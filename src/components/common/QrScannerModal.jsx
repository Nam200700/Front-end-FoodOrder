import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, AlertTriangle, Loader2, ScanLine } from 'lucide-react';
import jsQR from 'jsqr';

/**
 * Quét mã QR bằng CAMERA TRONG TRÌNH DUYỆT.
 *
 * Yêu cầu ngữ cảnh bảo mật (HTTPS) — trên HTTP thì navigator.mediaDevices không tồn tại.
 * Hai đường giải mã:
 *   1. BarcodeDetector (API gốc): có trên Chrome/Android, nhanh và nhẹ nhất.
 *   2. jsQR (fallback): iOS Safari KHÔNG hỗ trợ BarcodeDetector nên phải tự vẽ frame ra
 *      canvas rồi giải mã bằng jsQR — bù lại chạy được mọi trình duyệt.
 *
 * Trả kết quả qua onResult(text) với `text` là nội dung QR đã đọc (một chuỗi thô).
 * Bên gọi tự quyết định làm gì với chuỗi đó (ví dụ tách sid rồi điều hướng).
 */
export default function QrScannerModal({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const doneRef = useRef(false); // chặn gọi onResult nhiều lần khi frame tới dồn dập

  const [status, setStatus] = useState('starting'); // starting | scanning | denied | error
  const [errorMsg, setErrorMsg] = useState('');

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop()); // tắt đèn camera, nhả quyền
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const handleHit = (text) => {
      if (doneRef.current || !text) return;
      doneRef.current = true;
      stopCamera();
      onResult(text);
    };

    // Vòng lặp đọc frame: ưu tiên BarcodeDetector, không có thì dùng jsQR trên canvas.
    const scanLoop = async () => {
      const video = videoRef.current;
      if (!video || doneRef.current) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          if (detectorRef.current) {
            const codes = await detectorRef.current.detect(video);
            if (codes && codes.length > 0) { handleHit(codes[0].rawValue); return; }
          } else {
            const canvas = canvasRef.current;
            const w = video.videoWidth, h = video.videoHeight;
            if (w && h) {
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const result = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
              if (result?.data) { handleHit(result.data); return; }
            }
          }
        } catch {
          // Một frame lỗi không đáng dừng cả vòng — thử frame kế tiếp.
        }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrorMsg('Trình duyệt không hỗ trợ camera, hoặc trang không chạy trên HTTPS.');
        return;
      }
      // Khởi tạo BarcodeDetector nếu có và thực sự nhận diện được định dạng qr_code.
      try {
        if ('BarcodeDetector' in window) {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes('qr_code')) {
            detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          }
        }
      } catch {
        detectorRef.current = null; // hỏng thì rơi về jsQR
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, // ưu tiên camera sau
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true'); // iOS: không tự bật fullscreen
        await video.play();
        setStatus('scanning');
        rafRef.current = requestAnimationFrame(scanLoop);
      } catch (err) {
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setStatus('denied');
        } else {
          setStatus('error');
          setErrorMsg('Không mở được camera. Vui lòng kiểm tra thiết bị và thử lại.');
        }
      }
    }

    start();
    return () => { cancelled = true; stopCamera(); };
  }, [onResult, stopCamera]);

  const close = () => { stopCamera(); onClose(); };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={close}>
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <Camera size={16} className="text-[#FF6B35]" /> Quét mã QR đăng nhập
          </span>
          <button onClick={close} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="relative aspect-square bg-slate-900">
          {/* video luôn có trong DOM để ref gắn được; các lớp phủ nằm trên */}
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {status === 'scanning' && (
            <>
              {/* Khung ngắm + vạch quét chạy dọc */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-3/5 aspect-square">
                  <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                  <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                  <span className="absolute left-1 right-1 h-0.5 bg-[#FF6B35] shadow-[0_0_8px_#FF6B35] animate-line-flow" />
                </div>
              </div>
              <span className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-semibold text-white/90">
                Đưa mã QR trên màn hình kia vào khung
              </span>
            </>
          )}

          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
              <Loader2 size={26} className="animate-spin" />
              <span className="text-xs font-semibold">Đang mở camera…</span>
            </div>
          )}

          {(status === 'denied' || status === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 text-white">
              <AlertTriangle size={30} className="text-amber-400" />
              <span className="text-sm font-extrabold">
                {status === 'denied' ? 'Chưa được cấp quyền camera' : 'Không mở được camera'}
              </span>
              <span className="text-[11px] text-white/70 leading-relaxed">
                {status === 'denied'
                  ? 'Hãy cho phép truy cập camera trong cài đặt trình duyệt rồi thử lại.'
                  : errorMsg}
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
          <ScanLine size={13} /> Mã QR hiển thị trên thiết bị bạn muốn đăng nhập
        </div>
      </div>
    </div>
  );
}
