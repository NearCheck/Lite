// Firbase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDummyAPIKeyForExampleOnly",
    authDomain: "nearcheck-lite.firebaseapp.com",
    projectId: "nearcheck-lite",
    storageBucket: "nearcheck-lite.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:dummyappidfornearchecklite"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

// App State
let currentUser = null;
let currentRole = null;
let currentSections = [];
let currentStudents = [];
let activeSession = null;
let userLocation = null;
let watchId = null;

// DOM Elements
const app = document.getElementById('app');
const modalsContainer = document.getElementById('modals-container');

// Initialize the app
function initApp() {
    // Check authentication state
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            // Get user role from Firestore
            getUserRole(user.uid).then(role => {
                currentRole = role;
                loadDashboard();
            });
        } else {
            currentUser = null;
            currentRole = null;
            renderAuthPage();
        }
    });

    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sectionId = urlParams.get('sectionid');

    // If sectionId exists in URL and user is not logged in, store it for signup
    if (sectionId && !currentUser) {
        localStorage.setItem('inviteSectionId', sectionId);
    }
}

// Get user role from Firestore
async function getUserRole(userId) {
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            return doc.data().role; // 'teacher' or 'student'
        }
        return null;
    } catch (error) {
        console.error("Error getting user role:", error);
        showToast("Error loading user data");
        return null;
    }
}

// Render Authentication Page
function renderAuthPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'signin';

    let authContent = '';

    if (mode === 'signup') {
        const isTeacher = urlParams.get('role') === 'teacher';

        if (isTeacher) {
            authContent = `
                <div class="auth-container">
                    <div class="auth-card card">
                        <h1 class="auth-title">Teacher Sign Up</h1>
                        <form id="teacherSignupForm">
                            <div class="form-group">
                                <label for="fullName" class="form-label">Full Name</label>
                                <input type="text" id="fullName" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="email" class="form-label">Email</label>
                                <input type="email" id="email" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" id="password" class="form-control" required minlength="6">
                            </div>
                            <div class="form-group">
                                <label for="confirmPassword" class="form-label">Confirm Password</label>
                                <input type="password" id="confirmPassword" class="form-control" required minlength="6">
                            </div>
                            <button type="submit" class="btn btn-primary btn-lg w-100">Create Account</button>
                        </form>
                        <div class="auth-footer">
                            <p>Already have an account? <a href="?mode=signin" class="auth-link">Sign in</a></p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Student sign up
            const inviteSectionId = localStorage.getItem('inviteSectionId') || '';

            authContent = `
                <div class="auth-container">
                    <div class="auth-card card">
                        <h1 class="auth-title">Student Sign Up</h1>
                        <form id="studentSignupForm">
                            <div class="form-group">
                                <label for="fullName" class="form-label">Full Name</label>
                                <input type="text" id="fullName" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="email" class="form-label">Email Address</label>
                                <input type="email" id="email" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" id="password" class="form-control" required minlength="6">
                            </div>
                            <div class="form-group">
                                <label for="confirmPassword" class="form-label">Confirm Password</label>
                                <input type="password" id="confirmPassword" class="form-control" required minlength="6">
                            </div>
                            <div class="form-group">
                                <label for="sectionId" class="form-label">Section ID</label>
                                <input type="text" id="sectionId" class="form-control" value="${inviteSectionId}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" id="ageConfirm" required> I confirm I'm 13 years or older
                                </label>
                            </div>
                            <button type="submit" class="btn btn-primary btn-lg w-100">Continue</button>
                        </form>
                        <div class="auth-footer">
                            <p>Already have an account? <a href="?mode=signin" class="auth-link">Sign in</a></p>
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        // Sign in form
        authContent = `
            <div class="auth-container">
                <div class="auth-card card">
                    <h1 class="auth-title">Sign In</h1>
                    <form id="signinForm">
                        <div class="form-group">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" id="email" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" id="password" class="form-control" required>
                        </div>
                        <div class="form-group text-center">
                            <a href="#" id="forgotPassword" class="auth-link">Forgot password?</a>
                        </div>
                        <button type="submit" class="btn btn-primary btn-lg w-100">Sign In</button>
                    </form>
                    <div class="auth-footer">
                        <p>New to Nearcheck? <a href="?mode=signup&role=student" class="auth-link">Sign up</a></p>
                    </div>
                </div>
            </div>
        `;
    }

    app.innerHTML = authContent;

    // Add event listeners
    if (mode === 'signup') {
        const isTeacher = urlParams.get('role') === 'teacher';
        if (isTeacher) {
            document.getElementById('teacherSignupForm').addEventListener('submit', handleTeacherSignup);
        } else {
            document.getElementById('studentSignupForm').addEventListener('submit', handleStudentSignup);
        }
    } else {
        document.getElementById('signinForm').addEventListener('submit', handleSignIn);
        document.getElementById('forgotPassword').addEventListener('click', handleForgotPassword);
    }
}

