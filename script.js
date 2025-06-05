// Firebase Configuration

const firebaseConfig = {
  apiKey: "AIzaSyBDyh-K_H39W-jyOaLoWZX5ryxE6uoTUkE",
  authDomain: "nearcheck-ccbaa.firebaseapp.com",
  projectId: "nearcheck-ccbaa",
  storageBucket: "nearcheck-ccbaa.firebasestorage.app",
  messagingSenderId: "589499653954",
  appId: "1:589499653954:web:40d667f4d3c27fb444f2db",
  measurementId: "G-L6FPSXE2SQ"
};



// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App State
let currentUser = null;
let userRole = null;
let currentView = 'auth';
let sections = [];
let students = [];
let attendanceSessions = [];
let activeSession = null;
let activeSection = null;

// Location Permission State with enhanced controls
const locationPermission = {
    status: 'not-granted', // 'not-granted', 'granted', 'denied'
    lastUsed: null,
    timer: null,
    expirationTime: 24 * 60 * 60 * 1000, // 24 hours in ms
    activityWindow: null,
    autoCheckIn: false // New feature for auto check-in
};

// Security Measures with enhanced protections
const security = {
    debugCheckInterval: null,
    tamperDetection: {
        lastModified: null,
        integrityCheck: true
    },
    countryRestriction: 'PH', // Only allow access from Philippines
    ipCheckInterval: null
};

// DOM Elements
const appContainer = document.getElementById('app');

// Initialize the app with country restriction check
function initApp() {
    // Check country restriction first
    checkCountryRestriction().then(allowed => {
        if (!allowed) {
            showCountryRestrictionMessage();
            return;
        }

        // Set up security measures
        setupSecurityProtections();

        // Set up auth state listener
        setupAuthStateListener();

        // Initial render
        renderAuthScreen();

        // Check for existing location permission state
        checkExistingLocationPermission();
    }).catch(error => {
        console.error('Error checking country restriction:', error);
        // Fallback - allow access but log the error
        setupSecurityProtections();
        setupAuthStateListener();
        renderAuthScreen();
        checkExistingLocationPermission();
    });
}

// Enhanced country restriction check
async function checkCountryRestriction() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return true; // Bypass for local development
    }

    try {
        // Use free IP geolocation API
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        if (data.country === security.countryRestriction) {
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error fetching geolocation:', error);
        return true; // Allow access if API fails
    }
}

function showCountryRestrictionMessage() {
    appContainer.innerHTML = `
        <div class="country-restriction-container">
            <div class="country-restriction-card">
                <i class="fas fa-globe-americas"></i>
                <h2>Access Restricted</h2>
                <p>NearCheck Lite is currently only available in the Philippines due to regulatory requirements.</p>
                <p>If you believe this is an error, please contact support.</p>
            </div>
        </div>
        <style>
            .country-restriction-container {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .country-restriction-card {
                background: white;
                border-radius: 10px;
                padding: 30px;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .country-restriction-card i {
                font-size: 48px;
                color: #e74c3c;
                margin-bottom: 20px;
            }
            .country-restriction-card h2 {
                color: #2c3e50;
                margin-bottom: 15px;
            }
            .country-restriction-card p {
                color: #7f8c8d;
                margin-bottom: 10px;
            }
        </style>
    `;
}

// Enhanced Security Protections
function setupSecurityProtections() {
    // Detect debugger/tampering attempts
    security.debugCheckInterval = setInterval(() => {
        if (isDebuggerAttached()) {
            handleTamperingDetected();
        }
    }, 1000);

    // Store initial script state for integrity checking
    security.tamperDetection.lastModified = document.lastModified;

    // Prevent right-click in production
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showError('Context menu disabled for security');
        });
    }

    // Periodically check IP country
    security.ipCheckInterval = setInterval(() => {
        checkCountryRestriction().then(allowed => {
            if (!allowed) {
                showCountryRestrictionMessage();
                clearInterval(security.ipCheckInterval);
            }
        });
    }, 3600000); // Check every hour
}

function isDebuggerAttached() {
    const startTime = performance.now();
    debugger;
    return performance.now() - startTime > 100;
}

function handleTamperingDetected() {
    clearInterval(security.debugCheckInterval);
    clearInterval(security.ipCheckInterval);
    showError('Security violation detected');
    auth.signOut();
    setTimeout(() => {
        window.location.href = '/security-error.html';
    }, 2000);
}

// Enhanced Location Permission Management
function checkExistingLocationPermission() {
    if (navigator.permissions) {
        navigator.permissions.query({
                name: 'geolocation'
            })
            .then(permissionStatus => {
                updatePermissionState(permissionStatus.state);
                permissionStatus.onchange = () => {
                    updatePermissionState(permissionStatus.state);
                };
            })
            .catch(() => {
                updatePermissionState('prompt');
            });
    } else {
        updatePermissionState('prompt');
    }

    // Load auto check-in preference from localStorage
    const autoCheckInPref = localStorage.getItem('autoCheckInPref');
    if (autoCheckInPref) {
        locationPermission.autoCheckIn = autoCheckInPref === 'true';
    }
}

function updatePermissionState(state) {
    switch (state) {
        case 'granted':
            locationPermission.status = 'granted';
            startActivityWindow();
            break;
        case 'denied':
            locationPermission.status = 'denied';
            clearActivityWindow();
            break;
        case 'prompt':
            locationPermission.status = 'not-granted';
            clearActivityWindow();
            break;
    }

    if (currentView === 'permissions') {
        renderPermissionsContent();
    }
}

function startActivityWindow() {
    if (locationPermission.timer) {
        clearTimeout(locationPermission.timer);
    }

    locationPermission.lastUsed = new Date();
    locationPermission.activityWindow = new Date(Date.now() + locationPermission.expirationTime);

    locationPermission.timer = setTimeout(() => {
        locationPermission.status = 'not-granted';
        locationPermission.autoCheckIn = false;
        localStorage.setItem('autoCheckInPref', 'false');
        if (currentView === 'permissions') {
            renderPermissionsContent();
        }
    }, locationPermission.expirationTime);
}

function extendActivityWindow() {
    if (locationPermission.status === 'granted') {
        startActivityWindow();
    }
}

function clearActivityWindow() {
    if (locationPermission.timer) {
        clearTimeout(locationPermission.timer);
    }
    locationPermission.lastUsed = null;
    locationPermission.activityWindow = null;
}

function requestLocationPermission(context = 'general') {
    return new Promise((resolve, reject) => {
        if (locationPermission.status === 'granted') {
            resolve(true);
            return;
        }

        if (locationPermission.status === 'denied') {
            reject(new Error('Location access was previously denied. Please enable it in settings.'));
            return;
        }

        showLocationPermissionPrompt(context).then((userResponse) => {
            if (userResponse === 'granted') {
                navigator.geolocation.getCurrentPosition(
                    () => {
                        locationPermission.status = 'granted';
                        startActivityWindow();
                        resolve(true);
                    },
                    (error) => {
                        locationPermission.status = 'denied';
                        reject(error);
                    }, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            } else {
                locationPermission.status = 'denied';
                reject(new Error('Location access was denied by user.'));
            }
        });
    });
}

function showLocationPermissionPrompt(context) {
    return new Promise((resolve) => {
        let contextMessage = '';
        let icon = 'fa-map-marker-alt';

        switch (context) {
            case 'check-in':
                contextMessage = 'To verify your attendance, NearCheck needs to confirm your location matches the class session.';
                icon = 'fa-calendar-check';
                break;
            case 'session':
                contextMessage = 'To start an attendance session, NearCheck needs to record your location as the check-in point for students.';
                icon = 'fa-chalkboard-teacher';
                break;
            default:
                contextMessage = 'NearCheck uses your location only for attendance verification during active class sessions.';
        }

        showModal({
            title: 'Location Access Required',
            body: `
                <div class="permission-prompt">
                    <div class="permission-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="permission-content">
                        <h3>Enable Location Access</h3>
                        <p>${contextMessage}</p>
                        <p>Location data is only used for attendance purposes and is not stored permanently.</p>
                        <div class="permission-details">
                            <div class="detail-item">
                                <i class="fas fa-shield-alt"></i>
                                <span>Strictly limited to attendance verification</span>
                            </div>
                            <div class="detail-item">
                                <i class="fas fa-clock"></i>
                                <span>Automatically expires after 24 hours of inactivity</span>
                            </div>
                            <div class="detail-item">
                                <i class="fas fa-eye-slash"></i>
                                <span>Never runs in the background</span>
                            </div>
                        </div>
                        <div class="auto-checkin-option">
                            <label>
                                <input type="checkbox" id="auto-checkin-toggle">
                                Enable auto check-in (within 24-hour window)
                            </label>
                            <p class="small-text">Automatically check-in when in class location</p>
                        </div>
                    </div>
                </div>
                <style>
                    .auto-checkin-option {
                        margin-top: 16px;
                        padding: 12px;
                        background: #f8f9fa;
                        border-radius: 8px;
                    }
                    .auto-checkin-option label {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        cursor: pointer;
                    }
                    .small-text {
                        font-size: 12px;
                        color: #6c757d;
                        margin-top: 4px;
                        margin-left: 24px;
                    }
                </style>
            `,
            buttons: [{
                    text: 'Not Now',
                    class: 'button-secondary',
                    action: () => {
                        resolve('denied');
                        return true;
                    }
                },
                {
                    text: 'Allow Location',
                    class: 'button-primary',
                    action: () => {
                        const autoCheckIn = document.getElementById('auto-checkin-toggle').checked;
                        locationPermission.autoCheckIn = autoCheckIn;
                        localStorage.setItem('autoCheckInPref', autoCheckIn.toString());
                        resolve('granted');
                        return true;
                    }
                }
            ]
        });
    });
}

// Enhanced Auth State Listener with auto check-in
function setupAuthStateListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await fetchUserData();
            renderDashboard();

            // Check for auto check-in if permission is granted
            if (locationPermission.status === 'granted' && locationPermission.autoCheckIn) {
                checkForAutoCheckIn();
            }
        } else {
            currentUser = null;
            userRole = null;
            renderAuthScreen();
        }
    });
}

// Auto check-in logic
async function checkForAutoCheckIn() {
    if (userRole !== 'student' || !sections.length) return;

    try {
        // Get current location
        const position = await getCurrentPosition();
        const currentLocation = new firebase.firestore.GeoPoint(
            position.coords.latitude,
            position.coords.longitude
        );

        // Check active sessions for each section
        for (const section of sections) {
            const sessionsSnapshot = await db.collection('sessions')
                .where('sectionId', '==', section.id)
                .where('status', '==', 'active')
                .get();

            if (!sessionsSnapshot.empty) {
                const session = sessionsSnapshot.docs[0].data();
                const sessionId = sessionsSnapshot.docs[0].id;

                // Check if already checked in
                if (session.attendees && session.attendees.includes(currentUser.uid)) {
                    continue;
                }

                // Calculate distance
                const distance = calculateDistance(
                    session.location.latitude,
                    session.location.longitude,
                    currentLocation.latitude,
                    currentLocation.longitude
                );

                // If within range, auto check-in
                if (distance <= session.range) {
                    await db.collection('attendance').add({
                        sessionId,
                        sectionId: section.id,
                        studentId: currentUser.uid,
                        studentName: currentUser.displayName || 'Student',
                        checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
                        location: currentLocation,
                        distance,
                        status: 'present (auto)',
                        deviceInfo: navigator.userAgent
                    });

                    await db.collection('sessions').doc(sessionId).update({
                        attendees: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                    });

                    showSuccess(`Auto check-in successful for ${section.name}`);
                }
            }
        }
    } catch (error) {
        console.error('Auto check-in failed:', error);
    }
}

