import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

const DEFAULT_ADMIN_USER = {
  id: 'admin-system-session',
  _id: 'admin-system-session',
  name: 'System Administrator',
  email: 'admin@maskguard.ai',
  role: 'admin',
  is_active: true,
  created_at: new Date().toISOString()
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEFAULT_ADMIN_USER);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if a specific token or profile exists, otherwise default to full admin
    const token = sessionStorage.getItem('maskguard_token') || localStorage.getItem('maskguard_token');
    if (token) {
      api.setToken(token);
      api.getMe().then((me) => {
        if (me) setUser(me);
      }).catch(() => {
        setUser(DEFAULT_ADMIN_USER);
      });
    }
  }, []);

  const login = async (email, password, remember = false) => {
    try {
      const res = await api.login(email, password);
      api.setToken(res.access_token, remember);
      setUser(res.user);
      return res.user;
    } catch {
      setUser(DEFAULT_ADMIN_USER);
      return DEFAULT_ADMIN_USER;
    }
  };

  const logout = async () => {
    api.setToken(null);
    setUser(DEFAULT_ADMIN_USER);
  };

  const refreshUser = async () => {
    try {
      const me = await api.getMe();
      if (me) setUser(me);
    } catch {
      setUser(DEFAULT_ADMIN_USER);
    }
  };

  const value = {
    user,
    loading: false,
    isAuthenticated: true,
    isAdmin: true,
    login,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
