import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import type { FrameDataLocation } from '@/ffmpeg/builder/types.js';

export abstract class QsvDecoder extends BaseDecoder {
  affectsFrameState: boolean = true;

  protected _outputFrameDataLocation: FrameDataLocation = 'hardware';

  protected constructor(public name: string) {
    super();
  }
}
