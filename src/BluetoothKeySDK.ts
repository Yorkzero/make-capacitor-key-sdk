import { Capacitor } from '@capacitor/core';
import { BleClient, numberToUUID } from '@capacitor-community/bluetooth-le';
import {
    BluetoothKeyDevice,
    BluetoothKeyConnection,
    BluetoothKeyConfig,
    BluetoothKeyCommand,
    BluetoothKeyResponse,
    BluetoothKeyEvent,
    BluetoothKeyEventListener,
    BluetoothKeySDKError,
    BusinessCmd,
    BleOperateResult,
    ApplicationData,
    TransportData,
    LogLevel,
    ProtocolLayer,
    DataDirection,
    LogEventListener,
    LogEvent,
    TransportAckType,
    TransportEncryptType,
    ConnectionStatus,
} from './types';
import { PhysicalLayer } from './protocol/PhysicalLayer';
import { TransportLayerV1 } from './protocol/TransportLayer';
import { DefaultApplicationLayer } from './protocol/ApplicationLayer';
import { CommandUtils } from './utils/CommandUtils';
import { LogUtils } from './utils/LogUtils';
import { CryptoFactory } from './protocol/CryptoFactory';

export class BluetoothKeySDK {
    private config: BluetoothKeyConfig;
    private connections: Map<string, BluetoothKeyConnection> = new Map();
    private eventListeners: Map<string, BluetoothKeyEventListener[]> = new Map();
    private isInitialized = false;

    // 协议层实例
    private readonly physicalLayer = new PhysicalLayer();
    private readonly transportLayer = new TransportLayerV1();
    private readonly applicationLayer = new DefaultApplicationLayer();

    // 业务状态 - 每个连接独立管理
    private frameIndexes: Map<string, number> = new Map();
    private dynamicKeys: Map<string, Uint8Array> = new Map();
    private pendingMessages: Map<string, Map<number, Uint8Array>> = new Map();
    private currentBusiness: Map<string, BusinessCmd> = new Map();
    private businessResults: Map<string, BleOperateResult> = new Map();

    // 数据缓存和异步处理 - 每个连接独立管理
    private dataBuffers: Map<string, Uint8Array> = new Map();
    private receivingTimeoutTimers: Map<string, NodeJS.Timeout> = new Map();
    private scanCallback?: (result: any) => void;
    private isScanning = false;

