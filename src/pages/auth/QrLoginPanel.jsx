import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Loader2, CheckCircle2, Smartphone, ScanLine, XCircle, ArrowLeft, ShieldCheck, Clock } from 'lucide-react';
import apiClient from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

// Logo MealDash (nón đầu bếp) nhúng vào giữa mã QR cho "branded" như app thật.
// Ô trắng bo góc + nón cam để nổi trên nền QR; QR để level H (sửa lỗi 30%) nên
// khoét giữa vẫn quét tốt.
const BRAND_QR_LOGO =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
      <rect x='2' y='2' width='44' height='44' rx='13' fill='#ffffff'/>
      <rect x='5' y='5' width='38' height='38' rx='11' fill='#FF6B35'/>
      <g transform='translate(12 12)' fill='none' stroke='#ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
        <path d='M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z'/>
        <line x1='6' x2='18' y1='17' y2='17'/>
      </g>
    </svg>`
  );

// Điều hướng theo role sau khi đăng nhập (đồng bộ với handleSubmit ở Login)
const redirectByRole = (navigate) => {
  const role = useAuthStore.getState().role;
  if (role === 'MERCHANT' || role === 'OWNER') navigate('/merchant');
  else if (role === 'SHIPPER') navigate('/shipper');
  else if (role === 'ADMIN') navigate('/admin');
  else navigate('/');
};

/**
 * Panel ĐĂNG NHẬP QR (desktop): tạo phiên → hiện QR → poll trạng thái mỗi 2s.
 * Điện thoại (đã đăng nhập) quét URL, xác nhận → panel tự đổi token & vào trang.
 */
export default function QrLoginPanel({ onBack }) {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [session, setSession] = useState(null);      // { sessionId, pollSecret }
  const [status, setStatus] = useState('LOADING');   // LOADING|PENDING|SCANNED|APPROVED|DONE|EXPIRED|REJECTED|ERROR
  const [secondsLeft, setSecondsLeft] = useState(0);

  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const doneRef = useRef(false);

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
  };

  const createSession = useCallback(async () => {
    clearTimers();
    doneRef.current = false;
    setStatus('LOADING');
    setSession(null);
    try {
      const res = await apiClient.post('/auth/qr/create');
      const d = res.data?.data || {};
      setSession({ sessionId: d.sessionId, pollSecret: d.pollSecret });
      setSecondsLeft(d.expiresIn || 120);
      setStatus('PENDING');
    } catch {
      setStatus('ERROR');
    }
  }, []);

  useEffect(() => { createSession(); return clearTimers; }, [createSession]);

  // Đếm ngược + poll khi đã có phiên
  useEffect(() => {
    if (!session || doneRef.current) return;

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearTimers(); setStatus('EXPIRED'); return 0; }
        return s - 1;
      });
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get('/auth/qr/status', {
          params: { sid: session.sessionId, secret: session.pollSecret },
        });
        const st = res.data?.data?.status;
        if (st === 'SCANNED') {
          setStatus((cur) => (cur === 'PENDING' ? 'SCANNED' : cur));
        } else if (st === 'REJECTED') {
          clearTimers(); setStatus('REJECTED');
        } else if (st === 'EXPIRED') {
          clearTimers(); setStatus('EXPIRED');
        } else if (st === 'APPROVED') {
          clearTimers(); doneRef.current = true; setStatus('APPROVED');
          const ex = await apiClient.post('/auth/qr/exchange', {
            sid: session.sessionId, secret: session.pollSecret,
          });
          const { token, user } = ex.data?.data || {};
          setAuth({ token, user });
          setStatus('DONE');
          setTimeout(() => redirectByRole(navigate), 350);
        }
      } catch {
        // lỗi poll tạm thời → bỏ qua, lần sau thử lại
      }
    }, 900);

    return clearTimers;
  }, [session, navigate, setAuth]);

  const approveUrl = session ? `${window.location.origin}/qr/approve?sid=${session.sessionId}` : '';
  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const scanned = status === 'SCANNED';
  const finished = status === 'APPROVED' || status === 'DONE';

  const lowTime = secondsLeft <= 30;

  return (
    <div className="relative z-10 flex flex-col items-center text-center animate-rise-in">
      {/* Quầng sáng cam mờ sau khung QR cho chiều sâu */}
      <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 w-56 h-56 bg-gradient-to-br from-[#FF6B35]/20 via-amber-300/10 to-transparent rounded-full blur-3xl" />

      {/* Khung QR */}
      <div className="relative w-[236px] h-[236px] rounded-[28px] border border-slate-200/80 bg-white shadow-[0_10px_40px_-12px_rgba(255,107,53,0.25)] flex items-center justify-center overflow-hidden">
        {/* 4 góc ngắm */}
        <span className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#FF6B35] rounded-tl-md" />
        <span className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#FF6B35] rounded-tr-md" />
        <span className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#FF6B35] rounded-bl-md" />
        <span className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#FF6B35] rounded-br-md" />

        {status === 'LOADING' && (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 size={26} className="animate-spin" />
            <span className="text-[11px] font-bold">Đang tạo mã…</span>
          </div>
        )}

        {(status === 'PENDING' || scanned) && session && (
          <>
            <div className={`transition-all duration-300 ${scanned ? 'blur-sm scale-95 opacity-60' : ''}`}>
              <QRCodeSVG
                value={approveUrl}
                size={192}
                level="H"
                marginSize={0}
                fgColor="#1e293b"
                bgColor="#ffffff"
                imageSettings={{ src: BRAND_QR_LOGO, height: 44, width: 44, excavate: true }}
              />
            </div>
            {/* Vạch quét chạy khi đang chờ */}
            {!scanned && (
              <span className="absolute left-6 right-6 top-6 h-8 bg-gradient-to-b from-[#FF6B35]/25 to-transparent rounded animate-scanline pointer-events-none" />
            )}
            {/* Overlay đã quét */}
            {scanned && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 backdrop-blur-[1px]">
                <span className="w-12 h-12 rounded-full bg-orange-100 text-[#FF6B35] flex items-center justify-center animate-bob" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                  <Smartphone size={22} />
                </span>
                <span className="text-[11px] font-extrabold text-slate-700 px-4 leading-snug">Đã quét! Xác nhận<br />trên điện thoại…</span>
              </div>
            )}
          </>
        )}

        {finished && (
          <div className="flex flex-col items-center gap-2 text-emerald-600 animate-scale-up">
            <CheckCircle2 size={40} />
            <span className="text-xs font-extrabold text-slate-700">Đăng nhập thành công!</span>
          </div>
        )}

        {status === 'EXPIRED' && (
          <div className="flex flex-col items-center gap-2 text-slate-400 px-4">
            <Clock size={30} />
            <span className="text-[11px] font-bold text-slate-500">Mã QR đã hết hạn</span>
          </div>
        )}
        {status === 'REJECTED' && (
          <div className="flex flex-col items-center gap-2 text-rose-500 px-4">
            <XCircle size={32} />
            <span className="text-[11px] font-bold text-slate-500">Bạn đã từ chối đăng nhập</span>
          </div>
        )}
        {status === 'ERROR' && (
          <div className="flex flex-col items-center gap-2 text-rose-500 px-4">
            <XCircle size={30} />
            <span className="text-[11px] font-bold text-slate-500">Không tạo được mã QR</span>
          </div>
        )}
      </div>

      {/* Trạng thái / hướng dẫn dưới QR */}
      {status === 'PENDING' && (
        <>
          <div className={`mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${lowTime ? 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse' : 'text-slate-500 bg-slate-50 border-slate-200'}`}>
            <Clock size={12} className={lowTime ? 'text-rose-500' : 'text-[#FF6B35]'} /> Mã hết hạn sau <span className="tabular-nums font-black">{mm}:{ss}</span>
          </div>

          {/* Stepper 3 bước có đường nối dọc */}
          <div className="relative mt-5 w-full max-w-[252px] text-left">
            <span className="absolute left-[13px] top-4 bottom-4 w-px bg-gradient-to-b from-orange-200 via-orange-200 to-transparent" />
            <div className="flex flex-col gap-3.5">
              {[
                { Icon: Smartphone, text: 'Mở MealDash trên điện thoại đã đăng nhập' },
                { Icon: ScanLine, text: 'Dùng camera quét mã QR phía trên' },
                { Icon: ShieldCheck, text: 'Bấm “Đồng ý” để đăng nhập máy này' },
              ].map(({ Icon, text }, i) => (
                <div key={i} className="relative flex items-center gap-3">
                  <span className="relative z-10 w-[27px] h-[27px] rounded-full bg-gradient-to-br from-[#FF6B35] to-amber-400 text-white flex items-center justify-center shrink-0 text-[11px] font-black shadow-sm ring-4 ring-white">
                    {i + 1}
                  </span>
                  <span className="text-[11.5px] font-semibold text-slate-600 flex items-center gap-1.5 leading-snug">
                    <Icon size={14} className="text-[#FF6B35]/70 shrink-0" /> {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trấn an bảo mật */}
          <div className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <ShieldCheck size={12} className="text-emerald-500" /> Mã dùng một lần · tự huỷ sau khi đăng nhập
          </div>
        </>
      )}

      {scanned && (
        <p className="mt-4 text-[11px] font-semibold text-slate-500 max-w-[240px]">Vui lòng mở điện thoại và bấm <span className="font-extrabold text-[#FF6B35]">Đồng ý</span> để hoàn tất.</p>
      )}

      {(status === 'EXPIRED' || status === 'REJECTED' || status === 'ERROR') && (
        <button
          type="button"
          onClick={createSession}
          className="group mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF6B35] hover:bg-[#ff7947] text-white text-xs font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <RefreshCw size={14} className="transition-transform group-hover:rotate-180 duration-500" /> Tạo mã mới
        </button>
      )}

      {/* Quay lại đăng nhập mật khẩu */}
      <button
        type="button"
        onClick={onBack}
        className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} /> Đăng nhập bằng mật khẩu
      </button>
    </div>
  );
}
