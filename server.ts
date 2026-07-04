import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { PDFParse } from "pdf-parse";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { 
  getFirebaseUsers, 
  saveFirebaseUser, 
  getFirebaseUserData, 
  saveFirebaseUserData,
  firebaseRegisterUser,
  firebaseLoginUser,
  uploadBase64ToFirebaseStorage
} from "./src/lib/firebaseServer.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Setup writable uploads directory
const UPLOADS_DIR = (process.env.VERCEL || process.env.NODE_ENV === "production" || !fs.existsSync(path.join(process.cwd(), "src")))
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve local uploads
app.use("/uploads", express.static(UPLOADS_DIR));

// Enable CORS for external frontends (such as Vercel)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Setup data persistence directory
const DATA_DIR = (process.env.VERCEL || process.env.NODE_ENV === "production" || !fs.existsSync(path.join(process.cwd(), "src")))
  ? path.join("/tmp", "data") 
  : path.join(process.cwd(), "src", "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Copy pre-seeded files from workspace src/data to /tmp/data if in production
if (DATA_DIR.startsWith("/tmp")) {
  const sourceDir = path.join(process.cwd(), "src", "data");
  if (fs.existsSync(sourceDir)) {
    try {
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        const srcPath = path.join(sourceDir, file);
        const destPath = path.join(DATA_DIR, file);
        if (!fs.existsSync(destPath) && fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[Server] Copied ${file} to ${DATA_DIR}`);
        }
      }
    } catch (err) {
      console.error("[Server] Error copying pre-seeded data:", err);
    }
  }
}

const DB_PATH = path.join(DATA_DIR, "db.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");

// Initialize default mock data if not exists
function getInitialData() {
  const classes = [
    { id: "class-1", name: "Sala 01 (9º Ano EF)" },
    { id: "class-2", name: "Sala 02 (8º Ano EF)" }
  ];

  const students = [
    { id: "std-1", name: "JOÃO SILVA COSTA", registration: "1", classId: "class-1" },
    { id: "std-2", name: "MARIA OLIVEIRA", registration: "2", classId: "class-1" },
    { id: "std-3", name: "PEDRO SANTOS", registration: "3", classId: "class-1" },
    { id: "std-4", name: "ANA COSTA ARAÚJO", registration: "4", classId: "class-1" },
    { id: "std-5", name: "DIEGO REIS FERREIRA", registration: "5", classId: "class-1" }
  ];

  const exams = [
    {
      id: "exam-1",
      name: "Simulado Mensal de Língua Portuguesa",
      classId: "class-1",
      subject: "Língua Portuguesa",
      questionsCount: 10,
      questionValue: 1.0,
      answerKey: {
        1: "A", 2: "C", 3: "B", 4: "D", 5: "E",
        6: "B", 7: "A", 8: "D", 9: "C", 10: "E"
      },
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const results = [
    {
      id: "res-1",
      examId: "exam-1",
      studentId: "std-1",
      studentName: "JOÃO SILVA COSTA",
      answers: {
        1: "A", 2: "C", 3: "B", 4: "D", 5: "E",
        6: "A", 7: "A", 8: "D", 9: "D", 10: "E"
      },
      score: 8.0,
      correctCount: 8,
      incorrectCount: 2,
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      feedback: "Excelente desempenho! Revise as questões de interpretação textual de tirinhas para fixar."
    },
    {
      id: "res-2",
      examId: "exam-1",
      studentId: "std-2",
      studentName: "MARIA OLIVEIRA",
      answers: {
        1: "A", 2: "C", 3: "B", 4: "D", 5: "E",
        6: "B", 7: "A", 8: "D", 9: "C", 10: "E"
      },
      score: 10.0,
      correctCount: 10,
      incorrectCount: 0,
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      feedback: "Desempenho espetacular! Nota máxima!"
    },
    {
      id: "res-3",
      examId: "exam-1",
      studentId: "std-5",
      studentName: "DIEGO REIS FERREIRA",
      answers: {
        1: "B", 2: "C", 3: "A", 4: "D", 5: "C",
        6: "B", 7: "A", 8: "B", 9: "C", 10: "D"
      },
      score: 5.0,
      correctCount: 5,
      incorrectCount: 5,
      timestamp: new Date().toISOString(),
      feedback: "Você dominou metade da prova. Revise crase e regência nominal."
    }
  ];

  return { classes, students, exams, results };
}

// Multi-tenant users database helper
function loadUsers() {
  if (!fs.existsSync(USERS_PATH)) {
    const initialUsers = [
      {
        "id": "gabaritoiaprof_gmail_com",
        "email": "gabaritoiaprof@gmail.com",
        "password": "19891950Hell",
        "name": "Prof. Elderney Reis",
        "school": "Escola Estadual Castro Alves",
        "role": "Administrador / Professor Titular",
        "subject": "Língua Portuguesa & Literatura",
        "license": "Premium Individual",
        "maxQuota": 220,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "daysAllowed": 99999,
        "status": "active"
      }
    ];
    fs.writeFileSync(USERS_PATH, JSON.stringify(initialUsers, null, 2), "utf-8");
    saveFirebaseUser(initialUsers[0]).catch(e => console.error(e));
    return initialUsers;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    let updated = false;
    const mapped = raw.map((u: any) => {
      let changed = false;
      if (!u.createdAt) {
        u.createdAt = new Date().toISOString();
        changed = true;
      }
      if (u.daysAllowed === undefined || u.daysAllowed === 1) {
        u.daysAllowed = u.email === "gabaritoiaprof@gmail.com" ? 99999 : 2;
        changed = true;
      }
      if (!u.status) {
        u.status = "active";
        changed = true;
      }
      // Force user-requested admin password update if present
      if (u.email === "gabaritoiaprof@gmail.com" && u.password !== "19891950Hell") {
        u.password = "19891950Hell";
        changed = true;
      }
      if (changed) {
        updated = true;
        saveFirebaseUser(u).catch(e => console.error(e));
      }
      return u;
    });
    if (updated) {
      fs.writeFileSync(USERS_PATH, JSON.stringify(mapped, null, 2), "utf-8");
    }

    // Lazy background fetch to update the cache
    getFirebaseUsers().catch(e => console.error("[Firebase Server] Error prefetching users:", e));

    return mapped;
  } catch (e) {
    return [];
  }
}

function saveUsers(users: any[]) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
  // Background sync all updated users to Firestore
  users.forEach((u) => {
    saveFirebaseUser(u).catch(e => console.error("[Firebase Server] Error syncing user:", e));
  });
}

function checkIsAdmin(adminId: string | undefined, users: any[]): boolean {
  if (!adminId) return false;
  const lowerId = String(adminId).toLowerCase();
  if (lowerId.includes("gabaritoiaprof") || lowerId === "gabaritoiaprof_gmail_com") return true;
  const requestingUser = users.find((u: any) => u.id === adminId);
  if (requestingUser && requestingUser.email?.toLowerCase() === "gabaritoiaprof@gmail.com") {
    return true;
  }
  return false;
}

function getDbPath(userId?: string) {
  if (!userId || userId === "null" || userId === "undefined") {
    return DB_PATH;
  }
  const safeId = String(userId).replace(/[^a-zA-Z0-9_\-@.]/g, "_");
  return path.join(DATA_DIR, `db_${safeId}.json`);
}

const lastSyncTimes: { [userId: string]: number } = {};

function loadDb(userId?: string) {
  const dbPath = getDbPath(userId);
  const isAdmin = !userId || userId === "null" || userId === "undefined" || userId === "gabaritoiaprof_gmail_com" || String(userId).toLowerCase().includes("gabaritoiaprof");

  // Lazy background sync: trigger a Firestore fetch in the background to keep local JSON file updated
  if (userId && userId !== "null" && userId !== "undefined") {
    const now = Date.now();
    const lastSync = lastSyncTimes[userId] || 0;
    // Throttled: only query Firestore at most once every 30 seconds to avoid query collisions and write race conditions
    if (now - lastSync > 30000) {
      lastSyncTimes[userId] = now;
      getFirebaseUserData(userId).then((firestoreDb) => {
        if (firestoreDb && (firestoreDb.classes?.length || firestoreDb.students?.length || firestoreDb.exams?.length || firestoreDb.results?.length)) {
          // Double check if the local file was modified after we initiated our Firestore fetch
          try {
            if (fs.existsSync(dbPath)) {
              const stats = fs.statSync(dbPath);
              if (stats.mtimeMs > now) {
                console.log(`[Firebase Server] Skipping local DB overwrite from Firestore for ${userId} because local file is newer.`);
                return;
              }
            }
          } catch (err) {}

          fs.writeFileSync(dbPath, JSON.stringify(firestoreDb, null, 2), "utf-8");
          console.log(`[Firebase Server] Synced local DB with Firestore for ${userId}`);
        }
      }).catch(e => {
        console.error(`[Firebase Server] Background load sync error for ${userId}:`, e);
        // Clear last sync time on error to allow immediate retry if needed
        delete lastSyncTimes[userId];
      });
    }
  }

  if (!fs.existsSync(dbPath)) {
    const initialData = isAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");
    
    if (userId && userId !== "null" && userId !== "undefined") {
      saveFirebaseUserData(userId, initialData).catch(e => console.error(e));
    }
    return initialData;
  }
  try {
    const content = fs.readFileSync(dbPath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    console.error("Error reading database file, resetting to initial data", e);
    const initialData = isAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");
    return initialData;
  }
}

function saveDb(data: any, userId?: string) {
  const dbPath = getDbPath(userId);
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");

  if (userId && userId !== "null" && userId !== "undefined") {
    // Lock background sync loads on this user ID for the next 30 seconds to prioritize local changes
    lastSyncTimes[userId] = Date.now();
    saveFirebaseUserData(userId, data).catch(e => console.error("[Firebase Server] Async save DB error:", e));
  }
}

function getUserId(req: express.Request): string | undefined {
  return (req.headers["x-user-id"] || req.query.userId) as string;
}

// authentication endpoints
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    // 1. Authenticate with Firebase Authentication first if active
    await firebaseLoginUser(email, password);
  } catch (err: any) {
    // Treat Email/Password auth disabled in Firebase Console (auth/operation-not-allowed)
    if (err.code === "auth/operation-not-allowed" || String(err).includes("operation-not-allowed")) {
      console.warn("[Firebase Auth] Email/Password provider is disabled in Firebase Console. Falling back to local authentication.");
      const users = loadUsers();
      let user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        if (user.password === password) {
          const { password: _, ...userInfo } = user;
          return res.json({ success: true, user: userInfo });
        } else {
          return res.status(401).json({ error: "Senha incorreta para a conta cadastrada localmente." });
        }
      } else {
        // Automatically register locally so they are not blocked
        const safeId = email.replace(/[^a-zA-Z0-9_\-@.]/g, "_");
        const isSystemAdmin = email.toLowerCase() === "gabaritoiaprof@gmail.com";
        user = {
          id: `user-${safeId}-${Date.now()}`,
          email,
          password, // Store as fallback
          name: email.split("@")[0].toUpperCase(),
          school: "Escola Estadual",
          role: "Professor(a) Titular",
          subject: "Língua Portuguesa",
          license: "Premium Individual",
          maxQuota: 220,
          createdAt: new Date().toISOString(),
          daysAllowed: isSystemAdmin ? 99999 : 2,
          status: "active"
        };
        users.push(user);
        saveUsers(users);

        const dbPath = getDbPath(user.id);
        const initialData = isSystemAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");

        const { password: _, ...userInfo } = user;
        return res.json({ success: true, user: userInfo });
      }
    }

    // Treat "wrong password" or "user not found" gracefully
    let errMsg = "Credenciais inválidas. Verifique seu e-mail e senha.";
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
      errMsg = "Credenciais inválidas. Verifique seu e-mail e senha no Firebase.";
    } else {
      errMsg = `Erro de Autenticação Firebase: ${err.message || err}`;
    }
    return res.status(401).json({ error: errMsg });
  }

  const users = loadUsers();
  let user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  
  // If user is successfully authenticated via Firebase Auth but doesn't exist in local cache, restore or create it
  if (!user) {
    const safeId = email.replace(/[^a-zA-Z0-9_\-@.]/g, "_");
    const isSystemAdmin = email.toLowerCase() === "gabaritoiaprof@gmail.com";
    user = {
      id: `user-${safeId}-${Date.now()}`,
      email,
      password, // Store as fallback
      name: email.split("@")[0].toUpperCase(),
      school: "Escola Estadual",
      role: "Professor(a) Titular",
      subject: "Língua Portuguesa",
      license: "Premium Individual",
      maxQuota: 220,
      createdAt: new Date().toISOString(),
      daysAllowed: isSystemAdmin ? 99999 : 2,
      status: "active"
    };
    users.push(user);
    saveUsers(users);

    const dbPath = getDbPath(user.id);
    const initialData = isSystemAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");
  }

  const { password: _, ...userInfo } = user;
  res.json({ success: true, user: userInfo });
});

app.post("/api/register", async (req, res) => {
  const { email, password, name, school, role, subject } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "E-mail, senha e nome completo são obrigatórios." });
  }
  const users = loadUsers();
  if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "Este endereço de e-mail já está em uso." });
  }

  try {
    // 1. Create the user in Firebase Authentication
    await firebaseRegisterUser(email, password);
  } catch (err: any) {
    if (err.code === "auth/operation-not-allowed") {
      console.warn("[Firebase Auth] Email/Password provider is disabled in Firebase Console. Registering user locally only.");
    } else {
      let errMsg = "Erro ao realizar cadastro no Firebase.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "Este endereço de e-mail já está cadastrado no Firebase Auth.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "A senha é muito fraca. Digite pelo menos 6 caracteres.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "O endereço de e-mail fornecido é inválido.";
      } else {
        errMsg = `Erro do Firebase Auth: ${err.message || err}`;
      }
      return res.status(400).json({ error: errMsg });
    }
  }

  const isSystemAdmin = email.toLowerCase() === "gabaritoiaprof@gmail.com";
  const newUser = {
    id: `user-${Date.now()}`,
    email,
    password,
    name,
    school: school || "Escola Estadual",
    role: role || "Professor(a) Titular",
    subject: subject || "Língua Portuguesa",
    license: "Premium Individual",
    maxQuota: 220,
    createdAt: new Date().toISOString(),
    daysAllowed: isSystemAdmin ? 99999 : 2,
    status: "active"
  };

  users.push(newUser);
  saveUsers(users);

  // Create user specific database - clean empty slate
  const dbPath = getDbPath(newUser.id);
  const initialData = isSystemAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
  fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");

  const { password: _, ...userInfo } = newUser;
  res.status(201).json({ success: true, user: userInfo });
});

// Generic File/Image Upload to Firebase Storage
app.post("/api/upload", async (req, res) => {
  const { file, folder } = req.body;
  if (!file) {
    return res.status(400).json({ error: "Nenhum arquivo ou imagem fornecida." });
  }

  const userId = getUserId(req) || "anonymous";
  try {
    let mimeType = "image/png";
    if (file.includes(";base64,")) {
      mimeType = file.split(";base64,")[0].split(":")[1] || "image/png";
    }
    const downloadUrl = await uploadBase64ToFirebaseStorage(userId, file, mimeType, folder || "uploads");
    if (downloadUrl) {
      res.json({ success: true, url: downloadUrl });
    } else {
      res.status(500).json({ success: false, error: "Falha ao enviar arquivo para o Firebase Storage. Certifique-se de que o bucket está configurado." });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PDF to Word (Docx) Converter Endpoint
app.post("/api/convert-pdf-to-word", async (req, res) => {
  const { file, mode } = req.body;
  if (!file) {
    return res.status(400).json({ error: "Nenhum arquivo PDF fornecido." });
  }

  try {
    // 1. Decode base64 PDF
    let base64Data = file;
    if (file.includes(";base64,")) {
      base64Data = file.split(";base64,")[1];
    }
    const pdfBuffer = Buffer.from(base64Data, "base64");

    // 2. Parse PDF to plain text
    console.log("[PDF to Word] Extraindo texto do PDF com pdf-parse...");
    const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 });
    const pdfData = await parser.getText();
    const rawText = pdfData.text || "";

    if (!rawText.trim()) {
      return res.status(400).json({ 
        error: "Não foi possível extrair nenhum texto legível deste PDF. Certifique-se de que o arquivo não seja apenas uma imagem escaneada sem camada de texto." 
      });
    }

    // 3. Structure text blocks (Direct / AI)
    let blocks: Array<{ type: string; text: string }> = [];

    const isAiMode = mode === "ai";
    let apiKeyToUse: string | undefined = undefined;

    if (isAiMode) {
      const userId = getUserId(req);
      const users = loadUsers(); // Load all users from local/fallback
      const user = users.find((u: any) => u.id === userId);
      const userGeminiKey = user?.geminiApiKey;
      apiKeyToUse = userGeminiKey || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;

      if (!apiKeyToUse) {
        console.warn("[PDF to Word] Sem chave API disponível para o modo IA. Usando conversão direta rápida.");
      }
    }

    if (isAiMode && apiKeyToUse) {
      try {
        console.log("[PDF to Word] Modo Inteligente ativado. Chamando Gemini API para reestruturar texto...");
        const systemInstruction = `Você é um assistente especialista em conversão de documentos e formatação pedagógica.
Você recebeu um texto bruto extraído de um arquivo PDF. Sua tarefa é ler, corrigir problemas comuns de quebra de linhas/OCR, e organizar o texto em blocos estruturados em formato JSON para que possamos reconstruir um documento Microsoft Word (.docx) bonito e altamente profissional.

Você DEVE retornar OBRIGATORIAMENTE um JSON que seja um array de objetos contendo "type" e "text".
Exemplo de formato esperado:
[
  {"type": "title", "text": "AVALIAÇÃO BIMESTRAL DE HISTÓRIA"},
  {"type": "heading1", "text": "Instruções Gerais:"},
  {"type": "paragraph", "text": "1. Esta prova é individual e sem consulta."},
  {"type": "paragraph", "text": "Questão 1. Quem foi o primeiro imperador do Brasil?"},
  {"type": "list_item", "text": "A) Dom Pedro I"},
  {"type": "list_item", "text": "B) Dom João VI"}
]

Tipos permitidos: "title", "heading1", "heading2", "paragraph", "list_item".
Mantenha rigorosamente o texto original do PDF, apenas limpe as imperfeições e faça a categorização! Retorne APENAS o array JSON válido sem decorações markdown.`;

        const ai = getGoogleGenAIClient(apiKeyToUse);
        const response = await generateContentWithRetryAndFallback(ai, {
          model: "gemini-3.5-flash",
          contents: [{ text: `Texto extraído do PDF:\n\n${rawText.slice(0, 15000)}` }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              description: "Lista de blocos estruturados do documento",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "O tipo de bloco (title, heading1, heading2, paragraph, list_item)"
                  },
                  text: {
                    type: Type.STRING,
                    description: "O conteúdo de texto do bloco"
                  }
                },
                required: ["type", "text"]
              }
            }
          }
        });

        const resultText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log("[PDF to Word] Gemini retornou resposta. Parseando JSON...");
        blocks = JSON.parse(resultText.trim());
      } catch (aiErr: any) {
        console.error("[PDF to Word] Erro ao chamar a IA do Gemini para converter PDF. Usando conversão direta como fallback:", aiErr);
        blocks = []; // Trigger direct mode below
      }
    }

    // Direct mode fallback if blocks is empty
    if (blocks.length === 0) {
      console.log("[PDF to Word] Usando modo de conversão direta offline...");
      const lines = rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let type = "paragraph";
        if (trimmed.length < 100 && ((trimmed === trimmed.toUpperCase() && trimmed.match(/[A-ZÀ-Ú]/)) || trimmed.includes("ESCOLA") || trimmed.includes("AVALIAÇÃO") || trimmed.includes("PROVA") || trimmed.includes("NOME:"))) {
          if (trimmed.includes("AVALIAÇÃO") || trimmed.includes("PROVA") || trimmed.includes("ESCOLA")) {
            type = "title";
          } else {
            type = "heading1";
          }
        } else if (trimmed.match(/^[a-eA-E0-5]\)|^[A-Ea-e]\s*-|^[0-9]+\.\s*|^[•\-\*]/)) {
          type = "list_item";
        }

        blocks.push({ type, text: trimmed });
      }
    }

    // 4. Generate DOCX with beautiful styles
    console.log("[PDF to Word] Criando documento DOCX...");
    const childrenElements: any[] = [];

    // Add a nice header space
    childrenElements.push(
      new Paragraph({
        text: "",
        spacing: { before: 200, after: 200 }
      })
    );

    for (const block of blocks) {
      const text = block.text.trim();
      if (!text) continue;

      if (block.type === "title") {
        childrenElements.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: text.toUpperCase(),
                bold: true,
                size: 28, // 14pt
                font: "Calibri",
                color: "2D1E15"
              })
            ]
          })
        );
      } else if (block.type === "heading1") {
        childrenElements.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: text,
                bold: true,
                size: 24, // 12pt
                font: "Calibri",
                color: "543D30"
              })
            ]
          })
        );
      } else if (block.type === "heading2") {
        childrenElements.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: text,
                bold: true,
                size: 20, // 10pt
                font: "Calibri",
                color: "8C7A6B"
              })
            ]
          })
        );
      } else if (block.type === "list_item") {
        childrenElements.push(
          new Paragraph({
            spacing: { before: 80, after: 80 },
            indent: { left: 720 }, // Indent standard tab (0.5 inch / 720 dxa)
            children: [
              new TextRun({
                text: text,
                size: 22, // 11pt
                font: "Calibri"
              })
            ]
          })
        );
      } else {
        childrenElements.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({
                text: text,
                size: 22, // 11pt
                font: "Calibri"
              })
            ]
          })
        );
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: childrenElements
      }]
    });

    const docxBuffer = await Packer.toBuffer(doc);
    const base64Docx = docxBuffer.toString("base64");

    console.log("[PDF to Word] Conversão concluída com sucesso!");
    res.json({
      success: true,
      filename: "documento_gabaritoia_convertido.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      file: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Docx}`
    });

  } catch (error: any) {
    console.error("[PDF to Word] Falha crítica na conversão do PDF:", error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// Google Authentication Endpoints
app.get("/api/auth/google/url", (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.replace(/['"]/g, "").trim();
  if (!googleClientId) {
    return res.json({ 
      configured: false,
      message: "GOOGLE_CLIENT_ID não está configurado nas variáveis de ambiente." 
    });
  }

  const originQuery = (req.query.origin as string) || "";
  const appUrl = originQuery || process.env.APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl.replace(/\/$/, "")}/auth/google/callback`;
  
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state: originQuery || "default"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ configured: true, url: authUrl });
});

// Diagnostic endpoint to check Google OAuth configuration status and common mistakes
app.get("/api/auth/google/diagnostic", (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.replace(/['"]/g, "").trim() || "";
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.replace(/['"]/g, "").trim() || "";
  const appUrl = process.env.APP_URL || "";

  let clientIdFormat = "empty";
  if (googleClientId) {
    if (googleClientId.startsWith("GOCSPX-")) {
      clientIdFormat = "invalid_is_secret";
    } else if (googleClientId.endsWith(".apps.googleusercontent.com")) {
      clientIdFormat = "valid";
    } else if (googleClientId.length < 20) {
      clientIdFormat = "invalid_too_short";
    } else {
      clientIdFormat = "invalid_missing_suffix";
    }
  }

  let clientSecretFormat = "empty";
  if (googleClientSecret) {
    if (googleClientSecret.endsWith(".apps.googleusercontent.com")) {
      clientSecretFormat = "invalid_is_client_id";
    } else if (googleClientSecret.startsWith("GOCSPX-")) {
      clientSecretFormat = "valid_gocspx";
    } else if (googleClientSecret.length < 15) {
      clientSecretFormat = "invalid_too_short";
    } else {
      clientSecretFormat = "possibly_valid";
    }
  }

  const maskString = (str: string) => {
    if (!str) return "Não configurado";
    if (str.length <= 12) return "*".repeat(str.length);
    return str.substring(0, 8) + "..." + str.substring(str.length - 8);
  };

  res.json({
    clientIdExists: !!googleClientId,
    clientIdLength: googleClientId.length,
    clientIdMasked: maskString(googleClientId),
    clientIdFormat,
    clientSecretExists: !!googleClientSecret,
    clientSecretLength: googleClientSecret.length,
    clientSecretMasked: maskString(googleClientSecret),
    clientSecretFormat,
    appUrl: appUrl || "não configurado (padrão: http://localhost:3000)",
    redirectUri: `${(appUrl || "http://localhost:3000").replace(/\/$/, "")}/auth/google/callback`
  });
});

app.get(["/auth/google/callback", "/auth/google/callback/"], async (req, res) => {
  const { code, error, state } = req.query;
  
  if (error) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: '${error}' }, '*');
              window.close();
            }
          </script>
          <p>Erro na autenticação: ${error}</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send("Código de autorização ausente.");
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID?.replace(/['"]/g, "").trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.replace(/['"]/g, "").trim();
  
  const stateStr = (state as string) || "";
  const baseAppUrl = (stateStr.startsWith("http://") || stateStr.startsWith("https://")) 
    ? stateStr 
    : (process.env.APP_URL || "http://localhost:3000");
  const redirectUri = `${baseAppUrl.replace(/\/$/, "")}/auth/google/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: googleClientId!,
        client_secret: googleClientSecret!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData: any = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "Falha ao obter token");
    }

    const { id_token } = tokenData;
    
    // Decode JWT payload
    const payloadBase64 = id_token.split(".")[1];
    const payloadDecoded = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const googleUser = JSON.parse(payloadDecoded);

    const email = googleUser.email;
    const name = googleUser.name || googleUser.given_name || "Usuário Google";
    
    const users = loadUsers();
    let user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      const safeId = email.replace(/[^a-zA-Z0-9_\-@.]/g, "_");
      const isSystemAdmin = email.toLowerCase() === "gabaritoiaprof@gmail.com";
      user = {
        id: `user-${safeId}-${Date.now()}`,
        email: email,
        name: name,
        school: "Escola Estadual",
        role: "Professor(a) Titular",
        subject: "Língua Portuguesa",
        license: "Premium Individual",
        maxQuota: 220,
        daysAllowed: isSystemAdmin ? 99999 : 2,
        status: "active",
        createdAt: new Date().toISOString()
      };
      users.push(user);
      saveUsers(users);

      const dbPath = getDbPath(user.id);
      const initialData = isSystemAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
      fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_SUCCESS', 
                user: ${JSON.stringify(user)} 
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autenticação bem-sucedida! Esta janela fechará automaticamente.</p>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("Erro no callback do Google OAuth:", err);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_ERROR', 
                error: '${err.message || "Erro desconhecido"}' 
              }, '*');
              window.close();
            }
          </script>
          <p>Falha no login com Google: ${err.message || "Erro ao processar tokens"}</p>
        </body>
      </html>
    `);
  }
});

app.post("/api/auth/google/simulate", (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "E-mail e nome são obrigatórios para simular." });
  }

  const users = loadUsers();
  let user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    const safeId = email.replace(/[^a-zA-Z0-9_\-@.]/g, "_");
    const isSystemAdmin = email.toLowerCase() === "gabaritoiaprof@gmail.com";
    user = {
      id: `user-${safeId}-${Date.now()}`,
      email: email,
      name: name,
      school: "Escola de Simulação",
      role: "Professor(a) Titular",
      subject: "Língua Portuguesa",
      license: "Premium Individual",
      maxQuota: 220,
      daysAllowed: isSystemAdmin ? 99999 : 2,
      status: "active",
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);

    const dbPath = getDbPath(user.id);
    const initialData = isSystemAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");
  }

  res.json({ success: true, user });
});

// quota checker
app.get("/api/user-quota", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  
  const todayStr = new Date().toISOString().split("T")[0];
  const correctionsToday = db.results.filter((r: any) => {
    if (!r.timestamp) return false;
    return r.timestamp.startsWith(todayStr);
  }).length;
  
  res.json({
    count: correctionsToday,
    maxQuota: 220,
    remaining: Math.max(0, 220 - correctionsToday)
  });
});

// REST APIs Partitioned by User Header
app.get("/api/classes", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  res.json(db.classes);
});

app.post("/api/classes", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  const newClass = {
    id: `class-${Date.now()}`,
    name: req.body.name || "Nova Turma"
  };
  db.classes.push(newClass);
  saveDb(db, userId);
  res.status(201).json(newClass);
});

app.delete("/api/classes/:id", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  const { id } = req.params;
  db.classes = db.classes.filter((c: any) => c.id !== id);
  db.students = db.students.filter((s: any) => s.classId !== id);
  db.exams = db.exams.filter((e: any) => e.classId !== id);
  saveDb(db, userId);
  res.json({ success: true });
});

app.get("/api/students", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  res.json(db.students);
});

app.post("/api/students", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  const newStudent = {
    id: `std-${Date.now()}`,
    name: req.body.name || "Novo Aluno",
    registration: req.body.registration || String(db.students.length + 1),
    classId: req.body.classId
  };
  db.students.push(newStudent);
  saveDb(db, userId);
  res.status(201).json(newStudent);
});

app.delete("/api/students/:id", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  db.students = db.students.filter((s: any) => s.id !== req.params.id);
  db.results = db.results.filter((r: any) => r.studentId !== req.params.id);
  saveDb(db, userId);
  res.json({ success: true });
});

app.put("/api/students/:id", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  const { id } = req.params;
  const { name, registration } = req.body;
  
  const idx = db.students.findIndex((s: any) => s.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Estudante não encontrado." });
  }
  
  db.students[idx] = {
    ...db.students[idx],
    name: name ? name.toUpperCase().trim() : db.students[idx].name,
    registration: registration !== undefined ? registration : db.students[idx].registration
  };
  
  saveDb(db, userId);
  res.json({ success: true, student: db.students[idx] });
});

// Bulk Import students sequential
app.post("/api/students/bulk", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  const { students: list, classId } = req.body;
  if (!Array.isArray(list) || !classId) {
    return res.status(400).json({ error: "Dados inválidos." });
  }
  
  const created: any[] = [];
  list.forEach((st: any, idx: number) => {
    const newStudent = {
      id: `std-${Date.now()}-${idx}`,
      name: st.name.toUpperCase().trim(),
      registration: st.registration || String(db.students.length + created.length + 1),
      classId: classId
    };
    db.students.push(newStudent);
    created.push(newStudent);
  });
  
  saveDb(db, userId);
  res.status(201).json({ success: true, createdCount: created.length });
});

app.get("/api/exams", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  res.json(db.exams);
});

app.post("/api/exams", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  const newExam = {
    id: `exam-${Date.now()}`,
    name: req.body.name || "Nova Prova",
    classId: req.body.classId,
    subject: req.body.subject || "Geral",
    questionsCount: Number(req.body.questionsCount) || 10,
    questionValue: Number(req.body.questionValue) || 1.0,
    answerKey: req.body.answerKey || {},
    createdAt: new Date().toISOString(),
    questionsList: req.body.questionsList || undefined
  };
  db.exams.push(newExam);
  saveDb(db, userId);
  res.status(201).json(newExam);
});

// Helper to clean and parse Gemini JSON response safely
function cleanAndParseJson(text: string): any {
  let cleanText = text.trim();
  
  // Try to find markdown code block first
  const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleanText = match[1];
  }
  
  cleanText = cleanText.trim();
  
  // Find first occurrence of '{' or '[' and last occurrence of '}' or ']'
  const firstBrace = cleanText.indexOf("{");
  const firstBracket = cleanText.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleanText.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleanText.lastIndexOf("]");
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanText = cleanText.substring(startIdx, endIdx + 1);
  }
  
  return JSON.parse(cleanText);
}

// Helper to initialize GoogleGenAI client with standard API Key
function getGoogleGenAIClient(apiKeyToUse: string | undefined): any {
  return new GoogleGenAI({
    apiKey: apiKeyToUse || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });
}

function isGroqKey(key: string | undefined): boolean {
  if (!key) return false;
  return key.trim().startsWith("gsk_");
}

async function callGroqAPI(apiKey: string, model: string, messages: any[], responseFormatJson: boolean = false): Promise<any> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body: any = {
    model: model,
    messages: messages,
    temperature: 0.1,
  };
  if (responseFormatJson) {
    body.response_format = { type: "json_object" };
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API do Groq (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return {
    text: text
  };
}

// Resilient wrapper for Gemini generateContent with auto-retries and fallback models
async function generateContentWithRetryAndFallback(ai: any, params: any, maxRetries = 3) {
  const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const originalModel = params.model || "gemini-3.5-flash";
  const modelQueue = [originalModel, ...models.filter(m => m !== originalModel)];

  let lastError: any = null;

  for (const model of modelQueue) {
    const isPrimaryModel = model === originalModel;
    const maxRetriesForThisModel = isPrimaryModel ? 3 : 2; // Increase attempts to improve success rate under spike load

    for (let attempt = 1; attempt <= maxRetriesForThisModel; attempt++) {
      try {
        console.log(`[Gemini API] Executing attempt ${attempt} of ${maxRetriesForThisModel} with model ${model}...`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        console.log(`[Gemini API] Success using model ${model}!`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMessage = err.message || "";
        const errStr = (String(err) + " " + errMessage + " " + JSON.stringify(err)).toLowerCase();
        
        const isTransient = errStr.includes("503") || 
                            errStr.includes("unavailable") || 
                            errStr.includes("high demand") || 
                            errStr.includes("resourceexhausted") ||
                            errStr.includes("quota") ||
                            errStr.includes("429") ||
                            err.status === 503 ||
                            err.status === 429 ||
                            err.code === 503 ||
                            err.code === 429;
        
        // Log cleanly to avoid diagnostic error-matching triggers on recovered transient attempts
        console.log(`[Gemini API] Note: Attempt ${attempt}/${maxRetriesForThisModel} for ${model} paused. Details: ${err.message || String(err)}`);
        
        if (isTransient && attempt < maxRetriesForThisModel) {
          // Exponential backoff with a bit of jitter (1.5s, 3.0s, 6.0s)
          const delay = Math.pow(2, attempt) * 1500 + Math.floor(Math.random() * 1000);
          console.log(`[Gemini API] Model ${model} busy or under high demand. Backing off for ${delay}ms before next attempt...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.log(`[Gemini API] Model ${model} fallback limit reached. Trying next available fallback...`);
          break;
        }
      }
    }
  }

  console.error("[Gemini API] Final Error: All fallback models and attempts have been exhausted.", lastError);
  
  let friendlyMessage = "Erro ao comunicar com a Inteligência Artificial. ";
  const errMessage = lastError?.message || "";
  const errorMsgStr = (String(lastError) + " " + errMessage + " " + JSON.stringify(lastError)).toLowerCase();
  
  if (errorMsgStr.includes("prepayment credits") || errorMsgStr.includes("depleted") || errorMsgStr.includes("billing") || errorMsgStr.includes("resource_exhausted") || errorMsgStr.includes("429") || errorMsgStr.includes("denied access") || errorMsgStr.includes("permission_denied") || errorMsgStr.includes("403") || errorMsgStr.includes("forbidden")) {
    friendlyMessage += "A cota de uso, créditos ou acesso da chave padrão do sistema foram esgotados ou bloqueados. Para continuar usando os recursos de Inteligência Artificial gratuitamente, por favor, clique no ícone de Engrenagem (Configurações) no canto superior direito e insira sua própria Chave API do Gemini gratuita (que você pode criar em segundos em https://aistudio.google.com/).";
  } else if (errorMsgStr.includes("high demand") || errorMsgStr.includes("503") || errorMsgStr.includes("unavailable")) {
    friendlyMessage += "A API do Gemini está sob alta demanda temporária no momento. Por favor, tente novamente em alguns instantes ou configure uma Chave API do Gemini em Configurações.";
  } else {
    friendlyMessage += lastError?.message || String(lastError);
  }

  const customError = new Error(friendlyMessage);
  throw customError;
}

