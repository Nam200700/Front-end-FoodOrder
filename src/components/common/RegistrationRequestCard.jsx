import React, { useState } from 'react';
import { Check, X, Calendar, User, Phone, MapPin, FileText, BadgeAlert } from 'lucide-react';
import Button from './Button';

export default function RegistrationRequestCard({ 
  request, 
  fields = [], 
  onApprove, 
  onReject, 
  loading = false,
  role = 'OWNER'
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    onReject(request.id || request.userId, rejectReason.trim());
    setRejectReason('');
    setShowRejectInput(false);
  };

  const getRoleBadgeColor = () => {
    if (role === 'OWNER') return 'bg-[#1A73E8]/10 text-[#1A73E8] border-[#1A73E8]/20';
    return 'bg-[#34A853]/10 text-[#34A853] border-[#34A853]/20';
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'APPROVED': return 'Đã duyệt';
      case 'REJECTED': return 'Đã từ chối';
      default: return 'Chờ phê duyệt';
    }
  };

  const formattedDate = request.createdAt 
    ? new Date(request.createdAt).toLocaleDateString('vi-VN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'Chưa cập nhật';

  return (
    <div className="bg-white rounded-radius-xl border border-slate-100 shadow-sm overflow-hidden p-6 transition-all duration-300 hover:shadow-md hover:border-slate-200/60">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-radius-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center font-extrabold text-slate-500 shrink-0">
            {request.avatar || request.restaurantImageUrl ? (
              <img 
                src={request.avatar || request.restaurantImageUrl} 
                alt={request.fullName || request.restaurantName}
                className="w-full h-full object-cover"
              />
            ) : (
              (request.fullName || request.restaurantName || '?').substring(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 leading-snug">
              {request.restaurantName || request.fullName}
            </h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[9px] font-extrabold uppercase border px-2 py-0.5 rounded-full ${getRoleBadgeColor()}`}>
                {role === 'OWNER' ? 'Cửa Hàng' : 'Tài Xế'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold inline-flex items-center gap-1">
                <Calendar size={12} /> {formattedDate}
              </span>
            </div>
          </div>
        </div>
        
        <span className={`text-[10px] font-extrabold uppercase border px-2.5 py-1 rounded-full ${getStatusBadgeColor(request.status || request.registerStatus)}`}>
          {getStatusLabel(request.status || request.registerStatus)}
        </span>
      </div>

      {/* Info Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {fields.map((field, index) => (
          <div key={index} className="flex flex-col">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              {field.label}
            </span>
            <span className="text-xs font-semibold text-slate-700 leading-relaxed break-all">
              {field.value || 'Chưa cung cấp'}
            </span>
          </div>
        ))}
      </div>

      {/* Rejection Reason (If status is rejected) */}
      {(request.rejectedReason || request.rejectedReason === '') && (request.status === 'REJECTED' || request.registerStatus === 'REJECTED') && (
        <div className="mb-4 bg-red-50/50 border border-red-100 rounded-radius-lg p-3 flex items-start gap-2.5">
          <BadgeAlert size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-widest block mb-0.5">Lý do từ chối</span>
            <p className="text-xs font-bold text-red-700 leading-relaxed">
              {request.rejectedReason || 'Không có lý do cụ thể.'}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      {(request.status === 'PENDING' || request.registerStatus === 'PENDING') && (
        <div className="border-t border-slate-50 pt-4 flex flex-col gap-3">
          {!showRejectInput ? (
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowRejectInput(true)}
                disabled={loading}
                className="hover:bg-red-50 hover:text-red-600 hover:border-red-200 border-slate-200 text-slate-500 font-extrabold"
              >
                <X size={14} className="mr-1.5" /> Từ Chối
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => onApprove(request.id || request.userId)}
                disabled={loading}
                className="font-extrabold shadow-sm"
              >
                <Check size={14} className="mr-1.5" /> Phê Duyệt
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1 mb-1.5">
                  Lý do từ chối phê duyệt
                </label>
                <textarea
                  required
                  placeholder="Nhập lý do từ chối (ví dụ: Biển số xe không rõ ràng, Hình ảnh CCCD mờ...)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-radius-lg p-3 text-xs font-semibold focus:outline-none focus:border-red-500 focus:bg-white transition-all text-slate-700 min-h-[70px]"
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowRejectInput(false)}
                  className="border-slate-200 text-slate-500 font-extrabold text-xs"
                >
                  Hủy
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm" 
                  disabled={loading || !rejectReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs border-red-600 hover:border-red-700"
                >
                  Xác Nhận Từ Chối
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

    </div>
  );
}