// Enhanced Fetch User Data with data privacy compliance
async function fetchUserData() {
    try {
        showLoading('Loading your data...');

        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userRole = userDoc.data().role;

            if (userRole === 'teacher') {
                const sectionsSnapshot = await db.collection('sections')
                    .where('teacherId', '==', currentUser.uid)
                    .get();
                sections = sectionsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Fetch students for each section with minimal data
                const studentsPromises = sections.map(async section => {
                    const studentsSnapshot = await db.collection('users')
                        .where('sections', 'array-contains', section.id)
                        .where('role', '==', 'student')
                        .select('fullName', 'email', 'sections') // Only fetch necessary fields
                        .get();
                    return studentsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                });

                const studentsArrays = await Promise.all(studentsPromises);
                students = studentsArrays.flat();
            } else if (userRole === 'student') {
                const userData = userDoc.data();
                sections = [];

                if (userData.sections && userData.sections.length > 0) {
                    const sectionsSnapshot = await db.collection('sections')
                        .where(firebase.firestore.FieldPath.documentId(), 'in', userData.sections)
                        .select('name', 'subject', 'schedule', 'teacherName', 'checkInRange') // Only fetch necessary fields
                        .get();
                    sections = sectionsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                }
            }
        }

        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Failed to fetch user data. Please refresh the page to try again.');
        console.error('Error fetching user data:', error);
    }
}

// Enhanced Auth Screens with better validation
function renderAuthScreen() {
    currentView = 'auth';
    appContainer.innerHTML = `
        <div class="auth-container">
            <div class="auth-card card">
                <div class="auth-header">
                    <img src="nearcheck.svg" style="width: 50%; height: auto;">
                    <h1>NearCheck Lite</h1>
                    <p>Smart geolocation-based attendance system for educators and students</p>
                </div>
                <div id="auth-content"></div>
            </div>
        </div>
    `;

    renderRoleSelection();
}

function renderRoleSelection() {
    const authContent = document.getElementById('auth-content');
    authContent.innerHTML = `
        <div class="role-selector">
            <button class="role-button" id="teacher-role-btn" aria-label="I'm a Teacher">
                <span>I'm a Teacher</span>
                <i class="fas fa-chalkboard-teacher" aria-hidden="true"></i>
            </button>
            <button class="role-button" id="student-role-btn" aria-label="I'm a Student">
                <span>I'm a Student</span>
                <i class="fas fa-user-graduate" aria-hidden="true"></i>
            </button>
        </div>
        <div class="auth-footer" style="font-weight:400; font-size: 1rem;">
            Already have an account? <a href="#" id="sign-in-link" style="font-weight:500;">Sign in</a>
        </div>
    `;

    document.getElementById('teacher-role-btn').addEventListener('click', () => renderSignUpForm('teacher'));
    document.getElementById('student-role-btn').addEventListener('click', () => renderSignUpForm('student'));
    document.getElementById('sign-in-link').addEventListener('click', (e) => {
        e.preventDefault();
        renderSignInForm();
    });
}

function renderSignUpForm(role) {
    const authContent = document.getElementById('auth-content');

    if (role === 'teacher') {
        authContent.innerHTML = `
            <form id="signup-form">
                <div class="input-group">
                    <label for="fullname">Full Name</label>
                    <input type="text" id="fullname" required aria-required="true" maxlength="100">
                </div>
                <div class="input-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" required aria-required="true" maxlength="100">
                </div>
                <div class="input-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" required minlength="6" aria-required="true" maxlength="100">
                    <p class="input-hint">Minimum 6 characters</p>
                </div>
                <div class="input-group">
                    <label for="confirm-password">Confirm Password</label>
                    <input type="password" id="confirm-password" required minlength="6" aria-required="true" maxlength="100">
                </div>
                <div class="input-group">
                    <label for="birthdate">Birthdate (Must be 20+)</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="birthdate-day" placeholder="DD" maxlength="2" style="flex: 1;" pattern="[0-9]*" inputmode="numeric">
                        <input type="text" id="birthdate-month" placeholder="MM" maxlength="2" style="flex: 1;" pattern="[0-9]*" inputmode="numeric">
                        <input type="text" id="birthdate-year" placeholder="YYYY" maxlength="4" style="flex: 2;" pattern="[0-9]*" inputmode="numeric">
                    </div>
                </div>
                <div class="input-group">
                    <label>
                        <input type="checkbox" id="privacy-policy" required aria-required="true"> 
                        I agree to the <a href="#" id="privacy-policy-link">Privacy Policy</a>
                    </label>
                </div>
                <button type="submit" class="button button-primary w-100 mt-4">Create Account</button>
            </form>
            <div class="auth-footer">
                Already have an account? <a href="#" id="sign-in-link">Sign in</a>
            </div>
        `;

        setupDateInputs();
    } else {
        authContent.innerHTML = `
            <form id="signup-form">
                <div class="input-group">
                    <label for="fullname">Full Name</label>
                    <input type="text" id="fullname" required aria-required="true" maxlength="100">
                </div>
                <div class="input-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" required aria-required="true" maxlength="100">
                </div>
                <div class="input-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" required minlength="6" aria-required="true" maxlength="100">
                    <p class="input-hint">Minimum 6 characters</p>
                </div>
                <div class="input-group">
                    <label for="confirm-password">Confirm Password</label>
                    <input type="password" id="confirm-password" required minlength="6" aria-required="true" maxlength="100">
                </div>
                <div class="input-group">
                    <label for="section-id">Section ID (optional)</label>
                    <input type="text" id="section-id" placeholder="Provided by your teacher" maxlength="50">
                </div>
                <div class="input-group">
                    <label>
                        <input type="checkbox" id="age-confirm" required aria-required="true"> 
                        I confirm I'm 13 years or older
                    </label>
                </div>
                <div class="input-group">
                    <label>
                        <input type="checkbox" id="privacy-policy" required aria-required="true"> 
                        I agree to the <a href="#" id="privacy-policy-link">Privacy Policy</a>
                    </label>
                </div>
                <button type="submit" class="button button-primary w-100 mt-4">Continue</button>
            </form>
            <div class="auth-footer">
                Already have an account? <a href="#" id="sign-in-link">Sign in</a>
            </div>
        `;

        const urlParams = new URLSearchParams(window.location.search);
        const sectionId = urlParams.get('sectionid');
        if (sectionId) {
            document.getElementById('section-id').value = sectionId;
        }
    }

    document.getElementById('signup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSignUp(role);
    });

    document.getElementById('sign-in-link').addEventListener('click', (e) => {
        e.preventDefault();
        renderSignInForm();
    });

    document.getElementById('privacy-policy-link').addEventListener('click', (e) => {
        e.preventDefault();
        showPrivacyPolicy();
    });
}

function showPrivacyPolicy() {
    showModal({
        title: 'Privacy Policy',
        body: `
            <div style="max-height: 400px; overflow-y: auto;">
                <h3>Data Privacy Act of 2012 Compliance</h3>
                <p>NearCheck Lite complies with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).</p>
                
                <h4>Data Collection</h4>
                <p>We collect only the minimum necessary personal information for attendance tracking:</p>
                <ul>
                    <li>For teachers: Name, email, birthdate</li>
                    <li>For students: Name, email, age confirmation</li>
                </ul>
                
                <h4>Location Data</h4>
                <p>Location data is collected only during active attendance sessions and is:</p>
                <ul>
                    <li>Used solely for attendance verification</li>
                    <li>Stored in anonymized form</li>
                    <li>Automatically deleted after 30 days</li>
                </ul>
                
                <h4>Your Rights</h4>
                <p>Under the Data Privacy Act, you have the right to:</p>
                <ul>
                    <li>Access your personal data</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Withdraw consent</li>
                </ul>
                
                <p>For any data privacy concerns, please contact our Data Protection Officer at dpo@nearcheck.com</p>
            </div>
        `,
        buttons: [{
            text: 'Close',
            class: 'button-primary',
            action: 'close'
        }]
    });
}

function setupDateInputs() {
    const dayInput = document.getElementById('birthdate-day');
    const monthInput = document.getElementById('birthdate-month');
    const yearInput = document.getElementById('birthdate-year');

    dayInput.addEventListener('input', function() {
        if (this.value.length === 2) {
            monthInput.focus();
        }
    });

    monthInput.addEventListener('input', function() {
        if (this.value.length === 2) {
            yearInput.focus();
        }
    });

    [dayInput, monthInput, yearInput].forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key < '0' || e.key > '9') {
                e.preventDefault();
            }
        });

        input.addEventListener('paste', function(e) {
            const pasteData = e.clipboardData.getData('text');
            if (!/^\d+$/.test(pasteData)) {
                e.preventDefault();
            }
        });
    });
}

function renderSignInForm() {
    const authContent = document.getElementById('auth-content');
    authContent.innerHTML = `
        <form id="signin-form">
            <div class="input-group">
                <label for="email">Email</label>
                <input type="email" id="email" required aria-required="true" maxlength="100">
            </div>
            <div class="input-group">
                <label for="password">Password</label>
                <input type="password" id="password" required aria-required="true" maxlength="100">
            </div>
            <div class="input-group">
                <a href="#" id="forgot-password" style="font-size: 14px; text-align: right; display: block;">Forgot password?</a>
            </div>
            <button type="submit" class="button button-primary w-100">Sign In</button>
        </form>
        <div class="auth-footer">
            New to NearCheck? <a href="#" id="sign-up-link">Sign up</a>
        </div>
    `;

    document.getElementById('signin-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSignIn();
    });

    document.getElementById('sign-up-link').addEventListener('click', (e) => {
        e.preventDefault();
        renderRoleSelection();
    });

    document.getElementById('forgot-password').addEventListener('click', (e) => {
        e.preventDefault();
        showForgotPasswordModal();
    });
}

async function handleSignUp(role) {
    const fullName = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const privacyPolicyAccepted = document.getElementById('privacy-policy').checked;

    if (!fullName || !email || !password || !confirmPassword) {
        showError('Please fill all required fields');
        return;
    }

    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }

    if (!privacyPolicyAccepted) {
        showError('You must agree to the Privacy Policy');
        return;
    }

    if (role === 'teacher') {
        const day = document.getElementById('birthdate-day').value;
        const month = document.getElementById('birthdate-month').value;
        const year = document.getElementById('birthdate-year').value;

        if (!day || !month || !year) {
            showError('Please enter your complete birthdate');
            return;
        }

        const birthDate = new Date(`${year}-${month}-${day}`);
        if (isNaN(birthDate.getTime())) {
            showError('Please enter a valid date');
            return;
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 20) {
            showError('You must be at least 20 years old to register as a teacher');
            return;
        }
    }

    if (role === 'student' && !document.getElementById('age-confirm').checked) {
        showError('You must confirm you are at least 13 years old');
        return;
    }

    try {
        showLoading('Creating account...');

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const userData = {
            fullName,
            email,
            role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (role === 'student') {
            const sectionId = document.getElementById('section-id').value.trim();
            if (sectionId) {
                userData.sections = [sectionId];
            } else {
                userData.sections = [];
            }
        }

        await db.collection('users').doc(user.uid).set(userData);

        await user.updateProfile({
            displayName: fullName
        });

        hideLoading();

        currentUser = user;
        userRole = role;
        await fetchUserData();
        renderDashboard();
    } catch (error) {
        hideLoading();
        if (error.code === 'auth/email-already-in-use') {
            showError('This email is already registered. Please sign in instead.');
        } else if (error.code === 'auth/weak-password') {
            showError('Password should be at least 6 characters');
        } else if (error.code === 'auth/invalid-email') {
            showError('Please enter a valid email address');
        } else {
            showError(error.message || 'Account creation failed. Please try again.');
        }
    }
}

async function handleSignIn() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }

    try {
        showLoading('Signing in...');
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;

        // Update last login time
        await db.collection('users').doc(currentUser.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });

        hideLoading();
    } catch (error) {
        hideLoading();
        if (error.code === 'auth/user-not-found') {
            showError('No account found with this email. Please sign up.');
        } else if (error.code === 'auth/wrong-password') {
            showError('Incorrect password. Please try again.');
        } else if (error.code === 'auth/too-many-requests') {
            showError('Too many failed attempts. Please try again later or reset your password.');
        } else {
            showError(error.message || 'Sign in failed. Please try again.');
        }
    }
}

