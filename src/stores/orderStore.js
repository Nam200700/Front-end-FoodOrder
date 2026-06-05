import { create } from 'zustand';

const MOCK_HISTORY = [
  {
    id: '12340',
    restaurantId: 'res-01',
    restaurantName: 'Quán Cơm Tấm Sườn Sài Gòn',
    restaurantImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
    items: [
      { id: 'food-01', name: 'Cơm Tấm Sườn Bì Chả Đặc Biệt', price: 55000, quantity: 2 },
      { id: 'food-06', name: 'Trà Đá Chanh', price: 10000, quantity: 2 },
    ],
    total: 115000, // gồm ship 20000 (3km) và giảm 20000
    subtotal: 110000,
    shippingFee: 20000,
    shippingDistance: 3.0,
    status: 'COMPLETED',
    createdAt: '27/05/2026 18:30',
    review: {
      restaurant_rating: 5,
      restaurant_comment: 'Đồ ăn cực ngon, sườn siêu dày và mềm. Sẽ đặt lại thường xuyên!',
      shipper_rating: 5,
      shipper_comment: 'Shipper giao hàng rất nhanh và thân thiện.',
      merchant_reply: 'Cảm ơn bạn nhiều ạ! Quán rất hân hạnh được phục vụ bạn.',
      replied_at: '27/05/2026 19:00'
    }
  },
  {
    id: '12338',
    restaurantId: 'res-02',
    restaurantName: 'Pizza Hut - Nguyễn Trãi',
    restaurantImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=150&q=80',
    items: [
      { id: 'pizza-01', name: 'Pizza Hải Sản Phô Mai Cao Cấp', price: 189000, quantity: 1 },
    ],
    total: 218000, // gồm ship 29000 (4.8km)
    subtotal: 189000,
    shippingFee: 29000,
    shippingDistance: 4.8,
    status: 'CANCELLED',
    createdAt: '26/05/2026 12:15',
    review: null
  }
];

export const useOrderStore = create((set, get) => ({
  activeOrder: null,
  orderHistory: MOCK_HISTORY,
  loading: false,
  timerId: null,

  createOrder: (cartItems, total, subtotal, shippingFee, shippingDistance, restaurantId, restaurantName, address, paymentMethod) => {
    // Dừng mọi mô phỏng đang chạy
    if (get().timerId) {
      clearInterval(get().timerId);
    }

    const newOrder = {
      id: Math.floor(10000 + Math.random() * 90000).toString(),
      restaurantId,
      restaurantName,
      items: cartItems,
      total,
      subtotal,
      shippingFee,
      shippingDistance,
      address,
      paymentMethod,
      status: 'PENDING',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamps: {
        PENDING: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      shipper: null,
      review: null,
    };

    set({ activeOrder: newOrder });
    return newOrder;
  },

  updateStatus: (status, extraFields = {}) => {
    const { activeOrder } = get();
    if (!activeOrder) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedTimestamps = {
      ...activeOrder.timestamps,
      [status]: timeStr,
    };

    const updatedOrder = {
      ...activeOrder,
      status,
      timestamps: updatedTimestamps,
      ...extraFields,
    };

    set({ activeOrder: updatedOrder });

    // Nếu đơn hoàn thành hoặc hủy, thêm vào history
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const historyItem = {
        id: activeOrder.id,
        restaurantId: activeOrder.restaurantId,
        restaurantName: activeOrder.restaurantName,
        restaurantImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
        items: activeOrder.items,
        total: activeOrder.total,
        subtotal: activeOrder.subtotal,
        shippingFee: activeOrder.shippingFee,
        shippingDistance: activeOrder.shippingDistance,
        status: status,
        createdAt: new Date().toLocaleDateString('vi-VN') + ' ' + timeStr,
        review: null,
      };

      set((state) => ({
        orderHistory: [historyItem, ...state.orderHistory],
      }));
    }
  },

  cancelOrder: () => {
    const { activeOrder } = get();
    if (!activeOrder) return;

    if (get().timerId) {
      clearInterval(get().timerId);
      set({ timerId: null });
    }

    get().updateStatus('CANCELLED');
  },

  // MÔ PHỎNG 7 TRẠNG THÁI ĐƠN HÀNG CHUẨN DATABASE
  simulateOrderProgress: () => {
    const { activeOrder, timerId } = get();
    if (!activeOrder) return;

    if (timerId) {
      clearInterval(timerId);
    }

    let currentStepIndex = 0;
    const steps = [
      { status: 'CONFIRMED', delay: 4000 },
      { status: 'PREPARING', delay: 5000 },
      { status: 'READY_FOR_PICKUP', delay: 4000 },
      { 
        status: 'PICKED_UP', 
        delay: 5000, 
        extra: { 
          shipper: { 
            name: 'Nguyễn Minh Tuấn', 
            avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', 
            rating: 4.9, 
            bike: 'Xe máy (Motorbike)', 
            plate: '29E2-678.90',
            phone: '0987654321'
          } 
        } 
      },
      { status: 'DELIVERING', delay: 6000 },
      { status: 'COMPLETED', delay: 5000 },
    ];

    const runNextStep = () => {
      if (currentStepIndex >= steps.length) {
        clearInterval(get().timerId);
        set({ timerId: null });
        return;
      }

      const nextStep = steps[currentStepIndex];
      const tid = setTimeout(() => {
        get().updateStatus(nextStep.status, nextStep.extra || {});
        
        // Mô phỏng đẩy Push Notification tương ứng
        if (window.dispatchEvent) {
          const eventName = `notify_${nextStep.status}`;
          window.dispatchEvent(new CustomEvent(eventName, { detail: { orderId: activeOrder.id } }));
        }

        currentStepIndex++;
        runNextStep();
      }, nextStep.delay);

      set({ timerId: tid });
    };

    runNextStep();
  },

  stopSimulation: () => {
    const { timerId } = get();
    if (timerId) {
      clearInterval(timerId);
      set({ timerId: null });
    }
  },

  // THÊM ĐÁNH GIÁ (REVIEWS) CHUẨN DATABASE (1 ĐƠN = 1 REVIEW)
  addReview: (orderId, { restaurant_rating, restaurant_comment, shipper_rating, shipper_comment }) => {
    set((state) => ({
      orderHistory: state.orderHistory.map((order) =>
        order.id === orderId
          ? {
              ...order,
              review: {
                restaurant_rating,
                restaurant_comment,
                shipper_rating,
                shipper_comment,
                merchant_reply: null,
                replied_at: null
              }
            }
          : order
      ),
    }));
  },

  // CHỦ QUÁN PHẢN HỒI ĐÁNH GIÁ (MERCHANT REPLY)
  addMerchantReply: (orderId, replyText) => {
    const timeStr = new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    set((state) => ({
      orderHistory: state.orderHistory.map((order) =>
        order.id === orderId && order.review
          ? {
              ...order,
              review: {
                ...order.review,
                merchant_reply: replyText,
                replied_at: timeStr
              }
            }
          : order
      ),
    }));
  }
}));
