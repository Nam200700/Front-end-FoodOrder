import { getAvatarUrl } from './avatarHelper';

/**
 * Map dữ liệu thô từ API của Order về định dạng chuẩn dùng trên UI của Customer, Merchant và Shipper.
 *
 * @param {Object} ord - Đối tượng Order thô nhận từ API
 * @returns {Object|null} Đối tượng Order đã được chuẩn hóa hoặc null
 */
export const mapOrder = (ord) => {
  if (!ord) return null;

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatDateTime = (timeStr) => {
    if (!timeStr) return '';
    const dateObj = new Date(timeStr);
    return (
      dateObj.toLocaleDateString('vi-VN') +
      ' ' +
      String(dateObj.getHours()).padStart(2, '0') +
      ':' +
      String(dateObj.getMinutes()).padStart(2, '0')
    );
  };

  return {
    id: ord.orderId?.toString() || ord.id?.toString(),
    restaurantId: ord.restaurantId?.toString() || ord.restaurant?.restaurantId?.toString(),
    restaurantName: ord.restaurantName || ord.restaurant?.restaurantName || 'Quán Ăn AntiGravity',
    restaurantImage: ord.imageUrl || ord.restaurantImageUrl || ord.restaurant?.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
    customerId: ord.customerId?.toString(),
    customerName: ord.customerName || ord.customer?.name || 'Khách hàng',
    customerPhone: ord.customerPhone || ord.customer?.phone || '',
    items: (ord.items || ord.orderItems || []).map((i) => ({
      id: i.foodId?.toString() || i.id?.toString() || '',
      name: i.foodName || i.name || '',
      price: Number(i.priceAtOrder || i.price || 0),
      quantity: i.quantity,
      note: i.note || '',
    })),
    itemsCount: (ord.items || ord.orderItems || []).reduce((sum, item) => sum + item.quantity, 0),
    subtotalAmount: Number(ord.subtotalAmount),
    total: Number(ord.totalAmount || ord.total || 0),
    shippingFee: Number(ord.shippingFee || ord.deliveryFee || 0),
    address: ord.deliveryAddress || ord.address || '',
    deliveryLat: ord.deliveryLat ? Number(ord.deliveryLat) : null,
    deliveryLng: ord.deliveryLng ? Number(ord.deliveryLng) : null,
    paymentMethod: ord.paymentMethod || 'COD',
    status: ord.orderStatus || ord.status, // PENDING, CONFIRMED, PREPARING, READY_FOR_PICKUP, PICKED_UP, DELIVERING, COMPLETED, CANCELLED
    createdAt: formatDateTime(ord.createdAt || ord.orderTime),
    createdAtTime: formatTime(ord.createdAt || ord.orderTime),
    confirmedAt: formatTime(ord.confirmedAt),
    completedAt: formatTime(ord.completedAt),
    preparingAt: formatTime(ord.preparingAt),
    readyAt: formatTime(ord.readyAt),
    pickedUpAt: formatTime(ord.pickedUpAt),
    reviewed: ord.reviewed || false,
    rating: ord.restaurantRating || 5,
    note: ord.note || '',
    cancelReason: ord.cancelReason || '',
    shipper: ord.shipperId ? {
      id: ord.shipperId,
      name: ord.shipperName || 'Tài xế',
      // Avatar thật của tài xế nếu có; rỗng thì dùng ảnh mặc định SVG (giống fallback của customer),
      // không hardcode ảnh người lạ nữa.
      avatar: getAvatarUrl(ord.shipperAvatar),
      rating: 4.9,
      bike: ord.shipperVehicleType === 'MOTORBIKE' ? 'Xe máy (Motorbike)' :
            ord.shipperVehicleType === 'BICYCLE' ? 'Xe đạp (Bicycle)' :
            ord.shipperVehicleType === 'CAR' ? 'Ô tô (Car)' : 'Phương tiện giao hàng',
      plate: ord.shipperLicensePlate || 'Chưa cập nhật biển số',
      phone: ord.shipperPhone || '0987654321',
    } : null
  };
};

/**
 * Map dữ liệu thô từ API của Restaurant về định dạng chuẩn dùng trên UI.
 *
 * @param {Object} r - Đối tượng Restaurant thô nhận từ API
 * @returns {Object|null} Đối tượng Restaurant đã được chuẩn hóa hoặc null
 */
export const mapRestaurant = (r) => {
  if (!r) return null;
  return {
    id: r.restaurantId?.toString() || r.id?.toString(),
    name: r.restaurantName || r.name || '',
    image: r.imageUrl || r.restaurantImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    address: r.address || r.restaurantAddress || '',
    latitude: r.latitude || r.restaurantLatitude,
    longitude: r.longitude || r.restaurantLongitude,
    rating: Number(r.rating || r.averageRating || 5.0),
    reviewsCount: r.reviewsCount || r.reviewCount || 0,
    orderCount: r.orderCount || 0,
    tags: [r.cuisineType || 'Ẩm thực'],
    isOpen: r.isOpen ?? true,
    categories: r.categories || [],
    shipping: 'Miễn phí >99k',
    shippingFee: Number(r.deliveryFee || 15000),
    minOrderAmount: Number(r.minOrderAmount || 0),
    avgPrice: 45000,
    featured: r.rating >= 4.8 || (r.restaurantId ? r.restaurantId % 2 === 0 : false),
  };
};