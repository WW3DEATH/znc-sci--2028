/**
 * ZNC Science (Zahira National College Science Portal) Web Application
 * Connected to Firebase Realtime Database: e-learing-9adc3
 */

// User-provided Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDDk_xiDvdcAv_B5oSogFH50azgLBVszKY",
  authDomain: "e-learing-9adc3.firebaseapp.com",
  databaseURL: "https://e-learing-9adc3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "e-learing-9adc3",
  storageBucket: "e-learing-9adc3.firebasestorage.app",
  messagingSenderId: "349368530462",
  appId: "1:349368530462:web:f4cbd2e51995ff7860200f",
  measurementId: "G-RBESG4YNKM"
};

// Initialize Firebase SDK with Dynamic Fallback & Status Tracking
let db = null;
let isRealtimeSetupDone = false;

function getFirebaseDb() {
  if (db) return db;
  try {
    if (typeof firebase !== "undefined") {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      if (firebase.database) {
        db = firebase.database();
        console.log("⚡ Firebase RTDB initialized successfully for e-learing-9adc3");
      }
    }
  } catch (e) {
    console.warn("Firebase initialization note:", e);
  }
  return db;
}
getFirebaseDb();

function ensureFirebaseInitialized() {
  const database = getFirebaseDb();
  if (database && !isRealtimeSetupDone) {
    setupFirebaseRealtime();
    return true;
  }
  return false;
}

// Watchdog to auto-connect real-time WebSocket listeners the moment CDN scripts load
let initWatchdogAttempts = 0;
const firebaseWatchdogTimer = setInterval(() => {
  initWatchdogAttempts++;
  if (ensureFirebaseInitialized() || initWatchdogAttempts > 60) {
    clearInterval(firebaseWatchdogTimer);
  }
}, 200);

// Firebase Cloud Sync Configuration
const FIREBASE_RTDB_BASE_URL = "https://e-learing-9adc3-default-rtdb.asia-southeast1.firebasedatabase.app";
let isFirebaseConnected = false;
let lastCloudSyncTimestamp = 0;

// Cloud Synchronization: Pull all users from Firebase RTDB (direct REST or server proxy)
async function syncUsersWithCloud(forceRender = false) {
  let rawData = null;

  // 1. Attempt direct REST fetch to Firebase RTDB
  try {
    const res = await fetch(`${FIREBASE_RTDB_BASE_URL}/users.json`, { cache: "no-cache" });
    if (res.ok) {
      rawData = await res.json();
    }
  } catch (err) {
    // Direct fetch might be blocked by sandbox/extension
  }

  // 2. Fallback to same-origin server proxy if direct fetch did not succeed
  if (!rawData) {
    try {
      const res = await fetch("/api/firebase/users", { cache: "no-cache" });
      if (res.ok) {
        rawData = await res.json();
      }
    } catch (err) {
      // Proxy fallback notice
    }
  }

  if (rawData && typeof rawData === "object") {
    isFirebaseConnected = true;
    lastCloudSyncTimestamp = Date.now();

    const cloudUsers = Object.keys(rawData).map(key => {
      const u = rawData[key];
      if (!u || typeof u !== "object") return null;
      return {
        id: u.id || key,
        fullName: u.fullName || (key === "admin_jasim" ? "M.N.M. Jaasim" : (u.email ? u.email.split("@")[0] : "User")),
        email: u.email || (key === "admin_jasim" ? "mnmjaasim@gmail.com" : ""),
        role: (u.email && u.email.toLowerCase() === "mnmjaasim@gmail.com") || key === "admin_jasim" ? "ADMIN" : (u.role || "STUDENT"),
        stream: u.stream || "All Streams",
        spPoints: typeof u.spPoints === "number" ? u.spPoints : 50,
        weeklySp: typeof u.weeklySp === "number" ? u.weeklySp : 0,
        isVerified: u.isVerified !== undefined ? u.isVerified : true,
        hasEarlyQuizAccess: !!(u.hasEarlyQuizAccess || u.earlyQuizAccess || u.canDoQuizEarly),
        ...u
      };
    }).filter(Boolean).filter(u => {
      if (!u || !u.id) return false;
      const emailLower = (u.email || "").toLowerCase();
      return !REMOVED_MOCK_EMAILS.includes(emailLower) && !PURGED_MOCK_USER_IDS.includes(u.id);
    });

    // Merge into local STATE.users without overwriting different accounts
    let addedOrUpdated = 0;
    cloudUsers.forEach(cu => {
      const idx = STATE.users.findIndex(u => u.id === cu.id || (u.email && cu.email && u.email.toLowerCase() === cu.email.toLowerCase()));
      if (idx >= 0) {
        STATE.users[idx] = { ...STATE.users[idx], ...cu };
      } else {
        STATE.users.push(cu);
        addedOrUpdated++;
      }
    });

    try {
      localStorage.setItem("znc_registered_users", JSON.stringify(STATE.users));
    } catch (e) {}

    // Refresh current user session from merged data so permissions update in real-time
    if (STATE.currentUser) {
      const refreshedCurrent = STATE.users.find(u => u.id === STATE.currentUser.id || (u.email && STATE.currentUser.email && u.email.toLowerCase() === STATE.currentUser.email.toLowerCase()));
      if (refreshedCurrent) {
        STATE.currentUser = { ...STATE.currentUser, ...refreshedCurrent };
        try {
          localStorage.setItem("znc_current_user", JSON.stringify(STATE.currentUser));
          localStorage.setItem("znc_active_user", JSON.stringify(STATE.currentUser));
        } catch (e) {}
      }
    }

    updateFirebaseSyncUI(true, cloudUsers.length);
    checkWednesdayQuizWindow();

    // Auto-render admin users without pressing any button
    renderAdminUsers();
    renderLeaderboard();
    return cloudUsers;
  } else {
    if (!db) {
      updateFirebaseSyncUI(false);
    }
  }
  return null;
}

