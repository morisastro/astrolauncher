import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) { navigate('/', { replace: true }); return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, email, password);
      }
      navigate('/');
    } catch (err: any) {
      try { const e = JSON.parse(err.message); setError(e.error?.fieldErrors ? Object.values(e.error.fieldErrors).flat().join(', ') : e.error || 'Error'); } catch { setError(err.message || 'Connection error'); }
    } finally { setBusy(false); }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src="./assets/icon.png" alt="Astro" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h1>Astro Launcher</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username or Email" required />
          {mode === 'register' && (
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
          )}
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required minLength={6} />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </form>
        <p className="switch-mode" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
        </p>
      </div>
    </div>
  );
}
