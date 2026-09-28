import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { TOKEN_LEAD_FRAMES, TOKEN_REVEAL_FRAMES } from './videos';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/**
 * Full-black card with "Token" resolving out of a blur, as if the word is being
 * read slowly. Reveal takes `TOKEN_REVEAL_FRAMES` (~0.9s).
 */
export const TokenOutro: React.FC = () => {
  const frame = useCurrentFrame();

  const reveal = interpolate(
    frame,
    [TOKEN_LEAD_FRAMES, TOKEN_LEAD_FRAMES + TOKEN_REVEAL_FRAMES],
    [0, 1],
    {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    },
  );

  const opacity = interpolate(reveal, [0, 0.35, 1], [0, 0.72, 1], clamp);
  const blur = interpolate(reveal, [0, 1], [30, 0]);
  const scale = interpolate(reveal, [0, 1], [1.09, 1]);
  const tracking = interpolate(reveal, [0, 1], [0.17, 0.012]);
  const glow = interpolate(reveal, [0, 0.72, 1], [0, 1.1, 0.8], clamp);
  const halo = interpolate(reveal, [0, 1], [0, 0.55], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 52% at 50% 50%, rgba(120,168,255,${
            0.13 * halo
          }) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Inter, "Inter Display", "Arial Black", sans-serif',
            fontWeight: 900,
            fontSize: 208,
            lineHeight: 1,
            letterSpacing: `${tracking.toFixed(4)}em`,
            // letter-spacing adds a trailing gap; pull it back so the word
            // stays optically centred.
            marginRight: `${(-tracking).toFixed(4)}em`,
            color: '#FFFFFF',
            opacity,
            transform: `scale(${scale.toFixed(4)})`,
            filter: `blur(${blur.toFixed(2)}px)`,
            textShadow: [
              `0 0 ${(16 * glow).toFixed(1)}px rgba(255,255,255,${(0.55 * glow).toFixed(3)})`,
              `0 0 ${(86 * glow).toFixed(1)}px rgba(140,190,255,${(0.4 * glow).toFixed(3)})`,
              `0 0 ${(220 * glow).toFixed(1)}px rgba(90,140,255,${(0.22 * glow).toFixed(3)})`,
            ].join(', '),
          }}
        >
          Token
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
