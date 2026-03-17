import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';
import { TONEMAP_ENABLED, TUNARR_ENV_VARS } from '@/util/env.js';
import { FileStreamSource } from '../../../../stream/types.ts';
import {
  EmptyFfmpegCapabilities,
  FfmpegCapabilities,
} from '../../capabilities/FfmpegCapabilities.ts';
import {
  VaapiEntrypoint,
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
  VaapiProfiles,
} from '../../capabilities/VaapiHardwareCapabilities.ts';
import {
  AudioFormats,
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
  VideoFormats,
} from '../../constants.ts';
import { PadFilter } from '../../filter/PadFilter.ts';
import { PadVaapiFilter } from '../../filter/vaapi/PadVaapiFilter.ts';
import { ScaleVaapiFilter } from '../../filter/vaapi/ScaleVaapiFilter.ts';
import { TonemapVaapiFilter } from '../../filter/vaapi/TonemapVaapiFilter.ts';
import {
  PixelFormatRgba,
  PixelFormatUnknown,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import {
  AudioInputFilterSource,
  AudioInputSource,
} from '../../input/AudioInputSource.ts';
import { LavfiVideoInputSource } from '../../input/LavfiVideoInputSource.ts';
import { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../../input/WatermarkInputSource.ts';
import {
  AudioStream,
  EmbeddedSubtitleStream,
  StillImageStream,
  SubtitleMethods,
  VideoStream,
} from '../../MediaStream.ts';
import { KnownFfmpegFilters } from '../../options/KnownFfmpegOptions.ts';
import { AudioState } from '../../state/AudioState.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
  PipelineOptions,
} from '../../state/FfmpegState.ts';
import { FrameState, FrameStateOpts } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { Pipeline } from '../Pipeline.ts';
import { VaapiPipelineBuilder } from './VaapiPipelineBuilder.ts';

describe('VaapiPipelineBuilder', () => {
  test('should work', () => {
    const capabilities = new VaapiHardwareCapabilities([]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
      null,
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
      }),
      DefaultPipelineOptions,
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, decoding disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
      null,
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareDecoding: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, encoding disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 0,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      // new SubtitlesInputSource(
      //   new FileStreamSource('/path/to/video.mkv'),
      //   [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
      //   SubtitleMethods.Burn,
      // ),
      null,
      null,
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareEncoding: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, filters disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: null,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
      null,
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('basic audio-only stream', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
      new Set(),
    );

    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/image.png'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
        pixelFormat: new PixelFormatRgba(),
      }),
    );

    const audio = AudioInputSource.withStream(
      new FileStreamSource('/path/to/song.flac'),
      AudioStream.create({
        channels: 2,
        codec: 'flac',
        index: 0,
      }),
      AudioState.create({
        audioBitrate: 192,
        audioBufferSize: 192 * 2,
        audioChannels: 2,
      }),
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      audio,
      null,
      null,
      null,
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });
});

