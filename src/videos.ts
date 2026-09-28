export type CardConfig = {
  id: number;
  src: string;
  /** Source frame to start from. Maps to Remotion's `trimBefore` (unit: FRAMES). */
  startFrom: number;
  /** First-frame image shown while the card is flying in. */
  posterSrc: string;
  /** Last-frame image shown after the source video ends. */
  stillSrc?: string;
  /** Horizontal target offset as a percentage of canvas width. */
  targetX: number;
  /** Vertical target offset as a percentage of canvas height. */
  targetY: number;
  /** Final scale applied to the card's base box. */
  targetScale: number;
  /** Final rotation in degrees. */
  targetRotation: number;
  zIndex: number;
  /** Global composition frame at which this card starts flying in. */
  startFrame: number;
  /** Number of valid source frames after `startFrom`, before black/checker frames. */
  usableFrames: number;
  /**
   * Source frame (exclusive) where the spoken line actually ends. The picture is
   * cut at `usableFrames`, but the voice usually runs a little longer, so the
   * audio gets its own end point and finishes over the frozen still.
   */
  audioEndFrame: number;
  /**
   * Pre-rendered, pitch-preserved audio for `startFrom .. audioEndFrame`.
   *
   * Remotion's `<Audio playbackRate>` uses Web Audio's `AudioBufferSourceNode`,
   * which speeds the clip up *and shifts the pitch*. These files were time
   * stretched offline with ffmpeg's `rubberband` filter, so they already run at
   * the card's tempo and can be played back at 1.0x with the original voice.
   */
  audioSrc: string;
  /** Small speed adjustment for smooth pacing. */
  playbackRate: number;
  isHero?: boolean;
};

export const CANVAS = {
  width: 1920,
  height: 1080,
  fps: 60,
} as const;

export const COLORS = {
  canvas: '#ABABAB',
  paperHighlight: 'rgba(255,255,255,0.24)',
  paperShadow: 'rgba(0,0,0,0.08)',
  ink: '#242424',
  card: '#FFFFFF',
} as const;

/** Base geometry for the four supporting cards. */
export const CARD = {
  width: 960,
  height: 600,
  border: 6,
  radius: 16,
  entryFrames: 24,
} as const;

/** The hero uses the full canvas as its base box, then scales down to 0.6. */
export const HERO_CARD = {
  width: CANVAS.width,
  height: CANVAS.height,
  border: 6,
  radius: 16,
  entryFrames: 24,
} as const;

export const ENTRY_FRAMES = CARD.entryFrames;

/**
 * Playback starts while the card is still flying in (the entry spring runs for
 * `CARD.entryFrames`), so the clip is already running by the time it lands.
 */
export const VIDEO_PLAYBACK_DELAY_FRAMES = 6;

/**
 * Cards take off one at a time. `TAKEOFF_INTERVAL_FRAMES` is the breathing room
 * between consecutive fly-ins: a card lands once `CARD.entryFrames` have
 * elapsed and then sits still for the remainder of the interval before the
 * next one starts. 48 frames @60fps = 0.4s fly-in + 0.4s settled.
 */
const FIRST_TAKEOFF_FRAME = 18;
export const TAKEOFF_INTERVAL_FRAMES = 48;
export const TAKEOFF_FRAMES = [
  FIRST_TAKEOFF_FRAME,
  FIRST_TAKEOFF_FRAME + TAKEOFF_INTERVAL_FRAMES,
  FIRST_TAKEOFF_FRAME + TAKEOFF_INTERVAL_FRAMES * 2,
  FIRST_TAKEOFF_FRAME + TAKEOFF_INTERVAL_FRAMES * 3,
  FIRST_TAKEOFF_FRAME + TAKEOFF_INTERVAL_FRAMES * 4,
] as const;

export const HERO_TAKEOFF_FRAME = TAKEOFF_FRAMES[4];
export const HERO_LANDING_FRAME = HERO_TAKEOFF_FRAME + HERO_CARD.entryFrames;

