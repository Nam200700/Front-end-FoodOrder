import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LogOut,
  Clock,
  AlertTriangle,
  Check,
  Store,
  Bike,
  FileText,
  MapPin,
  Phone,
  ChevronRight,
  Loader2,
  RefreshCw,
  RadioTower,
  PartyPopper
} from 'lucide-react';
import Input from '../../components/common/Input';
import MapModal from '../../components/common/MapModal';
import apiClient from '../../services/api';
import { toast } from 'react-toastify';
import { validatePhone, validateIdCard } from '../../utils/validation';

export default function PartnerApproval() {
  const navigate = useNavigate();
  const { user, role, logout, ownerReRegister, shipperReRegister, refreshProfile } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [checking, setChecking] = useState(false);   // đang gọi kiểm tra trạng thái duyệt
  const [approved, setApproved] = useState(false);    // vừa phát hiện đã duyệt → hiện màn chúc mừng rồi chuyển
  
  // Owner fields for re-register
  const [restaurantName, setRestaurantName] = useState(user?.restaurantName || '');
  const [restaurantAddress, setRestaurantAddress] = useState(user?.restaurantAddress || user?.address || '');
  const [restaurantLat, setRestaurantLat] = useState(user?.restaurantLatitude || user?.lat || 10.762622);
  const [restaurantLng, setRestaurantLng] = useState(user?.restaurantLongitude || user?.lng || 106.660172);
  const [openMap, setOpenMap] = useState(false);
  const [restaurantPhone, setRestaurantPhone] = useState(user?.restaurantPhone || user?.phone || '');
  const [restaurantDescription, setRestaurantDescription] = useState(user?.restaurantDescription || '');
  const [restaurantImageUrl, setRestaurantImageUrl] = useState(user?.restaurantImageUrl || user?.avatar || '');

  // Shipper fields for re-register
  const [idCard, setIdCard] = useState(user?.idCard || '');
  const [vehicleType, setVehicleType] = useState(user?.vehicleType || 'MOTORBIKE');
  const [licensePlate, setLicensePlate] = useState(user?.licensePlate || '');

  const [errors, setErrors] = useState({});

  // Gõ lại vào ô nào thì xoá lỗi của ô đó — tránh chữ đỏ đứng mãi sau khi đã sửa.
  const clearError = (field) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const handleConfirmLocation = (lat, lng, address) => {
    setRestaurantAddress(address);
    setRestaurantLat(lat);
    setRestaurantLng(lng);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setErrors({});

    let res;
    if (role === 'OWNER' || role === 'MERCHANT') {
      // Kiểm tra đầy đủ: tên/địa chỉ bắt buộc, SĐT quán đúng định dạng (0 + 10 số) như trang đăng ký
      const ownerErr = {};
      if (!restaurantName.trim()) ownerErr.restaurantName = 'Tên quán không được để trống';
      if (!restaurantAddress.trim()) ownerErr.restaurantAddress = 'Địa chỉ quán không được để trống';
      if (!validatePhone(restaurantPhone)) ownerErr.restaurantPhone = 'Số điện thoại quán không hợp lệ (bắt đầu bằng 0, gồm 10 chữ số)';
      if (Object.keys(ownerErr).length > 0) {
        setErrors(ownerErr);
        setLoading(false);
        return;
      }
      res = await ownerReRegister(
        restaurantName,
        restaurantAddress,
        restaurantLat,
        restaurantLng,
        restaurantPhone,
        restaurantDescription,
        restaurantImageUrl
      );
    } else if (role === 'SHIPPER') {
      // CCCD/CMND phải đúng 9 hoặc 12 chữ số; biển số bắt buộc
      const shipperErr = {};
      if (!validateIdCard(idCard)) shipperErr.idCard = 'CCCD/CMND phải gồm 9 hoặc 12 chữ số';
      if (!licensePlate.trim()) shipperErr.licensePlate = 'Biển số xe không được để trống';
      if (Object.keys(shipperErr).length > 0) {
        setErrors(shipperErr);
        setLoading(false);
        return;
      }
      res = await shipperReRegister(idCard, vehicleType, licensePlate);
    }

    setLoading(false);
    if (res?.success) {
      toast.success('Gửi lại hồ sơ đối tác thành công! Vui lòng chờ xét duyệt từ Admin.');
      return;
    }

    // BE trả kèm bản đồ {field -> thông báo} khi trùng: tô đỏ TẤT CẢ ô sai cùng lúc.
    if (res?.validationErrors) {
      setErrors((prev) => ({ ...prev, ...res.validationErrors }));
      return;
    }

    // Lỗi trùng định danh: tô đỏ đúng ô để user biết phải sửa chỗ nào, thay vì
    // chỉ đọc banner chung rồi tự dò. Các lỗi khác vẫn hiện ở banner như cũ.
    const FIELD_BY_ERROR_CODE = {
      ID_CARD_EXISTS: ['idCard', 'Số CCCD/CMND này đã được sử dụng để đăng ký tài khoản khác!'],
      LICENSE_PLATE_EXISTS: ['licensePlate', 'Biển số xe này đã được đăng ký bởi tài xế khác!'],
      RESTAURANT_PHONE_EXISTS: ['restaurantPhone', 'Số điện thoại quán đã được đăng ký!'],
    };
    const mapped = FIELD_BY_ERROR_CODE[res?.errorCode];
    if (mapped) {
      const [field, message] = mapped;
      setErrors((prev) => ({ ...prev, [field]: message }));
    } else {
      setErrorMsg(res?.error || 'Gửi lại hồ sơ thất bại. Vui lòng kiểm tra lại!');
    }
  };

  const isPending = user?.registerStatus === 'PENDING';
  const isRejected = user?.registerStatus === 'REJECTED';

  // ─── TỰ ĐỘNG PHÁT HIỆN ADMIN ĐÃ DUYỆT (khỏi cần user F5) ───────────────────────
  // Peek /users/me: nếu registerStatus không còn PENDING/REJECTED nghĩa là đã duyệt →
  // hiện màn chúc mừng ~1.8s rồi cập nhật store; guard (ProtectedRoute) tự điều hướng
  // sang /merchant hoặc /shipper. Nếu bị từ chối → cập nhật store để chuyển sang form gửi lại.
  const committedRef = useRef(false);
  const checkApproval = useCallback(async (manual = false) => {
    if (committedRef.current) return;
    if (manual) setChecking(true);
    let raw;
    try {
      const r = await apiClient.get('/users/me'); // peek: chưa đụng store để kịp hiện màn chúc mừng
      raw = r.data?.data;
    } catch {
      if (manual) { setChecking(false); toast.error('Không kiểm tra được trạng thái lúc này. Thử lại sau nhé!'); }
      return;
    }
    if (manual) setChecking(false);
    if (!raw) return;
    const st = raw.registerStatus;
    const isApprovedNow = raw.status === true || (st !== 'PENDING' && st !== 'REJECTED');
    if (isApprovedNow) {
      committedRef.current = true;
      setApproved(true);
      // để màn chúc mừng hiển thị rồi mới cập nhật store → guard tự điều hướng
      setTimeout(() => { refreshProfile(); }, 1800);
    } else if (st === 'REJECTED') {
      committedRef.current = true;
      refreshProfile(); // đồng bộ store → render form gửi lại
    } else if (manual) {
      toast.info('Hồ sơ vẫn đang chờ Admin duyệt. Bạn sẽ được chuyển ngay khi được phê duyệt.');
    }
  }, [refreshProfile]);

  // Poll định kỳ + kiểm tra lại mỗi khi quay lại tab, chỉ khi đang chờ duyệt
  useEffect(() => {
    if (!isPending) return;
    const id = setInterval(() => { if (!document.hidden) checkApproval(false); }, 12000);
    const onVisible = () => { if (!document.hidden) checkApproval(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [isPending, checkApproval]);

  // Định nghĩa màu sắc thương hiệu
  const themeColor = role === 'SHIPPER' ? '#34A853' : '#1A73E8'; // Xanh lá cho Shipper, Xanh dương cho Owner
  const bgSoft = role === 'SHIPPER' ? 'bg-[#34A853]/5' : 'bg-[#1A73E8]/5';
  const borderActive = role === 'SHIPPER' ? 'border-[#34A853]' : 'border-[#1A73E8]';
  const textTheme = role === 'SHIPPER' ? 'text-[#34A853]' : 'text-[#1A73E8]';
  const btnGradient = role === 'SHIPPER' 
    ? 'from-[#34A853] to-[#2E8B49] hover:from-[#3fb95d] hover:to-[#34A853]' 
    : 'from-[#1A73E8] to-[#1557B0] hover:from-[#357ae8] hover:to-[#1A73E8]';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-google-sans relative overflow-hidden">
      
      {/* Mesh gradients backgrounds */}
      <div className={`absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-gradient-to-tr ${role === 'SHIPPER' ? 'from-[#34A853]/20' : 'from-[#1A73E8]/20'} to-transparent rounded-full blur-3xl opacity-60`}></div>
      <div className="absolute -bottom-48 -right-48 w-[32rem] h-[32rem] bg-gradient-to-tr from-[#FF6B35]/15 to-transparent rounded-full blur-3xl opacity-50"></div>

      {/* Double Bezel Container */}
      <div className="w-full max-w-2xl p-2.5 bg-slate-100/70 border border-slate-200/50 rounded-[2.25rem] shadow-shadow-2 relative z-10 animate-slide-up">
        
        {/* Core Card */}
        <div className="bg-white rounded-[calc(2.25rem-0.625rem)] p-8 sm:p-10 border border-slate-100/50 flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-gradient-to-tr ${role === 'SHIPPER' ? 'from-[#34A853] to-[#2E8B49]' : 'from-[#1A73E8] to-[#1557B0]'} rounded-xl flex items-center justify-center text-white shadow-md`}>
                {role === 'SHIPPER' ? <Bike size={20} /> : <Store size={20} />}
              </div>
              <div>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Hồ sơ đối tác
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-800 leading-tight">
                  {role === 'SHIPPER' ? 'Shipper Center' : 'Merchant Hub'}
                </h2>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-500 hover:bg-red-50 border border-red-200/30 transition-all cursor-pointer"
            >
              <LogOut size={14} />
              Đăng xuất
            </button>
          </div>

          {/* ─── CASE 0: VỪA ĐƯỢC DUYỆT — màn chúc mừng trước khi điều hướng ─────────── */}
          {isPending && approved && (
            <div className="space-y-6 text-center py-8 animate-rise-in">
              <div className="flex justify-center">
                <div className="relative">
                  <span className="absolute inset-0 rounded-full animate-halo" style={{ border: '2px solid #10B981' }} />
                  <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 animate-scale-up">
                    <PartyPopper size={46} strokeWidth={2} />
                  </div>
                </div>
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-2xl font-black text-emerald-600">Hồ sơ đã được duyệt! 🎉</h3>
                <p className="text-sm text-slate-500 font-semibold leading-relaxed">
                  Chúc mừng bạn đã trở thành đối tác chính thức của
                  <span className="text-[#FF6B35] font-extrabold"> Meal</span><span className="text-[#1A73E8] font-extrabold">Dash</span>.
                  Đang chuyển tới trang quản lý...
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600">
                <Loader2 size={16} className="animate-spin" /> Đang chuyển hướng
              </div>
            </div>
          )}

          {/* ─── CASE 1: PENDING (CHỜ DUYỆT HỒ SƠ) ─────────────────────────────────── */}
          {isPending && !approved && (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center animate-rise-in">
                <div className={`w-20 h-20 rounded-full ${bgSoft} flex items-center justify-center border-2 border-dashed ${borderActive} relative animate-float`}>
                  <Clock size={40} className={`${textTheme} animate-spin-slow`} />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
                  </span>
                </div>
              </div>

              <div className="max-w-md mx-auto space-y-2 animate-rise-in" style={{ animationDelay: '80ms' }}>
                <h3 className="text-xl font-extrabold text-slate-800">Hồ sơ đang được xét duyệt!</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-semibold">
                  Cảm ơn bạn đã đăng ký làm đối tác của <span className="text-[#FF6B35] font-extrabold">Meal</span><span className="text-[#1A73E8] font-extrabold">Dash</span>. Đơn đăng ký của bạn đang được Admin xem xét và phê duyệt (thường mất từ 1-2 ngày làm việc).
                </p>
              </div>

              {/* Approval Timeline UI */}
              <div className="bg-slate-50 border border-slate-100 rounded-radius-2xl p-6 max-w-md mx-auto mt-6 animate-rise-in" style={{ animationDelay: '140ms' }}>
                <div className="relative flex items-center justify-between">
                  {/* Progress line */}
                  <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[3px] bg-slate-200 z-0"></div>
                  <div className={`absolute left-4 w-1/2 top-1/2 -translate-y-1/2 h-[3px] ${role === 'SHIPPER' ? 'bg-[#34A853]/60' : 'bg-[#1A73E8]/60'} z-0 overflow-hidden`}>
                    {/* vệt sáng chảy dọc thanh tiến trình cho có "nhịp sống" */}
                    <span className="absolute inset-y-0 w-1/3 bg-white/60 animate-flow" />
                  </div>

                  {/* Step 1: Register */}
                  <div className="flex flex-col items-center z-10 relative">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                      <Check size={16} strokeWidth={3} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 mt-2">Nộp hồ sơ</span>
                  </div>

                  {/* Step 2: Pending */}
                  <div className="flex flex-col items-center z-10 relative">
                    <div className={`w-8 h-8 rounded-full ${borderActive} bg-white flex items-center justify-center shadow-md font-bold text-xs border-2 relative`}>
                      <span className="absolute inset-0 rounded-full animate-halo" style={{ border: `2px solid ${themeColor}` }} />
                      <span className={`w-2.5 h-2.5 rounded-full ${role === 'SHIPPER' ? 'bg-[#34A853]' : 'bg-[#1A73E8]'} animate-pulse`}></span>
                    </div>
                    <span className={`text-[10px] font-extrabold ${textTheme} mt-2`}>Đang xét duyệt</span>
                  </div>

                  {/* Step 3: Approved */}
                  <div className="flex flex-col items-center z-10 relative">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-2">Hoàn thành</span>
                  </div>
                </div>
              </div>

              {/* Chỉ báo đang theo dõi trực tiếp + nút kiểm tra thủ công */}
              <div className="flex flex-col items-center gap-3 pt-2 animate-rise-in" style={{ animationDelay: '200ms' }}>
                <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <RadioTower size={13} className="text-emerald-600" />
                  Đang theo dõi trực tiếp — tự chuyển ngay khi được duyệt
                </div>
                <button
                  onClick={() => checkApproval(true)}
                  disabled={checking}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full border bg-white hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-60 ${borderActive} ${textTheme}`}
                >
                  <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
                  {checking ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
                </button>
              </div>
            </div>
          )}

          {/* ─── CASE 2: REJECTED (BỊ TỪ CHỐI & GỬI LẠI ĐƠN) ────────────────────────── */}
          {isRejected && (
            <div className="space-y-6">
              
              {/* Alert Notification Box */}
              <div className="bg-red-50/70 border border-red-100 rounded-radius-2xl p-5 flex items-start gap-3.5 shadow-sm">
                <AlertTriangle size={24} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-extrabold text-red-800">Hồ sơ đối tác đã bị từ chối</h3>
                  <p className="text-xs text-red-700 leading-relaxed font-semibold mt-1">
                    Lý do: <span className="underline decoration-red-300 font-extrabold">{user?.rejectedReason || 'Không có lý do chi tiết từ Admin.'}</span>
                  </p>
                  <p className="text-[10px] text-red-500/80 font-bold uppercase mt-2">
                    Vui lòng chỉnh sửa thông tin bên dưới và gửi lại đơn đăng ký để được duyệt lại.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-radius-lg p-3 text-xs font-bold flex items-start gap-1.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{errorMsg}</span>
                </div>
              )}

              {/* Form Resubmission */}
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* OWNER FORM RE-SUBMIT */}
                {(role === 'OWNER' || role === 'MERCHANT') && (
                  <div className="space-y-5">
                    <h4 className="text-[10px] font-extrabold text-[#1A73E8] uppercase tracking-widest pl-1">
                      Chỉnh sửa thông tin hồ sơ quán
                    </h4>

                    <Input
                      label="Tên Quán Ăn"
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Ví dụ: Cơm Tấm Sài Gòn..."
                      icon={Store}
                      error={errors.restaurantName}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Input
                        label="Số Điện Thoại Quán"
                        type="tel"
                        required
                        value={restaurantPhone}
                        onChange={(e) => { setRestaurantPhone(e.target.value); clearError('restaurantPhone'); }}
                        placeholder="Để khách liên hệ..."
                        icon={Phone}
                        error={errors.restaurantPhone}
                      />

                      <div className="cursor-pointer" onClick={() => setOpenMap(true)}>
                        <Input
                          label="Địa Chỉ Quán Ăn (Nhấn để chọn bản đồ)"
                          type="text"
                          required
                          readOnly
                          value={restaurantAddress}
                          placeholder="Chọn vị trí quán ăn trên bản đồ..."
                          icon={MapPin}
                          error={errors.restaurantAddress}
                          className="cursor-pointer bg-slate-50"
                        />
                      </div>
                    </div>

                    <Input
                      label="Mô Tả Ngắn Về Quán"
                      type="text"
                      value={restaurantDescription}
                      onChange={(e) => setRestaurantDescription(e.target.value)}
                      placeholder="Món ăn đặc sắc, phong cách..."
                      icon={FileText}
                    />

                    <Input
                      label="Ảnh Đại Diện Quán (URL hình ảnh)"
                      type="text"
                      value={restaurantImageUrl}
                      onChange={(e) => setRestaurantImageUrl(e.target.value)}
                      placeholder="https://..."
                      icon={FileText}
                    />
                  </div>
                )}

                {/* SHIPPER FORM RE-SUBMIT */}
                {role === 'SHIPPER' && (
                  <div className="space-y-5">
                    <h4 className="text-[10px] font-extrabold text-[#34A853] uppercase tracking-widest pl-1">
                      Chỉnh sửa hồ sơ tài xế
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Input
                        label="Số CMTND / CCCD"
                        type="text"
                        required
                        value={idCard}
                        onChange={(e) => { setIdCard(e.target.value); clearError('idCard'); }}
                        placeholder="CCCD gồm 12 số..."
                        icon={FileText}
                        error={errors.idCard}
                      />

                      <Input
                        label="Biển Số Xe"
                        type="text"
                        required
                        value={licensePlate}
                        onChange={(e) => { setLicensePlate(e.target.value); clearError('licensePlate'); }}
                        placeholder="Ví dụ: 29A1-12345..."
                        icon={Bike}
                        error={errors.licensePlate}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pl-1">
                        Loại Phương Tiện
                      </label>
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-radius-lg p-3 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#FF6B35] focus:bg-white transition-all shadow-sm text-slate-700"
                      >
                        <option value="MOTORBIKE">Xe Máy (Motorbike)</option>
                        <option value="CAR">Ô Tô (Car)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-gradient-to-r ${btnGradient} text-white font-extrabold py-3.5 px-3.5 pl-6 rounded-full flex items-center justify-between shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group mt-6`}
                >
                  <span className="uppercase tracking-wider text-xs flex items-center gap-2">
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Đang gửi lại...
                      </>
                    ) : (
                      'Gửi lại hồ sơ đối tác'
                    )}
                  </span>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white group-hover:translate-x-1.5 transition-transform shrink-0">
                    <ChevronRight size={18} className="stroke-[2.5px]" />
                  </div>
                </button>

              </form>
            </div>
          )}

        </div>
      </div>

      <MapModal
        isOpen={openMap}
        onClose={() => setOpenMap(false)}
        onConfirm={handleConfirmLocation}
        initialLat={restaurantLat}
        initialLng={restaurantLng}
      />
    </div>
  );
}
