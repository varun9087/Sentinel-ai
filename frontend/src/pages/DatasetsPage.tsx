import React, { useEffect, useState } from "react";
import {
  Database,
  Download,
  FileText,
  FileUp,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { apiFetch } from "../api/client";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";

interface DatasetExample {
  id: string;
  input_text: string;
  expected_output: string | null;
  context: string | null;
  created_at: string;
}

interface Dataset {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  version: number;
  example_count: number;
  created_at: string;
  updated_at: string;
  examples?: DatasetExample[];
}

export const DatasetsPage: React.FC = () => {
  const { activeProject } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAddExampleOpen, setIsAddExampleOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Add example form
  const [inputVal, setInputVal] = useState("");
  const [expectedVal, setExpectedVal] = useState("");
  const [contextVal, setContextVal] = useState("");

  // JSONL import
  const [jsonlFile, setJsonlFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const fetchDatasets = async () => {
    if (!activeProject) return;
    try {
      const list = await apiFetch<Dataset[]>(`/projects/${activeProject.id}/datasets`);
      setDatasets(list);
      if (list.length > 0 && !selectedDataset) {
        loadDatasetDetail(list[0].id);
      } else if (selectedDataset) {
        loadDatasetDetail(selectedDataset.id);
      }
    } catch (err) {
      console.error("Failed to load datasets:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDatasetDetail = async (datasetId: string) => {
    if (!activeProject) return;
    try {
      const detailed = await apiFetch<Dataset>(`/projects/${activeProject.id}/datasets/${datasetId}`);
      setSelectedDataset(detailed);
    } catch (err) {
      console.error("Failed to load dataset detail:", err);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [activeProject]);

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !name.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<Dataset>(`/projects/${activeProject.id}/datasets`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      await fetchDatasets();
      setSelectedDataset(created);
      setIsCreateOpen(false);
      setName("");
      setDescription("");
    } catch (err: any) {
      alert(err.message || "Failed to create dataset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !selectedDataset || !inputVal.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/projects/${activeProject.id}/datasets/${selectedDataset.id}/examples`, {
        method: "POST",
        body: JSON.stringify({
          input_text: inputVal.trim(),
          expected_output: expectedVal.trim() || null,
          context: contextVal.trim() || null,
        }),
      });
      await loadDatasetDetail(selectedDataset.id);
      await fetchDatasets();
      setIsAddExampleOpen(false);
      setInputVal("");
      setExpectedVal("");
      setContextVal("");
    } catch (err: any) {
      alert(err.message || "Failed to add example");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportJsonl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !selectedDataset || !jsonlFile) return;
    setSubmitting(true);
    setImportErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", jsonlFile);

      await apiFetch(`/projects/${activeProject.id}/datasets/${selectedDataset.id}/import-jsonl`, {
        method: "POST",
        body: formData,
      });

      await loadDatasetDetail(selectedDataset.id);
      await fetchDatasets();
      setIsImportOpen(false);
      setJsonlFile(null);
    } catch (err: any) {
      setImportErrors([err.message || "Failed to import JSONL file."]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSampleDataset = async () => {
    if (!activeProject) return;
    try {
      const text = await apiFetch<string>(
        `/projects/${activeProject.id}/datasets/sample-dataset`,
        { headers: { Accept: "application/x-jsonlines" } }
      );
      const blob = new Blob([typeof text === "string" ? text : JSON.stringify(text)], {
        type: "application/x-jsonlines",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sample_sentinel_eval_dataset.jsonl";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download sample dataset");
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!activeProject) return;
    if (!confirm("Are you sure you want to delete this dataset? This action is irreversible.")) return;
    try {
      await apiFetch(`/projects/${activeProject.id}/datasets/${datasetId}`, {
        method: "DELETE",
      });
      setSelectedDataset(null);
      await fetchDatasets();
    } catch (err: any) {
      alert(err.message || "Failed to delete dataset");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Evaluation Datasets</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Curate, version, and import ground-truth test sets for reproducible LLM evaluations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadSampleDataset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            Sample JSONL
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Dataset
          </button>
        </div>
      </div>

      {/* Main Layout: Left Datasets list, Right Selected Dataset preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Datasets List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
            <span>Datasets ({datasets.length})</span>
            <button onClick={fetchDatasets} className="hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && datasets.length === 0 ? (
            <div className="bg-[#12141c] border border-zinc-800 rounded-xl p-8 text-center text-xs text-zinc-500">
              Loading datasets...
            </div>
          ) : datasets.length === 0 ? (
            <div className="bg-[#12141c] border border-dashed border-zinc-800 rounded-xl p-8 text-center">
              <Database className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">No datasets yet.</p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-3 text-xs text-orange-400 hover:underline"
              >
                Create your first dataset
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {datasets.map((d) => {
                const isSelected = selectedDataset?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => loadDatasetDetail(d.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#181b26] border-orange-500/50 shadow-sm"
                        : "bg-[#12141c] border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-semibold text-white tracking-tight">{d.name}</h4>
                      <Badge variant="orange">v{d.version}</Badge>
                    </div>
                    {d.description && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{d.description}</p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-3 pt-2 border-t border-zinc-800/60">
                      <span>{d.example_count} examples</span>
                      <span>{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Dataset Inspection & Example Preview */}
        <div className="lg:col-span-2">
          {!selectedDataset ? (
            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-12 text-center text-zinc-500 text-xs">
              Select a dataset on the left to preview examples or manage records.
            </div>
          ) : (
            <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl overflow-hidden">
              {/* Dataset Details Header */}
              <div className="p-5 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{selectedDataset.name}</h3>
                    <Badge variant="neutral">Version {selectedDataset.version}</Badge>
                  </div>
                  {selectedDataset.description && (
                    <p className="text-xs text-zinc-400 mt-0.5">{selectedDataset.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
                  >
                    <FileUp className="w-3.5 h-3.5 text-zinc-400" /> Import JSONL
                  </button>
                  <button
                    onClick={() => setIsAddExampleOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Example
                  </button>
                  <button
                    onClick={() => handleDeleteDataset(selectedDataset.id)}
                    title="Delete Dataset"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Examples Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-[#0e1017] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">Input Prompt / Query</th>
                      <th className="py-3 px-4">Expected Ground Truth</th>
                      <th className="py-3 px-4">Context / Knowledge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {!selectedDataset.examples || selectedDataset.examples.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-zinc-500 font-sans">
                          No examples stored in this dataset yet. Click "Add Example" or "Import JSONL"
                          above.
                        </td>
                      </tr>
                    ) : (
                      selectedDataset.examples.map((ex, i) => (
                        <tr key={ex.id} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="py-3 px-4 text-zinc-500">{i + 1}</td>
                          <td className="py-3 px-4 font-sans text-zinc-200 max-w-xs truncate">
                            {ex.input_text}
                          </td>
                          <td className="py-3 px-4 font-sans text-emerald-400 max-w-xs truncate">
                            {ex.expected_output || "—"}
                          </td>
                          <td className="py-3 px-4 font-sans text-zinc-400 max-w-xs truncate">
                            {ex.context || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Dataset Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Evaluation Dataset"
        description="Initialize a dataset collection to benchmark models and RAG prompts."
      >
        <form onSubmit={handleCreateDataset} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Dataset Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Enterprise RAG Support Benchmarks"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              placeholder="Detailed description of the queries and target evaluation objective"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
            >
              {submitting ? "Creating..." : "Create Dataset"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Example Modal */}
      <Modal
        isOpen={isAddExampleOpen}
        onClose={() => setIsAddExampleOpen(false)}
        title="Add Ground Truth Example"
        description="Insert an input prompt, target output, and optional grounding context."
      >
        <form onSubmit={handleAddExample} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Input Prompt / Query *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. What is the cancellation window for enterprise tiers?"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Expected Output (Ground Truth)
            </label>
            <textarea
              rows={2}
              placeholder="The reference ideal answer used for Exact Match and Token F1 benchmarks"
              value={expectedVal}
              onChange={(e) => setExpectedVal(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Grounding Context (Optional for RAG)
            </label>
            <textarea
              rows={3}
              placeholder="Source knowledge snippet used for Faithfulness and Context Recall evaluation"
              value={contextVal}
              onChange={(e) => setContextVal(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsAddExampleOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
            >
              {submitting ? "Saving..." : "Save Example"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Import JSONL Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setImportErrors([]);
        }}
        title="Import Dataset (JSONL)"
        description="Upload a JSONL file with records containing 'input_text', 'expected_output', and 'context'."
      >
        <form onSubmit={handleImportJsonl} className="space-y-4">
          <div className="border-2 border-dashed border-zinc-800 rounded-xl p-6 text-center hover:border-zinc-700 transition-colors">
            <FileText className="w-8 h-8 text-orange-400/80 mx-auto mb-2" />
            <p className="text-xs text-zinc-300 font-medium">Select JSONL file from your computer</p>
            <p className="text-[11px] text-zinc-500 mt-1">UTF-8 encoded JSON Lines (*.jsonl)</p>
            <input
              type="file"
              accept=".jsonl,.json,.txt"
              required
              onChange={(e) => setJsonlFile(e.target.files?.[0] || null)}
              className="mt-3 text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
            />
          </div>

          {importErrors.length > 0 && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
              <p className="font-semibold mb-1">Import Errors:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsImportOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !jsonlFile}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Validating & Importing..." : "Validate & Import"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
