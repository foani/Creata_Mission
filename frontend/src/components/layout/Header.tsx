/**
 * Header Component
 * 사용자 정보, 언어 선택, 지갑 상태를 표시하는 헤더 컴포넌트
 * 
 * Features:
 * - 사용자 지갑 주소 및 연결 상태 표시
 * - 언어 선택 드롭다운
 * - 사용자 점수 및 랭킹 표시
 * - CreataChain 로고 및 브랜딩
 * - 반응형 디자인 (모바일 최적화)
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

// 아이콘 컴포넌트들
const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const LanguageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  </svg>
);

const RankingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// 언어 옵션 정의
const LANGUAGE_OPTIONS = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' }
];

interface HeaderProps {
  onMenuToggle?: () => void;
  showMenu?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, showMenu = false }) => {
  const { t, i18n } = useTranslation();
  const { user, isConnected, totalScore, currentRank, connectWallet, disconnectWallet } = useAuthStore();
  
  // 상태 관리
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 지갑 주소 포맷팅 (앞 6자리 + ... + 뒤 4자리)
  const formatWalletAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 언어 변경 핸들러
  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setShowLanguageMenu(false);
  };

  // 현재 언어 정보 가져오기
  const getCurrentLanguage = () => {
    return LANGUAGE_OPTIONS.find(lang => lang.code === i18n.language) || LANGUAGE_OPTIONS[0];
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left Section - Logo & Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {/* 하드코딩된 CreataChain 로고 */}
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">C</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white">
                  {t('header.title', 'Creata Mission')}
                </h1>
                <p className="text-xs text-blue-100">
                  {t('header.subtitle', 'Web3 Gaming Platform')}
                </p>
              </div>
            </div>
          </div>

          {/* Center Section - User Stats (Desktop) */}
          <div className="hidden md:flex items-center space-x-6">
            {isConnected && (
              <>
                {/* 점수 표시 */}
                <div className="flex items-center space-x-2 bg-white/10 rounded-lg px-3 py-1">
                  <span className="text-yellow-300">⭐</span>
                  <span className="text-sm font-medium">
                    {t('header.score', 'Score')}: {totalScore?.toLocaleString() || 0}
                  </span>
                </div>

                {/* 랭킹 표시 */}
                <div className="flex items-center space-x-2 bg-white/10 rounded-lg px-3 py-1">
                  <RankingIcon />
                  <span className="text-sm font-medium">
                    {t('header.rank', 'Rank')}: #{currentRank || '--'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right Section - Controls */}
          <div className="flex items-center space-x-3">
            
            {/* 언어 선택 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors duration-200"
                aria-label={t('header.changeLanguage', 'Change Language')}
              >
                <LanguageIcon />
                <span className="text-sm font-medium hidden sm:inline">
                  {getCurrentLanguage().flag} {getCurrentLanguage().code.toUpperCase()}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 언어 선택 메뉴 */}
              {showLanguageMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center space-x-3 ${
                          i18n.language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.name}</span>
                        {i18n.language === lang.code && (
                          <span className="ml-auto text-blue-600">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 지갑 연결 상태 & 사용자 메뉴 */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2 transition-colors duration-200 ${
                  isConnected 
                    ? 'bg-green-500/20 hover:bg-green-500/30 border border-green-400/30' 
                    : 'bg-red-500/20 hover:bg-red-500/30 border border-red-400/30'
                }`}
                aria-label={t('header.walletMenu', 'Wallet Menu')}
              >
                <WalletIcon />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-medium">
                    {isConnected ? t('header.connected', 'Connected') : t('header.notConnected', 'Not Connected')}
                  </div>
                  {isConnected && user?.walletAddress && (
                    <div className="text-xs opacity-80">
                      {formatWalletAddress(user.walletAddress)}
                    </div>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              </button>

              {/* 사용자 메뉴 드롭다운 */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-2">
                    {isConnected ? (
                      <>
                        {/* 사용자 정보 */}
                        <div className="px-4 py-3 border-b border-gray-100">
                          <div className="text-sm font-medium text-gray-900">
                            {t('header.walletAddress', 'Wallet Address')}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {user?.walletAddress || '--'}
                          </div>
                          
                          {/* 모바일에서 점수/랭킹 표시 */}
                          <div className="md:hidden mt-2 flex justify-between text-xs">
                            <span className="text-gray-600">
                              {t('header.score', 'Score')}: {totalScore?.toLocaleString() || 0}
                            </span>
                            <span className="text-gray-600">
                              {t('header.rank', 'Rank')}: #{currentRank || '--'}
                            </span>
                          </div>
                        </div>

                        {/* 메뉴 항목들 */}
                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                          <RankingIcon />
                          <span>{t('header.viewProfile', 'View Profile')}</span>
                        </button>
                        
                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3">
                          <SettingsIcon />
                          <span>{t('header.settings', 'Settings')}</span>
                        </button>

                        <div className="border-t border-gray-100 my-1" />
                        
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                          onClick={() => {
                            disconnectWallet();
                            setShowUserMenu(false);
                          }}
                        >
                          <WalletIcon />
                          <span>{t('header.disconnect', 'Disconnect Wallet')}</span>
                        </button>
                      </>
                    ) : (
                      <div className="px-4 py-3">
                        <button
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                          onClick={() => {
                            connectWallet();
                            setShowUserMenu(false);
                          }}
                        >
                          {t('header.connectWallet', 'Connect Wallet')}
                        </button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          {t('header.connectMessage', 'Connect your Creata Wallet to start playing')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 모바일 메뉴 토글 (선택사항) */}
            {onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="md:hidden bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors duration-200"
                aria-label={t('header.toggleMenu', 'Toggle Menu')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showMenu ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 클릭 외부 영역 감지를 위한 오버레이 */}
      {(showLanguageMenu || showUserMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowLanguageMenu(false);
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;