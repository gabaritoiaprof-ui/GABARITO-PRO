import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { BarChart3, TrendingUp, Award, AlertTriangle, Users, BookOpen, ChevronRight, Check, Trash2, Pencil, X, Sparkles, CheckCircle2, MessageSquare } from "lucide-react";
import { Exam, ExamResult, Student, ClassGroup } from "../types";
import { apiFetch } from "../utils/api";

export default function ReportDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const [selectedExamId, setSelectedExamId] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState("all");

  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  // Editing state
  const [editingResult, setEditingResult] = useState<ExamResult | null>(null);
  const [editStudentId, setEditStudentId] = useState("");
  const [editStudentName, setEditStudentName] = useState("");
  const [editAnswers, setEditAnswers] = useState<Record<number, string>>({});
  const [editFeedback, setEditFeedback] = useState("");
  const [editScore, setEditScore] = useState(0);
  const [editCorrectCount, setEditCorrectCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; studentName: string } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resExams, resResults, resStudents, resClasses] = await Promise.all([
        apiFetch("/api/exams"),
        apiFetch("/api/results"),
        apiFetch("/api/students"),
        apiFetch("/api/classes")
      ]);
      setExams(await resExams.json());
      setResults(await resResults.json());
      setStudents(await resStudents.json());
      setClasses(await resClasses.json());
    } catch (e) {
      console.error("Erro ao carregar dados dos relatórios", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  };

  // Filter results based on chosen filters
  const filteredResults = results.filter((res) => {
    const matchesExam = selectedExamId === "all" || res.examId === selectedExamId;
    const matchesStudent = selectedStudentId === "all" || res.studentId === selectedStudentId;
    return matchesExam && matchesStudent;
  });

  // Calculate General Metrics
  const totalCorrections = filteredResults.length;
  
  const averageGrade = totalCorrections > 0
    ? Number((filteredResults.reduce((acc, curr) => acc + curr.score, 0) / totalCorrections).toFixed(1))
    : 0;

  const maxGrade = totalCorrections > 0
    ? Math.max(...filteredResults.map((r) => r.score))
    : 0;

  const minGrade = totalCorrections > 0
    ? Math.min(...filteredResults.map((r) => r.score))
    : 0;

  // Class Ranking (Ordered by grade descending)
  const rankingData = [...filteredResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10) // Top 10
    .map((r) => ({
      name: r.studentName,
      nota: r.score,
      acertos: r.correctCount
    }));

  // Question Error Analytics
  const getQuestionAnalytics = () => {
    if (selectedExamId === "all") return [];
    const examObj = exams.find((e) => e.id === selectedExamId);
    if (!examObj) return [];

    const totalStudentsInExam = filteredResults.length;
    if (totalStudentsInExam === 0) return [];

    const questionStats = Array.from({ length: examObj.questionsCount }).map((_, idx) => {
      const qNum = idx + 1;
      let corrects = 0;
      let incorrects = 0;

      filteredResults.forEach((res) => {
        const studentAns = res.answers[qNum];
        const correctAns = examObj.answerKey[qNum];
        if (studentAns === correctAns) {
          corrects++;
        } else {
          incorrects++;
        }
      });

      const errorPercentage = Math.round((incorrects / totalStudentsInExam) * 100);

      return {
        question: `Q${qNum.toString().padStart(2, "0")}`,
        "Erros (%)": errorPercentage,
        "Acertos (%)": 100 - errorPercentage,
        erros: incorrects,
        acertos: corrects
      };
    });

    return questionStats;
  };

  const questionData = getQuestionAnalytics();

  // Find the most-missed question
  const mostMissedQuestion = questionData.length > 0
    ? [...questionData].sort((a, b) => b.erros - a.erros)[0]
    : null;

  // Grade Distribution Pie Chart data
  const getGradeDistribution = () => {
    let blue = 0; // >= 7.0 (Excellent/Good)
    let yellow = 0; // >= 5.0 and < 7.0 (Average)
    let red = 0; // < 5.0 (Deficit)

    filteredResults.forEach((r) => {
      if (r.score >= 7.0) blue++;
      else if (r.score >= 5.0) yellow++;
      else red++;
    });

    return [
      { name: "Acima da Média (≥ 7.0)", value: blue, color: "#543D30" }, // Solid deep brown
      { name: "Recuperação (5.0 - 6.9)", value: yellow, color: "#D1A182" }, // Soft brown accent
      { name: "Abaixo da Média (< 5.0)", value: red, color: "#E05A47" } // Soft elegant red
    ];
  };

  const gradeDistribution = getGradeDistribution();

  // Handle Delete Result
  const handleDeleteResultClick = (id: string, studentName: string) => {
    setDeleteConfirm({ isOpen: true, id, studentName });
  };

  const confirmDeleteResult = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      const res = await apiFetch(`/api/results/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setResults(results.filter(r => r.id !== id));
        showMsg("Resultado removido com sucesso.", "success");
      } else {
        showMsg("Erro ao excluir resultado.", "error");
      }
    } catch (e) {
      showMsg("Falha de conexão com o servidor.", "error");
    }
  };

  // Handle Edit Click
  const handleEditResultClick = (res: ExamResult) => {
    setEditingResult(res);
    setEditStudentId(res.studentId || "custom");
    setEditStudentName(res.studentName);
    setEditAnswers({ ...res.answers });
    setEditFeedback(res.feedback || "");
    setEditScore(res.score);
    setEditCorrectCount(res.correctCount);
  };

  // Recalculate Edit score in real-time
  const handleAnswerChange = (qNum: number, value: string) => {
    if (!editingResult) return;
    const exam = exams.find(e => e.id === editingResult.examId);
    if (!exam) return;

    const newAnswers = { ...editAnswers, [qNum]: value };
    setEditAnswers(newAnswers);

    let correct = 0;
    for (let i = 1; i <= exam.questionsCount; i++) {
      const marked = (newAnswers[i] || "").trim().toUpperCase();
      const correctAns = (exam.answerKey[i] || "").trim().toUpperCase();
      if (marked === correctAns && correctAns !== "") {
        correct++;
      }
    }

    const calculatedScore = Number((correct * exam.questionValue).toFixed(2));
    setEditCorrectCount(correct);
    setEditScore(calculatedScore);
  };

  const handleSaveResultEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResult) return;

    let finalName = editStudentName;
    if (editStudentId !== "custom") {
      const matchStd = students.find(s => s.id === editStudentId);
      if (matchStd) finalName = matchStd.name;
    }

    try {
      const res = await apiFetch(`/api/results/${editingResult.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: finalName,
          studentId: editStudentId === "custom" ? null : editStudentId,
          answers: editAnswers,
          feedback: editFeedback,
          score: editScore
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(results.map(r => r.id === editingResult.id ? data.result : r));
        setEditingResult(null);
        showMsg("Boletim de notas atualizado com sucesso!", "success");
      } else {
        showMsg("Erro ao salvar alterações no servidor.", "error");
      }
    } catch (e) {
      showMsg("Falha de conexão com o servidor.", "error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-left space-y-8">
      
      {/* Banner de status */}
      {msg.text && (
        <div className={`p-4 rounded-2xl text-sm font-bold shadow-xs border text-left ${msg.type === "success" ? "bg-[#EAF7EC] text-[#1E7D34] border-[#D1F2D9]" : "bg-[#FDF2F2] text-[#9B1C1C] border-[#FDE8E8]"}`}>
          {msg.text}
        </div>
      )}

      {/* Filters Area */}
      <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider mb-2">
            Filtrar por Gabarito
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => {
              setSelectedExamId(e.target.value);
              setSelectedStudentId("all"); // Reset student filter
            }}
            className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-none"
          >
            <option value="all">Todos os Gabaritos</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider mb-2">
            Filtrar por Estudante
          </label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-none"
          >
            <option value="all">Todos os Estudantes</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-24 text-[#8C7A6B] text-sm font-medium animate-pulse">
          Carregando relatórios estatísticos...
        </div>
      ) : totalCorrections === 0 ? (
        <div className="text-center py-16 bg-white border border-[#EADCD3] rounded-3xl text-[#8C7A6B] shadow-xs">
          <BarChart3 className="w-12 h-12 text-[#A08E7F] mx-auto mb-4 animate-bounce" />
          <h3 className="font-black text-[#4A3728] text-sm">Nenhum dado para exibir</h3>
          <p className="text-xs text-[#8C7A6B] max-w-xs mx-auto leading-relaxed mt-1">
            Por favor, realize correções de gabaritos para alimentar as tabelas e gráficos estatísticos de desempenho.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FAF6F0] text-[#543D30] rounded-2xl flex items-center justify-center border border-[#F0E6DF]">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider">Correções</span>
                <span className="text-xl font-black text-[#4A3728]">{totalCorrections}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-[#EFF6FF] text-[#3B82F6] rounded-2xl flex items-center justify-center border border-[#DBEAFE]">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider">Média Geral</span>
                <span className="text-xl font-black text-[#3B82F6]">{averageGrade.toFixed(1)}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-[#EAF7EC] text-[#22C55E] rounded-2xl flex items-center justify-center border border-[#D1F2D9]">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider">Maior Nota</span>
                <span className="text-xl font-black text-[#22C55E]">{maxGrade.toFixed(1)}</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#EADCD3] shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FDF2F2] text-red-600 rounded-2xl flex items-center justify-center border border-[#FDE8E8]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-[#8C7A6B] uppercase tracking-wider">Menor Nota</span>
                <span className="text-xl font-black text-red-600">{minGrade.toFixed(1)}</span>
              </div>
            </div>

          </div>

          {/* Core Analytics charts block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Class Ranking Table */}
            <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] lg:col-span-5 shadow-xs">
              <h3 className="text-sm font-black text-[#4A3728] uppercase tracking-wider mb-5 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" /> Ranking de Alunos
              </h3>
              <div className="space-y-2.5">
                {rankingData.map((student, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-[#FCFAF7] hover:bg-[#FAF6F0] rounded-2xl border border-[#EADCD3] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? "bg-amber-100 text-amber-800" : idx === 1 ? "bg-slate-200 text-slate-800" : idx === 2 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"}`}>
                        {idx + 1}
                      </span>
                      <span className="font-extrabold text-xs text-[#4A3728] truncate max-w-[150px] uppercase">{student.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xs text-[#543D30] mr-2">{student.nota.toFixed(1)}</span>
                      <span className="text-[10px] text-[#8C7A6B]">({student.acertos} acertos)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recharts Grades Distribution Pie */}
            <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] lg:col-span-7 shadow-xs">
              <h3 className="text-sm font-black text-[#4A3728] uppercase tracking-wider mb-5 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#543D30]" /> Distribuição de Notas
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-6 justify-center h-[260px]">
                <div className="w-[180px] h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gradeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {gradeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 text-xs">
                  {gradeDistribution.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2.5 font-bold">
                      <span className="w-3.5 h-3.5 rounded-md" style={{ backgroundColor: entry.color }} />
                      <span className="text-[#8C7A6B]">{entry.name}:</span>
                      <span className="text-[#4A3728]">{entry.value} aluno(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Question Analytics block */}
          {selectedExamId !== "all" && questionData.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-[#4A3728] uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#543D30]" /> Estatísticas de Erro por Questão
                  </h3>
                  <p className="text-xs text-[#8C7A6B] mt-0.5 font-semibold">
                    Análise refinada das questões críticas que necessitam de revisão.
                  </p>
                </div>

                {mostMissedQuestion && (
                  <div className="p-3 bg-[#FDF2F2] border border-[#FDE8E8] rounded-2xl flex items-center gap-2 text-xs text-red-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      Questão Crítica: <strong className="text-red-700">{mostMissedQuestion.question}</strong> ({mostMissedQuestion["Erros (%)"]}% erros)
                    </span>
                  </div>
                )}
              </div>

              {/* Bar Chart of Errors */}
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={questionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EADCD3" />
                    <XAxis dataKey="question" stroke="#8C7A6B" fontSize={11} />
                    <YAxis unit="%" stroke="#8C7A6B" fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Erros (%)" fill="#E05A47" radius={[4, 4, 0, 0]} name="Erros %" />
                    <Bar dataKey="Acertos (%)" fill="#543D30" radius={[4, 4, 0, 0]} name="Acertos %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}

          {/* HISTÓRICO DE CORREÇÕES EDITÁVEIS - "RESULTADOS EDITÁVEIS E EXCLUSÃO" */}
          <div className="bg-white p-6 rounded-3xl border border-[#EADCD3] shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-black text-[#4A3728] uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#543D30]" /> Histórico Geral de Gabaritos Corrigidos
              </h3>
              <p className="text-xs text-[#8C7A6B] mt-0.5 font-semibold">
                Lista de todos os gabaritos processados. Clique em Editar para alterar notas, respostas identificadas ou deletar.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#FAF6F0]">
                    <th className="py-3 text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider">Estudante</th>
                    <th className="py-3 text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider">Gabarito / Avaliação</th>
                    <th className="py-3 text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider text-center">Acertos</th>
                    <th className="py-3 text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider text-center">Nota</th>
                    <th className="py-3 text-[10px] font-black text-[#8C7A6B] uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#FAF6F0] text-xs font-bold text-[#4A3728]">
                  {filteredResults.map((res) => {
                    const exam = exams.find(e => e.id === res.examId);
                    return (
                      <tr key={res.id} className="hover:bg-[#FCFAF7] transition-colors group">
                        <td className="py-3.5 uppercase">{res.studentName}</td>
                        <td className="py-3.5 text-[#8C7A6B]">{exam ? exam.name : "Prova Removida"}</td>
                        <td className="py-3.5 text-center text-emerald-600">{res.correctCount} / {exam?.questionsCount || 10}</td>
                        <td className="py-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-lg ${res.score >= 7.0 ? "bg-[#EAF7EC] text-emerald-800" : res.score >= 5.0 ? "bg-[#FFFBEB] text-amber-800" : "bg-[#FDF2F2] text-red-800"}`}>
                            {res.score.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEditResultClick(res)}
                              className="p-1.5 hover:bg-[#FAF6F0] text-[#8C7A6B] hover:text-[#543D30] rounded-lg transition-colors cursor-pointer"
                              title="Editar notas e respostas"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteResultClick(res.id, res.studentName)}
                              className="p-1.5 hover:bg-red-50 text-[#8C7A6B] hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Remover cartão de notas"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: EDITAR RESULTADO COMPLETO (EDITA TUDO!) */}
      {editingResult && (
        <div className="fixed inset-0 bg-[#4A3728]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#EADCD3] max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-left my-8">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF6F0] text-[#543D30] border border-[#EADCD3] rounded-lg text-[10px] font-black uppercase">
                  Editor de Cartões de Gabaritos
                </span>
                <h3 className="text-xl font-black text-[#4A3728] mt-2.5">Editar Respostas e Notas</h3>
                <p className="text-xs text-[#8C7A6B] mt-0.5 font-semibold">
                  Ajuste o estudante associado, altere as alternativas identificadas e reescreva o feedback pedagógico da IA.
                </p>
              </div>
              <button 
                onClick={() => setEditingResult(null)}
                className="p-1.5 hover:bg-[#FAF6F0] text-[#8C7A6B] hover:text-[#4A3728] rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResultEdit} className="space-y-6">
              
              {/* Row 1: Student select link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider mb-2">
                    Vincular ao Estudante
                  </label>
                  <select
                    value={editStudentId}
                    onChange={(e) => {
                      setEditStudentId(e.target.value);
                      if (e.target.value === "custom") {
                        setEditStudentName("");
                      } else {
                        const s = students.find(x => x.id === e.target.value);
                        if (s) setEditStudentName(s.name);
                      }
                    }}
                    className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-xs font-bold text-[#4A3728] focus:outline-none"
                  >
                    <option value="custom">-- Aluno Avulso (Não Cadastrado) --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider mb-2">
                    Nome Manual do Estudante
                  </label>
                  <input
                    type="text"
                    value={editStudentName}
                    onChange={(e) => setEditStudentName(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-xs font-bold text-[#4A3728] uppercase focus:outline-none"
                    disabled={editStudentId !== "custom"}
                    required
                  />
                </div>
              </div>

              {/* Dynamic Score and Correction metrics in modal header */}
              <div className="grid grid-cols-3 gap-2 p-4 bg-[#FAF6F0] rounded-2xl border border-[#EADCD3] text-center">
                <div>
                  <span className="block text-[9px] font-bold text-[#8C7A6B] uppercase">Nota Recalculada</span>
                  <span className="text-base font-black text-[#543D30]">{editScore.toFixed(1)}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#8C7A6B] uppercase">Acertos</span>
                  <span className="text-base font-black text-emerald-600">{editCorrectCount}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#8C7A6B] uppercase">Gabarito Oficial</span>
                  <span className="text-[10px] font-bold text-[#8C7A6B] mt-1 block leading-tight">Valor por Questão: {exams.find(e => e.id === editingResult.examId)?.questionValue || 1} pt</span>
                </div>
              </div>

              {/* Grid: Interactive Answers Bubble Matrix */}
              <div>
                <h4 className="text-xs font-black text-[#8C7A6B] uppercase tracking-wider mb-3">Grade de Respostas (Gabarito Analisado)</h4>
                
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto border border-[#EADCD3] rounded-2xl p-3 bg-[#FCFAF7]">
                  {Array.from({ length: exams.find(e => e.id === editingResult.examId)?.questionsCount || 10 }).map((_, idx) => {
                    const qNum = idx + 1;
                    const marked = editAnswers[qNum] || "";
                    const correctAns = exams.find(e => e.id === editingResult.examId)?.answerKey[qNum] || "";
                    const options = ["A", "B", "C", "D", "E", ""];

                    return (
                      <div key={qNum} className="flex items-center justify-between py-1.5 border-b border-[#FAF6F0] last:border-0">
                        <span className="text-xs font-black text-[#543D30] w-10">Q{qNum.toString().padStart(2, "0")}</span>
                        
                        {/* Horizontal Selection Bubble Row */}
                        <div className="flex gap-1">
                          {options.map((opt) => {
                            const isSelected = marked === opt;
                            const isCorrectOpt = opt === correctAns;
                            
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleAnswerChange(qNum, opt)}
                                className={`w-8 h-8 rounded-full font-black text-xs border cursor-pointer transition-all ${isSelected ? "bg-[#543D30] text-white border-[#543D30]" : isCorrectOpt ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-[#EADCD3] text-[#8C7A6B] hover:bg-[#FAF6F0]"}`}
                                title={opt === "" ? "Branco / Anulado" : `Alternativa ${opt}`}
                              >
                                {opt === "" ? "—" : opt}
                              </button>
                            );
                          })}
                        </div>

                        {/* indicator */}
                        <span className="text-[10px] font-extrabold text-emerald-600">Gabarito: {correctAns}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feedback text box */}
              <div>
                <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[#543D30]" /> Dica Pedagógica / Recomendação de Estudo
                </label>
                <textarea
                  rows={3}
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-xs focus:outline-none font-semibold text-[#4A3728] leading-relaxed"
                  placeholder="Escreva orientações de estudos dirigidas a este aluno..."
                />
              </div>

              {/* Actions Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingResult(null)}
                  className="flex-1 py-3 border border-[#EADCD3] text-[#8C7A6B] font-bold text-xs rounded-xl hover:bg-[#FCFAF7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#543D30] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Salvar Alterações
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-md w-full rounded-3xl border border-[#EADCD3] shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-black text-lg text-[#4A3728]">Confirmar Exclusão</h3>
            <p className="text-xs text-[#8C7A6B] leading-relaxed">
              Deseja realmente excluir o cartão de resultado de <strong className="text-[#4A3728]">"{deleteConfirm.studentName}"</strong> permanentemente? Esta ação não poderá ser desfeita.
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
                onClick={confirmDeleteResult}
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
