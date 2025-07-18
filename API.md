# Make Capacitor Key SDK API 文档

## 概述

基于 Capacitor 的美科蓝牙钥匙 SDK，提供完整的蓝牙钥匙解决方案，支持在线开锁和离线开锁两种模式。

### 在线开锁模式
当钥匙插入锁具后，设备会主动上报状态信息，SDK 调用者根据上报信息决定是否开关锁。

### 离线开锁模式 (v1.0.2+)
支持预先配置开锁任务和锁具段下发，实现离线环境下的开锁功能。设备可以存储预设的开锁权限，在无蓝牙连接环境下也能正常开锁。

### 核心特性
- **在线开锁**: 实时状态监控
- **离线开锁**: 任务配置和锁具段下发
- **日志管理**: 开锁记录上传和状态跟踪


## 核心功能

### 在线开锁流程

1. **蓝牙连接建立** - SDK 与蓝牙钥匙建立连接
2. **设备主动上报** - 钥匙插入锁具后主动上报设备信息和锁具状态
3. **业务决策** - SDK 调用者根据上报信息决定是否开锁
4. **执行开锁** - 发送开锁命令到设备

### 离线开锁流程 (v1.0.2+)

1. **任务配置** - 预先配置开锁权限（长期、临时、周期授权）
2. **锁具段下发** - 将锁具ID范围下发到设备
3. **离线存储** - 设备存储开锁权限信息
4. **离线开锁** - 在无蓝牙连接环境下使用预设权限开锁
5. **日志上传** - 连接蓝牙后上传开锁记录

## 主要类和方法

### BluetoothKeySDK

#### 构造函数
```typescript
new BluetoothKeySDK(config: BluetoothKeyConfig)
```

#### 核心方法

##### initialize()
初始化 SDK，请求蓝牙权限并启用蓝牙。

```typescript
await sdk.initialize();
```

##### scanDevices(timeout?: number, onDeviceFound?: (device: BluetoothKeyDevice) => void)
扫描蓝牙钥匙设备。

```typescript
const devices = await sdk.scanDevices(10000, (device) => {
  console.log('发现设备:', device.name);
});
```

##### connectToDevice(deviceId: string, secretKey?: string)
连接到指定的蓝牙钥匙设备。

```typescript
const connection = await sdk.connectToDevice('device-id');
```

##### sendCommand(deviceId: string, command: BluetoothKeyCommand, transportOptions?: TransportOptions)
发送命令到指定的蓝牙钥匙设备，支持业务数据校验。

```typescript
const response = await sdk.sendCommand(deviceId, command);
if (response.success) {
  console.log('命令执行成功:', response.parsedData);
} else {
  console.log('命令执行失败:', response.error);
}
```

#### 便捷操作方法

##### unlock(deviceId: string, lockId: string | number)
开锁操作。

```typescript
const response = await sdk.unlock(deviceId, 'LOCK_001');
if (response.success) {
  console.log('开锁成功');
} else {
  console.log('开锁失败:', response.error);
}
```

##### lock(deviceId: string, lockId: string | number)
关锁操作。

```typescript
const response = await sdk.lock(deviceId, 'LOCK_001');
if (response.success) {
  console.log('关锁成功');
} else {
  console.log('关锁失败:', response.error);
}
```

##### forceUnlock(deviceId: string, lockId: string | number)
强制开锁操作。

```typescript
const response = await sdk.forceUnlock(deviceId, 'LOCK_001');
if (response.success) {
  console.log('强制开锁成功');
} else {
  console.log('强制开锁失败:', response.error);
}
```

##### forceLock(deviceId: string, lockId: string | number)
强制关锁操作。

```typescript
const response = await sdk.forceLock(deviceId, 'LOCK_001');
if (response.success) {
  console.log('强制关锁成功');
} else {
  console.log('强制关锁失败:', response.error);
}
```

##### syncTime(deviceId: string)
校时操作。

```typescript
const response = await sdk.syncTime(deviceId);
if (response.success) {
  console.log('校时成功');
} else {
  console.log('校时失败:', response.error);
}
```

##### readDeviceInfo(deviceId: string)
读取设备信息。

```typescript
const response = await sdk.readDeviceInfo(deviceId);
if (response.success) {
  console.log('设备信息:', response.parsedData);
} else {
  console.log('读取设备信息失败:', response.error);
}
```

#### 任务配置和锁具段下发

##### addLongTermTaskAndSendSegments(deviceId: string, lockIds: (string | number)[])
添加长期授权任务并下发锁具段。

```typescript
const result = await sdk.addLongTermTaskAndSendSegments(deviceId, [1, 2, 3, 4, 5]);
if (result.taskConfigSuccess && result.segmentsSuccess) {
  console.log('长期授权任务配置和锁具段下发全部成功');
} else {
  console.log('操作失败:', result.error);
}
```

