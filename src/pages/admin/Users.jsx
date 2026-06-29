import React, { useState } from 'react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';
import ErrorState from '../../components/common/ErrorState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useModalState } from '../../hooks/useModalState';

export default function AdminUsers() {
  const unlockModal = useModalState();
  const lockModal = useModalState();
  const [lockReason, setLockReason] = useState('Vi phạm điều khoản sử dụng');
  const [actionLoading, setActionLoading] = useState(false);

  const mapUsers = (data) => {
    const realUsers = data?.content || [];
    return realUsers.map(user => ({
      id: user.userId || user.id,
      name: user.fullName || 'Người dùng',
      email: user.email || 'Chưa có email',
      phone: user.phone || 'Chưa có SĐT',
      role: user.role,
      status: user.status ? 'ACTIVE' : 'BLOCKED',
      lockedAt: user.lockedAt,
      lockedReason: user.lockedReason
    }));
  };

  const { data: usersList, loading, error, refetch } = useFetchData('/admin/users?size=100', {
    mapFn: mapUsers,
  });

  const handleToggleStatusClick = (userId, name, currentStatus) => {
    const nextActive = currentStatus === 'BLOCKED';
    if (nextActive) {
      unlockModal.open({ userId, name });
    } else {
      setLockReason('Vi phạm điều khoản sử dụng');
      lockModal.open({ userId, name });
    }
  };

  const handleUnlockConfirm = async () => {
    const { userId, name } = unlockModal.data || {};
    if (!userId) return;
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/users/${userId}/status?active=true`);
      toast.success(`Đã thực hiện Mở khoá kích hoạt tài khoản "${name}" thành công!`);
      unlockModal.close();
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi thay đổi trạng thái tài khoản.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockConfirm = async () => {
    const { userId, name } = lockModal.data || {};
    if (!userId) return;
    if (!lockReason.trim()) {
      toast.warning("Lý do khóa không được để trống!");
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/users/${userId}/status?active=false&lockedReason=${encodeURIComponent(lockReason.trim())}`);
      toast.success(`Đã thực hiện Khóa chặn tài khoản "${name}" thành công!`);
      lockModal.close();
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi thay đổi trạng thái tài khoản.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && (!usersList || usersList.length === 0)) {
    return <Spinner fullScreen />;
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans text-slate-100 pb-24 flex justify-center items-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const list = usersList || [];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">
      <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
        👥 Quản lý tài khoản người dùng
      </h1>

      <div className="bg-slate-950 rounded-radius-xl border border-slate-800 overflow-hidden shadow-md">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <tr>
              <th className="p-4">Tên người dùng</th>
              <th className="p-4">Địa chỉ Email / SĐT</th>
              <th className="p-4">Vai trò</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 font-semibold">
            {list.map((user) => (
              <tr key={user.id} className="hover:bg-slate-900/30">
                <td className="p-4 font-extrabold text-slate-100">{user.name}</td>
                <td className="p-4 text-slate-400">
                  <div>{user.email}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{user.phone}</div>
                </td>
                <td className="p-4">
                  <Badge variant="role" role={user.role} />
                </td>
                <td className="p-4">
                  {user.status === 'ACTIVE' ? (
                    <Badge status="COMPLETED" className="text-emerald-500 border-emerald-900/30 bg-emerald-950/45">Active</Badge>
                  ) : (
                    <div>
                      <Badge status="CANCELLED" className="text-red-500 border-red-900/30 bg-red-950/45">Blocked</Badge>
                      {user.lockedReason && (
                        <p className="text-[10px] text-red-400 mt-1 italic font-medium leading-tight">
                          Lý do: {user.lockedReason}
                        </p>
                      )}
                      {user.lockedAt && (
                        <p className="text-[9px] text-slate-400 mt-0.5 font-normal">
                          Khóa lúc: {new Date(user.lockedAt).toLocaleString('vi-VN')}
                        </p>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleToggleStatusClick(user.id, user.name, user.status)}
                    className={`text-xs font-bold hover:underline cursor-pointer ${
                      user.status === 'ACTIVE' ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm Mở khóa */}
      <ConfirmDialog
        isOpen={unlockModal.isOpen}
        onClose={() => unlockModal.close()}
        onConfirm={handleUnlockConfirm}
        title="Mở khóa tài khoản"
        message={`Bạn có chắc chắn muốn mở khóa tài khoản của "${unlockModal.data?.name || ''}" không?`}
        confirmLabel="Mở khóa"
        loading={actionLoading}
      />

      {/* Modal Khóa tài khoản */}
      <Modal
        isOpen={lockModal.isOpen}
        onClose={() => lockModal.close()}
        title={`Khóa tài khoản ${lockModal.data?.name || ''}`}
        size="sm"
      >
        <div className="space-y-4 font-google-sans">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Lý do khóa chặn</label>
            <textarea
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-md-primary text-slate-800"
              rows={3}
              placeholder="Nhập lý do khóa tài khoản..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => lockModal.close()}
              disabled={actionLoading}
              size="sm"
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleLockConfirm}
              loading={actionLoading}
              disabled={!lockReason.trim()}
              size="sm"
            >
              Khóa tài khoản
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

