import React from 'react';
export default function OrderHistory() {
  return (
    <div className="min-h-screen">
      <h1 className="text-2xl font-bold">Order History</h1>
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { ShoppingBag, Calendar, RefreshCcw } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import StarRating from '../../components/common/StarRating';

export default function OrderHistory() {
  const navigate = useNavigate();
  const replaceCart = useCartStore((state) => state.replaceCart);

  const mapOrders = (data) => {
    const realData = data?.content || [];
    return realData.map((ord) => {
      const dateObj = new Date(ord.createdAt);
      const formattedDate = dateObj.toLocaleDateString('vi-VN') + ' ' + 
        String(dateObj.getHours()).padStart(2, '0') + ':' + 
        String(dateObj.getMinutes()).padStart(2, '0');

      return {
        id: ord.orderId.toString(),
        restaurantId: ord.restaurantId.toString(),
        restaurantName: ord.restaurantName || 'Quán Ăn AntiGravity',
        restaurantImage: ord.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
        items: (ord.items || []).map((i) => ({
          id: `food-${i.foodId}`,
          name: i.foodName,
          price: Number(i.priceAtOrder),
          quantity: i.quantity,
        })),
        total: Number(ord.totalAmount),
        status: ord.orderStatus,
        createdAt: formattedDate,
        reviewed: ord.reviewed || false,
        rating: ord.restaurantRating || 5
      };
    });
  };

  const { data: orders, loading, error, refetch } = useFetchData('/orders', {
    mapFn: mapOrders,
  });

  const handleReorder = (order) => {
    const newItems = order.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      note: '',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
    }));
    
    replaceCart(newItems, order.restaurantId, order.restaurantName);
    navigate('/cart');
  };

  const getStatusChipClass = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]';
      case 'CANCELLED':
        return 'bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Giao thành công ✅';
      case 'CANCELLED': return 'Đã hủy ❌';
      default: return 'Đang xử lý ⏳';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full font-google-sans pb-24">
        <h1 className="text-xl md:text-2xl font-bold text-md-on-surface mb-6">Đơn hàng của tôi</h1>
        <div className="space-y-4">
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full font-google-sans pb-24 flex justify-center items-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const list = orders || [];

  if (list.length === 0) {
    return (
      <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full font-google-sans pb-24 flex justify-center items-center">
        <EmptyState 
          title="Chưa có đơn hàng nào" 
          message="Lịch sử mua hàng của bạn sẽ hiển thị tại đây khi bạn đặt đơn đầu tiên trên hệ thống."
          icon={ShoppingBag}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full font-google-sans pb-24">
      
      <h1 className="text-xl md:text-2xl font-bold text-md-on-surface mb-6">Đơn hàng của tôi</h1>

      {/* List cards */}
      <div className="space-y-4">
        {list.map((order) => (
          <div 
            key={order.id}
            onClick={() => navigate(`/orders/${order.id}`)}
            className="bg-white rounded-radius-xl p-4.5 border border-md-outline-variant/20 shadow-sm hover:shadow-shadow-1 transition-all cursor-pointer flex flex-col sm:flex-row gap-4 justify-between"
          >
            {/* Left side info */}
            <div className="flex gap-4 min-w-0">
              <div className="w-16 h-16 rounded-radius-md overflow-hidden shrink-0 border border-slate-100">
                <img src={order.restaurantImage} alt={order.restaurantName} className="w-full h-full object-cover" />
              </div>

              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${getStatusChipClass(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                  <span className="text-[10px] text-md-outline font-semibold">
                    #{order.id}
                  </span>
                </div>

                <h3 className="font-extrabold text-sm sm:text-base text-md-on-surface truncate mt-1.5">
                  {order.restaurantName}
                </h3>

                <p className="text-[11px] text-md-on-surface-variant truncate mt-1.5 font-medium">
                  {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                </p>

                <div className="flex items-center gap-3 text-[10px] text-md-outline font-extrabold mt-3 border-t border-slate-50 pt-2.5">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {order.createdAt}
                  </span>
                  <span>•</span>
                  <span className="font-extrabold text-md-on-surface">
                    Tổng: {formatCurrency(order.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex sm:flex-col justify-end gap-2 border-t border-slate-50 sm:border-none pt-3.5 sm:pt-0 shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleReorder(order)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4.5 py-2 bg-md-primary/10 text-md-primary hover:bg-md-primary/20 rounded-radius-full text-xs font-bold transition-all border border-md-primary/5 active:scale-95"
              >
                <RefreshCcw size={12} />
                Đặt lại
              </button>

              {order.status === 'COMPLETED' && !order.reviewed && (
                <button
                  onClick={() => navigate(`/reviews/${order.id}`)}
                  className="flex-1 sm:flex-initial px-4.5 py-2 bg-md-primary text-white hover:bg-opacity-95 rounded-radius-full text-xs font-bold shadow-sm transition-all active:scale-95 text-center"
                >
                  Đánh giá
                </button>
              )}

              {order.status === 'COMPLETED' && order.reviewed && (
                <div className="flex items-center gap-0.5 justify-center py-2">
                  <StarRating rating={order.rating} size={12} />
                  <span className="text-[9px] text-md-outline ml-1 font-bold font-google-sans">Đã review</span>
                </div>
              )}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
