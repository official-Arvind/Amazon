/**
 * Authentication Page JavaScript
 * Handles login, signup, and admin authentication with Firebase v9+
 * 
 * ADMIN CONFIGURATION:
 * Set your admin email in the ADMIN_EMAIL constant below
 */

'use strict';

import { loginWithEmail, signUpWithEmail, logoutUser } from '../../backend/js/auth.js';
import { subscribeToAuthState } from '../../backend/js/auth.js';

// =============================================
// CONFIGURATION
// =============================================

// IMPORTANT: Set your admin email here
const ADMIN_EMAIL = 'admin@zonix.com'; // Change this to your admin email

// Form elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const adminForm = document.getElementById('adminForm');

const loginTabBtn = document.getElementById('loginTabBtn');
const signupTabBtn = document.getElementById('signupTabBtn');
const adminToggleBtn = document.getElementById('adminToggleBtn');
const backFromAdminBtn = document.getElementById('backFromAdminBtn');

// Buttons
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const adminLoginBtn = document.getElementById('adminLoginBtn');

// Password toggle buttons
const toggleLoginPassword = document.getElementById('toggleLoginPassword');
const toggleSignupPassword = document.getElementById('toggleSignupPassword');
const toggleSignupConfirmPassword = document.getElementById('toggleSignupConfirmPassword');
const toggleAdminPassword = document.getElementById('toggleAdminPassword');

// Form switches
const switchToSignup = document.getElementById('switchToSignup');
const switchToLogin = document.getElementById('switchToLogin');

// UI elements
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// =============================================
// INITIALIZATION
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ Authentication page loaded');
    
    // Check if user is already logged in
    checkAuthStatus();
    
    // Initialize event listeners
    initializeEventListeners();
});

// =============================================
// EVENT LISTENERS
// =============================================

function initializeEventListeners() {
    // Tab switching
    loginTabBtn.addEventListener('click', () => switchTab('login'));
    signupTabBtn.addEventListener('click', () => switchTab('signup'));
    
    // Admin form
    adminToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('admin');
    });
    
    backFromAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('login');
    });
    
    // Form switches
    switchToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('signup');
    });
    
    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('login');
    });
    
    // Form submissions
    loginForm.addEventListener('submit', handleLoginSubmit);
    signupForm.addEventListener('submit', handleSignupSubmit);
    adminForm.addEventListener('submit', handleAdminLoginSubmit);
    
    // Password visibility toggles
    toggleLoginPassword.addEventListener('click', () => togglePasswordVisibility('loginPassword'));
    toggleSignupPassword.addEventListener('click', () => togglePasswordVisibility('signupPassword'));
    toggleSignupConfirmPassword.addEventListener('click', () => togglePasswordVisibility('signupConfirmPassword'));
    toggleAdminPassword.addEventListener('click', () => togglePasswordVisibility('adminPassword'));
    
    // Real-time validation
    document.getElementById('loginEmail').addEventListener('input', () => validateEmail('loginEmail'));
    document.getElementById('signupEmail').addEventListener('input', () => validateEmail('signupEmail'));
    document.getElementById('adminEmail').addEventListener('input', () => validateEmail('adminEmail'));
    
    document.getElementById('loginPassword').addEventListener('input', () => clearError('loginPassword'));
    document.getElementById('signupPassword').addEventListener('input', () => validatePasswordStrength('signupPassword'));
    document.getElementById('signupConfirmPassword').addEventListener('input', () => validatePasswordMatch());
}

// =============================================
// TAB SWITCHING
// =============================================

function switchTab(tabName) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected form
    const formToShow = document.querySelector(`[data-form="${tabName}"]`);
    if (formToShow) {
        formToShow.classList.add('active');
    }
    
    // Activate corresponding tab button
    if (tabName === 'login') {
        loginTabBtn.classList.add('active');
    } else if (tabName === 'signup') {
        signupTabBtn.classList.add('active');
    }
    
    // Clear previous errors
    clearAllErrors();
}

// =============================================
// PASSWORD VISIBILITY TOGGLE
// =============================================

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
}

// =============================================
// FORM VALIDATION
// =============================================

function validateEmail(inputId) {
    const input = document.getElementById(inputId);
    const email = input.value.trim();
    const errorElement = document.getElementById(`${inputId}Error`);
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
        errorElement.textContent = 'Email is required';
        errorElement.classList.add('show');
        return false;
    } else if (!emailRegex.test(email)) {
        errorElement.textContent = 'Please enter a valid email address';
        errorElement.classList.add('show');
        return false;
    } else {
        errorElement.classList.remove('show');
        return true;
    }
}

function validatePasswordStrength(inputId) {
    const input = document.getElementById(inputId);
    const password = input.value;
    const errorElement = document.getElementById(`${inputId}Error`);
    
    if (password.length < 8) {
        errorElement.textContent = 'Password must be at least 8 characters';
        errorElement.classList.add('show');
        return false;
    } else {
        errorElement.classList.remove('show');
        return true;
    }
}