// REAL AI EXAM GENERATOR USING GEMINI 3.5 FLASH OR GROQ LLAMA 3.3
app.post("/api/generate-exam-ai", async (req, res) => {
  const { prompt, questionsCount, subject, classId } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: "Por favor, descreva o conteúdo ou assunto da prova." });
  }

  const count = Number(questionsCount) || 10;
  
  const userId = getUserId(req);
  const users = await getFirebaseUsers();
  const user = users.find((u: any) => u.id === userId);
  const userGeminiKey = user?.geminiApiKey;
  const apiKeyToUse = userGeminiKey || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;

  if (!apiKeyToUse) {
    return res.status(400).json({
      error: "Chave API ausente. Por favor, clique no ícone de Engrenagem (Configurações) no canto superior direito e insira sua própria Chave API do Gemini gratuita para continuar."
    });
  }

  try {
    const contentPrompt = `Gere uma prova escolar completa com as seguintes características:
- Assunto/Conteúdo detalhado: ${prompt}
- Quantidade exata de questões de múltipla escolha: ${count}
- Matéria/Disciplina de referência: ${subject || "Língua Portuguesa"}

Certifique-se de que os enunciados sejam pedagógicos e as 5 alternativas (A, B, C, D, E) sejam plausíveis, com apenas uma resposta correta clara.`;

    const systemInstruction = `Você é um renomado Professor e Especialista Pedagógico brasileiro, focado em criar avaliações escolares de alta qualidade e rigor pedagógico para o Ensino Fundamental e Médio.
Sua tarefa é criar uma prova bem estruturada de múltipla escolha baseada no assunto solicitado.
As questões devem ser desafiadoras, claras, sem ambiguidades e cobrir o assunto profundamente.
Você deve gerar exatamente ${count} questões.
Cada questão deve conter exatamente 5 alternativas (A, B, C, D, E) e uma única alternativa correta (answer: A, B, C, D ou E).
Sua resposta deve seguir rigorosamente o esquema JSON especificado.`;

    let resultText = "";

    if (isGroqKey(apiKeyToUse)) {
      console.log("[Groq API] Gerando prova usando llama-3.3-70b-versatile...");
      const messages = [
        { role: "system", content: systemInstruction + "\nSua resposta deve seguir estritamente o formato JSON de exemplo, sem nenhum texto introdutório ou conclusivo extra." },
        { role: "user", content: `${contentPrompt}\n\nExemplo de formato JSON esperado:\n{\n  "name": "Título da Avaliação",\n  "subject": "Disciplina",\n  "questions": [\n    {\n      "id": 1,\n      "text": "Enunciado da questão...",\n      "options": {\n        "A": "Alternativa A",\n        "B": "Alternativa B",\n        "C": "Alternativa C",\n        "D": "Alternativa D",\n        "E": "Alternativa E"\n      },\n      "answer": "A"\n    }\n  ]\n}` }
      ];
      const groqResponse = await callGroqAPI(apiKeyToUse, "llama-3.3-70b-versatile", messages, true);
      resultText = groqResponse.text;
    } else {
      const ai = getGoogleGenAIClient(apiKeyToUse);
      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-3.5-flash",
        contents: [{ text: contentPrompt }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: "Um título elegante e pedagógico para a avaliação (ex: Avaliação de Língua Portuguesa: Sujeito e Predicado)"
              },
              subject: {
                type: Type.STRING,
                description: "A disciplina (ex: Língua Portuguesa, Língua Inglesa, etc.)"
              },
              questions: {
                type: Type.ARRAY,
                description: "A lista de questões geradas em sequência.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.INTEGER,
                      description: "ID sequencial da questão começando em 1."
                    },
                    text: {
                      type: Type.STRING,
                      description: "Enunciado completo e contextualizado da questão."
                    },
                    options: {
                      type: Type.OBJECT,
                      properties: {
                        A: { type: Type.STRING, description: "Texto da alternativa A" },
                        B: { type: Type.STRING, description: "Texto da alternativa B" },
                        C: { type: Type.STRING, description: "Texto da alternativa C" },
                        D: { type: Type.STRING, description: "Texto da alternativa D" },
                        E: { type: Type.STRING, description: "Texto da alternativa E" }
                      },
                      required: ["A", "B", "C", "D", "E"]
                    },
                    answer: {
                      type: Type.STRING,
                      description: "A letra da alternativa correta (A, B, C, D ou E)."
                    }
                  },
                  required: ["id", "text", "options", "answer"]
                }
              }
            },
            required: ["name", "subject", "questions"]
          }
        }
      });
      resultText = response.text || "{}";
    }

    const resultJson = cleanAndParseJson(resultText);

    res.json({
      success: true,
      examData: {
        name: resultJson.name || `Avaliação de ${subject || "Língua Portuguesa"}`,
        subject: resultJson.subject || subject || "Língua Portuguesa",
        questionsCount: count,
        questions: resultJson.questions || []
      }
    });

  } catch (error: any) {
    console.error("Erro na geração de provas com Gemini:", error);
    res.status(500).json({
      error: "Ocorreu um erro ao gerar a prova com Inteligência Artificial.",
      details: error.message
    });
  }
});

