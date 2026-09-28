import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');
// yuva444p10le is the pixel format that carries alpha through ProRes 4444.
Config.setPixelFormat('yuva444p10le');
Config.setCodec('prores');
Config.setProResProfile('4444');
Config.setOverwriteOutput(true);
