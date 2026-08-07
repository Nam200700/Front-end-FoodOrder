import React, { useState, useMemo } from 'react';
import { Users, UserCheck, Lock, ShieldCheck, ChevronLeft, ChevronRight, Unlock, Search } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import { toast } from 'react-toastify';
import ErrorState from '../../components/common/ErrorState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import FilterTabs from '../../components/common/FilterTabs';
import { useModalState } from '../../hooks/useModalState';

export default function AdminUsers() {
  const unlockModal = useModalState();
  const lockModal = useModalState();

  const [lockReason, setLockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [roleFilter, setRoleFilter] = useState('all');    // all | CUSTOMER | OWNER | SHIPPER | ADMIN
  const [statusFilter, setStatusFilter] = useState('all'); // all | ACTIVE | BLOCKED
  const [keyword, setKeyword] = useState('');              // Từ khóa tìm kiếm (tên, sđt, email)

  const [page, setPage] = useState(0);                     
  const pageSize = 10;                                    

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: pageSize.toString(),
    });

    if (keyword.trim()) {
      params.append('keyword', keyword.trim());
    }

    if (roleFilter !== 'all') {
      params.append('role', roleFilter);
    }

    if (statusFilter === 'ACTIVE') {
      params.append('active', 'true');
    } else if (statusFilter === 'BLOCKED') {
      params.append('active', 'false');
    }

    return `/admin/users?${params.toString()}`;
  }, [page, pageSize, roleFilter, statusFilter, keyword]);

  // Lấy dữ liệu danh sách người dùng phân trang
  const mapUsers = (data) => {
    const realUsers = data?.content || [];
    return {
      items: realUsers.map(user => ({
        id: user.id,
        name: user.fullName || 'Người dùng',
        email: user.email || 'Chưa có email',
        phone: user.phone || 'Chưa có SĐT',
        role: user.role,
        status: user.status ? 'ACTIVE' : 'BLOCKED',
        lockedAt: user.lockedAt,
        lockedReason: user.lockedReason
      })),
      totalPages: data?.totalPages || 1,
      totalElements: data?.totalElements || 0
    };
  };

  const { data: pageData, loading, error, refetch } = useFetchData(apiUrl, {
    mapFn: mapUsers,
  });

  const { data: kpiData, refetch: refetchKpi } = useFetchData('/admin/users/stats');

  const usersList = pageData?.items || [];
  const totalPages = pageData?.totalPages || 1;
  const totalElements = pageData?.totalElements || 0;

  const list = usersList;

  const userSummary = useMemo(() => {
    return {
      totalUser: kpiData?.totalUser ?? totalElements,
      activeUser: kpiData?.activeUser ?? 0,
      blockedUser: kpiData?.blockedUser ?? 0,
      totalAdmin: kpiData?.totalAdmin ?? 0,
      totalCustomer: kpiData?.totalCustomer ?? 0,
      totalOwner: kpiData?.totalOwner ?? 0,
      totalShipper: kpiData?.totalShipper ?? 0
    };
  }, [kpiData, totalElements]);

  const handleRoleChange = (newRole) => {
    setRoleFilter(newRole);
    setPage(0);
  };

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setKeyword(e.target.value);
    setPage(0); 
  };

  const handleToggleStatusClick = (userId, name, currentStatus) => {
    const nextActive = currentStatus === 'BLOCKED';
    if (nextActive) {
      unlockModal.open({ userId, name });
    } else {
      lockModal.open({ userId, name });
    }
  };

  // Mở khóa tài khoản
  const handleUnlockConfirm = async () => {
    const { userId, name } = unlockModal.data || {};
    if (!userId) return;
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/users/${userId}/status?active=true`);
      toast.success(`Đã mở khoá tài khoản ${name} thành công!`);
      unlockModal.close();
      refetch();
      refetchKpi(); 
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi thay đổi trạng thái tài khoản.');
    } finally {
      setActionLoading(false);
    }
  };

  // Khóa tài khoản
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
      toast.success(`Đã khóa tài khoản ${name} thành công!`);
      lockModal.close();
      refetch();
      refetchKpi();
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
      <div className="flex-1 p-4 md:p-6 w-full font-google-sans text-slate-800 pb-24 flex justify-center items-center bg-white">
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 md:px-6 py-5 w-full font-google-sans text-slate-800 pb-24 space-y-5 bg-white min-h-screen">
      <div>
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Users className="text-purple-600" size={22} /> Quản Lý Tài Khoản
        </h1>
      </div>

      {/* HÀNG KPI HIỂN THỊ TỔNG TOÀN HỆ THỐNG */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tổng tài khoản', value: `${userSummary.totalUser}`, sub: `Toàn hệ thống`, icon: Users, color: 'border-purple-100 bg-purple-50/50 text-purple-600', iconBg: 'bg-purple-100 text-purple-600' },
          { label: 'Đang hoạt động', value: `${userSummary.activeUser}`, sub: 'Toàn hệ thống', icon: UserCheck, color: 'border-emerald-100 bg-emerald-50/50 text-emerald-600', iconBg: 'bg-emerald-100 text-emerald-600' },
          { label: 'Đã khóa', value: `${userSummary.blockedUser}`, sub: 'Toàn hệ thống', icon: Lock, color: 'border-red-100 bg-red-50/50 text-red-600', iconBg: 'bg-red-100 text-red-600' },
          { label: 'Quản trị viên', value: `${userSummary.totalAdmin}`, sub: 'Tài khoản nội bộ', icon: ShieldCheck, color: 'border-cyan-100 bg-cyan-50/50 text-cyan-600', iconBg: 'bg-cyan-100 text-cyan-600' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`rounded-2xl p-3.5 border shadow-sm flex items-center gap-3 ${kpi.color}`}>
              <div className={`p-2 rounded-xl shrink-0 ${kpi.iconBg}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 font-bold block truncate uppercase tracking-wider">{kpi.label}</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">{kpi.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={keyword}
            onChange={handleSearchChange}
            placeholder="Tìm theo tên, số điện thoại, email"
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all font-semibold text-slate-800"
          />
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <FilterTabs
            tabs={[
              { id: 'all', label: `Tất cả vai trò (${userSummary.totalUser})` },
              { id: 'CUSTOMER', label: `Khách hàng (${userSummary.totalCustomer})` },
              { id: 'OWNER', label: `Chủ quán (${userSummary.totalOwner})` },
              { id: 'SHIPPER', label: `Tài xế (${userSummary.totalShipper})` },
              { id: 'ADMIN', label: `Quản trị (${userSummary.totalAdmin})` },
            ]}
            activeTab={roleFilter}
            onTabChange={handleRoleChange}
            className="bg-transparent p-0 w-max"
            activeClassName="bg-purple-600 text-white shadow-sm font-bold"
          />

          <FilterTabs
            tabs={[
              { id: 'all', label: 'Tất cả trạng thái' },
              { id: 'ACTIVE', label: 'Đang hoạt động' },
              { id: 'BLOCKED', label: 'Đã khóa' },
            ]}
            activeTab={statusFilter}
            onTabChange={handleStatusChange}
            className="bg-transparent p-0 w-max"
            activeClassName="bg-purple-600 text-white shadow-sm font-bold"
          />
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {list.length === 0 ? (
          <div className="text-center py-14 text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
            <Users size={36} className="text-slate-300" strokeWidth={1.5} />
            Không tìm thấy tài khoản nào phù hợp với từ khóa và bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Tên người dùng</th>
                  <th className="py-3.5 px-4">Địa chỉ Email</th>
                  <th className="py-3.5 px-4">Số điện thoại</th>
                  <th className="py-3.5 px-4">Vai trò</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {list.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-extrabold text-xs shrink-0">
                          {(user.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-extrabold text-slate-800">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{user.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{user.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="role" role={user.role} />
                    </td>
                    <td className="py-3.5 px-4">
                      {user.status === 'ACTIVE' ? (
                        <Badge status="COMPLETED" className="text-emerald-700 border-emerald-200 bg-emerald-50">Đang hoạt động</Badge>
                      ) : (
                        <div>
                          <Badge status="CANCELLED" className="text-red-700 border-red-200 bg-red-50">Đã khóa</Badge>
                          {user.lockedReason && (
                            <p className="text-[10px] text-red-500 mt-1 italic font-medium leading-tight">
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
                    <td className="py-3.5 px-4">
                      {user.role !== 'ADMIN' && (
                        user.status === 'ACTIVE' ? (
                          <button 
                            onClick={() => handleToggleStatusClick(user.id, user.name, user.status)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/60 transition-all shadow-2xs cursor-pointer"
                            title="Khóa tài khoản"
                          >
                            <Lock size={13} />
                            <span>Khóa</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleToggleStatusClick(user.id, user.name, user.status)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 transition-all shadow-2xs cursor-pointer"
                            title="Mở khóa tài khoản"
                          >
                            <Unlock size={13} />
                            <span>Mở khóa</span>
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* THANH PHÂN TRANG */}
        {totalPages > 0 && (
          <div className="py-3.5 px-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị <span className="text-slate-800 font-bold">{list.length}</span> / <span className="text-slate-800 font-bold">{totalElements}</span> người dùng
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(prev - 1, 0))}
                disabled={page === 0 || loading}
                className="flex items-center gap-1 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-xl"
              >
                <ChevronLeft size={14} /> 
              </Button>

              <div className="flex items-center gap-1 px-1">
                <span className="text-xs text-slate-500">Trang {page + 1}</span>
                <span className="text-xs text-slate-500">/</span>
                <span className="text-xs text-slate-500">{totalPages}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages - 1))}
                disabled={page >= totalPages - 1 || loading}
                className="flex items-center gap-1 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-xl"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={unlockModal.isOpen}
        onClose={() => unlockModal.close()}
        onConfirm={handleUnlockConfirm}
        title="Xác Nhận Mở Khóa Tài Khoản"
        message={`Bạn có chắc chắn muốn mở khóa tài khoản của "${unlockModal.data?.name || ''}" không?`}
        confirmLabel="Mở khóa"
        loading={actionLoading}
      />

      <Modal
        isOpen={lockModal.isOpen}
        onClose={() => lockModal.close()}
        title="Xác Nhận Khóa Tài Khoản"
        size="sm"
      >
        <div className="space-y-4 font-google-sans">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Lý do khóa</label>
            <textarea
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-500 text-slate-800 bg-white"
              rows={3}
              placeholder="Nhập lý do khóa tài khoản..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => lockModal.close()}
              disabled={actionLoading}
              size="sm"
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleLockConfirm}
              loading={actionLoading}
              disabled={!lockReason.trim()}
              size="sm"
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
            >
              Khóa tài khoản
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}