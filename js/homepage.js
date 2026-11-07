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
                            ● ${full ? "FULL" : "UPCOMING"}
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

                    if (tournamentSnap.data().isActive === false) {
                        return null;
                    }

                    return item;
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
                <span>RAAVAN ESPORTS</span>
                <h2>MY WALLET</h2>
                <p>Manage your virtual coins.</p>
            </div>

            <div class="wallet-balance-card">
                <div class="wallet-card-top">
                    <span>AVAILABLE BALANCE</span>
                    <span class="wallet-coin-icon">◈</span>
                </div>

                <h1>${walletBalance.toLocaleString("en-IN")}</h1>
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
                    <small>Buy coin package</small>
                </button>

                <button class="wallet-action-btn" id="walletHistoryBtn">
                    <span>▤</span>
                    <strong>HISTORY</strong>
                    <small>View transactions</small>
                </button>
            </div>

            <div class="wallet-request-box" id="walletRequestBox">
                <div class="wallet-section-title">
                    <h3>BUY RAAVAN COINS</h3>
                    <span>UPI PAYMENT</span>
                </div>

                <p class="wallet-note">
                    Select a package, pay using UPI and submit your UTR.
                    Coins are credited only after admin verification.
                </p>

                <form id="coinRequestForm">
                    <label for="coinAmount">Select Coin Package</label>

                    <select id="coinAmount" required>
                        <option value="">Select package</option>
                        ${COIN_PACKAGES.map(amount => `
                            <option value="${amount}">
                                ₹${amount} — ${amount} Coins
                            </option>
                        `).join("")}
                    </select>

                    <div class="upi-payment-box">
                        <h3>PAYMENT DETAILS</h3>

                        <p><strong>Payee:</strong> ${PAYEE_NAME}</p>

                        <p>
                            <strong>UPI ID:</strong>
                            ${UPI_ID}
                        </p>

                        <button type="button" id="copyUpiBtn">
                            COPY UPI ID
                        </button>

                        <img
                            src="assets/upi-qr.jpg"
                            alt="UPI QR Code"
                            style="width:200px;max-width:100%;display:block;margin:15px auto;"
                        >

                        <a
                            id="payWithUpiBtn"
                            href="#"
                            target="_blank"
                            rel="noopener"
                        >
                            PAY WITH UPI APP
                        </a>
                    </div>

                    <label for="coinUtr">
                        Payment UTR / Reference Number
                    </label>

                    <input
                        type="text"
                        id="coinUtr"
                        minlength="8"
                        maxlength="20"
                        placeholder="Enter payment UTR"
                        autocomplete="off"
                        required
                    >

                    <button type="submit" id="submitCoinRequest">
                        SUBMIT PAYMENT
                    </button>

                    <p id="coinRequestMessage"></p>

                    <small>
                        Enter the actual UTR from your payment app.
                        Admin will verify the payment before crediting coins.
                    </small>
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
                            <strong>+${Number(item.coins || item.amount || 0)} Coins</strong>
                            <small>UTR: ${escapeHTML(item.utr || "N/A")}</small>
                            <small>${formatWalletDate(item.createdAt)}</small>
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

            <div
                class="wallet-section-title wallet-history-heading"
                id="walletHistory"
            >
                <h3>TRANSACTION HISTORY</h3>
                <span>${history.length} RECORDS</span>
            </div>

            <div class="wallet-transaction-list">
                ${history.length ? history.map(item => {
                    const type = item.type || "transaction";

                    const title = type === "admin_bonus"
                        ? "Admin Bonus"
                        : type === "deposit_approved"
                            ? "UPI Payment Approved"
                            : "Wallet Transaction";

                    return `
                        <div class="wallet-transaction-item">
                            <div class="wallet-transaction-icon">◈</div>

                            <div class="wallet-transaction-info">
                                <strong>${title}</strong>
                                <small>${escapeHTML(item.description || "Virtual coins")}</small>
                                <small>${formatWalletDate(item.createdAt)}</small>
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
                Coin purchases are manually verified. Coins are virtual
                platform credits and are not a bank balance.
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

    walletPage.addEventListener("change", event => {
        if (event.target.id !== "coinAmount") return;

        const amount = Number(event.target.value);
        const payButton =
            document.getElementById("payWithUpiBtn");

        if (!COIN_PACKAGES.includes(amount)) {
            payButton.href = "#";
            return;
        }

        const params = new URLSearchParams({
            pa: UPI_ID,
            pn: PAYEE_NAME,
            am: String(amount),
            cu: "INR"
        });

        payButton.href = `upi://pay?${params.toString()}`;
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
                        <strong>${escapeHTML(item.time)}</strong>
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

                            const currentPlayers =
                                Number(data.players || 0);

                            const maxPlayers =
                                Number(data.capacity || 0);

                            if (
                                !Number.isInteger(currentPlayers) ||
                                !Number.isInteger(maxPlayers) ||
                                maxPlayers <= 0
                            ) {
                                throw new Error("Invalid player count.");
                            }

                            if (currentPlayers >= maxPlayers) {
                                throw new Error("Tournament is full.");
                            }

                            const newPlayers = currentPlayers + 1;

                            transaction.set(joinRef, {
                                uid: user.uid,
                                tournamentId: String(id),
                                tournamentName: data.name || item.name,
                                category: data.category || item.category,
                                map: data.map || item.map,
                                time: data.time || item.time,
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

    document.getElementById("notificationBtn")
        ?.addEventListener("click", () => {
            alert("No new notifications.");
        });

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
