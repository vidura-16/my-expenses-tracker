// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBu_J1T2jlGifHgyi-6BN3AhFBOkL9fxDk",
  authDomain: "myexpensestracker-5beb5.firebaseapp.com",
  projectId: "myexpensestracker-5beb5",
  storageBucket: "myexpensestracker-5beb5.firebasestorage.app",
  messagingSenderId: "134003626233",
  appId: "1:134003626233:web:83898f66726cbbfca29228",
  measurementId: "G-XV460NJZ6J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);