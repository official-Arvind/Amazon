/**
 * Firebase Authentication Module
 * Uses Firebase v9+ Modular Web SDK
 * * FUNCTIONS:
 * - signUpWithEmail(email, password, displayName)
 * - loginWithEmail(email, password)
 * - logoutUser()
 * - resetPassword(email)
 * - getCurrentUser()
 * - onAuthStateChanged(callback)
 * - updateUserProfile(displayName, photoURL)
 * * DEPENDENCIES:
 * - firebase-config.js (auth instance)
 * * USAGE:
 * import { loginWithEmail, signUpWithEmail, logoutUser } from './auth.js';
 */

'use strict';

import { auth } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  return password && password.length >= 8;
}

/**
 * Validate display name
 */
function validateDisplayName(displayName) {
  return displayName && displayName.trim().length >= 2;
}

// =============================================
// AUTHENTICATION FUNCTIONS
// =============================================

/**
 * Sign up a new user with email and password
 */
export async function signUpWithEmail(email, password, displayName = '') {
  try {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    if (!validatePassword(password)) {
      throw new Error('Password must be at least 8 characters');
    }

    console.log('Creating user account:', email);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (displayName && validateDisplayName(displayName)) {
      await updateProfile(user, {
        displayName: displayName.trim()
      });
    }

    console.log('✓ User account created:', user.uid);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      createdAt: new Date()
    };
  } catch (error) {
    console.error('✗ Sign up error:', error.message);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak');
    }
    throw error;
  }
}

/**
 * Login user with email and password
 */
export async function loginWithEmail(email, password) {
  try {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    if (!password) {
      throw new Error('Password is required');
    }

    console.log('Logging in user:', email);

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log('✓ User logged in:', user.uid);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      emailVerified: user.emailVerified
    };
  } catch (error) {
    console.error('✗ Login error:', error.message);
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled');
    }
    throw error;
  }
}

/**
 * Logout the current user
 */
export async function logoutUser() {
  try {
    console.log('Logging out user');
    await signOut(auth);
    console.log('✓ User logged out');
  } catch (error) {
    console.error('✗ Logout error:', error.message);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  try {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    console.log('Sending password reset email:', email);
    await sendPasswordResetEmail(auth, email);
    console.log('✓ Password reset email sent');
  } catch (error) {
    console.error('✗ Password reset error:', error.message);
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format');
    }
    throw error;
  }
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser() {
  return auth.currentUser ? {
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    displayName: auth.currentUser.displayName || '',
    photoURL: auth.currentUser.photoURL || '',
    emailVerified: auth.currentUser.emailVerified,
    createdAt: auth.currentUser.metadata?.creationTime
  } : null;
}

/**
 * Update user profile information
 */
export async function updateUserProfile(displayName, photoURL = null) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }

    if (displayName && !validateDisplayName(displayName)) {
      throw new Error('Display name must be at least 2 characters');
    }

    console.log('Updating user profile');
    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (photoURL) updateData.photoURL = photoURL;

    await updateProfile(user, updateData);
    console.log('✓ Profile updated');
  } catch (error) {
    console.error('✗ Profile update error:', error.message);
    throw error;
  }
}

/**
 * Subscribe to authentication state changes
 */
export function subscribeToAuthState(callback) {
  console.log('Setting up auth state listener');
  
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('✓ User authenticated:', user.uid);
      callback({
        isAuthenticated: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          emailVerified: user.emailVerified
        }
      });
    } else {
      console.log('User not authenticated');
      callback({
        isAuthenticated: false,
        user: null
      });
    }
  });

  return unsubscribe;
}

export default {
  signUpWithEmail,
  loginWithEmail,
  logoutUser,
  resetPassword,
  getCurrentUser,
  updateUserProfile,
  subscribeToAuthState
};