// Handle Teacher Signup
async function handleTeacherSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Basic validation
    if (password !== confirmPassword) {
        showToast("Passwords don't match");
        return;
    }

    try {
        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save additional user data to Firestore
        await db.collection('users').doc(user.uid).set({
            fullName,
            email,
            role: 'teacher',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear any invite section ID
        localStorage.removeItem('inviteSectionId');

        // Show success message
        showToast("Account created successfully!");

        // Redirect to dashboard after a delay
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } catch (error) {
        console.error("Signup error:", error);
        showToast(error.message);
    }
}

// Handle Student Signup
async function handleStudentSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const sectionId = document.getElementById('sectionId').value.trim();
    const ageConfirm = document.getElementById('ageConfirm').checked;

    // Basic validation
    if (!ageConfirm) {
        showToast("You must confirm you're 13 years or older");
        return;
    }

    if (password !== confirmPassword) {
        showToast("Passwords don't match");
        return;
    }

    // Check if section exists
    const sectionRef = db.collection('sections').doc(sectionId);
    const sectionDoc = await sectionRef.get();

    if (!sectionDoc.exists) {
        showToast("Invalid Section ID. Please check with your teacher.");
        return;
    }

    try {
        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save additional user data to Firestore
        await db.collection('users').doc(user.uid).set({
            fullName,
            email,
            role: 'student',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add student to the section
        await sectionRef.collection('students').doc(user.uid).set({
            fullName,
            email,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear invite section ID from localStorage
        localStorage.removeItem('inviteSectionId');

        // Show success message
        showToast("Account created successfully! You've been added to the section.");

        // Redirect to dashboard after a delay
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } catch (error) {
        console.error("Signup error:", error);
        showToast(error.message);
    }
}

// Handle Sign In
async function handleSignIn(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle the redirect
    } catch (error) {
        console.error("Sign in error:", error);
        showToast(error.message);
    }
}

// Handle Forgot Password
function handleForgotPassword(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();

    if (!email) {
        showToast("Please enter your email address");
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            showToast("Password reset email sent. Please check your inbox.");
        })
        .catch(error => {
            console.error("Password reset error:", error);
            showToast(error.message);
        });
}

// Load Dashboard based on user role
function loadDashboard() {
    if (!currentUser || !currentRole) {
        renderAuthPage();
        return;
    }

    if (currentRole === 'teacher') {
        loadTeacherDashboard();
    } else {
        loadStudentDashboard();
    }

    // Load drawer
    renderDrawer();
}

// Render Navigation Drawer
function renderDrawer() {
    const drawerContent = `
        <div class="drawer">
            <div class="drawer-header">
                <h3>NearCheck Lite</h3>
                <button id="closeDrawer" class="btn btn-secondary btn-sm"><i class="fas fa-times"></i></button>
            </div>
            <div class="drawer-body">
                <div class="drawer-item">
                    <i class="fas fa-home"></i>
                    <span>Dashboard</span>
                </div>
                <div class="drawer-item">
                    <i class="fas fa-users"></i>
                    <span>${currentRole === 'teacher' ? 'My Students' : 'Enroll'}</span>
                </div>
                ${currentRole === 'teacher' ? `
                <div class="drawer-item">
                    <i class="fas fa-chart-bar"></i>
                    <span>Attendance Reports</span>
                </div>
                ` : ''}
                <div class="drawer-item">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                </div>
                <div class="drawer-item">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Sign Out</span>
                </div>
            </div>
        </div>
        <div class="overlay"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', drawerContent);

    // Add event listeners
    document.getElementById('closeDrawer').addEventListener('click', toggleDrawer);
    document.querySelector('.overlay').addEventListener('click', toggleDrawer);

    // Add click handlers for drawer items
    const drawerItems = document.querySelectorAll('.drawer-item');
    drawerItems.forEach(item => {
        item.addEventListener('click', () => {
            const text = item.querySelector('span').textContent;
            handleDrawerItemClick(text);
        });
    });
}

// Toggle Drawer
function toggleDrawer() {
    const drawer = document.querySelector('.drawer');
    const overlay = document.querySelector('.overlay');

    drawer.classList.toggle('open');
    overlay.classList.toggle('open');
}

// Handle Drawer Item Click
function handleDrawerItemClick(itemText) {
    toggleDrawer();

    switch (itemText) {
        case 'Dashboard':
            loadDashboard();
            break;
        case 'My Students':
        case 'Enroll':
            if (currentRole === 'teacher') {
                renderManageStudents();
            } else {
                renderEnrollSection();
            }
            break;
        case 'Attendance Reports':
            renderAttendanceReports();
            break;
        case 'Settings':
            renderSettings();
            break;
        case 'Sign Out':
            auth.signOut();
            break;
        default:
            break;
    }
}

// Load Teacher Dashboard
async function loadTeacherDashboard() {
    try {
        // Get teacher's sections
        const sectionsSnapshot = await db.collection('sections')
            .where('teacherId', '==', currentUser.uid)
            .get();

        currentSections = [];
        sectionsSnapshot.forEach(doc => {
            currentSections.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Render dashboard
        const greeting = getGreeting();
        const dashboardContent = `
            <div class="container">
                <header class="header">
                    <button id="openDrawer" class="btn btn-secondary"><i class="fas fa-bars"></i></button>
                    <a href="#" class="header-logo">NearCheck</a>
                    <div class="header-actions">
                        <button id="createSectionBtn" class="btn btn-primary">+ Create Section</button>
                    </div>
                </header>
                
                <main>
                    <div class="dashboard-header">
                        <h1 class="greeting">${greeting}, ${currentUser.displayName || 'Teacher'}</h1>
                    </div>
                    
                    <h2>My Sections</h2>
                    ${currentSections.length > 0 ? `
                        <div class="section-carousel">
                            ${currentSections.map(section => `
                                <div class="section-card" data-section-id="${section.id}">
                                    <div class="section-actions">
                                        <button class="btn btn-secondary btn-sm section-menu-btn"><i class="fas fa-ellipsis-v"></i></button>
                                    </div>
                                    <h3>${section.name}</h3>
                                    <p>${section.subject}</p>
                                    <p>ID: ${section.id}</p>
                                    <p>Schedule: ${section.schedule}</p>
                                    <p>Students: ${section.studentCount || 0}</p>
                                    <button class="btn btn-primary mt-2 start-session-btn" data-section-id="${section.id}">
                                        Start Attendance Session
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="card">
                            <p>You don't have any sections yet. Create your first section to get started.</p>
                        </div>
                    `}
                </main>
            </div>
        `;

        app.innerHTML = dashboardContent;

        // Add event listeners
        document.getElementById('openDrawer').addEventListener('click', toggleDrawer);
        document.getElementById('createSectionBtn').addEventListener('click', renderCreateSectionForm);

        // Add click handlers for section cards
        if (currentSections.length > 0) {
            document.querySelectorAll('.start-session-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const sectionId = e.currentTarget.getAttribute('data-section-id');
                    startAttendanceSession(sectionId);
                });
            });

            document.querySelectorAll('.section-menu-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sectionCard = e.currentTarget.closest('.section-card');
                    const sectionId = sectionCard.getAttribute('data-section-id');
                    showSectionMenu(sectionId, e.currentTarget);
                });
            });
        }
    } catch (error) {
        console.error("Error loading teacher dashboard:", error);
        showToast("Error loading dashboard");
    }
}

// Get time-based greeting
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

