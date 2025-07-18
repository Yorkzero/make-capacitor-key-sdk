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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { BluetoothKeySDK, LogUtils, DEFAULT_CONFIG, LogLevel } from 'make-capacitor-key-sdk'

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
const recordUploadState = ref('idle') // 记录上传状态，字符串

// 设置日志级别和详细日志
sdk.setLogLevel(LogLevel.INFO)
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
    recordUploadState.value = 'idle'
  })

  sdk.addEventListener('lockStatusReport', (event) => {
    if (event.lockStatus) {
      const lockStatus = event.lockStatus
      const stateText = getLockStateText(lockStatus.state)
      log.value.push(`🔒 锁具状态上报: ${stateText} (电量: ${lockStatus.batteryLevel}%, 连接: ${lockStatus.isConnected ? '是' : '否'})`)

      // 自动控制逻辑：根据锁状态自动发送开关锁指令
      if (currentDeviceId.value && autoControlEnabled.value) {
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
      } else if (currentDeviceId.value && !autoControlEnabled.value) {
        // 如果自动控制未启用，只记录状态
        log.value.push(`📊 锁状态更新 - 锁状态: ${lockStatus.isLocked ? '关锁' : '开锁'} (自动控制已关闭)`)
      }
    }
  })

  sdk.addEventListener('deviceInfoReport', (event) => {
    log.value.push('📱 设备信息上报: ' + JSON.stringify(event.deviceInfo))
  })

  sdk.addEventListener('deviceReport', (event) => {
    log.value.push('📡 设备主动上报: ' + JSON.stringify(event.report))
  })

  sdk.addEventListener('unlockLogReport', (event) => {
    if (event.logInfo) {
      const logInfo = event.logInfo
      const operationDesc = getOperationTypeDescription(logInfo.operationType)
      const resultText = logInfo.operationResult === 'SUCCESS' ? '成功' : '失败'
      log.value.push(`📝 开锁日志: ${operationDesc} ${resultText} - 锁ID: ${logInfo.lockId} - 时间: ${logInfo.operationTime.toLocaleString()}`)
    }
  })

  sdk.addEventListener('recordUploadStatusChanged', (event) => {
    if (event.recordUploadState) {
      const state = event.recordUploadState
      recordUploadState.value = state.status
      log.value.push(`📤 记录上传状态变化: ${getRecordUploadStatusText(state.status)}`)
      if (state.logCount !== undefined) {
        log.value.push(`  📊 日志数量: ${state.logCount}`)
      }
      if (state.error) {
        log.value.push(`  ❌ 错误: ${state.error}`)
      }
    }
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

// 获取锁状态文本
const getLockStateText = (state: number): string => {
  switch (state) {
    case 255: return '未连接锁'
    case 254: return '未知状态'
    case 0: return '未知状态-锁梁打开'
    case 1: return '未知状态-锁梁闭合'
    case 2: return '开锁状态-锁梁打开'
    case 3: return '开锁状态-锁梁闭合'
    case 4: return '关锁状态-锁梁打开'
    case 5: return '关锁状态-锁梁闭合'
    default: return '未知状态'
  }
}

// 获取记录上传状态文本
const getRecordUploadStatusText = (status: string): string => {
  switch (status) {
    case 'idle': return '空闲'
    case 'starting': return '开始传输中'
    case 'uploading': return '传输中'
    case 'pausing': return '暂停传输中'
    case 'paused': return '已暂停'
    case 'completing': return '完成传输中'
    case 'completed': return '传输完成'
    case 'error': return '传输错误'
    default: return '未知状态'
  }
}

// 获取操作类型描述
const getOperationTypeDescription = (operationType: 'NORMAL_UNLOCK' | 'FORCE_UNLOCK' | 'NORMAL_LOCK' | 'FORCE_LOCK'): string => {
  switch (operationType) {
    case 'NORMAL_UNLOCK': return '正常开锁'
    case 'FORCE_UNLOCK': return '强制开锁'
    case 'NORMAL_LOCK': return '正常关锁'
    case 'FORCE_LOCK': return '强制关锁'
    default: return '未知操作'
  }
}

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

    const found = await sdk.scanDevices(2000, (device) => {
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
    const res = await sdk.readDeviceInfo(currentDeviceId.value)
    if (res.success) {
      log.value.push('📱 读取设备信息成功')
      if (res.parsedData) {
        log.value.push('📱 设备信息: ' + JSON.stringify(res.parsedData))
      }
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
    const res = await sdk.syncTime(currentDeviceId.value)
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
    const res = await sdk.unlock(currentDeviceId.value, lockId.value)
    if (res.success) {
      log.value.push('🔓 开锁成功')
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
    const res = await sdk.lock(currentDeviceId.value, lockId.value)
    if (res.success) {
      log.value.push('🔒 关锁成功')
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
    const res = await sdk.forceUnlock(currentDeviceId.value, lockId.value)
    if (res.success) {
      log.value.push('🔓 强制开锁成功')
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
    const res = await sdk.forceLock(currentDeviceId.value, lockId.value)
    if (res.success) {
      log.value.push('🔒 强制关锁成功')
    } else {
      log.value.push('❌ 强制关锁失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 强制关锁异常: ' + error)
  }
}

// 启动记录上传
const startRecordUpload = async () => {
  if (!currentDeviceId.value) return

  try {
    const res = await sdk.startRecordUpload(currentDeviceId.value)
    if (res.success) {
      log.value.push('📤 启动记录上传成功')
    } else {
      log.value.push('❌ 启动记录上传失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 启动记录上传异常: ' + error)
  }
}

// 停止记录上传
const stopRecordUpload = async () => {
  if (!currentDeviceId.value) return

  try {
    const res = await sdk.stopRecordUpload(currentDeviceId.value)
    if (res.success) {
      log.value.push('⏹️ 停止记录上传成功')
    } else {
      log.value.push('❌ 停止记录上传失败: ' + res.error)
    }
  } catch (error) {
    log.value.push('❌ 停止记录上传异常: ' + error)
  }
}

// 任务下发相关功能
// 生成随机锁具段列表
const generateRandomLockSegments = (count: number): string => {
  const segments = []
  for (let i = 0; i < count; i++) {
    // 生成25000000-25999999范围内的随机锁具ID
    const randomId = Math.floor(Math.random() * 1000000) + 25000000
    segments.push(randomId.toString())
  }
  return segments.join(',')
}

// 生成100段随机锁具ID
const taskLockIds = ref(generateRandomLockSegments(100)) // 锁具ID列表，逗号分隔
const taskStartTime = ref('2024-01-01T00:00:00') // 临时授权开始时间
const taskEndTime = ref('2026-12-31T23:59:59') // 临时授权结束时间

// 计算锁具ID数量
const lockIdCount = computed(() => {
  return taskLockIds.value.split(',').filter(id => id.trim() !== '').length
})

// 重新生成锁具段列表
const regenerateLockSegments = () => {
  taskLockIds.value = generateRandomLockSegments(100)
  log.value.push('🔄 重新生成100段随机锁具ID')
}

// 添加长期授权任务并下发锁具段
const addLongTermTaskAndSendSegments = async () => {
  if (!currentDeviceId.value) return

  try {
    const lockIds = taskLockIds.value.split(',').map(id => id.trim())
    const res = await sdk.addLongTermTaskAndSendSegments(currentDeviceId.value, lockIds)
    if (res.taskConfigSuccess && res.segmentsSuccess) {
      log.value.push('✅ 添加长期授权任务并下发锁具段成功')
    } else {
      log.value.push(`❌ 添加长期授权任务并下发锁具段失败: ${res.error}`)
      if (!res.taskConfigSuccess) {
        log.value.push('  - 任务配置失败')
      }
      if (!res.segmentsSuccess) {
        log.value.push('  - 锁具段下发失败')
      }
    }
  } catch (error) {
    log.value.push('❌ 添加长期授权任务并下发锁具段异常: ' + error)
  }
}

// 添加临时授权任务并下发锁具段
const addTemporaryTaskAndSendSegments = async () => {
  if (!currentDeviceId.value) return

  try {
    const lockIds = taskLockIds.value.split(',').map(id => id.trim())
    const startTime = new Date(taskStartTime.value)
    const endTime = new Date(taskEndTime.value)
    const res = await sdk.addTemporaryTaskAndSendSegments(currentDeviceId.value, lockIds, startTime, endTime)
    if (res.taskConfigSuccess && res.segmentsSuccess) {
      log.value.push('✅ 添加临时授权任务并下发锁具段成功')
    } else {
      log.value.push(`❌ 添加临时授权任务并下发锁具段失败: ${res.error}`)
      if (!res.taskConfigSuccess) {
        log.value.push('  - 任务配置失败')
      }
      if (!res.segmentsSuccess) {
        log.value.push('  - 锁具段下发失败')
      }
    }
  } catch (error) {
    log.value.push('❌ 添加临时授权任务并下发锁具段异常: ' + error)
  }
}

// 添加周期授权任务并下发锁具段
const addPeriodicTaskAndSendSegments = async () => {
  if (!currentDeviceId.value) return

  try {
    const lockIds = taskLockIds.value.split(',').map(id => id.trim())
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
      },
      {
        week: 3, // 周三
        authTimes: [
          { startTime: '09:00', endTime: '18:00' }
        ]
      },
      {
        week: 4, // 周四
        authTimes: [
          { startTime: '09:00', endTime: '18:00' }
        ]
      },
      {
        week: 5, // 周五
        authTimes: [
          { startTime: '09:00', endTime: '18:00' }
        ]
      }
    ]

    const res = await sdk.addPeriodicTaskAndSendSegments(currentDeviceId.value, lockIds, weeklySchedule)
    if (res.taskConfigSuccess && res.segmentsSuccess) {
      log.value.push('✅ 添加周期授权任务并下发锁具段成功')
    } else {
      log.value.push(`❌ 添加周期授权任务并下发锁具段失败: ${res.error}`)
      if (!res.taskConfigSuccess) {
        log.value.push('  - 任务配置失败')
      }
      if (!res.segmentsSuccess) {
        log.value.push('  - 锁具段下发失败')
      }
    }
  } catch (error) {
    log.value.push('❌ 添加周期授权任务并下发锁具段异常: ' + error)
  }
}

// 删除任务
const deleteTask = async () => {
  if (!currentDeviceId.value) return

  try {
    const res = await sdk.deleteTask(currentDeviceId.value)
    if (res.taskConfigSuccess) {
      log.value.push('✅ 删除任务成功')
    } else {
      log.value.push(`❌ 删除任务失败: ${res.error}`) 
      if (!res.taskConfigSuccess) {
        log.value.push('  - 任务删除失败')
      }   
    }
  } catch (error) {
    log.value.push('❌ 删除任务异常: ' + error)
  }
}

// 自动开锁（用于自动控制）
const autoUnlock = async () => {
  if (!currentDeviceId.value) return

  try {
    const res = await sdk.unlock(currentDeviceId.value, lockId.value)
    if (res.success) {
      log.value.push('🤖 自动开锁成功')
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
    const res = await sdk.lock(currentDeviceId.value, lockId.value)
    if (res.success) {
      log.value.push('🤖 自动关锁成功')
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
      <p v-if="connected">记录上传状态: {{ getRecordUploadStatusText(recordUploadState) }}</p>
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

    <!-- 记录上传控制 -->
    <div v-if="connected" style="margin-bottom: 20px;">
      <h3>📤 记录上传控制</h3>
      <button @click="startRecordUpload"
        style="padding: 10px 20px; margin-right: 10px; background-color: #2196F3; color: white;">启动记录上传</button>
      <button @click="stopRecordUpload"
        style="padding: 10px 20px; background-color: #FF5722; color: white;">停止记录上传</button>
    </div>

    <!-- 任务下发控制 -->
    <div v-if="connected" style="margin-bottom: 20px;">
      <h3>📦 任务下发控制</h3>
      <div style="margin-bottom: 10px;">
        <label>锁具ID列表 (逗号分隔): <input type="text" v-model="taskLockIds"
            style="padding: 5px; margin-left: 10px; width: 400px;" /></label>
        <span style="margin-left: 10px; color: #666;">当前锁具数量: {{ lockIdCount }} 个</span>
        <button @click="regenerateLockSegments"
          style="padding: 5px 10px; margin-left: 10px; background-color: #607D8B; color: white;">重新生成</button>
      </div>
      <div style="margin-bottom: 10px;">
        <label>临时授权开始时间: <input type="datetime-local" v-model="taskStartTime"
            style="padding: 5px; margin-left: 10px;" /></label>
      </div>
      <div style="margin-bottom: 10px;">
        <label>临时授权结束时间: <input type="datetime-local" v-model="taskEndTime"
            style="padding: 5px; margin-left: 10px;" /></label>
      </div>
      <button @click="addLongTermTaskAndSendSegments"
        style="padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white;">添加长期授权任务并下发锁具段</button>
      <button @click="addTemporaryTaskAndSendSegments"
        style="padding: 10px 20px; margin-right: 10px; background-color: #FF9800; color: white;">添加临时授权任务并下发锁具段</button>
      <button @click="addPeriodicTaskAndSendSegments"
        style="padding: 10px 20px; background-color: #2196F3; color: white;">添加周期授权任务并下发锁具段</button>
      <button @click="deleteTask"
        style="padding: 10px 20px; background-color: #FF5722; color: white;">删除任务</button>
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

## 📋 版本更新记录

### v1.0.2 (2025-07-17)

#### 🆕 新增功能

##### 离线开锁任务下发
- **任务配置和锁具段下发整合功能**
  - `addLongTermTaskAndSendSegments()` - 添加长期授权任务并下发锁具段
  - `addTemporaryTaskAndSendSegments()` - 添加临时授权任务并下发锁具段
  - `addPeriodicTaskAndSendSegments()` - 添加周期授权任务并下发锁具段
  - `deleteTask()` - 删除任务配置

##### 离线开锁日志上传
- **记录上传控制**
  - `startRecordUpload()` - 启动记录上传
  - `stopRecordUpload()` - 停止记录上传
  - `getRecordUploadState()` - 获取记录上传状态

- **事件通知**
  - `recordUploadStatusChanged` - 记录上传状态变化事件
  - `unlockLogReport` - 开锁日志上报事件

##### 便捷操作方法
- **基础操作封装**
  - `unlock()` - 开锁操作
  - `lock()` - 关锁操作
  - `forceUnlock()` - 强制开锁操作
  - `forceLock()` - 强制关锁操作
  - `syncTime()` - 校时操作
  - `readDeviceInfo()` - 读取设备信息

#### 🔧 技术改进

- **接口优化**
  - 移除 `CommandUtils` 对外导出

#### 📚 文档更新

- 更新 API 文档，新增便捷方法说明
- 添加任务配置和记录上传的完整使用示例
- 更新事件类型和接口定义
- 更新示例代码

### v1.0.1

- 更新 `package.json` 中的仓库地址、问题追踪地址和主页链接库

### v1.0.0 (2025-06-27)

- 基础蓝牙连接和通信功能
- 在线开锁核心功能
- 多设备连接管理
- 事件驱动架构
- 完整的错误处理机制
- 详细的日志记录功能

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 📞 支持

如有问题，请通过以下方式联系：

- 📧 Email: seanyan1942@icloud.com

---

**注意**: 此 SDK 专为美科蓝牙钥匙设备设计，请确保您的设备兼容性。
