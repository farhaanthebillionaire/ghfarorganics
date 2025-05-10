import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore'; // Firestore enabled
import { getAuth, type Auth } from 'firebase/auth';

// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmeWZwgLslrLsFnja6SBspBwZN1wUCLjg",
  authDomain: "ghfaro-2025.firebaseapp.com",
  projectId: "ghfaro-2025",
  storageBucket: "ghfaro-2025.firebasestorage.app",
  messagingSenderId: "298635757095",
  appId: "1:298635757095:web:f0c8981d3af7a5a6c77002"
};

// Initialize Firebase
// const app = initializeApp(firebaseConfig);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore; // Firestore enabled

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
db = getFirestore(app); // Firestore initialized

export { app, auth, db }; // db instance exported
