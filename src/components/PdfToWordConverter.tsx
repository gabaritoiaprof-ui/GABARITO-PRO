import React, { useState, useRef } from "react";
import { 
  FileText, Upload, Sparkles, CheckCircle2, AlertCircle, 
  ArrowRight, Download, Loader2, RefreshCw, FileCode, CornerDownRight
} from "lucide-react";
import { apiFetch } from "../utils/api";

export default function PdfToWordConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [base64File, setBase64File] = useState<string | null>(null);
  const [mode, setMode] = useState<"ai" | "direct">("ai");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"idle" | "reading" | "structuring" | "generating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [convertedData, setConvertedData] = useState<{ filename: string; file: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setErrorMessage("Por favor, selecione apenas arquivos formato PDF.");
        setStep("error");
        return;
      }
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setStep("idle");
    setErrorMessage("");
    setConvertedData(null);

    const reader = new FileReader();
    reader.onload = () => {
      setBase64File(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMessage("Falha ao ler o arquivo selecionado.");
      setStep("error");
    };
    reader.readAsDataURL(selectedFile);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type !== "application/pdf") {
        setErrorMessage("Por favor, selecione apenas arquivos formato PDF.");
        setStep("error");
        return;
      }
      processFile(droppedFile);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Convert execution
  const handleConvert = async () => {
    if (!base64File) return;

    setIsProcessing(true);
    setErrorMessage("");
    setConvertedData(null);

    try {
      // Step 1: Reading & extracting text from PDF
      setStep("reading");
      
      // We simulate step transitions slightly for a smoother, premium visual experience
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (mode === "ai") {
        setStep("structuring");
      } else {
        setStep("generating");
      }

      const response = await apiFetch("/api/convert-pdf-to-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: base64File,
          mode: mode
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Ocorreu uma falha inesperada durante a conversão do PDF.");
      }

      setStep("success");
      setConvertedData({
        filename: result.filename || `${file?.name.replace(/\.pdf$/i, "") || "documento"}.docx`,
        file: result.file
      });

    } catch (err: any) {
      console.error("[PDF Converter Component] Error converting file:", err);
      setErrorMessage(err.message || "Erro de conexão ou limite de cota de inteligência artificial.");
      setStep("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!convertedData) return;

    const link = document.createElement("a");
    link.href = convertedData.file;
    link.download = convertedData.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetConverter = () => {
    setFile(null);
    setBase64File(null);
    setConvertedData(null);
    setStep("idle");
    setErrorMessage("");
  };

  return (
    <div id="pdf-to-word-container" className="max-w-4xl mx-auto px-4 py-8 text-left space-y-8 animate-fade-in">
      
      {/* Title block */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200 mb-2">
          <Sparkles className="w-3 h-3 text-amber-700" /> Utilitário de Produtividade
        </div>
        <h1 className="text-3xl font-extrabold text-[#4A3728] tracking-tight">
          Conversor PDF para Word
        </h1>
        <p className="text-sm text-[#8C7A6B] mt-1 font-medium leading-relaxed max-w-2xl">
          Transforme avaliações, questionários ou textos pedagógicos em formato PDF em arquivos Microsoft Word (.docx) 100% editáveis em segundos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main interactive panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-[#EADCD3] p-6 shadow-xs space-y-6">
            
            {!file ? (
              /* Drop Zone */
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4 ${
                  dragActive 
                    ? "border-amber-500 bg-amber-50/40" 
                    : "border-[#EADCD3] hover:border-[#8C7A6B] hover:bg-[#FAF6F0]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                <div className="w-16 h-16 bg-[#F5EBE6] text-[#543D30] rounded-2xl flex items-center justify-center border border-[#EADCD3] shadow-xs">
                  <Upload className="w-7 h-7 stroke-[2]" />
                </div>
                
                <div className="space-y-1 max-w-sm">
                  <p className="font-extrabold text-sm text-[#4A3728]">
                    Arraste o arquivo PDF ou clique para buscar
                  </p>
                  <p className="text-xs text-[#8C7A6B] font-medium">
                    Suporta arquivos PDF de avaliações, provas ou materiais didáticos (Máx. 15MB)
                  </p>
                </div>
              </div>
            ) : (
              /* Selected file state */
              <div className="bg-[#FAF6F0] border border-[#EADCD3] rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 text-red-700 rounded-xl flex items-center justify-center border border-red-200 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-[#4A3728] truncate max-w-[220px] sm:max-w-md">
                      {file.name}
                    </p>
                    <p className="text-xs text-[#8C7A6B] font-semibold mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document
                    </p>
                  </div>
                </div>
                
                {!isProcessing && (
                  <button
                    onClick={resetConverter}
                    className="p-2 bg-white hover:bg-red-50 text-[#8C7A6B] hover:text-red-600 rounded-xl border border-[#EADCD3] transition-colors cursor-pointer shadow-xs"
                    title="Remover arquivo"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Selection modes */}
            {file && step !== "success" && step !== "error" && !isProcessing && (
              <div className="space-y-3">
                <label className="text-xs font-extrabold text-[#4A3728] uppercase tracking-wider block">
                  Escolha o Modo de Conversão
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* AI Mode Option */}
                  <div 
                    onClick={() => setMode("ai")}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 relative overflow-hidden select-none ${
                      mode === "ai" 
                        ? "border-amber-500 bg-amber-50/30 ring-1 ring-amber-500/20" 
                        : "border-[#EADCD3] hover:border-[#8C7A6B] bg-white"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-0.5 text-left pr-4">
                      <h4 className="font-black text-xs uppercase tracking-wider text-[#4A3728]">
                        Conversão Inteligente (IA)
                      </h4>
                      <p className="text-[11px] text-[#8C7A6B] leading-relaxed font-semibold">
                        Usa Inteligência Artificial para ler o texto do PDF, corrigir erros de quebras de página, OCR e reformatar em tópicos e enunciados perfeitos de Word.
                      </p>
                    </div>
                  </div>

                  {/* Direct Mode Option */}
                  <div 
                    onClick={() => setMode("direct")}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 relative overflow-hidden select-none ${
                      mode === "direct" 
                        ? "border-amber-500 bg-amber-50/30 ring-1 ring-amber-500/20" 
                        : "border-[#EADCD3] hover:border-[#8C7A6B] bg-white"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#FAF6F0] text-[#543D30] flex items-center justify-center shrink-0">
                      <FileCode className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-0.5 text-left pr-4">
                      <h4 className="font-black text-xs uppercase tracking-wider text-[#4A3728]">
                        Conversão Rápida Direta
                      </h4>
                      <p className="text-[11px] text-[#8C7A6B] leading-relaxed font-semibold">
                        Método offline ultra veloz que extrai o texto sequencial linha a linha do PDF de forma nativa e o envelopa instantaneamente em seções de Word.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading/Progress state rendering */}
            {isProcessing && (
              <div className="bg-[#FAF6F0] border border-[#EADCD3] rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-[#4A3728] animate-pulse">
                    {step === "reading" && "Lendo arquivo PDF e extraindo texto bruto..."}
                    {step === "structuring" && "A Inteligência Artificial está reestruturando e corrigindo o texto..."}
                    {step === "generating" && "Gerando documento Microsoft Word (.docx)..."}
                  </h4>
                  <p className="text-xs text-[#8C7A6B] font-medium max-w-sm mx-auto">
                    Isso leva apenas alguns segundos. Não feche nem recarregue a página.
                  </p>
                </div>
              </div>
            )}

            {/* Error display */}
            {step === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-red-900 text-sm">Falha na Conversão</h4>
                  <p className="text-xs text-red-700 font-semibold mt-1">
                    {errorMessage}
                  </p>
                  <button 
                    onClick={resetConverter}
                    className="text-xs font-black uppercase text-red-800 hover:text-red-900 mt-2.5 flex items-center gap-1 cursor-pointer"
                  >
                    Tentar Novamente <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Success display */}
            {step === "success" && convertedData && (
              <div className="bg-[#EAF7EC] border border-[#D1F2D9] rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-4">
                <div className="w-14 h-14 bg-[#22C55E]/10 text-[#22C55E] rounded-full flex items-center justify-center border border-[#D1F2D9] shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-[#1B4332] uppercase tracking-wider">
                    Conversão Concluída!
                  </h4>
                  <p className="text-xs text-[#2D6A4F] font-semibold max-w-md mx-auto">
                    Seu documento PDF foi transformado com sucesso em um arquivo Word editável contendo formatação nativa e fontes limpas.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 justify-center w-full max-w-xs">
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download .DOCX
                  </button>
                  
                  <button
                    onClick={resetConverter}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white border border-[#EADCD3] hover:bg-[#FAF6F0] text-[#543D30] text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    Nova Conversão
                  </button>
                </div>
              </div>
            )}

            {/* Trigger Button */}
            {file && step !== "success" && step !== "error" && !isProcessing && (
              <button
                onClick={handleConvert}
                className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-[#543D30] hover:bg-[#4A3728] text-white text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer shadow-sm transition-transform hover:-translate-y-0.5"
              >
                {mode === "ai" ? (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400 stroke-[2]" />
                    <span>Converter com IA Inteligente</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-white" />
                    <span>Converter Direto Rápido</span>
                  </>
                )}
              </button>
            )}

          </div>
        </div>

        {/* Sidebar help tips */}
        <div className="space-y-6">
          {/* Box 1: Why convert? */}
          <div className="bg-[#FAF6F0] border border-[#EADCD3] rounded-3xl p-5 text-left space-y-4">
            <h4 className="font-extrabold text-sm text-[#4A3728] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4.5 h-4.5 text-amber-700" /> Por que Converter?
            </h4>
            
            <ul className="space-y-3 text-xs text-[#8C7A6B] font-semibold leading-relaxed">
              <li className="flex gap-2">
                <CornerDownRight className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span><strong>Edite com Liberdade:</strong> Altere cabeçalhos, datas, insira novas questões ou mude a formatação da sua prova.</span>
              </li>
              <li className="flex gap-2">
                <CornerDownRight className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span><strong>Reaproveite Materiais:</strong> PDFs antigos baixados da internet podem ser transformados em Word para você personalizar para a sua turma.</span>
              </li>
              <li className="flex gap-2">
                <CornerDownRight className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span><strong>Remova OCR Danificado:</strong> O modo inteligente de inteligência artificial limpa as quebras de parágrafo indesejadas e reconstrói as alternativas de múltipla escolha.</span>
              </li>
            </ul>
          </div>

          {/* Box 2: Secure & Privacy */}
          <div className="bg-amber-50/50 border border-amber-200/50 rounded-3xl p-5 text-left space-y-2">
            <h5 className="font-extrabold text-xs text-amber-900 uppercase tracking-wider">
              🔒 Privacidade Garantida
            </h5>
            <p className="text-[11px] text-amber-800 leading-relaxed font-semibold">
              Seus documentos são processados de forma temporária em memória para a extração e conversão, sendo totalmente descartados logo em seguida. Seus dados estão 100% protegidos.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
