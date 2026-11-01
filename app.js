// Raavan eSports - Firebase client. Configure firebaseConfig and ADMIN_EMAIL before use.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
  runTransaction, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Firebase Console > Project settings > Your apps > SDK setup and configuration.
// Never put service-account keys or private server credentials in this file.
const firebaseConfig = {
  apiKey: "AIzaSyCtwo7CgwQoPqIeffJ-rXTVKI1EucB9xMc",
  authDomain: "raavan-esports.firebaseapp.com",
  projectId: "raavan-esports",
  storageBucket: "raavan-esports.firebasestorage.app",
  messagingSenderId: "335379689665",
  appId: "1:335379689665:web:1eef94dc57144a081ba440"
};
// Must exactly match the admin email allowed in firestore.rules.
// Admin should register normally and verify this email first.
const ADMIN_EMAIL = "the.raavanff@gmail.com";

const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let currentFilter = "All";
let allTours = [];
let stopToursListener = null;
let stopRegsListener = null;
let toastTimer = null;

const sampleTours = [
  { mode:"BR", name:"BATTLE ROYALE", type:"SOLO TOURNAMENT", prizePoints:500, maxPlayers:100, registeredCount:0, entryPoints:0, dateLabel:"Schedule to be announced", map:"Bermuda", color:"red", mark:"BR", status:"Open", description:"Battle Royale community tournament." },
  { mode:"CS", name:"CLASH SQUAD", type:"4V4 TOURNAMENT", prizePoints:2000, maxPlayers:64, registeredCount:0, entryPoints:0, dateLabel:"Schedule to be announced", map:"Bermuda", color:"blue", mark:"CS", status:"Open", description:"Clash Squad community tournament." },
  { mode:"Solo", name:"SOLO SHOWDOWN", type:"SOLO TOURNAMENT", prizePoints:1000, maxPlayers:50, registeredCount:0, entryPoints:0, dateLabel:"Schedule to be announced", map:"Kalahari", color:"purple", mark:"SOLO", status:"Open", description:"Solo skill tournament." }
];

