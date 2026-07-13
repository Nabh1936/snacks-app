import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBfyvnjRkvJcTfu6cVZ7pwkb3_syYwKim8",
  authDomain: "moderndryfruits.firebaseapp.com",
  projectId: "moderndryfruits",
  storageBucket: "moderndryfruits.firebasestorage.app",
  messagingSenderId: "715523355637",
  appId: "1:715523355637:web:ed25046db1d055833ee6bc",
  measurementId: "G-0X23JQNLGM"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;