describe('VaapiPipelineBuilder pad', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const fakeVersion = {
    versionString: 'n7.0.2',
    majorVersion: 7,
    minorVersion: 0,
    patchVersion: 2,
    isUnknown: false,
  };

  // 16:9 FHD video that exactly fills the target: no padding needed
  // squarePixelFrameSize(FHD) = 1920x1080 = paddedSize
  function create169FhdVideoStream(): VideoStream {
    return VideoStream.create({
      index: 0,
      codec: 'h264',
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.FHD,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: null,
    });
  }

  // 4:3 video that needs pillarboxing to fit in 16:9 FHD:
  // squarePixelFrameSize(FHD) = 1440x1080, paddedSize = 1920x1080
  function create43VideoStream(): VideoStream {
    return VideoStream.create({
      index: 0,
      codec: 'h264',
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.withDimensions(640, 480),
      displayAspectRatio: '4:3',
      providedSampleAspectRatio: null,
      colorFormat: null,
    });
  }

  function buildWithPad(opts: {
    videoStream: VideoStream;
    binaryCapabilities?: FfmpegCapabilities;
    disableHardwareDecoding?: boolean;
    disableHardwareEncoding?: boolean;
  }) {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);

    const binaryCapabilities =
      opts.binaryCapabilities ??
      new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.PadVaapi]),
        new Set(),
      );

    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      opts.videoStream,
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      null,
      null,
      null,
    );

    const state = FfmpegState.create({ version: fakeVersion });
    const videoStream = video.streams[0]!;

    return builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: videoStream.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      {
        ...DefaultPipelineOptions,
        vaapiDevice: '/dev/dri/renderD128',
        disableHardwareDecoding: opts.disableHardwareDecoding ?? false,
        disableHardwareEncoding: opts.disableHardwareEncoding ?? false,
      },
    );
  }

  test('uses pad_vaapi when capability is available and content is SDR', () => {
    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi=w=1920:h=1080');
    expect(args).not.toContain('pad=1920');
  });

  test('falls back to software pad when pad_vaapi capability is not available', () => {
    const pipeline = buildWithPad({
      videoStream: create43VideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).toContain('pad=1920:1080');
  });

  test('uses software pad for HDR content even when pad_vaapi capability is available', () => {
    const hdrStream = VideoStream.create({
      index: 0,
      codec: 'h264',
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.withDimensions(640, 480),
      displayAspectRatio: '4:3',
      providedSampleAspectRatio: null,
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithPad({ videoStream: hdrStream });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).toContain('pad=1920:1080');
  });

  test('pad_vaapi includes hwupload when frame data is in software', () => {
    const pipeline = buildWithPad({
      videoStream: create43VideoStream(),
      disableHardwareDecoding: true,
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi');
    const hwuploadIndex = args.indexOf('hwupload');
    const padVaapiIndex = args.indexOf('pad_vaapi');
    expect(hwuploadIndex).toBeGreaterThan(-1);
    expect(hwuploadIndex).toBeLessThan(padVaapiIndex);
  });

  test('falls back to software pad when TUNARR_DISABLE_VAAPI_PAD=true, even when pad_vaapi is available', () => {
    process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD] = 'true';

    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).toContain('pad=1920:1080');
  });

  test('falls back to software pad when TUNARR_DISABLE_VAAPI_PAD=true and only pad_opencl is available', () => {
    process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD] = 'true';

    const pipeline = buildWithPad({
      videoStream: create43VideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.PadOpencl]),
        new Set(),
      ),
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_opencl');
    expect(args).toContain('pad=1920:1080');
  });

  test('uses pad_vaapi when TUNARR_DISABLE_VAAPI_PAD is not set', () => {
    delete process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD];

    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi=w=1920:h=1080');
  });

  test('uses pad_vaapi when TUNARR_DISABLE_VAAPI_PAD=false', () => {
    process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD] = 'false';

    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi=w=1920:h=1080');
    expect(args).not.toContain('pad=1920:1080');
  });

  test('skips pad filter when current paddedSize already equals desired paddedSize (pad_vaapi available)', () => {
    // 16:9 FHD source fills the target frame exactly — no padding needed
    const pipeline = buildWithPad({ videoStream: create169FhdVideoStream() });

    const videoFilters =
      pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(videoFilters.some((f) => f instanceof PadVaapiFilter)).toBe(false);
    expect(videoFilters.some((f) => f instanceof PadFilter)).toBe(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).not.toContain('pad=');
  });

  test('skips pad filter when current paddedSize already equals desired paddedSize (no pad_vaapi capability)', () => {
    const pipeline = buildWithPad({
      videoStream: create169FhdVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    const videoFilters =
      pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(videoFilters.some((f) => f instanceof PadVaapiFilter)).toBe(false);
    expect(videoFilters.some((f) => f instanceof PadFilter)).toBe(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).not.toContain('pad=');
  });

  test('skips pad filter when current paddedSize already equals desired paddedSize (hardware decoding disabled)', () => {
    const pipeline = buildWithPad({
      videoStream: create169FhdVideoStream(),
      disableHardwareDecoding: true,
    });

    const videoFilters =
      pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(videoFilters.some((f) => f instanceof PadVaapiFilter)).toBe(false);
    expect(videoFilters.some((f) => f instanceof PadFilter)).toBe(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).not.toContain('pad=');
  });
});

