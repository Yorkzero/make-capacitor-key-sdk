import { BluetoothKeyCommand, BusinessCmd, LockStatus, DeviceInfo, LockState, BatteryState } from '../types';

export class CommandUtils {
  /**
   * 构建建立连接命令（0x01 + 4字节随机数）
   */
  static buildConnectCommand(): BluetoothKeyCommand {
    const now = Date.now();
    const randomBytes = new Uint8Array([
      (now >> 0) & 0xFF,
      (now >> 8) & 0xFF,
      (now >> 16) & 0xFF,
      (now >> 24) & 0xFF,
    ]);
    const data = new Uint8Array([0x01, ...randomBytes]);
    return {
      command: 'CONNECT',
      data,
      timeout: 5000,
    };
  }

  /**
   * 构建校时命令（0x05 + BCD时间）
   */
  static buildTimeSyncCommand(): BluetoothKeyCommand {
    const now = new Date();
    const bcd = CommandUtils.dateToBCD(now);
    const data = new Uint8Array([0x05, ...bcd]);
    return {
      command: 'TIME_SYNC',
      data,
      timeout: 3000,
    };
  }

  /**
   * 构建读取设备信息命令（0x06）
   */
  static buildReadDeviceInfoCommand(): BluetoothKeyCommand {
    return {
      command: 'READ_DEVICE_INFO',
      data: new Uint8Array([0x06]),
      timeout: 3000,
    };
  }

  /**
   * 构建开锁命令（0x08, 0x00, lockIdBytes）
   * lockId为小端模式
   */
  static buildUnlockCommand(lockId: string | number): BluetoothKeyCommand {
    const lockIdBytes = CommandUtils.lockIdToBytes(lockId);
    return {
      command: 'UNLOCK',
      data: new Uint8Array([0x08, 0x00, ...lockIdBytes]),
      timeout: 3000,
    };
  }

  /**
   * 构建关锁命令（0x08, 0x02, lockIdBytes）
   * lockId为小端模式
   */
  static buildLockCommand(lockId: string | number): BluetoothKeyCommand {
    const lockIdBytes = CommandUtils.lockIdToBytes(lockId);
    return {
      command: 'LOCK',
      data: new Uint8Array([0x08, 0x02, ...lockIdBytes]),
      timeout: 3000,
    };
  }

  /**
   * 构建强制开锁命令（0x08, 0x01, lockIdBytes）
   * lockId为小端模式
   */
  static buildForceUnlockCommand(lockId: string | number): BluetoothKeyCommand {
    const lockIdBytes = CommandUtils.lockIdToBytes(lockId);
    return {
      command: 'FORCE_UNLOCK',
      data: new Uint8Array([0x08, 0x01, ...lockIdBytes]),
      timeout: 3000,
    };
  }

  /**
   * 构建强制关锁命令（0x08, 0x03, lockIdBytes）
   * lockId为小端模式
   */
  static buildForceLockCommand(lockId: string | number): BluetoothKeyCommand {
    const lockIdBytes = CommandUtils.lockIdToBytes(lockId);
    return {
      command: 'FORCE_LOCK',
      data: new Uint8Array([0x08, 0x03, ...lockIdBytes]),
      timeout: 3000,
    };
  }

  /**
   * 构建自定义命令
   */
  static buildCustomCommand(command: string, data?: Uint8Array, timeout?: number): BluetoothKeyCommand {
    return {
      command,
      data: data || new Uint8Array(),
      timeout: timeout || 3000,
    };
  }

  /**
   * 字符串转换为Uint8Array
   */
  static stringToUint8Array(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  /**
   * Uint8Array转换为字符串
   */
  static uint8ArrayToString(array: Uint8Array): string {
    const decoder = new TextDecoder();
    return decoder.decode(array);
  }

  /**
   * 数字转换为Uint8Array
   */
  static numberToUint8Array(num: number, bytes: number = 4): Uint8Array {
    const array = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) {
      array[i] = (num >> (i * 8)) & 0xFF;
    }
    return array;
  }

  /**
   * Uint8Array转换为数字
   */
  static uint8ArrayToNumber(array: Uint8Array): number {
    let result = 0;
    for (let i = 0; i < array.length; i++) {
      result += array[i] << (i * 8);
    }
    return result;
  }

  /**
   * 验证响应数据
   */
  static validateResponse(response: Uint8Array, expectedLength?: number): boolean {
    if (!response || response.length === 0) {
      return false;
    }

    if (expectedLength && response.length !== expectedLength) {
      return false;
    }

    return true;
  }

