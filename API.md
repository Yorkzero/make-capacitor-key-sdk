# Make Capacitor Key SDK API 文档

## 概述

基于 Capacitor 的美科蓝牙钥匙 SDK，专注于在线开锁功能。当钥匙插入锁具后，设备会主动上报状态信息，SDK 调用者根据上报信息决定是否开关锁。

## 核心功能

### 在线开锁流程

1. **蓝牙连接建立** - SDK 与蓝牙钥匙建立连接
2. **设备主动上报** - 钥匙插入锁具后主动上报设备信息和锁具状态
3. **业务决策** - SDK 调用者根据上报信息决定是否开锁
4. **执行开锁** - 发送开锁命令到设备

### 事件驱动架构

SDK 采用事件驱动架构，通过监听设备主动上报事件实现在线开锁：

- `deviceReport` - 设备上报事件

### 业务数据校验

SDK 内置完整的业务数据校验机制，确保响应数据的有效性和完整性：

```typescript
// 发送命令时会自动进行业务数据校验
const response = await sdk.sendCommand(deviceId, command);
if (response.success) {
  // response.parsedData 包含校验后的解析数据
  console.log('校验后的数据:', response.parsedData);
} else {
  console.log('校验失败:', response.error);
}
```

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

### CommandUtils

#### 在线开锁相关命令

##### buildConnectCommand()
构建建立连接命令。

##### buildTimeSyncCommand()
构建校时命令。

##### buildReadDeviceInfoCommand()
构建读取设备信息命令。

##### buildUnlockCommand(lockId: string | number)
构建开锁命令。

```typescript
const command = CommandUtils.buildUnlockCommand('LOCK_001');
```

##### buildLockCommand(lockId: string | number)
构建关锁命令。

```typescript
const command = CommandUtils.buildLockCommand('LOCK_001');
```

##### buildForceUnlockCommand(lockId: string | number)
构建强制开锁命令。

##### buildForceLockCommand(lockId: string | number)
构建强制关锁命令。

##### buildCustomCommand(command: string, data?: Uint8Array, timeout?: number)
构建自定义命令。

## 事件类型

### 连接事件
- `connected` - 设备连接成功
- `disconnected` - 设备断开连接

### 在线开锁事件
- `deviceReport` - 设备上报事件（包含所有上报信息）

### 通用事件
- `dataReceived` - 接收到数据
- `error` - 发生错误
- `deviceFound` - 发现设备
- `scanCompleted` - 扫描完成

## 类型定义

### BluetoothKeyEvent
```typescript
interface BluetoothKeyEvent {
  type: 'connected' | 'disconnected' | 'dataReceived' | 'error' | 'deviceReport' | 'lockStatusReport' | 'deviceInfoReport' | 'deviceFound' | 'scanCompleted';
  deviceId?: string;
  data?: Uint8Array | BluetoothKeyDevice;
  error?: string;
  report?: any;
  lockStatus?: LockStatus;
  deviceInfo?: DeviceInfo;
  lockId?: string;
  timestamp?: Date;
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
- `BleOperateResult` - 操作结果
- `LockState` - 锁具状态枚举
- `BatteryState` - 电池状态枚举

#### 日志相关
- `LogLevel` - 日志级别枚举
- `LogEvent` - 日志事件
- `LogEventListener` - 日志监听器
- `ProtocolDataLog` - 协议数据日志
- `CompletePacketLog` - 完整数据包日志

## 使用示例

### 基本使用
```typescript
import { BluetoothKeySDK, CommandUtils, DEFAULT_CONFIG } from 'make-capacitor-key-sdk';

// 创建 SDK 实例
const sdk = new BluetoothKeySDK(DEFAULT_CONFIG);

// 初始化
await sdk.initialize();

// 扫描设备
const devices = await sdk.scanDevices(10000);

// 连接设备
if (devices.length > 0) {
  await sdk.connectToDevice(devices[0].deviceId);
  
  // 发送命令（自动进行业务数据校验）
  const unlockCommand = CommandUtils.buildUnlockCommand('LOCK_001');
  const response = await sdk.sendCommand(devices[0].deviceId, unlockCommand);
  
  if (response.success) {
    console.log('开锁成功:', response.parsedData);
  } else {
    console.log('开锁失败:', response.error);
  }
}
```

### 多设备连接管理
```typescript
import { BluetoothKeySDK, CommandUtils, DEFAULT_CONFIG } from 'make-capacitor-key-sdk';

const sdk = new BluetoothKeySDK(DEFAULT_CONFIG);
await sdk.initialize();

// 扫描设备
const devices = await sdk.scanDevices(10000);

// 连接多个设备
const connectedDevices: string[] = [];
for (const device of devices.slice(0, 3)) { // 连接前3个设备
  try {
    await sdk.connectToDevice(device.deviceId, `KEY_${device.deviceId}`); // 每个设备使用不同的密钥
    connectedDevices.push(device.deviceId);
    console.log(`设备 ${device.name} 连接成功`);
  } catch (error) {
    console.log(`设备 ${device.name} 连接失败:`, error);
  }
}

