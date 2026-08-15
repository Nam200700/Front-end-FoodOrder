import { useState, useEffect, useRef } from 'react';
import { Store, Camera, Save, Map, Clock, MapPin, Phone, Eye, CheckCircle2, Circle, Image as ImageIcon, Lightbulb, FileText, Sparkles, ShieldCheck, AlertTriangle, AlertCircle } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import { useImageUpload } from '../../hooks/useImageUpload'; // Import hook upload ảnh
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { getRestaurantBannerUrl } from '../../utils/avatarHelper';
import { validatePhone } from '../../utils/validation';
import { toast } from 'react-toastify';
import { useModalState } from '../../hooks/useModalState';
import MapModal2 from '../../components/common/Map'; // Import MapModal2

// Dòng báo lỗi dưới ô nhập. Đặt NGOÀI component để React không tháo-lắp lại sau mỗi lần gõ.
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p className="flex items-start gap-1 text-[11px] font-semibold text-rose-600 mt-1.5 animate-rise-in">
      <AlertCircle size={12} className="shrink-0 mt-px" />
      {msg}
    </p>
  );
}

export default function MerchantSettings() {
  const [resName, setResName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [description, setDescription] = useState('');
  
  // TOẠ ĐỘ VĨ ĐỘ/KINH ĐỘ THẬT CỦA QUÁN ĂN
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef(null);

  // Sử dụng hook useImageUpload
  const { uploading: uploadingBanner, uploadImage } = useImageUpload();

  const [saving, setSaving] = useState(false);
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [restaurantId, setRestaurantId] = useState(null);
  // Lỗi theo từng ô. Toast trôi mất và không chỉ được ô nào sai — lỗi trùng SĐT quán
  // phải hiện ngay dưới đúng ô đó.
  const [errors, setErrors] = useState({});

  const clearError = (field) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  // Sử dụng useModalState cho MapModal2
  const mapModal2 = useModalState();

  const { data: restaurant, loading } = useFetchData('/merchant/restaurant');

  // Uy tín chủ quán (điểm bị trừ khi từ chối/hủy đơn sau xác nhận)
  const [account, setAccount] = useState(null);
  useEffect(() => {
    apiClient.get('/users/me').then(r => setAccount(r.data?.data || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (restaurant) {
      setResName(restaurant.restaurantName || '');
      setPhone(restaurant.phone || '');
      setAddress(restaurant.address || '');
      setDescription(restaurant.description || '');
      setRestaurantId(restaurant.restaurantId || restaurant.id);
      setLatitude(restaurant.latitude ? Number(restaurant.latitude) : 10.762622);
      setLongitude(restaurant.longitude ? Number(restaurant.longitude) : 106.660172);
      setImageUrl(restaurant.imageUrl || '');
      setOpenTime(restaurant.opensAt || '');
      setCloseTime(restaurant.closesAt || '');
      setHasRestaurant(true);
    }
  }, [restaurant]);

  const handleBannerClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newUrl = await uploadImage(file);
    if (newUrl) {
      setImageUrl(newUrl);
      toast.success("Tải ảnh banner thành công!");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

    // Xử lý xác nhận vị trí mới từ MapModal2
  const handleMapConfirmAndSave = (selectedLat, selectedLng, addressName) => {
    setLatitude(selectedLat);
    setLongitude(selectedLng);
    if (addressName) {
      setAddress(addressName);
      clearError('address');
    }
    mapModal2.close();
    toast.success("Đã cập nhật vị trí quán trên bản đồ!");
  };

  // Mở trực tiếp MapModal2  vào thay đổi địa chỉ
  const handleOpenMapModal = () => {
    mapModal2.open();
  };

  const handleSave = async () => {
    // Kiểm tra HẾT các ô rồi mới dừng: chủ quán thấy mọi chỗ sai trong một lần,
    // không phải sửa xong ô này mới lòi ra ô kia.
    const localErrors = {};
    if (!resName.trim()) localErrors.resName = 'Vui lòng nhập tên quán.';
    if (!openTime || !closeTime) localErrors.hours = 'Vui lòng chọn đầy đủ giờ mở cửa và đóng cửa.';

    if (!phone.trim()) localErrors.phone = 'Vui lòng nhập số điện thoại liên hệ.';
    else if (!validatePhone(phone)) localErrors.phone = 'Số điện thoại không hợp lệ (bắt đầu bằng 0, gồm 10 chữ số).';

    if (!address.trim()) localErrors.address = 'Vui lòng cập nhật địa chỉ chi tiết quán.';

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const requestData = {
        restaurantName: resName,
        address: address,
        latitude: latitude,
        longitude: longitude,
        phone: phone,
        description: description,
        imageUrl: imageUrl,
        opensAt: openTime,
        closesAt: closeTime
      };

      if (!hasRestaurant) {
        const response = await apiClient.post('/merchant/restaurants', requestData);
        const newRes = response.data?.data;
        toast.success('Đã đăng ký và tạo nhà hàng thành công với tọa độ trên hệ thống.');
        setRestaurantId(newRes.restaurantId || newRes.id);
        setHasRestaurant(true);
      } else {
        await apiClient.put(`/merchant/restaurants/${restaurantId}`, requestData);
        toast.success('Cập nhật thông tin quán thành công!');
      }
    } catch (err) {
      console.error(err);
      const resData = err.response?.data;
      // Guard bên BE trả errorCode RESTAURANT_PHONE_EXISTS kèm bản đồ lỗi đặt tên ô theo form
      // đăng ký ("restaurantPhone"); màn này ô tên là "phone" nên map theo errorCode.
      if (resData?.errorCode === 'RESTAURANT_PHONE_EXISTS') {
        setErrors((prev) => ({
          ...prev,
          phone: resData?.data?.restaurantPhone || 'Số điện thoại này đã được một quán khác sử dụng!',
        }));
        return;
      }
      toast.error(resData?.message || 'Có lỗi xảy ra khi thiết lập nhà hàng. Vui lòng kiểm tra lại!');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner fullScreen />;
  }

  // Checklist hoàn thiện hồ sơ (tính từ dữ liệu đang nhập — lấp khoảng trống cột trái + nhắc chủ quán điền đủ)
  const profileChecks = [
    { label: 'Tên quán / thương hiệu', done: !!resName.trim() },
    { label: 'Ảnh bìa quán', done: !!imageUrl },
    { label: 'Giờ mở & đóng cửa', done: !!(openTime && closeTime) },
    { label: 'Số điện thoại', done: !!phone.trim() },
    { label: 'Mô tả quán', done: !!description.trim() },
    { label: 'Địa chỉ trên bản đồ', done: !!address.trim() },
  ];
  const profileDone = profileChecks.filter(c => c.done).length;
  const profilePct = Math.round((profileDone / profileChecks.length) * 100);

  // Ô nhập đổi sang tông đỏ khi có lỗi — giữ nguyên bố cục, chỉ đổi màu viền/nền.
  const fieldClass = (bad) =>
    `w-full px-4 py-2.5 border rounded-radius-lg text-xs focus:outline-none transition-all font-semibold ${
      bad
        ? 'bg-rose-50/60 border-rose-300 text-rose-700 focus:border-rose-400'
        : 'bg-slate-50 border-slate-200 focus:border-md-secondary focus:bg-white'
    }`;

  const tips = [
    { icon: ImageIcon, text: 'Dùng ảnh bìa sắc nét, đủ sáng để thu hút khách ngay từ cái nhìn đầu tiên.' },
    { icon: Clock, text: 'Cập nhật giờ mở/đóng chính xác để quán hiện đúng lúc và không lỡ đơn.' },
    { icon: FileText, text: 'Mô tả ngắn gọn, nêu bật món đặc trưng để khách dễ nhớ quán của bạn.' },
  ];

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full font-google-sans space-y-6 pb-24">
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Store className="text-md-secondary" size={24} />
        {hasRestaurant ? 'Thông Tin Quán Ăn' : 'Đăng ký nhà hàng mới của bạn'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* ─── LIVE PREVIEW + phụ trợ (lấp khoảng trống cột trái) ─────────────── */}
        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-4">

          {/* Uy tín & tỷ lệ hủy của quán */}
          {(() => {
            const rep = account?.reputationScore ?? 100;
            const cancels = restaurant?.cancelCount ?? 0;
            const done = restaurant?.orderCount ?? 0;
            const denom = cancels + done;
            const cancelRate = denom > 0 ? Math.round((cancels / denom) * 1000) / 10 : 0;
            const good = rep >= 70, mid = rep >= 40 && rep < 70;
            const barColor = good ? 'bg-emerald-500' : mid ? 'bg-amber-500' : 'bg-rose-500';
            const txtColor = good ? 'text-emerald-600' : mid ? 'text-amber-600' : 'text-rose-600';
            return (
              <Card variant="elevated" className="p-4">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 mb-3">
                  <ShieldCheck size={14} className="text-md-secondary" /> Uy tín quán
                </span>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Điểm uy tín</span>
                  <span className={`text-sm font-black ${txtColor}`}>{rep}/100</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, rep))}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="p-2.5 rounded-radius-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold">Đơn tự hủy/từ chối</p>
                    <p className="text-sm font-black text-slate-700 mt-0.5">{cancels}</p>
                  </div>
                  <div className="p-2.5 rounded-radius-lg bg-slate-50 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold">Tỷ lệ hủy</p>
                    <p className={`text-sm font-black mt-0.5 ${cancelRate >= 10 ? 'text-rose-600' : 'text-slate-700'}`}>{cancelRate}%</p>
                  </div>
                </div>
                {rep < 70 && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-2.5 flex items-start gap-1">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Hạn chế hủy đơn sau khi đã xác nhận để giữ uy tín quán.
                  </p>
                )}
              </Card>
            );
          })()}

          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Eye size={13} /> Xem trước
          </span>

          <Card variant="elevated" className="overflow-hidden">
            <div className="relative h-28 bg-slate-100">
              <img src={getRestaurantBannerUrl(imageUrl)} alt="Banner xem trước" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <span className={`absolute top-2 right-2 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-sm ${
                hasRestaurant && restaurant?.status
                  ? 'bg-emerald-500 text-white'
                  : hasRestaurant
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-700/80 text-white'
              }`}>
                {hasRestaurant ? (restaurant?.status ? 'Đang mở cửa' : 'Đang đóng cửa') : 'Bản xem trước'}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-extrabold text-base text-slate-800 truncate">
                {resName || 'Tên quán của bạn'}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-2">
                <Clock size={13} className="text-md-secondary shrink-0" /> {openTime || '--:--'} – {closeTime || '--:--'}
              </div>
              <div className="flex items-start gap-1.5 text-xs text-slate-500 font-semibold mt-2">
                <MapPin size={13} className="text-md-secondary mt-0.5 shrink-0" />
                <span className="line-clamp-2">{address || 'Địa chỉ quán sẽ hiển thị ở đây...'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-2">
                <Phone size={13} className="text-md-secondary shrink-0" /> {phone || 'Số điện thoại liên hệ...'}
              </div>
            </div>
          </Card>

          {/* Hoàn thiện hồ sơ */}
          <Card variant="elevated" className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <Sparkles size={14} className="text-md-secondary" /> Hoàn thiện hồ sơ
              </span>
              <span className="text-xs font-extrabold text-md-secondary tabular-nums">{profilePct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3.5">
              <div className="h-full rounded-full bg-md-secondary transition-all duration-500" style={{ width: `${profilePct}%` }} />
            </div>
            <ul className="space-y-2">
              {profileChecks.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px] font-semibold">
                  {c.done
                    ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    : <Circle size={14} className="text-slate-300 shrink-0" />}
                  <span className={c.done ? 'text-slate-600' : 'text-slate-400'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Mẹo cho quán nổi bật */}
          <Card variant="elevated" className="p-4">
            <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 mb-3">
              <Lightbulb size={14} className="text-amber-500" /> Mẹo cho quán nổi bật
            </span>
            <ul className="space-y-3">
              {tips.map((t, i) => {
                const Icon = t.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="p-1.5 rounded-radius-md bg-md-secondary/10 text-md-secondary shrink-0">
                      <Icon size={13} />
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium leading-relaxed">{t.text}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* ─── FORM thông tin ─────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Nhãn cân với "Xem trước" bên trái để 2 cột thẳng hàng đầu */}
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} /> Chỉnh sửa thông tin
          </span>
          <Card variant="elevated" className="p-5 space-y-5 animate-slide-up">
          <div className="space-y-5">
            <div className="relative h-44 sm:h-52 rounded-radius-lg overflow-hidden border border-slate-100 bg-slate-100 flex items-center justify-center">
              <img 
                src={getRestaurantBannerUrl(imageUrl)} 
                alt="Store Cover" 
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-black/10" />
              <Button 
                type="button" 
                onClick={handleBannerClick}
                disabled={uploadingBanner}
                className="relative z-10 !px-4 !py-2 !bg-white/95 backdrop-blur-md !rounded-radius-full !text-xs !font-bold !text-slate-700 shadow-sm !gap-1.5 hover:!scale-105"
              >
                {uploadingBanner ? (
                  <span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Camera size={14} />
                )}
                Thay đổi
              </Button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Tên quán / thương hiệu *
              </label>
              <div className="relative">
                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={resName}
                  onChange={(e) => { setResName(e.target.value); clearError('resName'); }}
                  className={`${fieldClass(errors.resName)} !pl-10`}
                />
              </div>
              <FieldError msg={errors.resName} />
            </div>

            <div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Giờ mở cửa *
                  </label>
                  <input
                    type="time"
                    value={openTime}
                    onChange={(e) => { setOpenTime(e.target.value); clearError('hours'); }}
                    className={fieldClass(errors.hours && !openTime)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Giờ đóng cửa *
                  </label>
                  <input
                    type="time"
                    value={closeTime}
                    onChange={(e) => { setCloseTime(e.target.value); clearError('hours'); }}
                    className={fieldClass(errors.hours && !closeTime)}
                  />
                </div>
              </div>
              <FieldError msg={errors.hours} />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Số điện thoại *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); clearError('phone'); }}
                placeholder="Ví dụ: 0281000001"
                className={fieldClass(errors.phone)}
              />
              <FieldError msg={errors.phone} />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Mô tả *
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                <textarea
                  rows={3}
                  onChange={(e) => setDescription(e.target.value)}
                  value={description}
                  className="w-full flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all resize-none font-semibold cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Địa chỉ *
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                <textarea
                  rows={2}
                  readOnly
                  onClick={handleOpenMapModal}
                  value={address}
                  className={`${fieldClass(errors.address)} flex-1 resize-none cursor-pointer`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenMapModal}
                  className="!px-4 !bg-md-secondary/15 !text-md-secondary border border-md-secondary/10 hover:!bg-md-secondary/25 !rounded-radius-lg !text-xs !font-bold transition-all !gap-1.5 hover:!scale-[1.02] active:!scale-[0.98] shrink-0"
                  icon={Map}
                >
                  Thay đổi
                </Button>
              </div>
              <FieldError msg={errors.address} />
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              loading={saving}
              variant="secondary"
              className="w-full !py-3.5 !px-4 !rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:!translate-y-[-1.5px] active:!translate-y-[0px] transition-all !text-xs uppercase tracking-wider"
              icon={Save}
            >
              {hasRestaurant ? 'Cập nhật thông tin' : 'Đăng ký & Tạo nhà hàng'}
            </Button>
          </div>
          </Card>
        </div>
      </div>

      {/* ================= MAP MODAL2 ================= */}
      <MapModal2 
        key={`${latitude}-${longitude}`} 
        isOpen={mapModal2.isOpen} 
        onClose={mapModal2.close} 
        onConfirm={handleMapConfirmAndSave} 
        isEditMode={Boolean(restaurantId)}
        initialLat={latitude || 10.762622} 
        initialLng={longitude || 106.660172} 
        showLabelSelector={false} 
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleBannerChange} 
      />
    </div>
  );
}