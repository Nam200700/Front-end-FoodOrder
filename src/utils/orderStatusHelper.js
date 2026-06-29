import { toast } from 'react-toastify';

export const STATUS_META = {
  // Trạng thái đơn hàng (OrderStatus)
  PENDING: {
    label: 'Đặt hàng thành công',
    toastText: null, // Không hiện Toast khi vừa đặt hàng xong (đã có flow đặt hàng thành công)
    color: 'slate',
  },
  CONFIRMED: {
    label: 'Quán đã xác nhận',
    toastText: 'Đơn hàng #{orderId}: Quán đã xác nhận đơn hàng!',
    color: 'md-primary',
  },
  PREPARING: {
    label: 'Đang chuẩn bị món',
    toastText: 'Đơn hàng #{orderId}: Quán đang chuẩn bị món ăn!',
    color: 'md-primary',
  },
  READY_FOR_PICKUP: {
    label: 'Chờ shipper lấy hàng',
    toastText: 'Đơn hàng #{orderId}: Món ăn đã chuẩn bị xong! Đang chờ tài xế đến lấy món.',
    color: 'md-secondary',
  },
  PICKED_UP: {
    label: 'Đang giao tới bạn',
    toastText: 'Đơn hàng #{orderId}: Shipper đã lấy món ăn và đang giao tới bạn! Hãy chuẩn bị nhận món.',
    color: 'md-tertiary',
  },
  DELIVERING: {
    label: 'Đang giao tới bạn',
    toastText: null, // Đặt là null vì đã hiển thị Toast ở PICKED_UP (tránh nổ 2 Toast trùng lặp)
    color: 'md-tertiary',
  },
  COMPLETED: {
    label: 'Giao hàng thành công',
    toastText: 'Đơn hàng #{orderId}: Đã giao thành công! Ăn ngon miệng nhé!',
    color: 'md-tertiary',
  },
  CANCELLED: {
    label: 'Đơn hàng đã bị hủy',
    toastText: 'Đơn hàng #{orderId} đã bị hủy.',
    color: 'md-error',
  },

  // Map các sự kiện từ Hàng đợi Thông báo Cá nhân (NotificationType)
  ORDER_CONFIRMED: {
    toastText: 'Đơn hàng #{orderId}: Quán đã xác nhận đơn hàng!',
  },
  ORDER_PREPARING: {
    toastText: 'Đơn hàng #{orderId}: Quán đang chuẩn bị món ăn!',
  },
  ORDER_READY_PICKUP: {
    toastText: 'Đơn hàng #{orderId}: Món ăn đã chuẩn bị xong! Đang chờ tài xế đến lấy món.',
  },
  SHIPPER_ASSIGNED: {
    toastText: 'Đơn hàng #{orderId}: Đã tìm thấy tài xế giao hàng! Đang đến quán lấy món.',
  },
  ORDER_COMPLETED: {
    toastText: 'Đơn hàng #{orderId}: Đã giao thành công! Ăn ngon miệng nhé!',
  },
  ORDER_CANCELLED: {
    toastText: 'Đơn hàng #{orderId} đã bị hủy.',
  },
};

// Chuẩn hóa WebSocket payload từ cả hai nguồn: OrderStatusEvent và NotificationEvent
export function parseOrderEvent(payload) {
  if (!payload) return null;

  // Trường hợp 1: Nhận từ user queue /queue/notify (NotificationEvent)
  if (payload.type && payload.refId !== undefined && payload.refId !== null) {
    return {
      orderId: payload.refId.toString(),
      status: payload.type, // ORDER_CONFIRMED, SHIPPER_ASSIGNED, v.v.
      timestamp: payload.timestamp || new Date().toISOString(),
      shipperId: null,
    };
  }

  // Trường hợp 2: Nhận từ /topic/order/${id} (OrderStatusEvent)
  const status = payload.newStatus || payload.orderStatus;
  const orderId = payload.orderId || payload.id;

  if (!status || !orderId) return null;

  return {
    orderId: orderId.toString(),
    status: status,
    timestamp: payload.timestamp || new Date().toISOString(),
    shipperId: payload.shipperId || null,
  };
}

// Bộ nhớ đệm lưu trữ lịch sử Toast để chống trùng lặp (deduping)
const toastHistory = {}; // Key: `${orderId}_${status}`, Value: timestamp

export function notifyStatusChange(parsedEvent) {
  if (!parsedEvent) return;

  const { orderId, status } = parsedEvent;
  const meta = STATUS_META[status];

  // Nếu trạng thái không được cấu hình Toast text thì bỏ qua
  if (!meta || !meta.toastText) return;

  const key = `${orderId}_${status}`;
  const now = Date.now();

  // Ngăn hiển thị Toast trùng lặp trong vòng 3 giây
  if (toastHistory[key] && now - toastHistory[key] < 3000) {
    console.log(`[Toast Dedupe]: Blocked duplicate toast for ${key}`);
    return;
  }
  toastHistory[key] = now;

  const message = meta.toastText.replace('#{orderId}', orderId);

  // Chọn loại toast phù hợp với trạng thái
  if (status === 'CANCELLED' || status === 'ORDER_CANCELLED') {
    toast.error(message, {
      position: 'top-right',
      autoClose: 6000,
      theme: 'colored',
    });
  } else if (
    status === 'READY_FOR_PICKUP' || 
    status === 'ORDER_READY_PICKUP' ||
    status === 'CONFIRMED' || 
    status === 'ORDER_CONFIRMED' ||
    status === 'SHIPPER_ASSIGNED'
  ) {
    toast.info(message, {
      position: 'top-right',
      autoClose: 6000,
      theme: 'colored',
    });
  } else {
    toast.success(message, {
      position: 'top-right',
      autoClose: 6000,
      theme: 'colored',
    });
  }
}

export const STATUS_CONFIG = {
  PENDING:          { label: 'Chờ xác nhận',     badgeClass: 'bg-amber-50 text-amber-750 border-amber-200' },
  CONFIRMED:        { label: 'Đã xác nhận',      badgeClass: 'bg-blue-50 text-blue-750 border-blue-200' },
  ACCEPTED:         { label: 'Đã chấp nhận',     badgeClass: 'bg-blue-50 text-blue-750 border-blue-200' },
  PREPARING:        { label: 'Đang chuẩn bị',    badgeClass: 'bg-violet-50 text-violet-750 border-violet-200' },
  READY_FOR_PICKUP: { label: 'Chờ shipper lấy',  badgeClass: 'bg-sky-50 text-sky-750 border-sky-200' },
  PICKED_UP:        { label: 'Đang giao hàng',   badgeClass: 'bg-indigo-50 text-indigo-750 border-indigo-200' },
  DELIVERING:       { label: 'Đang giao',        badgeClass: 'bg-indigo-50 text-indigo-750 border-indigo-200' },
  COMPLETED:        { label: 'Hoàn thành',       badgeClass: 'bg-emerald-50 text-emerald-750 border-emerald-200' },
  CANCELLED:        { label: 'Đã hủy',           badgeClass: 'bg-red-50 text-red-750 border-red-200' },
};

export const getStatusConfig = (status) =>
  STATUS_CONFIG[status] ?? { label: status, badgeClass: 'bg-slate-50 text-slate-550 border-slate-200' };

export const ROLE_LABELS = {
  CUSTOMER: 'Khách hàng', 
  OWNER: 'Chủ quán', 
  MERCHANT: 'Chủ quán',
  SHIPPER: 'Tài xế', 
  ADMIN: 'Ban quản trị',
};
export const getRoleLabel = (role) => ROLE_LABELS[role] ?? role;

