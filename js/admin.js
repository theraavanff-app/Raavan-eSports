
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Admin email
const ADMIN_EMAIL = "the.raavanff@gmail.com";

// HTML elements
const tournamentForm = document.getElementById("tournamentForm");
const tournamentList = document.getElementById("tournamentList");
const tournamentMessage = document.getElementById("tournamentMessage");

const bannerForm = document.getElementById("bannerForm");
const bannerList = document.getElementById("bannerList");
const bannerMessage = document.getElementById("bannerMessage");

const cardSettingsForm = document.getElementById("cardSettingsForm");
const settingsMessage = document.getElementById("settingsMessage");

const adminLogout = document.getElementById("adminLogout");

let adminVerified = false;

// Safe HTML text
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Check admin login
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./login.html";
        return;
    }

    if (user.email !== ADMIN_EMAIL) {
        alert("Access denied! Admin only.");
        await signOut(auth);
        window.location.href = "./login.html";
        return;
    }

    adminVerified = true;

    await loadTournaments();
    await loadCardSettings();
    await loadBanners();
});

// Logout
adminLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./login.html";
});

// =====================================
// CREATE TOURNAMENT
// =====================================

tournamentForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!adminVerified) return;

    tournamentMessage.textContent = "Creating tournament...";

    try {
        const name = document.getElementById("tName").value.trim();
        const category = document.getElementById("tCategory").value;
        const prizePool = document.getElementById("tPrize").value.trim();
        const perKillReward = document.getElementById("tPerKill").value.trim();
        const booyahPrize = document.getElementById("tBooyah").value.trim();
        const entryFees = document.getElementById("tEntry").value.trim();
        const map = document.getElementById("tMap").value.trim();
        const time = document.getElementById("tTime").value.trim();

        const players = Number(document.getElementById("tPlayers").value || 0);
        const capacity = Number(document.getElementById("tCapacity").value);

        if (!name || !category || !prizePool || !capacity) {
            throw new Error("Please fill all required fields.");
        }

        if (!Number.isInteger(players) || !Number.isInteger(capacity) ||
            players < 0 || capacity < 1 || players > capacity) {
            throw new Error("Please enter valid player numbers.");
        }

        await addDoc(collection(db, "tournaments"), {
            name,
            category,
            prizePool,
            perKillReward,
            booyahPrize,
            entryFees,
            map,
            time,
            players,
            capacity,
            isActive: true,
            createdAt: serverTimestamp()
        });

        tournamentForm.reset();
        document.getElementById("tPlayers").value = 0;

        tournamentMessage.textContent = "Tournament created successfully!";

        await loadTournaments();

    } catch (error) {
        console.error(error);
        tournamentMessage.textContent = error.message || "Something went wrong.";
    }
});

