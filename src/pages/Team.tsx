import React from 'react';
import { Card, Typography } from 'antd';
import { RocketOutlined } from '@ant-design/icons';

const { Title } = Typography;

const Team: React.FC = () => {
  return (
    <Card style={{ textAlign: 'center', padding: '48px' }}>
      <RocketOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '24px' }} />
      <Title level={3}>正在开发中～</Title>
    </Card>
  );
};

export default Team; 