// Main Application Class
class NearCheckApp {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.currentView = 'auth';
    this.sections = [];
    this.students = [];
    this.attendanceSessions = [];
    this.activeSession = null;
    this.activeSection = null;
    
    // Location permission state
    this.locationPermission = {
      status: 'not-granted',
      lastUsed: null,
      timer: null,
      expirationTime: 24 * 60 * 60 * 1000, // 24 hours
      activityWindow: null,
      autoCheckIn: false
    };
    
    // Security configurations
    this.security = {
      debugCheckInterval: null,
      tamperDetection: {
        lastModified: null,
        integrityCheck: true
      },
      countryRestriction: 'PH',
      ipCheckInterval: null
    };
    
    // Initialize the app
    this.init();
  }
  
  // Initialize the application
  async init() {
    try {
      // Show loading state immediately
      this.showLoading('Initializing application...');
      
      // Load configuration first
      await this.loadConfig();
      
      // Initialize Firebase services
      await this.initFirebase();
      
      // Check country restriction
      const allowed = await this.checkCountryRestriction();
      if (!allowed) {
        this.hideLoading();
        this.showCountryRestrictionMessage();
        return;
      }
      
      // Set up security protections
      this.setupSecurityProtections();
      
      // Set up auth state listener
      this.setupAuthStateListener();
      
      // Check existing location permission
      this.checkExistingLocationPermission();
      
      // Load necessary libraries in background
      this.loadDependencies().catch(console.error);
      
      // Initial render
      this.renderAuthScreen();
      this.hideLoading();
    } catch (error) {
      console.error('Initialization error:', error);
      this.hideLoading();
      this.showError('Failed to initialize application. Please refresh the page.');
    }
  }
  
  // Load configuration from config.js
  async loadConfig() {
    return new Promise((resolve, reject) => {
      if (typeof config !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'config.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load configuration'));
      document.head.appendChild(script);
    });
  }
  
  // Load required dependencies
  async loadDependencies() {
    const dependencies = [
      'https://cdn.jsdelivr.net/npm/chart.js',
      'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
      'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js'
    ];
    
    await Promise.all(dependencies.map(url => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) {
          resolve();
          return;
        }
        
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }));
  }
  
  // Initialize Firebase services
  async initFirebase() {
    try {
      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(config.firebase);
      }
      
      // Initialize services
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.storage = firebase.storage();
      
      // Enable persistence with error handling
      try {
        await this.db.enablePersistence({
          synchronizeTabs: true
        }).catch(err => {
          if (err.code === 'failed-precondition') {
            console.warn('Persistence can only be enabled in one tab at a time.');
          } else if (err.code === 'unimplemented') {
            console.warn('Current browser does not support all persistence features.');
          }
        });
      } catch (error) {
        console.warn('Firebase persistence error:', error);
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw new Error('Failed to initialize Firebase services');
    }
  }
  
  // Check if user is in allowed country
  async checkCountryRestriction() {
    // Allow local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }

    try {
      const response = await fetch(config.ipGeolocationApi);
      if (!response.ok) throw new Error('Geolocation API failed');
      
      const data = await response.json();
      return data.country === this.security.countryRestriction;
    } catch (error) {
      console.error('Geolocation check failed:', error);
      return true; // Allow access if API fails
    }
  }
  
  // Show country restriction message
  showCountryRestrictionMessage() {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = `
      <div class="country-restriction-container">
        <div class="country-restriction-card">
          <i class="fas fa-globe-americas"></i>
          <h2>Access Restricted</h2>
          <p>NearCheck Lite is currently only available in the Philippines due to regulatory requirements.</p>
          <p>If you believe this is an error, please contact support.</p>
          <div class="contact-btn">
            <button class="btn-primary">Contact Support</button>
          </div>
        </div>
      </div>
    `;
    
    // Add basic styles if not already present
    if (!document.getElementById('restriction-styles')) {
      const style = document.createElement('style');
      style.id = 'restriction-styles';
      style.textContent = `
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
          border-radius: 20px;
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
        .contact-btn button {
          background-color: #007bff;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: background-color 0.3s ease;
          margin-top: 15px;
        }
        .contact-btn button:hover {
          background-color: #0056b3;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Set up security protections
  setupSecurityProtections() {
    // Debugger detection
    this.security.debugCheckInterval = setInterval(() => {
      if (this.isDebuggerAttached()) {
        this.handleTamperingDetected();
      }
    }, 1000);
    
    // Record last modified time
    this.security.tamperDetection.lastModified = document.lastModified;
    
    // Disable right-click in production
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showToast('Right-click is disabled for security', 'info');
      }, { passive: false });
    }
    
    // Periodic IP/country check
    this.security.ipCheckInterval = setInterval(async () => {
      try {
        const allowed = await this.checkCountryRestriction();
        if (!allowed) {
          this.showCountryRestrictionMessage();
          clearInterval(this.security.ipCheckInterval);
        }
      } catch (error) {
        console.error('IP check failed:', error);
      }
    }, 3600000); // Every hour
  }
  
  // Check if debugger is attached
  isDebuggerAttached() {
    const startTime = performance.now();
    debugger;
    return performance.now() - startTime > 100;
  }
  
  // Handle security violations
  handleTamperingDetected() {
    clearInterval(this.security.debugCheckInterval);
    clearInterval(this.security.ipCheckInterval);
    this.showError('Security violation detected');
    this.auth.signOut();
    
    setTimeout(() => {
      window.location.href = '/security-error.html';
    }, 2000);
  }
  
  // Check existing location permissions
  checkExistingLocationPermission() {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(permissionStatus => {
          this.updatePermissionState(permissionStatus.state);
          permissionStatus.onchange = () => {
            this.updatePermissionState(permissionStatus.state);
          };
        })
        .catch(() => {
          this.updatePermissionState('prompt');
        });
    } else {
      this.updatePermissionState('prompt');
    }
    
    // Load auto check-in preference
    const autoCheckInPref = localStorage.getItem('autoCheckInPref');
    if (autoCheckInPref) {
      this.locationPermission.autoCheckIn = autoCheckInPref === 'true';
    }
  }
  
  // Update permission state
  updatePermissionState(state) {
    switch (state) {
      case 'granted':
        this.locationPermission.status = 'granted';
        this.startActivityWindow();
        break;
      case 'denied':
        this.locationPermission.status = 'denied';
        this.clearActivityWindow();
        break;
      case 'prompt':
        this.locationPermission.status = 'not-granted';
        this.clearActivityWindow();
        break;
    }
    
    if (this.currentView === 'permissions') {
      this.renderPermissionsContent();
    }
  }
  
  // Start activity window for location access
  startActivityWindow() {
    if (this.locationPermission.timer) {
      clearTimeout(this.locationPermission.timer);
    }
    
    this.locationPermission.lastUsed = new Date();
    this.locationPermission.activityWindow = new Date(Date.now() + this.locationPermission.expirationTime);
    
    this.locationPermission.timer = setTimeout(() => {
      this.locationPermission.status = 'not-granted';
      this.locationPermission.autoCheckIn = false;
      localStorage.setItem('autoCheckInPref', 'false');
      
      if (this.currentView === 'permissions') {
        this.renderPermissionsContent();
      }
      
      this.showToast('Location access window expired', 'info');
    }, this.locationPermission.expirationTime);
  }
  
  // Extend activity window
  extendActivityWindow() {
    if (this.locationPermission.status === 'granted') {
      this.startActivityWindow();
      this.showToast('Location access window extended', 'success');
    }
  }
  
  // Clear activity window
  clearActivityWindow() {
    if (this.locationPermission.timer) {
      clearTimeout(this.locationPermission.timer);
    }
    this.locationPermission.lastUsed = null;
    this.locationPermission.activityWindow = null;
  }
  
  // Request location permission with context
  async requestLocationPermission(context = 'general') {
    if (this.locationPermission.status === 'granted') {
      return true;
    }
    
    if (this.locationPermission.status === 'denied') {
      throw new Error('Location access was previously denied. Please enable it in settings.');
    }
    
    const userResponse = await this.showLocationPermissionPrompt(context);
    
    if (userResponse === 'granted') {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            this.locationPermission.status = 'granted';
            this.startActivityWindow();
            resolve(true);
          },
          (error) => {
            this.locationPermission.status = 'denied';
            reject(error);
          }, 
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });
    } else {
      this.locationPermission.status = 'denied';
      throw new Error('Location access was denied by user.');
    }
  }
  
  // Show location permission prompt with context
  async showLocationPermissionPrompt(context) {
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
    
    return new Promise((resolve) => {
      this.showModal({
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
        `,
        buttons: [
          {
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
              this.locationPermission.autoCheckIn = autoCheckIn;
              localStorage.setItem('autoCheckInPref', autoCheckIn.toString());
              resolve('granted');
              return true;
            }
          }
        ]
      });
    });
  }
  
  // Set up auth state listener
  setupAuthStateListener() {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.currentUser = user;
        await this.fetchUserData();
        this.renderDashboard();
        
        // Check for auto check-in if enabled
        if (this.locationPermission.status === 'granted' && this.locationPermission.autoCheckIn) {
          this.checkForAutoCheckIn();
        }
      } else {
        this.currentUser = null;
        this.userRole = null;
        this.renderAuthScreen();
      }
    });
  }
  
  // Check for auto check-in opportunities
  async checkForAutoCheckIn() {
    if (this.userRole !== 'student' || !this.sections.length) return;
    
    try {
      // Get current location
      const position = await this.getCurrentPosition();
      const currentLocation = new firebase.firestore.GeoPoint(
        position.coords.latitude,
        position.coords.longitude
      );
      
      // Check active sessions for each section
      for (const section of this.sections) {
        const sessionsSnapshot = await this.db.collection('sessions')
          .where('sectionId', '==', section.id)
          .where('status', '==', 'active')
          .get();
        
        if (!sessionsSnapshot.empty) {
          const session = sessionsSnapshot.docs[0].data();
          const sessionId = sessionsSnapshot.docs[0].id;
          
          // Skip if already checked in
          if (session.attendees && session.attendees.includes(this.currentUser.uid)) {
            continue;
          }
          
          // Calculate distance
          const distance = this.calculateDistance(
            session.location.latitude,
            session.location.longitude,
            currentLocation.latitude,
            currentLocation.longitude
          );
          
          // If within range, auto check-in
          if (distance <= session.range) {
            await this.db.collection('attendance').add({
              sessionId,
              sectionId: section.id,
              studentId: this.currentUser.uid,
              studentName: this.currentUser.displayName || 'Student',
              checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
              location: currentLocation,
              distance,
              status: 'present (auto)',
              deviceInfo: navigator.userAgent
            });
            
            await this.db.collection('sessions').doc(sessionId).update({
              attendees: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid)
            });
            
            this.showToast(`Auto check-in successful for ${section.name}`, 'success');
          }
        }
      }
    } catch (error) {
      console.error('Auto check-in failed:', error);
    }
  }
  
  // Fetch user data based on role
  async fetchUserData() {
    try {
      this.showLoading('Loading your data...');
      
      const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
      
      if (userDoc.exists) {
        this.userRole = userDoc.data().role;
        
        if (this.userRole === 'teacher') {
          // Fetch teacher's sections
          const sectionsSnapshot = await this.db.collection('sections')
            .where('teacherId', '==', this.currentUser.uid)
            .get();
          
          this.sections = sectionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Fetch students for each section
          const studentsPromises = this.sections.map(async section => {
            const studentsSnapshot = await this.db.collection('users')
              .where('sections', 'array-contains', section.id)
              .where('role', '==', 'student')
              .select('fullName', 'email', 'sections')
              .get();
            
            return studentsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          });
          
          const studentsArrays = await Promise.all(studentsPromises);
          this.students = studentsArrays.flat();
        } else if (this.userRole === 'student') {
          const userData = userDoc.data();
          this.sections = [];
          
          if (userData.sections && userData.sections.length > 0) {
            const sectionsSnapshot = await this.db.collection('sections')
              .where(firebase.firestore.FieldPath.documentId(), 'in', userData.sections)
              .select('name', 'subject', 'schedule', 'teacherName', 'checkInRange')
              .get();
            
            this.sections = sectionsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          }
        }
      }
      
      this.hideLoading();
    } catch (error) {
      this.hideLoading();
      this.showError('Failed to fetch user data. Please refresh the page to try again.');
      console.error('Error fetching user data:', error);
    }
  }
  
  // Render authentication screen
  renderAuthScreen() {
    this.currentView = 'auth';
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <img src="nearcheck.svg" alt="NearCheck Logo" class="auth-logo">
            <h1>NearCheck Lite</h1>
            <p>Smart geolocation-based attendance system for educators and students</p>
          </div>
          <div id="auth-content"></div>
        </div>
      </div>
    `;
    
    // Add basic styles if not already present
    if (!document.getElementById('auth-styles')) {
      const style = document.createElement('style');
      style.id = 'auth-styles';
      style.textContent = `
        .auth-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .auth-card {
          background: white;
          border-radius: 16px;
          padding: 32px;
          width: 100%;
          max-width: 450px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .auth-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .auth-logo {
          width: 50%;
          height: auto;
          margin-bottom: 16px;
        }
        .auth-header h1 {
          margin: 0 0 8px 0;
          color: #2c3e50;
        }
        .auth-header p {
          margin: 0;
          color: #7f8c8d;
        }
        .role-selector {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
        }
        .role-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .role-button:hover {
          border-color: #cbd5e0;
          background-color: #f8f9fa;
        }
        .role-button i {
          font-size: 20px;
          color: #4a5568;
        }
        .auth-footer {
          text-align: center;
          margin-top: 16px;
          font-size: 14px;
        }
        .auth-footer a {
          color: #4299e1;
          text-decoration: none;
          font-weight: 500;
        }
        .auth-footer a:hover {
          text-decoration: underline;
        }
        .input-group {
          margin-bottom: 16px;
        }
        .input-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #4a5568;
        }
        .input-group input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }
        .input-group input:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
        }
        .input-hint {
          margin-top: 4px;
          font-size: 12px;
          color: #718096;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .button-primary {
          background-color: #4299e1;
          color: white;
        }
        .button-primary:hover {
          background-color: #3182ce;
        }
        .button-secondary {
          background-color: #e2e8f0;
          color: #4a5568;
        }
        .button-secondary:hover {
          background-color: #cbd5e0;
        }
        .w-100 {
          width: 100%;
        }
        .mt-4 {
          margin-top: 16px;
        }
      `;
      document.head.appendChild(style);
    }
    
    this.renderRoleSelection();
  }
  
  // Render role selection screen
  renderRoleSelection() {
    const authContent = document.getElementById('auth-content');
    authContent.innerHTML = `
      <div class="role-selector">
        <button class="role-button" id="teacher-role-btn">
          <span>I'm a Teacher</span>
          <i class="fas fa-chalkboard-teacher"></i>
        </button>
        <button class="role-button" id="student-role-btn">
          <span>I'm a Student</span>
          <i class="fas fa-user-graduate"></i>
        </button>
      </div>
      <div class="auth-footer">
        Already have an account? <a href="#" id="sign-in-link">Sign in</a>
      </div>
    `;
    
    document.getElementById('teacher-role-btn').addEventListener('click', () => 
      this.renderSignUpForm('teacher'));
    document.getElementById('student-role-btn').addEventListener('click', () => 
      this.renderSignUpForm('student'));
    document.getElementById('sign-in-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.renderSignInForm();
    });
  }
  
  // Render sign-up form based on role
  renderSignUpForm(role) {
    const authContent = document.getElementById('auth-content');
    
    if (role === 'teacher') {
      authContent.innerHTML = `
        <form id="signup-form">
          <div class="input-group">
            <label for="fullname">Full Name</label>
            <input type="text" id="fullname" required maxlength="100">
          </div>
          <div class="input-group">
            <label for="email">Email</label>
            <input type="email" id="email" required maxlength="100">
          </div>
          <div class="input-group">
            <label for="password">Password</label>
            <input type="password" id="password" required minlength="6" maxlength="100">
            <p class="input-hint">Minimum 6 characters</p>
          </div>
          <div class="input-group">
            <label for="confirm-password">Confirm Password</label>
            <input type="password" id="confirm-password" required minlength="6" maxlength="100">
          </div>
          <div class="input-group">
            <label for="birthdate">Birthdate (Must be 20+)</label>
            <div class="birthdate-inputs">
              <input type="text" id="birthdate-day" placeholder="DD" maxlength="2" pattern="[0-9]*" inputmode="numeric">
              <input type="text" id="birthdate-month" placeholder="MM" maxlength="2" pattern="[0-9]*" inputmode="numeric">
              <input type="text" id="birthdate-year" placeholder="YYYY" maxlength="4" pattern="[0-9]*" inputmode="numeric">
            </div>
          </div>
          <div class="input-group">
            <label class="checkbox-label">
              <input type="checkbox" id="privacy-policy" required> 
              I agree to the <a href="#" id="privacy-policy-link">Privacy Policy</a>
            </label>
          </div>
          <button type="submit" class="button button-primary w-100 mt-4">Create Account</button>
        </form>
        <div class="auth-footer">
          Already have an account? <a href="#" id="sign-in-link">Sign in</a>
        </div>
      `;
      
      // Add birthdate input styles
      if (!document.getElementById('birthdate-styles')) {
        const style = document.createElement('style');
        style.id = 'birthdate-styles';
        style.textContent = `
          .birthdate-inputs {
            display: flex;
            gap: 8px;
          }
          .birthdate-inputs input {
            flex: 1;
            text-align: center;
          }
          .birthdate-inputs input:nth-child(3) {
            flex: 2;
          }
          .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          }
        `;
        document.head.appendChild(style);
      }
      
      this.setupDateInputs();
    } else {
      authContent.innerHTML = `
        <form id="signup-form">
          <div class="input-group">
            <label for="fullname">Full Name</label>
            <input type="text" id="fullname" required maxlength="100">
          </div>
          <div class="input-group">
            <label for="email">Email</label>
            <input type="email" id="email" required maxlength="100">
          </div>
          <div class="input-group">
            <label for="password">Password</label>
            <input type="password" id="password" required minlength="6" maxlength="100">
            <p class="input-hint">Minimum 6 characters</p>
          </div>
          <div class="input-group">
            <label for="confirm-password">Confirm Password</label>
            <input type="password" id="confirm-password" required minlength="6" maxlength="100">
          </div>
          <div class="input-group">
            <label for="section-id">Section ID (optional)</label>
            <input type="text" id="section-id" placeholder="Provided by your teacher" maxlength="50">
          </div>
          <div class="input-group">
            <label class="checkbox-label">
              <input type="checkbox" id="age-confirm" required> 
              I confirm I'm 13 years or older
            </label>
          </div>
          <div class="input-group">
            <label class="checkbox-label">
              <input type="checkbox" id="privacy-policy" required> 
              I agree to the <a href="#" id="privacy-policy-link">Privacy Policy</a>
            </label>
          </div>
          <button type="submit" class="button button-primary w-100 mt-4">Continue</button>
        </form>
        <div class="auth-footer">
          Already have an account? <a href="#" id="sign-in-link">Sign in</a>
        </div>
      `;
      
      // Pre-fill section ID if in URL
      const urlParams = new URLSearchParams(window.location.search);
      const sectionId = urlParams.get('sectionid');
      if (sectionId) {
        document.getElementById('section-id').value = sectionId;
      }
    }
    
    document.getElementById('signup-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignUp(role);
    });
    
    document.getElementById('sign-in-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.renderSignInForm();
    });
    
    document.getElementById('privacy-policy-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.showPrivacyPolicy();
    });
  }
  
  // Set up date inputs for teacher signup
  setupDateInputs() {
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
  
  // Render sign-in form
  renderSignInForm() {
    const authContent = document.getElementById('auth-content');
    authContent.innerHTML = `
      <form id="signin-form">
        <div class="input-group">
          <label for="email">Email</label>
          <input type="email" id="email" required maxlength="100">
        </div>
        <div class="input-group">
          <label for="password">Password</label>
          <input type="password" id="password" required maxlength="100">
        </div>
        <div class="input-group">
          <a href="#" id="forgot-password">Forgot password?</a>
        </div>
        <button type="submit" class="button button-primary w-100">Sign In</button>
      </form>
      <div class="auth-footer">
        New to NearCheck? <a href="#" id="sign-up-link">Sign up</a>
      </div>
    `;
    
    document.getElementById('signin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignIn();
    });
    
    document.getElementById('sign-up-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.renderRoleSelection();
    });
    
    document.getElementById('forgot-password').addEventListener('click', (e) => {
      e.preventDefault();
      this.showForgotPasswordModal();
    });
  }
  
  // Handle user sign-up
  async handleSignUp(role) {
    const fullName = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const privacyPolicyAccepted = document.getElementById('privacy-policy').checked;
    
    if (!fullName || !email || !password || !confirmPassword) {
      this.showError('Please fill all required fields');
      return;
    }
    
    if (password !== confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }
    
    if (!privacyPolicyAccepted) {
      this.showError('You must agree to the Privacy Policy');
      return;
    }
    
    if (role === 'teacher') {
      const day = document.getElementById('birthdate-day').value;
      const month = document.getElementById('birthdate-month').value;
      const year = document.getElementById('birthdate-year').value;
      
      if (!day || !month || !year) {
        this.showError('Please enter your complete birthdate');
        return;
      }
      
      const birthDate = new Date(`${year}-${month}-${day}`);
      if (isNaN(birthDate.getTime())) {
        this.showError('Please enter a valid date');
        return;
      }
      
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 20) {
        this.showError('You must be at least 20 years old to register as a teacher');
        return;
      }
    }
    
    if (role === 'student' && !document.getElementById('age-confirm').checked) {
      this.showError('You must confirm you are at least 13 years old');
      return;
    }
    
    try {
      this.showLoading('Creating account...');
      
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
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
      
      await this.db.collection('users').doc(user.uid).set(userData);
      
      await user.updateProfile({
        displayName: fullName
      });
      
      this.hideLoading();
      
      this.currentUser = user;
      this.userRole = role;
      await this.fetchUserData();
      this.renderDashboard();
    } catch (error) {
      this.hideLoading();
      if (error.code === 'auth/email-already-in-use') {
        this.showError('This email is already registered. Please sign in instead.');
      } else if (error.code === 'auth/weak-password') {
        this.showError('Password should be at least 6 characters');
      } else if (error.code === 'auth/invalid-email') {
        this.showError('Please enter a valid email address');
      } else {
        this.showError(error.message || 'Account creation failed. Please try again.');
      }
    }
  }
  
  // Handle user sign-in
  async handleSignIn() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
      this.showError('Please enter both email and password');
      return;
    }
    
    try {
      this.showLoading('Signing in...');
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      this.currentUser = userCredential.user;
      
      // Update last login time
      await this.db.collection('users').doc(this.currentUser.uid).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      this.hideLoading();
    } catch (error) {
      this.hideLoading();
      if (error.code === 'auth/user-not-found') {
        this.showError('No account found with this email. Please sign up.');
      } else if (error.code === 'auth/wrong-password') {
        this.showError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/too-many-requests') {
        this.showError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        this.showError(error.message || 'Sign in failed. Please try again.');
      }
    }
  }
  
  // Render main dashboard
  renderDashboard() {
    this.currentView = 'dashboard';
    const appContainer = document.getElementById('app');
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
            ${this.userRole === 'teacher' ? `
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
    
    // Add dashboard styles if not already present
    if (!document.getElementById('dashboard-styles')) {
      const style = document.createElement('style');
      style.id = 'dashboard-styles';
      style.textContent = `
        .dashboard {
          display: flex;
          min-height: 100vh;
        }
        .drawer {
          width: 280px;
          background: #2d3748;
          color: white;
          transition: transform 0.3s ease;
          position: fixed;
          height: 100vh;
          z-index: 100;
          transform: translateX(-280px);
        }
        .drawer.open {
          transform: translateX(0);
        }
        .drawer-header {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #4a5568;
        }
        .drawer-header h2 {
          margin: 0;
          font-size: 20px;
        }
        .menu-toggle {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
        }
        .menu-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .drawer-menu {
          padding: 16px 0;
        }
        .menu-item {
          display: flex;
          align-items: center;
          padding: 12px 20px;
          color: #cbd5e0;
          text-decoration: none;
          gap: 12px;
          transition: all 0.2s;
        }
        .menu-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }
        .menu-item.active {
          background: #4299e1;
          color: white;
        }
        .drawer-footer {
          padding: 20px;
          position: absolute;
          bottom: 0;
          width: 100%;
        }
        .button-danger {
          background-color: #e53e3e;
          color: white;
          width: 100%;
        }
        .button-danger:hover {
          background-color: #c53030;
        }
        .main-content {
          flex: 1;
          margin-left: 0;
          transition: margin-left 0.3s ease;
        }
        .content-header {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
        }
        .content-header h1 {
          margin: 0;
          font-size: 24px;
          color: #2d3748;
        }
        .content-body {
          padding: 20px;
        }
        @media (min-width: 992px) {
          .drawer {
            transform: translateX(0);
            position: relative;
          }
          .main-content {
            margin-left: 280px;
          }
          .menu-toggle {
            display: none;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set up event listeners for navigation
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        this.setActiveMenuItem(view);
        this.renderContent(view);
      });
    });
    
    // Sign out button
    document.getElementById('sign-out-btn').addEventListener('click', () => {
      this.auth.signOut();
    });
    
    // Drawer toggle buttons
    document.getElementById('drawer-toggle').addEventListener('click', this.toggleDrawer.bind(this));
    document.getElementById('mobile-drawer-toggle').addEventListener('click', this.toggleDrawer.bind(this));
    
    // Update drawer state based on screen size
    this.updateDrawerState();
    
    // Render initial content
    this.renderContent('dashboard');
  }
  
  // Toggle drawer visibility
  toggleDrawer() {
    document.querySelector('.drawer').classList.toggle('open');
  }
  
  // Update drawer state based on screen size
  updateDrawerState() {
    const drawer = document.querySelector('.drawer');
    if (!drawer) return;
    
    if (window.innerWidth >= 992) {
      drawer.classList.add('open');
    } else {
      drawer.classList.remove('open');
    }
  }
  
  // Set active menu item
  setActiveMenuItem(view) {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
      item.removeAttribute('aria-current');
      if (item.getAttribute('data-view') === view) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      }
    });
  }
  
  // Render content based on view
  renderContent(view) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    
    // Update header title
    const headerTitle = document.querySelector('.content-header h1');
    if (headerTitle) {
      headerTitle.textContent = view.charAt(0).toUpperCase() + view.slice(1).replace(/-/g, ' ');
    }
    
    // Render appropriate content
    switch (view) {
      case 'dashboard':
        this.renderDashboardContent();
        break;
      case 'sections':
        this.renderSectionsContent();
        break;
      case 'students':
        this.renderStudentsContent();
        break;
      case 'reports':
        this.renderReportsContent();
        break;
      case 'permissions':
        this.renderPermissionsContent();
        break;
      case 'account':
        this.renderAccountContent();
        break;
      default:
        this.renderDashboardContent();
    }
  }
  
  // Render dashboard content
  renderDashboardContent() {
    const now = new Date();
    const hours = now.getHours();
    let greeting = 'Good morning';
    
    if (hours >= 12 && hours < 17) {
      greeting = 'Good afternoon';
    } else if (hours >= 17 || hours < 5) {
      greeting = 'Good evening';
    }
    
    const firstName = this.currentUser.displayName ? this.currentUser.displayName.split(' ')[0] : 'User';
    
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
      <div class="greeting">
        <h2>${greeting}, ${firstName}</h2>
        <p>${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      
      ${this.userRole === 'teacher' ? `
        <div class="header-actions">
          <button class="button button-primary" id="create-section-btn">
            <i class="fas fa-plus"></i>
            <span>Create Section</span>
          </button>
        </div>
      ` : ''}
      
      ${this.sections.length > 0 ? `
        <div class="section-carousel">
          ${this.sections.map(section => `
            <div class="card" data-section-id="${section.id}">
              <div class="section-menu">
                <i class="fas fa-ellipsis-v"></i>
                <div class="dropdown-menu">
                  ${this.userRole === 'teacher' ? `
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
              ${this.userRole === 'teacher' ? `
                <p>${section.students ? section.students.length : 0} students</p>
                <div class="section-actions">
                  <button class="button button-primary start-session-btn">
                    Start Session
                  </button>
                </div>
              ` : `
                <div class="teacher-info">
                  <div class="teacher-avatar">${section.teacherName ? section.teacherName.charAt(0) : 'T'}</div>
                  <span>${section.teacherName || 'Teacher'}</span>
                </div>
                <div class="section-actions">
                  <button class="button button-primary checkin-btn">
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
          <p>${this.userRole === 'teacher' ? 'Create your first section to get started with attendance tracking' : 'Join a section using an invitation link from your teacher to begin checking in'}</p>
          ${this.userRole === 'teacher' ? `
            <button class="button button-primary" id="create-section-btn-2">
              Create Section
            </button>
          ` : `
            <button class="button button-primary" id="join-section-btn">
              Join Section
            </button>
          `}
        </div>
      `}
    `;
    
    // Add section card styles if not already present
    if (!document.getElementById('section-card-styles')) {
      const style = document.createElement('style');
      style.id = 'section-card-styles';
      style.textContent = `
        .greeting {
          margin-bottom: 24px;
        }
        .greeting h2 {
          margin: 0 0 4px 0;
          color: #2d3748;
        }
        .greeting p {
          margin: 0;
          color: #718096;
        }
        .header-actions {
          margin-bottom: 24px;
        }
        .section-carousel {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: relative;
        }
        .section-menu {
          position: absolute;
          top: 16px;
          right: 16px;
          cursor: pointer;
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
        .card h3 {
          margin: 0 0 8px 0;
          color: #2d3748;
        }
        .card p {
          margin: 0 0 8px 0;
          color: #718096;
        }
        .section-id {
          display: inline-block;
          font-size: 12px;
          background: #edf2f7;
          padding: 2px 8px;
          border-radius: 4px;
          color: #4a5568;
          margin-bottom: 12px;
        }
        .teacher-info {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        .teacher-avatar {
          width: 32px;
          height: 32px;
          background: #4299e1;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        .section-actions {
          margin-top: 16px;
        }
        .empty-state {
          text-align: center;
          padding: 40px 20px;
        }
        .empty-state i {
          font-size: 48px;
          color: #cbd5e0;
          margin-bottom: 16px;
        }
        .empty-state h3 {
          margin: 0 0 8px 0;
          color: #2d3748;
        }
        .empty-state p {
          margin: 0 0 16px 0;
          color: #718096;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set up event listeners for teacher actions
    if (this.userRole === 'teacher') {
      const createSectionBtn = document.getElementById('create-section-btn') || document.getElementById('create-section-btn-2');
      if (createSectionBtn) {
        createSectionBtn.addEventListener('click', () => this.showCreateSectionModal());
      }
      
      document.querySelectorAll('.start-session-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const sectionCard = e.target.closest('.card');
          const sectionId = sectionCard.getAttribute('data-section-id');
          const section = this.sections.find(s => s.id === sectionId);
          this.showStartSessionModal(section);
        });
      });
    } else {
      // Set up event listeners for student actions
      const joinSectionBtn = document.getElementById('join-section-btn');
      if (joinSectionBtn) {
        joinSectionBtn.addEventListener('click', () => this.renderSectionsContent());
      }
      
      document.querySelectorAll('.checkin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const sectionCard = e.target.closest('.card');
          const sectionId = sectionCard.getAttribute('data-section-id');
          const section = this.sections.find(s => s.id === sectionId);
          this.handleStudentCheckIn(section);
        });
      });
    }
    
    // Set up dropdown menu actions
    document.querySelectorAll('.dropdown-item[data-action="edit"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        this.showEditSectionModal(section);
      });
    });
    
    document.querySelectorAll('.dropdown-item[data-action="delete"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        this.showDeleteSectionModal(section);
      });
    });
    
    document.querySelectorAll('.dropdown-item[data-action="invite"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        this.showInviteStudentsModal(section);
      });
    });
    
    document.querySelectorAll('.dropdown-item[data-action="leave"]').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        
        if (confirm(`Are you sure you want to leave ${section.name}?`)) {
          try {
            this.showLoading('Leaving section...');
            await this.db.collection('users').doc(this.currentUser.uid).update({
              sections: firebase.firestore.FieldValue.arrayRemove(sectionId)
            });
            
            await this.fetchUserData();
            this.hideLoading();
            this.showSuccess(`You have left ${section.name}`);
            this.renderDashboardContent();
          } catch (error) {
            this.hideLoading();
            this.showError('Failed to leave section: ' + error.message);
          }
        }
      });
    });
  }
  
  // Render sections content
  renderSectionsContent() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
      ${this.userRole === 'teacher' ? `
        <div class="header-actions">
          <button class="button button-primary" id="create-section-btn">
            <i class="fas fa-plus"></i>
            <span>Create Section</span>
          </button>
        </div>
      ` : ''}
      
      ${this.sections.length > 0 ? `
        <div class="section-list">
          ${this.sections.map(section => `
            <div class="card" data-section-id="${section.id}">
              <div class="section-header">
                <h3>${section.name}</h3>
                <div class="section-menu">
                  <i class="fas fa-ellipsis-v"></i>
                  <div class="dropdown-menu">
                    ${this.userRole === 'teacher' ? `
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
              
              ${this.userRole === 'teacher' ? `
                <div class="section-actions">
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
          <p>${this.userRole === 'teacher' ? 'Create your first section to start managing attendance' : 'Join a section to begin checking in to classes'}</p>
          ${this.userRole === 'teacher' ? `
            <button class="button button-primary" id="create-section-btn-2">
              Create Section
            </button>
          ` : `
            <div class="join-section-form">
              <input type="text" id="join-section-input" placeholder="Enter Section ID">
              <button class="button button-primary" id="join-section-btn">
                Join Section
              </button>
            </div>
            <p class="text-muted">Get the section ID from your teacher</p>
          `}
        </div>
      `}
    `;
    
    // Add section list styles if not already present
    if (!document.getElementById('section-list-styles')) {
      const style = document.createElement('style');
      style.id = 'section-list-styles';
      style.textContent = `
        .section-list {
          display: grid;
          gap: 16px;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .section-header h3 {
          margin: 0;
        }
        .text-muted {
          color: #718096;
        }
        .section-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        .join-section-form {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .join-section-form input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set up event listeners for teacher actions
    if (this.userRole === 'teacher') {
      const createSectionBtn = document.getElementById('create-section-btn') || document.getElementById('create-section-btn-2');
      if (createSectionBtn) {
        createSectionBtn.addEventListener('click', () => this.showCreateSectionModal());
      }
      
      document.querySelectorAll('.invite-students-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const sectionCard = e.target.closest('.card');
          const sectionId = sectionCard.getAttribute('data-section-id');
          const section = this.sections.find(s => s.id === sectionId);
          this.showInviteStudentsModal(section);
        });
      });
      
      document.querySelectorAll('.manage-students-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const sectionCard = e.target.closest('.card');
          const sectionId = sectionCard.getAttribute('data-section-id');
          const section = this.sections.find(s => s.id === sectionId);
          this.showManageStudentsModal(section);
        });
      });
    } else {
      // Set up event listeners for student actions
      const joinSectionBtn = document.getElementById('join-section-btn');
      if (joinSectionBtn) {
        joinSectionBtn.addEventListener('click', async () => {
          const sectionId = document.getElementById('join-section-input').value.trim();
          if (!sectionId) {
            this.showError('Please enter a section ID');
            return;
          }
          
          try {
            this.showLoading('Joining section...');
            const sectionDoc = await this.db.collection('sections').doc(sectionId).get();
            if (!sectionDoc.exists) {
              throw new Error('Section not found. Please check the ID and try again.');
            }
            
            await this.db.collection('users').doc(this.currentUser.uid).update({
              sections: firebase.firestore.FieldValue.arrayUnion(sectionId)
            });
            
            await this.fetchUserData();
            this.hideLoading();
            this.renderContent('sections');
          } catch (error) {
            this.hideLoading();
            this.showError(error.message);
          }
        });
      }
    }
    
    // Set up dropdown menu actions
    document.querySelectorAll('.dropdown-item[data-action="edit"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        this.showEditSectionModal(section);
      });
    });
    
    document.querySelectorAll('.dropdown-item[data-action="delete"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        this.showDeleteSectionModal(section);
      });
    });
    
    document.querySelectorAll('.dropdown-item[data-action="invite"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        this.showInviteStudentsModal(section);
      });
    });
    
    document.querySelectorAll('.dropdown-item[data-action="leave"]').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const sectionId = item.getAttribute('data-section-id');
        const section = this.sections.find(s => s.id === sectionId);
        
        if (confirm(`Are you sure you want to leave ${section.name}?`)) {
          try {
            this.showLoading('Leaving section...');
            await this.db.collection('users').doc(this.currentUser.uid).update({
              sections: firebase.firestore.FieldValue.arrayRemove(sectionId)
            });
            
            await this.fetchUserData();
            this.hideLoading();
            this.showSuccess(`You have left ${section.name}`);
            this.renderContent('sections');
          } catch (error) {
            this.hideLoading();
            this.showError('Failed to leave section: ' + error.message);
          }
        }
      });
    });
  }
  
  // Render students content (teacher only)
  renderStudentsContent() {
    if (this.userRole !== 'teacher') return;
    
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
      <div class="header-actions">
        <button class="button button-primary" id="export-students-btn">
          <i class="fas fa-file-export"></i>
          <span>Export Student List</span>
        </button>
      </div>
      
      ${this.students.length > 0 ? `
        <div class="students-list">
          ${this.students.map(student => `
            <div class="card" data-student-id="${student.id}">
              <div class="student-header">
                <div class="student-info">
                  <div class="student-avatar">
                    ${student.fullName ? student.fullName.charAt(0) : 'S'}
                  </div>
                  <div>
                    <h3>${student.fullName || 'Student'}</h3>
                    <p class="text-muted">${student.email}</p>
                  </div>
                </div>
                <div class="student-menu">
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
              <div class="student-stats">
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
          <button class="button button-primary" id="invite-students-btn">
            Invite Students
          </button>
        </div>
      `}
    `;
    
    // Add student list styles if not already present
    if (!document.getElementById('student-list-styles')) {
      const style = document.createElement('style');
      style.id = 'student-list-styles';
      style.textContent = `
        .students-list {
          display: grid;
          gap: 16px;
        }
        .student-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .student-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .student-avatar {
          width: 40px;
          height: 40px;
          background-color: #4299e1;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        .student-info h3 {
          margin: 0;
          font-size: 16px;
        }
        .student-info p {
          margin: 0;
          font-size: 14px;
        }
        .student-stats {
          margin-top: 12px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set up event listeners
    const inviteStudentsBtn = document.getElementById('invite-students-btn');
    if (inviteStudentsBtn) {
      inviteStudentsBtn.addEventListener('click', () => {
        if (this.sections.length > 0) {
          this.renderContent('sections');
        } else {
          this.showCreateSectionModal();
        }
      });
    }
    
    document.getElementById('export-students-btn').addEventListener('click', () => {
      this.exportStudentsList();
    });
    
    // Set up dropdown menu actions
    document.querySelectorAll('.dropdown-item[data-action="view"]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const studentId = item.getAttribute('data-student-id');
        const student = this.students.find(s => s.id === studentId);
        this.showStudentDetailsModal(student);
      });
    });
    
    document.querySelectorAll('.dropdown-item[data-action="remove"]').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const studentId = item.getAttribute('data-student-id');
        const student = this.students.find(s => s.id === studentId);
        
        if (confirm(`Remove ${student.fullName || 'this student'} from all your sections?`)) {
          try {
            this.showLoading('Removing student...');
            
            // Remove student from all teacher's sections
            const batch = this.db.batch();
            const teacherSections = await this.db.collection('sections')
              .where('teacherId', '==', this.currentUser.uid)
              .get();
            
            teacherSections.forEach(sectionDoc => {
              const sectionRef = this.db.collection('users').doc(studentId);
              batch.update(sectionRef, {
                sections: firebase.firestore.FieldValue.arrayRemove(sectionDoc.id)
              });
            });
            
            await batch.commit();
            await this.fetchUserData();
            this.hideLoading();
            this.showSuccess('Student removed from all sections');
            this.renderContent('students');
          } catch (error) {
            this.hideLoading();
            this.showError('Failed to remove student: ' + error.message);
          }
        }
      });
    });
  }
  
  // Render reports content (teacher only)
  renderReportsContent() {
    if (this.userRole !== 'teacher') return;
    
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
      <div class="header-actions">
        <button class="button button-primary" id="export-reports-btn">
          <i class="fas fa-file-export"></i>
          <span>Export</span>
        </button>
      </div>
      
      <div class="reports-filters">
        <div class="filter-group">
          <label for="report-section-filter">Section</label>
          <select id="report-section-filter">
            <option value="">All Sections</option>
            ${this.sections.map(section => `
              <option value="${section.id}">${section.name}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="filter-group">
          <label for="report-time-filter">Time Period</label>
          <select id="report-time-filter">
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>
      
      <div id="custom-range-group" class="hidden">
        <div class="date-range-inputs">
          <div class="filter-group">
            <label for="report-start-date">Start Date</label>
            <input type="date" id="report-start-date">
          </div>
          <div class="filter-group">
            <label for="report-end-date">End Date</label>
            <input type="date" id="report-end-date">
          </div>
        </div>
      </div>
      
      <div class="reports-summary">
        <h3>Summary</h3>
        <div class="summary-stats">
          <div class="stat-card">
            <div class="stat-value">${this.students.length}</div>
            <div class="stat-label">Total Students</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="avg-attendance">0%</div>
            <div class="stat-label">Average Attendance</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="total-sessions">0</div>
            <div class="stat-label">Sessions</div>
          </div>
        </div>
      </div>
      
      <div class="reports-chart">
        <h3>Attendance Trend</h3>
        <div id="attendance-chart"></div>
      </div>
    `;
    
    // Add reports styles if not already present
    if (!document.getElementById('reports-styles')) {
      const style = document.createElement('style');
      style.id = 'reports-styles';
      style.textContent = `
        .reports-filters {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .filter-group {
          flex: 1;
          min-width: 200px;
        }
        .filter-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #4a5568;
        }
        .filter-group select, .filter-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .hidden {
          display: none;
        }
        .date-range-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }
        .reports-summary {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .reports-summary h3 {
          margin: 0 0 16px 0;
          color: #2d3748;
        }
        .summary-stats {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .stat-card {
          flex: 1;
          min-width: 120px;
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #4299e1;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 14px;
          color: #718096;
        }
        .reports-chart {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .reports-chart h3 {
          margin: 0 0 16px 0;
          color: #2d3748;
        }
        #attendance-chart {
          height: 300px;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Initialize chart
    this.renderAttendanceChart();
    
    // Set up event listeners
    document.getElementById('export-reports-btn').addEventListener('click', () => {
      this.showExportReportsModal();
    });
    
    document.getElementById('report-time-filter').addEventListener('change', (e) => {
      const customRangeGroup = document.getElementById('custom-range-group');
      if (e.target.value === 'custom') {
        customRangeGroup.classList.remove('hidden');
      } else {
        customRangeGroup.classList.add('hidden');
        this.updateReports();
      }
    });
    
    document.getElementById('report-section-filter').addEventListener('change', this.updateReports.bind(this));
    document.getElementById('report-start-date').addEventListener('change', this.updateReports.bind(this));
    document.getElementById('report-end-date').addEventListener('change', this.updateReports.bind(this));
    
    // Initial data load
    this.updateReports();
  }
  
  // Render attendance chart
  renderAttendanceChart() {
    const ctx = document.getElementById('attendance-chart');
    if (!ctx) return;
    
    // Create canvas if it doesn't exist
    if (!ctx.querySelector('canvas')) {
      ctx.innerHTML = '<canvas></canvas>';
    }
    
    const canvas = ctx.querySelector('canvas');
    const chartCtx = canvas.getContext('2d');
    
    // Destroy previous chart instance if exists
    if (window.attendanceChart) {
      window.attendanceChart.destroy();
    }
    
    window.attendanceChart = new Chart(chartCtx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Attendance Rate',
          data: [65, 59, 80, 81, 56, 55, 40],
          backgroundColor: 'rgba(66, 153, 225, 0.2)',
          borderColor: 'rgba(66, 153, 225, 1)',
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
  
  // Update reports data
  async updateReports() {
    try {
      this.showLoading('Loading report data...');
      
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
      
      // Fetch attendance data
      let query = this.db.collection('attendance')
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
      if (sectionFilter && this.students.length) {
        const sectionStudents = this.students.filter(s => s.sections.includes(sectionFilter));
        avgAttendance = Math.round((totalCheckIns / (totalSessions * sectionStudents.length)) * 100) || 0;
      } else if (this.students.length) {
        avgAttendance = Math.round((totalCheckIns / (totalSessions * this.students.length)) * 100) || 0;
      }
      
      // Update UI
      document.getElementById('avg-attendance').textContent = `${avgAttendance}%`;
      document.getElementById('total-sessions').textContent = totalSessions;
      
      // Update chart with real data
      this.updateChartWithData(attendanceData, startDate, endDate);
      
      this.hideLoading();
    } catch (error) {
      this.hideLoading();
      this.showError('Failed to update reports: ' + error.message);
    }
  }
  
  // Update chart with attendance data
  updateChartWithData(attendanceData, startDate, endDate) {
    if (!window.Chart || !window.attendanceChart) return;
    
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
      const rate = this.students.length ? Math.round((uniqueStudents / this.students.length) * 100) : 0;
      data.push(rate);
    }
    
    // Update chart
    window.attendanceChart.data.labels = labels;
    window.attendanceChart.data.datasets[0].data = data;
    window.attendanceChart.update();
  }
  
  // Render permissions content
  renderPermissionsContent() {
    const contentArea = document.getElementById('content-area');
    
    // Calculate time remaining if active
    let timeRemaining = '';
    if (this.locationPermission.activityWindow) {
      const remainingMs = this.locationPermission.activityWindow - new Date();
      if (remainingMs > 0) {
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        timeRemaining = `${hours}h ${minutes}m remaining`;
      }
    }
    
    contentArea.innerHTML = `
      <div class="permissions-container">
        <div class="permissions-header">
          <h2>Location Access</h2>
          <p>NearCheck Lite uses your location only during active class sessions to verify your physical presence.</p>
        </div>
        
        <div class="permission-status ${this.locationPermission.status}">
          <div class="status-icon">
            ${this.getStatusIcon(this.locationPermission.status)}
          </div>
          <div class="status-details">
            <h3>${this.getStatusTitle(this.locationPermission.status)}</h3>
            <p>${this.getStatusDescription(this.locationPermission.status)}</p>
            ${timeRemaining ? `<div class="time-remaining">${timeRemaining}</div>` : ''}
          </div>
        </div>
        
        <div class="permission-actions">
          ${this.locationPermission.status === 'granted' ? `
            <button class="button button-danger" id="disable-location-btn">
              <i class="fas fa-times"></i>
              <span>Revoke Access</span>
            </button>
            <button class="button button-secondary" id="extend-location-btn">
              <i class="fas fa-clock"></i>
              <span>Extend Duration</span>
            </button>
          ` : `
            <button class="button button-primary" id="enable-location-btn">
              <i class="fas fa-map-marker-alt"></i>
              <span>Enable Location</span>
            </button>
          `}
        </div>
        
        ${this.locationPermission.status === 'granted' ? `
          <div class="auto-checkin-toggle">
            <label class="toggle-switch">
              <input type="checkbox" id="auto-checkin-toggle" ${this.locationPermission.autoCheckIn ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <div class="toggle-label">
              <h4>Auto Check-In</h4>
              <p>Automatically check-in when in class location (within 24-hour window)</p>
            </div>
          </div>
        ` : ''}
        
        <div class="permission-info">
          <div class="info-section">
            <h3><i class="fas fa-search"></i> How Location Verification Works</h3>
            <ol>
              <li>Permission request when you check in (one-time or per session)</li>
              <li>Instant comparison with teacher's location coordinates</li>
              <li>Verification against classroom proximity setting</li>
              <li>Secure recording with timestamp and anonymized location data</li>
            </ol>
          </div>
          
          <div class="info-section">
            <h3><i class="fas fa-shield-alt"></i> Your Privacy Safeguards</h3>
            <ul>
              <li><strong>Single-purpose collection:</strong> Only for attendance verification</li>
              <li><strong>Automatic expiration:</strong> Access revokes after 24 inactive hours</li>
              <li><strong>No background tracking:</strong> Only active during check-in</li>
              <li><strong>Immediate control:</strong> Disable anytime with one tap</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    
    // Add permissions styles if not already present
    if (!document.getElementById('permissions-styles')) {
      const style = document.createElement('style');
      style.id = 'permissions-styles';
      style.textContent = `
        .permissions-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .permissions-header {
          margin-bottom: 24px;
        }
        .permissions-header h2 {
          margin: 0 0 8px 0;
          color: #2d3748;
        }
        .permissions-header p {
          margin: 0;
          color: #718096;
        }
        .permission-status {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          background: #f8f9fa;
        }
        .permission-status.granted {
          border-left: 4px solid #48bb78;
        }
        .permission-status.denied {
          border-left: 4px solid #f56565;
        }
        .permission-status.not-granted {
          border-left: 4px solid #ed8936;
        }
        .status-icon {
          font-size: 32px;
        }
        .permission-status.granted .status-icon {
          color: #48bb78;
        }
        .permission-status.denied .status-icon {
          color: #f56565;
        }
        .permission-status.not-granted .status-icon {
          color: #ed8936;
        }
        .status-details h3 {
          margin: 0 0 4px 0;
          color: #2d3748;
        }
        .status-details p {
          margin: 0;
          color: #718096;
        }
        .time-remaining {
          margin-top: 8px;
          font-size: 14px;
          color: #4299e1;
        }
        .permission-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }
        .auto-checkin-toggle {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
          margin-bottom: 24px;
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
          background-color: #48bb78;
        }
        input:checked + .slider:before {
          transform: translateX(24px);
        }
        .toggle-label h4 {
          margin: 0 0 4px 0;
          color: #2d3748;
        }
        .toggle-label p {
          margin: 0;
          font-size: 14px;
          color: #718096;
        }
        .permission-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .info-section {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 20px;
        }
        .info-section h3 {
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #2d3748;
        }
        .info-section ol, .info-section ul {
          padding-left: 20px;
          margin: 0;
        }
        .info-section li {
          margin-bottom: 8px;
        }
        @media (max-width: 768px) {
          .permission-info {
            grid-template-columns: 1fr;
          }
          .permission-actions {
            flex-direction: column;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set up event listeners
    const enableBtn = document.getElementById('enable-location-btn');
    if (enableBtn) {
      enableBtn.addEventListener('click', async () => {
        try {
          await this.requestLocationPermission();
          this.renderPermissionsContent();
        } catch (error) {
          this.showError(error.message);
        }
      });
    }
    
    const disableBtn = document.getElementById('disable-location-btn');
    if (disableBtn) {
      disableBtn.addEventListener('click', () => {
        this.locationPermission.status = 'not-granted';
        this.locationPermission.autoCheckIn = false;
        localStorage.setItem('autoCheckInPref', 'false');
        this.clearActivityWindow();
        this.renderPermissionsContent();
        this.showToast('Location access disabled', 'success');
      });
    }
    
    const extendBtn = document.getElementById('extend-location-btn');
    if (extendBtn) {
      extendBtn.addEventListener('click', () => {
        this.extendActivityWindow();
        this.renderPermissionsContent();
        this.showToast('Location access window extended', 'success');
      });
    }
    
    const autoCheckInToggle = document.getElementById('auto-checkin-toggle');
    if (autoCheckInToggle) {
      autoCheckInToggle.addEventListener('change', (e) => {
        this.locationPermission.autoCheckIn = e.target.checked;
        localStorage.setItem('autoCheckInPref', e.target.checked.toString());
        this.showToast(`Auto check-in ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
        
        // If enabling, check immediately
        if (e.target.checked && this.locationPermission.status === 'granted') {
          this.checkForAutoCheckIn();
        }
      });
    }
  }
  
  // Get status icon based on permission state
  getStatusIcon(status) {
    switch (status) {
      case 'granted':
        return '<i class="fas fa-check-circle"></i>';
      case 'denied':
        return '<i class="fas fa-times-circle"></i>';
      default:
        return '<i class="fas fa-question-circle"></i>';
    }
  }
  
  // Get status title based on permission state
  getStatusTitle(status) {
    switch (status) {
      case 'granted':
        return 'Access Granted';
      case 'denied':
        return 'Access Denied';
      default:
        return 'Access Not Granted';
    }
  }
  
  // Get status description based on permission state
  getStatusDescription(status) {
    switch (status) {
      case 'granted':
        return 'Location access is currently enabled for attendance verification.';
      case 'denied':
        return 'Location access is currently disabled. You won\'t be able to check in to classes.';
      default:
        return 'Location access hasn\'t been requested yet. It will be requested when needed.';
    }
  }
  
  // Render account content
  renderAccountContent() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
      <div class="account-container">
        <div class="account-section">
          <h2>Personal Information</h2>
          <div class="input-group">
            <label for="account-name">Full Name</label>
            <input type="text" id="account-name" value="${this.currentUser.displayName || ''}" maxlength="100">
          </div>
          <div class="input-group">
            <label for="account-email">Email</label>
            <input type="email" id="account-email" value="${this.currentUser.email}" disabled>
          </div>
          <button class="button button-primary" id="save-account-btn">Save Changes</button>
        </div>
        
        <div class="account-section">
          <h2>Security</h2>
          <p>Update your password to keep your account secure. Recommended if you suspect unauthorized access.</p>
          <button class="button button-secondary" id="change-password-btn">Change Password</button>
        </div>
        
        <div class="account-section danger-zone">
          <h2>Danger Zone</h2>
          <p>Deleting your account will permanently remove all your data from our systems.</p>
          <button class="button button-danger" id="delete-account-btn">Delete Account</button>
        </div>
      </div>
    `;
    
    // Add account styles if not already present
    if (!document.getElementById('account-styles')) {
      const style = document.createElement('style');
      style.id = 'account-styles';
      style.textContent = `
        .account-container {
          max-width: 600px;
          margin: 0 auto;
        }
        .account-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .account-section h2 {
          margin: 0 0 16px 0;
          color: #2d3748;
        }
        .account-section p {
          margin: 0 0 16px 0;
          color: #718096;
        }
        .danger-zone {
          border-left: 4px solid #f56565;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set up event listeners
    document.getElementById('save-account-btn').addEventListener('click', async () => {
      const newName = document.getElementById('account-name').value.trim();
      
      if (!newName) {
        this.showError('Please enter your name');
        return;
      }
      
      try {
        this.showLoading('Updating account...');
        await this.currentUser.updateProfile({
          displayName: newName
        });
        
        await this.db.collection('users').doc(this.currentUser.uid).update({
          fullName: newName
        });
        
        this.hideLoading();
        this.showSuccess('Account updated successfully');
      } catch (error) {
        this.hideLoading();
        this.showError(error.message || 'Failed to update account');
      }
    });
    
    document.getElementById('change-password-btn').addEventListener('click', () => {
      this.showChangePasswordModal();
    });
    
    document.getElementById('delete-account-btn').addEventListener('click', () => {
      this.showDeleteAccountModal();
    });
  }
  
  // Show create section modal
  showCreateSectionModal() {
    this.showModal({
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
      buttons: [
        {
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
              this.showError('Please fill all fields');
              return false;
            }
            
            try {
              this.showLoading('Creating section...');
              
              // Request location permission if not already granted
              await this.requestLocationPermission('session');
              
              // Get teacher's current location
              const position = await this.getCurrentPosition();
              
              // Create section in Firestore
              const sectionRef = await this.db.collection('sections').add({
                name,
                subject,
                schedule,
                checkInRange: range,
                teacherId: this.currentUser.uid,
                teacherName: this.currentUser.displayName || 'Teacher',
                teacherLocation: new firebase.firestore.GeoPoint(position.coords.latitude, position.coords.longitude),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                students: []
              });
              
              // Update local state
              this.sections.push({
                id: sectionRef.id,
                name,
                subject,
                schedule,
                checkInRange: range,
                teacherId: this.currentUser.uid
              });
              
              this.hideLoading();
              this.showSuccess('Section created successfully');
              this.renderContent('sections');
              return true;
            } catch (error) {
              this.hideLoading();
              this.showError(error.message || 'Failed to create section');
              return false;
            }
          }
        }
      ]
    });
  }
  
  // Show edit section modal
  showEditSectionModal(section) {
    this.showModal({
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
      buttons: [
        {
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
              this.showError('Please fill all fields');
              return false;
            }
            
            try {
              this.showLoading('Updating section...');
              
              await this.db.collection('sections').doc(section.id).update({
                name,
                subject,
                schedule,
                checkInRange: range
              });
              
              // Update local state
              const sectionIndex = this.sections.findIndex(s => s.id === section.id);
              if (sectionIndex !== -1) {
                this.sections[sectionIndex] = {
                  ...this.sections[sectionIndex],
                  name,
                  subject,
                  schedule,
                  checkInRange: range
                };
              }
              
              this.hideLoading();
              this.showSuccess('Section updated successfully');
              this.renderContent('sections');
              return true;
            } catch (error) {
              this.hideLoading();
              this.showError(error.message || 'Failed to update section');
              return false;
            }
          }
        }
      ]
    });
  }
  
  // Show delete section modal
  showDeleteSectionModal(section) {
    this.showModal({
      title: `Delete Section - ${section.name}`,
      body: `
        <p>Are you sure you want to delete this section? This action cannot be undone.</p>
        <p class="mb-4">All attendance records for this section will be preserved, but students will no longer be able to check in.</p>
        
        <div class="input-group">
          <label for="delete-confirm">Type "DELETE" to confirm</label>
          <input type="text" id="delete-confirm" required>
        </div>
      `,
      buttons: [
        {
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
              this.showError('Please type "DELETE" to confirm');
              return false;
            }
            
            try {
              this.showLoading('Deleting section...');
              
              // First remove all students from this section
              const studentsSnapshot = await this.db.collection('users')
                .where('sections', 'array-contains', section.id)
                .get();
              
              const batch = this.db.batch();
              studentsSnapshot.forEach(doc => {
                const studentRef = this.db.collection('users').doc(doc.id);
                batch.update(studentRef, {
                  sections: firebase.firestore.FieldValue.arrayRemove(section.id)
                });
              });
              
              await batch.commit();
              
              // Then delete the section
              await this.db.collection('sections').doc(section.id).delete();
              
              // Update local state
              this.sections = this.sections.filter(s => s.id !== section.id);
              
              this.hideLoading();
              this.showSuccess('Section deleted successfully');
              this.renderContent('sections');
              return true;
            } catch (error) {
              this.hideLoading();
              this.showError(error.message || 'Failed to delete section');
              return false;
            }
          }
        }
      ]
    });
  }
  
  // Show start session modal
  showStartSessionModal(section) {
    this.showModal({
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
      buttons: [
        {
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
              this.showError('Please enter a valid duration');
              return false;
            }
            
            try {
              this.showLoading('Starting session...');
              
              // Request location permission if not already granted
              await this.requestLocationPermission('session');
              
              // Get teacher's current location
              const position = await this.getCurrentPosition();
              
              // Create session in Firestore
              const sessionRef = await this.db.collection('sessions').add({
                sectionId: section.id,
                teacherId: this.currentUser.uid,
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
              this.activeSession = {
                id: sessionRef.id,
                sectionId: section.id,
                startTime: new Date(),
                duration,
                autoEnd,
                status: 'active'
              };
              
              this.hideLoading();
              this.showSuccess('Attendance session started');
              this.renderDashboardContent();
              
              // If auto-end is enabled, set timeout to end session
              if (autoEnd) {
                setTimeout(() => {
                  this.endSession(sessionRef.id);
                }, duration * 60 * 1000);
              }
              
              return true;
            } catch (error) {
              this.hideLoading();
              this.showError(error.message || 'Failed to start session');
              return false;
            }
          }
        }
      ]
    });
  }
  
  // End an active session
  async endSession(sessionId) {
    try {
      await this.db.collection('sessions').doc(sessionId).update({
        status: 'ended',
        endTime: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      this.activeSession = null;
      this.renderDashboardContent();
      this.showSuccess('Attendance session ended');
    } catch (error) {
      this.showError('Failed to end session: ' + error.message);
    }
  }
  
  // Show invite students modal
  showInviteStudentsModal(section) {
    const inviteLink = `${window.location.origin}${window.location.pathname}?sectionid=${section.id}`;
    const qr = qrcode(0, 'L');
    qr.addData(inviteLink);
    qr.make();
    const qrSvg = qr.createSvgTag(4);
    
    this.showModal({
      title: `Invite Students - ${section.name}`,
      body: `
        <div class="qr-code-container">
          <div class="qr-code">${qrSvg}</div>
          <p>Scan this QR code to join</p>
        </div>
        
        <div class="input-group mt-4">
          <label for="invite-link">Invitation Link</label>
          <div class="input-with-button">
            <input type="text" id="invite-link" value="${inviteLink}" readonly>
            <button class="button button-secondary" id="copy-link-btn">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </div>
        
        <div class="input-group">
          <label for="section-id">Section ID</label>
          <div class="input-with-button">
            <input type="text" id="section-id" value="${section.id}" readonly>
            <button class="button button-secondary" id="copy-id-btn">
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
          this.showToast('Link copied to clipboard', 'success');
        });
        
        modal.querySelector('#copy-id-btn').addEventListener('click', () => {
          const idInput = document.getElementById('section-id');
          idInput.select();
          document.execCommand('copy');
          this.showToast('Section ID copied to clipboard', 'success');
        });
      }
    });
  }
  
  // Show manage students modal
  showManageStudentsModal(section) {
    this.showModal({
      title: `Manage Students - ${section.name}`,
      body: `
        <div class="students-table-container">
          <table class="students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="students-list">
              <tr>
                <td colspan="3" class="loading-message">Loading students...</td>
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
          const querySnapshot = await this.db.collection('users')
            .where('sections', 'array-contains', section.id)
            .where('role', '==', 'student')
            .get();
          
          studentsList.innerHTML = '';
          
          if (querySnapshot.empty) {
            studentsList.innerHTML = `
              <tr>
                <td colspan="3" class="empty-message">No students found in this section</td>
              </tr>
            `;
            return;
          }
          
          querySnapshot.forEach((doc) => {
            const student = doc.data();
            studentsList.innerHTML += `
              <tr>
                <td>
                  <div class="student-info">
                    <div class="student-avatar">
                      ${student.fullName ? student.fullName.charAt(0) : 'S'}
                    </div>
                    <div>
                      <div class="student-name">${student.fullName || 'Student'}</div>
                      <div class="student-email">${student.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="status-badge">Active</span>
                </td>
                <td>
                  <button class="button button-danger remove-btn" data-student-id="${doc.id}">
                    Remove
                  </button>
                </td>
              </tr>
            `;
          });
          
          // Set up event listeners for remove buttons
          modal.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const studentId = e.target.getAttribute('data-student-id');
              if (confirm('Are you sure you want to remove this student from the section?')) {
                try {
                  this.showLoading('Removing student...');
                  
                  await this.db.collection('users').doc(studentId).update({
                    sections: firebase.firestore.FieldValue.arrayRemove(section.id)
                  });
                  
                  this.showManageStudentsModal(section);
                  this.hideLoading();
                  this.showSuccess('Student removed from section');
                } catch (error) {
                  this.hideLoading();
                  this.showError('Failed to remove student: ' + error.message);
                }
              }
            });
          });
        } catch (error) {
          studentsList.innerHTML = `
            <tr>
              <td colspan="3" class="error-message">Error loading students: ${error.message}</td>
            </tr>
          `;
        }
      }
    });
  }
  
  // Show student details modal
  showStudentDetailsModal(student) {
    this.showModal({
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
                  const section = this.sections.find(s => s.id === sectionId);
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
      `,
      buttons: [{
        text: 'Close',
        class: 'button-primary',
        action: 'close'
      }]
    });
  }
  
  // Show export reports modal
  showExportReportsModal() {
    this.showModal({
      title: 'Export Attendance Data',
      body: `
        <div class="export-options">
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
            <div class="date-range-inputs">
              <div class="input-group">
                <label for="export-start-date">Start Date</label>
                <input type="date" id="export-start-date">
              </div>
              <div class="input-group">
                <label for="export-end-date">End Date</label>
                <input type="date" id="export-end-date">
              </div>
            </div>
          </div>
          
          <div class="input-group">
            <label for="export-section">Section</label>
            <select id="export-section">
              <option value="all">All Sections</option>
              ${this.sections.map(section => `
                <option value="${section.id}">${section.name}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="input-group">
            <label for="export-email">Email for PDF (optional)</label>
            <input type="email" id="export-email" placeholder="Enter email to receive PDF">
          </div>
        </div>
      `,
      buttons: [
        {
          text: 'Cancel',
          class: 'button-secondary',
          action: 'close'
        },
        {
          text: 'Export Data',
          class: 'button-primary',
          action: async () => {
            const format = document.getElementById('export-format').value;
            const timeFilter = document.getElementById('export-time-range').value;
            const sectionId = document.getElementById('export-section').value;
            const email = document.getElementById('export-email').value.trim();
            
            let startDate, endDate = new Date();
            
            if (timeFilter === 'custom') {
              const startDateStr = document.getElementById('export-start-date').value;
              const endDateStr = document.getElementById('export-end-date').value;
              
              if (!startDateStr || !endDateStr) {
                this.showError('Please select both start and end dates');
                return false;
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
            
            try {
              this.showLoading('Preparing export...');
              
              // Fetch attendance data
              let query = this.db.collection('attendance')
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
                this.exportToCSV(attendanceData, `attendance_${new Date().toISOString().split('T')[0]}.csv`);
              } else if (format === 'pdf' && email) {
                await this.sendPDFByEmail(attendanceData, email);
              } else if (format === 'pdf') {
                this.exportToPDF(attendanceData);
              }
              
              this.hideLoading();
              this.showSuccess('Export completed successfully');
              return true;
            } catch (error) {
              this.hideLoading();
              this.showError('Failed to export data: ' + error.message);
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
  
  // Export data to CSV
  exportToCSV(data, filename) {
    if (!data.length) {
      this.showError('No data to export');
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
  
  // Export data to PDF (mock implementation)
  exportToPDF(data) {
    this.showModal({
      title: 'PDF Export',
      body: `
        <p>For PDF export, please provide an email address where we can send the report.</p>
        <p>Alternatively, you can use the print function in your browser:</p>
        
        <div class="print-option">
          <button class="button button-primary" id="print-report-btn">
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
  
  // Send PDF by email (mock implementation)
  async sendPDFByEmail(data, email) {
    try {
      // In a real implementation, you would call a cloud function or API to generate and send the PDF
      this.showSuccess(`PDF will be sent to ${email}. (Mock implementation)`);
      return true;
    } catch (error) {
      this.showError('Failed to send PDF: ' + error.message);
      return false;
    }
  }
  
  // Export students list
  exportStudentsList() {
    if (!this.students.length) {
      this.showError('No students to export');
      return;
    }
    
    const data = this.students.map(student => ({
      name: student.fullName || '',
      email: student.email || '',
      sections: student.sections ? student.sections.length : 0
    }));
    
    this.exportToCSV(data, `students_${new Date().toISOString().split('T')[0]}.csv`);
  }
  
  // Show change password modal
  showChangePasswordModal() {
    this.showModal({
      title: 'Change Password',
      body: `
        <form id="change-password-form">
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
        </form>
      `,
      buttons: [
        {
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
              this.showError('Please fill all fields');
              return false;
            }
            
            if (newPassword !== confirmNewPassword) {
              this.showError('New passwords do not match');
              return false;
            }
            
            if (newPassword.length < 6) {
              this.showError('Password must be at least 6 characters');
              return false;
            }
            
            try {
              this.showLoading('Changing password...');
              
              const credential = firebase.auth.EmailAuthProvider.credential(
                this.currentUser.email,
                currentPassword
              );
              
              await this.currentUser.reauthenticateWithCredential(credential);
              await this.currentUser.updatePassword(newPassword);
              
              this.hideLoading();
              this.showSuccess('Password changed successfully');
              return true;
            } catch (error) {
              this.hideLoading();
              if (error.code === 'auth/wrong-password') {
                this.showError('Current password is incorrect');
              } else {
                this.showError(error.message || 'Failed to change password');
              }
              return false;
            }
          }
        }
      ]
    });
  }
  
  // Show delete account modal
  showDeleteAccountModal() {
    this.showModal({
      title: 'Delete Account',
      body: `
        <div class="delete-account-warning">
          <p>Are you sure you want to delete your account? This action cannot be undone.</p>
          <p>All your data will be permanently removed from our systems.</p>
        </div>
        
        <div class="input-group">
          <label for="delete-password">Enter your password to confirm</label>
          <input type="password" id="delete-password" required>
        </div>
      `,
      buttons: [
        {
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
              this.showError('Please enter your password');
              return false;
            }
            
            try {
              this.showLoading('Deleting account...');
              
              const credential = firebase.auth.EmailAuthProvider.credential(
                this.currentUser.email,
                password
              );
              
              await this.currentUser.reauthenticateWithCredential(credential);
              
              // First delete user data from Firestore
              await this.db.collection('users').doc(this.currentUser.uid).delete();
              
              // Then delete the auth account
              await this.currentUser.delete();
              
              this.hideLoading();
              this.showSuccess('Account deleted successfully');
              return true;
            } catch (error) {
              this.hideLoading();
              if (error.code === 'auth/wrong-password') {
                this.showError('Incorrect password');
              } else {
                this.showError(error.message || 'Failed to delete account');
              }
              return false;
            }
          }
        }
      ]
    });
  }
  
  // Show forgot password modal
  showForgotPasswordModal() {
    this.showModal({
      title: 'Reset Password',
      body: `
        <div class="forgot-password-info">
          <p>Enter your email address and we'll send you a link to reset your password.</p>
        </div>
        
        <div class="input-group">
          <label for="reset-email">Email</label>
          <input type="email" id="reset-email" required>
        </div>
      `,
      buttons: [
        {
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
              this.showError('Please enter your email address');
              return false;
            }
            
            try {
              this.showLoading('Sending reset link...');
              await this.auth.sendPasswordResetEmail(email);
              this.hideLoading();
              this.showSuccess('Password reset link sent to your email');
              return true;
            } catch (error) {
              this.hideLoading();
              if (error.code === 'auth/user-not-found') {
                this.showError('No account found with this email');
              } else {
                this.showError(error.message || 'Failed to send reset link');
              }
              return false;
            }
          }
        }
      ]
    });
  }
  
  // Handle student check-in
  async handleStudentCheckIn(section) {
    try {
      this.showLoading('Preparing check-in...');
      
      // Check if there's an active session for this section
      const sessionsSnapshot = await this.db.collection('sessions')
        .where('sectionId', '==', section.id)
        .where('status', '==', 'active')
        .get();
      
      if (sessionsSnapshot.empty) {
        throw new Error('No active session found for this section');
      }
      
      const session = sessionsSnapshot.docs[0].data();
      const sessionId = sessionsSnapshot.docs[0].id;
      
      // Check if student already checked in
      if (session.attendees && session.attendees.includes(this.currentUser.uid)) {
        throw new Error('You have already checked in to this session');
      }
      
      // Get student's current location if required
      let studentLocation = null;
      let distance = 0;
      
      if (session.requireLocation) {
        // Request location permission with context
        await this.requestLocationPermission('check-in');
        
        const position = await this.getCurrentPosition();
        studentLocation = new firebase.firestore.GeoPoint(position.coords.latitude, position.coords.longitude);
        
        // Calculate distance between teacher and student
        distance = this.calculateDistance(
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
      await this.db.collection('attendance').add({
        sessionId,
        sectionId: section.id,
        studentId: this.currentUser.uid,
        studentName: this.currentUser.displayName || 'Student',
        checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
        location: studentLocation,
        distance,
        status: 'present',
        deviceInfo: navigator.userAgent
      });
      
      // Add to session attendees
      await this.db.collection('sessions').doc(sessionId).update({
        attendees: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid)
      });
      
      this.hideLoading();
      this.showSuccess('Checked in successfully!');
    } catch (error) {
      this.hideLoading();
      this.showError(error.message);
    }
  }
  
  // Get current position with validation
  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Additional validation for Philippines only
          if (this.security.countryRestriction && 
              (position.coords.latitude < 4 || position.coords.latitude > 21 ||
               position.coords.longitude < 116 || position.coords.longitude > 127)) {
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
  
  // Calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
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
  
  // Show modal dialog
  showModal(options) {
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
    
    // Add modal styles if not already present
    if (!document.getElementById('modal-styles')) {
      const style = document.createElement('style');
      style.id = 'modal-styles';
      style.textContent = `
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          opacity: 0;
          animation: fadeIn 0.3s forwards;
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        .modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          transform: translateY(20px);
          animation: slideUp 0.3s forwards;
        }
        @keyframes slideUp {
          to { transform: translateY(0); }
        }
        .modal-header {
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
          position: relative;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          color: #2d3748;
        }
        .close-button {
          position: absolute;
          top: 20px;
          right: 20px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #718096;
        }
        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }
        .modal-footer {
          padding: 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .input-with-button {
          display: flex;
          gap: 8px;
        }
        .input-with-button input {
          flex: 1;
        }
        .qr-code-container {
          text-align: center;
          margin-bottom: 16px;
        }
        .qr-code svg {
          max-width: 200px;
          margin: 0 auto;
        }
        .students-table-container {
          max-height: 400px;
          overflow-y: auto;
        }
        .students-table {
          width: 100%;
          border-collapse: collapse;
        }
        .students-table th {
          text-align: left;
          padding: 12px;
          background: #f8f9fa;
          position: sticky;
          top: 0;
        }
        .students-table td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        .loading-message, .empty-message, .error-message {
          text-align: center;
          padding: 20px;
        }
        .error-message {
          color: #e53e3e;
        }
        .student-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .student-avatar {
          width: 32px;
          height: 32px;
          background: #4299e1;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        .student-name {
          font-weight: 500;
        }
        .student-email {
          font-size: 12px;
          color: #718096;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          background: #48bb78;
          color: white;
          border-radius: 4px;
          font-size: 12px;
        }
        .remove-btn {
          padding: 6px 12px;
          font-size: 14px;
        }
        .delete-account-warning {
          margin-bottom: 16px;
        }
        .delete-account-warning p {
          margin: 0 0 8px 0;
        }
        .forgot-password-info {
          margin-bottom: 16px;
        }
        .forgot-password-info p {
          margin: 0 0 8px 0;
        }
      `;
      document.head.appendChild(style);
    }
    
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
      modal.style.animation = 'fadeOut 0.3s forwards';
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
  
  // Show loading indicator
  showLoading(message = 'Loading...') {
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
      loading.style.backdropFilter = 'blur(4px)';
      
      loading.innerHTML = `
        <div style="text-align: center;">
          <div class="spinner" style="width: 40px; height: 40px; border: 4px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: white; animation: spin 1s ease-in-out infinite; margin: 0 auto 16px;"></div>
          <p>${message}</p>
        </div>
      `;
      
      document.body.appendChild(loading);
      
      // Add spinner animation if not already present
      if (!document.getElementById('spinner-animation')) {
        const style = document.createElement('style');
        style.id = 'spinner-animation';
        style.textContent = `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      loading.querySelector('p').textContent = message;
      loading.style.display = 'flex';
    }
  }
  
  // Hide loading indicator
  hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      loading.style.display = 'none';
    }
  }
  
  // Show error message
  showError(message) {
    this.showToast(message, 'error');
  }
  
  // Show success message
  showSuccess(message) {
    this.showToast(message, 'success');
  }
  
   // Show toast notification
  showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast-message').forEach(el => el.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = this.getToastColor(type);
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    toast.style.zIndex = '1000';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.maxWidth = '90%';
    toast.style.textAlign = 'center';
    
    // Add icon based on type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-exclamation-circle"></i>';
        break;
      case 'warning':
        icon = '<i class="fas fa-exclamation-triangle"></i>';
        break;
      default:
        icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon} ${message}`;
    
    document.body.appendChild(toast);
    
    // Add animation
    toast.style.animation = 'toastIn 0.3s forwards';
    
    // Remove after delay
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s forwards';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
    
    // Add toast styles if not already present
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(20px); }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Get toast color based on type
  getToastColor(type) {
    switch (type) {
      case 'success':
        return '#48bb78';
      case 'error':
        return '#f56565';
      case 'warning':
        return '#ed8936';
      default:
        return '#4299e1';
    }
  }
  
  // Show privacy policy
  showPrivacyPolicy() {
    this.showModal({
      title: 'Privacy Policy',
      body: `
        <div class="privacy-policy-content">
          <h3>NearCheck Lite Privacy Policy</h3>
          <p>Last Updated: ${new Date().toLocaleDateString()}</p>
          
          <h4>1. Information We Collect</h4>
          <p>We collect the following information when you use NearCheck Lite:</p>
          <ul>
            <li>Account information (name, email, role)</li>
            <li>Class section information (for teachers)</li>
            <li>Attendance records (for students)</li>
            <li>Location data (only during active check-in sessions)</li>
            <li>Device information (browser type, IP address)</li>
          </ul>
          
          <h4>2. How We Use Your Information</h4>
          <p>We use the collected information to:</p>
          <ul>
            <li>Provide and maintain the service</li>
            <li>Verify attendance through location data</li>
            <li>Generate attendance reports</li>
            <li>Improve our services</li>
            <li>Communicate with users</li>
          </ul>
          
          <h4>3. Location Data</h4>
          <p>Location data is:</p>
          <ul>
            <li>Only collected during active check-in sessions</li>
            <li>Used solely for attendance verification</li>
            <li>Not stored permanently (only the verification result is kept)</li>
            <li>Never shared with third parties</li>
          </ul>
          
          <h4>4. Data Security</h4>
          <p>We implement appropriate security measures to protect your data:</p>
          <ul>
            <li>Encryption of sensitive data</li>
            <li>Secure server infrastructure</li>
            <li>Regular security audits</li>
            <li>Limited access to personal data</li>
          </ul>
          
          <h4>5. Your Rights</h4>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for data processing</li>
          </ul>
          
          <p>For any privacy-related inquiries, please contact us at privacy@nearcheck.com</p>
        </div>
      `,
      buttons: [{
        text: 'Close',
        class: 'button-primary',
        action: 'close'
      }]
    });
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if Firebase is already loaded
  if (typeof firebase === 'undefined') {
    // Load Firebase SDKs
    const firebaseScripts = [
      'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
      'https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js',
      'https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore.js',
      'https://www.gstatic.com/firebasejs/8.10.0/firebase-storage.js'
    ];
    
    let loaded = 0;
    
    firebaseScripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loaded++;
        if (loaded === firebaseScripts.length) {
          new NearCheckApp();
        }
      };
      document.head.appendChild(script);
    });
  } else {
    new NearCheckApp();
  }
});