// Render Create Section Form
function renderCreateSectionForm() {
    const modalContent = `
        <div class="modal-header">
            <h3 class="modal-title">Create New Section</h3>
            <button class="btn btn-secondary btn-sm close-modal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <form id="createSectionForm">
                <div class="form-group">
                    <label for="sectionName" class="form-label">Section Name</label>
                    <input type="text" id="sectionName" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="subject" class="form-label">Subject</label>
                    <input type="text" id="subject" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="schedule" class="form-label">Schedule</label>
                    <input type="text" id="schedule" class="form-control" placeholder="e.g. Mon/Wed/Fri 9:00-10:00" required>
                </div>
                <div class="form-group">
                    <label for="checkinRange" class="form-label">Check-in Range (meters)</label>
                    <input type="number" id="checkinRange" class="form-control" min="5" max="150" value="50" required>
                </div>
                <div class="form-group">
                    <button type="button" id="getLocationBtn" class="btn btn-secondary">
                        <i class="fas fa-location-arrow"></i> Set Teacher Location
                    </button>
                    <div id="locationStatus" class="mt-2"></div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary close-modal">Cancel</button>
            <button id="createSectionSubmit" class="btn btn-primary">Create</button>
        </div>
    `;

    showModal('Create Section', modalContent);

    // Add event listeners
    document.getElementById('getLocationBtn').addEventListener('click', getTeacherLocation);
    document.getElementById('createSectionSubmit').addEventListener('click', handleCreateSection);
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

// Get Teacher Location for Section Creation
function getTeacherLocation() {
    const locationStatus = document.getElementById('locationStatus');
    locationStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting location...';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };

                locationStatus.innerHTML = `
                    <i class="fas fa-check-circle" style="color: var(--success-color);"></i> 
                    Location set (Accuracy: ${Math.round(userLocation.accuracy)} meters)
                `;
            },
            (error) => {
                console.error("Geolocation error:", error);
                locationStatus.innerHTML = `
                    <i class="fas fa-exclamation-circle" style="color: var(--danger-color);"></i> 
                    ${error.message}
                `;
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        locationStatus.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color: var(--danger-color);"></i> 
            Geolocation is not supported by your browser
        `;
    }
}

// Handle Create Section
async function handleCreateSection() {
    const sectionName = document.getElementById('sectionName').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const schedule = document.getElementById('schedule').value.trim();
    const checkinRange = parseInt(document.getElementById('checkinRange').value);

    if (!sectionName || !subject || !schedule || isNaN(checkinRange)) {
        showToast("Please fill all fields correctly");
        return;
    }

    if (!userLocation) {
        showToast("Please set teacher location first");
        return;
    }

    try {
        // Create section in Firestore
        const sectionRef = await db.collection('sections').add({
            name: sectionName,
            subject,
            schedule,
            checkinRange,
            teacherId: currentUser.uid,
            teacherName: currentUser.displayName || 'Teacher',
            teacherLocation: new firebase.firestore.GeoPoint(userLocation.lat, userLocation.lng),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            studentCount: 0
        });

        showToast(`Section "${sectionName}" created successfully!`);
        closeModal();
        loadTeacherDashboard();
    } catch (error) {
        console.error("Error creating section:", error);
        showToast("Error creating section");
    }
}

// Show Section Menu (for ellipsis button)
function showSectionMenu(sectionId, buttonElement) {
    const section = currentSections.find(s => s.id === sectionId);
    if (!section) return;

    const rect = buttonElement.getBoundingClientRect();
    const menuContent = `
        <div class="dropdown-menu" style="position: absolute; top: ${rect.bottom + 5}px; left: ${rect.left - 150}px; width: 200px;">
            <div class="card">
                <div class="dropdown-item" data-action="invite"><i class="fas fa-user-plus"></i> Invite Students</div>
                <div class="dropdown-item" data-action="manage"><i class="fas fa-users-cog"></i> Manage Students</div>
                <div class="dropdown-item" data-action="delete"><i class="fas fa-trash"></i> Delete Section</div>
            </div>
        </div>
    `;

    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.dropdown-menu');
    if (existingDropdown) existingDropdown.remove();

    // Add new dropdown
    document.body.insertAdjacentHTML('beforeend', menuContent);

    // Add click handlers
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const action = e.currentTarget.getAttribute('data-action');
            handleSectionAction(sectionId, action);
            document.querySelector('.dropdown-menu').remove();
        });
    });

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function clickOutside(e) {
            if (!e.target.closest('.dropdown-menu') && e.target !== buttonElement) {
                document.querySelector('.dropdown-menu').remove();
                document.removeEventListener('click', clickOutside);
            }
        });
    }, 10);
}

// Handle Section Action
function handleSectionAction(sectionId, action) {
    const section = currentSections.find(s => s.id === sectionId);
    if (!section) return;

    switch (action) {
        case 'invite':
            showInviteStudentsModal(section);
            break;
        case 'manage':
            renderManageStudents(sectionId);
            break;
        case 'delete':
            showDeleteSectionModal(section);
            break;
        default:
            break;
    }
}

// Show Invite Students Modal
function showInviteStudentsModal(section) {
    const inviteLink = `${window.location.origin}${window.location.pathname}?sectionid=${section.id}`;

    const modalContent = `
        <div class="modal-header">
            <h3 class="modal-title">Invite Students to ${section.name}</h3>
            <button class="btn btn-secondary btn-sm close-modal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Invitation Link</label>
                <div class="flex gap-2">
                    <input type="text" id="inviteLink" class="form-control" value="${inviteLink}" readonly>
                    <button id="copyLinkBtn" class="btn btn-primary"><i class="fas fa-copy"></i></button>
                </div>
            </div>
            <div class="form-group mt-4">
                <label class="form-label">Or share via QR Code</label>
                <div class="qr-code-container">
                    <div class="qr-code" id="qrCode"></div>
                    <button id="downloadQrBtn" class="btn btn-primary"><i class="fas fa-download"></i> Download QR</button>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary close-modal">Close</button>
        </div>
    `;

    showModal('Invite Students', modalContent);

    // Add event listeners
    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        const linkInput = document.getElementById('inviteLink');
        linkInput.select();
        document.execCommand('copy');
        showToast("Link copied to clipboard!");
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Generate QR Code (would need a QR code library in production)
    // This is a placeholder - in a real app you'd use a library like QRious
    document.getElementById('qrCode').innerHTML = '<div class="text-center"><i class="fas fa-qrcode fa-5x"></i><p class="mt-2">QR Code would appear here</p></div>';
}

// Show Delete Section Modal
function showDeleteSectionModal(section) {
    const modalContent = `
        <div class="modal-header">
            <h3 class="modal-title">Delete Section</h3>
            <button class="btn btn-secondary btn-sm close-modal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <p>Are you sure you want to delete "${section.name}"? This action cannot be undone.</p>
            <div class="form-group mt-3">
                <label for="confirmPassword" class="form-label">Confirm your password to delete</label>
                <input type="password" id="confirmPassword" class="form-control" required>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary close-modal">Cancel</button>
            <button id="confirmDeleteBtn" class="btn btn-danger">Delete Section</button>
        </div>
    `;

    showModal('Delete Section', modalContent);

    // Add event listeners
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        const password = document.getElementById('confirmPassword').value;
        deleteSection(section.id, password);
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

// Delete Section
async function deleteSection(sectionId, password) {
    if (!password) {
        showToast("Please enter your password");
        return;
    }

    try {
        // Reauthenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            password
        );

        await currentUser.reauthenticateWithCredential(credential);

        // Delete section
        await db.collection('sections').doc(sectionId).delete();

        // Delete all students in this section
        const studentsSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('students')
            .get();

        const batch = db.batch();
        studentsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        showToast("Section deleted successfully");
        closeModal();
        loadTeacherDashboard();
    } catch (error) {
        console.error("Error deleting section:", error);
        showToast(error.message);
    }
}

// Start Attendance Session
async function startAttendanceSession(sectionId) {
    const section = currentSections.find(s => s.id === sectionId);
    if (!section) return;

    // Get teacher's current location
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        const teacherLocation = new firebase.firestore.GeoPoint(
            position.coords.latitude,
            position.coords.longitude
        );

        // Update section with current location
        await db.collection('sections').doc(sectionId).update({
            teacherLocation,
            lastSessionStart: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Create active session in Realtime DB
        activeSession = {
            sectionId,
            startTime: firebase.database.ServerValue.TIMESTAMP,
            teacherLocation: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            },
            checkinRange: section.checkinRange,
            status: 'active'
        };

        await rtdb.ref(`sessions/${sectionId}`).set(activeSession);

        // Start watching for student check-ins
        watchForCheckins(sectionId);

        // Show session controls
        showSessionControls(section);

        showToast("Attendance session started!");
    } catch (error) {
        console.error("Error starting session:", error);
        showToast(error.message);
    }
}

// Show Session Controls
function showSessionControls(section) {
    const modalContent = `
        <div class="modal-header">
            <h3 class="modal-title">Attendance Session - ${section.name}</h3>
            <button class="btn btn-secondary btn-sm close-modal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <div class="flex align-items-center gap-3 mb-3">
                <div class="status-badge status-present">Live</div>
                <div>Check-in range: ${section.checkinRange}m radius</div>
            </div>
            
            <div id="checkinsContainer">
                <p>Waiting for student check-ins...</p>
            </div>
        </div>
        <div class="modal-footer">
            <button id="endSessionBtn" class="btn btn-danger">End Session</button>
        </div>
    `;

    showModal('Attendance Session', modalContent, {
        large: true
    });

    // Add event listeners
    document.getElementById('endSessionBtn').addEventListener('click', () => {
        endAttendanceSession(section.id);
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal();
            endAttendanceSession(section.id);
        });
    });
}

// Watch for Student Check-ins
function watchForCheckins(sectionId) {
    // Listen for student check-ins in Realtime DB
    rtdb.ref(`checkins/${sectionId}`).on('value', (snapshot) => {
        const checkins = snapshot.val() || {};
        updateCheckinsList(checkins);
    });
}

// Update Check-ins List
function updateCheckinsList(checkins) {
    const container = document.getElementById('checkinsContainer');
    if (!container) return;

    const checkinList = Object.entries(checkins).map(([studentId, checkin]) => {
        return `
            <div class="flex align-items-center justify-content-between mb-2 p-2" style="background: var(--light-gray); border-radius: var(--border-radius-sm);">
                <div>
                    <strong>${checkin.studentName}</strong>
                    <div class="text-sm">${new Date(checkin.timestamp).toLocaleTimeString()}</div>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-success btn-sm approve-btn" data-student-id="${studentId}">Approve</button>
                    <button class="btn btn-danger btn-sm deny-btn" data-student-id="${studentId}">Deny</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = checkinList.length > 0 ? checkinList : '<p>No check-ins yet</p>';

    // Add event listeners for approve/deny buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            handleCheckinApproval(studentId, true);
        });
    });

    document.querySelectorAll('.deny-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            handleCheckinApproval(studentId, false);
        });
    });
}

// Handle Check-in Approval
async function handleCheckinApproval(studentId, approved) {
    if (!activeSession) return;

    try {
        // Record attendance in Firestore
        await db.collection('sections')
            .doc(activeSession.sectionId)
            .collection('attendance')
            .add({
                studentId,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                status: approved ? 'present' : 'absent',
                approvedBy: currentUser.uid,
                location: activeSession.teacherLocation,
                checkinRange: activeSession.checkinRange
            });

        // Remove check-in from Realtime DB
        await rtdb.ref(`checkins/${activeSession.sectionId}/${studentId}`).remove();

        showToast(`Check-in ${approved ? 'approved' : 'denied'}`);
    } catch (error) {
        console.error("Error handling check-in:", error);
        showToast("Error processing check-in");
    }
}

// End Attendance Session
async function endAttendanceSession(sectionId) {
    try {
        // Update session status in Realtime DB
        await rtdb.ref(`sessions/${sectionId}`).update({
            status: 'ended',
            endTime: firebase.database.ServerValue.TIMESTAMP
        });

        // Stop listening for check-ins
        if (rtdb.ref(`checkins/${sectionId}`).off) {
            rtdb.ref(`checkins/${sectionId}`).off();
        }

        activeSession = null;
        closeModal();
        showToast("Attendance session ended");
    } catch (error) {
        console.error("Error ending session:", error);
        showToast("Error ending session");
    }
}