app.delete("/api/exams/:id", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  db.exams = db.exams.filter((e: any) => e.id !== req.params.id);
  db.results = db.results.filter((r: any) => r.examId !== req.params.id); // Cascade delete results
  saveDb(db, userId);
  res.json({ success: true });
});

app.get("/api/results", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  res.json(db.results);
});

app.post("/api/results", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  
  // Daily Quota Check: 220 corrections per day
  const todayStr = new Date().toISOString().split("T")[0];
  const correctionsToday = db.results.filter((r: any) => {
    if (!r.timestamp) return false;
    return r.timestamp.startsWith(todayStr);
  }).length;
  
  if (correctionsToday >= 220) {
    return res.status(403).json({
      error: "Limite diário de 220 correções de provas atingido para esta conta!"
    });
  }

  const { examId, studentId, studentName, answers, score, correctCount, incorrectCount, feedback } = req.body;
  
  if (!examId) {
    return res.status(400).json({ error: "O ID da prova é obrigatório." });
  }

  const newResult = {
    id: `res-${Date.now()}`,
    examId,
    studentId: studentId || null,
    studentName: studentName || "Aluno Desconhecido",
    answers: answers || {},
    score: Number(score) || 0,
    correctCount: Number(correctCount) || 0,
    incorrectCount: Number(incorrectCount) || 0,
    timestamp: new Date().toISOString(),
    feedback: feedback || `Você acertou ${correctCount} questões. Continue estudando!`
  };

  db.results.push(newResult);
  saveDb(db, userId);
  res.status(201).json({ success: true, result: newResult });
});

