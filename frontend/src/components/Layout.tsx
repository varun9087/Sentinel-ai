import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BookOpen,
  Database,
  GitCompare,
  Key,
  Layers,
  LogOut,
  Plus,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";
import { Modal } from "./Modal";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, projects, activeProject, setActiveProject, refreshProjects, logout } = useAuth();
  const location = useLocation();

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const navItems = [
    { label: "Overview", path: "/", icon: BarChart3 },
    { label: "Traces & Observability", path: "/traces", icon: Activity },
    { label: "Datasets", path: "/datasets", icon: Database },
    { label: "Evaluation Engine", path: "/evaluations", icon: Layers },
    { label: "Model Comparison", path: "/comparison", icon: GitCompare },
    { label: "RAG Playground", path: "/rag", icon: BookOpen },
    { label: "API Keys & SDK", path: "/keys", icon: Key },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const created = await apiFetch<any>("/projects", {
        method: "POST",
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() || null }),
      });
      await refreshProjects();
      setActiveProject(created);
      setIsNewProjectOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
    } catch (err: any) {
      alert(err.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#090a0f] text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0d0f17] border-r border-zinc-800/80 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 gap-3 border-b border-zinc-800/80">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-black text-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight text-base">Sentinel AI</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-orange-950/80 text-orange-400 border border-orange-800/60 uppercase">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-normal">LLM Observability</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-orange-400" : "text-zinc-400"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile / Quick Info */}
        <div className="p-4 border-t border-zinc-800/80 bg-[#0a0c12]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300">
                {user?.full_name ? user.full_name[0].toUpperCase() : "U"}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{user?.full_name || user?.email}</p>
                <p className="text-[11px] text-zinc-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Navbar */}
        <header className="h-16 border-b border-zinc-800/80 bg-[#0d0f17]/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* Project Switcher */}
            <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
              <span className="text-zinc-400">Project:</span>
              <select
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                value={activeProject?.id || ""}
                onChange={(e) => {
                  const p = projects.find((x) => x.id === e.target.value);
                  if (p) setActiveProject(p);
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsNewProjectOpen(true)}
                title="Create Project"
                className="ml-1 p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-orange-400"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Local Engine Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Deterministic Engine Active
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 font-mono">
              ID: {activeProject?.id.slice(0, 8)}...
            </span>
          </div>
        </header>

        {/* Page Body Viewport */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#090a0f]">
          {children}
        </main>
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        title="Create New Project"
        description="Projects isolate API keys, traces, datasets, and evaluation runs."
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Project Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Support Copilot v2"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              placeholder="Brief description of the AI application or pipeline"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsNewProjectOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
            >
              {creating ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
