import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md', // sm, md, lg, xl
  className = '',
  ...props
}) {
  // Lắng nghe phím ESC để đóng Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay Backdrop Blur */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-all duration-300 animate-fade-in"
      />

      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={`bg-white w-full rounded-radius-xl shadow-shadow-5 border border-md-outline-variant/30 flex flex-col overflow-hidden relative z-10 max-h-[90vh] scale-100 transition-all duration-300 animate-slide-up ${sizes[size]} ${className}`}
        {...props}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-md-outline-variant/20 bg-slate-50/50">
          {title && (
            <h2 id="modal-title" className="text-lg font-extrabold text-md-on-surface font-google-sans leading-none">
              {title}
            </h2>
          )}
          <button 
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 rounded-full text-md-outline hover:text-md-primary hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body — min-h-0 để cuộn được trong flex-col khi vượt max-h dialog */}
        <div className="flex-1 min-h-0 p-6 overflow-y-auto no-scrollbar font-google-sans font-medium text-sm text-md-on-surface-variant">
          {children}
        </div>
      </div>

      {/* CSS Animation Keyframes Inject */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 220ms cubic-bezier(0.2, 0, 0, 1) forwards;
        }
        .animate-slide-up {
          animation: slideUp 280ms cubic-bezier(0.2, 0, 0, 1) forwards;
        }
      `}</style>

    </div>
  );
}
