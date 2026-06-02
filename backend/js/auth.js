/**
 * Firebase Authentication Module
 * Uses Firebase v9+ Modular Web SDK
 * 
 * FUNCTIONS:
 * - signUpWithEmail(email, password, displayName)
 * - loginWithEmail(email, password)
 * - logoutUser()
 * - resetPassword(email)
 * - getCurrentUser()
 * - onAuthStateChanged(callback)
 * - updateUserProfile(displayName, photoURL)
 * 
 * DEPENDENCIES:
 * - firebase-config.js (auth instance)
 * 
 * USAGE:
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
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid (minimum 8 characters)
 */
function validatePassword(password) {
  return password && password.length >= 8;
}

/**
 * Validate display name
 * @param {string} displayName - Name to validate
 * @returns {boolean} True if valid
 */
function validateDisplayName(displayName) {
  return displayName && displayName.trim().length >= 2;
}

// =============================================
// AUTHENTICATION FUNCTIONS
// =============================================

/**
 * Sign up a new user with email and password
 * @param {string} email - User email
 * @param {string} password - User password (min 8 characters)
 * @param {string} displayName - User's display name
 * @returns {Promise<Object>} User object with uid and email
 * @throws {Error} If validation fails or Firebase returns error
 */
export async function signUpWithEmail(email, password, displayName = '') {
  try {
    // Validation
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    if (!validatePassword(password)) {
      throw new Error('Password must be at least 8 characters');
    }

    console.log('Creating user account:', email);

    // Create user with Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile if display name provided
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
    
    // Handle specific Firebase errors
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
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User object with uid and email
 * @throws {Error} If validation fails or Firebase returns error
 */
export async function loginWithEmail(email, password) {
  try {
    // Validation
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    if (!password) {
      throw new Error('Password is required');
    }

    console.log('Logging in user:', email);

    // Sign in with Firebase Auth
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
    
    // Handle specific Firebase errors
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
 * @returns {Promise<void>}
 * @throws {Error} If logout fails
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
 * @param {string} email - User email
 * @returns {Promise<void>}
 * @throws {Error} If email is invalid or reset fails
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
 * @returns {Object|null} User object or null if not authenticated
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
 * @param {string} displayName - New display name
 * @param {string} photoURL - New photo URL (optional)
 * @returns {Promise<void>}
 * @throws {Error} If update fails
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
 * Triggers callback whenever user login status changes
 * @param {Function} callback - Function to call when auth state changes
 * @returns {Function} Unsubscribe function
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
        // return userCredential.user;
    } catch (error) {
        console.error('Login error:', error.message);
        throw error;
    }
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
async function logout() {
    try {
        console.log('Logging out user');
        
        // TODO: Call Firebase logout
        // await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error.message);
        throw error;
    }
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user or null
 */
function getCurrentUser() {
    // TODO: Return current user from Firebase
    // return auth.currentUser;
    return null;
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
async function sendPasswordReset(email) {
    try {
        console.log('Sending password reset email to:', email);
        
        if (!validateEmail(email)) {
            throw new Error('Invalid email address');
        }
        
        // TODO: Call Firebase password reset
        // await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error('Password reset error:', error.message);
        throw error;
    }
}

/**
 * Update user email
 * @param {string} newEmail - New email address
 * @returns {Promise<void>}
 */
async function updateUserEmail(newEmail) {
    try {
        console.log('Updating user email to:', newEmail);
        
        if (!validateEmail(newEmail)) {
            throw new Error('Invalid email address');
        }
        
        // TODO: Call Firebase update email
        // const user = auth.currentUser;
        // await updateEmail(user, newEmail);
    } catch (error) {
        console.error('Update email error:', error.message);
        throw error;
    }
}

/**
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
async function updateUserPassword(newPassword) {
    try {
        console.log('Updating user password');
        
        if (!validatePassword(newPassword)) {
            throw new Error('Password must be at least 8 characters');
        }
        
        // TODO: Call Firebase update password
        // const user = auth.currentUser;
        // await updatePassword(user, newPassword);
    } catch (error) {
        console.error('Update password error:', error.message);
        throw error;
    }
}

// =============================================
// USER PROFILE MANAGEMENT
// =============================================

/**
 * Create or update user profile
 * @param {Object} profileData - User profile data
 * @returns {Promise<void>}
 */
async function updateUserProfile(profileData) {
    try {
        console.log('Updating user profile');
        
        // TODO: Update Firestore user document
        // const user = auth.currentUser;
        // if (user) {
        //     await updateDoc(doc(db, 'users', user.uid), profileData);
        // }
    } catch (error) {
        console.error('Profile update error:', error.message);
        throw error;
    }
}

/**
 * Get user profile data
 * @returns {Promise<Object>} User profile data
 */
async function getUserProfile() {
    try {
        console.log('Fetching user profile');
        
        // TODO: Fetch user profile from Firestore
        // const user = auth.currentUser;
        // if (user) {
        //     const docSnap = await getDoc(doc(db, 'users', user.uid));
        //     return docSnap.data();
        // }
        return null;
    } catch (error) {
        console.error('Get profile error:', error.message);
        throw error;
    }
}

/**
 * Delete user account
 * @returns {Promise<void>}
 */
async function deleteUserAccount() {
    try {
        console.log('Deleting user account');
        
        // TODO: Delete user document from Firestore
        // const user = auth.currentUser;
        // if (user) {
        //     await deleteDoc(doc(db, 'users', user.uid));
        //     await user.delete();
        // }
    } catch (error) {
        console.error('Account deletion error:', error.message);
        throw error;
    }
}

// =============================================
// VALIDATION FUNCTIONS
// =============================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid (minimum 8 characters)
 */
function validatePassword(password) {
    return password && password.length >= 8;
}

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s-()]{10,}$/;
    return phoneRegex.test(phone);
}

// =============================================
// PERMISSION & ROLE CHECKING
// =============================================

/**
 * Check if user has specific role
 * @param {string} role - Role to check
 * @returns {Promise<boolean>} True if user has role
 */
async function hasRole(role) {
    try {
        const profile = await getUserProfile();
        return profile && profile.role === role;
    } catch (error) {
        console.error('Role check error:', error);
        return false;
    }
}

/**
 * Check if user is admin
 * @returns {Promise<boolean>} True if user is admin
 */
async function isAdmin() {
    return hasRole('admin');
}

/**
 * Check if user is customer
 * @returns {Promise<boolean>} True if user is customer
 */
async function isCustomer() {
    return hasRole('customer');
}

// =============================================
// EXPORTS
// =============================================

console.log('Authentication module loaded (placeholder)');

// Export functions for use in other modules
// export { signUp, login, logout, getCurrentUser, sendPasswordReset, updateUserEmail, updateUserPassword, updateUserProfile, getUserProfile, deleteUserAccount, validateEmail, validatePassword, hasRole, isAdmin, isCustomer };