##### addTemporaryTaskAndSendSegments(deviceId: string, lockIds: (string | number)[], startTime: Date, endTime: Date)
添加临时授权任务并下发锁具段。

```typescript
const startTime = new Date('2024-01-01');
const endTime = new Date('2024-12-31');
const result = await sdk.addTemporaryTaskAndSendSegments(deviceId, [1, 2, 3, 4, 5], startTime, endTime);
if (result.taskConfigSuccess && result.segmentsSuccess) {
  console.log('临时授权任务配置和锁具段下发全部成功');
} else {
  console.log('操作失败:', result.error);
}
```

##### addPeriodicTaskAndSendSegments(deviceId: string, lockIds: (string | number)[], weeklySchedule: WeeklySchedule[])
添加周期授权任务并下发锁具段。

```typescript
const weeklySchedule = [
  {
    week: 1, // 周一
    authTimes: [
      { startTime: '09:00', endTime: '18:00' }
    ]
  },
  {
    week: 2, // 周二
    authTimes: [
      { startTime: '09:00', endTime: '18:00' }
    ]
  }
];

const result = await sdk.addPeriodicTaskAndSendSegments(deviceId, [1, 2, 3, 4, 5], weeklySchedule);
if (result.taskConfigSuccess && result.segmentsSuccess) {
  console.log('周期授权任务配置和锁具段下发全部成功');
} else {
  console.log('操作失败:', result.error);
}
```

##### deleteTask(deviceId: string)
删除任务配置。

```typescript
const result = await sdk.deleteTask(deviceId);
if (result.taskConfigSuccess) {
  console.log('任务配置删除成功');
} else {
  console.log('任务配置删除失败:', result.error);
}
```

#### 记录上传控制

##### startRecordUpload(deviceId: string)
启动记录上传。

```typescript
const response = await sdk.startRecordUpload(deviceId);
if (response.success) {
  console.log('记录上传启动成功');
} else {
  console.log('记录上传启动失败:', response.error);
}
```

##### stopRecordUpload(deviceId: string)
停止记录上传。

```typescript
const response = await sdk.stopRecordUpload(deviceId);
if (response.success) {
  console.log('记录上传停止成功');
} else {
  console.log('记录上传停止失败:', response.error);
}
```

##### getRecordUploadState(deviceId: string)
获取记录上传状态。

```typescript
const state = sdk.getRecordUploadState(deviceId);
if (state) {
  console.log('记录上传状态:', state.status);
  console.log('日志数量:', state.logCount);
  if (state.error) {
    console.log('错误信息:', state.error);
  }
}
```

##### addEventListener(eventType: string, listener: BluetoothKeyEventListener)
添加事件监听器。

```typescript
sdk.addEventListener('lockStatusReport', (event) => {
  console.log('锁具状态上报:', event.lockStatus);
});
```

##### removeEventListener(eventType: string, listener: BluetoothKeyEventListener)
移除事件监听器。

##### disconnectDevice(deviceId: string)
断开指定设备的连接。

```typescript
await sdk.disconnectDevice('device-id');
```

##### disconnectAll()
断开所有连接。

```typescript
await sdk.disconnectAll();
```

##### getConnectionStatus(deviceId: string)
获取指定设备的连接状态。

##### getAllConnectionStatus()
获取所有连接状态。

##### isDeviceConnected(deviceId: string)
检查指定设备是否已连接。

##### getConnectedDeviceCount()
获取已连接的设备数量。

##### isSDKInitialized()
检查 SDK 是否已初始化。

##### isScanningDevices()
检查是否正在扫描设备。

##### destroy()
销毁 SDK 实例。

#### 日志功能

##### setLogLevel(level: LogLevel)
设置日志级别。

```typescript
sdk.setLogLevel(LogLevel.INFO);
```

##### setDetailedLogsEnabled(enabled: boolean)
启用/禁用详细日志。

```typescript
sdk.setDetailedLogsEnabled(true);
```

##### addLogListener(listener: LogEventListener)
添加日志监听器。

```typescript
sdk.addLogListener((event) => {
  console.log(`[${event.level}] ${event.message}`);
});
```

##### removeLogListener(listener: LogEventListener)
移除日志监听器。

## 事件类型

### 连接事件
- `connected` - 设备连接成功
- `disconnected` - 设备断开连接

### 在线开锁事件
- `deviceReport` - 设备上报事件（包含所有上报信息）
- `lockStatusReport` - 锁具状态上报事件
- `deviceInfoReport` - 设备信息上报事件
- `unlockLogReport` - 开锁日志上报事件

### 记录上传事件
- `recordUploadStatusChanged` - 记录上传状态变化事件

### 通用事件
- `dataReceived` - 接收到数据
- `error` - 发生错误
- `deviceFound` - 发现设备
- `scanCompleted` - 扫描完成

## 类型定义

### BluetoothKeyEvent
```typescript
interface BluetoothKeyEvent {
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
  recordUploadState?: RecordUploadState;
}
```

