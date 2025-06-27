import { PhysicalData } from '../types';
import { CommandUtils } from '../utils/CommandUtils';

export class PhysicalLayer {
  private readonly header = new Uint8Array([0xA5, 0x5A]);

  /**
   * 打包数据
   */
  pack(data: Uint8Array): Uint8Array {
    const length = data.length + 1;
    const lengthBytes = this.intToLittleEndian(length, 2);
    
    // 计算校验和
    let checksum = 0;
    for (let i = 0; i < this.header.length; i++) {
      checksum += this.header[i];
    }
    for (let i = 0; i < lengthBytes.length; i++) {
      checksum += lengthBytes[i];
    }
    for (let i = 0; i < data.length; i++) {
      checksum += data[i];
    }
    checksum &= 0xFF;

    return CommandUtils.concatUint8ArraysWithExtra(
      [this.header, lengthBytes, data],
      [checksum]
    );
  }

  /**
   * 解包数据（返回所有完整帧）
   */
  unpack(data: Uint8Array): Uint8Array[] {
    return this.unpackWithRemain(data).frames;
  }

  /**
   * 滑动窗口解包，返回所有完整帧和剩余未解包数据
   */
  unpackWithRemain(data: Uint8Array): { frames: Uint8Array[]; remain: Uint8Array } {
    const result: Uint8Array[] = [];
    let index = 0;
    while (index + 5 <= data.length) { // 至少要有包头+长度+校验和
        // 查找包头
        if (data[index] !== this.header[0] || data[index + 1] !== this.header[1]) {
            index++;
            continue;
        }
        // 解析长度（小端序）
        const length = data[index + 2] + (data[index + 3] << 8);
        const totalLen = 4 + length; // 包头2+长度2+数据+校验和
        if (index + totalLen > data.length) break; // 数据不完整，等待下次
        // 校验和
        let sum = 0;
        for (let i = index; i < index + totalLen - 1; i++) {
            sum += data[i];
        }
        sum &= 0xFF;
        const checksum = data[index + totalLen - 1];
        if (sum !== checksum) {
            // 校验和错，跳过当前包头，继续查找下一个
            index++;
            continue;
        }
        // 提取完整帧（含包头、长度、数据、校验和，便于调试）
        const frame = data.slice(index, index + totalLen);
        result.push(frame);
        index += totalLen;
    }
    // 剩余未解包数据
    const remain = data.slice(index);
    return { frames: result, remain };
  }

  /**
   * 整数转小端字节序
   */
  private intToLittleEndian(value: number, bytes: number): Uint8Array {
    const result = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) {
      result[i] = (value >> (i * 8)) & 0xFF;
    }
    return result;
  }

  /**
   * 小端字节序转整数
   */
  private littleEndianToInt(bytes: Uint8Array): number {
    let result = 0;
    for (let i = 0; i < bytes.length; i++) {
      result += bytes[i] << (i * 8);
    }
    return result;
  }
} 