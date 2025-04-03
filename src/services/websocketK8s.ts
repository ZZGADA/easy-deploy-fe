import { message } from 'antd';

export interface K8sWsRequest {
  step: 'init' | 'connected' | 'close';
  command: string;
  data: Record<string, any>;
}

export interface K8sWsData {
  command: string;
  result: string;
}

export interface K8sWsResponse {
  success: boolean;
  message: string;
  data: K8sWsData | null;
}

export class WebSocketK8sService {
  private ws: WebSocket | null = null;
  private messageCallback: ((response: K8sWsResponse) => void) | null = null;

  constructor(token: string) {
    const wsUrl = `ws://localhost:53801/ws/k8s?token=${encodeURIComponent(token)}`;
    this.initWebSocket(wsUrl);
  }

  private initWebSocket(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket 连接已建立');
      // 发送初始化消息
      this.sendMessage({
        step: 'init',
        command: '',
        data: {}
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const response: K8sWsResponse = JSON.parse(event.data);
        if (this.messageCallback) {
          this.messageCallback(response);
        }
      } catch (error) {
        console.error('解析 WebSocket 消息失败:', error);
        message.error('解析消息失败');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      message.error('WebSocket 连接错误');
    };

    this.ws.onclose = () => {
      console.log('WebSocket 连接已关闭');
      // 发送关闭消息
      this.sendMessage({
        step: 'close',
        command: '',
        data: {}
      });
    };
  }

  public setMessageCallback(callback: (response: K8sWsResponse) => void) {
    this.messageCallback = callback;
  }

  public sendCommand(command: string) {
    if (!command.startsWith('kubectl')) {
      message.error('只允许使用 kubectl 开头的命令');
      return;
    }

    this.sendMessage({
      step: 'connected',
      command,
      data: {}
    });
  }

  private sendMessage(request: K8sWsRequest) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(request));
    } else {
      message.error('WebSocket 未连接');
    }
  }

  public close() {
    if (this.ws) {
      this.sendMessage({
        step: 'close',
        command: '',
        data: {}
      });
    }
  }
} 