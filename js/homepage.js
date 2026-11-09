import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    runTransaction,
    serverTimestamp,
    onSnapshot,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// =====================================
// CONFIGURATION
// =====================================

const UPI_ID = "gautam.raj-sahu@pthdfc";
const PAYEE_NAME = "Gautam Sahu";

const COIN_PACKAGES = [10, 20, 50, 100, 200, 500];

const joinedTournaments = new Set();

let tournaments = [];

let cardSettings = {
    prizePool: true,
    perKillReward: true,
    booyahPrize: true,
    entryFees: true,
    map: true,
    playersCount: true
};

let banners = [];
let bannerTimer = null;
let unsubscribeTournaments = null;

let walletBalance = 0;
let walletRequests = [];
let walletWithdrawals = [];
let walletTransactions = [];

let walletListenersStarted = false;

// =====================================
// HELPERS
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

function collectTeamRoster(teamFormat) {
    return new Promise(resolve => {
        const playerCount = {
            Solo: 1,
            Duo: 2,
            Squad: 4
        }[teamFormat] || 1;

        const overlay = document.createElement("div");
        overlay.className = "team-join-overlay";

        let playerFields = "";

        for (let i = 1; i <= playerCount; i++) {
            playerFields += `
                <div class="team-player-card">
                    <div class="team-player-heading">
                        <span>PLAYER ${i}</span>
                        <b>👤</b>
                    </div>

                    <label>FREE FIRE UID</label>
                    <input
                        type="text"
                        class="team-uid"
                        maxlength="24"
                        placeholder="Enter Player ${i} UID"
                        required
                    >

                    <label>FREE FIRE NICKNAME</label>
                    <input
                        type="text"
                        class="team-nickname"
                        maxlength="30"
                        placeholder="Enter Player ${i} Nickname"
                        required
                    >
                </div>
            `;
        }

        overlay.innerHTML = `
            <div class="team-join-box">
                <div class="team-join-top">
                    <span>⚡ RAAVAN ESPORTS</span>
                    <button type="button" class="team-join-close">×</button>
                </div>

                <div class="team-join-icon">🏆</div>
                <h2>REGISTER YOUR TEAM</h2>
                <p class="team-join-subtitle">
                    Enter all players' Free Fire details
                </p>

                <div class="team-format-badge">
                    ${teamFormat.toUpperCase()} MATCH • ${playerCount} PLAYER${playerCount > 1 ? "S" : ""}
                </div>

                <form class="team-join-form">
                    ${playerFields}

                    <p class="team-join-error"></p>

                    <button type="submit" class="team-confirm-btn">
                        CONFIRM JOIN →
                    </button>

                    <button type="button" class="team-cancel-btn">
                        CANCEL
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        const closePopup = (result = null) => {
            overlay.remove();
            resolve(result);
        };

        overlay.querySelector(".team-join-close").onclick =
            () => closePopup();

        overlay.querySelector(".team-cancel-btn").onclick =
            () => closePopup();

        overlay.querySelector(".team-join-form").onsubmit = event => {
            event.preventDefault();

            const uids = [...overlay.querySelectorAll(".team-uid")];
            const names = [...overlay.querySelectorAll(".team-nickname")];

            const roster = uids.map((input, index) => ({
                ffUid: input.value.trim(),
                nickname: names[index].value.trim()
            }));

            const error = overlay.querySelector(".team-join-error");

            if (roster.some(p => !p.ffUid || !p.nickname)) {
                error.textContent = "Please fill all player details.";
                return;
            }

            if (roster.some(p =>
                !/^\d+$/.test(p.ffUid)
            )) {
                error.textContent = "Free Fire UID must contain numbers only.";
                return;
            }

            if (new Set(roster.map(p => p.ffUid)).size !== roster.length) {
                error.textContent = "Each player must have a different UID.";
                return;
            }

            closePopup(roster);
        };

        overlay.querySelector(".team-uid").focus();
    });
}

function formatWalletDate(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return "Just now";
    }

    return timestamp.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}
function formatMatchDateTime(item) {
    const value = item.matchDateTime;

    let date = null;

    if (value?.toDate) {
        date = value.toDate();
    } else if (value) {
        date = new Date(value);
    }

    if (date && !Number.isNaN(date.getTime())) {
        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    }

    return item.time || "Time not set";
}

function getTournamentStatus(item) {
    const players = Number(item.players || 0);
    const capacity = Number(item.capacity || 0);

    return capacity > 0 && players >= capacity
        ? "full"
        : "available";
}

// =====================================
// LOAD DATA
// =====================================

async function loadTournaments() {
    const snapshot = await getDocs(
        collection(db, "tournaments")
    );

    tournaments = snapshot.docs
        .map(item => ({
            id: item.id,
            ...item.data()
        }))
        .filter(item => item.isActive !== false);
}

async function loadJoinedTournaments() {
    joinedTournaments.clear();

    const user = auth.currentUser;
    if (!user) return;

    const snapshot = await getDocs(
        query(
            collection(db, "tournamentJoins"),
            where("uid", "==", user.uid)
        )
    );

    snapshot.forEach(item => {
        joinedTournaments.add(
            String(item.data().tournamentId)
        );
    });
}

async function loadCardSettings() {
    const snapshot = await getDoc(
        doc(db, "appSettings", "cardFields")
    );

    if (snapshot.exists()) {
        cardSettings = {
            ...cardSettings,
            ...snapshot.data()
        };
    }
}

async function loadBanners() {
    const snapshot = await getDocs(
        collection(db, "banners")
    );

    banners = snapshot.docs
        .map(item => item.data())
        .filter(item =>
            typeof item.imageUrl === "string" &&
            /^https?:\/\//i.test(item.imageUrl)
        );
}

function listenToTournaments(renderTournaments) {
    if (unsubscribeTournaments) {
        unsubscribeTournaments();
    }

    unsubscribeTournaments = onSnapshot(
        collection(db, "tournaments"),
        snapshot => {
            tournaments = snapshot.docs
                .map(item => ({
                    id: item.id,
                    ...item.data()
                }))
                .filter(item => item.isActive !== false);

            const category =
                document.querySelector(".category-btn.active")
                    ?.dataset.category || "All";

            renderTournaments(category);
        },
        error => {
            console.error("Tournament listener:", error);
        }
    );
}

// =====================================
// MAIN HOMEPAGE
// =====================================

export function initHomepage() {
    const tournamentList =
        document.getElementById("tournamentList");

    const categoryList =
        document.getElementById("categoryList");

    const homePage =
        document.querySelector(".home-page");

    if (!tournamentList || !categoryList || !homePage) {
        console.error("Homepage elements not found.");
        return;
    }

    const homeSections = [...homePage.children];

    // =================================
    // TOURNAMENT MODAL
    // =================================

    const modal = document.createElement("div");
    modal.id = "tournamentModal";
    modal.className = "tournament-modal hidden";
    document.body.appendChild(modal);
    // =================================
// ROOM DETAILS MODAL
// =================================

const roomDetailsModal = document.createElement("div");

roomDetailsModal.id = "roomDetailsModal";
roomDetailsModal.className = "room-details-modal hidden";

roomDetailsModal.innerHTML = `
    <div class="room-details-content">

        <button type="button" class="room-details-close"
            id="closeRoomDetails">&times;</button>

        <div class="room-details-icon">🔐</div>

        <span class="room-details-tag">RAAVAN ESPORTS</span>

        <h2>ROOM DETAILS</h2>

        <p id="roomDetailsStatus">
            Loading room details...
        </p>

        <div id="roomCredentials" hidden>

            <div class="room-credential-box">
                <small>ROOM ID</small>
                <strong id="displayRoomId"></strong>
                <button type="button" id="copyRoomId">
                    COPY ID
                </button>
            </div>

            <div class="room-credential-box">
                <small>ROOM PASSWORD</small>
                <strong id="displayRoomPassword"></strong>
                <button type="button" id="copyRoomPassword">
                    COPY PASSWORD
                </button>
            </div>

        </div>

        <p class="room-details-footer">
            ⚡ BE READY. THE BATTLE IS WAITING.
        </p>

    </div>
`;

document.body.appendChild(roomDetailsModal);
// =================================
// ROOM DETAILS FUNCTIONALITY
// =================================

let roomUnsubscribe = null;

const closeRoomDetails = () => {
    roomDetailsModal.classList.add("hidden");

    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }
};

document.getElementById("closeRoomDetails")
    .addEventListener("click", closeRoomDetails);

roomDetailsModal.addEventListener("click", e => {
    if (e.target === roomDetailsModal) {
        closeRoomDetails();
    }
});

async function openRoomDetails(tournamentId) {
    const status = document.getElementById("roomDetailsStatus");
    const credentials = document.getElementById("roomCredentials");

    credentials.hidden = true;
    status.textContent = "Loading room details...";

    roomDetailsModal.classList.remove("hidden");

    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }

    try {
        const tournamentSnap = await getDoc(
            doc(db, "tournaments", String(tournamentId))
        );

        let matchTime = null;

        if (tournamentSnap.exists()) {
            const matchDateTime =
                tournamentSnap.data().matchDateTime;

            if (matchDateTime?.toDate) {
                matchTime = matchDateTime.toDate();
            } else if (matchDateTime) {
                matchTime = new Date(matchDateTime);
            }
        }

        roomUnsubscribe = onSnapshot(
            doc(db, "tournamentRooms", String(tournamentId)),
            roomSnap => {
                if (roomSnap.exists() && roomSnap.data().published === true) {
                    const data = roomSnap.data();

                    document.getElementById("displayRoomId")
                        .textContent = data.roomId || "";

                    document.getElementById("displayRoomPassword")
                        .textContent = data.password || "";

                    credentials.hidden = false;
                    status.textContent = "ROOM DETAILS PUBLISHED!";
                    return;
                }

                credentials.hidden = true;

                if (matchTime && !Number.isNaN(matchTime.getTime())) {
                    const minutesLeft =
                        (matchTime.getTime() - Date.now()) / 60000;

                    if (minutesLeft > 5) {
                        status.textContent =
                            "COMING SOON — Room details will be published 5 minutes before match time.";
                    } else if (minutesLeft > 0) {
                        status.textContent =
                            "ROOM DETAILS EXPECTED SOON — PLEASE WAIT FOR ADMIN.";
                    } else {
                        status.textContent =
                            "ROOM DETAILS NOT AVAILABLE — PLEASE WAIT FOR ADMIN.";
                    }
                } else {
                    status.textContent =
                        "COMING SOON — Please wait for admin to publish room details.";
                }
            },
            error => {
                console.error("Room listener error:", error);
                status.textContent =
                    "Unable to load room details. Please try again.";
            }
        );

    } catch (error) {
        console.error("Room details error:", error);
        status.textContent =
            "Unable to load room details. Please try again.";
    }
}

// ROOM BUTTON CLICK
document.addEventListener("click", e => {
    const button = e.target.closest(".room-details-btn");

    if (!button) return;

    openRoomDetails(button.dataset.id);
});

// COPY ROOM ID
document.getElementById("copyRoomId")
    .addEventListener("click", async () => {
        const value =
            document.getElementById("displayRoomId").textContent;

        try {
            await navigator.clipboard.writeText(value);
            document.getElementById("copyRoomId").textContent = "COPIED!";
        } catch (error) {
            alert("Copy failed. Please copy manually.");
        }
    });

// COPY ROOM PASSWORD
document.getElementById("copyRoomPassword")
    .addEventListener("click", async () => {
        const value =
            document.getElementById("displayRoomPassword").textContent;

        try {
            await navigator.clipboard.writeText(value);
            document.getElementById("copyRoomPassword").textContent = "COPIED!";
        } catch (error) {
            alert("Copy failed. Please copy manually.");
        }
    });
    // =================================
    // SUCCESS TOAST
    // =================================

    const successToast = document.createElement("div");

    successToast.className = "join-success-toast";
    successToast.innerHTML = `
    <div class="success-confetti">🎉 ✨ 🎊</div>
    <div class="success-check">✓</div>
    <div class="success-message">
        <strong>TOURNAMENT JOINED!</strong>
        <small>Your Team Spot is Confirmed</small>
        <span>⚡ RAAVAN ESPORTS ⚡</span>
    </div>
`; 

    document.body.appendChild(successToast);

    function showJoinSuccess() {
        successToast.classList.remove("show");
        void successToast.offsetWidth;
        successToast.classList.add("show");

        setTimeout(() => {
            successToast.classList.remove("show");
        }, 2600);
    }

    // =================================
    // DYNAMIC PAGES
    // =================================

    const matchesPage = document.createElement("section");
    matchesPage.className = "matches-page hidden";
    homePage.appendChild(matchesPage);

    const profilePage = document.createElement("section");
    profilePage.className = "profile-page hidden";
    homePage.appendChild(profilePage);

    const walletPage = document.createElement("section");
    walletPage.className = "wallet-page hidden";
    homePage.appendChild(walletPage);

    // =================================
    // BANNERS
    // =================================

    function renderBanners() {
        const container =
            document.getElementById("bannerSlider") ||
            document.querySelector(".hero-banner");

        if (!container) return;

        if (bannerTimer) {
            clearInterval(bannerTimer);
            bannerTimer = null;
        }

        container.innerHTML = `
            <div class="hero-tag">WELCOME TO THE BATTLE</div>
            <h2>PLAY SMART.<br>WIN BIG.</h2>
            <p>Your tournament journey starts here.</p>
            <div class="hero-decoration">R</div>
        `;

        if (!banners.length) {
            container.style.backgroundImage = "";
            return;
        }

        let index = 0;

        function showBanner() {
            container.style.backgroundImage =
                `linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.25)), url("${banners[index].imageUrl}")`;

            container.style.backgroundSize = "cover";
            container.style.backgroundPosition = "center";
            container.style.backgroundRepeat = "no-repeat";
        }

        showBanner();

        if (banners.length > 1) {
            bannerTimer = setInterval(() => {
                index = (index + 1) % banners.length;
                showBanner();
            }, 4000);
        }
    }

    // =================================
    // TOURNAMENT CARDS
    // =================================

    function renderTournaments(category = "All") {
        const filtered = category === "All"
            ? tournaments
            : tournaments.filter(item =>
                item.category === category
            );

        if (!filtered.length) {
            tournamentList.innerHTML = `
                <div class="empty-state">
                    No tournaments available.
                </div>
            `;
            return;
        }

        tournamentList.innerHTML = filtered.map(item => {
            const players = Number(item.players || 0);
            const capacity = Number(item.capacity || 0);

            const full = getTournamentStatus(item) === "full";
            const joined = joinedTournaments.has(String(item.id));

            const remaining = Math.max(0, capacity - players);

            const info = [];

            if (cardSettings.prizePool) {
                info.push(`
                    <div class="info-box">
                        <small>PRIZE POOL</small>
                        <strong>${escapeHTML(item.prizePool ?? 0)}
                            <small class="coin-unit">COINS</small>
                        </strong>
                    </div>
                `);
            }

            if (cardSettings.perKillReward) {
                info.push(`
                    <div class="info-box">
                        <small>PER KILL</small>
                        <strong>${escapeHTML(item.perKillReward ?? 0)}
                            <small class="coin-unit">COINS</small>
                        </strong>
                    </div>
                `);
            }

            if (cardSettings.entryFees) {
                info.push(`
                    <div class="info-box">
                        <small>ENTRY FEES</small>
                        <strong>${escapeHTML(item.entryFees ?? 0)}
                            <small class="coin-unit">COINS</small>
                        </strong>
                    </div>
                `);
            }

            const lowerInfo = [];

            if (cardSettings.map) {
                lowerInfo.push(`
                    <span>🗺️ ${escapeHTML(item.map || "TBA")}</span>
                `);
            }

            if (cardSettings.playersCount) {
                lowerInfo.push(`
                    <span>👥 ${players}/${capacity}</span>
                `);
            }

            return `
                <article class="tournament-card">
                    <div class="tournament-top">
                        <span class="tournament-type">
                            ${escapeHTML(item.category || "MATCH")} MATCH
                        </span>

                        <span class="match-status ${full ? "full-status" : ""}">
    ${full ? "● FULL" : `🕒 ${escapeHTML(formatMatchDateTime(item))}`}
</span>
                    </div>

                    <h4>${escapeHTML(item.name || "Tournament")}</h4>

                    <div class="tournament-info">
                        ${info.join("")}
                    </div>

                    <div class="tournament-lower-info">
                        ${lowerInfo.join("")}
                    </div>

                    <div class="card-slot-section">
                        <div class="card-slot-label">
                            <span>${full ? "Tournament Full" : "Available Slots"}</span>
                            <strong>${full ? "FULL" : remaining}</strong>
                        </div>
                    </div>

                                        <div class="join-row">
                        <button
                            class="join-btn ${full ? "full-join-btn" : ""}"
                            data-id="${escapeHTML(item.id)}"
                        >
                            ${joined
                                ? "VIEW TOURNAMENT"
                                : full
                                    ? "TOURNAMENT FULL"
                                    : "VIEW & JOIN"}
                        </button>
                    </div>

                    ${joined ? `
                        <div class="room-card-action">
                            <button
                                class="room-details-btn"
                                data-id="${escapeHTML(item.id)}"
                            >
                                🔐 VIEW ROOM DETAILS
                            </button>
                        </div>
                    ` : ""}
                </article>
            `;
        }).join("");
    }

    // =================================
    // MY MATCHES
    // =================================

    async function renderMyMatches() {
        const user = auth.currentUser;

        if (!user) {
            matchesPage.innerHTML = `
                <div class="matches-empty">
                    <h3>Please Login First</h3>
                </div>
            `;
            return;
        }

        matchesPage.innerHTML = `
            <div class="matches-heading">
                <span>RAAVAN ESPORTS</span>
                <h2>MY MATCHES</h2>
                <p>Checking your tournaments...</p>
            </div>
        `;

        try {
            const snapshot = await getDocs(
                query(
                    collection(db, "tournamentJoins"),
                    where("uid", "==", user.uid)
                )
            );

            const allMatches = snapshot.docs.map(item => ({
                ...item.data(),
                joinId: item.id
            }));

            const checked = await Promise.all(
                allMatches.map(async item => {
                    const tournamentSnap = await getDoc(
                        doc(db, "tournaments", String(item.tournamentId))
                    );

                    if (!tournamentSnap.exists()) return null;

const tournamentData = tournamentSnap.data();

if (tournamentData.isActive === false) {
    return null;
}

return {
    ...item,
    matchDateTime: tournamentData.matchDateTime,
    time: tournamentData.time || item.time
};
                })
            );

            const matches = checked.filter(Boolean);

            matchesPage.innerHTML = `
                <div class="matches-heading">
                    <span>RAAVAN ESPORTS</span>
                    <h2>MY MATCHES</h2>
                    <p>Your joined tournaments in one place.</p>
                </div>

                ${matches.length ? `
                    <div class="my-match-list">
                        ${matches.map(item => `
                            <article class="my-match-card">
                                <div class="my-match-top">
                                    <span>${escapeHTML(item.category)}</span>
                                    <span class="my-match-status">● JOINED</span>
                                </div>

                                <h3>${escapeHTML(item.tournamentName)}</h3>

                                <div class="my-match-info">
                                    <div>
                                        <small>MAP</small>
                                        <strong>${escapeHTML(item.map)}</strong>
                                    </div>
                                    <div>
                                        <small>MATCH TIME</small>
<strong>${escapeHTML(formatMatchDateTime(item))}</strong>
                                    </div>
                                </div>

                                <button
                                    class="my-match-view"
                                    data-id="${escapeHTML(item.tournamentId)}"
                                >
                                    VIEW TOURNAMENT
                                </button>
                                                                <div class="room-card-action">
                                    <button
                                        class="room-details-btn"
                                        data-id="${escapeHTML(item.tournamentId)}"
                                    >
                                        🔐 VIEW ROOM DETAILS
                                    </button>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                ` : `
                    <div class="matches-empty">
                        <div class="empty-match-icon">🏆</div>
                        <h3>No Matches Joined Yet</h3>
                        <p>Your joined tournaments will appear here.</p>
                        <button id="exploreMatches">EXPLORE TOURNAMENTS</button>
                    </div>
                `}
            `;
        } catch (error) {
            console.error("My Matches error:", error);

            matchesPage.innerHTML = `
                <div class="matches-empty">
                    <h3>Could Not Load Matches</h3>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    }

    // =================================
    // PLAYER PROFILE
    // =================================

    async function renderProfile() {
        const user = auth.currentUser;

        if (!user) {
            profilePage.innerHTML = `
                <div class="profile-card">
                    <h3>Please Login First</h3>
                    <p>Your session is not available.</p>
                </div>
            `;
            return;
        }

        profilePage.innerHTML = `
            <div class="profile-heading">
                <span>RAAVAN ESPORTS</span>
                <h2>PLAYER PROFILE</h2>
            </div>
            <div class="profile-card">
                <h3>Loading Profile...</h3>
            </div>
        `;

        try {
            const profileRef = doc(db, "users", user.uid);
            let profileSnap = await getDoc(profileRef);

            if (!profileSnap.exists()) {
                const playerName =
                    user.displayName ||
                    user.email?.split("@")[0] ||
                    "Player";

                const playerId =
                    "RAAVAN-" +
                    user.uid.substring(0, 8).toUpperCase();

                await setDoc(profileRef, {
                    uid: user.uid,
                    name: playerName,
                    email: user.email || "",
                    playerId,
                    createdAt: serverTimestamp()
                });

                profileSnap = await getDoc(profileRef);
            }

            if (!profileSnap.exists()) {
                throw new Error("Profile could not be created.");
            }

            const data = profileSnap.data();

            profilePage.innerHTML = `
                <div class="profile-heading">
                    <span>RAAVAN ESPORTS</span>
                    <h2>PLAYER PROFILE</h2>
                    <p>Manage your player account.</p>
                </div>

                <div class="profile-card">
                    <div class="profile-avatar">R</div>

                    <h3>${escapeHTML(data.name || "Player")}</h3>

                    <span class="profile-badge">REGISTERED PLAYER</span>

                    <div class="profile-details">
                        <div>
                            <small>PLAYER ID</small>
                            <strong>${escapeHTML(data.playerId || "Not assigned")}</strong>
                        </div>
                        <div>
                            <small>EMAIL ADDRESS</small>
                            <strong>${escapeHTML(data.email || user.email || "")}</strong>
                        </div>
                    </div>

                    <form id="editProfileForm">
                        <label for="newPlayerName">Update Player Name</label>
                        <input
                            type="text"
                            id="newPlayerName"
                            value="${escapeHTML(data.name || "Player")}"
                            maxlength="30"
                            required
                        >
                        <button type="submit">SAVE PROFILE</button>
                        <p id="profileMessage"></p>
                    </form>
                    <a
    href="https://t.me/raavan_ff"
    target="_blank"
    rel="noopener noreferrer"
    class="support-btn"
>
    🎧 HELP / SUPPORT
</a>
                    <button id="logoutBtn" class="logout-btn">
                        LOG OUT
                    </button>
                </div>
            `;
        } catch (error) {
            console.error("Profile error:", error);

            profilePage.innerHTML = `
                <div class="profile-card">
                    <h3>Profile could not load</h3>
                    <p>${escapeHTML(error.message)}</p>
                    <button id="retryProfile">TRY AGAIN</button>
                </div>
            `;
        }
    }

    // =================================
    // WALLET RENDER
    // =================================

    
function renderWallet() {
    const user = auth.currentUser;

    if (!user) {
        walletPage.innerHTML = `
            <div class="wallet-empty">
                <h3>Please Login First</h3>
            </div>
        `;
        return;
    }

    const history = [...walletTransactions].sort((a, b) =>
        (b.createdAt?.toMillis?.() || 0) -
        (a.createdAt?.toMillis?.() || 0)
    );

    const requests = [...walletRequests].sort((a, b) =>
        (b.createdAt?.toMillis?.() || 0) -
        (a.createdAt?.toMillis?.() || 0)
    );

    walletPage.innerHTML = `
        <div class="wallet-heading">
            <span class="wallet-eyebrow">✦ RAAVAN ESPORTS ✦</span>
            <h2>MY <span>WALLET</span></h2>
            <p>Your coins. Your battle. Your glory.</p>
        </div>

        <div class="wallet-balance-card">
            <div class="wallet-card-glow"></div>

            <div class="wallet-card-top">
                <span>✦ AVAILABLE BALANCE</span>
                <span class="wallet-coin-icon">◈</span>
            </div>

            <div class="wallet-balance-number">
                ${walletBalance.toLocaleString("en-IN")}
            </div>

            <p class="wallet-balance-label">RAAVAN VIRTUAL COINS</p>

            <div class="wallet-card-footer">
                <span>RAAVAN ESPORTS</span>
                <span>PLAYER WALLET ✦</span>
            </div>
        </div>

        <div class="wallet-action-grid">
            <button class="wallet-action-btn" id="addCoinsBtn">
                <span>＋</span>
                <strong>BUY COINS</strong>
                <small>Get more coins</small>
            </button>

            <button class="wallet-action-btn" id="walletHistoryBtn">
                <span>▤</span>
                <strong>HISTORY</strong>
                <small>Track your activity</small>
            </button>
            <button class="wallet-action-btn" id="withdrawCoinsBtn">
    <span>↗</span>
    <strong>WITHDRAW</strong>
    <small>Get your payout</small>
</button>
        </div>

        <section class="wallet-request-box" id="walletRequestBox">

            <div class="wallet-section-title">
                <div>
                    <span class="wallet-mini-label">POWER UP YOUR GAME</span>
                    <h3>BUY RAAVAN COINS</h3>
                </div>
                <span class="wallet-secure-tag">✦ SECURE UPI</span>
            </div>

            <p class="wallet-note">
                Choose your coin pack and pay instantly using any UPI app.
            </p>

            <form id="coinRequestForm">

                <label class="wallet-form-label">
                    SELECT YOUR COIN PACKAGE
                </label>

                <div class="wallet-package-grid">
                    ${COIN_PACKAGES.map(amount => `
                        <button
                            type="button"
                            class="coin-package-card"
                            data-package="${amount}"
                        >
                            ${amount === 50 ? `
                                <span class="package-popular">POPULAR</span>
                            ` : ""}

                            <span class="package-price">₹${amount}</span>
                            <strong>${amount} COINS</strong>
                            <small>Instant UPI payment</small>
                        </button>
                    `).join("")}
                </div>

                <select id="coinAmount" class="wallet-package-native"
                    aria-label="Selected coin package">
                    <option value="">Select package</option>
                    ${COIN_PACKAGES.map(amount => `
                        <option value="${amount}">
                            ₹${amount} — ${amount} Coins
                        </option>
                    `).join("")}
                </select>

                <div class="upi-payment-box">

                    <div class="upi-box-heading">
                        <div>
                            <span class="wallet-mini-label">SCAN & PAY</span>
                            <h3>PAY WITH UPI</h3>
                        </div>
                        <span class="upi-live-tag">● LIVE</span>
                    </div>

                    <div class="upi-qr-frame">
                        <div class="upi-qr-inner">
                            <img
                                src="assets/upi-qr.jpg"
                                alt="Gautam Sahu UPI payment QR code"
                            >
                        </div>
                        <span class="upi-qr-caption">
                            SCAN USING ANY UPI APP
                        </span>
                    </div>

                    <div class="upi-payee-info">
                        <div>
                            <small>PAYEE NAME</small>
                            <strong>Gautam Sahu</strong>
                        </div>

                        <div>
                            <small>UPI ID</small>
                            <strong class="upi-id-text">
                                gautam.raj-sahu@pthdfc
                            </strong>
                        </div>
                    </div>

                    <button type="button" id="copyUpiBtn"
                        class="upi-copy-btn">
                        ⧉ COPY UPI ID
                    </button>

                    <a
                        id="payWithUpiBtn"
                        href="#"
                        class="upi-pay-button"
                    >
                        PAY WITH UPI APP <span>↗</span>
                    </a>

                    <p class="upi-security-note">
                        🔒 Verify the payee name and amount before paying.
                    </p>
                </div>

                <div class="wallet-utr-box">
                    <label for="coinUtr">
                        PAYMENT UTR / REFERENCE NUMBER
                    </label>

                    <input
                        type="text"
                        id="coinUtr"
                        minlength="8"
                        maxlength="20"
                        placeholder="Enter your 8–20 digit UTR"
                        autocomplete="off"
                        required
                    >

                    <small>
                        Find your UTR in your UPI app's payment details.
                    </small>
                </div>

                <button type="submit" id="submitCoinRequest"
                    class="wallet-submit-btn">
                    SUBMIT PAYMENT REQUEST <span>➜</span>
                </button>

                <p id="coinRequestMessage"></p>

                <div class="wallet-verification-note">
                    <span>🛡️</span>
                    <p>
                        Coins are added after admin verifies your payment.
                        Never submit a fake or incorrect UTR.
                    </p>
                </div>

            </form>
        </section>
                <section class="wallet-request-box" id="withdrawalBox">

            <div class="wallet-section-title">
                <div>
                    <span class="wallet-mini-label">GET YOUR REWARD</span>
                    <h3>WITHDRAW COINS</h3>
                </div>
                <span class="wallet-secure-tag">✦ MANUAL PAYOUT</span>
            </div>

            <p class="wallet-note">
                1 Coin = ₹1. Minimum withdrawal is 10 coins.
            </p>

            <form id="withdrawalForm">

                <label class="wallet-form-label">
                    ENTER COINS TO WITHDRAW
                </label>

                <input
                    type="number"
                    id="withdrawalCoins"
                    min="10"
                    max="1000000"
                    step="1"
                    placeholder="Minimum 10 coins"
                    required
                >
                                <label class="wallet-form-label" for="withdrawalMethod">
                    SELECT PAYOUT METHOD
                </label>

                <select id="withdrawalMethod" required>
                    <option value="upi">UPI ID</option>
                    <option value="bank">Bank Account</option>
                </select>

                <div id="withdrawalUpiBox">
                    <label class="wallet-form-label" for="withdrawalUpiId">
                        YOUR UPI ID
                    </label>
                    <input
                        type="text"
                        id="withdrawalUpiId"
                        placeholder="example@upi"
                    >
                </div>

                <div id="withdrawalBankBox" style="display:none">

                    <label class="wallet-form-label">
                        ACCOUNT HOLDER NAME
                    </label>
                    <input type="text"
                        id="withdrawalAccountHolder"
                        placeholder="Account holder name">

                    <label class="wallet-form-label">
                        ACCOUNT NUMBER
                    </label>
                    <input type="text"
                        id="withdrawalAccountNumber"
                        placeholder="Bank account number">

                    <label class="wallet-form-label">
                        IFSC CODE
                    </label>
                    <input type="text"
                        id="withdrawalIfsc"
                        placeholder="ABCD0123456">

                    <label class="wallet-form-label">
                        BANK NAME
                    </label>
                    <input type="text"
                        id="withdrawalBankName"
                        placeholder="Bank name">

                </div>
                                <p id="withdrawalMessage"></p>

                <button type="submit" id="submitWithdrawal"
                    class="wallet-submit-btn">
                    SUBMIT WITHDRAWAL REQUEST ➜
                </button>

                <p class="wallet-note">
                    Coins will be reserved when you submit.
                    Admin will manually process your payout.
                </p>

            </form>
        </section>

        <div class="wallet-section-title wallet-history-heading">
            <div>
                <span class="wallet-mini-label">YOUR ACTIVITY</span>
                <h3>PAYMENT REQUESTS</h3>
            </div>
            <span>${requests.length} REQUESTS</span>
        </div>

        <div class="wallet-request-list">
            ${requests.length ? requests.map(item => `
                <div class="wallet-request-item">
                    <div>
                        <strong>
                            +${Number(item.coins || item.amount || 0)} Coins
                        </strong>
                        <small>UTR: ${escapeHTML(item.utr || "N/A")}</small>
                        <small>${formatWalletDate(item.createdAt)}</small>
                    </div>

                    <span class="request-status ${escapeHTML(item.status || "pending")}">
                        ${escapeHTML((item.status || "pending").toUpperCase())}
                    </span>
                </div>
            `).join("") : `
                <div class="wallet-empty-small">
                    No payment requests yet.
                </div>
            `}
        </div>
                <div class="wallet-section-title wallet-history-heading">
            <div>
                <span class="wallet-mini-label">PAYOUT ACTIVITY</span>
                <h3>WITHDRAWAL REQUESTS</h3>
            </div>
            <span>${walletWithdrawals.length} REQUESTS</span>
        </div>

        <div class="wallet-request-list">
            ${walletWithdrawals.length ? [...walletWithdrawals].sort((a, b) =>
                (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
            ).map(item => `
                <div class="wallet-request-item">
                    <div>
                        <strong>
                            -${Number(item.coins || 0)} Coins (₹${Number(item.amountRupees || item.coins || 0)})
                        </strong>
                        <small>Method: ${item.method === "upi" ? "UPI" : "Bank Transfer"}</small>
                        <small>${formatWalletDate(item.createdAt)}</small>
                    </div>

                    <span class="request-status ${escapeHTML(item.status || "pending")}">
                        ${escapeHTML((item.status || "pending").toUpperCase())}
                    </span>
                </div>
            `).join("") : `
                <div class="wallet-empty-small">
                    No withdrawal requests yet.
                </div>
            `}
        </div>

        <div
            class="wallet-section-title wallet-history-heading"
            id="walletHistory"
        >
            <div>
                <span class="wallet-mini-label">COIN RECORDS</span>
                <h3>TRANSACTION HISTORY</h3>
            </div>
            <span>${history.length} RECORDS</span>
        </div>

        <div class="wallet-transaction-list">
            ${history.length ? history.map(item => {
                const type = item.type || "transaction";

                                const title = type === "admin_bonus"
                    ? "Admin Bonus"
                    : type === "deposit_approved"
                        ? "UPI Payment Approved"
                        : type === "withdrawal_paid"
                            ? "Withdrawal Paid"
                            : type === "withdrawal_refund"
                                ? "Withdrawal Refunded"
                                : "Wallet Transaction";

                const amountPrefix = type === "withdrawal_paid" ? "-" : "+";

                return `
                    <div class="wallet-transaction-item">
                        <div class="wallet-transaction-icon">◈</div>

                        <div class="wallet-transaction-info">
                            <strong>${title}</strong>
                            <small>${escapeHTML(item.description || "Virtual coins")}</small>
                            <small>${formatWalletDate(item.createdAt)}</small>
                        </div>

                        <strong class="wallet-credit">
                            ${amountPrefix}${Number(item.amount || 0)}
                        </strong>
                    </div>
                `;
            }).join("") : `
                <div class="wallet-empty-small">
                    No transactions yet.
                </div>
            `}
        </div>

        <p class="wallet-footer-note">
            RAAVAN ESPORTS • Virtual platform coins •
            Payments manually verified by admin.
        </p>
    `;
}


    // =================================
    // WALLET LISTENERS
    // =================================

    function startWalletListeners() {
        const user = auth.currentUser;

        if (!user || walletListenersStarted) return;

        walletListenersStarted = true;

        onSnapshot(
            doc(db, "wallets", user.uid),
            snapshot => {
                walletBalance = snapshot.exists()
                    ? Number(snapshot.data().balance || 0)
                    : 0;

                renderWallet();
            },
            error => console.error("Wallet balance:", error)
        );

        onSnapshot(
            query(
                collection(db, "coinRequests"),
                where("uid", "==", user.uid)
            ),
            snapshot => {
                walletRequests = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                renderWallet();
            },
            error => console.error("Wallet requests:", error)
        );
                onSnapshot(
            query(
                collection(db, "withdrawalRequests"),
                where("uid", "==", user.uid)
            ),
            snapshot => {
                walletWithdrawals = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                renderWallet();
            },
            error => console.error("Wallet withdrawals:", error)
        );

        onSnapshot(
            query(
                collection(db, "walletTransactions"),
                where("uid", "==", user.uid)
            ),
            snapshot => {
                walletTransactions = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                renderWallet();
            },
            error => console.error("Wallet history:", error)
        );
    }

        // =================================
    // UPI PACKAGE SELECTION
    // =================================

    walletPage.addEventListener("click", event => {
        const packageCard = event.target.closest(".coin-package-card");

        if (!packageCard) return;

        const amount = Number(packageCard.dataset.package);

        if (!COIN_PACKAGES.includes(amount)) return;

        const select = walletPage.querySelector("#coinAmount");

        if (!select) return;

        // Update selected package
        select.value = String(amount);

        // Trigger existing UPI payment link logic
        select.dispatchEvent(
            new Event("change", { bubbles: true })
        );

        // Update selected card design
        walletPage.querySelectorAll(".coin-package-card")
            .forEach(card => {
                card.classList.remove("active");
            });

        packageCard.classList.add("active");
    });

    walletPage.addEventListener("change", event => {
        if (event.target.id !== "coinAmount") return;

        const amount = Number(event.target.value);

        const payButton =
            walletPage.querySelector("#payWithUpiBtn");

        if (!payButton) return;

        if (!COIN_PACKAGES.includes(amount)) {
            payButton.href = "#";

            walletPage.querySelectorAll(".coin-package-card")
                .forEach(card => {
                    card.classList.remove("active");
                });

            return;
        }

        const params = new URLSearchParams({
            pa: UPI_ID,
            pn: PAYEE_NAME,
            am: String(amount),
            cu: "INR"
        });

        payButton.href = `upi://pay?${params.toString()}`;

        // Keep card and dropdown selection synchronized
        walletPage.querySelectorAll(".coin-package-card")
            .forEach(card => {
                card.classList.toggle(
                    "active",
                    Number(card.dataset.package) === amount
                );
            });
    });
        // =================================
    // WITHDRAWAL METHOD SELECTION
    // =================================

    walletPage.addEventListener("change", event => {
        if (event.target.id !== "withdrawalMethod") return;

        const method = event.target.value;

        const upiBox = walletPage.querySelector("#withdrawalUpiBox");
        const bankBox = walletPage.querySelector("#withdrawalBankBox");

        if (method === "upi") {
            upiBox.style.display = "block";
            bankBox.style.display = "none";
        } else {
            upiBox.style.display = "none";
            bankBox.style.display = "block";
        }
    });
        // =================================
    // SUBMIT WITHDRAWAL REQUEST
    // =================================

    walletPage.addEventListener("submit", async event => {
        if (event.target.id !== "withdrawalForm") return;

        event.preventDefault();

        const user = auth.currentUser;
        const message = walletPage.querySelector("#withdrawalMessage");
        const button = walletPage.querySelector("#submitWithdrawal");

        if (!user) {
            message.textContent = "Please login first.";
            message.className = "wallet-message-error";
            return;
        }

        const coins = Number(
            walletPage.querySelector("#withdrawalCoins").value
        );

        const method =
            walletPage.querySelector("#withdrawalMethod").value;

        if (!Number.isInteger(coins) || coins < 10 || coins > 1000000) {
            message.textContent = "Minimum withdrawal is 10 coins.";
            message.className = "wallet-message-error";
            return;
        }

        let payoutDetails = {};

        if (method === "upi") {
            const upiId = walletPage.querySelector("#withdrawalUpiId")
                .value.trim();

            if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(upiId)) {
                message.textContent = "Enter a valid UPI ID.";
                message.className = "wallet-message-error";
                return;
            }

            payoutDetails = { upiId: upiId };

        } else if (method === "bank") {
            const accountHolder = walletPage.querySelector("#withdrawalAccountHolder")
                .value.trim();

            const accountNumber = walletPage.querySelector("#withdrawalAccountNumber")
                .value.trim();

            const ifsc = walletPage.querySelector("#withdrawalIfsc")
                .value.trim().toUpperCase();

            const bankName = walletPage.querySelector("#withdrawalBankName")
                .value.trim();

            if (
                accountHolder.length < 2 ||
                !/^[0-9]{9,18}$/.test(accountNumber) ||
                !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) ||
                bankName.length < 2
            ) {
                message.textContent = "Please enter valid bank details.";
                message.className = "wallet-message-error";
                return;
            }

            payoutDetails = {
                accountHolder,
                accountNumber,
                ifsc,
                bankName
            };

        } else {
            message.textContent = "Select a valid payout method.";
            message.className = "wallet-message-error";
            return;
        }

        button.disabled = true;
        button.textContent = "SUBMITTING...";

        try {
            const walletRef = doc(db, "wallets", user.uid);

            const requestRef = doc(
                collection(db, "withdrawalRequests")
            );

            await runTransaction(db, async transaction => {
                const walletSnap = await transaction.get(walletRef);

                if (!walletSnap.exists()) {
                    throw new Error("Wallet not found.");
                }

                const currentBalance = Number(
                    walletSnap.data().balance || 0
                );

                if (
                    !Number.isInteger(currentBalance) ||
                    currentBalance < coins
                ) {
                    throw new Error("Insufficient wallet balance.");
                }

                transaction.set(requestRef, {
                    uid: user.uid,
                    coins: coins,
                    amountRupees: coins,
                    method: method,
                    ...payoutDetails,
                    status: "pending",
                    createdAt: serverTimestamp()
                });

                transaction.update(walletRef, {
                    balance: currentBalance - coins,
                    updatedAt: serverTimestamp(),
                    lastWithdrawalRequestId: requestRef.id
                });
            });

            message.textContent =
                "Withdrawal request submitted successfully!";

            message.className = "wallet-message-success";

            event.target.reset();

            walletPage.querySelector("#withdrawalUpiBox").style.display = "block";
            walletPage.querySelector("#withdrawalBankBox").style.display = "none";

        } catch (error) {
            console.error("Withdrawal request error:", error);

            message.textContent =
                error.message || "Request failed. Please try again.";

            message.className = "wallet-message-error";

        } finally {
            button.disabled = false;
            button.textContent = "SUBMIT WITHDRAWAL REQUEST ➜";
        }
    });
    // =================================
    // COPY UPI ID
    // =================================

    walletPage.addEventListener("click", async event => {
        if (!event.target.closest("#copyUpiBtn")) return;

        try {
            await navigator.clipboard.writeText(UPI_ID);
            alert("UPI ID copied successfully!");
        } catch (error) {
            alert("UPI ID: " + UPI_ID);
        }
    });

    // =================================
    // SUBMIT UPI PAYMENT REQUEST
    // =================================

    walletPage.addEventListener("submit", async event => {
        if (event.target.id !== "coinRequestForm") return;

        event.preventDefault();

        const user = auth.currentUser;

        if (!user) {
            alert("Please login first.");
            return;
        }

        const amount = Number(
            document.getElementById("coinAmount").value
        );

        const utr = document.getElementById("coinUtr")
            .value.trim().toUpperCase();

        const message =
            document.getElementById("coinRequestMessage");

        const button =
            document.getElementById("submitCoinRequest");

        if (!COIN_PACKAGES.includes(amount)) {
            message.textContent = "Select a valid coin package.";
            message.className = "wallet-message-error";
            return;
        }

        if (!/^[A-Z0-9]{8,20}$/.test(utr)) {
            message.textContent =
                "Enter a valid UTR containing 8–20 letters/numbers.";

            message.className = "wallet-message-error";
            return;
        }

        button.disabled = true;
        button.textContent = "SUBMITTING...";

        try {
            const requestRef = doc(
                collection(db, "coinRequests")
            );

            const claimRef = doc(db, "utrClaims", utr);

            const batch = writeBatch(db);

            batch.set(requestRef, {
                uid: user.uid,
                amount: amount,
                coins: amount,
                utr: utr,
                status: "pending",
                createdAt: serverTimestamp()
            });

            batch.set(claimRef, {
                uid: user.uid,
                requestId: requestRef.id,
                status: "pending",
                createdAt: serverTimestamp()
            });

            await batch.commit();

            event.target.reset();

            document.getElementById("payWithUpiBtn").href = "#";

            message.textContent =
                "Payment request submitted. Waiting for admin verification.";

            message.className = "wallet-message-success";

        } catch (error) {
            console.error("Payment request error:", error);

            if (error.code === "permission-denied") {
                message.textContent =
                    "UTR may already be used, or Firestore Rules need updating.";
            } else {
                message.textContent =
                    error.message || "Could not submit payment request.";
            }

            message.className = "wallet-message-error";

        } finally {
            button.disabled = false;
            button.textContent = "SUBMIT PAYMENT";
        }
    });

    // =================================
    // WALLET BUTTON EVENTS
    // =================================

    walletPage.addEventListener("click", event => {
        if (event.target.closest("#addCoinsBtn")) {
            document.getElementById("walletRequestBox")
                ?.scrollIntoView({ behavior: "smooth" });
        }

        if (event.target.closest("#walletHistoryBtn")) {
            document.getElementById("walletHistory")
                ?.scrollIntoView({ behavior: "smooth" });
        }
        if (event.target.closest("#withdrawCoinsBtn")) {
    document.getElementById("withdrawalBox")
        ?.scrollIntoView({ behavior: "smooth" });
        }
    });

    // =================================
    // PAGE NAVIGATION
    // =================================

    function showPage(page) {
        homeSections.forEach(section => {
            section.classList.toggle("hidden", page !== "home");
        });

        matchesPage.classList.toggle("hidden", page !== "matches");
        profilePage.classList.toggle("hidden", page !== "profile");
        walletPage.classList.toggle("hidden", page !== "wallet");

        document.querySelectorAll(".nav-btn").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

        if (page === "matches") renderMyMatches();
        if (page === "profile") renderProfile();

        if (page === "wallet") {
            startWalletListeners();
            renderWallet();
        }
    }

    // =================================
    // TOURNAMENT DETAILS + JOIN
    // =================================

    function openDetails(id) {
        const item = tournaments.find(t =>
            String(t.id) === String(id)
        );

        if (!item) {
            alert("This tournament is no longer available.");
            return;
        }

        const players = Number(item.players || 0);
        const capacity = Number(item.capacity || 0);

        const full = getTournamentStatus(item) === "full";
        const joined = joinedTournaments.has(String(id));

        const remaining = Math.max(0, capacity - players);

        const progress = capacity > 0
            ? Math.min(100, players / capacity * 100)
            : 0;

        modal.innerHTML = `
            <div class="details-box">
                <div class="details-header">
                    <span>TOURNAMENT DETAILS</span>
                    <button class="close-modal" id="closeModal">✕</button>
                </div>

                <div class="details-logo">R</div>

                <span class="details-tag">
                    ${escapeHTML(item.category)} MATCH
                </span>

                <h2>${escapeHTML(item.name)}</h2>

                ${full ? `
                    <span class="details-full-badge">
                        ● TOURNAMENT FULL
                    </span>
                ` : ""}

                <p class="details-subtitle">
                    Your battle. Your glory.
                </p>

                <div class="details-grid">
                    <div class="details-item">
                        <small>PRIZE POOL</small>
                        <strong>${escapeHTML(item.prizePool ?? 0)} COINS</strong>
                    </div>

                    <div class="details-item">
                        <small>PER KILL REWARD</small>
                        <strong>${escapeHTML(item.perKillReward ?? 0)} COINS</strong>
                    </div>

                    <div class="details-item">
                        <small>BOOYAH PRIZE</small>
                        <strong>${escapeHTML(item.booyahPrize ?? 0)} COINS</strong>
                    </div>

                    <div class="details-item">
                        <small>ENTRY FEES</small>
                        <strong>${escapeHTML(item.entryFees ?? 0)} COINS</strong>
                    </div>

                    <div class="details-item">
                        <small>MAP</small>
                        <strong>${escapeHTML(item.map)}</strong>
                    </div>

                    <div class="details-item">
                        <small>MATCH TIME</small>
<strong>${escapeHTML(formatMatchDateTime(item))}</strong>
                    </div>

                    <div class="details-item">
                        <small>PLAYERS</small>
                        <strong>${players}/${capacity}</strong>
                    </div>
                </div>

                <div class="slot-section">
                    <div class="slot-label">
                        <span>${full ? "Tournament Full" : "Available Slots"}</span>
                        <strong>${full ? "FULL" : remaining}</strong>
                    </div>

                    <div class="slot-track">
                        <div
                            class="slot-progress ${full ? "full-progress" : ""}"
                            style="width:${progress}%"
                        ></div>
                    </div>
                </div>

                <button
                    class="details-join-btn ${full ? "full-join-btn" : ""}"
                    id="joinTournament"
                    ${joined || full ? "disabled" : ""}
                >
                    ${joined
                        ? "✓ ALREADY JOINED"
                        : full
                            ? "TOURNAMENT FULL"
                            : "CONFIRM JOIN"}
                </button>
            </div>
        `;

        modal.classList.remove("hidden");

        document.getElementById("closeModal").onclick =
            closeDetails;

        document.getElementById("joinTournament").onclick =
            async () => {
                const user = auth.currentUser;

                if (!user) {
                    alert("Please login to join this tournament.");
                    return;
                }

                if (joinedTournaments.has(String(id)) || full) {
                    return;
                }

                const joinButton =
    document.getElementById("joinTournament");

const teamFormat = ["Solo", "Duo", "Squad"].includes(item.category)
    ? item.category
    : (["Solo", "Duo", "Squad"].includes(item.teamFormat)
        ? item.teamFormat
        : "Solo");

const roster = await collectTeamRoster(teamFormat);

if (!roster) {
    return;
}

joinButton.disabled = true;
joinButton.textContent = "JOINING...";

                try {
                    const joinRef = doc(
                        db,
                        "tournamentJoins",
                        `${id}_${user.uid}`
                    );

                    const tournamentRef = doc(
                        db,
                        "tournaments",
                        String(id)
                    );

                    const updatedPlayers = await runTransaction(
    db,
    async transaction => {
        const tournamentSnap =
            await transaction.get(tournamentRef);

        const existingJoin =
            await transaction.get(joinRef);

        if (!tournamentSnap.exists()) {
            throw new Error("Tournament not found.");
        }

        if (existingJoin.exists()) {
            throw new Error("You have already joined.");
        }

        const data = tournamentSnap.data();

        if (data.isActive === false) {
            throw new Error("Tournament is inactive.");
        }

        const currentPlayers = Number(data.players || 0);
        const maxPlayers = Number(data.capacity || 0);
        const entryFee = Number(data.entryFees ?? 0);

        if (
            !Number.isInteger(currentPlayers) ||
            !Number.isInteger(maxPlayers) ||
            maxPlayers <= 0
        ) {
            throw new Error("Invalid player count.");
        }

        if (!Number.isSafeInteger(entryFee) || entryFee < 0) {
            throw new Error("Invalid tournament entry fee.");
        }

        if (currentPlayers + roster.length > maxPlayers) {
    throw new Error("Not enough player slots available for this team.");
}

        const walletRef = doc(db, "wallets", user.uid);
        const historyRef = doc(
            db,
            "walletTransactions",
            `tournament_entry_${id}_${user.uid}`
        );

        let newBalance = null;

        if (entryFee > 0) {
            const walletSnap = await transaction.get(walletRef);
            const historySnap = await transaction.get(historyRef);

            if (!walletSnap.exists()) {
                throw new Error("Wallet not found. Please contact admin.");
            }

            if (historySnap.exists()) {
                throw new Error("Entry fee already charged.");
            }

            const balance = Number(walletSnap.data().balance);

            if (!Number.isSafeInteger(balance) || balance < 0) {
                throw new Error("Invalid wallet balance.");
            }

            if (balance < entryFee) {
                throw new Error(
                    `Insufficient coins! Required: ${entryFee}, Available: ${balance}.`
                );
            }

            newBalance = balance - entryFee;

            transaction.update(walletRef, {
    balance: newBalance,
    updatedAt: serverTimestamp(),
    lastEntryTournamentId: String(id)
});

            transaction.set(historyRef, {
                uid: user.uid,
                amount: entryFee,
                type: "tournament_entry",
                description: `Entry fee for ${data.name || item.name}`,
                tournamentId: String(id),
                createdAt: serverTimestamp()
            });
        }

        const newPlayers = currentPlayers + roster.length;

        transaction.set(joinRef, {
            uid: user.uid,
            tournamentId: String(id),
            tournamentName: data.name || item.name,
            category: data.category || item.category,
            map: data.map || item.map,
            time: data.time || item.time,
            capacity: maxPlayers,
            teamFormat,
roster,
            createdAt: serverTimestamp()
        });

        transaction.update(tournamentRef, {
            players: newPlayers
        });

        return newPlayers;
    }
);

                    item.players = updatedPlayers;
                    joinedTournaments.add(String(id));

                    renderTournaments(
                        document.querySelector(".category-btn.active")
                            ?.dataset.category || "All"
                    );

                    closeDetails();
                    showJoinSuccess();

                } catch (error) {
                    console.error("Joining error:", error);
                    alert(
    "Error Code: " + (error.code || "unknown") +
    "\nMessage: " + (error.message || "Joining failed.")
);

                    const currentButton =
                        document.getElementById("joinTournament");

                    if (currentButton) {
                        currentButton.disabled = false;
                        currentButton.textContent = "CONFIRM JOIN";
                    }
                }
            };
    }

    function closeDetails() {
        modal.classList.add("hidden");
    }

    modal.addEventListener("click", event => {
        if (event.target === modal) closeDetails();
    });

    // =================================
    // CATEGORY FILTER
    // =================================

    categoryList.addEventListener("click", event => {
        const button = event.target.closest(".category-btn");
        if (!button) return;

        document.querySelectorAll(".category-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");
        renderTournaments(button.dataset.category);
    });

    // =================================
    // TOURNAMENT BUTTONS
    // =================================

    tournamentList.addEventListener("click", event => {
        const button = event.target.closest(".join-btn");
        if (!button) return;

        openDetails(button.dataset.id);
    });

    matchesPage.addEventListener("click", event => {
        const button = event.target.closest(".my-match-view");

        if (button) openDetails(button.dataset.id);

        if (event.target.closest("#exploreMatches")) {
            showPage("home");
        }
    });

    // =================================
    // PROFILE EVENTS
    // =================================

    profilePage.addEventListener("click", async event => {
        if (event.target.closest("#logoutBtn")) {
            if (!confirm("Are you sure you want to logout?")) {
                return;
            }

            try {
                await signOut(auth);
            } catch (error) {
                alert("Logout failed: " + error.message);
            }
        }

        if (event.target.closest("#retryProfile")) {
            renderProfile();
        }
    });

    profilePage.addEventListener("submit", async event => {
        if (event.target.id !== "editProfileForm") return;

        event.preventDefault();

        const user = auth.currentUser;

        const name =
            document.getElementById("newPlayerName").value.trim();

        const message =
            document.getElementById("profileMessage");

        if (!user || !name) return;

        const button =
            event.target.querySelector('button[type="submit"]');

        button.disabled = true;
        button.textContent = "SAVING...";

        try {
            await updateDoc(
                doc(db, "users", user.uid),
                { name }
            );

            await updateProfile(user, {
                displayName: name
            });

            await renderProfile();

        } catch (error) {
            console.error("Profile update error:", error);

            message.textContent = error.message;

            button.disabled = false;
            button.textContent = "SAVE PROFILE";
        }
    });

    // =================================
    // HEADER BUTTONS
    // =================================

    document.getElementById("walletBtn")
        ?.addEventListener("click", () => {
            showPage("wallet");
        });

        // =================================
    // PLAYER NOTIFICATION INBOX
    // =================================

    const notificationBtn =
        document.getElementById("notificationBtn");

    const notificationModal = document.createElement("div");
    notificationModal.id = "playerNotificationModal";

    notificationModal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:9999;
        background:rgba(0,0,0,.88);
        display:none;
        align-items:center;
        justify-content:center;
        padding:15px;
    `;

    notificationModal.innerHTML = `
        <div style="
            width:100%;
            max-width:430px;
            max-height:80vh;
            overflow-y:auto;
            padding:20px;
            border:1px solid #b98220;
            border-radius:16px;
            background:#151515;
            color:white;
        ">
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
            ">
                <h2 style="color:#ffca55;margin:0">
                    🔔 Notifications
                </h2>
                <button id="closePlayerNotifications"
                    style="background:#333;color:white;border:0;
                    padding:8px 13px;border-radius:8px;font-size:20px">
                    ×
                </button>
            </div>

            <div id="playerNotificationList" style="margin-top:18px">
                Loading notifications...
            </div>
        </div>
    `;

    document.body.appendChild(notificationModal);

    const notificationList =
        notificationModal.querySelector("#playerNotificationList");

    let playerNotifications = [];
    let readNotificationIds = new Set();

    function renderPlayerNotifications() {
        const unreadCount = playerNotifications.filter(
            item => !readNotificationIds.has(item.id)
        ).length;

        if (notificationBtn) {
            notificationBtn.textContent =
                unreadCount > 0 ? `♢ ${unreadCount}` : "♢";
        }

        if (playerNotifications.length === 0) {
            notificationList.innerHTML = `
                <p style="text-align:center;color:#aaa;padding:25px 0">
                    No notifications yet.
                </p>
            `;
            return;
        }

        notificationList.innerHTML = playerNotifications.map(item => {
            const isRead = readNotificationIds.has(item.id);

            const date = item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleString()
                : "Just now";

            return `
                <div data-notification-id="${escapeHTML(item.id)}"
                    style="
                        padding:14px;
                        margin-bottom:12px;
                        border:1px solid #493817;
                        border-radius:12px;
                        background:${isRead ? "#202020" : "#30230e"};
                        cursor:pointer;
                    ">
                    <div style="display:flex;justify-content:space-between">
                        <strong style="color:#ffca55">
                            ${escapeHTML(item.title)}
                        </strong>
                        ${isRead ? "" : '<span style="color:#ffca55">●</span>'}
                    </div>
                    <p style="color:#ddd;font-size:13px;line-height:1.5">
                        ${escapeHTML(item.message)}
                    </p>
                    <small style="color:#999">${escapeHTML(date)}</small>
                </div>
            `;
        }).join("");
    }

        // =================================
    // MEDIAN FCM PUSH NOTIFICATIONS
    // =================================

    let medianBridgeReady = false;
        let fcmSetupStarted = false;

    function activatePushNotifications() {
        alert("FCM TEST: Function started");
        const messaging = window.median?.firebaseMessaging;

        if (!messaging) {
            alert("ERROR: Median FCM bridge not available. Rebuild app and check plugin.");
            return;
        }

        if (fcmSetupStarted) return;
        fcmSetupStarted = true;

        messaging.requestPermission({
            callback: function (permission) {
                alert("FCM permission callback: " + permission.granted);
                if (!permission.granted) {
                    alert("Notification permission denied.");
                    fcmSetupStarted = false;
                    return;
                }

                messaging.register({
                    callback: function (registration) {
                        console.log("FCM registration:", registration);
                        alert("FCM registration callback received!");

                        messaging.getToken({
                            callback: function (tokenResult) {
                                const token = tokenResult.token;
                                alert(token ? "FCM TOKEN GENERATED SUCCESSFULLY" : "FCM TOKEN NOT GENERATED");

                                if (!token) {
                                    alert("ERROR: FCM token not generated.");
                                    fcmSetupStarted = false;
                                    return;
                                }

                                messaging.subscribeToTopic({
                                    topic: "raavan_all_players",
                                    callback: function (result) {
                                        messaging.getSubscribedTopics({
                                            callback: function (topicsResult) {
                                                const topics =
                                                    topicsResult.topics || [];

                                                const subscribed =
                                                    topics.includes("raavan_all_players");

                                                alert(
                                                    "FCM DIAGNOSTIC\n\n" +
                                                    "Token: GENERATED\n" +
                                                    "Token preview: " +
                                                    token.substring(0, 12) + "...\n\n" +
                                                    "Topic subscription: " +
                                                    (result.success ? "SUCCESS" : "FAILED") +
                                                    "\nTopic verified: " +
                                                    (subscribed ? "YES" : "NO")
                                                );
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    notificationBtn?.addEventListener("click", () => {
        activatePushNotifications();
        notificationModal.style.display = "flex";
        renderPlayerNotifications();
    });

    notificationModal.querySelector(
        "#closePlayerNotifications"
    ).addEventListener("click", () => {
        notificationModal.style.display = "none";
    });

    notificationModal.addEventListener("click", event => {
        if (event.target === notificationModal) {
            notificationModal.style.display = "none";
        }
    });

    notificationList.addEventListener("click", async event => {
        const item = event.target.closest("[data-notification-id]");
        if (!item) return;

        const notificationId = item.dataset.notificationId;
        const user = auth.currentUser;

        if (!user || readNotificationIds.has(notificationId)) return;

        try {
            await setDoc(
                doc(
                    db,
                    "notificationReads",
                    `${user.uid}_${notificationId}`
                ),
                {
                    uid: user.uid,
                    notificationId,
                    readAt: serverTimestamp()
                }
            );

            readNotificationIds.add(notificationId);
            renderPlayerNotifications();

        } catch (error) {
            console.error("Notification read error:", error);
        }
    });

    const notificationUser = auth.currentUser;

    if (notificationUser) {
        getDocs(query(
            collection(db, "notificationReads"),
            where("uid", "==", notificationUser.uid)
        )).then(snapshot => {
            snapshot.forEach(item => {
                readNotificationIds.add(
                    item.data().notificationId
                );
            });
            renderPlayerNotifications();
        }).catch(error => {
            console.error("Read status error:", error);
        });
    }

    onSnapshot(
        collection(db, "notifications"),
        snapshot => {
            playerNotifications = snapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));

            playerNotifications.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

            renderPlayerNotifications();
        },
        error => {
            console.error("Notification listener error:", error);
            notificationList.textContent =
                "Unable to load notifications.";
        }
    );

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.addEventListener("click", () => {
            const page = button.dataset.page;

            if (
                ["home", "matches", "wallet", "profile"].includes(page)
            ) {
                showPage(page);
            }
        });
    });

    // =================================
    // INITIAL LOAD
    // =================================

    async function initializeHome() {
        tournamentList.innerHTML = `
            <div class="empty-state">
                Loading tournaments...
            </div>
        `;

        try {
            await Promise.all([
                loadTournaments(),
                loadJoinedTournaments(),
                loadCardSettings(),
                loadBanners()
            ]);

            renderTournaments();
            renderBanners();
            listenToTournaments(renderTournaments);

        } catch (error) {
            console.error("Homepage loading error:", error);

            tournamentList.innerHTML = `
                <div class="empty-state">
                    Could not load tournaments.
                    <br>
                    ${escapeHTML(error.message)}
                </div>
            `;
        }
    }

    initializeHome();
}
