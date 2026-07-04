export interface ExamQuestion {
  id: number;
  text: string;
  options: Record<string, string>; // e.g. {"A": "...", "B": "..."}
  answer: string;
}

export interface Exam {
  id: string;
  name: string;
  classId: string;
  subject: string;
  questionsCount: number;
  questionValue: number; // e.g. 0.2
  answerKey: Record<number, string>; // e.g. {1: 'A', 2: 'B'}
  createdAt: string;
  questionsList?: ExamQuestion[];
}

export interface Student {
  id: string;
  name: string;
  registration: string; // matrícula
  classId: string;
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "9º Ano A", "3º Ano Ensino Médio"
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId?: string; // Optional if student unregistered or guest
  studentName: string;
  answers: Record<number, string>; // Student's marked answers
  score: number; // e.g. 8.5
  correctCount: number;
  incorrectCount: number;
  timestamp: string;
  feedback?: string; // AI generated study tip or comments
}