// Render Manage Students
async function renderManageStudents(sectionId = null) {
    if (!sectionId && currentSections.length > 0) {
        sectionId = currentSections[0].id;
    }

    if (!sectionId) {
        app.innerHTML = '<div class="container"><p>No sections available</p></div>';
        return;
    }

    try {
        // Get students in this section
        const studentsSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('students')
            .get();

        currentStudents = [];
        studentsSnapshot.forEach(doc => {
            currentStudents.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Get attendance data for these students
        const attendanceData = await getAttendanceData(sectionId);

        // Render manage students page
        const section = currentSections.find(s => s.id === sectionId);
        const content = `
            <div class="container">
                <header class="header">
                    <button id="openDrawer" class="btn btn-secondary"><i class="fas fa-bars"></i></button>
                    <a href="#" class="header-logo">NearCheck</a>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="backToDashboard"><i class="fas fa-arrow-left"></i> Back</button>
                    </div>
                </header>
                
                <main>
                    <div class="dashboard-header">
                        <h1>Manage Students - ${section?.name || 'Section'}</h1>
                        ${currentSections.length > 1 ? `
                            <select id="sectionSelector" class="form-control">
                                ${currentSections.map(s => `
                                    <option value="${s.id}" ${s.id === sectionId ? 'selected' : ''}>${s.name}</option>
                                `).join('')}
                            </select>
                        ` : ''}
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Students (${currentStudents.length})</h3>
                            <input type="text" id="studentSearch" class="form-control" placeholder="Search students...">
                        </div>
                        
                        <div id="studentsList">
                            ${currentStudents.map(student => {
                                const attendance = attendanceData[student.id] || {};
                                return ` <
            div class = "flex align-items-center justify-content-between p-3 border-bottom"
        data - student - id = "${student.id}" >
            <
            div >
            <
            strong > $ {
                student.fullName
            } < /strong> <
        div class = "text-sm" > $ {
            student.email
        } < /div> <
        div class = "text-sm mt-1" >
        <
        span class = "status-badge status-present" > $ {
            attendance.present || 0
        }
        present < /span> <
        span class = "status-badge status-absent" > $ {
            attendance.absent || 0
        }
        absent < /span> <
        span class = "status-badge status-excused" > $ {
            attendance.excused || 0
        }
        excused < /span> < /
            div > <
            /div> <
        div class = "flex gap-2" >
        <
        button class = "btn btn-secondary btn-sm student-action"
        data - action = "view" > < i class = "fas fa-eye" > < /i></button >
            <
            button class = "btn btn-danger btn-sm student-action"
        data - action = "remove" > < i class = "fas fa-user-minus" > < /i></button >
            <
            /div> < /
            div >
            `;
                            }).join('')}
                        </div>
                    </div>
                </main>
            </div>
        `;

        app.innerHTML = content;

        // Add event listeners
        document.getElementById('openDrawer').addEventListener('click', toggleDrawer);
        document.getElementById('backToDashboard').addEventListener('click', loadTeacherDashboard);

        if (currentSections.length > 1) {
            document.getElementById('sectionSelector').addEventListener('change', (e) => {
                renderManageStudents(e.target.value);
            });
        }

        document.getElementById('studentSearch').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const students = document.querySelectorAll('#studentsList > div');

            students.forEach(student => {
                const name = student.querySelector('strong').textContent.toLowerCase();
                if (name.includes(searchTerm)) {
                    student.style.display = 'flex';
                } else {
                    student.style.display = 'none';
                }
            });
        });

        document.querySelectorAll('.student-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const studentId = e.currentTarget.closest('[data-student-id]').getAttribute('data-student-id');
                const action = e.currentTarget.getAttribute('data-action');

                if (action === 'view') {
                    viewStudentDetails(studentId, sectionId);
                } else if (action === 'remove') {
                    removeStudentFromSection(studentId, sectionId);
                }
            });
        });
    } catch (error) {
        console.error("Error loading students:", error);
        showToast("Error loading students");
    }
}

// Get Attendance Data for Students
async function getAttendanceData(sectionId) {
    const attendanceData = {};

    try {
        const attendanceSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('attendance')
            .get();

        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            if (!attendanceData[data.studentId]) {
                attendanceData[data.studentId] = {
                    present: 0,
                    absent: 0,
                    excused: 0
                };
            }

            if (data.status === 'present') attendanceData[data.studentId].present++;
            if (data.status === 'absent') attendanceData[data.studentId].absent++;
            if (data.status === 'excused') attendanceData[data.studentId].excused++;
        });
    } catch (error) {
        console.error("Error getting attendance data:", error);
    }

    return attendanceData;
}

// View Student Details
async function viewStudentDetails(studentId, sectionId) {
    const student = currentStudents.find(s => s.id === studentId);
    if (!student) return;

    try {
        // Get attendance records for this student
        const attendanceSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('attendance')
            .where('studentId', '==', studentId)
            .orderBy('date', 'desc')
            .limit(30)
            .get();

        const attendanceRecords = [];
        attendanceSnapshot.forEach(doc => {
            attendanceRecords.push(doc.data());
        });

        // Calculate attendance stats
        const totalRecords = attendanceRecords.length;
        const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
        const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
        const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
        const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

        // Render student details modal
        const modalContent = `
            <div class="modal-header">
                <h3 class="modal-title">${student.fullName}'s Attendance</h3>
                <button class="btn btn-secondary btn-sm close-modal"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="card mb-3">
                    <div class="flex align-items-center justify-content-between">
                        <div>
                            <h4>${student.fullName}</h4>
                            <p>${student.email}</p>
                        </div>
                        <div class="text-center">
                            <div class="text-lg" style="font-size: 2rem; font-weight: 600; color: var(--primary-color);">${attendanceRate}%</div>
                            <div>Attendance Rate</div>
                        </div>
                    </div>
                </div>
                
                <h4>Recent Attendance</h4>
                <div id="attendanceRecords">
                    ${attendanceRecords.map(record => {
                        const date = record.date.toDate ? record.date.toDate() : new Date();
                        return `
                            <div class="flex align-items-center justify-content-between p-2 border-bottom">
                                <div>
                                    <div>${date.toLocaleDateString()}</div>
                                    <div class="text-sm">${date.toLocaleTimeString()}</div>
                                </div>
                                <div class="status-badge ${getStatusClass(record.status)}">${record.status}</div>
                            </div>
                        `;
                    }).join('')}
                    
                    ${attendanceRecords.length === 0 ? '<p>No attendance records yet</p>' : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary close-modal">Close</button>
            </div>
        `;

        showModal('Student Attendance', modalContent, {
            large: true
        });

        // Add event listeners
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error("Error loading student details:", error);
        showToast("Error loading student details");
    }
}

// Get Status Class for Badge
function getStatusClass(status) {
    switch (status) {
        case 'present':
            return 'status-present';
        case 'absent':
            return 'status-absent';
        case 'excused':
            return 'status-excused';
        default:
            return '';
    }
}

// Remove Student from Section
async function removeStudentFromSection(studentId, sectionId) {
    const student = currentStudents.find(s => s.id === studentId);
    if (!student) return;

    const confirm = window.confirm(`Are you sure you want to remove ${student.fullName} from this section?`);
    if (!confirm) return;

    try {
        // Remove student from section
        await db.collection('sections')
            .doc(sectionId)
            .collection('students')
            .doc(studentId)
            .delete();

        // Decrement student count
        await db.collection('sections')
            .doc(sectionId)
            .update({
                studentCount: firebase.firestore.FieldValue.increment(-1)
            });

        showToast("Student removed from section");
        renderManageStudents(sectionId);
    } catch (error) {
        console.error("Error removing student:", error);
        showToast("Error removing student");
    }
}

