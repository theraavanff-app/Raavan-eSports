
import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    collection,
    getDocs,
    query,
    where,
    runTransaction,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

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

// WALLET STATE
let walletBalance = 0;
let walletRequests = [];
let walletTransactions = [];

let walletListenersStarted = false;

let unsubscribeWallet = null;
let unsubscribeRequests = null;
let unsubscribeHistory = null;


// =================================
// HTML SAFETY
// =================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// =================================
// TOURNAMENT STATUS
// =================================

function getTournamentStatus(item) {
    const players = Number(item.players || 0);
    const capacity = Number(item.capacity || 0);

    if (capacity > 0 && players >= capacity) {
        return "full";
    }

    return "available";
}


// =================================
// LOAD TOURNAMENTS
// =================================

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


// =================================
// REAL-TIME TOURNAMENT UPDATES
// =================================

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

            const activeCategory =
                document.querySelector(".category-btn.active")
                    ?.dataset.category || "All";

            renderTournaments(activeCategory);
        },
        error => {
            console.error("Tournament listener error:", error);
        }
    );
}


// =================================
// LOAD JOINED TOURNAMENTS
// =================================

async function loadJoinedTournaments() {
    joinedTournaments.clear();

    const user = auth.currentUser;
    if (!user) return;

    const q = query(
        collection(db, "tournamentJoins"),
        where("uid", "==", user.uid)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(item => {
        joinedTournaments.add(
            String(item.data().tournamentId)
        );
    });
}


// =================================
// LOAD CARD SETTINGS
// =================================

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


// =================================
// LOAD BANNERS
// =================================

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


// =================================
// MAIN HOMEPAGE
// =================================

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
    // SUCCESS TOAST
    // =================================

    const successToast = document.createElement("div");

    successToast.className = "join-success-toast";

    successToast.innerHTML = `
        <div class="success-check">✓</div>
        <div>
            <strong>Successfully Joined!</strong>
            <small>Your tournament spot is confirmed.</small>
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
    // MY MATCHES PAGE
    // =================================

    const matchesPage = document.createElement("section");

    matchesPage.className = "matches-page hidden";

    homePage.appendChild(matchesPage);


    // =================================
    // PROFILE PAGE
    // =================================

    const profilePage = document.createElement("section");

    profilePage.className = "profile-page hidden";

    homePage.appendChild(profilePage);


    // =================================
    // WALLET PAGE
    // =================================

    const walletPage = document.createElement("section");

    walletPage.className = "wallet-page hidden";

    homePage.appendChild(walletPage);


    // =================================
    // DYNAMIC BANNER SLIDER
    // =================================

    function renderBanners() {
        const bannerContainer =
            document.getElementById("bannerSlider") ||
            document.querySelector(".hero-banner");

        if (!bannerContainer) return;

        if (bannerTimer) {
            clearInterval(bannerTimer);
            bannerTimer = null;
        }

        const heroContent = `
            <div class="hero-tag">WELCOME TO THE BATTLE</div>
            <h2>PLAY SMART.<br>WIN BIG.</h2>
            <p>Your tournament journey starts here.</p>
            <div class="hero-decoration">R</div>
        `;

        bannerContainer.innerHTML = heroContent;

        if (!banners.length) {
            bannerContainer.style.backgroundImage = "";
            return;
        }

        let currentIndex = 0;

        function showBanner(index) {
            const imageUrl = banners[index].imageUrl;

            bannerContainer.style.backgroundImage =
                `linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.25)), url("${imageUrl}")`;

            bannerContainer.style.backgroundSize = "cover";
            bannerContainer.style.backgroundPosition = "center";
            bannerContainer.style.backgroundRepeat = "no-repeat";
        }

        showBanner(currentIndex);

        if (banners.length > 1) {
            bannerTimer = setInterval(() => {
                currentIndex =
                    (currentIndex + 1) % banners.length;

                showBanner(currentIndex);
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

            const status = getTournamentStatus(item);
            const full = status === "full";

            const joined =
                joinedTournaments.has(String(item.id));

            const remainingSlots =
                Math.max(0, capacity - players);

            const info = [];

            if (cardSettings.prizePool) {
                info.push(`
                    <div class="info-box">
                        <small>PRIZE POOL</small>
                        <strong>
                            ${escapeHTML(item.prizePool ?? 0)}
                            <small class="coin-unit">COINS</small>
                        </strong>
                    </div>
                `);
            }

            if (cardSettings.perKillReward) {
                info.push(`
                    <div class="info-box">
                        <small>PER KILL</small>
                        <strong>
                            ${escapeHTML(item.perKillReward ?? 0)}
                            <small class="coin-unit">COINS</small>
                        </strong>
                    </div>
                `);
            }

            if (cardSettings.entryFees) {
                info.push(`
                    <div class="info-box">
                        <small>ENTRY FEES</small>
                        <strong>
                            ${escapeHTML(item.entryFees ?? 0)}
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

                        ${full ? `
                            <span class="match-status full-status">
                                ● FULL
                            </span>
                        ` : `
                            <span class="match-status">
                                ● UPCOMING
                            </span>
                        `}
                    </div>

                    <h4>${escapeHTML(item.name || "Tournament")}</h4>

                    <div class="tournament-info">
                        ${info.join("")}
                    </div>

                    ${lowerInfo.length ? `
                        <div class="tournament-lower-info">
                            ${lowerInfo.join("")}
                        </div>
                    ` : ""}

                    <div class="card-slot-section">
                        <div class="card-slot-label">
                            <span>
                                ${full ? "Tournament Full" : "Available Slots"}
                            </span>

                            <strong>
                                ${full ? "FULL" : remainingSlots}
                            </strong>
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
                                    : "VIEW & JOIN"
                            }
                        </button>
                    </div>

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
            const q = query(
                collection(db, "tournamentJoins"),
                where("uid", "==", user.uid)
            );

            const snapshot = await getDocs(q);

            const allMatches = snapshot.docs.map(item => ({
                ...item.data(),
                joinId: item.id
            }));

            const checkedMatches = await Promise.all(
                allMatches.map(async item => {
                    const tournamentSnap = await getDoc(
                        doc(db, "tournaments", String(item.tournamentId))
                    );

                    if (!tournamentSnap.exists()) return null;

                    const tournament = tournamentSnap.data();

                    if (tournament.isActive === false) return null;

                    return item;
                })
            );

            const matches = checkedMatches.filter(Boolean);

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
                                    <span class="my-match-status">
                                        ● JOINED
                                    </span>
                                </div>

                                <h3>${escapeHTML(item.tournamentName)}</h3>

                                <div class="my-match-info">
                                    <div>
                                        <small>MAP</small>
                                        <strong>${escapeHTML(item.map)}</strong>
                                    </div>

                                    <div>
                                        <small>TIME</small>
                                        <strong>${escapeHTML(item.time)}</strong>
                                    </div>
                                </div>

                                <button
                                    class="my-match-view"
                                    data-id="${escapeHTML(item.tournamentId)}"
                                >
                                    VIEW TOURNAMENT
                                </button>

                            </article>
                        `).join("")}
                    </div>
                ` : `
                    <div class="matches-empty">
                        <div class="empty-match-icon">🏆</div>
                        <h3>No Matches Joined Yet</h3>
                        <p>Your joined tournaments will appear here.</p>

                        <button id="exploreMatches">
                            EXPLORE TOURNAMENTS
                        </button>
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
                    (user.email
                        ? user.email.split("@")[0]
                        : "Player");

                const playerId =
                    "RAAVAN-" +
                    user.uid.substring(0, 8).toUpperCase();

                await setDoc(profileRef, {
                    uid: user.uid,
                    name: playerName,
                    email: user.email || "",
                    playerId: playerId,
                    createdAt: serverTimestamp()
                });

                profileSnap = await getDoc(profileRef);
            }

            if (!profileSnap.exists()) {
                throw new Error(
                    "Profile could not be created. Check Firestore rules."
                );
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

                    <span class="profile-badge">
                        REGISTERED PLAYER
                    </span>

                    <div class="profile-details">
                        <div>
                            <small>PLAYER ID</small>
                            <strong>
                                ${escapeHTML(data.playerId || "Not assigned")}
                            </strong>
                        </div>

                        <div>
                            <small>EMAIL ADDRESS</small>
                            <strong>
                                ${escapeHTML(data.email || user.email || "")}
                            </strong>
                        </div>
                    </div>

                    <form id="editProfileForm">
                        <label for="newPlayerName">
                            Update Player Name
                        </label>

                        <input
                            type="text"
                            id="newPlayerName"
                            value="${escapeHTML(data.name || "Player")}"
                            maxlength="30"
                            required
                        >

                        <button type="submit">
                            SAVE PROFILE
                        </button>

                        <p id="profileMessage"></p>
                    </form>

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

                    <button id="retryProfile">
                        TRY AGAIN
                    </button>
                </div>
            `;
        }
    }


    // =================================
    // WALLET DATE FORMAT
    // =================================

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


    // =================================
    // RENDER PLAYER WALLET
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

        const history = [...walletTransactions].sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;

            return timeB - timeA;
        });

        const requests = [...walletRequests].sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;

            return timeB - timeA;
        });

        walletPage.innerHTML = `
            <div class="wallet-heading">
                <span>RAAVAN ESPORTS</span>
                <h2>MY WALLET</h2>
                <p>Manage your virtual coins.</p>
            </div>

            <div class="wallet-balance-card">

                <div class="wallet-card-top">
                    <span>AVAILABLE BALANCE</span>
                    <span class="wallet-coin-icon">◈</span>
                </div>

                <h1>
                    ${walletBalance.toLocaleString("en-IN")}
                </h1>

                <p>VIRTUAL COINS</p>

                <div class="wallet-card-footer">
                    <span>RAAVAN ESPORTS</span>
                    <span>PLAYER WALLET</span>
                </div>

            </div>

            <div class="wallet-action-grid">

                <button class="wallet-action-btn" id="addCoinsBtn">
                    <span>＋</span>
                    <strong>ADD COINS</strong>
                    <small>Send a request</small>
                </button>

                <button class="wallet-action-btn" id="walletHistoryBtn">
                    <span>▤</span>
                    <strong>HISTORY</strong>
                    <small>View transactions</small>
                </button>

            </div>

            <div class="wallet-request-box" id="walletRequestBox">

                <div class="wallet-section-title">
                    <h3>ADD VIRTUAL COINS</h3>
                    <span>REQUEST</span>
                </div>

                <p class="wallet-note">
                    Submit a virtual coin request. An admin will review and approve or reject it.
                </p>

                <form id="coinRequestForm">

                    <label for="coinAmount">
                        Coin Amount
                    </label>

                    <input
                        type="number"
                        id="coinAmount"
                        min="1"
                        max="100000"
                        step="1"
                        placeholder="Enter coins (e.g. 500)"
                        required
                    >

                    <label for="coinNote">
                        Request Note (Optional)
                    </label>

                    <input
                        type="text"
                        id="coinNote"
                        maxlength="100"
                        placeholder="Write a short note"
                    >

                    <button type="submit" id="submitCoinRequest">
                        SUBMIT REQUEST
                    </button>

                    <p id="coinRequestMessage"></p>

                </form>

            </div>

            <div class="wallet-section-title wallet-history-heading">
                <h3>REQUEST HISTORY</h3>
                <span>${requests.length} REQUESTS</span>
            </div>

            <div class="wallet-request-list">

                ${requests.length ? requests.map(item => `
                    <div class="wallet-request-item">

                        <div>
                            <strong>
                                +${Number(item.amount || 0)} Coins
                            </strong>

                            <small>
                                ${escapeHTML(item.note || "Virtual coin request")}
                            </small>

                            <small>
                                ${formatWalletDate(item.createdAt)}
                            </small>
                        </div>

                        <span class="request-status ${escapeHTML(item.status || "pending")}">
                            ${escapeHTML((item.status || "pending").toUpperCase())}
                        </span>

                    </div>
                `).join("") : `
                    <div class="wallet-empty-small">
                        No coin requests yet.
                    </div>
                `}

            </div>

            <div class="wallet-section-title wallet-history-heading" id="walletHistory">
                <h3>TRANSACTION HISTORY</h3>
                <span>${history.length} RECORDS</span>
            </div>

            <div class="wallet-transaction-list">

                ${history.length ? history.map(item => {
                    const type = item.type || "transaction";

                    const title = type === "admin_bonus"
                        ? "Admin Bonus"
                        : type === "deposit_approved"
                            ? "Request Approved"
                            : "Wallet Transaction";

                    return `
                        <div class="wallet-transaction-item">

                            <div class="wallet-transaction-icon">
                                ◈
                            </div>

                            <div class="wallet-transaction-info">
                                <strong>${title}</strong>

                                <small>
                                    ${escapeHTML(item.description || "Virtual coins")}
                                </small>

                                <small>
                                    ${formatWalletDate(item.createdAt)}
                                </small>
                            </div>

                            <strong class="wallet-credit">
                                +${Number(item.amount || 0)}
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
                This wallet uses virtual coins only. It does not process real-money deposits or withdrawals.
            </p>
        `;
    }


    // =================================
    // START REAL-TIME WALLET LISTENERS
    // =================================

    function startWalletListeners() {
        const user = auth.currentUser;

        if (!user || walletListenersStarted) return;

        walletListenersStarted = true;

        // WALLET BALANCE
        unsubscribeWallet = onSnapshot(
            doc(db, "wallets", user.uid),

            snapshot => {
                walletBalance = snapshot.exists()
                    ? Number(snapshot.data().balance || 0)
                    : 0;

                renderWallet();
            },

            error => {
                console.error("Wallet balance error:", error);
            }
        );


        // COIN REQUESTS
        const requestQuery = query(
            collection(db, "coinRequests"),
            where("uid", "==", user.uid)
        );

        unsubscribeRequests = onSnapshot(
            requestQuery,

            snapshot => {
                walletRequests = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                renderWallet();
            },

            error => {
                console.error("Wallet request error:", error);
            }
        );


        // TRANSACTION HISTORY
        const historyQuery = query(
            collection(db, "walletTransactions"),
            where("uid", "==", user.uid)
        );

        unsubscribeHistory = onSnapshot(
            historyQuery,

            snapshot => {
                walletTransactions = snapshot.docs.map(item => ({
                    id: item.id,
                    ...item.data()
                }));

                renderWallet();
            },

            error => {
                console.error("Wallet history error:", error);
            }
        );
    }


    // =================================
    // SUBMIT COIN REQUEST
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

        const note =
            document.getElementById("coinNote").value.trim();

        const message =
            document.getElementById("coinRequestMessage");

        const submitButton =
            document.getElementById("submitCoinRequest");

        if (
            !Number.isInteger(amount) ||
            amount < 1 ||
            amount > 100000
        ) {
            message.textContent =
                "Enter a valid amount between 1 and 100000.";

            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "SUBMITTING...";

        try {
            const requestData = {
                uid: user.uid,
                amount: amount,
                status: "pending",
                createdAt: serverTimestamp()
            };

            if (note) {
                requestData.note = note;
            }

            await addDoc(
                collection(db, "coinRequests"),
                requestData
            );

            event.target.reset();

            message.textContent =
                "Request submitted successfully! Waiting for admin approval.";

            message.className = "wallet-message-success";

        } catch (error) {
            console.error("Coin request error:", error);

            message.textContent =
                error.message || "Could not submit request.";

            message.className = "wallet-message-error";

        } finally {
            // The real-time listener may have refreshed the form.
            const currentButton =
                document.getElementById("submitCoinRequest");

            if (currentButton) {
                currentButton.disabled = false;
                currentButton.textContent = "SUBMIT REQUEST";
            }
        }
    });


    // =================================
    // WALLET BUTTON EVENTS
    // =================================

    walletPage.addEventListener("click", event => {
        if (event.target.closest("#addCoinsBtn")) {
            document.getElementById("walletRequestBox")
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        }

        if (event.target.closest("#walletHistoryBtn")) {
            document.getElementById("walletHistory")
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        }
    });


    // =================================
    // PAGE NAVIGATION
    // =================================

    function showPage(page) {
        homeSections.forEach(section => {
            section.classList.toggle(
                "hidden",
                page !== "home"
            );
        });

        matchesPage.classList.toggle(
            "hidden",
            page !== "matches"
        );

        profilePage.classList.toggle(
            "hidden",
            page !== "profile"
        );

        walletPage.classList.toggle(
            "hidden",
            page !== "wallet"
        );

        document.querySelectorAll(".nav-btn").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

        if (page === "matches") {
            renderMyMatches();
        }

        if (page === "profile") {
            renderProfile();
        }

        if (page === "wallet") {
            startWalletListeners();
            renderWallet();
        }
    }


    // =================================
    // TOURNAMENT DETAILS
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

        const joined =
            joinedTournaments.has(String(id));

        const remainingSlots =
            Math.max(0, capacity - players);

        const progress = capacity > 0
            ? Math.min(100, (players / capacity) * 100)
            : 0;

        modal.innerHTML = `
            <div class="details-box">

                <div class="details-header">
                    <span>TOURNAMENT DETAILS</span>

                    <button class="close-modal" id="closeModal">
                        ✕
                    </button>
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
                        <strong>
                            ${escapeHTML(item.prizePool ?? 0)} COINS
                        </strong>
                    </div>

                    <div class="details-item">
                        <small>PER KILL REWARD</small>
                        <strong>
                            ${escapeHTML(item.perKillReward ?? 0)} COINS
                        </strong>
                    </div>

                    <div class="details-item">
                        <small>BOOYAH PRIZE</small>
                        <strong>
                            ${escapeHTML(item.booyahPrize ?? 0)} COINS
                        </strong>
                    </div>

                    <div class="details-item">
                        <small>ENTRY FEES</small>
                        <strong>
                            ${escapeHTML(item.entryFees ?? 0)} COINS
                        </strong>
                    </div>

                    <div class="details-item">
                        <small>MAP</small>
                        <strong>${escapeHTML(item.map)}</strong>
                    </div>

                    <div class="details-item">
                        <small>MATCH TIME</small>
                        <strong>${escapeHTML(item.time)}</strong>
                    </div>

                    <div class="details-item">
                        <small>PLAYERS</small>
                        <strong>${players}/${capacity}</strong>
                    </div>

                </div>

                <div class="slot-section">

                    <div class="slot-label">
                        <span>
                            ${full ? "Tournament Full" : "Available Slots"}
                        </span>

                        <strong>
                            ${full ? "FULL" : remainingSlots}
                        </strong>
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
                            : "CONFIRM JOIN"
                    }
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

                            const tournamentData =
                                tournamentSnap.data();

                            if (tournamentData.isActive === false) {
                                throw new Error("Tournament is inactive.");
                            }

                            const currentPlayers =
                                Number(tournamentData.players || 0);

                            const maxPlayers =
                                Number(tournamentData.capacity || 0);

                            if (
                                !Number.isInteger(currentPlayers) ||
                                !Number.isInteger(maxPlayers) ||
                                maxPlayers <= 0
                            ) {
                                throw new Error(
                                    "Invalid tournament player count."
                                );
                            }

                            if (currentPlayers >= maxPlayers) {
                                throw new Error(
                                    "Tournament is full. No slots available."
                                );
                            }

                            const newPlayers = currentPlayers + 1;

                            transaction.set(joinRef, {
                                uid: user.uid,
                                tournamentId: String(id),
                                tournamentName:
                                    tournamentData.name || item.name,
                                category:
                                    tournamentData.category || item.category,
                                map:
                                    tournamentData.map || item.map,
                                time:
                                    tournamentData.time || item.time,
                                capacity: maxPlayers,
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

                    alert(error.message || "Joining failed.");

                    const currentJoinButton =
                        document.getElementById("joinTournament");

                    if (currentJoinButton) {
                        const latestItem = tournaments.find(
                            t => String(t.id) === String(id)
                        );

                        const latestFull = latestItem
                            ? getTournamentStatus(latestItem) === "full"
                            : false;

                        currentJoinButton.disabled = latestFull;

                        currentJoinButton.textContent =
                            latestFull
                                ? "TOURNAMENT FULL"
                                : "CONFIRM JOIN";
                    }
                }
            };
    }


    function closeDetails() {
        modal.classList.add("hidden");
    }


    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeDetails();
        }
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
    // OPEN TOURNAMENT
    // =================================

    tournamentList.addEventListener("click", event => {
        const button = event.target.closest(".join-btn");

        if (!button) return;

        openDetails(button.dataset.id);
    });


    // =================================
    // MY MATCHES EVENTS
    // =================================

    matchesPage.addEventListener("click", event => {
        const viewButton =
            event.target.closest(".my-match-view");

        if (viewButton) {
            openDetails(viewButton.dataset.id);
        }

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


    // =================================
    // EDIT PROFILE
    // =================================

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
    // HEADER WALLET BUTTON
    // =================================

    document.getElementById("walletBtn")
        ?.addEventListener("click", () => {
            showPage("wallet");
        });


    // =================================
    // NOTIFICATIONS
    // =================================

    document.getElementById("notificationBtn")
        ?.addEventListener("click", () => {
            alert("No new notifications.");
        });


    // =================================
    // BOTTOM NAVIGATION
    // =================================

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
    // INITIAL FIREBASE LOAD
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