    // 帧序号匹配机制 - 每个连接独立管理
    private pendingFrameResponses: Map<string, Map<number, { resolve: (data: Uint8Array) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>> = new Map();

    // 日志功能
    private logListeners: LogEventListener[] = [];
    private logLevel: LogLevel = LogLevel.INFO;
    private enableDetailedLogs: boolean = true;

    private _authStatusMap: Map<string, boolean> = new Map();

    // 认证Promise管理 - 每个设备独立的认证Promise
    private authPromises: Map<string, {
        resolve: (value: void) => void;
        reject: (error: Error) => void;
        timer: NodeJS.Timeout;
    }> = new Map();

    // 断开连接状态跟踪 - 避免重复处理
    private disconnectingDevices: Set<string> = new Set();

    constructor(config: BluetoothKeyConfig) {
        const defaultConfig: BluetoothKeyConfig = {
            serviceUUID: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
            writeCharacteristicUUID: '6E400002-B5A3-F393-E0A9-E50E24DCCA9E',
            notifyCharacteristicUUID: '6E400003-B5A3-F393-E0A9-E50E24DCCA9E',
            commandTimeout: 5000,
            secretKey: 'MK+JorgenR25004!',
        };

        // 合并用户配置和默认配置
        this.config = {
            ...defaultConfig,
            ...config,
        };

        this._authStatusMap = new Map();
    }

    /**
     * 设置日志级别
     */
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * 启用/禁用详细日志
     */
    setDetailedLogsEnabled(enabled: boolean): void {
        this.enableDetailedLogs = enabled;
    }

    /**
     * 添加日志监听器
     */
    addLogListener(listener: LogEventListener): void {
        this.logListeners.push(listener);
    }

    /**
     * 移除日志监听器
     */
    removeLogListener(listener: LogEventListener): void {
        const index = this.logListeners.indexOf(listener);
        if (index > -1) {
            this.logListeners.splice(index, 1);
        }
    }

    /**
     * 内部日志方法
     */
    private log(level: LogLevel, message: string, deviceId?: string, protocolData?: any, completePacket?: any, error?: Error): void {
        // 检查日志级别
        const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentLevelIndex = levelOrder.indexOf(this.logLevel);
        const messageLevelIndex = levelOrder.indexOf(level);
        
        if (messageLevelIndex < currentLevelIndex) {
            return; // 日志级别不够，不输出
        }

        const logEvent = LogUtils.createLogEvent(level, message, deviceId, protocolData, completePacket, error);
        
        // 输出到控制台
        const timestamp = new Date(logEvent.timestamp).toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        
        if (level === LogLevel.ERROR) {
            console.error(`${prefix} ${message}`, error || '');
        } else if (level === LogLevel.WARN) {
            console.warn(`${prefix} ${message}`);
        } else if (level === LogLevel.INFO) {
            console.info(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }

        // 如果有详细日志，输出格式化内容
        if (this.enableDetailedLogs) {
            if (protocolData) {
                console.log(LogUtils.formatProtocolDataLog(protocolData));
            }
            if (completePacket) {
                console.log(LogUtils.formatCompletePacketLog(completePacket));
            }
        }

        // 触发日志事件
        this.logListeners.forEach(listener => {
            try {
                listener(logEvent);
            } catch (error) {
                console.error('日志监听器执行错误:', error);
            }
        });
    }

    /**
     * 初始化SDK
     */
    async initialize(): Promise<void> {
        try {
            this.log(LogLevel.INFO, '开始初始化SDK');
            
            if (!Capacitor.isNativePlatform()) {
                this.log(LogLevel.ERROR, '蓝牙功能不支持，需要原生平台');
                throw BluetoothKeySDKError.bluetoothNotSupported();
            }

            // 检查Android平台的位置服务
            if (Capacitor.getPlatform() === 'android') {
                const isLocationEnabled = await BleClient.isLocationEnabled();
                if (!isLocationEnabled) {
                    this.log(LogLevel.WARN, '位置服务未启用，尝试打开设置');
                    await BleClient.openLocationSettings();
                }
            }

            // 初始化蓝牙客户端
            await BleClient.initialize();

            this.isInitialized = true;
            this.log(LogLevel.INFO, 'SDK初始化成功');
        } catch (error) {
            this.log(LogLevel.ERROR, 'SDK初始化失败', undefined, undefined, undefined, error instanceof Error ? error : undefined);
            if (error instanceof BluetoothKeySDKError) {
                throw error;
            }
            throw BluetoothKeySDKError.unknownError('初始化失败', error instanceof Error ? error : undefined);
        }
    }

    /**
     * 扫描蓝牙钥匙设备
     * @param timeout 扫描超时时间（毫秒）
     * @param onDeviceFound 可选，每发现新设备时回调
     */
    async scanDevices(timeout: number = 10000, onDeviceFound?: (device: BluetoothKeyDevice) => void): Promise<BluetoothKeyDevice[]> {
        if (!this.isInitialized) {
            throw BluetoothKeySDKError.sdkNotInitialized();
        }

        if (this.isScanning) {
            throw BluetoothKeySDKError.scanInProgress();
        }

        try {
            this.log(LogLevel.INFO, `开始扫描设备，超时时间: ${timeout}ms`);
            this.isScanning = true;
            const devices: BluetoothKeyDevice[] = [];
            const foundDeviceIds = new Set<string>();
            
            // 创建扫描回调函数
            this.scanCallback = (result) => {
                const device: BluetoothKeyDevice = {
                    deviceId: result.device.deviceId,
                    name: result.device.name || 'Unknown Device',
                    rssi: result.rssi || 0,
                    address: undefined, // BleClient API不提供address
                    addressType: undefined, // BleClient API不提供addressType
                };
                // 去重
                if (!foundDeviceIds.has(device.deviceId)) {
                    foundDeviceIds.add(device.deviceId);
                    devices.push(device);
                    // 回调方式
                    if (onDeviceFound) onDeviceFound(device);
                    // 事件方式
                    this.emitEvent('deviceFound', { type: 'deviceFound', deviceId: device.deviceId, data: device });
                }
            };

            // 开始扫描
            await BleClient.requestLEScan(
                {
                    services: [this.config.serviceUUID],
                    allowDuplicates: false,
                },
                this.scanCallback
            );

            // 等待扫描完成
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, timeout);
            });
            
            // 停止扫描
            await BleClient.stopLEScan();
            
            this.log(LogLevel.INFO, `扫描完成，发现 ${devices.length} 个设备`);
            // 事件方式：扫描完成
            this.emitEvent('scanCompleted', {});
            return devices;
        } catch (error) {
            this.log(LogLevel.ERROR, '扫描失败', undefined, undefined, undefined, error instanceof Error ? error : undefined);
            throw BluetoothKeySDKError.scanFailed(error instanceof Error ? error : undefined);
        } finally {
            this.isScanning = false;
            this.scanCallback = undefined;
        }
    }

    /**
     * 连接到蓝牙钥匙设备
     */
    async connectToDevice(deviceId: string, secretKey?: string): Promise<BluetoothKeyConnection> {
        if (!this.isInitialized) {
            throw BluetoothKeySDKError.sdkNotInitialized();
        }

        // 检查是否已经连接
        if (this.connections.has(deviceId)) {
            const existingConnection = this.connections.get(deviceId)!;
            if (existingConnection.isConnected) {
                this.log(LogLevel.WARN, `设备 ${deviceId} 已经连接`);
                throw BluetoothKeySDKError.unknownError(`设备 ${deviceId} 已经连接`);
            }
        }

        try {
            this.log(LogLevel.INFO, `开始连接设备: ${deviceId}`);
            
            // 连接到设备
            await BleClient.connect(deviceId, (deviceId: string) => {
                this.log(LogLevel.WARN, `设备主动断开连接: ${deviceId}`, deviceId);
                this._handleDeviceDisconnected(deviceId);
            });

            // 立即设置连接状态，这样在后续验证失败时能够正确断开
            const connection: BluetoothKeyConnection = {
                deviceId,
                isConnected: true,
                status: ConnectionStatus.CONNECTING, // 连接中状态
                services: [], // 暂时为空，后续会更新
            };
            this.connections.set(deviceId, connection);

            // 发现服务
            const services = await BleClient.getServices(deviceId);

            // 更新连接状态中的服务信息
            connection.services = services;

            // 验证服务是否存在
            const targetService = services.find(s => s.uuid.toLowerCase() === this.config.serviceUUID.toLowerCase());
            if (!targetService) {
                this.log(LogLevel.ERROR, `服务未找到: ${this.config.serviceUUID}`);
                throw BluetoothKeySDKError.serviceNotFound(this.config.serviceUUID);
            }

            const characteristics = targetService.characteristics;
            const writeChar = characteristics.find(c => c.uuid.toLowerCase() === this.config.writeCharacteristicUUID.toLowerCase());
            const notifyChar = characteristics.find(c => c.uuid.toLowerCase() === this.config.notifyCharacteristicUUID.toLowerCase());
            
            if (!writeChar || !notifyChar) {
                this.log(LogLevel.ERROR, '特征未找到');
                throw BluetoothKeySDKError.characteristicNotFound();
            }

            // 设置通知监听
            if (notifyChar.properties.notify) {
                await BleClient.startNotifications(
                    deviceId,
                    this.config.serviceUUID,
                    this.config.notifyCharacteristicUUID,
                    (value) => {
                        this.handleReceivedData(deviceId, new Uint8Array(value.buffer));
                    }
                );
            }
            
            // 初始化连接特定的状态
            this.frameIndexes.set(deviceId, 0);
            this.dynamicKeys.set(deviceId, new TextEncoder().encode(secretKey || this.config.secretKey || ''));
            this.pendingMessages.set(deviceId, new Map());
            this.currentBusiness.set(deviceId, BusinessCmd.NONE);
            this.businessResults.set(deviceId, BleOperateResult.FAILED);
            this.dataBuffers.set(deviceId, new Uint8Array());
            this.pendingFrameResponses.set(deviceId, new Map());
            
            // 初始化认证状态为未定义（undefined表示认证进行中）
            this._authStatusMap.delete(deviceId);

            // 更新连接状态为已连接
            connection.status = ConnectionStatus.CONNECTED;

            this.log(LogLevel.INFO, `设备连接成功: ${deviceId}`);
            this.emitEvent('connected', { deviceId });

            // === 自动多步认证流程 ===
            await this._autoAuthenticate(deviceId);
            // === 多步认证结束 ===

            return connection;
        } catch (error) {
            this.log(LogLevel.ERROR, `连接设备失败: ${deviceId}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            // 确保连接失败时清理资源
            await this._cleanupConnection(deviceId);
            if (error instanceof BluetoothKeySDKError) {
                throw error;
            }
            throw BluetoothKeySDKError.connectionFailed(error instanceof Error ? error : undefined);
        }
    }

    /**
     * 校验响应体是否为请求体中每一位与0x5A异或后的数据
     */
    private checkXorValidation(requestData: Uint8Array, responseData: Uint8Array): boolean {
        if (!requestData || !responseData || requestData.length === 0 || responseData.length === 0) {
            return false;
        }

        // 检查命令是否匹配
        if (responseData[0] !== requestData[0]) {
            return false;
        }

        // 提取请求体和响应体（去掉命令字节）
        const requestBody = requestData.slice(1);
        const responseBody = responseData.slice(1);

        // 检查长度是否匹配
        if (responseBody.length !== requestBody.length) {
            return false;
        }

        // 校验每一位是否满足异或关系：responseBody[i] == requestBody[i] ^ 0x5A
        for (let i = 0; i < requestBody.length; i++) {
            if (responseBody[i] !== (requestBody[i] ^ 0x5A)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 处理ACK数据
     */
    private async handleAckData(deviceId: string, frameIndex: number, responseData: Uint8Array): Promise<void> {
        const devicePendingMessages = this.pendingMessages.get(deviceId);
        if (!devicePendingMessages) return;

        const requestData = devicePendingMessages.get(frameIndex);
        if (!requestData || requestData.length === 0 || responseData.length === 0) {
            return;
        }

        // 检查命令是否匹配
        if (responseData[0] !== requestData[0]) {
            return;
        }

        // 取消接收超时定时器
        this.cancelReceivingTimeoutTimer(deviceId);

        // 从队列中移除
        devicePendingMessages.delete(frameIndex);

        // 根据命令类型进行校验和处理
        // 注意：这里只处理设备主动发起的认证命令（0x02, 0x03, 0x04）
        // 第一次认证（0x01）已经在_startFirstAuth中通过异步等待处理
        switch (responseData[0]) {

            default:
                // 其他命令的ACK处理
                this.log(LogLevel.DEBUG, `收到ACK响应，命令: 0x${responseData[0].toString(16).padStart(2, '0')}, 帧序号: ${frameIndex}`, deviceId);
                break;
        }
    }

    /**
     * 自动多步认证流程（四次握手+时间同步）
     * 使用Promise-based方式，替代混合的异步等待和回调
     */
    private async _autoAuthenticate(deviceId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // 设置认证超时
            const timer = setTimeout(() => {
                this.authPromises.delete(deviceId);
                this._authStatusMap.set(deviceId, false);
                reject(BluetoothKeySDKError.unknownError('多步认证超时'));
            }, 10000);

            // 保存认证Promise
            this.authPromises.set(deviceId, { resolve, reject, timer });

            // 开始第一次认证
            this._startFirstAuth(deviceId).catch(error => {
                // 第一次认证失败，清理并拒绝Promise
                this.authPromises.delete(deviceId);
                this._authStatusMap.set(deviceId, false);
                reject(error);
            });
        });
    }

    /**
     * 开始第一次认证
     */
    private async _startFirstAuth(deviceId: string): Promise<void> {
        const connectCmd = CommandUtils.buildConnectCommand();
        
        // 注意：第一次认证不在pendingMessages中保存，避免在回调中重复处理
        // 因为第一次认证的响应会通过sendCommand的异步等待直接处理
        
        const resp1 = await this.sendCommand(deviceId, connectCmd);
        if (!resp1.success || !resp1.data) {
            throw BluetoothKeySDKError.unknownError('第一次认证失败');
        }
        
        // 校验异或数据
        if (!this.checkXorValidation(connectCmd.data || new Uint8Array(), resp1.data)) {
            throw BluetoothKeySDKError.unknownError('第一次认证校验失败');
        }
        
        // 第一次认证成功，等待后续认证步骤通过handleAckData处理
    }

    /**
     * 完成认证流程
     */
    private _completeAuth(deviceId: string, success: boolean, error?: Error): void {
        const authPromise = this.authPromises.get(deviceId);
        if (!authPromise) return;

        // 清理认证Promise
        this.authPromises.delete(deviceId);
        clearTimeout(authPromise.timer);

        // 设置认证状态
        this._authStatusMap.set(deviceId, success);

        if (success) {
            authPromise.resolve();
        } else {
            this.log(LogLevel.ERROR, '多步认证流程失败', deviceId);
            authPromise.reject(error || BluetoothKeySDKError.unknownError('多步认证失败'));
        }
    }

    /**
     * 断开指定设备的连接
     */
    async disconnectDevice(deviceId: string): Promise<void> {
        const connection = this.connections.get(deviceId);
        if (!connection) {
            return;
        }

        // 检查是否已经在断开中，避免重复处理
        if (this.disconnectingDevices.has(deviceId)) {
            return;
        }

        try {
            // 标记为正在断开
            this.disconnectingDevices.add(deviceId);
            
            // 设置断开中状态
            connection.status = ConnectionStatus.DISCONNECTING;
            
            // 清理该设备的所有待处理响应
            this.clearPendingFrameResponses(deviceId);
            
            await BleClient.disconnect(deviceId);

            // 设置已断开状态
            connection.status = ConnectionStatus.DISCONNECTED;
            connection.isConnected = false;

            this.emitEvent('disconnected', { deviceId });
            
            // 清理该设备的所有状态
            this.connections.delete(deviceId);
            this.frameIndexes.delete(deviceId);
            this.dynamicKeys.delete(deviceId);
            this.pendingMessages.delete(deviceId);
            this.currentBusiness.delete(deviceId);
            this.businessResults.delete(deviceId);
            this.dataBuffers.delete(deviceId);
            this.pendingFrameResponses.delete(deviceId);
            
            // 清理认证状态和认证Promise
            this._authStatusMap.delete(deviceId);
            const authPromise = this.authPromises.get(deviceId);
            if (authPromise) {
                clearTimeout(authPromise.timer);
                this.authPromises.delete(deviceId);
            }
            
            // 清理定时器
            const timer = this.receivingTimeoutTimers.get(deviceId);
            if (timer) {
                clearTimeout(timer);
                this.receivingTimeoutTimers.delete(deviceId);
            }
        } catch (error) {
            throw BluetoothKeySDKError.unknownError('断开连接失败', error instanceof Error ? error : undefined);
        } finally {
            // 清理断开标志
            this.disconnectingDevices.delete(deviceId);
        }
    }

    /**
     * 断开所有连接
     */
    async disconnectAll(): Promise<void> {
        const deviceIds = Array.from(this.connections.keys());
        for (const deviceId of deviceIds) {
            await this.disconnectDevice(deviceId);
        }
    }

    /**
     * 发送命令到指定的蓝牙钥匙设备
     */
    async sendCommand(
        deviceId: string, 
        command: BluetoothKeyCommand,
        transportOptions?: {
            version?: number;
            ackType?: TransportAckType;
            encryptType?: TransportEncryptType;
            cryptoFactory?: CryptoFactory;
            secretKey?: Uint8Array;
        }
    ): Promise<BluetoothKeyResponse> {
        const connection = this.connections.get(deviceId);
        if (!connection || !connection.isConnected) {
            throw BluetoothKeySDKError.deviceNotConnected();
        }

        try {
            const timeout = command.timeout || this.config.commandTimeout || 5000;
            const ackType = transportOptions?.ackType || TransportAckType.REQUEST_WITH_ACK;

            this.log(LogLevel.INFO, `发送命令: ${command.command}, ackType: ${ackType}`, deviceId);

            // 获取当前帧序号（用于后续匹配响应）
            const currentFrameIndex = this.frameIndexes.get(deviceId) || 0;

            // 构建完整的数据包（支持传输层参数）
            const data = await this.buildCompletePacket(deviceId, command.data || new Uint8Array(), {
                frameIndex: currentFrameIndex,
                ...transportOptions,
            });

            this.log(LogLevel.DEBUG, `数据包构建完成，长度: ${data.length} 字节`, deviceId);

            // 写入数据
            await BleClient.write(
                deviceId,
                this.config.serviceUUID,
                this.config.writeCharacteristicUUID,
                new DataView(data.buffer)
            );

            this.log(LogLevel.INFO, `数据写入成功`, deviceId);

            // 根据ackType判断是否需要等待响应
            if (ackType === TransportAckType.REQUEST_WITH_ACK) {
                // 需要等待ACK响应
                this.log(LogLevel.DEBUG, `等待ACK响应，超时时间: ${timeout}ms，帧序号: ${currentFrameIndex}`, deviceId);
                const response = await this.waitForFrameResponse(deviceId, currentFrameIndex, timeout);
                this.log(LogLevel.INFO, `收到ACK响应，长度: ${response.length} 字节`, deviceId);
                
                // 业务数据校验
                const validationResult = this.validateBusinessResponse(command.data?.[0], response);
                if (!validationResult.isValid) {
                    this.log(LogLevel.ERROR, `业务数据校验失败: ${validationResult.error}`, deviceId);
                    return {
                        success: false,
                        error: `业务数据校验失败: ${validationResult.error}`,
                        data: response,
                    };
                }
                
                return {
                    success: true,
                    data: response,
                    parsedData: validationResult.parsedData,
                };
            } else if (ackType === TransportAckType.REQUEST_WITHOUT_ACK) {
                // 不需要等待响应，但可能需要等待业务响应
                if (command.command.includes('READ') || command.command.includes('GET')) {
                    this.log(LogLevel.DEBUG, `等待业务响应，超时时间: ${timeout}ms，帧序号: ${currentFrameIndex}`, deviceId);
                    const response = await this.waitForFrameResponse(deviceId, currentFrameIndex, timeout);
                    this.log(LogLevel.INFO, `收到业务响应，长度: ${response.length} 字节`, deviceId);
                    
                    // 业务数据校验
                    const validationResult = this.validateBusinessResponse(command.data?.[0], response);
                    if (!validationResult.isValid) {
                        this.log(LogLevel.ERROR, `业务数据校验失败: ${validationResult.error}`, deviceId);
                        return {
                            success: false,
                            error: `业务数据校验失败: ${validationResult.error}`,
                            data: response,
                        };
                    }
                    
                    return {
                        success: true,
                        data: response,
                        parsedData: validationResult.parsedData,
                    };
                }
                return { success: true };
            } else {
                // ACK或NONE类型，不需要等待响应
                return { success: true };
            }
        } catch (error) {
            this.log(LogLevel.ERROR, `发送命令失败: ${error instanceof Error ? error.message : '未知错误'}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            if (error instanceof BluetoothKeySDKError) {
                return {
                    success: false,
                    error: error.message,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : '未知错误',
            };
        }
    }

    /**
     * 构建完整的数据包（物理层+传输层+应用层）
     */
    private async buildCompletePacket(
        deviceId: string, 
        applicationData: Uint8Array,
        options: {
            frameIndex?: number;
            version?: number;
            ackType?: TransportAckType;
            encryptType?: TransportEncryptType;
            cryptoFactory?: CryptoFactory;
            secretKey?: Uint8Array;
        } = {}
    ): Promise<Uint8Array> {
        try {
            const {
                frameIndex = this.frameIndexes.get(deviceId) || 0,
                version = 0x01,
                ackType = TransportAckType.REQUEST_WITH_ACK,
                encryptType = TransportEncryptType.ENCRYPT,
                cryptoFactory,
                secretKey = this.dynamicKeys.get(deviceId) || new Uint8Array(),
            } = options;
            
            this.log(LogLevel.DEBUG, `开始构建数据包，帧序号: ${frameIndex}, ackType: ${ackType}, encryptType: ${encryptType}`, deviceId);
            
            // 应用层打包
            const appData = this.applicationLayer.pack(applicationData, frameIndex);
            const appLog = LogUtils.createProtocolDataLog(
                ProtocolLayer.APPLICATION,
                DataDirection.SEND,
                deviceId,
                appData,
                LogUtils.parseApplicationDataDescription(applicationData),
                { frameIndex }
            );
            this.log(LogLevel.DEBUG, `应用层打包完成`, deviceId, appLog);
            
            // 传输层打包（支持更多参数）
            const transportData = await this.transportLayer.pack(appData, {
                version,
                ackType,
                encryptType,
                cryptoFactory,
                secretKey,
            });
            const transportLog = LogUtils.createProtocolDataLog(
                ProtocolLayer.TRANSPORT,
                DataDirection.SEND,
                deviceId,
                transportData,
                `传输层数据 (${encryptType === TransportEncryptType.ENCRYPT ? 'AES加密' : '不加密'})`,
                { frameIndex, encrypted: encryptType === TransportEncryptType.ENCRYPT, ackType }
            );
            this.log(LogLevel.DEBUG, `传输层打包完成`, deviceId, transportLog);
            
            // 物理层打包
            const physicalData = this.physicalLayer.pack(transportData);
            const physicalLog = LogUtils.createProtocolDataLog(
                ProtocolLayer.PHYSICAL,
                DataDirection.SEND,
                deviceId,
                physicalData,
                '物理层数据包',
                { frameIndex }
            );
            this.log(LogLevel.DEBUG, `物理层打包完成`, deviceId, physicalLog);
            
            // 创建完整数据包日志
            const completePacketLog = LogUtils.createCompletePacketLog(
                deviceId,
                DataDirection.SEND,
                applicationData,
                transportData,
                physicalData,
                physicalData,
                true,
                { 
                    frameIndex, 
                    command: applicationData.length > 0 ? applicationData[0] : undefined,
                    ackType,
                    encryptType,
                    version
                }
            );
            this.log(LogLevel.INFO, `完整数据包构建完成`, deviceId, undefined, completePacketLog);
            
            // 更新帧序号（只有在需要ACK的情况下才更新）
            if (ackType === TransportAckType.REQUEST_WITH_ACK) {
                this.frameIndexes.set(deviceId, (frameIndex + 1) % 256);
            }
            
            return physicalData;
        } catch (error) {
            this.log(LogLevel.ERROR, `数据包构建失败`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            throw BluetoothKeySDKError.protocolError('数据包构建失败', error instanceof Error ? error : undefined);
        }
    }

    /**
     * 处理接收到的数据（滑动窗口+超时断帧并行）
     */
    private handleReceivedData(deviceId: string, data: Uint8Array): void {
        // 合并新数据到缓冲区
        const buffer = new Uint8Array([
            ...(this.dataBuffers.get(deviceId) || []),
            ...data
        ]);
        this.dataBuffers.set(deviceId, buffer);

        // 滑动窗口分帧，立即处理所有完整帧
        this._processBufferedFrames(deviceId);

        // 重置超时定时器
        this.startReceivingTimeoutTimer(deviceId);
    }

    /**
     * 滑动窗口处理缓冲区内所有完整帧，剩余数据保留
     */
    private _processBufferedFrames(deviceId: string): void {
        const buffer = this.dataBuffers.get(deviceId) || new Uint8Array();
        const { frames, remain } = this.physicalLayer.unpackWithRemain(buffer);
        this.dataBuffers.set(deviceId, remain);
        if (frames.length === 0) return;
        for (let i = 0; i < frames.length; i++) {
            this._processPhysicalFrame(deviceId, frames[i], i);
        }
    }

    /**
     * 处理单个物理层帧
     */
    private async _processPhysicalFrame(deviceId: string, physicalFrame: Uint8Array, packetIndex: number) {
        try {
            // 物理帧结构：header(2) + length(2) + data(N) + checksum(1)
            if (physicalFrame.length < 5) {
                this.log(LogLevel.WARN, '物理层帧长度过短', deviceId);
                return;
            }
            // 解析长度
            const dataLength = physicalFrame[2] + (physicalFrame[3] << 8);
            // 校验长度
            if (physicalFrame.length !== 4 + dataLength) {
                this.log(LogLevel.WARN, '物理层帧长度与长度字段不符', deviceId);
                return;
            }
            // 提取payload（去掉包头、长度、校验和）
            const payload = physicalFrame.slice(4, 4 + dataLength - 1);
            // 传给传输层解包
            const dynamicKey = this.dynamicKeys.get(deviceId) || new Uint8Array();
            this.log(LogLevel.DEBUG, `处理物理层数据包，长度: ${physicalFrame.length} 字节，payload长度: ${payload.length} 字节`, deviceId);
            // 传输层解包
            const transportUnpackData = await this.transportLayer.unpack(payload, dynamicKey);
            if (!transportUnpackData.data.length) {
                this.log(LogLevel.WARN, `传输层解包失败，数据为空`, deviceId);
                return;
            }
            const transportLog = LogUtils.createProtocolDataLog(
                ProtocolLayer.TRANSPORT,
                DataDirection.RECEIVE,
                deviceId,
                transportUnpackData.data,
                '传输层数据 (AES解密)',
                { packetIndex, encrypted: true }
            );
            this.log(LogLevel.DEBUG, `传输层解包成功`, deviceId, transportLog);
            // 应用层解包
            const applicationUnpackData = this.applicationLayer.unpack(transportUnpackData.data);
            if (!applicationUnpackData.data.length) {
                this.log(LogLevel.WARN, `应用层解包失败，数据为空`, deviceId);
                return;
            }
            const appLog = LogUtils.createProtocolDataLog(
                ProtocolLayer.APPLICATION,
                DataDirection.RECEIVE,
                deviceId,
                applicationUnpackData.data,
                LogUtils.parseApplicationDataDescription(applicationUnpackData.data),
                { packetIndex }
            );
            this.log(LogLevel.DEBUG, `应用层解包成功`, deviceId, appLog);
            // 创建完整数据包日志
            const completePacketLog = LogUtils.createCompletePacketLog(
                deviceId,
                DataDirection.RECEIVE,
                applicationUnpackData.data,
                transportUnpackData.data,
                physicalFrame,
                physicalFrame,
                true,
                { packetIndex, command: applicationUnpackData.data.length > 0 ? applicationUnpackData.data[0] : undefined }
            );
            this.log(LogLevel.INFO, `完整数据包解析成功`, deviceId, undefined, completePacketLog);
            await this.handleApplicationData(deviceId, transportUnpackData, applicationUnpackData);
        } catch (error) {
            this.log(LogLevel.ERROR, `数据处理错误`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            this.emitEvent('error', { 
                deviceId,
                error: BluetoothKeySDKError.protocolError('数据处理失败', error instanceof Error ? error : undefined).message 
            });
        }
    }

    /**
     * 启动接收超时定时器（超时断帧）
     */
    private startReceivingTimeoutTimer(deviceId: string): void {
        this.cancelReceivingTimeoutTimer(deviceId);
        const timer = setTimeout(() => {
            const buffer = this.dataBuffers.get(deviceId) || new Uint8Array();
            if (buffer.length > 0) {
                this.log(LogLevel.WARN, `接收超时，强制处理缓冲区数据，长度: ${buffer.length} 字节`, deviceId);
                // 超时后强制处理剩余数据（即使是不完整帧）
                this._processBufferedFrames(deviceId);
                this.dataBuffers.set(deviceId, new Uint8Array());
            }
        }, 200);
        this.receivingTimeoutTimers.set(deviceId, timer);
    }

    /**
     * 取消接收超时定时器
     */
    private cancelReceivingTimeoutTimer(deviceId: string): void {
        const timer = this.receivingTimeoutTimers.get(deviceId);
        if (timer) {
            clearTimeout(timer);
            this.receivingTimeoutTimers.delete(deviceId);
        }
    }

    /**
     * 处理应用层数据
     */
    private async handleApplicationData(deviceId: string, transportData: TransportData, applicationData: ApplicationData): Promise<void> {
        const frameIndex = applicationData.frameIndex;
        const data = applicationData.data;
        this.log(LogLevel.DEBUG, `处理应用层数据，帧序号: ${frameIndex}`, deviceId);

        if (!data || data.length === 0) {
            this.log(LogLevel.WARN, '应用层数据为空', deviceId);
            return;
        }
        const command = data[0];

        switch (transportData.ackType) {
            case TransportAckType.ACK:
                this.log(LogLevel.DEBUG, 'ACK类型数据', deviceId);
                await this.handleAckData(deviceId, frameIndex, data);
                this.resolveFrameResponse(deviceId, frameIndex, data);
                break;
            case TransportAckType.REQUEST_WITH_ACK:
                this.log(LogLevel.DEBUG, 'REQUEST_WITH_ACK类型数据', deviceId);
                await this.handleRequestWithAckData(deviceId, frameIndex, command, data);
                break;
            case TransportAckType.REQUEST_WITHOUT_ACK:
                this.log(LogLevel.DEBUG, 'REQUEST_WITHOUT_ACK类型数据', deviceId);
                // 可扩展
                break;
            case TransportAckType.NONE:
            default:
                this.log(LogLevel.WARN, `未知ackType: ${transportData.ackType}`, deviceId);
                break;
        }
    }

    /**
     * 检查是否为设备主动上报的数据
     */
    private isDeviceReport(data: Uint8Array): boolean {
        if (!data || data.length === 0) return false;
        
        const command = data[0];
        // 设备主动上报的命令：UPLOAD_STATUS (0x07) 和 GET_SYS_PARAM (0x05)
        return command === BusinessCmd.UPLOAD_STATUS || command === BusinessCmd.GET_SYS_PARAM;
    }

    /**
     * 处理设备主动上报（在线开锁核心功能）
     */
    private handleDeviceReport(deviceId: string, data: Uint8Array): void {
        try {
            const report = CommandUtils.parseDeviceStatusReport(data);
            
            // 触发设备上报事件
            this.emitEvent('deviceReport', {
                deviceId,
                data: data,
                report: report,
            });

            // 根据上报类型触发具体事件
            if (report.lockStatus) {
                // 锁具状态上报
                this.emitEvent('lockStatusReport', {
                    deviceId,
                    data: data,
                    lockStatus: report.lockStatus,
                    lockId: report.lockId,
                    timestamp: report.timestamp,
                });
            }

            if (report.deviceInfo) {
                // 设备信息上报
                this.emitEvent('deviceInfoReport', {
                    deviceId,
                    data: data,
                    deviceInfo: report.deviceInfo,
                    lockId: report.lockId,
                    timestamp: report.timestamp,
                });
            }

            this.log(LogLevel.INFO, `设备主动上报处理完成`, deviceId);
        } catch (error) {
            this.log(LogLevel.ERROR, '解析设备上报数据失败', deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            this.emitEvent('error', {
                deviceId,
                error: `解析设备上报数据失败: ${error instanceof Error ? error.message : '未知错误'}`,
            });
        }
    }

    /**
     * 处理日志上报事件
     */
    private handleLogReportEvent(deviceId: string, data: Uint8Array): void {
        // 这里可以解析日志数据并触发相应事件
        this.emitEvent('dataReceived', {
            deviceId,
            data: data,
        });
    }

    /**
     * 等待指定帧序号的响应
     */
    private async waitForFrameResponse(deviceId: string, frameIndex: number, timeout: number): Promise<Uint8Array> {
        return new Promise<Uint8Array>((resolve, reject) => {
            const deviceFrameResponses = this.pendingFrameResponses.get(deviceId) || new Map();
            
            const timer = setTimeout(() => {
                deviceFrameResponses.delete(frameIndex);
                reject(BluetoothKeySDKError.readTimeout());
            }, timeout);

            deviceFrameResponses.set(frameIndex, { resolve, reject, timer });
            this.pendingFrameResponses.set(deviceId, deviceFrameResponses);
        });
    }

    /**
     * 根据帧序号匹配响应
     */
    private resolveFrameResponse(deviceId: string, frameIndex: number, data: Uint8Array): void {
        const deviceFrameResponses = this.pendingFrameResponses.get(deviceId);
        if (!deviceFrameResponses) return;

        const pendingResponse = deviceFrameResponses.get(frameIndex);
        if (pendingResponse) {
            const { resolve, timer } = pendingResponse;
            clearTimeout(timer);
            deviceFrameResponses.delete(frameIndex);
            resolve(data);
            this.log(LogLevel.DEBUG, `帧序号匹配成功: ${frameIndex}`, deviceId);
        }
    }

    /**
     * 清理指定设备的待处理帧序号响应
     */
    private clearPendingFrameResponses(deviceId: string): void {
        const deviceFrameResponses = this.pendingFrameResponses.get(deviceId);
        if (!deviceFrameResponses) return;

        for (const [frameIndex, { reject, timer }] of deviceFrameResponses) {
            clearTimeout(timer);
            reject(BluetoothKeySDKError.unknownError('连接断开，取消等待响应'));
        }
        deviceFrameResponses.clear();
    }

    /**
     * 清理所有待处理的帧序号响应
     */
    private clearAllPendingFrameResponses(): void {
        for (const deviceId of this.pendingFrameResponses.keys()) {
            this.clearPendingFrameResponses(deviceId);
        }
    }

    /**
     * 添加事件监听器
     */
    addEventListener(eventType: string, listener: BluetoothKeyEventListener): void {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType)!.push(listener);
    }

    /**
     * 移除事件监听器
     */
    removeEventListener(eventType: string, listener: BluetoothKeyEventListener): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 触发事件
     */
    private emitEvent(type: string, data?: Partial<BluetoothKeyEvent>): void {
        const listeners = this.eventListeners.get(type);
        if (listeners) {
            const event: BluetoothKeyEvent = {
                type: type as any,
                ...data,
            };
            // 异步触发事件，避免阻塞（使用 setTimeout 替代 setImmediate 以兼容浏览器）
            setTimeout(() => {
                listeners.forEach(listener => {
                    try {
                        listener(event);
                    } catch (error) {
                        this.log(LogLevel.ERROR, '事件监听器执行错误', undefined, undefined, undefined, error instanceof Error ? error : undefined);
                    }
                });
            }, 0);
        }
    }

    /**
     * 获取指定设备的连接状态
     */
    getConnectionStatus(deviceId: string): BluetoothKeyConnection | null {
        return this.connections.get(deviceId) || null;
    }

    /**
     * 获取所有连接状态
     */
    getAllConnectionStatus(): BluetoothKeyConnection[] {
        return Array.from(this.connections.values());
    }

    /**
     * 检查指定设备是否已连接
     */
    isDeviceConnected(deviceId: string): boolean {
        const connection = this.connections.get(deviceId);
        return connection ? connection.isConnected : false;
    }

    /**
     * 获取已连接的设备数量
     */
    getConnectedDeviceCount(): number {
        return Array.from(this.connections.values()).filter(conn => conn.isConnected).length;
    }

    /**
     * 检查是否已初始化
     */
    isSDKInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * 检查是否正在扫描
     */
    isScanningDevices(): boolean {
        return this.isScanning;
    }

    /**
     * 销毁SDK
     */
    async destroy(): Promise<void> {
        // 停止扫描
        if (this.isScanning) {
            try {
                await BleClient.stopLEScan();
            } catch (error) {
                this.log(LogLevel.WARN, '停止扫描时出错', undefined, undefined, undefined, error instanceof Error ? error : undefined);
            }
            this.isScanning = false;
        }

        // 断开所有连接
        await this.disconnectAll();

        // 清理所有资源
        this.eventListeners.clear();
        this.clearAllPendingFrameResponses();
        
        // 清理所有定时器
        for (const deviceId of this.receivingTimeoutTimers.keys()) {
            this.cancelReceivingTimeoutTimer(deviceId);
        }
        
        this.isInitialized = false;
    }

    /**
     * 处理设备主动命令（自动回复相同帧序号）
     */
    private async handleDeviceActiveCommand(deviceId: string, frameIndex: number, data: Uint8Array): Promise<void> {
        try {
            // 根据命令类型构造回复数据
            let replyData: Uint8Array;
            const command = data[0];
            
            switch (command) {
                case BusinessCmd.UPLOAD_STATUS:
                    // 状态上报回复：0x07 + 0x01 (成功)
                    replyData = new Uint8Array([0x07, 0x01]);
                    break;
                case BusinessCmd.GET_SYS_PARAM:
                    // 系统参数回复：0x05 + 0x01 (成功)
                    replyData = new Uint8Array([0x05, 0x01]);
                    break;
                default:
                    // 其他命令回复：命令 + 0x01 (成功)
                    replyData = new Uint8Array([command, 0x01]);
                    break;
            }
            
            // 构建回复数据包（使用相同的帧序号）
            const replyPacket = await this.buildReplyPacket(deviceId, replyData, frameIndex);
            
            // 发送回复
            await BleClient.write(
                deviceId,
                this.config.serviceUUID,
                this.config.writeCharacteristicUUID,
                new DataView(replyPacket.buffer)
            );
            
            this.log(LogLevel.DEBUG, `设备主动命令回复成功，帧序号: ${frameIndex}`, deviceId);
        } catch (error) {
            this.log(LogLevel.ERROR, `设备主动命令回复失败，帧序号: ${frameIndex}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 构建回复数据包（使用指定帧序号）
     */
    private async buildReplyPacket(
        deviceId: string, 
        applicationData: Uint8Array, 
        frameIndex: number,
        transportOptions?: {
            version?: number;
            encryptType?: TransportEncryptType;
            cryptoFactory?: CryptoFactory;
            secretKey?: Uint8Array;
        }
    ): Promise<Uint8Array> {
        try {
            const {
                version = 0x01,
                encryptType = TransportEncryptType.ENCRYPT,
                cryptoFactory,
                secretKey = this.dynamicKeys.get(deviceId) || new Uint8Array(),
            } = transportOptions || {};
            
            this.log(LogLevel.DEBUG, `构建回复数据包，帧序号: ${frameIndex}`, deviceId);
            
            // 应用层打包（使用指定帧序号）
            const appData = this.applicationLayer.pack(applicationData, frameIndex);
            
            // 传输层打包（回复包使用ACK类型）
            const transportData = await this.transportLayer.pack(appData, {
                version,
                ackType: TransportAckType.ACK, // 回复包固定使用ACK类型
                encryptType,
                cryptoFactory,
                secretKey,
            });
            
            // 物理层打包
            const physicalData = this.physicalLayer.pack(transportData);
            
            this.log(LogLevel.DEBUG, `回复数据包构建完成，帧序号: ${frameIndex}`, deviceId);
            // 打印回复数据包明文数据
            this.log(LogLevel.DEBUG, `回复数据包明文数据:`, deviceId, LogUtils.createProtocolDataLog(
                ProtocolLayer.PHYSICAL,
                DataDirection.SEND,
                deviceId,
                physicalData,
                `回复数据包明文数据 - 帧序号: ${frameIndex}`,
                {
                    frameIndex,
                    secretKey: LogUtils.toHex(secretKey),
                    applicationData: LogUtils.toHex(appData),
                    transportData: LogUtils.toHex(transportData),
                    physicalData: LogUtils.toHex(physicalData)
                }
            ));
            
            return physicalData;
        } catch (error) {
            this.log(LogLevel.ERROR, `回复数据包构建失败，帧序号: ${frameIndex}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            throw BluetoothKeySDKError.protocolError('回复数据包构建失败', error instanceof Error ? error : undefined);
        }
    }

    /**
     * 清理连接并清理资源
     */
    private async _cleanupConnection(deviceId: string): Promise<void> {
        try {
            this.log(LogLevel.DEBUG, `开始清理连接: ${deviceId}`);
            
            // 先等待一小段时间，让连接稳定
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 尝试断开连接，最多重试3次
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    await this.disconnectDevice(deviceId);
                    this.log(LogLevel.INFO, `设备连接清理完成: ${deviceId}`);
                    return;
                } catch (error) {
                    retryCount++;
                    this.log(LogLevel.WARN, `断开连接失败，重试 ${retryCount}/${maxRetries}: ${deviceId}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
                    
                    if (retryCount < maxRetries) {
                        // 重试前等待更长时间
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }
            }
            
            // 所有重试都失败了，强制清理本地状态
            this.log(LogLevel.WARN, `断开连接重试失败，强制清理本地状态: ${deviceId}`, deviceId);
            this._forceCleanupLocalState(deviceId);
            
        } catch (error) {
            this.log(LogLevel.ERROR, `清理连接失败: ${deviceId}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            // 即使清理失败，也要强制清理本地状态
            this._forceCleanupLocalState(deviceId);
        }
    }

    /**
     * 强制清理本地状态（当断开连接失败时使用）
     */
    private _forceCleanupLocalState(deviceId: string): void {
        try {
            // 清理该设备的所有状态
            this.connections.delete(deviceId);
            this.frameIndexes.delete(deviceId);
            this.dynamicKeys.delete(deviceId);
            this.pendingMessages.delete(deviceId);
            this.currentBusiness.delete(deviceId);
            this.businessResults.delete(deviceId);
            this.dataBuffers.delete(deviceId);
            this.pendingFrameResponses.delete(deviceId);
            
            // 清理认证状态和认证Promise
            this._authStatusMap.delete(deviceId);
            const authPromise = this.authPromises.get(deviceId);
            if (authPromise) {
                clearTimeout(authPromise.timer);
                this.authPromises.delete(deviceId);
            }
            
            // 清理定时器
            const timer = this.receivingTimeoutTimers.get(deviceId);
            if (timer) {
                clearTimeout(timer);
                this.receivingTimeoutTimers.delete(deviceId);
            }
            
            // 清理断开标志
            this.disconnectingDevices.delete(deviceId);
            
            this.log(LogLevel.INFO, `强制清理本地状态完成: ${deviceId}`, deviceId);
        } catch (error) {
            this.log(LogLevel.ERROR, `强制清理本地状态失败: ${deviceId}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 处理 REQUEST_WITH_ACK 类型的数据（包括主动上报、认证、普通业务）
     */
    private async handleRequestWithAckData(deviceId: string, frameIndex: number, command: number, data: Uint8Array): Promise<void> {
        try {
            // 设备主动上报
            if (this.isDeviceReport(data)) {
                this.log(LogLevel.DEBUG, '设备主动上报数据', deviceId);
                this.handleDeviceReport(deviceId, data);
                await this.handleDeviceActiveCommand(deviceId, frameIndex, data);
                return;
            }
            // 多步认证命令
            if (command === 0x02) {
                // 第二次认证，回复异或数据
                const xorData = new Uint8Array(data.length - 1);
                for (let i = 1; i < data.length; i++) {
                    xorData[i - 1] = data[i] ^ 0x5A;
                }
                const replyData = CommandUtils.concatUint8Arrays(new Uint8Array([0x02]), xorData);
                const replyPacket = await this.buildReplyPacket(deviceId, replyData, frameIndex);
                await BleClient.write(
                    deviceId,
                    this.config.serviceUUID,
                    this.config.writeCharacteristicUUID,
                    new DataView(replyPacket.buffer)
                );
                this.startReceivingTimeoutTimer(deviceId);
                this.log(LogLevel.INFO, `第二次认证回复发送成功，帧序号: ${frameIndex}`, deviceId);
                return;
            } else if (command === 0x03) {
                // 第三次认证，更新动态密钥并回复
                const newKey = data.slice(1);
                this.dynamicKeys.set(deviceId, newKey);
                const replyData = CommandUtils.concatUint8Arrays(new Uint8Array([0x03]), newKey);
                const replyPacket = await this.buildReplyPacket(deviceId, replyData, frameIndex);
                await BleClient.write(
                    deviceId,
                    this.config.serviceUUID,
                    this.config.writeCharacteristicUUID,
                    new DataView(replyPacket.buffer)
                );
                this.startReceivingTimeoutTimer(deviceId);
                this.log(LogLevel.INFO, `第三次认证回复发送成功，帧序号: ${frameIndex}`, deviceId);
                return;
            } else if (command === 0x04) {
                // 第四次认证，更新最终动态密钥并回复
                const newKey = data.slice(1);
                this.dynamicKeys.set(deviceId, newKey);
                const replyData = CommandUtils.concatUint8Arrays(new Uint8Array([0x04]), newKey);
                const replyPacket = await this.buildReplyPacket(deviceId, replyData, frameIndex);
                await BleClient.write(
                    deviceId,
                    this.config.serviceUUID,
                    this.config.writeCharacteristicUUID,
                    new DataView(replyPacket.buffer)
                );
                this.businessResults.set(deviceId, BleOperateResult.SUCCESS);
                this.currentBusiness.set(deviceId, BusinessCmd.NONE);
                this.log(LogLevel.INFO, `第四次认证回复发送成功，认证流程完成，帧序号: ${frameIndex}`, deviceId);
                // 认证流程完成
                this._completeAuth(deviceId, true);
                return;
            }
            // 其它业务命令
            this.log(LogLevel.DEBUG, `普通业务命令: 0x${command.toString(16)}`, deviceId);
            this.resolveFrameResponse(deviceId, frameIndex, data);
        } catch (error) {
            this.log(LogLevel.ERROR, `REQUEST_WITH_ACK数据处理失败，帧序号: ${frameIndex}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
            this._completeAuth(deviceId, false, error instanceof Error ? error : undefined);
        }
    }

    /**
     * 处理设备主动断开连接
     */
    private _handleDeviceDisconnected(deviceId: string): void {
        try {
            // 检查是否已经在断开中（APP主动断开），如果是则跳过处理
            if (this.disconnectingDevices.has(deviceId)) {
                this.log(LogLevel.DEBUG, `设备 ${deviceId} 正在由APP主动断开，跳过设备主动断开处理`, deviceId);
                return;
            }

            this.log(LogLevel.INFO, `处理设备主动断开连接: ${deviceId}`, deviceId);
            
            // 标记为正在断开，防止重复处理
            this.disconnectingDevices.add(deviceId);
            
            // 更新连接状态
            const connection = this.connections.get(deviceId);
            if (connection) {
                connection.status = ConnectionStatus.DISCONNECTED;
                connection.isConnected = false;
            }
            
            // 清理该设备的所有状态
            this.frameIndexes.delete(deviceId);
            this.dynamicKeys.delete(deviceId);
            this.pendingMessages.delete(deviceId);
            this.currentBusiness.delete(deviceId);
            this.businessResults.delete(deviceId);
            this.dataBuffers.delete(deviceId);
            this.pendingFrameResponses.delete(deviceId);
            
            // 清理认证状态和认证Promise
            this._authStatusMap.delete(deviceId);
            const authPromise = this.authPromises.get(deviceId);
            if (authPromise) {
                clearTimeout(authPromise.timer);
                this.authPromises.delete(deviceId);
            }
            
            // 清理定时器
            const timer = this.receivingTimeoutTimers.get(deviceId);
            if (timer) {
                clearTimeout(timer);
                this.receivingTimeoutTimers.delete(deviceId);
            }
            
            // 发送断开连接事件
            this.emitEvent('disconnected', { deviceId });
            
            this.log(LogLevel.INFO, `设备断开连接处理完成: ${deviceId}`, deviceId);
        } catch (error) {
            this.log(LogLevel.ERROR, `处理设备断开连接失败: ${deviceId}`, deviceId, undefined, undefined, error instanceof Error ? error : undefined);
        } finally {
            // 清理断开标志
            this.disconnectingDevices.delete(deviceId);
        }
    }

    /**
     * 业务数据校验
     */
    private validateBusinessResponse(expectedCommand: number | undefined, response: Uint8Array): { isValid: boolean; parsedData?: any; error?: string } {
        if (expectedCommand === undefined) {
            return { isValid: true };
        }

        // 使用CommandUtils中的校验方法
        const validationResult = CommandUtils.validateBusinessResponse(expectedCommand, response);
        return {
            isValid: validationResult.isValid,
            parsedData: validationResult.parsedData,
            error: validationResult.error
        };
    }
}