// Render Attendance Reports
async function renderAttendanceReports() {
    try {
        // Get all sections for this teacher
        const sectionsSnapshot = await db.collection('sections')
            .where('teacherId', '==', currentUser.uid)
            .get();

        const sections = [];
        sectionsSnapshot.forEach(doc => {
            sections.push({
                id: doc.id,
                ...doc.data()
            });
        });

        if (sections.length === 0) {
            app.innerHTML = '<div class="container"><p>No sections available</p></div>';
            return;
        }

        // Get attendance data for the first section by default
        const sectionId = sections[0].id;
        const attendanceData = await getSectionAttendanceData(sectionId);

        // Render reports page
        const content = `
            <div class="container">
                <header class="header">
                    <button id="openDrawer" class="btn btn-secondary"><i class="fas fa-bars"></i></button>
                    <a href="#" class="header-logo">NearCheck</a>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="backToDashboard"><i class="fas fa-arrow-left"></i> Back</button>
                    </div>
                </header>
                
                <main>
                    <div class="dashboard-header">
                        <h1>Attendance Reports</h1>
                        ${sections.length > 1 ? `
                            <select id="sectionSelector" class="form-control">
                                ${sections.map(s => `
                                    <option value="${s.id}" ${s.id === sectionId ? 'selected' : ''}>${s.name}</option>
                                `).join('')}
                            </select>
                        ` : ''}
                    </div>
                    
                    <div class="card mb-3">
                        <div class="flex align-items-center justify-content-between">
                            <div>
                                <h3>${sections.find(s => s.id === sectionId)?.name || 'Section'}</h3>
                                <p>${attendanceData.totalStudents} students</p>
                            </div>
                            <div class="text-center">
                                <div class="text-lg" style="font-size: 2rem; font-weight: 600; color: var(--primary-color);">${attendanceData.attendanceRate}%</div>
                                <div>Overall Attendance</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Monthly Summary</h3>
                            <select id="monthSelector" class="form-control">
                                ${Array.from({ length: 12 }, (_, i) => {
                                    const date = new Date();
                                    date.setMonth(i);
                                    return ` < option value = "${i}"
        $ {
            i === new Date().getMonth() ? 'selected' : ''
        } > $ {
            date.toLocaleString('default', {
                month: 'long'
            })
        } < /option>`;
    }).join('')
} <
/select> < /
div >

    <
    div id = "monthlyReport" >
    <
    !--Monthly report will be loaded here-- >
    <
    /div> < /
    div > <
    /main> < /
    div >
    `;
        
        app.innerHTML = content;
        
        // Add event listeners
        document.getElementById('openDrawer').addEventListener('click', toggleDrawer);
        document.getElementById('backToDashboard').addEventListener('click', loadTeacherDashboard);
        
        if (sections.length > 1) {
            document.getElementById('sectionSelector').addEventListener('change', async (e) => {
                const sectionId = e.target.value;
                const attendanceData = await getSectionAttendanceData(sectionId);
                updateReportHeader(attendanceData);
                loadMonthlyReport(sectionId, new Date().getMonth());
            });
        }
        
        document.getElementById('monthSelector').addEventListener('change', (e) => {
            const month = parseInt(e.target.value);
            loadMonthlyReport(sectionId, month);
        });
        
        // Load initial monthly report
        loadMonthlyReport(sectionId, new Date().getMonth());
    } catch (error) {
        console.error("Error loading reports:", error);
        showToast("Error loading reports");
    }
}

// Get Section Attendance Data
async function getSectionAttendanceData(sectionId) {
    const result = {
        totalStudents: 0,
        attendanceRate: 0,
        presentCount: 0,
        absentCount: 0,
        excusedCount: 0
    };
    
    try {
        // Get student count
        const sectionDoc = await db.collection('sections').doc(sectionId).get();
        result.totalStudents = sectionDoc.data()?.studentCount || 0;
        
        if (result.totalStudents === 0) return result;
        
        // Get attendance records for the past 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const attendanceSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('attendance')
            .where('date', '>=', thirtyDaysAgo)
            .get();
        
        let totalRecords = 0;
        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            totalRecords++;
            
            if (data.status === 'present') result.presentCount++;
            if (data.status === 'absent') result.absentCount++;
            if (data.status === 'excused') result.excusedCount++;
        });
        
        if (totalRecords > 0) {
            result.attendanceRate = Math.round((result.presentCount / totalRecords) * 100);
        }
    } catch (error) {
        console.error("Error getting section attendance:", error);
    }
    
    return result;
}

// Update Report Header
function updateReportHeader(data) {
    const header = document.querySelector('.dashboard-header + .card');
    if (!header) return;
    
    const rateElement = header.querySelector('.text-lg');
    if (rateElement) {
        rateElement.textContent = `
$ {
    data.attendanceRate
} % `;
    }
    
    const studentCountElement = header.querySelector('p');
    if (studentCountElement) {
        studentCountElement.textContent = `
$ {
    data.totalStudents
}
students`;
    }
}

// Load Monthly Report
async function loadMonthlyReport(sectionId, month) {
    const monthlyReport = document.getElementById('monthlyReport');
    if (!monthlyReport) return;
    
    monthlyReport.innerHTML = '<div class="spinner"></div>';
    
    try {
        // Get first and last day of the month
        const year = new Date().getFullYear();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Get attendance records for this month
        const attendanceSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('attendance')
            .where('date', '>=', firstDay)
            .where('date', '<=', lastDay)
            .get();
        
        // Organize data by date
        const recordsByDate = {};
        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.date.toDate();
            const dateString = date.toISOString().split('T')[0];
            
            if (!recordsByDate[dateString]) {
                recordsByDate[dateString] = {
                    present: 0,
                    absent: 0,
                    excused: 0,
                    total: 0
                };
            }
            
            recordsByDate[dateString][data.status]++;
            recordsByDate[dateString].total++;
        });
        
        // Generate calendar view
        const monthName = firstDay.toLocaleString('default', { month: 'long' });
        let calendarHTML = ` <
h4 > $ {
    monthName
}
$ {
    year
} < /h4> <
div class = "calendar-grid" >
<
div class = "calendar-header" > Sun < /div> <
div class = "calendar-header" > Mon < /div> <
div class = "calendar-header" > Tue < /div> <
div class = "calendar-header" > Wed < /div> <
div class = "calendar-header" > Thu < /div> <
div class = "calendar-header" > Fri < /div> <
div class = "calendar-header" > Sat < /div>
`;
        
        // Calculate days in month and starting day
        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay();
        
        // Add empty cells for days before the 1st
        for (let i = 0; i < startDay; i++) {
            calendarHTML += '<div class="calendar-day empty"></div>';
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateString = currentDate.toISOString().split('T')[0];
            const dayRecords = recordsByDate[dateString] || { present: 0, absent: 0, excused: 0, total: 0 };
            const rate = dayRecords.total > 0 ? Math.round((dayRecords.present / dayRecords.total) * 100) : 0;
            
            // Determine color based on attendance rate
            let dayClass = 'no-data';
            if (dayRecords.total > 0) {
                if (rate >= 80) dayClass = 'high-attendance';
                else if (rate >= 50) dayClass = 'medium-attendance';
                else dayClass = 'low-attendance';
            }
            
            calendarHTML += ` <
div class = "calendar-day ${dayClass}"
data - date = "${dateString}" >
    <
    div class = "day-number" > $ {
        day
    } < /div>
$ {
    dayRecords.total > 0 ? `
                        <div class="day-stats">
                            <span class="present">${dayRecords.present}</span>
                            <span class="absent">${dayRecords.absent}</span>
                        </div>
                    ` : ''
} <
/div>
`;
        }
        
        calendarHTML += '</div>'; // Close calendar-grid
        
        // Add detailed attendance for selected date (default to today)
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        const selectedDate = recordsByDate[todayString] ? todayString : Object.keys(recordsByDate)[0];
        
        let detailHTML = '';
        if (selectedDate) {
            const detailRecords = await getAttendanceForDate(sectionId, selectedDate);
            
            detailHTML = ` <
div class = "mt-4" >
<
h4 > Attendance on $ {
    new Date(selectedDate).toLocaleDateString()
} < /h4>
$ {
    detailRecords.length > 0 ? `
                        <div class="attendance-detail">
                            ${detailRecords.map(record => `
                                <div class="flex align-items-center justify-content-between p-2 border-bottom">
                                    <div>
                                        <strong>${record.studentName}</strong>
                                        <div class="text-sm">${record.time}</div>
                                    </div>
                                    <div class="status-badge ${getStatusClass(record.status)}">${record.status}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>No attendance records for this date</p>'
} <
/div>
`;
        }
        
        monthlyReport.innerHTML = calendarHTML + detailHTML;
        
        // Add click handlers for calendar days
        document.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
            day.addEventListener('click', async () => {
                const date = day.getAttribute('data-date');
                const detailRecords = await getAttendanceForDate(sectionId, date);
                
                const detailHTML = ` <
div class = "mt-4" >
<
h4 > Attendance on $ {
    new Date(date).toLocaleDateString()
} < /h4>
$ {
    detailRecords.length > 0 ? `
                            <div class="attendance-detail">
                                ${detailRecords.map(record => `
                                    <div class="flex align-items-center justify-content-between p-2 border-bottom">
                                        <div>
                                            <strong>${record.studentName}</strong>
                                            <div class="text-sm">${record.time}</div>
                                        </div>
                                        <div class="status-badge ${getStatusClass(record.status)}">${record.status}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p>No attendance records for this date</p>'
} <
/div>
`;
                
                // Replace existing detail section
                const existingDetail = monthlyReport.querySelector('.mt-4');
                if (existingDetail) {
                    existingDetail.remove();
                }
                
                monthlyReport.insertAdjacentHTML('beforeend', detailHTML);
            });
        });
    } catch (error) {
        console.error("Error loading monthly report:", error);
        monthlyReport.innerHTML = '<p>Error loading report data</p>';
    }
}