/**
 * How long the hero sits in its card form after landing, and how long the
 * expansion to full frame takes. Both are relative to the hero's own takeoff,
 * so retiming `TAKEOFF_FRAMES` can never push the expansion into the past.
 */
const HERO_HOLD_AFTER_LANDING_FRAMES = 38;
const HERO_EXPAND_LENGTH_FRAMES = 34;
export const HERO_HOLD_END_FRAME =
  HERO_LANDING_FRAME + HERO_HOLD_AFTER_LANDING_FRAMES;
export const HERO_EXPAND_END_FRAME =
  HERO_HOLD_END_FRAME + HERO_EXPAND_LENGTH_FRAMES;
export const HERO_EXPAND_FRAMES = HERO_EXPAND_END_FRAME - HERO_HOLD_END_FRAME;

export const HERO_SOURCE_FRAMES = 228;
export const HERO_PLAYBACK_RATE = 1.06;

/**
 * Number of composition frames a trimmed source clip occupies.
 *
 * `floor((usableFrames - 1) / playbackRate) + 1` guarantees the final sampled
 * source position stays at or before `startFrom + usableFrames - 1`, so the
 * dark transparent-checker tail that every source clip ends with can never be
 * pulled into the render by an off-by-one seek.
 */
export const getPlayFrames = (card: Pick<CardConfig, 'usableFrames' | 'playbackRate'>) =>
  Math.max(1, Math.floor((card.usableFrames - 1) / card.playbackRate) + 1);

/**
 * Composition frames a card's audio needs. Always at least as long as the
 * picture so the tail of the last word is never clipped by the video trim.
 */
export const getAudioFrames = (
  card: Pick<CardConfig, 'startFrom' | 'usableFrames' | 'playbackRate' | 'audioEndFrame'>,
) =>
  Math.max(
    getPlayFrames(card),
    Math.ceil((card.audioEndFrame - card.startFrom) / card.playbackRate),
  );

export const HERO_PLAY_FRAMES = getPlayFrames({
  usableFrames: HERO_SOURCE_FRAMES,
  playbackRate: HERO_PLAYBACK_RATE,
});

/** The hero source contains a baked-in transparent-checker border. */
export const HERO_VIDEO_CROP_SCALE = 1.14;

/**
 * The requested minimum was 320 frames. The hero starts at frame 142, begins
 * playing after a 6-frame delay and is sped up slightly to 1.06x so the whole
 * 3.8s clip fits without an over-long dark tail. The composition extends
 * automatically when the hero needs more room.
 */
/** Last composition frame the hero clip occupies (exclusive). */
export const HERO_PLAY_END_FRAME =
  HERO_TAKEOFF_FRAME + VIDEO_PLAYBACK_DELAY_FRAMES + HERO_PLAY_FRAMES;

/**
 * CRT power-off. The picture collapses vertically into a bright horizontal
 * line, the line shrinks into a dot, and the dot glows out. It starts a few
 * frames before the hero clip ends so the picture is still moving while it dies.
 */
export const TV_OFF_START_FRAME = HERO_PLAY_END_FRAME - 6;
export const TV_OFF_COLLAPSE_FRAMES = 9;
export const TV_OFF_SHRINK_FRAMES = 6;
export const TV_OFF_GLOW_FRAMES = 9;
export const TV_OFF_END_FRAME =
  TV_OFF_START_FRAME +
  TV_OFF_COLLAPSE_FRAMES +
  TV_OFF_SHRINK_FRAMES +
  TV_OFF_GLOW_FRAMES;

/** Synthesised CRT power-off: descending flyback whine + low thump. */
export const TV_OFF_AUDIO_SRC = 'audio/tv-off.wav';

/**
 * A deliberate beat of pure black between the TV dying and the word appearing,
 * so the reveal does not land on top of the power-off.
 */
export const TOKEN_LEAD_FRAMES = 48;
/** ~0.9s reveal, roughly the length of a slow "to-ken". */
export const TOKEN_REVEAL_FRAMES = 54;
/** Reveal + hold together make up 5.0s @60fps. */
export const TOKEN_TOTAL_FRAMES = 300;
export const TOKEN_HOLD_FRAMES = TOKEN_TOTAL_FRAMES - TOKEN_REVEAL_FRAMES;
export const TOKEN_START_FRAME = TV_OFF_END_FRAME + TOKEN_LEAD_FRAMES;
export const TOKEN_END_FRAME = TOKEN_START_FRAME + TOKEN_TOTAL_FRAMES;

