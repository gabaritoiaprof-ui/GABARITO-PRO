import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import fs from "fs";
import path from "path";
import firebaseConfig from "../../firebase-applet-config.json";

// Local file fallbacks
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
          console.log(`[Firebase Server] Copied ${file} to ${DATA_DIR}`);
        }
      }
    } catch (err) {
      console.error("[Firebase Server] Error copying pre-seeded data:", err);
    }
  }
}

const LOCAL_USERS_PATH = path.join(DATA_DIR, "users.json");
const getLocalDbPath = (userId?: string) => {
  if (!userId || userId === "null" || userId === "undefined") {
    return path.join(DATA_DIR, "db.json");
  }
  const safeId = String(userId).replace(/[^a-zA-Z0-9_\-@.]/g, "_");
  return path.join(DATA_DIR, `db_${safeId}.json`);
};

// Check if Firebase is using default placeholder credentials
const isPlaceholderFirebase = 
  !firebaseConfig.projectId || 
  firebaseConfig.projectId.includes("remixed-") || 
  firebaseConfig.projectId === "placeholder-project-id" ||
  firebaseConfig.projectId === "gen-lang-client-0135885791";

// Initialize Firebase App only if we have real credentials
let db: any = null;
let storage: any = null;
let auth: any = null;
if (!isPlaceholderFirebase) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    storage = getStorage(app);
    auth = getAuth(app);
    console.log("[Firebase Server] Real Firebase credentials detected. Connected to Firestore, Storage, and Auth.");
  } catch (e) {
    console.error("[Firebase Server] Failed to initialize Firebase:", e);
  }
} else {
  console.log("[Firebase Server] Placeholder credentials detected. Operating in local JSON mode.");
}

// Helper to detect and handle Firestore permission/billing errors
function handleFirestoreError(error: any, context: string) {
  const errStr = String(error).toLowerCase();
  if (
    errStr.includes("permission_denied") ||
    errStr.includes("permission-denied") ||
    errStr.includes("billing") ||
    errStr.includes("unauthorized") ||
    errStr.includes("offline") ||
    errStr.includes("7") ||
    errStr.includes("code: 7")
  ) {
    console.warn(`[Firebase Server] Firestore custom DB is not authorized or billing is not enabled (${context}). Disabling Cloud Firestore permanently and running in ultra-reliable Local JSON mode.`);
    db = null;
  }
}

/**
 * Perform actual registration using Firebase Authentication (Email/Password)
 */
export async function firebaseRegisterUser(email: string, password: string): Promise<any> {
  if (!auth) {
    console.log("[Firebase Auth] Auth not initialized, skipping.");
    return null;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`[Firebase Auth] User successfully registered: ${email}`);
    return userCredential.user;
  } catch (error: any) {
    console.error(`[Firebase Auth] Register error for ${email}:`, error);
    throw error;
  }
}

/**
 * Perform actual sign-in using Firebase Authentication (Email/Password)
 */
export async function firebaseLoginUser(email: string, password: string): Promise<any> {
  if (!auth) {
    console.log("[Firebase Auth] Auth not initialized, skipping.");
    return null;
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(`[Firebase Auth] User successfully signed in: ${email}`);
    return userCredential.user;
  } catch (error: any) {
    console.error(`[Firebase Auth] Sign-in error for ${email}:`, error);
    throw error;
  }
}

