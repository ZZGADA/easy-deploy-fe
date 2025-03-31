import React, { useState, useEffect } from 'react';
import { Tree, Select, Button, Form, Input, message, Modal, Space, Card, List, Typography, AutoComplete } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, GithubOutlined, ImportOutlined } from '@ant-design/icons';
import { dockerfileService, DockerfileData, DockerfileItem, githubApi, githubService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

// Dockerfile 常用指令列表
const DOCKERFILE_KEYWORDS = [
  { value: 'FROM', label: 'FROM - 指定基础镜像' },
  { value: 'RUN', label: 'RUN - 执行命令' },
  { value: 'CMD', label: 'CMD - 容器启动命令' },
  { value: 'ENTRYPOINT', label: 'ENTRYPOINT - 入口点' },
  { value: 'WORKDIR', label: 'WORKDIR - 工作目录' },
  { value: 'COPY', label: 'COPY - 复制文件' },
  { value: 'ADD', label: 'ADD - 添加文件' },
  { value: 'ENV', label: 'ENV - 设置环境变量' },
  { value: 'ARG', label: 'ARG - 构建参数' },
  { value: 'EXPOSE', label: 'EXPOSE - 暴露端口' },
  { value: 'VOLUME', label: 'VOLUME - 定义匿名卷' },
  { value: 'USER', label: 'USER - 指定用户' },
  { value: 'LABEL', label: 'LABEL - 为镜像添加元数据' },
];

interface Repository {
  id: string;
  name: string;
  description?: string;
  branches: string[];
}

const DockerManage: React.FC = () => {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [dockerfiles, setDockerfiles] = useState<DockerfileData[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDockerfile, setEditingDockerfile] = useState<DockerfileData | null>(null);
  const [form] = Form.useForm();
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importContent, setImportContent] = useState('');

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

  // 获取 Dockerfile 列表
  const fetchDockerfiles = async () => {
    try {
      if (!selectedRepo || !selectedBranch) return;
      const repoId = repositories.find(r => r.name === selectedRepo)?.id;
      if (!repoId) return;

      const response = await dockerfileService.queryDockerfile({
        repository_id: repoId,
        branch_name: selectedBranch
      });
      
      if (response.code === 200 && response.data) {
        setDockerfiles(Array.isArray(response.data) ? response.data : []);
      } else {
        setDockerfiles([]);
      }
    } catch (error) {
      message.error('获取 Dockerfile 列表失败');
      setDockerfiles([]);
    }
  };

  useEffect(() => {
    if (selectedRepo && selectedBranch) {
      fetchDockerfiles();
    }
  }, [selectedRepo, selectedBranch]);

  // 处理仓库选择
  const handleRepoSelect = (repo: string) => {
    setSelectedRepo(repo);
    setSelectedBranch('');
    setDockerfiles([]);
  };

  // 处理分支选择
  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
  };

  // 处理 Dockerfile 删除
  const handleDelete = async (dockerfile: DockerfileData) => {
    try {
      if (!selectedRepo) return;
      await dockerfileService.deleteDockerfile(dockerfile.id || 0);
      message.success('Dockerfile 删除成功');
      fetchDockerfiles();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 处理 Dockerfile 创建/更新
  const handleSubmit = async (values: any) => {
    try {
      const fileData: DockerfileItem[] = values.commands.map((cmd: any, index: number) => ({
        index,
        dockerfile_key: cmd.key,
        shell_value: cmd.value
      }));

      const data: DockerfileData = {
        repository_name: selectedRepo,
        repository_id: repositories.find(r => r.name === selectedRepo)?.id || '',
        branch_name: selectedBranch,
        file_name: values.fileName || 'Dockerfile',
        file_data: fileData
      };

      if (editingDockerfile) {
        // 更新现有的 Dockerfile
        data.id = editingDockerfile.id;
        await dockerfileService.updateDockerfile(data);
        message.success('Dockerfile 更新成功');
      } else {
        // 创建新的 Dockerfile
        await dockerfileService.uploadDockerfile(data);
        message.success('Dockerfile 创建成功');
      }

      setIsModalVisible(false);
      setEditingDockerfile(null);
      form.resetFields();
      fetchDockerfiles();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 处理编辑 Dockerfile
  const handleEdit = (dockerfile: DockerfileData) => {
    setEditingDockerfile(dockerfile);
    form.setFieldsValue({
      fileName: dockerfile.file_name,
      commands: dockerfile.file_data.map(item => ({
        key: item.dockerfile_key,
        value: item.shell_value
      }))
    });
    setIsModalVisible(true);
  };

  // 处理创建新的 Dockerfile
  const handleCreate = () => {
    setEditingDockerfile(null);
    form.resetFields();
    form.setFieldsValue({
      fileName: 'Dockerfile'
    });
    setIsModalVisible(true);
  };

  // 解析 Dockerfile 内容
  const parseDockerfile = (content: string): { key: string; value: string }[] => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => {
      const [key, ...valueParts] = line.trim().split(' ');
      return {
        key: key.toUpperCase(),
        value: valueParts.join(' ')
      };
    });
  };

  // 处理 Dockerfile 导入
  const handleImport = () => {
    try {
      const commands = parseDockerfile(importContent);
      if (commands.length === 0) {
        message.error('请输入有效的 Dockerfile 内容');
        return;
      }

      form.setFieldsValue({
        commands: commands
      });
      
      setIsImportModalVisible(false);
      setImportContent('');
      setIsModalVisible(true);
    } catch (error) {
      message.error('解析 Dockerfile 失败，请检查格式是否正确');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
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
                onClick={() => {
                  handleRepoSelect(repo.name);
                  // 自动选择第一个分支
                  if (repo.branches.length > 0) {
                    handleBranchChange(repo.branches[0]);
                  }
                }}
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
      <div style={{ width: '80%', padding: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card>
            <Space>
              <Select
                style={{ width: 200 }}
                placeholder="选择分支"
                value={selectedBranch}
                onChange={handleBranchChange}
                disabled={!selectedRepo}
              >
                {selectedRepo &&
                  repositories
                    .find(r => r.name === selectedRepo)
                    ?.branches.map(branch => (
                      <Option key={branch} value={branch}>
                        {branch}
                      </Option>
                    ))}
              </Select>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                disabled={!selectedRepo || !selectedBranch}
              >
                创建 Dockerfile
              </Button>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setIsImportModalVisible(true)}
                disabled={!selectedRepo || !selectedBranch}
              >
                导入 Dockerfile
              </Button>
            </Space>
          </Card>

          <List
            dataSource={dockerfiles}
            locale={{
              emptyText: selectedRepo && selectedBranch ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <p>当前分支下暂无 Dockerfile 文件</p>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreate}
                  >
                    制作 Dockerfile
                  </Button>
                </div>
              ) : null
            }}
            renderItem={(dockerfile) => (
              <List.Item>
                <Card
                  title={dockerfile.file_name}
                  style={{ width: '100%', marginBottom: '16px' }}
                  extra={
                    <Space>
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(dockerfile)}
                      >
                        修改
                      </Button>
                      <Button 
                        icon={<DeleteOutlined />} 
                        danger 
                        onClick={() => handleDelete(dockerfile)}
                      >
                        删除
                      </Button>
                    </Space>
                  }
                >
                  <pre style={{ 
                    backgroundColor: '#282c34',
                    padding: '16px',
                    borderRadius: '6px',
                    margin: 0,
                    overflow: 'auto',
                    fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
                    fontSize: '14px',
                    lineHeight: '1.5',
                  }}>
                    <code>
                      {dockerfile.file_data.map((item, index) => {
                        // 处理注释和命令
                        if (item.dockerfile_key === '#') {
                          // 渲染注释行（绿色）
                          return (
                            <div key={index} style={{ color: '#98c379' }}>
                              # {item.shell_value}
                            </div>
                          );
                        } else {
                          // 处理命令行
                          const isSpecialCommand = ['CMD', 'ENTRYPOINT', 'RUN'].includes(item.dockerfile_key);
                          return (
                            <div key={index}>
                              {/* 关键字（蓝色） */}
                              <span style={{ color: '#61afef' }}>
                                {item.dockerfile_key}
                              </span>
                              {' '}
                              {/* 命令参数（特殊命令使用橙色，其他使用默认色） */}
                              <span style={{ 
                                color: isSpecialCommand ? '#d19a66' : '#abb2bf',
                              }}>
                                {item.shell_value}
                              </span>
                            </div>
                          );
                        }
                      }).reduce((prev: React.ReactNode[], curr: React.ReactNode, i: number) => {
                        // 在每个指令之间添加空行，除非当前行是注释且下一行也是注释
                        const nextItem = dockerfile.file_data[i + 1];
                        const currentIsComment = dockerfile.file_data[i].dockerfile_key === '#';
                        const nextIsComment = nextItem && nextItem.dockerfile_key === '#';
                        
                        if (currentIsComment && nextIsComment) {
                          return [...prev, curr];
                        }
                        return [...prev, curr, <div key={`space-${i}`}>&nbsp;</div>];
                      }, [])}
                    </code>
                  </pre>
                </Card>
              </List.Item>
            )}
          />
        </Space>

        {/* 导入 Dockerfile 的模态框 */}
        <Modal
          title="导入 Dockerfile"
          open={isImportModalVisible}
          onOk={handleImport}
          onCancel={() => {
            setIsImportModalVisible(false);
            setImportContent('');
          }}
          width={800}
        >
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">请粘贴标准格式的 Dockerfile 内容：</Text>
          </div>
          <Input.TextArea
            value={importContent}
            onChange={(e) => setImportContent(e.target.value)}
            placeholder="FROM node:14&#13;&#10;WORKDIR /app&#13;&#10;COPY . .&#13;&#10;RUN npm install&#13;&#10;CMD ['npm', 'start']"
            autoSize={{ minRows: 10, maxRows: 20 }}
            style={{ 
              fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
              fontSize: '14px'
            }}
          />
        </Modal>

        <Modal
          title={`${editingDockerfile ? '修改' : '创建'} Dockerfile`}
          open={isModalVisible}
          onOk={form.submit}
          onCancel={() => {
            setIsModalVisible(false);
            setEditingDockerfile(null);
            form.resetFields();
          }}
          width={1000}
        >
          <Form 
            form={form} 
            onFinish={handleSubmit}
            initialValues={{
              fileName: 'Dockerfile'
            }}
          >
            <Form.Item
              name="fileName"
              label="文件名称"
              rules={[{ required: true, message: '请输入文件名称' }]}
            >
              <Input defaultValue="Dockerfile" />
            </Form.Item>
            <Form.List name="commands">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8, width: '100%' }} align="start">
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        rules={[{ required: true, message: '请输入 Dockerfile 命令' }]}
                        style={{ width: '200px', marginBottom: 0 }}
                      >
                        <AutoComplete
                          options={DOCKERFILE_KEYWORDS}
                          placeholder="输入或选择命令"
                          filterOption={(inputValue, option) =>
                            option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                          }
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: '请输入命令内容' }]}
                        style={{ width: '600px', marginBottom: 0 }}
                      >
                        <Input.TextArea
                          placeholder="命令内容"
                          autoSize={{ minRows: 1, maxRows: 6 }}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Button onClick={() => remove(name)}>删除</Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加命令
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default DockerManage; 