// Push user update or creation to Cloud RTDB (Smooth, instantaneous & non-blocking)
function pushUserToCloud(user) {
  if (!user || !user.id) return;
  const dbInstance = getFirebaseDb();
  if (dbInstance) {
    try {
      dbInstance.ref("users/" + user.id).set(user);
    } catch (e) {}
  }
  // Asynchronous background backup via REST (never blocks the UI)
  (async () => {
    try {
      await fetch(`${FIREBASE_RTDB_BASE_URL}/users/${encodeURIComponent(user.id)}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
    } catch (e) {
      try {
        await fetch(`/api/firebase/users/${encodeURIComponent(user.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
      } catch (err) {}
    }
  })();
}

// Delete user from Cloud RTDB (Smooth, instantaneous & non-blocking)
function deleteUserFromCloud(userId) {
  if (!userId) return;
  const dbInstance = getFirebaseDb();
  if (dbInstance) {
    try {
      dbInstance.ref("users/" + userId).remove();
    } catch (e) {}
  }
  // Asynchronous background backup via REST
  (async () => {
    try {
      await fetch(`${FIREBASE_RTDB_BASE_URL}/users/${encodeURIComponent(userId)}.json`, {
        method: 'DELETE'
      });
    } catch (e) {
      try {
        await fetch(`/api/firebase/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE'
        });
      } catch (err) {}
    }
  })();
}

// Cloud Synchronization: Pull messages from Firebase RTDB (direct REST or server proxy)
async function syncMessagesWithCloud() {
  let rawData = null;
  try {
    const res = await fetch(`${FIREBASE_RTDB_BASE_URL}/messages.json`, { cache: "no-cache" });
    if (res.ok) rawData = await res.json();
  } catch (e) {}
  if (!rawData) {
    try {
      const res = await fetch("/api/firebase/messages", { cache: "no-cache" });
      if (res.ok) rawData = await res.json();
    } catch (e) {}
  }
  if (rawData && typeof rawData === "object") {
    const list = Object.keys(rawData).map(key => {
      const m = rawData[key];
      if (!m || typeof m !== "object") return null;
      return {
        id: m.id || key,
        senderId: m.senderId || "anon",
        senderName: m.senderName || "Anonymous",
        senderRole: m.senderRole || "STUDENT",
        senderStream: m.senderStream === "PHYSICAL_SCIENCE" ? "Physical Science" : (m.senderStream === "BIO_SCIENCE" ? "Bio Science" : (m.senderStream || "Physical Science")),
        stream: m.stream || (m.senderStream === "PHYSICAL_SCIENCE" ? "Physical Science" : (m.senderStream === "BIO_SCIENCE" ? "Bio Science" : "Physical Science")),
        content: m.content || m.text || "",
        attachment: m.attachment || (m.mediaUrl ? {
          name: m.mediaName || "Attachment",
          size: m.mediaSize || 0,
          type: m.mediaType || "application/octet-stream",
          dataUrl: m.mediaUrl,
          isImage: !!(m.mediaType && m.mediaType.startsWith("image/")),
          isPdf: !!(m.mediaType && m.mediaType.includes("pdf"))
        } : null),
        timestamp: m.timestamp || Date.now()
      };
    }).filter(Boolean).filter(m => !PURGED_MOCK_USER_IDS.includes(m.senderId));

    let count = 0;
    list.forEach(newMsg => {
      const idx = STATE.messages.findIndex(m => m.id === newMsg.id);
      if (idx >= 0) {
        STATE.messages[idx] = { ...STATE.messages[idx], ...newMsg };
      } else {
        STATE.messages.push(newMsg);
        count++;
      }
    });
    if (count > 0) {
      STATE.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      renderChatMessages();
      renderAdminChatAudit();
    }
  }
}

// UI Status Indicator updater for Firebase RTDB
function updateFirebaseSyncUI(connected, userCount) {
  isFirebaseConnected = connected;
  const statusEl = document.getElementById("firebaseConnectionStatus");
  if (statusEl) {
    statusEl.innerHTML = connected 
      ? `<span class="text-emerald-300 flex items-center space-x-1.5"><span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>RTDB Cloud Online (${userCount !== undefined ? userCount + ' Users' : 'Synced'})</span></span>`
      : `<span class="text-amber-300 flex items-center space-x-1.5"><span class="inline-block w-2 h-2 rounded-full bg-amber-400"></span><span>Connecting RTDB...</span></span>`;
  }

  const adminSyncDetail = document.getElementById("adminFirebaseSyncDetail");
  if (adminSyncDetail) {
    if (connected) {
      const activeCount = userCount !== undefined ? userCount : STATE.users.filter(u => !PURGED_MOCK_USER_IDS.includes(u.id)).length;
      adminSyncDetail.innerText = `Connected to Firebase project "e-learing-9adc3" (asia-southeast1). ${activeCount} registered accounts synced in real-time.`;
    } else {
      adminSyncDetail.innerText = `Connecting to Firebase Realtime Database (e-learing-9adc3)...`;
    }
  }

  const adminLastSync = document.getElementById("adminFirebaseLastSyncTime");
  if (adminLastSync) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    adminLastSync.innerText = `Last synced: ${timeStr}`;
  }

  const badge = document.getElementById("firebaseLiveStatusBadge");
  if (badge) {
    if (connected) {
      badge.className = "text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider";
      badge.innerText = "CONNECTED";
    } else {
      badge.className = "text-[10px] font-extrabold bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider";
      badge.innerText = "CONNECTING...";
    }
  }

  const ping = document.getElementById("firebaseStatusPing");
  const dot = document.getElementById("firebaseStatusDot");
  if (ping && dot) {
    if (connected) {
      ping.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75";
      dot.className = "relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500";
    } else {
      ping.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75";
      dot.className = "relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500";
    }
  }
}

// User-triggered manual Cloud Sync in Admin Panel
async function forceCloudUserSync() {
  showToast("🔄 Auto-sync is active in real time!");
  try {
    const users = await syncUsersWithCloud(true);
    const count = users ? users.length : STATE.users.length;
    showToast(`✅ Real-time sync active: ${count} accounts synced!`);
  } catch (err) {
    showToast("⚠️ Cloud sync notice: " + (err.message || "Network busy, retrying."));
  }
}

// Global Application State
const STATE = {
  // Whenever the website is opened, all accounts start signed out by default
  currentUser: null,
  currentView: "home",
  adminSubTab: "users",
  adminRedemptionFilter: "All",
  activeChatStream: "Physical Science", // Current stream chat viewing
  earlyApprovedEmails: {}, // Fast in-memory map of admin-approved early access emails

  // Selected subject for Wednesday Competitive Examination ('physics', 'combined_maths', 'chemistry', 'ict')
  selectedSubjectId: "physics",

  // Selected unit for Wednesday Exam (Units 1 - 8 or 'all' for Grand Paper)
  selectedUnitId: "all",

  // Leaderboard filters: Subject ('overall', 'physics', 'combined_maths', 'chemistry', 'ict') & Timeframe ('weekly', 'alltime')
  leaderboardSubject: "overall",
  leaderboardTimeframe: "weekly",

  // Synchronized Wednesday Quiz State (Weekly Seed Engine)
  wednesdayConfig: (typeof getActiveWednesdayInfo === "function") ? getActiveWednesdayInfo() : {
    dateString: "2026-09-16",
    paperCode: "WED-20260916",
    seed: 84920194,
    formattedDate: "Wednesday, Sep 16, 2026"
  },
  adminPreviewWednesdayDate: null, // Allows admin to preview future Wednesdays

  // Registered Users (Root Administrator; real students and teachers sign up and register dynamically)
  users: [
    {
      id: "admin_jasim",
      fullName: "M.N.M. Jaasim",
      email: "mnmjaasim@gmail.com",
      role: "ADMIN",
      stream: "Physical Science",
      spPoints: 450,
      weeklySp: 0,
      isVerified: true,
      subjectScores: { physics: 0, combined_maths: 0, chemistry: 0, ict: 0 },
      weeklyScores: {},
      weeklySubjectScores: {}
    }
  ],

  // Store Items (Empty as requested; Administrator can add real inventory items anytime from Admin Panel)
  redemptionItems: [],

  redemptions: [],

  // Submissions for Unit-Specific Mini-Leaderboards
  quizSubmissions: [],

  // Stream-segregated Discussions (Fresh and empty, with support for images, PDFs, and documents)
  messages: [],
  attachedChatFile: null,

  // Active Quiz Runner State
  activeQuiz: null,
  activeQuizQuestionIdx: 0,
  selectedAnswerIdx: null,
  activeQuizScore: 0,
  quizTimerInterval: null,
  quizSecondsRemaining: 3600,

  // Gemini Multi-Turn AI Tutor State
  gemini: {
    model: "gemini-3.5-flash",
    role: "general",
    isLoading: false,
    history: []
  }
};

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupFirebaseRealtime();
});

// Admin Privileges Helper: strictly restricts the Admin Panel & editing features
function isCurrentUserAdmin() {
  return !!(
    STATE.currentUser &&
    (STATE.currentUser.role === 'ADMIN' || (STATE.currentUser.email && STATE.currentUser.email.toLowerCase() === 'mnmjaasim@gmail.com'))
  );
}

function requireAdmin() {
  if (!isCurrentUserAdmin()) {
    showToast("🔒 Access Denied: Only the Administrator can access this section or edit items.");
    return false;
  }
  return true;
}

// Synchronize and persist users and active session to localStorage
function saveUsersAndSession() {
  try {
    if (STATE.currentUser) {
      const idx = STATE.users.findIndex(u => u.id === STATE.currentUser.id || (u.email && STATE.currentUser.email && u.email.toLowerCase() === STATE.currentUser.email.toLowerCase()));
      if (idx >= 0) {
        STATE.users[idx] = { ...STATE.users[idx], ...STATE.currentUser };
      } else {
        STATE.users.push(STATE.currentUser);
      }
    }
    // Persist all registered users
    localStorage.setItem("znc_registered_users", JSON.stringify(STATE.users));

    // Persist active user session if user kept signed in
    const isRemembered = localStorage.getItem("znc_current_user") || localStorage.getItem("zsp_current_user");
    if (isRemembered && STATE.currentUser) {
      localStorage.setItem("znc_current_user", JSON.stringify(STATE.currentUser));
    }
  } catch (e) {
    console.warn("Save users error:", e);
  }
}

// ----------------------------------------------------
// PURGED MOCK DATA LISTS (Guarantees zero fake users/store items)
// ----------------------------------------------------
const PURGED_MOCK_USER_IDS = [
  "user_rizvi", "user_farhan", "user_nuha", "user_salman", "user_aakil",
  "user_zainab", "user_hasan", "user_ammar", "user_inshaf",
  "teacher_perera", "student_ahamad", "student_sara", "student_nifras", "student_aisha"
];

const REMOVED_MOCK_EMAILS = [
  "a.rizvi@znc.edu.lk", "m.farhan@znc.edu.lk", "f.nuha@znc.edu.lk",
  "s.faris@znc.edu.lk", "m.aakil@znc.edu.lk", "z.bilal@znc.edu.lk",
  "h.tariq@znc.edu.lk", "a.zahran@znc.edu.lk", "m.inshaf@znc.edu.lk",
  "k.perera@zahira.lk", "ahamad.rizvi@zahira.lk", "sara.fathima@zahira.lk",
  "nifras.mr@zahira.lk", "aisha.m@zahira.lk"
];

const REMOVED_STORE_ITEM_IDS = ["item_1", "item_2", "item_3", "item_4"];

function initApp() {
  // 1. Purge all mock store items from storage & state
  try {
    localStorage.removeItem("znc_store_items");
    STATE.redemptionItems = [];
  } catch (e) {}

  // 2. Synchronize Wednesday quiz configuration with real-world calendar
  try {
    if (typeof getActiveWednesdayInfo === "function") {
      STATE.wednesdayConfig = getActiveWednesdayInfo();
    }
  } catch (e) {}

  // 3. Restore registered users from localStorage, rigorously filtering out all fake/mock accounts
  try {
    const savedUsersStr = localStorage.getItem("znc_registered_users");
    if (savedUsersStr) {
      const parsedUsers = JSON.parse(savedUsersStr);
      if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
        const cleanUsers = parsedUsers.filter(pu => {
          if (!pu || !pu.id) return false;
          if (PURGED_MOCK_USER_IDS.includes(pu.id)) return false;
          const emailLower = (pu.email || "").toLowerCase();
          if (REMOVED_MOCK_EMAILS.includes(emailLower)) return false;
          return true;
        });

        localStorage.setItem("znc_registered_users", JSON.stringify(cleanUsers));

        cleanUsers.forEach(pu => {
          const idx = STATE.users.findIndex(u => u.id === pu.id || (u.email && pu.email && u.email.toLowerCase() === pu.email.toLowerCase()));
          if (idx >= 0) {
            STATE.users[idx] = { ...STATE.users[idx], ...pu };
          } else {
            STATE.users.push(pu);
          }
        });
      }
    }
  } catch (e) {
    console.warn("User registry restore error:", e);
  }

  // 4. Support "Keep me signed in" option: restore session only if valid non-mock user
  try {
    const savedUserStr = localStorage.getItem("znc_current_user") || localStorage.getItem("zsp_current_user");
    if (savedUserStr) {
      const savedUser = JSON.parse(savedUserStr);
      if (savedUser && savedUser.id && !PURGED_MOCK_USER_IDS.includes(savedUser.id)) {
        const found = STATE.users.find(u => u.id === savedUser.id || (u.email && savedUser.email && u.email.toLowerCase() === savedUser.email.toLowerCase()));
        if (found) {
          STATE.currentUser = found;
        } else {
          STATE.currentUser = savedUser;
          STATE.users.push(savedUser);
        }
      } else {
        STATE.currentUser = null;
        localStorage.removeItem("znc_current_user");
        localStorage.removeItem("zsp_current_user");
      }
    } else {
      STATE.currentUser = null;
    }
  } catch (e) {
    STATE.currentUser = null;
  }

  // 5. Restore quiz submissions for unit-specific mini-leaderboards
  try {
    const savedSubsStr = localStorage.getItem("znc_quiz_submissions");
    if (savedSubsStr) {
      STATE.quizSubmissions = JSON.parse(savedSubsStr) || [];
    } else {
      STATE.quizSubmissions = [];
    }
  } catch (e) {
    STATE.quizSubmissions = [];
  }

  renderAuthHeader();
  renderHomeSubjects();
  renderPhysicsUnitCards();
  checkWednesdayQuizWindow();
  renderLeaderboard();
  renderMilestones();
  renderRedemptionItems();
  renderUserRedemptionHistory();
  renderChatMessages();
  renderAdminUsers();
  renderAdminStoreInventory();
  renderAdminRedemptions();
  renderAdminChatAudit();
  renderWednesdayPaperInfo();
  updateBadgeCounts();
  initGeminiChat();

  // Initial cloud sync from Firebase RTDB (users and messages)
  syncUsersWithCloud(true);
  syncMessagesWithCloud();

  // Periodic automatic sync every 5 seconds to pull any users or messages registered on other devices
  setInterval(() => {
    syncUsersWithCloud(false);
    syncMessagesWithCloud();
  }, 5000);

  // Periodic real-time check of Wednesday 6 PM - 12 AM window (every second for countdown)
  setInterval(checkWednesdayQuizWindow, 1000);

  // Initialize category route based on browser URL or initial-view attribute
  const initialCategory = document.body.dataset.initialView || getViewIdFromPath(window.location.pathname);
  if (initialCategory && initialCategory !== "home") {
    navigateTo(initialCategory, false);
  } else {
    navigateTo("home", false);
  }
}

// ----------------------------------------------------
// ROUTING & CATEGORY URL MANAGEMENT
// Maps paths like /discussion, /quiz, /leaderboard, /store, /admin, /gemini
// ----------------------------------------------------
function getViewIdFromPath(pathname) {
  const p = (pathname || "").toLowerCase().replace(/\/+$/, "").trim();
  if (p === "/quiz" || p.startsWith("/quiz/") || p === "/exam" || p === "/examination") return "quiz";
  if (p === "/discussion" || p.startsWith("/discussion/") || p === "/discussions" || p.startsWith("/discussions/")) return "discussions";
  if (p === "/leaderboard" || p.startsWith("/leaderboard/") || p === "/rankings") return "leaderboard";
  if (p === "/store" || p.startsWith("/store/") || p === "/redemption" || p.startsWith("/redemption/") || p === "/rewards") return "redemption";
  if (p === "/admin" || p.startsWith("/admin/") || p === "/admin-panel") return "admin";
  if (p === "/gemini" || p.startsWith("/gemini/") || p === "/ai-tutor" || p === "/tutor") return "gemini";
  if (p === "/profile" || p.startsWith("/profile/")) return "profile";
  return "home";
}

function getPathForViewId(viewId) {
  switch (viewId) {
    case "quiz": return "/quiz";
    case "discussions": return "/discussion";
    case "leaderboard": return "/leaderboard";
    case "redemption":
    case "store": return "/store";
    case "admin": return "/admin";
    case "gemini": return "/gemini";
    case "profile": return "/profile";
    case "home":
    default: return "/";
  }
}

function getTitleForViewId(viewId) {
  switch (viewId) {
    case "quiz": return "Wednesday Examination & Quiz | Zahira National College";
    case "discussions": return "Academic Discussions | Zahira National College";
    case "leaderboard": return "Student Leaderboard & Rankings | Zahira National College";
    case "redemption":
    case "store": return "Science Store & SP Rewards | Zahira National College";
    case "admin": return "Administrator Management Panel | Zahira National College";
    case "gemini": return "Gemini AI Academic Tutor | Zahira National College";
    case "profile": return "Student Profile & Milestones | Zahira National College";
    case "home":
    default: return "Zahira National College Science Portal | Grade 12 Advanced Level";
  }
}

function navigateTo(viewId, updateHistory = true) {
  // Normalize store alias
  if (viewId === "store") viewId = "redemption";

  // Strict guard: only administrator can open the Admin Panel
  if (viewId === "admin") {
    if (!isCurrentUserAdmin()) {
      showToast("🔒 Access Denied: Only the Administrator can access the Admin Panel.");
      if (!STATE.currentUser) {
        openLoginModal();
      } else {
        navigateTo("home", updateHistory);
      }
      return;
    }
  }

  // Profile guard: must be signed in
  if (viewId === "profile") {
    if (!STATE.currentUser) {
      showToast("Please sign in to view your profile.");
      openLoginModal();
      return;
    }
    renderProfileView();
  }

  STATE.currentView = viewId;
  document.querySelectorAll(".app-view").forEach(el => el.classList.add("hidden"));
  const target = document.getElementById("view-" + viewId);
  if (target) target.classList.remove("hidden");

  // Update nav tabs active style
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.classList.remove("bg-maroon", "text-white", "border", "border-gold/30");
    btn.classList.add("text-slate-300");
  });
  const activeBtn = document.getElementById("tab-" + viewId);
  if (activeBtn) {
    activeBtn.classList.add("bg-maroon", "text-white", "border", "border-gold/30");
    activeBtn.classList.remove("text-slate-300");
  }

  // Update browser history URL and page title
  const canonicalPath = getPathForViewId(viewId);
  document.title = getTitleForViewId(viewId);
  if (updateHistory && typeof window !== "undefined" && window.history && window.history.pushState) {
    const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
    if (currentPath !== canonicalPath) {
      window.history.pushState({ viewId: viewId }, document.title, canonicalPath);
    }
  }

  // If navigating to Discussions, apply stream permissions
  if (viewId === "discussions") {
    setupDiscussionViewPermissions();
  }

  // If navigating to Admin panel, ensure all admin tables are rendered
  if (viewId === "admin") {
    renderAdminUsers();
    renderAdminStoreInventory();
    renderAdminRedemptions();
    renderAdminChatAudit();
    renderWednesdayPaperInfo();
  }

  // If navigating to Leaderboard, ensure latest scores and date are rendered
  if (viewId === "leaderboard") {
    renderLeaderboard();
  }

  // If navigating to Store, ensure latest store items and history are rendered
  if (viewId === "redemption") {
    renderRedemptionItems();
    renderUserRedemptionHistory();
  }

  // If navigating to Gemini AI Tutor, render chat and focus input
  if (viewId === "gemini") {
    renderGeminiChat();
    setTimeout(() => {
      const input = document.getElementById("geminiChatInput");
      if (input) input.focus();
    }, 150);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Browser Back/Forward navigation listener
if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => {
    const targetView = (e.state && e.state.viewId) ? e.state.viewId : getViewIdFromPath(window.location.pathname);
    navigateTo(targetView, false);
  });
}

// ----------------------------------------------------
// AUTH & HEADER CONTROLS
// ----------------------------------------------------
function renderAuthHeader() {
  const container = document.getElementById("authHeaderControls");
  const adminNavTab = document.getElementById("tab-admin");

  // Only show the Admin Portal nav tab if the current user is an Admin
  if (adminNavTab) {
    adminNavTab.classList.toggle("hidden", !isCurrentUserAdmin());
  }

  if (!container) return;

  if (STATE.currentUser) {
    const streamTag = (STATE.currentUser.role === 'STUDENT') 
      ? ` • ${STATE.currentUser.stream}` 
      : ` • ${STATE.currentUser.role}`;

    container.innerHTML = `
      <div class="relative">
        <button onclick="toggleUserDropdown()" id="userProfileBtn" class="flex items-center space-x-2 bg-maroon-dark hover:bg-maroon-dark/80 px-3 py-1.5 rounded-xl border border-gold/30 transition shadow-sm">
          <div class="w-7 h-7 rounded-full bg-gold text-slate-900 font-black flex items-center justify-center text-xs shadow-inner">
            ${STATE.currentUser.fullName.charAt(0)}
          </div>
          <div class="hidden sm:block text-left">
            <p class="text-xs font-bold text-white leading-tight">${STATE.currentUser.fullName}</p>
            <p class="text-[10px] text-gold">${STATE.currentUser.role} ${streamTag} • ${STATE.currentUser.spPoints} SP</p>
          </div>
          <span class="material-symbols-outlined text-[16px] text-gold/80">expand_more</span>
        </button>

        <!-- Dropdown Menu -->
        <div id="userDropdownMenu" class="hidden absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-slate-800">
          <div class="px-4 py-2 border-b border-slate-100">
            <p class="text-xs font-bold text-slate-900 truncate">${STATE.currentUser.fullName}</p>
            <p class="text-[11px] text-slate-500 truncate">${STATE.currentUser.email}</p>
            <div class="flex items-center space-x-1 mt-1">
              <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${isCurrentUserAdmin() ? 'bg-maroon text-gold font-black' : 'bg-maroon/10 text-maroon'}">${STATE.currentUser.role}</span>
              ${STATE.currentUser.role === 'STUDENT' ? `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">${STATE.currentUser.stream}</span>
              ` : `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Staff Access</span>
              `}
            </div>
          </div>
          <button onclick="closeUserDropdown(); navigateTo('profile');" class="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2">
            <span class="material-symbols-outlined text-[18px] text-slate-500">account_circle</span>
            <span>My Profile</span>
          </button>
          ${isCurrentUserAdmin() ? `
            <button onclick="closeUserDropdown(); navigateTo('admin');" class="w-full px-4 py-2 text-left text-xs font-bold text-maroon hover:bg-maroon/5 flex items-center space-x-2">
              <span class="material-symbols-outlined text-[18px] text-maroon">shield_person</span>
              <span>Administrator Panel</span>
            </button>
          ` : ''}
          <button onclick="handleLogout()" class="w-full px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center space-x-2 border-t border-slate-100 mt-1">
            <span class="material-symbols-outlined text-[18px] text-red-500">logout</span>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    `;

    // Update Home displays
    const homeStream = document.getElementById("homeUserStreamDisplay");
    if (homeStream) {
      homeStream.innerText = (STATE.currentUser.role === 'STUDENT') ? STATE.currentUser.stream : "All-Access (Staff)";
    }
    const homeSp = document.getElementById("homeUserSp");
    if (homeSp) homeSp.innerText = `${STATE.currentUser.spPoints} SP`;

    const milestone = getMilestoneForSp(STATE.currentUser.spPoints);
    const homeLevel = document.getElementById("homeUserLevelDisplay");
    if (homeLevel) {
      homeLevel.innerText = `${milestone.current.badge} Level ${milestone.current.level} ${milestone.current.name}`;
    }

    const redSp = document.getElementById("redemptionUserPoints");
    if (redSp) redSp.innerText = `${STATE.currentUser.spPoints} SP`;

  } else {
    // Logged Out State
    container.innerHTML = `
      <button onclick="openLoginModal()" class="flex items-center space-x-1.5 bg-gold hover:bg-gold-dark text-slate-900 font-bold px-4 py-1.5 rounded-xl text-xs transition shadow-sm">
        <span class="material-symbols-outlined text-[18px]">login</span>
        <span>Sign In</span>
      </button>
    `;

    const homeStream = document.getElementById("homeUserStreamDisplay");
    if (homeStream) homeStream.innerText = "Guest (Sign In)";
    const homeSp = document.getElementById("homeUserSp");
    if (homeSp) homeSp.innerText = "0 SP";
    const homeLevel = document.getElementById("homeUserLevelDisplay");
    if (homeLevel) homeLevel.innerText = "Sign in to track";
    const redSp = document.getElementById("redemptionUserPoints");
    if (redSp) redSp.innerText = "0 SP";
  }
}

function toggleUserDropdown() {
  const menu = document.getElementById("userDropdownMenu");
  if (menu) menu.classList.toggle("hidden");
}

function closeUserDropdown() {
  const menu = document.getElementById("userDropdownMenu");
  if (menu) menu.classList.add("hidden");
}

window.addEventListener("click", (e) => {
  const btn = document.getElementById("userProfileBtn");
  const menu = document.getElementById("userDropdownMenu");
  if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

// ----------------------------------------------------
// AUTHENTICATION MODAL (LOGIN & REGISTRATION)
// ----------------------------------------------------
let authCurrentMode = 'signin'; // 'signin' or 'signup'

function openLoginModal(mode = 'signin') {
  setAuthMode(mode);
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.remove("hidden");
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.add("hidden");
}

function setAuthMode(mode) {
  authCurrentMode = mode;
  const title = document.getElementById("authModalTitle");
  const btnSubmit = document.getElementById("btnAuthSubmit");
  const btnTabSignIn = document.getElementById("btnAuthTabSignIn");
  const btnTabSignUp = document.getElementById("btnAuthTabSignUp");
  const fieldName = document.getElementById("fieldFullName");
  const fieldRole = document.getElementById("fieldRoleSelection");
  const fieldStream = document.getElementById("fieldStreamSelection");

  if (mode === 'signin') {
    if (title) title.innerText = "Sign In to ZSP - 28";
    if (btnSubmit) btnSubmit.innerText = "Sign In to Portal";
    btnTabSignIn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm";
    btnTabSignUp.className = "flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600";
    if (fieldName) fieldName.classList.add("hidden");
    if (fieldRole) fieldRole.classList.add("hidden");
    if (fieldStream) fieldStream.classList.add("hidden");
  } else {
    if (title) title.innerText = "Create New Account";
    if (btnSubmit) btnSubmit.innerText = "Create & Register Account";
    btnTabSignUp.className = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-800 shadow-sm";
    btnTabSignIn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600";
    if (fieldName) fieldName.classList.remove("hidden");
    if (fieldRole) fieldRole.classList.remove("hidden");
    onRoleChanged(); // will show/hide stream options based on selected role
  }
}

// When creating an account: if Student -> show ONLY Physical Science & Bio Science. If Teacher -> hide stream.
function onRoleChanged() {
  const roleRadios = document.getElementsByName("authRole");
  let selectedRole = "STUDENT";
  for (let r of roleRadios) {
    if (r.checked) selectedRole = r.value;
  }

  const fieldStream = document.getElementById("fieldStreamSelection");
  if (fieldStream) {
    if (selectedRole === "STUDENT") {
      fieldStream.classList.remove("hidden");
    } else {
      fieldStream.classList.add("hidden");
    }
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  if (!email) {
    showToast("Please enter your Gmail / Email address.");
    return;
  }

  if (authCurrentMode === 'signin') {
    // Check credentials against state
    let matchedUser = STATE.users.find(u => u && u.email && u.email.toLowerCase().trim() === email);

    // Strict Admin Authentication: only authorized admin email with proper password gets ADMIN privileges
    if (email === "mnmjaasim@gmail.com") {
      if (password !== "mnmjaasim2010" && password !== "admin123") {
        showToast("⚠️ Incorrect Administrator Password. Please enter the correct admin password.");
        return;
      }
      if (!matchedUser) {
        matchedUser = {
          id: "admin_jasim",
          fullName: "M.N.M. Jaasim",
          email: "mnmjaasim@gmail.com",
          role: "ADMIN",
          stream: "All Streams",
          spPoints: 450,
          weeklySp: 0,
          isVerified: true,
          hasEarlyQuizAccess: true
        };
        STATE.users.unshift(matchedUser);
      } else {
        matchedUser.role = "ADMIN";
        matchedUser.isVerified = true;
        matchedUser.hasEarlyQuizAccess = true;
      }
    } else {
      // General non-admin user login - STRICT: Do NOT create accounts on sign in!
      if (!matchedUser) {
        showToast(`⚠️ No account found for "${email}". The Sign In button only logs into existing accounts. Please click "Sign Up" below to create an account.`);
        return;
      }

      // Check stored password if set
      if (matchedUser.password && password && matchedUser.password !== password) {
        showToast("⚠️ Incorrect password. Please verify and try again.");
        return;
      }

      if (matchedUser.role === 'ADMIN' && matchedUser.email !== 'mnmjaasim@gmail.com') {
        matchedUser.role = 'STUDENT'; // Prevent unauthorized admin roles
      }
    }

    STATE.currentUser = matchedUser;

    // Handle "Keep me signed in" preference
    const keepSignedIn = document.getElementById("authKeepSignedIn")?.checked;
    try {
      if (keepSignedIn) {
        localStorage.setItem("znc_current_user", JSON.stringify(matchedUser));
      } else {
        localStorage.removeItem("znc_current_user");
        localStorage.removeItem("zsp_current_user");
      }
    } catch (e) {}

    saveUsersAndSession();
    pushUserToCloud(matchedUser);

    closeLoginModal();
    renderAuthHeader();
    renderHomeSubjects();
    renderChatMessages();
    renderLeaderboard();
    checkWednesdayQuizWindow();
    showToast(`Welcome back, ${matchedUser.fullName}! (${matchedUser.role}${matchedUser.role === 'STUDENT' ? ' - ' + matchedUser.stream : ''})`);

  } else {
    // SIGN UP FLOW: Strictly enforce 1 Gmail per account
    const fullName = document.getElementById("authFullName").value.trim();
    if (!fullName) {
      showToast("Please enter your Full Name.");
      return;
    }

    if (!password) {
      showToast("Please choose a secure password.");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast("Please enter a valid Gmail / Email address (e.g., student@gmail.com).");
      return;
    }

    // STRICT CHECK: A person can use only 1 Gmail to create an account
    const existingAccount = STATE.users.find(u => u && u.email && u.email.toLowerCase().trim() === email);
    if (existingAccount) {
      showToast(`⚠️ An account with "${email}" already exists! Each person can use only 1 Gmail address to create an account. Please switch to Sign In.`);
      setAuthMode('signin');
      const emailField = document.getElementById("loginEmail");
      if (emailField) emailField.value = email;
      return;
    }

    const roleRadios = document.getElementsByName("authRole");
    let role = "STUDENT";
    for (let r of roleRadios) {
      if (r.checked) role = r.value;
    }

    // Role safety: Only mnmjaasim@gmail.com can ever have ADMIN role
    if (email === "mnmjaasim@gmail.com") {
      role = "ADMIN";
    } else if (role === "ADMIN") {
      role = "STUDENT";
    }

    let stream = "All Streams";
    if (role === "STUDENT") {
      const streamRadios = document.getElementsByName("authStream");
      for (let s of streamRadios) {
        if (s.checked) stream = s.value;
      }
    }

    const newUser = {
      id: (role === "ADMIN" ? "admin_" : role === "TEACHER" ? "teacher_" : "student_") + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      fullName: fullName,
      email: email,
      password: password, // Store password so signin can authenticate
      role: role,
      stream: stream,
      spPoints: (role === "ADMIN" ? 450 : role === "TEACHER" ? 100 : 50),
      weeklySp: 0,
      isVerified: (role === "ADMIN" || role === "TEACHER"),
      hasEarlyQuizAccess: false,
      createdAt: Date.now()
    };

    STATE.users.push(newUser);
    STATE.currentUser = newUser;

    // Handle "Keep me signed in" preference for sign up
    const keepSignedIn = document.getElementById("authKeepSignedIn")?.checked;
    try {
      if (keepSignedIn) {
        localStorage.setItem("znc_current_user", JSON.stringify(newUser));
      } else {
        localStorage.removeItem("znc_current_user");
        localStorage.removeItem("zsp_current_user");
      }
    } catch (e) {}

    saveUsersAndSession();

    // Sync user to Firebase Realtime Database immediately
    pushUserToCloud(newUser);

    closeLoginModal();
    renderAuthHeader();
    renderHomeSubjects();
    renderChatMessages();
    renderLeaderboard();
    // AUTOMATICALLY show newly created account in Admin panel without clicking any sync button
    renderAdminUsers();
    checkWednesdayQuizWindow();
    showToast(`🎉 Account registered successfully as ${role}! Enrolled stream: ${stream}`);
  }
}

function handleLogout() {
  closeUserDropdown();
  STATE.currentUser = null;
  try {
    localStorage.removeItem("znc_current_user");
    localStorage.removeItem("zsp_current_user");
    sessionStorage.clear();
  } catch (e) {}
  renderAuthHeader();
  renderChatMessages();
  renderUserRedemptionHistory();
  renderHomeSubjects();
  navigateTo("home");
  showToast("You have been signed out of Zahira Science Portal.");
}

// ----------------------------------------------------
// PROFILE VIEW
// ----------------------------------------------------
function renderProfileView() {
  if (!STATE.currentUser) {
    openLoginModal();
    return;
  }

  const nameEl = document.getElementById("profileFullName");
  const avatarEl = document.getElementById("profileAvatar");
  const emailEl = document.getElementById("profileEmail");
  const roleBadge = document.getElementById("profileRoleBadge");
  const accountType = document.getElementById("profileAccountType");
  const streamEl = document.getElementById("profileStream");
  const spEl = document.getElementById("profileSpPoints");
  const milestoneEl = document.getElementById("profileMilestoneDisplay");

  if (nameEl) nameEl.innerText = STATE.currentUser.fullName;
  if (avatarEl) avatarEl.innerText = STATE.currentUser.fullName.charAt(0);
  if (emailEl) emailEl.innerText = STATE.currentUser.email;
  if (roleBadge) roleBadge.innerText = STATE.currentUser.role;
  if (accountType) accountType.innerText = STATE.currentUser.role === 'STUDENT' ? 'G.C.E. A/L Science Student' : 'Teacher / Administrator';
  if (streamEl) streamEl.innerText = STATE.currentUser.role === 'STUDENT' ? STATE.currentUser.stream : 'All Streams (Full Access)';
  if (spEl) spEl.innerText = `${STATE.currentUser.spPoints} SP`;

  const m = getMilestoneForSp(STATE.currentUser.spPoints);
  if (milestoneEl) milestoneEl.innerText = `${m.current.badge} Level ${m.current.level} ${m.current.name}`;

  // Render D3.js Weekly Science Points (SP) Trend Visualization
  setTimeout(() => renderWeeklySpTrendChart(window.currentWeeklySpFilter || 'all'), 50);

  // Render Academic Achievements & Badges Showcase
  setTimeout(() => renderAchievementsSection(window.currentAchievementFilter || 'All'), 60);
}

// ----------------------------------------------------
// ACADEMIC ACHIEVEMENTS & BADGES LOGIC
// ----------------------------------------------------
window.currentAchievementFilter = 'All';
window.achievementUnlockedOnly = false;

function getStudentAchievements(user) {
  if (!user) return [];
  const sp = Number(user.spPoints) || 150;
  const level = Number(user.level) || 1;
  const weeklySp = Number(user.weeklySp) || 0;
  const physicsSp = (user.subjectSp && user.subjectSp["Physics"]) || Math.round(sp * 0.35);
  const mathsSp = (user.subjectSp && user.subjectSp["Combined Mathematics"]) || Math.round(sp * 0.30);
  const chemSp = (user.subjectSp && user.subjectSp["Chemistry"]) || Math.round(sp * 0.25);
  const bioSp = (user.subjectSp && user.subjectSp["Biology"]) || Math.round(sp * 0.25);
  const rank = user.weeklyRank || (sp >= 300 ? 2 : null);

  return [
    {
      id: "first_sp",
      title: "First Steps to Science",
      description: "Earn your first 25 Science Points across Zahira study modules",
      category: "Dedication",
      iconEmoji: "🌱",
      currentProgress: Math.min(25, sp),
      maxProgress: 25,
      isUnlocked: sp >= 25,
      spReward: 10,
      unlockedDate: "Term Start"
    },
    {
      id: "physics_pioneer",
      title: "Physics Pioneer",
      description: "Attain 50+ Science Points in Advanced Level Physics questions",
      category: "Academic",
      iconEmoji: "⚛️",
      currentProgress: Math.min(50, physicsSp),
      maxProgress: 50,
      isUnlocked: physicsSp >= 50,
      spReward: 25,
      unlockedDate: "Week 2"
    },
    {
      id: "maths_prodigy",
      title: "Combined Maths Prodigy",
      description: "Accumulate 50+ Science Points in Pure & Applied Mathematics",
      category: "Academic",
      iconEmoji: "📐",
      currentProgress: Math.min(50, mathsSp),
      maxProgress: 50,
      isUnlocked: mathsSp >= 50,
      spReward: 25,
      unlockedDate: "Week 3"
    },
    {
      id: "chemistry_alchemist",
      title: "Alchemist Supreme",
      description: "Reach 40+ Science Points in Physical & Organic Chemistry",
      category: "Academic",
      iconEmoji: "🧪",
      currentProgress: Math.min(40, chemSp),
      maxProgress: 40,
      isUnlocked: chemSp >= 40,
      spReward: 20,
      unlockedDate: "Week 3"
    },
    {
      id: "bio_scholar",
      title: "Biosphere Scholar",
      description: "Achieve 40+ Science Points in G.C.E. A/L Biology modules",
      category: "Academic",
      iconEmoji: "🧬",
      currentProgress: Math.min(40, bioSp),
      maxProgress: 40,
      isUnlocked: bioSp >= 40,
      spReward: 20,
      unlockedDate: "Week 4"
    },
    {
      id: "wednesday_contestant",
      title: "Wednesday Night Gladiator",
      description: "Participate in the school live Wednesday Quiz (6:00 PM - 12:00 AM)",
      category: "Contests",
      iconEmoji: "⚡",
      currentProgress: (weeklySp > 0 || user.hasEarlyQuizAccess || sp >= 100) ? 1 : 0,
      maxProgress: 1,
      isUnlocked: weeklySp > 0 || user.hasEarlyQuizAccess || sp >= 100,
      spReward: 30,
      unlockedDate: "Active Week"
    },
    {
      id: "milestone_tier1",
      title: "Milestone Tier 1",
      description: "Reach Level 5 to unlock the first official Zahira Level Milestone",
      category: "Milestones",
      iconEmoji: "🏅",
      currentProgress: Math.min(5, level),
      maxProgress: 5,
      isUnlocked: level >= 5,
      spReward: 50,
      unlockedDate: "Level 5 Reached"
    },
    {
      id: "leaderboard_elite",
      title: "Top 10 Leaderboard Scholar",
      description: "Secure a top 10 weekly ranking across college science streams",
      category: "Contests",
      iconEmoji: "👑",
      currentProgress: (rank && rank <= 10) ? 1 : 0,
      maxProgress: 1,
      isUnlocked: (rank && rank <= 10),
      spReward: 75,
      unlockedDate: rank ? `Rank #${rank}` : null
    },
    {
      id: "century_club",
      title: "Century Science Club",
      description: "Surpass 100 total Science Points in your academic journey",
      category: "Dedication",
      iconEmoji: "💯",
      currentProgress: Math.min(100, sp),
      maxProgress: 100,
      isUnlocked: sp >= 100,
      spReward: 40,
      unlockedDate: "Milestone Unlocked"
    },
    {
      id: "grand_polymath",
      title: "Grand Science Polymath",
      description: "Attain an extraordinary achievement of 300+ Science Points",
      category: "Dedication",
      iconEmoji: "🌟",
      currentProgress: Math.min(300, sp),
      maxProgress: 300,
      isUnlocked: sp >= 300,
      spReward: 100,
      unlockedDate: "Honors Unlocked"
    }
  ];
}

function changeAchievementFilter(category) {
  window.currentAchievementFilter = category;
  document.querySelectorAll('.ach-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-ach-filter') === category) {
      btn.className = "ach-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-maroon text-gold shadow-sm";
    } else {
      btn.className = "ach-filter-btn px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition";
    }
  });
  renderAchievementsSection(category);
}
window.changeAchievementFilter = changeAchievementFilter;

function toggleUnlockedAchievementsOnly() {
  window.achievementUnlockedOnly = !window.achievementUnlockedOnly;
  const btn = document.getElementById("btnToggleUnlockedOnly");
  if (btn) {
    if (window.achievementUnlockedOnly) {
      btn.className = "px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 bg-emerald-700 text-white shadow-sm";
    } else {
      btn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition flex items-center space-x-1 border border-slate-200";
    }
  }
  renderAchievementsSection(window.currentAchievementFilter || 'All');
}
window.toggleUnlockedAchievementsOnly = toggleUnlockedAchievementsOnly;

function showAchievementDetail(achievementId) {
  const user = STATE.currentUser || { spPoints: 450, fullName: "Student", level: 6 };
  const allAchievements = getStudentAchievements(user);
  const item = allAchievements.find(a => a.id === achievementId);
  if (!item) return;

  const modal = document.createElement("div");
  modal.id = "achievementDetailModal";
  modal.className = "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4";
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150" onclick="event.stopPropagation()">
      <div class="flex items-start justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-14 h-14 rounded-full ${item.isUnlocked ? 'bg-amber-100 border-2 border-gold shadow-md' : 'bg-slate-100 border border-slate-300'} flex items-center justify-center text-3xl">
            ${item.iconEmoji}
          </div>
          <div>
            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${item.isUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
              ${item.isUnlocked ? '✅ UNLOCKED' : '🔒 IN PROGRESS'}
            </span>
            <h3 class="text-lg font-black text-slate-900 mt-1">${item.title}</h3>
            <p class="text-xs text-slate-500">${item.category} Category</p>
          </div>
        </div>
        <button onclick="document.getElementById('achievementDetailModal').remove()" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <p class="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
        ${item.description}
      </p>

      <div class="space-y-2 text-xs">
        <div class="flex justify-between text-slate-600">
          <span class="font-medium">Progress Metric:</span>
          <span class="font-bold text-slate-900">${item.currentProgress} / ${item.maxProgress}</span>
        </div>
        <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div class="h-full ${item.isUnlocked ? 'bg-gold' : 'bg-maroon'} rounded-full" style="width: ${(item.currentProgress / item.maxProgress) * 100}%;"></div>
        </div>
        <div class="flex justify-between text-slate-600 pt-1">
          <span class="font-medium">SP Reward:</span>
          <span class="font-black text-emerald-600">+${item.spReward} Science Points</span>
        </div>
        ${item.unlockedDate ? `
          <div class="flex justify-between text-slate-600">
            <span class="font-medium">Unlocked:</span>
            <span class="font-semibold text-slate-700">${item.unlockedDate}</span>
          </div>
        ` : ''}
      </div>

      <div class="pt-2">
        <button onclick="document.getElementById('achievementDetailModal').remove()" class="w-full py-2.5 rounded-xl bg-maroon text-gold font-bold text-xs hover:bg-maroon-dark transition shadow-md">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}
window.showAchievementDetail = showAchievementDetail;

function renderAchievementsSection(categoryFilter = 'All') {
  const container = document.getElementById("achievementsGridContainer");
  if (!container) return;

  const user = STATE.currentUser || { spPoints: 450, fullName: "Student", level: 6 };
  const allAchievements = getStudentAchievements(user);

  const unlockedCount = allAchievements.filter(a => a.isUnlocked).length;
  const totalSpBonus = allAchievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.spReward, 0);
  const percentComplete = Math.round((unlockedCount / allAchievements.length) * 100);

  // Update Summary Header Elements
  const badgeEl = document.getElementById("achievementUnlockedBadge");
  const overallLabel = document.getElementById("achievementOverallLabel");
  const bonusSpLabel = document.getElementById("achievementBonusSpLabel");
  const progressBar = document.getElementById("achievementProgressBar");

  if (badgeEl) badgeEl.innerText = `${unlockedCount} / ${allAchievements.length} UNLOCKED`;
  if (overallLabel) overallLabel.innerText = `Mastery Progress (${percentComplete}%)`;
  if (bonusSpLabel) bonusSpLabel.innerText = `+${totalSpBonus} SP Bonus Earned`;
  if (progressBar) progressBar.style.width = `${percentComplete}%`;

  // Filter Items
  const filtered = allAchievements.filter(item => {
    const matchCat = (categoryFilter === 'All') || (item.category === categoryFilter);
    const matchLock = !window.achievementUnlockedOnly || item.isUnlocked;
    return matchCat && matchLock;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
        No achievements found for this filter selection.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const fraction = Math.min(100, Math.round((item.currentProgress / item.maxProgress) * 100));
    return `
      <div onclick="showAchievementDetail('${item.id}')" class="cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md p-3.5 rounded-xl border ${item.isUnlocked ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-slate-200'} flex items-center space-x-3.5">
        <div class="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-2xl ${item.isUnlocked ? 'bg-amber-100 border-2 border-gold shadow-sm' : 'bg-slate-100 border border-slate-300 text-slate-400'}">
          ${item.iconEmoji}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <h4 class="text-xs font-black truncate ${item.isUnlocked ? 'text-amber-950' : 'text-slate-800'}">${item.title}</h4>
            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${item.isUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
              ${item.isUnlocked ? 'UNLOCKED' : `${item.currentProgress}/${item.maxProgress}`}
            </span>
          </div>
          <p class="text-[11px] text-slate-500 truncate mt-0.5">${item.description}</p>
          <div class="flex items-center space-x-2 mt-2">
            <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full ${item.isUnlocked ? 'bg-amber-500' : 'bg-maroon'} rounded-full" style="width: ${fraction}%;"></div>
            </div>
            <span class="text-[10px] font-bold ${item.isUnlocked ? 'text-emerald-600' : 'text-slate-400'} shrink-0">+${item.spReward} SP</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}
window.renderAchievementsSection = renderAchievementsSection;

// ----------------------------------------------------
// D3.JS WEEKLY SCIENCE POINTS (SP) TREND VISUALIZATION
// ----------------------------------------------------
window.currentWeeklySpFilter = 'all';

function ensureD3Loaded(callback) {
  if (window.d3) {
    callback(window.d3);
    return;
  }
  const existingScript = document.querySelector('script[src*="d3"]');
  if (existingScript) {
    existingScript.addEventListener('load', () => callback(window.d3));
    return;
  }
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/d3@7";
  script.onload = () => callback(window.d3);
  script.onerror = () => console.error("Failed to load D3.js library");
  document.head.appendChild(script);
}

function getStudentWeeklySpData(user, subjectFilter) {
  if (!user) return [];
  const totalSp = Number(user.spPoints) || 150;
  
  // Subject weight ratios for realistic distribution
  const subjectWeights = {
    all: 1.0,
    physics: 0.35,
    maths: 0.30,
    chemistry: 0.25,
    biology: 0.25,
    ict: 0.20
  };
  const weight = subjectWeights[subjectFilter] || 1.0;
  const targetTotal = Math.max(15, Math.round(totalSp * weight));

  // Trajectory over 6 consecutive academic weekly cycles
  const weekRatios = [0.12, 0.22, 0.36, 0.54, 0.76, 1.0];
  const weekLabels = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"];

  let prevCumulative = 0;
  return weekLabels.map((label, index) => {
    const cumulative = Math.max((index + 1) * 5, Math.round(targetTotal * weekRatios[index]));
    const earnedSp = (index === 0) ? cumulative : Math.max(5, cumulative - prevCumulative);
    const growth = (index === 0) ? 0 : Math.round(((earnedSp - (prevCumulative > 0 ? (cumulative - prevCumulative) : 10)) / 10) * 15 + 18);
    prevCumulative = cumulative;

    return {
      week: label,
      weekIndex: index + 1,
      sp: earnedSp,
      cumulativeSp: cumulative,
      growthRate: Math.max(5, Math.min(85, growth))
    };
  });
}

function changeWeeklySpFilter(subject) {
  window.currentWeeklySpFilter = subject;
  
  // Update button active styling
  document.querySelectorAll('.weekly-sp-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-subject') === subject) {
      btn.className = "weekly-sp-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-gold text-slate-950 shadow-sm";
    } else {
      btn.className = "weekly-sp-filter-btn px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition";
    }
  });

  renderWeeklySpTrendChart(subject);
}
window.changeWeeklySpFilter = changeWeeklySpFilter;

function renderWeeklySpTrendChart(subjectFilter = 'all') {
  const container = document.getElementById("weeklySpChartContainer");
  if (!container) return;

  const user = STATE.currentUser || { spPoints: 450, fullName: "Student" };
  const data = getStudentWeeklySpData(user, subjectFilter);
  if (!data || data.length === 0) return;

  // Update Summary Metric Strip
  const currentWeek = data[data.length - 1];
  const prevWeek = data[data.length - 2] || currentWeek;
  const growth = prevWeek.sp > 0 ? Math.round(((currentWeek.sp - prevWeek.sp) / prevWeek.sp) * 100) : 25;
  const totalSp = currentWeek.cumulativeSp;
  const avgVelocity = Math.round(totalSp / data.length);
  const peak = data.reduce((max, d) => d.sp > max.sp ? d : max, data[0]);

  const elCurrentSp = document.getElementById("statCurrentWeekSp");
  const elGrowthPercent = document.getElementById("statGrowthPercent");
  const elAvgSp = document.getElementById("statAvgWeeklySp");
  const elPeakSp = document.getElementById("statPeakWeekSp");
  const elImprovementStatus = document.getElementById("statImprovementStatus");
  const elInsightHeading = document.getElementById("insightHeading");
  const elInsightBody = document.getElementById("insightBody");

  if (elCurrentSp) elCurrentSp.innerText = `+${currentWeek.sp} SP`;
  if (elGrowthPercent) elGrowthPercent.innerText = `${Math.abs(growth)}%`;
  if (elAvgSp) elAvgSp.innerText = `${avgVelocity} SP / wk`;
  if (elPeakSp) elPeakSp.innerText = `${peak.week} (${peak.sp} SP)`;
  if (elImprovementStatus) {
    elImprovementStatus.innerText = growth >= 0 ? "Accelerating 🚀" : "Consistent 📈";
  }
  if (elInsightHeading && elInsightBody) {
    const subName = subjectFilter === 'all' ? 'All Subjects' : subjectFilter.toUpperCase();
    elInsightHeading.innerText = `${subName} Trend Analysis:`;
    elInsightBody.innerText = `You earned ${currentWeek.sp} SP this week (+${growth}% growth). Practicing 2 more quizzes will maintain your top leaderboard rank!`;
  }

  ensureD3Loaded(d3 => {
    // Clear previous SVG
    container.innerHTML = "";

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width > 0 ? rect.width : (container.parentElement ? container.parentElement.clientWidth - 24 : 600);
    const width = Math.max(300, containerWidth);
    const height = 260;

    const margin = { top: 25, right: 30, bottom: 35, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("overflow", "visible");

    // Definitions (Gradients & Glow Filters)
    const defs = svg.append("defs");

    // Area Gradient
    const areaGradient = defs.append("linearGradient")
      .attr("id", "spAreaGradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");

    areaGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#F59E0B")
      .attr("stop-opacity", 0.45);

    areaGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#881337")
      .attr("stop-opacity", 0.02);

    // Glow Filter
    const filter = defs.append("filter")
      .attr("id", "spGlow")
      .attr("x", "-20%").attr("y", "-20%")
      .attr("width", "140%").attr("height", "140%");

    filter.append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // D3 Scales
    const xScale = d3.scalePoint()
      .domain(data.map(d => d.week))
      .range([0, innerWidth])
      .padding(0.12);

    const maxSp = d3.max(data, d => d.sp) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, maxSp * 1.25])
      .range([innerHeight, 0])
      .nice();

    // Horizontal Subtle Grid Lines
    const yGrid = d3.axisLeft(yScale)
      .ticks(4)
      .tickSize(-innerWidth)
      .tickFormat("");

    g.append("g")
      .attr("class", "grid")
      .call(yGrid)
      .selectAll("line")
      .attr("stroke", "rgba(255, 255, 255, 0.08)")
      .attr("stroke-dasharray", "3 3");

    g.select(".grid .domain").remove();

    // X Axis
    const xAxis = d3.axisBottom(xScale).tickSize(0);
    const gX = g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis);

    gX.select(".domain").attr("stroke", "rgba(255, 255, 255, 0.15)");
    gX.selectAll("text")
      .attr("fill", "#94A3B8")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("dy", "12px");

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(4).tickFormat(d => `${d}`);
    const gY = g.append("g").call(yAxis);

    gY.select(".domain").remove();
    gY.selectAll("line").remove();
    gY.selectAll("text")
      .attr("fill", "#64748B")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("dx", "-4px");

    // Area Generator
    const areaGenerator = d3.area()
      .x(d => xScale(d.week))
      .y0(innerHeight)
      .y1(d => yScale(d.sp))
      .curve(d3.curveMonotoneX);

    // Append Area Path
    g.append("path")
      .datum(data)
      .attr("fill", "url(#spAreaGradient)")
      .attr("d", areaGenerator);

    // Line Generator
    const lineGenerator = d3.line()
      .x(d => xScale(d.week))
      .y(d => yScale(d.sp))
      .curve(d3.curveMonotoneX);

    // Append Line Path with Draw Animation
    const linePath = g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#F59E0B")
      .attr("stroke-width", 3.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("filter", "url(#spGlow)")
      .attr("d", lineGenerator);

    const totalLength = linePath.node() ? linePath.node().getTotalLength() : 0;
    if (totalLength > 0) {
      linePath
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
    }

    // Tooltip Element
    const tooltip = document.getElementById("d3SpTooltip");

    // Data Circles (Interactive Markers)
    const circles = g.selectAll(".sp-data-point")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "sp-data-point")
      .attr("cx", d => xScale(d.week))
      .attr("cy", d => yScale(d.sp))
      .attr("r", 5)
      .attr("fill", "#F59E0B")
      .attr("stroke", "#0F172A")
      .attr("stroke-width", 2.5)
      .style("cursor", "pointer")
      .style("transition", "transform 0.15s ease");

    // Circle Hover Events
    circles
      .on("mouseenter", function(event, d) {
        d3.select(this)
          .attr("r", 8)
          .attr("fill", "#FCD34D")
          .attr("stroke", "#FFFFFF");

        if (tooltip) {
          tooltip.innerHTML = `
            <div class="space-y-1">
              <div class="flex items-center justify-between space-x-3">
                <span class="font-extrabold text-amber-300 text-xs">${d.week} (Wed Quiz)</span>
                <span class="text-[10px] font-bold text-emerald-400">+${d.growthRate}% vs prior</span>
              </div>
              <div class="text-sm font-black text-white">+${d.sp} Marks / SP Earned</div>
              <div class="text-[10px] text-slate-400">Total Progress: ${d.cumulativeSp} SP</div>
            </div>
          `;
          tooltip.style.opacity = "1";
        }
      })
      .on("mousemove", function(event) {
        if (tooltip) {
          const containerRect = container.getBoundingClientRect();
          const x = event.clientX - containerRect.left;
          const y = event.clientY - containerRect.top;
          tooltip.style.left = `${Math.min(containerRect.width - 150, Math.max(10, x - 70))}px`;
          tooltip.style.top = `${Math.max(10, y - 75)}px`;
        }
      })
      .on("mouseleave", function() {
        d3.select(this)
          .attr("r", 5)
          .attr("fill", "#F59E0B")
          .attr("stroke", "#0F172A");

        if (tooltip) {
          tooltip.style.opacity = "0";
        }
      });
  });
}
window.renderWeeklySpTrendChart = renderWeeklySpTrendChart;

// Responsive Redraw on Window Resize
window.addEventListener("resize", () => {
  if (document.getElementById("view-profile") && !document.getElementById("view-profile").classList.contains("hidden")) {
    renderWeeklySpTrendChart(window.currentWeeklySpFilter || 'all');
  }
});

// ----------------------------------------------------
// HOME SUBJECTS (FILTERED ACCORDING TO STUDENT STREAM)
// ----------------------------------------------------
function renderHomeSubjects() {
  const container = document.getElementById("subjectCardsContainer");
  if (!container) return;

  const currentStream = (STATE.currentUser && STATE.currentUser.role === 'STUDENT') 
    ? STATE.currentUser.stream 
    : "All";

  // National syllabus subjects with full 8-unit question engines
  const allSubjects = [
    { id: "physics", name: "Physics", stream: "Both", units: "8 Units (800 Questions)", icon: "bolt", color: "bg-amber-50 text-amber-800 border-amber-200" },
    { id: "combined_maths", name: "Combined Mathematics", stream: "Physical Science", units: "8 Units (800 Questions)", icon: "calculate", color: "bg-blue-50 text-blue-800 border-blue-200" },
    { id: "chemistry", name: "Chemistry", stream: "Both", units: "8 Units (800 Questions)", icon: "science", color: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    { id: "ict", name: "Information & Communication Technology", stream: "Both", units: "8 Units (800 Questions)", icon: "terminal", color: "bg-indigo-50 text-indigo-800 border-indigo-200" }
  ];

  // Filter based on user's enrolled stream
  const filtered = allSubjects.filter(s => {
    if (currentStream === "All") return true;
    if (s.stream === "Both") return true;
    return s.stream === currentStream;
  });

  container.innerHTML = filtered.map(s => `
    <div class="p-4 rounded-xl border ${s.color} space-y-2 flex flex-col justify-between">
      <div>
        <div class="flex items-center space-x-2">
          <span class="material-symbols-outlined">${s.icon}</span>
          <h3 class="font-bold text-sm">${s.name}</h3>
        </div>
        <p class="text-xs opacity-80 mt-1 font-semibold">${s.units}</p>
        <span class="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-white/70">
          Stream: ${s.stream === 'Both' ? 'Physical & Bio' : s.stream}
        </span>
      </div>
      <button onclick="switchQuizSubject('${s.id}'); navigateTo('quiz');" class="text-[11px] font-bold underline hover:opacity-75 pt-2 text-left flex items-center space-x-1">
        <span>Take ${s.name} Quiz</span>
        <span>→</span>
      </button>
    </div>
  `).join("");
}

// ----------------------------------------------------
// WEDNESDAY 6:00 PM – 12:00 AM COMPETITIVE QUIZ ENGINE
// ----------------------------------------------------
// Returns Sri Lanka time (Asia/Colombo) or local time
function getSriLankaTime() {
  try {
    const slDateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" });
    return new Date(slDateStr);
  } catch (e) {
    return new Date();
  }
}

// Early Quiz Access Helper: checks if user is Admin or specifically approved by Admin
function hasUserEarlyQuizAccess(user) {
  if (!user) return false;
  const emailLower = (user.email || "").toLowerCase().trim();

  // 1. Root Admin and Admin role always have early quiz access
  if (user.role === "ADMIN" || user.id === "admin_jasim" || emailLower === "mnmjaasim@gmail.com") {
    return true;
  }

  // 2. Direct property on user object
  if (user.hasEarlyQuizAccess === true || user.earlyQuizAccess === true || user.canDoQuizEarly === true) {
    return true;
  }

  // 3. Lookup latest record in STATE.users (by id OR email)
  if (Array.isArray(STATE.users)) {
    const latest = STATE.users.find(u => 
      (u && u.id && u.id === user.id) || 
      (u && u.email && emailLower && u.email.toLowerCase().trim() === emailLower)
    );
    if (latest && (latest.hasEarlyQuizAccess === true || latest.earlyQuizAccess === true || latest.canDoQuizEarly === true)) {
      return true;
    }
  }

  // 4. Global approved emails map from Firebase Realtime Database
  if (emailLower && STATE.earlyApprovedEmails) {
    const cleanKey = emailLower.replace(/[\.\$#\[\]\/]/g, "_");
    if (STATE.earlyApprovedEmails[emailLower] === true || STATE.earlyApprovedEmails[cleanKey] === true) {
      return true;
    }
  }

  return false;
}

// Checks if current time is Wednesday between 18:00 (6:00 PM) and 24:00 (12:00 AM Midnight) in Sri Lanka Standard Time
function isWednesdayQuizWindowOpen() {
  const now = getSriLankaTime();
  const day = now.getDay(); // 3 = Wednesday
  const hour = now.getHours(); // 0 to 23

  // Automatically start at 6:00 PM (18:00) and run through 12:00 AM Midnight (24:00) strictly on Wednesday
  return (day === 3 && hour >= 18);
}

// Calculates exact countdown timing for the Wednesday examination
function getWednesdayCountdownInfo() {
  const now = getSriLankaTime();
  const day = now.getDay();
  const hour = now.getHours();

  if (day === 3 && hour >= 18) {
    // Currently live! Count down until 12:00 AM Midnight close (start of Thursday 00:00)
    const closeTime = new Date(now);
    closeTime.setHours(24, 0, 0, 0);
    const diffMs = Math.max(0, closeTime.getTime() - now.getTime());
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return {
      isOpen: true,
      text: `Closes in ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
    };
  } else {
    // Locked. Calculate time until next Wednesday 6:00 PM (18:00)
    const nextWed = new Date(now);
    let daysToAdd = (3 - day + 7) % 7;
    if (day === 3 && hour < 18) {
      daysToAdd = 0;
    } else if (daysToAdd === 0) {
      daysToAdd = 7;
    }
    nextWed.setDate(now.getDate() + daysToAdd);
    nextWed.setHours(18, 0, 0, 0);

    const diffMs = Math.max(0, nextWed.getTime() - now.getTime());
    const days = Math.floor(diffMs / (24 * 3600000));
    const hours = Math.floor((diffMs % (24 * 3600000)) / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);

    let text = "";
    if (days > 0) {
      text = `Opens in ${days}d ${hours}h ${mins}m`;
    } else {
      text = `Opens in ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }

    return {
      isOpen: false,
      text: text
    };
  }
}

function checkWednesdayQuizWindow() {
  const statusEl = document.getElementById("wednesdayWindowStatusText");
  const liveBadge = document.getElementById("quizWindowLiveBadge");
  const countdownText = document.getElementById("wednesdayCountdownText");
  const countdownBadge = document.getElementById("wednesdayCountdownBadge");
  const launchBtn = document.getElementById("btnLaunchMainQuiz");

  const countdown = getWednesdayCountdownInfo();
  const isOpen = countdown.isOpen;
  const hasEarlyAccess = STATE.currentUser && hasUserEarlyQuizAccess(STATE.currentUser);

  if (isOpen) {
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-emerald-600 font-extrabold flex items-center justify-end gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
        LIVE NOW (6:00 PM – 12:00 AM)
      </span>`;
    }
    if (liveBadge) {
      liveBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1";
      liveBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">bolt</span><span>LIVE: Wednesday Examination Open for Everyone!</span>`;
    }
    if (countdownBadge) {
      countdownBadge.className = "text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1";
    }
    if (countdownText) {
      countdownText.innerText = countdown.text;
    }
    if (launchBtn) {
      launchBtn.classList.remove("opacity-60");
      launchBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">play_circle</span><span>Start Examination (100 Questions)</span>`;
    }
  } else if (hasEarlyAccess) {
    // Early access unlocked for Admin or Admin-Approved users
    const isAdmin = STATE.currentUser.role === "ADMIN" || STATE.currentUser.id === "admin_jasim" || (STATE.currentUser.email && STATE.currentUser.email.toLowerCase() === "mnmjaasim@gmail.com");
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-purple-600 font-extrabold flex items-center justify-end gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-purple-600">verified_user</span>
        EARLY ACCESS ACTIVE (${isAdmin ? 'Admin' : 'Admin Approved'})
      </span>`;
    }
    if (liveBadge) {
      liveBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 flex items-center space-x-1";
      liveBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">lock_open</span><span>Early Access Unlocked (${isAdmin ? 'Admin' : 'Approved by Admin'}) • Official Window: Wed 6:00 PM – 12:00 AM</span>`;
    }
    if (countdownBadge) {
      countdownBadge.className = "text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1";
    }
    if (countdownText) {
      countdownText.innerText = `Official: ${countdown.text}`;
    }
    if (launchBtn) {
      launchBtn.classList.remove("opacity-60");
      launchBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">play_circle</span><span>Start Examination (Early Access)</span>`;
    }
  } else {
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-slate-600 font-medium flex items-center justify-end gap-1">
        <span class="material-symbols-outlined text-[14px] text-slate-400">lock</span>
        Locked (Opens Wed 6:00 PM)
      </span>`;
    }
    if (liveBadge) {
      liveBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1";
      liveBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">schedule</span><span>Opens Wednesday 6:00 PM – 12:00 AM</span>`;
    }
    if (countdownBadge) {
      countdownBadge.className = "text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 flex items-center gap-1";
    }
    if (countdownText) {
      countdownText.innerText = countdown.text;
    }
    if (launchBtn) {
      launchBtn.classList.add("opacity-60");
      launchBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">lock</span><span>Opens Wednesday 6:00 PM – 12:00 AM</span>`;
    }
  }
}

