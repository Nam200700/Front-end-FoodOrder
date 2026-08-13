import React, { useState, useMemo } from 'react';
import { Ticket, Plus, Search, Edit3, Ban, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import { toast } from 'react-toastify';
import ErrorState from '../../components/common/ErrorState';
import Modal from '../../components/common/Modal';
import FilterTabs from '../../components/common/FilterTabs';
import { useModalState } from '../../hooks/useModalState';
import { formatDateTime, formatCurrency } from '../../utils/format';

export default function Voucher() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | ACTIVE | INACTIVE | EXPIRED
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Hook quản lý modal Thêm/Sửa
  const formModal = useModalState();
  // Hook quản lý modal Xác nhận khóa
  const lockModal = useModalState();

  // State form data 
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    discountType: 'PERCENT',
    discountValue: '',
    minOrderAmount: '',
    startDate: '',
    endDate: '',
    status: 'ACTIVE',
    issueType: 'EVENT',
    pointsCost: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // Gọi API lấy KPI thống kê Voucher
  const { data: statsData, refetch: refetchKpi } = useFetchData('/vouchers/stats', {
    mapFn: (res) => res?.result || res || { totalVouchers: 0, activeVouchers: 0, inactiveVouchers: 0, expiredVouchers: 0 }
  });

  // URL API phân trang & lọc
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      size: pageSize.toString(),
    });

    if (keyword.trim()) {
      params.append('keyword', keyword.trim());
    }

    if (statusFilter !== 'all') {
      params.append('status', statusFilter);
    }

    return `/vouchers?${params.toString()}`;
  }, [page, pageSize, statusFilter, keyword]);

  // Lấy danh sách voucher
  const { data: rawVouchersData, loading, error, refetch } = useFetchData(apiUrl, {
    mapFn: (res) => res?.result || res || {}
  });

  const vouchersList = rawVouchersData?.content || (Array.isArray(rawVouchersData) ? rawVouchersData : []);
  const totalPages = rawVouchersData?.totalPages || 1;
  const totalElements = rawVouchersData?.totalElements || vouchersList.length;

  const filterTabs = [
    { id: 'all', label: 'Tất cả', count: statsData?.totalVouchers },
    { id: 'ACTIVE', label: 'Đang hoạt động', count: statsData?.activeVouchers },
    { id: 'INACTIVE', label: 'Tạm khóa', count: statsData?.inactiveVouchers },
    { id: 'EXPIRED', label: 'Đã hết hạn', count: statsData?.expiredVouchers },
  ];

  // Xử lý mở Modal Thêm mới
  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      discountType: 'PERCENT',
      discountValue: '',
      minOrderAmount: '',
      startDate: '',
      endDate: '',
      status: 'ACTIVE',
      issueType: 'EVENT',
      pointsCost: ''
    });
    formModal.open(null);
  };

  // Xử lý mở Modal Cập nhật
  const handleOpenEdit = (voucher) => {
    const formatLocalDateTime = (dateStr) => {
      if (!dateStr) return '';
      return dateStr.slice(0, 16);
    };

    setFormData({
      code: voucher.code || '',
      name: voucher.name || '',
      discountType: voucher.discountType || 'PERCENT',
      discountValue: voucher.discountValue || '',
      minOrderAmount: voucher.minOrderAmount != null ? voucher.minOrderAmount : '',
      startDate: formatLocalDateTime(voucher.startDate),
      endDate: formatLocalDateTime(voucher.endDate),
      status: voucher.status || 'ACTIVE',
      issueType: voucher.issueType || 'EVENT',
      pointsCost: voucher.pointsCost != null ? voucher.pointsCost : ''
    });
    formModal.open(voucher.voucherId);
  };

  // Validate Form chuẩn xác nghiệp vụ
  const validateForm = () => {
    if (!formData.code.trim()) {
      toast.error('Mã voucher không được để trống!');
      return false;
    }
    if (!formData.name.trim()) {
      toast.error('Tên chương trình voucher không được để trống!');
      return false;
    }

    if (formData.discountValue === '') {
      toast.error('Vui lòng nhập giá trị giảm!');
      return false;
    }
    
    const val = Number(formData.discountValue);
    if (isNaN(val) || val <= 0) {
      toast.error('Giá trị giảm phải là một số lớn hơn 0!');
      return false;
    }

    // Voucher đổi điểm bắt buộc nhập số điểm > 0
    if (formData.issueType === 'LOYALTY') {
      const pc = Number(formData.pointsCost);
      if (formData.pointsCost === '' || isNaN(pc) || pc <= 0) {
        toast.error('Voucher đổi điểm bắt buộc nhập số điểm cần để đổi (> 0)!');
        return false;
      }
    }

    if (formData.discountType === 'PERCENT' && val > 100) {
      toast.error('Giá trị giảm theo phần trăm (%) không được vượt quá 100%!');
      return false;
    }

    // VALIDATE ĐƠN TỐI THIỂU (minOrderAmount)
    if (formData.discountType === 'FIXED' && formData.issueType === 'EVENT') {
      if (formData.minOrderAmount === '' || formData.minOrderAmount === null) {
        toast.error('Voucher giảm cố định theo Sự kiện bắt buộc phải nhập Đơn tối thiểu!');
        return false;
      }
      const minVal = Number(formData.minOrderAmount);
      if (isNaN(minVal) || minVal < val) {
        toast.error(`Đơn tối thiểu (${minVal.toLocaleString()} đ) phải lớn hơn hoặc bằng Giá trị giảm (${val.toLocaleString()} đ)!`);
        return false;
      }
    } else {
      if (formData.minOrderAmount !== '') {
        const minVal = Number(formData.minOrderAmount);
        if (isNaN(minVal) || minVal < 0) {
          toast.error('Giá trị đơn tối thiểu không được nhỏ hơn 0!');
          return false;
        }
      }
    }

    if (!formData.startDate) {
      toast.error('Vui lòng chọn thời gian bắt đầu!');
      return false;
    }

    if (!formData.endDate) {
      toast.error('Vui lòng chọn thời gian kết thúc!');
      return false;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end <= start) {
      toast.error('Thời gian kết thúc phải lớn hơn thời gian bắt đầu!');
      return false;
    }

    return true;
  };

  // Submit Form (Thêm hoặc Sửa)
  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        discountValue: Number(formData.discountValue),
        minOrderAmount: formData.minOrderAmount !== '' ? Number(formData.minOrderAmount) : null,
        startDate: formData.startDate ? `${formData.startDate}:00` : null,
        endDate: formData.endDate ? `${formData.endDate}:00` : null,
      };

      if (formModal.data) {
        await apiClient.put(`/vouchers/${formModal.data}`, payload);
        toast.success('Cập nhật thông tin voucher thành công!');
      } else {
        await apiClient.post('/vouchers', payload);
        toast.success('Thêm mới voucher thành công!');
      }

      formModal.close();
      refetch();
      refetchKpi();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  // Khóa voucher
  const handleLockSubmit = async () => {
    try {
      const voucherId = lockModal.data;
      await apiClient.put(`/vouchers/${voucherId}/inactive`); 
      toast.success('Đã khóa voucher thành công!');
      lockModal.close();
      refetch();
      refetchKpi();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể khóa voucher này.');
    }
  };

  const isEditMode = Boolean(formModal.data);

  if (loading && vouchersList.length === 0 && page === 0) {
    return <Spinner fullScreen />;
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-6 w-full font-google-sans text-slate-800 pb-24 flex justify-center items-center bg-white">
        <ErrorState onRetry={() => { refetch(); refetchKpi(); }} />
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 md:px-6 py-5 w-full font-google-sans text-slate-800 pb-24 space-y-5 bg-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Ticket className="text-purple-600" size={22} />
          Quản Lý Voucher 
        </h1>
        <Button 
          onClick={handleOpenCreate}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={16} /> Thêm Voucher
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
            <Ticket size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Tổng số voucher</p>
            <h3 className="text-xl font-extrabold text-slate-900">{statsData?.totalVouchers || 0}</h3>
          </div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Đang hoạt động</p>
            <h3 className="text-xl font-extrabold text-emerald-600">{statsData?.activeVouchers || 0}</h3>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-slate-200 text-slate-600 rounded-xl">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Đang tạm khóa</p>
            <h3 className="text-xl font-extrabold text-slate-700">{statsData?.inactiveVouchers || 0}</h3>
          </div>
        </div>
        <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Đã hết hạn</p>
            <h3 className="text-xl font-extrabold text-amber-600">{statsData?.expiredVouchers || 0}</h3>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <FilterTabs
            tabs={filterTabs}
            activeTab={statusFilter}
            onTabChange={(tabId) => { setStatusFilter(tabId); setPage(0); }}
            className="bg-transparent p-0 w-max"
            activeClassName="bg-purple-600 text-white shadow-sm font-bold"
          />

          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
              placeholder="Tìm theo mã hoặc tên voucher..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 focus:bg-white transition-all font-semibold text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Voucher Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {vouchersList.length === 0 ? (
          <div className="text-center py-14 text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
            <Ticket size={36} className="text-slate-300" strokeWidth={1.5} />
            Không tìm thấy voucher nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs text-left min-w-[1050px] table-fixed">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-28">Mã Voucher</th>
                  <th className="py-3.5 px-4 w-40">Tên chương trình</th>
                  <th className="py-3.5 px-4 w-32">Loại phát hành</th>
                  <th className="py-3.5 px-4 w-32">Loại giảm</th>
                  <th className="py-3.5 px-4 w-28">Giá trị giảm</th>
                  <th className="py-3.5 px-4 w-32">Đơn tối thiểu</th>
                  <th className="py-3.5 px-4 w-24">Đã dùng</th>
                  <th className="py-3.5 px-4 w-40">Thời gian hiệu lực</th>
                  <th className="py-3.5 px-4 w-37">Trạng thái</th>
                  <th className="py-3.5 px-4 w-28 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {vouchersList.map((v) => (
                  <tr key={v.voucherId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 w-28 font-extrabold text-purple-600 truncate">{v.code}</td>
                    <td className="py-3.5 px-4 w-40 text-slate-800 font-bold truncate" title={v.name}>{v.name}</td>
                    <td className="py-3.5 px-4 w-32 truncate">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        v.issueType === 'EVENT'
                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                          : v.issueType === 'LOYALTY'
                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}>
                        {v.issueType === 'EVENT' ? 'Sự kiện' : v.issueType === 'LOYALTY' ? 'Đổi điểm' : 'Hủy đơn hàng'}
                      </span>
                      {v.issueType === 'LOYALTY' && v.pointsCost != null && (
                        <span className="block mt-1 text-[10px] font-bold text-amber-600">Cần {v.pointsCost} điểm</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 w-28 text-slate-600 truncate">
                      {v.discountType === 'PERCENT' ? 'Phần trăm (%)' : v.discountType === 'FIXED' ? 'Cố định (VNĐ)' : 'Miễn phí ship'}
                    </td>
                    <td className="py-3.5 px-4 w-28 font-extrabold text-emerald-600 truncate">
                      {v.discountType === 'PERCENT' ? `${v.discountValue}%` : v.discountType === 'FIXED' ? `${formatCurrency(v.discountValue)}` : 'Freeship'}
                    </td>
                    <td className="py-3.5 px-4 w-32 text-slate-700 font-bold truncate">
                      {v.minOrderAmount != null && Number(v.minOrderAmount) > 0 
                        ? `${formatCurrency(v.minOrderAmount)}` 
                        : 'Không yêu cầu'}
                    </td>
                    <td className="py-3.5 px-4 w-24 text-slate-600 truncate">
                      {v.usedQuantity || 0}
                    </td>
                    <td className="py-3.5 px-4 w-40 text-slate-500 text-[11px] truncate">
                      {formatDateTime(v.startDate)} <br/>đến {formatDateTime(v.endDate)}
                    </td>
                    <td className="py-3.5 px-4 w-28 truncate">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        v.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : v.status === 'EXPIRED' || (v.endDate && new Date(v.endDate) < new Date())
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {v.status === 'ACTIVE' ? 'Đang hoạt động' : (v.status === 'EXPIRED' || (v.endDate && new Date(v.endDate) < new Date())) ? 'Đã hết hạn' : 'Tạm khóa'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 w-24 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(v)}
                          title="Sửa voucher"
                          className="p-1.5 rounded-lg border bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 transition-all cursor-pointer"
                        >
                          <Edit3 size={14} />
                        </button>
                        {/* {v.status === 'ACTIVE' && (
                          <button
                            onClick={() => lockModal.open(v.voucherId)}
                            title="Khóa voucher"
                            className="p-1.5 rounded-lg border bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200 transition-all cursor-pointer"
                          >
                            <Ban size={14} />
                          </button>
                        )} */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="py-3.5 px-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị <span className="text-slate-800 font-bold">{vouchersList.length}</span> / <span className="text-slate-800 font-bold">{totalElements}</span> voucher
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

      {/* Modal Thêm / Cập nhật Voucher */}
      <Modal
        isOpen={formModal.isOpen}
        onClose={formModal.close}
        title={isEditMode ? 'Cập Nhật Thông Tin Voucher' : 'Thêm Mới Voucher'}
        size="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mã Voucher */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Mã Voucher (*)</span>
                {isEditMode && <Lock size={12} className="text-slate-400" />}
              </label>
              <input
                type="text"
                maxLength={50}
                disabled={isEditMode}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="VD: SALE50"
                className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none uppercase ${
                  isEditMode ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-bold' : 'bg-slate-50 border-slate-200 focus:border-purple-500 text-slate-800 font-extrabold'
                }`}
              />
            </div>

            {/* Tên Voucher (Cho phép sửa) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên Chương Trình (*)</label>
              <input
                type="text"
                maxLength={255}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Khuyến mãi sự kiện hè"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800 font-semibold"
              />
            </div>

            {/* Loại Phát Hành */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Loại Phát Hành (*)</span>
                {isEditMode && <Lock size={12} className="text-slate-400" />}
              </label>
              <select
                disabled={isEditMode}
                value={formData.issueType}
                onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none ${
                  isEditMode ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-semibold' : 'bg-slate-50 border-slate-200 focus:border-purple-500 text-slate-800 font-semibold'
                }`}
              >
                <option value="EVENT">Sự kiện</option>
                <option value="ORDER_CANCELLED">Hủy đơn hàng (đền bù)</option>
                <option value="LOYALTY">Đổi điểm thưởng</option>
              </select>
            </div>

            {/* Loại Giảm Giá */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Loại Giảm Giá (*)</span>
                {isEditMode && <Lock size={12} className="text-slate-400" />}
              </label>
              <select
                disabled={isEditMode}
                value={formData.discountType}
                onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none ${
                  isEditMode ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-semibold' : 'bg-slate-50 border-slate-200 focus:border-purple-500 text-slate-800 font-semibold'
                }`}
              >
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="FIXED">Số tiền cố định (VNĐ)</option>
                <option value="FREESHIP">Miễn phí vận chuyển</option>
              </select>
            </div>

            {/* Giá Trị Giảm */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Giá Trị Giảm (*)</span>
                {isEditMode && <Lock size={12} className="text-slate-400" />}
              </label>
              <input
                type="number"
                step="any"
                disabled={isEditMode}
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                placeholder="VD: 20000 hoặc 15 (%)"
                className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none ${
                  isEditMode ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-bold' : 'bg-slate-50 border-slate-200 focus:border-purple-500 text-slate-800 font-bold'
                }`}
              />
            </div>

            {/* Giá Trị Đơn Hàng Tối Thiểu */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>
                  Đơn Tối Thiểu (VNĐ) {formData.discountType === 'FIXED' && formData.issueType === 'EVENT' ? <b className="text-rose-500">(*)</b> : '(Tùy chọn)'}
                </span>
                {isEditMode && <Lock size={12} className="text-slate-400" />}
              </label>
              <input
                type="number"
                step="any"
                disabled={isEditMode}
                value={formData.minOrderAmount}
                onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                placeholder={formData.discountType === 'FIXED' && formData.issueType === 'EVENT' ? 'VD: 50000 (Bắt buộc >= Tiền giảm)' : 'VD: 50000 (Để trống nếu 0đ)'}
                className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none ${
                  isEditMode ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed font-semibold' : 'bg-slate-50 border-slate-200 focus:border-purple-500 text-slate-800 font-semibold'
                }`}
              />
            </div>

            {/* Số điểm cần để đổi — CHỈ cho loại "Đổi điểm" (LOYALTY) */}
            {formData.issueType === 'LOYALTY' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điểm cần để đổi <b className="text-amber-500">(*)</b>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.pointsCost}
                  onChange={(e) => setFormData({ ...formData, pointsCost: e.target.value })}
                  placeholder="VD: 100 (điểm thưởng)"
                  className="w-full px-3 py-2 text-xs bg-amber-50/60 border border-amber-200 rounded-xl focus:outline-none focus:border-amber-500 text-slate-800 font-bold"
                />
              </div>
            )}

            {/* Trạng Thái (Cho phép sửa) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Trạng Thái (*)</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800 font-semibold"
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Tạm khóa</option>
              </select>
            </div>

            {/* Thời Gian Bắt Đầu (Cho phép sửa) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Thời Gian Bắt Đầu (*)</label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800 font-semibold"
              />
            </div>

            {/* Thời Gian Kết Thúc (Cho phép sửa) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Thời Gian Kết Thúc (*)</label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 text-slate-800 font-semibold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={formModal.close}
              className="text-xs font-bold px-4 py-2 rounded-xl"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"
            >
              {submitting ? 'Đang lưu...' : 'Lưu lại'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Xác Nhận Khóa Voucher */}
      <Modal
        isOpen={lockModal.isOpen}
        onClose={lockModal.close}
        title="Xác Nhận Khóa Voucher"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Bạn có chắc chắn muốn khóa voucher này không? Voucher sẽ chuyển sang trạng thái tạm khóa và không thể sử dụng cho các đơn hàng mới.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={lockModal.close}
              className="text-xs font-bold px-4 py-2 rounded-xl"
            >
              Hủy
            </Button>
            <Button
              onClick={handleLockSubmit}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"
            >
              Xác nhận khóa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}