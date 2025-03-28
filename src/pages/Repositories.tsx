import React, { useEffect, useState } from 'react';
import { List, Typography, Card, Space, Tag, Spin, message, Tree, Row, Col } from 'antd';
import { GithubOutlined, BranchesOutlined, ClockCircleOutlined, UserOutlined, FolderOutlined, FileOutlined } from '@ant-design/icons';
import axios from 'axios';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

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
  type: 'markdown' | 'code' | 'image';
  language?: string;
  raw_url?: string;
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
  const [fileContentLoading, setFileContentLoading] = useState(false);

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
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'svg': 'image',
      'webp': 'image',
      'bmp': 'image',
      'ico': 'image'
    };
    return languageMap[extension] || 'text';
  };

  const fetchFileContent = async (path: string) => {
    if (!selectedRepo) return;
    
    setFileContentLoading(true);
    try {
      const response = await githubApi.get(
        `/repos/${USERS}/${selectedRepo.name}/contents/${path}`
      );
      
      const fileType = getFileLanguage(path);
      
      if (fileType === 'image') {
        setFileContent({
          content: '',
          type: 'image',
          raw_url: response.data.download_url
        });
      } else {
        const content = decodeURIComponent(escape(atob(response.data.content)));
        const isMarkdown = path.toLowerCase().endsWith('.md');
        
        setFileContent({
          content,
          type: isMarkdown ? 'markdown' : 'code',
          language: fileType
        });
      }
    } catch (error) {
      console.error('Error fetching file content:', error);
      message.error('获取文件内容失败');
    } finally {
      setFileContentLoading(false);
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
      
      if (commitResponse.data && commitResponse.data.length > 0) {
        const lastCommit = commitResponse.data[0];
        const commitInfo = {
          message: lastCommit.commit.message,
          date: lastCommit.commit.author.date,
          author: lastCommit.commit.author.name
        };

        // 更新文件树中的提交信息
        const updateFileTreeWithCommit = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === info.node.path) {
              return { ...node, lastCommit: commitInfo };
            }
            if (node.children && node.children.length > 0) {
              return { ...node, children: updateFileTreeWithCommit(node.children) };
            }
            return node;
          });
        };

        const updatedTree = updateFileTreeWithCommit([...fileTree]);
        setFileTree(updatedTree);

        // 直接更新当前选中文件的提交信息
        const currentNode = info.node;
        currentNode.lastCommit = commitInfo;
      }
    } catch (error) {
      console.error('Error fetching file commit:', error);
      message.error('获取文件提交信息失败');
    }
  };

  const findFileNode = (path: string, nodes: FileNode[]): FileNode | undefined => {
    for (const node of nodes) {
      if (node.path === path) {
        return node;
      }
      if (node.children && node.children.length > 0) {
        const found = findFileNode(path, node.children);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderFileContent = () => {
    if (fileContent.type === 'image') {
      return (
        <div style={{ 
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <img 
            src={fileContent.raw_url}
            alt={selectedFile}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 400px)',
              objectFit: 'contain'
            }}
          />
        </div>
      );
    }

    if (fileContent.type === 'markdown') {
      // 处理图片 URL
      const processImageUrl = (url: string) => {
        if (url.startsWith('http')) {
          return url;
        }
        
        // 处理相对路径的图片
        if (url.startsWith('./')) {
          url = url.substring(2);
        }
        if (url.startsWith('/')) {
          url = url.substring(1);
        }
        
        // 获取当前文件所在目录
        const currentDir = selectedFile.split('/').slice(0, -1).join('/');
        const imagePath = currentDir ? `${currentDir}/${url}` : url;
        
        return `https://raw.githubusercontent.com/${USERS}/${selectedRepo?.name}/${selectedRepo?.default_branch}/${imagePath}`;
      };

      return (
        <div style={{ padding: '20px' }}>
          <MarkdownPreview 
            source={fileContent.content}
            style={{
              backgroundColor: 'transparent',
              fontSize: '14px'
            }}
            wrapperElement={{
              "data-color-mode": "light"
            }}
            components={{
              table: props => (
                <table
                  {...props}
                  style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    margin: '16px 0',
                    border: '1px solid #e8e8e8'
                  }}
                />
              ),
              th: props => (
                <th
                  {...props}
                  style={{
                    backgroundColor: '#fafafa',
                    border: '1px solid #e8e8e8',
                    padding: '8px 16px'
                  }}
                />
              ),
              td: props => (
                <td
                  {...props}
                  style={{
                    border: '1px solid #e8e8e8',
                    padding: '8px 16px'
                  }}
                />
              ),
              img: ({ src, alt, ...props }) => (
                <img
                  src={processImageUrl(src || '')}
                  alt={alt}
                  style={{
                    maxWidth: '100%',
                    height: 'auto'
                  }}
                  {...props}
                />
              )
            }}
          />
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
            
            <Col span={24}>
              <PanelGroup direction="horizontal" style={{ height: 'calc(100vh - 150px)' }}>
                <Panel defaultSize={40} minSize={30}>
                  <div style={{ 
                    height: '100%',
                    padding: '16px',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    <Title level={5} style={{ flex: 'none' }}>项目目录结构</Title>
                    {fileTreeLoading ? (
                      <Spin />
                    ) : (
                      <div style={{
                        flex: 1,
                        overflow: 'auto',
                        marginTop: '16px',
                        paddingRight: '4px'
                      }}>
                        <DirectoryTree
                          treeData={fileTree}
                          onSelect={handleFileSelect}
                          height={window.innerHeight - 250}
                          style={{
                            overflow: 'overlay'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </Panel>

                <PanelResizeHandle style={{ 
                  width: '8px', 
                  background: '#f0f0f0',
                  cursor: 'col-resize',
                  margin: '0 -1px',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '2px',
                    height: '20px',
                    background: '#d9d9d9'
                  }} />
                </PanelResizeHandle>

                <Panel defaultSize={60} minSize={30}>
                  <div style={{ 
                    height: '100%', 
                    padding: '0 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    <Card 
                      title={
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Title level={5} style={{ margin: 0 }}>文件内容</Title>
                          {selectedFile && (
                            <Tag 
                              color="blue" 
                              style={{ 
                                padding: '4px 8px',
                                marginTop: '8px',
                                width: 'fit-content'
                              }}
                            >
                              {selectedFile}
                            </Tag>
                          )}
                        </Space>
                      }
                      style={{ 
                        flex: 1,
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                      }}
                      bodyStyle={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '24px 24px 0'
                      }}
                    >
                      {fileContentLoading ? (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          alignItems: 'center',
                          height: '100%'
                        }}>
                          <Spin tip="加载文件内容..." />
                        </div>
                      ) : (
                        <div style={{ height: '100%', overflow: 'auto' }}>
                          {renderFileContent()}
                        </div>
                      )}
                    </Card>
                    
                    {selectedFile && (
                      <Card
                        title={
                          <Space>
                            <Text strong>文件信息</Text>
                            <Tag icon={<UserOutlined />} color="blue">
                              {findFileNode(selectedFile, fileTree)?.lastCommit?.author || '未知作者'}
                            </Tag>
                          </Space>
                        }
                        style={{
                          marginBottom: '16px'
                        }}
                      >
                        {findFileNode(selectedFile, fileTree)?.lastCommit ? (
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <div>
                              <Text type="secondary">提交注释：</Text>
                              <div style={{ 
                                marginTop: '8px',
                                padding: '8px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {findFileNode(selectedFile, fileTree)?.lastCommit?.message}
                              </div>
                            </div>
                            <div>
                              <Text type="secondary">提交时间：</Text>
                              <div style={{ marginTop: '4px' }}>
                                {formatDate(findFileNode(selectedFile, fileTree)?.lastCommit?.date || '')}
                              </div>
                            </div>
                          </Space>
                        ) : (
                          <Text type="secondary">暂无提交信息</Text>
                        )}
                      </Card>
                    )}
                  </div>
                </Panel>
              </PanelGroup>
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