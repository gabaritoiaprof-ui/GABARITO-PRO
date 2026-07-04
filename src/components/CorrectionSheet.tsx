import React, { useState, useEffect } from "react";
import { 
  Award, CheckCircle2, AlertCircle, Users, FileText, 
  RefreshCw, GraduationCap, Search, Trash2, Calendar,
  Plus, Check
} from "lucide-react";
import { Exam, ClassGroup, Student, ExamResult } from "../types";
import { apiFetch } from "../utils/api";

interface CorrectionSheetProps {
  onGoToSettings?: () => void;
}

export default function CorrectionSheet({ onGoToSettings }: CorrectionSheetProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);

  // Selected filters
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  // Quick batch grading state
  const [batchScore, setBatchScore] = useState("");
  const [batchFeedback, setBatchFeedback] = useState("");
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Alert message
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Quick Add Student states
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentReg, setNewStudentReg] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Individual student grading states
  const [editingScores, setEditingScores] = useState<{ [studentId: string]: string }>({});
  const [savingScores, setSavingScores] = useState<{ [studentId: string]: boolean }>({});

  const fetchData = async () => {
    try {
      const [resExams, resClasses, resStudents, resResults] = await Promise.all([
        apiFetch("/api/exams"),
        apiFetch("/api/classes"),
        apiFetch("/api/students"),
        apiFetch("/api/results")
      ]);
      
      const dataExams = await resExams.json();
      const dataClasses = await resClasses.json();
      const dataStudents = await resStudents.json();
      const dataResults = await resResults.json();

      setExams(dataExams);
      setClasses(dataClasses);
      setStudents(dataStudents);
      setResults(dataResults);

      if (dataExams.length > 0 && !selectedExamId) {
        setSelectedExamId(dataExams[0].id);
      }
      if (dataClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(dataClasses[0].id);
      }
    } catch (e) {
      console.error("Erro ao carregar dados para correção:", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Find active records
  const currentExam = exams.find(e => e.id === selectedExamId);
  const currentClass = classes.find(c => c.id === selectedClassId);

  // Get maximum possible score for the exam
  const maxScore = currentExam 
    ? Number((currentExam.questionsCount * currentExam.questionValue).toFixed(1)) 
    : 10;

  // Filter students by class and search query
  const classStudents = students.filter(s => s.classId === selectedClassId);
  const filteredStudents = classStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.registration.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find result for a specific student and active exam
  const getStudentResult = (studentId: string) => {
    return results.find(r => r.examId === selectedExamId && r.studentId === studentId);
  };

  const handleApplyBatchGrade = async () => {
    if (!selectedExamId || !selectedClassId) {
      setAlertMsg({ text: "Selecione um gabarito e uma turma antes de prosseguir.", type: "error" });
      return;
    }

    const scoreNum = parseFloat(batchScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      setAlertMsg({ text: `Por favor, digite uma nota válida entre 0 e ${maxScore}.`, type: "error" });
      return;
    }

    setIsSavingBatch(true);
    setAlertMsg(null);

    try {
      const response = await apiFetch("/api/results/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExamId,
          classId: selectedClassId,
          score: scoreNum,
          feedback: batchFeedback
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setAlertMsg({ 
          text: `Nota ${scoreNum.toFixed(1)} aplicada com sucesso para todos os ${data.count} alunos da turma!`, 
          type: "success" 
        });
        setBatchScore("");
        setBatchFeedback("");
        await fetchData();
      } else {
        setAlertMsg({ text: data.error || "Erro ao salvar notas em lote.", type: "error" });
      }
    } catch (err) {
      setAlertMsg({ text: "Falha de conexão com o servidor ao aplicar notas.", type: "error" });
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleDeleteResult = async (resultId: string) => {
    if (!confirm("Tem certeza que deseja remover esta nota?")) return;
    try {
      const response = await apiFetch(`/api/results/${resultId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        await fetchData();
        setAlertMsg({ text: "Nota removida com sucesso.", type: "success" });
      } else {
        setAlertMsg({ text: "Erro ao remover nota.", type: "error" });
      }
    } catch (err) {
      setAlertMsg({ text: "Falha de conexão ao remover nota.", type: "error" });
    }
  };

  const handleScoreChange = (studentId: string, value: string) => {
    setEditingScores(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  const handleQuickAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      setAlertMsg({ text: "Selecione uma turma antes de cadastrar o aluno.", type: "error" });
      return;
    }
    if (!newStudentName.trim()) return;

    setIsAddingStudent(true);
    setAlertMsg(null);

    try {
      const response = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStudentName.trim().toUpperCase(),
          registration: newStudentReg.trim() || `MAT-${Math.floor(10000 + Math.random() * 90000)}`,
          classId: selectedClassId
        })
      });

      if (response.ok) {
        const addedStudent = await response.json();
        setAlertMsg({ text: `Aluno "${addedStudent.name}" cadastrado com sucesso nesta turma!`, type: "success" });
        setNewStudentName("");
        setNewStudentReg("");
        await fetchData();
      } else {
        const errorData = await response.json();
        setAlertMsg({ text: errorData.error || "Erro ao cadastrar aluno.", type: "error" });
      }
    } catch (err) {
      setAlertMsg({ text: "Erro ao conectar com o servidor.", type: "error" });
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleSaveIndividualScore = async (student: Student, existingResultId?: string) => {
    const scoreStr = editingScores[student.id];
    if (scoreStr === undefined) return; // No changes to save

    const scoreNum = parseFloat(scoreStr);
    if (scoreStr.trim() === "") {
      setAlertMsg({ text: "Por favor, digite uma nota válida ou exclua a nota atual.", type: "error" });
      return;
    }

    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      setAlertMsg({ text: `Por favor, digite uma nota válida entre 0 e ${maxScore}.`, type: "error" });
      return;
    }

    setSavingScores(prev => ({ ...prev, [student.id]: true }));
    setAlertMsg(null);

    try {
      let response;
      if (existingResultId) {
        response = await apiFetch(`/api/results/${existingResultId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score: scoreNum
          })
        });
      } else {
        response = await apiFetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId: selectedExamId,
            studentId: student.id,
            studentName: student.name,
            score: scoreNum,
            correctCount: 0,
            incorrectCount: 0,
            answers: {},
            feedback: "Nota lançada manualmente no gabarito."
          })
        });
      }

      if (response.ok) {
        setAlertMsg({ text: `Nota de ${student.name} salva com sucesso!`, type: "success" });
        setEditingScores(prev => {
          const next = { ...prev };
          delete next[student.id];
          return next;
        });
        await fetchData();
      } else {
        const errorData = await response.json();
        setAlertMsg({ text: errorData.error || "Erro ao salvar nota.", type: "error" });
      }
    } catch (err) {
      setAlertMsg({ text: "Erro ao conectar com o servidor.", type: "error" });
    } finally {
      setSavingScores(prev => ({ ...prev, [student.id]: false }));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8 text-left">
        <h1 className="text-3xl font-black text-[#4A3728] tracking-tight uppercase">Corrigir com Gabarito</h1>
        <p className="text-sm text-[#8C7A6B] font-semibold mt-1">
          Lançamento rápido e coletivo de notas utilizando gabarito oficial do sistema
        </p>
      </div>

      {/* Alert Notification */}
      {alertMsg && (
        <div className={`p-4 mb-6 rounded-2xl text-xs font-bold border text-left flex items-start gap-3 shadow-xs ${
          alertMsg.type === "success" 
            ? "bg-[#EAF7EC] text-[#1E7D34] border-[#D1F2D9]" 
            : "bg-[#FDF2F2] text-[#9B1C1C] border-[#FDE8E8]"
        }`}>
          {alertMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          )}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        
        {/* Left Column: Batch Configuration & Grade Input (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs space-y-5">
            <h3 className="font-black text-sm text-[#543D30] uppercase tracking-wider border-b border-[#FAF6F0] pb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#D1A182]" /> Configuração de Lançamento
            </h3>

            {/* Selector: GABARITO DE REFERÊNCIA */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                Gabarito de Referência
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => {
                  setSelectedExamId(e.target.value);
                  setAlertMsg(null);
                }}
                className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-hidden"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.questionsCount} questões • Peso {ex.questionValue})
                  </option>
                ))}
                {exams.length === 0 && (
                  <option value="">Nenhum gabarito disponível</option>
                )}
              </select>
            </div>

            {/* Selector: SALA DE AULA */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                Sala de Aula / Turma
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setAlertMsg(null);
                }}
                className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-hidden"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
                {classes.length === 0 && (
                  <option value="">Nenhuma turma disponível</option>
                )}
              </select>
            </div>

            {/* Batch Info Ticket Card */}
            {currentExam && currentClass && (
              <div className="p-4 bg-[#FAF6F0] rounded-2xl border border-[#EADCD3] space-y-2">
                <p className="text-xs font-black text-[#543D30] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#D1A182]" /> Selecionar Aluno
                </p>
                <p className="text-[11px] text-[#8C7A6B] leading-relaxed font-semibold">
                  Esta ação aplicará a nota inserida para os <strong>{classStudents.length} alunos</strong> cadastrados na turma <strong>{currentClass.name}</strong> para a avaliação <strong>{currentExam.name}</strong>.
                </p>
                <div className="text-[10px] text-amber-700 bg-amber-50/40 p-2 rounded-xl border border-amber-100 font-bold leading-normal">
                  ⚠️ Importante: Lançamentos rápidos anteriores para este mesmo grupo serão atualizados automaticamente com a nova nota inserida abaixo.
                </div>
              </div>
            )}

            {/* Input: DIGITAR NOTA */}
            {currentExam && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                    Nota a Ser Aplicada
                  </label>
                  <span className="text-[10px] font-mono font-black text-[#8C7A6B] uppercase">
                    Variação: 0.0 - {maxScore.toFixed(1)}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={maxScore}
                  value={batchScore}
                  onChange={(e) => setBatchScore(e.target.value)}
                  placeholder={`Ex: ${maxScore.toFixed(1)}`}
                  className="w-full px-4 py-3.5 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-base font-black text-[#4A3728] focus:outline-hidden placeholder:text-gray-400 font-mono"
                />
              </div>
            )}

            {/* Textarea: FEEDBACK GERAL PEDAGÓGICO */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                Dica ou Comentário Pedagógico Geral (Opcional)
              </label>
              <textarea
                value={batchFeedback}
                onChange={(e) => setBatchFeedback(e.target.value)}
                placeholder="Ex: Excelente nota de toda a turma! Continuem dedicados aos exercícios de interpretação e fixação."
                className="w-full p-4 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-xs font-semibold text-[#4A3728] focus:outline-hidden min-h-[90px] resize-none leading-relaxed"
              />
            </div>

            {/* Action Submit Button */}
            <button
              type="button"
              disabled={isSavingBatch || classStudents.length === 0 || !selectedExamId}
              onClick={handleApplyBatchGrade}
              className="w-full py-4 bg-[#543D30] hover:bg-[#3E2B21] disabled:bg-[#8C7A6B] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 duration-150"
            >
              {isSavingBatch ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Aplicando Notas em Lote...
                </>
              ) : (
                <>
                  <Award className="w-4 h-4 text-[#D1A182]" /> Aplicar Nota para Todos os Alunos
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Students & Current Grades List (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-[#FAF6F0] pb-3 mb-4">
              <h3 className="font-black text-sm text-[#543D30] uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-5 h-5 text-[#8C7A6B]" /> Notas Atuais da Sala
              </h3>
              <span className="text-[10px] font-black text-[#8C7A6B] bg-[#FAF6F0] border border-[#EADCD3] px-2 py-0.5 rounded-lg">
                {classStudents.length} alunos
              </span>
            </div>

            {/* Quick Add Student Form */}
            {selectedClassId ? (
              <div className="bg-[#FAF6F0]/70 p-3.5 rounded-2xl border border-[#EADCD3] mb-4 space-y-2 text-left">
                <p className="text-[10px] font-black text-[#543D30] uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 stroke-[3] text-[#D1A182]" /> Cadastrar Aluno nesta Turma
                </p>
                <form onSubmit={handleQuickAddStudent} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome do Aluno"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#EADCD3] rounded-xl text-[#4A3728] font-bold focus:outline-hidden focus:border-[#543D30]"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Matrícula"
                    value={newStudentReg}
                    onChange={(e) => setNewStudentReg(e.target.value)}
                    className="w-24 px-3 py-2 text-xs bg-white border border-[#EADCD3] rounded-xl text-[#4A3728] font-mono focus:outline-hidden focus:border-[#543D30]"
                  />
                  <button
                    type="submit"
                    disabled={isAddingStudent}
                    className="px-3.5 py-2 bg-[#543D30] hover:bg-[#3E2B21] disabled:bg-[#8C7A6B] text-white text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all shrink-0 flex items-center gap-1"
                  >
                    {isAddingStudent ? "..." : "Adicionar"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-xl border border-amber-200 mb-4 text-center">
                ⚠️ Selecione uma turma para habilitar o cadastro rápido de alunos.
              </div>
            )}

            {/* Search Input for Student Name */}
            <div className="relative mb-4">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-[#8C7A6B]" />
              </span>
              <input
                type="text"
                placeholder="Pesquisar aluno na lista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#FCFAF7] border border-[#EADCD3] rounded-xl text-[#543D30] font-semibold focus:outline-hidden focus:border-[#543D30] transition-colors"
              />
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[420px] pr-1.5">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-[#8C7A6B] text-xs font-bold bg-[#FCFAF7] rounded-2xl border border-dashed border-[#EADCD3]">
                  Nenhum aluno encontrado nesta sala.
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const studentResult = getStudentResult(student.id);
                  const hasGrade = studentResult !== undefined;
                  const score = hasGrade ? studentResult.score : null;

                  return (
                    <div 
                      key={student.id} 
                      className="p-3 bg-[#FCFAF7] border border-[#EADCD3] rounded-2xl flex items-center justify-between gap-3 transition-colors hover:bg-[#FAF6F0]/50"
                    >
                      <div className="text-left min-w-0 flex-1">
                        <p className="font-extrabold text-xs text-[#4A3728] uppercase truncate leading-tight">
                          {student.name}
                        </p>
                        <p className="text-[9px] text-[#8C7A6B] font-mono font-bold mt-0.5 uppercase tracking-wide">
                          Nº Matrícula: {student.registration}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={maxScore}
                            placeholder="Nota"
                            value={editingScores[student.id] !== undefined ? editingScores[student.id] : (score !== null ? score.toString() : "")}
                            onChange={(e) => handleScoreChange(student.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveIndividualScore(student, studentResult?.id);
                              }
                            }}
                            className="w-14 px-1.5 py-1 text-xs text-center font-bold font-mono bg-white border border-[#EADCD3] rounded-lg text-[#4A3728] focus:border-[#543D30] focus:outline-hidden"
                            title={`Digite a nota do aluno (0 - ${maxScore})`}
                          />
                          <button
                            onClick={() => handleSaveIndividualScore(student, studentResult?.id)}
                            disabled={savingScores[student.id] || editingScores[student.id] === undefined}
                            className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
                              editingScores[student.id] !== undefined && editingScores[student.id] !== (score !== null ? score.toString() : "")
                                ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white"
                                : "bg-[#FAF6F0] hover:bg-[#EADCD3] border-[#EADCD3] text-[#543D30] disabled:opacity-50"
                            }`}
                            title="Salvar nota individual"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>

                        {hasGrade && (
                          <button
                            onClick={() => handleDeleteResult(studentResult.id)}
                            className="p-1.5 hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                            title="Remover nota do aluno"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
