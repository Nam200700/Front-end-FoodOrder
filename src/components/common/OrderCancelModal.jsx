import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

const DEFAULT_REASONS = [
  'Khách hàng yêu cầu huỷ',
  'Quán hết nguyên liệu',
  'Không có tài xế',
  'Địa chỉ không hợp lệ',
  'Nghi ngờ gian lận',
];

/**
 * OrderCancelModal - Modal hủy đơn hàng dùng chung
 * Props:
 * - isOpen: boolean - Trạng thái đóng/mở
 * - onClose: function - Hàm xử lý khi đóng
 * - onConfirm: function - Hàm xử lý khi xác nhận hủy (nhận lý do hủy làm tham số)
 * - orderId: string/number - Mã đơn hàng cần hủy
 * - reasons: string[] - Danh sách lý do hủy tùy chọn (mặc định: DEFAULT_REASONS)
 * - loading: boolean - Trạng thái loading khi đang hủy (mặc định: false)
 */
export default function OrderCancelModal({
  isOpen,
  onClose,
  onConfirm,
  orderId,
  reasons = DEFAULT_REASONS,
  loading = false,
}) {
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');

  const reason = selected === '__custom__' ? custom : selected;
  const canSubmit = reason.trim().length >= 5;

  const handleClose = () => {
    setSelected('');
    setCustom('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    await onConfirm(reason.trim());
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Huỷ đơn #${orderId}`} size="sm">
      <div className="space-y-4 font-google-sans text-slate-800">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Chọn lý do huỷ *</p>
        
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelected(r)}
              className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                selected === r
                  ? 'border-md-primary bg-md-primary/5 text-md-primary font-bold'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {r}
            </button>
          ))}
          
          <button
            type="button"
            onClick={() => setSelected('__custom__')}
            className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              selected === '__custom__'
                ? 'border-md-primary bg-md-primary/5 text-md-primary font-bold'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Lý do khác...
          </button>
        </div>

        {selected === '__custom__' && (
          <div className="space-y-1 animate-fade-in">
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Nhập lý do huỷ chi tiết (tối thiểu 5 ký tự)..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs resize-none focus:outline-none focus:border-md-primary text-slate-800 font-semibold"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span>Mô tả chi tiết lý do hủy đơn</span>
              <span>{custom.length}/300 ký tự</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 mt-4">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={loading}
            size="sm"
          >
            Đóng
          </Button>
          <Button 
            variant="danger" 
            onClick={handleConfirm} 
            loading={loading} 
            disabled={!canSubmit}
            size="sm"
          >
            Xác nhận huỷ
          </Button>
        </div>
      </div>
    </Modal>
  );
}
