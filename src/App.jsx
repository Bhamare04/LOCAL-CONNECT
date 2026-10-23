import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Components
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';

// Pages
import Home from './pages/Home';
import Explore from './pages/Explore';
import TravelRecommendations from './pages/TravelRecommendations';
import Profile from './pages/Profile';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import CityPage from './pages/CityPage';
import AIAssistant from './components/ai/AIAssistant';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

function App() {
  const location = useLocation();

  return (
    <div className="relative min-h-screen bg-[#1e1b4b] selection:bg-brand/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand/30 blur-[140px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[0%] right-[-10%] w-[50%] h-[50%] bg-accent/30 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[20%] right-[0%] w-[40%] h-[40%] bg-vibrant-pink/20 blur-[100px] rounded-full animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[-10%] left-[10%] w-[45%] h-[45%] bg-vibrant-indigo/20 blur-[110px] rounded-full animate-pulse" style={{ animationDuration: '15s' }} />
      </div>

      <ScrollToTop />
      <Navbar />
      
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/travel-recommendations" element={<TravelRecommendations />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:userId" element={<Chat />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/city/:cityName" element={<CityPage />} />
          </Routes>
        </AnimatePresence>
      </main>

      <AIAssistant />
      <Footer />
    </div>
  );
}

export default App;
