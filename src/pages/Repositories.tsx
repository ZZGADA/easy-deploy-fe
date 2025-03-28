import React, { useEffect, useState } from 'react';
import { List, Typography, Card, Space, Tag, Spin, message, Tree, Row, Col } from 'antd';
import { GithubOutlined, BranchesOutlined, ClockCircleOutlined, UserOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'github-markdown-css'; // 添加 GitHub 风格的 Markdown 样式

const { Title, Text } = Typography;
const { DirectoryTree } = Tree;

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

interface FileNode {
  title: string;
  key: string;
  isLeaf: boolean;
  children: FileNode[];
  path?: string;
  lastCommit?: {
    message: string;
    date: string;
    author: string;
  };
}

interface FileContent {
  content: string;
  type: 'markdown' | 'code';
  language?: string;
}

const Repositories: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<FileContent>({
    content: '',
    type: 'markdown'
  });

  const USERS = 'ZZGADA';

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
      fetchFileTree(selectedRepo.name);
    }
  }, [selectedRepo]);

  const fetchRepositories = async () => {
    try {
      const response = await githubApi.get(`/users/${USERS}/repos`);
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
      const branchesResponse = await githubApi.get(`/repos/${USERS}/${repoName}/branches`);
      const branchesData = branchesResponse.data;

      const branchesWithCommits = await Promise.all(
        branchesData.map(async (branch: any) => {
          try {
            const commitResponse = await githubApi.get(
              `/repos/${USERS}/${repoName}/commits/${branch.commit.sha}`
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

  const fetchFileTree = async (repoName: string) => {
    setFileTreeLoading(true);
    try {
      // 获取默认分支
      const repoResponse = await githubApi.get(`/repos/${USERS}/${repoName}`);
      const defaultBranch = repoResponse.data.default_branch;

      // 使用 recursive 参数一次性获取所有文件
      const response = await githubApi.get(
        `/repos/${USERS}/${repoName}/git/trees/${defaultBranch}`,
        { params: { recursive: 1 } }
      );

      if (response.data.truncated) {
        message.warning('仓库文件过多，可能无法显示全部文件');
      }

      const files = response.data.tree;
      
      // 构建文件树结构
      const buildFileTree = (files: any[]): FileNode[] => {
        const root: { [key: string]: FileNode } = {};
        
        // 首先创建所有节点
        files.forEach(file => {
          const parts = file.path.split('/');
          let currentPath = '';
          
          parts.forEach((part: string, index: number) => {
            const path = index === 0 ? part : `${currentPath}/${part}`;
            currentPath = path;
            
            if (!root[path]) {
              root[path] = {
                title: part,
                key: path,
                isLeaf: file.type === 'blob' && index === parts.length - 1,
                children: [],
                path: path,
                lastCommit: undefined
              };
            }
          });
        });
        
        // 构建树形结构
        Object.keys(root).forEach(path => {
          const parts = path.split('/');
          if (parts.length > 1) {
            const parentPath = parts.slice(0, -1).join('/');
            if (root[parentPath]) {
              root[parentPath].children.push(root[path]);
            }
          }
        });
        
        // 返回顶层节点
        return Object.values(root).filter(node => !node.path?.includes('/'));
      };

      const tree = buildFileTree(files);
      setFileTree(tree);

      // 加载 README.md
      await loadReadme(files);

    } catch (error: any) {
      console.error('Error fetching file tree:', error);
      message.error('获取文件列表失败：' + (error.response?.data?.message || '未知错误'));
    } finally {
      setFileTreeLoading(false);
    }
  };

  const loadReadme = async (files: any[]) => {
    const readmeFile = files.find((file: any) => 
      file.path.toLowerCase() === 'readme.md'
    );

    if (readmeFile) {
      await fetchFileContent('README.md');
    } else {
      setFileContent({
        content: 'No README.md found in this repository.',
        type: 'markdown'
      });
    }
  };

  const fetchFileCommit = async (path: string) => {
    if (!selectedRepo) return;
    
    try {
      const response = await githubApi.get(
        `/repos/${USERS}/${selectedRepo.name}/commits`,
        { params: { path } }
      );
      
      const lastCommit = response.data[0];
      return {
        message: lastCommit.commit.message,
        date: lastCommit.commit.author.date,
        author: lastCommit.commit.author.name
      };
    } catch (error) {
      console.error('Error fetching file commit:', error);
      return null;
    }
  };

  const getFileLanguage = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sh': 'bash',
      'bash': 'bash',
      'xml': 'xml',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'dart': 'dart',
    };
    return languageMap[extension] || 'text';
  };

  const fetchFileContent = async (path: string) => {
    if (!selectedRepo) return;
    
    try {
      const response = await githubApi.get(
        `/repos/${USERS}/${selectedRepo.name}/contents/${path}`
      );
      
      const content = decodeURIComponent(escape(atob(response.data.content)));
      const isMarkdown = path.toLowerCase().endsWith('.md');
      
      setFileContent({
        content,
        type: isMarkdown ? 'markdown' : 'code',
        language: getFileLanguage(path)
      });
    } catch (error) {
      console.error('Error fetching file content:', error);
      message.error('获取文件内容失败');
    }
  };

  const handleFileSelect = async (selectedKeys: React.Key[], info: any) => {
    if (!info.node.isLeaf || !info.node.path) return;
    
    setSelectedFile(info.node.path);
    await fetchFileContent(info.node.path);
    
    // 获取提交信息
    try {
      const commitResponse = await githubApi.get(
        `/repos/${USERS}/${selectedRepo?.name}/commits`,
        { 
          params: { 
            path: info.node.path,
            per_page: 1
          }
        }
      );
      
      const lastCommit = commitResponse.data[0];
      info.node.lastCommit = {
        message: lastCommit.commit.message,
        date: lastCommit.commit.author.date,
        author: lastCommit.commit.author.name
      };
      
      setFileTree([...fileTree]);
    } catch (error) {
      console.error('Error fetching file commit:', error);
      message.error('获取文件提交信息失败');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderFileContent = () => {
    if (fileContent.type === 'markdown') {
      return (
        <div className="markdown-body">
          <ReactMarkdown>{fileContent.content}</ReactMarkdown>
        </div>
      );
    }

    return (
      <SyntaxHighlighter
        language={fileContent.language}
        style={vscDarkPlus}
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: '4px',
          fontSize: '14px'
        }}
      >
        {fileContent.content}
      </SyntaxHighlighter>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Row style={{ height: '100vh' }}>
      <Col 
        span={5} 
        style={{ 
          borderRight: '1px solid #f0f0f0', 
          padding: '16px',
          height: '100%',
          overflowY: 'auto'
        }}
      >
        <Title level={4}>代码仓库列表</Title>
        <List
          size="small"
          dataSource={repositories}
          style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}
          renderItem={(repo) => (
            <List.Item>
              <Card
                hoverable
                onClick={() => setSelectedRepo(repo)}
                style={{ 
                  cursor: 'pointer',
                  width: '100%',
                  backgroundColor: selectedRepo?.name === repo.name ? '#f0f0f0' : 'white'
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
      </Col>
      
      <Col span={19} style={{ padding: '16px', height: '100vh', overflowY: 'auto' }}>
        {selectedRepo ? (
          <Row>
            <Col span={24} style={{ marginBottom: '16px' }}>
              <Title level={4}>{selectedRepo.name}</Title>
              <Space>
                <Tag icon={<BranchesOutlined />}>{selectedRepo.default_branch}</Tag>
                <Tag icon={<ClockCircleOutlined />}>
                  最后更新: {formatDate(selectedRepo.updated_at)}
                </Tag>
              </Space>
            </Col>
            
            <Col span={12} style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
              <Title level={5}>项目目录结构</Title>
              {fileTreeLoading ? (
                <Spin />
              ) : (
                <DirectoryTree
                  treeData={fileTree}
                  onSelect={handleFileSelect}
                />
              )}
            </Col>
            
            <Col span={12} style={{ padding: '0 16px' }}>
              <Title level={5}>{selectedFile || 'README.md'}</Title>
              <Card 
                style={{ 
                  marginTop: '16px',
                  maxHeight: 'calc(100vh - 250px)',
                  overflowY: 'auto'
                }}
              >
                {renderFileContent()}
              </Card>
              
              {selectedFile && (
                <div style={{ marginTop: '16px' }}>
                  <Title level={5}>文件信息</Title>
                  <Card>
                    <Space direction="vertical">
                      <Text strong>路径: {selectedFile}</Text>
                      {fileTree.find(f => f.path === selectedFile)?.lastCommit && (
                        <>
                          <Text>最后提交信息: {fileTree.find(f => f.path === selectedFile)?.lastCommit?.message}</Text>
                          <Text>提交作者: {fileTree.find(f => f.path === selectedFile)?.lastCommit?.author}</Text>
                          <Text>提交时间: {formatDate(fileTree.find(f => f.path === selectedFile)?.lastCommit?.date || '')}</Text>
                        </>
                      )}
                    </Space>
                  </Card>
                </div>
              )}
            </Col>
          </Row>
        ) : (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Text type="secondary">请选择一个仓库查看详细信息</Text>
          </div>
        )}
      </Col>
    </Row>
  );
};

export default Repositories; 