import { useState } from 'react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import RegistrationRequestCard from '../../components/common/RegistrationRequestCard';
import FilterTabs from '../../components/common/FilterTabs';
import { toast } from 'react-toastify';
import ErrorState from '../../components/common/ErrorState';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function AdminShippers() {
  const [activeFilter, setActiveFilter] = useState('pending'); // pending, approved, rejected
  const [confirmApproveState, setConfirmApproveState] = useState({ open: false, id: null, name: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const statusParam = activeFilter === 'approved' ? 'APPROVED' : activeFilter === 'rejected' ? 'REJECTED' : 'PENDING';

  const mapShipperRequests = (data) => {
    const allRegs = data?.content || [];
    return allRegs.map(reg => {
      let vehicleLabel = 'Xe máy';
      if (reg.vehicleType === 'BICYCLE') vehicleLabel = 'Xe đạp';
      else if (reg.vehicleType === 'CAR') vehicleLabel = 'Ô tô';

      return {
        id: reg.registerId,
        userId: reg.userId,
        fullName: reg.userName || 'Tài xế mới',
        phone: reg.phone || 'Chưa cung cấp',
        email: reg.email,
        idCard: reg.idCard,
        vehicle: vehicleLabel,
        licensePlate: reg.licensePlate,
        createdAt: reg.createdAt,
        status: reg.status,
        rejectedReason: reg.rejectedReason,
        activeDelivery: reg.activeDelivery || 0,
        totalDelivery: reg.totalDelivery || 0
      };
    });
  };

  const { data: requests, loading, error, refetch } = useFetchData(`/admin/shipper-registers?status=${statusParam}&size=100`, {
    mapFn: mapShipperRequests,
    deps: [activeFilter],
  });

  const handleApproveClick = (id) => {
    const list = requests || [];
    const reqObj = list.find(r => r.id === id);
    const name = reqObj ? reqObj.fullName : 'Tài xế';
    setConfirmApproveState({ open: true, id, name });
  };

  const handleApproveConfirm = async () => {
    if (actionLoading) return;
    const { id, name } = confirmApproveState;
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/shipper-registers/${id}/review`, { status: 'APPROVED' });
      toast.success(`Đã phê duyệt và kích hoạt tài xế "${name}" thành công!`);
      setConfirmApproveState({ open: false, id: null, name: '' });
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi phê duyệt tài xế.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id, reason) => {
    if (actionLoading) return;
    const list = requests || [];
    const reqObj = list.find(r => r.id === id);
    const name = reqObj ? reqObj.fullName : 'Tài xế';
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/shipper-registers/${id}/review`, { status: 'REJECTED', rejectedReason: reason });
      toast.success(`Đã từ chối tài xế "${name}" với lý do: ${reason}`);
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi từ chối tài xế.');
    } finally {
      setActionLoading(false);
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
      <h1 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
        🚴 Duyệt Đăng Ký Tài Xế Shipper
      </h1>

      {/* Filter tab bar */}
      <FilterTabs
        tabs={[
          { id: 'pending', label: 'Chờ duyệt' },
          { id: 'approved', label: 'Đã phê duyệt' },
          { id: 'rejected', label: 'Đã từ chối' }
        ]}
        activeTab={activeFilter}
        onTabChange={setActiveFilter}
        className="bg-white p-1.5 rounded-2xl border border-slate-200/80 w-max shadow-sm"
      />

      <div className="space-y-4">
        {list.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/60 text-slate-400 text-xs font-bold shadow-sm">
            🎉 Không có yêu cầu đăng ký nào trong mục này.
          </div>
        ) : (
          list.map((req) => {
            const fields = [
              { label: 'Số điện thoại', value: req.phone },
              { label: 'Email liên hệ', value: req.email },
              { label: 'Số CCCD/ID Card', value: req.idCard },
              { label: 'Phương tiện di chuyển', value: `${req.vehicle} (Biển số: ${req.licensePlate || 'N/A'})` }
            ];

            return (
              <RegistrationRequestCard
                key={req.id}
                request={req}
                fields={fields}
                onApprove={handleApproveClick}
                onReject={handleReject}
                loading={loading || actionLoading}
                role="SHIPPER"
              />
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmApproveState.open}
        onClose={() => setConfirmApproveState({ open: false, id: null, name: '' })}
        onConfirm={handleApproveConfirm}
        title="Phê duyệt tài xế"
        message={`Bạn có chắc chắn muốn PHÊ DUYỆT kích hoạt tài xế "${confirmApproveState.name}" gia nhập hệ thống không?`}
        confirmLabel="Phê duyệt"
        loading={actionLoading}
      />

    </div>
  );
}
