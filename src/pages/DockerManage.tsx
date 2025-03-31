import React, { useState, useEffect } from 'react';
import { Tree, Select, Button, Form, Input, message, Modal, Space, Card, List, Typography, AutoComplete } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, GithubOutlined, ImportOutlined } from '@ant-design/icons';
import { dockerfileService, DockerfileData, DockerfileItem, githubApi, githubService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import ImageBuildModal from '../components/ImageBuildModal';

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
  const [buildModalVisible, setBuildModalVisible] = useState(false);
  const [selectedDockerfile, setSelectedDockerfile] = useState<DockerfileData | null>(null);

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
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card>
          <Space>
            <Select
              style={{ width: 200 }}
              placeholder="选择仓库"
              value={selectedRepo}
              onChange={handleRepoSelect}
            >
              {repositories.map(repo => (
                <Option key={repo.name} value={repo.name}>
                  {repo.name}
                </Option>
              ))}
            </Select>

            <Select
              style={{ width: 200 }}
              placeholder="选择分支"
              value={selectedBranch}
              onChange={handleBranchChange}
              disabled={!selectedRepo}
            >
              {repositories
                .find(repo => repo.name === selectedRepo)
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

        {dockerfiles.length > 0 && (
          <List
            dataSource={dockerfiles}
            renderItem={(dockerfile) => (
              <List.Item>
                <Card style={{ width: '100%' }}>
                  <div style={{ marginBottom: 16 }}>
                    <Title level={5}>{dockerfile.file_name}</Title>
                  </div>
                  <pre style={{
                    backgroundColor: '#282c34',
                    padding: '16px',
                    borderRadius: '4px',
                    color: '#abb2bf',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    overflow: 'auto'
                  }}>
                    {dockerfile.file_data.map((item, index) => (
                      <div key={index}>
                        <span style={{ color: '#c678dd', fontWeight: 'bold' }}>{item.dockerfile_key}</span>
                        <span style={{ color: '#98c379', marginLeft: '8px' }}>{item.shell_value}</span>
                      </div>
                    ))}
                  </pre>
                  <Space style={{ marginTop: 16 }}>
                    <Button
                      type="primary"
                      onClick={() => {
                        setSelectedDockerfile(dockerfile);
                        setBuildModalVisible(true);
                      }}
                    >
                      镜像构建
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => handleEdit(dockerfile)}
                    >
                      修改
                    </Button>
                    <Button
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: '确认删除',
                          content: '确定要删除这个 Dockerfile 吗？',
                          onOk: () => handleDelete(dockerfile),
                        });
                      }}
                    >
                      删除
                    </Button>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Space>

      {/* Dockerfile 编辑模态框 */}
      <Modal
        title={editingDockerfile ? "编辑 Dockerfile" : "创建 Dockerfile"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingDockerfile(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
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

      {/* Dockerfile 导入模态框 */}
      <Modal
        title="导入 Dockerfile"
        open={isImportModalVisible}
        onCancel={() => {
          setIsImportModalVisible(false);
          setImportContent('');
        }}
        onOk={handleImport}
      >
        <Input.TextArea
          rows={10}
          value={importContent}
          onChange={(e) => setImportContent(e.target.value)}
          placeholder="请粘贴 Dockerfile 内容..."
        />
      </Modal>

      {/* 镜像构建模态框 */}
      <ImageBuildModal
        visible={buildModalVisible}
        onCancel={() => {
          setBuildModalVisible(false);
          setSelectedDockerfile(null);
        }}
        dockerfile={selectedDockerfile}
      />
    </div>
  );
};

export default DockerManage; 