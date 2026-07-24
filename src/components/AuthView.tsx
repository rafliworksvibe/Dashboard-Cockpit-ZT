import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle
} from "lucide-react";
import { loginUser, signUpUser, resetUserPassword } from "../dataService";
import { UserAccount } from "../types";

interface AuthViewProps {
  onLogin: (user: UserAccount) => void;
}

export default function AuthView({ onLogin }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isVerificationScreen, setIsVerificationScreen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);

  // Helper to handle forgot password submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setError("Email tidak boleh kosong");
      return;
    }

    setIsLoading(true);

    try {
      await resetUserPassword(emailTrimmed);
      setSuccessMsg("Email instruksi reset password telah dikirim! Silakan periksa kotak masuk/spam email Anda.");
    } catch (err: any) {
      console.warn("Forgot password error:", err);
      let errorMsg = err.message || "Gagal mengirim email reset password. Silakan coba lagi.";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setError("Email tidak boleh kosong");
      return;
    }

    if (!password) {
      setError("Kata sandi tidak boleh kosong");
      return;
    }

    if (isSignUp) {
      if (!name.trim()) {
        setError("Nama lengkap tidak boleh kosong");
        return;
      }
      if (password.length < 6) {
        setError("Sandi harus minimal 6 karakter");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const result = await signUpUser(emailTrimmed, password, name, "ADMIN");
        if (result.isUnverified) {
          setVerificationEmail(result.email || emailTrimmed);
          setIsVerificationScreen(true);
        } else if (result.userAccount) {
          onLogin(result.userAccount);
        }
      } else {
        const result = await loginUser(emailTrimmed, password);
        if (result.isUnverified) {
          setVerificationEmail(result.email || emailTrimmed);
          setIsVerificationScreen(true);
        } else if (result.userAccount) {
          onLogin(result.userAccount);
        }
      }
    } catch (err: any) {
      console.warn("Authentication error:", err);
      let errorMsg = err.message || "Terjadi kesalahan saat pendaftaran.";
      if (
        err.code === "auth/email-already-in-use" ||
        err.message?.includes("already-in-use") ||
        err.message?.includes("already in use") ||
        err.message?.includes("already exists") ||
        err.message?.includes("User already exists") ||
        err.message?.includes("sudah terdaftar")
      ) {
        errorMsg = "Email sudah terdaftar. Silakan gunakan email lain atau masuk.";
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found" ||
        err.message?.includes("incorrect")
      ) {
        errorMsg = "Email atau kata sandi tidak sesuai.";
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerificationScreen) {
    return (
      <div className="min-h-screen w-full bg-[#f0f2f8] relative overflow-hidden flex items-center justify-center font-sans p-4 sm:p-6 md:p-8">
        {/* Visual background decorations */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#1e266f]/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#f36e21]/10 blur-[120px] pointer-events-none" />

        <div className="relative w-full max-w-md z-10">
          <motion.div 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 border-t-4 border-[#f36e21] overflow-hidden"
            id="verification-card-container"
          >
            {/* Header/Logo section */}
            <div className="p-6 sm:p-8 text-center bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/5/56/Logo_PT_Kereta_Api_Indonesia_%28Persero%29_2020.svg" 
                alt="KAI Logo" 
                className="h-10 sm:h-12 w-auto object-contain mx-auto mb-4" 
                referrerPolicy="no-referrer"
                id="verification-kai-logo"
              />
              <h2 className="text-sm font-black text-[#1e266f] tracking-tight uppercase" id="verification-heading-title">
                Corporate Transformation <span className="text-[#f36e21]">Cockpit</span>
              </h2>
            </div>

            <div className="p-6 sm:p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-orange-50 border border-orange-200 text-[#f36e21] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Mail className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800" id="verification-title">
                  Email Verification
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed" id="verification-message">
                  We have sent you a verification email to <span className="font-bold text-slate-900">{verificationEmail}</span>. Please verify it and log in.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsVerificationScreen(false);
                  setIsSignUp(false);
                  setError(null);
                  setSuccessMsg(null);
                  setPassword("");
                }}
                className="w-full bg-[#f36e21] hover:bg-[#e05d15] text-white font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-lg hover:shadow-orange-500/20 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                id="verification-login-btn"
              >
                <span>Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          <p className="text-center text-[10px] text-slate-400 font-medium mt-6">
            © 2026 PT Kereta Api Indonesia (Persero). All Rights Reserved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f0f2f8] relative overflow-hidden flex items-center justify-center font-sans p-4 sm:p-6 md:p-8">
      {/* Visual background decorations: high-blur corporate shapes */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#1e266f]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#f36e21]/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        
        {/* Floating Auth Card */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 border-t-4 border-[#f36e21] overflow-hidden"
          id="auth-card-container"
        >
          {/* Header/Logo section */}
          <div className="p-6 sm:p-8 text-center bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/5/56/Logo_PT_Kereta_Api_Indonesia_%28Persero%29_2020.svg" 
              alt="KAI Logo" 
              className="h-10 sm:h-12 w-auto object-contain mx-auto mb-4" 
              referrerPolicy="no-referrer"
              id="auth-kai-logo"
            />
            <h2 className="text-sm font-black text-[#1e266f] tracking-tight uppercase" id="auth-heading-title">
              Corporate Transformation <span className="text-[#f36e21]">Cockpit</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider mt-1 uppercase font-semibold">
              KAI DZ CONTROL HUB
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {isForgotPasswordMode ? (
              <>
                {/* Reset Password Header */}
                <div className="mb-6 text-center">
                  <h3 className="text-lg font-bold text-slate-800">
                    Reset Kata Sandi
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Masukkan email korporat Anda untuk menerima instruksi reset password.
                  </p>
                </div>

                {/* Error & Success Messages */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 font-medium"
                      id="auth-error-banner-forgot"
                    >
                      <ShieldAlert className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {successMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-800 font-medium"
                      id="auth-success-banner-forgot"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{successMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4" id="auth-forgot-password-form">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Email Korporat
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="nipp@kai.id"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 focus:border-[#f36e21] focus:bg-white text-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-xs font-medium outline-none transition-all placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 bg-[#f36e21] hover:bg-[#e05d15] text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-lg hover:shadow-orange-500/20 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                    id="auth-forgot-submit-btn"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <span>Kirim Reset Password</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Toggle Link to switch mode */}
                <div className="mt-6 text-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPasswordMode(false);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[#f36e21] font-bold hover:underline hover:text-[#e05d15] transition-colors focus:outline-none"
                    id="auth-forgot-back-btn"
                  >
                    Kembali ke Login
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Tab navigation or heading state indicator */}
                <div className="mb-6 text-center">
                  <h3 className="text-lg font-bold text-slate-800">
                    {isSignUp ? "Daftar Akun Baru" : "Masuk ke Sistem"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {isSignUp 
                      ? "Dapatkan akses penuh sebagai Administrator" 
                      : "Gunakan kredensial terdaftar untuk masuk"
                    }
                  </p>
                </div>

                {/* Error & Success Messages */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 font-medium"
                      id="auth-error-banner"
                    >
                      <ShieldAlert className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {successMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-800 font-medium"
                      id="auth-success-banner"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{successMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4" id="auth-main-form">
                  <AnimatePresence mode="popLayout">
                    {isSignUp && (
                      <motion.div
                        key="name-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5"
                      >
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                          Nama Lengkap
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Contoh: Nama Lengkap"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-50/80 border border-slate-200 focus:border-[#f36e21] focus:bg-white text-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-xs font-medium outline-none transition-all placeholder:text-slate-400"
                            required={isSignUp}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Email Korporat
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="nipp@kai.id"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 focus:border-[#f36e21] focus:bg-white text-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-xs font-medium outline-none transition-all placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Kata Sandi
                      </label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPasswordMode(true);
                            setError(null);
                            setSuccessMsg(null);
                          }}
                          className="text-[10px] text-[#f36e21] font-bold hover:underline cursor-pointer"
                        >
                          Lupa Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50/80 border border-slate-200 focus:border-[#f36e21] focus:bg-white text-slate-800 rounded-lg pl-10 pr-10 py-2.5 text-xs font-medium outline-none transition-all placeholder:text-slate-400 font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {isSignUp && (
                      <p className="text-[9px] text-slate-400 font-medium">
                        * Harus minimal 6 karakter.
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 bg-[#f36e21] hover:bg-[#e05d15] text-white font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-lg hover:shadow-orange-500/20 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                    id="auth-submit-btn"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <span>{isSignUp ? "Daftar Akun" : "Masuk Cockpit"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Toggle Link to switch mode */}
                <div className="mt-6 text-center text-xs">
                  <span className="text-slate-400">
                    {isSignUp ? "Sudah memiliki akun?" : "Belum terdaftar?"}{" "}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[#f36e21] font-bold hover:underline hover:text-[#e05d15] transition-colors focus:outline-none"
                    id="auth-toggle-mode-btn"
                  >
                    {isSignUp ? "Masuk ke Sistem" : "Buat Akun Sekarang"}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
        
        {/* Footer info label */}
        <p className="text-center text-[10px] text-slate-400 font-medium mt-6">
          © 2026 PT Kereta Api Indonesia (Persero). All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
