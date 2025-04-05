import React, { useState, useEffect, useRef } from 'react';
import { List, Card, Typography, Space, Tag, Button, Select, message, Modal, Input, Table, Alert, Row, Col, Form } from 'antd';
import { GithubOutlined, ReloadOutlined, DeploymentUnitOutlined, ApiOutlined, DeleteOutlined, LoadingOutlined, PlayCircleOutlined, SaveOutlined, RocketOutlined, HistoryOutlined, StopOutlined } from '@ant-design/icons';
import { githubApi, githubService, dockerImageService, DockerImage, k8sResourceService, K8sResource, ossAccountService, k8sResourceOperationLogService, K8sResourceOperationLog } from '../services/api';
import { WebSocketK8sService, K8sWsResponse } from '../services/websocketK8s';
import { useNavigate } from 'react-router-dom';
import OSS from 'ali-oss';
import dayjs from 'dayjs';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import Editor from '@monaco-editor/react';

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
  const [deploymentFileName, setDeploymentFileName] = useState('');
  const [serviceFileName, setServiceFileName] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [k8sResources, setK8sResources] = useState<K8sResource[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [ossClient, setOssClient] = useState<OSS | null>(null);
  const [ossLoading, setOssLoading] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewResourceId, setPreviewResourceId] = useState<number | null>(null);
  const [previewResourceType, setPreviewResourceType] = useState<string>('');
  const [previewOssUrl, setPreviewOssUrl] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [wsService, setWsService] = useState<WebSocketK8sService | null>(null);
  const [wsMessages, setWsMessages] = useState<Array<{ command: string; result: string }>>([]);
  const [customCommand, setCustomCommand] = useState('');
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token') || '';
  const [editorReady, setEditorReady] = useState(false);
  const [operationLogsModalVisible, setOperationLogsModalVisible] = useState(false);
  const [currentResourceId, setCurrentResourceId] = useState<number | null>(null);
  const [operationLogs, setOperationLogs] = useState<K8sResourceOperationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [deployingResources, setDeployingResources] = useState<number[]>([]);
  const [stoppingResources, setStoppingResources] = useState<number[]>([]);

  // 初始化 OSS 客户端
  const initOssClient = async () => {
    try {
      setOssLoading(true);
      const response = await ossAccountService.queryOssAccount();
      if (response.code === 200 && response.data) {
        const ossConfig = response.data;
        const client = new OSS({
          region: ossConfig.region,
          accessKeyId: ossConfig.access_key_id,
          accessKeySecret: ossConfig.access_key_secret,
          bucket: ossConfig.bucket,
          secure: true
        });
        setOssClient(client);
      } else {
        message.error('获取 OSS 配置失败');
      }
    } catch (error) {
      console.error('初始化 OSS 客户端失败:', error);
      message.error('初始化 OSS 客户端失败');
    } finally {
      setOssLoading(false);
    }
  };

  // 获取开发者令牌和仓库列表
  const fetchRepositories = async () => {
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

  // 监听 k8sResources 的变化
  useEffect(() => {
    console.log('Current k8sResources:', k8sResources);
  }, [k8sResources]);

  // 初始化 OSS 客户端和获取仓库列表
  useEffect(() => {
    initOssClient();
    fetchRepositories();
  }, [navigate]);

  // 初始化 WebSocket 服务
  const initWebSocket = () => {
    if (token) {
      setWsStatus('connecting');
      const service = new WebSocketK8sService(token);
      service.setMessageCallback((response: K8sWsResponse) => {
        const data = response.data;
        if (response.success && data && typeof data.command === 'string' && typeof data.result === 'string') {
          setWsMessages(prev => [...prev, {
            command: data.command,
            result: data.result
          }]);
          setWsStatus('connected');
        } else {
          // 处理错误消息，但不断开连接
          setWsMessages(prev => [...prev, {
            command: '系统提示',
            result: response.message || '命令执行失败'
          }]);
          // 只有在连接失败时才设置状态为 failed
          if (wsStatus === 'connecting') {
            setWsStatus('failed');
          }
        }
      });
      setWsService(service);
    }
  };

  // 重新连接 WebSocket
  const reconnectWebSocket = () => {
    if (wsService) {
      wsService.close();
    }
    initWebSocket();
  };

  // 组件卸载时关闭 WebSocket 连接
  useEffect(() => {
    return () => {
      if (wsService) {
        wsService.close();
      }
    };
  }, [wsService]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [wsMessages]);

  // 解除 WebSocket 连接
  const disconnectWebSocket = () => {
    if (wsService) {
      wsService.close();
      setWsService(null);
      setWsStatus('disconnected');
      setWsMessages([]);
    }
  };

  // 监听 WebSocket 消息，清除部署和停止状态
  useEffect(() => {
    if (wsMessages.length > 0) {
      // 只要收到任何消息，就清除所有等待状态
      setDeployingResources([]);
      setStoppingResources([]);
    }
  }, [wsMessages]);

  // 渲染加载状态
  if (ossLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingOutlined style={{ fontSize: 24 }} spin />
      </div>
    );
  }

  // 渲染 OSS 未配置状态
  if (!ossClient) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <Alert
          message="OSS 配置未完成"
          description="请先在个人中心配置 OSS 账号信息"
          type="warning"
          showIcon
        />
      </div>
    );
  }

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
    
    // 清空 WebSocket 相关状态
    if (wsService) {
      wsService.close();
      setWsService(null);
    }
    setWsStatus('disconnected');
    setWsMessages([]);
    setCustomCommand('');
    
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

    const fileName = type === 'deployment' ? deploymentFileName : serviceFileName;
    if (!fileName) {
      message.error('请输入文件名');
      return;
    }

    try {
      setConfigLoading(true);
      const config = type === 'deployment' ? deploymentConfig : serviceConfig;
      const timestamp = Date.now();
      const objectName = `k8s/${type}/${timestamp}.yaml`;
      
      // 创建 Blob 对象
      const blob = new Blob([config], { type: 'text/yaml' });
      
      const result = await ossClient.put(objectName, blob);
      
      // 保存配置到后端
      const selectedRepository = repositories.find(r => r.name === selectedRepo);
      if (selectedRepository) {
        await k8sResourceService.saveResource({
          repository_id: selectedRepository.id,
          resource_type: type,
          oss_url: result.url,
          file_name: fileName
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

  // 处理文件预览
  const handlePreviewFile = async (url: string, id: number, type: string, fileName: string) => {
    try {
      setPreviewLoading(true);
      setPreviewModalVisible(true);
      setPreviewFileName(fileName);
      setPreviewResourceId(id);
      setPreviewResourceType(type);
      setPreviewOssUrl(url);
      setIsEditing(false);
      setEditorReady(false);
      
      // 从 URL 中提取 object-name
      const objectName = url.split('/').slice(-3).join('/');
      
      // 获取文件内容
      const result = await ossClient.get(objectName);
      setPreviewContent(result.content.toString());
      setEditContent(result.content.toString());
    } catch (error) {
      console.error('获取文件内容失败:', error);
      message.error('获取文件内容失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 处理文件编辑保存
  const handleSaveEdit = async () => {
    if (!previewResourceId || !previewOssUrl || !previewFileName) {
      message.error('缺少必要信息');
      return;
    }

    try {
      setPreviewLoading(true);
      
      // 从 URL 中提取 object-name
      const objectName = previewOssUrl.split('/').slice(-3).join('/');
      
      // 创建 Blob 对象
      const blob = new Blob([editContent], { type: 'text/yaml' });
      
      // 上传到 OSS
      const result = await ossClient.put(objectName, blob);
      
      // 更新后端
      const selectedRepository = repositories.find(r => r.name === selectedRepo);
      if (selectedRepository) {
        await k8sResourceService.updateResource({
          id: previewResourceId,
          repository_id: selectedRepository.id,
          resource_type: previewResourceType,
          oss_url: result.url,
          file_name: previewFileName
        });
        
        message.success('文件更新成功');
        setIsEditing(false);
        
        // 更新预览内容
        setPreviewContent(editContent);
        
        // 刷新配置列表
        fetchK8sResources(selectedRepository.id, 'all');
      }
    } catch (error) {
      console.error('更新文件失败:', error);
      message.error('更新文件失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 获取文件类型
  const getFileType = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'json':
        return 'json';
      case 'js':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'py':
        return 'python';
      case 'sh':
        return 'bash';
      default:
        return 'text';
    }
  };

  // 处理资源部署
  const handleDeployResource = async (resource: K8sResource) => {
    // 检查 WebSocket 连接状态
    if (!wsService || wsStatus !== 'connected') {
      setWsMessages(prev => [...prev, {
        command: '系统提示',
        result: '请先点击下方的"远程连接"按钮建立连接，然后再进行部署操作。'
      }]);
      return;
    }

    try {
      // 设置部署状态
      setDeployingResources(prev => [...prev, resource.id]);
      
      // 发送部署命令
      wsService.sendCommand('kubectl apply -f', {
        k8s_resource_id: resource.id
      });
      
      // 设置超时，如果 30 秒内没有响应，则清除部署状态
      setTimeout(() => {
        setDeployingResources(prev => prev.filter(id => id !== resource.id));
      }, 15000);
    } catch (error) {
      console.error('部署失败:', error);
      setWsMessages(prev => [...prev, {
        command: '系统提示',
        result: '部署失败：' + (error instanceof Error ? error.message : String(error))
      }]);
      // 清除部署状态
      setDeployingResources(prev => prev.filter(id => id !== resource.id));
    }
  };

  // 处理资源停止运行
  const handleStopResource = async (resource: K8sResource) => {
    // 检查 WebSocket 连接状态
    if (!wsService || wsStatus !== 'connected') {
      setWsMessages(prev => [...prev, {
        command: '系统提示',
        result: '请先点击下方的"远程连接"按钮建立连接，然后再进行停止操作。'
      }]);
      return;
    }

    try {
      // 设置停止状态
      setStoppingResources(prev => [...prev, resource.id]);
      
      // 发送停止命令
      wsService.sendCommand('kubectl delete', {
        k8s_resource_id: resource.id
      });
      
      // 设置超时，如果 30 秒内没有响应，则清除停止状态
      setTimeout(() => {
        setStoppingResources(prev => prev.filter(id => id !== resource.id));
      }, 30000);
    } catch (error) {
      console.error('停止失败:', error);
      setWsMessages(prev => [...prev, {
        command: '系统提示',
        result: '停止失败：' + (error instanceof Error ? error.message : String(error))
      }]);
      // 清除停止状态
      setStoppingResources(prev => prev.filter(id => id !== resource.id));
    }
  };

  // 获取 K8s 资源操作日志
  const fetchOperationLogs = async (resourceId: number, page: number = 1, pageSize: number = 5) => {
    try {
      setLoadingLogs(true);
      const response = await k8sResourceOperationLogService.queryOperationLogs(resourceId, page, pageSize);
      if (response.code === 200) {
        setOperationLogs(response.logs);
        setTotalLogs(response.total);
        setCurrentPage(page);
        setPageSize(pageSize);
      } else {
        message.error('获取操作日志失败');
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
      message.error('获取操作日志失败');
    } finally {
      setLoadingLogs(false);
    }
  };

  // 处理操作记录按钮点击
  const handleOperationLogClick = (resourceId: number) => {
    setCurrentResourceId(resourceId);
    setOperationLogsModalVisible(true);
    fetchOperationLogs(resourceId);
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize: number) => {
    if (currentResourceId) {
      fetchOperationLogs(currentResourceId, page, pageSize);
    }
  };

  // 获取状态文本
  const getStatusText = (status: number) => {
    switch (status) {
      case 1:
        return '运行正常';
      case 2:
        return '运行停止';
      case 3:
        return '容器重启';
      default:
        return '未知状态';
    }
  };

  // 获取状态标签颜色
  const getStatusColor = (status: number) => {
    switch (status) {
      case 1:
        return 'green';
      case 2:
        return 'red';
      case 3:
        return 'orange';
      default:
        return 'default';
    }
  };

  // 获取操作类型标签颜色
  const getOperationTypeColor = (operationType: string, status: number) => {
    if (status === 2) {
      return 'red';
    }
    
    if (status === 3) {
      return operationType === 'delete' ? 'red' : 'orange';
    }
    
    return operationType === 'delete' ? 'red' : operationType === 'create' ? 'green' : 'blue';
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
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
    },
    {
      title: 'OSS URL',
      dataIndex: 'oss_url',
      key: 'oss_url',
      render: (url: string, record: K8sResource) => (
        <Button
          type="link"
          onClick={() => handlePreviewFile(url, record.id, record.resource_type, record.file_name)}
        >
          查看文件
        </Button>
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
        <Space>
          <Button
            type="primary"
            icon={<RocketOutlined />}
            onClick={() => handleDeployResource(record)}
            loading={deployingResources.includes(record.id)}
          >
            部署
          </Button>
          <Button
            type="primary"
            danger
            icon={<StopOutlined />}
            onClick={() => handleStopResource(record)}
            loading={stoppingResources.includes(record.id)}
          >
            停止
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteResource(record.id)}
          >
            删除
          </Button>
          <Button
            type="link"
            icon={<HistoryOutlined />}
            onClick={() => handleOperationLogClick(record.id)}
          >
            操作记录
          </Button>
        </Space>
      )
    }
  ];

  // 常用命令按钮
  const commonCommands = [
    { label: '查看所有 Pod', command: 'kubectl get pod -A' },
    { label: '查看所有 Service', command: 'kubectl get svc -A' },
    { label: '查看所有 Deployment', command: 'kubectl get deployment -A' },
    { label: '查看所有 Namespace', command: 'kubectl get namespace' },
    { label: '查看集群信息', command: 'kubectl cluster-info' },
    { label: '查看节点状态', command: 'kubectl get nodes' },
  ];

  // 执行命令
  const executeCommand = (command: string) => {
    if (wsService) {
      wsService.sendCommand(command);
    }
  };

  // 处理自定义命令提交
  const handleCommandSubmit = () => {
    if (customCommand.trim()) {
      executeCommand(customCommand.trim());
      setCustomCommand('');
    }
  };

  // 处理编辑器挂载
  const handleEditorDidMount = (editor: any) => {
    // 确保编辑器在挂载后正确布局
    setTimeout(() => {
      editor.layout();
      setEditorReady(true);
    }, 300);
  };

  // 处理清除消息
  const handleClearMessages = () => {
    setWsMessages([]);
  };

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

            {/* Kubernetes 控制面板 */}
            <Card 
              title={
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>Kubernetes 控制面板</span>
                  <Space>
                    {wsStatus === 'disconnected' && (
                      <Button type="primary" onClick={initWebSocket}>
                        远程连接
                      </Button>
                    )}
                    {wsStatus === 'connecting' && (
                      <Button type="primary" loading>
                        连接中...
                      </Button>
                    )}
                    {wsStatus === 'connected' && (
                      <Space>
                        <Button type="primary" onClick={reconnectWebSocket}>
                          重新连接
                        </Button>
                        <Button type="default" danger onClick={disconnectWebSocket}>
                          断开连接
                        </Button>
                      </Space>
                    )}
                    {wsStatus === 'failed' && (
                      <Button type="primary" danger onClick={reconnectWebSocket}>
                        连接失败，重试
                      </Button>
                    )}
                  </Space>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {/* 上层：常用命令按钮 */}
                <Row gutter={[8, 8]}>
                  {commonCommands.map((cmd, index) => (
                    <Col key={index}>
                      <Button
                        type="primary"
                        onClick={() => executeCommand(cmd.command)}
                      >
                        {cmd.label}
                      </Button>
                    </Col>
                  ))}
                </Row>

                {/* 中层：自定义命令输入 */}
                <Space.Compact style={{ width: '100%', marginTop: '16px' }}>
                  <Input
                    placeholder="请输入 kubectl 命令"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    onPressEnter={handleCommandSubmit}
                    style={{ width: 'calc(100% - 160px)' }}
                  />
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleCommandSubmit}
                  >
                    执行
                  </Button>
                  <Button
                    type="default"
                    icon={<DeleteOutlined />}
                    onClick={handleClearMessages}
                  >
                    清除
                  </Button>
                </Space.Compact>

                {/* 下层：消息展示区域 */}
                <div
                  style={{
                    marginTop: '16px',
                    height: '400px',
                    overflow: 'auto',
                    backgroundColor: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}
                >
                  {wsMessages.map((msg, index) => (
                    <div key={index} style={{ marginBottom: '16px' }}>
                      <div style={{ color: '#1890ff', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                        $ {msg.command}
                      </div>
                      <pre style={{ 
                        color: '#333', 
                        margin: 0, 
                        padding: 0, 
                        overflow: 'auto',
                        maxWidth: 'none'
                      }}>
                        {msg.result}
                      </pre>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
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
        <Form layout="vertical">
          <Form.Item label="文件名" required>
            <Input 
              placeholder="请输入文件名（不含扩展名）" 
              value={deploymentFileName}
              onChange={(e) => setDeploymentFileName(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="YAML 配置" required>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', height: '400px' }}>
              <Editor
                height="400px"
                defaultLanguage="yaml"
                value={deploymentConfig}
                onChange={(value) => setDeploymentConfig(value || '')}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  tabSize: 2,
                  wordWrap: 'on',
                  automaticLayout: true
                }}
                loading={<div>加载中...</div>}
                beforeMount={(monaco) => {
                  monaco.editor.defineTheme('vs-light', {
                    base: 'vs',
                    inherit: true,
                    rules: [],
                    colors: {}
                  });
                }}
              />
            </div>
          </Form.Item>
        </Form>
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
        <Form layout="vertical">
          <Form.Item label="文件名" required>
            <Input 
              placeholder="请输入文件名（不含扩展名）" 
              value={serviceFileName}
              onChange={(e) => setServiceFileName(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="YAML 配置" required>
            <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', height: '400px' }}>
              <Editor
                height="400px"
                defaultLanguage="yaml"
                value={serviceConfig}
                onChange={(value) => setServiceConfig(value || '')}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  tabSize: 2,
                  wordWrap: 'on',
                  automaticLayout: true
                }}
                loading={<div>加载中...</div>}
                beforeMount={(monaco) => {
                  monaco.editor.defineTheme('vs-light', {
                    base: 'vs',
                    inherit: true,
                    rules: [],
                    colors: {}
                  });
                }}
              />
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件预览 Modal */}
      <Modal
        title={`文件预览 - ${previewFileName}`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={800}
        footer={isEditing ? [
          <Button key="cancel" onClick={() => setIsEditing(false)}>
            取消
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSaveEdit}
            loading={previewLoading}
            disabled={!editorReady}
          >
            保存
          </Button>
        ] : [
          <Button key="edit" type="primary" onClick={() => setIsEditing(true)}>
            编辑
          </Button>
        ]}
        destroyOnClose
      >
        {previewLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <LoadingOutlined style={{ fontSize: 24 }} spin />
          </div>
        ) : isEditing ? (
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', height: '60vh' }}>
            {!editorReady && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <LoadingOutlined style={{ fontSize: 24 }} spin />
              </div>
            )}
            <Editor
              height="60vh"
              defaultLanguage="yaml"
              value={editContent}
              onChange={(value) => setEditContent(value || '')}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                tabSize: 2,
                wordWrap: 'on',
                automaticLayout: true,
                renderWhitespace: 'none',
                lineNumbers: 'on',
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3
              }}
              loading={<div>加载中...</div>}
              beforeMount={(monaco) => {
                monaco.editor.defineTheme('vs-light', {
                  base: 'vs',
                  inherit: true,
                  rules: [],
                  colors: {}
                });
              }}
              onMount={handleEditorDidMount}
            />
          </div>
        ) : (
          <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <SyntaxHighlighter
              language="yaml"
              style={docco}
              customStyle={{
                margin: 0,
                padding: '16px',
                borderRadius: '4px'
              }}
            >
              {previewContent}
            </SyntaxHighlighter>
          </div>
        )}
      </Modal>

      {/* 操作记录弹窗 */}
      <Modal
        title="操作记录"
        open={operationLogsModalVisible}
        onCancel={() => setOperationLogsModalVisible(false)}
        width={1000}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}
        footer={[
          <Button key="close" onClick={() => setOperationLogsModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {loadingLogs ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <LoadingOutlined style={{ fontSize: 24 }} spin />
          </div>
        ) : operationLogs.length > 0 ? (
          <Table
            dataSource={operationLogs}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalLogs,
              onChange: handlePageChange,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            scroll={{ x: 900, y: 500 }}
            size="small"
            columns={[
              {
                title: '操作类型',
                dataIndex: 'operation_type',
                key: 'operation_type',
                width: 80,
                render: (type: string, record: K8sResourceOperationLog) => (
                  <Tag color={getOperationTypeColor(type, record.status)}>
                    {type === 'create' ? '创建' : type === 'delete' ? '删除' : '检查'}
                  </Tag>
                )
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                width: 80,
                render: (status: number) => (
                  <Tag color={getStatusColor(status)}>
                    {getStatusText(status)}
                  </Tag>
                )
              },
              {
                title: '命名空间',
                dataIndex: 'namespace',
                key: 'namespace',
                width: 100
              },
              {
                title: '资源名称',
                dataIndex: 'metadata_name',
                key: 'metadata_name',
                width: 120
              },
              {
                title: '资源标签',
                dataIndex: 'metadata_labels',
                key: 'metadata_labels',
                width: 150,
                render: (labels: string) => (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }}>{labels}</pre>
                )
              },
              {
                title: '执行命令',
                dataIndex: 'command',
                key: 'command',
                render: (command: string) => (
                  <pre style={{ 
                    margin: 0, 
                    whiteSpace: 'pre-wrap', 
                    backgroundColor: '#f5f5f5', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    maxHeight: '60px',
                    overflow: 'auto'
                  }}>
                    {command}
                  </pre>
                )
              },
              {
                title: '操作时间',
                dataIndex: 'created_at',
                key: 'created_at',
                width: 150,
                render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
              }
            ]}
          />
        ) : (
          <Alert message="暂无操作记录" type="info" />
        )}
      </Modal>
    </div>
  );
};

export default KubernetesDeploy; 