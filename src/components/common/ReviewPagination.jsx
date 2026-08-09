import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Thanh phân trang tông dark-tím, dùng chung cho các trang Admin (duyệt hồ sơ, báo cáo…). */
export default function ReviewPagination({ page, totalPages, totalElements, currentCount, unit = 'mục', onPage, loading }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 flex items-center justify-between gap-4 shadow-md">
      <span className="text-[11px] text-slate-500 font-semibold">
        Hiển thị <b className="text-slate-300">{currentCount}</b> / <b className="text-slate-300">{totalElements}</b> {unit}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(Math.max(page - 1, 0))}
          disabled={page === 0 || loading}
          className="w-8 h-8 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 flex items-center justify-center transition-colors hover:border-purple-700 hover:text-purple-300 disabled:opacity-40 disabled:hover:border-slate-800 disabled:hover:text-slate-300 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Trang trước"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[11px] font-bold text-slate-400 tabular-nums px-1">
          Trang <span className="text-purple-300">{page + 1}</span> / {totalPages}
        </span>
        <button
          onClick={() => onPage(Math.min(page + 1, totalPages - 1))}
          disabled={page >= totalPages - 1 || loading}
          className="w-8 h-8 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 flex items-center justify-center transition-colors hover:border-purple-700 hover:text-purple-300 disabled:opacity-40 disabled:hover:border-slate-800 disabled:hover:text-slate-300 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Trang sau"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
