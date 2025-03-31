import React, { useEffect, useState } from 'react';
import { Card, Button, message, Space, Typography, Divider, Avatar, Descriptions, Form, Input, DatePicker, Table, Modal, Tag } from 'antd';
import { GithubOutlined, LoadingOutlined, EditOutlined, PlusOutlined, DeleteOutlined, StarOutlined, LoginOutlined } from '@ant-design/icons';
import { githubService, GithubUserInfo, DeveloperTokenRequest, DeveloperTokenResponse, dockerAccountService, DockerAccount, DockerAccountRequest } from '../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import locale from 'antd/es/date-picker/locale/zh_CN';

dayjs.locale('zh-cn');

const { Title } = Typography;

const Profile: React.FC = () => {
  const [githubInfo, setGithubInfo] = useState<GithubUserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<DeveloperTokenResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();
  const [dockerAccounts, setDockerAccounts] = useState<DockerAccount[]>([]);
  const [dockerLoading, setDockerLoading] = useState(false);
  const [isDockerModalVisible, setIsDockerModalVisible] = useState(false);
  const [editingDockerAccount, setEditingDockerAccount] = useState<DockerAccount | null>(null);
  const [dockerForm] = Form.useForm();

  const isFieldDisabled = Boolean(tokenInfo && !isEditing);
  const fieldBackgroundColor = isFieldDisabled ? '#f5f5f5' : 'white';

  // 获取 GitHub 绑定状态和开发者令牌信息
  useEffect(() => {
    checkGithubBinding();
  }, []);

  useEffect(() => {
    if (githubInfo?.bound) {
      fetchDeveloperToken();
    }
  }, [githubInfo]);

  const checkGithubBinding = async () => {
    try {
      setLoading(true);
      const response = await githubService.checkGithubBinding();
      console.log('GitHub binding response:', response); // 添加调试日志
      if (response.code === 200 && response.data) {
        setGithubInfo(response.data);
      }
    } catch (error) {
      console.error('检查 GitHub 绑定状态失败:', error);
      message.error('获取 GitHub 绑定状态失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeveloperToken = async () => {
    try {
      setTokenLoading(true);
      const response = await githubService.queryDeveloperToken();
      if (response.code === 200 && response.data) {
        setTokenInfo(response.data);
        form.setFieldsValue({
          developer_token: response.data.developer_token,
          comment: response.data.developer_token_comment,
          expire_time: response.data.developer_token_expire_time ? dayjs(response.data.developer_token_expire_time) : undefined,
          repository_name: response.data.developer_repository_name,
        });
      }
    } catch (error) {
      message.error('获取开发者令牌信息失败');
    } finally {
      setTokenLoading(false);
    }
  };

  // 处理 GitHub 绑定
  const handleBindGithub = () => {
    const oauthUrl = githubService.getOAuthUrl();
    window.location.href = oauthUrl;
  };

  // 处理 GitHub 解绑
  const handleUnbindGithub = async () => {
    try {
      setLoading(true);
      await githubService.unbindGithub();
      message.success('GitHub 账号解绑成功');
      setGithubInfo(null);
      setTokenInfo(null);
      form.resetFields();
    } catch (error) {
      message.error('GitHub 账号解绑失败');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: DeveloperTokenRequest) => {
    try {
      setTokenLoading(true);
      const data = {
        developer_token: values.developer_token,
        expire_time: dayjs(values.expire_time).format('YYYY-MM-DD HH:mm:ss'),
        comment: values.comment,
        repository_name: values.repository_name
      };
      
      if (tokenInfo) {
        await githubService.updateDeveloperToken(data);
        message.success('更新开发者令牌成功');
      } else {
        await githubService.saveDeveloperToken(data);
        message.success('保存开发者令牌成功');
      }
      
      await fetchDeveloperToken();
      setIsEditing(false);
    } catch (error) {
      message.error('操作失败');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (tokenInfo) {
      form.setFieldsValue({
        developer_token: tokenInfo.developer_token,
        comment: tokenInfo.developer_token_comment,
        expire_time: tokenInfo.developer_token_expire_time ? dayjs(tokenInfo.developer_token_expire_time) : undefined,
        repository_name: tokenInfo.developer_repository_name,
      });
    }
  };

  const disabledDate = (current: dayjs.Dayjs) => {
    return current && current.isBefore(dayjs().startOf('day'));
  };

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      form.setFieldsValue({
        expire_time: date
      });
    }
  };

  // 获取 Docker 账号列表
  const fetchDockerAccounts = async () => {
    try {
      setDockerLoading(true);
      const response = await dockerAccountService.queryDockerAccounts();
      if (response.code === 200) {
        setDockerAccounts(response.data || []);
      } else {
        message.error(response.message || '获取 Docker 账号列表失败');
      }
    } catch (error) {
      message.error('获取 Docker 账号列表失败');
    } finally {
      setDockerLoading(false);
    }
  };

  useEffect(() => {
    fetchDockerAccounts();
  }, []);

  // 处理 Docker 账号登录
  const handleDockerLogin = async (record: DockerAccount) => {
    try {
      const response = await dockerAccountService.loginDockerAccount(record.id);
      if (response.code === 200) {
        message.success('Docker 账号登录成功');
        await fetchDockerAccounts();
      } else {
        message.error(response.message || '登录失败');
      }
    } catch (error) {
      message.error('登录失败');
    }
  };

  // 处理设置默认 Docker 账号
  const handleSetDefault = async (record: DockerAccount) => {
    try {
      const response = await dockerAccountService.setDefaultAccount(record.id);
      if (response.code === 200) {
        message.success('默认账号设置成功');
        await fetchDockerAccounts();
      } else {
        message.error(response.message || '设置默认账号失败');
      }
    } catch (error) {
      message.error('设置默认账号失败');
    }
  };

  // 处理删除 Docker 账号
  const handleDeleteDocker = async (record: DockerAccount) => {
    try {
      const response = await dockerAccountService.deleteDockerAccount(record.id);
      if (response.code === 200) {
        message.success('Docker 账号删除成功');
        await fetchDockerAccounts();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 处理 Docker 账号表单提交
  const handleDockerSubmit = async (values: DockerAccountRequest) => {
    try {
      setDockerLoading(true);
      if (editingDockerAccount) {
        const response = await dockerAccountService.updateDockerAccount({
          ...values,
          id: editingDockerAccount.id
        });
        if (response.code === 200) {
          message.success('Docker 账号更新成功');
        } else {
          message.error(response.message || '更新失败');
        }
      } else {
        const response = await dockerAccountService.saveDockerAccount(values);
        if (response.code === 200) {
          message.success('Docker 账号添加成功');
        } else {
          message.error(response.message || '添加失败');
        }
      }
      setIsDockerModalVisible(false);
      dockerForm.resetFields();
      await fetchDockerAccounts();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setDockerLoading(false);
    }
  };

  // Docker 账号表格列定义
  const dockerColumns = [
    {
      title: '仓库地址',
      dataIndex: 'server',
      key: 'server',
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '备注',
      dataIndex: 'comment',
      key: 'comment',
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (text: string, record: DockerAccount) => (
        <Space size={2} style={{ display: 'flex', flexWrap: 'nowrap' }}>
          <Tag color={record.is_default ? 'green' : 'default'} style={{ margin: 0, padding: '0 4px' }}>
            {record.is_default ? '默认' : '普通'}
          </Tag>
          {record.is_login && (
            <Tag color="blue" style={{ margin: 0, padding: '0 4px' }}>
              已登录
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (text: string, record: DockerAccount) => (
        <Space size={2}>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingDockerAccount(record);
              dockerForm.setFieldsValue({
                server: record.server,
                namespace: record.namespace,
                username: record.username,
                password: record.password,
                comment: record.comment,
              });
              setIsDockerModalVisible(true);
            }}
            style={{ padding: '0 4px' }}
          >
            编辑
          </Button>
          {!record.is_default && (
            <Button
              type="text"
              icon={<StarOutlined />}
              onClick={() => handleSetDefault(record)}
              style={{ padding: '0 4px' }}
            >
              设默认
            </Button>
          )}
          <Button
            type="text"
            icon={<LoginOutlined />}
            onClick={() => handleDockerLogin(record)}
            style={{ 
              color: record.is_login ? '#52c41a' : undefined,
              padding: '0 4px'
            }}
          >
            {record.is_login ? '已登录' : '登录'}
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteDocker(record)}
            style={{ padding: '0 4px' }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{
      padding: '24px',
      height: 'calc(100vh - 64px)', // 减去顶部导航栏的高度
      overflow: 'auto',
      backgroundColor: '#f0f2f5'
    }}>
      <Card style={{ marginBottom: '24px' }}>
        <Title level={2}>个人中心</Title>
        <Divider />
        
        {/* GitHub 绑定部分 */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>
            <GithubOutlined style={{ marginRight: '8px' }} />
            GitHub 账号绑定
          </Title>

          {loading ? (
            <LoadingOutlined style={{ fontSize: 24 }} spin />
          ) : (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {githubInfo && githubInfo.bound ? (
                <>
                  <Descriptions bordered>
                    <Descriptions.Item label="头像" span={3}>
                      <Avatar size={64} src={githubInfo.avatar_url} />
                    </Descriptions.Item>
                    <Descriptions.Item label="GitHub ID" span={3}>
                      {githubInfo.github_id}
                    </Descriptions.Item>
                    <Descriptions.Item label="用户名" span={3}>
                      {githubInfo.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="邮箱" span={3}>
                      {githubInfo.email}
                    </Descriptions.Item>
                  </Descriptions>
                  <Button
                    danger
                    icon={<GithubOutlined />}
                    onClick={handleUnbindGithub}
                  >
                    解绑 GitHub 账号
                  </Button>
                </>
              ) : (
                <>
                  <div>当前未绑定 GitHub 账号</div>
                  <Button
                    type="primary"
                    icon={<GithubOutlined />}
                    onClick={handleBindGithub}
                  >
                    绑定 GitHub 账号
                  </Button>
                </>
              )}
            </Space>
          )}
        </div>

        {/* Docker 账号管理部分 */}
        <Divider />
        <div style={{ marginBottom: '24px' }}>
          <Space style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <Title level={4}>Docker 账号管理</Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingDockerAccount(null);
                dockerForm.resetFields();
                setIsDockerModalVisible(true);
              }}
            >
              添加 Docker 账号
            </Button>
          </Space>

          <Table
            loading={dockerLoading}
            columns={dockerColumns}
            dataSource={dockerAccounts}
            rowKey="id"
          />
        </div>

        {/* Docker 账号表单模态框 */}
        <Modal
          title={`${editingDockerAccount ? '编辑' : '添加'} Docker 账号`}
          open={isDockerModalVisible}
          onCancel={() => {
            setIsDockerModalVisible(false);
            setEditingDockerAccount(null);
            dockerForm.resetFields();
          }}
          footer={null}
        >
          <Form
            form={dockerForm}
            layout="vertical"
            onFinish={handleDockerSubmit}
          >
            <Form.Item
              name="server"
              label="仓库地址"
              rules={[{ required: true, message: '请输入 Docker 仓库地址' }]}
            >
              <Input placeholder="请输入 Docker 仓库地址" />
            </Form.Item>

            <Form.Item
              name="namespace"
              label="命名空间"
              rules={[{ required: true, message: '请输入命名空间' }]}
            >
              <Input placeholder="请输入命名空间" />
            </Form.Item>

            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>

            <Form.Item
              name="comment"
              label="备注"
              rules={[{ required: true, message: '请输入备注信息' }]}
            >
              <Input.TextArea placeholder="请输入备注信息" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={dockerLoading}>
                  {editingDockerAccount ? '保存修改' : '添加账号'}
                </Button>
                <Button onClick={() => {
                  setIsDockerModalVisible(false);
                  setEditingDockerAccount(null);
                  dockerForm.resetFields();
                }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* GitHub 开发者信息部分 */}
        {githubInfo?.bound && (
          <>
            <Divider />
            <Card 
              title="GitHub 开发者信息" 
              loading={tokenLoading}
              extra={
                tokenInfo && !isEditing ? (
                  <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
                    修改
                  </Button>
                ) : null
              }
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
              >
                <Form.Item
                  label="仓库名称"
                  name="repository_name"
                  rules={[{ required: true, message: '请输入你的仓库名称【不是项目仓库名称，是根仓库名称】' }]}
                >
                  <Input 
                    placeholder="请输入您的 GitHub 仓库名称" 
                    disabled={isFieldDisabled}
                    style={{ backgroundColor: fieldBackgroundColor }}
                  />
                </Form.Item>

                <Form.Item
                  label="开发者token"
                  name="developer_token"
                  rules={[{ required: true, message: '请输入开发者token' }]}
                >
                  <Input.Password 
                    placeholder="请输入您的 GitHub开发者 token" 
                    disabled={isFieldDisabled}
                    style={{ backgroundColor: fieldBackgroundColor }}
                  />
                </Form.Item>

                <Form.Item
                  label="开发者token过期时间"
                  name="expire_time"
                  rules={[{ required: true, message: '请选择过期时间' }]}
                >
                  <DatePicker
                    showTime={{
                      format: 'HH:mm:ss',
                      defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
                    }}
                    format="YYYY-MM-DD HH:mm:ss"
                    placeholder="选择过期时间"
                    style={{ 
                      width: '100%',
                      backgroundColor: fieldBackgroundColor
                    }}
                    disabled={isFieldDisabled}
                    locale={locale}
                    disabledDate={disabledDate}
                    onChange={handleDateChange}
                    showToday={false}
                    inputReadOnly={true}
                    popupStyle={{ width: '300px' }}
                  />
                </Form.Item>

                <Form.Item
                  label="备注"
                  name="comment"
                  rules={[{ required: true, message: '请输入备注信息' }]}
                >
                  <Input.TextArea 
                    placeholder="请输入备注信息" 
                    disabled={isFieldDisabled}
                    style={{ backgroundColor: fieldBackgroundColor }}
                  />
                </Form.Item>

                {(!tokenInfo || isEditing) && (
                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit">
                        {tokenInfo ? '保存修改' : '保存令牌'}
                      </Button>
                      {isEditing && (
                        <Button onClick={handleCancelEdit}>
                          取消修改
                        </Button>
                      )}
                    </Space>
                  </Form.Item>
                )}
              </Form>
            </Card>
          </>
        )}
      </Card>
    </div>
  );
};

export default Profile; 