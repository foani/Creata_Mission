/**
 * Navigation Component
 * 탭 기반 네비게이션을 위한 하단 네비게이션 컴포넌트
 * 
 * Features:
 * - 하단 탭 네비게이션 (모바일 친화적)
 * - 홈, 게임, 랭킹, 프로필 메뉴
 * - 활성 탭 하이라이팅
 * - 아이콘 + 라벨 조합
 * - 다국어 지원
 * - 배지 알림 기능 (선택사항)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

// 아이콘 컴포넌트들
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg 
    className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} 
    fill={active ? 'currentColor' : 'none'} 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={active ? 0 : 2} 
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
    />
  </svg>
);

const GameIcon = ({ active }: { active: boolean }) => (
  <svg 
    className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} 
    fill={active ? 'currentColor' : 'none'} 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={active ? 0 : 2} 
      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a1 1 0 01-1-1V9a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V5a1 1 0 011-1h3a1 1 0 001-1V4z" 
    />
  </svg>
);

const RankingIcon = ({ active }: { active: boolean }) => (
  <svg 
    className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} 
    fill={active ? 'currentColor' : 'none'} 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={active ? 0 : 2} 
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
    />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg 
    className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'}`} 
    fill={active ? 'currentColor' : 'none'} 
    stroke="currentColor" 
    viewBox="0 0 24 24"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth={active ? 0 : 2} 
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
    />
  </svg>
);

// 네비게이션 탭 타입 정의
export type NavigationTab = 'home' | 'games' | 'ranking' | 'profile';

interface NavigationItem {
  id: NavigationTab;
  labelKey: string;
  icon: React.ComponentType<{ active: boolean }>;
  badge?: number | string; // 알림 배지 (선택사항)
  disabled?: boolean;
}

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  badges?: Partial<Record<NavigationTab, number | string>>; // 각 탭의 배지 정보
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ 
  activeTab, 
  onTabChange, 
  badges = {},
  className = '' 
}) => {
  const { t } = useTranslation();

  // 네비게이션 메뉴 아이템 정의
  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      labelKey: 'navigation.home',
      icon: HomeIcon,
      badge: badges.home
    },
    {
      id: 'games',
      labelKey: 'navigation.games',
      icon: GameIcon,
      badge: badges.games
    },
    {
      id: 'ranking',
      labelKey: 'navigation.ranking',
      icon: RankingIcon,
      badge: badges.ranking
    },
    {
      id: 'profile',
      labelKey: 'navigation.profile',
      icon: ProfileIcon,
      badge: badges.profile
    }
  ];

  // 탭 클릭 핸들러
  const handleTabClick = (tabId: NavigationTab) => {
    if (activeTab !== tabId) {
      onTabChange(tabId);
    }
  };

  // 배지 렌더링 함수
  const renderBadge = (badge: number | string | undefined) => {
    if (badge === undefined || badge === null) return null;
    const badgeValue = typeof badge === 'number' && badge > 99 ? '99+' : badge.toString();
    return (
      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {badgeValue}
      </div>
    );
  };

  return (
    <nav className={`bg-white border-t border-gray-200 shadow-lg ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-around items-center h-16">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isDisabled = item.disabled;
            
            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && handleTabClick(item.id)}
                disabled={isDisabled}
                className={`
                  relative flex flex-col items-center justify-center space-y-1 py-2 px-3 rounded-lg transition-all duration-200 min-w-[60px]
                  ${isActive 
                    ? 'text-blue-600 bg-blue-50' 
                    : isDisabled 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }
                  ${isDisabled ? '' : 'active:scale-95'}
                `}
                aria-label={t(item.labelKey)}
                role="tab"
                aria-selected={isActive}
              >
                {/* 아이콘 컨테이너 */}
                <div className="relative">
                  <Icon active={isActive} />
                  {renderBadge(item.badge)}
                </div>
                
                {/* 라벨 */}
                <span className={`
                  text-xs font-medium transition-colors duration-200
                  ${isActive ? 'text-blue-600' : isDisabled ? 'text-gray-300' : 'text-gray-500'}
                `}>
                  {t(item.labelKey)}
                </span>
                
                {/* 활성 탭 인디케이터 */}
                {isActive && (
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* iOS Safari에서 하단 안전 영역 고려 */}
      <div className="pb-safe-bottom" />
    </nav>
  );
};

// 네비게이션 상태를 관리하는 커스텀 훅 (선택사항)
export const useNavigation = (initialTab: NavigationTab = 'home') => {
  const [activeTab, setActiveTab] = React.useState<NavigationTab>(initialTab);
  
  const handleTabChange = React.useCallback((tab: NavigationTab) => {
    setActiveTab(tab);
  }, []);
  
  return {
    activeTab,
    handleTabChange
  };
};

// 네비게이션 컨텍스트 (전역 상태 관리용, 선택사항)
interface NavigationContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  badges: Partial<Record<NavigationTab, number | string>>;
  setBadges: (badges: Partial<Record<NavigationTab, number | string>>) => void;
}

export const NavigationContext = React.createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: React.ReactNode;
  initialTab?: NavigationTab;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ 
  children, 
  initialTab = 'home' 
}) => {
  const [activeTab, setActiveTab] = React.useState<NavigationTab>(initialTab);
  const [badges, setBadges] = React.useState<Partial<Record<NavigationTab, number | string>>>({});
  
  const contextValue = React.useMemo(() => ({
    activeTab,
    setActiveTab,
    badges,
    setBadges
  }), [activeTab, badges]);
  
  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
};

// 네비게이션 컨텍스트 사용 훅
export const useNavigationContext = () => {
  const context = React.useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
};

export default Navigation;