// Enhanced Dashboard with better section management
function renderDashboard() {
    currentView = 'dashboard';
    appContainer.innerHTML = `
        <div class="dashboard">
            <div class="drawer">
                <div class="drawer-header">
                    <button class="menu-toggle" id="drawer-toggle" aria-label="Toggle menu">
                        <i class="fas fa-bars"></i>
                    </button>
                    <h2>NearCheck</h2>
                </div>
                <div class="drawer-menu">
                    <a href="#" class="menu-item active" data-view="dashboard" aria-current="page">
                        <i class="fas fa-home"></i>
                        <span>Dashboard</span>
                    </a>
                    <a href="#" class="menu-item" data-view="sections">
                        <i class="fas fa-layer-group"></i>
                        <span>My Sections</span>
                    </a>
                    ${userRole === 'teacher' ? `
                        <a href="#" class="menu-item" data-view="students">
                            <i class="fas fa-users"></i>
                            <span>My Students</span>
                        </a>
                        <a href="#" class="menu-item" data-view="reports">
                            <i class="fas fa-chart-bar"></i>
                            <span>Attendance Reports</span>
                        </a>
                    ` : ''}
                    <a href="#" class="menu-item" data-view="permissions">
                        <i class="fas fa-shield-alt"></i>
                        <span>Permissions</span>
                    </a>
                    <a href="#" class="menu-item" data-view="account">
                        <i class="fas fa-user"></i>
                        <span>Account</span>
                    </a>
                </div>
                <div class="drawer-footer">
                    <button class="button button-danger" id="sign-out-btn">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
            <div class="main-content">
                <div class="content-header">
                    <h1>Dashboard</h1>
                    <button class="menu-toggle" id="mobile-drawer-toggle" aria-label="Toggle menu">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>
                <div class="content-body" id="content-area"></div>
            </div>
        </div>
    `;

    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            setActiveMenuItem(view);
            renderContent(view);
        });
    });

    document.getElementById('sign-out-btn').addEventListener('click', () => {
        auth.signOut();
    });

    document.getElementById('drawer-toggle').addEventListener('click', toggleDrawer);
    document.getElementById('mobile-drawer-toggle').addEventListener('click', toggleDrawer);

    updateDrawerState();
    renderContent('dashboard');
}

function toggleDrawer() {
    document.querySelector('.drawer').classList.toggle('open');
}

function updateDrawerState() {
    const drawer = document.querySelector('.drawer');
    if (window.innerWidth >= 992) {
        drawer.classList.add('open');
    } else {
        drawer.classList.remove('open');
    }
}

function setActiveMenuItem(view) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
        if (item.getAttribute('data-view') === view) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
        }
    });
}

function renderContent(view) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    document.querySelector('.content-header h1').textContent = view.charAt(0).toUpperCase() + view.slice(1).replace(/-/g, ' ');

    switch (view) {
        case 'dashboard':
            renderDashboardContent();
            break;
        case 'sections':
            renderSectionsContent();
            break;
        case 'students':
            renderStudentsContent();
            break;
        case 'reports':
            renderReportsContent();
            break;
        case 'permissions':
            renderPermissionsContent();
            break;
        case 'account':
            renderAccountContent();
            break;
        default:
            renderDashboardContent();
    }
}

function renderDashboardContent() {
    const now = new Date();
    const hours = now.getHours();
    let greeting = 'Good morning';

    if (hours >= 12 && hours < 17) {
        greeting = 'Good afternoon';
    } else if (hours >= 17 || hours < 5) {
        greeting = 'Good evening';
    }

    const firstName = currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'User';

    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="greeting">
            <h2>${greeting}, ${firstName}</h2>
            <p>${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        ${userRole === 'teacher' ? `
            <div class="header-actions" style="margin-bottom: 24px;">
                <button class="button button-primary" id="create-section-btn">
                    <i class="fas fa-plus"></i>
                    <span>Create Section</span>
                </button>
            </div>
        ` : ''}
        
        ${sections.length > 0 ? `
            <div class="section-carousel">
                ${sections.map(section => `
                    <div class="section-card card" data-section-id="${section.id}">
                        <div class="section-menu" aria-label="Section options">
                            <i class="fas fa-ellipsis-v"></i>
                            <div class="dropdown-menu">
                                ${userRole === 'teacher' ? `
                                    <a href="#" class="dropdown-item" data-action="edit" data-section-id="${section.id}">
                                        <i class="fas fa-edit"></i> Edit
                                    </a>
                                    <a href="#" class="dropdown-item" data-action="delete" data-section-id="${section.id}">
                                        <i class="fas fa-trash"></i> Delete
                                    </a>
                                    <a href="#" class="dropdown-item" data-action="invite" data-section-id="${section.id}">
                                        <i class="fas fa-user-plus"></i> Invite Students
                                    </a>
                                ` : `
                                    <a href="#" class="dropdown-item" data-action="leave" data-section-id="${section.id}">
                                        <i class="fas fa-sign-out-alt"></i> Leave Section
                                    </a>
                                `}
                            </div>
                        </div>
                        <h3>${section.name}</h3>
                        <p>${section.subject}</p>
                        <span class="section-id">${section.id}</span>
                        ${userRole === 'teacher' ? `
                            <p>${section.students ? section.students.length : 0} students</p>
                            <div class="section-actions">
                                <button class="button button-primary start-session-btn" aria-label="Start attendance session for ${section.name}">
                                    Start Session
                                </button>
                            </div>
                        ` : `
                            <div class="teacher-info">
                                <div class="teacher-avatar">${section.teacherName ? section.teacherName.charAt(0) : 'T'}</div>
                                <span>${section.teacherName || 'Teacher'}</span>
                            </div>
                            <div class="section-actions">
                                <button class="button button-primary checkin-btn" aria-label="Check in to ${section.name}">
                                    Check In
                                </button>
                            </div>
                        `}
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="empty-state">
                <i class="fas fa-layer-group"></i>
                <h3>No Sections Found</h3>
                <p>${userRole === 'teacher' ? 'Create your first section to get started with attendance tracking' : 'Join a section using an invitation link from your teacher to begin checking in'}</p>
                ${userRole === 'teacher' ? `
                    <button class="button button-primary mt-4" id="create-section-btn-2">
                        Create Section
                    </button>
                ` : `
                    <button class="button button-primary mt-4" id="join-section-btn">
                        Join Section
                    </button>
                `}
            </div>
        `}
        <style>
            .section-menu {
                position: relative;
                cursor: pointer;
                margin-left: auto;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            
            .section-menu:hover {
                background-color: rgba(0, 0, 0, 0.1);
            }
            
            .dropdown-menu {
                display: none;
                position: absolute;
                right: 0;
                top: 100%;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                z-index: 100;
                min-width: 180px;
                overflow: hidden;
            }
            
            .section-menu:hover .dropdown-menu {
                display: block;
            }
            
            .dropdown-item {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                color: #333;
                text-decoration: none;
                gap: 8px;
                font-size: 14px;
            }
            
            .dropdown-item:hover {
                background-color: #f5f5f5;
            }
            
            .dropdown-item i {
                width: 16px;
                text-align: center;
            }
        </style>
    `;

    if (userRole === 'teacher') {
        const createSectionBtn = document.getElementById('create-section-btn') || document.getElementById('create-section-btn-2');
        if (createSectionBtn) {
            createSectionBtn.addEventListener('click', () => showCreateSectionModal());
        }

        document.querySelectorAll('.start-session-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sectionCard = e.target.closest('.section-card');
                const sectionId = sectionCard.getAttribute('data-section-id');
                const section = sections.find(s => s.id === sectionId);
                showStartSessionModal(section);
            });
        });
    } else {
        const joinSectionBtn = document.getElementById('join-section-btn');
        if (joinSectionBtn) {
            joinSectionBtn.addEventListener('click', () => renderSectionsContent());
        }

        document.querySelectorAll('.checkin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sectionCard = e.target.closest('.section-card');
                const sectionId = sectionCard.getAttribute('data-section-id');
                const section = sections.find(s => s.id === sectionId);
                handleStudentCheckIn(section);
            });
        });
    }

    // Set up dropdown menu actions
    document.querySelectorAll('.dropdown-item[data-action="edit"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);
            showEditSectionModal(section);
        });
    });

    document.querySelectorAll('.dropdown-item[data-action="delete"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);
            showDeleteSectionModal(section);
        });
    });

    document.querySelectorAll('.dropdown-item[data-action="invite"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);
            showInviteStudentsModal(section);
        });
    });

    document.querySelectorAll('.dropdown-item[data-action="leave"]').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);

            if (confirm(`Are you sure you want to leave ${section.name}?`)) {
                try {
                    showLoading('Leaving section...');
                    await db.collection('users').doc(currentUser.uid).update({
                        sections: firebase.firestore.FieldValue.arrayRemove(sectionId)
                    });

                    await fetchUserData();
                    hideLoading();
                    showSuccess(`You have left ${section.name}`);
                    renderDashboardContent();
                } catch (error) {
                    hideLoading();
                    showError('Failed to leave section: ' + error.message);
                }
            }
        });
    });
}

