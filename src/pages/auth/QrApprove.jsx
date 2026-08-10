import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Check, X, AlertTriangle, Loader2, MonitorSmartphone, LogIn, CheckCircle2, Home } from 'lucide-react';
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
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4 animate-scale-up">
              <CheckCircle2 size={34} />
            </div>
            <h1 className="text-lg font-extrabold text-slate-800">Đã đăng nhập thiết bị kia!</h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Máy tính của bạn sẽ tự vào trong giây lát. Bạn có thể đóng trang này.</p>
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
            {/* Xác nhận */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-amber-400 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
              <MonitorSmartphone size={30} />
            </div>
            <h1 className="text-lg font-extrabold text-slate-800">Đăng nhập trên thiết bị khác?</h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Có yêu cầu đăng nhập MealDash bằng tài khoản của bạn từ một thiết bị vừa quét mã QR.
            </p>

            {/* Thẻ tài khoản hiện tại */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3 text-left">
              <span className="w-10 h-10 rounded-full bg-[#FF6B35] text-white flex items-center justify-center font-black shrink-0">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-800 truncate">{user?.name || 'Tài khoản của tôi'}</p>
                <p className="text-[11px] text-slate-400 font-semibold truncate">{roleLabel}{user?.phone ? ` · ${user.phone}` : ''}</p>
              </div>
            </div>

            {/* Cảnh báo an toàn */}
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-left">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <span>Chỉ bấm <b>Đồng ý</b> nếu chính bạn đang đăng nhập trên thiết bị kia.</span>
            </div>

            <div className="mt-5 flex gap-3">
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
