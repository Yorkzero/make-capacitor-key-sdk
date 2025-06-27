import { ApplicationData } from '../types';

export class DefaultApplicationLayer {
  /**
   * 打包数据
   */
  pack(data: Uint8Array, frameIndex: number = 0): Uint8Array {
    const length = data.length;
    const result = new Uint8Array(2 + length);
    
    result[0] = frameIndex;
    result[1] = length;
    result.set(data, 2);
    
    return result;
  }

  /**
   * 解包数据
   */
  unpack(data: Uint8Array): ApplicationData {
    const result: ApplicationData = {
      frameIndex: 0,
      data: new Uint8Array(),
    };

    if (data.length < 2) return result;
    if (data[1] !== data.length - 2) return result;

    result.frameIndex = data[0];
    result.data = data.slice(2);
    
    return result;
  }
} 