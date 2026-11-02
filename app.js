import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCtwo7CgwQoPqIeffJ-rXTVKI1EucB9xMc",
  authDomain: "raavan-esports.firebaseapp.com",
  projectId: "raavan-esports",
  storageBucket: "raavan-esports.firebasestorage.app",
  messagingSenderId: "335379689665",
  appId: "1:335379689665:web:1eef94dc57144a081ba440"
};

const ADMIN_EMAIL = "the.raavanff@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentProfile = null;
let tournaments = [];
let authMode = "login";
let editingTournamentId = null;

const $ = id => document.getElementById(id);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  })[char]);
}

function showMessage(message) {
  const box = $("globalMessage");
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 3000);
}

function setFormMessage(id, message, isError = false) {
  const element = $(id);
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "#ff7d8d" : "#27d8e8";
}

function isAdmin() {
  return !!currentUser &&
    currentUser.email === ADMIN_EMAIL &&
    currentUser.emailVerified === true;
}

// NAVIGATION
window.showPage = function(page) {
  if (page === "admin" && !isAdmin()) {
    showMessage("Admin access required.");
    page = "auth";
  }

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active");
  });

  const target = $(page);
  if (target) target.classList.add("active");

  $("nav").classList.remove("open");

  if (page === "tournaments" || page === "home") renderTournaments();
  if (page === "myRegistrations") loadMyRegistrations();
  if (page === "profile") renderProfile();
  if (page === "admin" && isAdmin()) loadAdminData();

  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.toggleMenu = function() {
  $("nav").classList.toggle("open");
};

// AUTH MODE
window.setAuthMode = function(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("signupTab").classList.toggle("active", mode === "signup");
  $("nameGroup").classList.toggle("hidden", mode !== "signup");
  $("resetBtn").classList.toggle("hidden", mode !== "login");
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create Account";
  setFormMessage("authMessage", "");
};

// SIGNUP AND LOGIN
$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;
  const name = $("authName").value.trim();

  if (authMode === "signup" && !name) {
    return setFormMessage("authMessage", "Please enter your name.", true);
  }

  $("authSubmit").disabled = true;
  $("authSubmit").textContent = "Please wait...";

  try {
    if (authMode === "signup") {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", result.user.uid), {
        displayName: name,
        email: email,
        points: 0,
        createdAt: serverTimestamp()
      });

      await sendEmailVerification(result.user);
      setFormMessage("authMessage", "Account created! Verify your email, then login.");
      await signOut(auth);
      $("authForm").reset();
      setAuthMode("login");

    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);

      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user);
        await signOut(auth);
        throw new Error("Please verify your email first. A verification email has been sent.");
      }

      showMessage("Login successful!");
      showPage("home");
    }

  } catch (error) {
    setFormMessage("authMessage", error.message, true);
  } finally {
    $("authSubmit").disabled = false;
    $("authSubmit").textContent =
      authMode === "login" ? "Login" : "Create Account";
  }
});

// PASSWORD RESET
window.resetPassword = async function() {
  const email = $("authEmail").value.trim().toLowerCase();
  if (!email) return setFormMessage("authMessage", "Enter your email first.", true);

  try {
    await sendPasswordResetEmail(auth, email);
    setFormMessage("authMessage", "Password reset email sent.");
  } catch (error) {
    setFormMessage("authMessage", error.message, true);
  }
};

// LOGOUT
window.logout = async function() {
  try {
    await signOut(auth);
    showMessage("Logged out successfully.");
    showPage("home");
  } catch (error) {
    showMessage(error.message);
  }
};

// AUTH STATE
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user && user.emailVerified) {
    try {
      const profileRef = doc(db, "users", user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          displayName: user.displayName || user.email.split("@")[0],
          email: user.email,
          points: 0,
          createdAt: serverTimestamp()
        });
        currentProfile = { points: 0 };
      } else {
        currentProfile = profileSnap.data();
      }

      if (isAdmin()) {
        await seedTournamentsForAdmin();
      }

    } catch (error) {
      console.error("Profile error:", error);
      showMessage("Profile could not load. Check Firestore rules.");
    }
  } else {
    currentProfile = null;
  }

  updateNavigation();
  renderProfile();
  await loadTournaments();
});

