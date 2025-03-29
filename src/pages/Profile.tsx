import React, { useEffect, useState } from 'react';
import { Card, Button, message, Space, Typography, Divider, Avatar, Descriptions } from 'antd';
import { GithubOutlined, LoadingOutlined } from '@ant-design/icons';
import { githubService, GithubUserInfo } from '../services/api';

const { Title } = Typography;

const Profile: React.FC = () => {
  const [githubInfo, setGithubInfo] = useState<GithubUserInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // 检查 GitHub 绑定状态
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

  useEffect(() => {
    checkGithubBinding();
  }, []);

  // 处理 GitHub 绑定
  const handleGithubBinding = () => {
    const oauthUrl = githubService.getOAuthUrl();
    window.location.href = oauthUrl;
  };

  // 处理 GitHub 解绑
  const handleGithubUnbinding = async () => {
    try {
      setLoading(true);
      await githubService.unbindGithub();
      message.success('GitHub 账号解绑成功');
      // 重新获取绑定状态
      await checkGithubBinding();
    } catch (error) {
      message.error('GitHub 账号解绑失败');
    } finally {
      setLoading(false);
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
                    onClick={handleGithubUnbinding}
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
                    onClick={handleGithubBinding}
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
      </Card>
    </div>
  );
};

export default Profile; 