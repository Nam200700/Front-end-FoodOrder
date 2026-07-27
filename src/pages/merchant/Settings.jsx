import { useState, useEffect, useRef } from 'react';
import { Store, Camera, Save, Map, Clock, MapPin, Phone, Eye } from 'lucide-react';
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

  // Sử dụng useModalState cho MapModal2
  const mapModal2 = useModalState();

  const { data: restaurant, loading } = useFetchData('/merchant/restaurant');

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
    }
    mapModal2.close();
    toast.success("Đã cập nhật vị trí quán trên bản đồ!");
  };

  // Mở trực tiếp MapModal2  vào thay đổi địa chỉ
  const handleOpenMapModal = () => {
    mapModal2.open();
  };

  const handleSave = async () => {
    if (!resName.trim()) {
      toast.warning('Vui lòng nhập tên quán!');
      return;
    }
    if (!openTime || !closeTime) {
      toast.warning('Vui lòng chọn đầy đủ giờ mở cửa và đóng cửa!');
      return;
    }
    if (!phone.trim()) {
      toast.warning('Vui lòng nhập số điện thoại liên hệ!');
      return;
    }
    if (!validatePhone(phone)) {
      toast.warning('Số điện thoại không hợp lệ!');
      return;
    }
    if (!address.trim()) {
      toast.warning('Vui lòng cập nhật địa chỉ chi tiết quán!');
      return;
    }

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
        {hasRestaurant ? 'Thông Tin Quán Ăn' : 'Đăng ký nhà hàng mới của bạn'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* ─── LIVE PREVIEW ─────────────────────────── */}
        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-2.5">
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
        </div>

        {/* ─── FORM thông tin ─────────────────────────── */}
        <Card variant="elevated" className="lg:col-span-3 p-5 space-y-5 animate-slide-up">
          <div className="space-y-5">
            <div className="relative h-70 rounded-radius-lg overflow-hidden border border-slate-100 bg-slate-100 flex items-center justify-center">
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
                  onChange={(e) => setResName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Giờ mở cửa *
                </label>
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Giờ đóng cửa *
                </label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Số điện thoại *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all font-semibold"
              />
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
                  className="w-full flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-radius-lg text-xs focus:outline-none focus:border-md-secondary focus:bg-white transition-all resize-none font-semibold cursor-pointer"
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