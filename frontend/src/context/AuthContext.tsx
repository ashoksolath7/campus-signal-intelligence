import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getMeApi, loginApi, registerApi } from "../services/auth";
import { updateUserApi } from "../services/users";
import type { SessionUser, UserRole } from "../types/domain";
import { readJson, removeItem, writeJson } from "../utils/storage";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<string | null>;
  register: (input: {
    name: string;
    email: string;
    studentId?: string;
    facultyId?: string;
    staffId?: string;
    password: string;
    role?: UserRole;
    otp?: string;
    verificationToken?: string;
  }) => Promise<string | null>;
  logout: () => void;
  updateProfile: (patch: Pick<SessionUser, "name" | "phone">) => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toSession(user: SessionUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    facultyId: user.facultyId,
    staffId: user.staffId,
    departmentId: user.departmentId,
    phone: user.phone,
    emailVerified: user.emailVerified,
    verificationStatus: user.verificationStatus,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readJson<SessionUser>("session"));
  const [loading, setLoading] = useState<boolean>(true);

  const persist = useCallback((next: SessionUser | null) => {
    setUser(next);
    if (next) {
      writeJson("session", next);
    } else {
      removeItem("session");
      removeItem("token");
    }
  }, []);

  // Validate session against live backend on mount
  useEffect(() => {
    const token = readJson<string>("token");
    if (!token) {
      setLoading(false);
      return;
    }

    getMeApi()
      .then((liveUser) => {
        persist(toSession(liveUser));
      })
      .catch(() => {
        // Token expired or invalid
        persist(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [persist]);

  const login = useCallback(
    async (email: string, password: string, role: UserRole): Promise<string | null> => {
      try {
        const res = await loginApi(email, password, role);
        writeJson("token", res.accessToken);
        persist(toSession(res.user));
        return null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return msg || "Authentication failed. Please check your credentials.";
      }
    },
    [persist],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      studentId?: string;
      facultyId?: string;
      staffId?: string;
      password: string;
      role?: UserRole;
      otp?: string;
      verificationToken?: string;
    }): Promise<string | null> => {
      try {
        const res = await registerApi({
          name: input.name,
          email: input.email,
          studentId: input.studentId ?? "",
          password: input.password,
          otp: input.otp,
          verificationToken: input.verificationToken,
          role: input.role,
        });
        writeJson("token", res.accessToken);
        persist(toSession(res.user));
        return null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return msg || "Registration failed. Please check your details.";
      }
    },
    [persist],
  );

  const logout = useCallback(() => {
    removeItem("token");
    persist(null);
  }, [persist]);

  const updateProfile = useCallback(
    async (patch: Pick<SessionUser, "name" | "phone">): Promise<string | null> => {
      if (!user) {
        return "No authenticated user.";
      }
      try {
        await updateUserApi(user.id, patch);
        const updated = { ...user, ...patch };
        persist(updated);
        return null;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return msg || "Failed to update profile.";
      }
    },
    [persist, user],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateProfile }),
    [user, loading, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
