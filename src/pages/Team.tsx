import React, { useEffect, useState } from 'react';
import { Card, Typography, Table, Button, message, Tabs, Input, Space, Tag, Modal, Form } from 'antd';
import { RocketOutlined, SearchOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { teamService } from '../services/api';
import type { Team, TeamMember, TeamListResponse, CreateTeamRequest } from '../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;
const { TextArea } = Input;

const TeamPage: React.FC = () => {
  const [selfTeam, setSelfTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchType, setSearchType] = useState<'name' | 'id'>('name');
  const [searchValue, setSearchValue] = useState('');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [leaveLoading, setLeaveLoading] = useState<Record<number, boolean>>({}); // 新增状态，用于控制申请离开按钮的加载状态

  // 获取用户自己的团队信息
  const fetchSelfTeam = async () => {
    try {
      const response = await teamService.getSelfTeam();
      if (response.message === '用户未加入任何团队') {
        setSelfTeam(null);
      } else {
        setSelfTeam(response.data);
        // 获取团队成员列表
        const membersResponse = await teamService.getTeamMembers(response.data.id);
        setTeamMembers(membersResponse.data);
      }
    } catch (error) {
      message.error('获取团队信息失败');
    }
  };

  // 查询团队列表
  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await teamService.queryTeams(
        currentPage,
        pageSize,
        searchType === 'name' ? searchValue : undefined,
        searchType === 'id' ? searchValue : undefined
      );
      setTeams(response.data.teams);
      setTotal(response.data.total);
    } catch (error) {
      message.error('获取团队列表失败');
    }
    setLoading(false);
  };

  const [joinLoading, setJoinLoading] = useState(false); // 新增状态，用于控制按钮的加载状态

  // 申请加入或离开团队
  const handleJoinOrLeaveTeam = async (teamId: number, requestType: 0 | 1) => {
    setJoinLoading(true); // 设置按钮为加载状态
    try {
      await teamService.createTeamRequest({
        team_id: teamId,
        request_type: requestType
      });
      message.success('申请已发送');
    } catch (error) {
      // 处理后端返回的报错信息
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response &&
        typeof error.response.data === 'object' &&
        error.response.data !== null &&
        'message' in error.response.data
      ) {
        // 进行类型断言，确保 message 是 string 类型
        const errorMessage = error.response.data.message as string;
        message.error(errorMessage);
      } else {
        message.error('申请失败，请稍后重试');
      }
    } finally {
      setJoinLoading(false); // 无论请求成功或失败，都将按钮的加载状态重置
    }
  };

  // 创建团队
  const handleCreateTeam = async (values: CreateTeamRequest) => {
    try {
      await teamService.createTeam(values);
      message.success('团队创建成功');
      setIsCreateModalVisible(false);
      form.resetFields();
      fetchSelfTeam(); // 刷新团队信息
    } catch (error) {
      message.error('团队创建失败');
    }
  };

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showRequestCard, setShowRequestCard] = useState(true);

  // 获取待审批请求列表
  const fetchPendingRequests = async () => {
    if (!selfTeam) return; // 如果用户没有加入团队，不获取待审批列表
    setLoadingRequests(true);
    try {
      const response = await teamService.getTeamRequests(selfTeam.id);
      if (response.code === 401) {
        setShowRequestCard(false);
        return;
      }
      setShowRequestCard(true);
      setPendingRequests(response.data);
    } catch (error) {
      message.error('获取待审批请求列表失败');
    }
    setLoadingRequests(false);
  };

  // 审批请求
  const handleCheckRequest = async (requestId: number, status: number) => {
    try {
      await teamService.checkTeamRequest({ request_id: requestId, status });
      message.success('处理成功');
      fetchPendingRequests(); // 刷新申请列表
      if (selfTeam) {
        const membersResponse = await teamService.getTeamMembers(selfTeam.id);
        setTeamMembers(membersResponse.data);
      }
    } catch (error) {
      message.error('处理失败');
    }
  };

  useEffect(() => {
    fetchSelfTeam();
    fetchTeams();
  }, [currentPage, pageSize]);

  useEffect(() => {
    if (selfTeam) {
      fetchPendingRequests();
    }
  }, [selfTeam]);

  const columns = [
    {
      title: '团队名称',
      dataIndex: 'team_name',
      key: 'team_name',
    },
    {
      title: '团队描述',
      dataIndex: 'team_description',
      key: 'team_description',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Team) => (
        <Button type="primary" onClick={() => handleJoinOrLeaveTeam(record.id,0)} loading={joinLoading}>
          申请加入
        </Button>
      ),
    },
  ];

  const memberColumns = [
    {
        title: '用户名',
        dataIndex: 'user_name',
        key: 'user_name'
    },
    {
        title: '用户邮箱',
        dataIndex: 'user_email',
        key: 'user_email'
    },
    {
        title: '角色',
        key: 'if_creator',
        render: (_: unknown, record: TeamMember) => (
            <Tag color={record.if_creator ? 'gold' : 'blue'}>
                {record.if_creator ? '创建者' : '成员'}
            </Tag>
        )
    },
    {
        title: '操作',
        key: 'leave',
        render: (_: unknown, record: TeamMember) =>
            !record.if_creator && (
              <Button type="primary" onClick={() => handleJoinOrLeaveTeam(record.id,1)} loading={joinLoading}>
              申请离开
            </Button>
            )
    }
];

  // 定义请求列表的列配置
  const requestColumns = [
    {
      title: 'GitHub ID',
      dataIndex: 'github_id',
      key: 'github_id',
    },
    {
      title: 'GitHub 用户名',
      dataIndex: 'github_name',
      key: 'github_name',
    },
    {
      title: '请求类型',
      dataIndex: 'request_type',
      key: 'request_type',
      render: (type: number) => (
        <Tag color={type === 0 ? 'blue' : 'gold'}>
          {type === 0 ? '请求加入' : '请求离开'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="primary" onClick={() => handleCheckRequest(record.request_id, 1)}>
            批准
          </Button>
          <Button danger onClick={() => handleCheckRequest(record.request_id, 2)}>
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [updateForm] = Form.useForm();
  
  // 更新团队信息
  const handleUpdateTeam = async () => {
    if (selfTeam) {
      updateForm.setFieldsValue({
        team_name: selfTeam.team_name,
        team_description: selfTeam.team_description
      });
      setIsUpdateModalVisible(true);
    }
  };
  
  const handleUpdateSubmit = async (values: { team_name: string; team_description: string }) => {
    if (selfTeam) {
      try {
        const { id } = selfTeam;
        const response = await teamService.updateTeam({ id, ...values });
        if (response.code === 200) {
          message.success('更新成功');
          setIsUpdateModalVisible(false);
          fetchSelfTeam(); // 刷新团队信息
        } else {
          message.error('更新失败');
        }
      } catch (error) {
        message.error('更新失败');
      }
    }
  };
  
  // 新增一个处理注销团队的函数
  const handleDeleteTeam = async () => {
    if (selfTeam) {
      try {
        const response = await teamService.deleteTeam(selfTeam.id);
        if (response.code === 200) {
          message.success('删除成功');
          setSelfTeam(null);
          setTeamMembers([]);
        } else {
          message.error('删除失败');
        }
      } catch (error) {
        message.error('删除失败');
      }
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 用户自己的团队信息 */}
      {selfTeam ? (
        <Card title="我的团队" style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <Title level={4}>{selfTeam.team_name}</Title>
            <Text>{selfTeam.team_description}</Text>
          </div>
          <Table
            columns={memberColumns}
            dataSource={teamMembers}
            rowKey="user_id"
            pagination={false}
          />
          {/* 新增更新团队信息和注销团队按钮 */}
          <Space style={{ marginTop: '16px' }}>
            <Button type="primary" onClick={handleUpdateTeam}>
              更新团队信息
            </Button>
            {/* 修改 onClick 属性 */}
            <Button danger onClick={handleDeleteTeam}>
              注销团队
            </Button>
          </Space>
        </Card>
      ) : (
        <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
          <RocketOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '24px' }} />
          <Title level={3}>请加入/创建团队</Title>
        </Card>
      )}

      {/* 团队查询 */}
      <Card title="团队查询">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Tabs defaultActiveKey="name" onChange={(key) => setSearchType(key as 'name' | 'id')}>
              <TabPane tab="按团队名搜索" key="name" />
              <TabPane tab="按团队编号搜索" key="id" />
            </Tabs>
            {!selfTeam && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)}>
                创建团队
              </Button>
            )}
          </Space>
          <Search
            placeholder={`请输入${searchType === 'name' ? '团队名' : '团队编号'}`}
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
            }}
            onSearch={() => {
              setCurrentPage(1);
              fetchTeams();
            }}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={teams}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            onChange: (page, pageSize) => {
              setCurrentPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      {/* 创建团队弹窗 */}
      <Modal
        title="创建团队"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          onFinish={handleCreateTeam}
          layout="vertical"
        >
          <Form.Item
            name="team_name"
            label="团队名称"
            rules={[{ required: true, message: '请输入团队名称' }]}
          >
            <Input placeholder="请输入团队名称" />
          </Form.Item>
          <Form.Item
            name="team_description"
            label="团队描述"
          >
            <TextArea rows={4} placeholder="请输入团队描述" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建团队
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 更新团队信息弹窗 */}
      <Modal
        title="更新团队信息"
        open={isUpdateModalVisible}
        onCancel={() => {
          setIsUpdateModalVisible(false);
          fetchSelfTeam(); // 窗口关闭后刷新页面
        }}
        onOk={() => updateForm.submit()}
      >
        <Form
          form={updateForm}
          onFinish={handleUpdateSubmit}
          layout="vertical"
        >
          <Form.Item
            name="team_name"
            label="团队名称"
            rules={[{ required: true, message: '请输入团队名称' }]}
          >
            <Input placeholder="请输入团队名称" />
          </Form.Item>
          <Form.Item
            name="team_description"
            label="团队描述"
          >
            <TextArea rows={4} placeholder="请输入团队描述" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              更新
            </Button>
          </Form.Item>
        </Form>
      </Modal>
     
      {/* 待审批请求模块 */}
      {showRequestCard && (
        <Card 
          title="待审批请求"
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchPendingRequests}
              loading={loadingRequests}
            >
              刷新
            </Button>
          }
        >
          <Table
            columns={requestColumns}
            dataSource={pendingRequests}
            rowKey="request_id"
            loading={loadingRequests}
          />
        </Card>
      )}
    </div>
  );
};

export default TeamPage;