function validatePasswordMatch() {
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const errorElement = document.getElementById('signupConfirmPasswordError');
    
    if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        errorElement.classList.add('show');
        return false;
    } else {
        errorElement.classList.remove('show');
        return true;
    }
}

function clearError(inputId) {
    const errorElement = document.getElementById(`${inputId}Error`);
    if (errorElement) {
        errorElement.classList.remove('show');
    }
}

function clearAllErrors() {
    document.querySelectorAll('.error-msg').forEach(element => {
        element.classList.remove('show');
    });
}

// =============================================
// FORM SUBMISSIONS
// =============================================

/**
 * Handle login form submission
 */
async function handleLoginSubmit(e) {
    e.preventDefault();
    clearAllErrors();
    
    // Validate inputs
    const emailValid = validateEmail('loginEmail');
    const passwordValid = document.getElementById('loginPassword').value.length > 0;
    
    if (!emailValid || !passwordValid) {
        if (!passwordValid) {
            document.getElementById('loginPasswordError').textContent = 'Password is required';
            document.getElementById('loginPasswordError').classList.add('show');
        }
        return;
    }
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        showLoading(true);
        
        const user = await loginWithEmail(email, password);
        console.log('✓ Login successful:', user.email);
        
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = '../';
        }, 1000);
        
    } catch (error) {
        console.error('✗ Login error:', error.message);
        document.getElementById('loginError').textContent = error.message || 'Login failed. Please try again.';
        document.getElementById('loginError').classList.add('show');
        showToast(error.message || 'Login failed', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Handle signup form submission
 */
async function handleSignupSubmit(e) {
    e.preventDefault();
    clearAllErrors();
    
    // Validate all inputs
    const nameValid = document.getElementById('signupName').value.trim().length >= 2;
    const emailValid = validateEmail('signupEmail');
    const passwordValid = validatePasswordStrength('signupPassword');
    const passwordMatchValid = validatePasswordMatch();
    const termsAccepted = document.getElementById('agreeTerms').checked;
    
    if (!nameValid) {
        document.getElementById('signupNameError').textContent = 'Name must be at least 2 characters';
        document.getElementById('signupNameError').classList.add('show');
    }
    
    if (!termsAccepted) {
        document.getElementById('termsError').textContent = 'You must agree to the terms';
        document.getElementById('termsError').classList.add('show');
    }
    
    if (!nameValid || !emailValid || !passwordValid || !passwordMatchValid || !termsAccepted) {
        return;
    }
    
    const displayName = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    
    try {
        showLoading(true);
        
        const user = await signUpWithEmail(email, password, displayName);
        console.log('✓ Signup successful:', user.email);
        
        showToast('Account created successfully! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = '../';
        }, 1000);
        
    } catch (error) {
        console.error('✗ Signup error:', error.message);
        document.getElementById('signupError').textContent = error.message || 'Signup failed. Please try again.';
        document.getElementById('signupError').classList.add('show');
        showToast(error.message || 'Signup failed', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Handle admin login form submission
 */
async function handleAdminLoginSubmit(e) {
    e.preventDefault();
    clearAllErrors();
    
    // Validate inputs
    const emailValid = validateEmail('adminEmail');
    const passwordValid = document.getElementById('adminPassword').value.length > 0;
    
    if (!emailValid || !passwordValid) {
        if (!passwordValid) {
            document.getElementById('adminPasswordError').textContent = 'Password is required';
            document.getElementById('adminPasswordError').classList.add('show');
        }
        return;
    }
    
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    // Check if email matches admin email
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        document.getElementById('adminError').textContent = `Only authorized admin accounts can login here. Expected: ${ADMIN_EMAIL}`;
        document.getElementById('adminError').classList.add('show');
        showToast('Admin email not recognized', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const user = await loginWithEmail(email, password);
        console.log('✓ Admin login successful:', user.email);
        
        // Verify admin email
        if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
            await logoutUser();
            throw new Error('Unauthorized admin access attempted');
        }
        
        showToast('Admin login successful! Redirecting to dashboard...', 'success');
        setTimeout(() => {
            window.location.href = '../admin/';
        }, 1000);
        
    } catch (error) {
        console.error('✗ Admin login error:', error.message);
        document.getElementById('adminError').textContent = error.message || 'Admin login failed. Please try again.';
        document.getElementById('adminError').classList.add('show');
        showToast(error.message || 'Admin login failed', 'error');
    } finally {
        showLoading(false);
    }
}

// =============================================
// AUTH STATE MANAGEMENT
// =============================================

/**
 * Check if user is already logged in
 */
function checkAuthStatus() {
    subscribeToAuthState((authState) => {
        if (authState.isAuthenticated && authState.user) {
            console.log('User already logged in, redirecting...');
            
            // Check if user is admin
            if (authState.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                window.location.href = '../admin/';
            } else {
                window.location.href = '../';
            }
        }
    });
}

// =============================================
// UI HELPERS
// =============================================

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.add('show');
    } else {
        loadingOverlay.classList.remove('show');
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = 'toast show ' + type;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// =============================================
// EXPORT ADMIN EMAIL FOR OTHER SCRIPTS
// =============================================

export { ADMIN_EMAIL };
