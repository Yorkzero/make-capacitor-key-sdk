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
   * 构建下发任务配置命令（0x0C）
   * @param operationType 操作类型：0-删除，1-添加
   * @param segmentCount 号段总数，最大65535
   * @param authType 授权类型：0长期授权，1临时授权，2周期授权
   * @param startTime 有效期起始时间（临时授权时使用）
   * @param endTime 有效期结束时间（临时授权时使用）
   * @param weeklySchedule 周期授权的时间段配置（周期授权时使用）
   */
  static buildTaskConfigCommand(
    operationType: 0 | 1,
    segmentCount: number,
    authType: 0 | 1 | 2 = 0,
    startTime?: Date,
    endTime?: Date,
    weeklySchedule?: Array<{
      week: number; // 0-6表示周日到周六
      authTimes: Array<{
        startTime?: string; // 'HH:MM'
        endTime?: string;   // 'HH:MM'
      }>;
    }>
  ): BluetoothKeyCommand {
    const data: number[] = [0x0C, operationType];
    // 号段总数（小端2字节）
    data.push(segmentCount & 0xFF, (segmentCount >> 8) & 0xFF);
    const validCount = 0xFFFF;
    // 有效次数（小端2字节）
    data.push(validCount & 0xFF, (validCount >> 8) & 0xFF);
    // 授权类型
    data.push(authType);
    if (authType === 1 && startTime && endTime) {
      // 临时授权，添加起止时间（各6字节BCD）
      data.push(...CommandUtils.dateToBCD(startTime));
      data.push(...CommandUtils.dateToBCD(endTime));
    } else if (authType === 2 && weeklySchedule) {
      // 周期授权
      for (const day of weeklySchedule) {
        const tmp: number[] = [];
        tmp.push(day.week % 7);
        let slotCount = 0;
        for (const timeSlot of day.authTimes) {
          if (timeSlot.startTime && timeSlot.endTime && timeSlot.startTime !== '' && timeSlot.endTime !== '') {
            const [sh, sm] = timeSlot.startTime.split(':').map(Number);
            const [eh, em] = timeSlot.endTime.split(':').map(Number);
            tmp.push(sh, sm, eh, em);
          } else {
            tmp.push(0x00, 0x00, 0x00, 0x00);
          }
          slotCount++;
          if (slotCount >= 2) break;
        }
        // 不足2个时段补0
        while (slotCount < 2) {
          tmp.push(0x00, 0x00, 0x00, 0x00);
          slotCount++;
        }
        // 保证每个周期配置9字节
        while (tmp.length < 9) tmp.push(0x00);
        data.push(...tmp);
      }
    }
    return {
      command: 'TASK_CONFIG',
      data: new Uint8Array(data),
      timeout: 5000,
    };
  }

  /**
   * 构建删除任务配置命令（0x0C, 0, ...）
   */
  static buildDeleteTaskConfigCommand(segmentCount: number = 0): BluetoothKeyCommand {
    return CommandUtils.buildTaskConfigCommand(0, segmentCount);
  }

  /**
   * 构建添加长期授权任务配置命令（0x0C, 1, ..., 0）
   */
  static buildAddLongTermTaskConfigCommand(segmentCount: number): BluetoothKeyCommand {
    return CommandUtils.buildTaskConfigCommand(1, segmentCount);
  }

  /**
   * 构建添加临时授权任务配置命令（0x0C, 1, ..., 1, startTime, endTime）
   */
  static buildAddTemporaryTaskConfigCommand(
    segmentCount: number,
    startTime: Date,
    endTime: Date,
  ): BluetoothKeyCommand {
    return CommandUtils.buildTaskConfigCommand(1, segmentCount, 1, startTime, endTime);
  }

  /**
   * 构建添加周期授权任务配置命令（0x0C, 1, ..., 2, weeklySchedule）
   */
  static buildAddPeriodicTaskConfigCommand(
    segmentCount: number,
    weeklySchedule: Array<{
      week: number;
      authTimes: Array<{
        startTime?: string;
        endTime?: string;
      }>;
    }>,
  ): BluetoothKeyCommand {
    return CommandUtils.buildTaskConfigCommand(1, segmentCount, 2, undefined, undefined, weeklySchedule);
  }

  /**
   * 将锁具ID列表转换为号段列表
   * @param lockIds 锁具ID列表
   * @returns 号段列表，每个号段包含 [start, end]
   */
  static convertLockIdsToSegments(lockIds: (string | number)[]): Array<[number, number]> {
    const ids = lockIds
      .map(id => typeof id === 'string' ? parseInt(id, 10) || 0 : id)
      .filter(id => id > 0)
      .sort((a, b) => a - b);

    const segments: Array<[number, number]> = [];
    
    if (ids.length === 0) {
      return segments;
    }

    let start = ids[0];
    let end = ids[0];

    for (let i = 1; i < ids.length; i++) {
      if (ids[i] === end + 1) {
        end = ids[i];
      } else {
        segments.push([start, end]);
        start = ids[i];
        end = ids[i];
      }
    }
    
    segments.push([start, end]);
    return segments;
  }

  /**
   * 将号段列表转换为字节数据包列表
   * @param segments 号段列表，每个号段包含 [start, end]
   * @returns 字节数据包列表，每个包包含命令标识、帧大小和锁具段数据
   */
  static convertSegmentsToPackets(segments: Array<[number, number]>): Uint8Array[] {
    const packets: Uint8Array[] = [];
    const currentChunk: number[] = [];

    for (const segment of segments) {
      // 每个号段包含两个数字：start 和 end
      for (const number of segment) {
        // 每个数字占4字节（小端模式）
        currentChunk.push(
          number & 0xFF,
          (number >> 8) & 0xFF,
          (number >> 16) & 0xFF,
          (number >> 24) & 0xFF
        );

        // 当达到最大帧大小时（25个号段 * 8字节 = 200字节 + 1字节帧大小 + 1字节命令标识 = 202字节）
        if (currentChunk.length >= 25 * 8) {
          const packet = new Uint8Array([0x0D, currentChunk.length / 8, ...currentChunk]);
          packets.push(packet);
          currentChunk.length = 0; // 清空当前块
        }
      }
    }

    // 处理剩余的数据
    if (currentChunk.length > 0) {
      const packet = new Uint8Array([0x0D, currentChunk.length / 8, ...currentChunk]);
      packets.push(packet);
    }

    return packets;
  }

  /**
   * 构建锁具段下发命令（0x0D）
   * @param lockIds 锁具ID列表
   * @returns 锁具段下发命令包列表，每个包包含号段范围数据
   */
  static buildLockSegmentsCommand(lockIds: (string | number)[]): BluetoothKeyCommand[] {
    const segments = CommandUtils.convertLockIdsToSegments(lockIds);
    const packets = CommandUtils.convertSegmentsToPackets(segments);
    
    return packets.map(packet => ({
      command: 'LOCK_SEGMENTS',
      data: packet,
      timeout: 5000,
    }));
  }

  /**
   * 构建记录上传控制命令（0x0A）
   * @param operationType 操作类型：0-停止，1-启动，2-完成
   * @returns 记录上传控制命令
   */
  static buildRecordUploadControlCommand(operationType: 0 | 1 | 2): BluetoothKeyCommand {
    return {
      command: 'RECORD_UPLOAD_CONTROL',
      data: new Uint8Array([0x0A, operationType]),
      timeout: 5000,
    };
  }

  /**
   * 构建启动记录上传命令（0x0A, 0x01）
   */
  static buildStartRecordUploadCommand(): BluetoothKeyCommand {
    return CommandUtils.buildRecordUploadControlCommand(1);
  }

  /**
   * 构建停止记录上传命令（0x0A, 0x00）
   */
  static buildStopRecordUploadCommand(): BluetoothKeyCommand {
    return CommandUtils.buildRecordUploadControlCommand(0);
  }

  /**
   * 解析开锁日志数据（0x0B）
   * @param data 开锁日志数据
   * @returns 解析后的开锁日志信息
   */
  static parseUnlockLogData(data: Uint8Array): {
    operationType: 'NORMAL_UNLOCK' | 'FORCE_UNLOCK' | 'NORMAL_LOCK' | 'FORCE_LOCK';
    operationResult: 'SUCCESS' | 'FAILED';
    lockId: string;
    operationTime: Date;
    rawData: Uint8Array;
  } {
    if (data.length !== 13) {
      throw new Error(`开锁日志数据长度错误，期望: 13字节，实际: ${data.length}字节`);
    }

    const operationType = data[1];
    const operationResult = data[2];
    const lockIdBytes = data.slice(3, 7);
    const timeBytes = data.slice(7, 13);

    // 解析操作类型
    let operationTypeStr: 'NORMAL_UNLOCK' | 'FORCE_UNLOCK' | 'NORMAL_LOCK' | 'FORCE_LOCK';
    switch (operationType) {
      case 0x00:
        operationTypeStr = 'NORMAL_UNLOCK';
        break;
      case 0x01:
        operationTypeStr = 'FORCE_UNLOCK';
        break;
      case 0x02:
        operationTypeStr = 'NORMAL_LOCK';
        break;
      case 0x03:
        operationTypeStr = 'FORCE_LOCK';
        break;
      default:
        throw new Error(`无效的操作类型: 0x${operationType.toString(16)}`);
    }

    // 解析操作结果
    const operationResultStr = operationResult === 0x01 ? 'SUCCESS' : 'FAILED';

    // 解析锁ID（小端模式）
    const lockId = CommandUtils.uint8ArrayToNumber(lockIdBytes);

    // 解析操作时间（BCD格式）
    const operationTime = CommandUtils.bcdToDate(timeBytes);

    return {
      operationType: operationTypeStr,
      operationResult: operationResultStr,
      lockId: lockId.toString(),
      operationTime,
      rawData: data
    };
  }

  /**
   * BCD时间转换为Date对象
   * @param bcdTime BCD格式的时间数据（6字节：年月日时分秒）
   * @returns Date对象
   */
  static bcdToDate(bcdTime: Uint8Array): Date {
    if (bcdTime.length !== 6) {
      throw new Error(`BCD时间数据长度错误，期望: 6字节，实际: ${bcdTime.length}字节`);
    }

    // BCD解码
    const year = ((bcdTime[0] >> 4) * 10 + (bcdTime[0] & 0x0F)) + 2000; // 假设是20xx年
    const month = (bcdTime[1] >> 4) * 10 + (bcdTime[1] & 0x0F) - 1; // 月份从0开始
    const day = (bcdTime[2] >> 4) * 10 + (bcdTime[2] & 0x0F);
    const hour = (bcdTime[3] >> 4) * 10 + (bcdTime[3] & 0x0F);
    const minute = (bcdTime[4] >> 4) * 10 + (bcdTime[4] & 0x0F);
    const second = (bcdTime[5] >> 4) * 10 + (bcdTime[5] & 0x0F);

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * 检查是否为开锁日志数据
   * @param data 数据
   * @returns 是否为开锁日志
   */
  static isUnlockLogData(data: Uint8Array): boolean {
    return data.length >= 1 && data[0] === 0x0B;
  }

  /**
   * 获取操作类型描述
   * @param operationType 操作类型
   * @returns 操作类型描述
   */
  static getOperationTypeDescription(operationType: 'NORMAL_UNLOCK' | 'FORCE_UNLOCK' | 'NORMAL_LOCK' | 'FORCE_LOCK'): string {
    switch (operationType) {
      case 'NORMAL_UNLOCK':
        return '正常开锁';
      case 'FORCE_UNLOCK':
        return '强制开锁';
      case 'NORMAL_LOCK':
        return '正常关锁';
      case 'FORCE_LOCK':
        return '强制关锁';
      default:
        return '未知操作';
    }
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

      case 0x0C: // TASK_CONFIG
        return this.validateTaskConfigResponse(response);
      
      case 0x0D: // LOCK_SEGMENTS
        return this.validateLockSegmentsResponse(response);
      
      case 0x0A: // RECORD_UPLOAD_CONTROL
        return this.validateRecordUploadControlResponse(response);
      
      case 0x0B: // UNLOCK_LOG
        return this.validateUnlockLogData(response);
      
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
   * 验证任务配置响应（0x0C）
   */
  private static validateTaskConfigResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 2) {
      return { isValid: false, error: `任务配置响应长度错误，期望: 2字节，实际: ${response.length}字节` };
    }

    const result = response[1];
    if (result !== 0x01) {
      return { isValid: false, error: `任务配置操作失败，结果码: 0x${result.toString(16)}` };
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
   * 验证锁具段下发响应（0x0D）
   */
  private static validateLockSegmentsResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 2) {
      return { isValid: false, error: `锁具段下发响应长度错误，期望: 2字节，实际: ${response.length}字节` };
    }

    const result = response[1];
    if (result !== 0x01) {
      return { isValid: false, error: `锁具段下发操作失败，结果码: 0x${result.toString(16)}` };
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
   * 验证记录上传控制响应（0x0A）
   */
  private static validateRecordUploadControlResponse(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 2) {
      return { isValid: false, error: `记录上传控制响应长度错误，期望: 2字节，实际: ${response.length}字节` };
    }

    const result = response[1];
    if (result !== 0x01) {
      return { isValid: false, error: `记录上传控制操作失败，结果码: 0x${result.toString(16)}` };
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
   * 验证开锁日志数据（0x0B）
   */
  private static validateUnlockLogData(response: Uint8Array): {
    isValid: boolean;
    error?: string;
    parsedData?: any;
  } {
    if (response.length !== 13) {
      return { isValid: false, error: `开锁日志数据长度错误，期望: 13字节，实际: ${response.length}字节` };
    }

    try {
      const parsedData = CommandUtils.parseUnlockLogData(response);
      return { 
        isValid: true, 
        parsedData 
      };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : '开锁日志数据解析失败' 
      };
    }
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