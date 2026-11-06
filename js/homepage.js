
import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    runTransaction,
    serverTimestamp
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


// HTML SAFETY
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// LOAD TOURNAMENTS
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


// LOAD JOINED TOURNAMENTS
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


// LOAD CARD SETTINGS
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


// LOAD BANNERS
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


// MAIN HOMEPAGE
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

    const modal = document.createElement("div");
    modal.id = "tournamentModal";
    modal.className = "tournament-modal hidden";
    document.body.appendChild(modal);


    // SUCCESS TOAST
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


    // MY MATCHES PAGE
    const matchesPage = document.createElement("section");
    matchesPage.className = "matches-page hidden";
    homePage.appendChild(matchesPage);


    // PROFILE PAGE
    const profilePage = document.createElement("section");
    profilePage.className = "profile-page hidden";
    homePage.appendChild(profilePage);


    // =================================
    // DYNAMIC BANNER SLIDER
    // =================================

    function renderBanners() {

        const bannerContainer =
            document.getElementById("bannerSlider");

        if (!bannerContainer) {
            console.warn("Banner slider not found.");
            return;
        }

        if (bannerTimer) {
            clearInterval(bannerTimer);
            bannerTimer = null;
        }

        // NO ADMIN BANNERS - SHOW DEFAULT HERO
        if (!banners.length) {

            bannerContainer.style.backgroundImage = "";
            bannerContainer.style.backgroundSize = "";
            bannerContainer.style.backgroundPosition = "";

            bannerContainer.innerHTML = `
                <div class="hero-tag">WELCOME TO THE BATTLE</div>
                <h2>PLAY SMART.<br>WIN BIG.</h2>
                <p>Your tournament journey starts here.</p>
                <div class="hero-decoration">R</div>
            `;

            return;
        }

        let currentIndex = 0;

        // KEEP ORIGINAL HERO TEXT
        bannerContainer.innerHTML = `
            <div class="hero-tag">WELCOME TO THE BATTLE</div>
            <h2>PLAY SMART.<br>WIN BIG.</h2>
            <p>Your tournament journey starts here.</p>
            <div class="hero-decoration">R</div>
        `;

        function showBanner(index) {

            const imageUrl = banners[index].imageUrl;

            bannerContainer.style.backgroundImage =
                `linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.25)), url("${imageUrl}")`;

            bannerContainer.style.backgroundSize = "cover";
            bannerContainer.style.backgroundPosition = "center";
            bannerContainer.style.backgroundRepeat = "no-repeat";
        }

        showBanner(currentIndex);

        // CHANGE IMAGE EVERY 4 SECONDS
        if (banners.length > 1) {

            bannerTimer = setInterval(() => {

                currentIndex =
                    (currentIndex + 1) % banners.length;

                showBanner(currentIndex);

            }, 4000);
        }
    }


    // =================================
    // RENDER TOURNAMENTS
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

            const info = [];

            if (cardSettings.prizePool) {
                info.push(`
                    <div class="info-box">
                        <small>PRIZE POOL</small>
                        <strong>${escapeHTML(item.prizePool ?? 0)} COINS</strong>
                    </div>
                `);
            }

            if (cardSettings.perKillReward) {
                info.push(`
                    <div class="info-box">
                        <small>PER KILL REWARD</small>
                        <strong>${escapeHTML(item.perKillReward ?? 0)} COINS</strong>
                    </div>
                `);
            }

            if (cardSettings.booyahPrize) {
                info.push(`
                    <div class="info-box">
                        <small>BOOYAH PRIZE</small>
                        <strong>${escapeHTML(item.booyahPrize ?? 0)} COINS</strong>
                    </div>
                `);
            }

            if (cardSettings.entryFees) {
                info.push(`
                    <div class="info-box">
                        <small>ENTRY FEES</small>
                        <strong>${escapeHTML(item.entryFees ?? 0)} COINS</strong>
                    </div>
                `);
            }

            const lowerInfo = [];

            if (cardSettings.map) {
                lowerInfo.push(`
                    <span>🗺️ ${escapeHTML(item.map)}</span>
                `);
            }

            if (cardSettings.playersCount) {
                lowerInfo.push(`
                    <span>👥 ${Number(item.players || 0)} / ${Number(item.capacity || 0)}</span>
                `);
            }

            const joined = joinedTournaments.has(String(item.id));

            return `
                <article class="tournament-card">

                    <div class="tournament-top">
                        <span class="tournament-type">
                            ${escapeHTML(item.category)} MATCH
                        </span>

                        <span class="match-status">
                            ● Upcoming
                        </span>
                    </div>

                    <h4>${escapeHTML(item.name)}</h4>

                    <div class="tournament-info">
                        ${info.join("")}
                    </div>

                    ${lowerInfo.length ? `
                        <div class="tournament-lower-info">
                            ${lowerInfo.join("")}
                        </div>
                    ` : ""}

                    <div class="join-row">
                        <button
                            class="join-btn"
                            data-id="${escapeHTML(item.id)}"
                        >
                            ${joined ? "VIEW TOURNAMENT" : "JOIN TOURNAMENT"}
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
                <p>Loading your matches...</p>
            </div>
        `;

        try {

            const q = query(
                collection(db, "tournamentJoins"),
                where("uid", "==", user.uid)
            );

            const snapshot = await getDocs(q);

            const matches = snapshot.docs.map(item => ({
                ...item.data(),
                joinId: item.id
            }));

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
                                    <span>${escapeHTML(item.category)} MATCH</span>
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
                        <p>Join a tournament and it will appear here.</p>
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
        if (!user) return;

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

            const profileSnap = await getDoc(
                doc(db, "users", user.uid)
            );

            if (!profileSnap.exists()) {
                throw new Error("Player profile not found.");
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

                    <h3>${escapeHTML(data.name)}</h3>

                    <span class="profile-badge">
                        REGISTERED PLAYER
                    </span>

                    <div class="profile-details">
                        <div>
                            <small>PLAYER ID</small>
                            <strong>${escapeHTML(data.playerId)}</strong>
                        </div>

                        <div>
                            <small>EMAIL ADDRESS</small>
                            <strong>${escapeHTML(data.email)}</strong>
                        </div>
                    </div>

                    <form id="editProfileForm">
                        <label for="newPlayerName">Update Player Name</label>

                        <input
                            type="text"
                            id="newPlayerName"
                            value="${escapeHTML(data.name)}"
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

        document.querySelectorAll(".nav-btn").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

        if (page === "matches") renderMyMatches();
        if (page === "profile") renderProfile();
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

        const joined = joinedTournaments.has(String(id));

        const full =
            Number(item.players || 0) >= Number(item.capacity || 0);

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
                        <strong>${Number(item.players || 0)}/${Number(item.capacity || 0)}</strong>
                    </div>

                </div>

                <div class="slot-section">
                    <div class="slot-label">
                        <span>Available Slots</span>
                        <strong>${Math.max(0, Number(item.capacity || 0) - Number(item.players || 0))}</strong>
                    </div>

                    <div class="slot-track">
                        <div class="slot-progress"
                            style="width:${Math.min(100, (Number(item.players || 0) / Math.max(1, Number(item.capacity || 1))) * 100)}%">
                        </div>
                    </div>
                </div>

                <button
                    class="details-join-btn"
                    id="joinTournament"
                    ${joined || full ? "disabled" : ""}
                >
                    ${joined
                        ? "✓ ALREADY JOINED"
                        : full
                            ? "SLOTS FULL"
                            : "CONFIRM JOIN"
                    }
                </button>

            </div>
        `;

        modal.classList.remove("hidden");

        document.getElementById("closeModal").onclick = closeDetails;

        document.getElementById("joinTournament").onclick =
            async () => {

                const user = auth.currentUser;

                if (!user) {
                    alert("Please login to join this tournament.");
                    return;
                }

                if (joinedTournaments.has(String(id)) || full) return;

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

                    await runTransaction(db, async transaction => {

                        const existingJoin =
                            await transaction.get(joinRef);

                        if (existingJoin.exists()) {
                            throw new Error(
                                "You have already joined this tournament."
                            );
                        }

                        transaction.set(joinRef, {
                            uid: user.uid,
                            tournamentId: String(id),
                            tournamentName: item.name,
                            category: item.category,
                            map: item.map,
                            time: item.time,
                            capacity: Number(item.capacity),
                            createdAt: serverTimestamp()
                        });
                    });

                    joinedTournaments.add(String(id));

                    closeDetails();

                    renderTournaments(
                        document.querySelector(".category-btn.active")
                            ?.dataset.category || "All"
                    );

                    showJoinSuccess();

                } catch (error) {

                    console.error("Joining error:", error);

                    alert(error.message || "Joining failed.");

                    joinButton.disabled = false;
                    joinButton.textContent = "CONFIRM JOIN";
                }
            };
    }


    function closeDetails() {
        modal.classList.add("hidden");
    }

    modal.addEventListener("click", event => {
        if (event.target === modal) closeDetails();
    });


    // CATEGORY FILTER
    categoryList.addEventListener("click", event => {

        const button = event.target.closest(".category-btn");
        if (!button) return;

        document.querySelectorAll(".category-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        renderTournaments(button.dataset.category);
    });


    // OPEN TOURNAMENT
    tournamentList.addEventListener("click", event => {

        const button = event.target.closest(".join-btn");

        if (button) {
            openDetails(button.dataset.id);
        }
    });


    // MY MATCHES EVENTS
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


    // PROFILE EVENTS
    profilePage.addEventListener("click", async event => {

        if (event.target.closest("#logoutBtn")) {

            if (!confirm("Are you sure you want to logout?")) return;

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


    // EDIT PROFILE
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

            message.textContent = error.message;

            button.disabled = false;
            button.textContent = "SAVE PROFILE";
        }
    });


    // WALLET
    document.getElementById("walletBtn")
        ?.addEventListener("click", () => {
            alert("Demo Points Wallet will be added in the next update.");
        });


    // NOTIFICATIONS
    document.getElementById("notificationBtn")
        ?.addEventListener("click", () => {
            alert("No new notifications.");
        });


    // BOTTOM NAVIGATION
    document.querySelectorAll(".nav-btn").forEach(button => {

        button.addEventListener("click", () => {

            const page = button.dataset.page;

            if (["home", "matches", "profile"].includes(page)) {
                showPage(page);
            } else {
                alert("This page is coming soon.");
            }
        });
    });


    // =================================
    // INITIAL FIREBASE LOAD
    // =================================

    async function initializeHome() {

        tournamentList.innerHTML = `
            <div class="empty-state">Loading tournaments...</div>
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

        } catch (error) {

            console.error("Homepage loading error:", error);

            tournamentList.innerHTML = `
                <div class="empty-state">
                    Could not load tournaments.
                    <br>${escapeHTML(error.message)}
                </div>
            `;
        }
    }

    initializeHome();
}
