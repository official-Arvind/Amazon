import { subscribeToAuthState, logoutUser } from '../../backend/js/auth.js';
import { getSavedAddresses, saveAddress, deleteAddress } from '../../backend/js/db.js';


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

    // Address Book Logic
    const addressModal = document.getElementById('addressModal');
    const profileAddressForm = document.getElementById('profileAddressForm');
    const addAddressBtn = document.getElementById('addAddressBtn');
    const closeAddressModal = document.getElementById('closeAddressModal');
    let addresses = [];

    async function loadAddresses() {
        if (!currentUser) return;
        addresses = await getSavedAddresses(currentUser.uid);
        renderAddresses();
    }

    function renderAddresses() {
        const list = document.getElementById('addressesList');
        // Keep the Add Address button
        const addBtnHtml = `
            <div id="addAddressBtn" style="border: 1px dashed #a6a6a6; border-radius: 8px; padding: 2rem; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px;">
                <span style="font-size: 3rem; color: #a6a6a6;">+</span>
                <h3 style="color: #565959; font-weight: 500; font-size: 1.2rem;">Add address</h3>
            </div>
        `;
        
        const addressesHtml = addresses.map(addr => `
            <div style="border: 1px solid #d5d9d9; border-radius: 8px; padding: 1.5rem; min-height: 250px; display: flex; flex-direction: column; position: relative;">
                <strong style="font-size: 1.1rem; margin-bottom: 0.5rem; display: block;">${addr.name}</strong>
                <p style="margin: 0 0 0.3rem 0;">${addr.street}</p>
                <p style="margin: 0 0 0.3rem 0;">${addr.city}, ${addr.state} ${addr.zip}</p>
                <p style="margin: 0 0 0.3rem 0;">India</p>
                <p style="margin: 0 0 1rem 0;">Phone number: ${addr.phone}</p>
                
                <div style="margin-top: auto; display: flex; gap: 1rem; border-top: 1px solid #f0f2f2; padding-top: 1rem;">
                    <a href="#" class="edit-addr-btn" data-id="${addr.id}" style="color: #007185; text-decoration: none; font-size: 0.9rem;">Edit</a>
                    <a href="#" class="delete-addr-btn" data-id="${addr.id}" style="color: #007185; text-decoration: none; font-size: 0.9rem;">Remove</a>
                </div>
            </div>
        `).join('');

        list.innerHTML = addBtnHtml + addressesHtml;

        // Re-attach listeners
        document.getElementById('addAddressBtn').addEventListener('click', () => {
            profileAddressForm.reset();
            document.getElementById('profAddressId').value = '';
            document.getElementById('addressModalTitle').textContent = 'Add a new address';
            addressModal.style.display = 'flex';
        });

        document.querySelectorAll('.edit-addr-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = e.target.getAttribute('data-id');
                const addr = addresses.find(a => a.id === id);
                if (addr) {
                    document.getElementById('profAddressId').value = addr.id;
                    document.getElementById('profFullName').value = addr.name;
                    document.getElementById('profPhone').value = addr.phone;
                    document.getElementById('profStreet').value = addr.street;
                    document.getElementById('profCity').value = addr.city;
                    document.getElementById('profZip').value = addr.zip;
                    document.getElementById('profState').value = addr.state;
                    document.getElementById('addressModalTitle').textContent = 'Edit address';
                    addressModal.style.display = 'flex';
                }
            });
        });

        document.querySelectorAll('.delete-addr-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to remove this address?')) {
                    const id = e.target.getAttribute('data-id');
                    await deleteAddress(currentUser.uid, id);
                    loadAddresses();
                }
            });
        });
    }

    if (closeAddressModal) {
        closeAddressModal.addEventListener('click', () => {
            addressModal.style.display = 'none';
        });
    }

    if (profileAddressForm) {
        profileAddressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('profAddressId').value;
            const addressData = {
                name: document.getElementById('profFullName').value,
                phone: document.getElementById('profPhone').value,
                street: document.getElementById('profStreet').value,
                city: document.getElementById('profCity').value,
                zip: document.getElementById('profZip').value,
                state: document.getElementById('profState').value,
                country: 'India'
            };

            if (id) {
                await deleteAddress(currentUser.uid, id);
            }
            await saveAddress(currentUser.uid, addressData);
            addressModal.style.display = 'none';
            loadAddresses();
        });
    }

    // Initial load for authenticated user
    subscribeToAuthState((authState) => {
        if (authState.isAuthenticated && authState.user) {
            loadAddresses();
        }
    });
});

// End of file
