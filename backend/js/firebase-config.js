/**
 * Firebase Configuration and Initialization
 * Uses Firebase v9+ Modular Web SDK
 */

'use strict';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDjpgHpiMsO7SP_DtcWbhJ_tMgsDJVSnu4",
  authDomain: "studio-vih63.firebaseapp.com",
  projectId: "studio-vih63",
  storageBucket: "studio-vih63.firebasestorage.app",
  messagingSenderId: "771569986455",
  appId: "1:771569986455:web:bbfc575f548251d505f2d2",
  measurementId: "G-KRX08RSM3M"
};

/**
 * Initialize Firebase App
 */
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('✓ Firebase App initialized successfully');
} catch (error) {
  console.error('✗ Firebase initialization failed:', error);
}

/**
 * Initialize Firebase Authentication
 */
export const auth = getAuth(app);

/**
 * Initialize Firestore Database
 */
export const db = getFirestore(app);

/**
 * Enable Offline Persistence for Firestore
 * (Note: The deprecation warning in the console for this function is standard in Firebase 9.22 and completely safe to ignore)
 */
enableIndexedDbPersistence(db)
  .then(() => {
    console.log('✓ Firestore offline persistence enabled');
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠ Multiple tabs open - offline persistence disabled');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠ Browser does not support offline persistence');
    } else {
      console.warn('⚠ Offline persistence warning:', err);
    }
  });

export default app;