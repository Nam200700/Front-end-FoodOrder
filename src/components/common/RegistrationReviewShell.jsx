import React from 'react';
import { Clock, CheckCircle2, XCircle, ShieldCheck, ClipboardCheck, ArrowRight, Sparkles } from 'lucide-react';
import FilterTabs from './FilterTabs';
import ReviewPagination from './ReviewPagination';

/**
 * Khung trang duyệt hồ sơ đối tác (Admin) — dùng chung cho Quán ăn & Shipper.
 * Chỉ là lớp TRANG TRÍ/BỐ CỤC (không đụng logic duyệt): hero có blob + chip thống kê,
 * filter tab kèm số đếm, và cột phụ "cẩm nang duyệt + quy trình" để lấp khoảng trống,
 * giúp trang có sức sống thay vì 1 card lọt thỏm giữa khoảng trắng.
 */

// 4 bước quy trình chung — hiển thị ở cột phụ để trang đỡ trống & có ngữ cảnh
const PROCESS_STEPS = [
  { title: 'Tiếp nhận hồ sơ', desc: 'Đối tác gửi đăng ký, vào hàng chờ duyệt.' },
  { title: 'Đối chiếu thông tin', desc: 'Kiểm tra thông tin & giấy tờ so với cẩm nang.' },
  { title: 'Ra quyết định', desc: 'Phê duyệt để kích hoạt, hoặc từ chối kèm lý do.' },
  { title: 'Đối tác nhận kết quả', desc: 'Hệ thống thông báo kết quả cho đối tác.' },
];

export default function RegistrationReviewShell({
  icon: Icon,
  title,
  subtitle,
  counts = { pending: 0, approved: 0, rejected: 0 },
  activeFilter,
  onFilterChange,
  guidelines = [],
  pagination = null,
  children,
}) {
  const chips = [
    {
      id: 'pending', label: 'Chờ duyệt', value: counts.pending, icon: Clock,
      color: 'text-amber-400', ring: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      card: 'bg-slate-900 border-amber-500/30 hover:border-amber-500/60 hover:shadow-amber-950/40',
      pulse: (counts.pending ?? 0) > 0, // còn hồ sơ chờ → nhấp nháy nhắc việc
    },
    {
      id: 'approved', label: 'Đã duyệt', value: counts.approved, icon: CheckCircle2,
      color: 'text-emerald-400', ring: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      card: 'bg-slate-900 border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-emerald-950/40',
    },
    {
      id: 'rejected', label: 'Từ chối', value: counts.rejected, icon: XCircle,
      color: 'text-red-400', ring: 'bg-red-500/15 border-red-500/30 text-red-400',
      card: 'bg-slate-900 border-red-500/30 hover:border-red-500/60 hover:shadow-red-950/40',
    },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">

      {/* ─── HERO trang trí ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 md:p-7 shadow-md">
        {/* blob nền cho có chiều sâu */}
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-6 w-56 h-56 rounded-full bg-fuchsia-600/10 blur-3xl" />
        {/* icon chấm nhỏ trang trí */}
        <Sparkles className="pointer-events-none absolute top-5 right-6 text-purple-400/30" size={18} />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
              {Icon && <Icon size={28} />}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-100">{title}</h1>
              <p className="text-xs text-slate-400 font-semibold mt-1.5 max-w-md leading-relaxed">{subtitle}</p>
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
                  {/* chấm nhấp nháy khi còn hồ sơ chờ duyệt */}
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

      {/* ─── Filter tabs (kèm số đếm) ─── */}
      <FilterTabs
        tabs={[
          { id: 'pending', label: 'Chờ duyệt' },
          { id: 'approved', label: 'Đã phê duyệt' },
          { id: 'rejected', label: 'Đã từ chối' },
        ]}
        activeTab={activeFilter}
        onTabChange={onFilterChange}
        counts={counts}
        className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-max shadow-sm"
        activeClassName="bg-purple-650 text-white shadow-sm shadow-purple-650/25"
      />

      {/* ─── Nội dung chính + cột phụ ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Danh sách hồ sơ */}
        <div className="lg:col-span-2 space-y-4">
          {children}
          {pagination && <ReviewPagination {...pagination} />}
        </div>

        {/* Cột phụ: cẩm nang + quy trình (lấp khoảng trống, thêm ngữ cảnh) */}
        <aside className="space-y-5 lg:sticky lg:top-6">
          {/* Cẩm nang duyệt */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-md">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-4">
              <ClipboardCheck size={16} className="text-purple-400" /> Cẩm nang duyệt hồ sơ
            </h3>
            <ul className="space-y-3">
              {guidelines.map((g, i) => {
                const GIcon = g.icon || CheckCircle2;
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

          {/* Quy trình xử lý */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-md">
            <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-4">
              <ArrowRight size={16} className="text-purple-400" /> Quy trình xử lý
            </h3>
            <ol className="space-y-3.5">
              {PROCESS_STEPS.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-black text-purple-300 shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-[11px] font-bold text-slate-200 leading-snug">{s.title}</div>
                    <div className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">{s.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Nhắc nhở trách nhiệm */}
          <div className="rounded-3xl border border-purple-900/40 bg-purple-950/20 p-4 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-purple-300 shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-purple-300 leading-relaxed">
              Phê duyệt sẽ <b>kích hoạt tài khoản đối tác</b> ngay lập tức. Hãy đối chiếu kỹ thông tin trước khi quyết định.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
