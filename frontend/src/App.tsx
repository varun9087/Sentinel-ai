import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { ComparisonPage } from "./pages/ComparisonPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DatasetsPage } from "./pages/DatasetsPage";
import { EvaluationsPage } from "./pages/EvaluationsPage";
import { LoginPage } from "./pages/LoginPage";
import { RagPlaygroundPage } from "./pages/RagPlaygroundPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TracesPage } from "./pages/TracesPage";

const ProtectedApp: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#090a0f] flex flex-col items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-xs text-zinc-400 font-mono tracking-wider">
          INITIALIZING SENTINEL AI...
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/traces" element={<TracesPage />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="/evaluations" element={<EvaluationsPage />} />
        <Route path="/comparison" element={<ComparisonPage />} />
        <Route path="/rag" element={<RagPlaygroundPage />} />
        <Route path="/keys" element={<ApiKeysPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
