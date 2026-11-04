
const demoTournaments = [
    {
        id: 1,
        name: "Solo Battle Challenge",
        category: "Solo",
        map: "Bermuda",
        time: "6:00 PM",
        players: "12 / 48",
        prize: "Demo Points"
    },
    {
        id: 2,
        name: "Squad Warrior Cup",
        category: "Squad",
        map: "Bermuda",
        time: "7:00 PM",
        players: "8 / 48",
        prize: "Demo Points"
    },
    {
        id: 3,
        name: "Clash Squad Arena",
        category: "CS",
        map: "Random",
        time: "8:00 PM",
        players: "4 / 16",
        prize: "Demo Points"
    },
    {
        id: 4,
        name: "Duo Survival Match",
        category: "Duo",
        map: "Purgatory",
        time: "9:00 PM",
        players: "6 / 24",
        prize: "Demo Points"
    }
];

export function initHomepage() {
    const tournamentList =
        document.getElementById("tournamentList");

    const categoryList =
        document.getElementById("categoryList");

    if (!tournamentList || !categoryList) return;

    function renderTournaments(category = "All") {
        const filtered = category === "All"
            ? demoTournaments
            : demoTournaments.filter(
                item => item.category === category
            );

        if (filtered.length === 0) {
            tournamentList.innerHTML =
                `<div class="empty-state">
                    No tournaments available.
                </div>`;
            return;
        }

        tournamentList.innerHTML = filtered.map(item => `
            <article class="tournament-card">
                <div class="tournament-top">
                    <span class="tournament-type">
                        ${item.category} MATCH
                    </span>
                    <span class="match-status">
                        ● Upcoming
                    </span>
                </div>

                <h4>${item.name}</h4>

                <div class="tournament-info">
                    <div class="info-box">
                        <small>MAP</small>
                        <strong>${item.map}</strong>
                    </div>

                    <div class="info-box">
                        <small>TIME</small>
                        <strong>${item.time}</strong>
                    </div>

                    <div class="info-box">
                        <small>PLAYERS</small>
                        <strong>${item.players}</strong>
                    </div>
                </div>

                <div class="join-row">
                    <button class="join-btn"
                        data-id="${item.id}">
                        VIEW TOURNAMENT
                    </button>
                </div>
            </article>
        `).join("");
    }

    categoryList.addEventListener("click", event => {
        const button = event.target.closest(
            ".category-btn"
        );

        if (!button) return;

        document.querySelectorAll(".category-btn")
            .forEach(btn => btn.classList.remove("active"));

        button.classList.add("active");

        renderTournaments(button.dataset.category);
    });

    tournamentList.addEventListener("click", event => {
        const button = event.target.closest(".join-btn");

        if (!button) return;

        const tournament = demoTournaments.find(
            item => item.id === Number(button.dataset.id)
        );

        if (tournament) {
            alert(
                tournament.name +
                "\n\nTournament details and secure joining " +
                "will be connected in the next development step."
            );
        }
    });

    document.getElementById("walletBtn")
        ?.addEventListener("click", () => {
            alert("Wallet page is coming in the next step.");
        });

    document.getElementById("notificationBtn")
        ?.addEventListener("click", () => {
            alert("No new notifications.");
        });

    document.querySelectorAll(".nav-btn")
        .forEach(button => {
            button.addEventListener("click", () => {
                const page = button.dataset.page;

                if (page !== "home") {
                    alert(page + " page is coming soon.");
                    return;
                }

                document.querySelectorAll(".nav-btn")
                    .forEach(btn =>
                        btn.classList.remove("active")
                    );

                button.classList.add("active");
            });
        });

    renderTournaments();
}
