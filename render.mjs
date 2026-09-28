import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import { renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(root, 'src/index.ts');
const alpha = !process.argv.includes('--no-alpha');
const compositionId = alpha ? 'AlbumStackAlpha' : 'AlbumStack';

const output =
  process.argv[2] ?? path.join(root, 'out/AlbumStackAlpha.mov');

// yuva444p10le + ProRes 4444 is the combination that carries alpha through.
const alphaOptions = alpha
  ? {
      codec: 'prores',
      proResProfile: '4444',
      pixelFormat: 'yuva444p10le',
      imageFormat: 'png',
    }
  : { codec: 'h264', imageFormat: 'jpeg', pixelFormat: undefined, proResProfile: undefined };

const chromiumOptions = {
  gl: 'swangle',
};

// How many browser tabs render in parallel. Remotion's default is half of the
// CPU threads, which leaves a 4-core CI runner half idle; the workflow passes
// REMOTION_CONCURRENCY=100% to use every thread. Accepts "4" or "100%".
const concurrencyInput = process.env.REMOTION_CONCURRENCY?.trim();
const concurrency = !concurrencyInput
  ? null
  : /^\d+$/.test(concurrencyInput)
    ? Number(concurrencyInput)
    : concurrencyInput;

const serveUrl = await bundle({
  entryPoint,
  publicDir: path.join(root, 'public'),
  chromiumOptions,
  onProgress: (progress) => {
    if (progress % 25 === 0) console.log(`bundling ${Math.round(progress)}%`);
  },
});

const composition = await selectComposition({
  serveUrl,
  id: compositionId,
  chromiumOptions,
});

console.log(
  `rendering ${composition.id} ${composition.width}x${composition.height} ` +
    `@${composition.fps}fps ${composition.durationInFrames} frames -> ${output}`,
);

await renderMedia({
  serveUrl,
  composition,
  codec: alphaOptions.codec,
  proResProfile: alphaOptions.proResProfile,
  pixelFormat: alphaOptions.pixelFormat,
  imageFormat: alphaOptions.imageFormat,
  outputLocation: output,
  chromiumOptions,
  concurrency,
  alpha,
  onProgress: ({ progress }) => {
    console.log(`render ${Math.round(progress * 100)}%`);
  },
});

if (!alpha) {
  // Remotion's mp4 muxer writes an edit list with `media_time = 0` for the AAC
  // track, so the encoder's priming samples (~2048 @48kHz = ~43ms) are left in
  // front of the audio and the whole track plays late against the picture.
  // Trim the priming and re-mux (video is copied, audio is re-encoded once at
  // 320kbps) so the mp4 lines up exactly like the PCM alpha render does.
  const AAC_PRIMING_SAMPLES = 2048;
  const aligned = `${output}.aligned.mp4`;

  console.log(`aligning audio (trim ${AAC_PRIMING_SAMPLES} priming samples) -> ${output}`);
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      output,
      '-c:v',
      'copy',
      '-af',
      `atrim=start_sample=${AAC_PRIMING_SAMPLES},asetpts=N/SR/TB`,
      '-c:a',
      'aac',
      '-b:a',
      '320k',
      '-movflags',
      '+faststart',
      aligned,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  renameSync(aligned, output);
}

console.log(`done -> ${output}`);
