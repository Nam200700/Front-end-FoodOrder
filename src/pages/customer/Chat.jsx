import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { Send, ArrowLeft, MoreVertical, Paperclip, MessageSquare } from 'lucide-react';

export default function Chat() {
  const { convId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { conversations, activeConversation, messages, setActiveConversation, sendMessage, fetchConversations } = useChatStore();

  const queryParams = new URLSearchParams(location.search);
  const orderId = queryParams.get('orderId');
  const orderStatus = queryParams.get('status');
  
  const getChatBasePath = () => {
    const path = window.location.pathname;
    if (path.includes('/shipper/chat')) return '/shipper/chat';
    if (path.includes('/merchant/chat')) return '/merchant/chat';
    return '/chat';
  };
  const basePath = getChatBasePath();
  
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  // Tải danh sách cuộc trò chuyện khi mount trang Chat
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);


  // Focus active conversation if convId is in URL
  useEffect(() => {
    if (convId) {
      setActiveConversation(convId);
    }
  }, [convId, setActiveConversation]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversation]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    sendMessage(activeConversation, inputText);
    setInputText('');
  };

  const currentConv = conversations.find((c) => c.id === activeConversation);
  const currentMessages = activeConversation ? messages[activeConversation] || [] : [];

  return (
    <div className="flex-1 flex bg-white font-google-sans h-full overflow-hidden relative">
      
      {/* ─── LEFT SIDEBAR: CONVERSATION LIST (Hidden on mobile when chat detail is open) ─── */}
      <div className={`w-full md:w-80 shrink-0 border-r border-md-outline-variant/30 flex flex-col h-full bg-slate-50 ${
        convId ? 'hidden md:flex' : 'flex'
      }`}>
        <div className="p-4 border-b border-md-outline-variant/30 bg-white">
          <h1 className="text-lg font-bold text-md-on-surface">Tin nhắn</h1>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-md-outline">
              <MessageSquare size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">Chưa có tin nhắn nào</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = activeConversation === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    navigate(`${basePath}/${c.id}`);
                    setActiveConversation(c.id);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-radius-xl text-left transition-all ${
                    isSelected
                      ? 'bg-md-primary/10 text-md-primary font-medium border-l-4 border-md-primary'
                      : 'bg-white hover:bg-slate-100/50 border border-slate-100 shadow-sm'
                  }`}
                >
                  <img 
                    src={c.participantAvatar} 
                    alt={c.participantName} 
                    className="w-11 h-11 rounded-radius-full object-cover border border-slate-100"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs sm:text-sm text-md-on-surface truncate">
                        {c.participantName}
                      </span>
                      <span className="text-[9px] text-md-outline font-semibold">
                        {c.lastMessageTime}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 truncate ${
                      c.unreadCount > 0 ? 'font-bold text-md-on-surface' : 'text-md-on-surface-variant'
                    }`}>
                      {c.lastMessage}
                    </p>
                  </div>

                  {c.unreadCount > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-md-primary shrink-0 animate-pulse" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─── RIGHT SIDE: CHAT AREA (Hidden on mobile when chat list is open) ────────── */}
      <div className={`flex-1 flex flex-col h-full bg-white relative ${
        !convId ? 'hidden md:flex' : 'flex'
      }`}>
        {activeConversation && currentConv ? (
          <>
            {/* Chat header */}
            <div className="h-16 border-b border-md-outline-variant/30 px-4 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    navigate(basePath);
                    setActiveConversation(null);
                  }}
                  className="md:hidden p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant"
                >
                  <ArrowLeft size={18} />
                </button>

                <img 
                  src={currentConv.participantAvatar} 
                  alt={currentConv.participantName} 
                  className="w-9 h-9 rounded-radius-full object-cover border border-slate-100"
                />
                
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-md-on-surface truncate leading-none">
                    {currentConv.participantName}
                  </h3>
                  {orderId ? (
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1 animate-fade-in">
                      {/* Chấm xanh báo trạng thái online thay cho emoji 🟢 */}
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle"></span>
                      Hoạt động • Giao dịch đơn #{orderId}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1 animate-fade-in">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle"></span>
                      Hoạt động
                    </span>
                  )}
                </div>
              </div>

              <button className="p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant">
                <MoreVertical size={18} />
              </button>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              
              {/* Order Info Banner (Chỉ hiển thị nếu có đơn hàng giao dịch thật) */}
              {orderId && (
                <div className="p-3 bg-md-primary-container/20 rounded-radius-xl border border-md-primary/10 flex items-center justify-between text-xs mb-6 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-md-primary animate-ping"></span>
                    <span className="font-bold text-md-primary">Đơn hàng #{orderId}</span>
                    <span className="text-md-on-surface-variant">
                      • {
                        orderStatus === 'PENDING' ? 'Chờ xác nhận' :
                        orderStatus === 'CONFIRMED' ? 'Quán đã xác nhận' :
                        orderStatus === 'PREPARING' ? 'Đang chuẩn bị món' :
                        orderStatus === 'READY_FOR_PICKUP' ? 'Chờ shipper lấy' :
                        orderStatus === 'PICKED_UP' ? 'Shipper đã lấy món' :
                        orderStatus === 'DELIVERING' ? 'Đang giao tới bạn' :
                        orderStatus === 'COMPLETED' ? 'Đã hoàn thành' :
                        orderStatus === 'CANCELLED' ? 'Đã hủy đơn' : 'Đang xử lý'
                      }
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      const prefix = basePath.includes('/shipper') ? '/shipper' : '';
                      navigate(`${prefix}/orders/${orderId}`);
                    }}
                    className="font-bold text-md-primary hover:underline cursor-pointer"
                  >
                    Xem chi tiết
                  </button>
                </div>
              )}

              {currentMessages.map((msg, index) => {
                const isSelf = msg.isSelf;
                return (
                  <div key={msg.id || index} className={`flex items-end gap-2 ${
                    isSelf ? 'justify-end' : 'justify-start'
                  }`}>
                    
                    {/* Participant Avatar (only show on left side) */}
                    {!isSelf && (
                      <img 
                        src={currentConv.participantAvatar} 
                        alt="Avatar" 
                        className="w-7 h-7 rounded-radius-full object-cover border border-slate-100 shrink-0 mb-1"
                      />
                    )}

                    {/* Chat Bubble (spec 8.6) */}
                    <div className="flex flex-col max-w-[70%]">
                      <div className={`p-3 text-xs leading-relaxed shadow-sm ${
                        isSelf
                          ? 'bg-md-primary-container text-md-primary font-medium rounded-[20px_4px_20px_20px]'
                          : 'bg-white text-md-on-surface border border-md-outline-variant/15 rounded-[4px_20px_20px_20px]'
                      }`}>
                        {msg.content}
                      </div>
                      
                      {/* Timestamp */}
                      <span className={`text-[9px] text-md-outline font-semibold mt-1 px-1 ${
                        isSelf ? 'text-right' : 'text-left'
                      }`}>
                        {msg.time}
                      </span>
                    </div>

                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSend} className="p-3 border-t border-md-outline-variant/30 flex items-center gap-2 bg-white shrink-0">
              <button 
                type="button"
                className="p-2.5 rounded-radius-full hover:bg-slate-100 text-md-outline transition-colors shrink-0"
              >
                <Paperclip size={18} />
              </button>
              
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Nhập tin nhắn của bạn..."
                className="flex-1 bg-slate-50 border border-md-outline-variant/40 rounded-radius-full px-4 py-2.5 text-xs focus:outline-none focus:border-md-primary focus:bg-white transition-all"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-9 h-9 rounded-radius-full bg-md-primary hover:bg-opacity-95 text-white flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-90 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Send size={15} className="translate-x-[1px]" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-md-outline">
            <MessageSquare size={48} className="opacity-30 mb-3" />
            <h3 className="font-bold text-sm text-md-on-surface">Không có cuộc trò chuyện nào được chọn</h3>
            <p className="text-xs text-md-outline mt-1.5 max-w-xs">
              Vui lòng chọn một cuộc trò chuyện ở danh sách bên trái để bắt đầu nhắn tin.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}