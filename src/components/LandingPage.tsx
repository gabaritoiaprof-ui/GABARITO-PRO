import React from "react";
import { CheckCircle, Shield, Camera, FileSpreadsheet, BarChart3, QrCode } from "lucide-react";
import Logo from "./Logo";

interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center mb-12 sm:mb-16">
        <Logo size={110} className="mx-auto mb-6 drop-shadow-sm hover:scale-105 transition-transform duration-300" />
        <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold rounded-xl uppercase tracking-wider">
          Inteligência Artificial & Visão Computacional
        </span>
        <h1 className="mt-6 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 sm:leading-none">
          Gabarito <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-4">IA</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base text-slate-500 leading-relaxed">
          Corrija provas e simulados em menos de 2 segundos tirando uma simples foto.
          Economize horas de trabalho manual e obtenha relatórios de desempenho automáticos.
        </p>
        <div className="mt-8 flex justify-center">
          <button
            onClick={onStart}
            id="btn-get-started"
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 cursor-pointer transition-all transform hover:scale-102 flex items-center gap-2"
          >
            Acessar Sistema
          </button>
        </div>
      </div>

      {/* How it works section */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-slate-800 text-center mb-10 tracking-tight">
          Como funciona o fluxo completo?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-lg">
              1
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-2">Cadastre a Prova</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Defina o nome, turma, disciplina, quantidade de questões e informe o gabarito oficial.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-lg">
              2
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-2">Imprima os Cartões</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O sistema gera um cartão-resposta exclusivo com QR Code e 4 marcadores de canto para máxima precisão.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-lg">
              3
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-2">Tire a Foto</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Com o celular ou webcam, fotografe o cartão preenchido pelo aluno em qualquer ângulo.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-lg">
              4
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-2">Resultado & Gráficos</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              A IA corrige, detecta o aluno, atribui a nota e alimenta instantaneamente o painel estatístico.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Verification Section */}
      <div className="bg-slate-900 text-white p-8 sm:p-10 rounded-3xl shadow-xl mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-indigo-400" />
          <h2 className="text-2xl font-bold tracking-tight">Segurança e Privacidade dos Dados</h2>
        </div>
        <p className="text-slate-300 mb-8 text-sm leading-relaxed">
          Nós levamos a privacidade dos professores e alunos muito a sério. Aqui estão as respostas para os principais pontos de conformidade e segurança:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <h4 className="font-bold text-white text-sm">Não exigimos dados sensíveis</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-7">
              Não solicitamos CPF, senhas de contas bancárias ou integrações invasivas. O cadastro é simples para garantir segurança cibernética.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <h4 className="font-bold text-white text-sm">Armazenamento Seguro de Imagens</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-7">
              As fotos das provas são processadas em tempo real pela API segura do Gemini e descartadas imediatamente após a correção. Não guardamos fotos no servidor para proteger a privacidade dos alunos.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <h4 className="font-bold text-white text-sm">Administração Transparente</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-7">
              Os dados de alunos, turmas e notas ficam salvos no seu banco de dados local privado do aplicativo na Base44, que você mesmo pode gerenciar ou exportar a qualquer momento.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <h4 className="font-bold text-white text-sm">Layout Padronizado & Eficiente</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-7">
              Os 4 marcadores nos cantos (■) garantem correções precisas mesmo se a foto estiver inclinada, torta ou sob baixa luminosidade, em menos de 2 segundos.
            </p>
          </div>
        </div>
      </div>

      {/* Advanced features detail */}
      <div className="text-center text-xs text-slate-400 font-mono">
        Desenvolvido com tecnologia de ponta: React 19 • Express • Gemini 3.5 Flash Vision.
      </div>
    </div>
  );
}
