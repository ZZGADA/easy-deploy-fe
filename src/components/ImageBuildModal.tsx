import React, { useEffect, useState } from 'react';
import { Modal, Steps, Typography, Alert, Button, Input, Space } from 'antd';
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
  is_default: boolean;
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

      return () => {
        wsService.removeMessageHandler('build_output');
        wsService.removeMessageHandler('build_error');
        wsService.disconnect();
      };
    }
  }, [visible, dockerfile]);

  const checkDockerAccount = async () => {
    try {
      const response = await dockerAccountService.queryLoginAccount();
      if (response.data) {
        setDockerAccount(response.data);
        await wsService.connect();
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

  const startBuild = async () => {
    if (!dockerfile) {
      setError('Dockerfile 不存在');
      return;
    }

    if (!imageName) {
      setError('请输入镜像名称');
      return;
    }

    setLoading(true);
    setError('');
    setBuildOutput([]);

    try {
      // 将 file_data 转换为 Dockerfile 内容
      const dockerfileContent = dockerfile.file_data
        .map(item => `${item.dockerfile_key} ${item.shell_value}`)
        .join('\n');

      wsService.send({
        header: {
          method: 'generate_dockerfile',
        },
        data: {
          content: dockerfileContent,
        },
      });

      setCurrentStep(1);

      // 等待生成完成后，开始构建镜像
      wsService.send({
        header: {
          method: 'build_image',
        },
        data: {
          image_name: imageName,
        },
      });

      setCurrentStep(2);
    } catch (err) {
      setError('构建过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '准备',
      description: '检查 Docker 账号',
    },
    {
      title: '生成',
      description: '生成 Dockerfile',
    },
    {
      title: '构建',
      description: '构建镜像',
    },
  ];

  return (
    <Modal
      title="构建镜像"
      open={visible}
      onCancel={onCancel}
      width={800}
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
          <Alert
            type="info"
            message={`当前使用的 Docker 账号: ${dockerAccount.username}`}
            description="如需切换账号，请前往个人中心页面更换登录账号"
          />
        )}

        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
          <Text>镜像名称:</Text>
          <Input
            placeholder="请输入镜像名称（例如：myapp:latest）"
            value={imageName}
            onChange={e => setImageName(e.target.value)}
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
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={startBuild}
            loading={loading}
            disabled={!dockerAccount || !imageName || !dockerfile}
          >
            开始构建
          </Button>
        </div>
      </Space>
    </Modal>
  );
};

export default ImageBuildModal; 