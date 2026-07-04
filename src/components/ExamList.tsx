import React, { useState, useEffect } from "react";
import { 
  Target, CheckCircle2, ArrowLeft, RefreshCw, Award
} from "lucide-react";
import { Exam, ClassGroup } from "../types";
import { apiFetch } from "../utils/api";

interface ExamListProps {
  onNavigate?: (tab: string) => void;
}

export default function ExamList({ onNavigate }: ExamListProps) {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [gabaritoStep, setGabaritoStep] = useState<"config" | "fill">("config");

  // Form & Quick Answer Key state
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [numQuestions, setNumQuestions] = useState(20);
  const [defaultWeight, setDefaultWeight] = useState(0.5);
  
  // Answer key values and individual score weights (pt)
  const [answerKey, setAnswerKey] = useState<Record<number, string>>({});
  const [questionWeights, setQuestionWeights] = useState<Record<number, number>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resClasses = await apiFetch("/api/classes");
      if (resClasses.ok) {
        const dataClasses = await resClasses.json();
        setClasses(dataClasses);
        if (dataClasses.length > 0) {
          setSelectedClassId(dataClasses[0].id);
        }
      }
    } catch (e) {
      showMsg("Erro ao carregar turmas.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dynamically calculate a default weight when question count changes (aiming to sum close to 10 points)
  useEffect(() => {
    const recommended = Number((10 / numQuestions).toFixed(1));
    // If not finite or zero/negative, default to 0.5
    setDefaultWeight(isFinite(recommended) && recommended > 0 ? recommended : 0.5);
  }, [numQuestions]);

  // Synchronize weights when numQuestions or defaultWeight changes
  useEffect(() => {
    const weights: Record<number, number> = {};
    for (let i = 1; i <= numQuestions; i++) {
      weights[i] = defaultWeight;
    }
    setQuestionWeights(weights);
  }, [numQuestions, defaultWeight]);

  // Synchronize answer key when numQuestions changes (preserves existing selected choices)
  useEffect(() => {
    setAnswerKey(prev => {
      const keys: Record<number, string> = {};
      for (let i = 1; i <= numQuestions; i++) {
        keys[i] = prev[i] || "";
      }
      return keys;
    });
  }, [numQuestions]);

  const showMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 4000);
  };

  const handleSelectOption = (qNum: number, option: string) => {
    setAnswerKey(prev => ({
      ...prev,
      [qNum]: prev[qNum] === option ? "" : option // toggle
    }));
  };

  const handleWeightChange = (qNum: number, val: number) => {
    setQuestionWeights(prev => ({
      ...prev,
      [qNum]: Math.max(0.1, val)
    }));
  };

  // Counting filled questions
  const filledCount = Object.values(answerKey).filter(v => v !== "").length;
  const isFormComplete = filledCount === numQuestions && examName.trim() !== "";

  const handleCreateExam = async () => {
    if (!examName.trim()) {
      showMsg("Por favor, digite o nome do gabarito.", "error");
      return;
    }

    setIsLoading(true);
    try {
      // Compute correct average value representing question weight
      const totalPoints = (Object.values(questionWeights) as number[]).reduce((a, b) => a + b, 0);
      const avgValue = Number((totalPoints / numQuestions).toFixed(2));

      const res = await apiFetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: examName,
          subject: subject || "Geral",
          classId: selectedClassId || "class-1",
          questionsCount: numQuestions,
          questionValue: avgValue,
          answerKey: answerKey
        })
      });

      if (res.ok) {
        showMsg(`Gabarito "${examName}" criado com sucesso! Redirecionando para o painel...`, "success");
        setTimeout(() => {
          if (onNavigate) {
            onNavigate("painel");
          }
        }, 1500);
      } else {
        showMsg("Erro ao criar gabarito no servidor.", "error");
      }
    } catch (e) {
      showMsg("Erro ao conectar com o servidor.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page Title */}
      <div className="mb-8 text-left">
        <h1 className="text-3xl font-black text-[#4A3728] tracking-tight uppercase">Gabarito Rápido</h1>
        <p className="text-sm text-[#8C7A6B] font-semibold mt-1">
          Crie novos gabaritos de provas oficiais instantaneamente preenchendo as chaves de respostas
        </p>
      </div>

      {/* Alert banner */}
      {msg.text && (
        <div className={`p-4 mb-6 rounded-2xl text-xs font-bold border text-left ${
          msg.type === "success" 
            ? "bg-[#EAF7EC] text-[#1E7D34] border-[#D1F2D9]" 
            : "bg-[#FDF2F2] text-[#9B1C1C] border-[#FDE8E8]"
        }`}>
          {msg.text}
        </div>
      )}

      {/* CONFIGURATION STEP */}
      {gabaritoStep === "config" && (
        <div className="max-w-xl mx-auto text-left">
          <div className="bg-white p-8 rounded-3xl border border-[#EADCD3] shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-black text-[#4A3728] uppercase tracking-wider flex items-center gap-2">
                <Target className="w-5 h-5 text-[#D1A182]" /> Dados do Gabarito
              </h3>
              <p className="text-xs text-[#8C7A6B] mt-1 font-semibold">
                Informe o título, matéria e quantidade de questões para configurar a chave de respostas.
              </p>
            </div>

            <div className="space-y-4">
              {/* Título do Gabarito */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                  Título do Gabarito
                </label>
                <input
                  type="text"
                  placeholder="Ex: Simulado Mensal de História"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-hidden"
                />
              </div>

              {/* Matéria */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                  Matéria / Assunto
                </label>
                <input
                  type="text"
                  placeholder="Ex: História, Geografia..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-hidden"
                />
              </div>

              {/* Turma Aplicada */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                  Vincular à Turma
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-hidden"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Número de Questões Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                  Número de Questões ({numQuestions})
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNumQuestions(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 bg-white border border-[#EADCD3] hover:bg-[#FAF6F0] text-[#543D30] rounded-xl flex items-center justify-center font-black text-lg cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <div className="w-16 h-10 bg-[#FCFAF7] border border-[#EADCD3] rounded-xl flex items-center justify-center font-black text-[#4A3728]">
                    {numQuestions}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNumQuestions(prev => Math.min(100, prev + 1))}
                    className="w-10 h-10 bg-white border border-[#EADCD3] hover:bg-[#FAF6F0] text-[#543D30] rounded-xl flex items-center justify-center font-black text-lg cursor-pointer transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Valor Padrão por Questão */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-[#8C7A6B] uppercase tracking-wider">
                    Valor de cada Questão
                  </label>
                  <span className="text-[10px] font-mono font-black text-[#8C7A6B] uppercase">
                    Padrão: {defaultWeight.toFixed(1)} pt
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10.0"
                  value={defaultWeight}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setDefaultWeight(val);
                    }
                  }}
                  className="w-full px-4 py-3 bg-[#FCFAF7] border border-[#EADCD3] focus:border-[#543D30] rounded-2xl text-sm font-bold text-[#4A3728] focus:outline-hidden font-mono"
                />
                <p className="text-[10px] text-[#8C7A6B] font-semibold">
                  Todas as questões iniciarão com esta nota. Nota total aproximada do gabarito: <strong className="text-[#543D30]">{(numQuestions * defaultWeight).toFixed(1)} pontos</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (onNavigate) onNavigate("painel");
                }}
                className="flex-1 py-3.5 border border-[#EADCD3] hover:bg-[#FCFAF7] text-[#543D30] text-xs font-black uppercase rounded-2xl cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!examName.trim()}
                onClick={() => setGabaritoStep("fill")}
                className={`flex-1 py-3.5 text-xs font-black uppercase rounded-2xl transition-all ${
                  examName.trim()
                    ? "bg-[#543D30] hover:bg-[#3E2B21] text-white cursor-pointer shadow-md"
                    : "bg-[#FAF6F0] text-[#A08E7F] border border-[#EADCD3] cursor-not-allowed"
                }`}
              >
                Avançar &gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUBBLE SELECTION STEP */}
      {gabaritoStep === "fill" && (
        <div className="max-w-xl mx-auto text-left">
          <div className="bg-white rounded-3xl border border-[#EADCD3] shadow-xs overflow-hidden">
            
            {/* Form Top Area */}
            <div className="p-6 border-b border-[#FAF6F0] bg-white space-y-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h3 className="text-base font-black text-[#4A3728] uppercase tracking-wider">Preencher Chave de Respostas</h3>
                </div>
                <p className="text-xs text-[#8C7A6B] mt-1 font-semibold leading-relaxed">
                  Marque as alternativas corretas para {examName} ({numQuestions} questões)
                </p>
              </div>

              {/* Quick default weight control inside the fill step */}
              <div className="p-3 bg-[#FAF6F0] rounded-2xl border border-[#EADCD3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[#543D30]">
                <span className="text-[#8C7A6B] uppercase tracking-wider text-[10px] font-black">Alterar pontuação de TODAS de uma vez:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10.0"
                    value={defaultWeight}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setDefaultWeight(val);
                      }
                    }}
                    className="w-16 px-2.5 py-1 text-center bg-white border border-[#EADCD3] rounded-xl focus:outline-hidden font-mono text-[#4A3728] font-black text-sm"
                  />
                  <span className="text-[#8C7A6B] font-bold">pt cada</span>
                </div>
              </div>
            </div>

            {/* Scrollable Questions list */}
            <div className="max-h-[380px] overflow-y-auto px-6 divide-y divide-[#FAF6F0]">
              {Array.from({ length: numQuestions }).map((_, index) => {
                const qNum = index + 1;
                const selectedOption = answerKey[qNum] || "";
                const currentWeight = questionWeights[qNum] || 1.0;
                
                return (
                  <div key={qNum} className="py-3 flex items-center justify-between gap-4">
                    {/* Number label */}
                    <span className="font-extrabold text-xs text-[#8C7A6B] w-8">
                      Q{qNum.toString().padStart(2, "0")}:
                    </span>

                    {/* Options Row */}
                    <div className="flex items-center gap-1.5 flex-1 justify-center">
                      {["A", "B", "C", "D", "E"].map((opt) => {
                        const isSelected = selectedOption === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSelectOption(qNum, opt)}
                            className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full border text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                              isSelected 
                                ? "bg-[#543D30] text-white border-[#543D30] shadow-xs" 
                                : "bg-white text-[#8C7A6B] border-[#EADCD3] hover:border-[#8C7A6B]"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {/* Score Weight Selector */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        max="10.0"
                        value={currentWeight}
                        onChange={(e) => handleWeightChange(qNum, Number(e.target.value))}
                        className="w-13 px-2 py-1 text-center text-xs font-bold text-[#4A3728] border border-[#EADCD3] rounded-xl focus:outline-hidden bg-[#FCFAF7] font-mono"
                      />
                      <span className="text-[10px] font-black uppercase text-[#8C7A6B]">pt</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Progress Bar & Info */}
            <div className="p-6 bg-white border-t border-[#FAF6F0] space-y-4">
              <div className="flex justify-between items-center text-xs font-bold text-[#8C7A6B]">
                <span>{filledCount} de {numQuestions} alternativas marcadas</span>
                <span>Total: {(Object.values(questionWeights) as number[]).reduce((a, b) => a + b, 0).toFixed(1)} pt</span>
              </div>
              
              {/* Custom colored progress bar */}
              <div className="w-full bg-[#FAF6F0] rounded-full h-2 border border-[#EADCD3]">
                <div 
                  className="bg-[#D1A182] h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(filledCount / numQuestions) * 100}%` }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGabaritoStep("config")}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 border border-[#EADCD3] hover:bg-[#FCFAF7] text-[#543D30] text-xs font-black uppercase rounded-2xl cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateExam}
                  disabled={!isFormComplete || isLoading}
                  className={`flex-1 py-3.5 text-xs font-black uppercase rounded-2xl transition-all shadow-md text-center flex items-center justify-center gap-1.5 ${
                    isFormComplete && !isLoading
                      ? "bg-[#543D30] hover:bg-[#3E2B21] text-white cursor-pointer" 
                      : "bg-[#FAF6F0] text-[#A08E7F] border border-[#EADCD3] cursor-not-allowed shadow-none"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4 text-[#D1A182]" /> Criar Gabarito
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
