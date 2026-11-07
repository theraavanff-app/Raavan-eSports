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
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =====================================
// ADMIN CONFIGURATION
// =====================================

const ADMIN_EMAIL = "the.raavanff@gmail.com";
let adminVerified = false;

// =====================================
// HTML ELEMENTS
// =====================================

const tournamentForm = document.getElementById("tournamentForm");
const tournamentList = document.getElementById("tournamentList");
const tournamentMessage = document.getElementById("tournamentMessage");

const bannerForm = document.getElementById("bannerForm");
const bannerList = document.getElementById("bannerList");
const bannerMessage = document.getElementById("bannerMessage");

const cardSettingsForm = document.getElementById("cardSettingsForm");
const settingsMessage = document.getElementById("settingsMessage");

const adminLogout = document.getElementById("adminLogout");

const joinedPlayersSection =
    document.getElementById("joinedPlayersSection");

const joinedTournamentTitle =
    document.getElementById("joinedTournamentTitle");

const joinedPlayersCount =
    document.getElementById("joinedPlayersCount");

const joinedPlayersList =
    document.getElementById("joinedPlayersList");

// =====================================
// SAFE HTML
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// =====================================
// FIREBASE ADMIN AUTHENTICATION
// =====================================

onAuthStateChanged(auth, async (user) => {

    console.log("Firebase Admin Check:", user?.email || "NO USER");

    if (!user) {
        window.location.replace("./login.html");
        return;
    }

    if (
        user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()
    ) {
        alert("Wrong Firebase account detected.");

        await signOut(auth);
        window.location.replace("./login.html");
        return;
    }

    adminVerified = true;

    console.log("Raavan eSports Admin Verified!");

    await loadTournaments();
    await loadCardSettings();
    await loadBanners();
});

// =====================================
// ADMIN LOGOUT
// =====================================

adminLogout.addEventListener("click", async () => {

    try {
        await signOut(auth);
        window.location.replace("./login.html");

    } catch (error) {
        console.error("Logout error:", error);
        alert("Logout failed: " + error.message);
    }
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

        const players =
            Number(document.getElementById("tPlayers").value || 0);

        const capacity =
            Number(document.getElementById("tCapacity").value);

        if (!name || !category || !prizePool || !capacity) {
            throw new Error("Please fill all required fields.");
        }

        if (
            !Number.isInteger(players) ||
            !Number.isInteger(capacity) ||
            players < 0 ||
            capacity < 1 ||
            players > capacity
        ) {
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

        tournamentMessage.textContent =
            "Tournament created successfully!";

        await loadTournaments();

    } catch (error) {

        console.error("Tournament creation error:", error);
        tournamentMessage.textContent =
            error.message || "Something went wrong.";
    }
});

// =====================================
// LOAD TOURNAMENTS
// =====================================

