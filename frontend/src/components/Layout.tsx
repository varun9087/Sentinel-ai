import { useEffect, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Command,
  Database,
  FlaskConical,
  GitCompare,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Shield,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Project } from "../context/AuthContext";
import { apiFetch } from "../api/client";
import { Modal } from "./Modal";

const navigation = [
  { label: "Overview", path: "/", icon: LayoutDashboard, group: "WORKSPACE" },
  { label: "Trace explorer", path: "/traces", icon: Activity },
  {
    label: "Evaluations",
    path: "/evaluations",
    icon: FlaskConical,
    group: "BUILD & EVALUATE",
  },
  { label: "Datasets", path: "/datasets", icon: Database },
  { label: "Compare runs", path: "/comparison", icon: GitCompare },
  { label: "RAG playground", path: "/rag", icon: BookOpen },
  { label: "API keys & SDK", path: "/keys", icon: KeyRound, group: "DEVELOP" },
  { label: "Settings", path: "/settings", icon: Settings2 },
];
export const Layout = ({ children }: { children: ReactNode }) => {
  const {
    user,
    projects,
    activeProject,
    setActiveProject,
    refreshProjects,
    logout,
  } = useAuth();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setMobile(false);
    setSearchOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const project = await apiFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      await refreshProjects();
      setActiveProject(project);
      setIsNewProjectOpen(false);
      setName("");
      setDescription("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create project.",
      );
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Shield size={21} strokeWidth={1.8} />
          </span>
          <span>
            sentinel<span className="brand-ai">AI</span>
          </span>
          <span className="edition">CONSOLE</span>
        </Link>
        <div className="workspace-switch">
          <div className="workspace-avatar">
            {(activeProject?.name || "S").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <span className="eyebrow">YOUR WORKSPACE</span>
            <select
              aria-label="Active project"
              value={activeProject?.id || ""}
              onChange={(e) => {
                const p = projects.find((p) => p.id === e.target.value);
                if (p) setActiveProject(p);
              }}
            >
              <option value="" disabled>
                Select a project
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="icon-button"
            aria-label="Create project"
            onClick={() => setIsNewProjectOpen(true)}
          >
            <Plus size={15} />
          </button>
        </div>
        <button
          className="navigation-search"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={15} />
          <span>Go to anything...</span>
          <kbd>⌘ K</kbd>
        </button>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <div key={item.path}>
              {item.group && <p className="nav-group">{item.group}</p>}
              <Link
                className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
                to={item.path}
                aria-current={
                  location.pathname === item.path ? "page" : undefined
                }
              >
                <item.icon size={17} strokeWidth={1.7} />
                <span>{item.label}</span>
                {location.pathname === item.path && (
                  <span className="nav-dot" />
                )}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/keys" className="connect-card">
            <span className="flex items-center gap-2">
              <Command size={16} /> Built for your stack{" "}
              <ArrowUpRight size={14} className="ml-auto" />
            </span>
            <p>
              Connect your first application.
              <br />
              Every request tells a story.
            </p>
            <span className="connect-action">
              Get the integration guide <ChevronRight size={13} />
            </span>
          </Link>
          <div className="profile">
            <div className="profile-avatar">
              {(user?.full_name || user?.email || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <strong>{user?.full_name || "My workspace"}</strong>
              <span>{user?.email}</span>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="text-zinc-500 hidden sm:inline">Workspace</span>
            <ChevronRight size={13} className="text-zinc-600" />
            <span>
              {navigation.find((item) => item.path === location.pathname)
                ?.label || "Overview"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="environment-label">
              <span /> Project workspace
            </span>
            <Link to="/keys" className="topbar-docs">
              Integration guide <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>
        <main id="main-content" className="page-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="console-footer">
          <span>
            <Shield size={12} /> SENTINEL / AI RELIABILITY PLATFORM
          </span>
          <span>Monitor. Evaluate. Trust.</span>
        </footer>
      </div>
      <Modal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Jump to a workspace tool"
        description="Navigate your AI development workflow."
      >
        <input
          autoFocus
          aria-label="Search navigation"
          className="field"
          placeholder="Search pages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-3 space-y-1">
          {navigation
            .filter((item) =>
              item.label.toLowerCase().includes(query.toLowerCase()),
            )
            .map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSearchOpen(false)}
                className="nav-link"
              >
                <item.icon size={17} />
                {item.label}
                <ChevronRight size={14} className="ml-auto" />
              </Link>
            ))}
          {!navigation.some((item) =>
            item.label.toLowerCase().includes(query.toLowerCase()),
          ) && (
            <p className="text-sm text-zinc-400 py-4">
              No matching pages. Try “traces” or “datasets”.
            </p>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        title="Create a project"
        description="A dedicated space for your traces, datasets, and evaluations."
      >
        <form onSubmit={createProject} className="space-y-4">
          <label className="form-label">
            Project name
            <input
              className="field"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer support agent"
            />
          </label>
          <label className="form-label">
            Description
            <textarea
              className="field"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you building?"
            />
          </label>
          {error && (
            <p role="alert" className="error-notice">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setIsNewProjectOpen(false)}
            >
              Cancel
            </button>
            <button
              className="button-primary"
              disabled={creating || !name.trim()}
            >
              {creating ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