function updateNavigation() {
  const loggedIn = !!currentUser && currentUser.emailVerified;
  $("authNav").classList.toggle("hidden", loggedIn);
  $("logoutBtn").classList.toggle("hidden", !loggedIn);
  $("adminNav").classList.toggle("hidden", !isAdmin());
  $("homeUser").textContent = loggedIn ? "Player" : "Guest";
}

// PROFILE
function renderProfile() {
  if (!currentUser || !currentUser.emailVerified) {
    $("profileAvatar").textContent = "R";
    $("profileName").textContent = "Guest User";
    $("profileEmail").textContent = "Please login to view your profile.";
    $("profileStatus").textContent = "Not logged in";
    $("profilePoints").textContent = "0";
    return;
  }

  const name = currentProfile?.displayName || currentUser.email;
  $("profileAvatar").textContent = name.charAt(0).toUpperCase();
  $("profileName").textContent = name;
  $("profileEmail").textContent = currentUser.email;
  $("profileStatus").textContent = isAdmin() ? "Admin" : "Verified Player";
  $("profilePoints").textContent = currentProfile?.points ?? 0;
}

// TOURNAMENTS
async function loadTournaments() {
  try {
    const snapshot = await getDocs(collection(db, "tournaments"));
    tournaments = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    tournaments.sort((a, b) => {
      const dateA = a.date?.toMillis?.() || 0;
      const dateB = b.date?.toMillis?.() || 0;
      return dateA - dateB;
    });

    renderTournaments();
    if (isAdmin()) renderAdminTournaments();

  } catch (error) {
    console.error(error);
    showMessage("Could not load tournaments. Check Firestore rules.");
  }
}

