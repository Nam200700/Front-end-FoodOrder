import React from 'react';

export default function Card({
  children,
  variant = 'elevated', // elevated, glass, flat
  hoverEffect = false,
  className = '',
  onClick,
  ...props
}) {
  const baseStyle = 'rounded-radius-xl overflow-hidden transition-all duration-300 font-google-sans';

  // Variants map
  const variants = {
    elevated: 'bg-white border border-md-outline-variant/20 shadow-shadow-1',
    glass: 'glass-effect',
    flat: 'bg-white border border-md-outline-variant/40',
  };

  const hoverStyle = hoverEffect 
    ? 'hover:scale-[1.015] hover:shadow-shadow-3 card-float cursor-pointer' 
    : onClick ? 'cursor-pointer' : '';

  return (
    <div
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
