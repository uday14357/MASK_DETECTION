import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setEmail('admin@maskguard.ai');
    setPassword('AdminMaskGuard2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Sign In to MaskGuard AI
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Smart Face Mask Monitoring & Surveillance Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 p-3.5 flex items-start gap-3 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Work Email Address
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@maskguard.ai"
                  className="block w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
              <p className="font-semibold text-slate-700 flex items-center justify-between">
                <span>Default Admin Account:</span>
                <button
                  type="button"
                  onClick={handleFillDemoAdmin}
                  className="text-teal-600 hover:text-teal-700 font-bold underline cursor-pointer"
                >
                  Autofill Credentials
                </button>
              </p>
              <div className="mt-1 text-slate-500 font-mono text-[11px] space-y-0.5">
                <div>Email: <span className="text-slate-800">admin@maskguard.ai</span></div>
                <div>Pass: <span className="text-slate-800">AdminMaskGuard2026!</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <Link to="/" className="text-teal-600 hover:underline">
            ← Back to Public Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
