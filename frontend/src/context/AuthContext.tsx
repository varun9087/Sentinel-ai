import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../api/client";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  setActiveProject: (p: Project) => void;
  refreshProjects: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("sentinel_token"));
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserData = async () => {
    try {
      const userData = await apiFetch<User>("/auth/me");
      setUser(userData);
      const projList = await apiFetch<Project[]>("/projects");
      setProjects(projList);
      if (projList.length > 0) {
        // Retain current or set first
        const savedProjId = localStorage.getItem("sentinel_active_project_id");
        const found = projList.find((p) => p.id === savedProjId);
        setActiveProject(found || projList[0]);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleAuthSuccess = async (tokenStr: string, userObj: User) => {
    localStorage.setItem("sentinel_token", tokenStr);
    setToken(tokenStr);
    setUser(userObj);
    const projList = await apiFetch<Project[]>("/projects");
    setProjects(projList);
    if (projList.length > 0) {
      setActiveProject(projList[0]);
      localStorage.setItem("sentinel_active_project_id", projList[0].id);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pass }),
    });
    await handleAuthSuccess(res.access_token, res.user);
  };

  const register = async (email: string, pass: string, name?: string) => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: pass, full_name: name }),
    });
    await handleAuthSuccess(res.access_token, res.user);
  };

  const demoLogin = async () => {
    const res = await apiFetch<{ access_token: string; user: User }>("/auth/demo-login", {
      method: "POST",
    });
    await handleAuthSuccess(res.access_token, res.user);
  };

  const logout = () => {
    localStorage.removeItem("sentinel_token");
    localStorage.removeItem("sentinel_active_project_id");
    setToken(null);
    setUser(null);
    setProjects([]);
    setActiveProject(null);
  };

  const refreshProjects = async () => {
    if (!token) return;
    const projList = await apiFetch<Project[]>("/projects");
    setProjects(projList);
    if (projList.length > 0 && !activeProject) {
      setActiveProject(projList[0]);
    }
  };

  useEffect(() => {
    window.addEventListener("sentinel:session-expired", logout);
    return () => window.removeEventListener("sentinel:session-expired", logout);
  }, []);

  const handleSetActiveProject = (p: Project) => {
    setActiveProject(p);
    localStorage.setItem("sentinel_active_project_id", p.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        projects,
        activeProject,
        loading,
        login,
        register,
        demoLogin,
        logout,
        setActiveProject: handleSetActiveProject,
        refreshProjects,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
