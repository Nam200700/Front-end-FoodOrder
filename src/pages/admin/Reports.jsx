import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, RefreshCw, CheckCircle2, User, Flag, Quote, ShieldAlert } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import FilterTabs from '../../components/common/FilterTabs';
import { toast } from 'react-toastify';

// Các trạng thái báo cáo (khớp enum BE ReportStatus) — cho phép admin xem cả lịch sử đã xử lý
const REPORT_STATUS_TABS = [
  { id: 'PENDING', label: 'Chờ xử lý' },
  { id: 'RESOLVED', label: 'Đã xử lý' },
  { id: 'REJECTED', label: 'Đã từ chối' },
];

export default function AdminReports() {
  // Ghép nhãn đối tượng bị báo cáo theo targetType (BE ReportResponse chỉ trả targetType + targetId,
  // không có tên/phone nên trước đây cột luôn hiện "Đối tượng #—").
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

  const mapReports = (data) => {
    const realData = data?.content || data || [];
    return realData.map(rep => {
      const dateObj = rep.createdAt ? new Date(rep.createdAt) : new Date();
      const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

      return {
        id: rep.reportId || rep.id,
        // Ưu tiên tên thật do backend trả (reporterName/targetName); thiếu thì fallback về nhãn kèm #id.
        sender: rep.reporterName || `Người dùng #${rep.reporterId || '—'}`,
        target: rep.targetName || targetLabel(rep.targetType, rep.targetId),
        content: rep.reason || 'Không có nội dung mô tả.',
        date: dateStr
      };
    });
  };

  // Lọc theo trạng thái: PENDING mặc định; đổi tab sẽ đổi URL -> useFetchData tự refetch
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const { data: reports, loading, refetch } = useFetchData(`/admin/reports?status=${statusFilter}&size=500`, {
    mapFn: mapReports,
  });

  // Đếm số báo cáo theo trạng thái để hiện badge trên tab (một lần gọi lấy tất cả rồi đếm)
  const [statusCounts, setStatusCounts] = useState({});
  useEffect(() => {
    let ignore = false;
    apiClient.get('/admin/reports?size=500')
      .then((res) => {
        if (ignore) return;
        const all = res.data?.data?.content || [];
        const counts = {};
        all.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
        setStatusCounts(counts);
      })
      .catch((err) => console.error('Lỗi đếm báo cáo theo trạng thái:', err));
    return () => { ignore = true; };
  }, [reports]); // refresh sau khi giải quyết 1 báo cáo (danh sách đổi)

  const handleResolve = async (id, target) => {
    // BE dùng PATCH /admin/reports/{id}/resolve và ResolveReportRequest chỉ nhận { status }
    // (không có adminNote). Chỉ cần xác nhận trước khi đánh dấu đã xử lý.
    if (!window.confirm(`Xác nhận đã xác minh & xử lý báo cáo đối với "${target}"?`)) return;

    try {
      await apiClient.patch(`/admin/reports/${id}/resolve`, { status: 'RESOLVED' });
      toast.success('Đã giải quyết báo cáo vi phạm thành công!');
      refetch();
    } catch (err) {
      console.error('Lỗi giải quyết báo cáo:', err);
      toast.error('Không thể xử lý báo cáo vi phạm lúc này. Vui lòng thử lại sau!');
    }
  };

  if (loading && (!reports || reports.length === 0)) {
    return <Spinner fullScreen />;
  }

  const list = reports || [];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="text-red-500 animate-pulse" size={24} />
            Xử lý báo cáo vi phạm từ khách hàng
          </h1>
          <p className="text-xs text-slate-400 mt-1">Xác minh & xử lý các khiếu nại vi phạm đang chờ trên nền tảng</p>
        </div>
        <button
          onClick={refetch}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-radius-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Bộ lọc trạng thái: xem báo cáo chờ xử lý / đã xử lý / đã từ chối (lịch sử) */}
      <FilterTabs
        tabs={REPORT_STATUS_TABS}
        activeTab={statusFilter}
        onTabChange={setStatusFilter}
        counts={statusCounts}
        className="bg-slate-900 p-1 rounded-radius-lg border border-slate-800 w-max"
        activeClassName="bg-purple-650 text-white shadow-sm"
      />

      {/* ─── Dải tổng quan: số báo cáo đang chờ xử lý (chỉ ở tab PENDING) ─────── */}
      {statusFilter === 'PENDING' && list.length > 0 && (
        <div className="flex items-center gap-3 bg-red-950/15 border border-red-900/30 rounded-radius-xl p-4">
          <div className="p-2.5 rounded-radius-lg bg-red-500/10 text-red-400 shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-100 block">Đang có {list.length} báo cáo chờ xử lý</span>
            <span className="text-[11px] text-slate-400">Ưu tiên xác minh sớm để bảo vệ trải nghiệm người dùng</span>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="text-center py-16 bg-slate-950 rounded-radius-xl border border-slate-800 text-slate-400 text-xs font-bold shadow-md flex flex-col items-center gap-3">
          {/* icon CheckCircle xanh thay emoji 🎉 cho trạng thái sạch báo cáo */}
          <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={1.5} />
          {statusFilter === 'PENDING'
            ? 'Tuyệt vời! Không còn báo cáo vi phạm nào chưa xử lý trên hệ thống.'
            : statusFilter === 'RESOLVED'
              ? 'Chưa có báo cáo nào đã được xử lý.'
              : 'Chưa có báo cáo nào bị từ chối.'}
        </div>
      ) : (
        // Lưới 2 cột ở màn rộng để tận dụng không gian (trước đây 1 cột bị trống bên phải)
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((rep) => (
            <div key={rep.id} className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 space-y-4 shadow-sm hover:border-slate-700 transition-colors flex flex-col">
              {/* Header: avatar chữ cái người báo cáo + đối tượng bị báo cáo + thời gian */}
              <div className="flex justify-between items-start border-b border-slate-850 pb-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-purple-950/40 border border-purple-900/40 flex items-center justify-center text-purple-300 font-extrabold text-sm shrink-0">
                    {(rep.sender || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-100 truncate flex items-center gap-1.5">
                      <User size={12} className="text-slate-500 shrink-0" /> {rep.sender}
                    </h3>
                    <span className="text-[10px] text-slate-500 mt-1 inline-flex items-center gap-1">
                      <Flag size={11} className="text-red-400 shrink-0" />
                      Đối tượng: <b className="text-red-400 font-bold">{rep.target}</b>
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold shrink-0">{rep.date}</span>
              </div>

              {/* Nội dung tố cáo: bọc trong khối trích dẫn có icon */}
              <div className="relative bg-slate-900 border border-slate-850 p-3.5 pl-9 rounded-radius-lg flex-1">
                <Quote size={14} className="absolute left-3 top-3.5 text-slate-600" />
                <p className="text-xs text-slate-300 leading-relaxed font-medium italic">
                  {rep.content}
                </p>
              </div>

              {/* Chỉ cho thao tác giải quyết ở tab PENDING; tab lịch sử hiển thị nhãn trạng thái */}
              <div className="flex justify-end gap-2 pt-1">
                {statusFilter === 'PENDING' ? (
                  <button
                    onClick={() => handleResolve(rep.id, rep.target)}
                    className="px-4.5 py-2 bg-purple-650 hover:bg-purple-750 text-white font-bold text-xs rounded-radius-full shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <ShieldCheck size={14} />
                    Giải quyết xong
                  </button>
                ) : (
                  <span className={`px-3 py-1.5 rounded-radius-full text-[11px] font-bold inline-flex items-center gap-1.5 ${statusFilter === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                    <ShieldCheck size={13} />
                    {statusFilter === 'RESOLVED' ? 'Đã xử lý' : 'Đã từ chối'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}