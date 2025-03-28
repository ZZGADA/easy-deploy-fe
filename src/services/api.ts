import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = 'http://localhost:18081'; // 根据实际后端地址修改

const api = axios.create({
  baseURL: API_BASE_URL,
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

export default api; 