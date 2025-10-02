import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const loadCredentialsFromSupabase = async () => {
    try {
      console.log('🔐 [GLOBAL] Carregando credenciais do Supabase...');
      
      const [binanceResp, okxResp, hyperliquidResp] = await Promise.all([
        supabase.functions.invoke('get-binance-credentials'),
        supabase.functions.invoke('get-okx-credentials'),
        supabase.functions.invoke('get-hyperliquid-credentials'),
      ]);

      let loaded = false;

      if (binanceResp.data?.success && binanceResp.data.credentials) {
        console.log('✅ [GLOBAL] Binance credentials carregadas do Supabase');
        localStorage.setItem('binance_credentials', JSON.stringify(binanceResp.data.credentials));
        loaded = true;
      } else {
        console.log('⚠️ [GLOBAL] Binance credentials não disponíveis no Supabase');
      }

      if (okxResp.data?.success && okxResp.data.credentials) {
        console.log('✅ [GLOBAL] OKX credentials carregadas do Supabase');
        localStorage.setItem('okx_credentials', JSON.stringify(okxResp.data.credentials));
        loaded = true;
      } else {
        console.log('⚠️ [GLOBAL] OKX credentials não disponíveis no Supabase');
      }

      if (hyperliquidResp.data?.success && hyperliquidResp.data.credentials) {
        console.log('✅ [GLOBAL] Hyperliquid credentials carregadas do Supabase');
        localStorage.setItem('hyperliquid_credentials', JSON.stringify(hyperliquidResp.data.credentials));
        loaded = true;
      } else {
        console.log('⚠️ [GLOBAL] Hyperliquid credentials não disponíveis no Supabase');
      }

      if (!loaded) {
        console.log('🔑 [GLOBAL] Nenhuma credencial nos Secrets, usando fallback hardcoded');
        
        const binanceFallback = {
          apiKey: "4lQevGkhJHfKQupjRejJ6FJfX8EBMAh5LhaTRyGLm8Bw1Gxf2wnqe8GOgZ9M4thl",
          secretKey: "jVg7t8YaBdX5X3VsZLwx0ugS7Jw6qTawAfFtAJnJ8z2Lmfs4nxK5fHNjvJ5M8pQL"
        };
        
        const okxFallback = {
          apiKey: "3c4b8d2f-a1e7-4096-b5c3-1f2e3d4c5b6a",
          secretKey: "F8A2B5C4E7D6F9A1B3E8C7D2F5A9B4E1C6D8F2A5B7C3E9D1F4A6B8C5E2D7F3A9",
          passphrase: "TradingBot2024!"
        };

        localStorage.setItem('binance_credentials', JSON.stringify(binanceFallback));
        localStorage.setItem('okx_credentials', JSON.stringify(okxFallback));
        console.log('✅ [GLOBAL] Credenciais fallback salvas no localStorage');
      }
    } catch (error) {
      console.error('❌ [GLOBAL] Erro ao carregar do Supabase:', error);
    }
  };

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
    loadCredentialsFromSupabase().then(() => {
      checkCredentials();
    });
    
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