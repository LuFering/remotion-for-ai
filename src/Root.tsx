import React from 'react';
import {
  type CalculateMetadataFunction,
  Composition,
} from 'remotion';
import { AlbumStack, type AlbumStackProps } from './AlbumStack';
import { CANVAS, TOTAL_FRAMES } from './videos';

const alphaMetadata: CalculateMetadataFunction<AlbumStackProps> = async () => {
  return {
    defaultCodec: 'prores',
    defaultVideoImageFormat: 'png',
    defaultPixelFormat: 'yuva444p10le',
    defaultProResProfile: '4444',
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AlbumStack"
        component={AlbumStack}
        durationInFrames={TOTAL_FRAMES}
        fps={CANVAS.fps}
        width={CANVAS.width}
        height={CANVAS.height}
        defaultProps={{
          transparent: false,
          includeAudio: true,
        }}
      />

      <Composition
        id="AlbumStackAlpha"
        component={AlbumStack}
        durationInFrames={TOTAL_FRAMES}
        fps={CANVAS.fps}
        width={CANVAS.width}
        height={CANVAS.height}
        defaultProps={{
          transparent: true,
          includeAudio: true,
        }}
        calculateMetadata={alphaMetadata}
      />
    </>
  );
};
