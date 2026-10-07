/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/lib/pocketbase/auth-context'

import Index from './pages/Index'
import NotFound from './pages/NotFound'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Agenda from './pages/Agenda'
import PacientesList from './pages/PacientesList'
import PacienteDetalhes from './pages/PacienteDetalhes'
import ProntuarioPage from './pages/ProntuarioPage'
import OrcamentosPage from './pages/OrcamentosPage'
import FinanceiroPage from './pages/FinanceiroPage'
import RelatoriosPage from './pages/RelatoriosPage'
import AgendamentoPublico from './pages/AgendamentoPublico'
import OwnerPainel from './pages/OwnerPainel'
import SuperAdminPainel from './pages/SuperAdminPainel'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/agendar-online" element={<AgendamentoPublico />} />

          {/* Rotas Protegidas dentro do Layout Shell da Aplicação */}
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pacientes" element={<PacientesList />} />
            <Route path="/pacientes/:id" element={<PacienteDetalhes />} />
            <Route path="/prontuario" element={<ProntuarioPage />} />
            <Route path="/prontuario/:pacienteId" element={<ProntuarioPage />} />
            <Route path="/orcamentos" element={<OrcamentosPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/configuracoes" element={<OwnerPainel />} />
            <Route path="/gestao-owner" element={<OwnerPainel />} />
            <Route path="/superadmin" element={<SuperAdminPainel />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
