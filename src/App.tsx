import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TradingModeProvider } from "@/contexts/TradingModeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ArbitrageCalculator from "./pages/ArbitrageCalculator";  
import Portfolio from "./pages/Portfolio";
import ArbitrageControl from "./pages/ArbitrageControl";
import BalanceDashboard from "./pages/BalanceDashboard";
import AutoBot from "./pages/AutoBot";
import HFTTrading from "./pages/HFTTrading";
import TriangularArbitrage from "./pages/TriangularArbitrage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TradingModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </TradingModeProvider>
  </QueryClientProvider>
);

export default App;