async function loadTournaments() {

    if (!adminVerified) return;

    tournamentList.textContent = "Loading tournaments...";

    try {

        const snapshot =
            await getDocs(collection(db, "tournaments"));

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

                    <p>
                        ${escapeHTML(data.category)}
                        |
                        ${escapeHTML(data.map)}
                    </p>

                    <p>
                        Players:
                        ${escapeHTML(data.players)}
                        /
                        ${escapeHTML(data.capacity)}
                    </p>
                </div>

                <div class="admin-tournament-actions">

                    <button
                        class="view-players"
                        data-id="${escapeHTML(item.id)}"
                        data-name="${escapeHTML(data.name)}">
                        VIEW PLAYERS
                    </button>

                    <button
                        class="delete-tournament"
                        data-id="${escapeHTML(item.id)}">
                        DELETE
                    </button>

                </div>
            `;

            tournamentList.appendChild(card);
        });

    } catch (error) {

        console.error("Tournament loading error:", error);
        tournamentList.textContent =
            "Unable to load tournaments: " + error.message;
    }
}

// =====================================
// TOURNAMENT BUTTONS
// VIEW PLAYERS + DELETE
// =====================================

tournamentList.addEventListener("click", async (e) => {

    if (!adminVerified) return;

    // VIEW PLAYERS
    const viewButton = e.target.closest(".view-players");

    if (viewButton) {

    const tournamentId = viewButton.dataset.id;
    const tournamentName = viewButton.dataset.name;

    await loadJoinedPlayers(tournamentId, tournamentName);
    return;
    }

    // DELETE TOURNAMENT
    const deleteButton = e.target.closest(".delete-tournament");

    if (!deleteButton) return;

    const id = deleteButton.dataset.id;

    if (!confirm("Are you sure you want to delete this tournament?")) {
        return;
    }

    try {

        await deleteDoc(doc(db, "tournaments", id));

        if (
            joinedTournamentTitle &&
            joinedTournamentTitle.dataset.id === id
        ) {
            joinedPlayersSection.hidden = true;
        }

        await loadTournaments();

    } catch (error) {

        console.error("Tournament delete error:", error);
        alert("Tournament delete failed: " + error.message);
    }
});

// =====================================
// LOAD JOINED PLAYERS
// =====================================

async function loadJoinedPlayers(tournamentId, tournamentName) {

    if (!adminVerified) return;

    joinedPlayersSection.hidden = false;

    joinedTournamentTitle.textContent =
        "Tournament: " + tournamentName;

    joinedTournamentTitle.dataset.id = tournamentId;

    joinedPlayersCount.textContent = "Loading...";
    joinedPlayersList.innerHTML = "<p>Loading players...</p>";

    joinedPlayersSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {

        const joinsQuery = query(
            collection(db, "tournamentJoins"),
            where("tournamentId", "==", tournamentId)
        );

        const joinSnapshot = await getDocs(joinsQuery);

        if (joinSnapshot.empty) {

            joinedPlayersCount.textContent = "Total Players: 0";

            joinedPlayersList.innerHTML = `
                <p class="no-joined-players">
                    No players have joined this tournament yet.
                </p>
            `;

            return;
        }

        // Fetch player profiles
        const players = await Promise.all(
            joinSnapshot.docs.map(async (joinDoc) => {

                const joinData = joinDoc.data();

                if (!joinData.uid) return null;

                const userSnapshot = await getDoc(
                    doc(db, "users", joinData.uid)
                );

                if (!userSnapshot.exists()) {

                    return {
                        name: "Player",
                        playerId: "Not available"
                    };
                }

                const userData = userSnapshot.data();

                return {
                    name: userData.name || "Player",
                    playerId: userData.playerId || "Not available"
                };
            })
        );

        const validPlayers = players.filter(Boolean);

        joinedPlayersCount.textContent =
            "Total Players: " + validPlayers.length;

        joinedPlayersList.innerHTML = "";

        validPlayers.forEach((player, index) => {

            const playerCard = document.createElement("div");

            playerCard.className = "joined-player-item";

            playerCard.innerHTML = `
                <div class="joined-player-number">
                    ${index + 1}
                </div>

                <div class="joined-player-info">
                    <h4>${escapeHTML(player.name)}</h4>
                    <p>Player ID: ${escapeHTML(player.playerId)}</p>
                </div>
            `;

            joinedPlayersList.appendChild(playerCard);
        });

    } catch (error) {

        console.error("Joined players loading error:", error);

        joinedPlayersCount.textContent = "";

        joinedPlayersList.innerHTML = `
            <p class="players-error">
                Unable to load players: ${escapeHTML(error.message)}
            </p>
        `;
    }
}

// =====================================
// LOAD CARD SETTINGS
// =====================================

async function loadCardSettings() {

    if (!adminVerified) return;

    try {

        const settingsRef = doc(db, "appSettings", "cardFields");
        const settingsSnap = await getDoc(settingsRef);

        if (!settingsSnap.exists()) return;

        const settings = settingsSnap.data();

        Object.keys(settings).forEach((key) => {

            const checkbox =
                cardSettingsForm.elements.namedItem(key);

            if (checkbox && checkbox.type === "checkbox") {
                checkbox.checked = settings[key] === true;
            }
        });

    } catch (error) {
        console.error("Settings load error:", error);
    }
}

// =====================================
// SAVE CARD SETTINGS
// =====================================

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

            settings[field] =
                cardSettingsForm.elements.namedItem(field).checked;
        });

        await setDoc(
            doc(db, "appSettings", "cardFields"),
            settings
        );

        settingsMessage.textContent =
            "Settings saved successfully!";

    } catch (error) {

        console.error("Settings save error:", error);

        settingsMessage.textContent =
            "Settings save failed: " + error.message;
    }
});

// =====================================
// ADD BANNER
// =====================================

bannerForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    if (!adminVerified) return;

    const url = document.getElementById("bannerUrl").value.trim();

    bannerMessage.textContent = "Adding banner...";

    try {

        const parsedUrl = new URL(url);

        if (
            parsedUrl.protocol !== "https:" &&
            parsedUrl.protocol !== "http:"
        ) {
            throw new Error(
                "Only HTTP or HTTPS image URLs are allowed."
            );
        }

        await addDoc(collection(db, "banners"), {
            imageUrl: url,
            createdAt: serverTimestamp()
        });

        bannerForm.reset();

        bannerMessage.textContent =
            "Banner added successfully!";

        await loadBanners();

    } catch (error) {

        console.error("Banner add error:", error);

        bannerMessage.textContent =
            error.message || "Banner add failed.";
    }
});

// =====================================
// LOAD BANNERS
// =====================================

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

        console.error("Banner loading error:", error);

        bannerList.textContent =
            "Unable to load banners: " + error.message;
    }
}

// =====================================
// DELETE BANNER
// =====================================

bannerList.addEventListener("click", async (e) => {

    const button = e.target.closest(".delete-banner");

    if (!button || !adminVerified) return;

    const id = button.dataset.id;

    if (!confirm("Delete this banner?")) return;

    try {

        await deleteDoc(doc(db, "banners", id));

        await loadBanners();

    } catch (error) {

        console.error("Banner delete error:", error);

        alert("Banner delete failed: " + error.message);
    }
});