function isConfigured() {
  return firebaseConfig.apiKey !== "PASTE_YOUR_FIREBASE_WEB_API_KEY" &&
    firebaseConfig.projectId !== "PASTE_YOUR_PROJECT_ID";
}
function escapeHtml(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function moneyPoints(value) { return `${Number(value || 0).toLocaleString("en-IN")} pts`; }
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}
function openModal(title, html) { $("modalTitle").textContent = title; $("modalBody").innerHTML = html; $("modalBackdrop").classList.add("show"); }
function closeModal() { $("modalBackdrop").classList.remove("show"); }
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  $(`${name}Page`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  $("bottomNav").classList.toggle("hidden", name === "admin");
  window.scrollTo({top:0, behavior:"smooth"});
}
function adminUser() {
  return Boolean(currentUser && currentUser.emailVerified &&
    currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}
function tourCard(t) {
  const id = escapeHtml(t.id);
  const count = Number(t.registeredCount || 0);
  return `<article class="tour-card"><div class="tour-art ${escapeHtml(t.color || "red")}" data-mark="${escapeHtml(t.mark || t.mode)}">
    <span class="mode-pill">${escapeHtml(String(t.mode || "BR").toUpperCase())}</span>
    <span class="status-pill">${escapeHtml(String(t.status || "Open").toUpperCase())}</span>
    <h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.type || "TOURNAMENT")}</p>
  </div><div class="tour-body"><div class="metrics">
    <div class="metric"><strong>🏆 ${moneyPoints(t.prizePoints)}</strong><small>Prize points</small></div>
    <div class="metric"><strong>♟ ${count}/${Number(t.maxPlayers || 100)}</strong><small>Players</small></div>
    <div class="fee">${moneyPoints(t.entryPoints)}<small>ENTRY POINTS</small></div>
  </div><div class="meta-row"><span>◷ ${escapeHtml(t.dateLabel || "TBA")}</span><span>⌁ ${escapeHtml(t.map || "TBA")}</span></div>
  <button class="btn primary full" data-detail="${id}">View / Join →</button></div></article>`;
}
function renderTours() {
  const shown = allTours.filter(t => currentFilter === "All" || t.mode === currentFilter);
  $("tournamentCount").textContent = `${shown.length} available`;
  $("tournamentList").innerHTML = shown.length ? shown.map(tourCard).join("") : `<div class="empty">No tournaments in this category yet.</div>`;
  if (adminUser()) renderAdminTours();
}
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
  renderTours();
}
function startTourListener() {
  if (stopToursListener) stopToursListener();
  stopToursListener = onSnapshot(query(collection(db, "tournaments"), orderBy("createdAt", "desc")), snap => {
    allTours = snap.docs.map(d => ({id:d.id, ...d.data()}));
    renderTours();
  }, err => {
    console.error(err); $("tournamentList").innerHTML = `<div class="empty">Could not load tournaments. Check Firestore setup and Security Rules.</div>`;
    toast("Firebase data access error. Check setup.");
  });
}
async function seedTournamentsForAdmin() {
  if (!adminUser()) return;
  const snap = await getDocs(collection(db, "tournaments"));
  if (!snap.empty) return;
  for (const t of sampleTours) await addDoc(collection(db, "tournaments"), {...t, createdAt:serverTimestamp(), createdBy:currentUser.uid});
}
async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {displayName:user.displayName || (user.email || "Player").split("@")[0], email:user.email || "", points:0, createdAt:serverTimestamp()});
  }
}
async function loadProfile() {
  if (!currentUser) {
    $("profileName").textContent = "Guest player"; $("profileEmail").textContent = "Sign in to save your profile";
    $("pointsBalance").textContent = "— pts"; $("profileAuthBtn").textContent = "Login / Register";
    $("adminBtn").classList.add("hidden"); $("logoutBtn").classList.add("hidden");
    $("myRegistrations").innerHTML = `<div class="empty">Login to see your tournament registrations.</div>`;
    return;
  }
  $("profileName").textContent = currentUser.displayName || "Player";
  $("profileEmail").textContent = currentUser.email || "";
  $("profileAuthBtn").textContent = currentUser.emailVerified ? "Account verified" : "Verify email to enable account features";
  $("adminBtn").classList.toggle("hidden", !adminUser());
  $("logoutBtn").classList.remove("hidden");
  try {
    const u = await getDoc(doc(db, "users", currentUser.uid));
    $("pointsBalance").textContent = moneyPoints(u.exists() ? u.data().points : 0);
  } catch (e) { $("pointsBalance").textContent = "Unavailable"; console.error(e); }
  await loadRegistrations();
}
async function loadRegistrations() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, "registrations"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const regs = snap.docs.map(d => ({id:d.id,...d.data()}));
    $("myRegistrations").innerHTML = regs.length ? regs.map(r => `<div class="admin-row"><div class="admin-row-top"><strong>${escapeHtml(r.tournamentName || "Tournament")}</strong><span class="status-tag">${escapeHtml(r.status || "Registered")}</span></div><small>Registered ${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : "just now"}</small></div>`).join("") : `<div class="empty">You haven't joined any tournaments yet.</div>`;
  } catch(e) { console.error(e); $("myRegistrations").innerHTML = `<div class="empty">Could not load registrations. Check Firestore index/rules.</div>`; }
}
function detailModal(t) {
  openModal("Tournament details", `<div class="tour-art ${escapeHtml(t.color || "red")}" data-mark="${escapeHtml(t.mark || t.mode)}"><span class="mode-pill">${escapeHtml(t.mode)}</span><span class="status-pill">${escapeHtml(t.status || "Open")}</span><h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.type || "TOURNAMENT")}</p></div>
    <div class="detail-row"><span>Prize</span><strong>${moneyPoints(t.prizePoints)}</strong></div><div class="detail-row"><span>Entry</span><strong>${moneyPoints(t.entryPoints)}</strong></div><div class="detail-row"><span>Players</span><strong>${Number(t.registeredCount||0)}/${Number(t.maxPlayers||100)}</strong></div><div class="detail-row"><span>Schedule</span><strong>${escapeHtml(t.dateLabel || "TBA")}</strong></div><div class="detail-row"><span>Map</span><strong>${escapeHtml(t.map || "TBA")}</strong></div><p>${escapeHtml(t.description || "Follow the tournament organiser's instructions and play fairly.")}</p><p class="form-note">This build uses non-cash points. Registration is saved to Firebase; no payment is taken.</p><button class="btn primary full" id="confirmJoinBtn">Register for tournament</button>`);
  $("confirmJoinBtn").addEventListener("click", () => registerTournament(t.id));
}
async function registerTournament(tournamentId) {
  if (!currentUser) { closeModal(); authModal("login"); return; }
  if (!currentUser.emailVerified) { toast("Verify your email before registering."); return; }
  try {
    await runTransaction(db, async tx => {
      const tourRef = doc(db, "tournaments", tournamentId);
      const regRef = doc(db, "registrations", `${currentUser.uid}_${tournamentId}`);
      const userRef = doc(db, "users", currentUser.uid);
      const [tourSnap, regSnap, userSnap] = await Promise.all([tx.get(tourRef), tx.get(regRef), tx.get(userRef)]);
      if (!tourSnap.exists()) throw new Error("Tournament no longer exists.");
      const t = tourSnap.data();
      if (t.status !== "Open") throw new Error("This tournament is closed.");
      if (regSnap.exists()) throw new Error("You are already registered.");
      if (Number(t.registeredCount || 0) >= Number(t.maxPlayers || 100)) throw new Error("This tournament is full.");
      if (!userSnap.exists()) throw new Error("Your profile is missing. Sign out and sign in again.");
      tx.set(regRef, {uid:currentUser.uid, tournamentId, tournamentName:t.name, status:"Registered", createdAt:serverTimestamp()});
      tx.update(tourRef, {registeredCount:Number(t.registeredCount || 0)+1});
    });
    closeModal(); toast("Tournament registration saved!"); await loadProfile();
  } catch(e) { console.error(e); toast(e.message || "Registration failed."); }
}
function authModal(mode="login") {
  const register = mode === "register";
  openModal(register ? "Create account" : "Login", `<div class="form-note">Use an email you can access. Email verification is required before tournament registration.</div>
    ${register ? `<label class="field-label">Display name</label><input class="field" id="authName" maxlength="28" placeholder="Your player name">` : ""}
    <label class="field-label">Email</label><input class="field" id="authEmail" type="email" autocomplete="email" placeholder="you@example.com">
    <label class="field-label">Password</label><input class="field" id="authPassword" type="password" autocomplete="${register?"new-password":"current-password"}" minlength="6" placeholder="At least 6 characters">
    <button id="authSubmit" class="btn primary full" style="margin-top:16px">${register?"Register":"Login"}</button>
    <button id="authSwitch" class="text-btn full" style="margin-top:12px">${register?"Already have an account? Login":"New here? Create an account"}</button>
    <p class="form-note">Admin uses this same login. Admin privileges are only granted to the verified email configured in app.js and firestore.rules.</p>`);
  $("authSubmit").addEventListener("click", async () => {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    if (!email || password.length < 6) { toast("Enter a valid email and password (6+ characters)."); return; }
    try {
      if (register) {
        const name = $("authName").value.trim() || email.split("@")[0];
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, {displayName:name});
        await result.user.reload();
        // Import is dynamic so the initial auth code stays readable.
        const { sendEmailVerification } = await import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js");
        await sendEmailVerification(result.user);
        await ensureUserDoc(result.user);
        closeModal(); toast("Account created. Check your inbox to verify email.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(); toast("Signed in.");
      }
    } catch(e) { console.error(e); toast(authError(e.code)); }
  });
  $("authSwitch").addEventListener("click", () => authModal(register ? "login" : "register"));
}
function authError(code) {
  const map = {"auth/email-already-in-use":"That email already has an account.","auth/invalid-email":"Enter a valid email.","auth/weak-password":"Use a stronger password.","auth/invalid-credential":"Email or password is incorrect.","auth/too-many-requests":"Too many attempts. Try again later.","auth/network-request-failed":"Network error. Check your connection."};
  return map[code] || "Authentication failed. Check Firebase Authentication setup.";
}
function renderAdminTours() {
  if (!adminUser()) return;
  $("adminCount").textContent = allTours.length; $("adminEmail").textContent = currentUser.email;
  $("adminTournamentList").innerHTML = allTours.length ? allTours.map(t => `<div class="admin-row"><div class="admin-row-top"><strong>${escapeHtml(t.name)}</strong><span class="status-tag">${escapeHtml(t.status || "Open")}</span></div><small>${escapeHtml(t.mode)} · Prize ${moneyPoints(t.prizePoints)} · Entry ${moneyPoints(t.entryPoints)} · ${escapeHtml(t.dateLabel || "TBA")}</small><div class="admin-actions"><button class="btn secondary" data-edit="${escapeHtml(t.id)}">Edit</button><button class="btn secondary" data-toggle="${escapeHtml(t.id)}">${t.status === "Open" ? "Close" : "Reopen"}</button><button class="btn secondary" data-delete="${escapeHtml(t.id)}">Delete</button></div></div>`).join("") : `<div class="empty">No tournaments yet. Tap Add to create one.</div>`;
}
function tournamentForm(t=null) {
  const edit = Boolean(t);
  openModal(edit ? "Edit tournament" : "Add tournament", `<label class="field-label">Tournament title</label><input class="field" id="fName" maxlength="48" value="${escapeHtml(t?.name || "")}" placeholder="e.g. Battle Royale">
  <label class="field-label">Mode</label><select class="field" id="fMode"><option value="BR" ${t?.mode==="BR"?"selected":""}>Battle Royale</option><option value="CS" ${t?.mode==="CS"?"selected":""}>Clash Squad</option><option value="Solo" ${t?.mode==="Solo"?"selected":""}>Solo</option><option value="Custom" ${t?.mode==="Custom"?"selected":""}>Custom</option></select>
  <div class="two-fields"><div><label class="field-label">Prize points</label><input class="field" id="fPrize" type="number" min="0" max="1000000" value="${Number(t?.prizePoints ?? 500)}"></div><div><label class="field-label">Entry points</label><input class="field" id="fEntry" type="number" min="0" max="100000" value="${Number(t?.entryPoints ?? 0)}"></div></div>
  <div class="two-fields"><div><label class="field-label">Max players</label><input class="field" id="fMax" type="number" min="2" max="10000" value="${Number(t?.maxPlayers ?? 100)}"></div><div><label class="field-label">Schedule label</label><input class="field" id="fDate" maxlength="60" value="${escapeHtml(t?.dateLabel || "Schedule to be announced")}"></div></div>
  <label class="field-label">Map</label><input class="field" id="fMap" maxlength="40" value="${escapeHtml(t?.map || "Bermuda")}">
  <label class="field-label">Description</label><textarea class="field" id="fDescription" maxlength="500" rows="3">${escapeHtml(t?.description || "")}</textarea>
  <button id="saveTournamentBtn" class="btn primary full" style="margin-top:16px">${edit?"Save changes":"Create tournament"}</button>`);
  $("saveTournamentBtn").addEventListener("click", () => saveTournament(t?.id || null));
}
async function saveTournament(id) {
  if (!adminUser()) { toast("Admin access required."); return; }
  const name = $("fName").value.trim(), mode = $("fMode").value;
  const prizePoints = Number($("fPrize").value), entryPoints = Number($("fEntry").value), maxPlayers = Number($("fMax").value);
  if (!name || !Number.isSafeInteger(prizePoints) || prizePoints < 0 || !Number.isSafeInteger(entryPoints) || entryPoints < 0 || !Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 10000) { toast("Check tournament title and numeric fields."); return; }
  const data = {name, mode, type:mode==="CS"?"4V4 TOURNAMENT":mode==="Custom"?"CUSTOM ROOM":mode==="Solo"?"SOLO TOURNAMENT":"BATTLE ROYALE TOURNAMENT", prizePoints, entryPoints, maxPlayers, dateLabel:$("fDate").value.trim() || "Schedule to be announced", map:$("fMap").value.trim() || "TBA", description:$("fDescription").value.trim(), color:mode==="CS"?"blue":mode==="Solo"?"purple":mode==="Custom"?"gold":"red", mark:mode==="Custom"?"CUSTOM":mode, status:"Open"};
  try {
    if (id) await updateDoc(doc(db,"tournaments",id), data);
    else await addDoc(collection(db,"tournaments"), {...data, registeredCount:0, createdAt:serverTimestamp(), createdBy:currentUser.uid});
    closeModal(); toast(id ? "Tournament updated." : "Tournament created.");
  } catch(e) { console.error(e); toast("Save failed. Check admin email and Firestore Rules."); }
}
async function toggleTournament(id) {
  const t = allTours.find(x => x.id === id); if (!t || !adminUser()) return;
  try { await updateDoc(doc(db,"tournaments",id), {status:t.status==="Open"?"Closed":"Open"}); toast("Tournament status updated."); }
  catch(e) { console.error(e); toast("Could not update tournament."); }
}
async function deleteTournament(id) {
  if (!adminUser()) return;
  openModal("Delete tournament?", `<p>This deletes the tournament listing. Existing registration records are not automatically deleted.</p><button class="btn primary full" id="confirmDelete">Delete listing</button><button class="btn secondary full" id="cancelDelete" style="margin-top:8px">Cancel</button>`);
  $("cancelDelete").addEventListener("click", closeModal);
  $("confirmDelete").addEventListener("click", async () => {
    try { await deleteDoc(doc(db,"tournaments",id)); closeModal(); toast("Tournament listing deleted."); }
    catch(e) { console.error(e); toast("Delete failed. Check permissions."); }
  });
}
async function editName() {
  if (!currentUser) { authModal(); return; }
  openModal("Edit display name", `<label class="field-label">Display name</label><input class="field" id="displayNameField" maxlength="28" value="${escapeHtml(currentUser.displayName || "")}"><button class="btn primary full" id="saveNameBtn" style="margin-top:14px">Save name</button>`);
  $("saveNameBtn").addEventListener("click", async () => {
    const name = $("displayNameField").value.trim(); if (!name) { toast("Enter a display name."); return; }
    try { await updateProfile(currentUser,{displayName:name}); await setDoc(doc(db,"users",currentUser.uid),{displayName:name},{merge:true}); await currentUser.reload(); closeModal(); await loadProfile(); toast("Display name saved."); }
    catch(e) { console.error(e); toast("Could not save profile."); }
  });
}

