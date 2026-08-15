import { create } from 'zustand';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import apiClient from '../services/api';
import { useAuthStore } from './authStore';
// Dùng CHUNG địa chỉ với WebSocketContext — trước đây hai nơi đọc hai biến khác nhau
// nên khi deploy chỉ khai một biến thì chat âm thầm trỏ về localhost.
import { WS_URL as WS_BASE_URL } from '../utils/wsUrl';

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: {}, // { [convId]: [messages] }
  stompClient: null,
  connected: false,
  subscribedConvIds: new Set(), // Quản lý danh sách các convId đã subscribe để tránh lặp subscription

  // Tải danh sách cuộc trò chuyện từ API thật
  fetchConversations: async () => {
    try {
      const response = await apiClient.get('/conversations');
      const realConvs = response.data?.data || [];
      const currentUserId = useAuthStore.getState().user?.id;

      const mapped = realConvs.map((c) => {
        const timeStr = c.lastMessageAt
          ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';
        return {
          id: c.conversationId.toString(),
          participantId: c.otherUserId.toString(),
          participantName: c.otherUserName || 'Người dùng',
          participantAvatar: c.otherUserAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
          lastMessage: 'Nhấn vào để xem tin nhắn...',
          lastMessageTime: timeStr,
          unreadCount: 0,
          role: 'PARTICIPANT', // Phân vai trò chung
        };
      });

      set({ conversations: mapped });

      // Sau khi tải danh sách, nếu có stompClient đang connect, hãy tiến hành subscribe cho các cuộc trò chuyện mới
      const { stompClient, connected } = get();
      if (connected && stompClient) {
        mapped.forEach((c) => {
          get().subscribeToConversation(c.id);
        });
      }
    } catch (err) {
      console.error('[Chat Store]: Error fetching conversations:', err);
    }
  },

  // Tải tin nhắn của một cuộc trò chuyện thật sự từ DB
  fetchMessages: async (convId) => {
    try {
      const response = await apiClient.get(`/conversations/${convId}/messages?size=100`);
      const pageData = response.data?.data;
      const realMsgs = pageData?.content || [];
      const currentUserId = useAuthStore.getState().user?.id;

      const mapped = realMsgs.map((m) => {
        const timeStr = m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';
        return {
          id: m.messageId.toString(),
          conversationId: m.conversationId.toString(),
          content: m.content,
          senderId: m.senderId.toString(),
          time: timeStr,
          isSelf: m.senderId === currentUserId,
        };
      });

      // API trả về tin nhắn mới nhất trước (Desc), Front-end hiển thị từ cũ đến mới (Asc)
      const sorted = [...mapped].reverse();

      set((state) => ({
        messages: {
          ...state.messages,
          [convId]: sorted,
        },
      }));

      // Cập nhật lastMessage của conversation dựa trên tin nhắn cuối cùng
      if (sorted.length > 0) {
        const lastMsg = sorted[sorted.length - 1];
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === convId
              ? { ...c, lastMessage: lastMsg.content, lastMessageTime: lastMsg.time }
              : c
          ),
        }));
      }
    } catch (err) {
      console.error(`[Chat Store]: Error fetching messages for conv ${convId}:`, err);
    }
  },

  setActiveConversation: (convId) => {
    if (!convId) {
      set({ activeConversation: null });
      return;
    }
    set({ activeConversation: convId });
    get().fetchMessages(convId);
    get().markConvRead(convId);
  },

  // Thiết lập kết nối STOMP WebSocket thật
  connectWebSocket: () => {
    const { connected, stompClient } = get();
    if (connected || stompClient) return; // Đã kết nối hoặc đang có client thì bỏ qua

    const token = useAuthStore.getState().token;
    if (!token) {
      console.warn('[Chat Store]: Cannot connect WebSocket, token is empty.');
      return;
    }

    console.log('[Chat Store]: Connecting to WebSocket STOMP...');
    
    // Tạo SockJS connection
    const socket = new SockJS(WS_BASE_URL);
    
    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        // Chỉ log debug khi cần thiết
      },
      onConnect: () => {
        console.log('[Chat Store]: STOMP WebSocket Connected Successfully!');
        set({ connected: true, stompClient: client });

        // Tải danh sách conversations và tự động subscribe
        get().fetchConversations();
      },
      onDisconnect: () => {
        console.log('[Chat Store]: STOMP WebSocket Disconnected.');
        set({ connected: false, stompClient: null, subscribedConvIds: new Set() });
      },
      onStompError: (frame) => {
        console.error('[Chat Store]: STOMP Protocol Error:', frame.headers['message']);
        set({ connected: false, stompClient: null, subscribedConvIds: new Set() });
      },
    });

    client.activate();
  },

  // Ngắt kết nối WebSocket
  disconnectWebSocket: () => {
    const { stompClient } = get();
    if (stompClient) {
      console.log('[Chat Store]: Disconnecting WebSocket...');
      stompClient.deactivate();
      set({ connected: false, stompClient: null, subscribedConvIds: new Set() });
    }
  },

  // Subscribe vào topic cụ thể của cuộc trò chuyện
  subscribeToConversation: (convId) => {
    const { stompClient, connected, subscribedConvIds } = get();
    if (!connected || !stompClient || subscribedConvIds.has(convId)) return;

    console.log(`[Chat Store]: Subscribing to topic /topic/chat/${convId}`);
    stompClient.subscribe(`/topic/chat/${convId}`, (messageFrame) => {
      try {
        const rawMsg = JSON.parse(messageFrame.body);
        const currentUserId = useAuthStore.getState().user?.id;
        const timeStr = rawMsg.createdAt
          ? new Date(rawMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';

        const newMsg = {
          id: rawMsg.messageId.toString(),
          conversationId: rawMsg.conversationId.toString(),
          content: rawMsg.content,
          senderId: rawMsg.senderId.toString(),
          time: timeStr,
          isSelf: rawMsg.senderId === currentUserId,
        };

        // Thêm tin nhắn mới vào danh sách tin nhắn hiện tại
        set((state) => {
          const currentMsgs = state.messages[convId] || [];
          // Tránh tin nhắn trùng lặp do nhận phản hồi cùng lúc
          const isDuplicate = currentMsgs.some((m) => m.id === newMsg.id);
          const updatedMsgs = isDuplicate ? currentMsgs : [...currentMsgs, newMsg];

          // Cập nhật conversation list
          const updatedConvs = state.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  lastMessage: newMsg.content,
                  lastMessageTime: newMsg.time,
                  unreadCount: state.activeConversation === convId ? 0 : c.unreadCount + 1,
                }
              : c
          );

          return {
            messages: {
              ...state.messages,
              [convId]: updatedMsgs,
            },
            conversations: updatedConvs,
          };
        });
      } catch (err) {
        console.error('[Chat Store]: Error parsing incoming WebSocket message:', err);
      }
    });

    // Ghi nhận đã subscribe thành công
    set((state) => {
      const updated = new Set(state.subscribedConvIds);
      updated.add(convId);
      return { subscribedConvIds: updated };
    });
  },

  // Gửi tin nhắn thực tế qua STOMP Destination /app/chat/{convId}
  sendMessage: (convId, text) => {
    const { stompClient, connected } = get();
    if (!connected || !stompClient) {
      console.warn('[Chat Store]: Cannot send message, WebSocket is not connected!');
      alert('Kết nối chat bị gián đoạn. Đang thử kết nối lại...');
      get().connectWebSocket();
      return;
    }

    try {
      console.log(`[Chat Store]: Sending message to /app/chat/${convId}`);
      stompClient.publish({
        destination: `/app/chat/${convId}`,
        body: JSON.stringify({ content: text }),
      });
    } catch (err) {
      console.error('[Chat Store]: Error publishing message:', err);
    }
  },

  markConvRead: (convId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, unreadCount: 0 } : c
      ),
    }));
  },

  // KHỞI TẠO CUỘC CHAT CÓ GẮN VỚI OTHER_USER_ID CHUẨN DATABASE
  startNewConversation: async (otherUserId, participantName, participantAvatar, role) => {
    if (!otherUserId) {
      console.error('[Chat Store]: Cannot start conversation without otherUserId');
      return null;
    }

    try {
      console.log(`[Chat Store]: Opening conversation with user ${otherUserId}...`);
      // Gọi API POST /conversations để get-or-create cuộc trò chuyện thật trên DB
      const response = await apiClient.post(`/conversations?otherUserId=${otherUserId}`);
      const convData = response.data?.data;
      
      if (!convData || !convData.conversationId) {
        throw new Error('API did not return a valid conversation');
      }

      const convId = convData.conversationId.toString();

      // Reload conversations list
      await get().fetchConversations();

      // Subscribe vào cuộc trò chuyện mới
      get().subscribeToConversation(convId);

      // Đặt cuộc trò chuyện hiện tại là convId
      set({ activeConversation: convId });
      
      // Tải tin nhắn
      await get().fetchMessages(convId);

      return convId;
    } catch (err) {
      console.error('[Chat Store]: Error starting new conversation:', err);
      alert('Không thể bắt đầu cuộc trò chuyện. Vui lòng kiểm tra lại!');
      return null;
    }
  }
}));
