import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { RefreshCw, Loader2, CheckCircle2, Smartphone, ScanLine, XCircle, ArrowLeft, ShieldCheck, Clock } from 'lucide-react';
import apiClient from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

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
          setTimeout(() => redirectByRole(navigate), 800);
        }
      } catch {
        // lỗi poll tạm thời → bỏ qua, lần sau thử lại
      }
    }, 2000);

    return clearTimers;
  }, [session, navigate, setAuth]);

  const approveUrl = session ? `${window.location.origin}/qr/approve?sid=${session.sessionId}` : '';
  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const scanned = status === 'SCANNED';
  const finished = status === 'APPROVED' || status === 'DONE';

  return (
    <div className="relative z-10 flex flex-col items-center text-center animate-rise-in">
      {/* Khung QR */}
      <div className="relative w-[232px] h-[232px] rounded-3xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden">
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
              <QRCodeSVG value={approveUrl} size={188} level="M" marginSize={0} fgColor="#1e293b" bgColor="#ffffff" />
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
          <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
            <Clock size={12} className="text-[#FF6B35]" /> Mã hết hạn sau <span className="tabular-nums text-slate-700">{mm}:{ss}</span>
          </div>
          <div className="mt-4 space-y-2 text-left max-w-[248px]">
            {[
              { Icon: Smartphone, text: 'Mở MealDash trên điện thoại (đã đăng nhập)' },
              { Icon: ScanLine, text: 'Dùng camera quét mã QR phía trên' },
              { Icon: ShieldCheck, text: 'Bấm "Đồng ý" để đăng nhập máy này' },
            ].map(({ Icon, text }, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#FF6B35] flex items-center justify-center shrink-0 text-[11px] font-black">{i + 1}</span>
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5"><Icon size={13} className="text-slate-400 shrink-0" /> {text}</span>
              </div>
            ))}
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
