import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, MessageSquare, LayoutDashboard, Sparkles, Search, Menu, X, User, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase/config';
import { signOut } from 'firebase/auth';
import NotificationsMenu from './NotificationsMenu';
import { Magnetic } from './UIComponents';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { currentUser, userData } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Explore', path: '/explore', icon: <Compass size={18} /> },
    { name: 'Travel Recommendations', path: '/travel-recommendations', icon: <Sparkles size={18} /> },
    { name: 'Messages', path: '/chat', icon: <MessageSquare size={18} /> },
    ...(currentUser && userData?.role === 'local' ? [{ name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-500 ${
        isScrolled ? 'py-4' : 'py-8'
      }`}
    >
      <div className="w-full max-w-5xl px-4">
        <div className={`rounded-[2rem] p-2.5 px-6 flex items-center justify-between transition-all duration-500 border shadow-2xl backdrop-blur-3xl ${
          isScrolled ? 'bg-black/20 border-white/10' : 'bg-black/10 border-white/5'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand via-vibrant-pink to-accent-light flex items-center justify-center text-white shadow-[0_0_20px_rgba(225,29,72,0.4)] group-hover:shadow-[0_0_40px_rgba(225,29,72,0.6)] group-hover:scale-105 transition-all duration-500 relative">
              <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Compass size={22} className="relative z-10 group-hover:rotate-45 transition-transform duration-700" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight hidden sm:block">
              Local<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-light to-vibrant-pink animate-gradient-x drop-shadow-[0_0_10px_rgba(244,114,182,0.5)]">Connect</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1.5 ml-8">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Magnetic key={link.path} strength={0.15}>
                  <Link 
                    to={link.path}
                    className={`relative group flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold tracking-wide uppercase transition-all duration-300 ${
                      active 
                        ? 'text-white' 
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {active && (
                      <motion.div 
                        layoutId="navbar-active"
                        className="absolute inset-0 bg-white/10 rounded-full border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <div className={`${active ? 'text-brand-light drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]' : 'text-white/40 group-hover:text-white/80'}`}>
                        {link.icon}
                      </div>
                      {link.name}
                    </span>
                  </Link>
                </Magnetic>
              );
            })}
          </div>
          
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <div className="w-px h-6 bg-white/10 mx-2" />
            {currentUser ? (
              <>
                <NotificationsMenu currentUser={currentUser} />
                <Magnetic strength={0.2}>
                  <Link to="/profile" className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 ${
                    isActive('/profile') 
                      ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand to-vibrant-pink flex items-center justify-center text-xs font-bold text-white shadow-[0_0_10px_rgba(225,29,72,0.5)]">
                      {userData?.name?.charAt(0) || currentUser.displayName?.charAt(0) || <User size={12} />}
                    </div>
                    <span className="font-bold text-[13px] tracking-wide">{userData?.name?.split(' ')[0] || 'Profile'}</span>
                  </Link>
                </Magnetic>
                <Magnetic strength={0.2}>
                  <button onClick={handleLogout} className="flex items-center gap-2 p-2.5 rounded-full text-white/40 hover:text-brand-light hover:bg-brand/10 transition-colors ml-1">
                    <LogOut size={16} />
                  </button>
                </Magnetic>
              </>
            ) : (
              <>
                <Magnetic strength={0.2}>
                  <Link to="/login" className="flex items-center gap-2 px-6 py-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors font-bold text-[13px] uppercase tracking-wide">
                    <span>Login</span>
                  </Link>
                </Magnetic>
                <Magnetic strength={0.2}>
                  <Link to="/register" className="liquid-button flex items-center gap-2 px-7 py-2.5 rounded-full bg-white text-black hover:scale-105 transition-all duration-500 ml-2 font-black text-[13px] uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                    <span className="relative z-10">Sign Up</span>
                  </Link>
                </Magnetic>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-2">
            {currentUser && <NotificationsMenu currentUser={currentUser} />}
            <button 
              className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-full left-0 right-0 p-4 pt-0"
          >
            <div className="glass rounded-2xl p-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link 
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isActive(link.path) 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.icon}
                  <span className="font-medium">{link.name}</span>
                </Link>
              ))}
              <hr className="border-white/10 my-2" />
              {currentUser ? (
                <>
                  <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isActive('/profile') 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}>
                    <User size={18} />
                    <span className="font-medium">{userData?.name || currentUser.displayName || 'Profile'}</span>
                  </Link>
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="flex items-center justify-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors mt-2">
                    <LogOut size={18} />
                    <span className="font-medium">Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl text-white/70 hover:text-white transition-colors">
                    <User size={18} />
                    <span className="font-medium">Login</span>
                  </Link>
                  <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-center gap-3 p-3 rounded-xl bg-brand text-white transition-colors mt-2">
                    <span className="font-medium">Sign Up</span>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
