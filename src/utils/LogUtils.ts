import { 
    LogLevel, 
    ProtocolLayer, 
    DataDirection, 
    ProtocolDataLog, 
    CompletePacketLog,
    LogEvent 
} from '../types';

/**
 * 日志工具类
 */
export class LogUtils {
    /**
     * 将Uint8Array转换为十六进制字符串
     */
    static toHex(data: Uint8Array): string {
        return Array.from(data)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join(' ');
    }

    /**
     * 将Uint8Array转换为ASCII字符串（可打印字符）
     */
    static toAscii(data: Uint8Array): string {
        return Array.from(data)
            .map(byte => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')
            .join('');
    }

    /**
     * 格式化协议数据日志
     */
    static formatProtocolDataLog(log: ProtocolDataLog): string {
        const direction = log.direction === DataDirection.SEND ? '发送' : '接收';
        const layer = this.getLayerName(log.layer);
        const hex = this.toHex(log.rawData);
        
        let output = `[${layer}] ${direction} - 设备: ${log.deviceId}\n`;
        output += `  描述: ${log.description}\n`;
        output += `  数据: ${hex}\n`;
        output += `  长度: ${log.rawData.length} 字节\n`;
        
        if (log.metadata) {
            output += `  元数据: ${JSON.stringify(log.metadata, null, 2)}\n`;
        }
        
        return output;
    }

    /**
     * 格式化完整数据包日志
     */
    static formatCompletePacketLog(log: CompletePacketLog): string {
        const direction = log.direction === DataDirection.SEND ? '发送' : '接收';
        
        let output = `=== 完整数据包 ${direction} ===\n`;
        output += `设备: ${log.deviceId}\n`;
        output += `时间: ${new Date(log.timestamp).toISOString()}\n\n`;
        
        // 应用层数据
        output += `【应用层】\n`;
        output += `  描述: ${log.applicationData.description}\n`;
        output += `  数据: ${this.toHex(log.applicationData.raw)}\n`;
        output += `\n`;
        
        // 传输层数据
        output += `【传输层】\n`;
        output += `  描述: ${log.transportData.description}\n`;
        output += `  加密: ${log.transportData.encrypted ? '是' : '否'}\n`;
        output += `  数据: ${this.toHex(log.transportData.raw)}\n`;
        output += `\n`;
        
        // 物理层数据
        output += `【物理层】\n`;
        output += `  描述: ${log.physicalData.description}\n`;
        output += `  数据: ${this.toHex(log.physicalData.raw)}\n`;
        output += `\n`;
        
        // 最终数据
        output += `【最终数据】\n`;
        output += `  数据: ${this.toHex(log.finalData.raw)}\n`;
        output += `  总长度: ${log.finalData.raw.length} 字节\n`;
        
        if (log.metadata) {
            output += `\n【元数据】\n`;
            output += `  ${JSON.stringify(log.metadata, null, 2)}\n`;
        }
        
        output += `=== 数据包结束 ===\n`;
        
        return output;
    }

    /**
     * 获取协议层名称
     */
    static getLayerName(layer: ProtocolLayer): string {
        switch (layer) {
            case ProtocolLayer.PHYSICAL:
                return '物理层';
            case ProtocolLayer.TRANSPORT:
                return '传输层';
            case ProtocolLayer.APPLICATION:
                return '应用层';
            default:
                return '未知层';
        }
    }

    /**
     * 获取命令名称
     */
    static getCommandName(command: number): string {
        const commandNames: Record<number, string> = {
            0x01: 'CONN (连接)',
            0x02: 'OPEN (开锁)',
            0x03: 'CLOSE (关锁)',
            0x04: 'FORCE_OPEN (强制开锁)',
            0x05: 'GET_SYS_PARAM (获取系统参数)',
            0x06: 'FORCE_CLOSE (强制关锁)',
            0x07: 'UPLOAD_STATUS (上传状态)',
            0x08: 'LOCK_RECORD_UPLOAD (锁记录上传)',
        };
        
        return commandNames[command] || `未知命令 (0x${command.toString(16).padStart(2, '0')})`;
    }

    /**
     * 解析应用层数据描述
     */
    static parseApplicationDataDescription(data: Uint8Array): string {
        if (data.length === 0) return '空数据';
        
        const command = data[0];
        const commandName = this.getCommandName(command);
        
        if (data.length === 1) {
            return `${commandName}`;
        }
        
        const payload = data.slice(1);
        return `载荷: ${this.toHex(payload)}`;
    }

    /**
     * 创建协议数据日志
     */
    static createProtocolDataLog(
        layer: ProtocolLayer,
        direction: DataDirection,
        deviceId: string,
        data: Uint8Array,
        description: string,
        metadata?: Record<string, any>
    ): ProtocolDataLog {
        return {
            layer,
            direction,
            deviceId,
            timestamp: Date.now(),
            rawData: data,
            hexData: this.toHex(data),
            description,
            metadata
        };
    }

    /**
     * 创建完整数据包日志
     */
    static createCompletePacketLog(
        deviceId: string,
        direction: DataDirection,
        applicationData: Uint8Array,
        transportData: Uint8Array,
        physicalData: Uint8Array,
        finalData: Uint8Array,
        transportEncrypted: boolean = false,
        metadata?: Record<string, any>
    ): CompletePacketLog {
        return {
            deviceId,
            direction,
            timestamp: Date.now(),
            applicationData: {
                raw: applicationData,
                hex: this.toHex(applicationData),
                description: this.parseApplicationDataDescription(applicationData)
            },
            transportData: {
                raw: transportData,
                hex: this.toHex(transportData),
                encrypted: transportEncrypted,
                description: `传输层数据${transportEncrypted ? ' (已加密)' : ''}`
            },
            physicalData: {
                raw: physicalData,
                hex: this.toHex(physicalData),
                description: '物理层数据包'
            },
            finalData: {
                raw: finalData,
                hex: this.toHex(finalData)
            },
            metadata
        };
    }

    /**
     * 创建日志事件
     */
    static createLogEvent(
        level: LogLevel,
        message: string,
        deviceId?: string,
        protocolData?: ProtocolDataLog,
        completePacket?: CompletePacketLog,
        error?: Error
    ): LogEvent {
        return {
            type: 'log',
            level,
            message,
            deviceId,
            protocolData,
            completePacket,
            error,
            timestamp: Date.now()
        };
    }
} 