// Get Attendance for Specific Date
async function getAttendanceForDate(sectionId, dateString) {
    const date = new Date(dateString);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    try {
        const snapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('attendance')
            .where('date', '>=', date)
            .where('date', '<', nextDay)
            .get();
        
        const records = [];
        
        // Get student names
        const studentsSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('students')
            .get();
        
        const students = {};
        studentsSnapshot.forEach(doc => {
            students[doc.id] = doc.data().fullName;
        });
        
        // Process attendance records
        snapshot.forEach(doc => {
            const data = doc.data();
            const recordDate = data.date.toDate();
            
            records.push({
                studentId: data.studentId,
                studentName: students[data.studentId] || 'Unknown',
                status: data.status,
                time: recordDate.toLocaleTimeString(),
                date: recordDate
            });
        });
        
        // Sort by time
        records.sort((a, b) => a.date - b.date);
        
        return records;
    } catch (error) {
        console.error("Error getting attendance for date:", error);
        return [];
    }
}

// Render Settings Page
function renderSettings() {
    const content = ` <
div class = "container" >
<
header class = "header" >
<
button id = "openDrawer"
class = "btn btn-secondary" > < i class = "fas fa-bars" > < /i></button >
<
a href = "#"
class = "header-logo" > NearCheck < /a> <
div class = "header-actions" >
<
button class = "btn btn-secondary"
id = "backToDashboard" > < i class = "fas fa-arrow-left" > < /i> Back</button >
    <
    /div> < /
    header >

    <
    main >
    <
    div class = "dashboard-header" >
    <
    h1 > Account Settings < /h1> < /
    div >

    <
    div class = "card mb-3" >
    <
    h3 class = "card-title" > Personal Information < /h3> <
form id = "personalInfoForm" >
    <
    div class = "form-group" >
    <
    label
for = "displayName"
class = "form-label" > Full Name < /label> <
input type = "text"
id = "displayName"
class = "form-control"
value = "${currentUser.displayName || ''}" >
    <
    /div> <
div class = "form-group" >
<
label
for = "email"
class = "form-label" > Email < /label> <
input type = "email"
id = "email"
class = "form-control"
value = "${currentUser.email}"
readonly >
    <
    /div> <
button type = "submit"
class = "btn btn-primary" > Save Changes < /button> < /
    form > <
    /div>

    <
    div class = "card mb-3" >
    <
    h3 class = "card-title" > Change Password < /h3> <
form id = "changePasswordForm" >
    <
    div class = "form-group" >
    <
    label
for = "currentPassword"
class = "form-label" > Current Password < /label> <
input type = "password"
id = "currentPassword"
class = "form-control"
required >
    <
    /div> <
div class = "form-group" >
<
label
for = "newPassword"
class = "form-label" > New Password < /label> <
input type = "password"
id = "newPassword"
class = "form-control"
required minlength = "6" >
    <
    /div> <
div class = "form-group" >
<
label
for = "confirmNewPassword"
class = "form-label" > Confirm New Password < /label> <
input type = "password"
id = "confirmNewPassword"
class = "form-control"
required minlength = "6" >
    <
    /div> <
button type = "submit"
class = "btn btn-primary" > Change Password < /button> < /
    form > <
    /div>

    <
    div class = "card" >
    <
    h3 class = "card-title" > Danger Zone < /h3> <
div class = "form-group" >
<
button id = "deleteAccountBtn"
class = "btn btn-danger" > Delete Account < /button> <
p class = "text-sm mt-1" > This will permanently delete your account and all associated data. < /p> < /
    div > <
    /div> < /
    main > <
    /div>
`;
    
    app.innerHTML = content;
    
    // Add event listeners
    document.getElementById('openDrawer').addEventListener('click', toggleDrawer);
    document.getElementById('backToDashboard').addEventListener('click', loadDashboard);
    document.getElementById('personalInfoForm').addEventListener('submit', updatePersonalInfo);
    document.getElementById('changePasswordForm').addEventListener('submit', changePassword);
    document.getElementById('deleteAccountBtn').addEventListener('click', confirmDeleteAccount);
}

// Update Personal Information
async function updatePersonalInfo(e) {
    e.preventDefault();
    
    const displayName = document.getElementById('displayName').value.trim();
    
    if (!displayName) {
        showToast("Please enter your name");
        return;
    }
    
    try {
        // Update in Firebase Auth
        await currentUser.updateProfile({
            displayName
        });
        
        // Update in Firestore
        await db.collection('users').doc(currentUser.uid).update({
            fullName: displayName
        });
        
        // Update in all sections (for teachers)
        if (currentRole === 'teacher') {
            const sectionsSnapshot = await db.collection('sections')
                .where('teacherId', '==', currentUser.uid)
                .get();
            
            const batch = db.batch();
            sectionsSnapshot.forEach(doc => {
                batch.update(doc.ref, {
                    teacherName: displayName
                });
            });
            
            await batch.commit();
        }
        
        showToast("Profile updated successfully");
    } catch (error) {
        console.error("Error updating profile:", error);
        showToast("Error updating profile");
    }
}

// Change Password
async function changePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (newPassword !== confirmNewPassword) {
        showToast("New passwords don't match");
        return;
    }
    
    try {
        // Reauthenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        
        await currentUser.reauthenticateWithCredential(credential);
        
        // Change password
        await currentUser.updatePassword(newPassword);
        
        // Clear form
        document.getElementById('changePasswordForm').reset();
        
        showToast("Password changed successfully");
    } catch (error) {
        console.error("Error changing password:", error);
        showToast(error.message);
    }
}

// Confirm Account Deletion
function confirmDeleteAccount() {
    const modalContent = ` <
div class = "modal-header" >
<
h3 class = "modal-title" > Delete Account < /h3> <
button class = "btn btn-secondary btn-sm close-modal" > < i class = "fas fa-times" > < /i></button >
<
/div> <
div class = "modal-body" >
<
p > Are you sure you want to delete your account ? This action cannot be undone. < /p> <
div class = "form-group mt-3" >
<
label
for = "deletePassword"
class = "form-label" > Confirm your password < /label> <
input type = "password"
id = "deletePassword"
class = "form-control"
required >
    <
    /div> < /
    div > <
    div class = "modal-footer" >
    <
    button class = "btn btn-secondary close-modal" > Cancel < /button> <
button id = "confirmDeleteAccountBtn"
class = "btn btn-danger" > Delete Account < /button> < /
    div >
    `;
    
    showModal('Delete Account', modalContent);
    
    // Add event listeners
    document.getElementById('confirmDeleteAccountBtn').addEventListener('click', deleteAccount);
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

// Delete Account
async function deleteAccount() {
    const password = document.getElementById('deletePassword').value;
    
    if (!password) {
        showToast("Please enter your password");
        return;
    }
    
    try {
        // Reauthenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            password
        );
        
        await currentUser.reauthenticateWithCredential(credential);
        
        // Delete user data from Firestore
        if (currentRole === 'teacher') {
            // Delete all sections and students
            const sectionsSnapshot = await db.collection('sections')
                .where('teacherId', '==', currentUser.uid)
                .get();
            
            const batch = db.batch();
            sectionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        } else {
            // Remove student from all sections
            const sectionsSnapshot = await db.collectionGroup('students')
                .where('__name__', '==', currentUser.uid)
                .get();
            
            const batch = db.batch();
            sectionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }
        
        // Delete user document
        await db.collection('users').doc(currentUser.uid).delete();
        
        // Delete auth account
        await currentUser.delete();
        
        showToast("Account deleted successfully");
        closeModal();
    } catch (error) {
        console.error("Error deleting account:", error);
        showToast(error.message);
    }
}

