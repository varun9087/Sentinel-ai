import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, Shield, Terminal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
export const LoginPage = () => {
  const { login, register, demoLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"form" | "demo" | null>(null);
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setError("");
    setPending(event ? "form" : "demo");
    try {
      if (!event) await demoLogin();
      else if (isRegister) await register(email, password, name);
      else await login(email, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setPending(null);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">
            <Shield size={21} />
          </span>
          <span>
            sentinel<span className="brand-ai">AI</span>
          </span>
        </div>
        <div className="auth-editorial">
          <div className="eyebrow flex items-center gap-2">
            <span className="orange-line" /> INTELLIGENCE, OBSERVED.
          </div>
          <h1>
            Build boldly.
            <br />
            Measure deeply.
            <br />
            <em>Trust your AI.</em>
          </h1>
          <p>
            The workspace for teams turning AI experiments into dependable
            products.
          </p>
          <div className="auth-features">
            <span>
              <Check size={13} /> Trace every request
            </span>
            <span>
              <Check size={13} /> Evaluate every change
            </span>
          </div>
          <div className="signal-art" aria-hidden="true">
            <span className="signal-line" />
            <div className="signal-orbit">
              <div className="signal-core">
                <Shield size={46} strokeWidth={1} />
              </div>
            </div>
            <span className="signal-line right" />
            <span className="art-label">OBSERVE · EVALUATE · IMPROVE</span>
          </div>
        </div>
        <div className="auth-bottom">
          <span>THE AI RELIABILITY WORKSPACE</span>
          <span>SENTINEL / 01</span>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-container">
          <span className="eyebrow">YOUR CONTROL ROOM AWAITS</span>
          <h2>{isRegister ? "Make room for better AI." : "Welcome back."}</h2>
          <p>
            {isRegister
              ? "Create your workspace. Start with a trace, build toward trust."
              : "Sign in to see the full picture of your AI applications."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            {isRegister && (
              <label className="form-label">
                Full name
                <input
                  className="field"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                />
              </label>
            )}
            <label className="form-label">
              Work email
              <input
                className="field"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>
            <label className="form-label">
              Password
              <input
                className="field"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 8 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  isRegister ? "At least 8 characters" : "Enter your password"
                }
              />
            </label>
            {error && (
              <p className="error-notice" role="alert">
                {error}
              </p>
            )}
            <button className="button-primary" disabled={pending !== null}>
              {pending === "form"
                ? "Opening your workspace..."
                : isRegister
                  ? "Create workspace"
                  : "Sign in to workspace"}
              <ArrowRight size={15} />
            </button>
          </form>
          <div className="auth-divider">OR EXPLORE SENTINEL</div>
          <button
            className="button-secondary auth-demo"
            disabled={pending !== null}
            onClick={() => submit()}
          >
            <Terminal size={15} />
            {pending === "demo"
              ? "Preparing workspace..."
              : "Open development demo"}
            <ArrowRight size={14} />
          </button>
          <div className="auth-toggle">
            {isRegister ? "Already have a workspace?" : "New to Sentinel?"}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
            >
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </div>
          <div className="auth-footnote">
            Built for developers. Grounded in evidence.
            <br />
            Demo access is available only when enabled by your server.
          </div>
        </div>
      </section>
    </div>
  );
};
