import React, { useState } from 'react';
import { History, ClipboardList, Clipboard, Check, X, Utensils, Wallet, CheckCircle2, ChevronLeft, ChevronRight, User, Clock, Sparkles, Package } from 'lucide-react';
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
      <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans pb-24 space-y-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="text-md-tertiary" size={24} />
          Lịch sử giao hàng
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans pb-24 flex justify-center items-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  // Xử lý dữ liệu thô từ trang hiện tại
  const rawContent = pageData?.content || [];
  const list = mapHistory({ content: rawContent });
  const totalPages = pageData?.totalPages || 1;
  const totalElements = pageData?.totalElements ?? list.length; // tổng chuyến THẬT (mọi trang)

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
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans pb-24 space-y-6">

      {/* ─── HERO XANH SHIPPER: tài xế đạp xe chạy ngang + số chuyến thật ─── */}
      <div className="relative overflow-hidden rounded-radius-xl bg-gradient-to-br from-[#2E7D32] to-md-tertiary text-white p-6 md:p-7 shadow-shadow-2 animate-rise-in">
        <History className="absolute -right-5 -bottom-6 text-white/10" size={130} strokeWidth={1} />
        <Sparkles className="absolute right-28 top-5 text-white/20 animate-twinkle" size={20} />
        <Sparkles className="absolute right-12 bottom-6 text-white/15 animate-twinkle" size={13} style={{ animationDelay: '800ms' }} />
        <div className="absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/12 to-transparent animate-shine pointer-events-none" />

        {/* Con đường nét đứt + tài xế đạp xe (bánh quay, thân rung, vạch tốc độ) */}
        <div className="absolute bottom-3 left-4 right-4 border-t-2 border-dashed border-white/20" />
        <div className="absolute bottom-2 left-0 right-0 h-9 pointer-events-none">
          <div className="absolute left-0 bottom-0 w-full animate-ride">
            <div className="relative inline-block animate-vroom text-white">
              <span className="absolute top-2 -left-3 h-[2px] w-4 rounded-full bg-white/50 animate-speed" style={{ animationDelay: '0ms' }} />
              <span className="absolute top-4 -left-4 h-[2px] w-5 rounded-full bg-white/40 animate-speed" style={{ animationDelay: '200ms' }} />
              <svg width="46" height="29" viewBox="0 0 64 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
                <rect x="13.5" y="9" width="11" height="10" rx="2" fill="rgba(255,255,255,0.2)" />
                <path d="M13.5 13 H24.5 M18 9 V7 H21 V9" strokeWidth="1.6" />
                <path d="M13 30 L30 30 L24 17 Z M30 30 L44 15 L51 30 M24 17 L44 15 M42 15 H47.5 M21 17 H26.5" />
                <path d="M24 17 L30 30 M24 17 L36 8 L44 15" />
                <circle cx="39" cy="5.4" r="3.2" />
                <circle cx="13" cy="30" r="6" />
                <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-wheel">
                  <path d="M13 25.4 V34.6 M8.4 30 H17.6 M9.7 26.7 L16.3 33.3 M16.3 26.7 L9.7 33.3" strokeWidth="1.3" />
                </g>
                <circle cx="51" cy="30" r="6" />
                <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className="animate-wheel">
                  <path d="M51 25.4 V34.6 M46.4 30 H55.6 M47.7 26.7 L54.3 33.3 M54.3 26.7 L47.7 33.3" strokeWidth="1.3" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
            <Package size={11} /> Tài xế giao hàng
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight flex items-center gap-2.5">
            Lịch Sử Giao Hàng
          </h1>
          <p className="text-sm text-white/85 font-semibold mt-1.5 leading-relaxed">
            Tổng <span className="font-extrabold">{totalElements}</span> chuyến giao trong lịch sử — xem lại chi tiết bên dưới.
          </p>
        </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {filteredList.map((item, idx) => {
                const isDone = item.status === 'COMPLETED';
                return (
                  <Card
                    key={item.id}
                    variant="elevated"
                    style={{ animationDelay: `${idx * 55}ms` }}
                    className="flex items-stretch overflow-hidden animate-rise-in transition-all hover:shadow-shadow-3 hover:-translate-y-0.5"
                  >
                    <div className={`w-1.5 shrink-0 ${isDone ? 'bg-md-tertiary' : 'bg-blue-400'}`} />
                    <div className="flex-1 p-4 flex items-center gap-3.5 min-w-0">
                      {/* Icon trạng thái */}
                      <div className={`w-11 h-11 rounded-radius-lg flex items-center justify-center shrink-0 shadow-sm border ${
                        isDone
                          ? 'bg-[#E8F5E9] text-md-tertiary border-[#C8E6C9]'
                          : 'bg-blue-50 text-blue-500 border-blue-100'
                      }`}>
                        {isDone ? <Check size={18} strokeWidth={3} /> : <Clock size={18} strokeWidth={3} />}
                      </div>

                      {/* Thông tin đơn: tiêu đề + ngày + trạng thái cùng hàng, rồi khách/quán */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-800">
                            Mã Đơn #{item.id}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                            <Clipboard size={11} className="shrink-0" /> {item.date}
                          </span>
                          <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {isDone ? 'Thành công' : 'Đang giao'}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-col gap-1">
                          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                            <User size={12} className="shrink-0 text-slate-400" /> Khách hàng: <span className="font-semibold text-slate-600">{item.customer}</span>
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                            <Utensils size={12} className="shrink-0 text-slate-400" /> Quán: <span className="font-semibold text-slate-600">{item.restaurant}</span>
                          </span>
                        </div>
                      </div>

                      {/* Phí ship — tách bằng đường kẻ dọc, canh giữa theo chiều cao card */}
                      <div className="shrink-0 self-stretch pl-3.5 border-l border-slate-100 flex flex-col justify-center items-end text-right">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Phí giao hàng</span>
                        <span className="mt-1.5 text-sm font-extrabold px-2.5 py-1 rounded-radius-full text-md-tertiary bg-[#E8F5E9]">
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