import React from 'react';
import { AlertTriangle, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';

export default function AdminReports() {
  const mapReports = (data) => {
    const realData = data?.content || data || [];
    return realData.map(rep => {
      const dateObj = rep.createdAt ? new Date(rep.createdAt) : new Date();
      const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
      
      return {
        id: rep.reportId || rep.id,
        sender: rep.reporterName || rep.reporterPhone || `User #${rep.reporterId || '—'}`,
        target: rep.reportedUserName || rep.reportedUserPhone || `Đối tượng #${rep.reportedUserId || '—'}`,
        content: rep.reason || 'Không có nội dung mô tả.',
        date: dateStr
      };
    });
  };

  const { data: reports, loading, refetch } = useFetchData('/admin/reports?status=PENDING&size=500', {
    mapFn: mapReports,
  });

  const handleResolve = async (id, target) => {
    const note = window.prompt(
      `Nhập ghi chú xử lý báo cáo vi phạm đối với "${target}":`, 
      'Đã xác minh hành vi và nhắc nhở cảnh cáo đối tượng vi phạm.'
    );
    if (note === null) return; // Nhấn hủy prompt

    try {
      await apiClient.put(`/admin/reports/${id}/resolve`, {
        adminNote: note.trim() || 'Đã giải quyết xong',
        status: 'RESOLVED'
      });
      toast.success('Đã giải quyết báo cáo vi phạm thành công!');
      refetch();
    } catch (err) {
      console.warn('Lỗi gọi API resolve chuyên dụng, thử cập nhật PUT trực tiếp:', err);
      try {
        // Fallback PUT trực tiếp lên resource report
        await apiClient.put(`/admin/reports/${id}`, {
          status: 'RESOLVED',
          adminNote: note.trim() || 'Đã giải quyết xong'
        });
        toast.success('Đã giải quyết báo cáo vi phạm thành công!');
        refetch();
      } catch (fallbackErr) {
        console.error('Lỗi giải quyết báo cáo:', fallbackErr);
        toast.error('Không thể xử lý báo cáo vi phạm lúc này. Vui lòng thử lại sau!');
      }
    }
  };

  if (loading && (!reports || reports.length === 0)) {
    return <Spinner fullScreen />;
  }

  const list = reports || [];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">
      
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <AlertTriangle className="text-red-500 animate-pulse" size={24} />
          Xử lý báo cáo vi phạm từ khách hàng
        </h1>
        <button
          onClick={refetch}
          className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-radius-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      <div className="space-y-4">
        {list.length === 0 ? (
          <div className="text-center py-16 bg-slate-950 rounded-radius-xl border border-slate-800 text-slate-400 text-xs font-bold shadow-md flex flex-col items-center gap-3">
            {/* icon CheckCircle xanh thay emoji 🎉 cho trạng thái sạch báo cáo */}
            <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={1.5} />
            Tuyệt vời! Không còn báo cáo vi phạm nào chưa xử lý trên hệ thống.
          </div>
        ) : (
          list.map((rep) => (
            <div key={rep.id} className="bg-slate-950 border border-slate-800 rounded-radius-xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-start border-b border-slate-850 pb-3">
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-100">Người báo cáo: {rep.sender}</h3>
                  <span className="text-[10px] text-slate-500 block mt-1">Đối tượng bị báo cáo: <b className="text-red-400 font-bold">{rep.target}</b></span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">{rep.date}</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 border border-slate-850 p-3.5 rounded-radius-lg font-medium">
                "{rep.content}"
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => handleResolve(rep.id, rep.target)}
                  className="px-4.5 py-2 bg-purple-650 hover:bg-purple-750 text-white font-bold text-xs rounded-radius-full shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <ShieldCheck size={14} />
                  Giải quyết xong
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}