import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  initializeAuth
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  collection, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  writeBatch, 
  getDocFromServer, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove, 
  updateDoc, 
  addDoc, 
  increment,
  enableNetwork 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import firebaseConfigImport from '../../firebase-applet-config.json';

// Support environment variables for Vercel deployment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigImport.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigImport.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigImport.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigImport.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigImport.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigImport.appId,
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigImport.firestoreDatabaseId;

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use initializeAuth with specific persistence and resolver
// We use indexedDBLocalPersistence for better compatibility in iframes, 
// but fallback to browserLocalPersistence which is standard for web.
let authInstance;
try {
  // Check if we are in an iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  authInstance = initializeAuth(app, {
    persistence: isInIframe ? indexedDBLocalPersistence : browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch (e) {
  // If already initialized or fails, use getAuth
  authInstance = getAuth(app);
}

export const auth = authInstance;

// Use initializeFirestore with long polling for maximum compatibility in iframes/mobile
let dbInstance;
const dbSettings = {
  experimentalForceLongPolling: true,
};

try {
  // Try to use the named database if provided
  const dbId = firestoreDatabaseId && firestoreDatabaseId !== '(default)' ? firestoreDatabaseId : undefined;
  dbInstance = initializeFirestore(app, dbSettings, dbId);
} catch (e) {
  console.error('Failed to initialize Firestore, falling back to default:', e);
  dbInstance = initializeFirestore(app, dbSettings);
}

export const db = dbInstance;

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Force network connection
export { signInWithPopup, signOut, onAuthStateChanged, doc, collection, setDoc, getDoc, getDocs, onSnapshot, query, where, deleteDoc, writeBatch, serverTimestamp, arrayUnion, arrayRemove, updateDoc, addDoc, increment, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject };
export type { User };

// Error Handling Types
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isOffline = errMessage.toLowerCase().includes('offline') || 
                    errMessage.toLowerCase().includes('network') ||
                    !window.navigator.onLine;
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };

  // Log detailed error for debugging
  console.error('Firestore Error Detail:', {
    message: errMessage,
    operation: operationType,
    path: path,
    databaseId: firestoreDatabaseId,
    projectId: firebaseConfig.projectId,
    isOffline,
    fullError: error
  });

  // For background sync operations (onSnapshot), we can just warn if offline
  if (isOffline && (operationType === OperationType.GET || operationType === OperationType.LIST)) {
    console.warn(`[Firestore] ${operationType} operation on ${path} is pending due to offline state.`);
    return;
  }

  throw new Error(JSON.stringify(errInfo));
}

/**
 * Sanitizes data for Firestore by removing undefined values recursively.
 * Preserves Firestore special objects like serverTimestamp, increment, etc.
 */
export function sanitizeData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // If it's a Firestore special object (FieldValue, etc.), return as is
  // These objects typically have a specific internal structure or are not plain objects
  if (data.constructor && data.constructor.name !== 'Object' && !Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      if (value !== undefined) {
        sanitized[key] = sanitizeData(value);
      }
    }
  }
  return sanitized;
}

// Removed testFirestoreConnection to avoid false positive error messages in the UI
// The SDK's own error handling and our handleFirestoreError will manage real issues.