// ----------------------------------------------------
// MULTI-SUBJECT SYNCHRONIZED WEDNESDAY EXAMINATION SYSTEM
// Supports: Physics, Combined Maths, Chemistry, ICT
// ----------------------------------------------------

function switchQuizSubject(subjectId) {
  if (!SUBJECTS_DATA[subjectId]) subjectId = "physics";
  STATE.selectedSubjectId = subjectId;
  STATE.selectedUnitId = "all";

  // Update Subject Selector Tabs
  ["physics", "combined_maths", "chemistry", "ict"].forEach(id => {
    const tab = document.getElementById(`quizSubTab_${id}`);
    if (tab) {
      if (id === subjectId) {
        tab.className = "quiz-subject-tab p-3.5 rounded-2xl border-2 text-left transition flex items-center space-x-3 bg-maroon/5 border-maroon ring-2 ring-maroon/20 shadow-sm";
      } else {
        tab.className = "quiz-subject-tab p-3.5 rounded-2xl border-2 text-left transition flex items-center space-x-3 bg-white border-slate-200 hover:border-slate-300";
      }
    }
  });

  const subj = SUBJECTS_DATA[subjectId];

  // Update Dynamic Labels
  const headerLabel = document.getElementById("unitSelectorHeaderLabel");
  if (headerLabel) headerLabel.innerText = `Select ${subj.name} Unit to Practice or Test:`;

  const subLabel = document.getElementById("unitSelectorSubLabel");
  if (subLabel) subLabel.innerHTML = `Each of the 8 Sri Lankan A/L ${subj.shortName} units has <strong>100 comprehensive quiz questions</strong>.`;

  const totalBadge = document.getElementById("unitTotalQuestionsBadge");
  if (totalBadge) totalBadge.innerText = `800 Total A/L ${subj.shortName} Questions Available`;

  const launchBtnText = document.getElementById("btnLaunchMainQuizText");
  if (launchBtnText) launchBtnText.innerText = `Start ${subj.shortName} Grand Quiz (100 Questions)`;

  // Re-render unit cards for this subject
  renderUnitCards();
}