// Load Student Dashboard
async function loadStudentDashboard() {
    try {
        // Get student's sections
        const sectionsSnapshot = await db.collectionGroup('students')
            .where('__name__', '==', currentUser.uid)
            .get();
        
        currentSections = [];
        
        for (const doc of sectionsSnapshot.docs) {
            const sectionRef = doc.ref.parent.parent;
            const sectionDoc = await sectionRef.get();
            
            if (sectionDoc.exists) {
                currentSections.push({
                    id: sectionDoc.id,
                    ...sectionDoc.data()
                });
            }
        }
        
        // Render dashboard
        const greeting = getGreeting();
        const dashboardContent = ` <
    div class = "container" >
    <
    header class = "header" >
    <
    button id = "openDrawer"
class = "btn btn-secondary" > < i class = "fas fa-bars" > < /i></button >
<
a href = "#"
class = "header-logo" > NearCheck < /a> <
div class = "header-actions" >
<
button id = "enrollSectionBtn"
class = "btn btn-primary" > +Enroll < /button> < /
    div > <
    /header>

    <
    main >
    <
    div class = "dashboard-header" >
    <
    h1 class = "greeting" > $ {
        greeting
    }, $ {
        currentUser.displayName || 'Student'
    } < /h1> < /
    div >

    <
    h2 > My Classes < /h2>
$ {
    currentSections.length > 0 ? `
                        <div class="section-carousel">
                            ${currentSections.map(section => {
                                // Check if there's an active session for this section
                                const hasActiveSession = false; // Would check RTDB in real implementation
                                
                                return `
                                    <div class="section-card" data-section-id="${section.id}">
                                        <div class="section-actions">
                                            <button class="btn btn-secondary btn-sm section-menu-btn"><i class="fas fa-ellipsis-v"></i></button>
                                        </div>
                                        <h3>${section.name}</h3>
                                        <p>${section.subject}</p>
                                        <p>Teacher: ${section.teacherName}</p>
                                        <p>Schedule: ${section.schedule}</p>
                                        ${hasActiveSession ? `
                                            <button class="btn btn-primary mt-2 checkin-btn" data-section-id="${section.id}">
                                                Check In Now
                                            </button>
                                        ` : `
                                            <div class="mt-2 text-sm">No active session</div>
                                        `}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `
                        <div class="card">
                            <p>You're not enrolled in any classes yet. Use the Enroll button to join a class.</p>
                        </div>
                    `
} <
/main> < /
div >
    `;
        
        app.innerHTML = dashboardContent;
        
        // Add event listeners
        document.getElementById('openDrawer').addEventListener('click', toggleDrawer);
        document.getElementById('enrollSectionBtn').addEventListener('click', renderEnrollSection);
        
        // Add click handlers for section cards
        if (currentSections.length > 0) {
            document.querySelectorAll('.checkin-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const sectionId = e.currentTarget.getAttribute('data-section-id');
                    startCheckInProcess(sectionId);
                });
            });
            
            document.querySelectorAll('.section-menu-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sectionCard = e.currentTarget.closest('.section-card');
                    const sectionId = sectionCard.getAttribute('data-section-id');
                    showStudentSectionMenu(sectionId, e.currentTarget);
                });
            });
        }
    } catch (error) {
        console.error("Error loading student dashboard:", error);
        showToast("Error loading dashboard");
    }
}

// Render Enroll Section
function renderEnrollSection() {
    const modalContent = ` <
    div class = "modal-header" >
    <
    h3 class = "modal-title" > Enroll in a Class < /h3> <
button class = "btn btn-secondary btn-sm close-modal" > < i class = "fas fa-times" > < /i></button >
<
/div> <
div class = "modal-body" >
<
div class = "form-group" >
<
label
for = "sectionCode"
class = "form-label" > Enter Section ID < /label> <
input type = "text"
id = "sectionCode"
class = "form-control"
placeholder = "e.g. ABC123" >
    <
    /div> <
div class = "form-group mt-3" >
<
p > Or use your teacher 's invite link</p> <
input type = "text"
id = "inviteLink"
class = "form-control"
placeholder = "Paste invite link here" >
    <
    /div> < /
    div > <
    div class = "modal-footer" >
    <
    button class = "btn btn-secondary close-modal" > Cancel < /button> <
button id = "enrollSubmitBtn"
class = "btn btn-primary" > Enroll < /button> < /
    div >
    `;
    
    showModal('Enroll in Class', modalContent);
    
    // Add event listeners
    document.getElementById('enrollSubmitBtn').addEventListener('click', handleEnroll);
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Parse section ID from invite link if pasted
    document.getElementById('inviteLink').addEventListener('input', (e) => {
        const url = new URL(e.target.value);
        const sectionId = url.searchParams.get('sectionid');
        if (sectionId) {
            document.getElementById('sectionCode').value = sectionId;
        }
    });
}

// Handle Enroll
async function handleEnroll() {
    const sectionId = document.getElementById('sectionCode').value.trim();
    
    if (!sectionId) {
        showToast("Please enter a Section ID");
        return;
    }
    
    try {
        // Check if section exists
        const sectionRef = db.collection('sections').doc(sectionId);
        const sectionDoc = await sectionRef.get();
        
        if (!sectionDoc.exists) {
            showToast("Invalid Section ID. Please check with your teacher.");
            return;
        }
        
        // Check if already enrolled
        const studentRef = sectionRef.collection('students').doc(currentUser.uid);
        const studentDoc = await studentRef.get();
        
        if (studentDoc.exists) {
            showToast("You're already enrolled in this class");
            return;
        }
        
        // Add student to section
        await studentRef.set({
            fullName: currentUser.displayName || 'Student',
            email: currentUser.email,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Increment student count
        await sectionRef.update({
            studentCount: firebase.firestore.FieldValue.increment(1)
        });
        
        showToast("Enrolled successfully!");
        closeModal();
        loadStudentDashboard();
    } catch (error) {
        console.error("Error enrolling:", error);
        showToast("Error enrolling in class");
    }
}

// Show Student Section Menu
function showStudentSectionMenu(sectionId, buttonElement) {
    const section = currentSections.find(s => s.id === sectionId);
    if (!section) return;
    
    const rect = buttonElement.getBoundingClientRect();
    const menuContent = ` <
    div class = "dropdown-menu"
style = "position: absolute; top: ${rect.bottom + 5}px; left: ${rect.left - 150}px; width: 200px;" >
    <
    div class = "card" >
    <
    div class = "dropdown-item"
data - action = "viewAttendance" > < i class = "fas fa-calendar-check" > < /i> View Attendance</div >
    <
    div class = "dropdown-item"
data - action = "leave" > < i class = "fas fa-sign-out-alt" > < /i> Leave Class</div >
    <
    /div> < /
    div >
    `;
    
    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.dropdown-menu');
    if (existingDropdown) existingDropdown.remove();
    
    // Add new dropdown
    document.body.insertAdjacentHTML('beforeend', menuContent);
    
    // Add click handlers
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const action = e.currentTarget.getAttribute('data-action');
            handleStudentSectionAction(sectionId, action);
            document.querySelector('.dropdown-menu').remove();
        });
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function clickOutside(e) {
            if (!e.target.closest('.dropdown-menu') && e.target !== buttonElement) {
                document.querySelector('.dropdown-menu').remove();
                document.removeEventListener('click', clickOutside);
            }
        });
    }, 10);
}

// Handle Student Section Action
function handleStudentSectionAction(sectionId, action) {
    const section = currentSections.find(s => s.id === sectionId);
    if (!section) return;
    
    switch(action) {
        case 'viewAttendance':
            viewStudentAttendance(sectionId);
            break;
        case 'leave':
            leaveSection(sectionId);
            break;
        default:
            break;
    }
}

