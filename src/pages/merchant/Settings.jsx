import { useState, useEffect, useRef } from 'react';
import { Store, Camera, Save, Map, Clock, MapPin, Phone, Eye, AlertTriangle } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import MapModal from '../../components/common/MapModal';
import { getRestaurantBannerUrl } from '../../utils/avatarHelper';
import { validatePhone } from '../../utils/validation';
import { toast } from 'react-toastify';

export default function MerchantSettings() {
  const [resName, setResName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('22:00');
  
  // TOẠ ĐỘ VĨ ĐỘ/KINH ĐỘ THẬT CỦA QUÁN ĂN
  const [latitude, setLatitude] = useState(10.762622);
  const [longitude, setLongitude] = useState(106.660172);

  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [saving, setSaving] = useState(false);
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [restaurantId, setRestaurantId] = useState(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [phoneError, setPhoneError] = useState(''); // lỗi định dạng SĐT liên hệ quán

  const { data: restaurant, loading } = useFetchData('/merchant/restaurant');

  useEffect(() => {
    if (restaurant) {
      setResName(restaurant.restaurantName || '');
      setPhone(restaurant.phone || '');
      setAddress(restaurant.address || '');
      setRestaurantId(restaurant.restaurantId || restaurant.id);
      setLatitude(restaurant.latitude ? Number(restaurant.latitude) : 10.762622);
      setLongitude(restaurant.longitude ? Number(restaurant.longitude) : 106.660172);
      setImageUrl(restaurant.imageUrl || '');
      setHasRestaurant(true);

      // Extract times from description if present
      if (restaurant.description) {
        const timePattern = /Giờ mở cửa:\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/;
        const match = restaurant.description.match(timePattern);
        if (match) {
          setOpenTime(match[1]);
          setCloseTime(match[2]);
        }
      }
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

    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Kích thước file tối đa là 5MB!");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(file.type.toLowerCase()) && ext !== 'heic' && ext !== 'heif') {
      toast.warning("Chỉ chấp nhận các định dạng hình ảnh JPEG, PNG, WEBP, HEIC, HEIF!");
      return;
    }

    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await apiClient.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newUrl = uploadRes.data?.data?.url;
      if (!newUrl) throw new Error("Không nhận được URL ảnh!");
      setImageUrl(newUrl);
    } catch (uploadErr) {
      console.error("Upload ảnh thất bại:", uploadErr);
      toast.error(uploadErr.response?.data?.message || "Lỗi khi upload ảnh lên Cloudinary!");
    } finally {
      setUploadingBanner(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmLocation = (selectedLat, selectedLng, addressName) => {
    setLatitude(selectedLat);
    setLongitude(selectedLng);
    setAddress(addressName);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!resName.trim() || !address.trim() || !phone.trim()) {
      toast.warning('Vui lòng nhập đầy đủ thông tin bắt buộc!');
      return;
    }
    // Chặn SĐT sai định dạng (bắt đầu bằng 0, gồm 10 chữ số) — không lưu số rác lên hệ thống.
    if (!validatePhone(phone)) {
      setPhoneError('Số điện thoại không hợp lệ (bắt đầu bằng số 0 và gồm 10 chữ số).');
      toast.warning('Số điện thoại liên hệ không hợp lệ. Vui lòng kiểm tra lại!');
      return;
    }
    setPhoneError('');

    setSaving(true);
    try {
      if (!hasRestaurant) {
        // TẠO NHÀ HÀNG MỚI VỚI TOẠ ĐỘ THẬT
        const createReq = {
          restaurantName: resName,
          address: address,
          latitude: latitude,
          longitude: longitude,
          phone: phone,
          description: `Quán ăn chuyên phục vụ các món ăn ngon. Giờ mở cửa: ${openTime} - ${closeTime}`,
          imageUrl: imageUrl
        };
        const response = await apiClient.post('/merchant/restaurants', createReq);
        const newRes = response.data?.data;
        toast.success('Chúc mừng! Đã đăng ký và tạo nhà hàng thành công với toạ độ thật trên hệ thống database.');
        setRestaurantId(newRes.restaurantId || newRes.id);
        setHasRestaurant(true);
      } else {
        // CẬP NHẬT CẤU HÌNH THẬT SỰ QUA API PUT
        const updateReq = {
          restaurantName: resName,
          address: address,
          latitude: latitude,
          longitude: longitude,
          phone: phone,
          description: `Quán ăn chuyên phục vụ các món ăn ngon. Giờ mở cửa: ${openTime} - ${closeTime}`,
          imageUrl: imageUrl
        };
        await apiClient.put(`/merchant/restaurants/${restaurantId}`, updateReq);
        toast.success('Cập nhật cấu hình và toạ độ địa lý thật của nhà hàng thành công!');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi thiết lập nhà hàng. Vui lòng kiểm tra lại!');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner fullScreen />;
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full font-google-sans space-y-6 pb-24">
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Store className="text-md-secondary" size={24} />
        {hasRestaurant ? 'Thông tin quán ăn của bạn' : 'Đăng ký nhà hàng mới của bạn'}
      </h1>

      {/* Bố cục 2 cột: LIVE PREVIEW bảng hiệu (trái) + form chỉnh sửa (phải).
          Preview render TRỰC TIẾP từ state form (resName/imageUrl/openTime/closeTime/
          address/phone) nên gõ tới đâu cập nhật tới đó — chỉ trình bày, không thêm fetch. */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

      {/* ─── LIVE PREVIEW: thẻ quán như khách nhìn thấy ─────────────────────────── */}
      <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-2.5">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Eye size={13} /> Xem trước (như khách thấy)
        </span>
        <div className="bg-white rounded-radius-xl border border-slate-200/60 shadow-sm overflow-hidden">
          {/* Banner + trạng thái mở/đóng */}
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
              <Clock size={13} className="text-md-secondary shrink-0" /> {openTime} – {closeTime}
            </div>
            <div className="flex items-start gap-1.5 text-xs text-slate-500 font-semibold mt-2">
              <MapPin size={13} className="text-md-secondary mt-0.5 shrink-0" />
              <span className="line-clamp-2">{address || 'Địa chỉ quán sẽ hiển thị ở đây...'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-2">
              <Phone size={13} className="text-md-secondary shrink-0" /> {phone || 'Số điện thoại liên hệ...'}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 font-medium px-1">
          Thẻ này cập nhật trực tiếp khi bạn chỉnh form bên phải.
        </p>
      </div>

      <form onSubmit={handleSave} className="lg:col-span-3 bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm space-y-5 animate-slide-up">
        
        {/* Banner upload section */}
        <div className="relative h-32 rounded-radius-lg overflow-hidden border border-slate-100 bg-slate-100 flex items-center justify-center">
          <img 
            src={getRestaurantBannerUrl(imageUrl)} 
            alt="Store Cover" 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-black/10" />
          <button 
            type="button" 
            onClick={handleBannerClick}
            disabled={uploadingBanner}
            className="relative z-10 px-4 py-2 bg-white/95 backdrop-blur-md rounded-radius-full text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5 hover:scale-105 transition-all cursor-pointer"
          >
            {uploadingBanner ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Camera size={14} />
            )}
            Ảnh banner nhà hàng
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Tên cửa hàng / thương hiệu *
          </label>
          <div className="relative">
            <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              required
              placeholder="Nhập tên nhà hàng của bạn..."
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Giờ mở cửa
            </label>
            <input
              type="time"
              required
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all font-semibold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Giờ đóng cửa
            </label>
            <input
              type="time"
              required
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Số điện thoại liên hệ *
          </label>
          <input
            type="tel"
            required
            placeholder="090xxxxxxx"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError(''); }}
            onBlur={() => setPhoneError(validatePhone(phone) ? '' : 'Số điện thoại không hợp lệ (bắt đầu bằng số 0 và gồm 10 chữ số).')}
            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-radius-lg text-xs focus:outline-none focus:bg-white transition-all font-semibold ${
              phoneError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-md-secondary'
            }`}
          />
          {phoneError && (
            <span className="text-[11px] text-red-500 font-bold mt-1.5 ml-1 flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{phoneError}</span>
            </span>
          )}
        </div>

        {/* Địa chỉ chi tiết quán có nút chọn bản đồ */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Địa chỉ chi tiết quán *
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
            <textarea
              rows={2}
              required
              placeholder="Nhập địa chỉ nhà hàng..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all resize-none font-semibold"
            />
            <button
              type="button"
              onClick={() => setIsMapOpen(true)}
              className="px-4 bg-md-secondary/15 text-md-secondary border border-md-secondary/10 hover:bg-md-secondary/20 rounded-radius-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Map size={14} />
              Bản đồ
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-md-secondary text-white font-bold py-3.5 px-4 rounded-radius-full shadow-shadow-2 hover:shadow-shadow-3 hover:translate-y-[-1.5px] active:translate-y-[0px] transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
        >
          {saving ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              {hasRestaurant ? 'Cập nhật cấu hình' : 'Đăng ký & Tạo nhà hàng'}
              <Save size={14} />
            </>
          )}
        </button>

      </form>

      </div>
      {/* đóng grid 2 cột preview + form */}

      {/* MapModal chọn địa chỉ Quán ăn */}
      <MapModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleConfirmLocation}
        initialLat={latitude}
        initialLng={longitude}
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
