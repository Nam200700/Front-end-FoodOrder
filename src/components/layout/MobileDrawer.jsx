import { useEffect } from 'react';

/**
 * Overlay + drawer panel. KHÔNG có nội dung — caller tự inject qua children.
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - children: ReactNode        — toàn bộ nội dung drawer (logo, menu, avatar, logout)
 * - drawerClass?: string       — className của panel (màu nền, width, v.v.)
 */
export default function MobileDrawer({ isOpen, onClose, children, drawerClass = '' }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />
      {/* Drawer panel — trượt vào từ phải cho mượt (mobile) thay vì hiện đột ngột */}
      <div className={`relative flex flex-col h-full overflow-y-auto shadow-2xl animate-slide-in-right ${drawerClass}`}>
        {children}
      </div>
    </div>
  );
}
