
const demoTournaments = [
    { id: 1, name: "Solo Battle Challenge", category: "Solo", map: "Bermuda", time: "6:00 PM", players: 12, capacity: 48, prize: "Demo Points" },
    { id: 2, name: "Squad Warrior Cup", category: "Squad", map: "Bermuda", time: "7:00 PM", players: 8, capacity: 48, prize: "Demo Points" },
    { id: 3, name: "Clash Squad Arena", category: "CS", map: "Random", time: "8:00 PM", players: 4, capacity: 16, prize: "Demo Points" },
    { id: 4, name: "Duo Survival Match", category: "Duo", map: "Purgatory", time: "9:00 PM", players: 6, capacity: 24, prize: "Demo Points" }
];

const STORAGE_KEY = "raavan_demo_joined_matches";

function loadJoined() {
    try {
        return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
        return new Set();
    }
}

const joinedTournaments = loadJoined();

export function initHomepage() {
    const tournamentList = document.getElementById("tournamentList");
    const categoryList = document.getElementById("categoryList");
    const homePage = document.querySelector(".home-page");

    if (!tournamentList || !categoryList || !homePage) return;

    const homeSections = [...homePage.children];

    // Tournament details popup
    const modal = document.createElement("div");
    modal.id = "tournamentModal";
    modal.className = "tournament-modal hidden";
    document.body.appendChild(modal);

    // Success animation
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

        setTimeout(() => successToast.classList.remove("show"), 2600);
    }

    // My Matches page
    const matchesPage = document.createElement("section");
    matchesPage.className = "matches-page hidden";
    homePage.appendChild(matchesPage);

    function renderTournaments(category = "All") {
        const filtered = category === "All"
            ? demoTournaments
            : demoTournaments.filter(item => item.category === category);

        if (!filtered.length) {
            tournamentList.innerHTML =
                `<div class="empty-state">No tournaments available.</div>`;
            return;
        }

        tournamentList.innerHTML = filtered.map(item => `
            <article class="tournament-card">
                <div class="tournament-top">
                    <span class="tournament-type">${item.category} MATCH</span>
                    <span class="match-status">● Upcoming</span>
                </div>
                <h4>${item.name}</h4>
                <div class="tournament-info">
                    <div class="info-box"><small>MAP</small><strong>${item.map}</strong></div>
                    <div class="info-box"><small>TIME</small><strong>${item.time}</strong></div>
                    <div class="info-box"><small>PLAYERS</small><strong>${item.players} / ${item.capacity}</strong></div>
                </div>
                <div class="join-row">
                    <button class="join-btn" data-id="${item.id}">VIEW TOURNAMENT</button>
                </div>
            </article>
        `).join("");
    }

    function renderMyMatches() {
        const matches = demoTournaments.filter(item =>
            joinedTournaments.has(item.id)
        );

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
                                <span>${item.category} MATCH</span>
                                <span class="my-match-status">● UPCOMING</span>
                            </div>
                            <h3>${item.name}</h3>
                            <div class="my-match-info">
                                <div><small>MAP</small><strong>${item.map}</strong></div>
                                <div><small>TIME</small><strong>${item.time}</strong></div>
                                <div><small>PLAYERS</small><strong>${item.players}/${item.capacity}</strong></div>
                            </div>
                            <button class="my-match-view" data-id="${item.id}">
                                VIEW DETAILS
                            </button>
                        </article>
                    `).join("")}
                </div>
            ` : `
                <div class="matches-empty">
                    <div class="empty-match-icon">🏆</div>
                    <h3>No Matches Joined Yet</h3>
                    <p>Join a tournament and it will appear here.</p>
                    <button id="exploreMatches">EXPLORE TOURNAMENTS</button>
                </div>
            `}
        `;
    }

    function showPage(page) {
        homeSections.forEach(section => {
            section.classList.toggle("hidden", page !== "home");
        });

        matchesPage.classList.toggle("hidden", page !== "matches");

        document.querySelectorAll(".nav-btn").forEach(button => {
            button.classList.toggle("active", button.dataset.page === page);
        });

        if (page === "matches") renderMyMatches();
    }

    function openDetails(id) {
        const item = demoTournaments.find(t => t.id === id);
        if (!item) return;

        const joined = joinedTournaments.has(id);
        const full = item.players >= item.capacity;

        modal.innerHTML = `
            <div class="details-box">
                <div class="details-header">
                    <span>TOURNAMENT DETAILS</span>
                    <button class="close-modal" id="closeModal">✕</button>
                </div>
                <div class="details-logo">R</div>
                <span class="details-tag">${item.category} MATCH</span>
                <h2>${item.name}</h2>
                <p class="details-subtitle">Your battle. Your glory.</p>

                <div class="details-grid">
                    <div class="details-item"><small>GAME MODE</small><strong>${item.category}</strong></div>
                    <div class="details-item"><small>MAP</small><strong>${item.map}</strong></div>
                    <div class="details-item"><small>MATCH TIME</small><strong>${item.time}</strong></div>
                    <div class="details-item"><small>ENTRY</small><strong>FREE</strong></div>
                    <div class="details-item"><small>PLAYERS</small><strong>${item.players}/${item.capacity}</strong></div>
                    <div class="details-item"><small>REWARD TYPE</small><strong>${item.prize}</strong></div>
                </div>

                <div class="slot-section">
                    <div class="slot-label">
                        <span>Available Slots</span>
                        <strong>${item.capacity - item.players}</strong>
                    </div>
                    <div class="slot-track">
                        <div class="slot-progress" style="width:${(item.players / item.capacity) * 100}%"></div>
                    </div>
                </div>

                <div class="players-section">
                    <h3>Joined Players</h3>
                    <p>${joined ? "✓ You have joined this demo tournament." : "No demo player joined yet."}</p>
                </div>

                <button class="details-join-btn" id="joinTournament"
                    ${joined || full ? "disabled" : ""}>
                    ${joined ? "✓ ALREADY JOINED" : full ? "SLOTS FULL" : "JOIN TOURNAMENT"}
                </button>

                <p class="demo-note">
                    Demo tournament • No cash entry • Demo Points have no cash value.
                </p>
            </div>
        `;

        modal.classList.remove("hidden");

        document.getElementById("closeModal").onclick = closeDetails;

        document.getElementById("joinTournament").onclick = () => {
            if (joinedTournaments.has(id) || item.players >= item.capacity) return;

            joinedTournaments.add(id);
            item.players++;

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify([...joinedTournaments])
            );

            renderTournaments(
                document.querySelector(".category-btn.active")?.dataset.category || "All"
            );

            openDetails(id);
            showJoinSuccess();
        };
    }

    function closeDetails() {
        modal.classList.add("hidden");
    }

    modal.addEventListener("click", event => {
        if (event.target === modal) closeDetails();
    });

    categoryList.addEventListener("click", event => {
        const button = event.target.closest(".category-btn");
        if (!button) return;

        document.querySelectorAll(".category-btn").forEach(btn =>
            btn.classList.remove("active")
        );

        button.classList.add("active");
        renderTournaments(button.dataset.category);
    });

    tournamentList.addEventListener("click", event => {
        const button = event.target.closest(".join-btn");
        if (button) openDetails(Number(button.dataset.id));
    });

    matchesPage.addEventListener("click", event => {
        const viewButton = event.target.closest(".my-match-view");
        if (viewButton) openDetails(Number(viewButton.dataset.id));

        if (event.target.closest("#exploreMatches")) {
            showPage("home");
        }
    });

    document.getElementById("walletBtn")?.addEventListener("click", () => {
        alert("Demo Points Wallet will be added in the next update.");
    });

    document.getElementById("notificationBtn")?.addEventListener("click", () => {
        alert("No new notifications.");
    });

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.addEventListener("click", () => {
            const page = button.dataset.page;
            if (page === "home" || page === "matches") showPage(page);
            else alert("This page is coming soon.");
        });
    });

    renderTournaments();
}
