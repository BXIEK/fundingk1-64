import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TradingModeProvider } from "@/contexts/TradingModeContext";
import Index from "./pages/Index";
import ArbitrageCalculator from "./pages/ArbitrageCalculator";  
import Portfolio from "./pages/Portfolio";
import ArbitrageControl from "./pages/ArbitrageControl";
import BalanceDashboard from "./pages/BalanceDashboard";
import AutoBot from "./pages/AutoBot";
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
            <Route path="/" element={<Index />} />
            <Route path="/arbitrage-calculator" element={<ArbitrageCalculator />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/arbitrage-control" element={<ArbitrageControl />} />
            <Route path="/balance-dashboard" element={<BalanceDashboard />} />
            <Route path="/auto-bot" element={<AutoBot />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </TradingModeProvider>
  </QueryClientProvider>
);

export default App;
