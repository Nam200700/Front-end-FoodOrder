import React from 'react';

export default function Spinner({
  size = 'md', // sm, md, lg
  color = 'primary', // primary, secondary, white
  fullScreen = false,
  className = '',
  ...props
}) {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const colors = {
    primary: 'border-md-primary border-t-transparent',
    secondary: 'border-md-secondary border-t-transparent',
    white: 'border-white border-t-transparent',
  };

  const spinner = (
    <div
      className={`rounded-full animate-spin ${sizes[size]} ${colors[color]} ${className}`}
      {...props}
    />
  );

  if (fullScreen) {
    const isAdmin = window.location.pathname.startsWith('/admin');
    const adminTheme = typeof window !== 'undefined' ? localStorage.getItem('admin-theme') : 'dark';
    const isDarkMode = isAdmin ? (adminTheme !== 'light') : false;

    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${
        isDarkMode 
          ? 'bg-slate-950/90 text-purple-400' 
          : 'bg-white/70 text-md-primary'
      } backdrop-blur-xs gap-3 transition-colors duration-350`}>
        {spinner}
        <span className={`text-sm font-google-sans font-bold tracking-wider animate-pulse ${
          isDarkMode ? 'text-purple-300' : 'text-md-outline'
        }`}>
          Fresh Delivery
        </span>
      </div>
    );
  }

  return spinner;
}
