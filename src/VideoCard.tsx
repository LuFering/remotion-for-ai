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
  CARD,
  COLORS,
  getPlayFrames,
  VIDEO_PLAYBACK_DELAY_FRAMES,
  type CardConfig,
} from './videos';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

type VideoCardProps = Pick<
  CardConfig,
  | 'src'
  | 'startFrom'
  | 'posterSrc'
  | 'stillSrc'
  | 'usableFrames'
  | 'playbackRate'
  | 'targetX'
  | 'targetY'
  | 'targetScale'
  | 'targetRotation'
  | 'zIndex'
>;

export const VideoCard: React.FC<VideoCardProps> = ({
  src,
  startFrom,
  posterSrc,
  stillSrc,
  usableFrames,
  playbackRate,
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
    durationInFrames: CARD.entryFrames,
    config: {
      damping: 15,
      stiffness: 145,
      mass: 0.86,
    },
  });

  const x = interpolate(entry, [0, 1], [0, targetX], clamp);
  const y = interpolate(entry, [0, 1], [70, targetY], clamp);
  const rotation = interpolate(
    entry,
    [0, 0.64, 1],
    [-3, 2, targetRotation],
    clamp,
  );
  const opacity = interpolate(
    frame,
    [0, 4, CARD.entryFrames],
    [0, 0.88, 1],
    {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );
  const scaleCurve = interpolate(
    frame,
    [0, 12, CARD.entryFrames],
    [0.28, 1.05, 1],
    {
      ...clamp,
      easing: Easing.bezier(0.18, 1, 0.32, 1),
    },
  );

  const playFrames = getPlayFrames({ usableFrames, playbackRate });

  const settled = frame >= CARD.entryFrames;
  const breatheY = settled
    ? Math.sin(((frame - CARD.entryFrames) / 110) * Math.PI * 2) * 3
    : 0;

  // The poster hands over to the running clip with a short cross-fade so the
  // first decoded frame is already underneath before the poster disappears.
  const posterOpacity = interpolate(
    frame,
    [VIDEO_PLAYBACK_DELAY_FRAMES - 2, VIDEO_PLAYBACK_DELAY_FRAMES + 2],
    [1, 0],
    clamp,
  );
  // Reach full opacity on the last frame of the clip (not after it), so the
  // dark checker tail of the source can never flash through.
  const stillOpacity = stillSrc
    ? interpolate(
        frame,
        [
          VIDEO_PLAYBACK_DELAY_FRAMES + playFrames - 4,
          VIDEO_PLAYBACK_DELAY_FRAMES + playFrames - 1,
        ],
        [0, 1],
        clamp,
      )
    : 0;

  const mediaStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'block',
    width: '100%',
    height: '100%',
  };

  const imageStyle: React.CSSProperties = {
    ...mediaStyle,
    objectFit: 'cover',
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: (CANVAS.width - CARD.width) / 2,
        top: (CANVAS.height - CARD.height) / 2,
        width: CARD.width,
        height: CARD.height,
        zIndex,
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: `${CARD.border}px solid ${COLORS.card}`,
        borderRadius: CARD.radius,
        backgroundColor: COLORS.card,
        boxShadow: '0 15px 35px rgba(0,0,0,0.25)',
        opacity,
        translate: `${(x / 100) * CANVAS.width}px ${(y / 100) * CANVAS.height + breatheY}px`,
        scale: targetScale * scaleCurve,
        rotate: `${rotation}deg`,
        transformOrigin: '50% 50%',
      }}
    >
      <CanvasImage
        src={posterSrc}
        style={{
          ...imageStyle,
          opacity: posterOpacity,
        }}
      />

      <Sequence
        from={VIDEO_PLAYBACK_DELAY_FRAMES}
        durationInFrames={playFrames}
      >
        <Video
          src={src}
          trimBefore={startFrom}
          trimAfter={startFrom + usableFrames}
          playbackRate={playbackRate}
          muted
          objectFit="cover"
          style={mediaStyle}
        />
      </Sequence>

      {stillSrc ? (
        <CanvasImage
          src={stillSrc}
          style={{
            ...imageStyle,
            opacity: stillOpacity,
          }}
        />
      ) : null}
    </div>
  );
};
