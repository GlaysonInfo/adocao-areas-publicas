// src/routes/AppRoutes.tsx
import { Route, Routes } from "react-router-dom";

import { PublicProgramPage } from "../pages/PublicProgramPage";
import { LoginPage } from "../pages/LoginPage";
import { AreasPage } from "../pages/AreasPage";
import { ProposalNewPage } from "../pages/ProposalNewPage";
import { MyProposalsPage } from "../pages/MyProposalsPage";
import { MyProposalDetailPage } from "../pages/MyProposalDetailPage";

// ✅ NOVO (ADOTANTE - ATENDER AJUSTES)
import { MyProposalEditPage } from "../pages/proposals/MyProposalEditPage";

import { ManagerKanbanPage } from "../pages/ManagerKanbanPage";
import { ManagerProposalDetailPage } from "../pages/ManagerProposalDetailPage";

import { RequireManager } from "../auth/RequireManager";
import { RequireAdmin } from "../auth/RequireAdmin";

import { AdminAreasPage } from "../pages/admin/AdminAreasPage";
import { AdminAreasImportPage } from "../pages/admin/AdminAreasImportPage";

import { RequireReports } from "../auth/RequireReports";
import { ReportsPage } from "../pages/reports/ReportsPage";

export function AppRoutes() {
  return (
    <Routes>
      {/* INÍCIO PÚBLICO */}
      <Route path="/" element={<PublicProgramPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* ADOTANTE */}
      <Route path="/areas" element={<AreasPage />} />
      <Route path="/propostas/nova" element={<ProposalNewPage />} />
      <Route path="/minhas-propostas" element={<MyProposalsPage />} />

      {/* ✅ NOVO: tela de edição para atender ajustes */}
      <Route path="/minhas-propostas/:id/editar" element={<MyProposalEditPage />} />

      <Route path="/minhas-propostas/:id" element={<MyProposalDetailPage />} />

      {/* GESTOR (PROTEGIDO) */}
      <Route element={<RequireManager />}>
        <Route path="/gestor/kanban" element={<ManagerKanbanPage />} />
        <Route path="/gestor/propostas/:id" element={<ManagerProposalDetailPage />} />
      </Route>

      {/* ADMIN (PROTEGIDO) */}
      <Route element={<RequireAdmin />}>
        <Route path="/admin/areas" element={<AdminAreasPage />} />
        <Route path="/admin/areas/importar" element={<AdminAreasImportPage />} />
      </Route>

      {/* RELATÓRIOS (gestor_semad OU administrador) */}
      <Route element={<RequireReports />}>
        <Route path="/relatorios" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<div>Página não encontrada</div>} />
    </Routes>
  );
}