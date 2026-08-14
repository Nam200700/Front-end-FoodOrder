import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  error = '',
  helperText = '',
  icon: Icon,
  className = '',
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  // Trạng thái nhãn bay lên (Float Label)
  const isFloating = focused || value?.toString().length > 0 || placeholder.length > 0;

  return (
    <div className={`flex flex-col relative w-full ${className}`}>
      
      {/* Label bọc ngoài hoặc Float Label dạng Material Design */}
      {label && (
        <label 
          className={`absolute left-4.5 transition-all duration-200 pointer-events-none select-none font-google-sans font-bold z-10 ${
            isFloating
              ? 'top-2 text-[10px] uppercase tracking-wider text-md-primary'
              : 'top-1/2 -translate-y-1/2 text-sm text-md-outline'
          }`}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative flex items-center w-full">
        {/* Leading Icon */}
        {Icon && (
          <div className="absolute left-4.5 text-md-outline shrink-0 pointer-events-none">
            <Icon size={18} />
          </div>
        )}

        {/* Input tag */}
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? placeholder : ''}
          className={`w-full font-google-sans font-semibold text-sm md:text-base text-md-on-surface bg-md-surface-variant/20 border rounded-radius-lg focus:outline-none transition-all ${
            Icon ? 'pl-12' : 'pl-4.5'
          } ${
            isPassword ? 'pr-12' : 'pr-4.5'
          } ${
            label ? 'pt-6 pb-2.5' : 'py-4'
          } ${
            error 
              ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
              : focused 
                ? 'border-md-primary focus:ring-4 focus:ring-md-primary/10' 
                : 'border-md-outline-variant hover:border-md-outline'
          }`}
          {...props}
        />

        {/* Password Eye Toggle — Eye ⇄ EyeOff xoay + fade chéo nhau, nhún khi bấm */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4.5 w-[18px] h-[18px] text-md-outline hover:text-md-primary active:scale-90 transition-all cursor-pointer"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
          >
            <Eye
              size={18}
              className={`absolute inset-0 m-auto transition-all duration-300 ${
                showPassword ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
              }`}
            />
            <EyeOff
              size={18}
              className={`absolute inset-0 m-auto transition-all duration-300 ${
                showPassword ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
              }`}
            />
          </button>
        )}
      </div>

      {/* Error & Helper text */}
      {error ? (
        <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-2 flex items-start gap-1">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{error}</span>
        </span>
      ) : helperText ? (
        <span className="text-[11px] text-md-outline font-semibold mt-1.5 ml-2">{helperText}</span>
      ) : null}

    </div>
  );
}
