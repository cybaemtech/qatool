import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("qa-portal-token");
  });
  const [user, setUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();

  const { data: meData, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: ["getMe"],
    },
  });

  useEffect(() => {
    if (meData) {
      setUser(meData);
    }
  }, [meData]);

  useEffect(() => {
    if (error) {
      logout();
      setLocation("/login");
    }
  }, [error, setLocation]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("qa-portal-token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("qa-portal-token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
