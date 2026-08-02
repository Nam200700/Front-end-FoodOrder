import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, ShieldCheck, RefreshCw, CheckCircle2, User, Quote, ShieldAlert,
  Clock, XCircle, Sparkles, ClipboardCheck, Store, Bike, Package, Star, Flag, Inbox, X,
} from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import FilterTabs from '../../components/common/FilterTabs';
import ReviewPagination from '../../components/common/ReviewPagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { toast } from 'react-toastify';

const PAGE_SIZE = 6; // số báo cáo mỗi trang

const REPORT_STATUS_TABS = [
  { id: 'PENDING', label: 'Chờ xử lý' },
  { id: 'RESOLVED', label: 'Đã xử lý' },
  { id: 'REJECTED', label: 'Đã từ chối' },
];

// Metadata theo loại đối tượng bị báo cáo → icon + màu để nhận diện nhanh (chú thích ở cột phụ)
const TARGET_META = {
  RESTAURANT: { icon: Store,   label: 'Quán ăn',     ring: 'bg-blue-500/15 border-blue-500/30 text-blue-300',      text: 'text-blue-300' },
  SHIPPER:    { icon: Bike,    label: 'Tài xế',      ring: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', text: 'text-emerald-300' },
  USER:       { icon: User,    label: 'Người dùng',  ring: 'bg-slate-500/15 border-slate-500/30 text-slate-300',   text: 'text-slate-300' },
  ORDER:      { icon: Package, label: 'Đơn hàng',    ring: 'bg-amber-500/15 border-amber-500/30 text-amber-300',   text: 'text-amber-300' },
  REVIEW:     { icon: Star,    label: 'Đánh giá',    ring: 'bg-purple-500/15 border-purple-500/30 text-purple-300', text: 'text-purple-300' },
  DEFAULT:    { icon: Flag,    label: 'Đối tượng',   ring: 'bg-red-500/15 border-red-500/30 text-red-300',         text: 'text-red-300' },
};
const metaOf = (type) => TARGET_META[type] || TARGET_META.DEFAULT;

// Cẩm nang xử lý báo cáo (cột phụ)
const REPORT_GUIDELINES = [
  { icon: Quote, text: 'Đọc kỹ nội dung tố cáo và đối chiếu với đối tượng bị báo cáo.' },
  { icon: ClipboardCheck, text: 'Kiểm tra lịch sử vi phạm & bằng chứng liên quan trước khi kết luận.' },
  { icon: ShieldCheck, text: '“Giải quyết xong” khi đã xác minh và có biện pháp xử lý.' },
  { icon: XCircle, text: '“Từ chối” khi báo cáo sai sự thật, thiếu căn cứ hoặc trùng lặp.' },
];

export default function AdminReports() {
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ PENDING: 0, RESOLVED: 0, REJECTED: 0 });
  const [confirmState, setConfirmState] = useState({ open: false, id: null, target: '', action: null });
  const [actionLoading, setActionLoading] = useState(false);

  const targetLabel = (type, id) => {
    const idStr = id ?? '—';
    switch (type) {
      case 'RESTAURANT': return `Quán #${idStr}`;
      case 'SHIPPER':    return `Tài xế #${idStr}`;
      case 'USER':       return `Người dùng #${idStr}`;
      case 'ORDER':      return `Đơn #${idStr}`;
      case 'REVIEW':     return `Đánh giá #${idStr}`;
      default:           return `Đối tượng #${idStr}`;
    }
  };

  const mapReports = (data) => ({
    items: (data?.content || []).map(rep => {
      const dateObj = rep.createdAt ? new Date(rep.createdAt) : new Date();
      const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
      return {
        id: rep.reportId || rep.id,
        sender: rep.reporterName || `Người dùng #${rep.reporterId || '—'}`,
        targetType: rep.targetType,
        target: rep.targetName || targetLabel(rep.targetType, rep.targetId),
        content: rep.reason || 'Không có nội dung mô tả.',
        date: dateStr,
      };
    }),
    totalPages: data?.totalPages || 1,
    totalElements: data?.totalElements || 0,
  });

  const { data: pageData, loading, refetch } = useFetchData(
    `/admin/reports?status=${statusFilter}&page=${page}&size=${PAGE_SIZE}`,
    { mapFn: mapReports, deps: [statusFilter, page] }
  );

  const list = pageData?.items || [];
  const totalPages = pageData?.totalPages || 1;
  const totalElements = pageData?.totalElements || 0;

  // Đếm số báo cáo mỗi trạng thái (size=1 → totalElements) cho chip + badge tab
  const fetchCounts = useCallback(async () => {
    try {
      const [p, r, x] = await Promise.all([
        apiClient.get('/admin/reports?status=PENDING&size=1'),
        apiClient.get('/admin/reports?status=RESOLVED&size=1'),
        apiClient.get('/admin/reports?status=REJECTED&size=1'),
      ]);
      setStatusCounts({
        PENDING: p.data?.data?.totalElements || 0,
        RESOLVED: r.data?.data?.totalElements || 0,
        REJECTED: x.data?.data?.totalElements || 0,
      });
    } catch (err) {
      console.error('Lỗi đếm báo cáo theo trạng thái:', err);
    }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Trang cuối vừa xử lý hết → lùi về trang trước cho khỏi trống
  useEffect(() => {
    if (!loading && list.length === 0 && page > 0) setPage(p => p - 1);
  }, [loading, list.length, page]);

  const refreshAll = () => { refetch(); fetchCounts(); };
  const handleFilterChange = (f) => { setStatusFilter(f); setPage(0); };

  const openConfirm = (action, rep) => setConfirmState({ open: true, id: rep.id, target: rep.target, action });
  const closeConfirm = () => setConfirmState({ open: false, id: null, target: '', action: null });

  const handleConfirm = async () => {
    const { id, target, action } = confirmState;
    const status = action === 'reject' ? 'REJECTED' : 'RESOLVED';
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/reports/${id}/resolve`, { status });
      toast.success(action === 'reject'
        ? `Đã từ chối báo cáo đối với "${target}".`
        : `Đã giải quyết báo cáo đối với "${target}".`);
      closeConfirm();
      refreshAll();
    } catch (err) {
      console.error('Lỗi xử lý báo cáo:', err);
      toast.error('Không thể xử lý báo cáo lúc này. Vui lòng thử lại sau!');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && list.length === 0 && page === 0) {
    return <Spinner fullScreen />;
  }

  const chips = [
    { id: 'PENDING',  label: 'Chờ xử lý', value: statusCounts.PENDING, icon: Clock,
      color: 'text-amber-400', ring: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      card: 'bg-slate-900 border-amber-500/30 hover:border-amber-500/60 hover:shadow-amber-950/40',
      pulse: (statusCounts.PENDING ?? 0) > 0 },
    { id: 'RESOLVED', label: 'Đã xử lý', value: statusCounts.RESOLVED, icon: CheckCircle2,
      color: 'text-emerald-400', ring: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      card: 'bg-slate-900 border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-emerald-950/40' },
    { id: 'REJECTED', label: 'Từ chối', value: statusCounts.REJECTED, icon: XCircle,
      color: 'text-red-400', ring: 'bg-red-500/15 border-red-500/30 text-red-400',
      card: 'bg-slate-900 border-red-500/30 hover:border-red-500/60 hover:shadow-red-950/40' },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">

      {/* ─── HERO trang trí ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 md:p-7 shadow-md">
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-red-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-6 w-56 h-56 rounded-full bg-purple-600/10 blur-3xl" />
        <Sparkles className="pointer-events-none absolute top-5 right-6 text-purple-400/30" size={18} />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-300 shrink-0 shadow-inner">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-100">Xử lý báo cáo vi phạm</h1>
              <p className="text-xs text-slate-400 font-semibold mt-1.5 max-w-md leading-relaxed">
                Xác minh & xử lý các khiếu nại vi phạm từ khách hàng đang chờ trên nền tảng.
              </p>
            </div>
          </div>

          {/* Chip thống kê 3 trạng thái — nền theo màu trạng thái + animation */}
          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            {chips.map((c, i) => {
              const CIcon = c.icon;
              return (
                <div
                  key={c.id}
                  className={`group relative rounded-2xl border px-3.5 py-3 text-center min-w-[86px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-rise-in ${c.card}`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  {c.pulse && (
                    <span className="absolute top-2 right-2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                    </span>
                  )}
                  <div className={`mx-auto mb-1.5 w-8 h-8 rounded-xl border flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${c.ring}`}>
                    <CIcon size={15} />
                  </div>
                  <div className={`text-xl font-black leading-none tabular-nums ${c.color}`}>{c.value ?? 0}</div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mt-1">{c.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Thanh công cụ: filter + làm mới ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterTabs
          tabs={REPORT_STATUS_TABS}
          activeTab={statusFilter}
          onTabChange={handleFilterChange}
          counts={statusCounts}
          className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-max shadow-sm"
          activeClassName="bg-purple-650 text-white shadow-sm shadow-purple-650/25"
        />
        <button
          onClick={refreshAll}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-900 hover:border-slate-700 text-slate-300 font-bold text-xs rounded-radius-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Dải ưu tiên khi còn báo cáo chờ xử lý */}
      {statusFilter === 'PENDING' && totalElements > 0 && (
        <div className="flex items-center gap-3 bg-red-950/15 border border-red-900/30 rounded-2xl p-4 animate-rise-in">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-100 block">Đang có {totalElements} báo cáo chờ xử lý</span>
            <span className="text-[11px] text-slate-400">Ưu tiên xác minh sớm để bảo vệ trải nghiệm người dùng.</span>
          </div>
        </div>
      )}

      {/* ─── Nội dung chính + cột phụ ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          {list.length === 0 ? (
            <div className="text-center py-16 px-6 bg-slate-950 rounded-3xl border border-dashed border-slate-800 text-slate-400 shadow-md flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                {statusFilter === 'PENDING'
                  ? <CheckCircle2 size={30} className="text-emerald-500" strokeWidth={1.6} />
                  : <Inbox size={30} className="text-slate-500" strokeWidth={1.6} />}
              </div>
              <p className="text-sm font-bold text-slate-300">
                {statusFilter === 'PENDING' ? 'Tuyệt vời — không còn báo cáo nào chờ xử lý!' : 'Chưa có báo cáo nào trong mục này.'}
              </p>
              <p className="text-xs font-semibold text-slate-500 max-w-xs leading-relaxed">
                {statusFilter === 'PENDING'
                  ? 'Mọi khiếu nại vi phạm đã được xử lý. Báo cáo mới sẽ xuất hiện tại đây.'
                  : 'Các báo cáo sẽ hiển thị ở đây khi có dữ liệu tương ứng.'}
              </p>
            </div>
          ) : (
            list.map((rep, idx) => {
              const meta = metaOf(rep.targetType);
              const MetaIcon = meta.icon;
              return (
                <div
                  key={rep.id}
                  className="group bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm hover:border-slate-700 hover:shadow-lg transition-all duration-300 flex flex-col animate-rise-in"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Header: người tố cáo + đối tượng + thời gian */}
                  <div className="flex justify-between items-start border-b border-slate-800/70 pb-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-purple-950/40 border border-purple-900/40 flex items-center justify-center text-purple-300 font-extrabold text-sm shrink-0">
                        {(rep.sender || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Người tố cáo</div>
                        <h3 className="font-bold text-sm text-slate-100 truncate flex items-center gap-1.5">
                          <User size={12} className="text-slate-500 shrink-0" /> {rep.sender}
                        </h3>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold shrink-0 inline-flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-full px-2.5 py-1">
                      <Clock size={11} /> {rep.date}
                    </span>
                  </div>

                  {/* Đối tượng bị báo cáo — icon theo loại */}
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${meta.ring}`}>
                      <MetaIcon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">Đối tượng bị báo cáo · {meta.label}</div>
                      <div className={`text-sm font-bold truncate ${meta.text}`}>{rep.target}</div>
                    </div>
                  </div>

                  {/* Nội dung tố cáo */}
                  <div className="relative bg-slate-900 border border-slate-800 p-3.5 pl-9 rounded-2xl flex-1">
                    <Quote size={14} className="absolute left-3 top-3.5 text-slate-600" />
                    <p className="text-xs text-slate-300 leading-relaxed font-medium italic">{rep.content}</p>
                  </div>

                  {/* Hành động: Từ chối + Giải quyết (chỉ ở tab Chờ xử lý) */}
                  <div className="flex justify-end gap-2 pt-1">
                    {statusFilter === 'PENDING' ? (
                      <>
                        <button
                          onClick={() => openConfirm('reject', rep)}
                          className="px-4 py-2 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/50 text-red-300 font-bold text-xs rounded-radius-full flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <X size={14} /> Từ chối
                        </button>
                        <button
                          onClick={() => openConfirm('resolve', rep)}
                          className="px-4.5 py-2 bg-purple-650 hover:bg-purple-750 text-white font-bold text-xs rounded-radius-full shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                        >
                          <ShieldCheck size={14} /> Giải quyết xong
                        </button>
                      </>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-radius-full text-[11px] font-bold inline-flex items-center gap-1.5 ${statusFilter === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {statusFilter === 'RESOLVED' ? <ShieldCheck size={13} /> : <XCircle size={13} />}
                        {statusFilter === 'RESOLVED' ? 'Đã xử lý' : 'Đã từ chối'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <ReviewPagination
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            currentCount={list.length}
            unit="báo cáo"
            onPage={setPage}
            loading={loading}
          />
        </div>

        {/* Cột phụ: cẩm nang + chú thích loại đối tượng + nhắc nhở */}
        <aside className="space-y-5 lg:sticky lg:top-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-md">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-4">
              <ClipboardCheck size={16} className="text-purple-400" /> Cẩm nang xử lý báo cáo
            </h3>
            <ul className="space-y-3">
              {REPORT_GUIDELINES.map((g, i) => {
                const GIcon = g.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
                      <GIcon size={13} />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300 leading-relaxed">{g.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-md">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Flag size={16} className="text-purple-400" /> Loại đối tượng bị báo cáo
            </h3>
            <ul className="grid grid-cols-2 gap-2.5">
              {['RESTAURANT', 'SHIPPER', 'USER', 'ORDER', 'REVIEW'].map((t) => {
                const m = TARGET_META[t];
                const MIcon = m.icon;
                return (
                  <li key={t} className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${m.ring}`}>
                      <MIcon size={12} />
                    </span>
                    <span className="text-[11px] font-bold text-slate-300">{m.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-3xl border border-purple-900/40 bg-purple-950/20 p-4 flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-purple-300 shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-purple-300 leading-relaxed">
              Quyết định xử lý ảnh hưởng trực tiếp tới đối tác/khách hàng. Hãy đối chiếu kỹ bằng chứng trước khi <b>giải quyết</b> hoặc <b>từ chối</b>.
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmState.open}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        danger={confirmState.action === 'reject'}
        title={confirmState.action === 'reject' ? 'Từ chối báo cáo' : 'Giải quyết báo cáo'}
        message={confirmState.action === 'reject'
          ? `Bạn có chắc muốn TỪ CHỐI báo cáo đối với "${confirmState.target}"? Báo cáo sẽ được đánh dấu là không đủ căn cứ.`
          : `Xác nhận đã xác minh & xử lý xong báo cáo đối với "${confirmState.target}"?`}
        confirmLabel={confirmState.action === 'reject' ? 'Từ chối' : 'Giải quyết xong'}
        loading={actionLoading}
      />
    </div>
  );
}
