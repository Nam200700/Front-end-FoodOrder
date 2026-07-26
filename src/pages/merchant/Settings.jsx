import { useState, useEffect, useRef } from 'react';
import { Store, Camera, Save, Map, Clock, MapPin, Phone, Eye, AlertTriangle } from 'lucide-react';
import { useFetchData } from '../../hooks/useFetchData';
import apiClient from '../../services/api';
import Spinner from '../../components/common/Spinner';
import MapModal from '../../components/common/MapModal';
import Modal from '../../components/common/Modal'; // Đảm bảo bạn đã import component Modal tương ứng
import Button from '../../components/common/Button'; // Đảm bảo bạn đã import component Button tương ứng
import { getRestaurantBannerUrl } from '../../utils/avatarHelper';
import { validatePhone } from '../../utils/validation';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useModalState } from '../../hooks/useModalState';

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
  const [phoneError, setPhoneError] = useState('');

  // States quản lý Modal Cập nhật địa chỉ & MapModal theo đúng luồng
  const [isUpdateAddressModalOpen, setIsUpdateAddressModalOpen] = useState(false);
  const [newAddressText, setNewAddressText] = useState('');
  const [addressLabel, setAddressLabel] = useState('Nhà riêng');
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

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

  // Bước 1: Nhập địa chỉ ở modal cập nhật -> Lấy kinh độ và vĩ độ -> Mở MapModal lên để xác nhận
  const handleProceedToMap = async (e) => {
    e.preventDefault();
    if (!newAddressText.trim()) {
      toast.warning('Vui lòng nhập địa chỉ cụ thể!');
      return;
    }

    setIsUpdatingLocation(true);
    try {
      let cleanQuery = newAddressText
        .replace(/trường\s+thcs\s+/gi, '')
        .replace(/trường\s+tiểu học\s+/gi, '')
        .replace(/xã\s+/gi, '')
        .replace(/\d+\/\d+\s+ấp\s+\d+/gi, '')
        .replace(/ấp\s+\d+/gi, '')
        .replace(/^\d+[\/\-]?\d*\s*,?/g, '')
        .trim();

      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: { format: 'json', q: cleanQuery, limit: 1, 'accept-language': 'vi' }
      });

      if (response.data && response.data.length > 0) {
        const lat = parseFloat(response.data[0].lat);
        const lon = parseFloat(response.data[0].lon);
        setLatitude(lat);
        setLongitude(lon);
      } else {
        toast.info("Không tìm thấy tọa độ chính xác tự động, vui lòng chọn vị trí trên bản đồ.");
      }

      // Đóng modal nhập địa chỉ, mở MapModal để xác nhận lại tọa độ
      setIsUpdateAddressModalOpen(false);
      setMapModalOpen(true);
    } catch (err) {
      console.error("Lỗi lấy tọa độ:", err);
      toast.error("Không thể lấy tọa độ từ địa chỉ đã nhập. Vui lòng chọn trực tiếp trên bản đồ.");
      setIsUpdateAddressModalOpen(false);
      setMapModalOpen(true);
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Bước 2: Xác nhận từ MapModal sau khi đã kiểm tra vị trí
  const handleMapConfirmAndSave = (selectedLat, selectedLng, addressName) => {
    setLatitude(selectedLat);
    setLongitude(selectedLng);
    setAddress(addressName || newAddressText);
    setMapModalOpen(false);
    toast.success("Đã cập nhật tọa độ và địa chỉ thành công!");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!resName.trim() || !address.trim() || !phone.trim()) {
      toast.warning('Vui lòng nhập đầy đủ thông tin bắt buộc!');
      return;
    }
    if (!validatePhone(phone)) {
      setPhoneError('Số điện thoại không hợp lệ (bắt đầu bằng số 0 và gồm 10 chữ số).');
      toast.warning('Số điện thoại liên hệ không hợp lệ. Vui lòng kiểm tra lại!');
      return;
    }
    setPhoneError('');

    setSaving(true);
    try {
      const requestData = {
        restaurantName: resName,
        address: address,
        latitude: latitude,
        longitude: longitude,
        phone: phone,
        description: `Quán ăn chuyên phục vụ các món ăn ngon. Giờ mở cửa: ${openTime} - ${closeTime}`,
        imageUrl: imageUrl
      };

      if (!hasRestaurant) {
        const response = await apiClient.post('/merchant/restaurants', requestData);
        const newRes = response.data?.data;
        toast.success('Chúc mừng! Đã đăng ký và tạo nhà hàng thành công với tọa độ trên hệ thống.');
        setRestaurantId(newRes.restaurantId || newRes.id);
        setHasRestaurant(true);
      } else {
        await apiClient.put(`/merchant/restaurants/${restaurantId}`, requestData);
        toast.success('Cập nhật cấu hình và tọa độ địa lý của nhà hàng thành công xuống DB!');
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
        {hasRestaurant ? 'Thông tin quán ăn' : 'Đăng ký nhà hàng mới của bạn'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* ─── LIVE PREVIEW ─────────────────────────── */}
        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-2.5">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Eye size={13} /> Xem trước (như khách thấy)
          </span>
          <div className="bg-white rounded-radius-xl border border-slate-200/60 shadow-sm overflow-hidden">
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
        </div>

        {/* ─── FORM CẤU HÌNH CHÍNH ─────────────────────────── */}
        <form onSubmit={handleSave} className="lg:col-span-3 bg-white rounded-radius-xl p-5 border border-slate-200/60 shadow-sm space-y-5 animate-slide-up">
          
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

          {/* Phần Địa chỉ: Click vào mở Modal cập nhật địa chỉ */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Địa chỉ chi tiết quán *
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
              <textarea
                rows={2}
                required
                readOnly
                onClick={() => {
                  setNewAddressText(address);
                  setIsUpdateAddressModalOpen(true);
                }}
                placeholder="Click vào đây để cập nhật địa chỉ quán..."
                value={address}
                className="w-full flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all resize-none font-semibold cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  setNewAddressText(address);
                  setIsUpdateAddressModalOpen(true);
                }}
                className="px-4 bg-md-secondary/15 text-md-secondary border border-md-secondary/10 hover:bg-md-secondary/20 rounded-radius-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
              >
                <Map size={14} />
                Cập nhật địa chỉ
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
                {hasRestaurant ? 'Cập nhật thông tin' : 'Đăng ký & Tạo nhà hàng'}
                <Save size={14} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* ================= MODAL CẬP NHẬT ĐỊA CHỈ ================= */}
      <Modal 
        isOpen={isUpdateAddressModalOpen} 
        onClose={() => setIsUpdateAddressModalOpen(false)}
        title="Cập Nhật Địa Chỉ"
        size="md"
        className="!rounded-2xl"
      >
        <div className="space-y-4 -mx-6 -my-6 px-6 py-4">
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Địa chỉ cụ thể <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <MapPin size={15} />
              </span>
              <input 
                type="text"
                value={newAddressText}
                onChange={(e) => setNewAddressText(e.target.value)}
                placeholder="Ví dụ: Đường Tô Ký, Phường Trung Mỹ Tây, TP.HCM..."
                className="w-full pl-9 pr-3 py-3 text-xs border border-slate-200 rounded-2xl bg-white text-slate-800 font-semibold focus:outline-none focus:border-[#ff6b35]"
              />
            </div>
          </div>

          <div className="pt-4 -mx-6 px-6 border-t border-slate-100 flex items-center justify-end gap-3 mt-6 bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUpdateAddressModalOpen(false)}
              className="!rounded-2xl !text-xs !font-bold !py-2.5 !px-5 cursor-pointer border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleProceedToMap}
              disabled={isUpdatingLocation}
              loading={isUpdatingLocation}
              className="!rounded-2xl !text-xs !font-bold !py-2.5 !px-6 !bg-[#ff6b35] text-white hover:!bg-orange-600 cursor-pointer shadow-md shadow-orange-500/20"
            >
              Xác nhận
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MAP MODAL XÁC NHẬN LẠI VỊ TRÍ ================= */}
      {mapModalOpen && (
        <MapModal 
          key={`${latitude}_${longitude}_${mapModalOpen}`}
          isOpen={mapModalOpen} 
          onClose={() => {
            setMapModalOpen(false);
            setIsUpdateAddressModalOpen(true); 
          }} 
          onConfirm={handleMapConfirmAndSave} 
          initialLat={latitude || 10.7769} 
          initialLng={longitude || 106.7009} 
        />
      )}

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