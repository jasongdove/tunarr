import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.js';
import { PixelFormatUnknown } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type { Watermark } from '@tunarr/types';

export class OverlayWatermarkCudaFilter extends OverlayWatermarkFilter {
  public affectsFrameState: boolean = true;

  constructor(watermark: Watermark, resolution: FrameSize) {
    super(watermark, resolution, resolution, PixelFormatUnknown());
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Hardware);
  }

  public get filter() {
    return `overlay_cuda=${this.getPosition()}`;
  }
}
