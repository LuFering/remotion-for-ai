// Splits the composition into equal chunks and publishes the plan.
//
// In CI the plan goes to `$GITHUB_OUTPUT` (the workflow feeds it to the job
// matrix); locally it is printed as JSON.
//
// Every chunk must render the same number of frames except the last one — a
// rule of Remotion's distributed rendering blueprint:
// https://www.remotion.dev/docs/distributed-rendering
import { bundle } from '@remotion/bundler';
import { selectComposition } from '@remotion/renderer';
import { appendFileSync } from 'node:fs';
import {
  chromiumOptions,
  COMPOSITION_ID,
  entryPoint,
  publicDir,
} from './lib.mjs';

const arg = process.argv.find((value) => value.startsWith('--chunks='));
const requested = arg ? Number(arg.slice('--chunks='.length)) : 8;

if (!Number.isInteger(requested) || requested < 1) {
  throw new Error(`--chunks must be a positive integer, got ${JSON.stringify(arg)}`);
}

const serveUrl = await bundle({ entryPoint, publicDir, chromiumOptions });
const composition = await selectComposition({
  serveUrl,
  id: COMPOSITION_ID,
  chromiumOptions,
});

const total = composition.durationInFrames;
const count = Math.min(requested, total);
const framesPerChunk = Math.ceil(total / count);

const chunks = [];
for (let index = 0; index * framesPerChunk < total; index += 1) {
  const start = index * framesPerChunk;
  chunks.push({
    index,
    start,
    end: Math.min(start + framesPerChunk - 1, total - 1),
  });
}

const plan = {
  compositionId: composition.id,
  durationInFrames: total,
  fps: composition.fps,
  width: composition.width,
  height: composition.height,
  framesPerChunk,
  chunks,
};

if (process.env.GITHUB_OUTPUT) {
  const lines = [
    `chunks=${JSON.stringify(chunks)}`,
    `frames_per_chunk=${framesPerChunk}`,
    `duration_in_frames=${total}`,
    `fps=${composition.fps}`,
  ];
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  console.log(`planned ${chunks.length} chunks of ${framesPerChunk} frames (${total} total)`);
} else {
  console.log(JSON.stringify(plan, null, 2));
}
