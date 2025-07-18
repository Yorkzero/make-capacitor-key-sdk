// 重新导出BleClient的类型
export type { BleDevice, BleService, BleCharacteristic, BleDescriptor } from '@capacitor-community/bluetooth-le';

// 业务命令枚举
export enum BusinessCmd {
  // 建立连接
  CONN = 0x01,
  // 请求开锁
  OPEN = 0x02,
  // 请求关锁
  CLOSE = 0x03,
  // 请求强制开锁
  FORCE_OPEN = 0x04,
  /// 时间同步
  TIME_SYNC = 0x05,
  // 请求系统参数
  GET_SYS_PARAM = 0x06,
  // 钥匙上报锁具状态
  UPLOAD_STATUS = 0x07,
  // 蓝牙挂锁校时
  LOCK_TIME_SYNC = 0x08,
  // 蓝牙挂锁日志上传
  LOCK_RECORD_UPLOAD = 0x09,
  // 强制关锁
  FORCE_CLOSE = 0x0A,
  // 连接后握手
  ESTABLISH = 0xFFFE,
  // 第二次握手
  ESTABLISH2 = 0xFFFD,
  // 无意义，用于冲掉黏性事件
  NONE = 0xFF99,
  // 请求开关锁
  OPEN_OR_CLOSE = 0xFFFF,
  // 任务下发配置
  TASK_CONFIG = 0x0B,
  // 任务下发锁具段
  TASK_LOCK = 0x0C,
  // 允许日志上传
  ALLOW_LOG_UPLOAD = 0x0D,
  // 停止日志上传
  STOP_LOG_UPLOAD = 0x0E,
  // 任务清除配置
  TASK_CLEAR_CONFIG = 0x0F,
}

// 传输层确认类型
export enum TransportAckType {
  REQUEST_WITHOUT_ACK = 'requsetWithoutAck',
  REQUEST_WITH_ACK = 'requsetWithAck',
  ACK = 'ack',
  NONE = 'none',
}

// 传输层加密类型
export enum TransportEncryptType {
  NO_ENCRYPT = 'noEncrypt',
  ENCRYPT = 'encrypt',
}

// 应用层数据
export interface ApplicationData {
  frameIndex: number;
  data: Uint8Array;
}

// 传输层数据
export interface TransportData {
  version: number;
  ackType: TransportAckType;
  encryptType: TransportEncryptType;
  data: Uint8Array;
}

// 物理层数据
export interface PhysicalData {
  header: Uint8Array;
  length: number;
  data: Uint8Array;
  checksum: number;
}

// 锁具状态枚举
export enum LockState {
  UNCONNECTED = 0xFF,  // 未连接锁
  UNKNOWN = 0xFE,      // 未知状态（非挂锁类设备）
  UNKNOWN_OPEN = 0,    // 未知状态，锁梁打开
  UNKNOWN_CLOSED = 1,  // 未知状态，锁梁闭合
  UNLOCKED_OPEN = 2,   // 开锁状态，锁梁打开（正确开锁状态）
  UNLOCKED_CLOSED = 3, // 开锁状态，锁梁闭合（异常状态）
  LOCKED_OPEN = 4,     // 关锁状态，锁梁打开（异常状态）
  LOCKED_CLOSED = 5,   // 关锁状态，锁梁闭合（正确关锁状态）
}

// 电池状态枚举
export enum BatteryState {
  LOW = 0,      // 低电量
  MEDIUM = 1,   // 中电量
  HIGH = 2,     // 高电量
  CHARGING = 3, // 充电中
}

// 锁具状态
export interface LockStatus {
  state: LockState;           // 锁具状态
  isLocked: boolean;          // 是否锁定（兼容性字段）
  batteryLevel: number;       // 电池电量百分比
  isConnected: boolean;       // 是否已连接锁具
}

// 设备信息
export interface DeviceInfo {
  deviceId: string;
}

// 操作结果
export enum BleOperateResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  NO_BLE_PERMISSION = 'noBlePermission',
  NO_BLE_OPEN = 'noBleOpen',
  RETRY = 'retry',
}

export interface BluetoothKeyDevice {
  deviceId: string;
  name: string;
  rssi: number;
  address?: string;
  addressType?: string;
}

// 连接状态枚举
export enum ConnectionStatus {
  CONNECTING = 'connecting',      // 连接中（蓝牙已连接，但服务验证未完成）
  CONNECTED = 'connected',        // 已连接（服务验证完成，可以通信）
  DISCONNECTING = 'disconnecting', // 断开中
  DISCONNECTED = 'disconnected',   // 已断开
}

