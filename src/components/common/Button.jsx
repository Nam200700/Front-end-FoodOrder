import React from 'react';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary, secondary, outline, text, danger
  size = 'md', // sm, md, lg
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) {
  // Styles cơ bản
  const baseStyle = 'inline-flex items-center justify-center font-google-sans font-extrabold tracking-wide rounded-radius-full transition-all duration-200 focus:outline-none cursor-pointer select-none active:scale-[0.98] disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed';

  // Variants map
  const variants = {
    primary: 'bg-md-primary text-white shadow-shadow-1 hover:shadow-shadow-2 hover:bg-opacity-95',
    secondary: 'bg-md-secondary text-white shadow-shadow-1 hover:shadow-shadow-2 hover:bg-opacity-95',
    outline: 'bg-white border border-md-outline-variant text-md-on-surface-variant hover:bg-slate-50',
    text: 'bg-transparent text-md-primary hover:bg-md-primary-container/15',
    danger: 'bg-[#EA4335] text-white shadow-shadow-1 hover:shadow-shadow-2 hover:bg-opacity-95',
  };

  // Sizes map
  const sizes = {
    sm: 'text-xs px-4 py-2.5 gap-1.5',
    md: 'text-sm px-6 py-3.5 gap-2.5',
    lg: 'text-base px-8 py-4.5 gap-3',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18} className="shrink-0" />}
          {children}
        </>
      )}
    </button>
  );
}