// Load tournaments
async function loadTournaments() {
    if (!adminVerified) return;

    tournamentList.textContent = "Loading tournaments...";

    try {
        const snapshot = await getDocs(collection(db, "tournaments"));

        if (snapshot.empty) {
            tournamentList.innerHTML = "<p>No tournaments found.</p>";
            return;
        }

        tournamentList.innerHTML = "";

        snapshot.forEach((item) => {
            const data = item.data();

            const card = document.createElement("div");
            card.className = "admin-item";

            card.innerHTML = `
                <div>
                    <h4>${escapeHTML(data.name)}</h4>
                    <p>${escapeHTML(data.category)} | ${escapeHTML(data.map)}</p>
                    <p>Players: ${escapeHTML(data.players)} / ${escapeHTML(data.capacity)}</p>
                </div>
                <button class="delete-tournament" data-id="${escapeHTML(item.id)}">
                    DELETE
                </button>
            `;

            tournamentList.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        tournamentList.textContent = "Unable to load tournaments.";
    }
}

// Delete tournament
tournamentList.addEventListener("click", async (e) => {
    const button = e.target.closest(".delete-tournament");

    if (!button || !adminVerified) return;

    const id = button.dataset.id;

    if (!confirm("Are you sure you want to delete this tournament?")) return;

    try {
        await deleteDoc(doc(db, "tournaments", id));
        await loadTournaments();
    } catch (error) {
        console.error(error);
        alert("Tournament delete failed: " + error.message);
    }
});

// =====================================
// TOURNAMENT CARD SETTINGS
// =====================================

async function loadCardSettings() {
    if (!adminVerified) return;

    try {
        const settingsRef = doc(db, "appSettings", "cardFields");
        const settingsSnap = await getDoc(settingsRef);

        if (!settingsSnap.exists()) return;

        const settings = settingsSnap.data();

        Object.keys(settings).forEach((key) => {
            const checkbox = cardSettingsForm.elements.namedItem(key);

            if (checkbox && checkbox.type === "checkbox") {
                checkbox.checked = settings[key] === true;
            }
        });

    } catch (error) {
        console.error("Settings load error:", error);
    }
}

cardSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!adminVerified) return;

    settingsMessage.textContent = "Saving settings...";

    try {
        const fields = [
            "prizePool",
            "perKillReward",
            "booyahPrize",
            "entryFees",
            "map",
            "playersCount"
        ];

        const settings = {};

        fields.forEach((field) => {
            settings[field] = cardSettingsForm.elements.namedItem(field).checked;
        });

        await setDoc(doc(db, "appSettings", "cardFields"), settings);

        settingsMessage.textContent = "Settings saved successfully!";

    } catch (error) {
        console.error(error);
        settingsMessage.textContent = "Settings save failed: " + error.message;
    }
});

// =====================================
// BANNER MANAGEMENT - URL ONLY
// =====================================

bannerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!adminVerified) return;

    const url = document.getElementById("bannerUrl").value.trim();

    bannerMessage.textContent = "Adding banner...";

    try {
        const parsedUrl = new URL(url);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("Only HTTP or HTTPS image URLs are allowed.");
        }

        await addDoc(collection(db, "banners"), {
            imageUrl: url,
            createdAt: serverTimestamp()
        });

        bannerForm.reset();

        bannerMessage.textContent = "Banner added successfully!";

        await loadBanners();

    } catch (error) {
        console.error(error);
        bannerMessage.textContent = error.message || "Banner add failed.";
    }
});

// Load banners
async function loadBanners() {
    if (!adminVerified) return;

    bannerList.textContent = "Loading banners...";

    try {
        const snapshot = await getDocs(collection(db, "banners"));

        if (snapshot.empty) {
            bannerList.innerHTML = "<p>No banners added yet.</p>";
            return;
        }

        bannerList.innerHTML = "";

        snapshot.forEach((item) => {
            const data = item.data();

            const card = document.createElement("div");
            card.className = "admin-item";

            const image = document.createElement("img");
            image.src = data.imageUrl;
            image.alt = "Banner preview";
            image.style.width = "100%";
            image.style.maxWidth = "260px";
            image.style.height = "100px";
            image.style.objectFit = "cover";
            image.style.borderRadius = "10px";

            image.onerror = () => {
                image.alt = "Image URL could not be loaded";
                image.removeAttribute("src");
            };

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "DELETE";
            deleteButton.className = "delete-banner";
            deleteButton.dataset.id = item.id;

            card.appendChild(image);
            card.appendChild(deleteButton);
            bannerList.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        bannerList.textContent = "Unable to load banners.";
    }
}

// Delete banner
bannerList.addEventListener("click", async (e) => {
    const button = e.target.closest(".delete-banner");

    if (!button || !adminVerified) return;

    const id = button.dataset.id;

    if (!confirm("Delete this banner?")) return;

    try {
        await deleteDoc(doc(db, "banners", id));
        await loadBanners();
    } catch (error) {
        console.error(error);
        alert("Banner delete failed: " + error.message);
    }
});