export const TARGET_TOTAL_FRAMES = 320;
export const TOTAL_FRAMES = Math.max(TARGET_TOTAL_FRAMES, TOKEN_END_FRAME);

/**
 * Camera framing while a card is the focus: how far the framing travels towards
 * that card (0 = stay centred, 1 = centre the card) and how far it zooms in.
 * Kept below the background overscan so the paper never exposes an edge.
 */
export const CAMERA_FOCUS_STRENGTH = 0.55;
export const CAMERA_FOCUS_ZOOM = 1.22;

export const MAIN_AUDIO_SRC = 'audio/main.wav';

/**
 * Digital silence that spans the whole composition.
 *
 * Remotion sizes the exported audio track to the last *sample* it can find, so
 * once the CRT power-off sound decays there would be nothing left to hold the
 * track open: the mp4 would come out 13.3s of picture against 7.9s of audio.
 * Playing a silent source across the full duration keeps the track aligned.
 */
export const SILENCE_AUDIO_SRC = 'audio/silence.wav';

export const videos: CardConfig[] = [
  {
    id: 1,
    src: 'videos/1.mp4',
    audioSrc: 'audio/card1.wav',
    startFrom: 1,
    posterSrc: 'stills/1-poster.png',
    stillSrc: 'stills/1-still.png',
    targetX: -25,
    targetY: -20,
    targetScale: 0.5,
    targetRotation: -7,
    zIndex: 2,
    startFrame: TAKEOFF_FRAMES[0],
    usableFrames: 24,
    audioEndFrame: 33,
    playbackRate: 1.06,
  },
  {
    id: 2,
    src: 'videos/2.mp4',
    audioSrc: 'audio/card2.wav',
    startFrom: 2,
    posterSrc: 'stills/2-poster.png',
    stillSrc: 'stills/2-still.png',
    targetX: 24,
    targetY: -20,
    targetScale: 0.48,
    targetRotation: 6,
    zIndex: 3,
    startFrame: TAKEOFF_FRAMES[1],
    usableFrames: 32,
    audioEndFrame: 42,
    playbackRate: 1.05,
  },
  {
    id: 3,
    src: 'videos/3.mp4',
    audioSrc: 'audio/card3.wav',
    startFrom: 4,
    posterSrc: 'stills/3-poster.png',
    stillSrc: 'stills/3-still.png',
    targetX: -24,
    targetY: 20,
    targetScale: 0.52,
    targetRotation: 5,
    zIndex: 4,
    startFrame: TAKEOFF_FRAMES[2],
    usableFrames: 51,
    audioEndFrame: 63,
    playbackRate: 1.04,
  },
  {
    id: 4,
    src: 'videos/4.mp4',
    audioSrc: 'audio/card4.wav',
    startFrom: 3,
    posterSrc: 'stills/4-poster.png',
    stillSrc: 'stills/4-still.png',
    targetX: 25,
    targetY: 21,
    targetScale: 0.49,
    targetRotation: -6,
    zIndex: 5,
    startFrame: TAKEOFF_FRAMES[3],
    usableFrames: 24,
    audioEndFrame: 36,
    playbackRate: 1.06,
  },
  {
    id: 5,
    src: 'videos/黄仁勋.mp4',
    audioSrc: MAIN_AUDIO_SRC,
    startFrom: 0,
    posterSrc: 'stills/5-poster.png',
    targetX: 0,
    targetY: 0,
    targetScale: 0.6,
    targetRotation: 0,
    zIndex: 1000,
    startFrame: HERO_TAKEOFF_FRAME,
    usableFrames: HERO_SOURCE_FRAMES,
    audioEndFrame: HERO_SOURCE_FRAMES,
    playbackRate: HERO_PLAYBACK_RATE,
    isHero: true,
  },
];
