import React, { useEffect, useState } from 'react';
import { Card, Button, message, Space, Typography, Divider, Avatar, Descriptions, Form, Input, DatePicker } from 'antd';
import { GithubOutlined, LoadingOutlined, EditOutlined } from '@ant-design/icons';
import { githubService, GithubUserInfo, DeveloperTokenRequest, DeveloperTokenResponse } from '../services/api';
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

  return (
    <div style={{ padding: '24px' }}>
      <Card>
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

        {/* 其他个人信息部分 */}
        {/* ... 其他个人信息的代码 ... */}

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