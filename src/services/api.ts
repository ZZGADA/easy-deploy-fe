import axios from 'axios';

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

export const authService = {
  register: (data: RegisterData) => {
    console.log('register', data);
    return api.post('/api/auth/sign_up', data);
  },

  completeRegistration: (data: CompleteRegistrationData) => {
    return api.post('/api/auth/sign_up/verify', data);
  },

  login: (data: LoginData) => {
    return api.post('/api/auth/login', data);
  },
};

export default api; 