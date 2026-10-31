import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMeApi, loginApi, registerApi } from "../services/auth";
import { deleteSecureItem, getSecureItem, saveSecureItem } from "../services/storage";
import type { SessionUser, UserRole } from "../types/domain";

type AuthContextType = {
  user: SessionUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    role: UserRole,
  ) => Promise<{ user: SessionUser | null; error: string | null }>;
  register: (input: {
    name: string;
    email: string;
    studentId: string;
    password: string;
    otp?: string;
    verificationToken?: string;
    role?: UserRole;
  }) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore authenticated session from SecureStore on launch
  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getSecureItem("token");
        if (!token) {
          setLoading(false);
          return;
        }
        const liveUser = await getMeApi();
        setUser(liveUser);
      } catch {
        await deleteSecureItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      role: UserRole,
    ): Promise<{ user: SessionUser | null; error: string | null }> => {
      try {
        const res = await loginApi(email, password, role);
        await saveSecureItem("token", res.accessToken);
        setUser(res.user);
        return { user: res.user, error: null };
      } catch (err: unknown) {
        return {
          user: null,
          error: err instanceof Error ? err.message : "Authentication failed.",
        };
      }
    },
    [],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      studentId: string;
      password: string;
      otp?: string;
      verificationToken?: string;
      role?: UserRole;
    }): Promise<string | null> => {
      try {
        const res = await registerApi(input);
        await saveSecureItem("token", res.accessToken);
        setUser(res.user);
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : "Registration failed.";
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await deleteSecureItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

