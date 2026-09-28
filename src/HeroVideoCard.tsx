import React from 'react';
import {
  CanvasImage,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Video } from '@remotion/media';
import {
  CANVAS,
  COLORS,
  HERO_CARD,
  HERO_EXPAND_FRAMES,
  HERO_HOLD_END_FRAME,
  HERO_PLAY_FRAMES,
  HERO_PLAYBACK_RATE,
  HERO_SOURCE_FRAMES,
  HERO_TAKEOFF_FRAME,
  HERO_VIDEO_CROP_SCALE,
  VIDEO_PLAYBACK_DELAY_FRAMES,
  type CardConfig,
} from './videos';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

type HeroVideoCardProps = Pick<
  CardConfig,
  | 'src'
  | 'startFrom'
  | 'posterSrc'
  | 'targetX'
  | 'targetY'
  | 'targetScale'
  | 'targetRotation'
  | 'zIndex'
>;

export const HeroVideoCard: React.FC<HeroVideoCardProps> = ({
  src,
  startFrom,
  posterSrc,
  targetX,
  targetY,
  targetScale,
  targetRotation,
  zIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({
    frame,
    fps,
    durationInFrames: HERO_CARD.entryFrames,
    config: {
      damping: 15,
      stiffness: 145,
      mass: 0.86,
    },
  });

  const entryX = interpolate(entry, [0, 1], [0, targetX], clamp);
  const entryY = interpolate(entry, [0, 1], [70, targetY], clamp);
  const entryRotation = interpolate(
    entry,
    [0, 0.64, 1],
    [-3, 2, targetRotation],
    clamp,
  );
  const entryOpacity = interpolate(
    frame,
    [0, 4, HERO_CARD.entryFrames],
    [0, 0.88, 1],
    {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );
  const entryScale = interpolate(
    frame,
    [0, 12, HERO_CARD.entryFrames],
    [0.28, 1.05, 1],
    {
      ...clamp,
      easing: Easing.bezier(0.18, 1, 0.32, 1),
    },
  );

  const expansionStart = HERO_HOLD_END_FRAME - HERO_TAKEOFF_FRAME;
  const expansionFrame = Math.max(0, frame - expansionStart);
  const expansion = interpolate(
    expansionFrame,
    [0, HERO_EXPAND_FRAMES],
    [0, 1],
    {
      ...clamp,
      easing: Easing.inOut(Easing.cubic),
    },
  );

  const x = interpolate(expansion, [0, 1], [entryX, 0], clamp);
  const y = interpolate(expansion, [0, 1], [entryY, 0], clamp);
  const rotation = interpolate(expansion, [0, 1], [entryRotation, 0], clamp);
  const scale = interpolate(
    expansion,
    [0, 1],
    [targetScale * entryScale, 1],
    clamp,
  );
  const borderWidth = interpolate(expansion, [0, 1], [HERO_CARD.border, 0], clamp);
  const radius = interpolate(expansion, [0, 1], [HERO_CARD.radius, 0], clamp);
  const shadowOpacity = interpolate(expansion, [0, 1], [0.25, 0], clamp);

  const cropStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'block',
    width: `${HERO_VIDEO_CROP_SCALE * 100}%`,
    height: `${HERO_VIDEO_CROP_SCALE * 100}%`,
    left: `${((1 - HERO_VIDEO_CROP_SCALE) / 2) * 100}%`,
    top: `${((1 - HERO_VIDEO_CROP_SCALE) / 2) * 100}%`,
  };

  const cropImageStyle: React.CSSProperties = {
    ...cropStyle,
    objectFit: 'cover',
  };

  // Short cross-fade into the running clip so the first decoded frame is
  // already underneath before the poster disappears.
  const posterOpacity = interpolate(
    frame,
    [VIDEO_PLAYBACK_DELAY_FRAMES - 2, VIDEO_PLAYBACK_DELAY_FRAMES + 2],
    [1, 0],
    clamp,
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: HERO_CARD.width,
        height: HERO_CARD.height,
        zIndex,
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: `${borderWidth}px solid ${COLORS.card}`,
        borderRadius: radius,
        backgroundColor: COLORS.card,
        boxShadow: `0 18px 45px rgba(0,0,0,${shadowOpacity})`,
        opacity: entryOpacity,
        translate: `${(x / 100) * CANVAS.width}px ${(y / 100) * CANVAS.height}px`,
        scale,
        rotate: `${rotation}deg`,
        transformOrigin: '50% 50%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        <CanvasImage
          src={posterSrc}
          style={{
            ...cropImageStyle,
            opacity: posterOpacity,
          }}
        />

        <Sequence
          from={VIDEO_PLAYBACK_DELAY_FRAMES}
          durationInFrames={HERO_PLAY_FRAMES}
        >
          <Video
            src={src}
            trimBefore={startFrom}
            trimAfter={HERO_SOURCE_FRAMES}
            playbackRate={HERO_PLAYBACK_RATE}
            muted
            objectFit="cover"
            style={cropStyle}
          />
        </Sequence>
      </div>
    </div>
  );
};