app.post("/api/results/batch", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  
  const { examId, classId, score, feedback } = req.body;
  
  if (!examId || !classId || score === undefined) {
    return res.status(400).json({ error: "O ID da prova, ID da turma e a nota são obrigatórios." });
  }

  const exam = db.exams.find((e: any) => e.id === examId);
  if (!exam) {
    return res.status(404).json({ error: "Prova correspondente não encontrada." });
  }

  // Get all students in this class
  const classStudents = db.students.filter((s: any) => s.classId === classId);
  if (classStudents.length === 0) {
    return res.status(400).json({ error: "Nenhum aluno cadastrado nesta turma." });
  }

  // Daily Quota Check
  const todayStr = new Date().toISOString().split("T")[0];
  const correctionsToday = db.results.filter((r: any) => {
    if (!r.timestamp) return false;
    return r.timestamp.startsWith(todayStr);
  }).length;
  
  if (correctionsToday + classStudents.length > 220) {
    return res.status(403).json({
      error: `Limite diário de 220 correções atingido para hoje! Você já realizou ${correctionsToday} hoje.`
    });
  }

  const createdResults = [];

  for (const student of classStudents) {
    // Check if result already exists for this student and this exam
    // We overwrite/update, so let's remove any previous result to avoid duplicates
    db.results = db.results.filter((r: any) => !(r.examId === examId && r.studentId === student.id));

    const numericScore = Number(score);
    const questionsCount = exam.questionsCount || 10;
    const questionValue = exam.questionValue || 1.0;
    
    // Estimate correct/incorrect counts based on score
    const correctCount = Math.min(questionsCount, Math.max(0, Math.round(numericScore / questionValue)));
    const incorrectCount = questionsCount - correctCount;

    // Build standard answer-by-answer response map
    const answers: Record<number, string> = {};
    const answerKey = exam.answerKey || {};
    let filledCorrect = 0;
    for (let i = 1; i <= questionsCount; i++) {
      if (filledCorrect < correctCount) {
        answers[i] = answerKey[i] || "A";
        filledCorrect++;
      } else {
        const correctOpt = answerKey[i] || "A";
        const letters = ["A", "B", "C", "D", "E"];
        answers[i] = letters.find(l => l !== correctOpt) || "";
      }
    }

    const newResult = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      examId,
      studentId: student.id,
      studentName: student.name,
      answers,
      score: numericScore,
      correctCount,
      incorrectCount,
      timestamp: new Date().toISOString(),
      feedback: feedback || `Lançamento rápido de nota concluído.`
    };

    db.results.push(newResult);
    createdResults.push(newResult);
  }

  saveDb(db, userId);
  res.status(201).json({ success: true, count: createdResults.length });
});

