import React, { useState, useEffect } from "react";
import { 
  Users, UserPlus, ShieldAlert, CheckCircle, Clock, Trash2, 
  Edit, RotateCcw, Search, MessageCircle, AlertTriangle, X, Check, Save
} from "lucide-react";
import { apiFetch } from "../utils/api";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  school?: string;
  role?: string;
  subject?: string;
  createdAt: string;
  daysAllowed: number;
  daysUsed: number;
  daysRemaining: number;
  isExpired: boolean;
  isBlocked: boolean;
  status: string;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });

  // Modals / Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; userId: string; userName: string } | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formSchool, setFormSchool] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formDaysAllowed, setFormDaysAllowed] = useState(30);
  const [formStatus, setFormStatus] = useState("active");
  const [formCreatedAt, setFormCreatedAt] = useState("");

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showMsg("Não foi possível carregar os usuários.", "error");
      }
    } catch (e) {
      showMsg("Erro de conexão com o servidor.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail || !formPassword) {
      showMsg("Nome, E-mail e Senha são obrigatórios.", "error");
      return;
    }

    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          school: formSchool,
          role: formRole,
          subject: formSubject,
          daysAllowed: Number(formDaysAllowed),
          status: formStatus
        })
      });

      if (res.ok) {
        showMsg("Usuário adicionado com sucesso!", "success");
        setShowAddModal(false);
        resetForm();
        fetchUsers();
      } else {
        const err = await res.json();
        showMsg(err.error || "Erro ao adicionar usuário.", "error");
      }
    } catch (e) {
      showMsg("Erro ao conectar ao servidor.", "error");
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await apiFetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          school: formSchool,
          role: formRole,
          subject: formSubject,
          daysAllowed: Number(formDaysAllowed),
          status: formStatus,
          createdAt: formCreatedAt
        })
      });

      if (res.ok) {
        showMsg("Usuário atualizado com sucesso!", "success");
        setShowEditModal(false);
        fetchUsers();
      } else {
        const err = await res.json();
        showMsg(err.error || "Erro ao atualizar usuário.", "error");
      }
    } catch (e) {
      showMsg("Erro ao conectar ao servidor.", "error");
    }
  };

  const handleQuickExtend = async (userId: string, additionalDays: number = 30) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newDays = Number(user.daysAllowed) + additionalDays;
    
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daysAllowed: newDays,
          status: "active" // Automatically unblocks if extended
        })
      });

      if (res.ok) {
        showMsg(`Mais ${additionalDays} dias adicionados para ${user.name}!`, "success");
        fetchUsers();
      } else {
        showMsg("Não foi possível renovar os dias.", "error");
      }
    } catch (e) {
      showMsg("Erro na renovação.", "error");
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newStatus = currentStatus === "blocked" ? "active" : "blocked";

    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        showMsg(newStatus === "blocked" ? `${user.name} bloqueado!` : `${user.name} desbloqueado!`, "success");
        fetchUsers();
      } else {
        showMsg("Erro ao alterar o status do usuário.", "error");
      }
    } catch (e) {
      showMsg("Erro de conexão.", "error");
    }
  };

  const handleDeleteUserClick = (userId: string, name: string) => {
    setDeleteConfirm({ isOpen: true, userId, userName: name });
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirm) return;
    const { userId } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        showMsg("Usuário excluído com sucesso!", "success");
        fetchUsers();
      } else {
        const err = await res.json();
        showMsg(err.error || "Erro ao excluir usuário.", "error");
      }
    } catch (e) {
      showMsg("Erro na exclusão.", "error");
    }
  };

  const openEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword(user.password || "");
    setFormSchool(user.school || "");
    setFormRole(user.role || "");
    setFormSubject(user.subject || "");
    setFormDaysAllowed(user.daysAllowed);
    setFormStatus(user.status);
    setFormCreatedAt(user.createdAt);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormSchool("");
    setFormRole("");
    setFormSubject("");
    setFormDaysAllowed(30);
    setFormStatus("active");
    setFormCreatedAt("");
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.school && u.school.toLowerCase().includes(q))
    );
  });

  const totalUsers = users.length;
  const activeUsers = users.filter(u => !u.isBlocked).length;
  const blockedUsers = users.filter(u => u.isBlocked).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-left space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#4A3728] tracking-tight">Painel de Controle Admin</h1>
          <p className="text-sm text-[#8C7A6B] mt-1 font-medium">Controle quantos usuários estão ativos, renove acessos de 30 dias e gerencie licenças.</p>
        </div>
        
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 px-5 py-3 bg-[#543D30] hover:bg-[#402D23] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-all self-start sm:self-center"
        >
          <UserPlus className="w-4 h-4" /> Cadastrar Novo Usuário
        </button>
      </div>

      {/* FEEDBACK STATUS */}
      {msg.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold border transition-all ${
          msg.type === "success" 
            ? "bg-[#E6F4EA] text-[#137333] border-[#A3E2B5]" 
            : "bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]"
        }`}>
          {msg.text}
        </div>
      )}

      {/* METRIC CARD BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-5">
          <div className="w-12 h-12 bg-[#FAF6F0] rounded-2xl flex items-center justify-center text-[#543D30]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider">Total de Usuários</span>
            <span className="text-2xl font-black text-[#4A3728]">{totalUsers}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-5">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider">Usuários Ativos</span>
            <span className="text-2xl font-black text-[#4A3728]">{activeUsers}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-5">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider">Bloqueados / Expirados</span>
            <span className="text-2xl font-black text-[#4A3728]">{blockedUsers}</span>
          </div>
        </div>
      </div>

      {/* SEARCH AND MAIN USER DATABASE GRID */}
      <div className="bg-white rounded-3xl border border-[#EADCD3] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#EADCD3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-black text-base text-[#4A3728]">Lista de Usuários do Sistema</h2>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#8C7A6B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou escola..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-xs font-medium focus:outline-none placeholder-[#8C7A6B]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-[#8C7A6B] font-bold text-sm">
            Carregando usuários...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-[#8C7A6B] font-bold text-sm">
            Nenhum usuário correspondente encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF6F0] text-[#8C7A6B] text-[10px] font-black uppercase tracking-wider border-b border-[#EADCD3]">
                  <th className="py-4 px-6">Usuário / Cadastro</th>
                  <th className="py-4 px-6">Contato / Escola</th>
                  <th className="py-4 px-6">Credenciais</th>
                  <th className="py-4 px-6 text-center">Tempo de Uso</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FAF6F0]">
                {filteredUsers.map((u) => {
                  const regDate = new Date(u.createdAt).toLocaleDateString("pt-BR");
                  const isSystemAdmin = u.email === "gabaritoiaprof@gmail.com";
                  
                  return (
                    <tr key={u.id} className="hover:bg-[#FCFAF7] transition-colors text-xs">
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-[#4A3728]">{u.name}</div>
                        <div className="text-[10px] text-[#8C7A6B] font-medium mt-0.5">Cadastrado em {regDate}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-gray-800">{u.email}</div>
                        <div className="text-[10px] text-[#8C7A6B] mt-0.5 font-medium">{u.school || "Não informada"}</div>
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-gray-500">
                        {u.password || "••••••"}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isSystemAdmin ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase">Ilmitado</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-extrabold text-[#4A3728]">
                              {u.daysRemaining} dias restantes
                            </div>
                            <div className="text-[10px] text-[#8C7A6B] font-medium">
                              {u.daysUsed} de {u.daysAllowed} dias utilizados
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isSystemAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-black text-[9px] uppercase tracking-wider">
                            Administrador
                          </span>
                        ) : u.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full font-black text-[9px] uppercase tracking-wider">
                            <Clock className="w-3 h-3" /> Bloqueado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-black text-[9px] uppercase tracking-wider">
                            <CheckCircle className="w-3 h-3" /> Ativo
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isSystemAdmin && (
                            <>
                              <button
                                onClick={() => handleQuickExtend(u.id, 30)}
                                className="px-2 py-1 bg-[#FAF6F0] hover:bg-[#F5EBE6] text-[#543D30] font-bold rounded-lg border border-[#EADCD3] transition-all cursor-pointer text-[10px]"
                                title="Renovar +30 dias"
                              >
                                +30 Dias
                              </button>
                              <button
                                onClick={() => handleToggleBlock(u.id, u.status)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  u.status === "blocked" 
                                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200" 
                                    : "bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                                }`}
                                title={u.status === "blocked" ? "Ativar Usuário" : "Bloquear Usuário"}
                              >
                                {u.status === "blocked" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 bg-[#FAF6F0] hover:bg-[#F5EBE6] text-gray-600 rounded-lg border border-[#EADCD3] cursor-pointer transition-all"
                            title="Editar Dados"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!isSystemAdmin && (
                            <button
                              onClick={() => handleDeleteUserClick(u.id, u.name)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 cursor-pointer transition-all"
                              title="Excluir Definitivamente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WHATSAPP SUPPORT REMINDER */}
      <div className="bg-[#FAF6F0] p-6 rounded-3xl border border-[#EADCD3] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-[#4A3728] text-sm">Precisa de Suporte Técnico?</h4>
            <p className="text-xs text-[#8C7A6B] font-medium">Fale diretamente com nossa central de suporte técnico do Gabarito IA para liberação e renovação.</p>
          </div>
        </div>
        <a
          href="https://wa.me/5592992504905?text=Ol%C3%A1!%20Vim%20do%20Gabarito%20IA%20e%20gostaria%20de%20suporte."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition-all shrink-0"
        >
          <MessageCircle className="w-4 h-4" /> Contato no WhatsApp (92) 99250-4905
        </a>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-3xl border border-[#EADCD3] shadow-2xl overflow-hidden text-left flex flex-col">
            <div className="p-6 border-b border-[#EADCD3] flex justify-between items-center bg-[#FAF6F0]">
              <h3 className="font-black text-base text-[#4A3728]">Cadastrar Usuário Manual</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#8C7A6B] hover:text-[#4A3728] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prof. José da Silva"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">E-mail Cadastrado *</label>
                <input
                  type="email"
                  required
                  placeholder="professor@email.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Senha de Acesso *</label>
                <input
                  type="text"
                  required
                  placeholder="Senha simples"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Instituição / Escola</label>
                  <input
                    type="text"
                    placeholder="Ex: Colégio Militar"
                    value={formSchool}
                    onChange={(e) => setFormSchool(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Disciplina / Matéria</label>
                  <input
                    type="text"
                    placeholder="Ex: Geografia"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Dias Permitidos de Uso</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formDaysAllowed}
                    onChange={(e) => setFormDaysAllowed(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Status da Conta</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs font-bold"
                  >
                    <option value="active">Ativo / Liberado</option>
                    <option value="blocked">Bloqueado / Pausado</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#543D30] hover:bg-[#402D23] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer mt-4"
              >
                Salvar Cadastro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-3xl border border-[#EADCD3] shadow-2xl overflow-hidden text-left flex flex-col">
            <div className="p-6 border-b border-[#EADCD3] flex justify-between items-center bg-[#FAF6F0]">
              <h3 className="font-black text-base text-[#4A3728]">Editar Usuário</h3>
              <button onClick={() => setShowEditModal(false)} className="text-[#8C7A6B] hover:text-[#4A3728] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditUser} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">E-mail Cadastrado *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Senha de Acesso *</label>
                <input
                  type="text"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Instituição / Escola</label>
                  <input
                    type="text"
                    value={formSchool}
                    onChange={(e) => setFormSchool(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Disciplina / Matéria</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Dias Permitidos de Uso</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formDaysAllowed}
                    disabled={selectedUser.email === "gabaritoiaprof@gmail.com"}
                    onChange={(e) => setFormDaysAllowed(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none font-bold disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Status da Conta</label>
                  <select
                    value={formStatus}
                    disabled={selectedUser.email === "gabaritoiaprof@gmail.com"}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs font-bold disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="active">Ativo / Liberado</option>
                    <option value="blocked">Bloqueado / Pausado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8C7A6B] uppercase mb-1.5">Data de Cadastro (ISO)</label>
                <input
                  type="text"
                  required
                  value={formCreatedAt}
                  onChange={(e) => setFormCreatedAt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#FAF6F0] border border-[#EADCD3] focus:border-[#543D30] rounded-xl text-xs focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#543D30] hover:bg-[#402D23] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer mt-4"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-3xl border border-[#EADCD3] shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-[#4A3728]">Confirmar Exclusão</h3>
            <p className="text-xs text-[#8C7A6B] leading-relaxed">
              Deseja mesmo excluir o usuário <strong className="text-[#4A3728]">"{deleteConfirm.userName}"</strong> de forma definitiva? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-[#FAF6F0] hover:bg-[#F5EBE6] text-[#543D30] font-black uppercase text-[10px] tracking-wider rounded-xl border border-[#EADCD3] cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition-all"
              >
                Excluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