$("modalClose").addEventListener("click", closeModal);
$("modalBackdrop").addEventListener("click", e => { if(e.target === $("modalBackdrop")) closeModal(); });
document.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); });
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));
document.querySelectorAll(".filter").forEach(b => b.addEventListener("click", () => setFilter(b.dataset.filter)));
$("exploreBtn").addEventListener("click", () => $("tournamentList").scrollIntoView({behavior:"smooth"}));
$("headerLogin").addEventListener("click", () => authModal());
$("profileAuthBtn").addEventListener("click", () => currentUser ? toast(currentUser.emailVerified ? "You are signed in." : "Please verify your email from your inbox.") : authModal());
$("editNameBtn").addEventListener("click", editName);
$("myTournamentsBtn").addEventListener("click", async () => { showPage("wallet"); await loadRegistrations(); });
$("supportBtn").addEventListener("click", () => openModal("Help & support", `<p>Contact your tournament organiser using the support details published by your community.</p><p class="form-note">Add a verified support email or ticket backend before launch.</p>`));
$("adminBtn").addEventListener("click", () => { if (!adminUser()) return toast("Admin access denied."); showPage("admin"); renderAdminTours(); });
$("adminBack").addEventListener("click", () => showPage("profile"));
$("logoutBtn").addEventListener("click", async () => { try { await signOut(auth); showPage("home"); toast("Signed out."); } catch(e) { toast("Sign out failed."); } });
$("addTournamentBtn").addEventListener("click", () => tournamentForm());
$("tournamentList").addEventListener("click", e => {
  const b = e.target.closest("[data-detail]"); if (!b) return;
  const t = allTours.find(x => x.id === b.dataset.detail); if (t) detailModal(t);
});
$("adminTournamentList").addEventListener("click", e => {
  const edit = e.target.closest("[data-edit]"), toggle = e.target.closest("[data-toggle]"), del = e.target.closest("[data-delete]");
  if (edit) { const t = allTours.find(x => x.id === edit.dataset.edit); if (t) tournamentForm(t); }
  if (toggle) toggleTournament(toggle.dataset.toggle);
  if (del) deleteTournament(del.dataset.delete);
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    try { await ensureUserDoc(user); } catch(e) { console.error(e); }
  }
  await loadProfile();
  if (user && adminUser()) {
    $("adminBtn").classList.remove("hidden");
    try { await seedTournamentsForAdmin(); } catch(e) { console.error("Seed skipped:", e); }
  }
  if (isConfigured()) startTourListener();
  else {
    $("tournamentList").innerHTML = `<div class="empty">Firebase setup required. Follow README.md, add your Firebase web config to app.js, then reload.</div>`;
    $("tournamentCount").textContent = "Setup required";
  }
});