// Helper to remove/sanitize undefined values for Firestore
function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  if (typeof obj === "object") {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        newObj[key] = sanitizeForFirestore(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Core Data Helpers with Cloud Persistence and local fallback
export async function getFirebaseUsers(): Promise<any[]> {
  if (db) {
    try {
      const colRef = collection(db, "users");
      const querySnapshot = await getDocs(colRef);
      const users: any[] = [];
      querySnapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      if (users.length > 0) {
        // Save locally to keep in sync
        fs.writeFileSync(LOCAL_USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
        return users;
      }
    } catch (error) {
      console.error("[Firebase Server] Failed to fetch users from Firestore, using local fallback:", error);
      handleFirestoreError(error, "getFirebaseUsers");
    }
  }
  
  // Local fallback
  if (fs.existsSync(LOCAL_USERS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_USERS_PATH, "utf-8"));
    } catch (_) {
      return [];
    }
  }
  return [];
}

export async function saveFirebaseUser(user: any): Promise<void> {
  const userId = user.id;
  if (db) {
    try {
      const userDocRef = doc(db, "users", userId);
      // Remove id from the document data to avoid redundancy
      const { id, ...userData } = user;
      const sanitized = sanitizeForFirestore(userData);
      await setDoc(userDocRef, sanitized, { merge: true });
      console.log(`[Firebase Server] Synced user ${userId} to Firestore.`);
    } catch (error) {
      console.error(`[Firebase Server] Failed to sync user ${userId} to Firestore:`, error);
      handleFirestoreError(error, "saveFirebaseUser");
    }
  }

  // Always update locally too
  try {
    let users = [];
    if (fs.existsSync(LOCAL_USERS_PATH)) {
      users = JSON.parse(fs.readFileSync(LOCAL_USERS_PATH, "utf-8"));
    }
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    fs.writeFileSync(LOCAL_USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    console.error("[Firebase Server] Failed to write user locally:", e);
  }
}

export async function getFirebaseUserData(userId: string): Promise<any> {
  if (db) {
    try {
      const userDocRef = doc(db, "user_databases", userId);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Ensure all fields are arrays
        const normalized = {
          classes: data.classes || [],
          students: data.students || [],
          exams: data.exams || [],
          results: data.results || []
        };
        // Keep local copy in sync only if it wasn't updated recently
        const localPath = getLocalDbPath(userId);
        let shouldOverwrite = true;
        try {
          if (fs.existsSync(localPath)) {
            const stats = fs.statSync(localPath);
            // If modified within the last 15 seconds, prioritize local modifications
            if (Date.now() - stats.mtimeMs < 15000) {
              shouldOverwrite = false;
              console.log(`[Firebase Server] Skipping local copy sync from Firestore for ${userId} (modified recently).`);
            }
          }
        } catch (_) {}

        if (shouldOverwrite) {
          fs.writeFileSync(localPath, JSON.stringify(normalized, null, 2), "utf-8");
        }
        return normalized;
      }
    } catch (error) {
      console.error(`[Firebase Server] Failed to get database for ${userId} from Firestore, falling back to local:`, error);
      handleFirestoreError(error, "getFirebaseUserData");
    }
  }

  // Local fallback
  const localPath = getLocalDbPath(userId);
  if (fs.existsSync(localPath)) {
    try {
      return JSON.parse(fs.readFileSync(localPath, "utf-8"));
    } catch (_) {
      return { classes: [], students: [], exams: [], results: [] };
    }
  }
  
  return { classes: [], students: [], exams: [], results: [] };
}

export async function saveFirebaseUserData(userId: string, data: any): Promise<void> {
  // 1. Write locally first for instant availability
  try {
    fs.writeFileSync(getLocalDbPath(userId), JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[Firebase Server] Failed to save DB locally:", e);
  }

  // 2. Write to Firestore in cloud if db is active
  if (db) {
    try {
      const userDocRef = doc(db, "user_databases", userId);
      const payload = {
        classes: data.classes || [],
        students: data.students || [],
        exams: data.exams || [],
        results: data.results || [],
        updatedAt: new Date().toISOString()
      };
      const sanitized = sanitizeForFirestore(payload);
      await setDoc(userDocRef, sanitized);
      console.log(`[Firebase Server] Database for user ${userId} saved to Firestore.`);
    } catch (error) {
      console.error(`[Firebase Server] Failed to save database for ${userId} to Firestore:`, error);
      handleFirestoreError(error, "saveFirebaseUserData");
    }
  }
}

/**
 * Uploads a base64 encoded image/file to Firebase Storage under users/{userId}/{folder}/{filename}
 * Returns the download URL or null on failure.
 */
export async function uploadBase64ToFirebaseStorage(
  userId: string,
  base64Data: string,
  mimeType: string,
  folder: string = "uploads"
): Promise<string | null> {
  let cleanBase64 = base64Data;
  let actualMimeType = mimeType;
  if (base64Data.includes(";base64,")) {
    const parts = base64Data.split(";base64,");
    actualMimeType = parts[0].split(":")[1] || mimeType;
    cleanBase64 = parts[1];
  }
  // Remove extra whitespaces
  cleanBase64 = cleanBase64.replace(/\s/g, "");

  const extension = actualMimeType.split("/")[1] || "png";
  const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;

  const saveLocally = () => {
    try {
      const uploadsDir = (process.env.VERCEL || process.env.NODE_ENV === "production" || !fs.existsSync(path.join(process.cwd(), "src")))
        ? path.join("/tmp", "uploads")
        : path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const localFilePath = path.join(uploadsDir, filename);
      fs.writeFileSync(localFilePath, Buffer.from(cleanBase64, "base64"));
      console.log(`[Firebase Storage Fallback] Saved file locally because Firebase Storage is unavailable/unauthorized: /uploads/${filename}`);
      return `/uploads/${filename}`;
    } catch (err) {
      console.error("[Firebase Storage Fallback] Failed to save file locally:", err);
      return null;
    }
  };

  if (!storage) {
    console.log("[Firebase Storage] No storage instance available. Operating in local mode.");
    return saveLocally();
  }

  try {
    const storagePath = `users/${userId}/${folder}/${filename}`;
    const storageRef = ref(storage, storagePath);
    await uploadString(storageRef, cleanBase64, "base64", {
      contentType: actualMimeType,
    });

    const downloadUrl = await getDownloadURL(storageRef);
    console.log(`[Firebase Storage] Uploaded file to: ${storagePath}. URL: ${downloadUrl}`);
    return downloadUrl;
  } catch (error) {
    const errStr = String(error).toLowerCase();
    if (errStr.includes("unauthorized") || errStr.includes("permission") || errStr.includes("denied") || errStr.includes("quota")) {
      console.warn(`[Firebase Storage] Storage is not authorized or quota exceeded. Disabling Cloud Storage and using local uploads instead. Error was: ${error}`);
      storage = null;
    } else {
      console.warn(`[Firebase Storage Information] Upload fell back for user ${userId} to local storage. (Real Firebase Storage not configured or locked: ${error})`);
    }
    console.log("[Firebase Storage Fallback] Falling back to local storage...");
    return saveLocally();
  }
}

