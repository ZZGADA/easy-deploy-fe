import React, { useEffect, useState } from 'react';
import { Card, Button, message, Space, Typography, Divider } from 'antd';
import { GithubOutlined } from '@ant-design/icons';
import { githubService } from '../services/api';

const { Title, Text } = Typography;

const Profile: React.FC = () => {
  const [isGithubBound, setIsGithubBound] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // 检查 GitHub 绑定状态
  const checkGithubBinding = async () => {
    try {
      const response = await githubService.checkGithubBinding();
      setIsGithubBound(response.data.bound);
    } catch (error) {
      console.error('检查 GitHub 绑定状态失败:', error);
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
      setIsGithubBound(false);
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
          <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
            <Text>
              {isGithubBound ? '已绑定 GitHub 账号' : '未绑定 GitHub 账号'}
            </Text>
            <Button
              type={isGithubBound ? 'default' : 'primary'}
              icon={<GithubOutlined />}
              onClick={isGithubBound ? handleGithubUnbinding : handleGithubBinding}
              loading={loading}
            >
              {isGithubBound ? '解绑 GitHub 账号' : '绑定 GitHub 账号'}
            </Button>
          </Space>
        </div>

        {/* 其他个人信息部分 */}
        {/* ... 其他个人信息的代码 ... */}
      </Card>
    </div>
  );
};

export default Profile; 