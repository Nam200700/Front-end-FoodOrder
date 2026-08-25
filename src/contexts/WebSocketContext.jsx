import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuthStore } from '../stores/authStore';
import { validateWsMessage } from '../utils/wsMessageValidator';
import { WS_URL } from '../utils/wsUrl';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const token = useAuthStore((state) => state.token);
  const [connected, setConnected] = useState(false);
  const stompClientRef = useRef(null);
  
  // Lưu trữ các subscriptions đang hoạt động toàn hệ thống
  // Cấu trúc: { [destination]: { stompSubscription: Object|null, callbacks: Set<Function> } }
  const activeSubscriptionsRef = useRef({});

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
      // WS_URL đã được utils/wsUrl.js chuẩn hoá sẵn scheme, không đổi lại ở đây nữa:
      // phép replace cũ (/^ws/) sẽ cắt nhầm nếu địa chỉ là đường dẫn tương đối.
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token}`, // Đính kèm JWT khi handshake bảo mật
      },
      debug: (str) => {
        // Chỉ log debug khi thật sự cần thiết
        console.log('[WebSocket STOMP Debug]: ', str);
      },
      reconnectDelay: 5000, // Tự động reconnect sau 5 giây nếu đứt kết nối
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = (frame) => {
      console.log('[WebSocket Context]: Connected to Spring Boot! Frame: ' + frame);
      setConnected(true);

      // Khi kết nối thành công, tự động re-subscribe cho tất cả các destinations đang xếp hàng
      Object.keys(activeSubscriptionsRef.current).forEach((destination) => {
        const sub = activeSubscriptionsRef.current[destination];
        if (!sub.stompSubscription) {
          console.log(`[WebSocket Context]: Activating queued subscription for ${destination}`);
          try {
            const stompSub = client.subscribe(destination, (message) => {
              const payload = validateWsMessage(message.body);
              if (!payload) return; // Malformed payload or validation failed, ignore
              
              const currentSub = activeSubscriptionsRef.current[destination];
              if (currentSub) {
                currentSub.callbacks.forEach((cb) => cb(payload));
              }
            });
            sub.stompSubscription = stompSub;
          } catch (err) {
            console.error(`[WebSocket Context]: Failed to subscribe to ${destination} on connect:`, err);
          }
        }
      });
    };

    client.onDisconnect = () => {
      console.log('[WebSocket Context]: Disconnected.');
      setConnected(false);
      
      // Xóa thực thể STOMP subscription của server khi đứt kết nối (cần subscribe lại khi connect lại)
      Object.keys(activeSubscriptionsRef.current).forEach((destination) => {
        activeSubscriptionsRef.current[destination].stompSubscription = null;
      });
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
   * Đăng ký nhận tin nhắn từ một Topic (Sử dụng cơ chế Ref-count để dùng chung subscription)
   * @param {string} destination Topic muốn subscribe
   * @param {function} callback Hàm callback nhận tin nhắn
   * @returns {object} Subscription chứa hàm unsubscribe để hủy callback tương ứng
   */
  const subscribe = (destination, callback) => {
    // 1. Nếu chưa có subscription cho destination này
    if (!activeSubscriptionsRef.current[destination]) {
      activeSubscriptionsRef.current[destination] = {
        stompSubscription: null,
        callbacks: new Set([callback]),
      };

      // Nếu client đang connected thì đăng ký trực tiếp lên server
      if (stompClientRef.current && stompClientRef.current.connected) {
        console.log(`[WebSocket Context]: First subscribe on ${destination}. Calling STOMP client.subscribe.`);
        try {
          const stompSub = stompClientRef.current.subscribe(destination, (message) => {
            const payload = validateWsMessage(message.body);
            if (!payload) return; // Malformed payload or validation failed, ignore
            
            const currentSub = activeSubscriptionsRef.current[destination];
            if (currentSub) {
              currentSub.callbacks.forEach((cb) => cb(payload));
            }
          });
          activeSubscriptionsRef.current[destination].stompSubscription = stompSub;
        } catch (err) {
          console.error(`[WebSocket Context]: STOMP subscription error for ${destination}:`, err);
        }
      } else {
        console.log(`[WebSocket Context]: Connection not ready. Subscription to ${destination} queued.`);
      }
    } else {
      // Đã có kết nối cho destination này, chỉ cần add callback vào để chia sẻ luồng dữ liệu (refCount++)
      console.log(`[WebSocket Context]: Reusing active subscription for ${destination}. Current listener count: ${activeSubscriptionsRef.current[destination].callbacks.size + 1}`);
      activeSubscriptionsRef.current[destination].callbacks.add(callback);
    }

    // Trả về đối tượng dọn dẹp subscription
    return {
      unsubscribe: () => {
        const sub = activeSubscriptionsRef.current[destination];
        if (!sub) return;

        sub.callbacks.delete(callback);
        console.log(`[WebSocket Context]: Removed listener from ${destination}. Remaining count: ${sub.callbacks.size}`);

        // Nếu không còn component nào lắng nghe destination này nữa
        if (sub.callbacks.size === 0) {
          if (sub.stompSubscription) {
            console.log(`[WebSocket Context]: No listeners remaining. Unsubscribing destination ${destination} from server.`);
            try {
              sub.stompSubscription.unsubscribe();
            } catch (err) {
              console.warn(`[WebSocket Context]: Error when unsubscribing from server:`, err);
            }
          }
          delete activeSubscriptionsRef.current[destination];
        }
      }
    };
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
