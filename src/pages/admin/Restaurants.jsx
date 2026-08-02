import React, { useState, useEffect, useCallback } from 'react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import RegistrationRequestCard from '../../components/common/RegistrationRequestCard';
import RegistrationReviewShell from '../../components/common/RegistrationReviewShell';
import { toast } from 'react-toastify';
import { Store, CheckCircle2, MapPin, Image, FileText, Phone, Inbox } from 'lucide-react';
import ErrorState from '../../components/common/ErrorState';
import ConfirmDialog from '../../components/common/ConfirmDialog';

// Cẩm nang duyệt hồ sơ QUÁN ĂN (hiển thị ở cột phụ)
const OWNER_GUIDELINES = [
  { icon: Store, text: 'Tên quán rõ ràng, không phản cảm hay trùng lặp gây nhầm lẫn.' },
  { icon: MapPin, text: 'Địa chỉ hoạt động cụ thể, hợp lệ và có thật.' },
  { icon: Image, text: 'Ảnh đại diện quán rõ nét, đúng ngành ẩm thực (nếu có).' },
  { icon: FileText, text: 'Mô tả quán phù hợp thuần phong mỹ tục, không sai phạm.' },
  { icon: Phone, text: 'Số điện thoại liên hệ chính xác để đối soát khi cần.' },
];

const PAGE_SIZE = 5; // số hồ sơ mỗi trang

export default function AdminRestaurants() {
  const [activeFilter, setActiveFilter] = useState('pending'); // pending, approved, rejected
  const [page, setPage] = useState(0);
  const [confirmApproveState, setConfirmApproveState] = useState({ open: false, id: null, name: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  const statusParam = activeFilter === 'approved' ? 'APPROVED' : activeFilter === 'rejected' ? 'REJECTED' : 'PENDING';

  const mapRestaurantRequests = (data) => ({
    items: (data?.content || []).map(reg => ({
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
    })),
    totalPages: data?.totalPages || 1,
    totalElements: data?.totalElements || 0,
  });

  const { data: pageData, loading, error, refetch } = useFetchData(`/admin/restaurant-registers?status=${statusParam}&page=${page}&size=${PAGE_SIZE}`, {
    mapFn: mapRestaurantRequests,
    deps: [activeFilter, page],
  });

  const requests = pageData?.items;
  const totalPages = pageData?.totalPages || 1;
  const totalElements = pageData?.totalElements || 0;

  // Đổi bộ lọc → về trang đầu
  const handleFilterChange = (f) => { setActiveFilter(f); setPage(0); };

  // Đếm số hồ sơ mỗi trạng thái (size=1 → đọc totalElements) cho chip thống kê + badge tab
  const fetchCounts = useCallback(async () => {
    try {
      const [p, a, r] = await Promise.all([
        apiClient.get('/admin/restaurant-registers?status=PENDING&size=1'),
        apiClient.get('/admin/restaurant-registers?status=APPROVED&size=1'),
        apiClient.get('/admin/restaurant-registers?status=REJECTED&size=1'),
      ]);
      setCounts({
        pending: p.data?.data?.totalElements || 0,
        approved: a.data?.data?.totalElements || 0,
        rejected: r.data?.data?.totalElements || 0,
      });
    } catch (err) {
      console.error('Lỗi đếm hồ sơ quán:', err);
    }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Trang cuối vừa bị duyệt hết → lùi về trang trước cho khỏi trống
  useEffect(() => {
    if (!loading && requests && requests.length === 0 && page > 0) setPage(p => p - 1);
  }, [loading, requests, page]);

  const refreshAll = () => { refetch(); fetchCounts(); };

  const handleApproveClick = (id) => {
    const reqObj = (requests || []).find(r => r.id === id);
    setConfirmApproveState({ open: true, id, name: reqObj ? reqObj.restaurantName : 'Quán ăn' });
  };

  const handleApproveConfirm = async () => {
    const { id, name } = confirmApproveState;
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/restaurant-registers/${id}/review`, { status: 'APPROVED' });
      toast.success(`Đã phê duyệt và kích hoạt quán ăn "${name}" thành công!`);
      setConfirmApproveState({ open: false, id: null, name: '' });
      refreshAll();
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi phê duyệt.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id, reason) => {
    const reqObj = (requests || []).find(r => r.id === id);
    const name = reqObj ? reqObj.restaurantName : 'Quán ăn';
    try {
      await apiClient.patch(`/admin/restaurant-registers/${id}/review`, { status: 'REJECTED', rejectedReason: reason });
      toast.success(`Đã từ chối đăng ký cho đối tác "${name}" với lý do: "${reason}"`);
      refreshAll();
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
    <RegistrationReviewShell
      icon={Store}
      title="Duyệt Đăng Ký Quán Ăn"
      subtitle="Xét duyệt hồ sơ đối tác cửa hàng. Phê duyệt để kích hoạt quán, hoặc từ chối kèm lý do minh bạch."
      counts={counts}
      activeFilter={activeFilter}
      onFilterChange={handleFilterChange}
      guidelines={OWNER_GUIDELINES}
      pagination={{
        page, totalPages, totalElements,
        currentCount: list.length, unit: 'hồ sơ quán',
        onPage: setPage, loading,
      }}
    >
      {list.length === 0 ? (
        <div className="text-center py-16 px-6 bg-slate-950 rounded-3xl border border-dashed border-slate-800 text-slate-400 shadow-md flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            {activeFilter === 'pending'
              ? <CheckCircle2 size={30} className="text-emerald-500" strokeWidth={1.6} />
              : <Inbox size={30} className="text-slate-500" strokeWidth={1.6} />}
          </div>
          <p className="text-sm font-bold text-slate-300">
            {activeFilter === 'pending' ? 'Tuyệt vời — không còn hồ sơ nào chờ duyệt!' : 'Chưa có hồ sơ nào trong mục này.'}
          </p>
          <p className="text-xs font-semibold text-slate-500 max-w-xs leading-relaxed">
            {activeFilter === 'pending'
              ? 'Mọi đăng ký quán ăn đã được xử lý. Hồ sơ mới sẽ xuất hiện tại đây.'
              : 'Các hồ sơ sẽ hiển thị ở đây khi có dữ liệu tương ứng.'}
          </p>
        </div>
      ) : (
        list.map((req, idx) => {
          const fields = [
            { label: 'Chủ tài khoản đối tác', value: `${req.ownerName} (ID: ${req.ownerId})` },
            { label: 'Điện thoại liên hệ', value: req.phone },
            { label: 'Địa chỉ hoạt động', value: req.address },
            { label: 'Mô tả quán ăn', value: req.description }
          ];
          return (
            <div key={req.id} className="animate-rise-in" style={{ animationDelay: `${idx * 60}ms` }}>
              <RegistrationRequestCard
                request={req}
                fields={fields}
                onApprove={handleApproveClick}
                onReject={handleReject}
                loading={loading}
                role="OWNER"
              />
            </div>
          );
        })
      )}

      <ConfirmDialog
        isOpen={confirmApproveState.open}
        onClose={() => setConfirmApproveState({ open: false, id: null, name: '' })}
        onConfirm={handleApproveConfirm}
        title="Phê duyệt đăng ký quán ăn"
        message={`Bạn có chắc chắn muốn PHÊ DUYỆT kích hoạt tài khoản đối tác và tạo quán ăn "${confirmApproveState.name}" không?`}
        confirmLabel="Phê duyệt"
        loading={actionLoading}
      />
    </RegistrationReviewShell>
  );
}
