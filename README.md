# 🔑 Make Capacitor Key SDK

基于 Capacitor 的蓝牙钥匙通讯 SDK

## 🚀 快速开始

### 安装

```bash
npm install make-capacitor-key-sdk
```

### 依赖包

sdk需要以下依赖包

```bash
npm install @capacitor-community/bluetooth-le
```

### 使用案例

# App.vue #

```typescript
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { BluetoothKeySDK, CommandUtils, LogUtils, DEFAULT_CONFIG, LogLevel } from 'make-capacitor-key-sdk'

const sdk = new BluetoothKeySDK({
  ...DEFAULT_CONFIG,
  commandTimeout: 10000,
})

const devices = ref<any[]>([])
const connected = ref(false)
const log = ref<string[]>([])
const currentDeviceId = ref('')
const isScanning = ref(false)
const lockId = ref('1234') // 默认锁ID
const autoControlEnabled = ref(false) // 自动控制开关

// 设置日志级别和详细日志
sdk.setLogLevel(LogLevel.ERROR)
sdk.setDetailedLogsEnabled(false)

// 添加日志监听器
const logListener = (event: any) => {
  const timestamp = new Date(event.timestamp).toLocaleTimeString()
  log.value.push(`[${timestamp}] ${event.level.toUpperCase()}: ${event.message}`)

  // 如果有协议数据，也显示
  if (event.protocolData) {
    const formatted = LogUtils.formatProtocolDataLog(event.protocolData)
    log.value.push(`  ${formatted}`)
  }
}

sdk.addLogListener(logListener)

// 事件监听
onMounted(() => {
  sdk.addEventListener('connected', (e) => {
    connected.value = true
    log.value.push('✅ 已连接: ' + e.deviceId)
    currentDeviceId.value = e.deviceId || ''
  })

  sdk.addEventListener('disconnected', (e) => {
    connected.value = false
    log.value.push('❌ 已断开: ' + (e.deviceId || ''))
    currentDeviceId.value = ''
  })

  sdk.addEventListener('lockStatusReport', (event) => {
    log.value.push('🔒 锁具状态上报: ' + JSON.stringify(event.lockStatus))

    // 自动控制逻辑：根据锁状态自动发送开关锁指令
    if (event.lockStatus && event.lockStatus.isConnected === true && currentDeviceId.value && autoControlEnabled.value) {
      const lockStatus = event.lockStatus
      log.value.push(`🤖 自动控制检测 - 锁状态: ${lockStatus.isLocked ? '关锁' : '开锁'}`)

      // 如果锁具连接且处于开锁状态，自动发送关锁指令
      if (!lockStatus.isLocked) {
        log.value.push('🤖 检测到锁具处于开锁状态，自动发送关锁指令...')
        setTimeout(() => {
          autoLock()
        }, 1000) // 延迟1秒执行，避免过于频繁
      }
      // 如果锁具连接且处于关锁状态，自动发送开锁指令
      else if (lockStatus.isLocked) {
        log.value.push('🤖 检测到锁具处于关锁状态，自动发送开锁指令...')
        setTimeout(() => {
          autoUnlock()
        }, 1000) // 延迟1秒执行，避免过于频繁
      }
    } else if (event.lockStatus && currentDeviceId.value && !autoControlEnabled.value) {
      // 如果自动控制未启用，只记录状态
      const lockStatus = event.lockStatus
      log.value.push(`📊 锁状态更新 - 锁状态: ${lockStatus.isLocked ? '关锁' : '开锁'} (自动控制已关闭)`)
    }
  })

  sdk.addEventListener('deviceInfoReport', (event) => {
    log.value.push('📱 设备信息上报: ' + JSON.stringify(event.deviceInfo))
  })

  sdk.addEventListener('deviceReport', (event) => {
    log.value.push('📡 设备主动上报: ' + JSON.stringify(event.report))
  })

  sdk.addEventListener('error', (event) => {
    log.value.push('❌ 错误: ' + event.error)
  })

  sdk.addEventListener('scanCompleted', () => {
    isScanning.value = false
    log.value.push('🔍 扫描完成')
  })
})

onUnmounted(() => {
  sdk.removeLogListener(logListener)
  sdk.destroy()
})

// 初始化SDK
const initialize = async () => {
  try {
    await sdk.initialize()
    log.value.push('✅ SDK初始化成功')
  } catch (error) {
    log.value.push('❌ SDK初始化失败: ' + error)
  }
}

// 扫描设备
const scan = async () => {
  if (isScanning.value) {
    log.value.push('⚠️ 正在扫描中，请稍候...')
    return
  }

  try {
    isScanning.value = true
    log.value.push('🔍 开始扫描设备...')

    const found = await sdk.scanDevices(8000, (device) => {
      log.value.push(`📱 发现设备: ${device.name || device.deviceId} (${device.rssi}dBm)`)
    })

    devices.value = found
    log.value.push(`✅ 扫描完成，发现 ${found.length} 个设备`)
  } catch (error) {
    log.value.push('❌ 扫描失败: ' + error)
  } finally {
    isScanning.value = false
  }
}

// 连接设备
const connect = async (deviceId: string) => {
  try {
    log.value.push('🔗 正在连接设备: ' + deviceId)
    await sdk.connectToDevice(deviceId)
    log.value.push('✅ 连接成功: ' + deviceId)
  } catch (error) {
    log.value.push('❌ 连接失败: ' + error)
  }
}

// 断开连接
const disconnect = async () => {
  if (!currentDeviceId.value) return

  try {
    await sdk.disconnectDevice(currentDeviceId.value)
    log.value.push('🔌 已断开连接')
  } catch (error) {
    log.value.push('❌ 断开连接失败: ' + error)
  }
}

// 读取设备信息
const readDeviceInfo = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildReadDeviceInfoCommand()
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('📱 设备信息: ' + JSON.stringify(res.parsedData))
    } else {
      log.value.push('❌ 读取设备信息失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 读取设备信息异常: ' + error)
  }
}

// 时间同步
const syncTime = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildTimeSyncCommand()
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('⏰ 时间同步成功')
    } else {
      log.value.push('❌ 时间同步失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 时间同步异常: ' + error)
  }
}

// 开锁
const unlock = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildUnlockCommand(lockId.value)
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('🔓 开锁命令发送成功')
    } else {
      log.value.push('❌ 开锁失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 开锁异常: ' + error)
  }
}

// 关锁
const lock = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildLockCommand(lockId.value)
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('🔒 关锁命令发送成功')
    } else {
      log.value.push('❌ 关锁失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 关锁异常: ' + error)
  }
}

// 强制开锁
const forceUnlock = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildForceUnlockCommand(lockId.value)
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('🔓 强制开锁命令发送成功')
    } else {
      log.value.push('❌ 强制开锁失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 强制开锁异常: ' + error)
  }
}

// 强制关锁
const forceLock = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildForceLockCommand(lockId.value)
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('🔒 强制关锁命令发送成功')
    } else {
      log.value.push('❌ 强制关锁失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 强制关锁异常: ' + error)
  }
}

// 自动开锁（用于自动控制）
const autoUnlock = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildUnlockCommand(lockId.value)
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('🤖 自动开锁命令发送成功')
    } else {
      log.value.push('❌ 自动开锁失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 自动开锁异常: ' + error)
  }
}

// 自动关锁（用于自动控制）
const autoLock = async () => {
  if (!currentDeviceId.value) return

  try {
    const cmd = CommandUtils.buildLockCommand(lockId.value)
    const res = await sdk.sendCommand(currentDeviceId.value, cmd)
    if (res.success) {
      log.value.push('🤖 自动关锁命令发送成功')
    } else {
      log.value.push('❌ 自动关锁失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 自动关锁异常: ' + error)
  }
}

// 清空日志
const clearLog = () => {
  log.value = []
}

// 页面加载时自动初始化
onMounted(() => {
  initialize()
})
</script>

<template>
  <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
    <h1>🔑 蓝牙钥匙演示</h1>

    <!-- 初始化状态 -->
    <div style="margin-bottom: 20px;">
      <h3>📱 SDK状态</h3>
      <p>初始化状态: {{ sdk.isSDKInitialized() ? '✅ 已初始化' : '❌ 未初始化' }}</p>
      <p>连接设备数: {{ sdk.getConnectedDeviceCount() }}</p>
      <p>扫描状态: {{ isScanning ? '🔍 扫描中...' : '⏸️ 未扫描' }}</p>
    </div>

    <!-- 锁ID设置 -->
    <div style="margin-bottom: 20px;">
      <h3>🔢 锁ID设置</h3>
      <input v-model="lockId" placeholder="输入锁ID" style="padding: 8px; margin-right: 10px;" />
      <span>当前锁ID: {{ lockId }}</span>
    </div>

    <!-- 扫描和连接 -->
    <div style="margin-bottom: 20px;">
      <h3>🔍 设备扫描</h3>
      <button @click="scan" :disabled="isScanning" style="padding: 10px 20px; margin-right: 10px;">
        {{ isScanning ? '扫描中...' : '扫描设备' }}
      </button>

      <div v-if="devices.length" style="margin-top: 10px;">
        <h4>发现设备 ({{ devices.length }})</h4>
        <div v-for="d in devices" :key="d.deviceId"
          style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px;">
          <div><strong>名称:</strong> {{ d.name || '未知设备' }}</div>
          <div><strong>ID:</strong> {{ d.deviceId }}</div>
          <div><strong>信号强度:</strong> {{ d.rssi }}dBm</div>
          <button @click="connect(d.deviceId)" style="padding: 5px 10px; margin-top: 5px;">
            连接
          </button>
        </div>
      </div>
    </div>

    <!-- 连接控制 -->
    <div v-if="connected" style="margin-bottom: 20px;">
      <h3>🔗 连接控制</h3>
      <p>当前连接: {{ currentDeviceId }}</p>
      <button @click="disconnect" style="padding: 10px 20px; margin-right: 10px;">断开连接</button>
      <button @click="readDeviceInfo" style="padding: 10px 20px; margin-right: 10px;">读取设备信息</button>
      <button @click="syncTime" style="padding: 10px 20px;">时间同步</button>
    </div>

    <!-- 锁具控制 -->
    <div v-if="connected" style="margin-bottom: 20px;">
      <h3>🔐 锁具控制</h3>

      <!-- 自动控制开关 -->
      <div style="margin-bottom: 15px; padding: 10px; background-color: #f0f8ff; border-radius: 5px;">
        <h4>🤖 自动控制</h4>
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" v-model="autoControlEnabled" style="margin-right: 10px; transform: scale(1.2);" />
          <span>启用自动控制（根据锁状态自动开关锁）</span>
        </label>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
          {{ autoControlEnabled ? '✅ 自动控制已启用 - 锁具状态变化时将自动发送相反指令' : '⏸️ 自动控制已关闭 - 仅记录锁具状态变化' }}
        </p>
      </div>

      <button @click="unlock"
        style="padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white;">开锁</button>
      <button @click="lock"
        style="padding: 10px 20px; margin-right: 10px; background-color: #f44336; color: white;">关锁</button>
      <button @click="forceUnlock"
        style="padding: 10px 20px; margin-right: 10px; background-color: #FF9800; color: white;">强制开锁</button>
      <button @click="forceLock" style="padding: 10px 20px; background-color: #9C27B0; color: white;">强制关锁</button>
    </div>

    <!-- 日志 -->
    <div>
      <h3>📋 日志 <button @click="clearLog" style="padding: 5px 10px; margin-left: 10px;">清空</button></h3>
      <div
        style="border: 1px solid #ddd; padding: 10px; height: 400px; overflow-y: auto; background-color: #f9f9f9; font-family: monospace; font-size: 12px;">
        <div v-for="(item, idx) in log" :key="idx" style="margin-bottom: 5px; word-break: break-all;">
          {{ item }}
        </div>
        <div v-if="log.length === 0" style="color: #999;">暂无日志</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button {
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  opacity: 0.8;
}

input {
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

h1,
h3,
h4 {
  color: #333;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
}
</style>

```

## 📖 详细文档

- [API 文档](./API.md) - 完整的 API 参考

## 📱 平台支持

- ✅ iOS (通过 Capacitor)
- ✅ Android (通过 Capacitor)
- ❌ Web (蓝牙功能受限)

## 🛠️ 开发环境

- Node.js >= 16
- Capacitor >= 7.0

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 📞 支持

如有问题，请通过以下方式联系：

- 📧 Email: seanyan1942@icloud.com

---

**注意**: 此 SDK 专为美科蓝牙钥匙设备设计，请确保您的设备兼容性。
