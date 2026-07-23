import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAIEvCy5HclftUp7CVwmWU4lv7pons1wqI",
  authDomain: "dashboard-cockpit-zt-49a0b.firebaseapp.com",
  projectId: "dashboard-cockpit-zt-49a0b",
  storageBucket: "dashboard-cockpit-zt-49a0b.firebasestorage.app",
  messagingSenderId: "147436106964",
  appId: "1:147436106964:web:555b9e3930584e3c35f741"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);



