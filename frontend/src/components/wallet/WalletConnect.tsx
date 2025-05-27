// frontend/src/components/wallet/WalletConnect.tsx
// CreataChain 기반 지갑 연결 컴포넌트
// Creata Wallet SDK 연동 및 사용자 인증

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// 지갑 연결 상태 타입 정의
interface WalletState {
  isConnected: boolean;
  address: string | null;
  isInstalled: boolean;
  isVerified: boolean;
  chainId: number | null;
}

// Creata Wallet 인터페이스 확장
declare global {
  interface Window {
    creata?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isConnected: () => boolean;
      getAddress: () => Promise<string>;
      signMessage: (message: string) => Promise<string>;
      switchNetwork: (chainId: string) => Promise<void>;
    };
  }
}

const WalletConnect: React.FC = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    isInstalled: false,
    isVerified: false,
    chainId: null,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catena 네트워크 설정 - 하드코딩된 네트워크 정보
  const CATENA_NETWORK = {
    chainId: '0x3E8', // 1000
    chainName: 'Catena (CIP-20) Chain Mainnet',
    nativeCurrency: {
      name: 'CTA',
      symbol: 'CTA',
      decimals: 18,
    },
    rpcUrls: ['https://cvm.node.creatachain.com'],
    blockExplorerUrls: ['https://catena.explorer.creatachain.com'],
  };

  // 컴포넌트 마운트 시 지갑 확인
  useEffect(() => {
    checkWalletInstallation();
    if (window.creata) {
      checkConnection();
    }
  }, []);

  /**
   * Creata Wallet 설치 여부 확인
   */
  const checkWalletInstallation = () => {
    const isInstalled = typeof window.creata !== 'undefined';
    
    setWalletState(prev => ({
      ...prev,
      isInstalled: isInstalled,
    }));

    if (!isInstalled) {
      setError('Creata Wallet이 설치되지 않았습니다.');
    }
  };

  /**
   * 기존 연결 상태 확인
   */
  const checkConnection = async () => {
    try {
      if (!window.creata) return;

      const isConnected = window.creata.isConnected();
      if (isConnected) {
        const address = await window.creata.getAddress();
        setWalletState(prev => ({
          ...prev,
          isConnected: true,
          address: address,
        }));
      }
    } catch (error) {
      console.error('연결 상태 확인 오류:', error);
    }
  };

  /**
   * Creata Wallet 연결 함수
   */
  const connectWallet = async () => {
    if (!window.creata) {
      setError('Creata Wallet이 설치되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. 지갑 연결 요청
      await window.creata.request({
        method: 'eth_requestAccounts',
      });

      // 2. 주소 가져오기
      const address = await window.creata.getAddress();

      // 3. 네트워크 확인 및 변경
      await ensureCatenaNetwork();

      // 4. 백엔드에 설치 확인 전송
      await confirmInstallation(address);

      // 5. 지갑 서명을 통한 인증
      await verifyWallet(address);

      setWalletState(prev => ({
        ...prev,
        isConnected: true,
        address: address,
        isVerified: true,
      }));

    } catch (error: any) {
      console.error('지갑 연결 오류:', error);
      setError(error.message || '지갑 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Catena 네트워크 확인 및 전환
   */
  const ensureCatenaNetwork = async () => {
    try {
      await window.creata?.switchNetwork(CATENA_NETWORK.chainId);
    } catch (error: any) {
      // 네트워크가 없으면 추가
      try {
        await window.creata?.request({
          method: 'wallet_addEthereumChain',
          params: [CATENA_NETWORK],
        });
      } catch (addError) {
        throw new Error('Catena 네트워크 추가에 실패했습니다.');
      }
    }
  };

  /**
   * 백엔드에 지갑 설치 확인 전송
   */
  const confirmInstallation = async (address: string) => {
    try {
      // 하드코딩된 백엔드 API URL
      const response = await fetch('http://localhost:3000/api/auth/install-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          telegramId: null, // 텔레그램 연동 시 추가될 예정
        }),
      });

      if (!response.ok) {
        throw new Error('설치 확인 전송 실패');
      }

      const result = await response.json();
      console.log('설치 확인 완료:', result);
    } catch (error) {
      console.error('설치 확인 오류:', error);
      // 설치 확인 실패해도 진행 (선택적 기능)
    }
  };

  /**
   * 지갑 서명을 통한 사용자 인증
   */
  const verifyWallet = async (address: string) => {
    try {
      // 인증 메시지 생성
      const timestamp = Date.now();
      const message = `Creata 인증 요청 @ ${timestamp} by ${address}`;

      // 메시지 서명
      const signature = await window.creata?.signMessage(message);

      // 백엔드로 인증 요청 전송
      const response = await fetch('http://localhost:3000/api/auth/verify-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          message: message,
          signature: signature,
        }),
      });

      if (!response.ok) {
        throw new Error('지갑 인증 실패');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('서명 검증 실패');
      }

      console.log('지갑 인증 완료:', result);
    } catch (error) {
      console.error('지갑 인증 오류:', error);
      throw error;
    }
  };

  /**
   * 지갑 연결 해제
   */
  const disconnectWallet = () => {
    setWalletState({
      isConnected: false,
      address: null,
      isInstalled: walletState.isInstalled,
      isVerified: false,
      chainId: null,
    });
    setError(null);
  };

  /**
   * Creata Wallet 설치 페이지로 이동
   */
  const installWallet = () => {
    // 하드코딩된 Creata Wallet 다운로드 URL
    window.open('https://play.google.com/store/apps/details?id=com.creatawallet', '_blank');
  };

  // 지갑이 설치되지 않은 경우
  if (!walletState.isInstalled) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🔗 Creata Wallet 필요
          </h2>
          <p className="text-gray-600 mb-6">
            CreataChain 미션 게임을 플레이하려면 Creata Wallet이 필요합니다.
          </p>
          <button
            onClick={installWallet}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
          >
            📱 Creata Wallet 설치하기
          </button>
        </div>
      </div>
    );
  }

  // 지갑이 연결된 경우
  if (walletState.isConnected && walletState.address) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            ✅ 지갑 연결됨
          </h2>
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500 mb-1">연결된 주소:</p>
            <p className="font-mono text-sm break-all">
              {walletState.address}
            </p>
          </div>
          {walletState.isVerified && (
            <p className="text-green-600 text-sm mb-4">
              🔐 지갑 인증 완료
            </p>
          )}
          <button
            onClick={disconnectWallet}
            className="w-full bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-300"
          >
            연결 해제
          </button>
        </div>
      </div>
    );
  }

  // 연결되지 않은 경우
  return (
    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          🔗 지갑 연결
        </h2>
        <p className="text-gray-600 mb-6">
          CreataChain 미션 게임에 참여하려면 지갑을 연결해주세요.
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <button
          onClick={connectWallet}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              연결 중...
            </span>
          ) : (
            '🔗 Creata Wallet 연결'
          )}
        </button>

        <div className="mt-4 text-xs text-gray-500">
          <p>• Catena (CIP-20) 네트워크 자동 설정</p>
          <p>• 지갑 서명을 통한 안전한 인증</p>
        </div>
      </div>
    </div>
  );
};

export default WalletConnect; 
