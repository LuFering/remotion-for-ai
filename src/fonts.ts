import { INTER_BLACK_WOFF2 } from './font-data';

/**
 * Pins `Inter` at weight 900 for the Token outro.
 *
 * Inter is installed on some machines and not on others — the GitHub runner has
 * no Inter at all, so without pinning it the word silently falls back to DejaVu
 * Sans and the render stops matching what was designed.
 *
 * This deliberately does NOT use `@remotion/fonts`' `loadFont()`. That helper
 * wraps the load in `delayRender()`, and the handle is created at module scope —
 * i.e. in every browser tab Remotion opens, including the ones it never renders
 * a frame in. Those tabs never clear the handle, so its 28s timer eventually
 * fires in the middle of a long render:
 *
 *   A delayRender() "Loading font Inter (…)" was called but not cleared after 28000ms
 *
 * A plain `@font-face` has no such deadline: Remotion awaits
 * `document.fonts.ready` after seeking to every frame (see the renderer's
 * seek-to-frame), so the frame is still never captured before the font is
 * ready. The font itself is inlined as a data: URL by `scripts/build-font.mjs`
 * so there is no request to queue behind the video and still fetches either.
 *
 * The asset is Google Fonts' `latin` subset of Inter 900 — SIL OFL 1.1, see
 * `public/fonts/OFL.txt`.
 */
const STYLE_ID = 'remotion-inter-black-900';

const installInterBlack = (): void => {
  // Renders run in a browser; this keeps the module safe if it is ever imported
  // somewhere else.
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@font-face {
  font-family: 'Inter';
  src: url('${INTER_BLACK_WOFF2}') format('woff2');
  font-weight: 900;
  font-style: normal;
  font-display: block;
}`;
  document.head.appendChild(style);

  // Start the load now so the `document.fonts.ready` await that Remotion does
  // after seeking to a frame has something to wait for.
  void document.fonts.load("900 16px 'Inter'");
};

installInterBlack();
