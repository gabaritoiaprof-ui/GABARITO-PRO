import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase on the client side
const getClientFirebaseApp = () => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

const app = getClientFirebaseApp();
const auth = getAuth(app);

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
];

let cachedToken: string | null = null;
let googleUser: any = null;

export async function connectGoogleDrive(): Promise<{ token: string; user: any }> {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach(scope => provider.addScope(scope));
  
  provider.setCustomParameters({
    prompt: "consent"
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) {
      throw new Error("Não foi possível obter o Token de Acesso do Google.");
    }
    cachedToken = credential.accessToken;
    googleUser = result.user;
    
    localStorage.setItem("gdrive_connected", "true");
    return { token: cachedToken, user: googleUser };
  } catch (error) {
    console.error("Error connecting to Google Drive:", error);
    throw error;
  }
}

export function getCachedToken(): string | null {
  return cachedToken;
}

export function setCachedToken(token: string | null) {
  cachedToken = token;
}

export function isDriveConnected(): boolean {
  return !!cachedToken || localStorage.getItem("gdrive_connected") === "true";
}

export async function disconnectGoogleDrive(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("SignOut failed but cleaning cache anyway", e);
  }
  cachedToken = null;
  googleUser = null;
  localStorage.removeItem("gdrive_connected");
}

// REST API helper to list files
export async function listDriveFiles(token: string, q = ""): Promise<any[]> {
  const url = `https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,thumbnailLink)&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error(`Erro do Google Drive API: ${res.statusText}`);
  }
  const data = await res.json();
  return data.files || [];
}

// REST API helper to find or create a folder
export async function findOrCreateFolder(token: string, folderName: string): Promise<string> {
  const searchQ = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const files = await listDriveFiles(token, searchQ);
  if (files && files.length > 0) {
    return files[0].id;
  }

  const url = "https://www.googleapis.com/drive/v3/files";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder"
    })
  });

  if (!res.ok) {
    throw new Error(`Falha ao criar pasta: ${res.statusText}`);
  }
  const data = await res.json();
  return data.id;
}

// REST API helper to upload a text/csv file
export async function uploadFileToFolder(
  token: string,
  folderId: string,
  fileName: string,
  content: string,
  mimeType = "text/csv"
): Promise<string> {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: mimeType
  };

  const boundary = "314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    content +
    closeDelimiter;

  const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload falhou: ${res.statusText} (${errText})`);
  }

  const data = await res.json();
  return data.id;
}

// Download file content
export async function downloadFileContent(token: string, fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo: ${res.statusText}`);
  }
  return await res.text();
}