describe('VaapiPipelineBuilder tonemap', () => {
  const originalEnv = process.env;
  const fakeVersion = {
    versionString: 'n7.0.2',
    majorVersion: 7,
    minorVersion: 0,
    patchVersion: 2,
    isUnknown: false,
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createHdrVideoStream(
    colorFormat: ColorFormat = new ColorFormat({
      colorRange: ColorRanges.Tv,
      colorSpace: ColorSpaces.Bt2020nc,
      colorPrimaries: ColorPrimaries.Bt2020,
      colorTransfer: ColorTransferFormats.Smpte2084,
    }),
  ): VideoStream {
    return VideoStream.create({
      index: 0,
      codec: 'hevc',
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: colorFormat,
    });
  }

  function buildWithTonemap(opts: {
    videoStream: VideoStream;
    binaryCapabilities?: FfmpegCapabilities;
    pipelineOptions?: Partial<PipelineOptions>;
    desiredState?: Partial<FrameStateOpts>;
  }): Pipeline {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.HevcMain10,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.HevcMain,
        VaapiEntrypoint.Encode,
      ),
    ]);

    const binaryCapabilities =
      opts.binaryCapabilities ??
      new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapOpencl]),
        new Set(),
      );

    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      opts.videoStream,
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      null,
      null,
      null,
    );

    const state = FfmpegState.create({ version: fakeVersion });

    const desiredState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatYuv420P(),
      videoFormat: VideoFormats.Hevc,
      ...(opts.desiredState ?? {}),
    });

    const pipeline = builder.build(state, desiredState, {
      ...DefaultPipelineOptions,
      ...(opts.pipelineOptions ?? {}),
      vaapiDevice: '/dev/dri/renderD128',
      vaapiPipelineOptions: {
        tonemapPreference: 'opencl',
        ...(opts.pipelineOptions?.vaapiPipelineOptions ?? {}),
      },
    });

    return pipeline;
  }

  function hasVaapiTonemapFilter(pipeline: Pipeline) {
    const filterChain =
      pipeline.getComplexFilter()?.filterChain.videoFilterSteps ?? [];
    return filterChain.some((filter) => filter instanceof TonemapVaapiFilter);
  }

  function hasOpenclTonemapFilter(pipeline: Pipeline) {
    const args = pipeline.getCommandArgs().join(' ');
    return args.includes('tonemap_opencl');
  }

  function hasSoftwareTonemapFilter(pipeline: Pipeline) {
    const args = pipeline.getCommandArgs().join(' ');
    return args.includes('zscale') && args.includes('tonemap=tonemap=hable');
  }

  test('applies tonemap filter for HDR10 (smpte2084) content', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(
        new ColorFormat({
          colorRange: ColorRanges.Tv,
          colorSpace: ColorSpaces.Bt2020nc,
          colorPrimaries: ColorPrimaries.Bt2020,
          colorTransfer: ColorTransferFormats.Smpte2084,
        }),
      ),
    });

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('tonemap_opencl=tonemap=hable');
    expect(args).toContain('hwmap=derive_device=opencl');
    expect(args).toContain('hwmap=derive_device=vaapi:reverse=1');
  });

  test('applies tonemap filter for HLG (arib-std-b67) content', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(
        new ColorFormat({
          colorRange: ColorRanges.Tv,
          colorSpace: ColorSpaces.Bt2020nc,
          colorPrimaries: ColorPrimaries.Bt2020,
          colorTransfer: ColorTransferFormats.AribStdB67,
        }),
      ),
    });

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
  });

  test('skips tonemap when TONEMAP_ENABLED is false', () => {
    process.env[TONEMAP_ENABLED] = 'false';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
    });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
  });

  test('skips tonemap when content is SDR', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const sdrStream = VideoStream.create({
      index: 0,
      codec: 'hevc',
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FHD,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt709,
        colorPrimaries: ColorPrimaries.Bt709,
        colorTransfer: ColorTransferFormats.Bt709,
      }),
    });

    const pipeline = buildWithTonemap({ videoStream: sdrStream });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
  });

  test('falls back to software tonemap when neither tonemap_vaapi nor tonemap_opencl is available', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('skips hardware tonemap but applies software tonemap when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      pipelineOptions: {
        disableHardwareFilters: true,
      },
    });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('tonemap filter appears before scale in the filter chain', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
    });

    const args = pipeline.getCommandArgs().join(' ');
    const tonemapIndex = args.indexOf('tonemap_opencl');
    const scaleIndex = args.indexOf('scale_vaapi');

    expect(tonemapIndex).toBeGreaterThan(-1);
    expect(scaleIndex).toBeGreaterThan(-1);
    expect(tonemapIndex).toBeLessThan(scaleIndex);
  });

  test('uses tonemap_vaapi when preference is explicitly vaapi and opencl is unavailable', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(true);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(args).toContain('tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709');
  });

  test('prefers tonemap_opencl over tonemap_vaapi when both are available', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([
          KnownFfmpegFilters.TonemapVaapi,
          KnownFfmpegFilters.TonemapOpencl,
        ]),
        new Set(),
      ),
    });

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
  });

  test('opencl tonemap filter appears before scale in the filter chain', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapOpencl]),
        new Set(),
      ),
    });

    const args = pipeline.getCommandArgs().join(' ');
    const tonemapIndex = args.indexOf('tonemap_opencl');
    const scaleIndex = args.indexOf('scale_vaapi');

    expect(tonemapIndex).toBeGreaterThan(-1);
    expect(scaleIndex).toBeGreaterThan(-1);
    expect(tonemapIndex).toBeLessThan(scaleIndex);
  });

  test('skips opencl tonemap when hardware filters are disabled but applies software tonemap', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapOpencl]),
        new Set(),
      ),
      pipelineOptions: {
        disableHardwareFilters: true,
      },
    });

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('applies tonemap_opencl for Dolby Vision content (dvhe codec)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const dvStream = VideoStream.create({
      index: 0,
      codec: 'dvhe',
      profile: 'dvhe.08.09',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({ videoStream: dvStream });

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
  });

  test('applies software tonemap for Dolby Vision (dvhe codec) when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const dvStream = VideoStream.create({
      index: 0,
      codec: 'dvhe',
      profile: 'dvhe.08.09',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: dvStream,
      pipelineOptions: {
        disableHardwareFilters: true,
      },
    });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('applies software tonemap for Dolby Vision with profile string (hevc codec)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const dvStream = VideoStream.create({
      index: 0,
      codec: 'hevc',
      profile: 'dolby vision / hevc main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: dvStream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    // No hardware tonemap filter, falls back to software
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('yuv420p10le input ensures outputted pixel format is 8-bit nv12', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.withDimensions(3840, 2076),
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
      desiredState: {
        scaledSize: stream.squarePixelFrameSize(FrameSize.FourK),
        paddedSize: FrameSize.FourK,
      },
    });

    const padFilter = pipeline
      .getComplexFilter()!
      .filterChain.videoFilterSteps.find((step) => step instanceof PadFilter);
    console.log(pipeline.getCommandArgs().join(' '));
    expect(padFilter).toBeDefined();
    expect(padFilter!.filter).toEqual(
      'hwdownload,format=nv12,pad=3840:2160:-1:-1:color=black',
    );
  });

  test('unknown pixel format properly wraps in nv12 after tonemapping', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      profile: 'main 10',
      pixelFormat: PixelFormatUnknown(10),
      frameSize: FrameSize.withDimensions(3840, 2076),
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
      desiredState: {
        scaledSize: stream.squarePixelFrameSize(FrameSize.FourK),
        paddedSize: FrameSize.FourK,
      },
    });

    const padFilter = pipeline
      .getComplexFilter()!
      .filterChain.videoFilterSteps.find((step) => step instanceof PadFilter);
    expect(padFilter).toBeDefined();
    expect(padFilter!.filter).toEqual(
      'hwdownload,format=nv12,pad=3840:2160:-1:-1:color=black',
    );
  });

  test('tonemap_vaapi includes format upload prefix when frame data is in software (hardware decoding disabled)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        disableHardwareDecoding: true,
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain(
      'format=vaapi|nv12|p010le,tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709',
    );
  });

  // This test verifies that software decode triggers a scale_vaapi because of the tonemap
  // to ensure we don't excessively move frames from hardware <-> software
  test('8-bit yuv420p HDR input uses vaapi tonemap and scale_vaapi (software decode)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    // Unusual but valid: 8-bit stream tagged with HDR color metadata
    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      // Explicitly trigger a software decode
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const filters = pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(true);
    const scaleFilter = filters.find(
      (filter) => filter instanceof ScaleVaapiFilter,
    );
    expect(scaleFilter).toBeDefined();
  });

  // This test verifies that hardware decode also uses scale_vaapi after vaapi tonemap
  test('8-bit yuv420p HDR input uses vaapi tonemap and scale_vaapi (hardware decode)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    // Unusual but valid: 8-bit stream tagged with HDR color metadata
    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const filters = pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(true);
    const scaleFilter = filters.find(
      (filter) => filter instanceof ScaleVaapiFilter,
    );
    expect(scaleFilter).toBeDefined();
  });

  describe('still image stream', () => {
    test('correct produces pipeline for error image', () => {
      const stream = StillImageStream.create({
        index: 0,
        pixelFormat: PixelFormatUnknown(8),
        frameSize: FrameSize.FourK,
      });

      const capabilities = new VaapiHardwareCapabilities([
        new VaapiProfileEntrypoint(
          VaapiProfiles.H264Main,
          VaapiEntrypoint.Decode,
        ),
        new VaapiProfileEntrypoint(
          VaapiProfiles.H264Main,
          VaapiEntrypoint.Encode,
        ),
      ]);

      const audioState = AudioState.create({
        audioEncoder: AudioFormats.Ac3,
        audioChannels: 6,
        audioBitrate: 192,
        audioBufferSize: 384,
        audioSampleRate: 48,
        audioVolume: 100,
        // Check if audio and video are coming from same location
        // audioDuration: duration.asMilliseconds(),
      });

      const pipeline = new VaapiPipelineBuilder(
        capabilities,
        EmptyFfmpegCapabilities,
        // VideoInputSource.withStream(
        //   new HttpStreamSource(
        //     'http://localhost:8000/images/generic-error-screen.png',
        //   ),
        //   stream,
        // ),
        LavfiVideoInputSource.errorText(
          FrameSize.FHD,
          'Error',
          'There was an error',
        ),
        AudioInputFilterSource.noise(audioState),
        null,
        null,
        null,
      );

      const builtPipeline = pipeline.build(
        FfmpegState.create({
          version: {
            versionString: 'n7.1.1-56-gc2184b65d2-20250716',
            majorVersion: 7,
            minorVersion: 1,
            patchVersion: 1,
            versionDetails: '56-gc2184b65d2-20250716',
            isUnknown: false,
          },
          vaapiDevice: '/dev/dri/renderD128',
        }),
        new FrameState({
          scaledSize: stream.squarePixelFrameSize(FrameSize.FHD),
          paddedSize: FrameSize.FourK,
          isAnamorphic: false,
          realtime: true,
          videoFormat: VideoFormats.H264,
          frameRate: 24,
          videoTrackTimescale: 90000,
          videoBitrate: 4_000,
          videoBufferSize: 8_000,
          deinterlace: false,
          pixelFormat: new PixelFormatYuv420P(),
          colorFormat: ColorFormat.unknown,
          infiniteLoop: false,
        }),
        DefaultPipelineOptions,
      );

      console.log(builtPipeline.getCommandArgs().join(' '));
    });
  });
});