// Enhanced Sections Content with better management
function renderSectionsContent() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        ${userRole === 'teacher' ? `
            <div class="header-actions" style="margin-bottom: 24px;">
                <button class="button button-primary" id="create-section-btn">
                    <i class="fas fa-plus"></i>
                    <span>Create Section</span>
                </button>
            </div>
        ` : ''}
        
        ${sections.length > 0 ? `
            <div class="section-list">
                ${sections.map(section => `
                    <div class="card mb-4" data-section-id="${section.id}">
                        <div class="d-flex align-items-center justify-content-between">
                            <h3>${section.name}</h3>
                            <div class="section-menu" aria-label="Section options">
                                <i class="fas fa-ellipsis-v"></i>
                                <div class="dropdown-menu">
                                    ${userRole === 'teacher' ? `
                                        <a href="#" class="dropdown-item" data-action="edit" data-section-id="${section.id}">
                                            <i class="fas fa-edit"></i> Edit
                                        </a>
                                        <a href="#" class="dropdown-item" data-action="delete" data-section-id="${section.id}">
                                            <i class="fas fa-trash"></i> Delete
                                        </a>
                                        <a href="#" class="dropdown-item" data-action="invite" data-section-id="${section.id}">
                                            <i class="fas fa-user-plus"></i> Invite Students
                                        </a>
                                    ` : `
                                        <a href="#" class="dropdown-item" data-action="leave" data-section-id="${section.id}">
                                            <i class="fas fa-sign-out-alt"></i> Leave Section
                                        </a>
                                    `}
                                </div>
                            </div>
                        </div>
                        <p class="text-muted">${section.subject}</p>
                        <p><strong>Schedule:</strong> ${section.schedule}</p>
                        <p><strong>Section ID:</strong> <span class="section-id">${section.id}</span></p>
                        <p><strong>Check-in Range:</strong> ${section.checkInRange}m</p>
                        
                        ${userRole === 'teacher' ? `
                            <div class="section-actions mt-4" style="display: flex; gap: 8px;">
                                <button class="button button-primary invite-students-btn">
                                    <i class="fas fa-user-plus"></i>
                                    <span>Invite Students</span>
                                </button>
                                <button class="button button-secondary manage-students-btn">
                                    <i class="fas fa-users-cog"></i>
                                    <span>Manage Students</span>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="empty-state">
                <i class="fas fa-layer-group"></i>
                <h3>No Sections Found</h3>
                <p>${userRole === 'teacher' ? 'Create your first section to start managing attendance' : 'Join a section to begin checking in to classes'}</p>
                ${userRole === 'teacher' ? `
                    <button class="button button-primary mt-4" id="create-section-btn-2">
                        Create Section
                    </button>
                ` : `
                    <div class="input-group mt-4">
                        <input type="text" id="join-section-input" placeholder="Enter Section ID">
                        <button class="button button-primary w-100" id="join-section-btn">
                            Join Section
                        </button>
                    </div>
                    <p class="text-center text-muted mt-2">Get the section ID from your teacher</p>
                `}
            </div>
        `}
    `;

    if (userRole === 'teacher') {
        const createSectionBtn = document.getElementById('create-section-btn') || document.getElementById('create-section-btn-2');
        if (createSectionBtn) {
            createSectionBtn.addEventListener('click', () => showCreateSectionModal());
        }

        document.querySelectorAll('.invite-students-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sectionCard = e.target.closest('.card');
                const sectionId = sectionCard.getAttribute('data-section-id');
                const section = sections.find(s => s.id === sectionId);
                showInviteStudentsModal(section);
            });
        });

        document.querySelectorAll('.manage-students-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sectionCard = e.target.closest('.card');
                const sectionId = sectionCard.getAttribute('data-section-id');
                const section = sections.find(s => s.id === sectionId);
                showManageStudentsModal(section);
            });
        });
    } else {
        const joinSectionBtn = document.getElementById('join-section-btn');
        if (joinSectionBtn) {
            joinSectionBtn.addEventListener('click', async () => {
                const sectionId = document.getElementById('join-section-input').value.trim();
                if (!sectionId) {
                    showError('Please enter a section ID');
                    return;
                }

                try {
                    showLoading('Joining section...');
                    const sectionDoc = await db.collection('sections').doc(sectionId).get();
                    if (!sectionDoc.exists) {
                        throw new Error('Section not found. Please check the ID and try again.');
                    }

                    await db.collection('users').doc(currentUser.uid).update({
                        sections: firebase.firestore.FieldValue.arrayUnion(sectionId)
                    });

                    await fetchUserData();
                    hideLoading();
                    renderContent('sections');
                } catch (error) {
                    hideLoading();
                    showError(error.message);
                }
            });
        }
    }

    // Set up dropdown menu actions
    document.querySelectorAll('.dropdown-item[data-action="edit"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);
            showEditSectionModal(section);
        });
    });

    document.querySelectorAll('.dropdown-item[data-action="delete"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);
            showDeleteSectionModal(section);
        });
    });

    document.querySelectorAll('.dropdown-item[data-action="invite"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);
            showInviteStudentsModal(section);
        });
    });

    document.querySelectorAll('.dropdown-item[data-action="leave"]').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section-id');
            const section = sections.find(s => s.id === sectionId);

            if (confirm(`Are you sure you want to leave ${section.name}?`)) {
                try {
                    showLoading('Leaving section...');
                    await db.collection('users').doc(currentUser.uid).update({
                        sections: firebase.firestore.FieldValue.arrayRemove(sectionId)
                    });

                    await fetchUserData();
                    hideLoading();
                    showSuccess(`You have left ${section.name}`);
                    renderContent('sections');
                } catch (error) {
                    hideLoading();
                    showError('Failed to leave section: ' + error.message);
                }
            }
        });
    });
}

// Enhanced Students Content (Teacher only)
function renderStudentsContent() {
    if (userRole !== 'teacher') return;

    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="header-actions" style="margin-bottom: 24px;">
            <button class="button button-primary" id="export-students-btn">
                <i class="fas fa-file-export"></i>
                <span>Export Student List</span>
            </button>
        </div>
        
        ${students.length > 0 ? `
            <div class="students-list">
                ${students.map(student => `
                    <div class="card mb-4" data-student-id="${student.id}">
                        <div class="d-flex align-items-center justify-content-between">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div class="student-avatar">
                                    ${student.fullName ? student.fullName.charAt(0) : 'S'}
                                </div>
                                <div>
                                    <h3>${student.fullName || 'Student'}</h3>
                                    <p class="text-muted">${student.email}</p>
                                </div>
                            </div>
                            <div class="student-menu" aria-label="Student options">
                                <i class="fas fa-ellipsis-v"></i>
                                <div class="dropdown-menu">
                                    <a href="#" class="dropdown-item" data-action="view" data-student-id="${student.id}">
                                        <i class="fas fa-eye"></i> View Details
                                    </a>
                                    <a href="#" class="dropdown-item" data-action="remove" data-student-id="${student.id}">
                                        <i class="fas fa-user-minus"></i> Remove
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div class="student-sections mt-3">
                            <p><strong>Sections:</strong> ${student.sections ? student.sections.length : 0}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Students Found</h3>
                <p>Students will appear here once they join your sections. Invite students to your sections to get started.</p>
                <button class="button button-primary mt-4" id="invite-students-btn">
                    Invite Students
                </button>
            </div>
        `}
        <style>
            .student-avatar {
                width: 40px;
                height: 40px;
                background-color: var(--primary);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }
            
            .student-menu {
                position: relative;
                cursor: pointer;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            
            .student-menu:hover {
                background-color: rgba(0, 0, 0, 0.1);
            }
            
            .dropdown-menu {
                display: none;
                position: absolute;
                right: 0;
                top: 100%;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                z-index: 100;
                min-width: 180px;
                overflow: hidden;
            }
            
            .student-menu:hover .dropdown-menu {
                display: block;
            }
            
            .dropdown-item {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                color: #333;
                text-decoration: none;
                gap: 8px;
                font-size: 14px;
            }
            
            .dropdown-item:hover {
                background-color: #f5f5f5;
            }
            
            .dropdown-item i {
                width: 16px;
                text-align: center;
            }
        </style>
    `;

    const inviteStudentsBtn = document.getElementById('invite-students-btn');
    if (inviteStudentsBtn) {
        inviteStudentsBtn.addEventListener('click', () => {
            if (sections.length > 0) {
                renderContent('sections');
            } else {
                showCreateSectionModal();
            }
        });
    }

    document.getElementById('export-students-btn').addEventListener('click', () => {
        exportStudentsList();
    });

    // Set up dropdown menu actions
    document.querySelectorAll('.dropdown-item[data-action="view"]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const studentId = item.getAttribute('data-student-id');
            const student = students.find(s => s.id === studentId);
            showStudentDetailsModal(student);
        });
    });

    document.querySelectorAll('.dropdown-item[data-action="remove"]').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const studentId = item.getAttribute('data-student-id');
            const student = students.find(s => s.id === studentId);

            if (confirm(`Remove ${student.fullName || 'this student'} from all your sections?`)) {
                try {
                    showLoading('Removing student...');

                    // Remove student from all teacher's sections
                    const batch = db.batch();
                    const teacherSections = await db.collection('sections')
                        .where('teacherId', '==', currentUser.uid)
                        .get();

                    teacherSections.forEach(sectionDoc => {
                        const sectionRef = db.collection('users').doc(studentId);
                        batch.update(sectionRef, {
                            sections: firebase.firestore.FieldValue.arrayRemove(sectionDoc.id)
                        });
                    });

                    await batch.commit();
                    await fetchUserData();
                    hideLoading();
                    showSuccess('Student removed from all sections');
                    renderContent('students');
                } catch (error) {
                    hideLoading();
                    showError('Failed to remove student: ' + error.message);
                }
            }
        });
    });
}

// Enhanced Reports Content with free API integration
function renderReportsContent() {
    if (userRole !== 'teacher') return;

    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="header-actions" style="margin-bottom: 24px;">
            <button class="button button-primary" id="export-reports-btn">
                <i class="fas fa-file-export"></i>
                <span>Export</span>
            </button>
        </div>
        
        <div class="reports-filters-container">
            <div class="filter-controls">
                <div class="filter-select-wrapper">
                    <select class="filter-select" id="report-section-filter">
                        <option value="">All Sections</option>
                        ${sections.map(section => `
                            <option value="${section.id}">${section.name}</option>
                        `).join('')}
                    </select>
                    <div class="select-arrow"></div>
                </div>
                
                <div class="filter-select-wrapper">
                    <select class="filter-select" id="report-time-filter">
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="custom">Custom Range</option>
                    </select>
                    <div class="select-arrow"></div>
                </div>
            </div>
            
            <div id="custom-range-group" style="display: none; margin-top: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="input-group">
                        <label for="report-start-date">Start Date</label>
                        <input type="date" id="report-start-date" class="filter-select">
                    </div>
                    <div class="input-group">
                        <label for="report-end-date">End Date</label>
                        <input type="date" id="report-end-date" class="filter-select">
                    </div>
                </div>
            </div>
        </div>
        
        <div class="reports-summary card mb-4">
            <h3>Summary</h3>
            <div style="display: flex; justify-content: space-between; margin-top: 16px;">
                <div class="summary-item">
                    <p>Total Students</p>
                    <h2>${students.length}</h2>
                </div>
                <div class="summary-item">
                    <p>Average Attendance</p>
                    <h2 id="avg-attendance">0%</h2>
                </div>
                <div class="summary-item">
                    <p>Sessions</p>
                    <h2 id="total-sessions">0</h2>
                </div>
            </div>
        </div>
        
        <div class="reports-chart card" style="padding: 20px; height: 300px;">
            <h3>Attendance Trend</h3>
            <div id="attendance-chart" style="height: 200px;"></div>
        </div>
        
        <style>
            .reports-filters-container {
                margin-bottom: 24px;
            }
            
            .filter-controls {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
            }
            
            .filter-select-wrapper {
                position: relative;
                min-width: 180px;
                flex-grow: 1;
            }
            
            .filter-select {
                width: 100%;
                padding: 12px 16px;
                padding-right: 40px;
                font-size: 14px;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                color: #2d3748;
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                appearance: none;
                outline: none;
                transition: all 0.2s ease;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            
            .filter-select:focus {
                border-color: #4299e1;
                box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
            }
            
            .filter-select:hover {
                border-color: #cbd5e0;
            }
            
            .select-arrow {
                position: absolute;
                top: 50%;
                right: 16px;
                transform: translateY(-50%);
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 6px solid #718096;
                pointer-events: none;
            }
            
            .summary-item {
                text-align: center;
                flex: 1;
            }
            
            .summary-item h2 {
                font-size: 24px;
                margin: 8px 0 0;
                color: var(--primary);
            }
            
            @media (max-width: 640px) {
                .filter-controls {
                    flex-direction: column;
                    gap: 12px;
                }
                
                .filter-select-wrapper {
                    min-width: 100%;
                }
            }
        </style>
    `;

    // Load Chart.js from CDN and render chart
    loadScript('https://cdn.jsdelivr.net/npm/chart.js').then(() => {
        renderAttendanceChart();
    });

    document.getElementById('export-reports-btn').addEventListener('click', () => {
        showExportReportsModal();
    });

    document.getElementById('report-time-filter').addEventListener('change', (e) => {
        const customRangeGroup = document.getElementById('custom-range-group');
        if (e.target.value === 'custom') {
            customRangeGroup.style.display = 'block';
        } else {
            customRangeGroup.style.display = 'none';
            updateReports();
        }
    });

    document.getElementById('report-section-filter').addEventListener('change', updateReports);
    document.getElementById('report-start-date').addEventListener('change', updateReports);
    document.getElementById('report-end-date').addEventListener('change', updateReports);

    // Initial data load
    updateReports();
}

function renderAttendanceChart() {
    const ctx = document.getElementById('attendance-chart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Attendance Rate',
                data: [65, 59, 80, 81, 56, 55, 40],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

async function updateReports() {
    try {
        showLoading('Loading report data...');

        const sectionFilter = document.getElementById('report-section-filter').value;
        const timeFilter = document.getElementById('report-time-filter').value;

        let startDate, endDate = new Date();

        if (timeFilter === 'custom') {
            const startDateStr = document.getElementById('report-start-date').value;
            const endDateStr = document.getElementById('report-end-date').value;

            if (!startDateStr || !endDateStr) {
                throw new Error('Please select both start and end dates');
            }

            startDate = new Date(startDateStr);
            endDate = new Date(endDateStr);
        } else if (timeFilter === 'week') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        } else { // month
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
        }

        // Fetch attendance data based on filters
        let query = db.collection('attendance')
            .where('checkInTime', '>=', startDate)
            .where('checkInTime', '<=', endDate);

        if (sectionFilter) {
            query = query.where('sectionId', '==', sectionFilter);
        }

        const snapshot = await query.get();
        const attendanceData = snapshot.docs.map(doc => doc.data());

        // Calculate statistics
        const totalSessions = new Set(attendanceData.map(a => a.sessionId)).size;
        const totalCheckIns = attendanceData.length;

        let avgAttendance = 0;
        if (sectionFilter && students.length) {
            const sectionStudents = students.filter(s => s.sections.includes(sectionFilter));
            avgAttendance = Math.round((totalCheckIns / (totalSessions * sectionStudents.length)) * 100) || 0;
        } else if (students.length) {
            avgAttendance = Math.round((totalCheckIns / (totalSessions * students.length)) * 100) || 0;
        }

        // Update UI
        document.getElementById('avg-attendance').textContent = `${avgAttendance}%`;
        document.getElementById('total-sessions').textContent = totalSessions;

        // Update chart with real data
        updateChartWithData(attendanceData, startDate, endDate);

        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Failed to update reports: ' + error.message);
    }
}

function updateChartWithData(attendanceData, startDate, endDate) {
    if (!window.Chart) return;

    // Group data by day
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const labels = [];
    const data = [];

    for (let i = 0; i <= daysDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        const dateStr = currentDate.toLocaleDateString('en-US', {
            weekday: 'short'
        });
        labels.push(dateStr);

        const dayData = attendanceData.filter(a => {
            const checkInDate = a.checkInTime.toDate();
            return checkInDate.toDateString() === currentDate.toDateString();
        });

        // Calculate attendance rate for the day
        const uniqueStudents = new Set(dayData.map(d => d.studentId)).size;
        const rate = students.length ? Math.round((uniqueStudents / students.length) * 100) : 0;
        data.push(rate);
    }

    // Update chart
    const ctx = document.getElementById('attendance-chart').getContext('2d');
    if (window.attendanceChart) {
        window.attendanceChart.data.labels = labels;
        window.attendanceChart.data.datasets[0].data = data;
        window.attendanceChart.update();
    } else {
        window.attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Attendance Rate',
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// Enhanced Permissions Content with auto check-in toggle
function renderPermissionsContent() {
    const contentArea = document.getElementById('content-area');

    // Calculate time remaining if active
    let timeRemaining = '';
    if (locationPermission.activityWindow) {
        const remainingMs = locationPermission.activityWindow - new Date();
        if (remainingMs > 0) {
            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            timeRemaining = `${hours}h ${minutes}m remaining`;
        }
    }

    contentArea.innerHTML = `
        <div class="location-access-card">
            <div class="location-access-header">
                <h2 class="location-access-title">Location Access</h2>
            </div>
            
            <div class="location-access-body">
                <p class="location-access-description">
                    NearCheck Lite uses your location <strong>only during active class sessions</strong> to verify your physical presence. 
                    This helps maintain academic integrity while respecting your privacy.
                </p>
                
                <div class="permission-status-container">
                    <h3 class="permission-status-heading">Current Access Status</h3>
                    
                    <div class="permission-status-indicator ${locationPermission.status}">
                        <div class="status-visual">
                            <div class="status-icon-circle">
                                ${getStatusIcon(locationPermission.status)}
                            </div>
                            <div class="status-pulse-effect"></div>
                        </div>
                        <div class="status-details">
                            <h4 class="status-title">${getStatusTitle(locationPermission.status)}</h4>
                            <p class="status-description">${getStatusDescription(locationPermission.status)}</p>
                            ${timeRemaining ? `<div class="status-timer"><span class="timer-icon">⏳</span> ${timeRemaining}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="permission-actions">
                        ${locationPermission.status === 'granted' ? `
                            <button class="action-btn action-danger" id="disable-location-btn">
                                <span class="btn-icon"><i class="fas fa-close"></i></span>
                                <span class="btn-text">Revoke Access</span>
                            </button>
                            <button class="action-btn action-neutral" id="extend-location-btn">
                                <span class="btn-icon"><i class="fas fa-timer"></i></span>
                                <span class="btn-text">Extend Duration</span>
                            </button>
                        ` : `
                            <button class="action-btn action-primary" id="enable-location-btn">
                                <span class="btn-icon"><i class="fas fa-location"></i></span>
                                <span class="btn-text">Enable Location</span>
                            </button>
                        `}
                    </div>
                    
                    ${locationPermission.status === 'granted' ? `
                        <div class="auto-checkin-toggle">
                            <label class="toggle-switch">
                                <input type="checkbox" id="auto-checkin-toggle" ${locationPermission.autoCheckIn ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <div class="toggle-label">
                                <h4>Auto Check-In</h4>
                                <p>Automatically check-in when in class location (within 24-hour window)</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="location-info-sections">
                <div class="info-section how-it-works">
                    <h3 class="info-section-title">
                        <span class="title-icon"><i class="fas fa-search"></i></span>
                        How Location Verification Works
                    </h3>
                    <ul class="info-points">
                        <li class="info-point">
                            <div class="point-icon">1</div>
                            <p>Permission request when you check in (one-time or per session)</p>
                        </li>
                        <li class="info-point">
                            <div class="point-icon">2</div>
                            <p>Instant comparison with teacher's location coordinates</p>
                        </li>
                        <li class="info-point">
                            <div class="point-icon">3</div>
                            <p>Verification against classroom proximity setting</p>
                        </li>
                        <li class="info-point">
                            <div class="point-icon">4</div>
                            <p>Secure recording with timestamp and anonymized location data</p>
                        </li>
                    </ul>
                </div>
                
                <div class="info-section privacy">
                    <h3 class="info-section-title">
                        <span class="title-icon"><i class="fas fa-shield-alt"></i></span>
                        Your Privacy Safeguards
                    </h3>
                    <ul class="info-points">
                        <li class="info-point">
                            <div class="point-icon">✓</div>
                            <p><strong>Single-purpose collection:</strong> Only for attendance verification</p>
                        </li>
                        <li class="info-point">
                            <div class="point-icon">✓</div>
                            <p><strong>Automatic expiration:</strong> Access revokes after 24 inactive hours</p>
                        </li>
                        <li class="info-point">
                            <div class="point-icon">✓</div>
                            <p><strong>No background tracking:</strong> Only active during check-in</p>
                        </li>
                        <li class="info-point">
                            <div class="point-icon">✓</div>
                            <p><strong>Immediate control:</strong> Disable anytime with one tap</p>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        
        <style>
            .location-access-card {
                font-family: 'Poppins', sans-serif;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                padding: 32px;
                max-width: 800px;
                margin: 0 auto;
                border: 1px solid #f0f0f0;
            }
            
            .location-access-header {
                margin-bottom: 24px;
                border-bottom: 1px solid #f5f5f5;
                padding-bottom: 16px;
            }
            
            .location-access-title {
                font-size: 24px;
                font-weight: 700;
                color: #2c3e50;
                margin: 0 0 4px 0;
            }
            
            .location-access-body {
                margin-bottom: 32px;
            }
            
            .location-access-description {
                font-size: 16px;
                line-height: 1.6;
                color: #34495e;
                margin-bottom: 24px;
            }
            
            .permission-status-container {
                background: #f9fbfd;
                border-radius: 16px;
                padding: 24px;
                border: 1px solid #e3eef9;
                margin-bottom: 24px;
            }
            
            .permission-status-heading {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
            }
            
            .permission-status-indicator {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 24px;
            }
            
            .status-visual {
                position: relative;
                flex-shrink: 0;
            }
            
            .status-icon-circle {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                z-index: 2;
                position: relative;
            }
            
            .status-pulse-effect {
                position: absolute;
                width: 72px;
                height: 72px;
                background: rgba(66, 165, 245, 0.2);
                border-radius: 50%;
                top: -6px;
                left: -6px;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(0.95); opacity: 0.8; }
                70% { transform: scale(1.1); opacity: 0.2; }
                100% { transform: scale(0.95); opacity: 0.8; }
            }
            
            .permission-status-indicator.granted .status-icon-circle {
                background: #e8f5e9;
                color: #4caf50;
            }
            
            .permission-status-indicator.denied .status-icon-circle {
                background: #ffebee;
                color: #f44336;
            }
            
            .permission-status-indicator.not-granted .status-icon-circle {
                background: #fff8e1;
                color: #ffa000;
            }
            
            .permission-status-indicator.granted .status-pulse-effect {
                background: rgba(76, 175, 80, 0.2);
            }
            
            .status-details {
                flex-grow: 1;
            }
            
            .status-title {
                font-size: 18px;
                font-weight: 600;
                margin: 0 0 6px 0;
                color: #2c3e50;
            }
            
            .status-description {
                font-size: 15px;
                color: #7f8c8d;
                margin: 0;
                line-height: 1.5;
            }
            
            .status-timer {
                margin-top: 8px;
                font-size: 14px;
                color: #3498db;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .permission-actions {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            
            .action-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 12px 20px;
                font-size: 15px;
                font-weight: 600;
                border-radius: 10px;
                cursor: pointer;
                border: none;
                transition: all 0.25s ease;
                user-select: none;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .action-primary {
                background: #3498db;
                color: white;
            }
            
            .action-primary:hover {
                background: #2980b9;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
            }
            
            .action-danger {
                background: #e74c3c;
                color: white;
            }
            
            .action-danger:hover {
                background: #c0392b;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
            }
            
            .action-neutral {
                background: #95a5a6;
                color: white;
            }
            
            .action-neutral:hover {
                background: #7f8c8d;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(149, 165, 166, 0.3);
            }
            
            .auto-checkin-toggle {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: #f8f9fa;
                border-radius: 12px;
                margin-top: 24px;
            }
            
            .toggle-switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 26px;
            }
            
            .toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 34px;
            }
            
            .slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            
            input:checked + .slider {
                background-color: #4CAF50;
            }
            
            input:checked + .slider:before {
                transform: translateX(24px);
            }
            
            .toggle-label h4 {
                margin: 0 0 4px 0;
                color: #2c3e50;
            }
            
            .toggle-label p {
                margin: 0;
                font-size: 14px;
                color: #7f8c8d;
            }
            
            .location-info-sections {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
                margin-top: 32px;
            }
            
            .info-section {
                background: #f9fbfd;
                border-radius: 16px;
                padding: 20px;
                border: 1px solid #e3eef9;
            }
            
            .info-section-title {
                font-size: 17px;
                color: #2c3e50;
                margin: 0 0 16px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .title-icon {
                font-size: 20px;
            }
            
            .info-points {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .info-point {
                display: flex;
                gap: 12px;
                margin-bottom: 14px;
                align-items: flex-start;
            }
            
            .point-icon {
                width: 24px;
                height: 24px;
                background: #3498db;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 600;
                flex-shrink: 0;
            }
            
            .info-point p {
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
                color: #34495e;
            }
            
            .info-section.privacy .point-icon {
                background: #2ecc71;
            }
            
            @media (max-width: 768px) {
                .location-info-sections {
                    grid-template-columns: 1fr;
                }
                
                .permission-status-indicator {
                    flex-direction: column;
                    align-items: flex-start;
                }
                
                .permission-actions {
                    flex-direction: column;
                }
                
                .action-btn {
                    justify-content: center;
                }
            }
        </style>
    `;

    // Set up event listeners for permission buttons
    const enableBtn = document.getElementById('enable-location-btn');
    if (enableBtn) {
        enableBtn.addEventListener('click', async () => {
            try {
                await requestLocationPermission();
                renderPermissionsContent();
            } catch (error) {
                showError(error.message);
            }
        });
    }

    const disableBtn = document.getElementById('disable-location-btn');
    if (disableBtn) {
        disableBtn.addEventListener('click', () => {
            locationPermission.status = 'not-granted';
            locationPermission.autoCheckIn = false;
            localStorage.setItem('autoCheckInPref', 'false');
            clearActivityWindow();
            renderPermissionsContent();
            showSuccess('Location access disabled');
        });
    }

    const extendBtn = document.getElementById('extend-location-btn');
    if (extendBtn) {
        extendBtn.addEventListener('click', () => {
            extendActivityWindow();
            renderPermissionsContent();
            showSuccess('Location access window extended');
        });
    }

    const autoCheckInToggle = document.getElementById('auto-checkin-toggle');
    if (autoCheckInToggle) {
        autoCheckInToggle.addEventListener('change', (e) => {
            locationPermission.autoCheckIn = e.target.checked;
            localStorage.setItem('autoCheckInPref', e.target.checked.toString());
            showSuccess(`Auto check-in ${e.target.checked ? 'enabled' : 'disabled'}`);

            // If enabling, check immediately
            if (e.target.checked && locationPermission.status === 'granted') {
                checkForAutoCheckIn();
            }
        });
    }
}

function getStatusIcon(status) {
    switch (status) {
        case 'granted':
            return '<i class="fas fa-check-circle"></i>';
        case 'denied':
            return '<i class="fas fa-times-circle"></i>';
        default:
            return '<i class="fas fa-question-circle"></i>';
    }
}

function getStatusTitle(status) {
    switch (status) {
        case 'granted':
            return 'Access Granted';
        case 'denied':
            return 'Access Denied';
        default:
            return 'Access Not Granted';
    }
}

function getStatusDescription(status) {
    switch (status) {
        case 'granted':
            return 'Location access is currently enabled for attendance verification.';
        case 'denied':
            return 'Location access is currently disabled. You won\'t be able to check in to classes.';
        default:
            return 'Location access hasn\'t been requested yet. It will be requested when needed.';
    }
}

// Enhanced Account Content with better security
function renderAccountContent() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="card mb-4">
            <h3 class="mb-4">Personal Information</h3>
            <div class="input-group">
                <label for="account-name">Full Name</label>
                <input type="text" id="account-name" value="${currentUser.displayName || ''}" maxlength="100">
            </div>
            <div class="input-group">
                <label for="account-email">Email</label>
                <input type="email" id="account-email" value="${currentUser.email}" disabled>
            </div>
            <button class="button button-primary" id="save-account-btn">Save Changes</button>
        </div>
        
        <div class="card mb-4">
            <h3 class="mb-4">Security</h3>
            <p class="mb-4">Update your password to keep your account secure. Recommended if you suspect unauthorized access.</p>
            <button class="button button-secondary" id="change-password-btn">Change Password</button>
        </div>
        
        <div class="card">
            <h3 class="mb-4">Danger Zone</h3>
            <p class="mb-4">Deleting your account will permanently remove all your data from our systems.</p>
            <button class="button button-danger" id="delete-account-btn">Delete Account</button>
        </div>
    `;

    document.getElementById('save-account-btn').addEventListener('click', async () => {
        const newName = document.getElementById('account-name').value.trim();

        if (!newName) {
            showError('Please enter your name');
            return;
        }

        try {
            showLoading('Updating account...');
            await currentUser.updateProfile({
                displayName: newName
            });

            await db.collection('users').doc(currentUser.uid).update({
                fullName: newName
            });

            hideLoading();
            showSuccess('Account updated successfully');
        } catch (error) {
            hideLoading();
            showError(error.message || 'Failed to update account');
        }
    });

    document.getElementById('change-password-btn').addEventListener('click', () => {
        showChangePasswordModal();
    });

    document.getElementById('delete-account-btn').addEventListener('click', () => {
        showDeleteAccountModal();
    });
}

// Enhanced Section Management
function showCreateSectionModal() {
    showModal({
        title: 'Create New Section',
        body: `
            <form id="create-section-form">
                <div class="input-group">
                    <label for="section-name">Section Name</label>
                    <input type="text" id="section-name" required placeholder="e.g. 12 - Apollo" maxlength="50">
                </div>
                <div class="input-group">
                    <label for="section-subject">Subject</label>
                    <input type="text" id="section-subject" required placeholder="e.g. Practical Research 2" maxlength="50">
                </div>
                <div class="input-group">
                    <label for="section-schedule">Schedule</label>
                    <input type="text" id="section-schedule" placeholder="e.g. Monday - Friday" required maxlength="50">
                </div>
                <div class="input-group">
                    <label for="section-range">Check-in Range (Meters)</label>
                    <input type="number" id="section-range" value="10" min="5" max="150" required>
                    <p class="input-hint">Students must be within this distance to check in</p>
                </div>
            </form>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Create Section',
                class: 'button-primary',
                action: async () => {
                    const name = document.getElementById('section-name').value.trim();
                    const subject = document.getElementById('section-subject').value.trim();
                    const schedule = document.getElementById('section-schedule').value.trim();
                    const range = parseInt(document.getElementById('section-range').value);

                    if (!name || !subject || !schedule || !range) {
                        showError('Please fill all fields');
                        return false;
                    }

                    try {
                        showLoading('Creating section...');

                        // Request location permission if not already granted
                        await requestLocationPermission('session');

                        // Get teacher's current location
                        const position = await getCurrentPosition();

                        // Create section in Firestore
                        const sectionRef = await db.collection('sections').add({
                            name,
                            subject,
                            schedule,
                            checkInRange: range,
                            teacherId: currentUser.uid,
                            teacherName: currentUser.displayName || 'Teacher',
                            teacherLocation: new firebase.firestore.GeoPoint(position.coords.latitude, position.coords.longitude),
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            students: []
                        });

                        // Update local state
                        sections.push({
                            id: sectionRef.id,
                            name,
                            subject,
                            schedule,
                            checkInRange: range,
                            teacherId: currentUser.uid
                        });

                        hideLoading();
                        showSuccess('Section created successfully');
                        renderContent('sections');
                        return true;
                    } catch (error) {
                        hideLoading();
                        showError(error.message || 'Failed to create section');
                        return false;
                    }
                }
            }
        ]
    });
}

function showEditSectionModal(section) {
    showModal({
        title: `Edit Section - ${section.name}`,
        body: `
            <form id="edit-section-form">
                <div class="input-group">
                    <label for="edit-section-name">Section Name</label>
                    <input type="text" id="edit-section-name" value="${section.name}" required maxlength="50">
                </div>
                <div class="input-group">
                    <label for="edit-section-subject">Subject</label>
                    <input type="text" id="edit-section-subject" value="${section.subject}" required maxlength="50">
                </div>
                <div class="input-group">
                    <label for="edit-section-schedule">Schedule</label>
                    <input type="text" id="edit-section-schedule" value="${section.schedule}" required maxlength="50">
                </div>
                <div class="input-group">
                    <label for="edit-section-range">Check-in Range (Meters)</label>
                    <input type="number" id="edit-section-range" value="${section.checkInRange}" min="5" max="150" required>
                </div>
            </form>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Save Changes',
                class: 'button-primary',
                action: async () => {
                    const name = document.getElementById('edit-section-name').value.trim();
                    const subject = document.getElementById('edit-section-subject').value.trim();
                    const schedule = document.getElementById('edit-section-schedule').value.trim();
                    const range = parseInt(document.getElementById('edit-section-range').value);

                    if (!name || !subject || !schedule || !range) {
                        showError('Please fill all fields');
                        return false;
                    }

                    try {
                        showLoading('Updating section...');

                        await db.collection('sections').doc(section.id).update({
                            name,
                            subject,
                            schedule,
                            checkInRange: range
                        });

                        // Update local state
                        const sectionIndex = sections.findIndex(s => s.id === section.id);
                        if (sectionIndex !== -1) {
                            sections[sectionIndex] = {
                                ...sections[sectionIndex],
                                name,
                                subject,
                                schedule,
                                checkInRange: range
                            };
                        }

                        hideLoading();
                        showSuccess('Section updated successfully');
                        renderContent('sections');
                        return true;
                    } catch (error) {
                        hideLoading();
                        showError(error.message || 'Failed to update section');
                        return false;
                    }
                }
            }
        ]
    });
}

function showDeleteSectionModal(section) {
    showModal({
        title: `Delete Section - ${section.name}`,
        body: `
            <p>Are you sure you want to delete this section? This action cannot be undone.</p>
            <p class="mb-4">All attendance records for this section will be preserved, but students will no longer be able to check in.</p>
            
            <div class="input-group">
                <label for="delete-confirm">Type "DELETE" to confirm</label>
                <input type="text" id="delete-confirm" required>
            </div>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Delete Section',
                class: 'button-danger',
                action: async () => {
                    const confirmation = document.getElementById('delete-confirm').value.trim();

                    if (confirmation !== 'DELETE') {
                        showError('Please type "DELETE" to confirm');
                        return false;
                    }

                    try {
                        showLoading('Deleting section...');

                        // First remove all students from this section
                        const studentsSnapshot = await db.collection('users')
                            .where('sections', 'array-contains', section.id)
                            .get();

                        const batch = db.batch();
                        studentsSnapshot.forEach(doc => {
                            const studentRef = db.collection('users').doc(doc.id);
                            batch.update(studentRef, {
                                sections: firebase.firestore.FieldValue.arrayRemove(section.id)
                            });
                        });

                        await batch.commit();

                        // Then delete the section
                        await db.collection('sections').doc(section.id).delete();

                        // Update local state
                        sections = sections.filter(s => s.id !== section.id);

                        hideLoading();
                        showSuccess('Section deleted successfully');
                        renderContent('sections');
                        return true;
                    } catch (error) {
                        hideLoading();
                        showError(error.message || 'Failed to delete section');
                        return false;
                    }
                }
            }
        ]
    });
}

