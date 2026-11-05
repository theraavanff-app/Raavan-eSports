
const demoTournaments = [
    {
        id: 1,
        name: "Solo Battle Challenge",
        category: "Solo",
        map: "Bermuda",
        time: "6:00 PM",
        players: 12,
        capacity: 48,
        prize: "Demo Points"
    },
    {
        id: 2,
        name: "Squad Warrior Cup",
        category: "Squad",
        map: "Bermuda",
        time: "7:00 PM",
        players: 8,
        capacity: 48,
        prize: "Demo Points"
    },
    {
        id: 3,
        name: "Clash Squad Arena",
        category: "CS",
        map: "Random",
        time: "8:00 PM",
        players: 4,
        capacity: 16,
        prize: "Demo Points"
    },
    {
        id: 4,
        name: "Duo Survival Match",
        category: "Duo",
        map: "Purgatory",
        time: "9:00 PM",
        players: 6,
        capacity: 24,
        prize: "Demo Points"
    }
];

const joinedTournaments = new Set();

export function initHomepage() {
    const tournamentList = document.getElementById("tournamentList");
    const categoryList = document.getElementById("categoryList");

    if (!tournamentList || !categoryList) return;

    // Create tournament details popup
    const modal = document.createElement("div");
    
// Success animation element
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

    modal.id = "tournamentModal";
    modal.className = "tournament-modal hidden";
    document.body.appendChild(modal);

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
                    <div class="info-box">
                        <small>MAP</small><strong>${item.map}</strong>
                    </div>
                    <div class="info-box">
                        <small>TIME</small><strong>${item.time}</strong>
                    </div>
                    <div class="info-box">
                        <small>PLAYERS</small>
                        <strong>${item.players} / ${item.capacity}</strong>
                    </div>
                </div>
                <div class="join-row">
                    <button class="join-btn" data-id="${item.id}">
                        VIEW TOURNAMENT
                    </button>
                </div>
            </article>
        `).join("");
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
                <p class="details-subtitle">
                    Your battle. Your glory.
                </p>

                <div class="details-grid">
                    <div class="details-item">
                        <small>GAME MODE</small>
                        <strong>${item.category}</strong>
                    </div>
                    <div class="details-item">
                        <small>MAP</small>
                        <strong>${item.map}</strong>
                    </div>
                    <div class="details-item">
                        <small>MATCH TIME</small>
                        <strong>${item.time}</strong>
                    </div>
                    <div class="details-item">
                        <small>ENTRY</small>
                        <strong>FREE</strong>
                    </div>
                    <div class="details-item">
                        <small>PLAYERS</small>
                        <strong>${item.players}/${item.capacity}</strong>
                    </div>
                    <div class="details-item">
                        <small>REWARD TYPE</small>
                        <strong>${item.prize}</strong>
                    </div>
                </div>

                <div class="slot-section">
                    <div class="slot-label">
                        <span>Available Slots</span>
                        <strong>${item.capacity - item.players}</strong>
                    </div>
                    <div class="slot-track">
                        <div class="slot-progress"
                            style="width:${(item.players / item.capacity) * 100}%">
                        </div>
                    </div>
                </div>

                <div class="players-section">
                    <h3>Joined Players</h3>
                    <p>${joined ? "✓ You have joined this tournament." : "No demo player joined yet."}</p>
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
    if (joined || item.players >= item.capacity) return;

    joinedTournaments.add(id);
    item.players++;

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
        if (!button) return;

        openDetails(Number(button.dataset.id));
    });

    document.getElementById("walletBtn")?.addEventListener("click", () =>
        alert("Demo Points Wallet will be added in the next update.")
    );

    document.getElementById("notificationBtn")?.addEventListener("click", () =>
        alert("No new notifications.")
    );

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.addEventListener("click", () => {
            const page = button.dataset.page;

            if (page !== "home") {
                alert(page + " page is coming soon.");
                return;
            }

            document.querySelectorAll(".nav-btn").forEach(btn =>
                btn.classList.remove("active")
            );

            button.classList.add("active");
        });
    });

    renderTournaments();
}
