import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";

interface ApiKeyItem {
  id: string;
  project_id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export const ApiKeysPage: React.FC = () => {
  const { activeProject } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [generating, setGenerating] = useState(false);

  // Once-only revealed raw key modal
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const list = await apiFetch<ApiKeyItem[]>(`/projects/${activeProject.id}/keys`);
      setKeys(list);
    } catch (err) {
      console.error("Failed to load API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [activeProject]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !keyName.trim()) return;
    setGenerating(true);
    try {
      const res = await apiFetch<{ raw_key: string } & ApiKeyItem>(
        `/projects/${activeProject.id}/keys`,
        {
          method: "POST",
          body: JSON.stringify({ name: keyName.trim() }),
        }
      );
      setRevealedKey(res.raw_key);
      setIsGenerateOpen(false);
      setKeyName("");
      await fetchKeys();
    } catch (err: any) {
      alert(err.message || "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!activeProject) return;
    if (!confirm("Revoking an API key will permanently block events using this key. Proceed?"))
      return;
    try {
      await apiFetch(`/projects/${activeProject.id}/keys/${keyId}`, {
        method: "DELETE",
      });
      await fetchKeys();
    } catch (err: any) {
      alert(err.message || "Failed to revoke key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pythonSnippet = `from sentinel_ai import Sentinel

# Initialize Sentinel Observability Client
client = Sentinel(
    base_url="http://localhost:8000",
    api_key="${revealedKey || "sentinel_YOUR_RAW_KEY_HERE"}",
    project_id="${activeProject?.id || "YOUR_PROJECT_ID"}",
)

# Instrument LLM request execution
client.log_event(
    model="gpt-4o",
    operation="generation",
    input_tokens=120,
    output_tokens=80,
    latency_ms=450,
    status="success",
    input_payload="User query or prompt text",
    output_payload="Model response text",
)`;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">API Keys & Ingestion SDK</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage high-entropy project ingestion keys and integrate external Python applications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGenerateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Generate Ingestion Key
          </button>
        </div>
      </div>

      {/* Security Info Card */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex items-start gap-3 text-xs text-zinc-300">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-white">Cryptographic SHA-256 Storage</h4>
          <p className="mt-0.5 text-zinc-400">
            Sentinel AI hashes all ingestion keys with SHA-256 before persisting them. Raw secret
            strings are displayed exactly once at creation and cannot be retrieved later.
          </p>
        </div>
      </div>

      {/* Keys Table */}
      <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Active Ingestion Keys</h3>
          <button onClick={fetchKeys} className="text-zinc-400 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#0e1017] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Key Name</th>
                <th className="py-3 px-4">Prefix</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {loading && keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500 font-sans">
                    Loading API keys...
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500 font-sans">
                    No API keys created yet for this project.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="py-3 px-4 font-sans">
                      {k.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="error">Revoked</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans font-medium text-white">{k.name}</td>
                    <td className="py-3 px-4 text-orange-400 font-mono">{k.key_prefix}</td>
                    <td className="py-3 px-4 font-sans text-zinc-400">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-sans text-zinc-400">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleTimeString() : "Never"}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {k.is_active && (
                        <button
                          onClick={() => handleRevoke(k.id)}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Python SDK Integration Code Box */}
      <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Python SDK Quick-Start</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Instrument your application using the non-blocking Sentinel Python client.
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(pythonSnippet)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy Code"}
          </button>
        </div>

        <pre className="p-4 rounded-lg bg-[#090a0f] border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto">
          {pythonSnippet}
        </pre>
      </div>

      {/* Generate Key Modal */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Generate Ingestion API Key"
        description="Keys allow external services to transmit LLM traces to this project."
      >
        <form onSubmit={handleCreateKey} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Key Identifier</label>
            <input
              type="text"
              required
              placeholder="e.g. Production Backend Worker"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsGenerateOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500"
            >
              {generating ? "Generating..." : "Generate Key"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Once-Only Key Revealed Modal */}
      <Modal
        isOpen={!!revealedKey}
        onClose={() => setRevealedKey(null)}
        title="Copy Your API Key"
        description="Make sure to copy your API key now. You won't be able to see it again!"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              This is the only time this secret key will ever be displayed. Store it in an environment
              variable or secret manager.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Secret Key
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={revealedKey || ""}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-orange-400 select-all"
              />
              <button
                onClick={() => copyToClipboard(revealedKey || "")}
                className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium shrink-0 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setRevealedKey(null)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-zinc-800 hover:bg-zinc-700"
            >
              I Have Stored the Key
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