  /**
   * 业务数据校验 - 根据命令类型验证响应数据
   */
  static validateBusinessResponse(command: number, response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (!response || response.length === 0) {
      return { isValid: false, error: '响应数据为空' };
    }

    // 检查命令是否匹配
    if (response[0] !== command) {
      return { isValid: false, error: `命令不匹配，期望: 0x${command.toString(16)}, 实际: 0x${response[0].toString(16)}` };
    }

    switch (command) {
      case 0x01: // CONNECT
        return this.validateConnectResponse(response);
      
      case 0x05: // TIME_SYNC
        return this.validateTimeSyncResponse(response);
      
      case 0x06: // READ_DEVICE_INFO
        return this.validateReadDeviceInfoResponse(response);
      
      case 0x08: // LOCK/UNLOCK
        return this.validateLockUnlockResponse(response);
      
      case 0x07: // UPLOAD_STATUS
        return this.validateUploadStatusResponse(response);
      
      case 0x02: // 第二次认证
      case 0x03: // 第三次认证
      case 0x04: // 第四次认证
        return this.validateAuthResponse(command, response);
      
      default:
        return { isValid: true, parsedData: response };
    }
  }

  /**
   * 验证连接响应（0x01）
   */
  private static validateConnectResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 5) {
      return { isValid: false, error: `连接响应长度错误，期望: 5字节，实际: ${response.length}字节` };
    }

    return { 
      isValid: true, 
      parsedData: { 
        command: response[0],
        timestamp: response.slice(1, 5)
      }
    };
  }

  /**
   * 验证校时响应（0x05）
   */
  private static validateTimeSyncResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 2) {
      return { isValid: false, error: `校时响应长度错误，期望: 2字节，实际: ${response.length}字节` };
    }

    const result = response[1];
    if (result !== 0x01) {
      return { isValid: false, error: `校时响应结果错误，期望: 0x01，实际: 0x${result.toString(16)}` };
    }

    return { 
      isValid: true, 
      parsedData: { 
        command: response[0],
        result: result
      }
    };
  }

  /**
   * 验证读取设备信息响应（0x06）
   */
  private static validateReadDeviceInfoResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 8) {
      return { isValid: false, error: `设备信息响应长度错误，期望: 8字节，实际: ${response.length}字节` };
    }

    const result = response[1];
    if (result !== 0x01) {
      return { isValid: false, error: `设备信息响应结果错误，期望: 0x01，实际: 0x${result.toString(16)}` };
    }

    const lockState = response[2];
    const batteryState = response[3];
    const lockIdBytes = response.slice(4, 8);
    const lockId = this.uint8ArrayToNumber(lockIdBytes);

    return { 
      isValid: true, 
      parsedData: { 
        command: response[0],
        result: result,
        lockState,
        batteryState,
        lockId: lockId.toString(),
        lockIdBytes
      }
    };
  }

  /**
   * 验证开锁/关锁响应（0x08）
   */
  private static validateLockUnlockResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 4) {
      return { isValid: false, error: `开锁/关锁响应长度错误，期望: 4字节，实际: ${response.length}字节` };
    }

    const result = response[1];

    // 验证结果：1表示成功，其他表示失败
    if (result !== 0x01) {
      return { isValid: false, error: `开锁/关锁操作失败，结果码: 0x${result.toString(16)}` };
    }


    return { 
      isValid: true, 
      parsedData: { 
        command: response[0],
        result,
      }
    };
  }

  /**
   * 验证状态上报响应（0x07）
   */
  private static validateUploadStatusResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 7) {
      return { isValid: false, error: `状态上报响应长度错误，期望: 7字节，实际: ${response.length}字节` };
    }

    const lockState = response[1];
    const batteryState = response[2];
    const lockIdBytes = response.slice(3, 7);

    // 验证锁状态
    if (![0x00, 0x01, 0x02, 0x03].includes(lockState)) {
      return { isValid: false, error: `无效的锁状态: 0x${lockState.toString(16)}` };
    }

    // 验证电池状态
    if (![0x00, 0x01, 0x02, 0x03].includes(batteryState)) {
      return { isValid: false, error: `无效的电池状态: 0x${batteryState.toString(16)}` };
    }

    const lockId = this.uint8ArrayToNumber(lockIdBytes);

    return { 
      isValid: true, 
      parsedData: { 
        command: response[0],
        lockState,
        batteryState,
        lockId: lockId.toString(),
        lockIdBytes
      }
    };
  }

  /**
   * 验证认证响应（0x02, 0x03, 0x04）
   */
  private static validateAuthResponse(command: number, response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    // 认证响应长度应该是动态的，至少2字节
    if (response.length < 2) {
      return { isValid: false, error: `认证响应长度错误，至少需要2字节，实际: ${response.length}字节` };
    }

    // 认证响应应该包含动态密钥数据
    const keyData = response.slice(1);
    
    return { 
      isValid: true, 
      parsedData: { 
        command: response[0],
        keyData,
        keyLength: keyData.length
      }
    };
  }

  /**
   * 解析设备状态上报事件
   * 这是在线开锁的核心功能：钥匙插入锁具后主动上报
   * 
   * 锁具状态上报（UPLOAD_STATUS）：7字节
   * 第1位：命令类型
   * 第2位：锁状态
   * 第3位：电池状态
   * 第4-7位：锁ID（小端模式）
   * 
   * 设备信息上报（GET_SYS_PARAM）：8字节
   * 第1位：命令类型
   * 第2位：操作结果（1成功，0失败）
   * 第3位：锁状态
   * 第4位：电池状态
   * 第5-8位：锁ID（小端模式）
   */
  static parseDeviceStatusReport(data: Uint8Array): {
    command: number;
    lockStatus?: LockStatus;
    deviceInfo?: DeviceInfo;
    lockId?: string;
    timestamp: Date;
    operationResult?: boolean;
  } {
    const command = data[0];
    
    // 根据命令类型确定数据长度和解析方式
    let lockStateValue: number;
    let batteryStateValue: number;
    let lockIdBytes: Uint8Array;
    let operationResult: boolean | undefined;

    switch (command) {
      case BusinessCmd.UPLOAD_STATUS:
        // 锁具状态上报：7字节
        if (!this.validateResponse(data, 7)) {
          throw new Error('无效的锁具状态上报数据');
        }
        lockStateValue = data[1];
        batteryStateValue = data[2];
        lockIdBytes = data.slice(3, 7);
        break;
      
      case BusinessCmd.GET_SYS_PARAM:
        // 设备信息上报：8字节
        if (!this.validateResponse(data, 8)) {
          throw new Error('无效的设备信息上报数据');
        }
        operationResult = data[1] === 1; // 1成功，0失败
        lockStateValue = data[2];
        batteryStateValue = data[3];
        lockIdBytes = data.slice(4, 8);
        break;
      
      default:
        throw new Error(`未知的上报命令: ${command}`);
    }
    
    // 解析锁ID（小端模式）
    const lockId = this.uint8ArrayToNumber(lockIdBytes);
    const lockIdStr = lockId.toString();
    
    // 检查是否为未连接状态（锁ID全为FF）
    const isConnected = !lockIdBytes.every(byte => byte === 0xFF);
    
    // 解析锁状态
    let lockStatus: LockStatus | undefined;
    let deviceInfo: DeviceInfo | undefined;

    // 解析锁状态和电池状态（两个命令都有这些信息）
    const lockState = this.parseLockState(lockStateValue);
    const batteryLevel = this.convertBatteryStateToLevel(batteryStateValue);

    lockStatus = {
      state: lockState,
      isLocked: this.isLockedByState(lockState),
      batteryLevel: batteryLevel,
      isConnected: isConnected,
    };

    deviceInfo = {
      deviceId: lockIdStr,
    };

    return {
      command,
      lockStatus,
      deviceInfo,
      lockId: lockIdStr,
      timestamp: new Date(), // 状态上报中没有时间戳信息，使用当前时间
      operationResult,
    };
  }

  /**
   * 解析锁状态值
   */
  private static parseLockState(lockStateValue: number): LockState {
    switch (lockStateValue) {
      case 0xFF:
        return LockState.UNCONNECTED;
      case 0xFE:
        return LockState.UNKNOWN;
      case 0:
        return LockState.UNKNOWN_OPEN;
      case 1:
        return LockState.UNKNOWN_CLOSED;
      case 2:
        return LockState.UNLOCKED_OPEN;
      case 3:
        return LockState.UNLOCKED_CLOSED;
      case 4:
        return LockState.LOCKED_OPEN;
      case 5:
        return LockState.LOCKED_CLOSED;
      default:
        return LockState.UNKNOWN;
    }
  }

  /**
   * 根据锁状态值判断是否锁定
   */
  private static isLockedByState(lockState: LockState): boolean {
    switch (lockState) {
      case LockState.UNCONNECTED:
      case LockState.UNKNOWN:
      case LockState.UNKNOWN_OPEN:
      case LockState.UNKNOWN_CLOSED:
      case LockState.UNLOCKED_OPEN:
      case LockState.UNLOCKED_CLOSED:
        return false; // 开锁状态或未知状态
      case LockState.LOCKED_OPEN:
      case LockState.LOCKED_CLOSED:
        return true;  // 关锁状态
      default:
        return false; // 默认认为开锁
    }
  }

  /**
   * 将电池状态转换为电池电量级别
   */
  private static convertBatteryStateToLevel(batteryState: number): number {
    switch (batteryState) {
      case BatteryState.LOW:
        return 20;
      case BatteryState.MEDIUM:
        return 60;
      case BatteryState.HIGH:
        return 100;
      case BatteryState.CHARGING:
        return 100; // 充电中认为电量充足
      default:
        return 0;
    }
  }

  /**
   * 检查是否为设备主动上报的数据
   */
  static isDeviceReport(data: Uint8Array): boolean {
    if (!this.validateResponse(data, 1)) {
      return false;
    }

    const command = data[0];
    return command === BusinessCmd.UPLOAD_STATUS || command === BusinessCmd.GET_SYS_PARAM;
  }

  /**
   * 字符串/数字转小端4字节Uint8Array
   * 确保输出严格为4字节，不足位补0
   */
  static lockIdToBytes(lockId: string | number): Uint8Array {
    let idNum = typeof lockId === 'number' ? lockId : parseInt(lockId, 10);
    
    // 确保是32位无符号整数
    idNum = idNum >>> 0; // 转换为无符号32位整数
    
    const bytes = new Uint8Array(4);
    // 小端模式：低字节在前，高字节在后
    bytes[0] = (idNum >> 0) & 0xFF;  // 最低字节
    bytes[1] = (idNum >> 8) & 0xFF;  // 次低字节
    bytes[2] = (idNum >> 16) & 0xFF; // 次高字节
    bytes[3] = (idNum >> 24) & 0xFF; // 最高字节
    
    return bytes;
  }

  /**
   * 日期转BCD编码（年月日时分秒）
   */
  static dateToBCD(date: Date): number[] {
    const y = date.getFullYear() % 100;
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours();
    const min = date.getMinutes();
    const s = date.getSeconds();
    return [
      ((Math.floor(y / 10)) << 4) | (y % 10),
      ((Math.floor(m / 10)) << 4) | (m % 10),
      ((Math.floor(d / 10)) << 4) | (d % 10),
      ((Math.floor(h / 10)) << 4) | (h % 10),
      ((Math.floor(min / 10)) << 4) | (min % 10),
      ((Math.floor(s / 10)) << 4) | (s % 10),
    ];
  }

  /**
   * 拼接多个Uint8Array到一个新的Uint8Array
   * 更优雅的写法，替代手动计算offset的方式
   */
  static concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /**
   * 拼接多个Uint8Array并添加额外的字节
   */
  static concatUint8ArraysWithExtra(arrays: Uint8Array[], extraBytes: number[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0) + extraBytes.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    // 先设置所有数组
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    
    // 再设置额外字节
    result.set(extraBytes, offset);
    
    return result;
  }

  /**
   * 获取锁具状态描述
   */
  static getLockStateDescription(lockState: LockState): string {
    switch (lockState) {
      case LockState.UNCONNECTED:
        return '未连接锁';
      case LockState.UNKNOWN:
        return '未知状态';
      case LockState.UNKNOWN_OPEN:
        return '未知状态，锁梁打开';
      case LockState.UNKNOWN_CLOSED:
        return '未知状态，锁梁闭合';
      case LockState.UNLOCKED_OPEN:
        return '开锁状态，锁梁打开';
      case LockState.UNLOCKED_CLOSED:
        return '开锁状态，锁梁闭合（异常）';
      case LockState.LOCKED_OPEN:
        return '关锁状态，锁梁打开（异常）';
      case LockState.LOCKED_CLOSED:
        return '关锁状态，锁梁闭合';
      default:
        return '未知状态';
    }
  }

  /**
   * 获取电池状态描述
   */
  static getBatteryStateDescription(batteryState: BatteryState): string {
    switch (batteryState) {
      case BatteryState.LOW:
        return '低电量';
      case BatteryState.MEDIUM:
        return '中电量';
      case BatteryState.HIGH:
        return '高电量';
      case BatteryState.CHARGING:
        return '充电中';
      default:
        return '未知电量';
    }
  }
} 