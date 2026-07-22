import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, Sparkles, X } from 'lucide-react';

export default function ChatbotWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showTooltip, setShowTooltip] = useState(false);

  // Auto-show tooltip briefly after 3 seconds on mount to guide the user
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 3000);
    
    // Auto-hide tooltip after 8 seconds
    const hideTimer = setTimeout(() => {
      setShowTooltip(false);
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Exclude paths where the chatbot widget should NOT be displayed
  const hiddenPaths = [
    '/chatbot',
    '/login',
    '/register',
    '/partner',
    '/merchant',
    '/shipper',
    '/admin'
  ];

  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path));

  if (shouldHide) {
    return null;
  }

  const handleClick = () => {
    navigate('/chatbot', { state: { from: location.pathname } });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 font-google-sans select-none pointer-events-auto">
      {/* Tooltip Bubble */}
      {showTooltip && (
        <div className="relative flex items-center bg-white text-gray-800 text-xs md:text-sm font-semibold py-2 px-3.5 rounded-2xl shadow-lg border border-gray-100 animate-fade-in shrink-0 max-w-[200px] md:max-w-xs">
          <div className="flex items-center gap-1.5 pr-2">
            <Sparkles size={14} className="text-orange-500 animate-pulse" />
            <span>Trò chuyện với AI!</span>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="p-0.5 hover:bg-gray-150 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={12} />
          </button>
          
          {/* Arrow */}
          <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-r border-t border-gray-100 rotate-45"></div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        className="group relative w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-orange-200/50 hover:shadow-2xl transition-all transform hover:scale-108 active:scale-95 duration-200 cursor-pointer border-2 border-white"
        title="Trợ lý ảo AI Fresh Delivery"
      >
        {/* Pulsing Highlight Ring */}
        <span className="absolute inset-0 rounded-full bg-orange-500 opacity-40 animate-ping group-hover:animate-none scale-105 pointer-events-none"></span>
        
        {/* Bot Icon */}
        <Bot size={28} className="md:size-32 transition-transform group-hover:rotate-12 duration-200" />
        
        {/* Micro Sparkle Notification Dot */}
        <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 rounded-full border border-white animate-pulse"></span>
      </button>
    </div>
  );
}
