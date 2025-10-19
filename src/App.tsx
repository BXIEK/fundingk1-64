import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TradingModeProvider } from "@/contexts/TradingModeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ArbitrageCalculator = lazy(() => import("./pages/ArbitrageCalculator"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const ArbitrageControl = lazy(() => import("./pages/ArbitrageControl"));
const BalanceDashboard = lazy(() => import("./pages/BalanceDashboard"));
const AutoBot = lazy(() => import("./pages/AutoBot"));
const HFTTrading = lazy(() => import("./pages/HFTTrading"));
const TriangularArbitrage = lazy(() => import("./pages/TriangularArbitrage"));
const BlockchainArbitrage = lazy(() => import("./pages/BlockchainArbitrage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TradingModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
            <Routes>
              {/* Rota pública de autenticação */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Rotas protegidas */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/arbitrage-calculator" element={<ProtectedRoute><ArbitrageCalculator /></ProtectedRoute>} />
              <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
              <Route path="/arbitrage-control" element={<ProtectedRoute><ArbitrageControl /></ProtectedRoute>} />
              <Route path="/balance-dashboard" element={<ProtectedRoute><BalanceDashboard /></ProtectedRoute>} />
              <Route path="/auto-bot" element={<ProtectedRoute><AutoBot /></ProtectedRoute>} />
              <Route path="/hft-trading" element={<ProtectedRoute><HFTTrading /></ProtectedRoute>} />
              <Route path="/triangular-arbitrage" element={<ProtectedRoute><TriangularArbitrage /></ProtectedRoute>} />
              <Route path="/blockchain-arbitrage" element={<ProtectedRoute><BlockchainArbitrage /></ProtectedRoute>} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </TradingModeProvider>
  </QueryClientProvider>
);

export default App;
