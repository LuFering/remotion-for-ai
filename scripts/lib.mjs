import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root — this file lives in `<root>/scripts/`. */
export const projectRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);

export const entryPoint = path.join(projectRoot, 'src/index.ts');
export const publicDir = path.join(projectRoot, 'public');
export const outDir = path.join(projectRoot, 'out');

/** Same GL setting `render.mjs` uses. */
export const chromiumOptions = { gl: 'swangle' };

/** The composition the distributed renderer splits into chunks. */
export const COMPOSITION_ID = 'AlbumStack';

/**
 * How many browser tabs render in parallel. Remotion's default is half of the
 * CPU threads; the workflow passes REMOTION_CONCURRENCY explicitly.
 * Accepts `"4"` or `"100%"`.
 */
export const concurrencyFromEnv = () => {
  const raw = process.env.REMOTION_CONCURRENCY?.trim();
  if (!raw) {
    return null;
  }
  return /^\d+$/.test(raw) ? Number(raw) : raw;
};

/** Reads a required integer environment variable. */
export const intFromEnv = (name) => {
  const raw = process.env[name];
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer, got ${JSON.stringify(raw)}`);
  }
  return value;
};
