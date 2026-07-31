import React, { useState } from 'react';
import { History, ClipboardList, Clipboard, Check, X, Utensils, Wallet, CheckCircle2, ChevronLeft, ChevronRight, User, Clock, Sparkles, Package, Calendar, Coins, Bike, PackageSearch, Search, SlidersHorizontal, ArrowDownUp, ChevronDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useFetchData } from '../../hooks/useFetchData';
import { SkeletonOrderCard } from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Card from '../../components/common/Card';
import FilterTabs from '../../components/common/FilterTabs';

const SORTS = [
  { id: 'recent', label: 'Mới nhất' },
  { id: 'oldest', label: 'Cũ nhất' },
  { id: 'feeHigh', label: 'Phí cao nhất' },
  { id: 'feeLow', label: 'Phí thấp nhất' },
];

// Tô sáng phần khớp từ khoá tìm kiếm (kiểu GitHub/Algolia) — an toàn, chỉ so chuỗi thường.
function Highlight({ text, q }) {
  const s = String(text ?? '');
  if (!q) return s;
  const i = s.toLowerCase().indexOf(q);
  if (i === -1) return s;
  return (
    <>
      {s.slice(0, i)}
      <mark className="bg-amber-200/70 text-slate-900 rounded px-0.5">{s.slice(i, i + q.length)}</mark>
      {s.slice(i + q.length)}
    </>
  );
}

