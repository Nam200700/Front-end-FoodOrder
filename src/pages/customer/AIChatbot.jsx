import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, RefreshCw, ArrowLeft, Calendar } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../services/api';

export default function AIChatbot({ isPublic = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date groups for sidebar navigation
  const [dateGroups, setDateGroups] = useState([]);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});

  // Suggestions for user to click
  const suggestions = [
    "Gợi ý món ăn tối nay cho tôi",
    "Có quán ăn nào ngon gần đây không?",
    "Tôi muốn ăn đồ Hàn Quốc, hệ thống có món gì?",
    "Hỏi thông tin về an toàn hệ thống"
  ];

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const endpoint = isPublic ? '/auth/chatbot/history' : '/chatbot/history';
      const response = await apiClient.get(endpoint);
      const historyData = response.data.data || [];
      
      // Map API fields
      const mapped = historyData.map((msg, index) => {
        // Safe date parsing
        let dateObj = null;
        let dateStr = 'Trước đây';
        let timeStr = '';
        
        if (msg.createdAt) {
          try {
            if (Array.isArray(msg.createdAt)) {
              const [year, month, day, hour, minute] = msg.createdAt;
              dateObj = new Date(year, month - 1, day, hour, minute);
            } else {
              dateObj = new Date(msg.createdAt);
            }
            if (!isNaN(dateObj.getTime())) {
              dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
              timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          } catch (e) {
            console.error(e);
          }
        }

        return {
          id: msg.messageId || `msg_${index}_${Math.random()}`,
          sender: msg.sender ? msg.sender.toLowerCase() : 'bot',
          text: msg.content || '',
          dateLabel: dateStr,
          time: timeStr
        };
      });

      setMessages(mapped);

      // Extract unique dates for sidebar grouping
      const uniqueDates = [];
      mapped.forEach(msg => {
        if (msg.dateLabel && !uniqueDates.includes(msg.dateLabel)) {
          uniqueDates.push(msg.dateLabel);
        }
      });
      setDateGroups(uniqueDates);

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

  const scrollToDate = (dateLabel) => {
    // Find first message of this date group
    const firstMsgOfDate = messages.find(m => m.dateLabel === dateLabel);
    if (firstMsgOfDate && messageRefs.current[firstMsgOfDate.id]) {
      messageRefs.current[firstMsgOfDate.id].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || input.trim();
    if (!text) return;

    if (!textToSend) setInput('');
    setError(null);

    // Add user message locally
    const userMsg = {
      id: `temp_${Math.random()}`,
      sender: 'user',
      text: text,
      dateLabel: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const endpoint = isPublic ? '/auth/chatbot/chat' : '/chatbot/chat';
      const response = await apiClient.post(endpoint, { message: text }, { timeout: 60000 });
      const result = response.data.data;
      
      // Add Bot reply locally
      const botMsg = {
        id: `temp_${Math.random()}`,
        sender: 'bot',
        text: result.reply,
        dateLabel: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      
      // Re-extract date groups in case a new day started
      const todayStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      setDateGroups(prev => prev.includes(todayStr) ? prev : [...prev, todayStr]);
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
      
      {/* ─── SIDEBAR: TIMELINE HISTORY ─── */}
      <div className="hidden md:flex w-68 bg-white border-r border-gray-200 flex-col h-full shrink-0 animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">Lịch sử trò chuyện</span>
          <button 
            onClick={fetchHistory}
            disabled={historyLoading}
            className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
            title="Làm mới lịch sử"
          >
            <RefreshCw size={14} className={historyLoading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-3 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 px-3 uppercase tracking-wider mb-2">Các ngày nhắn tin</p>
          {dateGroups.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">Chưa có tin nhắn nào</div>
          ) : (
            dateGroups.map((date) => (
              <button 
                key={date} 
                onClick={() => scrollToDate(date)} 
                className="w-full text-left py-2.5 px-3 rounded-xl text-xs md:text-sm font-medium text-gray-600 hover:text-orange-600 hover:bg-orange-50 border border-transparent hover:border-orange-100/50 transition-all truncate flex items-center gap-2.5 cursor-pointer"
              >
                <Calendar size={14} className="text-gray-400" />
                <span className="truncate">Ngày {date}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ─── MAIN CHAT AREA ─── */}
      <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const fromPath = location.state?.from || '/';
                navigate(fromPath);
              }} 
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
            <button 
              onClick={fetchHistory} 
              disabled={historyLoading} 
              title="Tải lại lịch sử"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              <RefreshCw size={18} className={historyLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 text-red-700 px-6 py-3 flex items-center gap-2 border-b border-red-100">
            <AlertCircle size={18} className="shrink-0" />
            <span className="text-xs md:text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {historyLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Đang tải lịch sử trò chuyện...</span>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State */
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
            <div className="space-y-4 animate-fade-in">
              {messages.map((msg, index) => {
                const isBot = msg.sender === 'bot';
                
                // Show date separator if date changes
                const showSeparator = index === 0 || messages[index - 1].dateLabel !== msg.dateLabel;
                
                return (
                  <div key={msg.id} ref={el => messageRefs.current[msg.id] = el}>
                    {showSeparator && (
                      <div className="flex items-center justify-center my-6">
                        <div className="h-px bg-gray-200 flex-grow"></div>
                        <span className="mx-4 text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">
                          Ngày {msg.dateLabel}
                        </span>
                        <div className="h-px bg-gray-200 flex-grow"></div>
                      </div>
                    )}
                    
                    <div className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'} mt-3`}>
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
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-start gap-2.5 justify-start mt-3">
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
