
'use client';

import React, { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import Cookies from 'js-cookie';
import { AUTH_TOKEN_COOKIE_NAME } from '@/lib/constants';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  isLoading: boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = Cookies.get(AUTH_TOKEN_COOKIE_NAME);
    setIsAuthenticated(token === 'true');
    setIsLoading(false);
  }, []);

  const login = () => {
    // Remove the 'expires' option to make it a session cookie
    // Session cookies are deleted when the browser session ends (e.g., browser is closed)
    Cookies.set(AUTH_TOKEN_COOKIE_NAME, 'true', { path: '/' });
    setIsAuthenticated(true);
  };

  const logout = () => {
    Cookies.remove(AUTH_TOKEN_COOKIE_NAME, { path: '/' }); // Added path: '/' for removal consistency
    setIsAuthenticated(false);
     window.location.href = '/login';
  };

  if (isLoading) {
    return null;
  }


  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthInternal() { // Renamed to avoid conflict if useAuth is re-exported differently
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthInternal must be used within an AuthProvider');
  }
  return context;
}