function showStartSessionModal(section) {
    showModal({
        title: `Start Attendance Session - ${section.name}`,
        body: `
            <p>You're about to start an attendance session for <strong>${section.name}</strong>.</p>
            
            <div class="input-group mt-4">
                <label for="session-duration">Session Duration (minutes)</label>
                <input type="number" id="session-duration" value="15" min="1" max="120">
            </div>
            
            <div class="input-group">
                <label>
                    <input type="checkbox" id="auto-end-checkbox" checked> Auto-end session after duration
                </label>
            </div>
            
            <div class="input-group">
                <label>
                    <input type="checkbox" id="require-location-checkbox" checked> Require student location
                </label>
            </div>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Start Session',
                class: 'button-primary',
                action: async () => {
                    const duration = parseInt(document.getElementById('session-duration').value);
                    const autoEnd = document.getElementById('auto-end-checkbox').checked;
                    const requireLocation = document.getElementById('require-location-checkbox').checked;

                    if (!duration || duration < 1) {
                        showError('Please enter a valid duration');
                        return false;
                    }

                    try {
                        showLoading('Starting session...');

                        // Request location permission if not already granted
                        await requestLocationPermission('session');

                        // Get teacher's current location
                        const position = await getCurrentPosition();

                        // Create session in Firestore
                        const sessionRef = await db.collection('sessions').add({
                            sectionId: section.id,
                            teacherId: currentUser.uid,
                            startTime: firebase.firestore.FieldValue.serverTimestamp(),
                            endTime: null,
                            duration,
                            autoEnd,
                            requireLocation,
                            location: new firebase.firestore.GeoPoint(position.coords.latitude, position.coords.longitude),
                            range: section.checkInRange,
                            status: 'active',
                            attendees: []
                        });

                        // Update local state
                        activeSession = {
                            id: sessionRef.id,
                            sectionId: section.id,
                            startTime: new Date(),
                            duration,
                            autoEnd,
                            status: 'active'
                        };

                        hideLoading();
                        showSuccess('Attendance session started');
                        renderDashboardContent();

                        // If auto-end is enabled, set timeout to end session
                        if (autoEnd) {
                            setTimeout(() => {
                                endSession(sessionRef.id);
                            }, duration * 60 * 1000);
                        }

                        return true;
                    } catch (error) {
                        hideLoading();
                        showError(error.message || 'Failed to start session');
                        return false;
                    }
                }
            }
        ]
    });
}

async function endSession(sessionId) {
    try {
        await db.collection('sessions').doc(sessionId).update({
            status: 'ended',
            endTime: firebase.firestore.FieldValue.serverTimestamp()
        });

        activeSession = null;
        renderDashboardContent();
        showSuccess('Attendance session ended');
    } catch (error) {
        showError('Failed to end session: ' + error.message);
    }
}

function showInviteStudentsModal(section) {
    const inviteLink = `${window.location.origin}${window.location.pathname}?sectionid=${section.id}`;
    const qr = qrcode(0, 'L');
    qr.addData(inviteLink);
    qr.make();
    const qrSvg = qr.createSvgTag(4);

    showModal({
        title: `Invite Students - ${section.name}`,
        body: `
            <div class="qr-code-container">
                <div class="qr-code" id="qr-code">${qrSvg}</div>
                <p>Scan this QR code to join</p>
            </div>
            
            <div class="input-group mt-4">
                <label for="invite-link">Invitation Link</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="invite-link" value="${inviteLink}" readonly>
                    <button class="button button-secondary" id="copy-link-btn" aria-label="Copy invitation link">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            
            <div class="input-group">
                <label for="section-id">Section ID</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="section-id" value="${section.id}" readonly>
                    <button class="button button-secondary" id="copy-id-btn" aria-label="Copy section ID">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `,
        buttons: [{
            text: 'Done',
            class: 'button-primary',
            action: 'close'
        }],
        onRender: (modal) => {
            modal.querySelector('#copy-link-btn').addEventListener('click', () => {
                const linkInput = document.getElementById('invite-link');
                linkInput.select();
                document.execCommand('copy');
                showSuccess('Link copied to clipboard');
            });

            modal.querySelector('#copy-id-btn').addEventListener('click', () => {
                const idInput = document.getElementById('section-id');
                idInput.select();
                document.execCommand('copy');
                showSuccess('Section ID copied to clipboard');
            });
        }
    });
}

function showManageStudentsModal(section) {
    showModal({
        title: `Manage Students - ${section.name}`,
        body: `
            <div style="max-height: 400px; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="students-list">
                        <tr>
                            <td colspan="3" style="text-align: center; padding: 16px;">Loading students...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `,
        buttons: [{
            text: 'Done',
            class: 'button-primary',
            action: 'close'
        }],
        onRender: async (modal) => {
            const studentsList = modal.querySelector('#students-list');

            try {
                const querySnapshot = await db.collection('users')
                    .where('sections', 'array-contains', section.id)
                    .where('role', '==', 'student')
                    .get();

                studentsList.innerHTML = '';

                if (querySnapshot.empty) {
                    studentsList.innerHTML = `
                        <tr>
                            <td colspan="3" style="text-align: center; padding: 16px;">No students found in this section</td>
                        </tr>
                    `;
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const student = doc.data();
                    studentsList.innerHTML += `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center" style="gap: 8px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center;">
                                        ${student.fullName ? student.fullName.charAt(0) : 'S'}
                                    </div>
                                    <div>
                                        <div style="font-weight: 500;">${student.fullName || 'Student'}</div>
                                        <div style="font-size: 12px; color: var(--text-tertiary);">${student.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="badge badge-success">Active</span>
                            </td>
                            <td>
                                <button class="button button-danger" style="padding: 4px 8px; font-size: 12px;" data-student-id="${doc.id}">
                                    Remove
                                </button>
                            </td>
                        </tr>
                    `;
                });

                // Set up event listeners for remove buttons
                modal.querySelectorAll('button[data-student-id]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const studentId = e.target.getAttribute('data-student-id');
                        if (confirm('Are you sure you want to remove this student from the section?')) {
                            try {
                                showLoading('Removing student...');

                                await db.collection('users').doc(studentId).update({
                                    sections: firebase.firestore.FieldValue.arrayRemove(section.id)
                                });

                                showManageStudentsModal(section);
                                hideLoading();
                                showSuccess('Student removed from section');
                            } catch (error) {
                                hideLoading();
                                showError('Failed to remove student: ' + error.message);
                            }
                        }
                    });
                });
            } catch (error) {
                studentsList.innerHTML = `
                    <tr>
                        <td colspan="3" style="text-align: center; padding: 16px; color: var(--error);">Error loading students: ${error.message}</td>
                    </tr>
                `;
            }
        }
    });
}

function showStudentDetailsModal(student) {
    showModal({
        title: `Student Details - ${student.fullName || 'Student'}`,
        body: `
            <div class="student-details">
                <div class="student-avatar-large">
                    ${student.fullName ? student.fullName.charAt(0) : 'S'}
                </div>
                <div class="student-info">
                    <h3>${student.fullName || 'Student'}</h3>
                    <p class="student-email">${student.email}</p>
                </div>
                
                <div class="student-stats">
                    <div class="stat-item">
                        <div class="stat-value">${student.sections ? student.sections.length : 0}</div>
                        <div class="stat-label">Sections</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">0</div>
                        <div class="stat-label">Attendance Rate</div>
                    </div>
                </div>
                
                <div class="student-sections">
                    <h4>Enrolled Sections</h4>
                    ${student.sections && student.sections.length > 0 ? `
                        <ul class="section-list">
                            ${student.sections.map(sectionId => {
                                const section = sections.find(s => s.id === sectionId);
                                return section ? `
                                    <li>
                                        <i class="fas fa-layer-group"></i>
                                        <span>${section.name} (${section.subject})</span>
                                    </li>
                                ` : '';
                            }).join('')}
                        </ul>
                    ` : '<p>No sections enrolled</p>'}
                </div>
            </div>
            
            <style>
                .student-details {
                    text-align: center;
                }
                
                .student-avatar-large {
                    width: 80px;
                    height: 80px;
                    background-color: var(--primary);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    font-weight: bold;
                    margin: 0 auto 16px;
                }
                
                .student-info h3 {
                    margin: 0 0 4px 0;
                }
                
                .student-email {
                    color: #6c757d;
                    margin: 0 0 16px 0;
                }
                
                .student-stats {
                    display: flex;
                    justify-content: center;
                    gap: 24px;
                    margin: 16px 0;
                }
                
                .stat-item {
                    text-align: center;
                }
                
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--primary);
                }
                
                .stat-label {
                    font-size: 14px;
                    color: #6c757d;
                }
                
                .student-sections {
                    margin-top: 24px;
                    text-align: left;
                }
                
                .student-sections h4 {
                    margin-bottom: 12px;
                    font-size: 16px;
                }
                
                .section-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .section-list li {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                
                .section-list li:last-child {
                    border-bottom: none;
                }
            </style>
        `,
        buttons: [{
            text: 'Close',
            class: 'button-primary',
            action: 'close'
        }]
    });
}

// Enhanced Export Reports with free API integration
function showExportReportsModal() {
    showModal({
        title: 'Export Attendance Data',
        body: `
            <div class="input-group">
                <label for="export-format">Format</label>
                <select id="export-format">
                    <option value="csv">CSV (.csv)</option>
                    <option value="pdf">PDF (.pdf)</option>
                </select>
            </div>
            
            <div class="input-group">
                <label for="export-time-range">Time Range</label>
                <select id="export-time-range">
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom Range</option>
                </select>
            </div>
            
            <div class="input-group" id="export-custom-range-group" style="display: none;">
                <label for="export-start-date">Start Date</label>
                <input type="date" id="export-start-date">
                
                <label for="export-end-date" style="margin-top: 8px;">End Date</label>
                <input type="date" id="export-end-date">
            </div>
            
            <div class="input-group">
                <label for="export-section">Section</label>
                <select id="export-section">
                    <option value="all">All Sections</option>
                    ${sections.map(section => `
                        <option value="${section.id}">${section.name}</option>
                    `).join('')}
                </select>
            </div>
            
            <div class="input-group">
                <label for="export-email">Email for PDF (optional)</label>
                <input type="email" id="export-email" placeholder="Enter email to receive PDF">
            </div>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Export Data',
                class: 'button-primary',
                action: async () => {
                    const format = document.getElementById('export-format').value;
                    const timeRange = document.getElementById('export-time-range').value;
                    const sectionId = document.getElementById('export-section').value;
                    const email = document.getElementById('export-email').value.trim();

                    let startDate, endDate = new Date();

                    if (timeRange === 'custom') {
                        const startDateStr = document.getElementById('export-start-date').value;
                        const endDateStr = document.getElementById('export-end-date').value;

                        if (!startDateStr || !endDateStr) {
                            showError('Please select both start and end dates');
                            return false;
                        }

                        startDate = new Date(startDateStr);
                        endDate = new Date(endDateStr);
                    } else if (timeRange === 'week') {
                        startDate = new Date();
                        startDate.setDate(startDate.getDate() - 7);
                    } else { // month
                        startDate = new Date();
                        startDate.setMonth(startDate.getMonth() - 1);
                    }

                    try {
                        showLoading('Preparing export...');

                        // Fetch attendance data
                        let query = db.collection('attendance')
                            .where('checkInTime', '>=', startDate)
                            .where('checkInTime', '<=', endDate);

                        if (sectionId !== 'all') {
                            query = query.where('sectionId', '==', sectionId);
                        }

                        const snapshot = await query.get();
                        const attendanceData = snapshot.docs.map(doc => {
                            const data = doc.data();
                            return {
                                studentName: data.studentName,
                                sectionId: data.sectionId,
                                checkInTime: data.checkInTime.toDate().toLocaleString(),
                                status: data.status,
                                distance: data.distance ? `${data.distance}m` : 'N/A'
                            };
                        });

                        if (format === 'csv') {
                            exportToCSV(attendanceData, `attendance_${new Date().toISOString().split('T')[0]}.csv`);
                        } else if (format === 'pdf' && email) {
                            await sendPDFByEmail(attendanceData, email);
                        } else if (format === 'pdf') {
                            exportToPDF(attendanceData);
                        }

                        hideLoading();
                        showSuccess('Export completed successfully');
                        return true;
                    } catch (error) {
                        hideLoading();
                        showError('Failed to export data: ' + error.message);
                        return false;
                    }
                }
            }
        ],
        onRender: (modal) => {
            modal.querySelector('#export-time-range').addEventListener('change', (e) => {
                const customRangeGroup = modal.querySelector('#export-custom-range-group');
                if (e.target.value === 'custom') {
                    customRangeGroup.style.display = 'block';
                } else {
                    customRangeGroup.style.display = 'none';
                }
            });
        }
    });
}

