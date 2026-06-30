import React, { useState } from 'react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import RegistrationRequestCard from '../../components/common/RegistrationRequestCard';
import FilterTabs from '../../components/common/FilterTabs';
import { toast } from 'react-toastify';
import { Store, CheckCircle2 } from 'lucide-react';
import ErrorState from '../../components/common/ErrorState';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function AdminRestaurants() {
  const [activeFilter, setActiveFilter] = useState('pending'); // pending, approved, rejected
  const [confirmApproveState, setConfirmApproveState] = useState({ open: false, id: null, name: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const statusParam = activeFilter === 'approved' ? 'APPROVED' : activeFilter === 'rejected' ? 'REJECTED' : 'PENDING';

  const mapRestaurantRequests = (data) => {
    const allRegs = data?.content || [];
    return allRegs.map(reg => {
      return {
        id: reg.registerId,
        ownerId: reg.ownerId,
        ownerName: reg.ownerName || 'Chủ quán đối tác',
        restaurantName: reg.restaurantName,
        phone: reg.phone || 'Chưa cung cấp',
        address: reg.address,
        description: reg.description || 'Chưa cung cấp mô tả',
        restaurantImageUrl: reg.imageUrl || null,
        createdAt: reg.createdAt,
        status: reg.status,
        rejectedReason: reg.rejectedReason
      };
    });
  };

  const { data: requests, loading, error, refetch } = useFetchData(`/admin/restaurant-registers?status=${statusParam}&size=100`, {
    mapFn: mapRestaurantRequests,
    deps: [activeFilter],
  });

  const handleApproveClick = (id) => {
    const list = requests || [];
    const reqObj = list.find(r => r.id === id);
    const name = reqObj ? reqObj.restaurantName : 'Quán ăn';
    setConfirmApproveState({ open: true, id, name });
  };

  const handleApproveConfirm = async () => {
    const { id, name } = confirmApproveState;
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/restaurant-registers/${id}/review`, { status: 'APPROVED' });
      toast.success(`Đã phê duyệt và kích hoạt quán ăn "${name}" thành công!`);
      setConfirmApproveState({ open: false, id: null, name: '' });
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi phê duyệt.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id, reason) => {
    const list = requests || [];
    const reqObj = list.find(r => r.id === id);
    const name = reqObj ? reqObj.restaurantName : 'Quán ăn';
    try {
      await apiClient.patch(`/admin/restaurant-registers/${id}/review`, { status: 'REJECTED', rejectedReason: reason });
      toast.success(`Đã từ chối đăng ký cho đối tác "${name}" với lý do: "${reason}"`);
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi từ chối phê duyệt.');
    }
  };

  if (loading && (!requests || requests.length === 0)) {
    return <Spinner fullScreen />;
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans text-slate-100 pb-24 flex justify-center items-center">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const list = requests || [];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full font-google-sans text-slate-100 pb-24 space-y-6">
      
      <div className="flex items-center gap-3">
        <h1 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2 tracking-tight">
          {/* icon Store tím thay emoji 🏪 */}
          <Store className="text-purple-400" size={26} /> Duyệt Đăng Ký Quán Ăn (Hồ sơ Đối tác)
        </h1>
      </div>

      {/* Filter tab bar — đồng bộ dark + tab active tím (tránh rò màu cam) */}
      <FilterTabs
        tabs={[
          { id: 'pending', label: 'Chờ duyệt' },
          { id: 'approved', label: 'Đã phê duyệt' },
          { id: 'rejected', label: 'Đã từ chối' }
        ]}
        activeTab={activeFilter}
        onTabChange={setActiveFilter}
        className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-max shadow-sm"
        activeClassName="bg-purple-650 text-white shadow-sm shadow-purple-650/25"
      />

      {/* Request lists */}
      <div className="space-y-4">
        {list.length === 0 ? (
          <div className="text-center py-12 bg-slate-950 rounded-3xl border border-slate-800 text-slate-400 text-xs font-semibold shadow-md flex flex-col items-center gap-3">
            {/* icon CheckCircle thay emoji 🎉 cho trạng thái rỗng */}
            <CheckCircle2 size={38} className="text-emerald-500" strokeWidth={1.5} />
            Không có yêu cầu đăng ký nào trong mục này.
          </div>
        ) : (
          list.map((req) => {
            const fields = [
              { label: 'Chủ tài khoản đối tác', value: `${req.ownerName} (ID: ${req.ownerId})` },
              { label: 'Điện thoại liên hệ', value: req.phone },
              { label: 'Địa chỉ hoạt động', value: req.address },
              { label: 'Mô tả quán ăn', value: req.description }
            ];

            return (
              <RegistrationRequestCard
                key={req.id}
                request={req}
                fields={fields}
                onApprove={handleApproveClick}
                onReject={handleReject}
                loading={loading}
                role="OWNER"
              />
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmApproveState.open}
        onClose={() => setConfirmApproveState({ open: false, id: null, name: '' })}
        onConfirm={handleApproveConfirm}
        title="Phê duyệt đăng ký quán ăn"
        message={`Bạn có chắc chắn muốn PHÊ DUYỆT kích hoạt tài khoản đối tác và tạo quán ăn "${confirmApproveState.name}" không?`}
        confirmLabel="Phê duyệt"
        loading={actionLoading}
      />

    </div>
  );
}