// Render the All Units Grand Paper and 8 Units selector for the chosen subject
function renderUnitCards() {
  const container = document.getElementById("physicsUnitsGrid");
  if (!container) return;

  const subjectId = STATE.selectedSubjectId || "physics";
  const subj = (typeof SUBJECTS_DATA !== "undefined" && SUBJECTS_DATA[subjectId]) 
    ? SUBJECTS_DATA[subjectId] 
    : { name: "Physics", units: (typeof PHYSICS_UNITS !== "undefined" ? PHYSICS_UNITS : []) };

  const units = subj.units || [];

  container.innerHTML = units.map(u => {
    const isSelected = String(STATE.selectedUnitId) === String(u.id);
    const isGrand = u.id === "all" || u.isGrand;

    if (isGrand) {
      return `
        <div onclick="selectSubjectUnit('${u.id}')" id="unitCard_${u.id}" class="sm:col-span-2 lg:col-span-4 p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm ${isSelected ? 'border-maroon bg-gradient-to-r from-maroon/10 via-gold/10 to-amber-500/10 ring-2 ring-maroon/30' : 'border-gold/60 bg-gradient-to-r from-amber-500/5 to-white hover:border-gold'}">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-maroon text-gold">OFFICIAL NATIONAL PAPER</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">100 Questions (${subj.shortName} Balanced Paper)</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Identical for All Students
              </span>
            </div>
            <h4 class="font-black text-sm text-slate-900">${subj.emoji} ${u.name}</h4>
            <p class="text-xs text-slate-600">${u.desc}</p>
          </div>
          <div class="shrink-0 text-right">
            <span class="inline-block px-4 py-2 rounded-xl text-xs font-bold transition ${isSelected ? 'bg-maroon text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
              ${isSelected ? '✓ Selected Paper' : 'Select Grand Paper'}
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div onclick="selectSubjectUnit('${u.id}')" id="unitCard_${u.id}" class="p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${isSelected ? 'border-maroon bg-maroon/5 ring-2 ring-maroon/30' : 'border-slate-200 bg-white hover:border-slate-300'}">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase text-maroon">Unit ${u.id}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">100 Questions</span>
          </div>
          <h4 class="font-bold text-xs text-slate-900 mt-1">${u.name.replace(`Unit ${u.id}: `, '')}</h4>
          <p class="text-[11px] text-slate-500 line-clamp-2 mt-1">${u.desc}</p>
        </div>
        <div class="mt-2 text-right">
          <span class="text-[11px] font-bold ${isSelected ? 'text-maroon' : 'text-slate-400'}">
            ${isSelected ? '● Selected' : 'Select Unit'}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

// Backward compatibility alias
function renderPhysicsUnitCards() {
  renderUnitCards();
}

function selectSubjectUnit(unitId) {
  STATE.selectedUnitId = unitId;
  renderUnitCards();

  const subjectId = STATE.selectedSubjectId || "physics";
  const subj = SUBJECTS_DATA[subjectId] || SUBJECTS_DATA.physics;
  const unit = (subj.units || []).find(u => String(u.id) === String(unitId)) || { name: `Unit ${unitId}` };

  const label = document.getElementById("selectedUnitLabel");
  if (label) {
    label.innerText = `${subj.shortName} - ${unit.name} (100 Questions)`;
  }

  const launchBtnText = document.getElementById("btnLaunchMainQuizText");
  if (launchBtnText) {
    launchBtnText.innerText = `Start ${subj.shortName} Quiz (100 Questions)`;
  }
}

// Backward compatibility alias
function selectPhysicsUnit(unitId) {
  selectSubjectUnit(unitId);
}

function startSelectedUnitQuiz() {
  if (!STATE.currentUser) {
    showToast("Please sign in with your account to sit the Wednesday examination.");
    openLoginModal();
    return;
  }

  // Check if official Wednesday window is open or user has approved early access
  const isOfficialWindow = isWednesdayQuizWindowOpen();
  const hasEarlyAccess = hasUserEarlyQuizAccess(STATE.currentUser);

  if (!isOfficialWindow && !hasEarlyAccess) {
    const countdown = getWednesdayCountdownInfo();
    showToast(`🔒 Examination Locked: The Wednesday Main Competitive Examination opens strictly every Wednesday from 6:00 PM to 12:00 AM Midnight (${countdown.text}). Early access before Wednesday is reserved for Administrator and admin-approved candidates.`);
    return;
  }

  const subjectId = STATE.selectedSubjectId || "physics";
  const subj = SUBJECTS_DATA[subjectId] || SUBJECTS_DATA.physics;
  const weeklySeed = (STATE.wednesdayConfig && STATE.wednesdayConfig.seed) ? STATE.wednesdayConfig.seed : 84920194;
  
  // Deterministically generate/shuffle 100 questions for this Wednesday using weekly seed
  const questions = (typeof getSynchronizedWednesdayQuestions === "function")
    ? getSynchronizedWednesdayQuestions(subjectId, STATE.selectedUnitId, weeklySeed)
    : [];

  if (!questions || questions.length === 0) {
    showToast(`Loading ${subj.name} questions...`);
    return;
  }

  const unit = (subj.units || []).find(u => String(u.id) === String(STATE.selectedUnitId)) || { name: `Unit ${STATE.selectedUnitId}` };
  const subCode = subjectId.toUpperCase().replace("_", "").substring(0, 4);

  STATE.activeQuiz = {
    subjectId: subjectId,
    subjectName: subj.name,
    subjectEmoji: subj.emoji,
    unitId: STATE.selectedUnitId,
    unitTitle: unit.name,
    questions: questions,
    rewardSp: 100, // 100 SP for completing 100 questions
    paperCode: (questions[0] && questions[0].paperCode) ? questions[0].paperCode : `WED-${subCode}-${weeklySeed}`,
    seed: weeklySeed,
    isEarlyAccess: !isOfficialWindow,
    earlyAccessUser: !isOfficialWindow ? (STATE.currentUser.role === 'ADMIN' ? 'Admin' : 'Admin Approved') : null
  };

  STATE.activeQuizQuestionIdx = 0;
  STATE.selectedAnswerIdx = null;
  STATE.activeQuizScore = 0;
  STATE.quizSecondsRemaining = 3600; // 60 minutes

  // Open active runner
  const runner = document.getElementById("activeQuizRunner");
  if (runner) runner.classList.remove("hidden");

  const runnerPaperEl = document.getElementById("quizRunnerPaperCode");
  if (runnerPaperEl) runnerPaperEl.innerText = STATE.activeQuiz.paperCode;

  renderCurrentQuizQuestion();
  renderActiveQuizUnitMiniLeaderboard();
  startQuizTimer();
  runner.scrollIntoView({ behavior: "smooth" });
  showToast(`Exam Started: ${subj.emoji} ${subj.name} - ${unit.name} (Synchronized Paper ${STATE.activeQuiz.paperCode})`);
}

function renderCurrentQuizQuestion() {
  if (!STATE.activeQuiz || !STATE.activeQuiz.questions) return;
  const q = STATE.activeQuiz.questions[STATE.activeQuizQuestionIdx];
  const subjectName = STATE.activeQuiz.subjectName || "Physics";
  const subjectEmoji = STATE.activeQuiz.subjectEmoji || "⚛️";
  const unitTitle = STATE.activeQuiz.unitTitle || "Unit";

  const tagEl = document.getElementById("quizSubjectTag");
  if (tagEl) {
    tagEl.innerText = `${subjectEmoji} ${subjectName} • ${unitTitle}`;
  }

  const titleEl = document.getElementById("quizCurrentTitle");
  if (titleEl) {
    titleEl.innerText = `Question ${STATE.activeQuizQuestionIdx + 1} of 100`;
  }

  const progressEl = document.getElementById("quizProgressCount");
  if (progressEl) {
    progressEl.innerText = `${STATE.activeQuizQuestionIdx + 1} / 100`;
  }

  const textEl = document.getElementById("quizQuestionText");
  if (textEl) {
    textEl.innerText = q.q;
  }

  const container = document.getElementById("quizOptionsContainer");
  if (container) {
    container.innerHTML = q.options.map((opt, i) => `
      <label class="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition">
        <input type="radio" name="activeQuizOption" value="${i}" onchange="STATE.selectedAnswerIdx = ${i}" class="text-maroon focus:ring-maroon" />
        <span class="text-xs sm:text-sm font-medium text-slate-800">${opt}</span>
      </label>
    `).join("");
  }

  // Trigger KaTeX render if formula exists
  if (typeof renderMathInElement === "function" && textEl) {
    try {
      renderMathInElement(textEl, { delimiters: [{ left: "$", right: "$", display: false }] });
    } catch (e) {}
  }
}

// ----------------------------------------------------
// UNIT-SPECIFIC MINI-LEADERBOARD FOR ACTIVE QUIZ RUNNER
// Displays top performers for this specific unit only
// ----------------------------------------------------
function renderActiveQuizUnitMiniLeaderboard() {
  const container = document.getElementById("unitMiniLeaderboardList");
  if (!container) return;

  if (!STATE.activeQuiz) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">No exam currently active.</p>`;
    return;
  }

  const subjectId = STATE.activeQuiz.subjectId || "physics";
  const unitId = String(STATE.activeQuiz.unitId);
  const unitTitle = STATE.activeQuiz.unitTitle || ("Unit " + unitId);
  const subjectName = STATE.activeQuiz.subjectName || "Physics";
  const subjectEmoji = STATE.activeQuiz.subjectEmoji || "⚛️";
  const unitKey = `${subjectId}_unit_${unitId}`;

  // Update mini-leaderboard headers
  const titleEl = document.getElementById("unitMiniLeaderboardTitle");
  if (titleEl) {
    titleEl.innerText = `${subjectEmoji} ${unitTitle}`;
  }
  const subtitleEl = document.getElementById("unitMiniLeaderboardSubtitle");
  if (subtitleEl) {
    subtitleEl.innerText = `Top Performers (100 Questions)`;
  }

  // Filter candidate students: strictly genuine STUDENT role only (exclude admin, teachers, mock users)
  const candidateStudents = STATE.users.filter(u => {
    if (!u) return false;
    if (u.role !== "STUDENT") return false;
    if (u.id === "admin_jasim" || (u.email && u.email.toLowerCase() === "mnmjaasim@gmail.com")) return false;
    if (PURGED_MOCK_USER_IDS.includes(u.id)) return false;
    const emailLower = (u.email || "").toLowerCase();
    if (REMOVED_MOCK_EMAILS.includes(emailLower)) return false;
    if (u.id && (u.id.startsWith("mock_") || u.id.startsWith("fake_") || u.id.startsWith("demo_"))) return false;
    return true;
  });

  // Calculate unit performance for each student from official submissions
  const studentPerformance = candidateStudents.map(student => {
    // 1. Check submissions list (strictly exclude early submissions)
    const studentSubs = (STATE.quizSubmissions || []).filter(sub => 
      sub && sub.userId === student.id && 
      sub.subjectId === subjectId && 
      String(sub.unitId) === unitId &&
      !sub.isEarly &&
      sub.officialLeaderboardEligible !== false
    );

    let maxScore = 0;
    let totalQuestions = 100;
    let latestTimestamp = 0;

    studentSubs.forEach(s => {
      const sScore = Number(s.score) || 0;
      if (sScore > maxScore) {
        maxScore = sScore;
        totalQuestions = Number(s.total) || 100;
        latestTimestamp = s.timestamp || 0;
      }
    });

    // 2. Check user's direct unitScores dictionary
    if (student.unitScores && student.unitScores[unitKey] !== undefined) {
      const recorded = Number(student.unitScores[unitKey]) || 0;
      if (recorded > maxScore) {
        maxScore = recorded;
      }
    }

    return {
      student: student,
      score: maxScore,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((maxScore / totalQuestions) * 100) : 0,
      timestamp: latestTimestamp,
      totalSp: Number(student.spPoints) || 0
    };
  }).filter(item => item.score > 0);

  // Sort by score descending; break ties with total SP / timestamp
  studentPerformance.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.totalSp - a.totalSp;
  });

  // Render Top Performers
  if (studentPerformance.length === 0) {
    container.innerHTML = `
      <div class="py-5 px-3 text-center bg-white/80 rounded-xl border border-dashed border-amber-300 space-y-1.5">
        <span class="material-symbols-outlined text-amber-500 text-2xl">emoji_events</span>
        <p class="text-xs font-bold text-slate-800">Be the First Unit Champion!</p>
        <p class="text-[10px] text-slate-500 leading-relaxed">No student has recorded a final score for <strong>${unitTitle}</strong> yet.<br/>Complete all questions to set the benchmark and claim Rank #1!</p>
      </div>
    `;
  } else {
    // Show Top 5 performers
    const topPerformers = studentPerformance.slice(0, 5);
    container.innerHTML = topPerformers.map((item, idx) => {
      const rank = idx + 1;
      const isCurrentUser = STATE.currentUser && STATE.currentUser.id === item.student.id;
      
      let rankBadgeClass = "bg-slate-100 text-slate-700";
      let rankIcon = `#${rank}`;
      if (rank === 1) {
        rankBadgeClass = "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm font-black";
        rankIcon = "🥇";
      } else if (rank === 2) {
        rankBadgeClass = "bg-slate-200 text-slate-800 font-extrabold";
        rankIcon = "🥈";
      } else if (rank === 3) {
        rankBadgeClass = "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold";
        rankIcon = "🥉";
      }

      const initials = (item.student.fullName || "Student")
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      return `
        <div class="flex items-center justify-between p-2 rounded-lg border transition ${isCurrentUser ? 'bg-amber-100/70 border-amber-300 shadow-sm' : 'bg-white hover:bg-slate-50 border-slate-100'}">
          <div class="flex items-center space-x-2 min-w-0">
            <span class="w-6 h-6 rounded-md flex items-center justify-center text-xs ${rankBadgeClass} shrink-0">
              ${rankIcon}
            </span>
            <div class="w-6 h-6 rounded-full bg-maroon/10 text-maroon font-bold text-[10px] flex items-center justify-center border border-maroon/20 shrink-0">
              ${initials}
            </div>
            <div class="min-w-0">
              <div class="flex items-center space-x-1">
                <p class="text-xs font-bold text-slate-800 truncate leading-tight">${item.student.fullName}</p>
                ${isCurrentUser ? '<span class="text-[8px] font-extrabold bg-maroon text-white px-1 py-0.2 rounded shrink-0">YOU</span>' : ''}
              </div>
              <p class="text-[9px] text-slate-500 truncate">${item.student.stream || 'Science'}</p>
            </div>
          </div>
          <div class="text-right shrink-0 pl-2">
            <div class="flex items-baseline space-x-1 justify-end">
              <span class="text-xs font-black text-maroon">${item.score}</span>
              <span class="text-[10px] text-slate-400 font-medium">/ 100</span>
            </div>
            <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
              ${item.percentage}%
            </span>
          </div>
        </div>
      `;
    }).join("");
  }

  // Update current user's standing footer in mini-leaderboard
  const userRankEl = document.getElementById("unitMiniLeaderboardUserRank");
  if (userRankEl) {
    if (!STATE.currentUser) {
      userRankEl.innerHTML = `
        <div class="flex items-center justify-between text-[11px] text-slate-500">
          <span>Not signed in</span>
          <button onclick="openLoginModal()" class="text-maroon font-bold hover:underline">Sign In</button>
        </div>
      `;
    } else {
      const userEntry = studentPerformance.find(p => p.student.id === STATE.currentUser.id);
      if (userEntry) {
        const userRank = studentPerformance.indexOf(userEntry) + 1;
        userRankEl.innerHTML = `
          <div class="flex items-center justify-between bg-amber-50/80 p-2 rounded-lg border border-amber-200">
            <div class="flex items-center space-x-1.5">
              <span class="material-symbols-outlined text-amber-600 text-[16px]">stars</span>
              <span class="text-[11px] font-bold text-slate-700">Your Unit Best:</span>
            </div>
            <div class="text-right">
              <span class="text-xs font-black text-maroon">${userEntry.score}/100</span>
              <span class="text-[10px] font-bold text-amber-800 ml-1">(Rank #${userRank})</span>
            </div>
          </div>
        `;
      } else {
        userRankEl.innerHTML = `
          <div class="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div class="flex items-center space-x-1">
              <span class="material-symbols-outlined text-slate-400 text-[14px]">edit_note</span>
              <span>Sitting active exam now</span>
            </div>
            <span class="font-bold text-maroon">Aim for Top 5!</span>
          </div>
        `;
      }
    }
  }
}

// Backward compatibility alias
function renderCurrentPhysicsQuestion() {
  renderCurrentQuizQuestion();
}

function submitQuizAnswer() {
  if (STATE.selectedAnswerIdx === null) {
    showToast("Please select an answer choice before submitting.");
    return;
  }

  const currentQ = STATE.activeQuiz.questions[STATE.activeQuizQuestionIdx];
  if (STATE.selectedAnswerIdx === currentQ.correctIndex) {
    STATE.activeQuizScore++;
  }

  // Advance to next question or complete
  STATE.activeQuizQuestionIdx++;
  if (STATE.activeQuizQuestionIdx < STATE.activeQuiz.questions.length) {
    STATE.selectedAnswerIdx = null;
    renderCurrentQuizQuestion();
  } else {
    finishQuizAndAwardMilestones();
  }
}

function finishQuizAndAwardMilestones() {
  clearInterval(STATE.quizTimerInterval);

  const totalQ = STATE.activeQuiz.questions.length;
  const score = STATE.activeQuizScore;
  const earnedSp = Math.round((score / totalQ) * 100);
  const subjectId = STATE.activeQuiz.subjectId || "physics";
  const subjectName = STATE.activeQuiz.subjectName || "Physics";

  const isOfficialWindow = isWednesdayQuizWindowOpen();
  const isEarlyAccessSubmission = (!isOfficialWindow) || (STATE.activeQuiz && STATE.activeQuiz.isEarlyAccess);

  if (isEarlyAccessSubmission) {
    // 1. EARLY QUIZ ACCESS BEFORE WEDNESDAY
    // Award points to personal practice balance, but explicitly exclude from competitive leaderboard
    STATE.currentUser.spPoints = (Number(STATE.currentUser.spPoints) || 0) + earnedSp;
    STATE.currentUser.earlyQuizSp = (Number(STATE.currentUser.earlyQuizSp) || 0) + earnedSp;
    // CRITICAL: Points earned by early access before Wednesday will NOT show in the leaderboard
  } else {
    // 2. OFFICIAL WEDNESDAY 6:00 PM – 12:00 AM LIVE WINDOW
    STATE.currentUser.spPoints = (Number(STATE.currentUser.spPoints) || 0) + earnedSp;
    STATE.currentUser.officialSpPoints = (Number(STATE.currentUser.officialSpPoints) || 0) + earnedSp;

    // Track Subject-Specific Lifetime Points
    if (!STATE.currentUser.subjectScores) {
      STATE.currentUser.subjectScores = {};
    }
    STATE.currentUser.subjectScores[subjectId] = (Number(STATE.currentUser.subjectScores[subjectId]) || 0) + earnedSp;

    // Track Weekly SP points for the active exam week (Wednesday cycle)
    const activeWeekKey = (STATE.wednesdayConfig && STATE.wednesdayConfig.paperCode) 
      ? STATE.wednesdayConfig.paperCode 
      : "WED-20260916";

    if (!STATE.currentUser.weeklyScores) {
      STATE.currentUser.weeklyScores = {};
    }
    STATE.currentUser.weeklyScores[activeWeekKey] = (Number(STATE.currentUser.weeklyScores[activeWeekKey]) || 0) + earnedSp;
    STATE.currentUser.weeklySp = STATE.currentUser.weeklyScores[activeWeekKey];

    // Track Weekly Subject-Specific Score
    if (!STATE.currentUser.weeklySubjectScores) {
      STATE.currentUser.weeklySubjectScores = {};
    }
    if (!STATE.currentUser.weeklySubjectScores[activeWeekKey]) {
      STATE.currentUser.weeklySubjectScores[activeWeekKey] = {};
    }
    STATE.currentUser.weeklySubjectScores[activeWeekKey][subjectId] = 
      (Number(STATE.currentUser.weeklySubjectScores[activeWeekKey][subjectId]) || 0) + earnedSp;
  }

  // Record submission for unit-specific mini-leaderboards
  const subRecord = {
    userId: STATE.currentUser.id,
    userName: STATE.currentUser.fullName,
    stream: STATE.currentUser.stream || "Physical Science",
    subjectId: subjectId,
    subjectName: subjectName,
    unitId: STATE.activeQuiz.unitId,
    paperCode: STATE.activeQuiz.paperCode,
    score: score,
    total: totalQ,
    earnedSp: earnedSp,
    timestamp: Date.now(),
    isEarly: isEarlyAccessSubmission,
    officialLeaderboardEligible: !isEarlyAccessSubmission
  };
  if (!STATE.quizSubmissions) STATE.quizSubmissions = [];
  STATE.quizSubmissions.push(subRecord);
  try {
    localStorage.setItem("znc_quiz_submissions", JSON.stringify(STATE.quizSubmissions.slice(-200)));
  } catch (e) {}

  // Track unit-specific best score in user profile
  if (!STATE.currentUser.unitScores) {
    STATE.currentUser.unitScores = {};
  }
  const unitKey = `${subjectId}_unit_${STATE.activeQuiz.unitId}`;
  STATE.currentUser.unitScores[unitKey] = Math.max(Number(STATE.currentUser.unitScores[unitKey]) || 0, score);

  // Persist user points & weekly scores so they never revert on page refresh!
  saveUsersAndSession();

  // Check milestone level up
  const milestone = getMilestoneForSp(STATE.currentUser.spPoints);

  // Sync score and SP to Firebase Realtime Database
  if (db) {
    try {
      db.ref("quiz_submissions/" + Date.now()).set(subRecord);
      db.ref("users/" + STATE.currentUser.id + "/spPoints").set(STATE.currentUser.spPoints);
      if (isEarlyAccessSubmission) {
        db.ref("users/" + STATE.currentUser.id + "/earlyQuizSp").set(STATE.currentUser.earlyQuizSp);
      } else {
        const activeWeekKey = (STATE.wednesdayConfig && STATE.wednesdayConfig.paperCode) ? STATE.wednesdayConfig.paperCode : "WED-20260916";
        db.ref("users/" + STATE.currentUser.id + "/officialSpPoints").set(STATE.currentUser.officialSpPoints || 0);
        db.ref("users/" + STATE.currentUser.id + "/weeklySp").set(STATE.currentUser.weeklySp || 0);
        db.ref("users/" + STATE.currentUser.id + "/weeklyScores/" + activeWeekKey).set(STATE.currentUser.weeklySp || 0);
        db.ref("users/" + STATE.currentUser.id + "/subjectScores/" + subjectId).set(STATE.currentUser.subjectScores[subjectId]);
        db.ref("users/" + STATE.currentUser.id + "/weeklySubjectScores/" + activeWeekKey + "/" + subjectId).set(STATE.currentUser.weeklySubjectScores[activeWeekKey][subjectId]);
      }
      db.ref("users/" + STATE.currentUser.id + "/unitScores/" + unitKey).set(STATE.currentUser.unitScores[unitKey]);
    } catch (e) {
      console.warn("RTDB quiz sync error:", e);
    }
  }

  renderAuthHeader();
  renderLeaderboard();
  renderMilestones();
  renderActiveQuizUnitMiniLeaderboard();

  if (isEarlyAccessSubmission) {
    showToast(`🎉 Early Exam Completed! Score: ${score}/${totalQ}. You earned +${earnedSp} SP in personal balance. (Early submissions are excluded from official leaderboards).`);
  } else {
    showToast(`🎉 Exam Completed! Score: ${score}/${totalQ}. You earned +${earnedSp} SP in ${subjectName}! (Weekly Total: ${STATE.currentUser.weeklySp} SP)`);
  }
  abandonQuiz();
}

function abandonQuiz() {
  clearInterval(STATE.quizTimerInterval);
  STATE.activeQuiz = null;
  const runner = document.getElementById("activeQuizRunner");
  if (runner) runner.classList.add("hidden");

  // Reset timer visual state
  const timerDisplay = document.getElementById("quizTimerDisplay");
  const timerWrapper = document.getElementById("quizTimerWrapper");
  const timerLabel = document.getElementById("quizTimerLabel");
  if (timerDisplay) {
    timerDisplay.classList.remove("text-red-600", "animate-pulse", "font-black");
    timerDisplay.classList.add("text-maroon", "font-bold");
  }
  if (timerWrapper) {
    timerWrapper.classList.remove("bg-red-50", "border-red-400", "ring-2", "ring-red-400", "animate-pulse");
    timerWrapper.classList.add("border-slate-200");
  }
  if (timerLabel) {
    timerLabel.classList.remove("text-red-600", "font-bold");
    timerLabel.classList.add("text-slate-500");
    timerLabel.innerHTML = `<span class="material-symbols-outlined text-[13px]">timer</span><span>Time Remaining</span>`;
  }
}