// 同时向多个设备发送命令
const unlockCommand = CommandUtils.buildUnlockCommand('LOCK_001');
const responses = await Promise.allSettled(
  connectedDevices.map(deviceId => sdk.sendCommand(deviceId, unlockCommand))
);

responses.forEach((response, index) => {
  const deviceId = connectedDevices[index];
  if (response.status === 'fulfilled') {
    console.log(`设备 ${deviceId} 开锁结果:`, response.value.success);
    if (response.value.success) {
      console.log('校验后的数据:', response.value.parsedData);
    }
  } else {
    console.log(`设备 ${deviceId} 开锁失败:`, response.reason);
  }
});

// 获取所有连接状态
const allConnections = sdk.getAllConnectionStatus();
console.log('当前连接数:', sdk.getConnectedDeviceCount());

// 检查特定设备连接状态
connectedDevices.forEach(deviceId => {
  const isConnected = sdk.isDeviceConnected(deviceId);
  console.log(`设备 ${deviceId} 连接状态:`, isConnected);
});

// 断开特定设备
await sdk.disconnectDevice(connectedDevices[0]);

// 断开所有设备
await sdk.disconnectAll();
```

### 错误处理
```typescript
import { BluetoothKeySDK, BluetoothKeySDKError, BluetoothKeyError } from 'make-capacitor-key-sdk';

try {
  const sdk = new BluetoothKeySDK(DEFAULT_CONFIG);
  await sdk.initialize();
  
  const devices = await sdk.scanDevices(10000);
  if (devices.length === 0) {
    console.log('未发现设备');
    return;
  }
  
  await sdk.connectToDevice(devices[0].deviceId);
  
} catch (error) {
  if (error instanceof BluetoothKeySDKError) {
    switch (error.errorType) {
      case BluetoothKeyError.BLUETOOTH_NOT_SUPPORTED:
        console.log('当前平台不支持蓝牙');
        break;
      case BluetoothKeyError.SDK_NOT_INITIALIZED:
        console.log('SDK未初始化');
        break;
      case BluetoothKeyError.DEVICE_NOT_FOUND:
        console.log('未找到设备');
        break;
      case BluetoothKeyError.CONNECTION_FAILED:
        console.log('连接失败');
        break;
      default:
        console.log('其他错误:', error.message);
    }
  } else {
    console.log('未知错误:', error);
  }
}
```

### 事件监听
```typescript
// 监听数据接收
sdk.addEventListener('dataReceived', (event) => {
  console.log('收到数据:', event.data, '来自设备:', event.deviceId);
});

// 监听连接状态
sdk.addEventListener('connected', (event) => {
  console.log('设备已连接:', event.deviceId);
});

sdk.addEventListener('disconnected', (event) => {
  console.log('设备已断开:', event.deviceId);
});

// 监听锁具状态上报
sdk.addEventListener('lockStatusReport', (event) => {
  console.log('锁具状态:', event.lockStatus);
  console.log('锁ID:', event.lockId);
});

// 监听错误事件
sdk.addEventListener('error', (event) => {
  console.log('发生错误:', event.error, '设备:', event.deviceId);
});
```

### 日志功能
```typescript
import { LogLevel } from 'make-capacitor-key-sdk';

// 设置日志级别
sdk.setLogLevel(LogLevel.INFO);

// 启用详细日志
sdk.setDetailedLogsEnabled(true);

// 添加日志监听器
sdk.addLogListener((event) => {
  console.log(`[${event.level.toUpperCase()}] ${event.message}`);
  
  // 如果有协议数据，显示格式化内容
  if (event.protocolData) {
    console.log(LogUtils.formatProtocolDataLog(event.protocolData));
  }
  
  // 如果有完整数据包，显示格式化内容
  if (event.completePacket) {
    console.log(LogUtils.formatCompletePacketLog(event.completePacket));
  }
});
```

### 自定义配置
```typescript
const customConfig = {
  serviceUUID: 'YOUR_SERVICE_UUID',
  writeCharacteristicUUID: 'YOUR_WRITE_UUID',
  notifyCharacteristicUUID: 'YOUR_NOTIFY_UUID',
  secretKey: 'YOUR_SECRET_KEY',
  commandTimeout: 10000,
};

const sdk = new BluetoothKeySDK(customConfig);
```

## 多连接管理API

### 连接管理
- `connectToDevice(deviceId: string, secretKey?: string)` - 连接指定设备
- `disconnectDevice(deviceId: string)` - 断开指定设备
- `disconnectAll()` - 断开所有设备

### 状态查询
- `getConnectionStatus(deviceId: string)` - 获取指定设备连接状态
- `getAllConnectionStatus()` - 获取所有设备连接状态
- `isDeviceConnected(deviceId: string)` - 检查指定设备是否已连接
- `getConnectedDeviceCount()` - 获取已连接设备数量

### 命令发送
- `sendCommand(deviceId: string, command: BluetoothKeyCommand, transportOptions?: TransportOptions)` - 向指定设备发送命令

## 版本信息

```typescript
import { SDK_VERSION } from 'make-capacitor-key-sdk';
console.log('SDK版本:', SDK_VERSION); // '1.0.0'
```

---