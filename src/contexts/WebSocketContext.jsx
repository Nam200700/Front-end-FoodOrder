import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuthStore } from '../stores/authStore';

const WebSocketContext = createContext(null);
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';

export function WebSocketProvider({ children }) {
  const token = useAuthStore((state) => state.token);
  const [connected, setConnected] = useState(false);
  const stompClientRef = useRef(null);

  useEffect(() => {
    // Chỉ kích hoạt socket khi người dùng đã đăng nhập (có token)
    if (!token) {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
        setConnected(false);
        console.log('[WebSocket Context]: Disconnected due to logout.');
      }
      return;
    }

    console.log('[WebSocket Context]: Connecting...');
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL.replace(/^ws/, 'http')),
      connectHeaders: {
        Authorization: `Bearer ${token}`, // Đính kèm JWT khi handshake bảo mật
      },
      debug: (str) => {
        // Chỉ log khi cần thiết hoặc để ẩn log debug nếu quá dài
        console.log('[WebSocket STOMP]: ', str);
      },
      reconnectDelay: 5000, // Tự động reconnect sau 5 giây nếu đứt kết nối
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = (frame) => {
      console.log('[WebSocket Context]: Connected to Spring Boot! Frame: ' + frame);
      setConnected(true);
    };

    client.onDisconnect = () => {
      console.log('[WebSocket Context]: Disconnected.');
      setConnected(false);
    };

    client.onStompError = (frame) => {
      console.error('[WebSocket Context]: Broker reported error: ' + frame.headers['message']);
      console.error('[WebSocket Context]: Additional details: ' + frame.body);
    };

    client.activate();
    stompClientRef.current = client;

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
        setConnected(false);
        console.log('[WebSocket Context]: Cleaned up on unmount.');
      }
    };
  }, [token]);

  /**
   * Đăng ký nhận tin nhắn từ một Topic
   * @param {string} destination Topic muốn subscribe
   * @param {function} callback Hàm callback nhận tin nhắn
   * @returns {object} Subscription để gọi unsubscribe
   */
  const subscribe = (destination, callback) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) {
      console.warn('[WebSocket Context]: Not connected. Cannot subscribe to ' + destination);
      
      // Đăng ký xếp hàng chờ khi đã connect
      let retryCount = 0;
      const interval = setInterval(() => {
        retryCount++;
        if (stompClientRef.current && stompClientRef.current.connected) {
          clearInterval(interval);
          const sub = stompClientRef.current.subscribe(destination, (message) => {
            try {
              callback(JSON.parse(message.body));
            } catch (e) {
              callback(message.body);
            }
          });
          return sub;
        }
        if (retryCount > 10) {
          clearInterval(interval);
          console.error('[WebSocket Context]: Failed to subscribe after 10 attempts to ' + destination);
        }
      }, 1000);

      return {
        unsubscribe: () => clearInterval(interval)
      };
    }

    return stompClientRef.current.subscribe(destination, (message) => {
      try {
        const payload = JSON.parse(message.body);
        callback(payload);
      } catch (e) {
        callback(message.body);
      }
    });
  };

  /**
   * Gửi tin nhắn lên một Destination (Topic/Queue)
   * @param {string} destination Destination gửi tin nhắn
   * @param {object} body Nội dung tin nhắn gửi đi
   */
  const publish = (destination, body) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) {
      console.warn('[WebSocket Context]: Not connected. Cannot publish message to ' + destination);
      return;
    }

    stompClientRef.current.publish({
      destination,
      body: JSON.stringify(body),
    });
  };

  return (
    <WebSocketContext.Provider value={{ connected, subscribe, publish }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
