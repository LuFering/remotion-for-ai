import React from 'react';
import { AbsoluteFill, interpolate, Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import { CAMERA_BACKGROUND_OVERSCAN, Camera } from './Camera';
import { HeroVideoCard } from './HeroVideoCard';
import { PaperBackground } from './PaperBackground';
import { TokenOutro } from './TokenOutro';
import { TvOff } from './TvOff';
import { VideoCard } from './VideoCard';
import {
  COLORS,
  getAudioFrames,
  HERO_PLAY_FRAMES,
  HERO_PLAYBACK_RATE,
  HERO_SOURCE_FRAMES,
  MAIN_AUDIO_SRC,
  SILENCE_AUDIO_SRC,
  TOTAL_FRAMES,
  TV_OFF_AUDIO_SRC,
  TV_OFF_END_FRAME,
  TV_OFF_START_FRAME,
  VIDEO_PLAYBACK_DELAY_FRAMES,
  videos,
} from './videos';

export type AlbumStackProps = {
  /** Omit the paper background so ProRes 4444 carries transparency. */
  transparent?: boolean;
  /** Keep this true unless audio is being handled in a separate NLE track. */
  includeAudio?: boolean;
};

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const AlbumStack: React.FC<AlbumStackProps> = ({
  transparent = false,
  includeAudio = true,
}) => {
  const supportingCards = videos.filter((card) => !card.isHero);
  const hero = videos.find((card) => card.isHero);

  if (!hero) {
    throw new Error('AlbumStack requires one card with isHero: true.');
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? 'transparent' : COLORS.canvas,
      }}
    >
      <Sequence from={0} durationInFrames={TV_OFF_END_FRAME}>
        <TvOff>
          <Camera>
            {!transparent ? (
              // Overscan the paper so a panned/zoomed camera never exposes an edge.
              <div
                style={{
                  position: 'absolute',
                  left: `${((1 - CAMERA_BACKGROUND_OVERSCAN) / 2) * 100}%`,
                  top: `${((1 - CAMERA_BACKGROUND_OVERSCAN) / 2) * 100}%`,
                  width: `${CAMERA_BACKGROUND_OVERSCAN * 100}%`,
                  height: `${CAMERA_BACKGROUND_OVERSCAN * 100}%`,
                }}
              >
                <PaperBackground />
              </div>
            ) : null}

        {supportingCards.map((card) => (
        <Sequence
          key={card.id}
          from={card.startFrame}
          durationInFrames={TOTAL_FRAMES - card.startFrame}
        >
          <VideoCard
            src={staticFile(card.src)}
            startFrom={card.startFrom}
            posterSrc={staticFile(card.posterSrc)}
            stillSrc={card.stillSrc ? staticFile(card.stillSrc) : undefined}
            usableFrames={card.usableFrames}
            playbackRate={card.playbackRate}
            targetX={card.targetX}
            targetY={card.targetY}
            targetScale={card.targetScale}
            targetRotation={card.targetRotation}
            zIndex={card.zIndex}
          />
        </Sequence>
      ))}

      <Sequence
        from={hero.startFrame}
        durationInFrames={TOTAL_FRAMES - hero.startFrame}
      >
        <HeroVideoCard
          src={staticFile(hero.src)}
          startFrom={hero.startFrom}
          posterSrc={staticFile(hero.posterSrc)}
          targetX={hero.targetX}
          targetY={hero.targetY}
          targetScale={hero.targetScale}
          targetRotation={hero.targetRotation}
          zIndex={hero.zIndex}
        />
      </Sequence>

          </Camera>
        </TvOff>
      </Sequence>

      <Sequence
        from={TV_OFF_END_FRAME}
        durationInFrames={TOTAL_FRAMES - TV_OFF_END_FRAME}
      >
        <TokenOutro />
      </Sequence>

      {includeAudio ? (
        <>
          {supportingCards.map((card) => {
            // The picture stops at the last clean video frame, but the voice
            // runs a little longer, so the audio is allowed to finish over the
            // frozen still instead of being cut mid-word.
            const audioFrames = getAudioFrames(card);

            return (
              <Sequence
                key={`audio-${card.id}`}
                from={card.startFrame + VIDEO_PLAYBACK_DELAY_FRAMES}
                durationInFrames={audioFrames}
              >
                <Audio
                  src={staticFile(card.audioSrc)}
                  volume={(audioFrame) =>
                    interpolate(
                      audioFrame,
                      [0, 4, audioFrames - 4, audioFrames],
                      [0, 0.52, 0.52, 0],
                      clamp,
                    )
                  }
                />
              </Sequence>
            );
          })}

          <Sequence
            from={hero.startFrame + VIDEO_PLAYBACK_DELAY_FRAMES}
            durationInFrames={HERO_PLAY_FRAMES}
          >
            <Audio
              src={staticFile(MAIN_AUDIO_SRC)}
              trimAfter={HERO_SOURCE_FRAMES}
              playbackRate={HERO_PLAYBACK_RATE}
              volume={(audioFrame) =>
                interpolate(
                  audioFrame,
                  [0, 4, HERO_PLAY_FRAMES - 8, HERO_PLAY_FRAMES],
                  [0, 1, 1, 0],
                  clamp,
                )
              }
            />
          </Sequence>

          <Sequence
            from={TV_OFF_START_FRAME}
            durationInFrames={TV_OFF_END_FRAME - TV_OFF_START_FRAME}
          >
            <Audio src={staticFile(TV_OFF_AUDIO_SRC)} volume={0.85} />
          </Sequence>

          {/* Keeps the exported audio track as long as the picture. */}
          <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
            <Audio src={staticFile(SILENCE_AUDIO_SRC)} />
          </Sequence>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
