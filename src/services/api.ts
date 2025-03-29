import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// GitHub 绑定相关接口
export const githubService = {
  // 获取 GitHub OAuth URL
  getOAuthUrl: () => {
    const clientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
    const token = localStorage.getItem('token'); // 获取用户 token
    const redirectUri = encodeURIComponent(`${process.env.REACT_APP_API_BASE_URL}/bind/github/callback?token=${token}`);
    const scope = 'repo';
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  },

  // 检查用户是否已绑定 GitHub
  checkGithubBinding: () => {
    return api.get('/api/user/github/status');
  },

  // 解绑 GitHub 账号
  unbindGithub: () => {
    return api.post('/api/user/github/unbind');
  },
};

export default api; 