import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiPost, apiGet } from './api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar: string | null;
  rank: { name: string; displayName: string; color: string; icon: string | null } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('astro_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      apiGet('/auth/me', token)
        .then(setUser)
        .catch(() => { localStorage.removeItem('astro_token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  async function login(login: string, password: string) {
    const data = await apiPost('/auth/login', { login, password });
    localStorage.setItem('astro_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(username: string, email: string, password: string) {
    const data = await apiPost('/auth/register', { username, email, password });
    localStorage.setItem('astro_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('astro_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
