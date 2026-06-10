import { subscribeToAuthState, logoutUser } from '../../backend/js/auth.js';


let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth State
    subscribeToAuthState((authState) => {
        if (authState.isAuthenticated && authState.user) {
            currentUser = authState.user;
            document.getElementById('userDisplayName').textContent = currentUser.displayName || 'User';
            document.getElementById('userEmail').textContent = currentUser.email;
            
            document.getElementById('settingsNameDisplay').textContent = currentUser.displayName || 'User';
            document.getElementById('settingsEmailDisplay').textContent = currentUser.email;
        } else {
            // Not authenticated
            window.location.href = '../login/';
        }
    });

    // Tab switching
    const navItems = document.querySelectorAll('.profile-nav-item[data-tab]');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.profile-tab').forEach(tab => tab.style.display = 'none');
            const tabId = item.getAttribute('data-tab') + 'Tab';
            document.getElementById(tabId).style.display = 'block';
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await logoutUser();
        window.location.href = '../login/';
    });
});

// End of file
