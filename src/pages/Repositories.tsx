import React, { useEffect, useState } from 'react';
import { List, Typography, Card, Space, Tag, Spin, message } from 'antd';
import { GithubOutlined, BranchesOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface Repository {
  name: string;
  description: string;
  default_branch: string;
  updated_at: string;
  branches_url: string;
  html_url: string;
}

interface Branch {
  name: string;
  commit: {
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        email: string;
        date: string;
      };
      committer: {
        name: string;
        email: string;
        date: string;
      };
    };
  };
}

const Repositories: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  const ORGANIZATION = 'ZZGADA';

  const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      'Authorization': `token ${process.env.REACT_APP_GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      fetchBranches(selectedRepo.name);
    }
  }, [selectedRepo]);

  const fetchRepositories = async () => {
    try {
      const response = await githubApi.get(`/users/${ORGANIZATION}/repos`);
      setRepositories(response.data);
    } catch (error: any) {
      console.error('Error fetching repositories:', error);
      message.error('获取仓库列表失败：' + (error.response?.data?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async (repoName: string) => {
    setBranchLoading(true);
    try {
      // 首先获取分支列表
      const branchesResponse = await githubApi.get(`/repos/${ORGANIZATION}/${repoName}/branches`);
      const branchesData = branchesResponse.data;

      // 获取每个分支的最新提交信息
      const branchesWithCommits = await Promise.all(
        branchesData.map(async (branch: any) => {
          try {
            const commitResponse = await githubApi.get(
              `/repos/${ORGANIZATION}/${repoName}/commits/${branch.commit.sha}`
            );
            return {
              ...branch,
              commit: {
                ...branch.commit,
                commit: commitResponse.data.commit
              }
            };
          } catch (error) {
            console.error(`Error fetching commit for branch ${branch.name}:`, error);
            return branch;
          }
        })
      );

      setBranches(branchesWithCommits);
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      message.error('获取分支列表失败：' + (error.response?.data?.message || '未知错误'));
      setBranches([]);
    } finally {
      setBranchLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2}>代码仓库管理</Title>
      <List
        grid={{ gutter: 16, column: 1 }}
        dataSource={repositories}
        renderItem={(repo) => (
          <List.Item>
            <Card
              hoverable
              onClick={() => setSelectedRepo(repo)}
              style={{ cursor: 'pointer' }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  <GithubOutlined />
                  <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                    {repo.name}
                  </a>
                </Space>
                <Typography.Text type="secondary">{repo.description}</Typography.Text>
                <Space>
                  <Tag icon={<BranchesOutlined />}>{repo.default_branch}</Tag>
                  <Tag icon={<ClockCircleOutlined />}>
                    最后更新: {formatDate(repo.updated_at)}
                  </Tag>
                </Space>
                {selectedRepo?.name === repo.name && (
                  <div style={{ marginTop: '16px' }}>
                    <Title level={4}>分支列表</Title>
                    {branchLoading ? (
                      <Spin />
                    ) : (
                      <List
                        size="small"
                        dataSource={branches}
                        renderItem={(branch) => (
                          <List.Item>
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <Space>
                                <BranchesOutlined />
                                <Typography.Text strong>{branch.name}</Typography.Text>
                              </Space>
                              {branch.commit?.commit?.message && (
                                <Typography.Text type="secondary" style={{ display: 'block' }}>
                                  提交信息: {branch.commit.commit.message}
                                </Typography.Text>
                              )}
                              <Space>
                                {branch.commit?.commit?.author?.name && (
                                  <Space>
                                    <UserOutlined />
                                    <Typography.Text type="secondary">
                                      作者: {branch.commit.commit.author.name}
                                    </Typography.Text>
                                  </Space>
                                )}
                                {branch.commit?.commit?.author?.date && (
                                  <Space>
                                    <ClockCircleOutlined />
                                    <Typography.Text type="secondary">
                                      提交时间: {formatDate(branch.commit.commit.author.date)}
                                    </Typography.Text>
                                  </Space>
                                )}
                              </Space>
                            </Space>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                )}
              </Space>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default Repositories; 