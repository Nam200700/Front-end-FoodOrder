import React, { useState } from 'react';
import { History, ClipboardList, Clipboard, Check, X, Utensils, Wallet, CheckCircle2, ChevronLeft, ChevronRight, User, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Card from '../../components/common/Card';
import FilterTabs from '../../components/common/FilterTabs';

export default function ShipperHistory() {
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState('ALL'); 
  const pageSize = 10;

  const mapHistory = (data) => {
    const content = data?.content || [];
    
    return content.map(ord => {
      const dateObj = new Date(ord.createdAt);
      const formattedDate = dateObj.toLocaleDateString('vi-VN');

      return {
        id: ord.orderId.toString(),
        restaurant: ord.restaurantName || 'Nhà hàng AntiGravity',
        customer: ord.customerName || 'Khách hàng',
        date: formattedDate,
        fee: Number(ord.shippingFee), 
        status: ord.orderStatus
      };
    });
  };

  // gọi api lấy danh sách lịch sử đơn giao
  const { data: pageData, loading, error, refetch } = useFetchData(`/shipper/orders?page=${page}&size=${pageSize}`, {
    mapFn: (data) => data, 
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

  // Xử lý dữ liệu thô từ trang hiện tại
  const rawContent = pageData?.content || [];
  const list = mapHistory({ content: rawContent });
  const totalPages = pageData?.totalPages || 1;

  // Lọc danh sách theo Tab 
  const filteredList = list.filter(item => {
    if (activeTab === 'COMPLETED') return item.status === 'COMPLETED';
    if (activeTab === 'CANCELLED') return item.status === 'CANCELLED';
    if (activeTab === 'DELIVERING') return item.status === 'DELIVERING' || item.status === 'READY_FOR_PICKUP';
    return true; 
  });

  // tab trạng thái
  const filterTabs = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'DELIVERING', label: 'Đang giao' }, 
    { id: 'COMPLETED', label: 'Thành công' },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full font-google-sans pb-24 space-y-6">

      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="text-md-tertiary" size={24} />
          Lịch Sử Giao Hàng
        </h1>
      </div>

      {list.length === 0 && page === 0 ? (
        <EmptyState
          title="Bạn chưa hoàn thành đơn hàng nào"
          message="Hãy nhận đơn tại tab Shipper Hub và bắt đầu hành trình ngay!"
          icon={ClipboardList}
        />
      ) : (
        <>
          {/* ─── FILTER TABS ──────────────── */}
          <FilterTabs
            tabs={filterTabs}
            activeTab={activeTab}
            onTabChange={(tabId) => {
              setActiveTab(tabId);
            }}
            activeClassName="bg-md-tertiary text-white shadow-sm shadow-md-tertiary/25"
          />

          {/* ─── DANH SÁCH CHUYẾN GIAO SỬ DỤNG COMPONENT CARD ────── */}
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm font-medium bg-white rounded-radius-xl border border-slate-200/60">
              Không có đơn hàng nào phù hợp.
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredList.map((item) => {
                const isDone = item.status === 'COMPLETED';
                return (
                  <Card
                    key={item.id}
                    variant="elevated"
                    // hoverEffect={true}
                    className="flex items-stretch overflow-hidden"
                  >
                    <div className={`w-1.5 shrink-0 ${isDone ? 'bg-md-tertiary' : 'bg-blue-400'}`} />
                    <div className="flex-1 p-4 flex items-center justify-between gap-4 min-w-0">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-radius-lg flex items-center justify-center shrink-0 shadow-sm border ${
                          isDone
                            ? 'bg-[#E8F5E9] text-md-tertiary border-[#C8E6C9]'
                            : 'bg-blue-50 text-blue-500 border-blue-100'
                        }`}>
                          {isDone ? <Check size={18} strokeWidth={3} /> : <Clock size={18} strokeWidth={3} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-800">
                              Mã Đơn #{item.id}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              <Clipboard size={11} className="shrink-0" /> {item.date}
                            </span>
                            <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ml-auto ${
                              isDone
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-blue-50 text-blue-700 border-blue-100'
                            }`}>
                              {isDone ? 'Thành công' : 'Đang giao'}
                            </span>
                          </div>
                          
                          <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <User size={11} className="shrink-0" /> Khách hàng: {item.customer}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Utensils size={11} className="shrink-0" /> Quán: {item.restaurant}
                          </span>
                        </div>
                      </div>

                      {/* Phí ship */}
                      <div className="text-right shrink-0">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Phí giao hàng</span>
                        <span className={`inline-block mt-1 text-sm font-extrabold px-2.5 py-1 rounded-radius-full text-md-tertiary bg-[#E8F5E9]`}>
                          {formatCurrency(item.fee)}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ─── NÚT PHÂN TRANG ──────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200/60">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} /> Trước đó
              </button>
              
              <span className="text-xs font-bold text-slate-500">
                Trang {page + 1} / {totalPages}
              </span>

              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
              >
                Kế tiếp <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}