export interface BluetoothKeyConnection {
  deviceId: string;
  isConnected: boolean;
  status: ConnectionStatus;       // 新增连接状态字段
  services?: any[]; // 使用BleClient提供的BleService类型
}

export interface BluetoothKeyService {
  uuid: string;
  characteristics: BluetoothKeyCharacteristic[];
}

export interface BluetoothKeyCharacteristic {
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    indicate: boolean;
  };
  value?: ArrayBuffer;
}

export interface BluetoothKeyCommand {
  command: string;
  data?: Uint8Array;
  timeout?: number;
}

export interface BluetoothKeyResponse {
  success: boolean;
  data?: Uint8Array;
  error?: string;
  parsedData?: any; // 业务数据校验后的解析数据
}

export interface BluetoothKeyConfig {
  serviceUUID: string;
  writeCharacteristicUUID: string;
  notifyCharacteristicUUID: string;
  commandTimeout?: number;
  retryCount?: number;
  secretKey?: string; // AES加密密钥
}

// 开锁日志信息
export interface UnlockLogInfo {
  operationType: 'NORMAL_UNLOCK' | 'FORCE_UNLOCK' | 'NORMAL_LOCK' | 'FORCE_LOCK';
  operationResult: 'SUCCESS' | 'FAILED';
  lockId: string;
  operationTime: Date;
  rawData: Uint8Array;
}

// 记录上传状态枚举
export enum RecordUploadStatus {
  IDLE = 'idle',           // 空闲状态
  STARTING = 'starting',   // 开始传输中
  UPLOADING = 'uploading', // 传输中
  PAUSING = 'pausing',     // 暂停传输中
  PAUSED = 'paused',       // 已暂停
  COMPLETING = 'completing', // 完成传输中
  COMPLETED = 'completed',   // 传输完成
  ERROR = 'error'          // 错误状态
}

// 记录上传状态信息
export interface RecordUploadState {
  status: RecordUploadStatus;
  deviceId: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  logCount?: number;       // 已传输的日志数量
}

export interface BluetoothKeyEvent {
  type: 'connected' | 'disconnected' | 'dataReceived' | 'error' | 'deviceReport' | 'lockStatusReport' | 'deviceInfoReport' | 'unlockLogReport' | 'recordUploadStatusChanged' | 'deviceFound' | 'scanCompleted';
  deviceId?: string;
  data?: Uint8Array | BluetoothKeyDevice;
  error?: string;
  report?: any;
  lockStatus?: LockStatus;
  deviceInfo?: DeviceInfo;
  lockId?: string;
  timestamp?: Date;
  logInfo?: UnlockLogInfo;
  operationType?: 'NORMAL_UNLOCK' | 'FORCE_UNLOCK' | 'NORMAL_LOCK' | 'FORCE_LOCK';
  operationResult?: 'SUCCESS' | 'FAILED';
  operationTime?: Date;
  recordUploadState?: RecordUploadState;
}

export type BluetoothKeyEventListener = (event: BluetoothKeyEvent) => void;

export enum BluetoothKeyError {
  // 蓝牙相关错误
  BLUETOOTH_NOT_ENABLED = 'BLUETOOTH_NOT_ENABLED',
  BLUETOOTH_NOT_SUPPORTED = 'BLUETOOTH_NOT_SUPPORTED',
  BLUETOOTH_PERMISSION_DENIED = 'BLUETOOTH_PERMISSION_DENIED',
  LOCATION_PERMISSION_DENIED = 'LOCATION_PERMISSION_DENIED',
  
  // 设备相关错误
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_NOT_CONNECTED = 'DEVICE_NOT_CONNECTED',
  DEVICE_ALREADY_CONNECTED = 'DEVICE_ALREADY_CONNECTED',
  DEVICE_DISCONNECTED = 'DEVICE_DISCONNECTED',
  
  // 连接相关错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',
  
  // 服务相关错误
  SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
  CHARACTERISTIC_NOT_FOUND = 'CHARACTERISTIC_NOT_FOUND',
  CHARACTERISTIC_NOT_SUPPORTED = 'CHARACTERISTIC_NOT_SUPPORTED',
  
  // 通信相关错误
  WRITE_FAILED = 'WRITE_FAILED',
  READ_FAILED = 'READ_FAILED',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  
  // 协议相关错误
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  DATA_PARSING_ERROR = 'DATA_PARSING_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  
  // 业务相关错误
  COMMAND_FAILED = 'COMMAND_FAILED',
  COMMAND_TIMEOUT = 'COMMAND_TIMEOUT',
  INVALID_COMMAND = 'INVALID_COMMAND',
  BUSINESS_ERROR = 'BUSINESS_ERROR',
  