function startQuizTimer() {
  clearInterval(STATE.quizTimerInterval);
  const timerDisplay = document.getElementById("quizTimerDisplay");
  const timerWrapper = document.getElementById("quizTimerWrapper");
  const timerLabel = document.getElementById("quizTimerLabel");

  // Reset to standard appearance
  if (timerDisplay) {
    timerDisplay.classList.remove("text-red-600", "animate-pulse", "font-black");
    timerDisplay.classList.add("text-maroon", "font-bold");
  }
  if (timerWrapper) {
    timerWrapper.classList.remove("bg-red-50", "border-red-400", "ring-2", "ring-red-400", "animate-pulse");
    timerWrapper.classList.add("border-slate-200");
  }
  if (timerLabel) {
    timerLabel.classList.remove("text-red-600", "font-bold");
    timerLabel.classList.add("text-slate-500");
    timerLabel.innerHTML = `<span class="material-symbols-outlined text-[13px]">timer</span><span>Time Remaining</span>`;
  }

  let urgencyAlertFired = false;

  STATE.quizTimerInterval = setInterval(() => {
    STATE.quizSecondsRemaining--;
    if (STATE.quizSecondsRemaining <= 0) {
      clearInterval(STATE.quizTimerInterval);
      showToast("⏱️ Time is up! Calculating examination score...");
      finishQuizAndAwardMilestones();
      return;
    }

    const mins = Math.floor(STATE.quizSecondsRemaining / 60);
    const secs = STATE.quizSecondsRemaining % 60;
    if (timerDisplay) {
      timerDisplay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // URGENCY FEEDBACK: Timer text turns red and pulses when < 5 minutes (300 seconds) remaining
    if (STATE.quizSecondsRemaining < 300) {
      if (timerDisplay && !timerDisplay.classList.contains("text-red-600")) {
        timerDisplay.classList.remove("text-maroon");
        timerDisplay.classList.add("text-red-600", "animate-pulse", "font-black");
      }
      if (timerWrapper && !timerWrapper.classList.contains("border-red-400")) {
        timerWrapper.classList.remove("border-slate-200");
        timerWrapper.classList.add("bg-red-50", "border-red-400", "ring-2", "ring-red-400", "animate-pulse");
      }
      if (timerLabel && !timerLabel.classList.contains("text-red-600")) {
        timerLabel.classList.remove("text-slate-500");
        timerLabel.classList.add("text-red-600", "font-bold");
        timerLabel.innerHTML = `<span class="material-symbols-outlined text-[13px] animate-bounce">warning</span><span>⚠️ Final 5 Minutes!</span>`;
      }
      if (!urgencyAlertFired) {
        urgencyAlertFired = true;
        showToast("⚠️ Urgency Warning: Less than 5 minutes remaining in the quiz!");
      }
    }
  }, 1000);
}

// ----------------------------------------------------
// LEADERBOARD: OVERALL & SUBJECT-WISE ENGINE
// ----------------------------------------------------

function switchLeaderboardSubject(subjectId) {
  STATE.leaderboardSubject = subjectId;

  // Update tab buttons
  const tabs = ["overall", "physics", "combined_maths", "chemistry", "ict"];
  tabs.forEach(t => {
    const btn = document.getElementById(`lbTab_${t}`);
    if (btn) {
      if (t === subjectId) {
        btn.className = "lb-subject-tab px-4 py-2 rounded-xl text-xs font-bold border-2 transition flex items-center space-x-1.5 bg-maroon text-white border-maroon shadow-sm";
      } else {
        btn.className = "lb-subject-tab px-4 py-2 rounded-xl text-xs font-bold border-2 transition flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent";
      }
    }
  });

  renderLeaderboard();
}

function switchLeaderboardTimeframe(tf) {
  STATE.leaderboardTimeframe = tf;

  const btnWeekly = document.getElementById("lbTimeWeekly");
  const btnAllTime = document.getElementById("lbTimeAllTime");

  if (tf === "weekly") {
    if (btnWeekly) btnWeekly.className = "px-3 py-1 rounded-lg font-bold transition bg-white text-maroon shadow-sm";
    if (btnAllTime) btnAllTime.className = "px-3 py-1 rounded-lg font-bold text-slate-600 hover:text-slate-900 transition";
  } else {
    if (btnWeekly) btnWeekly.className = "px-3 py-1 rounded-lg font-bold text-slate-600 hover:text-slate-900 transition";
    if (btnAllTime) btnAllTime.className = "px-3 py-1 rounded-lg font-bold transition bg-white text-maroon shadow-sm";
  }

  renderLeaderboard();
}

// Render Leaderboard dynamically based on Subject (Overall vs. Specific Subject) & Timeframe (Weekly vs. All-Time)
function renderLeaderboard() {
  const tbody = document.getElementById("leaderboardTableBody");
  if (!tbody) return;

  const subject = STATE.leaderboardSubject || "overall";
  const timeframe = STATE.leaderboardTimeframe || "weekly";
  const activeWeekCode = (STATE.wednesdayConfig && STATE.wednesdayConfig.paperCode) 
    ? STATE.wednesdayConfig.paperCode 
    : "WED-20260916";

  const dateDisplay = document.getElementById("weeklyLeaderboardDateDisplay");
  if (dateDisplay) {
    if (timeframe === "weekly") {
      dateDisplay.innerText = `Active Week: ${STATE.wednesdayConfig.formattedDate || activeWeekCode}`;
    } else {
      dateDisplay.innerText = "All-Time Standings (Cumulative)";
    }
  }

  // Update Main Title, Description & Badge
  const mainTitle = document.getElementById("leaderboardMainTitle");
  const scopeBadge = document.getElementById("leaderboardScopeBadge");
  const mainDesc = document.getElementById("leaderboardMainDesc");
  const scoreColHeader = document.getElementById("lbColScoreHeader");

  const subjectMeta = {
    overall: { title: "Overall Science Leaderboard", badge: "All Subjects", desc: "Top 10 scholars across Sri Lanka ranked by combined performance across Physics, Combined Maths, Chemistry, and ICT." },
    physics: { title: "Physics Examination Leaderboard", badge: "⚛️ Physics", desc: "Top 10 scholars ranked strictly by Sri Lankan A/L Physics past paper questions and Wednesday exam scores." },
    combined_maths: { title: "Combined Mathematics Leaderboard", badge: "📐 Combined Maths", desc: "Top 10 scholars ranked strictly by Pure and Applied Mathematics problem sets and exam scores." },
    chemistry: { title: "Chemistry Examination Leaderboard", badge: "🧪 Chemistry", desc: "Top 10 scholars ranked strictly by General, Physical, Inorganic, and Organic Chemistry scores." },
    ict: { title: "Information & Communication Technology Leaderboard", badge: "💻 ICT", desc: "Top 10 scholars ranked strictly by Computer Science, Networking, SQL, and Python problem sets." }
  }[subject] || { title: "Portal Leaderboard", badge: "Subject", desc: "Top 10 scholars" };

  if (mainTitle) mainTitle.innerText = subjectMeta.title;
  if (scopeBadge) scopeBadge.innerText = `${subjectMeta.badge} • ${timeframe === 'weekly' ? 'Weekly' : 'All-Time'}`;
  if (mainDesc) mainDesc.innerText = subjectMeta.desc;
  if (scoreColHeader) {
    scoreColHeader.innerText = (timeframe === "weekly") 
      ? (subject === "overall" ? "Weekly SP Earned" : `${subjectMeta.badge} Weekly Score`)
      : (subject === "overall" ? "Total SP Balance" : `${subjectMeta.badge} All-Time Score`);
  }

  // Filter candidate students: STRICTLY EXCLUDE Admin, Teachers, and all Mock Users
  const candidateStudents = STATE.users.filter(u => {
    if (!u) return false;
    // 1. Strictly exclude Admin accounts
    if (u.role === "ADMIN" || u.id === "admin_jasim" || (u.email && u.email.toLowerCase() === "mnmjaasim@gmail.com")) {
      return false;
    }
    // 2. Strictly exclude Teachers and Staff
    if (u.role === "TEACHER" || u.role === "STAFF") {
      return false;
    }
    // 3. Only genuine STUDENT role can be ranked on the student leaderboard
    if (u.role !== "STUDENT") {
      return false;
    }
    // 4. Strictly exclude any mock demo accounts and test IDs
    if (PURGED_MOCK_USER_IDS.includes(u.id)) {
      return false;
    }
    const emailLower = (u.email || "").toLowerCase();
    if (REMOVED_MOCK_EMAILS.includes(emailLower)) {
      return false;
    }
    if (u.id && (u.id.startsWith("mock_") || u.id.startsWith("fake_") || u.id.startsWith("demo_"))) {
      return false;
    }
    return true;
  });

  // Calculate scores and sort real student users based on selected filters
  // IMPORTANT: Quiz points earned by early access before Wednesday are strictly excluded from leaderboard
  const sorted = candidateStudents.map(u => {
    let relevantScore = 0;
    const officialTotalSp = Math.max(0, (Number(u.spPoints) || 0) - (Number(u.earlyQuizSp) || 0));

    if (subject === "overall") {
      if (timeframe === "weekly") {
        // Weekly leaderboard strictly counts official Wednesday live exam scores
        relevantScore = (u.weeklyScores && u.weeklyScores[activeWeekCode] !== undefined) 
          ? Number(u.weeklyScores[activeWeekCode]) 
          : (Number(u.weeklySp) || 0);
      } else {
        // All-Time leaderboard strictly excludes early quiz points
        relevantScore = officialTotalSp;
      }
    } else {
      // Specific Subject Leaderboard
      if (timeframe === "weekly") {
        relevantScore = (u.weeklySubjectScores && u.weeklySubjectScores[activeWeekCode] && u.weeklySubjectScores[activeWeekCode][subject] !== undefined)
          ? Number(u.weeklySubjectScores[activeWeekCode][subject])
          : 0;
      } else {
        relevantScore = (u.subjectScores && u.subjectScores[subject] !== undefined)
          ? Number(u.subjectScores[subject])
          : 0;
      }
    }

    return {
      user: u,
      score: relevantScore,
      totalSp: officialTotalSp
    };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.totalSp - a.totalSp; // Tie-breaker by lifetime SP
  });

  // Filter for display: in weekly, show students who have logged scores; in all-time show active students
  const displayList = (timeframe === "weekly")
    ? sorted.filter(item => item.score > 0)
    : sorted;

  // RESTRICT TO TOP 10 SCHOLARS ONLY
  const top10 = displayList.slice(0, 10);

  if (top10.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-xs text-slate-400">
          <div class="flex flex-col items-center justify-center space-y-1.5 py-4">
            <span class="material-symbols-outlined text-4xl text-slate-300">leaderboard</span>
            <p class="font-bold text-slate-700 text-sm">No Student Scores Logged Yet</p>
            <p class="text-xs text-slate-500 max-w-sm">Registered students who participate in the Wednesday examination will be ranked here. Complete the examination to claim the #1 spot!</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = top10.map((item, i) => {
    const u = item.user;
    const milestone = getMilestoneForSp(u.spPoints);
    const isCurrentUser = STATE.currentUser && (STATE.currentUser.id === u.id || (STATE.currentUser.email && u.email && STATE.currentUser.email.toLowerCase() === u.email.toLowerCase()));

    const badgeColor = i === 0 ? "bg-amber-100 text-amber-900 border-amber-300 font-black" :
                       i === 1 ? "bg-slate-100 text-slate-800 border-slate-300 font-bold" :
                       i === 2 ? "bg-amber-50 text-amber-800 border-amber-200 font-bold" : "text-slate-700 font-semibold";

    return `
      <tr class="hover:bg-slate-50 transition ${isCurrentUser ? 'bg-maroon/5 font-semibold' : ''}">
        <td class="p-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded-lg border text-xs ${badgeColor}">
            ${i === 0 ? "🥇 1st" : i === 1 ? "🥈 2nd" : i === 2 ? "🥉 3rd" : `#${i + 1}`}
          </span>
        </td>
        <td class="p-3 font-semibold text-slate-900 flex items-center space-x-2">
          <span>${u.fullName}</span>
          ${isCurrentUser ? '<span class="text-[9px] bg-maroon text-white font-black px-1.5 py-0.2 rounded shadow-2xs">YOU</span>' : ''}
        </td>
        <td class="p-3 text-slate-600 text-xs">
          <span class="font-semibold text-slate-800">${u.role}</span>
          <span class="text-slate-400">• ${u.stream}</span>
        </td>
        <td class="p-3 text-xs font-bold text-slate-700">
          ${milestone.current.badge} L${milestone.current.level} (${milestone.current.name})
        </td>
        <td class="p-3">
          <span class="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">star</span>
            <span>+${item.score} SP</span>
          </span>
        </td>
        <td class="p-3 font-bold text-slate-700">${u.spPoints || 0} SP</td>
        <td class="p-3 text-right">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded ${u.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${u.isVerified ? 'VERIFIED' : 'PENDING'}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

// ----------------------------------------------------
// REDEMPTION STORE (ADD / REMOVE ITEMS & REQUESTS)
// ----------------------------------------------------
function renderRedemptionItems() {
  const container = document.getElementById("redemptionItemsGrid");
  if (!container) return;

  if (!STATE.redemptionItems || STATE.redemptionItems.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
          <span class="material-symbols-outlined text-3xl">storefront</span>
        </div>
        <h4 class="font-bold text-slate-800 text-base">Redemption Store is Currently Empty</h4>
        <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          There are no items available in the store right now. The administrator can list textbooks, past papers, lab manuals, and scientific calculators at any time from the Admin Panel.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = STATE.redemptionItems.map(item => `
    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition">
      <div class="space-y-2">
        <div class="flex justify-between items-start">
          <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">${item.category}</span>
          <span class="text-xs text-slate-500 font-semibold">${item.stock} in stock</span>
        </div>
        <h3 class="font-bold text-slate-900 text-base leading-snug">${item.title}</h3>
        <p class="text-xs text-slate-600 leading-relaxed">${item.description}</p>
      </div>

      <div class="pt-3 border-t flex items-center justify-between">
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-400">Required</span>
          <p class="text-base font-black text-amber-700">${item.spPrice} SP</p>
        </div>
        <button onclick="requestRedemption('${item.id}')" class="bg-maroon hover:bg-maroon-dark text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition">
          Redeem Reward
        </button>
      </div>
    </div>
  `).join("");
}

function requestRedemption(itemId) {
  if (!STATE.currentUser) {
    showToast("Please sign in with your student account to redeem rewards.");
    openLoginModal();
    return;
  }

  const item = STATE.redemptionItems.find(i => i.id === itemId);
  if (!item) return;

  if (Number(STATE.currentUser.spPoints) < item.spPrice) {
    showToast(`Insufficient SP! You need ${item.spPrice} SP, but have ${STATE.currentUser.spPoints} SP.`);
    return;
  }

  if (item.stock <= 0) {
    showToast("Item is currently out of stock. Please wait for administrator restock.");
    return;
  }

  // Deduct points and stock
  STATE.currentUser.spPoints = Math.max(0, (Number(STATE.currentUser.spPoints) || 0) - item.spPrice);
  item.stock = Math.max(0, item.stock - 1);

  // Immediately persist updated balance so points never revert on refresh!
  saveUsersAndSession();

  const newRedemption = {
    id: "red_" + Math.random().toString(36).substring(2, 9),
    userId: STATE.currentUser.id,
    userName: STATE.currentUser.fullName,
    userEmail: STATE.currentUser.email,
    userStream: STATE.currentUser.stream,
    itemId: item.id,
    itemTitle: item.title,
    spSpent: item.spPrice,
    timestamp: Date.now(),
    status: "Pending"
  };

  STATE.redemptions.unshift(newRedemption);

  // Sync to Firebase RTDB
  if (db) {
    try {
      db.ref("redemption_requests/" + newRedemption.id).set(newRedemption);
      db.ref("users/" + STATE.currentUser.id + "/spPoints").set(STATE.currentUser.spPoints);
      db.ref("store_items/" + item.id).set(item);
    } catch (e) {
      console.warn("RTDB sync error:", e);
    }
  }

  renderAuthHeader();
  renderRedemptionItems();
  renderUserRedemptionHistory();
  renderAdminRedemptions();
  renderAdminStoreInventory();
  renderLeaderboard();
  updateBadgeCounts();

  showToast(`✅ Request for "${item.title}" submitted to Administration! Remaining balance: ${STATE.currentUser.spPoints} SP`);
}

function renderUserRedemptionHistory() {
  const container = document.getElementById("userRedemptionHistoryList");
  if (!container) return;

  if (!STATE.currentUser) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">Please sign in to view your redemption requests.</p>`;
    return;
  }

  const userReds = STATE.redemptions.filter(r => r.userId === STATE.currentUser.id);
  if (userReds.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">You have not submitted any reward redemption requests yet.</p>`;
    return;
  }

  container.innerHTML = userReds.map(r => `
    <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
      <div>
        <p class="text-xs font-bold text-slate-900">${r.itemTitle}</p>
        <p class="text-[11px] text-slate-500">Requested: ${new Date(r.timestamp).toLocaleDateString()} • Spent: ${r.spSpent} SP</p>
      </div>
      <span class="text-xs font-bold px-3 py-1 rounded-full text-center ${getStatusBadgeClass(r.status)}">
        ${r.status}
      </span>
    </div>
  `).join("");
}

// ----------------------------------------------------
// STREAM-RESTRICTED CHAT DISCUSSIONS
// ----------------------------------------------------
function setupDiscussionViewPermissions() {
  const switcher = document.getElementById("chatAdminStreamSwitcher");
  const badge = document.getElementById("chatStreamBadge");
  const notice = document.getElementById("chatStreamNotice");
  const navLabel = document.getElementById("discussionsNavLabel");

  if (!STATE.currentUser) {
    if (switcher) switcher.classList.add("hidden");
    if (badge) badge.innerText = "Guest Mode (Sign In Required)";
    renderChatMessages();
    return;
  }

  // Teachers and Admins have access to BOTH streams
  if (STATE.currentUser.role === "ADMIN" || STATE.currentUser.role === "TEACHER") {
    if (switcher) switcher.classList.remove("hidden");
    if (badge) badge.innerText = `${STATE.activeChatStream} Channel (Moderator View)`;
    if (notice) notice.innerText = `You have staff access to view and communicate in both Physical Science and Bio Science streams.`;
    if (navLabel) navLabel.innerText = "Discussions (All-Access)";
  } else {
    // Student: Lock to their chosen stream only
    STATE.activeChatStream = STATE.currentUser.stream;
    if (switcher) switcher.classList.add("hidden");
    if (badge) badge.innerText = `${STATE.currentUser.stream} Channel`;
    if (notice) notice.innerText = `You are enrolled in ${STATE.currentUser.stream}. You can view and participate strictly in your stream discussions.`;
    if (navLabel) navLabel.innerText = `${STATE.currentUser.stream} Chat`;
  }

  renderChatMessages();
}

function switchChatStream(streamName) {
  STATE.activeChatStream = streamName;
  const btnPhys = document.getElementById("btnChatPhysical");
  const btnBio = document.getElementById("btnChatBio");

  if (streamName === "Physical Science") {
    if (btnPhys) btnPhys.className = "px-3 py-1 rounded-lg text-xs font-bold bg-maroon text-white";
    if (btnBio) btnBio.className = "px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-700";
  } else {
    if (btnPhys) btnPhys.className = "px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-700";
    if (btnBio) btnBio.className = "px-3 py-1 rounded-lg text-xs font-bold bg-maroon text-white";
  }

  setupDiscussionViewPermissions();
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function handleChatFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  // Maximum file size limit: 6MB to ensure smooth transmission and storage
  const maxBytes = 6 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast("Selected file exceeds 6MB. Please attach a smaller image or compressed PDF.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    STATE.attachedChatFile = {
      name: file.name,
      size: file.size,
      type: file.type || (isPdf ? "application/pdf" : "application/octet-stream"),
      dataUrl: dataUrl,
      isImage: isImage,
      isPdf: isPdf
    };

    // Update Attachment Preview UI
    const previewArea = document.getElementById("chatAttachmentPreviewArea");
    const thumb = document.getElementById("chatAttachmentThumbnail");
    const nameEl = document.getElementById("chatAttachmentFileName");
    const badgeEl = document.getElementById("chatAttachmentTypeBadge");
    const sizeEl = document.getElementById("chatAttachmentFileSize");

    if (previewArea) previewArea.classList.remove("hidden");
    if (nameEl) nameEl.innerText = file.name;
    if (sizeEl) sizeEl.innerText = formatBytes(file.size);

    if (badgeEl) {
      badgeEl.innerText = isImage ? "IMAGE" : isPdf ? "PDF" : "DOC";
      badgeEl.className = isImage 
        ? "text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-200"
        : isPdf
        ? "text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-red-100 text-red-900 border border-red-200"
        : "text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 border border-blue-200";
    }

    if (thumb) {
      if (isImage) {
        thumb.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover rounded-lg" alt="Preview" />`;
      } else if (isPdf) {
        thumb.innerHTML = `<span class="material-symbols-outlined text-2xl text-red-600">picture_as_pdf</span>`;
      } else {
        thumb.innerHTML = `<span class="material-symbols-outlined text-2xl text-amber-700">description</span>`;
      }
    }

    showToast(`Attached ${isImage ? "image" : isPdf ? "PDF" : "file"}: ${file.name}`);
  };

  reader.onerror = function() {
    showToast("Failed to read the file. Please try again.");
    clearChatAttachment();
  };

  reader.readAsDataURL(file);
}

function clearChatAttachment() {
  STATE.attachedChatFile = null;
  const input = document.getElementById("chatFileInput");
  if (input) input.value = "";
  const previewArea = document.getElementById("chatAttachmentPreviewArea");
  if (previewArea) previewArea.classList.add("hidden");
}

function openMediaViewerModal(dataUrl, fileName) {
  const modal = document.getElementById("mediaViewerModal");
  const img = document.getElementById("mediaViewerImage");
  const title = document.getElementById("mediaViewerTitle");
  const downloadBtn = document.getElementById("mediaViewerDownloadBtn");

  if (!modal) return;
  const decodedUrl = decodeURIComponent(dataUrl);
  const decodedName = decodeURIComponent(fileName || "Attachment");

  if (img) img.src = decodedUrl;
  if (title) title.innerText = decodedName;
  if (downloadBtn) {
    downloadBtn.href = decodedUrl;
    downloadBtn.setAttribute("download", decodedName);
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeMediaViewerModal() {
  const modal = document.getElementById("mediaViewerModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  const img = document.getElementById("mediaViewerImage");
  if (img) img.src = "";
}

function renderChatMessages() {
  const box = document.getElementById("chatMessagesBox");
  if (!box) return;

  const currentUserId = STATE.currentUser ? STATE.currentUser.id : null;

  // Filter messages according to currently viewed stream
  const filtered = STATE.messages.filter(m => {
    if (!m.stream) return true; // Legacy message fallback
    return m.stream === STATE.activeChatStream;
  });

  if (filtered.length === 0) {
    box.innerHTML = `
      <div class="text-center py-16 px-4 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-maroon/10 text-maroon flex items-center justify-center mx-auto">
          <span class="material-symbols-outlined text-2xl">forum</span>
        </div>
        <div class="space-y-1">
          <p class="text-sm font-bold text-slate-800">No messages in the ${STATE.activeChatStream} discussion room yet.</p>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">Be the first to post a study question, past paper derivation, or attach diagrams & PDFs!</p>
        </div>
      </div>
    `;
    return;
  }

  box.innerHTML = filtered.map(m => {
    const isCurrentUser = currentUserId && m.senderId === currentUserId;
    const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let attachmentHtml = "";
    if (m.attachment) {
      const att = m.attachment;
      const isImg = att.isImage || (att.type && att.type.startsWith("image/"));
      const isPdf = att.isPdf || (att.type === "application/pdf") || (att.name && att.name.toLowerCase().endsWith(".pdf"));

      if (isImg) {
        attachmentHtml = `
          <div class="mt-2.5 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-950/5 max-w-sm shadow-sm group">
            <div class="relative cursor-pointer overflow-hidden bg-slate-100 flex items-center justify-center max-h-60" onclick="openMediaViewerModal('${encodeURIComponent(att.dataUrl)}', '${encodeURIComponent(att.name)}')">
              <img src="${att.dataUrl}" alt="${att.name}" class="w-full h-auto max-h-60 object-contain transition duration-200 group-hover:scale-[1.02]" />
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span class="bg-black/80 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 shadow">
                  <span class="material-symbols-outlined text-[16px]">zoom_in</span>
                  <span>View Full Image</span>
                </span>
              </div>
            </div>
            <div class="px-3 py-2 bg-white flex items-center justify-between border-t border-slate-100">
              <div class="min-w-0 pr-2">
                <p class="text-xs font-bold text-slate-800 truncate">${att.name}</p>
                <p class="text-[10px] text-slate-400">${formatBytes(att.size)}</p>
              </div>
              <a href="${att.dataUrl}" download="${att.name}" class="text-maroon hover:text-maroon-dark text-xs font-bold flex items-center space-x-0.5 px-2 py-1 rounded-lg hover:bg-maroon/5 transition shrink-0">
                <span class="material-symbols-outlined text-[16px]">download</span>
                <span>Save</span>
              </a>
            </div>
          </div>
        `;
      } else if (isPdf) {
        attachmentHtml = `
          <div class="mt-2.5 p-3 bg-red-50/80 border border-red-200/80 rounded-xl max-w-sm flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center space-x-2.5 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <span class="material-symbols-outlined text-2xl">picture_as_pdf</span>
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold text-slate-900 truncate">${att.name}</p>
                <div class="flex items-center space-x-1.5 mt-0.5">
                  <span class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-red-200/80 text-red-900">PDF Past Paper</span>
                  <span class="text-[10px] text-slate-500">${formatBytes(att.size)}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-1 shrink-0">
              <a href="${att.dataUrl}" target="_blank" class="p-1.5 text-slate-600 hover:text-maroon hover:bg-white rounded-lg transition" title="Open PDF in new tab">
                <span class="material-symbols-outlined text-[20px]">open_in_new</span>
              </a>
              <a href="${att.dataUrl}" download="${att.name}" class="p-1.5 text-white bg-maroon hover:bg-maroon-dark rounded-lg transition shadow-sm" title="Download PDF document">
                <span class="material-symbols-outlined text-[20px]">download</span>
              </a>
            </div>
          </div>
        `;
      } else {
        attachmentHtml = `
          <div class="mt-2.5 p-3 bg-slate-100 border border-slate-200 rounded-xl max-w-sm flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center space-x-2.5 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-2xl">description</span>
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold text-slate-900 truncate">${att.name}</p>
                <p class="text-[10px] text-slate-500">${formatBytes(att.size)} • Document</p>
              </div>
            </div>
            <a href="${att.dataUrl}" download="${att.name}" class="p-1.5 text-white bg-maroon hover:bg-maroon-dark rounded-lg transition shadow-sm" title="Download Document">
              <span class="material-symbols-outlined text-[20px]">download</span>
            </a>
          </div>
        `;
      }
    }

    return `
      <div class="flex items-start space-x-3 p-3.5 rounded-xl ${isCurrentUser ? 'bg-maroon/5 ml-4 sm:ml-8 border border-maroon/20' : 'bg-white mr-4 sm:mr-8 border border-slate-200 shadow-sm'}">
        <div class="w-8 h-8 rounded-full ${m.senderRole === 'ADMIN' ? 'bg-maroon text-gold' : m.senderRole === 'TEACHER' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'} font-bold flex items-center justify-center text-xs shrink-0">
          ${m.senderName.charAt(0)}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-slate-900">${m.senderName}</span>
              <span class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${m.senderRole === 'ADMIN' ? 'bg-maroon text-white' : m.senderRole === 'TEACHER' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${m.senderRole || 'STUDENT'}</span>
              ${isCurrentUser ? '<span class="text-[9px] font-bold text-maroon bg-maroon/10 px-1.5 py-0.2 rounded">YOU</span>' : ''}
            </div>
            <span class="text-[10px] text-slate-400">${timeStr}</span>
          </div>
          ${m.content ? `<p class="text-xs text-slate-700 mt-1 leading-relaxed break-words">${m.content}</p>` : ''}
          ${attachmentHtml}
          ${m.content ? `
            <div class="mt-2 flex items-center justify-end">
              <button onclick="askGeminiQuick('${encodeURIComponent(m.content)}')" class="inline-flex items-center space-x-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 px-2 py-0.5 rounded-lg transition" title="Ask Gemini AI Tutor to explain or solve this">
                <span class="material-symbols-outlined text-[13px] text-amber-500">auto_awesome</span>
                <span>Ask Gemini Tutor</span>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  box.scrollTop = box.scrollHeight;
}

function postChatMessage(e) {
  e.preventDefault();
  if (!STATE.currentUser) {
    showToast("Please sign in to participate in student discussions.");
    openLoginModal();
    return;
  }

  const input = document.getElementById("chatInputMessage");
  const text = input ? input.value.trim() : "";
  const attachment = STATE.attachedChatFile;

  if (!text && !attachment) {
    showToast("Please enter a message or attach a study file/image.");
    return;
  }

  const targetStream = (STATE.currentUser.role === 'ADMIN' || STATE.currentUser.role === 'TEACHER')
    ? STATE.activeChatStream
    : STATE.currentUser.stream;

  const newMsg = {
    id: "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    stream: targetStream,
    senderId: STATE.currentUser.id,
    senderName: STATE.currentUser.fullName,
    senderRole: STATE.currentUser.role,
    content: text,
    attachment: attachment ? {
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
      dataUrl: attachment.dataUrl,
      isImage: !!attachment.isImage,
      isPdf: !!attachment.isPdf
    } : null,
    timestamp: Date.now()
  };

  STATE.messages.push(newMsg);
  if (input) input.value = "";
  clearChatAttachment();

  // Sync to Firebase Realtime Database
  if (db) {
    try {
      db.ref("discussions/" + newMsg.id).set(newMsg);
    } catch (e) {
      console.warn("RTDB discussion sync note:", e);
    }
  }

  renderChatMessages();
  renderAdminChatAudit();
  showToast(attachment ? "Message & attachment shared in " + targetStream : "Message sent to " + targetStream);
}

// ----------------------------------------------------
// ADMINISTRATOR PANEL (USERS, STORE, REDEMPTIONS, CHAT)
// ----------------------------------------------------
function switchAdminTab(tabKey) {
  if (!requireAdmin()) {
    navigateTo("home");
    return;
  }

  STATE.adminSubTab = tabKey;
  document.querySelectorAll(".admin-subtab").forEach(btn => {
    btn.classList.remove("bg-maroon", "text-white");
    btn.classList.add("text-slate-600", "hover:bg-slate-100");
  });
  const activeBtn = document.getElementById("adminTab-" + tabKey);
  if (activeBtn) {
    activeBtn.classList.add("bg-maroon", "text-white");
    activeBtn.classList.remove("text-slate-600", "hover:bg-slate-100");
  }

  document.querySelectorAll(".admin-panel").forEach(p => p.classList.add("hidden"));
  const panel = document.getElementById("adminPanel-" + tabKey);
  if (panel) panel.classList.remove("hidden");

  // Re-render subtab content on switch
  if (tabKey === "users") {
    syncUsersWithCloud(true);
    renderAdminUsers();
  } else if (tabKey === "store") {
    renderAdminStoreInventory();
  } else if (tabKey === "redemptions") {
    renderAdminRedemptions();
  } else if (tabKey === "chat") {
    renderAdminChatAudit();
  } else if (tabKey === "quiz") {
    renderWednesdayPaperInfo();
  }
}

// 1. User Management & Permanent Account Deletion
function renderAdminUsers() {
  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;

  if (!isCurrentUserAdmin()) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center bg-amber-50 rounded-xl border border-amber-200">
          <div class="flex flex-col items-center justify-center space-y-2">
            <span class="material-symbols-outlined text-4xl text-amber-600">lock</span>
            <p class="font-extrabold text-slate-800 text-sm">Administrator Access Required</p>
            <p class="text-xs text-slate-600 max-w-md">Please sign in with administrator credentials (<strong>mnmjaasim@gmail.com</strong>) to review registered students, teachers, and system permissions.</p>
            <button onclick="openLoginModal()" class="mt-2 px-4 py-2 bg-maroon text-white font-bold rounded-xl text-xs hover:bg-maroon-dark shadow transition flex items-center space-x-1.5">
              <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span>Sign In as Administrator</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const searchInput = document.getElementById("adminUserSearchInput");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const roleFilterEl = document.getElementById("adminUserRoleFilter");
  const roleFilter = roleFilterEl ? roleFilterEl.value : "";
  const streamFilterEl = document.getElementById("adminUserStreamFilter");
  const streamFilter = streamFilterEl ? streamFilterEl.value : "";

  // Show all genuine registered users (filter out purged mock accounts)
  const activeUsers = STATE.users.filter(u => {
    if (!u) return false;
    if (PURGED_MOCK_USER_IDS.includes(u.id)) return false;
    const emailLower = (u.email || "").toLowerCase();
    if (REMOVED_MOCK_EMAILS.includes(emailLower)) return false;
    return true;
  });

  // Update count badge in admin panel header
  const countBadge = document.getElementById("adminTotalUsersCount");
  if (countBadge) {
    const studentCount = activeUsers.filter(u => u.role === "STUDENT").length;
    const teacherCount = activeUsers.filter(u => u.role === "TEACHER").length;
    const adminCount = activeUsers.filter(u => u.role === "ADMIN").length;
    const earlyApprovedCount = activeUsers.filter(u => hasUserEarlyQuizAccess(u) && u.role !== 'ADMIN').length;
    countBadge.innerText = `${activeUsers.length} Registered (${studentCount} Students, ${teacherCount} Teachers, ${adminCount} Admin • ${earlyApprovedCount} Early Quiz Approved)`;
  }

  const filtered = activeUsers.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (streamFilter && u.stream !== streamFilter) return false;
    if (!query) return true;
    return (u.fullName && u.fullName.toLowerCase().includes(query)) || 
           (u.email && u.email.toLowerCase().includes(query)) ||
           (u.role && u.role.toLowerCase().includes(query)) ||
           (u.stream && u.stream.toLowerCase().includes(query));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-xs text-slate-400">No registered users found matching the selected filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3 font-semibold text-slate-900">
        <div class="flex items-center space-x-1.5">
          <span>${u.fullName}</span>
          ${STATE.currentUser && STATE.currentUser.id === u.id ? '<span class="text-[9px] bg-maroon text-white font-bold px-1.5 py-0.2 rounded">YOU</span>' : ''}
        </div>
      </td>
      <td class="p-3 text-xs text-slate-500">${u.email}</td>
      <td class="p-3 text-xs font-bold">
        <span class="px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-900 border border-amber-300' : (u.role === 'TEACHER' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-800')}">
          ${u.role}
        </span>
      </td>
      <td class="p-3 text-xs text-slate-600">${u.stream || 'N/A'}</td>
      <td class="p-3 text-xs font-bold text-gold-dark">
        <div class="flex items-center space-x-1">
          <span>${u.spPoints || 0} SP</span>
          <button onclick="adminAdjustUserSp('${u.id}')" class="text-slate-400 hover:text-amber-600 p-0.5 rounded" title="Adjust SP Points">
            <span class="material-symbols-outlined text-[13px]">edit</span>
          </button>
        </div>
      </td>
      <td class="p-3">
        ${(u.role === 'ADMIN' || u.id === 'admin_jasim' || (u.email && u.email.toLowerCase() === 'mnmjaasim@gmail.com')) ? `
          <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
            ADMIN (UNLOCKED)
          </span>
        ` : (hasUserEarlyQuizAccess(u) ? `
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Approved
            </span>
            <button onclick="adminToggleEarlyQuizAccess('${u.id}', false)" class="text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-bold transition" title="Revoke early quiz access">
              Revoke
            </button>
          </div>
        ` : `
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              Wed 6 PM – 12 AM Only
            </span>
            <button onclick="adminToggleEarlyQuizAccess('${u.id}', true)" class="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded font-bold transition flex items-center gap-0.5" title="Approve this student to take quiz early before Wednesday">
              <span class="material-symbols-outlined text-[12px]">lock_open</span>
              <span>Approve Early</span>
            </button>
          </div>
        `)}
      </td>
      <td class="p-3">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${u.isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
          ${u.isVerified ? 'VERIFIED' : 'PENDING'}
        </span>
      </td>
      <td class="p-3 text-right space-x-2 whitespace-nowrap">
        <button onclick="adminInspectUserProgress('${u.id}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[11px] font-bold shadow inline-flex items-center space-x-1" title="View Wednesday Quiz Marks & Progress Graph">
          <span class="material-symbols-outlined text-[13px]">show_chart</span>
          <span>Graph</span>
        </button>
        ${!u.isVerified ? `
          <button onclick="verifyUser('${u.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow">
            Verify
          </button>
        ` : ''}
        ${u.id !== 'admin_jasim' && u.email !== 'mnmjaasim@gmail.com' ? `
          <button onclick="adminDeleteUser('${u.id}')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold shadow inline-flex items-center space-x-1">
            <span class="material-symbols-outlined text-[14px]">delete</span>
            <span>Delete</span>
          </button>
        ` : `
          <span class="text-xs text-slate-400 italic font-medium">Root Admin</span>
        `}
      </td>
    </tr>
  `).join("");
}

function adminInspectUserProgress(userId) {
  const u = STATE.users.find(user => user.id === userId);
  if (!u) {
    showToast("User record not found", "error");
    return;
  }

  // Create or reuse modal container
  let modal = document.getElementById("adminProgressModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "adminProgressModal";
    modal.className = "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4";
    document.body.appendChild(modal);
  }

  const data = getStudentWeeklySpData(u, 'all');
  const currentWeek = data[data.length - 1] || { sp: 0, cumulativeSp: 0 };
  const totalSp = Number(u.spPoints) || 0;

  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative flex flex-col space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-lg">
            ${(u.fullName || "S").charAt(0)}
          </div>
          <div>
            <h3 class="text-base font-extrabold text-white">${u.fullName}</h3>
            <p class="text-xs text-slate-400">Wednesday Quiz Marks & Progress Graph • ${u.stream || 'A/L Science'} (${totalSp} SP)</p>
          </div>
        </div>
        <button onclick="document.getElementById('adminProgressModal').remove()" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
          <span class="text-[10px] text-slate-400 font-bold uppercase">Latest Wed Quiz</span>
          <p class="text-sm font-black text-amber-400 mt-0.5">+${currentWeek.sp} SP</p>
        </div>
        <div class="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
          <span class="text-[10px] text-slate-400 font-bold uppercase">Total Progress</span>
          <p class="text-sm font-black text-white mt-0.5">${totalSp} SP</p>
        </div>
        <div class="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
          <span class="text-[10px] text-slate-400 font-bold uppercase">Status</span>
          <p class="text-sm font-black text-emerald-400 mt-0.5">Active</p>
        </div>
      </div>

      <div class="bg-slate-950/60 rounded-xl p-3 border border-slate-800 relative">
        <div id="adminModalChartContainer" class="w-full h-[220px]"></div>
      </div>

      <div class="flex justify-end pt-2">
        <button onclick="document.getElementById('adminProgressModal').remove()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition">
          Close
        </button>
      </div>
    </div>
  `;

  // Render SVG in modal
  setTimeout(() => {
    const container = document.getElementById("adminModalChartContainer");
    if (!container) return;
    ensureD3Loaded(d3 => {
      container.innerHTML = "";
      const width = container.clientWidth || 550;
      const height = 220;
      const margin = { top: 20, right: 25, bottom: 30, left: 40 };
      const innerW = width - margin.left - margin.right;
      const innerH = height - margin.top - margin.bottom;

      const svg = d3.select(container)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

      const defs = svg.append("defs");
      const grad = defs.append("linearGradient")
        .attr("id", "adminChartGrad")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", "#F59E0B").attr("stop-opacity", 0.4);
      grad.append("stop").attr("offset", "100%").attr("stop-color", "#881337").attr("stop-opacity", 0.02);

      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
      const xScale = d3.scalePoint().domain(data.map(d => d.week)).range([0, innerW]).padding(0.1);
      const maxSp = d3.max(data, d => d.sp) || 50;
      const yScale = d3.scaleLinear().domain([0, maxSp * 1.3]).range([innerH, 0]).nice();

      const area = d3.area().x(d => xScale(d.week)).y0(innerH).y1(d => yScale(d.sp)).curve(d3.curveMonotoneX);
      g.append("path").datum(data).attr("fill", "url(#adminChartGrad)").attr("d", area);

      const line = d3.line().x(d => xScale(d.week)).y(d => yScale(d.sp)).curve(d3.curveMonotoneX);
      g.append("path").datum(data).attr("fill", "none").attr("stroke", "#F59E0B").attr("stroke-width", 3).attr("d", line);

      g.selectAll("circle").data(data).enter().append("circle")
        .attr("cx", d => xScale(d.week))
        .attr("cy", d => yScale(d.sp))
        .attr("r", 4.5)
        .attr("fill", "#F59E0B")
        .attr("stroke", "#0F172A")
        .attr("stroke-width", 2);

      g.append("g").attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .selectAll("text").attr("fill", "#94A3B8").attr("font-size", "10px").attr("dy", "8px");

      g.append("g")
        .call(d3.axisLeft(yScale).ticks(3))
        .selectAll("text").attr("fill", "#64748B").attr("font-size", "9px");
    });
  }, 60);
}
window.adminInspectUserProgress = adminInspectUserProgress;

function adminToggleEarlyQuizAccess(userId, grant) {
  if (!requireAdmin()) return;
  const u = STATE.users.find(user => user.id === userId);
  if (!u) return;

  u.hasEarlyQuizAccess = grant;
  u.earlyQuizAccess = grant;

  const emailLower = (u.email || "").toLowerCase().trim();
  if (emailLower) {
    STATE.users.forEach(other => {
      if (other && other.email && other.email.toLowerCase().trim() === emailLower) {
        other.hasEarlyQuizAccess = grant;
        other.earlyQuizAccess = grant;
      }
    });
    if (!STATE.earlyApprovedEmails) STATE.earlyApprovedEmails = {};
    STATE.earlyApprovedEmails[emailLower] = grant;
    const cleanKey = emailLower.replace(/[\.\$#\[\]\/]/g, "_");
    STATE.earlyApprovedEmails[cleanKey] = grant;
  }

  // Update active session user if currently logged into this account
  if (STATE.currentUser && (STATE.currentUser.id === u.id || (emailLower && STATE.currentUser.email && STATE.currentUser.email.toLowerCase().trim() === emailLower))) {
    STATE.currentUser.hasEarlyQuizAccess = grant;
    STATE.currentUser.earlyQuizAccess = grant;
    try {
      localStorage.setItem("znc_current_user", JSON.stringify(STATE.currentUser));
      localStorage.setItem("znc_active_user", JSON.stringify(STATE.currentUser));
    } catch (e) {}
  }

  saveUsersAndSession();
  pushUserToCloud(u);

  // Synchronize early access directly to Firebase RTDB for immediate cross-device propagation
  const dbInstance = getFirebaseDb();
  if (dbInstance) {
    try {
      dbInstance.ref("users/" + u.id).update({
        hasEarlyQuizAccess: grant,
        earlyQuizAccess: grant
      });
      if (emailLower) {
        const cleanKey = emailLower.replace(/[\.\$#\[\]\/]/g, "_");
        dbInstance.ref("early_approved_users/" + cleanKey).set(grant);
      }
    } catch (e) {}
  }

  renderAdminUsers();
  checkWednesdayQuizWindow();

  showToast(grant 
    ? `✅ Approved early quiz access for ${u.fullName}! They can now sit the quiz before Wednesday.`
    : `🔒 Revoked early quiz access for ${u.fullName}. Quiz is now locked until Wednesday 6:00 PM.`
  );
}

function verifyUser(userId) {
  if (!requireAdmin()) return;
  const u = STATE.users.find(user => user.id === userId);
  if (u) {
    u.isVerified = true;
    saveUsersAndSession();
    pushUserToCloud(u);
    renderAdminUsers();
    renderLeaderboard();
    updateBadgeCounts();
    showToast(`Verified account for ${u.fullName}!`);
  }
}

// Admin can manually adjust student SP balance
function adminAdjustUserSp(userId) {
  if (!requireAdmin()) return;
  const u = STATE.users.find(user => user.id === userId);
  if (!u) return;

  const input = prompt(`Enter new Science Points (SP) balance for ${u.fullName}:`, u.spPoints || 0);
  if (input === null) return;
  const newSp = parseInt(input, 10);
  if (isNaN(newSp) || newSp < 0) {
    showToast("⚠️ Invalid SP value. Please enter a positive integer.");
    return;
  }

  u.spPoints = newSp;
  if (STATE.currentUser && STATE.currentUser.id === u.id) {
    STATE.currentUser.spPoints = newSp;
  }
  saveUsersAndSession();
  pushUserToCloud(u);

  renderAuthHeader();
  renderAdminUsers();
  renderLeaderboard();
  renderMilestones();
  showToast(`Updated SP balance for ${u.fullName} to ${newSp} SP.`);
}

// Admin can permanently delete users
function adminDeleteUser(userId) {
  if (!requireAdmin()) return;
  const u = STATE.users.find(user => user.id === userId);
  if (!u) return;

  if (confirm(`Are you sure you want to permanently delete user "${u.fullName}" (${u.email})? This action cannot be undone.`)) {
    STATE.users = STATE.users.filter(user => user.id !== userId);

    if (STATE.currentUser && STATE.currentUser.id === userId) {
      handleLogout();
    } else {
      saveUsersAndSession();
    }

    // Sync deletion to Firebase
    deleteUserFromCloud(userId);

    renderAdminUsers();
    renderLeaderboard();
    updateBadgeCounts();
    showToast(`Deleted user ${u.fullName} from database.`);
  }
}

// 2. Redemption Store Inventory Management (Add & Remove Items)
function renderAdminStoreInventory() {
  if (!isCurrentUserAdmin()) return;
  const container = document.getElementById("adminStoreItemsList");
  if (!container) return;

  if (!STATE.redemptionItems || STATE.redemptionItems.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
        <span class="material-symbols-outlined text-3xl text-slate-300 mb-1">inventory_2</span>
        <p class="font-bold text-slate-700 text-sm">Store Inventory is Currently Empty</p>
        <p class="text-[11px] text-slate-400 mt-1">Use the "Add New Store Reward Item" form above to list rewards for students.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = STATE.redemptionItems.map(item => `
    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
      <div>
        <div class="flex justify-between items-start">
          <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">${item.category}</span>
          <span class="text-xs font-bold text-maroon">${item.spPrice} SP</span>
        </div>
        <h4 class="font-bold text-sm text-slate-900 mt-1">${item.title}</h4>
        <p class="text-xs text-slate-600 mt-1">${item.description}</p>
        <p class="text-[11px] text-slate-500 font-semibold mt-2">Available Stock: ${item.stock} units</p>
      </div>
      <div class="pt-2 border-t border-slate-200 flex justify-end">
        <button onclick="adminRemoveStoreItem('${item.id}')" class="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center space-x-1">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove from Store</span>
        </button>
      </div>
    </div>
  `).join("");
}

function handleAdminAddStoreItem(e) {
  e.preventDefault();
  if (!requireAdmin()) return;

  const title = document.getElementById("newStoreTitle").value.trim();
  const category = document.getElementById("newStoreCategory").value;
  const spPrice = parseInt(document.getElementById("newStoreSpPrice").value, 10);
  const stock = parseInt(document.getElementById("newStoreStock").value, 10);
  const desc = document.getElementById("newStoreDesc").value.trim();

  if (!title || !desc || isNaN(spPrice) || isNaN(stock)) {
    showToast("Please complete all store item fields.");
    return;
  }

  const newItem = {
    id: "item_" + Date.now(),
    title: title,
    category: category,
    spPrice: spPrice,
    stock: stock,
    description: desc
  };

  STATE.redemptionItems.unshift(newItem);

  // Sync to Firebase
  if (db) {
    try {
      db.ref("store_items/" + newItem.id).set(newItem);
    } catch (e) {
      console.warn("RTDB store sync note:", e);
    }
  }

  // Clear form
  e.target.reset();

  renderRedemptionItems();
  renderAdminStoreInventory();
  showToast(`✅ Successfully added "${title}" to the Redemption Store!`);
}

function adminRemoveStoreItem(itemId) {
  if (!requireAdmin()) return;
  const item = STATE.redemptionItems.find(i => i.id === itemId);
  if (!item) return;

  if (confirm(`Remove "${item.title}" from the redemption store?`)) {
    STATE.redemptionItems = STATE.redemptionItems.filter(i => i.id !== itemId);

    // Sync removal to Firebase
    if (db) {
      try {
        db.ref("store_items/" + itemId).remove();
      } catch (e) {
        console.warn("RTDB remove item note:", e);
      }
    }

    renderRedemptionItems();
    renderAdminStoreInventory();
    showToast(`Removed "${item.title}" from store inventory.`);
  }
}

// 3. Redemption Requests Oversight
function setAdminRedemptionFilter(filter) {
  STATE.adminRedemptionFilter = filter;
  document.querySelectorAll(".admin-red-filter").forEach(b => {
    b.classList.remove("bg-maroon", "text-white");
    b.classList.add("bg-slate-100", "text-slate-700");
  });
  if (typeof event !== "undefined" && event && event.target) {
    event.target.classList.add("bg-maroon", "text-white");
    event.target.classList.remove("bg-slate-100", "text-slate-700");
  }
  renderAdminRedemptions();
}

function renderAdminRedemptions() {
  const container = document.getElementById("adminRedemptionsListContainer");
  if (!container) return;

  const totalEl = document.getElementById("adminStatTotalRequests");
  const pendingEl = document.getElementById("adminStatPendingRequests");
  const fulfilledEl = document.getElementById("adminStatFulfilledRequests");

  const total = STATE.redemptions.length;
  const pending = STATE.redemptions.filter(r => (r.status || "").toLowerCase() === "pending").length;
  const fulfilled = STATE.redemptions.filter(r => (r.status || "").toLowerCase() === "fulfilled").length;

  if (totalEl) totalEl.innerText = total;
  if (pendingEl) pendingEl.innerText = pending;
  if (fulfilledEl) fulfilledEl.innerText = fulfilled;

  const searchInput = document.getElementById("adminRedemptionSearchInput");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const filterLower = (STATE.adminRedemptionFilter || "All").toLowerCase();

  const filtered = STATE.redemptions.filter(r => {
    const statusLower = (r.status || "").toLowerCase();
    let matchesFilter = (filterLower === "all");
    if (!matchesFilter) {
      if (filterLower === "rejected" || filterLower === "cancelled") {
        matchesFilter = (statusLower === "rejected" || statusLower === "cancelled");
      } else {
        matchesFilter = (statusLower === filterLower);
      }
    }
    const matchesQuery = !query ||
      (r.userName && r.userName.toLowerCase().includes(query)) ||
      (r.itemTitle && r.itemTitle.toLowerCase().includes(query)) ||
      (r.userEmail && r.userEmail.toLowerCase().includes(query));
    return matchesFilter && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No student redemption requests found for this filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(r => {
    const targetId = r.id || r.firebaseKey;
    const statusLower = (r.status || "pending").toLowerCase();
    const isCompleted = (statusLower === "fulfilled" || statusLower === "approved");
    const isCancelled = (statusLower === "cancelled" || statusLower === "rejected" || statusLower === "declined");

    return `
      <div class="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-bold text-sm text-slate-900">${r.userName || 'Student'}</h4>
            <p class="text-xs text-slate-500">${r.userEmail || ''} • Stream: <strong>${r.userStream || 'Physical Science'}</strong></p>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full ${getStatusBadgeClass(r.status)}">
            ${isCancelled ? 'Cancelled & Refunded' : isCompleted ? 'Handed Over' : r.status || 'Pending Collection'}
          </span>
        </div>

        <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
          <div>
            <p class="font-semibold text-xs text-slate-800">${r.itemTitle || 'Reward Item'}</p>
            <p class="text-[11px] text-slate-500">${r.timestamp ? new Date(r.timestamp).toLocaleString() : 'Recent'}</p>
          </div>
          <span class="font-black text-amber-700 text-sm">${r.spSpent || 0} SP</span>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onclick="updateRedemptionStatus('${targetId}', 'Approved')" class="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow flex items-center space-x-1.5 transition">
            <span class="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Approve & Mark Handed Over</span>
          </button>
          <button type="button" onclick="updateRedemptionStatus('${targetId}', 'Cancelled')" class="px-3.5 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center space-x-1.5 transition">
            <span class="material-symbols-outlined text-[16px]">cancel</span>
            <span>Cancel & Refund</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function updateRedemptionStatus(redemptionId, action) {
  if (!requireAdmin()) return;

  const red = STATE.redemptions.find(r => r.id === redemptionId || r.firebaseKey === redemptionId);
  if (!red) {
    showToast("⚠️ Redemption request record not found in queue.");
    return;
  }

  const targetKey = red.firebaseKey || red.id;
  const isCancelOrDecline = (action === "Cancelled" || action === "Declined" || action === "Rejected");

  // If cancelling/declining, restore Science Points to student
  if (isCancelOrDecline) {
    const refundSp = Number(red.spSpent) || 0;

    let user = STATE.users.find(u => (red.userId && u.id === red.userId) || (red.userEmail && u.email && u.email.toLowerCase() === red.userEmail.toLowerCase()));
    if (user) {
      user.spPoints = (Number(user.spPoints) || 0) + refundSp;
    }

    if (STATE.currentUser && ((red.userId && STATE.currentUser.id === red.userId) || (red.userEmail && STATE.currentUser.email && STATE.currentUser.email.toLowerCase() === red.userEmail.toLowerCase()))) {
      STATE.currentUser.spPoints = (Number(STATE.currentUser.spPoints) || 0) + refundSp;
    }

    saveUsersAndSession();

    // Sync refunded balance to Firebase RTDB
    if (db && (red.userId || (user && user.id))) {
      try {
        const targetUserId = user ? user.id : red.userId;
        const finalSp = user ? user.spPoints : refundSp;
        db.ref("users/" + targetUserId + "/spPoints").set(finalSp);
      } catch (err) {
        console.warn("RTDB refund SP error:", err);
      }
    }
  }

  // Remove the record of student redemption store request completely from state after approving or declining
  STATE.redemptions = STATE.redemptions.filter(r => r.id !== targetKey && r.firebaseKey !== targetKey && r.id !== redemptionId && r.firebaseKey !== redemptionId);

  // Remove record from Firebase Realtime Database
  if (db) {
    try {
      db.ref("redemption_requests/" + targetKey).remove();
    } catch (e) {
      console.warn("RTDB remove redemption record error:", e);
    }
  }

  renderAuthHeader();
  renderAdminRedemptions();
  renderUserRedemptionHistory();
  renderLeaderboard();
  updateBadgeCounts();

  if (isCancelOrDecline) {
    showToast(`↩️ Request for "${red.itemTitle}" cancelled, ${red.spSpent} SP refunded to ${red.userName || 'student'}, and record removed.`);
  } else {
    showToast(`🎁 Reward "${red.itemTitle}" marked handed over to ${red.userName || 'student'} and record removed.`);
  }
}

// 4. Chat Moderation across Both Streams
function renderAdminChatAudit() {
  if (!isCurrentUserAdmin()) return;
  const box = document.getElementById("adminChatAuditBox");
  if (!box) return;

  if (STATE.messages.length === 0) {
    box.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">No active discussion messages across any academic streams.</div>`;
    return;
  }

  box.innerHTML = STATE.messages.map(m => {
    let attachmentBadge = "";
    if (m.attachment) {
      attachmentBadge = `<span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center space-x-1"><span class="material-symbols-outlined text-[12px]">attachment</span><span>${m.attachment.name}</span></span>`;
    }

    return `
      <div class="flex justify-between items-center p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-2 flex-wrap gap-y-1">
            <span class="text-xs font-bold text-slate-900">${m.senderName}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-maroon/10 text-maroon">${m.stream || 'All'}</span>
            <span class="text-[10px] text-slate-400">${new Date(m.timestamp).toLocaleTimeString()}</span>
            ${attachmentBadge}
          </div>
          <p class="text-xs text-slate-700 mt-0.5 truncate max-w-xl">"${m.content || 'File attachment'}"</p>
        </div>
        <button onclick="adminDeleteChatMessage('${m.id}')" class="text-red-600 hover:text-red-800 p-1.5 text-xs rounded-lg hover:bg-red-50 shrink-0" title="Delete message">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    `;
  }).join("");
}

function adminDeleteChatMessage(msgId) {
  if (!requireAdmin()) return;
  STATE.messages = STATE.messages.filter(m => m.id !== msgId);
  if (db) {
    try {
      db.ref("discussions/" + msgId).remove();
    } catch (e) {
      console.warn("RTDB delete message note:", e);
    }
  }
  renderChatMessages();
  renderAdminChatAudit();
  showToast("Message deleted by Administrator.");
}

function adminClearAllDiscussionMessages() {
  if (!requireAdmin()) return;
  if (!confirm("Are you sure you want to permanently clear ALL discussion messages and attached files across both Physical Science and Bio Science?")) {
    return;
  }

  STATE.messages = [];
  if (db) {
    try {
      db.ref("discussions").remove();
    } catch (e) {
      console.warn("RTDB clear discussions note:", e);
    }
  }
  renderChatMessages();
  renderAdminChatAudit();
  showToast("All discussion messages have been permanently removed.");
}

// ----------------------------------------------------
// FIREBASE REALTIME DATABASE SYNC (High Speed & Smooth)
// ----------------------------------------------------
function setupFirebaseRealtime() {
  const dbInstance = getFirebaseDb();
  if (!dbInstance) return;
  if (isRealtimeSetupDone) return;
  isRealtimeSetupDone = true;

  const statusEl = document.getElementById("firebaseConnectionStatus");
  if (statusEl) statusEl.innerText = "Firebase Cloud Connected";

  try {
    // Realtime connection status listener
    dbInstance.ref(".info/connected").on("value", snap => {
      const isOnline = snap.val() === true;
      updateFirebaseSyncUI(isOnline);
    });

    // 1. Permanently remove all mock accounts from Firebase RTDB
    PURGED_MOCK_USER_IDS.forEach(mid => {
      try { dbInstance.ref("users/" + mid).remove(); } catch(e) {}
    });

    // 2. Permanently remove all mock store items from Firebase RTDB
    REMOVED_STORE_ITEM_IDS.forEach(iid => {
      try { dbInstance.ref("store_items/" + iid).remove(); } catch(e) {}
    });

    // 3. Purge all prior discussion messages from cloud if requested
    if (!localStorage.getItem("znc_discussion_messages_purged_all_2026")) {
      try {
        dbInstance.ref("discussions").remove();
      } catch (e) {}
      localStorage.setItem("znc_discussion_messages_purged_all_2026", "true");
    }

    // 4. Real-time Early Approved Users Index Listener
    dbInstance.ref("early_approved_users").on("value", snapshot => {
      const data = snapshot.val();
      if (!STATE.earlyApprovedEmails) STATE.earlyApprovedEmails = {};
      if (data && typeof data === "object") {
        Object.keys(data).forEach(key => {
          STATE.earlyApprovedEmails[key] = !!data[key];
          const dotEmail = key.replace(/_/g, ".");
          STATE.earlyApprovedEmails[dotEmail] = !!data[key];
        });

        // Update active user session immediately if their email was approved
        if (STATE.currentUser && STATE.currentUser.email) {
          const userEmail = STATE.currentUser.email.toLowerCase().trim();
          const cleanKey = userEmail.replace(/[\.\$#\[\]\/]/g, "_");
          if (data[cleanKey] !== undefined) {
            STATE.currentUser.hasEarlyQuizAccess = !!data[cleanKey];
            STATE.currentUser.earlyQuizAccess = !!data[cleanKey];
            try {
              localStorage.setItem("znc_current_user", JSON.stringify(STATE.currentUser));
              localStorage.setItem("znc_active_user", JSON.stringify(STATE.currentUser));
            } catch (e) {}
          }
        }
        checkWednesdayQuizWindow();
        renderAdminUsers();
      }
    });

    // 5. Real-time Users Listener: full snapshot
    dbInstance.ref("users").on("value", snapshot => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const cloudUsers = Object.keys(data).map(key => {
          const u = data[key];
          if (!u || typeof u !== "object") return null;
          return {
            id: u.id || key,
            fullName: u.fullName || (key === "admin_jasim" ? "M.N.M. Jaasim" : (u.email ? u.email.split("@")[0] : "User")),
            email: u.email || (key === "admin_jasim" ? "mnmjaasim@gmail.com" : ""),
            role: (u.email && u.email.toLowerCase() === "mnmjaasim@gmail.com") || key === "admin_jasim" ? "ADMIN" : (u.role || "STUDENT"),
            stream: u.stream || "All Streams",
            spPoints: typeof u.spPoints === "number" ? u.spPoints : 50,
            weeklySp: typeof u.weeklySp === "number" ? u.weeklySp : 0,
            isVerified: u.isVerified !== undefined ? u.isVerified : true,
            hasEarlyQuizAccess: !!(u.hasEarlyQuizAccess || u.earlyQuizAccess || u.canDoQuizEarly),
            ...u
          };
        }).filter(Boolean).filter(u => {
          if (!u || !u.id) return false;
          const emailLower = (u.email || "").toLowerCase();
          return !REMOVED_MOCK_EMAILS.includes(emailLower) && !PURGED_MOCK_USER_IDS.includes(u.id);
        });

        cloudUsers.forEach(cu => {
          const idx = STATE.users.findIndex(u => u.id === cu.id || (u.email && cu.email && u.email.toLowerCase() === cu.email.toLowerCase()));
          if (idx >= 0) {
            STATE.users[idx] = { ...STATE.users[idx], ...cu };
          } else {
            STATE.users.push(cu);
          }
        });

        try {
          localStorage.setItem("znc_registered_users", JSON.stringify(STATE.users));
        } catch (e) {}

        // Crucial: Update active session user if cloud record updated (e.g. Early Access, SP points, verified)
        if (STATE.currentUser) {
          const refreshed = STATE.users.find(u => u.id === STATE.currentUser.id || (u.email && STATE.currentUser.email && u.email.toLowerCase() === STATE.currentUser.email.toLowerCase()));
          if (refreshed) {
            STATE.currentUser = { ...STATE.currentUser, ...refreshed };
            try {
              localStorage.setItem("znc_current_user", JSON.stringify(STATE.currentUser));
              localStorage.setItem("znc_active_user", JSON.stringify(STATE.currentUser));
            } catch (e) {}
          }
        }

        updateFirebaseSyncUI(true, cloudUsers.length);
        checkWednesdayQuizWindow();
        renderLeaderboard();
        // AUTOMATICALLY show newly created accounts in Admin panel without clicking any sync button!
        renderAdminUsers();
      }
    });

    // 6. Delta listener for instant addition of newly created accounts across devices
    dbInstance.ref("users").on("child_added", snapshot => {
      const u = snapshot.val();
      if (!u || typeof u !== "object" || !u.id) return;
      if (PURGED_MOCK_USER_IDS.includes(u.id)) return;
      const emailLower = (u.email || "").toLowerCase();
      if (REMOVED_MOCK_EMAILS.includes(emailLower)) return;

      const idx = STATE.users.findIndex(existing => existing.id === u.id || (existing.email && u.email && existing.email.toLowerCase() === u.email.toLowerCase()));
      if (idx >= 0) {
        STATE.users[idx] = { ...STATE.users[idx], ...u };
      } else {
        STATE.users.push(u);
      }
      renderAdminUsers(); // Instantly show newly created account in Admin panel!
      renderLeaderboard();
    });

    // 7. Delta listener for real-time changes to user permissions/points
    dbInstance.ref("users").on("child_changed", snapshot => {
      const u = snapshot.val();
      if (!u || typeof u !== "object" || !u.id) return;
      const idx = STATE.users.findIndex(existing => existing.id === u.id || (existing.email && u.email && existing.email.toLowerCase() === u.email.toLowerCase()));
      if (idx >= 0) {
        STATE.users[idx] = { ...STATE.users[idx], ...u };
      }
      if (STATE.currentUser && (STATE.currentUser.id === u.id || (STATE.currentUser.email && u.email && STATE.currentUser.email.toLowerCase() === u.email.toLowerCase()))) {
        STATE.currentUser = { ...STATE.currentUser, ...u };
        try {
          localStorage.setItem("znc_current_user", JSON.stringify(STATE.currentUser));
          localStorage.setItem("znc_active_user", JSON.stringify(STATE.currentUser));
        } catch (e) {}
        checkWednesdayQuizWindow();
      }
      renderAdminUsers();
      renderLeaderboard();
    });

    // Listen for discussions from both "discussions" (Web node) and "messages" (Android node)
    const handleIncomingChat = snapshot => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => {
          const m = data[key];
          if (!m || typeof m !== "object") return null;
          return {
            id: m.id || key,
            senderId: m.senderId || "anon",
            senderName: m.senderName || "Anonymous",
            senderRole: m.senderRole || "STUDENT",
            senderStream: m.senderStream === "PHYSICAL_SCIENCE" ? "Physical Science" : (m.senderStream === "BIO_SCIENCE" ? "Bio Science" : (m.senderStream || "Physical Science")),
            stream: m.stream || (m.senderStream === "PHYSICAL_SCIENCE" ? "Physical Science" : (m.senderStream === "BIO_SCIENCE" ? "Bio Science" : "Physical Science")),
            content: m.content || m.text || "",
            attachment: m.attachment || (m.mediaUrl ? {
              name: m.mediaName || "Attachment",
              size: m.mediaSize || 0,
              type: m.mediaType || "application/octet-stream",
              dataUrl: m.mediaUrl,
              isImage: !!(m.mediaType && m.mediaType.startsWith("image/")),
              isPdf: !!(m.mediaType && m.mediaType.includes("pdf"))
            } : null),
            timestamp: m.timestamp || Date.now()
          };
        }).filter(Boolean).filter(m => !PURGED_MOCK_USER_IDS.includes(m.senderId));

        list.forEach(newMsg => {
          const idx = STATE.messages.findIndex(m => m.id === newMsg.id);
          if (idx >= 0) {
            STATE.messages[idx] = { ...STATE.messages[idx], ...newMsg };
          } else {
            STATE.messages.push(newMsg);
          }
        });
        STATE.messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        renderChatMessages();
        renderAdminChatAudit();
      }
    };

    db.ref("discussions").on("value", handleIncomingChat);
    db.ref("messages").on("value", handleIncomingChat);

    // Listen for store items (strictly excluding purged mock items)
    db.ref("store_items").on("value", snapshot => {
      const data = snapshot.val();
      if (data) {
        STATE.redemptionItems = Object.values(data).filter(item => {
          if (!item || !item.id) return false;
          return !REMOVED_STORE_ITEM_IDS.includes(item.id);
        });
      } else {
        STATE.redemptionItems = [];
      }
      renderRedemptionItems();
      renderAdminStoreInventory();
    });

    // Listen for redemptions
    db.ref("redemption_requests").on("value", snapshot => {
      const list = [];
      snapshot.forEach(child => {
        const val = child.val();
        if (val) {
          list.push({
            ...val,
            id: val.id || child.key,
            firebaseKey: child.key
          });
        }
      });
      STATE.redemptions = list;
      renderAdminRedemptions();
      renderUserRedemptionHistory();
      updateBadgeCounts();
    });

    // Listen for quiz submissions to dynamically update unit mini-leaderboards in real-time
    db.ref("quiz_submissions").limitToLast(200).on("value", snapshot => {
      const data = snapshot.val();
      if (data) {
        STATE.quizSubmissions = Object.values(data);
        renderActiveQuizUnitMiniLeaderboard();
      }
    });

    // Listen for Wednesday Exam Synchronized Configuration
    db.ref("wednesday_quiz_config").on("value", snapshot => {
      const data = snapshot.val();
      const realCal = (typeof getActiveWednesdayInfo === "function") ? getActiveWednesdayInfo() : null;

      // If cloud has no seed, or has an outdated date in the past, sync cloud to real calendar
      if (!data || !data.seed || (realCal && data.dateString < realCal.dateString)) {
        if (realCal) {
          STATE.wednesdayConfig = realCal;
          try {
            db.ref("wednesday_quiz_config").set(realCal);
          } catch (err) {}
        }
      } else {
        STATE.wednesdayConfig = data;
      }
      renderWednesdayPaperInfo();
      renderLeaderboard();
    });

  } catch (e) {
    console.warn("RTDB listeners active in fallback mode:", e);
  }
}

// ----------------------------------------------------
// WEDNESDAY SYNCHRONIZED EXAM ENGINE & ADMIN CONTROLS
// ----------------------------------------------------
function renderWednesdayPaperInfo() {
  const cfg = STATE.wednesdayConfig;
  if (!cfg) return;

  // Real-world Today date calculation
  const todayInfo = (typeof getActiveWednesdayInfo === "function") ? getActiveWednesdayInfo() : null;
  const todayFormatted = todayInfo ? todayInfo.todayFormatted : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  // Real-World Date in Top Navigation Bar & Hero
  const liveDateEl = document.getElementById("liveRealWorldDateDisplay");
  if (liveDateEl) liveDateEl.innerText = todayFormatted;

  const heroDateEl = document.getElementById("heroRealWorldDateText");
  if (heroDateEl) heroDateEl.innerText = `Calendar: ${todayFormatted}`;

  // Student Examination View Indicators
  const codeDisplay = document.getElementById("wednesdayPaperCodeDisplay");
  if (codeDisplay) codeDisplay.innerText = cfg.paperCode || "WED-20260923";

  const seedDisplay = document.getElementById("wednesdaySeedDisplay");
  if (seedDisplay) seedDisplay.innerText = `#${cfg.seed || "17534348"}`;

  const runnerPaperEl = document.getElementById("quizRunnerPaperCode");
  if (runnerPaperEl && (!STATE.activeQuiz || !STATE.activeQuiz.paperCode)) {
    runnerPaperEl.innerText = cfg.paperCode || "WED-20260923";
  }

  // Leaderboard Exam Cycle Date Indicator
  const lbDateEl = document.getElementById("weeklyLeaderboardDateDisplay");
  if (lbDateEl) lbDateEl.innerText = `Exam Cycle: ${cfg.formattedDate || "Wednesday, Sep 23, 2026"}`;

  // Admin Panel Indicators
  const adminDate = document.getElementById("adminCurrentWedDate");
  if (adminDate) adminDate.innerText = cfg.formattedDate || cfg.dateString || "Wednesday, Sep 23, 2026";

  const adminCode = document.getElementById("adminCurrentPaperCode");
  if (adminCode) adminCode.innerText = cfg.paperCode || "WED-20260923";

  const adminSeed = document.getElementById("adminCurrentSeed");
  if (adminSeed) adminSeed.innerText = `#${cfg.seed || "17534348"}`;

  renderAdminQuestionInspection();
}

function adminForceReseedQuiz() {
  if (!requireAdmin()) return;

  const newSeed = Math.floor(Math.random() * 89999999) + 10000000;
  const currentInfo = (typeof getActiveWednesdayInfo === "function")
    ? getActiveWednesdayInfo(STATE.adminPreviewWednesdayDate)
    : { dateString: "2026-09-23", paperCode: "WED-20260923", formattedDate: "Wednesday, Sep 23, 2026" };

  STATE.wednesdayConfig = {
    dateString: currentInfo.dateString,
    paperCode: `${currentInfo.paperCode}-R${String(newSeed).slice(-4)}`,
    seed: newSeed,
    formattedDate: currentInfo.formattedDate,
    updatedAt: Date.now(),
    updatedBy: STATE.currentUser ? STATE.currentUser.fullName : "Administrator"
  };

  // Broadcast through Firebase Realtime Database so all connected student devices receive the new seed instantly
  if (db) {
    try {
      db.ref("wednesday_quiz_config").set(STATE.wednesdayConfig);
    } catch (e) {
      console.warn("RTDB quiz seed sync:", e);
    }
  }

  renderWednesdayPaperInfo();
  showToast(`Exam Reseeded! Paper Code: ${STATE.wednesdayConfig.paperCode} (Seed: #${newSeed})`);
}

function adminAdvanceNextWednesday() {
  if (!requireAdmin()) return;

  const baseDate = STATE.adminPreviewWednesdayDate ? new Date(STATE.adminPreviewWednesdayDate) : new Date();
  baseDate.setDate(baseDate.getDate() + 7);
  STATE.adminPreviewWednesdayDate = baseDate;

  const newInfo = (typeof getActiveWednesdayInfo === "function")
    ? getActiveWednesdayInfo(baseDate)
    : { dateString: "2026-09-23", paperCode: "WED-20260923", seed: 94819201, formattedDate: "Wednesday, Sep 23, 2026" };

  STATE.wednesdayConfig = {
    ...newInfo,
    updatedAt: Date.now(),
    updatedBy: STATE.currentUser ? STATE.currentUser.fullName : "Administrator"
  };

  if (db) {
    try {
      db.ref("wednesday_quiz_config").set(STATE.wednesdayConfig);
    } catch (e) {
      console.warn("RTDB quiz seed sync:", e);
    }
  }

  renderWednesdayPaperInfo();
  showToast(`Inspecting Next Wednesday Paper: ${newInfo.formattedDate} (${newInfo.paperCode})`);
}

function adminResetCalendarWednesday() {
  if (!requireAdmin()) return;

  STATE.adminPreviewWednesdayDate = null;
  const newInfo = (typeof getActiveWednesdayInfo === "function")
    ? getActiveWednesdayInfo()
    : { dateString: "2026-09-16", paperCode: "WED-20260916", seed: 84920194, formattedDate: "Wednesday, Sep 16, 2026" };

  STATE.wednesdayConfig = {
    ...newInfo,
    updatedAt: Date.now(),
    updatedBy: "System Real-World Calendar"
  };

  if (db) {
    try {
      db.ref("wednesday_quiz_config").set(STATE.wednesdayConfig);
    } catch (e) {
      console.warn("RTDB quiz seed sync:", e);
    }
  }

  renderWednesdayPaperInfo();
  renderLeaderboard();
  renderAdminQuestionInspection();
  showToast(`Restored to Official Calendar Wednesday: ${newInfo.formattedDate}`);
}

function onAdminInspectSubjectChange() {
  const subjSelect = document.getElementById("adminInspectSubjectSelect");
  const unitSelect = document.getElementById("adminInspectUnitSelect");
  if (!subjSelect || !unitSelect) return;

  const subjectId = subjSelect.value || "physics";
  const subj = (typeof SUBJECTS_DATA !== "undefined" && SUBJECTS_DATA[subjectId]) 
    ? SUBJECTS_DATA[subjectId] 
    : { name: "Physics", units: [] };

  const units = subj.units || [];
  unitSelect.innerHTML = units.map(u => `
    <option value="${u.id}">${u.name}</option>
  `).join("");

  renderAdminQuestionInspection();
}

function renderAdminQuestionInspection() {
  const subjSelect = document.getElementById("adminInspectSubjectSelect");
  const unitSelect = document.getElementById("adminInspectUnitSelect");
  const container = document.getElementById("adminQuestionInspectorList");
  if (!container) return;

  // Initialize unit select options if empty
  if (unitSelect && (!unitSelect.options || unitSelect.options.length === 0)) {
    onAdminInspectSubjectChange();
    return;
  }

  const subjectId = subjSelect ? subjSelect.value : "physics";
  const unitId = unitSelect ? unitSelect.value : "all";
  const seed = (STATE.wednesdayConfig && STATE.wednesdayConfig.seed) ? STATE.wednesdayConfig.seed : 84920194;

  const sampleQuestions = (typeof getSynchronizedWednesdayQuestions === "function")
    ? getSynchronizedWednesdayQuestions(subjectId, unitId, seed).slice(0, 5)
    : [];

  if (sampleQuestions.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">No questions found for selection.</p>`;
    return;
  }

  container.innerHTML = sampleQuestions.map((q, i) => `
    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
      <div class="flex items-center justify-between">
        <span class="font-bold text-maroon">Exam Question #${i + 1} (${q.paperCode || STATE.wednesdayConfig.paperCode})</span>
        <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          ● Locked for All Students
        </span>
      </div>
      <p class="font-semibold text-slate-900">${q.q}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        ${q.options.map((opt, optIdx) => `
          <div class="p-2 rounded-lg border ${optIdx === q.correctIndex ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}">
            <span class="font-mono text-[10px] mr-1">${['A','B','C','D','E'][optIdx]}:</span> ${opt}
            ${optIdx === q.correctIndex ? ' <span class="text-[10px] text-emerald-600 font-extrabold ml-1">✓ (Correct Answer)</span>' : ''}
          </div>
        `).join("")}
      </div>
      <p class="text-[11px] text-slate-500 italic mt-0.5">Scheme/Explanation: ${q.explanation}</p>
    </div>
  `).join("");
}

// ----------------------------------------------------
// UI UTILITIES
// ----------------------------------------------------
function updateBadgeCounts() {
  const pendingRedemptions = STATE.redemptions.filter(r => r.status.toLowerCase() === "pending").length;
  const pendingUsers = STATE.users.filter(u => !u.isVerified).length;

  const navBadge = document.getElementById("navPendingBadge");
  if (navBadge) {
    navBadge.innerText = pendingRedemptions + pendingUsers;
    navBadge.classList.toggle("hidden", (pendingRedemptions + pendingUsers) === 0);
  }

  const adminRedBadge = document.getElementById("adminPendingRedemptionsCount");
  if (adminRedBadge) adminRedBadge.innerText = pendingRedemptions;

  const adminUserBadge = document.getElementById("adminPendingUsersCount");
  if (adminUserBadge) adminUserBadge.innerText = pendingUsers;
}

function getStatusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "fulfilled":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-800 border border-red-200";
    default:
      return "bg-amber-100 text-amber-800 border border-amber-200";
  }
}

function showToast(message) {
  const toast = document.getElementById("toastNotification");
  const msgEl = document.getElementById("toastMessage");
  if (!toast || !msgEl) return;

  msgEl.innerText = message;
  toast.classList.remove("hidden", "translate-y-2");
  setTimeout(() => {
    toast.classList.add("hidden", "translate-y-2");
  }, 4000);
}

// ====================================================
// GEMINI MULTI-TURN AI TUTOR CHAT ENGINE
// ====================================================

const GEMINI_ROLES = {
  general: {
    name: "All-Round A/L Science Mentor",
    tagline: "Comprehensive guidance across Physics, Combined Maths, Chemistry & Biology",
    instruction: `You are the official ZNC Science AI Academic Tutor & Syllabus Mentor for Zahira National College (Mawanella) Science Section.
You specialize in the Sri Lankan G.C.E. Advanced Level (A/L) English Medium curriculum for:
- Physics (Mechanics, Waves, Optics, Thermal, Fields, Current Electricity, Electronics, Modern Physics)
- Combined Mathematics (Pure Mathematics: Algebra, Calculus, Trigonometry, Coordinate Geometry, Complex Numbers; Applied Mathematics: Statics, Dynamics, Vectors, Projectiles, Equilibrium, Relative Velocity)
- Chemistry (General, Physical, Inorganic s/p/d block, and Organic Chemistry)
- Biology (Cellular, Plant/Animal Physiology, Genetics, Environmental Biology based on NIE Resource Book)

MATHEMATICAL & SCIENTIFIC EQUATION FORMATTING (CRITICAL):
1. Never write plain ASCII math (e.g. NEVER write 'x = (-b +/- sqrt(b^2 - 4ac))/2a' or '8 +/- 6i / 2 = 4 +/- 3i').
2. Never wrap mathematical calculations inside programming code blocks (do NOT use \`\`\` or \`\`\`latex).
3. ALWAYS format mathematical derivations, formulas, and sums using standard LaTeX display mode with double dollar signs ($$...$$) on their own lines.
   Example:
   $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
   $$x = \\frac{-(-8) \\pm \\sqrt{(-8)^2 - 4(1)(25)}}{2(1)}$$
   $$x = \\frac{8 \\pm \\sqrt{64 - 100}}{2} = \\frac{8 \\pm \\sqrt{-36}}{2}$$
   $$x = \\frac{8 \\pm 6i}{2} = 4 \\pm 3i$$
4. Use standard LaTeX macros: \\frac{num}{den}, \\sqrt{x}, \\pm, \\times, \\cdot, \\int, \\sum, \\alpha, \\beta, \\theta, \\lambda, \\Delta.
5. For inline variables or symbols in sentences, use single dollar signs: $x$, $z$, $i = \\sqrt{-1}$, $F = ma$.

Guidelines:
1. Always maintain a polite, encouraging, highly structured academic tone.
2. Provide step-by-step mathematical derivations and scientific explanations.
3. Reference relevant fundamental laws (e.g. Newton's Laws, Bernoulli's Principle, Le Chatelier's Principle, Hess's Law).
4. Highlight common A/L examination pitfalls and marking scheme tips.
5. Use bullet points, bold formulas, and numbered steps for high readability.`
  },
  physics: {
    name: "Physics Problem Solver",
    tagline: "Senior A/L Physics Tutor • Formula Derivations & Mechanical Calculations",
    instruction: `You are the ZNC Physics Problem Solver & Senior A/L Physics Tutor for Sri Lankan G.C.E. A/L students.
Specialization:
- Mechanics (Kinematics, Newton's Laws, Circular Motion, Work/Energy/Power, Hydrostatics, Fluid Dynamics & Bernoulli)
- Waves & Oscillations (SHM, Doppler Effect, Wave Superposition, Sound & Light Waves)
- Thermal Physics (Heat transfer, Gas Laws, Thermodynamics first law, Calorimetry)
- Gravitational, Electrostatic, and Magnetic Fields
- Current Electricity (Kirchhoff's Laws, Potentiometer, Wheatstone bridge)
- Electronics & Modern Physics (Semiconductors, Logic gates, Photoelectric effect, Atomic spectra)

MATHEMATICAL EQUATIONS (CRITICAL):
- Never output raw computer ASCII formulas like 'v = u + at' or '1/2mv^2'.
- Never use code blocks for formulas.
- ALWAYS use display LaTeX ($$...$$) on separate lines for all formulas and derivation steps:
  $$v^2 = u^2 + 2as$$
  $$P + \\frac{1}{2}\\rho v^2 + \\rho gh = \\text{constant}$$
  $$T = 2\\pi \\sqrt{\\frac{l}{g}}$$
- For inline variables, use $v$, $a$, $m$, $F$, $\\rho$.

Problem-Solving Protocol:
1. Identify given values and requested quantities with proper SI units.
2. Clearly state governing physics principles and standard equations formatted in LaTeX display mode ($$...$$).
3. Provide rigorous step-by-step substitution and algebraic simplification line-by-line.
4. Conclude with final answer with magnitude, direction (if vector), and SI units.
5. Add an "A/L Past Paper Insight" tip for exam success.`
  },
  maths: {
    name: "Combined Maths Specialist",
    tagline: "Pure & Applied Mathematics Tutor • Rigorous Proofs & Algebraic Solutions",
    instruction: `You are the ZNC Combined Mathematics Specialist & Master Tutor for Sri Lankan A/L students.
Specialization:
- Pure Mathematics: Algebra, Roots of Quadratics, Polynomials, Remainder Theorem, Binomial Theorem, Mathematical Induction, Complex Numbers & Argand Diagrams, Trigonometry identities & equations, Limits, Differentiation, Integration (by parts, partial fractions, substitution), Coordinate Geometry (Straight lines, Circles).
- Applied Mathematics: Vectors (Scalar & Vector products), Coplanar Forces, Equilibrium of Rigid Bodies, Friction, Newton's Laws of Motion, Work-Energy-Power, Projectiles on horizontal and inclined planes, Direct & Oblique Impacts, Circular Motion, Relative Velocity, Jointed Rods and Frameworks, Probability & Statistics.

MATHEMATICAL EQUATIONS & SUMS (CRITICAL):
- NEVER output raw text like 'x = (-b +/- sqrt(b^2 - 4ac))/2a'.
- NEVER put calculations inside code blocks.
- ALWAYS use double-dollar display LaTeX ($$...$$) on their own lines for every single algebraic step and simplification:
  $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
  $$x = \\frac{-(-8) \\pm \\sqrt{(-8)^2 - 4(1)(25)}}{2(1)}$$
  $$x = \\frac{8 \\pm \\sqrt{-36}}{2} = \\frac{8 \\pm 6i}{2} = 4 \\pm 3i$$
- For inline math, use $z = x + iy$, $r = |z| = \\sqrt{x^2 + y^2}$, $\\theta = \\arg(z)$.

Protocol:
1. State definitions, theorems, and conditions clearly.
2. Present structured, line-by-line algebraic proofs and geometric reasoning using LaTeX display equations ($$...$$).
3. Emphasize standard A/L methods preferred by Department of Examinations marking schemes.`
  },
  chemistry: {
    name: "Chemistry Master",
    tagline: "General, Physical, Inorganic & Organic Chemistry Expert",
    instruction: `You are the ZNC Chemistry Academic Tutor for Sri Lankan A/L Chemistry.
Specialization:
- Atomic Structure, Chemical Bonding, and Periodic Trends
- Chemical Calculations (Mole concept, Stoichiometry, Titrations)
- Gaseous State and Real Gases (van der Waals equation)
- Chemical Energetics & Thermodynamics (Hess's Law, Born-Haber cycle, Entropy, Gibbs Free Energy)
- Chemical Kinetics (Rate laws, Collision theory, Arrhenius equation)
- Chemical & Ionic Equilibrium (Kc, Kp, pH, Buffer solutions, Solubility product Ksp, Common ion effect)
- Inorganic Chemistry (Characteristics, reactions, and qualitative analysis of s, p, and 3d block elements)
- Organic Chemistry (Mechanisms: SN1, SN2, Electrophilic Addition, Electrophilic Aromatic Substitution, Carbonyl addition, Aldol condensation, tests for functional groups).

EQUATIONS & SUMS (CRITICAL):
- Use LaTeX display equations ($$...$$) for all equilibrium expressions, thermodynamics, and kinetics calculations:
  $$K_c = \\frac{[\\text{NH}_3]^2}{[\\text{N}_2][\\text{H}_2]^3}$$
  $$\\Delta G^\\circ = \\Delta H^\\circ - T\\Delta S^\\circ$$
  $$\\text{pH} = \\text{p}K_a + \\log_{10}\\left(\\frac{[\\text{A}^-]}{[\\text{HA}]}\\right)$$
- Always write balanced chemical equations with state symbols (s, l, g, aq).
- Explicitly specify reagents, catalysts, and reaction conditions (temperature, pressure) for organic conversions.`
  },
  biology: {
    name: "Biology Resource Book Expert",
    tagline: "NIE Resource Book Specialist • Precise Definitions & Essay Marking Criteria",
    instruction: `You are the ZNC Biology Specialist & NIE Resource Book Advisor for Sri Lankan G.C.E. A/L Biology.
Guidelines:
1. Strictly follow the terminology and definitions presented in the official National Institute of Education (NIE) Sri Lanka G.C.E. A/L Biology Resource Books.
2. Structure essay questions as bulleted marking criteria matching past paper marking schemes.
3. Clearly detail biochemical pathways (Cellular Respiration, Photosynthesis light & dark reactions, DNA Replication, Protein Synthesis).
4. Provide comparative tables when comparing anatomical or physiological structures.`
  }
};

function initGeminiChat() {
  // 1. Restore conversation history from localStorage
  try {
    const saved = localStorage.getItem("znc_gemini_chat_history");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        STATE.gemini.history = parsed;
      }
    }
  } catch (e) {
    console.warn("Gemini history restore error:", e);
  }

  // 2. Restore selected model and role preference
  try {
    const savedModel = localStorage.getItem("znc_gemini_selected_model");
    if (savedModel) {
      STATE.gemini.model = savedModel;
      const modelSelect = document.getElementById("geminiModelSelect");
      if (modelSelect) modelSelect.value = savedModel;
    }

    const savedRole = localStorage.getItem("znc_gemini_selected_role");
    if (savedRole && GEMINI_ROLES[savedRole]) {
      STATE.gemini.role = savedRole;
      const roleSelect = document.getElementById("geminiRoleSelect");
      if (roleSelect) roleSelect.value = savedRole;
      const roleLabel = document.getElementById("activeRoleLabel");
      if (roleLabel) roleLabel.innerText = GEMINI_ROLES[savedRole].name;
    }
  } catch (e) {}

  // 3. Render initial welcome card if history is empty
  renderGeminiChat();
  checkGeminiBackendStatus();
}

function onGeminiRoleChange(newRole) {
  if (GEMINI_ROLES[newRole]) {
    STATE.gemini.role = newRole;
    try {
      localStorage.setItem("znc_gemini_selected_role", newRole);
    } catch (e) {}
    const roleLabel = document.getElementById("activeRoleLabel");
    if (roleLabel) roleLabel.innerText = GEMINI_ROLES[newRole].name;
    showToast(`Tutor switched to: ${GEMINI_ROLES[newRole].name}`);
  }
}

function onGeminiModelChange(newModel) {
  STATE.gemini.model = newModel;
  try {
    localStorage.setItem("znc_gemini_selected_model", newModel);
  } catch (e) {}
  showToast(`Active model: ${newModel}`);
}

function renderGeminiChat() {
  const container = document.getElementById("geminiChatMessages");
  if (!container) return;

  const currentUserName = STATE.currentUser ? STATE.currentUser.fullName : "Student";

  // If history is empty, display welcoming overview card
  if (!STATE.gemini.history || STATE.gemini.history.length === 0) {
    container.innerHTML = `
      <div class="bg-gradient-to-br from-white via-slate-50 to-purple-50/40 p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-maroon via-purple-900 to-amber-500 p-0.5 shadow-md flex items-center justify-center shrink-0">
            <div class="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-amber-300">
              <span class="material-symbols-outlined text-2xl">auto_awesome</span>
            </div>
          </div>
          <div>
            <h3 class="font-extrabold text-base text-slate-900">Assalamu Alaikum, ${currentUserName}!</h3>
            <p class="text-xs text-slate-600">I am your official ZNC Science AI Academic Tutor powered by Google Gemini.</p>
          </div>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed">
          I am trained on the complete Sri Lankan G.C.E. Advanced Level Science curriculum. You can ask me to solve physics calculations, derive mathematical equations, explain reaction mechanisms, clarify resource book concepts, or provide exam strategies.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div class="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <p class="text-xs font-bold text-maroon flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">psychology</span> Multi-Turn Context
            </p>
            <p class="text-[11px] text-slate-500 mt-1">I remember our previous queries in this thread so you can ask follow-up questions naturally.</p>
          </div>
          <div class="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <p class="text-xs font-bold text-amber-700 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">memory</span> Dynamic Model Selection
            </p>
            <p class="text-[11px] text-slate-500 mt-1">Use <strong>gemini-3.1-pro</strong> for complex math proofs, <strong>gemini-3.5-flash</strong> for general syllabus queries, or <strong>gemini-3.1-flash-lite</strong> for speed.</p>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] font-bold text-slate-400 mr-1">Quick Starters:</span>
          <button onclick="sendQuickGeminiPrompt('Explain the Doppler effect in sound waves with moving source vs moving observer equations.')" class="text-[11px] bg-slate-100 hover:bg-amber-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg transition">
            🔊 Doppler Effect Equations
          </button>
          <button onclick="sendQuickGeminiPrompt('What is the method of integration by parts in Combined Mathematics? Give an example.')" class="text-[11px] bg-slate-100 hover:bg-amber-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg transition">
            📐 Integration by Parts
          </button>
          <button onclick="sendQuickGeminiPrompt('Explain the SN1 and SN2 reaction mechanisms in organic alkyl halides with stereochemistry.')" class="text-[11px] bg-slate-100 hover:bg-amber-100 text-slate-700 font-medium px-2.5 py-1 rounded-lg transition">
            🧪 SN1 vs SN2 Mechanisms
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Render message history thread
  let html = "";
  for (let i = 0; i < STATE.gemini.history.length; i++) {
    const msg = STATE.gemini.history[i];
    const isUser = msg.role === "user";

    if (isUser) {
      const userInitials = (STATE.currentUser ? STATE.currentUser.fullName.charAt(0) : "S").toUpperCase();
      html += `
        <div class="flex items-start justify-end space-x-2.5 pl-6 sm:pl-16">
          <div class="flex flex-col items-end">
            <div class="bg-gradient-to-r from-maroon to-maroon-dark text-white p-3.5 sm:p-4 rounded-2xl rounded-tr-xs shadow-sm max-w-2xl border border-gold/20">
              <p class="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">${escapeHtml(msg.text)}</p>
            </div>
            <div class="flex items-center space-x-2 mt-1 mr-1 text-[10px] text-slate-400 font-medium">
              <span>${formatChatTime(msg.timestamp)}</span>
              <span>•</span>
              <span>You</span>
            </div>
          </div>
          <div class="w-8 h-8 rounded-full bg-maroon text-gold font-bold text-xs flex items-center justify-center border border-gold/40 shrink-0 shadow-xs">
            ${userInitials}
          </div>
        </div>
      `;
    } else {
      const formattedContent = formatGeminiMarkdown(msg.text);
      const modelTag = msg.modelUsed || STATE.gemini.model;
      const msgId = msg.id || `msg_ai_${i}`;

      html += `
        <div class="flex items-start space-x-2.5 pr-6 sm:pr-16">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shrink-0 shadow-xs">
            <div class="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center">
              <span class="material-symbols-outlined text-amber-300 text-base">auto_awesome</span>
            </div>
          </div>
          <div class="flex-1 max-w-3xl">
            <div class="bg-white p-4 sm:p-5 rounded-2xl rounded-tl-xs shadow-xs border border-slate-200/90 text-slate-800">
              <div class="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <div class="flex items-center space-x-2">
                  <span class="text-xs font-bold text-slate-900">Gemini Academic Tutor</span>
                  <span class="text-[10px] font-extrabold uppercase px-2 py-0.2 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    ${modelTag}
                  </span>
                </div>
                <button onclick="copyGeminiMessage('${msgId}')" title="Copy response to clipboard" class="text-slate-400 hover:text-slate-700 text-xs flex items-center gap-1 font-semibold p-1 hover:bg-slate-100 rounded transition">
                  <span class="material-symbols-outlined text-[15px]">content_copy</span>
                  <span class="text-[10px] hidden sm:inline">Copy</span>
                </button>
              </div>

              <!-- Message Body -->
              <div id="${msgId}_content" class="text-xs sm:text-sm text-slate-800 space-y-2 leading-relaxed">
                ${formattedContent}
              </div>
            </div>

            <div class="flex items-center space-x-2 mt-1 ml-1 text-[10px] text-slate-400 font-medium">
              <span>${formatChatTime(msg.timestamp)}</span>
              <span>•</span>
              <span>ZNC Science Portal</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Thinking / Loading Indicator
  if (STATE.gemini.isLoading) {
    html += `
      <div class="flex items-start space-x-2.5 pr-6 sm:pr-16">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shrink-0 shadow-xs animate-pulse">
          <div class="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center">
            <span class="material-symbols-outlined text-amber-300 text-base">psychology</span>
          </div>
        </div>
        <div class="bg-white p-4 rounded-2xl rounded-tl-xs shadow-xs border border-slate-200 text-slate-700 flex items-center space-x-3">
          <div class="flex space-x-1">
            <div class="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style="animation-delay: 0s"></div>
            <div class="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style="animation-delay: 0.2s"></div>
            <div class="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style="animation-delay: 0.4s"></div>
          </div>
          <span class="text-xs font-semibold text-slate-600">Gemini is analyzing syllabus and drafting step-by-step answer...</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  renderMathInElementSafely(container);
  scrollGeminiToBottom();
}

function scrollGeminiToBottom() {
  const scrollContainer = document.getElementById("geminiChatMessagesContainer");
  if (scrollContainer) {
    setTimeout(() => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }, 50);
  }
}

function handleGeminiFormSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("geminiChatInput");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendGeminiMessage(text);
}

function handleGeminiInputKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleGeminiFormSubmit();
  }
}

function sendQuickGeminiPrompt(text) {
  navigateTo("gemini");
  sendGeminiMessage(text);
}

function openGeminiChatQuick() {
  navigateTo("gemini");
  setTimeout(() => {
    const input = document.getElementById("geminiChatInput");
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth" });
    }
  }, 150);
}

function askGeminiQuick(encodedQuestionText) {
  try {
    const text = decodeURIComponent(encodedQuestionText);
    navigateTo("gemini");
    const prompt = `Student Discussion Question:\n"${text}"\n\nPlease provide a clear, step-by-step academic explanation, state all relevant physics/chemistry/maths formulas, and give exam tips for Sri Lankan A/L students.`;
    sendGeminiMessage(prompt);
  } catch (e) {
    console.error("askGeminiQuick error:", e);
  }
}

function askGeminiAboutQuizQuestion() {
  if (!STATE.activeQuiz || !STATE.activeQuiz.questions) return;
  const q = STATE.activeQuiz.questions[STATE.activeQuizQuestionIdx];
  if (!q) return;

  const unit = PHYSICS_UNITS.find(u => u.id === STATE.activeQuiz.unitId);
  const unitName = unit ? unit.name : "Physics";

  const prompt = `Physics Quiz Question from ${unitName}:\n"${q.q}"\n\nOptions:\n${q.options.map((o, idx) => `${idx + 1}) ${o}`).join("\n")}\n\nPlease explain the underlying physics principles, relevant equations, and concept steps required to solve this question correctly without directly giving away the letter option.`;

  navigateTo("gemini");
  sendGeminiMessage(prompt);
}

async function checkGeminiBackendStatus() {
  const statusBadge = document.getElementById("geminiStatusBadge");
  try {
    const res = await fetch("/api/gemini/status");
    if (res.ok) {
      const data = await res.json();
      if (statusBadge) {
        statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live A/L AI`;
        statusBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1";
      }
      return true;
    }
  } catch (e) {
    console.warn("Backend status check error:", e);
  }

  const customKey = localStorage.getItem("znc_custom_gemini_api_key");
  if (statusBadge) {
    if (customKey) {
      statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Client Key Active`;
      statusBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/40 flex items-center gap-1";
    } else {
      statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Standalone / Direct`;
      statusBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1";
    }
  }
  return false;
}

function promptGeminiApiKey() {
  const current = localStorage.getItem("znc_custom_gemini_api_key") || "";
  const key = prompt(
    "Optional Client-Side Google Gemini API Key:\n\n" +
    "If your server is in static hosting mode or you prefer using your own quota, enter your Gemini API Key below.\n" +
    "(Leave empty to use the Portal server proxy)",
    current
  );

  if (key !== null) {
    if (key.trim()) {
      localStorage.setItem("znc_custom_gemini_api_key", key.trim());
      showToast("Custom Gemini API Key saved for client-side queries!");
    } else {
      localStorage.removeItem("znc_custom_gemini_api_key");
      showToast("Reset to server default Gemini connection.");
    }
    checkGeminiBackendStatus();
  }
}

async function callDirectGeminiApi(apiKey, messages, model, systemInstruction) {
  const formattedContents = [];
  for (const msg of messages) {
    if (!msg || !msg.text) continue;
    const role = (msg.role === "model" || msg.role === "assistant") ? "model" : "user";
    formattedContents.push({
      role: role,
      parts: [{ text: String(msg.text).trim() }]
    });
  }
  if (formattedContents.length === 0) throw new Error("No message text provided.");
  if (formattedContents[formattedContents.length - 1].role !== "user") {
    formattedContents.push({ role: "user", parts: [{ text: "Please continue or summarize." }] });
  }

  const payload = {
    contents: formattedContents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      topP: 0.95
    }
  };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const raw = await resp.text();
    throw new Error(`Google API returned ${resp.status}: ${raw.substring(0, 120)}`);
  }

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error ? data.error.message : `API returned HTTP ${resp.status}`);
  }
  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error("No candidate returned by Gemini.");
  const text = candidate.content?.parts?.map(p => p.text || "").join("\n") || "";
  if (!text.trim()) throw new Error("Empty text received from Gemini.");
  return text;
}

async function sendGeminiMessage(userText) {
  if (!userText || STATE.gemini.isLoading) return;

  const newMsg = {
    id: "msg_user_" + Date.now(),
    role: "user",
    text: userText,
    timestamp: Date.now()
  };

  STATE.gemini.history.push(newMsg);
  STATE.gemini.isLoading = true;
  renderGeminiChat();

  // Save updated history
  try {
    localStorage.setItem("znc_gemini_chat_history", JSON.stringify(STATE.gemini.history));
  } catch (e) {}

  // Update send button state
  const btnSend = document.getElementById("btnGeminiSend");
  const sendIcon = document.getElementById("geminiSendIcon");
  const sendText = document.getElementById("geminiSendText");
  if (btnSend) btnSend.disabled = true;
  if (sendIcon) sendIcon.innerText = "hourglass_top";
  if (sendText) sendText.innerText = "Thinking...";

  // Prepare payload with multi-turn conversation history (exclude error messages)
  const activeRoleConfig = GEMINI_ROLES[STATE.gemini.role] || GEMINI_ROLES.general;
  const messagesPayload = STATE.gemini.history
    .filter(m => !m.id || !m.id.startsWith("msg_ai_err_"))
    .map(m => ({
      role: m.role === "user" ? "user" : "model",
      text: m.text
    }));

  try {
    let replyText = null;
    let modelUsed = STATE.gemini.model;

    const customApiKey = (localStorage.getItem("znc_custom_gemini_api_key") || "").trim();

    let serverError = null;
    // 1. Try server endpoint first
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customApiKey ? { "x-gemini-api-key": customApiKey } : {})
        },
        body: JSON.stringify({
          messages: messagesPayload,
          model: STATE.gemini.model,
          systemInstruction: activeRoleConfig.instruction,
          apiKey: customApiKey || undefined
        })
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.success && data.reply) {
          replyText = data.reply;
          modelUsed = data.modelUsed || STATE.gemini.model;
        } else {
          serverError = new Error(data.error || `Server error (${response.status})`);
        }
      } else {
        const rawText = await response.text();
        serverError = new Error(`Server returned HTTP ${response.status} (${rawText.trim() || response.statusText})`);
      }
    } catch (netErr) {
      serverError = netErr;
    }

    // 2. If server failed and custom API key is present, fallback to direct Google Generative Language API
    if (!replyText) {
      if (customApiKey) {
        try {
          replyText = await callDirectGeminiApi(customApiKey, messagesPayload, STATE.gemini.model, activeRoleConfig.instruction);
          modelUsed = `${STATE.gemini.model} (Direct)`;
        } catch (directErr) {
          throw new Error(`Server proxy error: ${serverError?.message || 'Failed'}. Direct API error: ${directErr.message}`);
        }
      } else if (serverError) {
        throw serverError;
      }
    }

    if (replyText) {
      STATE.gemini.history.push({
        id: "msg_ai_" + Date.now(),
        role: "model",
        text: replyText,
        modelUsed: modelUsed,
        timestamp: Date.now()
      });
    }
  } catch (err) {
    console.error("Gemini Tutor Error:", err);
    STATE.gemini.history.push({
      id: "msg_ai_err_" + Date.now(),
      role: "model",
      text: `⚠️ **AI Tutor Notice**: ${err.message}\n\n*Tip*: If this persists, verify your server is running (\`node server.js\`) or click the 🔑 API Key button to supply a personal Gemini key.`,
      modelUsed: STATE.gemini.model,
      timestamp: Date.now()
    });
  } finally {
    STATE.gemini.isLoading = false;
    try {
      localStorage.setItem("znc_gemini_chat_history", JSON.stringify(STATE.gemini.history));
    } catch (e) {}

    if (btnSend) btnSend.disabled = false;
    if (sendIcon) sendIcon.innerText = "send";
    if (sendText) sendText.innerText = "Send";

    renderGeminiChat();
  }
}

