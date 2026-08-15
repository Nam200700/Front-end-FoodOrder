import { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuthStore } from '../stores/authStore';
import { validateWsMessage } from '../utils/wsMessageValidator';

/*
 * ⚠️ HOOK CŨ, HIỆN KHÔNG NƠI NÀO DÙNG — đã được thay bằng WebSocketContext
 * (kết nối dùng chung + ref-count subscription). Giữ lại để tham khảo.
 * Lưu ý: hook này dùng brokerURL với scheme ws:// nên KHÔNG dùng chung được
 * utils/wsUrl.js (địa chỉ ở đó là http:// cho SockJS). Nếu cần dùng lại thì
 * chuyển hẳn sang WebSocketContext thay vì sửa chỗ này.
 */
const WS_URL = import.meta.env.VITE_WS_URL || (
  import.meta.env.PROD
    ? (() => { throw new Error('[Config] VITE_WS_URL must be set in production!'); })()
    : 'ws://localhost:8080/ws'
);

/**
 * Hook kết nối WebSocket STOMP với Spring Boot Backend
 * Tự động đính kèm Bearer Token JWT khi handshake
 */
export function useWebSocket() {
  const token = useAuthStore((state) => state.token);
  const [connected, setConnected] = useState(false);
  const stompClientRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    // Thiết lập STOMP Client
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${token}`, // Đính kèm JWT khi handshake bảo mật
      },
      debug: (str) => {
        console.log('[STOMP DEBUG]: ', str);
      },
      reconnectDelay: 5000, // Tự động reconnect sau 5 giây nếu đứt kết nối
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = (frame) => {
      console.log('Connected to Spring Boot STOMP WebSocket! Frame: ' + frame);
      setConnected(true);
    };

    client.onDisconnect = () => {
      console.log('Disconnected from STOMP WebSocket.');
      setConnected(false);
    };

    client.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    // Bắt đầu kết nối
    client.activate();
    stompClientRef.current = client;

    // Dọn dẹp kết nối khi component unmount
    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        console.log('WebSocket Connection deactivated.');
      }
    };
  }, [token]);

  /**
   * Đăng ký nhận tin nhắn từ một Topic
   * @param {string} destination 
   * @param {function} onMessageReceived 
   * @returns {object} Subscription để unsubscribe khi unmount
   */
  const subscribe = (destination, onMessageReceived) => {
    if (!stompClientRef.current || !connected) {
      console.warn('STOMP Client is not connected yet. Cannot subscribe to ' + destination);
      return null;
    }

    return stompClientRef.current.subscribe(destination, (message) => {
      const payload = validateWsMessage(message.body);
      if (payload) {
        onMessageReceived(payload);
      }
    });
  };

  /**
   * Gửi tin nhắn lên một Destination
   * @param {string} destination 
   * @param {object} body 
   */
  const publish = (destination, body) => {
    if (!stompClientRef.current || !connected) {
      console.warn('STOMP Client is not connected. Cannot publish message to ' + destination);
      return;
    }

    stompClientRef.current.publish({
      destination,
      body: JSON.stringify(body),
    });
  };

  return {
    connected,
    subscribe,
    publish,
  };
}
