// frontend/src/services/api.ts
// API 서비스 - 백엔드와 통신하는 모든 API 호출을 관리

import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - 모든 요청에 인증 토큰 추가
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 인증 실패 시 로그아웃 처리
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;