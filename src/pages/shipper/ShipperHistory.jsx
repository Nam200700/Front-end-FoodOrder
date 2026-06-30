import React from 'react';
import { History, ClipboardList, Clipboard, Check, X, Utensils, Wallet, CheckCircle2, XCircle } from 'lucide-react';
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

  // Tổng hợp lịch sử cho dải thống kê (đếm/tổng từ dữ liệu đã có)
  const completedCount = list.filter(i => i.status === 'COMPLETED').length;
  const cancelledCount = list.filter(i => i.status === 'CANCELLED').length;
  const totalEarned = list
    .filter(i => i.status === 'COMPLETED')
    .reduce((s, i) => s + (i.fee || 0), 0);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 space-y-6">

      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="text-md-tertiary" size={24} />
          Lịch sử giao hàng
        </h1>
        <p className="text-xs text-slate-400 mt-1">Toàn bộ chuyến giao đã hoàn thành và bị huỷ của bạn</p>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Bạn chưa hoàn thành đơn hàng nào"
          message="Hãy nhận đơn tại tab Shipper Hub và bắt đầu hành trình ngay!"
          icon={ClipboardList}
        />
      ) : (
        <>
          {/* ─── DẢI THỐNG KÊ: thành công · đã huỷ · tổng phí ship ──────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-radius-xl p-3.5 border border-slate-200/60 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-radius-md bg-emerald-50 text-emerald-500 shrink-0"><CheckCircle2 size={16} /></div>
              <div className="min-w-0">
                <span className="text-sm font-black text-slate-800 block leading-none">{completedCount}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Thành công</span>
              </div>
            </div>
            <div className="bg-white rounded-radius-xl p-3.5 border border-slate-200/60 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-radius-md bg-red-50 text-red-500 shrink-0"><XCircle size={16} /></div>
              <div className="min-w-0">
                <span className="text-sm font-black text-slate-800 block leading-none">{cancelledCount}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Đã huỷ</span>
              </div>
            </div>
            <div className="bg-white rounded-radius-xl p-3.5 border border-slate-200/60 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-radius-md bg-[#E8F5E9] text-md-tertiary shrink-0"><Wallet size={16} /></div>
              <div className="min-w-0">
                <span className="text-sm font-black text-md-tertiary block leading-none truncate">{formatCurrency(totalEarned)}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Tổng phí ship</span>
              </div>
            </div>
          </div>

          {/* ─── DANH SÁCH CHUYẾN GIAO (card có dải màu trạng thái bên trái) ────── */}
          <div className="space-y-3.5">
            {list.map((item) => {
              const isDone = item.status === 'COMPLETED';
              return (
                <div
                  key={item.id}
                  className="group bg-white rounded-radius-xl border border-slate-200/60 shadow-sm flex items-stretch overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
                >
                  {/* dải màu trạng thái bên trái */}
                  <div className={`w-1.5 shrink-0 ${isDone ? 'bg-md-tertiary' : 'bg-red-400'}`} />

                  <div className="flex-1 p-4 flex items-center justify-between gap-4 min-w-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* icon trạng thái: Check (thành công) / X (huỷ) thay emoji ✓/✗ */}
                      <div className={`w-10 h-10 rounded-radius-lg flex items-center justify-center shrink-0 shadow-sm border ${
                        isDone
                          ? 'bg-[#E8F5E9] text-md-tertiary border-[#C8E6C9]'
                          : 'bg-red-50 text-red-500 border-red-100'
                      }`}>
                        {isDone ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-800">
                            Đơn #{item.id} • {item.customer}
                          </span>
                          <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-red-50 text-red-700 border-red-100'
                          }`}>
                            {isDone ? 'Thành công' : 'Đã huỷ'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Utensils size={11} className="shrink-0" /> {item.restaurant}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
                          <Clipboard size={11} className="shrink-0" /> {item.date}
                        </span>
                      </div>
                    </div>

                    {/* phí ship trong "pill" cho nổi bật */}
                    <div className="text-right shrink-0">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">Phí ship nhận</span>
                      <span className={`inline-block mt-1 text-sm font-extrabold px-2.5 py-1 rounded-radius-full ${
                        isDone ? 'text-md-tertiary bg-[#E8F5E9]' : 'text-slate-400 bg-slate-100 line-through'
                      }`}>
                        {formatCurrency(item.fee)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}