import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TradingModeContextType {
  isRealMode: boolean;
  setIsRealMode: (mode: boolean) => void;
  hasCredentials: boolean;
  setHasCredentials: (has: boolean) => void;
  recheckCredentials: () => void;
}

const TradingModeContext = createContext<TradingModeContextType | undefined>(undefined);

export const useTradingMode = (): TradingModeContextType => {
  const context = useContext(TradingModeContext);
  if (!context) {
    throw new Error('useTradingMode must be used within a TradingModeProvider');
  }
  return context;
};

interface TradingModeProviderProps {
  children: ReactNode;
}

export const TradingModeProvider: React.FC<TradingModeProviderProps> = ({ children }) => {
  const [isRealMode, setIsRealMode] = useState(true); // Modo real ativo por padrão
  const [hasCredentials, setHasCredentials] = useState(false);

  const checkCredentials = () => {
    const binanceCredentials = localStorage.getItem('binance_credentials');
    const hyperliquidCredentials = localStorage.getItem('hyperliquid_credentials');
    
    // Verificar se tem credenciais válidas (incluindo de demonstração)
    let hasValidBinance = false;
    let hasValidHyperliquid = false;
    
    if (binanceCredentials) {
      try {
        const binanceCreds = JSON.parse(binanceCredentials);
        hasValidBinance = !!(binanceCreds.apiKey && binanceCreds.secretKey);
      } catch (e) {
        console.error('Erro ao parse credenciais Binance:', e);
      }
    }
    
    if (hyperliquidCredentials) {
      try {
        const hyperliquidCreds = JSON.parse(hyperliquidCredentials);
        hasValidHyperliquid = !!(hyperliquidCreds.walletName && hyperliquidCreds.walletAddress && hyperliquidCreds.privateKey);
      } catch (e) {
        console.error('Erro ao parse credenciais Hyperliquid:', e);
      }
    }
    
    const hasValidCredentials = hasValidBinance || hasValidHyperliquid;
    setHasCredentials(hasValidCredentials);
    
    console.log('Status das credenciais:', {
      hasValidBinance,
      hasValidHyperliquid,
      hasValidCredentials
    });
    
    return hasValidCredentials;
  };

  useEffect(() => {
    checkCredentials();
    
    // Verifica credenciais a cada mudança no localStorage
    const handleStorageChange = () => {
      checkCredentials();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value: TradingModeContextType = {
    isRealMode,
    setIsRealMode: (mode: boolean) => {
      // Permitir ativar modo real independente das credenciais
      setIsRealMode(mode);
    },
    hasCredentials,
    setHasCredentials,
    recheckCredentials: checkCredentials,
  };

  return (
    <TradingModeContext.Provider value={value}>
      {children}
    </TradingModeContext.Provider>
  );
};