export default function ShipperHistory() {
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('ALL'); // ALL | TODAY | 7D | 30D
  const [sortBy, setSortBy] = useState('recent');
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
        createdAt: ord.createdAt,
        ts: dateObj.getTime(),
        fee: Number(ord.shippingFee),
        status: ord.orderStatus
      };
    });
  };

  // Tải toàn bộ lịch sử để BỘ LỌC áp trên tất cả (không chỉ 1 trang). Một shipper số đơn nhỏ nên an toàn.
  const { data: pageData, loading, error, refetch } = useFetchData(`/shipper/orders?page=0&size=1000`, {
    mapFn: (data) => data,
  });

  // reset về trang 1 mỗi khi đổi bộ lọc
  const resetPage = () => setPage(0);

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

  // Toàn bộ chuyến giao (đã tải hết)
  const rawContent = pageData?.content || [];
  const list = mapHistory({ content: rawContent });
  const totalElements = pageData?.totalElements ?? list.length; // tổng chuyến THẬT

  // ─── ÁP BỘ LỌC: trạng thái + tìm kiếm + mốc thời gian ───
  const q = search.trim().toLowerCase();
  const now = Date.now();
  const DAY = 86400000;
  const dateFloor =
    dateRange === 'TODAY' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    : dateRange === '7D' ? now - 7 * DAY
    : dateRange === '30D' ? now - 30 * DAY
    : 0;

  const filteredList = list.filter(item => {
    // trạng thái
    if (activeTab === 'COMPLETED' && item.status !== 'COMPLETED') return false;
    if (activeTab === 'CANCELLED' && item.status !== 'CANCELLED') return false;
    if (activeTab === 'DELIVERING' && !(item.status === 'DELIVERING' || item.status === 'READY_FOR_PICKUP')) return false;
    // mốc thời gian
    if (dateFloor && !(item.ts >= dateFloor)) return false;
    // tìm kiếm (mã đơn / khách / quán)
    if (q && !(`#${item.id}`.toLowerCase().includes(q) || item.id.includes(q) ||
      item.customer.toLowerCase().includes(q) || item.restaurant.toLowerCase().includes(q))) return false;
    return true;
  });

  // Sắp xếp kết quả đã lọc theo lựa chọn
  const sortedList = [...filteredList].sort((a, b) => {
    if (sortBy === 'oldest') return a.ts - b.ts;
    if (sortBy === 'feeHigh') return (b.fee || 0) - (a.fee || 0) || b.ts - a.ts;
    if (sortBy === 'feeLow') return (a.fee || 0) - (b.fee || 0) || b.ts - a.ts;
    return b.ts - a.ts; // recent
  });

  // Phân trang CLIENT trên kết quả đã lọc + sắp xếp
  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = sortedList.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const hasActiveFilter = q !== '' || dateRange !== 'ALL' || activeTab !== 'ALL';

  // ─── TỔNG QUAN (theo kết quả đang lọc, kiểu trip-summary Grab/Uber) ───
  const doneList = filteredList.filter((i) => i.status === 'COMPLETED');
  const deliveringCount = filteredList.filter((i) => i.status === 'DELIVERING' || i.status === 'READY_FOR_PICKUP').length;
  const sumFee = doneList.reduce((s, i) => s + (i.fee || 0), 0);
  const avgFee = doneList.length ? sumFee / doneList.length : 0;
  const summaryStats = [
    { icon: Wallet, tint: 'text-md-tertiary', bg: 'from-[#E8F5E9]/70 to-white border-[#C8E6C9]/60', value: formatCurrency(sumFee), label: 'Tổng phí đã nhận' },
    { icon: CheckCircle2, tint: 'text-emerald-500', bg: 'from-emerald-50/70 to-white border-emerald-100', value: doneList.length, label: 'Chuyến thành công' },
    { icon: Bike, tint: 'text-blue-500', bg: 'from-blue-50/70 to-white border-blue-100', value: deliveringCount, label: 'Đang giao' },
    { icon: TrendingUp, tint: 'text-amber-500', bg: 'from-amber-50/70 to-white border-amber-100', value: formatCurrency(avgFee), label: 'TB mỗi chuyến' },
  ];

  // tab trạng thái
  const filterTabs = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'DELIVERING', label: 'Đang giao' },
    { id: 'COMPLETED', label: 'Thành công' },
  ];

  // chip lọc theo mốc thời gian
  const dateChips = [
    { id: 'ALL', label: 'Mọi lúc' },
    { id: 'TODAY', label: 'Hôm nay' },
    { id: '7D', label: '7 ngày' },
    { id: '30D', label: '30 ngày' },
  ];

  const changeSort = (v) => { setSortBy(v); resetPage(); };

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
          {/* ─── BỘ LỌC: tìm kiếm + trạng thái + mốc thời gian ──────────────── */}
          <div className="bg-white rounded-radius-xl border border-slate-200/70 shadow-shadow-1 p-3.5 md:p-4 space-y-3.5 animate-rise-in">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-7 h-7 rounded-radius-md bg-[#E8F5E9] text-md-tertiary flex items-center justify-center shrink-0">
                <SlidersHorizontal size={15} />
              </span>
              <span className="text-sm font-bold">Bộ lọc</span>
              {hasActiveFilter && (
                <button
                  onClick={() => { setSearch(''); setDateRange('ALL'); setActiveTab('ALL'); resetPage(); }}
                  className="ml-auto text-[11px] font-bold text-md-tertiary hover:text-[#2E7D32] inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X size={13} /> Xoá lọc
                </button>
              )}
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                placeholder="Tìm mã đơn, khách hàng, quán..."
                className="w-full pl-9 pr-9 py-2.5 text-sm rounded-radius-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-md-tertiary focus:ring-2 focus:ring-md-tertiary/20 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); resetPage(); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Chip mốc thời gian */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-1 mr-0.5">
                <Calendar size={12} /> Thời gian:
              </span>
              {dateChips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setDateRange(c.id); resetPage(); }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-radius-full border transition-all cursor-pointer ${
                    dateRange === c.id
                      ? 'bg-md-tertiary text-white border-md-tertiary shadow-sm shadow-md-tertiary/25'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-md-tertiary/50 hover:text-md-tertiary'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── FILTER TABS TRẠNG THÁI ──────────────── */}
          <FilterTabs
            tabs={filterTabs}
            activeTab={activeTab}
            onTabChange={(tabId) => {
              setActiveTab(tabId);
              resetPage();
            }}
            activeClassName="bg-md-tertiary text-white shadow-sm shadow-md-tertiary/25"
          />

          {/* ─── DẢI TỔNG QUAN theo kết quả lọc (trip-summary Grab/Uber) ─── */}
          {filteredList.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryStats.map((s, i) => (
                <div
                  key={s.label}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className={`relative overflow-hidden rounded-radius-xl p-3.5 border bg-gradient-to-br ${s.bg} shadow-sm animate-rise-in transition-transform hover:-translate-y-0.5`}
                >
                  <s.icon size={16} className={`${s.tint} animate-float`} style={{ animationDelay: `${i * 200}ms` }} />
                  <p className="text-base md:text-lg font-black text-slate-800 mt-1.5 leading-none tabular-nums">{s.value}</p>
                  <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Hàng đếm kết quả + sắp xếp */}
          <div className="flex items-center justify-between gap-3 -mt-1">
            <p className="text-xs font-semibold text-slate-500">
              Tìm thấy <span className="font-extrabold text-md-tertiary">{filteredList.length}</span> chuyến
              {hasActiveFilter && <span className="text-slate-400 font-medium"> / {list.length} tổng</span>}
            </p>
            <div className="relative shrink-0">
              <ArrowDownUp size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => changeSort(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 text-xs font-bold rounded-radius-lg bg-white border border-slate-200 text-slate-600 hover:border-md-tertiary/50 focus:border-md-tertiary focus:ring-2 focus:ring-md-tertiary/20 outline-none cursor-pointer transition-all"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* ─── DANH SÁCH CHUYẾN GIAO SỬ DỤNG COMPONENT CARD ────── */}
          {filteredList.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3 text-center bg-white rounded-radius-xl border border-slate-200/60">
              <span className="w-14 h-14 rounded-radius-full bg-slate-50 text-slate-300 flex items-center justify-center animate-float">
                <PackageSearch size={26} />
              </span>
              <p className="text-sm font-bold text-slate-500">Không có chuyến giao nào khớp bộ lọc</p>
              <p className="text-xs text-slate-400 font-medium">Thử đổi từ khoá, mốc thời gian hoặc trạng thái phía trên nhé.</p>
              {hasActiveFilter && (
                <button
                  onClick={() => { setSearch(''); setDateRange('ALL'); setActiveTab('ALL'); resetPage(); }}
                  className="mt-1 text-xs font-bold text-white bg-md-tertiary px-4 py-2 rounded-radius-full inline-flex items-center gap-1.5 hover:bg-[#2E7D32] cursor-pointer transition-colors"
                >
                  <X size={13} /> Xoá bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {pageItems.map((item, idx) => {
                const isDone = item.status === 'COMPLETED';
                return (
                  <Card
                    key={item.id}
                    variant="elevated"
                    style={{ animationDelay: `${idx * 55}ms` }}
                    className="group flex items-stretch overflow-hidden animate-rise-in transition-all hover:shadow-shadow-3 hover:-translate-y-0.5"
                  >
                    <div className={`w-1.5 group-hover:w-2.5 shrink-0 transition-all duration-300 ${isDone ? 'bg-md-tertiary' : 'bg-blue-400'}`} />
                    <div className="flex-1 p-4 flex items-center gap-3.5 min-w-0">
                      {/* Icon trạng thái — done: dấu check; đang giao: xe máy nhấp nháy */}
                      <div className="relative shrink-0">
                        {!isDone && <span className="absolute inset-0 rounded-radius-lg bg-blue-400/25 animate-ping" />}
                        <div className={`relative w-11 h-11 rounded-radius-lg flex items-center justify-center shadow-sm border transition-transform group-hover:scale-105 ${
                          isDone
                            ? 'bg-[#E8F5E9] text-md-tertiary border-[#C8E6C9]'
                            : 'bg-blue-50 text-blue-500 border-blue-100'
                        }`}>
                          {isDone ? <Check size={18} strokeWidth={3} /> : <Bike size={18} strokeWidth={2.6} />}
                        </div>
                      </div>

                      {/* Thông tin đơn: tiêu đề + ngày + trạng thái cùng hàng, rồi khách/quán */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-800">
                            Mã Đơn #<Highlight text={item.id} q={q} />
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                            <Calendar size={11} className="shrink-0" /> {item.date}
                          </span>
                          <span className={`text-[9px] font-bold border px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {isDone
                              ? <><CheckCircle2 size={10} /> Thành công</>
                              : <><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Đang giao</>}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-col gap-1">
                          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                            <User size={12} className="shrink-0 text-md-tertiary" /> Khách hàng: <span className="font-semibold text-slate-600"><Highlight text={item.customer} q={q} /></span>
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                            <Utensils size={12} className="shrink-0 text-orange-400" /> Quán: <span className="font-semibold text-slate-600"><Highlight text={item.restaurant} q={q} /></span>
                          </span>
                        </div>
                      </div>

                      {/* Phí ship — tách bằng đường kẻ dọc, canh giữa theo chiều cao card */}
                      <div className="shrink-0 self-stretch pl-3.5 border-l border-slate-100 flex flex-col justify-center items-end text-right">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Phí giao hàng</span>
                        <span className="mt-1.5 text-sm font-extrabold px-2.5 py-1 rounded-radius-full text-md-tertiary bg-[#E8F5E9] inline-flex items-center gap-1 transition-transform group-hover:scale-105">
                          <Coins size={13} className="shrink-0" /> {formatCurrency(item.fee)}
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
                onClick={() => setPage(Math.max(safePage - 1, 0))}
                disabled={safePage === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-radius-md text-xs font-bold bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} /> Trước đó
              </button>

              <span className="text-xs font-bold text-slate-500">
                Trang {safePage + 1} / {totalPages}
              </span>

              <button
                onClick={() => setPage(Math.min(safePage + 1, totalPages - 1))}
                disabled={safePage >= totalPages - 1}
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