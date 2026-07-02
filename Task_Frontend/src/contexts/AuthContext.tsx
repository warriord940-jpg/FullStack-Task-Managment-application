import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_URL;
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true" || !API_BASE_URL;

const getErrorMessage = async (response: Response, fallbackMessage: string) => {
  try {
    const data = await response.json();
    return data.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      const user: User = {
        id: `demo-${email.toLowerCase()}`,
        email,
        name: email.split("@")[0] || "Demo User",
        role: email.toLowerCase().includes("admin") ? "admin" : "user",
      };

      setUser(user);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", `demo-token-${Date.now()}`);
      return;
    }

    console.log("FINAL URL:", `${API_BASE_URL}/auth/signin`);
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Sign in failed"));
    }

    const data = await response.json();
    const user: User = {
      id: data.user._id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
    };

    setUser(user);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", data.token);
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (isDemoMode) {
      const user: User = {
        id: `demo-${email.toLowerCase()}`,
        email,
        name,
        role: "user",
      };

      setUser(user);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", `demo-token-${Date.now()}`);
      return;
    }

    console.log("FINAL URL:", `${API_BASE_URL}/auth/signup`);
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Sign up failed"));
    }

    const data = await response.json();
    const user: User = {
      id: data.user._id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role || "user",
    };

    setUser(user);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", data.token);
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
