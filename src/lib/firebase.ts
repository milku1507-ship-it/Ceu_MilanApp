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

// Use initializeAuth with specific persistence and resolver to fix "Pending promise was never set" errors
// This is more robust in iframes and complex browser environments
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: indexedDBLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch (e) {
  console.warn('Auth already initialized or failed to initialize with custom settings, falling back to getAuth');
  authInstance = getAuth(app);
}

export const auth = authInstance;

// Use initializeFirestore with long polling and disabled fetch streams for maximum compatibility
let dbInstance;
const dbSettings = {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
};

try {
  // Try to use the named database if provided
  const dbId = firestoreDatabaseId && firestoreDatabaseId !== '(default)' ? firestoreDatabaseId : undefined;
  dbInstance = initializeFirestore(app, dbSettings, dbId);
} catch (e) {
  console.error('Failed to initialize Firestore with named database, falling back to default:', e);
  dbInstance = initializeFirestore(app, dbSettings);
}

export const db = dbInstance;

// Force network connection with retry and status check
const enableFirestoreNetwork = async (retries = 5) => {
  if (!window.navigator.onLine) {
    console.warn('Device is offline, Firestore will operate in offline mode');
    return;
  }

  for (let i = 0; i < retries; i++) {
    try {
      await enableNetwork(db);
      console.log('Firestore network enabled successfully');
      return;
    } catch (err) {
      console.warn(`Attempt ${i + 1} to enable network failed:`, err);
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};

enableFirestoreNetwork();

export const googleProvider = new GoogleAuthProvider();

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
    isOffline
  });

  // For background sync operations (onSnapshot), we can just warn if offline
  // The SDK will automatically reconnect and retry when back online
  if (isOffline && (operationType === OperationType.GET || operationType === OperationType.LIST)) {
    console.warn(`[Firestore] ${operationType} operation on ${path} is pending due to offline state.`);
    return;
  }

  throw new Error(JSON.stringify(errInfo));
}

export { signInWithPopup, signOut, onAuthStateChanged, doc, collection, setDoc, getDoc, getDocs, onSnapshot, query, where, deleteDoc, writeBatch, serverTimestamp, arrayUnion, arrayRemove, updateDoc, addDoc, increment };
export type { User };
