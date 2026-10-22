import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { lazy,Suspense } from 'react';
import { useEffect } from 'react';
import { startAutosave } from '@/game/progress';
import { recoverPendingRewards } from '@/game/rewards';
const Multiplayer=lazy(()=>import('./pages/Multiplayer'));
const Showcase=lazy(()=>import('./pages/Showcase'));
const ClassShop=lazy(()=>import('./pages/ClassShop'));

const queryClient = new QueryClient();

const App = () => {
  useEffect(()=>{void recoverPendingRewards();return startAutosave();},[]);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/showcase" element={<Suspense fallback={<div className="p-12 text-center">Loading the arena…</div>}><Showcase/></Suspense>} />
          <Route path="/shop" element={<Suspense fallback={<div className="p-12 text-center">Opening the class shop…</div>}><ClassShop/></Suspense>} />
          <Route path="/multiplayer" element={<Suspense fallback={<div className="p-12 text-center">Opening multiplayer…</div>}><Multiplayer/></Suspense>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);};

export default App;
