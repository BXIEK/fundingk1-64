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
    const okxCredentials = localStorage.getItem('okx_credentials');
    
    console.log('🔍 DIAGNÓSTICO COMPLETO DE CREDENCIAIS:');
    console.log('localStorage keys presentes:', Object.keys(localStorage));
    
    // Verificar se tem credenciais válidas (incluindo de demonstração)
    let hasValidBinance = false;
    let hasValidHyperliquid = false;
    let hasValidOKX = false;
    
    if (binanceCredentials) {
      try {
        const binanceCreds = JSON.parse(binanceCredentials);
        hasValidBinance = !!(binanceCreds.apiKey && binanceCreds.secretKey);
        console.log('✅ Credenciais Binance no localStorage:', { 
          present: true,
          hasApiKey: !!binanceCreds.apiKey, 
          hasSecretKey: !!binanceCreds.secretKey,
          apiKeyLength: binanceCreds.apiKey?.length || 0,
          secretKeyLength: binanceCreds.secretKey?.length || 0
        });
      } catch (e) {
        console.error('❌ Erro ao parse credenciais Binance:', e);
      }
    } else {
      console.log('❌ Nenhuma credencial Binance no localStorage');
    }
    
    if (okxCredentials) {
      try {
        const okxCreds = JSON.parse(okxCredentials);
        hasValidOKX = !!(okxCreds.apiKey && okxCreds.secretKey && okxCreds.passphrase);
        console.log('✅ Credenciais OKX no localStorage:', { 
          present: true,
          hasApiKey: !!okxCreds.apiKey, 
          hasSecretKey: !!okxCreds.secretKey,
          hasPassphrase: !!okxCreds.passphrase
        });
      } catch (e) {
        console.error('❌ Erro ao parse credenciais OKX:', e);
      }
    } else {
      console.log('❌ Nenhuma credencial OKX no localStorage');
    }
    
    if (hyperliquidCredentials) {
      try {
        const hyperliquidCreds = JSON.parse(hyperliquidCredentials);
        hasValidHyperliquid = !!(hyperliquidCreds.walletName && hyperliquidCreds.walletAddress && hyperliquidCreds.privateKey);
        console.log('✅ Credenciais Hyperliquid no localStorage:', { 
          present: true,
          hasWalletName: !!hyperliquidCreds.walletName, 
          hasWalletAddress: !!hyperliquidCreds.walletAddress,
          hasPrivateKey: !!hyperliquidCreds.privateKey
        });
      } catch (e) {
        console.error('❌ Erro ao parse credenciais Hyperliquid:', e);
      }
    } else {
      console.log('❌ Nenhuma credencial Hyperliquid no localStorage');
    }
    
    const hasValidCredentials = hasValidBinance || hasValidHyperliquid || hasValidOKX;
    setHasCredentials(hasValidCredentials);
    
    console.log('📊 RESUMO DAS CREDENCIAIS:', {
      hasValidBinance,
      hasValidOKX,
      hasValidHyperliquid,
      hasValidCredentials,
      conclusao: hasValidCredentials ? 'SISTEMA PRONTO' : 'CREDENCIAIS NECESSÁRIAS'
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