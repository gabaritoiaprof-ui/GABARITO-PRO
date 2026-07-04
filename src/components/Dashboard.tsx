import React, { useEffect, useState } from "react";
import { 
  FileText, Camera, Users, TrendingUp, ChevronRight, 
  AlertCircle, BookOpen, Plus, GraduationCap, User, 
  BarChart3, Sparkles, ArrowRight, HelpCircle, Search, 
  Trash2, Printer, Eye, EyeOff, CheckCircle2, Download
} from "lucide-react";
import { Exam, ExamResult, Student, ClassGroup } from "../types";
import { apiFetch } from "../utils/api";
import QRCode from "qrcode";
import html2canvas from "html2canvas";

interface DashboardProps {
  user?: any;
  onNavigate: (tab: "painel" | "salas" | "provas" | "corrigir" | "resultados" | "usuarios" | "conversor") => void;
  onNewExamClick?: () => void;
}

export default function Dashboard({ user, onNavigate, onNewExamClick }: DashboardProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states for the integrated "Suas Provas" list
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [selectedExamForPreview, setSelectedExamForPreview] = useState<Exam | null>(null);
  
  // Preview configuration states
  const [selectedTemplateStyle, setSelectedTemplateStyle] = useState<"classic" | "gradepen">("gradepen");
  const [showAnswersInPreview, setShowAnswersInPreview] = useState(false);

  // QR Code preview states
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    if (!selectedExamForPreview) {
      setQrCodeDataUrl("");
      return;
    }

    const text = `GABARITOIA::EXAM:${selectedExamForPreview.id}::STUDENT:BLANK`;

    QRCode.toDataURL(text, {
      margin: 1,
      width: 150,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    })
    .then(url => {
      setQrCodeDataUrl(url);
    })
    .catch(err => {
      console.error("Error generating QR code:", err);
    });
  }, [selectedExamForPreview]);

  // Success / Error messages
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [resExams, resResults, resStudents, resClasses] = await Promise.all([
        apiFetch("/api/exams"),
        apiFetch("/api/results"),
        apiFetch("/api/students"),
        apiFetch("/api/classes")
      ]);
      
      const dataExams = await resExams.json();
      const dataResults = await resResults.json();
      const dataStudents = await resStudents.json();
      const dataClasses = await resClasses.json();

      setExams(dataExams);
      setResults(dataResults);
      setStudents(dataStudents);
      setClasses(dataClasses);

      if (dataExams.length > 0 && !selectedExamForPreview) {
        setSelectedExamForPreview(dataExams[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados do painel:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const showFeedback = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleDeleteExam = async (examId: string, examName: string) => {
    if (!confirm(`Tem certeza que deseja remover permanentemente a prova "${examName}" e todos os seus resultados correspondentes?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/exams/${examId}`, { method: "DELETE" });
      if (res.ok) {
        showFeedback("Prova removida com sucesso.", "success");
        if (selectedExamForPreview?.id === examId) {
          setSelectedExamForPreview(null);
        }
        await fetchDashboardData();
      } else {
        showFeedback("Erro ao remover prova.", "error");
      }
    } catch (e) {
      showFeedback("Falha na conexão ao excluir prova.", "error");
    }
  };

  // Compute statistics
  const totalExams = exams.length;
  const totalCorrected = results.length;
  
  const uniqueStudentIds = new Set();
  results.forEach(r => {
    if (r.studentId) {
      uniqueStudentIds.add(r.studentId);
    } else {
      uniqueStudentIds.add(r.studentName);
    }
  });
  const totalStudentsEvaluated = uniqueStudentIds.size;

  const averageGrade = totalCorrected > 0 
    ? Number((results.reduce((acc, curr) => acc + curr.score, 0) / totalCorrected).toFixed(0)) 
    : 0;

  // Filter exams list
  const filteredExams = exams.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ex.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === "all" || ex.classId === selectedClassFilter;
    return matchesSearch && matchesClass;
  });
  // Printing engine: opens a highly polished print layout
  const handleDownloadAsJpg = async (exam: Exam) => {
    const element = document.getElementById("gabarito-card-preview");
    if (!element) {
      alert("Elemento do gabarito não encontrado para exportação.");
      return;
    }

    try {
      // Temporary style adjustments to ensure high-quality, high-contrast, fully visible render
      const canvas = await html2canvas(element, {
        scale: 3, // Make it high resolution for OMR scanning/printing!
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      // Convert to JPG blob
      canvas.toBlob((blob) => {
        if (!blob) {
          alert("Erro ao gerar imagem.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `gabarito_${exam.name.toLowerCase().replace(/\s+/g, "_")}.jpg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.95);
    } catch (err) {
      console.error("Erro ao exportar JPG:", err);
      alert("Ocorreu um erro ao exportar o gabarito em JPG.");
    }
  };

  const handlePrintAnswerSheets = async (exam: Exam, blankOnly: boolean = false) => {
    const classObj = classes.find(c => c.id === exam.classId);
    const examStudents = blankOnly ? [] : students.filter(s => s.classId === exam.classId);
    
    // Create new print window
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, permita pop-ups para imprimir as folhas de respostas.");
      return;
    }

    // List of student data sets to print
    const sheetsToPrint = examStudents.length > 0 
      ? examStudents 
      : [{ id: "blank", name: "____________________________________", registration: "___________" }];

    // Generate dynamic base64 QR Code URLs for all sheets beforehand
    const sheetsWithQr = await Promise.all(
      sheetsToPrint.map(async (student) => {
        const registration = student.registration || "BLANK";
        const metadata = `GABARITOIA::EXAM:${exam.id}::STUDENT:${registration === "___________" ? "BLANK" : registration}`;
        try {
          const qrDataUrl = await QRCode.toDataURL(metadata, {
            margin: 1,
            width: 150,
            color: {
              dark: "#000000",
              light: "#ffffff"
            }
          });
          return { student, qrDataUrl };
        } catch (err) {
          console.error("Error generating QR code:", err);
          return { student, qrDataUrl: "" };
        }
      })
    );

    // Prepare print HTML structure
    let htmlContent = `
      <html>
      <head>
        <title>Gabarito IA - OpenCV OMR Folha de Respostas A4 18x10cm</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            .page-break { page-break-after: always; }
            body { 
               -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
          }
          body {
            margin: 0;
            padding: 0;
            width: 21cm;
            height: 29.7cm;
            font-family: ui-sans-serif, system-ui, sans-serif;
            background-color: #ffffff;
            color: #000000;
          }
          .page-container {
            width: 21cm;
            height: 29.7cm;
            padding: 1.5cm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            page-break-after: always;
            overflow: hidden;
            position: relative;
            background: #ffffff;
          }
          .gabarito-card {
            width: 18cm;
            height: 10cm;
            border: 2px solid #000000;
            border-radius: 8px;
            padding: 0.6cm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            background: #ffffff;
            color: #000000;
          }
          .bubble {
            width: 14px;
            height: 14px;
            border: 1.2px solid #000000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7px;
            font-weight: 900;
            color: #000000;
            background-color: #ffffff;
          }
          .marker-square {
            width: 14px;
            height: 14px;
            background-color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            position: absolute;
            z-index: 50;
          }
          .timing-mark {
            width: 6px;
            height: 3px;
            background-color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
    `;

    sheetsWithQr.forEach(({ student, qrDataUrl }, index) => {
      const isLast = index === sheetsWithQr.length - 1;
      
      // Chunk questions in columns of exactly 5
      const cols: number[][] = [];
      for (let i = 0; i < exam.questionsCount; i += 5) {
        const col: number[] = [];
        for (let j = 0; j < 5; j++) {
          if (i + j < exam.questionsCount) {
            col.push(i + j + 1);
          }
        }
        cols.push(col);
      }

      htmlContent += `
        <div class="page-container page-break">
          <!-- The beautiful 18x10cm scannable card from the user's sketch -->
          <div class="gabarito-card">
            <!-- Corner Calibration Markers for OpenCV findContours / warpPerspective -->
            <div class="marker-square" style="top: 0.15cm; left: 0.15cm;" title="Anchor TL"></div>
            <div class="marker-square" style="top: 0.15cm; right: 0.15cm;" title="Anchor TR"></div>
            <div class="marker-square" style="bottom: 0.15cm; left: 0.15cm;" title="Anchor BL"></div>
            <div class="marker-square" style="bottom: 0.15cm; right: 0.15cm;" title="Anchor BR"></div>

            <!-- Header Container -->
            <div class="border border-black p-2 rounded-lg bg-white">
              <div class="flex justify-between items-start gap-2">
                <div class="space-y-0.5 min-w-0 flex-1">
                  <span class="text-[7px] font-black uppercase tracking-wider text-gray-500 block leading-none">Gabarito IA • OMR Scanner Ready</span>
                  <h1 class="text-xs font-black uppercase text-black leading-tight truncate">${exam.name}</h1>
                  <p class="text-[8px] font-bold text-gray-600 truncate">Matéria: ${exam.subject} • Turma: ${classObj ? classObj.name : "Geral"}</p>
                </div>
                
                <!-- Compact QR Code for OpenCV orientation and ID -->
                <div class="shrink-0 flex flex-col items-center p-0.5 border border-black rounded-md bg-white">
                  <img src="${qrDataUrl}" alt="QR Metadata" class="w-11 h-11 bg-white" referrerPolicy="no-referrer" />
                  <span class="text-[5px] font-mono font-black mt-0.5 text-black">RA:${student.registration || "N/A"}</span>
                </div>
              </div>

              <!-- Student info row -->
              <div class="grid grid-cols-3 gap-1.5 border-t border-dashed border-gray-300 pt-1 mt-1">
                <div class="col-span-2 min-w-0">
                  <span class="block text-[6px] font-black uppercase text-gray-500 leading-none">Estudante:</span>
                  <span class="font-black text-[9px] text-black uppercase leading-tight truncate block">${student.name}</span>
                </div>
                <div class="min-w-0">
                  <span class="block text-[6px] font-black uppercase text-gray-500 leading-none">Matrícula:</span>
                  <span class="font-mono font-black text-[9px] text-black leading-tight block truncate">${student.registration}</span>
                </div>
              </div>
            </div>

            <!-- OMR Calibration instructions (extremely compact) -->
            <div class="p-1.5 bg-gray-50 border border-black rounded-lg flex items-center justify-between gap-2 text-[6.5px] leading-snug text-gray-700 font-bold">
              <div class="space-y-0.5">
                <p class="text-black text-[7.5px]">📌 <strong>GABARITO OFICIAL (18x10cm) • FOLHA A4</strong></p>
                <p>• Preencha todo o círculo. Utilize caneta preta ou azul escura.</p>
                <p>• Mantenha a folha limpa e sem dobras para leitura por câmera + OpenCV.</p>
              </div>
              <div class="flex gap-2 items-center shrink-0">
                <div class="flex flex-col items-center">
                  <span class="text-[5px] text-emerald-600 font-black">CERTO</span>
                  <div class="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[7px] font-black">A</div>
                </div>
                <div class="flex flex-col items-center">
                  <span class="text-[5px] text-red-500 font-black">ERRADO</span>
                  <div class="w-4 h-4 rounded-full border border-gray-400 text-gray-400 flex items-center justify-center text-[7px] font-black relative">
                    A
                    <span class="absolute text-red-500 font-black text-[8px]">✖</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Main Bubble Matrix Area -->
            <div class="relative bg-white border border-black p-2 rounded-lg flex-1 flex flex-col justify-center my-1.5">
              <div class="text-center mb-1.5">
                <span class="text-[6px] font-black tracking-widest text-black bg-gray-100 border border-black px-2 py-0.5 rounded uppercase">
                  ÁREA DE LEITURA ÓPTICA (OMR) • PROCESSAMENTO IMAGEM
                </span>
              </div>

              <div class="flex flex-row justify-center gap-2 flex-1">
                ${cols.map((col, cIdx) => {
                  const startNum = col[0];
                  const endNum = col[col.length - 1];
                  return `
                    <div class="border border-black rounded-md p-1 bg-white flex flex-col justify-between flex-1 max-w-[135px]">
                      <div class="text-[6px] font-black text-center border-b border-black pb-0.5 mb-1 uppercase tracking-wide bg-gray-50">
                        Q. ${startNum} - ${endNum}
                      </div>
                      <div class="space-y-0.5 flex-1 flex flex-col justify-around">
                        ${col.map(qNum => `
                          <div class="flex items-center justify-between py-0.5 border-b border-dashed border-gray-100">
                            <div class="flex items-center gap-1 min-w-0">
                              <div class="timing-mark" title="Timing Mark Q${qNum}"></div>
                              <span class="font-mono font-black text-[7.5px] text-black">Q${qNum.toString().padStart(2, "0")}:</span>
                            </div>
                            <div class="flex gap-0.5">
                              ${["A", "B", "C", "D", "E"].map(opt => `
                                <div class="bubble">${opt}</div>
                              `).join("")}
                            </div>
                          </div>
                        `).join("")}
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>

            <!-- Bottom Branding and verification -->
            <div class="border-t border-black pt-1 px-4 flex justify-between items-center text-[6px] font-mono text-black font-black uppercase mb-1">
              <span>SISTEMA DE CORREÇÃO GABARITO IA • OPENCV HIGH-SPEED</span>
              <span>ID: ${exam.id.toUpperCase().slice(0, 12)}</span>
            </div>
          </div>
          
          <!-- Dashed cut lines for visual alignment on A4 sheet -->
          <div class="w-[18cm] mt-4 border-t border-dashed border-gray-400 flex justify-between text-[8px] font-mono text-gray-400 uppercase">
            <span>✂️ Linha para recorte opcional (Gabarito 18x10cm)</span>
            <span>Estilo: A4 Compacto</span>
          </div>
        </div>
      `;
    });

    htmlContent += `
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => { window.close(); }, 1200);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-left">
      
      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#543D30] via-[#4A3728] to-[#36271C] rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-[#EADCD3]/10">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400/20 text-amber-200 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-400/30">
              <Sparkles className="w-3 h-3 text-amber-300" /> Sistema Ativo
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-none animate-fade-in">
              Olá, {user?.name ? user.name.split(" ")[0] : "Professor(a)"}! 👋
            </h2>
            <p className="text-sm text-amber-100/90 max-w-xl font-semibold">
              Bem-vindo ao seu painel inteligente. Corrija avaliações rapidamente em lote, gerencie turmas e acompanhe gráficos de desempenho.
            </p>
          </div>
          
          <div className="flex flex-row sm:flex-col gap-2 shrink-0">
            <button
              onClick={onNewExamClick || (() => onNavigate("provas"))}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-amber-500 hover:bg-amber-400 text-[#4A3728] text-xs font-black uppercase tracking-wider rounded-2xl shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Novo Gabarito</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Navigation Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Corrigir Provas */}
        <div 
          onClick={() => onNavigate("corrigir")}
          className="group bg-white p-5 rounded-3xl border border-[#EADCD3] hover:border-[#22C55E]/40 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[125px] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#EAF7EC]/40 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-[#EAF7EC] text-[#22C55E] rounded-xl flex items-center justify-center border border-[#D1F2D9] shrink-0">
              <Camera className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-[#4A3728] group-hover:text-[#22C55E] transition-colors uppercase tracking-wider">Corrigir com Gabarito</h4>
              <p className="text-[11px] text-[#8C7A6B] leading-relaxed font-semibold mt-1">Lançamento de notas rápido e coletivo para turmas.</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#F5EBE6] flex items-center justify-between text-[9px] font-bold text-[#8C7A6B]">
            <span>Lançar notas em lote</span>
            <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Salas e Alunos */}
        <div 
          onClick={() => onNavigate("salas")}
          className="group bg-white p-5 rounded-3xl border border-[#EADCD3] hover:border-[#D1A182] shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[125px] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#FAF6F0]/40 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-[#FFF5EE] text-[#D1A182] rounded-xl flex items-center justify-center border border-[#FFEBDF] shrink-0">
              <GraduationCap className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-[#4A3728] group-hover:text-[#D1A182] transition-colors uppercase tracking-wider">Salas & Alunos</h4>
              <p className="text-[11px] text-[#8C7A6B] leading-relaxed font-semibold mt-1">Gerencie salas, cadastre alunos ou importe dados.</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#F5EBE6] flex items-center justify-between text-[9px] font-bold text-[#8C7A6B]">
            <span>Gerenciar estudantes</span>
            <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Resultados */}
        <div 
          onClick={() => onNavigate("resultados")}
          className="group bg-white p-5 rounded-3xl border border-[#EADCD3] hover:border-[#3B82F6]/40 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[125px] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#EFF6FF]/40 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-[#EFF6FF] text-[#3B82F6] rounded-xl flex items-center justify-center border border-[#DBEAFE] shrink-0">
              <BarChart3 className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-[#4A3728] group-hover:text-[#3B82F6] transition-colors uppercase tracking-wider">Desempenho</h4>
              <p className="text-[11px] text-[#8C7A6B] leading-relaxed font-semibold mt-1">Relatórios analíticos e estatísticas gerais.</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#F5EBE6] flex items-center justify-between text-[9px] font-bold text-[#8C7A6B]">
            <span>Visualizar médias</span>
            <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 4: Conversor PDF */}
        <div 
          onClick={() => onNavigate("conversor")}
          className="group bg-white p-5 rounded-3xl border border-[#EADCD3] hover:border-amber-600/40 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[125px] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50/40 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shrink-0">
              <FileText className="w-4.5 h-4.5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-[#4A3728] group-hover:text-amber-600 transition-colors uppercase tracking-wider">PDF para Word</h4>
              <p className="text-[11px] text-[#8C7A6B] leading-relaxed font-semibold mt-1">Converta provas em PDF em arquivos Word editáveis.</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#F5EBE6] flex items-center justify-between text-[9px] font-bold text-[#8C7A6B]">
            <span>Converter material</span>
            <ArrowRight className="w-3 h-3 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Provas criadas */}
        <div className="bg-white p-4 rounded-3xl border border-[#EADCD3] shadow-xs text-left">
          <div className="w-9 h-9 bg-[#FAF6F0] text-[#543D30] rounded-xl flex items-center justify-center border border-[#F0E6DF] mb-3">
            <FileText className="w-4.5 h-4.5 font-bold" />
          </div>
          <span className="block text-2xl font-black text-[#4A3728] leading-none font-mono">{totalExams}</span>
          <span className="text-[10px] font-bold text-[#8C7A6B] mt-1 block uppercase tracking-wider">Gabaritos criados</span>
        </div>

        {/* Provas corrigidas */}
        <div className="bg-white p-4 rounded-3xl border border-[#EADCD3] shadow-xs text-left">
          <div className="w-9 h-9 bg-[#EAF7EC] text-[#22C55E] rounded-xl flex items-center justify-center border border-[#D1F2D9] mb-3">
            <Camera className="w-4.5 h-4.5 font-bold" />
          </div>
          <span className="block text-2xl font-black text-[#4A3728] leading-none font-mono">{totalCorrected}</span>
          <span className="text-[10px] font-bold text-[#8C7A6B] mt-1 block uppercase tracking-wider">Lançamentos</span>
        </div>

        {/* Alunos avaliados */}
        <div className="bg-white p-4 rounded-3xl border border-[#EADCD3] shadow-xs text-left">
          <div className="w-9 h-9 bg-[#EFF6FF] text-[#3B82F6] rounded-xl flex items-center justify-center border border-[#DBEAFE] mb-3">
            <Users className="w-4.5 h-4.5 font-bold" />
          </div>
          <span className="block text-2xl font-black text-[#4A3728] leading-none font-mono">{totalStudentsEvaluated}</span>
          <span className="text-[10px] font-bold text-[#8C7A6B] mt-1 block uppercase tracking-wider">Estudantes</span>
        </div>

        {/* Média geral */}
        <div className="bg-white p-4 rounded-3xl border border-[#EADCD3] shadow-xs text-left">
          <div className="w-9 h-9 bg-[#FFFBEB] text-[#F59E0B] rounded-xl flex items-center justify-center border border-[#FEF3C7] mb-3">
            <TrendingUp className="w-4.5 h-4.5 font-bold" />
          </div>
          <span className="block text-2xl font-black text-[#4A3728] leading-none font-mono">{averageGrade}%</span>
          <span className="text-[10px] font-bold text-[#8C7A6B] mt-1 block uppercase tracking-wider">Média geral</span>
        </div>
      </div>

      {/* FEEDBACK STATUS ALERTS */}
      {msg && (
        <div className={`p-4 rounded-2xl text-xs font-bold border text-left ${
          msg.type === "success" 
            ? "bg-[#EAF7EC] text-[#1E7D34] border-[#D1F2D9]" 
            : "bg-[#FDF2F2] text-[#9B1C1C] border-[#FDE8E8]"
        }`}>
          {msg.text}
        </div>
      )}

      {/* INTEGRATED "SUAS PROVAS" SECTION */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 border-b border-[#F0E6DF] pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-[#D1A182] uppercase tracking-widest block">Lista Geral do Sistema</span>
            <h3 className="text-xl font-black text-[#4A3728] tracking-tight uppercase">Seus Gabaritos Oficiais</h3>
          </div>

          {/* Filters controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-[#8C7A6B]" />
              </span>
              <input
                type="text"
                placeholder="Pesquisar gabarito..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-[#EADCD3] rounded-xl text-[#4A3728] font-bold focus:outline-hidden focus:border-[#543D30]"
              />
            </div>

            {/* Class filter Selector */}
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-[#EADCD3] rounded-xl text-[#4A3728] font-bold focus:outline-hidden focus:border-[#543D30]"
            >
              <option value="all">Todas as turmas</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Two Column Layout for Exam List + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: List of Exams */}
          <div className="lg:col-span-5 space-y-3.5">
            {isLoading ? (
              <div className="text-center py-12 text-[#8C7A6B] text-xs font-bold animate-pulse bg-white border border-[#EADCD3] rounded-3xl">
                Carregando lista de avaliações...
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white border border-dashed border-[#EADCD3] rounded-3xl text-xs text-[#8C7A6B] font-bold">
                Nenhum gabarito encontrado com os filtros selecionados.
              </div>
            ) : (
              filteredExams.map(ex => {
                const isSelected = selectedExamForPreview?.id === ex.id;
                const examClass = classes.find(c => c.id === ex.classId);
                const examResultsCount = results.filter(r => r.examId === ex.id).length;

                return (
                  <div
                    key={ex.id}
                    onClick={() => setSelectedExamForPreview(ex)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all duration-150 ${
                      isSelected 
                        ? "bg-[#FAF6F0] border-[#543D30] ring-1 ring-[#543D30]" 
                        : "bg-white border-[#EADCD3] hover:bg-[#FCFAF7]"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-[#4A3728] leading-snug uppercase tracking-wide">
                          {ex.name}
                        </h4>
                        <p className="text-xs font-semibold text-[#8C7A6B] mt-0.5">
                          {ex.subject} • {examClass ? examClass.name : "Qualquer turma"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteExam(ex.id, ex.name);
                        }}
                        className="p-1.5 text-[#8C7A6B] hover:text-red-500 rounded-lg hover:bg-red-50/50 transition-colors cursor-pointer"
                        title="Deletar Gabarito"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#F0E6DF]/50 pt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-[#543D30] bg-[#FAF6F0] border border-[#EADCD3] px-2 py-0.5 rounded-lg">
                          {ex.questionsCount} QUESTÕES
                        </span>
                        <span className="text-[9px] font-black text-amber-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-lg">
                          PESO {ex.questionValue}
                        </span>
                      </div>
                      
                      <span className="text-[10px] font-black font-mono text-[#8C7A6B] uppercase">
                        {examResultsCount} LANÇADAS
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Live Interactive Printable Preview */}
          <div className="lg:col-span-7">
            {selectedExamForPreview ? (
              <div className="bg-white border border-[#EADCD3] rounded-3xl overflow-hidden shadow-xs text-left">
                
                {/* Header preview tool bar */}
                <div className="bg-[#FAF6F0] p-4 border-b border-[#EADCD3] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-xs text-[#543D30] uppercase tracking-wider">Visualizar Gabarito Oficial</h4>
                    <p className="text-[10px] font-semibold text-[#8C7A6B] mt-0.5">Ajuste o formato e imprima a folha de respostas</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Style selector */}
                    <select
                      value={selectedTemplateStyle}
                      onChange={(e) => setSelectedTemplateStyle(e.target.value as any)}
                      className="px-2.5 py-1 text-[10px] font-black bg-white border border-[#EADCD3] rounded-lg text-[#4A3728] focus:outline-hidden uppercase tracking-wider"
                    >
                      <option value="gradepen">Modelo Gradepen Pro</option>
                      <option value="classic">Modelo Concurso</option>
                    </select>

                    {/* Show Answers checkbox */}
                    <button
                      type="button"
                      onClick={() => setShowAnswersInPreview(!showAnswersInPreview)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        showAnswersInPreview 
                          ? "bg-[#543D30] text-white border-[#543D30]" 
                          : "bg-white text-[#8C7A6B] border-[#EADCD3]"
                      }`}
                      title={showAnswersInPreview ? "Ocultar Gabarito" : "Mostrar Gabarito"}
                    >
                      {showAnswersInPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Printable sheet mock */}
                <div className="p-6 space-y-6">
                  
                {/* Printable sheet mock */}
                <div className="p-6 bg-gray-100 flex justify-center">
                  
                  {/* Realistically Proportioned A4 Sheet Mock */}
                  <div className="aspect-[1/1.414] w-full max-w-[480px] bg-white border border-gray-300 shadow-lg p-6 flex flex-col items-center justify-start rounded-xl relative overflow-hidden select-none">
                    
                    {/* The horizontal 18x10cm scannable card aligned at the top of the A4 page */}
                    <div id="gabarito-card-preview" className="w-full aspect-[1.8/1] border-2 border-black rounded-lg p-5 flex flex-col justify-between relative bg-white text-black">
                      
                      {/* Corner Calibration Markers */}
                      <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 bg-black" title="Anchor TL"></div>
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-black" title="Anchor TR"></div>
                      <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 bg-black" title="Anchor BL"></div>
                      <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 bg-black" title="Anchor BR"></div>

                      {/* Header Container inside the card */}
                      <div className="border border-black p-1.5 rounded-md bg-white">
                        <div className="flex justify-between items-start gap-1.5">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <span className="text-[6px] font-black uppercase tracking-wider text-gray-500 block leading-none">Gabarito IA • OMR Scanner Ready</span>
                            <h3 className="font-black text-[10px] text-black uppercase leading-tight truncate">{selectedExamForPreview.name}</h3>
                            <p className="text-[7px] font-bold text-gray-600 truncate">
                              Matéria: {selectedExamForPreview.subject} • Turma: {
                                classes.find(c => c.id === selectedExamForPreview.classId)?.name || "Geral"
                              }
                            </p>
                          </div>
                          
                          {/* Dynamic QR Code */}
                          <div className="shrink-0 flex flex-col items-center p-0.5 border border-black rounded-md bg-white">
                            {qrCodeDataUrl ? (
                              <img 
                                src={qrCodeDataUrl}
                                alt="QR Code" 
                                className="w-8 h-8 bg-white block"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 animate-pulse rounded" />
                            )}
                            <span className="text-[4px] font-mono font-black mt-0.5 text-black">
                              RA:___________
                            </span>
                          </div>
                        </div>

                        {/* Student Row */}
                        <div className="grid grid-cols-3 gap-1.5 border-t border-dashed border-gray-300 pt-0.5 mt-1 text-left">
                          <div className="col-span-2 min-w-0">
                            <span className="block text-[5px] font-black uppercase text-gray-400 leading-none">Estudante:</span>
                            <span className="font-extrabold text-[8px] text-gray-700 uppercase leading-tight truncate block">
                              ____________________________________
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[5px] font-black uppercase text-gray-400 leading-none">Matrícula:</span>
                            <span className="font-mono font-extrabold text-[8px] text-gray-700 leading-tight block truncate">
                              ___________
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Instructions */}
                      <div className="p-1 bg-gray-50 border border-black rounded-md flex items-center justify-between gap-1.5 text-[5.5px] leading-tight text-gray-700 font-bold">
                        <div className="space-y-0.5 text-left">
                          <p className="text-black text-[6.5px]">📌 <strong>GABARITO OFICIAL (18x10cm) • FOLHA A4</strong></p>
                          <p>• Preencha todo o círculo com caneta esferográfica preta ou azul.</p>
                        </div>
                        <div className="flex gap-1.5 items-center shrink-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[4px] text-emerald-600 font-black leading-none">CERTO</span>
                            <div className="w-3.5 h-3.5 rounded-full bg-black text-white flex items-center justify-center text-[6px] font-black">A</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[4px] text-red-500 font-black leading-none">ERRADO</span>
                            <div className="w-3.5 h-3.5 rounded-full border border-gray-400 text-gray-400 flex items-center justify-center text-[6px] font-black relative">
                              A
                              <span className="absolute text-red-500 font-black text-[7px]" style={{ top: "-1px" }}>✖</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Main Bubble Matrix Area grouped in columns of exactly 5 questions */}
                      <div className="relative bg-white border border-black p-1.5 rounded-md flex-1 flex flex-col justify-center my-1">
                        <div className="text-center mb-1">
                          <span className="text-[5px] font-black tracking-widest text-black bg-gray-100 border border-black px-1 py-0.5 rounded-xs uppercase">
                            ÁREA DE LEITURA ÓPTICA (OMR) • COLUNAS DE 5 QUESTÕES
                          </span>
                        </div>

                        <div className="flex flex-row justify-center gap-1 flex-1 overflow-hidden">
                          {(() => {
                            // Chunk questions in columns of exactly 5
                            const cols: number[][] = [];
                            for (let i = 0; i < selectedExamForPreview.questionsCount; i += 5) {
                              const col: number[] = [];
                              for (let j = 0; j < 5; j++) {
                                if (i + j < selectedExamForPreview.questionsCount) {
                                  col.push(i + j + 1);
                                }
                              }
                              cols.push(col);
                            }

                            return cols.map((col, cIdx) => {
                              const startNum = col[0];
                              const endNum = col[col.length - 1];

                              return (
                                <div key={cIdx} className="border border-black rounded p-1 bg-white flex flex-col justify-between flex-1 max-w-[100px]">
                                  <div className="text-[5.5px] font-black text-center border-b border-black pb-0.5 mb-0.5 uppercase tracking-wide bg-gray-50 leading-none">
                                    Q. {startNum} - {endNum}
                                  </div>
                                  <div className="space-y-0.5 flex-1 flex flex-col justify-around">
                                    {col.map(qNum => {
                                      const correctAnswer = selectedExamForPreview.answerKey[qNum] || "";
                                      return (
                                        <div key={qNum} className="flex items-center justify-between py-0.5 border-b border-dashed border-gray-100">
                                          <div className="flex items-center gap-0.5 min-w-0">
                                            <div className="w-1.5 h-1 bg-black" title="Timing Mark"></div>
                                            <span className="font-mono font-black text-[6.5px] text-black">Q{qNum.toString().padStart(2, "0")}:</span>
                                          </div>
                                          <div className="flex gap-0.5">
                                            {["A", "B", "C", "D", "E"].map(opt => {
                                              const isCorrect = correctAnswer === opt;
                                              const shouldHighlight = showAnswersInPreview && isCorrect;

                                              return (
                                                <div 
                                                  key={opt}
                                                  className={`w-3.5 h-3.5 rounded-full border text-[5.5px] font-black flex items-center justify-center transition-all ${
                                                    shouldHighlight 
                                                      ? "bg-black text-white border-black scale-105" 
                                                      : "bg-white text-gray-400 border-gray-300"
                                                  }`}
                                                >
                                                  {opt}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Bottom Branding */}
                      <div className="border-t border-black pt-0.5 px-4 flex justify-between items-center text-[5px] font-mono text-black font-black uppercase">
                        <span>SISTEMA DE CORREÇÃO GABARITO IA • OPENCV</span>
                        <span>ID: {selectedExamForPreview.id.toUpperCase().slice(0, 10)}</span>
                      </div>

                    </div>

                    {/* Empty Space representing the bottom of the A4 page (just like the drawing) */}
                    <div className="flex-1 w-full flex flex-col items-center justify-center border border-dashed border-gray-200 bg-gray-50/50 mt-4 rounded-lg relative">
                      <div className="text-center space-y-1">
                        <span className="text-[28px] font-black tracking-widest text-gray-200 uppercase">A4</span>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">Área inferior livre para anotações do professor</p>
                      </div>
                      
                      {/* Visual scissor line */}
                      <div className="absolute top-0 left-0 right-0 border-t border-dashed border-gray-300 flex justify-between px-3 text-[6px] font-mono text-gray-400 uppercase pt-1">
                        <span>✂️ Linha de Recorte do Gabarito (18x10cm)</span>
                        <span>Margens A4 de 1.5cm</span>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Operational print action buttons */}
                <div className="p-6 pt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handlePrintAnswerSheets(selectedExamForPreview, false)}
                      className="py-3 bg-[#543D30] hover:bg-[#3E2B21] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer shadow-xs transition-all flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4 text-[#D1A182]" /> Imprimir para a Turma
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadAsJpg(selectedExamForPreview)}
                      className="py-3 border border-[#EADCD3] hover:bg-[#FCFAF7] text-[#543D30] text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4 text-[#8C7A6B]" /> Baixar em JPG
                    </button>
                  </div>

                </div>

              </div>

            </div>
            ) : (
              <div className="bg-[#FCFAF7] border border-dashed border-[#EADCD3] p-12 rounded-3xl text-center text-[#8C7A6B] text-xs font-bold flex flex-col items-center justify-center min-h-[350px]">
                <FileText className="w-12 h-12 text-[#A08E7F] mb-3" />
                <span>Selecione uma prova da lista para visualizar ou imprimir</span>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
