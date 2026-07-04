import React, { useState, useEffect } from "react";
import { 
  BookOpen, LogOut, LayoutDashboard, GraduationCap, 
  FileCheck, Camera, BarChart3, User, ShieldCheck, 
  Settings, Award, Sparkles, CheckCircle2, UserCheck, School, Mail, Lock, BookOpenCheck,
  Clock, MessageCircle, ShieldAlert, Eye, EyeOff, Share2, Copy, FileText
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import StudentList from "./components/StudentList";
import ExamList from "./components/ExamList";
import CorrectionSheet from "./components/CorrectionSheet";
import ReportDashboard from "./components/ReportDashboard";
import AdminPanel from "./components/AdminPanel";
import PdfToWordConverter from "./components/PdfToWordConverter";
import Logo from "./components/Logo";
import { apiFetch } from "./utils/api";
import { connectGoogleDrive, disconnectGoogleDrive, getCachedToken, isDriveConnected } from "./lib/googleDriveAuth";

type Tab = "painel" | "salas" | "provas" | "corrigir" | "resultados" | "usuarios" | "admin" | "conversor";

const DEFAULT_USER = {
  id: "gabaritoiaprof_gmail_com",
  email: "gabaritoiaprof@gmail.com",
  name: "Prof. Elderney Reis",
  school: "Escola Estadual Castro Alves",
  role: "Administrador / Professor Titular",
  subject: "Língua Portuguesa & Literatura",
  license: "Premium Individual",
  isAdminSession: true
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("painel");
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem("gabarito_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    // Set default user in localStorage so apiFetch finds it
    localStorage.setItem("gabarito_user", JSON.stringify(DEFAULT_USER));
    return DEFAULT_USER;
  });

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register form fields
  const [regName, setRegName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Dynamic quota state
  const [quotaInfo, setQuotaInfo] = useState({ count: 0, maxQuota: 220, remaining: 220 });
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Google Drive states
  const [isDriveLinked, setIsDriveLinked] = useState(isDriveConnected());
  const [driveToken, setDriveToken] = useState<string | null>(getCachedToken());
  const [driveError, setDriveError] = useState("");

  useEffect(() => {
    setIsDriveLinked(isDriveConnected());
    setDriveToken(getCachedToken());
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // User settings states
  const [settingsName, setSettingsName] = useState("");
  const [settingsSchool, setSettingsSchool] = useState("");
  const [settingsRole, setSettingsRole] = useState("");
  const [settingsSubject, setSettingsSubject] = useState("");
  const [settingsGeminiKey, setSettingsGeminiKey] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchUserSettings = async () => {
    if (!user) return;
    try {
      const res = await apiFetch("/api/user-settings");
      if (res.ok) {
        const data = await res.json();
        setSettingsName(data.name || "");
        setSettingsSchool(data.school || "");
        setSettingsRole(data.role || "");
        setSettingsSubject(data.subject || "");
        setSettingsGeminiKey(data.geminiApiKey || "");
      }
    } catch (e) {
      console.error("Error fetching user settings:", e);
    }
  };

  const fetchQuotaAndSubscription = async () => {
    if (!user) return;
    try {
      // Fetch quota
      const qRes = await apiFetch("/api/user-quota");
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuotaInfo(qData);
      }
      // Fetch subscription status
      const sRes = await apiFetch("/api/user-subscription");
      if (sRes.ok) {
        const sData = await sRes.json();
        setSubscriptionStatus(sData);
      }
    } catch (e) {
      console.error("Error fetching quota or subscription:", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchQuotaAndSubscription();
      fetchUserSettings();
    } else {
      setSubscriptionStatus(null);
    }
  }, [user, activeTab]);



  const handleConnectDrive = async () => {
    setDriveError("");
    try {
      const res = await connectGoogleDrive();
      setDriveToken(res.token);
      setIsDriveLinked(true);
    } catch (err: any) {
      setDriveError(err.message || "Erro ao conectar com o Google Drive.");
    }
  };

  const handleDisconnectDrive = async () => {
    setDriveError("");
    try {
      await disconnectGoogleDrive();
      setDriveToken(null);
      setIsDriveLinked(false);
    } catch (err: any) {
      setDriveError(err.message || "Erro ao desconectar do Google Drive.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const loggedUser = { ...data.user };
        if (loggedUser.email === "gabaritoiaprof@gmail.com") {
          loggedUser.isAdminSession = true;
        }
        localStorage.removeItem("gabarito_logged_out");
        localStorage.setItem("gabarito_user", JSON.stringify(loggedUser));
        setUser(loggedUser);
        setAuthSuccess("Acesso autorizado! Carregando seu painel...");
        setActiveTab(loggedUser.email === "gabaritoiaprof@gmail.com" ? "admin" : "painel");
      } else {
        setAuthError(data.error || "E-mail ou senha incorretos.");
      }
    } catch (err) {
      setAuthError("Falha de conexão com o servidor de autenticação.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (password !== confirmPassword) {
      setAuthError("As senhas não coincidem!");
      return;
    }

    try {
      const res = await apiFetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: regName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.removeItem("gabarito_logged_out");
        localStorage.setItem("gabarito_user", JSON.stringify(data.user));
        setUser(data.user);
        setAuthSuccess("Conta criada com sucesso! Inicializando seu banco de dados...");
        setActiveTab("painel");
      } else {
        setAuthError(data.error || "Erro ao realizar cadastro.");
      }
    } catch (err) {
      setAuthError("Falha de conexão com o servidor de autenticação.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("gabarito_user");
    localStorage.setItem("gabarito_logged_out", "true");
    setUser(null);
    setEmail("");
    setPassword("");
    setRegName("");
    setConfirmPassword("");
    setAuthMode("login");
    setActiveTab("painel");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const res = await apiFetch("/api/user-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsName,
          school: settingsSchool,
          role: settingsRole,
          subject: settingsSubject,
          geminiApiKey: settingsGeminiKey
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem("gabarito_user", JSON.stringify(data.user));
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } else {
          setSaveError("Erro ao salvar as configurações.");
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveError(errData.error || "Erro ao salvar as configurações.");
      }
    } catch (err) {
      console.error("Error saving user settings:", err);
      setSaveError("Falha na conexão de rede com o servidor.");
    } finally {
      setSaveLoading(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://ais-pre-otq4onomj4u4br2ivgkquy-639252826962.us-west2.run.app";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Gabarito IA - Correção Óptica Inteligente",
          text: "Gabarito IA: Correção automatizada e inteligente de provas para professores!",
          url: shareUrl,
        });
      } catch (err) {
        console.log("Erro de compartilhamento:", err);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  const formattedDate = currentTime.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const regDateStr = subscriptionStatus?.createdAt 
    ? new Date(subscriptionStatus.createdAt).toLocaleString("pt-BR") 
    : "Carregando...";

  const expirationDateStr = subscriptionStatus?.createdAt && subscriptionStatus?.daysAllowed
    ? new Date(new Date(subscriptionStatus.createdAt).getTime() + subscriptionStatus.daysAllowed * 24 * 60 * 60 * 1000).toLocaleString("pt-BR")
    : "Carregando...";



  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] font-sans antialiased text-[#4A3728]">
      
      {/* HEADER SECTION - Styled exactly like the screenshots! */}
      <header className="bg-[#FAF6F0] border-b border-[#EADCD3] sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
          
          {/* Logo / Brand Left */}
          <div
            onClick={() => setActiveTab("painel")}
            className="flex items-center gap-3 cursor-pointer select-none shrink-0"
          >
            <Logo size={42} className="shrink-0" />
            <div className="text-left leading-tight">
              <h1 className="text-lg font-black tracking-tight text-[#4A3728]">Gabarito IA</h1>
              <span className="text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider block">Correção Inteligente</span>
            </div>
          </div>

          {/* Desktop Navigation Tabs - Matches the look exactly! */}
          <nav className="hidden md:flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#EADCD3] shadow-xs">
            <button
              onClick={() => setActiveTab("painel")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "painel" ? "bg-[#F5EBE6] text-[#543D30]" : "text-[#8C7A6B] hover:text-[#543D30]"}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Painel</span>
            </button>

            <button
              onClick={() => setActiveTab("salas")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "salas" ? "bg-[#F5EBE6] text-[#543D30]" : "text-[#8C7A6B] hover:text-[#543D30]"}`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Salas</span>
            </button>

            <button
              onClick={() => setActiveTab("provas")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "provas" ? "bg-[#F5EBE6] text-[#543D30]" : "text-[#8C7A6B] hover:text-[#543D30]"}`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Gabaritos</span>
            </button>

            <button
              onClick={() => setActiveTab("corrigir")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "corrigir" ? "bg-[#F5EBE6] text-[#543D30]" : "text-[#8C7A6B] hover:text-[#543D30]"}`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Corrigir</span>
            </button>

            <button
              onClick={() => setActiveTab("resultados")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "resultados" ? "bg-[#F5EBE6] text-[#543D30]" : "text-[#8C7A6B] hover:text-[#543D30]"}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Resultados</span>
            </button>

            <button
              onClick={() => setActiveTab("conversor")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "conversor" ? "bg-[#F5EBE6] text-[#543D30]" : "text-[#8C7A6B] hover:text-[#543D30]"}`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Conversor PDF</span>
            </button>

            <button
              onClick={() => setActiveTab("usuarios")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "usuarios" ? "bg-[#F5EBE6] text-[#543D30]" : "text-[#8C7A6B] hover:text-[#543D30]"}`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Usuários</span>
            </button>

            {user && user.email === "gabaritoiaprof@gmail.com" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all ${activeTab === "admin" ? "bg-[#F5EBE6] text-amber-800 border border-amber-200" : "text-amber-800 hover:text-amber-900 hover:bg-amber-50"}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Painel Admin</span>
              </button>
            )}
          </nav>

          {/* Live Date & Time Clock Badge */}
          <div className="hidden lg:flex flex-col text-right leading-none pr-1 select-none">
            <span className="text-[9px] font-black uppercase tracking-wider text-[#8C7A6B]">{formattedDate}</span>
            <span className="text-xs font-black text-[#543D30] mt-0.5 font-mono flex items-center justify-end gap-1">
              <Clock className="w-3 h-3 text-[#D1A182]" />
              {formattedTime}
            </span>
          </div>

          {/* Brand Text & Exit Right */}
          <div className="flex items-center gap-1.5 sm:gap-3 select-none">
            <span className="hidden lg:inline-block text-[11px] font-black uppercase tracking-widest text-[#8C7A6B]">
              {user.name}
            </span>
            
            {user && user.email === "gabaritoiaprof@gmail.com" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`w-9 h-9 sm:w-10 sm:h-10 border rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer ${activeTab === "admin" ? "bg-amber-100 border-amber-300 text-amber-800 animate-pulse" : "bg-white border-[#EADCD3] text-amber-700 hover:bg-amber-50"}`}
                title="Painel Admin"
              >
                <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            )}

            <button
              onClick={() => setActiveTab("usuarios")}
              className={`w-9 h-9 sm:w-10 sm:h-10 border rounded-xl flex items-center justify-center transition-all shadow-xs cursor-pointer ${activeTab === "usuarios" ? "bg-[#F5EBE6] border-[#543D30] text-[#543D30]" : "bg-white border-[#EADCD3] text-[#8C7A6B] hover:bg-[#FAF6F0]"}`}
              title="Configurações do Usuário"
            >
              <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>

        </div>
      </header>

      {/* MAIN VIEW CONTROLLER */}
      <main className="flex-1 pb-24">
        
        {activeTab === "painel" && (
          <Dashboard 
            user={user}
            onNavigate={(tab) => setActiveTab(tab)}
            onNewExamClick={() => setActiveTab("provas")}
          />
        )}
        
        {activeTab === "salas" && (
          <StudentList 
            onNavigateToResults={(studentId) => {
              setActiveTab("resultados");
            }}
            onGoToSettings={() => setActiveTab("usuarios")}
          />
        )}
        
        {activeTab === "provas" && (
          <ExamList onNavigate={(tab) => setActiveTab(tab)} />
        )}
        
        {activeTab === "corrigir" && (
          <CorrectionSheet onGoToSettings={() => setActiveTab("usuarios")} />
        )}
        
        {activeTab === "resultados" && (
          <ReportDashboard />
        )}

        {activeTab === "conversor" && (
          <PdfToWordConverter />
        )}

        {activeTab === "admin" && user?.email === "gabaritoiaprof@gmail.com" && (
          <AdminPanel />
        )}
        
        {/* Custom highly polished profile view for Tab "usuarios" */}
        {activeTab === "usuarios" && (
          <div className="max-w-3xl mx-auto px-4 py-8 text-left space-y-6">
            <div>
              <h1 className="text-3xl font-extrabold text-[#4A3728] tracking-tight">Configurações de Usuário</h1>
              <p className="text-sm text-[#8C7A6B] mt-1 font-medium">Gerencie sua conta e credenciais do Gabarito IA</p>
            </div>

            {user && user.email === "gabaritoiaprof@gmail.com" && (
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-amber-900 text-sm">Acesso de Administrador Ativo</h4>
                    <p className="text-xs text-amber-700 font-semibold mt-0.5">Você pode visualizar todas as pessoas cadastradas, gerenciar trial de 30 dias e bloquear/liberar acessos.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("admin")}
                  className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-all shrink-0 font-bold"
                >
                  Abrir Controle Admin
                </button>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-[#EADCD3] shadow-xs overflow-hidden">
              {/* Profile Top Banner */}
              <div className="bg-[#FAF6F0] p-6 border-b border-[#EADCD3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#543D30] text-white rounded-full flex items-center justify-center font-black text-2xl border border-[#EADCD3] shadow-xs uppercase">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-[#4A3728]">{user.name}</h3>
                    <p className="text-xs text-[#8C7A6B] font-semibold mt-0.5">{user.role}</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-3 py-1 bg-white text-emerald-600 border border-[#D1F2D9] rounded-xl text-xs font-black uppercase">
                  <ShieldCheck className="w-4 h-4" /> Conta Ativa
                </span>
              </div>

              {/* Profile Details List */}
              <div className="p-6 space-y-6 divide-y divide-[#FAF6F0]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1">Instituição de Ensino</span>
                    <span className="font-bold text-sm text-[#4A3728]">{user.school}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1">E-mail Cadastrado</span>
                    <span className="font-bold text-sm text-[#4A3728]">{user.email}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 pb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1">Especialidade / Disciplina</span>
                    <span className="font-bold text-sm text-[#543D30]">{user.subject}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1">Tipo de Licença</span>
                    <span className="font-bold text-sm text-emerald-600 flex items-center gap-1">
                      <Sparkles className="w-4 h-4" /> {user.license || "Premium Individual"}
                    </span>
                  </div>
                </div>

                {/* Seção de Dias de Acesso Disponíveis */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 pb-4 bg-[#FAF6F0]/50 p-4 rounded-2xl border border-[#EADCD3]/40">
                  <div>
                    <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1">Dias de Acesso Disponíveis</span>
                    <span className="font-black text-base text-[#543D30] flex items-center gap-1.5">
                      <Clock className="w-4.5 h-4.5 text-[#D1A182]" />
                      {user.email === "gabaritoiaprof@gmail.com" ? (
                        "Acesso Vitalício (Admin)"
                      ) : (
                        subscriptionStatus ? `${subscriptionStatus.daysRemaining} dias disponíveis` : "Carregando..."
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1">Período de Acesso Utilizado</span>
                    <span className="font-bold text-sm text-[#8C7A6B]">
                      {user.email === "gabaritoiaprof@gmail.com" ? (
                        "Uso Ilimitado"
                      ) : (
                        subscriptionStatus ? `${subscriptionStatus.daysUsed} de ${subscriptionStatus.daysAllowed} dias consumidos` : "Carregando..."
                      )}
                    </span>
                  </div>
                </div>

                {/* Seção de Datas e Hora de Acesso */}
                <div className="pt-4 pb-4 bg-[#FAF6F0]/30 p-4 rounded-2xl border border-[#EADCD3]/40 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#543D30] border-b border-[#EADCD3] pb-1.5">Informações de Período e Hora</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-[#8C7A6B]">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Data/Hora de Cadastro:</span>
                      <span className="text-sm font-black text-[#543D30]">{regDateStr}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Data/Hora de Expiração:</span>
                      <span className="text-sm font-black text-red-600">{expirationDateStr}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-[#8C7A6B] border-t border-[#EADCD3]/40 pt-2.5">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Data de Hoje:</span>
                      <span className="text-sm font-black text-[#543D30]">{formattedDate}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Hora de Hoje:</span>
                      <span className="text-sm font-black text-[#543D30] font-mono">{formattedTime}</span>
                    </div>
                  </div>
                </div>

                {/* Buy 30 more days CTA */}
                {user.email !== "gabaritoiaprof@gmail.com" && (
                  <div className="bg-gradient-to-br from-[#FCFAF7] to-[#FAF6F0] border border-[#EADCD3] p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-black text-[#4A3728] text-sm uppercase tracking-wide">Renovar Acesso (+30 Dias)</h4>
                        <p className="text-[11px] text-[#8C7A6B] font-semibold mt-0.5 leading-relaxed">
                          Adicione mais 30 dias de correções automáticas de provas com nossa Inteligência Artificial pedagógica.
                        </p>
                      </div>
                    </div>
                    <a
                      href="https://wa.me/5592992504905?text=Ol%C3%A1!%20Vim%20do%20Gabarito%20IA%20e%20gostaria%20de%20comprar%20mais%2030%20dias%20de%20acesso%20premium."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-all shrink-0 flex items-center justify-center gap-2 hover:scale-[1.02] duration-200"
                    >
                      <MessageCircle className="w-4 h-4 fill-white text-emerald-600" /> Comprar +30 Dias
                    </a>
                  </div>
                )}

                <div className="pt-4 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-[#8C7A6B]">
                     <span>Cota Geral de Escaneamento Diário</span>
                    <span>{quotaInfo.count} de {quotaInfo.maxQuota} cartões utilizados</span>
                  </div>
                  <div className="w-full bg-[#FAF6F0] rounded-full h-2.5 border border-[#EADCD3]">
                    <div 
                      className="bg-[#D1A182] h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(quotaInfo.count / quotaInfo.maxQuota) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#8C7A6B] leading-relaxed">
                    Sua assinatura de 220 correções diárias renova automaticamente todos os dias às 00:00 UTC. Para suporte institucional de turmas, entre em contato com o suporte pedagógico.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick settings checklist & API configuration */}
            <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#F5EBE6] pb-3">
                <h3 className="text-sm font-black text-[#543D30] uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#543D30]" /> Configurações de Perfil & IA
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">Nome do Professor</label>
                  <input
                    type="text"
                    required
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full px-4 py-3 text-xs bg-[#FCFAF7] border border-[#EADCD3] rounded-xl text-[#543D30] font-semibold focus:outline-hidden focus:border-[#543D30] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">Escola / Instituição</label>
                  <input
                    type="text"
                    value={settingsSchool}
                    onChange={(e) => setSettingsSchool(e.target.value)}
                    className="w-full px-4 py-3 text-xs bg-[#FCFAF7] border border-[#EADCD3] rounded-xl text-[#543D30] font-semibold focus:outline-hidden focus:border-[#543D30] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">Cargo / Função</label>
                  <input
                    type="text"
                    value={settingsRole}
                    onChange={(e) => setSettingsRole(e.target.value)}
                    className="w-full px-4 py-3 text-xs bg-[#FCFAF7] border border-[#EADCD3] rounded-xl text-[#543D30] font-semibold focus:outline-hidden focus:border-[#543D30] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">Disciplina Principal</label>
                  <input
                    type="text"
                    value={settingsSubject}
                    onChange={(e) => setSettingsSubject(e.target.value)}
                    className="w-full px-4 py-3 text-xs bg-[#FCFAF7] border border-[#EADCD3] rounded-xl text-[#543D30] font-semibold focus:outline-hidden focus:border-[#543D30] transition-colors"
                  />
                </div>
              </div>

              {/* API Key Configuration Card */}
              <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">Chave API do Gemini / Groq (Opcional)</h4>
                    <p className="text-[10px] text-amber-800 font-medium mt-0.5 leading-relaxed">
                      Por padrão, o app utiliza a <strong>Inteligência Artificial do servidor</strong>. Caso o limite gratuito do servidor seja atingido (Erro 429), insira sua própria chave gratuita criada no Google AI Studio.
                    </p>
                  </div>
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Opcional: Cole sua chave do Gemini (AIzaSy...) ou Groq (gsk_...) aqui"
                    value={settingsGeminiKey}
                    onChange={(e) => setSettingsGeminiKey(e.target.value)}
                    className="w-full px-4 py-3 text-xs bg-white border border-amber-300 rounded-xl text-[#543D30] font-mono focus:outline-hidden focus:border-amber-600 transition-colors"
                  />
                </div>
              </div>

              {/* Switch checklists */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 p-3 bg-[#FCFAF7] border border-[#EADCD3] rounded-2xl cursor-pointer">
                  <input type="checkbox" defaultChecked className="mt-1 accent-[#543D30]" />
                  <div>
                    <span className="block text-xs font-black text-[#4A3728]">Enviar feedbacks automáticos para o aluno</span>
                    <span className="block text-[10px] text-[#8C7A6B] mt-0.5">Disparar as dicas pedagógicas da IA para o boletim online do estudante.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-[#FCFAF7] border border-[#EADCD3] rounded-2xl cursor-pointer">
                  <input type="checkbox" defaultChecked className="mt-1 accent-[#543D30]" />
                  <div>
                    <span className="block text-xs font-black text-[#4A3728]">Detecção avançada de dupla marcação</span>
                    <span className="block text-[10px] text-[#8C7A6B] mt-0.5">Considerar questão como errada se houver dupla marcação ou rasura forte.</span>
                  </div>
                </label>
              </div>

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  Configurações salvas com sucesso!
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full sm:w-auto px-6 py-3 bg-[#543D30] hover:bg-[#3E2B21] disabled:bg-[#8C7A6B] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 duration-150"
                >
                  {saveLoading ? "Salvando..." : "Salvar Configurações"}
                </button>
              </div>
            </form>
          </div>
        )}

      </main>

      {/* MOBILE FOOTER STICKY MENU */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#EADCD3] h-16 flex items-center justify-around z-50 no-print px-2 shadow-md">
        <button
          onClick={() => setActiveTab("painel")}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all cursor-pointer ${activeTab === "painel" ? "text-[#543D30] bg-[#FAF6F0]" : "text-[#8C7A6B]"}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5 uppercase tracking-wider">Painel</span>
        </button>

        <button
          onClick={() => setActiveTab("salas")}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all cursor-pointer ${activeTab === "salas" ? "text-[#543D30] bg-[#FAF6F0]" : "text-[#8C7A6B]"}`}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5 uppercase tracking-wider">Salas</span>
        </button>

        <button
          onClick={() => setActiveTab("provas")}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all cursor-pointer ${activeTab === "provas" ? "text-[#543D30] bg-[#FAF6F0]" : "text-[#8C7A6B]"}`}
        >
          <FileCheck className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5 uppercase tracking-wider">Gabaritos</span>
        </button>

        <button
          onClick={() => setActiveTab("corrigir")}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all cursor-pointer ${activeTab === "corrigir" ? "text-[#543D30] bg-[#FAF6F0]" : "text-[#8C7A6B]"}`}
        >
          <Camera className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5 uppercase tracking-wider">Corrigir</span>
        </button>

        <button
          onClick={() => setActiveTab("resultados")}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all cursor-pointer ${activeTab === "resultados" ? "text-[#543D30] bg-[#FAF6F0]" : "text-[#8C7A6B]"}`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5 uppercase tracking-wider">Notas</span>
        </button>
      </footer>

      {/* Floating WhatsApp Support Button */}
      <a
        href="https://wa.me/5592992504905?text=Ol%C3%A1!%20Vim%20do%20Gabarito%20IA%20e%20gostaria%20de%20suporte."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-[#25D366] text-white p-3.5 md:p-4 rounded-full shadow-lg hover:bg-[#20ba5a] transition-all hover:scale-105 z-40 flex items-center gap-2 group no-print font-bold text-xs"
        title="Suporte no WhatsApp"
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6 fill-white text-[#25D366]" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out whitespace-nowrap block text-[11px] font-black uppercase tracking-wider leading-none">
          Suporte (92) 99250-4905
        </span>
      </a>

    </div>
  );
}