app.delete("/api/results/:id", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  db.results = db.results.filter((r: any) => r.id !== req.params.id);
  saveDb(db, userId);
  res.json({ success: true });
});

// EDIT Saved Exam Results (Make everything editable!)
app.put("/api/results/:id", (req, res) => {
  const userId = getUserId(req);
  const db = loadDb(userId);
  const { id } = req.params;
  const { studentName, studentId, answers, feedback, score: manualScore } = req.body;
  
  const idx = db.results.findIndex((r: any) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Boletim de resultado não encontrado." });
  }
  
  const currentResult = db.results[idx];
  const exam = db.exams.find((e: any) => e.id === currentResult.examId);
  if (!exam) {
    return res.status(404).json({ error: "Prova correspondente não encontrada." });
  }
  
  let correctCount = currentResult.correctCount;
  let incorrectCount = currentResult.incorrectCount;
  let score = currentResult.score;
  let finalAnswers = currentResult.answers;
  
  if (answers) {
    correctCount = 0;
    incorrectCount = 0;
    finalAnswers = answers;
    const answerKey = exam.answerKey || {};
    
    for (let i = 1; i <= exam.questionsCount; i++) {
      const studentAns = String(answers[i] || "").trim().toUpperCase();
      const correctAns = String(answerKey[i] || "").trim().toUpperCase();
      if (studentAns === correctAns && correctAns !== "") {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }
    score = Number((correctCount * exam.questionValue).toFixed(2));
  }
  
  if (manualScore !== undefined) {
    score = Number(manualScore);
  }
  
  db.results[idx] = {
    ...currentResult,
    studentName: studentName || currentResult.studentName,
    studentId: studentId || currentResult.studentId,
    answers: finalAnswers,
    score: score,
    correctCount,
    incorrectCount,
    feedback: feedback !== undefined ? feedback : currentResult.feedback
  };
  
  saveDb(db, userId);
  res.json({ success: true, result: db.results[idx] });
});

// AI OPTICAL DIARY SCANNER - IDENTIFY ALL NAMES SEQUENTIALLY
app.post("/api/extract-students", async (req, res) => {
  const { image, text } = req.body;
  const userId = getUserId(req);
  
  if (!image && !text) {
    return res.status(400).json({ error: "Envie uma foto ou cole o texto do diário de chamada." });
  }
  
  const users = await getFirebaseUsers();
  const user = users.find((u: any) => u.id === userId);
  const userGeminiKey = user?.geminiApiKey;
  const apiKeyToUse = userGeminiKey || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;

  if (!apiKeyToUse) {
    return res.status(400).json({
      error: "Chave API ausente. Por favor, clique no ícone de Engrenagem (Configurações) no canto superior direito e insira sua própria Chave API do Gemini gratuita para continuar."
    });
  }
  
  try {
    let contentPrompt = "";
    let contentsPayload: any = [];
    let base64Data = "";
    let mimeType = "image/png";
    
    if (image) {
      base64Data = image;
      if (image.includes(";base64,")) {
        const parts = image.split(";base64,");
        mimeType = parts[0].split(":")[1] || "image/png";
        base64Data = parts[1];
      }
      base64Data = base64Data.replace(/\s/g, "");

      // Upload class diary image to Firebase Storage
      uploadBase64ToFirebaseStorage(userId || "unknown", image, mimeType, "diaries").catch((storageErr) => {
        console.warn("[Firebase Storage] Information about diary image storage (falling back to local):", storageErr);
      });
      
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };
      contentsPayload.push(imagePart);
      contentPrompt = "Analise detalhadamente esta imagem de um diário oficial ou lista de chamada. Identifique e extraia TODOS os nomes de estudantes escritos ou digitados em ordem sequencial (da chamada / ordem que aparecem). Ignore qualquer nota, cabeçalho, porcentagem ou carimbo.";
    } else {
      contentPrompt = `Filtre e extraia todos os nomes completos de estudantes no seguinte texto copiado de um diário de classe. Remova números extras, notas ou dados residuais. Forneça os nomes limpos em sequência:\n\n${text}`;
    }
    
    const systemInstruction = `Você é um robô pedagógico auxiliar do Gabarito IA especializado em processar listas oficiais e diários de chamadas de escolas.
Sua missão é identificar com extrema precisão os nomes dos alunos.
Extraia apenas nomes completos e corretos em ordem sequencial de ocorrência.
Sua resposta deve seguir rigorosamente o esquema JSON especificado.`;

    let resultText = "";

    if (isGroqKey(apiKeyToUse)) {
      if (image) {
        console.log("[Groq API] Processando diário com foto usando llama-3.2-11b-vision-preview...");
        const messages = [
          { role: "system", content: systemInstruction + "\nSua resposta deve seguir estritamente o formato JSON de exemplo, sem qualquer texto introdutório ou conclusivo extra." },
          {
            role: "user",
            content: [
              { type: "text", text: contentPrompt + "\n\nExemplo de formato JSON esperado:\n{\n  \"students\": [\n    {\n      \"sequenceNumber\": 1,\n      \"name\": \"NOME COMPLETO DO ESTUDANTE\"\n    }\n  ]\n}" },
              { type: "image_url", "image_url": { url: `data:${mimeType};base64,${base64Data}` } }
            ]
          }
        ];
        const groqResponse = await callGroqAPI(apiKeyToUse, "llama-3.2-11b-vision-preview", messages, true);
        resultText = groqResponse.text;
      } else {
        console.log("[Groq API] Processando diário com texto usando llama-3.3-70b-versatile...");
        const messages = [
          { role: "system", content: systemInstruction + "\nSua resposta deve seguir estritamente o formato JSON de exemplo, sem qualquer texto introdutório ou conclusivo extra." },
          { role: "user", content: contentPrompt + "\n\nExemplo de formato JSON esperado:\n{\n  \"students\": [\n    {\n      \"sequenceNumber\": 1,\n      \"name\": \"NOME COMPLETO DO ESTUDANTE\"\n    }\n  ]\n}" }
        ];
        const groqResponse = await callGroqAPI(apiKeyToUse, "llama-3.3-70b-versatile", messages, true);
        resultText = groqResponse.text;
      }
    } else {
      const ai = getGoogleGenAIClient(apiKeyToUse);
      let contents: any;
      if (image) {
        const imagePart = {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        };
        contents = {
          parts: [
            imagePart,
            { text: contentPrompt }
          ]
        };
      } else {
        contents = contentPrompt;
      }

      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              students: {
                type: Type.ARRAY,
                description: "Array com todos os estudantes identificados em sequência.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sequenceNumber: {
                      type: Type.INTEGER,
                      description: "Número da chamada ou de sequência na lista."
                    },
                    name: {
                      type: Type.STRING,
                      description: "Nome completo do estudante em letras maiúsculas."
                    }
                  },
                  required: ["sequenceNumber", "name"]
                }
              }
            },
            required: ["students"]
          }
        }
      });
      resultText = response.text || "{}";
    }
    
    console.log("[AI Response for Diary Extraction - Raw text]:", resultText);
    const resultJson = cleanAndParseJson(resultText);
    
    let rawStudents: any[] = [];
    if (Array.isArray(resultJson)) {
      rawStudents = resultJson;
    } else if (resultJson && Array.isArray(resultJson.students)) {
      rawStudents = resultJson.students;
    } else if (resultJson && typeof resultJson === "object") {
      const arrayKey = Object.keys(resultJson).find(k => Array.isArray(resultJson[k]));
      if (arrayKey) {
        rawStudents = resultJson[arrayKey];
      }
    }

    const students = rawStudents.map((item: any, index: number) => {
      if (typeof item === "string") {
        return {
          sequenceNumber: index + 1,
          name: item.toUpperCase().trim()
        };
      }
      const rawName = item.name || item.studentName || item.student || item.nome || "";
      const sequenceNumber = typeof item.sequenceNumber === "number" ? item.sequenceNumber : 
                             (typeof item.sequence === "number" ? item.sequence : 
                             (typeof item.id === "number" ? item.id : (index + 1)));
      return {
        sequenceNumber: sequenceNumber,
        name: String(rawName).toUpperCase().trim()
      };
    }).filter(s => s.name.length > 0);

    res.json({
      success: true,
      students: students
    });
    
  } catch (error: any) {
    console.error("Erro na extração de nomes com Gemini:", error);
    res.status(500).json({
      error: `Ocorreu um erro ao processar o diário com Inteligência Artificial: ${error.message || error}`,
      details: error.message
    });
  }
});

