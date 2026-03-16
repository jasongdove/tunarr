import type { FfmpegState } from '@/ffmpeg/builder/state/FfmpegState.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation, type FrameSize } from '@/ffmpeg/builder/types.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import { HardwareAccelerationMode } from '../../../db/schema/TranscodeConfig.ts';
import { FilterOption } from './FilterOption.ts';
import { HardwareDownloadFilter } from './HardwareDownloadFilter.ts';
import { HardwareDownloadCudaFilter } from './nvidia/HardwareDownloadCudaFilter.ts';

export class ScaleFilter extends FilterOption {
  private hardwareDownloadFilter?: FilterOption;
  readonly filter: string;

  readonly affectsFrameState = true;

  constructor(
    private currentState: FrameState,
    private ffmpegState: FfmpegState,
    private desiredScaledSize: FrameSize,
    private desiredPaddedSize: FrameSize,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  static create(
    currentState: FrameState,
    ffmpegState: FfmpegState,
    desiredScaledSize: FrameSize,
    desiredPaddedSize: FrameSize,
  ) {
    return new ScaleFilter(
      currentState,
      ffmpegState,
      desiredScaledSize,
      desiredPaddedSize,
    );
  }

  private generateFilter(): string {
    if (this.currentState.scaledSize.equals(this.desiredScaledSize)) {
      return '';
    }

    const aspectRatio = this.desiredScaledSize.equals(this.desiredPaddedSize)
      ? ''
      : ':force_original_aspect_ratio=decrease';

    let scaleFilter: string;
    if (this.currentState.isAnamorphic) {
      scaleFilter = `scale=iw*sar:ih,setsar=1,scale=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:flags=${this.ffmpegState.softwareScalingAlgorithm}${aspectRatio}`;
    } else {
      scaleFilter = `scale=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:flags=${this.ffmpegState.softwareScalingAlgorithm}${aspectRatio},setsar=1`;
    }

    if (this.currentState.frameDataLocation === FrameDataLocation.Hardware) {
      const hwdownload =
        this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda
          ? new HardwareDownloadCudaFilter(this.currentState, null)
          : new HardwareDownloadFilter(this.currentState);
      this.hardwareDownloadFilter = hwdownload;
      const hwdownloadFilter = hwdownload.filter;
      if (isNonEmptyString(hwdownloadFilter)) {
        scaleFilter = `${hwdownloadFilter},${scaleFilter}`;
      }
    }

    return scaleFilter;
  }

  nextState(currentState: FrameState): FrameState {
    currentState =
      this.hardwareDownloadFilter?.nextState(currentState) ?? currentState;
    return currentState.update({
      scaledSize: this.desiredScaledSize,
      paddedSize: this.desiredScaledSize,
      isAnamorphic: false,
      frameDataLocation: FrameDataLocation.Software,
    });
  }
}
