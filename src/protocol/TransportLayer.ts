import { TransportData, TransportAckType, TransportEncryptType } from '../types';
import { CryptoFactory } from './CryptoFactory';
import CryptoJS from 'crypto-js';

export class TransportLayerV1 {
  /**
   * 打包数据
   */
  async pack(
    data: Uint8Array,
    options: {
      version?: number;
      ackType?: TransportAckType;
      encryptType?: TransportEncryptType;
      cryptoFactory?: CryptoFactory;
      secretKey?: Uint8Array;
    } = {}
  ): Promise<Uint8Array> {
    const {
      version = 0x01,
      ackType = TransportAckType.REQUEST_WITH_ACK,
      encryptType = TransportEncryptType.ENCRYPT,
      cryptoFactory = new AesEcbCryptoFactory(),
      secretKey = new Uint8Array(),
    } = options;

    const result: number[] = [];
    result.push(version);

    // 根据确认类型和加密类型设置控制字节
    let controlByte = 0;
    switch (ackType) {
      case TransportAckType.REQUEST_WITHOUT_ACK:
        controlByte = encryptType === TransportEncryptType.ENCRYPT ? 0xFC : 0xF4;
        break;
      case TransportAckType.REQUEST_WITH_ACK:
        controlByte = encryptType === TransportEncryptType.ENCRYPT ? 0xFE : 0xF6;
        break;
      case TransportAckType.ACK:
        controlByte = encryptType === TransportEncryptType.ENCRYPT ? 0xFD : 0xF5;
        break;
      case TransportAckType.NONE:
        controlByte = encryptType === TransportEncryptType.ENCRYPT ? 0xFF : 0xF7;
        break;
    }
    result.push(controlByte);

    // 根据加密类型处理数据
    let formatData: Uint8Array;
    switch (encryptType) {
      case TransportEncryptType.ENCRYPT:
        formatData = await cryptoFactory.encrypt(data, secretKey);
        break;
      case TransportEncryptType.NO_ENCRYPT:
        formatData = data;
        break;
    }

    result.push(...Array.from(formatData));
    return new Uint8Array(result);
  }

  /**
   * 解包数据
   */
  async unpack(data: Uint8Array, secretKey: Uint8Array = new Uint8Array()): Promise<TransportData> {
    const result: TransportData = {
      version: 0x01,
      ackType: TransportAckType.REQUEST_WITH_ACK,
      encryptType: TransportEncryptType.ENCRYPT,
      data: new Uint8Array(),
    };

    if (data.length < 2) return result;

    result.version = data[0];
    if (result.version !== 0x01) return result;

    const controlByte = data[1];
    let tmp: Uint8Array;

    // 判断是否加密
    if ((controlByte & 0x04) !== 0) {
      result.encryptType = TransportEncryptType.ENCRYPT;
      const cryptoFactory = new AesEcbCryptoFactory();
      tmp = await cryptoFactory.decrypt(data.slice(2), secretKey);
      result.data = tmp;
    } else {
      result.encryptType = TransportEncryptType.NO_ENCRYPT;
      tmp = data.slice(2);
      result.data = tmp;
    }

    // 判断确认类型
    const ackBits = controlByte & 0x03;
    switch (ackBits) {
      case 0:
        result.ackType = TransportAckType.REQUEST_WITHOUT_ACK;
        break;
      case 2:
        result.ackType = TransportAckType.REQUEST_WITH_ACK;
        break;
      case 1:
        result.ackType = TransportAckType.ACK;
        break;
      case 3:
        result.ackType = TransportAckType.NONE;
        break;
    }

    return result;
  }
}

/**
 * AES加密工厂
 */
export class AesEcbCryptoFactory implements CryptoFactory {
  async encrypt(data: Uint8Array, secretKey: Uint8Array = new Uint8Array()): Promise<Uint8Array> {
    // 确保密钥长度为16字节（AES-128要求）
    let normalizedKey = secretKey;
    if (secretKey.length !== 16) {
      if (secretKey.length < 16) {
        // 密钥不足16字节，用0填充
        normalizedKey = new Uint8Array(16);
        normalizedKey.set(secretKey);
      } else {
        // 密钥超过16字节，截取前16字节
        normalizedKey = secretKey.slice(0, 16);
      }
    }
    
    // 直接使用Uint8Array作为密钥，避免字符串转换
    const key = CryptoJS.lib.WordArray.create(normalizedKey as any);
    // 转换明文
    const wordArray = CryptoJS.lib.WordArray.create(data as any);
    // 加密
    const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    // 输出为Uint8Array
    const hex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    return Uint8Array.from(hex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  }

  async decrypt(data: Uint8Array, secretKey: Uint8Array = new Uint8Array()): Promise<Uint8Array> {
    // 确保密钥长度为16字节（AES-128要求）
    let normalizedKey = secretKey;
    if (secretKey.length !== 16) {
      if (secretKey.length < 16) {
        // 密钥不足16字节，用0填充
        normalizedKey = new Uint8Array(16);
        normalizedKey.set(secretKey);
      } else {
        // 密钥超过16字节，截取前16字节
        normalizedKey = secretKey.slice(0, 16);
      }
    }
    
    // 直接使用Uint8Array作为密钥，避免字符串转换
    const key = CryptoJS.lib.WordArray.create(normalizedKey as any);
    // 转换密文
    const hexStr = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
    const encryptedHex = CryptoJS.enc.Hex.parse(hexStr);
    // 解密
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: encryptedHex } as any,
      key,
      {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    // 输出为Uint8Array
    const words = decrypted.words;
    const sigBytes = decrypted.sigBytes;
    const result = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
      result[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return result;
  }
}