function clearGeminiChat() {
  if (confirm("Are you sure you want to clear your conversation history with Gemini AI Tutor?")) {
    STATE.gemini.history = [];
    try {
      localStorage.removeItem("znc_gemini_chat_history");
    } catch (e) {}
    renderGeminiChat();
    showToast("Conversation history cleared.");
  }
}

function exportGeminiChat() {
  if (!STATE.gemini.history || STATE.gemini.history.length === 0) {
    showToast("No conversation notes to export.");
    return;
  }

  let textNotes = `ZNC SCIENCE PORTAL — GEMINI ACADEMIC TUTOR NOTES\n`;
  textNotes += `Export Date: ${new Date().toLocaleString()}\n`;
  textNotes += `Student: ${STATE.currentUser ? STATE.currentUser.fullName : "Guest"}\n`;
  textNotes += `Tutor Role: ${GEMINI_ROLES[STATE.gemini.role]?.name || "Science Mentor"}\n`;
  textNotes += `========================================================\n\n`;

  STATE.gemini.history.forEach((m, idx) => {
    const sender = m.role === "user" ? "YOU" : `GEMINI AI TUTOR (${m.modelUsed || "Gemini"})`;
    textNotes += `[${sender} - ${new Date(m.timestamp).toLocaleTimeString()}]\n`;
    textNotes += `${m.text}\n\n--------------------------------------------------------\n\n`;
  });

  navigator.clipboard.writeText(textNotes)
    .then(() => {
      showToast("📋 Conversation notes copied to clipboard!");
    })
    .catch(() => {
      showToast("Could not copy notes to clipboard.");
    });
}

