import React, { useState, useEffect } from 'react';
import { List, Card, Typography, Space, Tag, Button, Select, message, Modal, Input, Table } from 'antd';
import { GithubOutlined, ReloadOutlined, DeploymentUnitOutlined, ApiOutlined, DeleteOutlined } from '@ant-design/icons';
import { githubApi, githubService, dockerImageService, DockerImage, k8sResourceService, K8sResource } from '../services/api';
import { useNavigate } from 'react-router-dom';
import OSS from 'ali-oss';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Repository {
  id: string;
  name: string;
  description?: string;
  branches: string[];
}

const KubernetesDeploy: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [deploymentModalVisible, setDeploymentModalVisible] = useState(false);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [deploymentConfig, setDeploymentConfig] = useState('');
  const [serviceConfig, setServiceConfig] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [k8sResources, setK8sResources] = useState<K8sResource[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);

  // 检查环境变量是否存在
  const ossConfig = {
    region: process.env.REACT_APP_OSS_REGION,
    accessKeyId: process.env.REACT_APP_OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.REACT_APP_OSS_ACCESS_KEY_SECRET,
    bucket: process.env.REACT_APP_OSS_BUCKET
  };

  // 验证所有必需的配置是否存在
  if (!ossConfig.region || !ossConfig.accessKeyId || !ossConfig.accessKeySecret || !ossConfig.bucket) {
    console.error('OSS 配置不完整，请检查环境变量');
  }

  const client = new OSS({
    region: ossConfig.region as string,
    accessKeyId: ossConfig.accessKeyId as string,
    accessKeySecret: ossConfig.accessKeySecret as string,
    bucket: ossConfig.bucket as string,
    secure: true as boolean
  });

  // 获取开发者令牌和仓库列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取开发者令牌
        const tokenResponse = await githubService.queryDeveloperToken();
        if (!tokenResponse.data || !tokenResponse.data.developer_token) {
          message.error('请先在个人中心绑定 GitHub 开发者令牌');
          navigate('/easy-deploy/profile');
          return;
        }

        // 设置 GitHub API 的认证头
        githubApi.defaults.headers.common['Authorization'] = `Bearer ${tokenResponse.data.developer_token}`;

        // 获取仓库列表
        const response = await githubApi.get('/user/repos');
        const repos = await Promise.all(response.data.map(async (repo: any) => {
          const branchesResponse = await githubApi.get(`/repos/${repo.full_name}/branches`);
          return {
            id: repo.id.toString(),
            name: repo.name,
            description: repo.description,
            branches: branchesResponse.data.map((branch: any) => branch.name)
          };
        }));

        setRepositories(repos);
      } catch (error) {
        message.error('获取数据失败，请确保已正确设置 GitHub 开发者令牌');
        navigate('/easy-deploy/profile');
      }
    };

    fetchData();
  }, [navigate]);

  // 获取 Docker 镜像列表
  const fetchDockerImages = async (repositoryId: string) => {
    try {
      setLoading(true);
      const response = await dockerImageService.queryDockerImages({
        repository_id: repositoryId,
        dockerfile_id: 0
      });
      if (response.code === 200 && response.data) {
        const images = response.data as DockerImage[];
        setDockerImages(images);
        if (images.length > 0) {
          setSelectedImage(images[0]);
        }
      }
    } catch (error) {
      message.error('获取镜像列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取 K8s 资源配置列表
  const fetchK8sResources = async (repositoryId: string, resourceType: string) => {
    try {
      setResourceLoading(true);
      const response = await k8sResourceService.queryResources({
        repository_id: repositoryId,
        resource_type: resourceType
      });
      console.log('K8s Resources Response:', response);
      if (response.code === 200 && response.data) {
          console.log("sisiisisisiis",response.data)
        console.log('Setting K8s Resources:', response.data);
        setK8sResources(response.data);
      }
    } catch (error) {
      console.error('获取配置列表失败:', error);
      message.error('获取配置列表失败');
    } finally {
      setResourceLoading(false);
    }
  };

  // 处理仓库选择
  const handleRepoSelect = (repo: string) => {
    // 重置所有状态
    setSelectedRepo(repo);
    setDockerImages([]);
    setSelectedImage(null);
    setDeploymentConfig('');
    setServiceConfig('');
    setK8sResources([]);
    
    const selectedRepository = repositories.find(r => r.name === repo);
    if (selectedRepository) {
      fetchDockerImages(selectedRepository.id);
      // 加载 K8s 资源配置列表
      fetchK8sResources(selectedRepository.id, 'all');
    }
  };

  // 处理 Modal 关闭
  const handleModalClose = (type: 'deployment' | 'service') => {
    if (type === 'deployment') {
      setDeploymentModalVisible(false);
      setDeploymentConfig('');
    } else {
      setServiceModalVisible(false);
      setServiceConfig('');
    }
    
    // 刷新配置列表
    const selectedRepository = repositories.find(r => r.name === selectedRepo);
    if (selectedRepository) {
      fetchK8sResources(selectedRepository.id, "all");
    }
  };

  // 处理配置保存
  const handleSaveConfig = async (type: 'deployment' | 'service') => {
    if (!selectedRepo || !selectedImage) {
      message.error('请先选择仓库和镜像');
      return;
    }

    try {
      setConfigLoading(true);
      const config = type === 'deployment' ? deploymentConfig : serviceConfig;
      const timestamp = Date.now();
      const objectName = `k8s/${type}/${timestamp}.yaml`;
      
      // 创建 Blob 对象
      const blob = new Blob([config], { type: 'text/yaml' });
      
      const result = await client.put(objectName, blob);
      
      // 保存配置到后端
      const selectedRepository = repositories.find(r => r.name === selectedRepo);
      if (selectedRepository) {
        await k8sResourceService.saveResource({
          repository_id: selectedRepository.id,
          resource_type: type,
          oss_url: result.url
        });
        
        message.success(`${type === 'deployment' ? 'Deployment' : 'Service'} 配置保存成功`);
        message.info(`文件已保存到: ${objectName}`);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setConfigLoading(false);
      handleModalClose(type);
    }
  };

  // 处理配置删除
  const handleDeleteResource = async (id: number) => {
    try {
      await k8sResourceService.deleteResource({ id });
      message.success('删除成功');
      // 刷新配置列表
      const selectedRepository = repositories.find(r => r.name === selectedRepo);
      if (selectedRepository) {
        fetchK8sResources(selectedRepository.id, 'all');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 配置列表列定义
  const columns = [
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      render: (type: string) => (
        <Tag color={type === 'deployment' ? 'blue' : 'green'}>
          {type.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'OSS URL',
      dataIndex: 'oss_url',
      key: 'oss_url',
      render: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: K8sResource) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteResource(record.id)}
        >
          删除
        </Button>
      )
    }
  ];

  // 添加 useEffect 来监听 k8sResources 的变化
  useEffect(() => {
    console.log('Current k8sResources:', k8sResources);
  }, [k8sResources]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 左侧仓库列表 */}
      <div style={{ width: '20%', borderRight: '1px solid #f0f0f0', padding: '16px' }}>
        <Title level={4}>代码仓库列表</Title>
        <List
          size="small"
          dataSource={repositories}
          style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}
          renderItem={(repo) => (
            <List.Item>
              <Card
                hoverable
                onClick={() => handleRepoSelect(repo.name)}
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  backgroundColor: selectedRepo === repo.name ? '#f0f0f0' : 'white'
                }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <GithubOutlined />
                    <Text strong>{repo.name}</Text>
                  </Space>
                  <Text type="secondary" ellipsis>{repo.description}</Text>
                </Space>
              </Card>
            </List.Item>
          )}
        />
      </div>

      {/* 右侧内容区域 */}
      <div style={{ width: '80%', padding: '16px' }}>
        {selectedRepo ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card title="Docker 镜像构建历史">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ marginBottom: 16 }}>
                  <Text strong>选择镜像版本：</Text>
                  <Select
                    style={{ width: 600 }}
                    value={selectedImage?.id}
                    onChange={(value) => {
                      const image = dockerImages.find(img => img.id === value);
                      setSelectedImage(image || null);
                    }}
                    loading={loading}
                  >
                    {dockerImages.map(image => (
                      <Option key={image.id} value={image.id}>
                        {image.full_image_name} ({dayjs(image.created_at).format('YYYY-MM-DD HH:mm:ss')})
                      </Option>
                    ))}
                  </Select>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      const selectedRepository = repositories.find(r => r.name === selectedRepo);
                      if (selectedRepository) {
                        fetchDockerImages(selectedRepository.id);
                      }
                    }}
                    loading={loading}
                  >
                    刷新
                  </Button>
                </Space>

                {selectedImage && (
                  <Card size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Text strong>镜像名称：</Text>
                        <Tag color="blue" style={{
                          padding: '4px 8px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          maxWidth: '100%',
                          wordBreak: 'break-all'
                        }}>
                          {selectedImage.full_image_name}
                        </Tag>
                      </Space>
                      <Space>
                        <Text strong>构建时间：</Text>
                        <Text>{dayjs(selectedImage.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                      </Space>
                      <Space>
                        <Text strong>Dockerfile ID：</Text>
                        <Text>{selectedImage.dockerfile_id}</Text>
                      </Space>
                    </Space>
                  </Card>
                )}
              </Space>
            </Card>

            <Card title="Kubernetes 配置">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<DeploymentUnitOutlined />}
                    onClick={() => setDeploymentModalVisible(true)}
                    disabled={!selectedImage}
                  >
                    Deployment 配置构建
                  </Button>
                  <Button
                    type="primary"
                    icon={<ApiOutlined />}
                    onClick={() => setServiceModalVisible(true)}
                    disabled={!selectedImage}
                  >
                    Service 配置构建
                  </Button>
                </Space>

                <Table
                  columns={columns}
                  dataSource={k8sResources}
                  rowKey="id"
                  loading={resourceLoading}
                  style={{ marginTop: 16 }}
                />
              </Space>
            </Card>
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <Text type="secondary">请从左侧选择代码仓库</Text>
          </div>
        )}
      </div>

      {/* Deployment 配置 Modal */}
      <Modal
        title="Deployment 配置构建"
        open={deploymentModalVisible}
        onOk={() => handleSaveConfig('deployment')}
        onCancel={() => handleModalClose('deployment')}
        width={800}
        confirmLoading={configLoading}
      >
        <TextArea
          rows={20}
          value={deploymentConfig}
          onChange={(e) => setDeploymentConfig(e.target.value)}
          placeholder="请输入 Deployment 配置（YAML 格式）"
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>

      {/* Service 配置 Modal */}
      <Modal
        title="Service 配置构建"
        open={serviceModalVisible}
        onOk={() => handleSaveConfig('service')}
        onCancel={() => handleModalClose('service')}
        width={800}
        confirmLoading={configLoading}
      >
        <TextArea
          rows={20}
          value={serviceConfig}
          onChange={(e) => setServiceConfig(e.target.value)}
          placeholder="请输入 Service 配置（YAML 格式）"
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>
    </div>
  );
};

export default KubernetesDeploy; 