  // 系统相关错误
  SDK_NOT_INITIALIZED = 'SDK_NOT_INITIALIZED',
  SCAN_IN_PROGRESS = 'SCAN_IN_PROGRESS',
  INVALID_CONFIG = 'INVALID_CONFIG',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 蓝牙钥匙SDK自定义错误类
 */
export class BluetoothKeySDKError extends Error {
  public readonly errorType: BluetoothKeyError;
  public readonly originalError?: Error;

  constructor(errorType: BluetoothKeyError, message: string, originalError?: Error) {
    super(message);
    this.name = 'BluetoothKeySDKError';
    this.errorType = errorType;
    this.originalError = originalError;
  }

  /**
   * 创建蓝牙不支持错误
   */
  static bluetoothNotSupported(originalError?: Error): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.BLUETOOTH_NOT_SUPPORTED,
      '此SDK仅支持原生平台（iOS/Android）',
      originalError
    );
  }

  /**
   * 创建SDK未初始化错误
   */
  static sdkNotInitialized(): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.SDK_NOT_INITIALIZED,
      'SDK未初始化，请先调用initialize()'
    );
  }

  /**
   * 创建设备未连接错误
   */
  static deviceNotConnected(): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.DEVICE_NOT_CONNECTED,
      '设备未连接'
    );
  }

  /**
   * 创建扫描进行中错误
   */
  static scanInProgress(): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.SCAN_IN_PROGRESS,
      '扫描已在进行中，请等待当前扫描完成'
    );
  }

  /**
   * 创建服务未找到错误
   */
  static serviceNotFound(serviceUUID: string): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.SERVICE_NOT_FOUND,
      `未找到服务: ${serviceUUID}`
    );
  }

  /**
   * 创建特征值未找到错误
   */
  static characteristicNotFound(): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.CHARACTERISTIC_NOT_FOUND,
      '未找到必要的特征值'
    );
  }

  /**
   * 创建连接失败错误
   */
  static connectionFailed(originalError?: Error): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.CONNECTION_FAILED,
      '连接设备失败',
      originalError
    );
  }

  /**
   * 创建扫描失败错误
   */
  static scanFailed(originalError?: Error): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.DEVICE_NOT_FOUND,
      '扫描设备失败',
      originalError
    );
  }

  /**
   * 创建写入失败错误
   */
  static writeFailed(originalError?: Error): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.WRITE_FAILED,
      '写入数据失败',
      originalError
    );
  }

  /**
   * 创建读取超时错误
   */
  static readTimeout(): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.COMMAND_TIMEOUT,
      '读取响应超时'
    );
  }

  /**
   * 创建协议错误
   */
  static protocolError(message: string, originalError?: Error): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.PROTOCOL_ERROR,
      `协议错误: ${message}`,
      originalError
    );
  }

  /**
   * 创建未知错误
   */
  static unknownError(message: string, originalError?: Error): BluetoothKeySDKError {
    return new BluetoothKeySDKError(
      BluetoothKeyError.UNKNOWN_ERROR,
      `未知错误: ${message}`,
      originalError
    );
  }
}

/**
 * 日志级别
 */
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error'
}

/**
 * 协议层类型
 */
export enum ProtocolLayer {
    PHYSICAL = 'physical',
    TRANSPORT = 'transport',
    APPLICATION = 'application'
}

/**
 * 数据方向
 */
export enum DataDirection {
    SEND = 'send',
    RECEIVE = 'receive'
}

/**
 * 协议数据日志
 */
export interface ProtocolDataLog {
    layer: ProtocolLayer;
    direction: DataDirection;
    deviceId: string;
    timestamp: number;
    rawData: Uint8Array;
    hexData: string;
    description: string;
    metadata?: Record<string, any>;
}

/**
 * 完整数据包日志
 */
export interface CompletePacketLog {
    deviceId: string;
    direction: DataDirection;
    timestamp: number;
    applicationData: {
        raw: Uint8Array;
        hex: string;
        description: string;
    };
    transportData: {
        raw: Uint8Array;
        hex: string;
        encrypted: boolean;
        description: string;
    };
    physicalData: {
        raw: Uint8Array;
        hex: string;
        description: string;
    };
    finalData: {
        raw: Uint8Array;
        hex: string;
    };
    metadata?: Record<string, any>;
}

/**
 * 日志事件
 */
export interface LogEvent {
    type: 'log';
    level: LogLevel;
    message: string;
    deviceId?: string;
    protocolData?: ProtocolDataLog;
    completePacket?: CompletePacketLog;
    error?: Error;
    timestamp: number;
}

/**
 * 日志监听器
 */
export type LogEventListener = (event: LogEvent) => void; 