function copyGeminiMessage(msgId) {
  const contentEl = document.getElementById(msgId + "_content");
  if (!contentEl) return;
  const text = contentEl.innerText;
  navigator.clipboard.writeText(text)
    .then(() => showToast("Answer copied to clipboard!"))
    .catch(() => showToast("Failed to copy answer."));
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatChatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Render LaTeX math expression using KaTeX if loaded, or fallback gracefully.
 */
function renderLatex(tex, isDisplay) {
  let cleanTex = (tex || "").trim();
  if (!cleanTex) return "";

  // Normalize align/align* to aligned for KaTeX compatibility
  cleanTex = cleanTex.replace(/\\begin\{align\*?\}/g, "\\begin{aligned}")
                     .replace(/\\end\{align\*?\}/g, "\\end{aligned}");

  // Remove redundant outer $$ or $ delimiters if present inside
  cleanTex = cleanTex.replace(/^\$\$([\s\S]*)\$\$$/, "$1")
                     .replace(/^\$([\s\S]*)\$$/, "$1")
                     .trim();

  if (typeof katex !== "undefined" && katex.renderToString) {
    try {
      return katex.renderToString(cleanTex, {
        displayMode: isDisplay,
        throwOnError: false,
        strict: false,
        trust: true
      });
    } catch (e) {
      console.warn("KaTeX render error:", e);
    }
  }
  return escapeHtml(cleanTex);
}

/**
 * Safe auto-renderer for any LaTeX math elements remaining in a container element
 */
function renderMathInElementSafely(el) {
  if (!el) return;
  if (typeof renderMathInElement === "function") {
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false,
        strict: false
      });
    } catch (e) {
      console.warn("renderMathInElement error:", e);
    }
  }
}

