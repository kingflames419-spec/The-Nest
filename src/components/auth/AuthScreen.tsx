import { useState, FormEvent } from 'react';
import { Mail, ArrowRight, Loader2, Hexagon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function AuthScreen() {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error } = await signInWithOtp(email.trim());
    setLoading(false);
    if (error) {
      setError('Could not send a code. Please try again.');
    } else {
      setInfo('Check your inbox for a 6-digit code.');
      setStep('otp');
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await verifyOtp(email.trim(), token.trim());
    setLoading(false);
    if (error) {
      setError('That code is invalid or expired. Try again.');
    }
  };

  return (
    <div className="min-h-screen honeycomb-pattern flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient honey glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-nest-honey/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-5">
            <div className="w-24 h-24 hex-clip bg-nest-carbon hairline-bright flex items-center justify-center honey-glow-strong">
              <div className="w-full h-full hex-clip bg-nest-void flex items-center justify-center">
                <Hexagon className="w-12 h-12 text-nest-honey" strokeWidth={1.5} />
              </div>
            </div>
          </div>
          <h1 className="font-display text-[32px] sm:text-[40px] font-semibold text-nest-white tracking-tight leading-none">
            The Nest
          </h1>
          <p className="text-nest-zinc text-sm mt-2 tracking-wide">
            Private messaging for your inner circle
          </p>
        </div>

        <div className="glass-overlay hairline-bright rounded-2xl p-8 animate-fade-in">
          {step === 'email' ? (
            <>
              <h2 className="font-display text-headline-sm font-medium text-nest-white mb-1">
                Enter your email
              </h2>
              <p className="text-nest-zinc text-body-sm mb-6">
                We'll send you a one-time login code. No passwords, ever.
              </p>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-label-md text-nest-zinc-dim uppercase tracking-wider mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-nest-zinc-dim" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl glass-input hairline text-nest-white outline-none transition-all focus:border-nest-honey/50 focus:ring-1 focus:ring-nest-honey/30 placeholder:text-nest-zinc-dim"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-body-sm text-nest-error bg-nest-error-container/20 rounded-lg px-3 py-2 border border-nest-error/30">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-nest-honey hover:bg-nest-honey-dim disabled:opacity-50 text-nest-void font-display font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 honey-glow"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Send login code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-display text-headline-sm font-medium text-nest-white mb-1">
                Enter your code
              </h2>
              <p className="text-nest-zinc text-body-sm mb-6">
                We sent a 6-digit code to{' '}
                <span className="font-medium text-nest-white-soft">{email}</span>
              </p>
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label className="block text-label-md text-nest-zinc-dim uppercase tracking-wider mb-2">
                    Login code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-4 py-3.5 rounded-xl glass-input hairline text-nest-white text-center text-2xl tracking-[0.5em] font-display font-semibold outline-none transition-all focus:border-nest-honey/50 focus:ring-1 focus:ring-nest-honey/30 placeholder:text-nest-zinc-dim/40 placeholder:tracking-[0.3em]"
                  />
                </div>
                {error && (
                  <p className="text-body-sm text-nest-error bg-nest-error-container/20 rounded-lg px-3 py-2 border border-nest-error/30">
                    {error}
                  </p>
                )}
                {info && (
                  <p className="text-body-sm text-nest-honey bg-nest-honey/10 rounded-lg px-3 py-2 border border-nest-honey/20">
                    {info}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading || token.length < 6}
                  className="w-full bg-nest-honey hover:bg-nest-honey-dim disabled:opacity-50 text-nest-void font-display font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 honey-glow"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify and enter'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setToken('');
                    setError(null);
                    setInfo(null);
                  }}
                  className="w-full text-nest-zinc hover:text-nest-white-soft text-body-sm font-medium py-2 transition-colors"
                >
                  Use a different email
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-8">
          <Hexagon className="w-3 h-3 text-nest-honey/40" fill="currentColor" />
          <p className="text-nest-zinc-dim text-label-sm uppercase tracking-wider">
            End-to-end encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
