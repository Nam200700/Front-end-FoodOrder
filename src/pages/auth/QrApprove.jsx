import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Check, X, AlertTriangle, Loader2, MonitorSmartphone, LogIn, CheckCircle2, Home, Smartphone } from 'lucide-react';
import apiClient from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

/**
 * Trang XÁC NHẬN đăng nhập QR — mở trên ĐIỆN THOẠI (đã đăng nhập) khi quét mã.
 * Route công khai; tự kiểm đăng nhập bên trong để giữ được `sid` (không đá về /login làm mất mã).
 */
export default function QrApprove() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sid = params.get('sid');
  const { isLoggedIn, user, role } = useAuthStore();

  const [state, setState] = useState('confirm'); // confirm | working | approved | rejected | error
  const [errorMsg, setErrorMsg] = useState('');

  // Đánh dấu "đã quét" để máy tính kia hiện trạng thái (best-effort)
  useEffect(() => {
    if (!sid) { setState('error'); setErrorMsg('Thiếu mã QR. Vui lòng quét lại từ màn hình đăng nhập.'); return; }
    if (!isLoggedIn) return;
    apiClient.post('/auth/qr/scanned', { sid }).catch(() => {});
  }, [sid, isLoggedIn]);

  const doApprove = async () => {
    setState('working');
    try {
      await apiClient.post('/auth/qr/approve', { sid });
      setState('approved');
    } catch (err) {
      setState('error');
      setErrorMsg(err.response?.data?.message || 'Không thể xác nhận. Mã có thể đã hết hạn.');
    }
  };

  const doReject = async () => {
    setState('working');
    try {
      await apiClient.post('/auth/qr/reject', { sid });
      setState('rejected');
    } catch {
      setState('rejected');
    }
  };

  const roleLabel = { CUSTOMER: 'Khách hàng', OWNER: 'Chủ quán', MERCHANT: 'Chủ quán', SHIPPER: 'Tài xế', ADMIN: 'Quản trị' }[role] || '';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-google-sans relative overflow-hidden">
      <div className="absolute -top-32 -left-24 w-80 h-80 bg-gradient-to-tr from-[#FF6B35]/15 to-transparent rounded-full blur-3xl opacity-60 animate-pulse-slow" />
      {/* Blob thứ hai ở góc đối diện cho nền cân, lệch pha để hai vệt sáng không thở cùng nhịp */}
      <div className="absolute -bottom-40 -right-28 w-96 h-96 bg-gradient-to-tl from-amber-300/15 to-transparent rounded-full blur-3xl opacity-50 animate-pulse-slow" style={{ animationDelay: '1.4s' }} />
      <span className="absolute top-24 right-10 w-1.5 h-1.5 rounded-full bg-[#FF6B35]/60 animate-twinkle" />
      <span className="absolute bottom-32 left-12 w-1 h-1 rounded-full bg-amber-400/70 animate-twinkle" style={{ animationDelay: '0.7s' }} />
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-shadow-3 border border-slate-200/60 p-7 relative z-10 animate-slide-up text-center">

        {/* Chưa đăng nhập → hướng dẫn đăng nhập trước (giữ nguyên mã, không đá đi) */}
        {!isLoggedIn ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#FF6B35] flex items-center justify-center mx-auto mb-4 animate-float">
              <LogIn size={30} />
            </div>
            <h1 className="text-lg font-extrabold text-slate-800">Cần đăng nhập trước</h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Hãy đăng nhập MealDash trên <b>điện thoại này</b> rồi quét lại mã QR để xác nhận.</p>
            <Link to="/login" className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF6B35] hover:bg-[#ff7947] text-white text-xs font-extrabold shadow-sm transition-all active:scale-95">
              <LogIn size={14} /> Đăng nhập ngay
            </Link>
          </>
        ) : state === 'approved' ? (
          <>
            {/* Vòng tròn tick + 2 vòng sóng lan toả (lệch pha) tạo cảm giác "vừa xong" */}
            <div className="relative w-24 h-24 mx-auto mb-1">
              <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ring-wave" />
              <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ring-wave" style={{ animationDelay: '1.3s' }} />
              <span className="absolute inset-2 rounded-full bg-emerald-300/40 animate-soft-halo" />
              <div className="absolute inset-4 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center animate-scale-up shadow-sm">
                <CheckCircle2 size={34} />
              </div>
              {/* Tia sáng nhỏ nhấp nháy quanh vòng tick */}
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-twinkle" />
              <span className="absolute bottom-2 left-1 w-1 h-1 rounded-full bg-emerald-400 animate-twinkle" style={{ animationDelay: '0.9s' }} />
              <span className="absolute top-6 left-0 w-1 h-1 rounded-full bg-emerald-300 animate-twinkle" style={{ animationDelay: '1.7s' }} />
            </div>

            {/* Điện thoại ──▸ thiết bị kia: chấm chạy thể hiện phiên đang được chuyển sang */}
            <div className="flex items-center justify-center gap-2.5 mb-3 animate-rise-in" style={{ animationDelay: '120ms' }}>
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <Smartphone size={14} />
              </span>
              <span className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-twinkle"
                    style={{ animationDelay: `${i * 0.25}s` }} />
                ))}
              </span>
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center animate-node-glow">
                <MonitorSmartphone size={15} />
              </span>
            </div>

            <h1 className="text-lg font-extrabold text-slate-800 animate-rise-in" style={{ animationDelay: '180ms' }}>
              Đã đăng nhập thiết bị kia!
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed animate-rise-in" style={{ animationDelay: '240ms' }}>
              Thiết bị kia sẽ tự vào trong giây lát. Bạn có thể đóng trang này.
            </p>
            <button onClick={() => navigate('/')} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer">
              <Home size={14} /> Về trang chủ
            </button>
          </>
        ) : state === 'rejected' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 animate-scale-up">
              <X size={32} strokeWidth={2.5} />
            </div>
            <h1 className="text-lg font-extrabold text-slate-800">Đã từ chối đăng nhập</h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Yêu cầu đăng nhập trên thiết bị kia đã bị huỷ. Không có gì thay đổi trên tài khoản của bạn.</p>
          </>
        ) : state === 'error' ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={30} />
            </div>
            <h1 className="text-lg font-extrabold text-slate-800">Không thể xác nhận</h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{errorMsg}</p>
            <button onClick={() => navigate('/')} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer">
              <Home size={14} /> Về trang chủ
            </button>
          </>
        ) : (
          <>
            {/* Xác nhận — icon thiết bị có quầng sáng + vệt quét QR chạy qua */}
            <div className="relative w-20 h-20 mx-auto mb-4">
              <span className="absolute inset-0 rounded-3xl bg-[#FF6B35]/25 animate-soft-halo" />
              <div className="absolute inset-2 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-amber-400 text-white flex items-center justify-center shadow-sm animate-float overflow-hidden">
                <MonitorSmartphone size={30} className="relative z-10" />
                {/* Vệt sáng quét dọc, gợi lại động tác vừa quét mã QR */}
                <span className="absolute left-0 right-0 h-1/3 bg-white/25 blur-[2px] animate-line-flow" />
              </div>
              <span className="absolute -top-1 right-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-twinkle" />
              <span className="absolute bottom-0 -left-1 w-1 h-1 rounded-full bg-[#FF6B35] animate-twinkle" style={{ animationDelay: '1.1s' }} />
            </div>

            <h1 className="text-lg font-extrabold text-slate-800 animate-rise-in" style={{ animationDelay: '60ms' }}>
              Đăng nhập trên thiết bị khác?
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed animate-rise-in" style={{ animationDelay: '110ms' }}>
              Có yêu cầu đăng nhập MealDash bằng tài khoản của bạn từ một thiết bị vừa quét mã QR.
            </p>

            {/* Thẻ tài khoản hiện tại */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3 text-left animate-rise-in" style={{ animationDelay: '160ms' }}>
              <span className="relative w-10 h-10 shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#FF6B35]/30 animate-ring-wave" />
                <span className="relative w-10 h-10 rounded-full bg-[#FF6B35] text-white flex items-center justify-center font-black">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-800 truncate">{user?.name || 'Tài khoản của tôi'}</p>
                <p className="text-[11px] text-slate-400 font-semibold truncate">{roleLabel}{user?.phone ? ` · ${user.phone}` : ''}</p>
              </div>
            </div>

            {/* Cảnh báo an toàn */}
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-left animate-rise-in" style={{ animationDelay: '210ms' }}>
              <ShieldCheck size={14} className="shrink-0 mt-0.5 animate-throb" />
              <span>Chỉ bấm <b>Đồng ý</b> nếu chính bạn đang đăng nhập trên thiết bị kia.</span>
            </div>

            <div className="mt-5 flex gap-3 animate-rise-in" style={{ animationDelay: '260ms' }}>
              <button
                onClick={doReject}
                disabled={state === 'working'}
                className="flex-1 py-3 rounded-full border border-slate-200 text-slate-600 text-xs font-extrabold hover:bg-slate-50 transition-all active:scale-95 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <X size={15} /> Từ chối
              </button>
              <button
                onClick={doApprove}
                disabled={state === 'working'}
                className="flex-1 py-3 rounded-full bg-[#FF6B35] hover:bg-[#ff7947] text-white text-xs font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              >
                {state === 'working' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} className="stroke-[3px]" />}
                Đồng ý
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
