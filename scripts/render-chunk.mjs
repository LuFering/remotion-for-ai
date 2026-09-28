// Renders one frame range of the composition.
//
// Runs on its own CI machine; the stitch job concatenates the results. Video
// and audio go to separate files because that is what `combineChunks()` wants,
// and `h264-ts` is the codec that can be concatenated without re-encoding.
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import {
  chromiumOptions,
  COMPOSITION_ID,
  concurrencyFromEnv,
  entryPoint,
  intFromEnv,
  outDir,
  publicDir,
} from './lib.mjs';

const index = intFromEnv('CHUNK_INDEX');
const start = intFromEnv('CHUNK_START');
const end = intFromEnv('CHUNK_END');

const serveUrl = await bundle({ entryPoint, publicDir, chromiumOptions });
const composition = await selectComposition({
  serveUrl,
  id: COMPOSITION_ID,
  chromiumOptions,
});

const videoOutput = path.join(outDir, `chunk-${index}.ts`);
const audioOutput = path.join(outDir, `chunk-${index}.aac`);

console.log(
  `chunk ${index}: frames ${start}-${end} (${end - start + 1} frames) -> ${videoOutput}`,
);

let lastLogged = -1;

await renderMedia({
  serveUrl,
  composition,
  codec: 'h264-ts',
  frameRange: [start, end],
  separateAudioTo: audioOutput,
  audioCodec: 'aac',
  // Pads each chunk's audio so the chunks concatenate without a gap at the
  // seams. Both of these are required for a chunked render.
  forSeamlessAacConcatenation: true,
  enforceAudioTrack: true,
  // The first frame of the *overall* range, so every chunk agrees on where the
  // timeline starts.
  compositionStart: 0,
  imageFormat: 'jpeg',
  chromiumOptions,
  concurrency: concurrencyFromEnv(),
  outputLocation: videoOutput,
  onProgress: ({ progress }) => {
    const percent = Math.floor(progress * 10) * 10;
    if (percent > lastLogged) {
      lastLogged = percent;
      console.log(`chunk ${index}: ${percent}%`);
    }
  },
});

console.log(`chunk ${index}: done`);
