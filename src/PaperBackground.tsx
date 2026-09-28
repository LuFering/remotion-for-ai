import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from './videos';

export const PaperBackground: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.canvas,
        backgroundImage: `
          radial-gradient(circle at 18% 16%, ${COLORS.paperHighlight}, transparent 31%),
          radial-gradient(circle at 84% 82%, ${COLORS.paperShadow}, transparent 36%),
          linear-gradient(135deg, rgba(255,255,255,0.12), rgba(0,0,0,0.035))
        `,
      }}
    >
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.055,
          mixBlendMode: 'multiply',
        }}
      >
        <filter id="paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.86"
            numOctaves="3"
            seed="17"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1920" height="1080" filter="url(#paper-grain)" />
      </svg>

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.13) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
