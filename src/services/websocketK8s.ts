import { message } from 'antd';

export interface K8sWsRequest {
  step: string;
  command: string;
  data?: {
    k8s_resource_id?: number;
    redis_key?: string;
    resource_type?: string;
    resource_name?: string;
    [key: string]: any;
  };
}

export interface K8sWsData {
  command: string;
  result: string;
}

export interface K8sResourceInfo {
  resource_id: number;
  resource_name: string;
  resource_type: string;
  namespace: string;
  user_id: number;
}

export interface K8sResourceStatusData {
  redis_key: string;
  resources: K8sResourceInfo[];
  timestamp: number;
  type: string;
}

export interface K8sWsResponse {
  success: boolean;
  message: string;
  data: K8sWsData | K8sResourceStatusData | null;
}

export class WebSocketK8sService {
  private ws: WebSocket | null = null;
  private messageCallback: ((response: K8sWsResponse) => void) | null = null;
  private resourceStatusCallback: ((resources: K8sResourceInfo[]) => void) | null = null;

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
        
        // 处理资源状态消息
        if (response.message === 'resource_status_running' && response.data && 'type' in response.data && response.data.type === 'resource_status') {
          if (this.resourceStatusCallback) {
            this.resourceStatusCallback(response.data.resources);
          }
        } else if (this.messageCallback) {
          // 处理普通命令执行响应
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

  public setResourceStatusCallback(callback: (resources: K8sResourceInfo[]) => void) {
    this.resourceStatusCallback = callback;
  }

  public getMessageCallback(): ((response: K8sWsResponse) => void) | null {
    return this.messageCallback;
  }

  public sendCommand(command: string, data?: K8sWsRequest['data']) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const request: K8sWsRequest = {
        step: 'connected',
        command,
        data
      };
      this.ws.send(JSON.stringify(request));
    } else {
      console.error('WebSocket is not connected');
    }
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