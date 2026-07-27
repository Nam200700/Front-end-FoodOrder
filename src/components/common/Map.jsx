import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Navigation, Check, Search, Home, Briefcase, Bookmark } from 'lucide-react';
import Button from './Button';
import axios from 'axios';

// Giải quyết lỗi thiếu icon Marker của Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MapModal2({ 
  isOpen, 
  onClose, 
  onConfirm, 
  initialLat = 10.762622, 
  initialLng = 106.660172,
  isEditMode = false,
  addressLabel = 'Nhà riêng',
  setAddressLabel,
  showLabelSelector = true 
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  
  const [selectedCoords, setSelectedCoords] = useState({ lat: initialLat, lng: initialLng });
  const [addressName, setAddressName] = useState('Đang lấy địa chỉ...');
  const [searchText, setSearchText] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);

  const presetLabels = ['Nhà riêng', 'Văn phòng', 'Chung cư', 'Khác'];

  // Theo dõi khi modal mở ra
  useEffect(() => {
    if (!isOpen) return;

    if (!isEditMode && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setSelectedCoords({ lat: latitude, lng: longitude });
          if (mapRef.current && markerRef.current) {
            mapRef.current.setView([latitude, longitude], 16);
            markerRef.current.setLatLng([latitude, longitude]);
          }
          fetchAddress(latitude, longitude);
          setLocating(false);
        },
        (error) => {
          console.warn('Không lấy được GPS tự động:', error);
          setSelectedCoords({ lat: initialLat, lng: initialLng });
          fetchAddress(initialLat, initialLng);
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setSelectedCoords({ lat: initialLat, lng: initialLng });
      if (mapRef.current && markerRef.current) {
        mapRef.current.setView([initialLat, initialLng], 15);
        markerRef.current.setLatLng([initialLat, initialLng]);
      }
      fetchAddress(initialLat, initialLng);
    }
  }, [isOpen]);

  const fetchAddress = async (lat, lng) => {
    setLoadingAddress(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`
      );
      if (response.data && response.data.display_name) {
        setAddressName(response.data.display_name);
        setSearchText(response.data.display_name);
      } else {
        const fallback = `Toạ độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddressName(fallback);
        setSearchText(fallback);
      }
    } catch (error) {
      console.error('Lỗi gọi Nominatim API:', error);
      const fallback = `Toạ độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddressName(fallback);
      setSearchText(fallback);
    } finally {
      setLoadingAddress(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      if (mapRef.current) return;

      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 15);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      if (isEditMode) {
        fetchAddress(initialLat, initialLng);
      }

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSelectedCoords({ lat, lng });
        fetchAddress(lat, lng);
      });

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setSelectedCoords({ lat, lng });
        fetchAddress(lat, lng);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleSearchAddress = async (e) => {
    e.preventDefault();
    if (!searchText.trim()) return;

    setSearching(true);
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: { format: 'json', q: searchText, limit: 1, 'accept-language': 'vi' },
        headers: { 'User-Agent': 'FoodDeliveryApp/1.0' }
      });

      if (response.data && response.data.length > 0) {
        const lat = parseFloat(response.data[0].lat);
        const lng = parseFloat(response.data[0].lon);
        const displayName = response.data[0].display_name;

        setSelectedCoords({ lat, lng });
        setAddressName(displayName);
        setSearchText(displayName);

        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
        }
      } else {
        alert('Không tìm thấy địa chỉ này. Vui lòng thử lại!');
      }
    } catch (error) {
      console.error('Lỗi tìm kiếm địa chỉ:', error);
      alert('Đã xảy ra lỗi khi tìm kiếm địa chỉ.');
    } finally {
      setSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSelectedCoords({ lat: latitude, lng: longitude });
        fetchAddress(latitude, longitude);

        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
          markerRef.current.setLatLng([latitude, longitude]);
        }
        setLocating(false);
      },
      (error) => {
        console.warn('Lỗi Geolocation:', error);
        alert('Không thể truy cập vị trí hiện tại!');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirmLocation = () => {
    if (loadingAddress || searching) return;
    onConfirm(selectedCoords.lat, selectedCoords.lng, addressName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-google-sans animate-fade-in">
      <div className="bg-white rounded-radius-xl w-full max-w-2xl h-[90vh] md:h-[88vh] flex flex-col overflow-hidden shadow-shadow-4 relative animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-md-primary">
            <MapPin size={22} className="stroke-[2.5px]" />
            <h3 className="font-extrabold text-base md:text-lg text-slate-800">
              {isEditMode ? 'Cập Nhật Vị Trí Địa Chỉ' : 'Thêm Địa Chỉ Mới Trên Bản Đồ'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thanh tìm kiếm và Tùy chọn Nhãn */}
        <div className="p-4 bg-slate-50 border-b border-slate-150 space-y-3">
          <form onSubmit={handleSearchAddress} className="flex gap-2">
            <div className="relative flex-1">
              {/* Đảm bảo icon Search nằm chuẩn giữa ô input */}
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Nhập địa chỉ (ví dụ: Số 1 Nguyễn Huệ, Quận 1)..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 focus:border-md-primary rounded-lg text-xs font-semibold bg-white outline-none transition-all"
              />
            </div>
            {/* Nút Tìm kiếm màu cam, thu nhỏ gọn hơn (size sm hoặc chỉnh padding) */}
            <Button 
              type="submit" 
              variant="secondary" 
              size="sm" 
              disabled={searching} 
              className="bg-md-primary hover:bg-opacity-95 text-white px-4 py-2 text-xs font-bold shrink-0"
            >
              {searching ? 'Đang tìm...' : 'Tìm kiếm'}
            </Button>
          </form>

          {showLabelSelector && (
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Loại địa chỉ:
              </span>
              {presetLabels.map((lbl) => {
                const isSelected = addressLabel === lbl;
                return (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setAddressLabel(lbl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                      isSelected 
                        ? 'bg-md-primary text-white border-md-primary shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {lbl === 'Nhà riêng' && <Home size={13} />}
                    {lbl === 'Văn phòng' && <Briefcase size={13} />}
                    {lbl !== 'Nhà riêng' && lbl !== 'Văn phòng' && <Bookmark size={13} />}
                    {lbl}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bản đồ Leaflet Container */}
        <div className="flex-1 relative bg-slate-50">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Nút định vị GPS */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="absolute bottom-5 right-5 z-20 p-3 bg-white hover:bg-slate-50 text-md-primary rounded-full shadow-shadow-3 hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-slate-150 cursor-pointer"
            title="Định vị vị trí hiện tại"
          >
            <Navigation size={18} className={`fill-current ${locating ? 'animate-pulse' : ''}`} />
          </button>
        </div>

        {/* Footer hiển thị địa chỉ đã chọn */}
        <div className="p-4 md:p-5 bg-slate-50 border-t border-slate-150/60 flex flex-col justify-between gap-3 shrink-0">
          <div className="bg-white p-3.5 rounded-radius-lg border border-slate-200 shadow-sm flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block flex items-center gap-1">
                📍 Địa chỉ đã chọn {showLabelSelector && `(${addressLabel})`}
              </span>
              <p className="text-xs md:text-sm text-slate-800 font-extrabold mt-1.5 leading-relaxed min-h-[36px] flex items-center">
                {loadingAddress || locating ? (
                  <span className="text-slate-400 font-bold flex items-center gap-2 animate-pulse">
                    <span className="w-4 h-4 border-2 border-md-primary border-t-transparent rounded-full animate-spin"></span>
                    {locating ? 'Đang lấy vị trí của bạn...' : 'Đang phân tích tọa độ...'}
                  </span>
                ) : (
                  addressName
                )}
              </p>
            </div>
          </div>

          {/* Các nút bấm ở footer được thu nhỏ lại */}
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="outline" onClick={onClose} size="sm" className="px-4 py-2 text-xs font-bold">
              Hủy
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleConfirmLocation}
              disabled={loadingAddress || searching || locating}
              icon={Check}
              size="sm"
              className="bg-md-primary hover:bg-opacity-95 text-white px-4 py-2 text-xs font-bold"
            >
              Xác nhận vị trí
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}