import React from 'react';
import { History, ClipboardList, Clipboard, Check, X } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';

export default function ShipperHistory() {
  const mapHistory = (data) => {
    const content = data?.content || [];
    const completed = content.filter(ord => ord.orderStatus === 'COMPLETED' || ord.orderStatus === 'CANCELLED');
    
    return completed.map(ord => {
      const dateObj = new Date(ord.createdAt);
      const formattedDate = dateObj.toLocaleDateString('vi-VN') + ' ' + 
        String(dateObj.getHours()).padStart(2, '0') + ':' + 
        String(dateObj.getMinutes()).padStart(2, '0');

      return {
        id: ord.orderId.toString(),
        restaurant: ord.restaurantName || 'Nhà hàng AntiGravity',
        customer: ord.customerName || 'Khách hàng',
        date: formattedDate,
        fee: Number(ord.shippingFee), // phí ship thật từ DB
        status: ord.orderStatus
      };
    });
  };

  const { data: historyOrders, loading, error, refetch } = useFetchData('/shipper/orders', {
    mapFn: mapHistory,
  });

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 space-y-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="text-md-tertiary" size={24} />
          Lịch sử giao hàng
        </h1>
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
      <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 flex justify-center items-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const list = historyOrders || [];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 space-y-6">
      
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <History className="text-md-tertiary" size={24} />
        Lịch sử giao hàng
      </h1>

      {list.length === 0 ? (
        <EmptyState
          title="Bạn chưa hoàn thành đơn hàng nào"
          message="Hãy nhận đơn tại tab Shipper Hub và bắt đầu hành trình ngay!"
          icon={ClipboardList}
        />
      ) : (
        <div className="space-y-4">
          {list.map((item) => (
            <div 
              key={item.id}
              className="bg-white rounded-radius-xl p-4 border border-slate-200/60 shadow-sm flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* icon trạng thái: Check (thành công) / X (huỷ) thay emoji ✓/✗ */}
                <div className={`w-10 h-10 rounded-radius-lg flex items-center justify-center shrink-0 shadow-sm border ${
                  item.status === 'COMPLETED'
                    ? 'bg-[#E8F5E9] text-md-tertiary border-[#C8E6C9]'
                    : 'bg-red-50 text-red-500 border-red-100'
                }`}>
                  {item.status === 'COMPLETED' ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs sm:text-sm text-slate-800">
                      Đơn #{item.id} • {item.customer}
                    </span>
                    <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ${
                      item.status === 'COMPLETED' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {item.status === 'COMPLETED' ? 'Thành công' : 'Đã huỷ'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Quán: {item.restaurant}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-1.5 flex items-center gap-1">
                    <Clipboard size={12} />
                    {item.date}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-400 block font-bold uppercase">PHÍ SHIP NHẬN</span>
                <span className="text-sm font-bold text-md-tertiary mt-1 block">{formatCurrency(item.fee)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}