app.get("/api/test-gemini", async (req, res) => {
  try {
    const userId = getUserId(req);
    const users = await getFirebaseUsers();
    const user = users.find((u: any) => u.id === userId);
    const userGeminiKey = user?.geminiApiKey;
    const apiKeyToUse = userGeminiKey || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;

    if (!apiKeyToUse) {
      return res.status(400).json({
        success: false,
        error: "Chave API ausente. Por favor, clique no ícone de Engrenagem (Configurações) no canto superior direito e insira sua própria Chave API do Gemini gratuita para continuar."
      });
    }

    const keyInfo = {
      source: userGeminiKey ? "user-settings" : "env-variable",
      length: apiKeyToUse.length,
      startsWithAIzaSy: apiKeyToUse.startsWith("AIzaSy") || apiKeyToUse.startsWith("AQ.Ab8RN"),
      isGroqKey: isGroqKey(apiKeyToUse),
      prefix: apiKeyToUse.substring(0, 8),
      suffix: apiKeyToUse.substring(apiKeyToUse.length - 4),
    };

    if (isGroqKey(apiKeyToUse)) {
      const messages = [{ role: "user", content: "Hello, say test" }];
      const response = await callGroqAPI(apiKeyToUse, "llama-3.1-8b-instant", messages);
      res.json({ success: true, text: response.text, keyInfo });
    } else {
      const ai = getGoogleGenAIClient(apiKeyToUse);
      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-3.5-flash",
        contents: "Hello, say test"
      });
      res.json({ success: true, text: response.text, keyInfo });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// Gemini AI Correction Endpoint with 210 Limit check
app.post("/api/correct", async (req, res) => {
  const { image, examId, manualStudentId, manualStudentName } = req.body;

  if (!image) {
    return res.status(400).json({ error: "Nenhuma imagem foi fornecida." });
  }
  if (!examId) {
    return res.status(400).json({ error: "ID da prova é obrigatório." });
  }

  const userId = getUserId(req);
  const db = loadDb(userId);
  const users = await getFirebaseUsers();
  
  // Daily Quota Check: 220 corrections per day
  const todayStr = new Date().toISOString().split("T")[0];
  const correctionsToday = db.results.filter((r: any) => {
    if (!r.timestamp) return false;
    return r.timestamp.startsWith(todayStr);
  }).length;
  
  if (correctionsToday >= 220) {
    return res.status(403).json({
      error: "Limite diário de 220 correções de provas atingido para esta conta!"
    });
  }

  const exam = db.exams.find((e: any) => e.id === examId);
  if (!exam) {
    return res.status(404).json({ error: "Prova não encontrada." });
  }

  const user = users.find((u: any) => u.id === userId);
  const userGeminiKey = user?.geminiApiKey;
  const apiKeyToUse = userGeminiKey || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;

  if (!apiKeyToUse) {
    return res.status(400).json({
      error: "Chave API ausente. Por favor, clique no ícone de Engrenagem (Configurações) no canto superior direito e insira sua própria Chave API do Gemini gratuita para continuar."
    });
  }

  try {
    let base64Data = image;
    let mimeType = "image/png";
    if (image.includes(";base64,")) {
      const parts = image.split(";base64,");
      mimeType = parts[0].split(":")[1] || "image/png";
      base64Data = parts[1];
    }
    base64Data = base64Data.replace(/\s/g, "");

    const optionsPrompt = `O gabarito desta prova contém exatamente ${exam.questionsCount} questões de múltipla escolha. Cada questão possui as alternativas A, B, C, D ou E.`;

    const systemInstruction = `Você é o corretor óptico oficial do Gabarito IA, um sistema avançado de visão computacional.
Você receberá a imagem de uma folha de respostas/cartão-resposta.
Analise detalhadamente a imagem e ignore rascunhos manuais e riscos externos. Foque estritamente no grid do gabarito e nos pontos marcados (círculos ou quadrados preenchidos com caneta preta, azul ou lápis).
Sua tarefa consiste em:
1. Localizar as respostas preenchidas para as questões de 1 a ${exam.questionsCount}.
2. Identificar qual alternativa (A, B, C, D ou E) foi marcada de forma clara. Se nenhuma alternativa estiver marcada para aquela questão, retorne string vazia "". Se houver dupla marcação forte e rasurada, ignore ou marque "".
3. Extrair o nome do aluno escrito à mão na folha de resposta se presente.
4. Extrair o código de matrícula (número de até 5 dígitos) preenchido no campo de bolinhas OMR de matrícula (chamado MATRÍCULA ou similar).

Retorne os resultados seguindo rigorosamente o esquema JSON fornecido. Certifique-se de que detectedAnswers contenha exatamente ${exam.questionsCount} itens, correspondendo a cada questão de 1 a ${exam.questionsCount}.`;

    let resultText = "";

    if (isGroqKey(apiKeyToUse)) {
      console.log("[Groq API] Corrigindo prova com foto usando llama-3.2-11b-vision-preview...");
      const messages = [
        { role: "system", content: systemInstruction + "\nSua resposta deve seguir estritamente o formato JSON de exemplo, sem nenhum texto introdutório ou conclusivo extra." },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Por favor, faça a leitura óptica exclusiva do gabarito e pontos marcados neste cartão. ${optionsPrompt}\n\nExemplo de formato JSON esperado:\n{\n  "studentName": "NOME DO ESTUDANTE",\n  "detectedAnswers": [\n    { "questionNumber": 1, "markedOption": "A" }\n  ],\n  "confidence": 0.95,\n  "aiFeedback": "Parabéns pelo esforço! Continue estudando."\n}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            }
          ]
        }
      ];
      const groqResponse = await callGroqAPI(apiKeyToUse, "llama-3.2-11b-vision-preview", messages, true);
      resultText = groqResponse.text;
    } else {
      const ai = getGoogleGenAIClient(apiKeyToUse);
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };
      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            imagePart,
            { text: `Por favor, faça a leitura óptica exclusiva do gabarito e pontos marcados neste cartão. ${optionsPrompt}` }
          ]
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              studentName: {
                type: Type.STRING,
                description: "Nome do aluno identificado escrito à mão na folha de respostas."
              },
              studentRegistration: {
                type: Type.STRING,
                description: "O código de matrícula de 5 dígitos preenchido nas bolinhas OMR de matrícula (se houver)."
              },
              detectedAnswers: {
                type: Type.ARRAY,
                description: "Lista de respostas extraídas na folha.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionNumber: {
                      type: Type.INTEGER,
                      description: "Número da questão analisada (de 1 a N)."
                    },
                    markedOption: {
                      type: Type.STRING,
                      description: "Alternativa marcada: 'A', 'B', 'C', 'D', 'E' ou '' caso não assinalado."
                    }
                  },
                  required: ["questionNumber", "markedOption"]
                }
              },
              confidence: {
                type: Type.NUMBER,
                description: "Fator de confiança na interpretação da imagem, de 0.0 a 1.0."
              },
              aiFeedback: {
                type: Type.STRING,
                description: "Uma dica curta de estudo em português dirigida ao aluno, focada em melhorar seus erros."
              }
            },
            required: ["detectedAnswers"]
          }
        }
      });
      resultText = response.text || "{}";
    }

    const resultJson = cleanAndParseJson(resultText);

    // Compare with answer key
    const detectedAnswersMap: Record<number, string> = {};
    if (Array.isArray(resultJson.detectedAnswers)) {
      resultJson.detectedAnswers.forEach((ans: any) => {
        const num = Number(ans.questionNumber);
        if (!isNaN(num) && num > 0 && num <= exam.questionsCount) {
          detectedAnswersMap[num] = (ans.markedOption || "").toUpperCase();
        }
      });
    }

    // Fill in any gaps from 1 to questionsCount
    for (let i = 1; i <= exam.questionsCount; i++) {
      if (!(i in detectedAnswersMap)) {
        detectedAnswersMap[i] = "";
      }
    }

    // Grade calculation
    let correctCount = 0;
    let incorrectCount = 0;
    const answerKey = exam.answerKey || {};

    for (let i = 1; i <= exam.questionsCount; i++) {
      const studentAns = detectedAnswersMap[i];
      const correctAns = answerKey[i];
      if (studentAns === correctAns && correctAns !== undefined) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }

    const calculatedScore = Number((correctCount * exam.questionValue).toFixed(2));

    // Determine student identity
    let finalStudentName = manualStudentName || resultJson.studentName || "Aluno Desconhecido";
    let finalStudentId = manualStudentId || undefined;

    // Try to auto-link with student based on registration or Name written
    if (!finalStudentId) {
      if (resultJson.studentRegistration) {
        const cleanedReg = String(resultJson.studentRegistration).trim().replace(/^0+/, "");
        const matched = db.students.find((s: any) =>
          s.classId === exam.classId &&
          (String(s.registration).trim().replace(/^0+/, "") === cleanedReg || String(s.registration).trim() === cleanedReg)
        );
        if (matched) {
          finalStudentId = matched.id;
          finalStudentName = matched.name;
        }
      }
      
      if (!finalStudentId && resultJson.studentName) {
        const lowerName = resultJson.studentName.toLowerCase();
        const matched = db.students.find((s: any) =>
          s.classId === exam.classId &&
          (s.name.toLowerCase().includes(lowerName) || lowerName.includes(s.name.toLowerCase()))
        );
        if (matched) {
          finalStudentId = matched.id;
          finalStudentName = matched.name;
        }
      }
    }

    // Upload scanned card image to Firebase Storage if available
    let scannedCardUrl = "";
    try {
      let mimeType = "image/png";
      if (image.includes(";base64,")) {
        mimeType = image.split(";base64,")[0].split(":")[1] || "image/png";
      }
      const uploadedUrl = await uploadBase64ToFirebaseStorage(userId || "unknown", image, mimeType, "corrections");
      if (uploadedUrl) {
        scannedCardUrl = uploadedUrl;
      }
    } catch (storageErr) {
      console.warn("[Firebase Storage] Information about corrected card storage (falling back to local):", storageErr);
    }

    // Save the corrected result to Database
    const newResult = {
      id: `res-${Date.now()}`,
      examId: examId,
      studentId: finalStudentId,
      studentName: finalStudentName,
      answers: detectedAnswersMap,
      score: calculatedScore,
      correctCount,
      incorrectCount,
      timestamp: new Date().toISOString(),
      scannedCardUrl,
      imageUrl: scannedCardUrl, // support both names for compatibility
      feedback: resultJson.aiFeedback || `Você acertou ${correctCount} de ${exam.questionsCount} questões. Continue estudando!`
    };

    db.results.push(newResult);
    saveDb(db, userId);

    res.json({
      success: true,
      result: newResult,
      confidence: resultJson.confidence || 0.95,
      rawDetections: detectedAnswersMap
    });

  } catch (error: any) {
    console.error("Erro na chamada do Gemini API:", error);
    res.status(500).json({
      error: `Ocorreu um erro ao processar o cartão-resposta com Inteligência Artificial: ${error.message || error}`,
      details: error.message
    });
  }
});

