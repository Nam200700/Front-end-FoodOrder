import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, RefreshCw, Trash2, ArrowLeft, Plus, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';

export default function AIChatbot({ isPublic = false }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Session states
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('chatbot_active_session_id') || 'session_' + Math.random().toString(36).substring(2, 11);
  });
  const [sessions, setSessions] = useState([]);
  const messagesEndRef = useRef(null);

  // Suggestions for user to click
  const suggestions = [
    "Gợi ý món ăn tối nay cho tôi",
    "Có quán ăn nào ngon gần đây không?",
    "Tôi muốn ăn đồ Hàn Quốc, hệ thống có món gì?",
    "Hỏi thông tin về an toàn hệ thống"
  ];

  // Load sessions and history on mount & when sessionId changes
  useEffect(() => {
    localStorage.setItem('chatbot_active_session_id', sessionId);
    fetchSessions();
    fetchHistory();
  }, [sessionId]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const fetchSessions = async () => {
    try {
      const endpoint = isPublic ? '/auth/chatbot/sessions' : '/chatbot/sessions';
      const response = await apiClient.get(endpoint);
      const sessionList = response.data.data || [];
      
      // Ensure the current sessionId is included in the sidebar list
      if (!sessionList.includes(sessionId)) {
        sessionList.unshift(sessionId);
      }
      setSessions(sessionList);
    } catch (err) {
      console.error("Lỗi khi tải danh sách phiên chat:", err);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const endpoint = isPublic ? `/auth/chatbot/history?sessionId=${sessionId}` : `/chatbot/history?sessionId=${sessionId}`;
      const response = await apiClient.get(endpoint);
      const historyData = response.data.data || [];
      // Map API fields (sender, content, createdAt) to view state
      const mapped = historyData.map(msg => ({
        id: Math.random().toString(),
        sender: msg.sender ? msg.sender.toLowerCase() : 'bot',
        text: msg.content || '',
        time: (() => {
          if (!msg.createdAt) return '';
          try {
            if (Array.isArray(msg.createdAt)) {
              const [year, month, day, hour, minute] = msg.createdAt;
              const h = hour !== undefined ? hour.toString().padStart(2, '0') : '00';
              const m = minute !== undefined ? minute.toString().padStart(2, '0') : '00';
              return `${h}:${m}`;
            }
            const date = new Date(msg.createdAt);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            return '';
          }
        })()
      }));
      setMessages(mapped);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử chat:", err);
      setError("Không thể tải lịch sử trò chuyện. Hãy thử lại!");
    } finally {
      setHistoryLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewChat = () => {
    const newId = 'session_' + Math.random().toString(36).substring(2, 11);
    setSessionId(newId);
    setMessages([]);
    setError(null);
  };

  const selectSession = (id) => {
    setSessionId(id);
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || input.trim();
    if (!text) return;

    if (!textToSend) setInput('');
    setError(null);

    // Add user message to UI
    const userMsg = {
      id: Math.random().toString(),
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const endpoint = isPublic ? '/auth/chatbot/chat' : '/auth/chatbot/chat';
      const response = await apiClient.post(endpoint, { 
        message: text,
        sessionId: sessionId
      }, { timeout: 60000 });
      const result = response.data.data;
      
      // Add Bot reply to UI
      const botMsg = {
        id: Math.random().toString(),
        sender: 'bot',
        text: result.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      
      // Refresh session list in case this is a newly saved session
      fetchSessions();
    } catch (err) {
      console.error("Lỗi gửi tin nhắn chatbot:", err);
      const errMsg = err.response?.data?.message || "Đã xảy ra lỗi hệ thống. Vui lòng thử lại!";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-64px)] font-google-sans bg-gray-50 w-full overflow-hidden relative shadow-sm">
      
      {/* ─── SIDEBAR: CHAT HISTORY ─── */}
      <div className="hidden md:flex w-68 bg-white border-r border-gray-200 flex-col h-full shrink-0">
        <div className="p-4 border-b border-gray-100">
          <button 
            onClick={handleNewChat} 
            className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs md:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Plus size={16} />
            Cuộc trò chuyện mới
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 px-3 uppercase tracking-wider mb-2">Lịch sử hội thoại</p>
          {sessions.map((s) => (
            <button 
              key={s} 
              onClick={() => selectSession(s)} 
              className={`w-full text-left py-2.5 px-3 rounded-xl text-xs md:text-sm font-medium transition-all truncate flex items-center gap-2.5 ${
                s === sessionId 
                  ? 'bg-orange-50 text-orange-600 font-semibold border border-orange-100 shadow-2xs' 
                  : 'text-gray-600 hover:bg-gray-50 border border-transparent'
              }`}
            >
              <MessageSquare size={14} className={s === sessionId ? "text-orange-500" : "text-gray-400"} />
              <span className="truncate">
                {s.startsWith('session_') ? `Đoạn chat ${s.substring(8, 14)}` : `Cuộc trò chuyện ${s}`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── MAIN CHAT AREA ─── */}
      <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="bg-orange-100 text-orange-600 p-2.5 rounded-2xl flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div>
              <h1 className="font-bold text-gray-800 text-base md:text-lg flex items-center gap-1.5">
                Trợ lý ảo AI Fresh Delivery
                <Sparkles size={16} className="text-orange-500 animate-pulse" />
              </h1>
              <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                Đang hoạt động • Trực tuyến
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick button to clear/reset chat for mobile */}
            <button 
              onClick={handleNewChat}
              title="Đoạn chat mới"
              className="md:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <Plus size={18} />
            </button>
            <button 
              onClick={fetchHistory} 
              disabled={historyLoading} 
              title="Tải lại lịch sử chat"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <RefreshCw size={18} className={historyLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 text-red-700 px-6 py-3 flex items-center gap-2 border-b border-red-100 animate-fade-in">
            <AlertCircle size={18} className="shrink-0" />
            <span className="text-xs md:text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {historyLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Đang tải lịch sử hội thoại...</span>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State / Welcoming suggestions */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto px-4">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 p-6 rounded-full text-orange-500 mb-4 shadow-xs">
                <Bot size={48} />
              </div>
              <h2 className="font-bold text-gray-800 text-lg mb-2">Xin chào! Tôi là Trợ lý AI</h2>
              <p className="text-gray-500 text-xs md:text-sm mb-6">
                Tôi có thể giúp bạn tìm kiếm món ăn ngon, xem thông tin các quán đối tác và đưa ra gợi ý phù hợp nhất với sở thích của bạn!
              </p>
              
              <div className="w-full text-left">
                <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Gợi ý câu hỏi:</p>
                <div className="grid grid-cols-1 gap-2">
                  {suggestions.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSendMessage(s)}
                      className="p-3 bg-white hover:bg-orange-50/50 border border-gray-150 hover:border-orange-200 text-xs md:text-sm text-gray-700 rounded-xl text-left transition-all shadow-2xs cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages list */
            <div className="space-y-4">
              {messages.map((msg) => {
                const isBot = msg.sender === 'bot';
                return (
                  <div key={msg.id} className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}>
                    {isBot && (
                      <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                        <Bot size={16} />
                      </div>
                    )}
                    
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-2xs ${
                      isBot 
                        ? 'bg-white text-gray-800 border border-gray-100 rounded-tl-xs' 
                        : 'bg-orange-500 text-white rounded-tr-xs'
                    }`}>
                      <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      {msg.time && (
                        <span className={`text-[10px] block mt-1 text-right ${isBot ? 'text-gray-400' : 'text-orange-200'}`}>
                          {msg.time}
                        </span>
                      )}
                    </div>

                    {!isBot && (
                      <div className="w-8 h-8 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center shrink-0">
                        <User size={16} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-start gap-2.5 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="bg-white border border-gray-100 max-w-[70%] rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce delay-200"></span>
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce delay-300"></span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Form Bar */}
        <div className="bg-white p-4 border-t border-gray-100 shadow-lg">
          <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded-2xl p-1.5 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={loading}
              placeholder={loading ? "AI đang trả lời..." : "Hỏi AI về món ăn, quán ăn, gợi ý thực đơn..."}
              className="flex-grow px-3 py-2 text-xs md:text-sm bg-transparent outline-none text-gray-800 disabled:opacity-50"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={loading || !input.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white p-2.5 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
