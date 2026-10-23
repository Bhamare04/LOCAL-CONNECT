import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export const Badge = ({ children, variant = 'primary' }) => {
  const variants = {
    primary: 'bg-brand/20 text-brand-light border-brand/30',
    accent: 'bg-accent/20 text-accent-light border-accent/30',
    white: 'bg-white/10 text-white/80 border-white/20',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  );
};

export const GlassCard = ({ children, className = '', hover = true, onClick, variant = 'light' }) => {
  const variants = {
    light: 'bg-white/5 border-white/10',
    dark: 'bg-black/60 border-white/5 shadow-2xl backdrop-blur-2xl',
  };

  return (
    <div 
      className={`glass-card p-6 ${variants[variant]} ${!hover ? 'hover:transform-none' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const Magnetic = ({ children, strength = 0.5 }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) * strength;
    const y = (clientY - (top + height / 2)) * strength;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
    >
      {children}
    </motion.div>
  );
};

export const GlassButton = ({
  children,
  variant = 'primary',
  onClick,
  className = '',
  type = 'button'
}) => {
  const variants = {
    primary: 'glass-button-primary',
    accent: 'glass-button-accent',
    outline: 'border border-white/20 text-white hover:bg-white/10',
  };

  return (
    <button type={type} onClick={onClick} className={`${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};
