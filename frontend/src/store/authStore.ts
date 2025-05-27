// frontend/src/store/authStore.ts
// Zustand를 사용한 전역 인증 상태 관리

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  walletAddress: string;
  telegramId?: string;
  language: string;
  isWalletVerified: boolean;
  isWalletInstalled: boolean;
  score: number;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,

        // Actions
        setUser: (user) => 
          set({ user, isAuthenticated: true }),

        setToken: (token) => 
          set({ token }),

        login: (user, token) => 
          set({ 
            user, 
            token, 
            isAuthenticated: true,
            isLoading: false 
          }),

        logout: () => 
          set({ 
            user: null, 
            token: null, 
            isAuthenticated: false,
            isLoading: false 
          }),

        updateUser: (updates) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null
          })),

        setLoading: (loading) => 
          set({ isLoading: loading }),
      }),
      {
        name: 'auth-storage', // localStorage에 저장될 키 이름
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }), // 저장할 상태 선택
      }
    )
  )
);