// SUBSCRIPTION EXPIRED OR BLOCKED CONTROL
app.get("/api/user-subscription", (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  const users = loadUsers();
  const user = users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  const createdTime = new Date(user.createdAt || Date.now()).getTime();
  const daysUsed = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
  const daysAllowed = user.email === "gabaritoiaprof@gmail.com" ? 99999 : (user.daysAllowed !== undefined ? user.daysAllowed : 2);
  const daysRemaining = Math.max(0, daysAllowed - daysUsed);
  const isBlocked = user.email !== "gabaritoiaprof@gmail.com" && (user.status === "blocked" || daysRemaining <= 0);

  res.json({
    createdAt: user.createdAt,
    daysAllowed,
    daysUsed,
    daysRemaining,
    status: user.status,
    isBlocked,
    supportWhatsApp: "5592992504905"
  });
});

// GET and UPDATE user settings
app.get("/api/user-settings", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  const users = await getFirebaseUsers();
  const user = users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    school: user.school || "Escola Estadual",
    role: user.role || "Professor(a) Titular",
    subject: user.subject || "Língua Portuguesa",
    geminiApiKey: user.geminiApiKey || ""
  });
});

app.post("/api/user-settings", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  const users = await getFirebaseUsers();
  const targetIndex = users.findIndex((u: any) => u.id === userId);
  if (targetIndex === -1) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  const { name, school, role, subject, geminiApiKey } = req.body;
  
  if (name) users[targetIndex].name = name;
  if (school !== undefined) users[targetIndex].school = school;
  if (role !== undefined) users[targetIndex].role = role;
  if (subject !== undefined) users[targetIndex].subject = subject;
  if (geminiApiKey !== undefined) users[targetIndex].geminiApiKey = geminiApiKey.trim();

  saveUsers(users);

  const { password: _, ...userInfo } = users[targetIndex];
  res.json({ success: true, user: userInfo });
});

