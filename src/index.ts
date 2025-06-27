// 导出主要公共API
export { BluetoothKeySDK } from './BluetoothKeySDK';
export { CommandUtils } from './utils/CommandUtils';
export { LogUtils } from './utils/LogUtils';

// 导出类型定义（用户需要使用的类型）
export type {
  BluetoothKeyDevice,
  BluetoothKeyConnection,
  BluetoothKeyConfig,
  BluetoothKeyCommand,
  BluetoothKeyResponse,
  BluetoothKeyEvent,
  BluetoothKeyEventListener,
  BluetoothKeyError,
  BusinessCmd,
  BleOperateResult,
  LockStatus,
  DeviceInfo,
  // 日志相关类型
  ProtocolDataLog,
  CompletePacketLog,
  LogEvent,
  LogEventListener,
} from './types';

// 导出错误类
export { BluetoothKeySDKError } from './types';

// 导出枚举
export { LogLevel, ProtocolLayer, DataDirection } from './types';

// 导出默认配置 - 信驰达蓝牙模块标准UUID
export const DEFAULT_CONFIG = {
  // 信驰达蓝牙模块服务UUID
  serviceUUID: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
  // 信驰达蓝牙模块写特征UUID
  writeCharacteristicUUID: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E',
  // 信驰达蓝牙模块通知特征UUID
  notifyCharacteristicUUID: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E',
  commandTimeout: 5000,
  retryCount: 3,
  secretKey: 'MK+JorgenR25004!', // 默认加密密钥
};

// 导出SDK版本
export const SDK_VERSION = '1.0.0'; 