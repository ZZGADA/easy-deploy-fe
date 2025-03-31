import { message } from 'antd';

export interface WSMessage {
  docker_build_step: string
  data: any;
}

export interface WSResponse {
  success: boolean;
  message: string;
  data?: any;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private errorHandler: ((message: string) => void) | null = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          reject(new Error('未找到认证令牌'));
          return;
        }

        const wsUrl = `ws://localhost:53801/ws/docker?token=${encodeURIComponent(token)}`;
        this.ws = new WebSocket(wsUrl);
        
        // 设置请求头
        this.ws.onopen = () => {
          console.log('WebSocket 连接已建立');
          // 发送认证信息
          this.ws?.send(JSON.stringify({
            docker_build_step:"init",
            data: {}
          }));
          resolve();
        };

        this.ws.onmessage = (event) => {
          const response: WSResponse = JSON.parse(event.data);
          
          // 处理错误消息
          if (!response.success) {
            console.error('WebSocket 错误:', response.message);
            if (this.errorHandler) {
              this.errorHandler(response.message);
            }
            this.disconnect();
            return;
          }

          // 处理不同类型的消息
          if (response.message === 'build_output' || response.message === 'build_error') {
            const handler = this.messageHandlers.get(response.message);
            if (handler) {
              handler(response.data);
            }
          } else {
            // 处理其他类型的消息
            const handler = this.messageHandlers.get('success');
            if (handler) {
              handler(response.message);
            }
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          message.error('WebSocket 连接错误');
          if (this.errorHandler) {
            this.errorHandler('WebSocket 连接错误');
          }
          this.disconnect();
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket 连接已关闭');
          this.ws = null;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(msg: WSMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(JSON.stringify(msg))
      this.ws.send(JSON.stringify(msg))
    } else {
      message.error('WebSocket 未连接');
      if (this.errorHandler) {
        this.errorHandler('WebSocket 未连接');
      }
    }
  }

  onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  onError(handler: (message: string) => void) {
    this.errorHandler = handler;
  }

  removeMessageHandler(type: string) {
    this.messageHandlers.delete(type);
  }
}

export const wsService = new WebSocketService(); 