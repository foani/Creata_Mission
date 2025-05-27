/**
 * Footer Component
 * 푸터 정보를 표시하는 컴포넌트
 * 
 * Features:
 * - CreataChain 브랜딩 및 저작권 정보
 * - 소셜 미디어 링크
 * - 유용한 링크들 (문서, 지원, 개인정보보호)
 * - 다국어 지원
 * - 반응형 디자인
 * - 현재 버전 정보
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// 소셜 미디어 아이콘 컴포넌트들
const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.9616-.6067 3.9501-1.5219 6.002-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0190 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// 소셜 미디어 링크 정의
interface SocialLink {
  name: string;
  icon: React.ComponentType;
  url: string;
  labelKey: string;
}

// 푸터 링크 정의
interface FooterLink {
  labelKey: string;
  url: string;
  external?: boolean;
}

interface FooterSection {
  titleKey: string;
  links: FooterLink[];
}

interface FooterProps {
  showSocial?: boolean;
  showLinks?: boolean;
  showVersion?: boolean;
  compact?: boolean;
  className?: string;
}

const Footer: React.FC<FooterProps> = ({
  showSocial = true,
  showLinks = true,
  showVersion = true,
  compact = false,
  className = ''
}) => {
  const { t } = useTranslation();
  
  // 하드코딩된 소셜 미디어 링크들
  const socialLinks: SocialLink[] = [
    {
      name: 'Twitter',
      icon: TwitterIcon,
      url: 'https://twitter.com/creatachain',
      labelKey: 'footer.social.twitter'
    },
    {
      name: 'Telegram',
      icon: TelegramIcon,
      url: 'https://t.me/creatachain',
      labelKey: 'footer.social.telegram'
    },
    {
      name: 'Discord',
      icon: DiscordIcon,
      url: 'https://discord.gg/creatachain',
      labelKey: 'footer.social.discord'
    },
    {
      name: 'GitHub',
      icon: GitHubIcon,
      url: 'https://github.com/creatachain',
      labelKey: 'footer.social.github'
    }
  ];
  
  // 하드코딩된 푸터 링크 섹션들
  const footerSections: FooterSection[] = [
    {
      titleKey: 'footer.sections.product',
      links: [
        { labelKey: 'footer.links.games', url: '/games' },
        { labelKey: 'footer.links.ranking', url: '/ranking' },
        { labelKey: 'footer.links.wallet', url: '/wallet' },
        { labelKey: 'footer.links.rewards', url: '/rewards' }
      ]
    },
    {
      titleKey: 'footer.sections.support',
      links: [
        { labelKey: 'footer.links.help', url: '/help' },
        { labelKey: 'footer.links.faq', url: '/faq' },
        { labelKey: 'footer.links.contact', url: '/contact' },
        { labelKey: 'footer.links.feedback', url: '/feedback' }
      ]
    },
    {
      titleKey: 'footer.sections.legal',
      links: [
        { labelKey: 'footer.links.privacy', url: '/privacy' },
        { labelKey: 'footer.links.terms', url: '/terms' },
        { labelKey: 'footer.links.cookies', url: '/cookies' }
      ]
    },
    {
      titleKey: 'footer.sections.developer',
      links: [
        { labelKey: 'footer.links.docs', url: 'https://docs.creatachain.com', external: true },
        { labelKey: 'footer.links.api', url: 'https://api.creatachain.com', external: true },
        { labelKey: 'footer.links.github', url: 'https://github.com/creatachain', external: true }
      ]
    }
  ];
  
  // 현재 연도
  const currentYear = new Date().getFullYear();
  
  // 하드코딩된 버전 정보
  const appVersion = process.env.REACT_APP_VERSION || '1.0.0';
  
  // 링크 클릭 핸들러
  const handleLinkClick = (url: string, external: boolean = false) => {
    if (external) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // 내부 링크는 라우터 처리 (여기서는 간단히 location.href 사용)
      window.location.href = url;
    }
  };
  
  // 소셜 링크 렌더링 함수
  function renderSocialLinks() {
    return (
      <div className="flex space-x-4">
        {socialLinks.map((social) => {
          const Icon = social.icon;
          return (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors duration-200 p-2 rounded-lg hover:bg-gray-700"
              aria-label={t(social.labelKey, social.name)}
            >
              <Icon />
            </a>
          );
        })}
      </div>
    );
  }
  
  // 컴팩트 모드 렌더링
  if (compact) {
    return (
      <footer className={`bg-gray-800 text-white py-4 ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            {/* 저작권 */}
            <div className="text-sm text-gray-300">
              © {currentYear} CreataChain. {t('footer.copyright', 'All rights reserved.')}
            </div>
            
            {/* 소셜 링크 */}
            {showSocial && renderSocialLinks()}
          </div>
        </div>
      </footer>
    );
  }
  
  // 전체 모드 렌더링
  return (
    <footer className={`bg-gray-800 text-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          
          {/* 브랜드 섹션 */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              {/* 하드코딩된 CreataChain 로고 */}
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <h3 className="text-lg font-bold">CreataChain</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4 max-w-sm">
              {t('footer.description', 'Web3 gaming platform powered by CreataChain. Play games, earn rewards, and join the decentralized gaming revolution.')}
            </p>
            
            {/* 소셜 미디어 링크 */}
            {showSocial && renderSocialLinks()}
          </div>
          
          {/* 링크 섹션들 */}
          {showLinks && footerSections.map((section) => (
            <div key={section.titleKey} className="lg:col-span-1">
              <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">
                {t(section.titleKey)}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    {link.external ? (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-300 hover:text-white text-sm transition-colors duration-200 flex items-center space-x-1"
                      >
                        <span>{t(link.labelKey)}</span>
                        <ExternalLinkIcon />
                      </a>
                    ) : (
                      <Link
                        to={link.url}
                        className="text-gray-300 hover:text-white text-sm transition-colors duration-200 flex items-center space-x-1"
                      >
                        <span>{t(link.labelKey)}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* 하단 구분선 및 저작권 정보 */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="text-sm text-gray-300">
              © {currentYear} CreataChain. {t('footer.copyright', 'All rights reserved.')}
            </div>
            
            {showVersion && (
              <div className="text-sm text-gray-400">
                {t('footer.version', 'Version')} {appVersion} | 
                <span className="ml-1">
                  {t('footer.buildWith', 'Built with')} ❤️ {t('footer.by', 'by')} CreataChain Team
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;