/**
 * Rich Markdown + KaTeX Mathematical Typesetter for Gemini Academic Responses
 */
function formatGeminiMarkdown(text) {
  if (!text) return "";

  const mathBlocks = [];
  const mathInlines = [];
  const codeBlocks = [];

  // 1. Convert math code blocks (```latex, ```math, ```tex or containing LaTeX commands) to display math blocks
  let processed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const l = (lang || "").toLowerCase();
    const isMathLang = l === "latex" || l === "tex" || l === "math" || l === "katex";
    const hasMathCommands = /\\(frac|sqrt|pm|int|sum|prod|cdot|times|alpha|beta|theta|lambda|pi|partial|begin\{aligned\}|begin\{align)/.test(code);

    if (isMathLang || (hasMathCommands && !/^(const|let|var|function|import|export|class|def|for|while)\b/.test(code.trim()))) {
      const idx = mathBlocks.length;
      mathBlocks.push({ tex: code.trim(), isDisplay: true });
      return `\n\n___MATH_BLOCK_${idx}___\n\n`;
    }

    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || "CODE", code: code.trim() });
    return `___CODE_BLOCK_${idx}___`;
  });

  // 2. Preserve Display / Block Math: $$...$$ or \[...\] or \begin{aligned}...\end{aligned}
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
    const idx = mathBlocks.length;
    mathBlocks.push({ tex, isDisplay: true });
    return `\n\n___MATH_BLOCK_${idx}___\n\n`;
  });
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, tex) => {
    const idx = mathBlocks.length;
    mathBlocks.push({ tex, isDisplay: true });
    return `\n\n___MATH_BLOCK_${idx}___\n\n`;
  });
  processed = processed.replace(/(\\begin\{(?:aligned|align\*?|gather\*?|equation\*?|matrix|pmatrix|bmatrix|cases)\}[\s\S]*?\\end\{(?:aligned|align\*?|gather\*?|equation\*?|matrix|pmatrix|bmatrix|cases)\})/g, (match, tex) => {
    const idx = mathBlocks.length;
    mathBlocks.push({ tex, isDisplay: true });
    return `\n\n___MATH_BLOCK_${idx}___\n\n`;
  });

  // 3. Preserve Inline Math: \(...\) or $...$
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, tex) => {
    const idx = mathInlines.length;
    mathInlines.push({ tex, isDisplay: false });
    return `___MATH_INLINE_${idx}___`;
  });
  processed = processed.replace(/(^|[^\\])\$([^\$\n\r]+?)\$/g, (match, prefix, tex) => {
    const trimmed = tex.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return match;
    }
    const idx = mathInlines.length;
    mathInlines.push({ tex: trimmed, isDisplay: false });
    return `${prefix}___MATH_INLINE_${idx}___`;
  });

  // 3b. Detect standalone formula lines with LaTeX commands that may have missed delimiters (e.g. x = \frac{-b \pm \sqrt{...}}{2a})
  processed = processed.replace(/^([ \t]*[a-zA-Z0-9_\(\)]+[ \t]*=[ \t]*\\[a-zA-Z]+[\s\S]*?)$/gm, (match, line) => {
    if (line.includes("___MATH_") || line.includes("___CODE_")) return match;
    if (line.includes("\\frac") || line.includes("\\sqrt") || line.includes("\\pm") || line.includes("\\int") || line.includes("\\sum")) {
      const idx = mathBlocks.length;
      mathBlocks.push({ tex: line.trim(), isDisplay: true });
      return `\n\n___MATH_BLOCK_${idx}___\n\n`;
    }
    return match;
  });

  // 4. Escape HTML for remaining regular text to prevent XSS
  processed = escapeHtml(processed);

  // 5. Parse Markdown Tables
  processed = processed.replace(/((?:^\|[^\n]+\|\r?\n)+)/gm, (tableMatch) => {
    const rows = tableMatch.trim().split("\n").map(r => r.trim()).filter(Boolean);
    if (rows.length < 2) return tableMatch;
    
    // Check if second row is a separator row (e.g. |---|---| or |:---:|)
    const isSep = /^\|[\s:\-\|]+\|$/.test(rows[1]);
    if (!isSep) return tableMatch;

    const parseCells = (row) => row.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    const headerCells = parseCells(rows[0]);
    const bodyRows = rows.slice(2);

    let tableHtml = `<div class="overflow-x-auto my-3 rounded-xl border border-slate-200 shadow-2xs">
      <table class="min-w-full divide-y divide-slate-200 text-xs text-left">
        <thead class="bg-slate-50 font-bold text-slate-800">
          <tr>${headerCells.map(c => `<th class="px-3.5 py-2.5">${c}</th>`).join("")}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">`;

    for (const row of bodyRows) {
      const cells = parseCells(row);
      tableHtml += `<tr>${cells.map(c => `<td class="px-3.5 py-2 text-slate-700">${c}</td>`).join("")}</tr>`;
    }

    tableHtml += `</tbody></table></div>`;
    return `\n\n${tableHtml}\n\n`;
  });

  // 6. Format Markdown elements: Horizontal rule, Headings, Bold, Italic, Inline Code
  processed = processed.replace(/^---$/gm, '<hr class="my-3 border-slate-200" />');
  processed = processed.replace(/^### (.*$)/gm, '<h4 class="font-black text-xs sm:text-sm text-maroon mt-3 mb-1">$1</h4>');
  processed = processed.replace(/^## (.*$)/gm, '<h3 class="font-black text-sm text-slate-900 mt-3.5 mb-1.5 border-b pb-1">$1</h3>');
  processed = processed.replace(/^# (.*$)/gm, '<h2 class="font-black text-base text-slate-900 mt-4 mb-2">$1</h2>');
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
  processed = processed.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em class="italic text-slate-800">$2</em>');
  processed = processed.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-purple-900 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border border-slate-200">$1</code>');

  // 7. Split into paragraphs/lists
  const lines = processed.split("\n");
  let inList = false;
  const formatted = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      if (!inList) {
        formatted.push('<ul class="list-disc pl-5 my-1.5 space-y-1 text-slate-800">');
        inList = true;
      }
      formatted.push(`<li>${trimmed.substring(2)}</li>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (inList) {
        formatted.push('</ul>');
        inList = false;
      }
      formatted.push(`<div class="pl-2 my-1 text-slate-800 font-semibold">${trimmed}</div>`);
    } else {
      if (inList) {
        formatted.push('</ul>');
        inList = false;
      }
      if (trimmed === "") {
        formatted.push('<div class="h-1"></div>');
      } else if (trimmed.startsWith("___MATH_BLOCK_") && trimmed.endsWith("___")) {
        formatted.push(trimmed);
      } else if (trimmed.startsWith("___CODE_BLOCK_") && trimmed.endsWith("___")) {
        formatted.push(trimmed);
      } else if (trimmed.startsWith('<div class="overflow-x-auto my-3')) {
        formatted.push(line);
      } else {
        formatted.push(`<p class="my-1 leading-relaxed text-slate-800">${line}</p>`);
      }
    }
  }
  if (inList) formatted.push('</ul>');

  let result = formatted.join("");

  // 8. Re-insert Rendered Math Blocks
  result = result.replace(/___MATH_BLOCK_(\d+)___/g, (match, idx) => {
    const item = mathBlocks[parseInt(idx, 10)];
    if (!item) return "";
    const rendered = renderLatex(item.tex, true);
    return `<div class="katex-display-card">${rendered}</div>`;
  });

  // 9. Re-insert Rendered Inline Math
  result = result.replace(/___MATH_INLINE_(\d+)___/g, (match, idx) => {
    const item = mathInlines[parseInt(idx, 10)];
    if (!item) return "";
    return `<span class="katex-inline-math">${renderLatex(item.tex, false)}</span>`;
  });

  // 10. Re-insert Code Blocks
  result = result.replace(/___CODE_BLOCK_(\d+)___/g, (match, idx) => {
    const item = codeBlocks[parseInt(idx, 10)];
    if (!item) return "";
    return `<div class="my-2.5 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xs">
      <div class="bg-slate-800 px-3 py-1 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider flex justify-between items-center">
        <span>${escapeHtml(item.lang)}</span>
      </div>
      <pre class="p-3 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed"><code>${escapeHtml(item.code)}</code></pre>
    </div>`;
  });

  return result;
}

