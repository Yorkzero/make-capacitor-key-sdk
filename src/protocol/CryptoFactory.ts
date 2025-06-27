/**
 * 加解密工厂抽象类
 */
export interface CryptoFactory {
  /**
   * 加密数据
   */
  encrypt(data: Uint8Array, secretKey?: Uint8Array): Promise<Uint8Array>;

  /**
   * 解密数据
   */
  decrypt(data: Uint8Array, secretKey?: Uint8Array): Promise<Uint8Array>;
}