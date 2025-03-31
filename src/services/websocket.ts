import { message } from 'antd';

export interface WSMessage {
  header: {
    authorization?: string;
    method: string;
  };
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

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('ws://localhost:52881/ws/build');

        this.ws.onopen = () => {
          console.log('WebSocket 连接已建立');
          resolve();
        };

        this.ws.onmessage = (event) => {
          const response: WSResponse = JSON.parse(event.data);
          if (!response.success) {
            message.error(response.message);
            return;
          }

          // 处理不同类型的消息
          if (response.message === 'build_output' || response.message === 'build_error') {
            const handler = this.messageHandlers.get(response.message);
            if (handler) {
              handler(response.data);
            }
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
          message.error('WebSocket 连接错误');
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
      this.ws.send(JSON.stringify(msg));
    } else {
      message.error('WebSocket 未连接');
    }
  }

  onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  removeMessageHandler(type: string) {
    this.messageHandlers.delete(type);
  }
}

export const wsService = new WebSocketService(); 