// Firebase Configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, enableNetwork, disableNetwork, enableIndexedDbPersistence, collection, doc, setDoc, getDocs, updateDoc, deleteDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCz-zukDh3j5p3u_GsmfwSnVXpv65JlPZI",
  authDomain: "tardiness-monitoring-system.firebaseapp.com",
  projectId: "tardiness-monitoring-system",
  storageBucket: "tardiness-monitoring-system.firebasestorage.app",
  messagingSenderId: "244896832804",
  appId: "1:244896832804:web:4480195050950ff9c7e7b1",
  measurementId: "G-T3WJJ1VYH9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore
const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
    .then(() => {
        console.log('Firebase persistence enabled');
    })
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time
            console.log('Persistence failed - multiple tabs open');
        } else if (err.code == 'unimplemented') {
            // The current browser doesn't support persistence
            console.log('Persistence not supported');
        }
    });

// Export for use in other files
window.db = db;
window.firebaseApp = app;
window.firebaseFunctions = {
    collection,
    doc,
    setDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    orderBy,
    query
}; 