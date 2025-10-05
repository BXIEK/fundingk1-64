import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useIsMobile } from "@/hooks/use-mobile"
import SmartBalanceDashboard from "@/components/SmartBalanceDashboard"
import Web3WalletManager from "@/components/Web3WalletManager"
import CrossPlatformTransferHub from "@/components/CrossPlatformTransferHub"
import MobileAPIManager from "@/components/MobileAPIManger"
import { ExchangeBalanceCard } from "@/components/ExchangeBalanceCard"
import { TotalBalanceCard } from "@/components/TotalBalanceCard"

export default function BalanceDashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  
  const [binanceBalance, setBinanceBalance] = useState(0)
  const [okxBalance, setOkxBalance] = useState(0)
  const [binancePrice, setBinancePrice] = useState<number | null>(null)
  const [okxPrice, setOkxPrice] = useState<number | null>(null)

  // Determinar qual exchange é melhor para comprar/vender
  const getBestExchange = () => {
    if (binancePrice === null || okxPrice === null) return null;
    
    return {
      buy: binancePrice < okxPrice ? 'binance' : 'okx',  // Comprar na mais barata
      sell: binancePrice > okxPrice ? 'binance' : 'okx',  // Vender na mais cara
      spread: Math.abs(binancePrice - okxPrice),
      spreadPercent: ((Math.abs(binancePrice - okxPrice) / Math.min(binancePrice, okxPrice)) * 100).toFixed(4)
    };
  };

  const bestExchange = getBestExchange();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mobile-container">
          <div>
            <h1 className="text-2xl font-bold mb-2">📱 Dashboard Móvel</h1>
            <p className="text-muted-foreground mb-6 text-sm">
              Gerencie suas exchanges e saldos diretamente do celular
            </p>
          </div>

          {/* Mobile API Manager */}
          <MobileAPIManager />

          {/* Mobile Web3 Section */}
          <div className="mt-8">
            <Web3WalletManager />
          </div>

          {/* Mobile Balance Section */}
          <div className="mt-8">
            <SmartBalanceDashboard />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard de Saldos</h1>
        <p className="text-muted-foreground mt-2">
          Monitore e gerencie seus saldos com baseline de $100 USD por exchange
        </p>
      </div>

      {/* Cards de Saldo por Exchange e Total */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Saldo Binance */}
          <ExchangeBalanceCard 
            exchange="binance"
            baseline={100}
            onBalanceChange={setBinanceBalance}
            onPriceUpdate={(ex, price) => setBinancePrice(price)}
            bestAction={bestExchange?.buy === 'binance' ? 'buy' : bestExchange?.sell === 'binance' ? 'sell' : null}
            spreadPercent={bestExchange?.spreadPercent || null}
          />
          
          {/* Saldo OKX */}
          <ExchangeBalanceCard 
            exchange="okx"
            baseline={100}
            onBalanceChange={setOkxBalance}
            onPriceUpdate={(ex, price) => setOkxPrice(price)}
            bestAction={bestExchange?.buy === 'okx' ? 'buy' : bestExchange?.sell === 'okx' ? 'sell' : null}
            spreadPercent={bestExchange?.spreadPercent || null}
          />
          
          {/* Saldo Total */}
      <TotalBalanceCard 
        binanceBalance={binanceBalance} 
        okxBalance={okxBalance}
        totalBaseline={200}
        spreadData={bestExchange && binancePrice && okxPrice ? {
          symbol: 'BTC',
          spreadPercent: parseFloat(bestExchange.spreadPercent),
          buyExchange: bestExchange.buy === 'binance' ? 'Binance' : 'OKX',
          sellExchange: bestExchange.sell === 'binance' ? 'Binance' : 'OKX',
          buyPrice: bestExchange.buy === 'binance' ? binancePrice : okxPrice,
          sellPrice: bestExchange.sell === 'binance' ? binancePrice : okxPrice,
        } : null}
      />
        </div>
        
        {/* Indicador de Spread entre Exchanges */}
        {bestExchange && binancePrice && okxPrice && (
          <div className="mt-6 p-6 border-2 rounded-lg bg-gradient-to-r from-primary/10 to-primary/20 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                  📊 Spread Cross-Exchange
                </h3>
                <p className="text-sm text-muted-foreground">
                  Diferença de preço entre Binance e OKX
                </p>
              </div>
              <div className="flex-1 text-center md:text-right">
                <div className="flex flex-col md:flex-row items-center justify-end gap-6">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-primary mb-1">
                      ${bestExchange.spread.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                    <p className="text-lg font-semibold text-muted-foreground">
                      {bestExchange.spreadPercent}% de diferença
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 border-l-2 border-primary/30 pl-6">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <p className="text-base text-green-500 font-bold">
                        Comprar: {bestExchange.buy === 'binance' ? 'Binance' : 'OKX'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <p className="text-base text-red-500 font-bold">
                        Vender: {bestExchange.sell === 'binance' ? 'Binance' : 'OKX'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Hub de Transferências Cross-Platform */}
      <section>
        <CrossPlatformTransferHub />
      </section>

      {/* Carteira Web3 */}
      <section>
        <Web3WalletManager />
      </section>

      {/* Sistema de Monitoramento */}
      <section>
        <SmartBalanceDashboard />
      </section>
    </div>
  )
}