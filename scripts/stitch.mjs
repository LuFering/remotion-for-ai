// Concatenates the rendered chunks into the final mp4.
//
// `combineChunks()` is Remotion's own public API for exactly this ("Combine
// multiple video chunks, useful for decentralized rendering") — it remuxes the
// h264-ts video without re-encoding and lines the AAC chunks up on the sample
// grid, which is the part that is easy to get subtly wrong by hand.
import { combineChunks } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { intFromEnv, outDir, projectRoot } from './lib.mjs';

/**
 * Remotion ships its own ffmpeg inside the compositor package, so the stitch
 * job does not have to apt-install one. Falls back to PATH if it is missing.
 */
const findFfmpeg = () => {
  const scope = path.join(projectRoot, 'node_modules/@remotion');
  if (existsSync(scope)) {
    for (const entry of readdirSync(scope)) {
      if (!entry.startsWith('compositor-')) {
        continue;
      }
      const binary = path.join(
        scope,
        entry,
        process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
      );
      if (existsSync(binary)) {
        return binary;
      }
    }
  }
  return 'ffmpeg';
};

const durationInFrames = intFromEnv('DURATION_IN_FRAMES');
const framesPerChunk = intFromEnv('FRAMES_PER_CHUNK');
const fps = intFromEnv('FPS');

const chunksDir = process.env.CHUNKS_DIR
  ? path.resolve(process.env.CHUNKS_DIR)
  : path.join(outDir, 'chunks');

const indices = readdirSync(chunksDir)
  .map((file) => /^chunk-(\d+)\.ts$/.exec(file))
  .filter(Boolean)
  .map((match) => Number(match[1]))
  .sort((a, b) => a - b);

if (indices.length === 0) {
  throw new Error(`no chunk-*.ts files found in ${chunksDir}`);
}

indices.forEach((index, position) => {
  if (index !== position) {
    throw new Error(
      `chunk ${position} is missing — found chunks ${indices.join(', ')}`,
    );
  }
  for (const extension of ['ts', 'aac']) {
    const file = path.join(chunksDir, `chunk-${index}.${extension}`);
    if (!existsSync(file)) {
      throw new Error(`missing ${file}`);
    }
  }
});

const videoFiles = indices.map((index) =>
  path.join(chunksDir, `chunk-${index}.ts`),
);
const audioFiles = indices.map((index) =>
  path.join(chunksDir, `chunk-${index}.aac`),
);

console.log(
  `stitching ${indices.length} chunks (${durationInFrames} frames @ ${fps}fps, ${framesPerChunk} frames/chunk)`,
);

let lastLogged = -1;

await combineChunks({
  outputLocation: path.join(outDir, 'AlbumStack.mp4'),
  codec: 'h264',
  fps,
  framesPerChunk,
  compositionDurationInFrames: durationInFrames,
  preferLossless: false,
  audioCodec: 'aac',
  audioBitrate: '320k',
  sampleRate: 48000,
  videoFiles,
  audioFiles,
  onProgress: ({ totalProgress }) => {
    const percent = Math.floor(totalProgress * 10) * 10;
    if (percent > lastLogged) {
      lastLogged = percent;
      console.log(`stitch: ${percent}%`);
    }
  },
});

// `combineChunks()` muxes the concatenated AAC with `-c:a copy`, so the first
// chunk's encoder priming survives into the output and the whole audio track
// ends up ~43ms (2048 samples @48kHz) behind the picture. `render.mjs` has to
// work around the same thing for a normal render — trim the priming and
// re-encode the audio once, exactly like it does.
const rawOutput = path.join(outDir, 'AlbumStack.mp4');
const alignedOutput = path.join(outDir, 'AlbumStack.aligned.mp4');
const ffmpeg = findFfmpeg();

console.log(`aligning audio (trim 2048 priming samples) with ${ffmpeg}`);

execFileSync(
  ffmpeg,
  [
    '-v', 'error',
    '-y',
    '-i', rawOutput,
    '-c:v', 'copy',
    '-af', 'atrim=start_sample=2048,asetpts=N/SR/TB',
    '-c:a', 'aac',
    '-b:a', '320k',
    '-movflags', '+faststart',
    alignedOutput,
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

renameSync(alignedOutput, rawOutput);

console.log(`stitched -> ${rawOutput}`);