### LockStatus
```typescript
interface LockStatus {
  state: LockState;
  isLocked: boolean;
  batteryLevel: number;
  isConnected: boolean;
}
```

### DeviceInfo
```typescript
interface DeviceInfo {
  deviceId: string;
}
```

### UnlockLogInfo
```typescript
interface UnlockLogInfo {
  operationType: 'NORMAL_UNLOCK' | 'FORCE_UNLOCK' | 'NORMAL_LOCK' | 'FORCE_LOCK';
  operationResult: 'SUCCESS' | 'FAILED';
  lockId: string;
  operationTime: Date;
  rawData: Uint8Array;
}
```

### RecordUploadState
```typescript
interface RecordUploadState {
  status: RecordUploadStatus;
  logCount?: number;
  error?: string;
  timestamp: Date;
}
```

### WeeklySchedule
```typescript
interface WeeklySchedule {
  week: number; // 0-6表示周日到周六
  authTimes: Array<{
    startTime?: string; // 'HH:MM'
    endTime?: string;   // 'HH:MM'
  }>;
}
```

### BluetoothKeyCommand
```typescript
interface BluetoothKeyCommand {
  command: string;
  data?: Uint8Array;
  timeout?: number;
}
```

### BluetoothKeyResponse
```typescript
interface BluetoothKeyResponse {
  success: boolean;
  data?: Uint8Array;
  error?: string;
  parsedData?: any; // 业务数据校验后的解析数据
}
```

### BluetoothKeyConfig
```typescript
interface BluetoothKeyConfig {
  serviceUUID: string;
  writeCharacteristicUUID: string;
  notifyCharacteristicUUID: string;
  commandTimeout?: number;
  secretKey?: string;
}
```

### TransportOptions
```typescript
interface TransportOptions {
  version?: number;
  ackType?: TransportAckType;
  encryptType?: TransportEncryptType;
  cryptoFactory?: CryptoFactory;
  secretKey?: Uint8Array;
}
```

### 错误处理

#### BluetoothKeyError
错误类型枚举，用于标识不同类型的错误。

```typescript
import { BluetoothKeyError } from 'make-capacitor-key-sdk';

// 错误类型包括：
// - 蓝牙相关：BLUETOOTH_NOT_ENABLED, BLUETOOTH_NOT_SUPPORTED 等
// - 设备相关：DEVICE_NOT_FOUND, DEVICE_NOT_CONNECTED 等
// - 连接相关：CONNECTION_FAILED, CONNECTION_TIMEOUT 等
// - 服务相关：SERVICE_NOT_FOUND, CHARACTERISTIC_NOT_FOUND 等
// - 通信相关：WRITE_FAILED, READ_FAILED 等
// - 协议相关：PROTOCOL_ERROR, DATA_PARSING_ERROR 等
// - 业务相关：COMMAND_FAILED, COMMAND_TIMEOUT 等
// - 系统相关：SDK_NOT_INITIALIZED, SCAN_IN_PROGRESS 等
```

#### BluetoothKeySDKError
自定义错误类，包含错误类型和原始错误信息。

```typescript
import { BluetoothKeySDKError } from 'make-capacitor-key-sdk';

try {
  await sdk.initialize();
} catch (error) {
  if (error instanceof BluetoothKeySDKError) {
    console.log('错误类型:', error.errorType);
    console.log('错误消息:', error.message);
    console.log('原始错误:', error.originalError);
  }
}
```

### 类型定义

#### 设备相关
- `BluetoothKeyDevice` - 蓝牙设备信息
- `BluetoothKeyConnection` - 连接状态
- `BluetoothKeyConfig` - SDK 配置

#### 命令相关
- `BluetoothKeyCommand` - 命令定义
- `BluetoothKeyResponse` - 响应定义（包含校验后的解析数据）
- `BusinessCmd` - 业务命令枚举

#### 事件相关
- `BluetoothKeyEvent` - 事件定义
- `BluetoothKeyEventListener` - 事件监听器
- `BluetoothKeyError` - 错误类型

#### 业务相关
- `LockStatus` - 锁具状态
- `DeviceInfo` - 设备信息
- `UnlockLogInfo` - 开锁日志信息
- `RecordUploadState` - 记录上传状态
- `WeeklySchedule` - 周期授权时间表
- `BleOperateResult` - 操作结果
- `LockState` - 锁具状态枚举
- `BatteryState` - 电池状态枚举
- `RecordUploadStatus` - 记录上传状态枚举

#### 日志相关
- `LogLevel` - 日志级别枚举
- `LogEvent` - 日志事件
- `LogEventListener` - 日志监听器
- `ProtocolDataLog` - 协议数据日志
- `CompletePacketLog` - 完整数据包日志

## 版本信息

```typescript
import { SDK_VERSION } from 'make-capacitor-key-sdk';
console.log('SDK版本:', SDK_VERSION); // '1.0.2'
```

---