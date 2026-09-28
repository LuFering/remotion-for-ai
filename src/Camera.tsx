import React from 'react';
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CAMERA_FOCUS_STRENGTH,
  CAMERA_FOCUS_ZOOM,
  CANVAS,
  CARD,
  HERO_CARD,
  videos,
} from './videos';

type CameraKey = { frame: number; x: number; y: number; zoom: number };

const NEUTRAL: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 };

/**
 * Framing for one focused card.
 *
 * A card sits `target` px away from the canvas centre. Panning the camera
 * centre `FOCUS_STRENGTH` of the way towards it (and zooming to
 * `FOCUS_ZOOM`) pulls the card that much closer to the middle of frame while
 * everything grows, which is what reads as a push-in.
 */
const focusOn = (targetX: number, targetY: number) => ({
  x: -(targetX / 100) * CANVAS.width * CAMERA_FOCUS_STRENGTH * CAMERA_FOCUS_ZOOM,
  y: -(targetY / 100) * CANVAS.height * CAMERA_FOCUS_STRENGTH * CAMERA_FOCUS_ZOOM,
  zoom: CAMERA_FOCUS_ZOOM,
});

const buildKeys = (): CameraKey[] => {
  const supporting = videos.filter((card) => !card.isHero);
  const hero = videos.find((card) => card.isHero);

  if (!hero) {
    throw new Error('Camera requires one card with isHero: true.');
  }

  const keys: CameraKey[] = [{ frame: 0, ...NEUTRAL }];
  let current = { ...NEUTRAL };

  for (const card of supporting) {
    // Hold the previous framing until this card takes off...
    keys.push({ frame: card.startFrame, ...current });
    // ...then travel with it and settle exactly when the card lands.
    current = focusOn(card.targetX, card.targetY);
    keys.push({ frame: card.startFrame + CARD.entryFrames, ...current });
  }

  // The hero flies in at the centre: pull the camera back to neutral while it
  // travels, so the full-canvas expansion happens on the untouched framing.
  keys.push({ frame: hero.startFrame, ...current });
  keys.push({ frame: hero.startFrame + HERO_CARD.entryFrames, ...NEUTRAL });

  return keys;
};

const CAMERA_KEYS = buildKeys();

const stateAt = (frame: number, fps: number): { x: number; y: number; zoom: number } => {
  if (frame <= CAMERA_KEYS[0].frame) {
    return NEUTRAL;
  }

  for (let i = 1; i < CAMERA_KEYS.length; i++) {
    const from = CAMERA_KEYS[i - 1];
    const to = CAMERA_KEYS[i];

    if (frame <= to.frame) {
      const span = to.frame - from.frame;
      const progress =
        span <= 0
          ? 1
          : spring({
              frame: frame - from.frame,
              fps,
              durationInFrames: span,
              config: { damping: 16, stiffness: 150, mass: 0.9 },
            });

      return {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
        zoom: from.zoom + (to.zoom - from.zoom) * progress,
      };
    }
  }

  return NEUTRAL;
};

/**
 * Overscan keeps the paper background covering the canvas while the camera is
 * panned to a corner. Worst case travel is ~330px, this gives ~560px of slack.
 */
export const CAMERA_BACKGROUND_OVERSCAN = 1.3;

export const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { x, y, zoom } = stateAt(frame, fps);

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${zoom.toFixed(5)})`,
        transformOrigin: '50% 50%',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
