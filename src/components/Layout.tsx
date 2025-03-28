import React from 'react';
import { Layout, Menu } from 'antd';
import { UserOutlined, TeamOutlined, CodeOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider, Content } = Layout;

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/easy-deploy/profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: '/easy-deploy/team',
      icon: <TeamOutlined />,
      label: '团队空间',
    },
    {
      key: '/easy-deploy/repositories',
      icon: <CodeOutlined />,
      label: '代码仓库管理',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="light" style={{ boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)' }}>
        <div style={{ 
          height: 64, 
          margin: 16, 
          background: '#f0f2f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Easy Deploy
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ height: 'calc(100% - 96px)', borderRight: 0 }}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout; 