function exportToCSV(data, filename) {
    if (!data.length) {
        showError('No data to export');
        return;
    }

    // Extract headers
    const headers = Object.keys(data[0]);

    // Create CSV content
    let csvContent = headers.join(',') + '\n';

    data.forEach(item => {
        const row = headers.map(header => {
            // Escape quotes and wrap in quotes if contains comma
            const value = String(item[header]).replace(/"/g, '""');
            return value.includes(',') ? `"${value}"` : value;
        });
        csvContent += row.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToPDF(data) {
    showModal({
        title: 'PDF Export',
        body: `
            <p>For PDF export, please provide an email address where we can send the report.</p>
            <p>Alternatively, you can use the print function in your browser:</p>
            
            <div class="input-group mt-4">
                <button class="button button-primary w-100" id="print-report-btn">
                    <i class="fas fa-print"></i> Print Report
                </button>
            </div>
        `,
        buttons: [{
            text: 'Close',
            class: 'button-primary',
            action: 'close'
        }],
        onRender: (modal) => {
            modal.querySelector('#print-report-btn').addEventListener('click', () => {
                window.print();
            });
        }
    });
}

async function sendPDFByEmail(data, email) {
    try {
        // In a real implementation, you would call a cloud function or API to generate and send the PDF
        // This is a mock implementation
        showSuccess(`PDF will be sent to ${email}. (Mock implementation)`);
        return true;
    } catch (error) {
        showError('Failed to send PDF: ' + error.message);
        return false;
    }
}

function exportStudentsList() {
    if (!students.length) {
        showError('No students to export');
        return;
    }

    const data = students.map(student => ({
        name: student.fullName || '',
        email: student.email || '',
        sections: student.sections ? student.sections.length : 0
    }));

    exportToCSV(data, `students_${new Date().toISOString().split('T')[0]}.csv`);
}

// Enhanced Change Password Modal
function showChangePasswordModal() {
    showModal({
        title: 'Change Password',
        body: `
            <div class="input-group">
                <label for="current-password">Current Password</label>
                <input type="password" id="current-password" required>
            </div>
            <div class="input-group">
                <label for="new-password">New Password</label>
                <input type="password" id="new-password" required minlength="6">
                <p class="input-hint">Minimum 6 characters</p>
            </div>
            <div class="input-group">
                <label for="confirm-new-password">Confirm New Password</label>
                <input type="password" id="confirm-new-password" required minlength="6">
            </div>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Change Password',
                class: 'button-primary',
                action: async () => {
                    const currentPassword = document.getElementById('current-password').value;
                    const newPassword = document.getElementById('new-password').value;
                    const confirmNewPassword = document.getElementById('confirm-new-password').value;

                    if (!currentPassword || !newPassword || !confirmNewPassword) {
                        showError('Please fill all fields');
                        return false;
                    }

                    if (newPassword !== confirmNewPassword) {
                        showError('New passwords do not match');
                        return false;
                    }

                    if (newPassword.length < 6) {
                        showError('Password must be at least 6 characters');
                        return false;
                    }

                    try {
                        showLoading('Changing password...');

                        const credential = firebase.auth.EmailAuthProvider.credential(
                            currentUser.email,
                            currentPassword
                        );

                        await currentUser.reauthenticateWithCredential(credential);
                        await currentUser.updatePassword(newPassword);

                        hideLoading();
                        showSuccess('Password changed successfully');
                        return true;
                    } catch (error) {
                        hideLoading();
                        if (error.code === 'auth/wrong-password') {
                            showError('Current password is incorrect');
                        } else {
                            showError(error.message || 'Failed to change password');
                        }
                        return false;
                    }
                }
            }
        ]
    });
}

// Enhanced Delete Account Modal
function showDeleteAccountModal() {
    showModal({
        title: 'Delete Account',
        body: `
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <p class="mb-4">All your data will be permanently removed from our systems.</p>
            
            <div class="input-group">
                <label for="delete-password">Enter your password to confirm</label>
                <input type="password" id="delete-password" required>
            </div>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Delete Account',
                class: 'button-danger',
                action: async () => {
                    const password = document.getElementById('delete-password').value;

                    if (!password) {
                        showError('Please enter your password');
                        return false;
                    }

                    try {
                        showLoading('Deleting account...');

                        const credential = firebase.auth.EmailAuthProvider.credential(
                            currentUser.email,
                            password
                        );

                        await currentUser.reauthenticateWithCredential(credential);

                        // First delete user data from Firestore
                        await db.collection('users').doc(currentUser.uid).delete();

                        // Then delete the auth account
                        await currentUser.delete();

                        hideLoading();
                        showSuccess('Account deleted successfully');
                        return true;
                    } catch (error) {
                        hideLoading();
                        if (error.code === 'auth/wrong-password') {
                            showError('Incorrect password');
                        } else {
                            showError(error.message || 'Failed to delete account');
                        }
                        return false;
                    }
                }
            }
        ]
    });
}

function showForgotPasswordModal() {
    showModal({
        title: 'Reset Password',
        body: `
            <p>Enter your email address and we'll send you a link to reset your password.</p>
            
            <div class="input-group mt-4">
                <label for="reset-email">Email</label>
                <input type="email" id="reset-email" required>
            </div>
        `,
        buttons: [{
                text: 'Cancel',
                class: 'button-secondary',
                action: 'close'
            },
            {
                text: 'Send Reset Link',
                class: 'button-primary',
                action: async () => {
                    const email = document.getElementById('reset-email').value.trim();

                    if (!email) {
                        showError('Please enter your email address');
                        return false;
                    }

                    try {
                        showLoading('Sending reset link...');
                        await auth.sendPasswordResetEmail(email);
                        hideLoading();
                        showSuccess('Password reset link sent to your email');
                        return true;
                    } catch (error) {
                        hideLoading();
                        if (error.code === 'auth/user-not-found') {
                            showError('No account found with this email');
                        } else {
                            showError(error.message || 'Failed to send reset link');
                        }
                        return false;
                    }
                }
            }
        ]
    });
}

// Enhanced Student Check-In with better error handling
async function handleStudentCheckIn(section) {
    try {
        showLoading('Preparing check-in...');

        // Check if there's an active session for this section
        const sessionsSnapshot = await db.collection('sessions')
            .where('sectionId', '==', section.id)
            .where('status', '==', 'active')
            .get();

        if (sessionsSnapshot.empty) {
            throw new Error('No active session found for this section');
        }

        const session = sessionsSnapshot.docs[0].data();
        const sessionId = sessionsSnapshot.docs[0].id;

        // Check if student already checked in
        if (session.attendees && session.attendees.includes(currentUser.uid)) {
            throw new Error('You have already checked in to this session');
        }

        // Get student's current location if required
        let studentLocation = null;
        let distance = 0;

        if (session.requireLocation) {
            // Request location permission with context
            await requestLocationPermission('check-in');

            const position = await getCurrentPosition();
            studentLocation = new firebase.firestore.GeoPoint(position.coords.latitude, position.coords.longitude);

            // Calculate distance between teacher and student
            distance = calculateDistance(
                session.location.latitude,
                session.location.longitude,
                studentLocation.latitude,
                studentLocation.longitude
            );

            if (distance > session.range) {
                throw new Error(`You are too far from the check-in location (${Math.round(distance)}m away, maximum is ${session.range}m)`);
            }
        }

        // Record attendance
        await db.collection('attendance').add({
            sessionId,
            sectionId: section.id,
            studentId: currentUser.uid,
            studentName: currentUser.displayName || 'Student',
            checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
            location: studentLocation,
            distance,
            status: 'present',
            deviceInfo: navigator.userAgent
        });

        // Add to session attendees
        await db.collection('sessions').doc(sessionId).update({
            attendees: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
        });

        hideLoading();
        showSuccess('Checked in successfully!');
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

// Enhanced Get Current Position with better error messages
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Additional validation for Philippines only
                if (security.countryRestriction && position.coords.latitude < 4 || position.coords.latitude > 21 ||
                    position.coords.longitude < 116 || position.coords.longitude > 127) {
                    reject(new Error('Location must be within the Philippines'));
                    return;
                }
                resolve(position);
            },
            (error) => {
                let errorMessage = 'Error getting location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access was denied. Please enable it in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'The request to get location timed out.';
                        break;
                }
                reject(new Error(errorMessage));
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// More precise distance calculation using Haversine formula
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

// Helper function to load external scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Enhanced Modal Function with accessibility improvements
function showModal(options) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 id="modal-title">${options.title}</h2>
                <button class="close-button" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
                ${options.body}
            </div>
            <div class="modal-footer">
                ${options.buttons.map(btn => `
                    <button class="button ${btn.class}" id="${btn.text.toLowerCase().replace(' ', '-')}-btn">
                        ${btn.text}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Focus first interactive element
    setTimeout(() => {
        const firstInput = modal.querySelector('input, button, select, textarea');
        if (firstInput) {
            firstInput.focus();
        }
    }, 10);

    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 300);
    };

    modal.querySelector('.close-button').addEventListener('click', closeModal);

    options.buttons.forEach(btn => {
        const button = modal.querySelector(`#${btn.text.toLowerCase().replace(' ', '-')}-btn`);
        if (btn.action === 'close') {
            button.addEventListener('click', closeModal);
        } else {
            button.addEventListener('click', async () => {
                const result = await btn.action();
                if (result) {
                    closeModal();
                }
            });
        }
    });

    if (options.onRender) {
        options.onRender(modal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Handle ESC key
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };

    document.addEventListener('keydown', handleKeyDown);
    modal._handleKeyDown = handleKeyDown;
}

// Enhanced Loading Indicator
function showLoading(message = 'Loading...') {
    let loading = document.getElementById('loading-overlay');

    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-overlay';
        loading.style.position = 'fixed';
        loading.style.top = '0';
        loading.style.left = '0';
        loading.style.right = '0';
        loading.style.bottom = '0';
        loading.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        loading.style.display = 'flex';
        loading.style.alignItems = 'center';
        loading.style.justifyContent = 'center';
        loading.style.zIndex = '1000';
        loading.style.color = 'white';
        loading.style.fontSize = '18px';
        loading.style.backdropFilter = 'blur(4px)';

        loading.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="width: 40px; height: 40px; border: 4px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: white; animation: spin 1s ease-in-out infinite; margin: 0 auto 16px;"></div>
                <p>${message}</p>
            </div>
        `;

        document.body.appendChild(loading);

        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    } else {
        loading.querySelector('p').textContent = message;
        loading.style.display = 'flex';
    }
}

function hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
        loading.style.display = 'none';
    }
}

// Enhanced Error Message with auto-hide
function showError(message) {
    document.querySelectorAll('.error-message').forEach(el => el.remove());

    const error = document.createElement('div');
    error.className = 'error-message animated';
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'assertive');
    error.style.position = 'fixed';
    error.style.bottom = '20px';
    error.style.left = '50%';
    error.style.transform = 'translateX(-50%)';
    error.style.backgroundColor = 'var(--error)';
    error.style.color = 'white';
    error.style.padding = '12px 24px';
    error.style.borderRadius = 'var(--border-radius)';
    error.style.boxShadow = 'var(--box-shadow)';
    error.style.zIndex = '1000';
    error.style.display = 'flex';
    error.style.alignItems = 'center';
    error.style.gap = '8px';
    error.style.maxWidth = '90%';
    error.style.wordBreak = 'break-word';

    error.innerHTML = `
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(error);

    setTimeout(() => {
        error.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            error.remove();
        }, 300);
    }, 5000);

    if (!document.getElementById('error-animations')) {
        const style = document.createElement('style');
        style.id = 'error-animations';
        style.innerHTML = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(10px); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Enhanced Success Message
function showSuccess(message) {
    document.querySelectorAll('.success-message').forEach(el => el.remove());

    const success = document.createElement('div');
    success.className = 'success-message animated';
    success.setAttribute('role', 'status');
    success.setAttribute('aria-live', 'polite');
    success.style.position = 'fixed';
    success.style.bottom = '20px';
    success.style.left = '50%';
    success.style.transform = 'translateX(-50%)';
    success.style.backgroundColor = 'var(--success)';
    success.style.color = 'white';
    success.style.padding = '12px 24px';
    success.style.borderRadius = 'var(--border-radius)';
    success.style.boxShadow = 'var(--box-shadow)';
    success.style.zIndex = '1000';
    success.style.display = 'flex';
    success.style.alignItems = 'center';
    success.style.gap = '8px';
    success.style.maxWidth = '90%';
    success.style.wordBreak = 'break-word';

    success.innerHTML = `
        <i class="fas fa-check-circle" aria-hidden="true"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(success);

    setTimeout(() => {
        success.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            success.remove();
        }, 300);
    }, 5000);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);

// Handle window resize for responsive drawer
window.addEventListener('resize', () => {
    if (document.querySelector('.drawer')) {
        updateDrawerState();
    }
});