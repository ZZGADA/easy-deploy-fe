import React, { useEffect, useState } from 'react';
import { Modal, Steps, Typography, Alert, Button, Input, Space, Descriptions } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { wsService } from '../services/websocket';
import { dockerAccountService, DockerfileData } from '../services/api';

const { Step } = Steps;
const { Text } = Typography;
const { TextArea } = Input;

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
  const [buildOutput, setBuildOutput] = useState<string[]>([]);
  const [imageName, setImageName] = useState('');
  const [error, setError] = useState('');

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

  const handleWebSocketError = (error: string) => {
    setError(error);
    setLoading(false);
    setBuildOutput(prev => [...prev, `WebSocket错误: ${error}`]);
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
    setBuildOutput(prev => [...prev, output]);
  };

  const handleBuildError = (error: string) => {
    setBuildOutput(prev => [...prev, `错误: ${error}`]);
    setError(error);
  };

  const handleSuccess = (message: string) => {
    console.log("handleSuccess - message:", message);
    console.log("handleSuccess - imageName:", imageName);
    console.log("handleSuccess - currentStep:", currentStep);
    setBuildOutput(prev => [...prev, message]);
    if (message.includes('git clone success')) {
      setCurrentStep(2);
      startCloneRepository();
    } else if (message.includes('Dockerfile build success')) {
      setCurrentStep(3);
      startBuildImage();
    } else if (message.includes('build & push success')) {
      setCurrentStep(4);
      setLoading(false);
    }
  };

  const handleError = (message: string) => {
    setBuildOutput(prev => [...prev, `错误: ${message}`]);
    setError(message);
    setLoading(false);
    wsService.disconnect();
  };

  const startBuild = async () => {
    if (!dockerfile) {
      setError('Dockerfile 不存在');
      return;
    }

    if (!imageName) {
      setError('请输入镜像名称');
      return;
    }

    console.log("startBuild - imageName:", imageName);
    setLoading(true);
    setError('');

    try {
      // 第一阶段：克隆仓库
      wsService.send({
        docker_build_step: 'clone_repository',
        data: {
          id: dockerfile.id,
          docker_image_name: imageName.trim(),
        },
      });
      setCurrentStep(1);
    } catch (err) {
      setError('克隆仓库过程中发生错误');
      setLoading(false);
      wsService.disconnect();
    }
  };

  const startCloneRepository = () => {
    try {
      wsService.send({
        docker_build_step: 'generate_dockerfile',
        data: {
          id: dockerfile?.id,
          docker_image_name: imageName.trim(),
        },
      });
    } catch (err) {
      setError('生成 Dockerfile 过程中发生错误');
      setLoading(false);
      wsService.disconnect();
    }
  };

  const startBuildImage = () => {
    console.log("startBuildImage - imageName:", imageName);
    if (!dockerfile?.id) {
      setError('Dockerfile ID 不存在');
      return;
    }

    if (!imageName || imageName.trim() === '') {
      setError('镜像名称不能为空');
      return;
    }

    try {
      wsService.send({
        docker_build_step: 'build_image',
        data: {
          id: dockerfile.id,
          docker_image_name: imageName.trim(),
        },
      });
    } catch (err) {
      setError('构建镜像过程中发生错误');
      setLoading(false);
      wsService.disconnect();
    }
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
          <TextArea
            value={buildOutput.join('\n')}
            autoSize={{ minRows: 10, maxRows: 20 }}
            readOnly
            style={{ marginTop: 16, backgroundColor: '#f5f5f5' }}
          />
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