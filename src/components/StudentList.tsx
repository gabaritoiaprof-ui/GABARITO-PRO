import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, GraduationCap, Search, Trash2, ArrowLeft, BookOpen, 
  Download, ScanLine, Users, Award, Pencil, Check, X, ShieldCheck, 
  Sparkles, Camera, Upload, ListOrdered, CheckCircle2, AlertCircle, Info, RefreshCw
} from "lucide-react";
import { Student, ClassGroup, ExamResult } from "../types";
import { apiFetch } from "../utils/api";

interface StudentListProps {
  onNavigateToResults?: (studentId: string) => void;
  onGoToSettings?: () => void;
}

export default function StudentList({ onNavigateToResults, onGoToSettings }: StudentListProps) {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals & form states
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState<Student | null>(null);
  const [isScanningJournal, setIsScanningJournal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "student" | "class";
    id: string;
    name: string;
  } | null>(null);

  // Form fields
  const [newClassName, setNewClassName] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentReg, setNewStudentReg] = useState("");

  // Classroom wizard states
  const [classNivel, setClassNivel] = useState<"Ensino Fundamental" | "Ensino Médio" | null>(null);
  const [classAno, setClassAno] = useState<string | null>(null);
  const [classTurmaType, setClassTurmaType] = useState<"letras" | "numeros">("letras");
  const [classTurmaValue, setClassTurmaValue] = useState<string | null>(null);
  const [isNameManualOverride, setIsNameManualOverride] = useState(false);

  // Edit fields
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentReg, setEditStudentReg] = useState("");

  // AI Journal Extraction state
  const [journalScanMode, setJournalScanMode] = useState<"text" | "photo">("text");
  const [journalText, setJournalText] = useState("");
  const [journalImage, setJournalImage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedStudents, setExtractedStudents] = useState<Array<{ sequenceNumber: number; name: string; checked: boolean }>>([]);
  const [extractionError, setExtractionError] = useState("");

  // Camera state for Journal Scan - removed live camera streaming to prevent lag on mobile devices

  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resClasses, resStudents, resResults] = await Promise.all([
        apiFetch("/api/classes"),
        apiFetch("/api/students"),
        apiFetch("/api/results")
      ]);
      const dataClasses = await resClasses.json();
      const dataStudents = await resStudents.json();
      const dataResults = await resResults.json();
      
      setClasses(dataClasses);
      setStudents(dataStudents);
      setResults(dataResults);

      // Auto-select first class as active
      if (dataClasses.length > 0) {
        const sala01 = dataClasses.find((c: any) => c.name.toLowerCase() === "sala 01") || dataClasses[0];
        setSelectedClass(sala01);
      }
    } catch (e) {
      showMsg("Erro ao carregar dados do servidor.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-generate classroom name based on selected criteria unless manually overridden
  useEffect(() => {
    if (!isNameManualOverride) {
      let generatedName = "";
      if (classAno) {
        generatedName += classAno;
      }
      if (classTurmaValue) {
        if (generatedName) {
          generatedName += ` - Turma ${classTurmaValue}`;
        } else {
          generatedName += `Turma ${classTurmaValue}`;
        }
      }
      if (classNivel) {
        const abbrev = classNivel === "Ensino Fundamental" ? "EF" : "EM";
        if (generatedName) {
          generatedName += ` ${abbrev}`;
        } else {
          generatedName += classNivel;
        }
      }
      setNewClassName(generatedName);
    }
  }, [classNivel, classAno, classTurmaValue, isNameManualOverride]);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  };

  const handleCloseAddClass = () => {
    setIsAddingClass(false);
    setClassNivel(null);
    setClassAno(null);
    setClassTurmaValue(null);
    setIsNameManualOverride(false);
    setNewClassName("");
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      const res = await apiFetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName })
      });
      if (res.ok) {
        const data = await res.json();
        setClasses([...classes, data]);
        handleCloseAddClass();
        setSelectedClass(data);
        showMsg(`Turma "${data.name}" criada com sucesso!`, "success");
      }
    } catch (e) {
      showMsg("Erro ao salvar turma.", "error");
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !selectedClass) return;

    try {
      const res = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStudentName,
          registration: newStudentReg || String(students.length + 1),
          classId: selectedClass.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStudents([...students, data]);
        setNewStudentName("");
        setNewStudentReg("");
        setIsAddingStudent(false);
        showMsg(`Aluno "${data.name}" cadastrado com sucesso!`, "success");
      }
    } catch (e) {
      showMsg("Erro ao salvar aluno.", "error");
    }
  };

  const handleEditStudentClick = (student: Student) => {
    setIsEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentReg(student.registration);
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingStudent) return;

    try {
      const res = await apiFetch(`/api/students/${isEditingStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editStudentName,
          registration: editStudentReg
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(students.map(s => s.id === isEditingStudent.id ? data.student : s));
        setIsEditingStudent(null);
        showMsg(`Cadastro do estudante atualizado com sucesso.`, "success");
      } else {
        showMsg("Erro ao atualizar dados do estudante.", "error");
      }
    } catch (e) {
      showMsg("Erro ao conectar com o servidor.", "error");
    }
  };

  const handleDeleteStudentClick = (id: string, name: string) => {
    setDeleteConfirm({ type: "student", id, name });
  };

  const handleDeleteClassClick = (id: string, name: string) => {
    setDeleteConfirm({ type: "class", id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    setDeleteConfirm(null);

    if (type === "student") {
      try {
        const res = await apiFetch(`/api/students/${id}`, {
          method: "DELETE"
        });
        if (res.ok) {
          setStudents(students.filter(s => s.id !== id));
          setResults(results.filter(r => r.studentId !== id));
          showMsg("Estudante e notas removidos com sucesso.", "success");
        } else {
          showMsg("Erro ao remover estudante.", "error");
        }
      } catch (e) {
        showMsg("Erro ao remover estudante.", "error");
      }
    } else if (type === "class") {
      try {
        const res = await apiFetch(`/api/classes/${id}`, {
          method: "DELETE"
        });
        if (res.ok) {
          setClasses(classes.filter(c => c.id !== id));
          setStudents(students.filter(s => s.classId !== id));
          setResults(results.filter(r => {
            const student = students.find(s => s.id === r.studentId);
            return !student || student.classId !== id;
          }));
          showMsg("Turma removida com sucesso.", "success");
        } else {
          showMsg("Erro ao remover turma.", "error");
        }
      } catch (e) {
        showMsg("Erro de conexão ao remover turma.", "error");
      }
    }
  };

  const handleExportCSV = () => {
    if (!selectedClass) return;
    const classStudents = students.filter(s => s.classId === selectedClass.id);
    
    // Usar ponto e vírgula como separador para compatibilidade com o Excel em português
    // e adicionar "Matrícula" com acentuação correta
    const headers = "ID;Nome;Matrícula;Turma\n";
    const rows = classStudents.map(s => {
      const cleanName = (s.name || "").replace(/"/g, '""');
      const cleanReg = (s.registration || "").replace(/"/g, '""');
      const cleanClassName = (selectedClass.name || "").replace(/"/g, '""');
      return `"${s.id}";"${cleanName}";"${cleanReg}";"${cleanClassName}"`;
    }).join("\n");
    
    // Adiciona o BOM UTF-8 (\uFEFF) para forçar o Excel a reconhecer a acentuação perfeitamente
    const csvContent = "\uFEFF" + headers + rows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `alunos_${selectedClass.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // AI Extract students handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractionError("");
    const reader = new FileReader();
    reader.onload = () => {
      setJournalImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractStudents = async () => {
    if (journalScanMode === "text" && !journalText.trim()) return;
    if (journalScanMode === "photo" && !journalImage) return;

    setIsExtracting(true);
    setExtractionError("");
    try {
      const res = await apiFetch("/api/extract-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: journalScanMode === "text" ? journalText : undefined,
          image: journalScanMode === "photo" ? journalImage : undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const studentsList = (data.students || []).map((s: any) => ({
          ...s,
          checked: true
        }));
        setExtractedStudents(studentsList);
        if (studentsList.length === 0) {
          setExtractionError("Nenhum nome de estudante foi identificado. Tente novamente.");
        }
      } else {
        setExtractionError(data.error || "Erro ao interpretar dados do diário de chamada.");
      }
    } catch (e) {
      setExtractionError("Falha ao comunicar com o processador de IA.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveBulkStudents = async () => {
    if (!selectedClass) return;
    const selectedList = extractedStudents.filter(s => s.checked);
    if (selectedList.length === 0) return;

    try {
      const res = await apiFetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass.id,
          students: selectedList.map(s => ({ name: s.name, registration: String(s.sequenceNumber) }))
        })
      });
      if (res.ok) {
        showMsg(`${selectedList.length} alunos importados com sucesso em sequência!`, "success");
        setIsScanningJournal(false);
        setExtractedStudents([]);
        setJournalText("");
        setJournalImage(null);
        fetchData();
      } else {
        showMsg("Erro ao salvar lista de alunos no servidor.", "error");
      }
    } catch (e) {
      showMsg("Falha ao conectar para importação em massa.", "error");
    }
  };

  // Simulate Instant OCR for Demo
  const handleSimulateJournalScan = () => {
    setIsExtracting(true);
    setExtractionError("");
    setTimeout(() => {
      const mockList = [
        { sequenceNumber: 1, name: "ADRIANA DE SOUZA CAMPOS", checked: true },
        { sequenceNumber: 2, name: "BRUNO HENRIQUE SILVEIRA", checked: true },
        { sequenceNumber: 3, name: "CARLA DANTAS MENDONÇA", checked: true },
        { sequenceNumber: 4, name: "DIEGO REIS FERREIRA", checked: true },
        { sequenceNumber: 5, name: "ELIANA COELHO MARQUES", checked: true },
        { sequenceNumber: 6, name: "FELIPE ALVES FERREIRA", checked: true },
        { sequenceNumber: 7, name: "GABRIEL NUNES TEIXEIRA", checked: true },
        { sequenceNumber: 8, name: "HELENA PATRÍCIA DE ARAÚJO", checked: true }
      ];
      setExtractedStudents(mockList);
      setIsExtracting(false);
    }, 1500);
  };

  // Filter students
  const activeStudents = selectedClass 
    ? students.filter(s => s.classId === selectedClass.id)
    : [];

  const filteredStudents = activeStudents.filter(s => {
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.registration.toLowerCase().includes(term);
  });

  // Calculate statistics
  const classResults = selectedClass 
    ? results.filter(r => {
        const student = students.find(s => s.id === r.studentId);
        return student && student.classId === selectedClass.id;
      })
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Messages banner */}
      {msg.text && (
        <div className={`p-4 mb-6 rounded-2xl text-sm font-bold shadow-xs border text-left ${msg.type === "success" ? "bg-[#EAF7EC] text-[#1E7D34] border-[#D1F2D9]" : "bg-[#FDF2F2] text-[#9B1C1C] border-[#FDE8E8]"}`}>
          {msg.text}
        </div>
      )}

      {/* Class List View */}
      {!selectedClass ? (
        <div className="text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-[#4A3728] tracking-tight">Suas Salas</h1>
              <p className="text-sm text-[#8C7A6B] mt-1 font-medium">Selecione uma turma para gerenciar os alunos e notas.</p>
            </div>
            <button
              onClick={() => setIsAddingClass(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#543D30] hover:bg-[#402D23] text-white text-xs font-bold rounded-2xl cursor-pointer shadow-md transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Cadastrar Turma
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-20 text-[#8C7A6B] font-medium animate-pulse">Carregando salas...</div>
          ) : classes.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-[#EADCD3] text-center max-w-lg mx-auto shadow-xs">
              <GraduationCap className="w-12 h-12 text-[#A08E7F] mx-auto mb-4" />
              <h3 className="font-bold text-[#4A3728]">Nenhuma sala cadastrada</h3>
              <p className="text-xs text-[#8C7A6B] mt-2 leading-relaxed">
                Comece cadastrando uma nova turma (ex: 9º Ano EF - Turma 01) clicando no botão no topo direito.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {classes.map((cls) => {
                const numStudents = students.filter(s => s.classId === cls.id).length;
                return (
                  <div
                    key={cls.id}
                    onClick={() => setSelectedClass(cls)}
                    className="bg-white p-6 rounded-3xl border border-[#EADCD3] hover:border-[#543D30] cursor-pointer shadow-xs hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-[#FAF6F0] text-[#543D30] rounded-xl flex items-center justify-center border border-[#F0E6DF]">
                        <Users className="w-5 h-5" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClassClick(cls.id, cls.name);
                        }}
                        className="p-1.5 hover:bg-red-50 text-[#8C7A6B] hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Turma"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-black text-base text-[#4A3728] group-hover:text-[#543D30] transition-colors">{cls.name}</h3>
                    <p className="text-xs font-semibold text-[#8C7A6B] mt-1">
                      {numStudents} {numStudents === 1 ? "Aluno" : "Alunos"} cadastrados
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Class Detail View */
        <div className="text-left space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedClass(null)}
                  className="p-1.5 hover:bg-[#F5EBE6] text-[#543D30] rounded-xl cursor-pointer transition-colors"
                  title="Voltar para Salas"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-3xl font-extrabold text-[#4A3728] tracking-tight">{selectedClass.name}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5EBE6] text-[#543D30] text-[11px] font-bold rounded-xl border border-[#EADCD3] uppercase">
                  <GraduationCap className="w-3.5 h-3.5" /> 9º Ano EF
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5EBE6] text-[#543D30] text-[11px] font-bold rounded-xl border border-[#EADCD3] uppercase">
                  Turma Ativa
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5EBE6] text-[#543D30] text-[11px] font-bold rounded-xl border border-[#EADCD3] uppercase">
                  <BookOpen className="w-3.5 h-3.5" /> Língua Portuguesa
                </span>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-[#FAF6F0] border border-[#EADCD3] text-[#543D30] text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
              <button
                onClick={() => setIsScanningJournal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FAF6F0] hover:bg-[#F0E6DF] border border-[#EADCD3] text-[#543D30] text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-all"
              >
                <ScanLine className="w-4 h-4 text-[#D1A182]" /> Escanear Lista IA
              </button>
              <button
                onClick={() => setIsAddingStudent(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#543D30] hover:bg-[#402D23] text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition-all"
              >
                <Plus className="w-4 h-4" /> Adicionar Aluno
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-[#EFF6FF] text-[#3B82F6] rounded-2xl flex items-center justify-center border border-[#DBEAFE]">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-[#4A3728]">{activeStudents.length}</span>
                <span className="text-xs font-bold text-[#8C7A6B]">Alunos nesta sala</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FFFBEB] text-[#F59E0B] rounded-2xl flex items-center justify-center border border-[#FEF3C7]">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-2xl font-black text-[#4A3728]">{classResults.length}</span>
                <span className="text-xs font-bold text-[#8C7A6B]">Gabaritos corrigidos</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4.5 h-4.5 text-[#A08E7F] absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Buscar aluno por nome ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm focus:outline-none shadow-xs font-medium"
            />
          </div>

          <div className="space-y-3">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-[#EADCD3] text-[#8C7A6B] text-xs font-medium">
                Nenhum aluno encontrado para os termos da busca.
              </div>
            ) : (
              [...filteredStudents].sort((a, b) => Number(a.registration) - Number(b.registration)).map((student) => {
                const studentLetter = student.name.charAt(0).toUpperCase();
                
                return (
                  <div
                    key={student.id}
                    className="bg-white p-4 rounded-3xl border border-[#EADCD3] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:shadow-xs transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#F5EBE6] text-[#543D30] font-black rounded-full flex items-center justify-center text-sm border border-[#EADCD3]">
                        {studentLetter}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm sm:text-base text-[#4A3728] uppercase">{student.name}</h3>
                        <p className="text-xs text-[#8C7A6B] mt-0.5 font-semibold">
                          Código de Chamada: <strong className="text-[#543D30]">#{student.registration}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      <button
                        onClick={() => {
                          if (onNavigateToResults) {
                            onNavigateToResults(student.id);
                          } else {
                            alert(`Buscando notas do aluno: ${student.name}`);
                          }
                        }}
                        className="px-4 py-2 bg-[#F5EBE6] hover:bg-[#EADCD3] text-[#543D30] font-black text-xs rounded-xl border border-[#EADCD3] cursor-pointer transition-colors"
                      >
                        Ver Notas
                      </button>
                      <button
                        onClick={() => handleEditStudentClick(student)}
                        className="p-2 hover:bg-[#FAF6F0] text-[#8C7A6B] hover:text-[#543D30] border border-transparent hover:border-[#EADCD3] rounded-xl cursor-pointer transition-colors"
                        title="Editar Aluno"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStudentClick(student.id, student.name)}
                        className="p-2 hover:bg-red-50 text-[#8C7A6B] hover:text-red-600 border border-transparent hover:border-red-100 rounded-xl cursor-pointer transition-colors"
                        title="Remover Aluno"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL: IA Diário de Chamada Import */}
      {isScanningJournal && selectedClass && (
        <div className="fixed inset-0 bg-[#4A3728]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#EADCD3] max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-left my-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-[#D1A182] border border-[#F0E6DF] rounded-lg text-[10px] font-black uppercase">
                  <Sparkles className="w-3.5 h-3.5" /> Scanner Pedagógico Inteligente
                </span>
                <h3 className="text-xl font-black text-[#4A3728] mt-2.5">Importar Diário Escolar com IA</h3>
                <p className="text-xs text-[#8C7A6B] mt-0.5 font-semibold">Identifique múltiplos alunos de uma só vez por foto ou texto.</p>
              </div>
              <button 
                onClick={() => {
                  setIsScanningJournal(false);
                }}
                className="p-1 text-[#8C7A6B] hover:text-[#4A3728] hover:bg-[#FAF6F0] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector Text vs Photo */}
            <div className="grid grid-cols-2 gap-2 bg-[#FAF6F0] p-1 rounded-2xl border border-[#EADCD3] mb-6">
              <button
                onClick={() => setJournalScanMode("text")}
                className={`py-2.5 text-xs font-black uppercase rounded-xl tracking-wider transition-all cursor-pointer ${journalScanMode === "text" ? "bg-[#543D30] text-white shadow-xs" : "text-[#8C7A6B]"}`}
              >
                Colar Texto do Diário
              </button>
              <button
                onClick={() => setJournalScanMode("photo")}
                className={`py-2.5 text-xs font-black uppercase rounded-xl tracking-wider transition-all cursor-pointer ${journalScanMode === "photo" ? "bg-[#543D30] text-white shadow-xs" : "text-[#8C7A6B]"}`}
              >
                Foto da Caderneta/Diário
              </button>
            </div>

            {/* Error alerts */}
            {extractionError && (
              <div className="p-4 mb-4 bg-red-50 border border-red-100 rounded-2xl text-red-900 text-xs font-bold text-left space-y-3">
                <div className="flex gap-2 items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{extractionError}</span>
                </div>
                {onGoToSettings && (extractionError.includes("Configurações") || extractionError.includes("Chave API") || extractionError.includes("cota") || extractionError.includes("créditos") || extractionError.includes("429") || extractionError.includes("esgotados")) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onGoToSettings}
                      className="w-full sm:w-auto px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                    >
                      ⚙️ Configurar Minha Chave API Grátis
                    </button>
                  </div>
                )}
              </div>
            )}

            {extractedStudents.length === 0 ? (
              <div className="space-y-4">
                {journalScanMode === "text" ? (
                  <div>
                    <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider mb-2">Cole as linhas de nomes do diário</label>
                    <textarea
                      rows={6}
                      placeholder="Cole o texto aqui. Exemplo:&#10;1 - ADRIANA SOUZA CAMPOS&#10;2 - BRUNO HENRIQUE SILVEIRA&#10;3 - CARLA DANTAS MENDONÇA"
                      value={journalText}
                      onChange={(e) => setJournalText(e.target.value)}
                      className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-xs focus:outline-none font-bold"
                    />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-[#EADCD3] rounded-2xl bg-[#FCFAF7] p-6 text-center flex flex-col items-center justify-center min-h-[220px] relative">
                    {journalImage ? (
                      <div className="w-full flex flex-col items-center">
                        <img src={journalImage} className="max-h-[280px] object-contain rounded-xl border border-[#EADCD3] mb-3 shadow-xs bg-white" />
                        <div className="flex gap-2">
                          <button onClick={() => setJournalImage(null)} className="px-5 py-2.5 bg-white border border-[#EADCD3] text-[#8C7A6B] text-xs font-bold rounded-xl cursor-pointer hover:bg-[#FAF6F0] transition-colors">Remover Foto</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 w-full">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xs border border-[#EADCD3] mx-auto">
                          <Camera className="w-5 h-5 text-[#8C7A6B]" />
                        </div>
                        <p className="text-xs font-bold text-[#8C7A6B]">Tire foto da folha do diário contendo os nomes</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm mx-auto pt-1.5">
                          {/* Option 1: Native Phone Camera App */}
                          <label className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-[#543D30] hover:bg-[#402D23] text-white rounded-2xl cursor-pointer shadow-sm transition-all">
                            <Camera className="w-5 h-5 text-[#EADCD3]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-center">Câmera Celular<br/><span className="text-[8px] text-[#EADCD3]/80 font-normal normal-case">Qualidade máxima</span></span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </label>

                          {/* Option 2: Device Gallery / PDF */}
                          <label className="flex flex-col items-center justify-center gap-1.5 p-3.5 bg-white hover:bg-[#FAF6F0] border border-[#EADCD3] text-[#543D30] rounded-2xl cursor-pointer shadow-sm transition-all">
                            <Upload className="w-5 h-5 text-[#D1A182]" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-center">Galeria / PDF<br/><span className="text-[8px] text-[#8C7A6B] font-normal normal-case">Selecionar arquivo</span></span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSimulateJournalScan}
                    className="flex-1 py-3 text-[10px] text-[#D1A182] hover:text-[#543D30] font-black uppercase tracking-wider text-center"
                  >
                    ⚡ Simular Leitura Óptica Instantânea
                  </button>
                  <button
                    onClick={handleExtractStudents}
                    disabled={isExtracting || (journalScanMode === "text" ? !journalText.trim() : !journalImage)}
                    className="flex-1 py-3 bg-[#543D30] hover:bg-[#402D23] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isExtracting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processando com IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Identificar com IA
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Preview Extracted List & Bulk Save */
              <div className="space-y-4">
                <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#EADCD3] flex gap-3">
                  <ListOrdered className="w-5 h-5 text-[#D1A182] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#543D30] uppercase mb-0.5">Sequência Identificada com Sucesso</h4>
                    <p className="text-xs text-[#8C7A6B] leading-relaxed font-semibold">
                      Abaixo está a lista sequencial de nomes extraída do diário. Verifique os nomes e clique em Salvar Tudo.
                    </p>
                  </div>
                </div>

                <div className="max-h-[250px] overflow-y-auto border border-[#EADCD3] rounded-2xl divide-y divide-[#FAF6F0] bg-[#FCFAF7] p-2">
                  {extractedStudents.map((st, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 hover:bg-white rounded-xl">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={st.checked}
                          onChange={(e) => {
                            setExtractedStudents(extractedStudents.map((s, i) => i === idx ? { ...s, checked: e.target.checked } : s));
                          }}
                          className="accent-[#543D30]"
                        />
                        <span className="text-xs font-black text-[#8C7A6B] w-6">#{st.sequenceNumber}</span>
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => {
                            setExtractedStudents(extractedStudents.map((s, i) => i === idx ? { ...s, name: e.target.value } : s));
                          }}
                          className="bg-transparent border-b border-transparent focus:border-[#EADCD3] focus:bg-white px-1.5 py-0.5 text-xs font-bold text-[#4A3728] uppercase focus:outline-none rounded-sm max-w-sm sm:max-w-md w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setExtractedStudents([])}
                    className="flex-1 py-3 border border-[#EADCD3] text-[#8C7A6B] font-bold text-xs rounded-xl"
                  >
                    Recomeçar Leitura
                  </button>
                  <button
                    onClick={handleSaveBulkStudents}
                    className="flex-1 py-3 bg-[#543D30] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Importar {extractedStudents.filter(s => s.checked).length} Alunos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Cadastrar Turma */}
      {isAddingClass && (
        <div className="fixed inset-0 bg-[#4A3728]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#EADCD3] max-w-lg w-full p-6 shadow-2xl text-left my-8 max-h-[90vh] overflow-y-auto relative">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-5">
              <h3 className="text-xl font-black text-[#4A3728]">Nova Sala de Aula</h3>
              <button 
                type="button"
                onClick={handleCloseAddClass}
                className="p-1.5 hover:bg-[#FAF6F0] text-[#8C7A6B] hover:text-[#4A3728] rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-6">
              
              {/* NÍVEL DE ENSINO */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-[#8C7A6B]" />
                  Nível de Ensino <span className="text-[9px] font-bold text-gray-400 lowercase italic">(opcional)</span>
                </label>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const target = classNivel === "Ensino Fundamental" ? null : "Ensino Fundamental";
                      setClassNivel(target);
                      setClassAno(null);
                      setClassTurmaValue(null);
                    }}
                    className={`flex-1 py-3 px-4 text-xs font-black rounded-xl border transition-all cursor-pointer text-center ${
                      classNivel === "Ensino Fundamental"
                        ? "bg-[#543D30] text-white border-[#543D30] shadow-xs"
                        : "bg-white text-[#543D30] border-[#EADCD3] hover:bg-[#FAF6F0]"
                    }`}
                  >
                    Ensino Fundamental
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = classNivel === "Ensino Médio" ? null : "Ensino Médio";
                      setClassNivel(target);
                      setClassAno(null);
                      setClassTurmaValue(null);
                    }}
                    className={`flex-1 py-3 px-4 text-xs font-black rounded-xl border transition-all cursor-pointer text-center ${
                      classNivel === "Ensino Médio"
                        ? "bg-[#543D30] text-white border-[#543D30] shadow-xs"
                        : "bg-white text-[#543D30] border-[#EADCD3] hover:bg-[#FAF6F0]"
                    }`}
                  >
                    Ensino Médio
                  </button>
                </div>
              </div>

              {/* ANO / SÉRIE */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider block">
                  Ano / Série
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(() => {
                    const anos = classNivel === "Ensino Médio" 
                      ? ["1º Ano", "2º Ano", "3º Ano"]
                      : ["1º Ano", "2º Ano", "3º Ano", "4º Ano", "5º Ano", "6º Ano", "7º Ano", "8º Ano", "9º Ano"];
                    
                    return anos.map((ano) => (
                      <button
                        key={ano}
                        type="button"
                        onClick={() => setClassAno(classAno === ano ? null : ano)}
                        className={`py-2 px-3 text-xs font-extrabold rounded-xl border transition-all cursor-pointer text-center ${
                          classAno === ano
                            ? "bg-[#FAF6F0] text-[#543D30] border-[#543D30] ring-1 ring-[#543D30]"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-[#FAF6F0]"
                        }`}
                      >
                        {ano}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* TURMA */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider block">
                  Turma
                </label>
                
                {/* Switch Letras / Números */}
                <div className="grid grid-cols-2 gap-1.5 bg-[#FAF6F0] p-1 rounded-xl border border-[#EADCD3] mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setClassTurmaType("letras");
                      setClassTurmaValue(null);
                    }}
                    className={`py-2 text-[10px] font-black uppercase rounded-lg tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      classTurmaType === "letras"
                        ? "bg-white text-[#543D30] shadow-xs border border-[#EADCD3]/40"
                        : "text-[#8C7A6B] hover:text-[#543D30]"
                    }`}
                  >
                    <span>T</span> Letras (A-Z)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClassTurmaType("numeros");
                      setClassTurmaValue(null);
                    }}
                    className={`py-2 text-[10px] font-black uppercase rounded-lg tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      classTurmaType === "numeros"
                        ? "bg-white text-[#543D30] shadow-xs border border-[#EADCD3]/40"
                        : "text-[#8C7A6B] hover:text-[#543D30]"
                    }`}
                  >
                    <span>#</span> Números (1-20)
                  </button>
                </div>

                {/* Grid values */}
                <div className="max-h-[140px] overflow-y-auto border border-gray-150 rounded-xl bg-white p-2">
                  <div className="grid grid-cols-7 gap-1.5">
                    {(() => {
                      const items = classTurmaType === "letras"
                        ? ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"]
                        : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];

                      return items.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setClassTurmaValue(classTurmaValue === val ? null : val)}
                          className={`h-9 w-full text-xs font-black rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                            classTurmaValue === val
                              ? "bg-[#FAF6F0] text-[#543D30] border-[#543D30] ring-1 ring-[#543D30]"
                              : "bg-white text-gray-600 border-gray-150 hover:bg-[#FAF6F0]"
                          }`}
                        >
                          {val}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* NOME FINAL DA TURMA */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 text-[#8C7A6B]" />
                  Nome Final da Turma
                </label>
                <input
                  type="text"
                  placeholder="Selecione o nível, ano e turma para gerar..."
                  value={newClassName}
                  onChange={(e) => {
                    setNewClassName(e.target.value);
                    setIsNameManualOverride(true);
                  }}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm focus:outline-none font-bold"
                  required
                />
                {isNameManualOverride && (
                  <div className="text-right">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsNameManualOverride(false);
                      }} 
                      className="text-[10px] text-[#543D30] underline font-bold"
                    >
                      Restaurar nome automático
                    </button>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseAddClass}
                  className="flex-1 py-3 border border-[#EADCD3] text-[#8C7A6B] font-bold text-xs rounded-xl hover:bg-[#FCFAF7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newClassName.trim()}
                  className="flex-1 py-3 bg-[#543D30] hover:bg-[#402D23] disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Criar Turma
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Aluno */}
      {isAddingStudent && (
        <div className="fixed inset-0 bg-[#4A3728]/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-[#EADCD3] max-w-md w-full p-6 shadow-xl text-left">
            <h3 className="text-lg font-black text-[#4A3728] mb-4">Adicionar Aluno</h3>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  placeholder="Ex: DIEGO REIS FERREIRA"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm focus:outline-none font-bold uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                  Código de Matrícula / Chamada (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 6"
                  value={newStudentReg}
                  onChange={(e) => setNewStudentReg(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingStudent(false)}
                  className="flex-1 py-3 border border-[#EADCD3] text-[#8C7A6B] font-bold text-xs rounded-xl hover:bg-[#FCFAF7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#543D30] hover:bg-[#402D23] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Aluno */}
      {isEditingStudent && (
        <div className="fixed inset-0 bg-[#4A3728]/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-[#EADCD3] max-w-md w-full p-6 shadow-xl text-left">
            <h3 className="text-lg font-black text-[#4A3728] mb-4">Editar Cadastro de Aluno</h3>
            <form onSubmit={handleSaveEditStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  placeholder="Ex: DIEGO REIS FERREIRA"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm focus:outline-none font-bold uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#8C7A6B] uppercase tracking-wider mb-1.5">
                  Número de Chamada / Código *
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5"
                  value={editStudentReg}
                  onChange={(e) => setEditStudentReg(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm focus:outline-none font-bold"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingStudent(null)}
                  className="flex-1 py-3 border border-[#EADCD3] text-[#8C7A6B] font-bold text-xs rounded-xl hover:bg-[#FCFAF7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#543D30] hover:bg-[#402D23] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-3xl border border-[#EADCD3] shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-[#4A3728]">Confirmar Exclusão</h3>
            <p className="text-xs text-[#8C7A6B] leading-relaxed">
              {deleteConfirm.type === "student" ? (
                <>Deseja realmente remover o estudante <strong className="text-[#4A3728]">"{deleteConfirm.name}"</strong>? Toda a ficha de notas dele também será excluída permanentemente.</>
              ) : (
                <>Deseja realmente excluir a turma <strong className="text-[#4A3728]">"{deleteConfirm.name}"</strong>? Todos os alunos e notas vinculados a ela também serão removidos permanentemente.</>
              )}
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
                onClick={handleConfirmDelete}
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
