import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import {
  TV_OFF_COLLAPSE_FRAMES,
  TV_OFF_END_FRAME,
  TV_OFF_SHRINK_FRAMES,
  TV_OFF_START_FRAME,
} from './videos';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

const COLLAPSE_END = TV_OFF_START_FRAME + TV_OFF_COLLAPSE_FRAMES;
const SHRINK_END = COLLAPSE_END + TV_OFF_SHRINK_FRAMES;

/**
 * CRT power-off. Everything inside is squashed vertically into a bright line,
 * the line is then squeezed horizontally into a dot which glows out, leaving
 * pure black behind.
 */
export const TvOff: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();

  const collapse = interpolate(
    frame,
    [TV_OFF_START_FRAME, COLLAPSE_END],
    [1, 0.008],
    { ...clamp, easing: Easing.in(Easing.cubic) },
  );
  const shrink = interpolate(
    frame,
    [COLLAPSE_END, SHRINK_END],
    [1, 0.0015],
    { ...clamp, easing: Easing.in(Easing.quad) },
  );
  const brightness = interpolate(
    frame,
    [TV_OFF_START_FRAME, COLLAPSE_END],
    [1, 3.4],
    { ...clamp, easing: Easing.in(Easing.quad) },
  );
  // The "room" goes dark as the tube dies.
  const blackout = interpolate(
    frame,
    [TV_OFF_START_FRAME, TV_OFF_START_FRAME + 6],
    [0, 1],
    clamp,
  );
  const glow = interpolate(
    frame,
    [
      TV_OFF_START_FRAME + TV_OFF_COLLAPSE_FRAMES * 0.5,
      COLLAPSE_END,
      SHRINK_END,
      TV_OFF_END_FRAME,
    ],
    [0, 0.85, 1, 0],
    clamp,
  );
  const contentOpacity = interpolate(
    frame,
    [SHRINK_END, TV_OFF_END_FRAME],
    [1, 0],
    clamp,
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${shrink.toFixed(5)}, ${collapse.toFixed(5)})`,
          transformOrigin: '50% 50%',
          opacity: contentOpacity,
          filter: brightness > 1.001 ? `brightness(${brightness.toFixed(3)})` : undefined,
        }}
      >
        {children}
      </AbsoluteFill>

      {/* Room lights out: sits over the picture so the tube dies into black. */}
      <AbsoluteFill style={{ backgroundColor: '#000000', opacity: blackout }} />

      {/* The bright line / dot left behind by the collapsing picture. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${(shrink * 100).toFixed(4)}%`,
          height: 10,
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#FFFFFF',
          opacity: glow,
          boxShadow:
            '0 0 34px 12px rgba(255,255,255,0.92), 0 0 140px 54px rgba(150,190,255,0.5)',
        }}
      />
    </AbsoluteFill>
  );
};