// View Student Attendance
async function viewStudentAttendance(sectionId) {
    try {
        // Get attendance records for this student
        const attendanceSnapshot = await db.collection('sections')
            .doc(sectionId)
            .collection('attendance')
            .where('studentId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .limit(30)
            .get();
        
        const attendanceRecords = [];
        attendanceSnapshot.forEach(doc => {
            attendanceRecords.push(doc.data());
        });
        
        // Calculate stats
        const totalRecords = attendanceRecords.length;
        const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
        const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
        const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
        const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
        
        // Render modal
        const section = currentSections.find(s => s.id === sectionId);
        const modalContent = ` <
    div class = "modal-header" >
    <
    h3 class = "modal-title" > My Attendance - $ {
        section?.name || 'Class'
    } < /h3> <
button class = "btn btn-secondary btn-sm close-modal" > < i class = "fas fa-times" > < /i></button >
<
/div> <
div class = "modal-body" >
<
div class = "card mb-3" >
<
div class = "flex align-items-center justify-content-between" >
<
div >
    <
    h4 > $ {
        currentUser.displayName || 'Student'
    } < /h4> <
p > $ {
        section?.name || 'Class'
    } < /p> < /
    div > <
    div class = "text-center" >
    <
    div class = "text-lg"
style = "font-size: 2rem; font-weight: 600; color: var(--primary-color);" > $ {
    attendanceRate
} % < /div> <
div > Attendance Rate < /div> < /
    div > <
    /div> < /
    div >

    <
    h4 > Recent Attendance < /h4> <
div id = "attendanceRecords" >
    $ {
        attendanceRecords.map(record => {
            const date = record.date.toDate ? record.date.toDate() : new Date();
            return `
                            <div class="flex align-items-center justify-content-between p-2 border-bottom">
                                <div>
                                    <div>${date.toLocaleDateString()}</div>
                                    <div class="text-sm">${date.toLocaleTimeString()}</div>
                                </div>
                                <div class="status-badge ${getStatusClass(record.status)}">${record.status}</div>
                            </div>
                        `;
        }).join('')
    }

$ {
    attendanceRecords.length === 0 ? '<p>No attendance records yet</p>' : ''
} <
/div> < /
div > <
    div class = "modal-footer" >
    <
    button class = "btn btn-secondary close-modal" > Close < /button> < /
    div >
    `;
        
        showModal('My Attendance', modalContent, { large: true });
        
        // Add event listeners
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error("Error loading attendance:", error);
        showToast("Error loading attendance records");
    }
}

// Leave Section
async function leaveSection(sectionId) {
    const section = currentSections.find(s => s.id === sectionId);
    if (!section) return;
    
    const confirm = window.confirm(`
Are you sure you want to leave "${section.name}" ? `);
    if (!confirm) return;
    
    try {
        // Remove student from section
        await db.collection('sections')
            .doc(sectionId)
            .collection('students')
            .doc(currentUser.uid)
            .delete();
        
        // Decrement student count
        await db.collection('sections')
            .doc(sectionId)
            .update({
                studentCount: firebase.firestore.FieldValue.increment(-1)
            });
        
        showToast(`
You 've left ${section.name}`);
loadStudentDashboard();
}
catch (error) {
    console.error("Error leaving section:", error);
    showToast("Error leaving section");
}
}

// Start Check-in Process
async function startCheckInProcess(sectionId) {
    const section = currentSections.find(s => s.id === sectionId);
    if (!section) return;

    try {
        // Check if there's an active session
        const sessionRef = rtdb.ref(`sessions/${sectionId}`);
        const sessionSnapshot = await sessionRef.once('value');
        const session = sessionSnapshot.val();

        if (!session || session.status !== 'active') {
            showToast("No active attendance session for this class");
            return;
        }

        // Get current location
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        const studentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
        };

        // Calculate distance from teacher
        const distance = calculateDistance(
            studentLocation.lat,
            studentLocation.lng,
            session.teacherLocation.lat,
            session.teacherLocation.lng
        );

        // Check if within range (including accuracy margin)
        if (distance > (session.checkinRange + studentLocation.accuracy)) {
            showToast(`You're too far from the teacher (${Math.round(distance)}m away)`);
            return;
        }

        // Show check-in confirmation
        showCheckInConfirmation(section, studentLocation, distance);
    } catch (error) {
        console.error("Error starting check-in:", error);
        showToast(error.message);
    }
}

// Calculate Distance Between Coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Show Check-in Confirmation
function showCheckInConfirmation(section, studentLocation, distance) {
    const modalContent = `
        <div class="modal-header">
            <h3 class="modal-title">Check In - ${section.name}</h3>
            <button class="btn btn-secondary btn-sm close-modal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <div class="card mb-3">
                <div class="flex align-items-center justify-content-between">
                    <div>
                        <h4>${currentUser.displayName || 'Student'}</h4>
                        <p>${section.name}</p>
                    </div>
                    <div class="status-badge status-present">Within Range</div>
                </div>
            </div>
            
            <div class="flex align-items-center justify-content-between mb-3">
                <div>
                    <i class="fas fa-location-arrow"></i> Your Location
                </div>
                <div>
                    Accuracy: ${Math.round(studentLocation.accuracy)}m
                </div>
            </div>
            
            <div class="flex align-items-center justify-content-between mb-3">
                <div>
                    <i class="fas fa-chalkboard-teacher"></i> Teacher Location
                </div>
                <div>
                    Distance: ${Math.round(distance)}m
                </div>
            </div>
            
            <div class="form-group mt-4">
                <label class="form-label">
                    <input type="checkbox" id="shareLocation" checked> Share my location with teacher
                </label>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary close-modal">Cancel</button>
            <button id="confirmCheckInBtn" class="btn btn-primary">Check In</button>
        </div>
    `;

    showModal('Check In', modalContent);

    // Add event listeners
    document.getElementById('confirmCheckInBtn').addEventListener('click', () => {
        submitCheckIn(section.id, studentLocation);
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

// Submit Check-in
async function submitCheckIn(sectionId, studentLocation) {
    const shareLocation = document.getElementById('shareLocation').checked;

    try {
        // Record check-in in Realtime DB
        await rtdb.ref(`checkins/${sectionId}/${currentUser.uid}`).set({
            studentId: currentUser.uid,
            studentName: currentUser.displayName || 'Student',
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            location: shareLocation ? studentLocation : null,
            deviceInfo: navigator.userAgent
        });

        showToast("Check-in submitted! Waiting for teacher approval.");
        closeModal();
    } catch (error) {
        console.error("Error submitting check-in:", error);
        showToast("Error submitting check-in");
    }
}

// Show Modal
function showModal(title, content, options = {}) {
    const modalId = 'modal-' + Date.now();
    const sizeClass = options.large ? ' modal-lg' : '';

    const modalHTML = `
        <div id="${modalId}" class="modal${sizeClass}">
            ${content}
        </div>
        <div class="overlay open"></div>
    `;

    modalsContainer.innerHTML = modalHTML;

    // Add animation
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('open');
    }, 10);

    // Return modal element
    return document.getElementById(modalId);
}

// Close Modal
function closeModal() {
    const modal = modalsContainer.querySelector('.modal.open');
    if (modal) {
        modal.classList.remove('open');

        setTimeout(() => {
            modalsContainer.innerHTML = '';
        }, 300);
    }
}

// Show Toast Notification
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Security Headers and Domain Verification
(function() {
    // Prevent iframe embedding
    if (window.self !== window.top) {
        document.body.innerHTML = '<h1 style="text-align: center; margin-top: 50px;">NearCheck cannot be embedded in iframes</h1>';
        return;
    }

    // Allowed domains (in production, you would whitelist your actual domains)
    const allowedDomains = [
        'nearcheck-lite.github.io',
        'nearcheck-lite.firebaseapp.com',
        'localhost'
    ];

    // Check current domain
    const currentDomain = window.location.hostname;
    if (!allowedDomains.includes(currentDomain) && !currentDomain.endsWith('.github.io') && !currentDomain.endsWith('.firebaseapp.com')) {
        document.body.innerHTML = '<h1 style="text-align: center; margin-top: 50px;">Unauthorized domain</h1>';
        return;
    }

    // Force HTTPS in production
    if (window.location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(currentDomain)) {
        window.location.href = 'https://' + window.location.host + window.location.pathname;
    }
})();
