import React, { useEffect, useState, useRef } from 'react';
import { Modal, Steps, Typography, Alert, Button, Input, Space, Descriptions, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { wsService } from '../services/websocket';
import { dockerAccountService, DockerfileData } from '../services/api';

const { Step } = Steps;
const { Text } = Typography;
const { TextArea } = Input;

// 定义消息类型
type MessageType = 'success' | 'build' | 'error' | 'info';

interface BuildMessage {
  type: MessageType;
  content: string;
  timestamp: number;
}

interface ImageBuildModalProps {
  visible: boolean;
  onCancel: () => void;
  dockerfile: DockerfileData | null;
}

interface DockerAccount {
  id: number;
  username: string;
  server: string;
  comment: string;
  is_default: boolean;
  namespace: string;
}

const ImageBuildModal: React.FC<ImageBuildModalProps> = ({
  visible,
  onCancel,
  dockerfile,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [dockerAccount, setDockerAccount] = useState<DockerAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildOutput, setBuildOutput] = useState<BuildMessage[]>([]);
  const [imageName, setImageName] = useState('');
  const imageNameRef = useRef('');
  const [error, setError] = useState('');
  const outputContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    imageNameRef.current = imageName;
  }, [imageName]);

  useEffect(() => {
    if (visible && dockerfile) {
      checkDockerAccount();
    }
  }, [visible, dockerfile]);

  useEffect(() => {
    if (visible && dockerfile) {
      wsService.onMessage('build_output', handleBuildOutput);
      wsService.onMessage('build_error', handleBuildError);
      wsService.onMessage('success', handleSuccess);
      wsService.onMessage('error', handleError);
      wsService.onError(handleWebSocketError);

      return () => {
        wsService.removeMessageHandler('build_output');
        wsService.removeMessageHandler('build_error');
        wsService.removeMessageHandler('success');
        wsService.removeMessageHandler('error');
        wsService.disconnect();
      };
    }
  }, [visible, dockerfile]);

  // 添加自动滚动到底部的效果
  useEffect(() => {
    if (outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
    }
  }, [buildOutput]);

  const handleWebSocketError = (error: string) => {
    setError(error);
    setLoading(false);
    setBuildOutput(prev => [...prev, {
      type: 'error',
      content: `WebSocket错误: ${error}`,
      timestamp: Date.now()
    }]);
    wsService.disconnect();
  };

  const checkDockerAccount = async () => {
    try {
      const response = await dockerAccountService.queryLoginAccount();
      if (response.code === 200 && response.data) {
        setDockerAccount(response.data);
        try {
          await wsService.connect();
        } catch (err) {
          setError('WebSocket 连接失败，请检查网络连接');
          setLoading(false);
        }
      } else {
        setError('请先在个人中心页面登录 Docker 账号');
      }
    } catch (err) {
      setError('获取 Docker 账号信息失败');
    }
  };

  const handleBuildOutput = (output: string) => {
    // 判断消息类型
    let type: MessageType = 'info';
    if (output.includes('building with')) {
      type = 'build';
    } else if (output.includes('success')) {
      type = 'success';
    } else if (output.includes('error') || output.includes('failed')) {
      type = 'error';
    }

    setBuildOutput(prev => [...prev, {
      type,
      content: output,
      timestamp: Date.now()
    }]);
  };

  const handleBuildError = (error: string) => {
    setBuildOutput(prev => [...prev, {
      type: 'error',
      content: `错误: ${error}`,
      timestamp: Date.now()
    }]);
    setError(error);
  };

  const handleSuccess = (message: string) => {
    console.log("=== handleSuccess 开始 ===");
    console.log("收到消息:", message);
    console.log("当前镜像名称:", imageNameRef.current);
    console.log("当前步骤:", currentStep);
    console.log("=== handleSuccess 结束 ===");
    
    setBuildOutput(prev => [...prev, {
      type: 'success',
      content: message,
      timestamp: Date.now()
    }]);
    if (message.includes('git clone success')) {
      console.log("开始生成 Dockerfile...");
      setCurrentStep(2);
      startCloneRepository();
    } else if (message.includes('Dockerfile build success')) {
      console.log("开始构建镜像...");
      setCurrentStep(3);
      startBuildImage();
    } else if (message.includes('docker build & push success')) {
      console.log("构建完成！");
      setCurrentStep(4);
      setLoading(false);
    }
  };

  const handleError = (message: string) => {
    setBuildOutput(prev => [...prev, {
      type: 'error',
      content: `错误: ${message}`,
      timestamp: Date.now()
    }]);
    setError(message);
    setLoading(false);
    wsService.disconnect();
  };

  const startBuild = async () => {
    console.log("=== startBuild 开始 ===");
    if (!dockerfile) {
      setError('Dockerfile 不存在');
      return;
    }

    if (!imageNameRef.current) {
      setError('请输入镜像名称');
      return;
    }

    console.log("开始构建，参数：", {
      dockerfileId: dockerfile.id,
      imageName: imageNameRef.current.trim()
    });
    
    setLoading(true);
    setError('');

    try {
      // 第一阶段：克隆仓库
      const message = {
        docker_build_step: 'clone_repository',
        data: {
          id: dockerfile.id,
          docker_image_name: imageNameRef.current.trim(),
        },
      };
      console.log("发送消息:", message);
      wsService.send(message);
      setCurrentStep(1);
    } catch (err) {
      console.error("克隆仓库失败:", err);
      setError('克隆仓库过程中发生错误');
      setLoading(false);
      wsService.disconnect();
    }
    console.log("=== startBuild 结束 ===");
  };

  const startCloneRepository = () => {
    console.log("=== startCloneRepository 开始 ===");
    try {
      const message = {
        docker_build_step: 'generate_dockerfile',
        data: {
          id: dockerfile?.id,
          docker_image_name: imageNameRef.current.trim(),
        },
      };
      console.log("发送消息:", message);
      wsService.send(message);
    } catch (err) {
      console.error("生成 Dockerfile 失败:", err);
      setError('生成 Dockerfile 过程中发生错误');
      setLoading(false);
      wsService.disconnect();
    }
    console.log("=== startCloneRepository 结束 ===");
  };

  const startBuildImage = () => {
    console.log("=== startBuildImage 开始 ===");
    const currentImageName = imageNameRef.current.trim();
    console.log("当前镜像名称:", currentImageName);
    
    if (!dockerfile?.id) {
      console.error("Dockerfile ID 不存在");
      setError('Dockerfile ID 不存在');
      return;
    }

    if (!currentImageName) {
      console.error("镜像名称为空");
      setError('镜像名称不能为空');
      return;
    }

    try {
      const message = {
        docker_build_step: 'build_image',
        data: {
          id: dockerfile.id,
          docker_image_name: currentImageName,
        },
      };
      console.log("发送消息:", message);
      wsService.send(message);
    } catch (err) {
      console.error("构建镜像失败:", err);
      setError('构建镜像过程中发生错误');
      setLoading(false);
      wsService.disconnect();
    }
    console.log("=== startBuildImage 结束 ===");
  };

  const handleCancel = () => {
    setLoading(false);
    wsService.disconnect();
    setCurrentStep(0);
    setBuildOutput([]);
    setError('');
    setImageName('');
    onCancel();
  };

  const steps = [
    {
      title: '准备',
      description: '检查 Docker 账号',
    },
    {
      title: '克隆',
      description: '克隆代码仓库',
    },
    {
      title: '生成',
      description: '生成 Dockerfile',
    },
    {
      title: '构建',
      description: '构建镜像',
    },
    {
      title: '完成',
      description: '构建完成',
    },
  ];

  const renderBuildMessage = (message: BuildMessage) => {
    const { type, content } = message;

    
    
    // 处理构建步骤消息
    if (content.includes('connect success')) {
      return (
        <div style={{ marginBottom: 8 }}>
          <Tag color="blue">连接成功</Tag>
        </div>
      );
    }
    
    if (content.includes('git clone success')) {
      return (
        <div style={{ marginBottom: 8 }}>
          <Tag color="green">仓库克隆成功</Tag>
        </div>
      );
    }
    
    if (content.includes('Dockerfile build success')) {
      return (
        <div style={{ marginBottom: 8 }}>
          <Tag color="purple">Dockerfile 生成成功</Tag>
        </div>
      );
    }
    
    if (content.includes('docker build & push success')) {
      return (
        <div style={{ marginBottom: 8 }}>
          <Tag color="gold">镜像构建并推送成功</Tag>
        </div>
      );
    }

    if (content.includes('docker logins  success')) {
      return (
        <div style={{ marginBottom: 8 }}>
          <Tag color="orange">docker login 登陆成功</Tag>
        </div>
      );
    }


    // 处理构建过程消息
    if (content.startsWith('#')) {
      return (
        <div style={{ 
          marginBottom: 4,
          fontFamily: 'monospace',
          color: '#666',
          fontSize: '13px'
        }}>
          {content}
        </div>
      );
    }

    if (content.includes('resource_status_running')) {
      return null;
    }

    // 处理其他消息
    return (
      <div style={{ 
        marginBottom: 4,
        color: type === 'error' ? '#ff4d4f' : '#666'
      }}>
        {content}
      </div>
    );
  };

  return (
    <Modal
      title="构建镜像"
      open={visible}
      onCancel={handleCancel}
      width={960}
      footer={null}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Steps current={currentStep}>
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
              icon={index < currentStep ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : undefined}
            />
          ))}
        </Steps>

        {error && <Alert type="error" message={error} />}

        {dockerAccount && (
          <Descriptions title="Docker 账号信息" bordered size="small">
            <Descriptions.Item label="用户名">{dockerAccount.username}</Descriptions.Item>
            <Descriptions.Item label="命名空间">{dockerAccount.namespace}</Descriptions.Item>
            <Descriptions.Item label="服务器地址">{dockerAccount.server}</Descriptions.Item>
            <Descriptions.Item label="备注">{dockerAccount.comment}</Descriptions.Item>
          </Descriptions>
        )}

        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
          <Text>镜像名称:</Text>
          <Input
            placeholder="请输入镜像名称（例如：myapp:latest）"
            value={imageName}
            onChange={e => {
              console.log("Input value changed:", e.target.value);
              setImageName(e.target.value);
            }}
            disabled={loading}
          />
        </Space>

        {buildOutput.length > 0 && (
          <div 
            ref={outputContainerRef}
            style={{ 
              marginTop: 16,
              backgroundColor: '#f5f5f5',
              padding: 16,
              borderRadius: 4,
              maxHeight: 400,
              overflowY: 'auto'
            }}
          >
            {buildOutput.map((message, index) => (
              <div key={index}>
                {renderBuildMessage(message)}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Button onClick={handleCancel} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={startBuild}
            loading={loading}
            disabled={!dockerAccount || !imageName || !dockerfile || currentStep > 0}
          >
            开始构建
          </Button>
        </div>
      </Space>
    </Modal>
  );
};

export default ImageBuildModal;