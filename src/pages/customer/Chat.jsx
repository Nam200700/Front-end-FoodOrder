import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChatStore } from '../../stores/chatStore';
import { Send, ArrowLeft, MoreVertical, Paperclip, MessageSquare, Search, User, Store, Bike } from 'lucide-react';

// Màu nhấn + lời dẫn theo VAI (dùng chung 1 component cho 3 role):
//  khách #FF6B35 · chủ quán #1A73E8 · shipper #34A853. Tint = accent + alpha hex.
const ROLE_THEME = {
  customer: {
    label: 'Khách hàng', icon: User, accent: '#FF6B35',
    listHint: 'Nhắn với quán khi cần hỏi về món hoặc đơn hàng của bạn.',
    idleHint: 'Chọn một cuộc trò chuyện bên trái để trao đổi với quán về đơn của bạn.',
  },
  owner: {
    label: 'Chủ quán', icon: Store, accent: '#1A73E8',
    listHint: 'Trao đổi với khách và tài xế quanh các đơn của quán.',
    idleHint: 'Chọn một cuộc trò chuyện bên trái để trả lời khách và tài xế.',
  },
  shipper: {
    label: 'Tài xế', icon: Bike, accent: '#34A853',
    listHint: 'Liên hệ khách và quán trong lúc nhận và giao đơn.',
    idleHint: 'Chọn một cuộc trò chuyện bên trái để liên hệ khách và quán.',
  },
};

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

  // Vai + màu nhấn suy từ basePath
  const role = basePath.includes('/shipper') ? 'shipper' : basePath.includes('/merchant') ? 'owner' : 'customer';
  const theme = ROLE_THEME[role];
  const accent = theme.accent;
  const soft = `${accent}1A`;   // nền tint ~10%
  const softer = `${accent}0D`; // nền tint ~5%
  const RoleIcon = theme.icon;

  const [inputText, setInputText] = useState('');
  const [search, setSearch] = useState('');
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

  // Lọc danh sách theo tên đối phương (tìm client-side)
  const q = search.trim().toLowerCase();
  const filteredConversations = q
    ? conversations.filter((c) => (c.participantName || '').toLowerCase().includes(q))
    : conversations;

  return (
    <div className="flex-1 flex bg-white font-google-sans h-full overflow-hidden relative">

      {/* ─── LEFT SIDEBAR: CONVERSATION LIST (Hidden on mobile when chat detail is open) ─── */}
      <div className={`w-full md:w-80 shrink-0 border-r border-md-outline-variant/30 flex flex-col h-full bg-slate-50 ${
        convId ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header + chip vai + ô tìm */}
        <div className="p-4 border-b border-md-outline-variant/30 bg-white space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-extrabold text-md-on-surface">Tin nhắn</h1>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-radius-full"
              style={{ backgroundColor: soft, color: accent }}
            >
              <RoleIcon size={12} /> {theme.label}
            </span>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-md-outline pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm cuộc trò chuyện..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-md-outline-variant/40 rounded-radius-full focus:outline-none focus:bg-white transition-all"
              style={{ '--tw-ring-color': accent }}
              onFocus={(e) => { e.target.style.borderColor = accent; }}
              onBlur={(e) => { e.target.style.borderColor = ''; }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center px-4 py-14 animate-rise-in">
              <span
                className="w-16 h-16 rounded-radius-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: soft, color: accent }}
              >
                <MessageSquare size={28} />
              </span>
              <p className="text-sm font-extrabold text-md-on-surface">Chưa có cuộc trò chuyện nào</p>
              <p className="text-xs text-md-on-surface-variant font-medium mt-1.5 leading-relaxed">{theme.listHint}</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center px-4 py-14 text-md-outline">
              <Search size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">Không tìm thấy cuộc trò chuyện khớp “{search.trim()}”.</p>
            </div>
          ) : (
            filteredConversations.map((c) => {
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
                      ? 'font-medium border-l-4'
                      : 'bg-white hover:bg-slate-100/60 border border-slate-100 shadow-sm'
                  }`}
                  style={isSelected ? { backgroundColor: soft, borderColor: accent, color: accent } : undefined}
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
                      <span className="text-[9px] text-md-outline font-semibold shrink-0">
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
                    <span
                      className="shrink-0 min-w-5 h-5 px-1.5 rounded-radius-full text-white text-[10px] font-extrabold flex items-center justify-center"
                      style={{ backgroundColor: accent }}
                    >
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
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
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => {
                    navigate(basePath);
                    setActiveConversation(null);
                  }}
                  className="md:hidden p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant"
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="relative shrink-0">
                  <img
                    src={currentConv.participantAvatar}
                    alt={currentConv.participantName}
                    className="w-9 h-9 rounded-radius-full object-cover border-2"
                    style={{ borderColor: soft }}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-md-on-surface truncate leading-none">
                    {currentConv.participantName}
                  </h3>
                  <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle" />
                    {orderId ? `Hoạt động • Giao dịch đơn #${orderId}` : 'Hoạt động'}
                  </span>
                </div>
              </div>

              <button className="p-2 rounded-radius-full hover:bg-slate-100 text-md-on-surface-variant shrink-0">
                <MoreVertical size={18} />
              </button>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">

              {/* Order Info Banner (Chỉ hiển thị nếu có đơn hàng giao dịch thật) */}
              {orderId && (
                <div
                  className="p-3 rounded-radius-xl border flex items-center justify-between text-xs mb-6"
                  style={{ backgroundColor: softer, borderColor: soft }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                    <span className="font-bold shrink-0" style={{ color: accent }}>Đơn hàng #{orderId}</span>
                    <span className="text-md-on-surface-variant truncate">
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
                    className="font-bold hover:underline cursor-pointer shrink-0 ml-2"
                    style={{ color: accent }}
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

                    {/* Chat Bubble — bong bóng tự gửi tô màu theo vai */}
                    <div className="flex flex-col max-w-[70%]">
                      <div
                        className={`p-3 text-xs leading-relaxed shadow-sm ${
                          isSelf
                            ? 'font-medium rounded-[20px_4px_20px_20px]'
                            : 'bg-white text-md-on-surface border border-md-outline-variant/15 rounded-[4px_20px_20px_20px]'
                        }`}
                        style={isSelf ? { backgroundColor: soft, color: accent } : undefined}
                      >
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
                className="flex-1 bg-slate-50 border border-md-outline-variant/40 rounded-radius-full px-4 py-2.5 text-xs focus:outline-none focus:bg-white transition-all"
                onFocus={(e) => { e.target.style.borderColor = accent; }}
                onBlur={(e) => { e.target.style.borderColor = ''; }}
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-9 h-9 rounded-radius-full text-white flex items-center justify-center transition-all shadow-sm shrink-0 active:scale-90 disabled:opacity-40 disabled:pointer-events-none hover:brightness-95"
                style={{ backgroundColor: accent }}
              >
                <Send size={15} className="translate-x-[1px]" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 animate-rise-in">
            <span
              className="w-20 h-20 rounded-radius-full flex items-center justify-center mb-4"
              style={{ backgroundColor: soft, color: accent }}
            >
              <MessageSquare size={40} />
            </span>
            <h3 className="font-extrabold text-base text-md-on-surface">Chọn một cuộc trò chuyện</h3>
            <p className="text-xs text-md-on-surface-variant font-medium mt-1.5 max-w-xs leading-relaxed">
              {theme.idleHint}
            </p>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold mt-4 px-3 py-1.5 rounded-radius-full"
              style={{ backgroundColor: softer, color: accent }}
            >
              <RoleIcon size={13} /> Không gian nhắn tin của {theme.label.toLowerCase()}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
