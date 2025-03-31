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
  server: string;
  username: string;
  password: string;
  comment: string;
  is_default: boolean;
  is_login: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DockerAccountRequest {
  id?: number;
  username: string;
  password: string;
  registry: string;
  description?: string;
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

export default api; 