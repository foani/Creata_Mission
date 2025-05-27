/**
 * Layout Component
 * 전체 페이지 레이아웃을 담당하는 메인 레이아웃 컴포넌트
 * 
 * Features:
 * - Header, Navigation, Footer 통합 관리
 * - 페이지별 콘텐츠 영역 관리
 * - 로딩 상태 및 에러 상태 처리
 * - 반응형 디자인 (모바일/데스크톱)
 * - 텔레그램 WebApp 환경 최적화
 * - 네비게이션 상태 관리
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import Header from './Header';
import Navigation, { NavigationTab, NavigationProvider, useNavigation } from './Navigation';
import Footer from './Footer';

// 로딩 스피너 컴포넌트
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-gray-600 text-sm">Loading...</p>
    </div>
  </div>
);

// 에러 화면 컴포넌트
const ErrorScreen: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => {
  const { t } = useTranslation();
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('layout.error.title', 'Something went wrong')}
        </h2>
        <p className="text-gray-600 mb-6">
          {error || t('layout.error.message', 'An unexpected error occurred. Please try again.')}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            {t('layout.error.retry', 'Try Again')}
          </button>
        )}
      </div>
    </div>
  );
};

// 네비게이션 없는 페이지들 (로그인, 에러 페이지 등)
const PAGES_WITHOUT_NAVIGATION: NavigationTab[] = ['login', 'error'];

// 풀스크린 페이지들 (게임 플레이 중 등)
const FULLSCREEN_PAGES: NavigationTab[] = [];

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: NavigationTab;
  showHeader?: boolean;
  showNavigation?: boolean;
  showFooter?: boolean;
  fullscreen?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

const LayoutContent: React.FC<LayoutProps> = ({
  children,
  currentPage = 'home',
  showHeader = true,
  showNavigation = true,
  showFooter = true,
  fullscreen = false,
  loading = false,
  error = null,
  onRetry,
  className = ''
}) => {
  const { t } = useTranslation();
  const { isConnected, isLoading: authLoading } = useAuthStore();
  const { activeTab, handleTabChange } = useNavigation(currentPage);
  
  // 모바일 메뉴 상태 (Header에서 사용)
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // 페이지별 설정 결정
  const shouldShowNavigation = showNavigation && !PAGES_WITHOUT_NAVIGATION.includes(currentPage);
  const isFullscreen = fullscreen || FULLSCREEN_PAGES.includes(currentPage);
  
  // 전체 로딩 상태
  const isPageLoading = loading || authLoading;
  
  // 텔레그램 WebApp 환경 감지 및 설정
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // 텔레그램 WebApp 설정
      tg.ready();
      tg.expand();
      
      // 하드코딩된 테마 색상 설정
      tg.setHeaderColor('#3B82F6'); // blue-600
      tg.setBackgroundColor('#F9FAFB'); // gray-50
      
      // 뒤로가기 버튼 설정
      if (activeTab !== 'home') {
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
          handleTabChange('home');
        });
      } else {
        tg.BackButton.hide();
      }
      
      return () => {
        tg.BackButton.hide();
      };
    }
  }, [activeTab, handleTabChange]);
  
  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // 숫자 키로 탭 전환 (1: home, 2: games, 3: ranking, 4: profile)
      if (event.altKey) {
        switch (event.key) {
          case '1':
            handleTabChange('home');
            break;
          case '2':
            handleTabChange('games');
            break;
          case '3':
            handleTabChange('ranking');
            break;
          case '4':
            handleTabChange('profile');
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleTabChange]);
  
  // 모바일 메뉴 토글
  const handleMobileMenuToggle = () => {
    setShowMobileMenu(!showMobileMenu);
  };
  
  // 에러 재시도
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };
  
  // 로딩 상태 렌더링
  if (isPageLoading) {
    return <LoadingSpinner />;
  }
  
  // 에러 상태 렌더링
  if (error) {
    return <ErrorScreen error={error} onRetry={handleRetry} />;
  }
  
  // 풀스크린 모드 렌더링
  if (isFullscreen) {
    return (
      <div className={`min-h-screen bg-gray-900 ${className}`}>
        {children}
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col ${className}`}>
      {/* Header */}
      {showHeader && (
        <Header 
          onMenuToggle={handleMobileMenuToggle}
          showMenu={showMobileMenu}
        />
      )}
      
      {/* Main Content Area */}
      <main className={`flex-1 ${shouldShowNavigation ? 'pb-16' : ''} ${showHeader ? '' : 'pt-0'}`}>
        <div className="max-w-7xl mx-auto">
          {/* 모바일 메뉴 오버레이 */}
          {showMobileMenu && (
            <>
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                onClick={() => setShowMobileMenu(false)}
              />
              <div className="fixed top-16 left-0 right-0 bg-white shadow-lg z-50 md:hidden">
                <div className="py-4 px-6 space-y-3">
                  <button 
                    onClick={() => {
                      handleTabChange('home');
                      setShowMobileMenu(false);
                    }}
                    className={`block w-full text-left py-2 px-3 rounded-lg ${
                      activeTab === 'home' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t('navigation.home', 'Home')}
                  </button>
                  <button 
                    onClick={() => {
                      handleTabChange('games');
                      setShowMobileMenu(false);
                    }}
                    className={`block w-full text-left py-2 px-3 rounded-lg ${
                      activeTab === 'games' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t('navigation.games', 'Games')}
                  </button>
                  <button 
                    onClick={() => {
                      handleTabChange('ranking');
                      setShowMobileMenu(false);
                    }}
                    className={`block w-full text-left py-2 px-3 rounded-lg ${
                      activeTab === 'ranking' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t('navigation.ranking', 'Ranking')}
                  </button>
                  <button 
                    onClick={() => {
                      handleTabChange('profile');
                      setShowMobileMenu(false);
                    }}
                    className={`block w-full text-left py-2 px-3 rounded-lg ${
                      activeTab === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t('navigation.profile', 'Profile')}
                  </button>
                </div>
              </div>
            </>
          )}
          
          {/* Page Content */}
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation */}
      {shouldShowNavigation && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <Navigation 
            activeTab={activeTab}
            onTabChange={handleTabChange}
            badges={{
              // 예시: 새 알림이 있는 경우
              // profile: 1,
              // games: 'NEW'
            }}
          />
        </div>
      )}
      
      {/* Footer (데스크톱에서만 표시) */}
      {showFooter && !shouldShowNavigation && (
        <Footer />
      )}
      
      {/* iOS Safari에서 하단 안전 영역 확보 */}
      {shouldShowNavigation && (
        <div className="h-4 bg-white" /> 
      )}
    </div>
  );
};

// 메인 Layout 컴포넌트 (NavigationProvider로 감싸서 내보냄)
const Layout: React.FC<LayoutProps> = (props) => {
  return (
    <NavigationProvider initialTab={props.currentPage}>
      <LayoutContent {...props} />
    </NavigationProvider>
  );
};

// Layout과 함께 사용할 수 있는 페이지 wrapper 컴포넌트
interface PageWrapperProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ 
  children, 
  title, 
  description,
  className = '' 
}) => {
  const { t } = useTranslation();
  
  return (
    <div className={`space-y-6 ${className}`}>
      {(title || description) && (
        <div className="text-center">
          {title && (
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-gray-600">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

// 고차 컴포넌트: 페이지를 Layout으로 감싸기
export const withLayout = (
  Component: React.ComponentType<any>,
  layoutOptions: Partial<LayoutProps> = {}
) => {
  const WrappedComponent = (props: any) => (
    <Layout {...layoutOptions} {...props}>
      <Component {...props} />
    </Layout>
  );
  
  WrappedComponent.displayName = `withLayout(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// 텔레그램 WebApp 타입 확장
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
}

export default Layout;