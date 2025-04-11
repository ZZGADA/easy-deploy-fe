import axios from 'axios';
import Cookies from 'js-cookie';

// 统一的 401 错误处理函数
const handle401Error = () => {
  // 清除所有认证信息
  Cookies.remove('token');
  localStorage.removeItem('token');
  
  // 清除所有 axios 实例的默认 headers
  delete api.defaults.headers.common['Authorization'];
  delete githubApi.defaults.headers.common['Authorization'];
  
  // 重定向到登录页面
  window.location.href = '/easy-deploy/login';
};

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// GitHub API 实例
export const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    'Accept': 'application/vnd.github.v3+json'
  }
});

// 为 api 实例添加响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handle401Error();
    }
    return Promise.reject(error);
  }
);

// 为 githubApi 实例添加响应拦截器
githubApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handle401Error();
    }
    return Promise.reject(error);
  }
);

export interface RegisterData {
  email: string;
  password: string;
}

export interface CompleteRegistrationData extends RegisterData {
  code: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
}

export const authService = {
  register: async (data: RegisterData) => {
    const response = await api.post('/api/auth/sign_up', data);
    return response.data;
  },

  completeRegistration: async (data: CompleteRegistrationData) => {
    const response = await api.post('/api/auth/sign_up/verify', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<LoginResponse> => {
    try {
      const response = await api.post('/api/auth/login', data);
      console.log('API response:', response.data); // 添加日志
      if (response.data && response.data.token) {
        // 将token存储在cookie中，24小时后过期
        Cookies.set('token', response.data.token, { expires: 1 });
        // 同时存储在localStorage中
        localStorage.setItem('token', response.data.token);
        // 设置axios默认header
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      return response.data;
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  },

  logout: () => {
    // 删除token
    Cookies.remove('token');
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  },

  isAuthenticated: () => {
    return !!Cookies.get('token') || !!localStorage.getItem('token');
  }
};

// GitHub 用户信息接口
export interface GithubUserInfo {
  bound: boolean;
  avatar_url?: string;
  email?: string;
  github_id?: number;
  id?: number;
  name?: string;
}

// GitHub 开发者令牌相关接口
export interface DeveloperTokenRequest {
  developer_token: string;
  expire_time: string;
  comment: string;
  repository_name: string;
}

export interface DeveloperTokenResponse {
  developer_token: string;
  developer_token_comment: string;
  developer_token_expire_time: string;
  developer_repository_name: string;
}

// GitHub 绑定相关接口
export const githubService = {
  // 获取 GitHub OAuth URL
  getOAuthUrl: () => {
    const clientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
    const token = localStorage.getItem('token');
    const frontendRedirectUrl = 'http://localhost:3000/easy-deploy/profile';
    const backendCallbackUrl = `${process.env.REACT_APP_API_BASE_URL}/api/user/github/bind/callback`;
    
    // 构建后端回调 URL，包含前端重定向地址和用户 token
    const callbackUrl = encodeURIComponent(
      `${backendCallbackUrl}?redirect_url=${encodeURIComponent(frontendRedirectUrl)}&token=${token}`
    );
    
    const scope = 'repo';
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUrl}&scope=${scope}`;
  },

  // 检查用户是否已绑定 GitHub
  checkGithubBinding: async (): Promise<{ code: number; data: GithubUserInfo }> => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/github/status', {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data; // 返回后端的响应数据，而不是整个 axios 响应对象
  },

  // 解绑 GitHub 账号
  unbindGithub: async () => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/github/unbind', null, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 保存开发者令牌
  saveDeveloperToken: async (data: DeveloperTokenRequest) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/github/developer/token/save', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 更新开发者令牌
  updateDeveloperToken: async (data: DeveloperTokenRequest) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/github/developer/token/update', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 查询开发者令牌
  queryDeveloperToken: async () => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/github/developer/token/query', {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },
};

// Dockerfile 相关接口
export interface DockerfileItem {
  index: number;
  dockerfile_key: string;
  shell_value: string;
}

export interface DockerfileData {
  id?: number;
  repository_name: string;
  repository_id: string;
  branch_name: string;
  file_name: string;
  file_data: DockerfileItem[];
}

interface QueryDockerfileParams {
  repository_id: string;
  branch_name: string;
}

export const dockerfileService = {
  uploadDockerfile: async (data: DockerfileData) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/dockerfile/repository/upload', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  queryDockerfile: async (params: QueryDockerfileParams) => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/dockerfile/repository/query', {
      params,
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  updateDockerfile: async (data: DockerfileData) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/dockerfile/repository/update', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  deleteDockerfile: async (dockerFileID: number) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/dockerfile/repository/delete', 
      { id: dockerFileID},
      {
        headers: {
          'Authorization': `${token}`
        }
      }
    );
    return response.data;
  }
};

// Docker账号相关接口
export interface DockerAccount {
  id: number;
  user_id: number;
  username: string;
  password: string;
  server: string;
  namespace: string;
  comment: string;
  is_default: boolean;
  is_login: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DockerAccountRequest {
  id?: number;
  server: string;
  username: string;
  password: string;
  registry: string;
  namespace: string;
  comment: string;
}

export const dockerAccountService = {
  // 保存Docker账号
  saveDockerAccount: async (data: DockerAccountRequest) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/docker/info/save', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 更新Docker账号
  updateDockerAccount: async (data: DockerAccountRequest) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/docker/info/update', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 删除Docker账号
  deleteDockerAccount: async (id: number) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/docker/info/delete', { id }, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 查询Docker账号列表
  queryDockerAccounts: async () => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/docker/info/query', {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 设置默认Docker账号
  setDefaultAccount: async (dockerAccountId: number) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/docker/info/setDefault', 
      { docker_account_id: dockerAccountId },
      {
        headers: {
          'Authorization': `${token}`
        }
      }
    );
    return response.data;
  },

  // 登录Docker账号
  loginDockerAccount: async (id: number) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/docker/login', { id }, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 查询已登录的Docker账号
  queryLoginAccount: async () => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/docker/info/login/query', {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },
};

// Docker 镜像相关接口
export interface DockerImage {
  id: number;
  user_id: number;
  dockerfile_id: number;
  full_image_name: string;
  image_name: string;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

export interface DockerImageQueryParams {
  dockerfile_id?: number;
  repository_id?: string;
}

export const dockerImageService = {
  // 查询 Docker 镜像列表
  queryDockerImages: async (params: DockerImageQueryParams) => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/docker/images/query', {
      params,
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  }
};

export interface K8sResource {
  id: number;
  repository_id: string;
  resource_type: string;
  oss_url: string;
  file_name: string;
  created_at: string;
  updated_at: string;
}

export interface K8sResourceService {
  saveResource: (data: {
    repository_id: string;
    resource_type: string;
    oss_url: string;
    file_name: string;
  }) => Promise<K8sResource>;
  queryResources: (params: {
    repository_id: string;
    resource_type: string;
  }) => Promise<ApiResponse<K8sResource[]>>;
  deleteResource: (data: { id: number }) => Promise<ApiResponse<any>>;
  updateResource: (data: {
    id: number;
    repository_id: string;
    resource_type: string;
    oss_url: string;
    file_name: string;
  }) => Promise<K8sResource>;
}

export const k8sResourceService: K8sResourceService = {
  saveResource: (data) => {
    const token = localStorage.getItem('token');
    return api.post('/api/user/k8s/resource/save', data, {
      headers: {
        'Authorization': `${token}`
      }
    }).then(response => response.data);
  },
  queryResources: (params) => {
    const token = localStorage.getItem('token');
    return api.get('/api/user/k8s/resource/query', {
      params,
      headers: {
        'Authorization': `${token}`
      }
    }).then(response => response.data);
  },
  deleteResource: (data) => {
    const token = localStorage.getItem('token');
    return api.post('/api/user/k8s/resource/delete', data, {
      headers: {
        'Authorization': `${token}`
      }
    }).then(response => response.data);
  },
  updateResource: (data) => {
    const token = localStorage.getItem('token');
    return api.post('/api/user/k8s/resource/update', data, {
      headers: {
        'Authorization': `${token}`
      }
    }).then(response => response.data);
  }
};

export default api;

// OSS 账号相关类型定义
export interface OssAccount {
  id: number;
  user_id: number;
  access_key_id: string;
  access_key_secret: string;
  bucket: string;
  region: string;
  created_at?: string;
  updated_at?: string;
}

export interface OssAccountRequest {
  access_key_id: string;
  access_key_secret: string;
  bucket: string;
  region: string;
}

// OSS 账号服务
export const ossAccountService = {
  // 保存 OSS 账号
  saveOssAccount: async (data: OssAccountRequest): Promise<ApiResponse<null>> => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/oss/access/save', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 更新 OSS 账号
  updateOssAccount: async (data: OssAccountRequest): Promise<ApiResponse<null>> => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/oss/access/update', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 查询 OSS 账号
  queryOssAccount: async (): Promise<ApiResponse<OssAccount>> => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/oss/access/query', {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 删除 OSS 账号
  deleteOssAccount: async (): Promise<ApiResponse<null>> => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/user/oss/access/delete', {}, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },
};

// K8s 资源操作记录接口
export interface K8sResourceOperationLog {
  id: number;
  k8s_resource_id: number;
  user_id: number;
  namespace: string;
  metadata_name: string;
  metadata_labels: string;
  operation_type: string;
  status: number;
  command: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface K8sResourceOperationLogResponse {
  code: number;
  message: string;
  logs: K8sResourceOperationLog[];
  total: number;
  page: number;
  page_size: number;
}

export const k8sResourceOperationLogService = {
  // 查询 K8s 资源操作日志
  queryOperationLogs: async (k8sResourceId: number, page: number = 1, pageSize: number = 5): Promise<K8sResourceOperationLogResponse> => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/user/k8s/resource/operation/log/query', {
      params: { 
        k8s_resource_id: k8sResourceId,
        page: page,
        page_size: pageSize
      },
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  }
};

// 团队相关接口
export interface Team {
  id: number;
  team_name: string;
  team_description: string;
  team_uuid: string;
  creator_id: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: number;
  user_id: number;
  user_email: string;
  if_creator: boolean;
}

export interface TeamListResponse {
  code: number;
  message: string;
  data: {
    teams: Team[];
    total: number;
  };
}

export interface TeamRequest {
  team_id: number;
  request_type: 0 | 1;
}

export interface CreateTeamRequest {
  team_name: string;
  team_description: string;
}

export const teamService = {
  // 获取用户自己的团队信息
  getSelfTeam: async (): Promise<{ code: number; message: string; data: Team }> => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/team/info/self', {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 获取团队成员列表
  getTeamMembers: async (teamId: number): Promise<{ code: number; message: string; data: TeamMember[] }> => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/team/info/member', {
      params: {
        team_id: teamId
      },
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 查询团队列表
  queryTeams: async (page: number = 1, pageSize: number = 10, teamName?: string, teamUuid?: string): Promise<TeamListResponse> => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/team/list', {
      params: {
        page,
        page_size: pageSize,
        ...(teamName && { team_name: teamName }),
        ...(teamUuid && { team_uuid: teamUuid })
      },
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 创建团队申请
  createTeamRequest: async (data: TeamRequest): Promise<{ code: number; message: string; data: any }> => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/team/request/create', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 创建团队
  createTeam: async (data: CreateTeamRequest): Promise<{ code: number; message: string; data: Team }> => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/team/create', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },


  updateTeam: async (data: { id: number; team_name: string; team_description?: string }) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/team/update', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },
  // 新增删除团队接口
  deleteTeam: async (teamId: number) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/team/delete', { team_id: teamId }, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

   // 新增获取待审批请求列表接口
   getTeamRequests: async (teamId: number) => {
    const token = localStorage.getItem('token');
    const response = await api.get('/api/team/request/list', {
      params: {
        team_id: teamId
      },
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  },

  // 新增审批请求接口
  checkTeamRequest: async (data: { request_id: number; status: number }) => {
    const token = localStorage.getItem('token');
    const response = await api.post('/api/team/request/check', data, {
      headers: {
        'Authorization': `${token}`
      }
    });
    return response.data;
  }
}; 