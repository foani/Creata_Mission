// src/App.tsx
import React, { useState } from 'react';
import './App.css';
import WalletConnect from './components/wallet/WalletConnect';
import LazyDerby from './components/games/LazyDerby';
import ReverseDarts from './components/games/ReverseDarts';

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>('0x1234567890123456789012345678901234567890'); // 테스트용

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      {walletAddress ? (
        <ReverseDarts />
      ) : (
        <WalletConnect />
      )}
    </div>
  );
}
export default App;