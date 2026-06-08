import React from 'react';
import Modal from './Modal';
import Button from './Button';

/**
 * ConfirmDialog component để thay thế cho window.confirm()
 * Props:
 * - isOpen: boolean - Trạng thái đóng/mở
 * - onClose: function - Hàm xử lý khi đóng/hủy
 * - onConfirm: function - Hàm xử lý khi xác nhận
 * - title: string - Tiêu đề hộp thoại
 * - message: string - Nội dung thông báo
 * - confirmLabel: string - Nhãn nút xác nhận (mặc định: 'Xác nhận')
 * - cancelLabel: string - Nhãn nút hủy (mặc định: 'Hủy')
 * - danger: boolean - Nếu là true sẽ hiển thị nút xác nhận màu đỏ (mặc định: false)
 * - loading: boolean - Trạng thái loading của nút xác nhận (mặc định: false)
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  danger = false,
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 font-google-sans leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
            size="sm"
          >
            {cancelLabel}
          </Button>
          <Button 
            variant={danger ? 'danger' : 'primary'} 
            onClick={onConfirm} 
            loading={loading}
            size="sm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