function formatDate(value) {
  if (!value) return "Date to be announced";
  let date;

  if (typeof value === "string") date = new Date(value);
  else if (value.toDate) date = value.toDate();
  else date = new Date(value);

  if (isNaN(date.getTime())) return "Date to be announced";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function tournamentCard(t) {
  const registered = Number(t.registeredCount || 0);
  const capacity = Number(t.capacity || 0);
  const full = capacity > 0 && registered >= capacity;
  const open = t.status === "Open" && !full;

  return `
    <article class="tournament-card">
      <div class="card-top">
        <span class="mode-tag">${escapeHTML(t.mode || "Solo")}</span>
        <span class="status-tag ${open ? "" : "closed"}">
          ${full ? "Full" : escapeHTML(t.status || "Closed")}
        </span>
      </div>
      <h3>${escapeHTML(t.name || "Tournament")}</h3>
      <div class="card-info"><span>Date</span><strong>${escapeHTML(formatDate(t.date))}</strong></div>
      <div class="card-info"><span>Players</span><strong>${registered}/${capacity || "—"}</strong></div>
      <div class="card-info"><span>Entry</span><strong>FREE</strong></div>
      <div class="card-info"><span>Reward points</span><strong>${Number(t.prizePoints || 0)}</strong></div>
      <button class="primary-btn card-action" ${open ? "" : "disabled"}
        onclick="joinTournament('${escapeHTML(t.id)}')">
        ${open ? "Register Now" : full ? "Tournament Full" : "Registration Closed"}
      </button>
    </article>
  `;
}

function renderTournaments() {
  $("homeTournamentCount").textContent = tournaments.length;

  const html = tournaments.length
    ? tournaments.map(tournamentCard).join("")
    : '<div class="empty">No tournaments available right now.</div>';

  $("tournamentList").innerHTML = html;
  $("homeTournamentList").innerHTML = tournaments.length
    ? tournaments.slice(0, 2).map(tournamentCard).join("")
    : '<div class="empty">New tournaments coming soon.</div>';
}

// REGISTER TOURNAMENT
window.joinTournament = async function(tournamentId) {
  if (!currentUser || !currentUser.emailVerified) {
    showMessage("Please login with a verified email first.");
    showPage("auth");
    return;
  }

  const tournament = tournaments.find(t => t.id === tournamentId);
  if (!tournament) return showMessage("Tournament not found.");

  if (tournament.status !== "Open") {
    return showMessage("Registration is closed.");
  }

  const registrationId = `${currentUser.uid}_${tournamentId}`;
  const registrationRef = doc(db, "registrations", registrationId);
  const tournamentRef = doc(db, "tournaments", tournamentId);

  try {
    await runTransaction(db, async transaction => {
      const registrationSnap = await transaction.get(registrationRef);
      const tournamentSnap = await transaction.get(tournamentRef);

      if (registrationSnap.exists()) {
        throw new Error("You have already registered for this tournament.");
      }

      if (!tournamentSnap.exists()) {
        throw new Error("Tournament no longer exists.");
      }

      const data = tournamentSnap.data();
      const count = Number(data.registeredCount || 0);
      const capacity = Number(data.capacity || 0);

      if (data.status !== "Open") {
        throw new Error("Registration is closed.");
      }

      if (capacity > 0 && count >= capacity) {
        throw new Error("Tournament is full.");
      }

      transaction.set(registrationRef, {
        uid: currentUser.uid,
        tournamentId: tournamentId,
        tournamentName: data.name,
        status: "Registered",
        createdAt: serverTimestamp()
      });

      transaction.update(tournamentRef, {
        registeredCount: count + 1
      });
    });

    showMessage("Registration successful!");
    await loadTournaments();
    showPage("myRegistrations");

  } catch (error) {
    console.error(error);
    showMessage(error.message || "Registration failed.");
  }
};

// MY REGISTRATIONS
async function loadMyRegistrations() {
  if (!currentUser || !currentUser.emailVerified) {
    $("myRegistrationList").innerHTML =
      '<div class="empty">Please login to see your registrations.</div>';
    return;
  }

  $("myRegistrationList").innerHTML = '<div class="empty">Loading...</div>';

  try {
    const q = query(
      collection(db, "registrations"),
      where("uid", "==", currentUser.uid)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      $("myRegistrationList").innerHTML =
        '<div class="empty">You have not registered for any tournament yet.</div>';
      return;
    }

    $("myRegistrationList").innerHTML = snapshot.docs.map(item => {
      const data = item.data();
      return `
        <div class="registration-item">
          <h3>${escapeHTML(data.tournamentName)}</h3>
          <p class="muted small">Status: ${escapeHTML(data.status)}</p>
          <p class="muted small">Registration ID: ${escapeHTML(item.id)}</p>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error(error);
    $("myRegistrationList").innerHTML =
      '<div class="empty">Could not load registrations. Check Firestore rules.</div>';
  }
}

// ADMIN: CREATE SAMPLE TOURNAMENTS ON FIRST ADMIN LOGIN
async function seedTournamentsForAdmin() {
  if (!isAdmin()) return;

  const markerRef = doc(db, "settings", "sampleTournaments");
  const marker = await getDoc(markerRef);
  if (marker.exists()) return;

  const existing = await getDocs(collection(db, "tournaments"));
  if (!existing.empty) {
    await setDoc(markerRef, { seeded: true });
    return;
  }

  const samples = [
    {
      name: "Raavan Solo Challenge",
      mode: "Solo",
      capacity: 48,
      prizePoints: 100,
      status: "Open",
      registeredCount: 0,
      date: new Date(Date.now() + 86400000)
    },
    {
      name: "Raavan Duo Battle",
      mode: "Duo",
      capacity: 48,
      prizePoints: 150,
      status: "Open",
      registeredCount: 0,
      date: new Date(Date.now() + 172800000)
    },
    {
      name: "Raavan Squad Championship",
      mode: "Squad",
      capacity: 48,
      prizePoints: 250,
      status: "Open",
      registeredCount: 0,
      date: new Date(Date.now() + 259200000)
    }
  ];

  for (const item of samples) {
    await addDoc(collection(db, "tournaments"), {
      ...item,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
  }

  await setDoc(markerRef, { seeded: true });
}

// ADMIN CREATE / EDIT TOURNAMENT
$("tournamentForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdmin()) return showMessage("Admin access required.");

  const name = $("tName").value.trim();
  const date = $("tDate").value;
  const capacity = Number($("tCapacity").value);
  const prizePoints = Number($("tPrize").value);

  if (!name || !date || capacity < 2 || prizePoints < 0) {
    return setFormMessage("adminMessage", "Please check all fields.", true);
  }

  const data = {
    name,
    mode: $("tMode").value,
    date: new Date(date),
    capacity,
    prizePoints,
    roomId: $("tRoom").value.trim(),
    roomPassword: $("tRoomPassword").value.trim()
  };

  try {
    if (editingTournamentId) {
      await updateDoc(doc(db, "tournaments", editingTournamentId), data);
      showMessage("Tournament updated.");
    } else {
      await addDoc(collection(db, "tournaments"), {
        ...data,
        status: "Open",
        registeredCount: 0,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      showMessage("Tournament created.");
    }

    cancelTournamentEdit();
    await loadTournaments();
    loadAdminData();

  } catch (error) {
    console.error(error);
    setFormMessage("adminMessage", error.message, true);
  }
});

function renderAdminTournaments() {
  if (!isAdmin()) return;

  $("adminTournamentList").innerHTML = tournaments.length
    ? tournaments.map(t => `
      <div class="admin-item">
        <h3>${escapeHTML(t.name)}</h3>
        <p class="muted small">${escapeHTML(t.mode)} • ${escapeHTML(t.status || "Closed")}</p>
        <p class="muted small">${Number(t.registeredCount || 0)} / ${Number(t.capacity || 0)} players</p>
        <div class="admin-actions">
          <button onclick="editTournament('${escapeHTML(t.id)}')">Edit</button>
          <button onclick="toggleTournament('${escapeHTML(t.id)}')">
            ${t.status === "Open" ? "Close" : "Open"}
          </button>
          <button class="danger" onclick="deleteTournament('${escapeHTML(t.id)}')">Delete</button>
        </div>
      </div>
    `).join("")
    : '<div class="empty">No tournaments found.</div>';
}

window.editTournament = function(id) {
  if (!isAdmin()) return;

  const t = tournaments.find(item => item.id === id);
  if (!t) return;

  editingTournamentId = id;
  $("tName").value = t.name || "";
  $("tMode").value = t.mode || "Solo";
  $("tCapacity").value = t.capacity || 48;
  $("tPrize").value = t.prizePoints || 0;
  $("tRoom").value = t.roomId || "";
  $("tRoomPassword").value = t.roomPassword || "";

  let date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
  if (!isNaN(date.getTime())) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    $("tDate").value = local.toISOString().slice(0, 16);
  }

  $("cancelEdit").classList.remove("hidden");
  $("tournamentForm").scrollIntoView({ behavior: "smooth" });
};

window.cancelTournamentEdit = function() {
  editingTournamentId = null;
  $("tournamentForm").reset();
  $("cancelEdit").classList.add("hidden");
  setFormMessage("adminMessage", "");
};

window.toggleTournament = async function(id) {
  if (!isAdmin()) return;

  const t = tournaments.find(item => item.id === id);
  if (!t) return;

  try {
    await updateDoc(doc(db, "tournaments", id), {
      status: t.status === "Open" ? "Closed" : "Open"
    });
    showMessage("Tournament status updated.");
    await loadTournaments();
  } catch (error) {
    showMessage(error.message);
  }
};

window.deleteTournament = async function(id) {
  if (!isAdmin()) return;
  if (!confirm("Delete this tournament? This cannot be undone.")) return;

  try {
    await deleteDoc(doc(db, "tournaments", id));
    showMessage("Tournament deleted.");
    await loadTournaments();
  } catch (error) {
    showMessage(error.message);
  }
};

// ADMIN DATA
async function loadAdminData() {
  if (!isAdmin()) return;

  renderAdminTournaments();
  $("adminRegistrationList").innerHTML = '<div class="empty">Loading...</div>';

  try {
    const snapshot = await getDocs(collection(db, "registrations"));

    if (snapshot.empty) {
      $("adminRegistrationList").innerHTML =
        '<div class="empty">No registrations yet.</div>';
      return;
    }

    $("adminRegistrationList").innerHTML = snapshot.docs.map(item => {
      const data = item.data();
      return `
        <div class="registration-item">
          <h3>${escapeHTML(data.tournamentName)}</h3>
          <p class="muted small">Player UID: ${escapeHTML(data.uid)}</p>
          <p class="muted small">Status: ${escapeHTML(data.status)}</p>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error(error);
    $("adminRegistrationList").innerHTML =
      '<div class="empty">Could not load registrations.</div>';
  }
}

// INITIAL PAGE
showPage("home");