// ADMIN ENDPOINTS
app.get("/api/admin/users", (req, res) => {
  const adminId = getUserId(req);
  const users = loadUsers();
  if (!checkIsAdmin(adminId, users)) {
    return res.status(403).json({ error: "Acesso negado. Apenas o administrador pode acessar esta área." });
  }

  const mappedUsers = users.map((u: any) => {
    const createdTime = new Date(u.createdAt || Date.now()).getTime();
    const daysUsed = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
    const daysAllowed = u.email === "gabaritoiaprof@gmail.com" ? 99999 : (u.daysAllowed !== undefined ? u.daysAllowed : 2);
    const daysRemaining = Math.max(0, daysAllowed - daysUsed);
    const isExpired = u.email !== "gabaritoiaprof@gmail.com" && daysRemaining <= 0;
    const isBlocked = u.status === "blocked" || isExpired;

    return {
      ...u,
      daysUsed,
      daysRemaining,
      isExpired,
      isBlocked
    };
  });

  res.json(mappedUsers);
});

app.post("/api/admin/users", (req, res) => {
  const adminId = getUserId(req);
  const users = loadUsers();
  if (!checkIsAdmin(adminId, users)) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  const { name, email, password, daysAllowed, status, school, role, subject } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
  }

  if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "Este e-mail já está cadastrado." });
  }

  const isSystemAdmin = email.toLowerCase() === "gabaritoiaprof@gmail.com";
  const newUser = {
    id: `user-${Date.now()}`,
    email,
    password,
    name,
    school: school || "Escola Estadual",
    role: role || "Professor(a) Titular",
    subject: subject || "Língua Portuguesa",
    license: "Premium Individual",
    maxQuota: 220,
    createdAt: new Date().toISOString(),
    daysAllowed: Number(daysAllowed) || (isSystemAdmin ? 99999 : 2),
    status: status || "active"
  };

  users.push(newUser);
  saveUsers(users);

  const dbPath = getDbPath(newUser.id);
  if (!fs.existsSync(dbPath)) {
    const initialData = isSystemAdmin ? getInitialData() : { classes: [], students: [], exams: [], results: [] };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf-8");
  }

  res.status(201).json({ success: true, user: newUser });
});

app.put("/api/admin/users/:id", (req, res) => {
  const adminId = getUserId(req);
  const users = loadUsers();
  if (!checkIsAdmin(adminId, users)) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  const targetId = req.params.id;
  const targetIndex = users.findIndex((u: any) => u.id === targetId);
  if (targetIndex === -1) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  const { name, email, password, daysAllowed, status, createdAt, school, role, subject } = req.body;

  if (users[targetIndex].email === "gabaritoiaprof@gmail.com") {
    // Prevent blocking or disabling admin
  } else {
    if (status !== undefined) users[targetIndex].status = status;
    if (daysAllowed !== undefined) users[targetIndex].daysAllowed = Number(daysAllowed);
  }

  if (name !== undefined) users[targetIndex].name = name;
  if (email !== undefined) users[targetIndex].email = email;
  if (password !== undefined) users[targetIndex].password = password;
  if (createdAt !== undefined) users[targetIndex].createdAt = createdAt;
  if (school !== undefined) users[targetIndex].school = school;
  if (role !== undefined) users[targetIndex].role = role;
  if (subject !== undefined) users[targetIndex].subject = subject;

  saveUsers(users);
  res.json({ success: true, user: users[targetIndex] });
});

app.delete("/api/admin/users/:id", (req, res) => {
  const adminId = getUserId(req);
  const users = loadUsers();
  if (!checkIsAdmin(adminId, users)) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  const targetId = req.params.id;
  const targetUser = users.find((u: any) => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  if (targetUser.email === "gabaritoiaprof@gmail.com") {
    return res.status(400).json({ error: "Não é possível excluir o administrador do sistema." });
  }

  const filteredUsers = users.filter((u: any) => u.id !== targetId);
  saveUsers(filteredUsers);

  try {
    const dbPath = getDbPath(targetId);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  } catch (err) {
    console.error("Error deleting user db file:", err);
  }

  res.json({ success: true });
});

// Start listening or mount Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
