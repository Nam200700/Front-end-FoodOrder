import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Navigation, Check } from 'lucide-react';
import Button from './Button';
import axios from 'axios';

// Giải quyết lỗi thiếu icon Marker của Leaflet trong môi trường Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MapModal({ isOpen, onClose, onConfirm, initialLat = 10.762622, initialLng = 106.660172 }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  
  const [selectedCoords, setSelectedCoords] = useState({ lat: initialLat, lng: initialLng });
  const [addressName, setAddressName] = useState('Đang lấy địa chỉ...');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locating, setLocating] = useState(false);

  // Hàm dịch ngược toạ độ ra địa chỉ chữ (Reverse Geocoding) - Miễn phí 100% từ OpenStreetMap Nominatim
  const fetchAddress = async (lat, lng) => {
    setLoadingAddress(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`
      );
      if (response.data && response.data.display_name) {
        // Rút gọn địa chỉ Nominatim thường hơi dài
        setAddressName(response.data.display_name);
      } else {
        setAddressName(`Toạ độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (error) {
      console.error('Lỗi gọi Nominatim API:', error);
      setAddressName(`Toạ độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoadingAddress(false);
    }
  };

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!isOpen) return;

    // Đợi DOM render xong để tránh lỗi Leaflet map container not found
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Tạo bản đồ mới
      const map = L.map(mapContainerRef.current).setView([selectedCoords.lat, selectedCoords.lng], 15);
      mapRef.current = map;

      // Nạp Layer bản đồ OpenStreetMap miễn phí 100%
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Tạo Marker ban đầu
      const marker = L.marker([selectedCoords.lat, selectedCoords.lng], {
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      // Lấy địa chỉ của toạ độ ban đầu
      fetchAddress(selectedCoords.lat, selectedCoords.lng);

      // Lắng nghe sự kiện click trên bản đồ để di chuyển Marker
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSelectedCoords({ lat, lng });
        fetchAddress(lat, lng);
      });

      // Lắng nghe sự kiện kéo (drag) Marker
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

  // Định vị vị trí hiện tại của người dùng bằng GPS trình duyệt (Geolocation API)
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
        alert('Không thể truy cập vị trí hiện tại. Vui lòng cho phép quyền truy cập GPS!');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirmLocation = () => {
    if (loadingAddress) return;
    onConfirm(selectedCoords.lat, selectedCoords.lng, addressName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-google-sans animate-fade-in">
      <div className="bg-white rounded-radius-xl w-full max-w-2xl h-[90vh] md:h-[80vh] flex flex-col overflow-hidden shadow-shadow-4 relative animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
          <div className="flex items-center gap-2 text-md-primary">
            <MapPin size={22} className="stroke-[2.5px]" />
            <h3 className="font-extrabold text-base md:text-lg text-slate-800">
              Chọn vị trí giao hàng
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bản đồ Map Leaflet Container */}
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
        <div className="p-5 md:p-6 bg-slate-50 border-t border-slate-150/60 flex flex-col justify-between gap-4 shrink-0">
          <div className="bg-white p-4.5 rounded-radius-lg border border-slate-200 shadow-sm">
            <span className="text-[10px] text-md-outline font-extrabold uppercase tracking-wider block">
              📍 Địa chỉ giao hàng được chọn
            </span>
            <p className="text-xs md:text-sm text-slate-800 font-extrabold mt-2 leading-relaxed min-h-[40px] flex items-center">
              {loadingAddress ? (
                <span className="text-slate-400 font-bold flex items-center gap-2 animate-pulse">
                  <span className="w-4 h-4 border-2 border-md-primary border-t-transparent rounded-full animate-spin"></span>
                  Đang phân tích địa chỉ địa lý...
                </span>
              ) : (
                addressName
              )}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} size="md">
              Hủy
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleConfirmLocation}
              disabled={loadingAddress}
              icon={Check}
              size="md"
              className="bg-md-primary hover:bg-opacity-95 text-white"
            >
              Xác nhận vị trí
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
