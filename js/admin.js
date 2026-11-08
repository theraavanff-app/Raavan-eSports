
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
    serverTimestamp,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =====================================
// ADMIN CONFIGURATION
// =====================================

const ADMIN_EMAIL = "the.raavanff@gmail.com";
const COIN_PACKAGES = [10, 20, 50, 100, 200, 500];

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

// WALLET ELEMENTS

const bonusForm = document.getElementById("bonusForm");
const bonusMessage = document.getElementById("bonusMessage");

const coinRequestsList =
    document.getElementById("coinRequestsList");
const withdrawalRequestsList =
    document.getElementById("withdrawalRequestsList");

const adminWalletHistory =
    document.getElementById("adminWalletHistory");

const refreshRequests =
    document.getElementById("refreshRequests");

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

function walletEscape(value) {
    return escapeHTML(value);
}

// =====================================
// ADMIN AUTHENTICATION
// =====================================

onAuthStateChanged(auth, async user => {

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

    const walletNote = document.querySelector(".wallet-admin-note");

    if (walletNote) {
        walletNote.textContent =
            "Virtual coins are platform credits. Withdrawals are manually paid by admin.";
    }

    await loadTournaments();
    await loadCardSettings();
    await loadBanners();
    await loadWalletManagement();
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

tournamentForm.addEventListener("submit", async e => {

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
        const matchDateTime =
    document.getElementById("tMatchDateTime").value;

if (!matchDateTime) {
    throw new Error("Please select match date and time.");
}

const matchTimestamp = new Date(matchDateTime);

if (Number.isNaN(matchTimestamp.getTime())) {
    throw new Error("Invalid match date and time.");
}

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
            matchDateTime: matchTimestamp,
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

        snapshot.forEach(item => {

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
// =====================================

tournamentList.addEventListener("click", async e => {

    if (!adminVerified) return;

    const viewButton = e.target.closest(".view-players");

    if (viewButton) {

        await loadJoinedPlayers(
            viewButton.dataset.id,
            viewButton.dataset.name
        );

        return;
    }

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

        const players = await Promise.all(
            joinSnapshot.docs.map(async joinDoc => {

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

        Object.keys(settings).forEach(key => {

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

cardSettingsForm.addEventListener("submit", async e => {

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

        fields.forEach(field => {

            const checkbox =
                cardSettingsForm.elements.namedItem(field);

            settings[field] = checkbox.checked;
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

bannerForm.addEventListener("submit", async e => {

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

        snapshot.forEach(item => {

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

bannerList.addEventListener("click", async e => {

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

// =====================================
// WALLET MANAGEMENT
// =====================================

async function loadWalletManagement() {

    if (!adminVerified) return;

    await Promise.all([
        loadCoinRequests(),
        loadWithdrawalRequests(),
        loadAdminWalletHistory()
    ]);
}

// =====================================
// LOAD COIN REQUESTS
// =====================================

async function loadCoinRequests() {

    if (!adminVerified) return;

    coinRequestsList.textContent = "Loading requests...";

    try {

        const snapshot = await getDocs(
            collection(db, "coinRequests")
        );

        if (snapshot.empty) {

            coinRequestsList.innerHTML =
                "<p>No coin requests found.</p>";

            return;
        }

        const requests = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        requests.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });

        coinRequestsList.innerHTML = "";

        requests.forEach(request => {

            const card = document.createElement("div");

            card.className = "wallet-request-item";

            const status = request.status || "pending";

            const amount = Number(request.amount || 0);
            const coins = Number(request.coins || 0);

            card.innerHTML = `
                <h4>Player UID: ${walletEscape(request.uid)}</h4>

                <p>
                    Payment:
                    <strong>₹${walletEscape(amount)}</strong>
                </p>

                <p>
                    Coins:
                    <strong>${walletEscape(coins)}</strong>
                </p>

                <p>
                    UTR:
                    <strong>${walletEscape(request.utr || "Missing")}</strong>
                </p>

                <p>
                    Status:
                    <strong>${walletEscape(status.toUpperCase())}</strong>
                </p>

                <p>
                    Request ID:
                    <small>${walletEscape(request.id)}</small>
                </p>

                ${
                    status === "pending"
                    ? `
                        <div class="wallet-request-actions">

                            <button
                                class="approve-coin-request"
                                data-id="${walletEscape(request.id)}">
                                APPROVE
                            </button>

                            <button
                                class="reject-coin-request"
                                data-id="${walletEscape(request.id)}">
                                REJECT
                            </button>

                        </div>
                    `
                    : ""
                }
            `;

            coinRequestsList.appendChild(card);
        });

    } catch (error) {

        console.error("Coin requests error:", error);

        coinRequestsList.textContent =
            "Unable to load requests: " + error.message;
    }
}

// =====================================
// LOAD WITHDRAWAL REQUESTS
// =====================================

async function loadWithdrawalRequests() {

    if (!adminVerified) return;

    withdrawalRequestsList.textContent =
        "Loading withdrawal requests...";

    try {

        const snapshot = await getDocs(
            collection(db, "withdrawalRequests")
        );

        if (snapshot.empty) {
            withdrawalRequestsList.innerHTML =
                "<p>No withdrawal requests found.</p>";
            return;
        }

        const requests = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        requests.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });

        withdrawalRequestsList.innerHTML = "";

        requests.forEach(request => {

            const card = document.createElement("div");
            card.className = "wallet-request-item";

            const status = request.status || "pending";
            const coins = Number(request.coins || 0);
            const method = request.method || "";

            let payoutDetails = "";

            if (method === "upi") {

                payoutDetails = `
                    <p>UPI ID:
                        <strong>${walletEscape(request.upiId)}</strong>
                    </p>
                `;

            } else if (method === "bank") {

                payoutDetails = `
                    <p>Account Holder:
                        <strong>${walletEscape(request.accountHolder)}</strong>
                    </p>

                    <p>Account Number:
                        <strong>${walletEscape(request.accountNumber)}</strong>
                    </p>

                    <p>IFSC:
                        <strong>${walletEscape(request.ifsc)}</strong>
                    </p>

                    <p>Bank:
                        <strong>${walletEscape(request.bankName)}</strong>
                    </p>
                `;

            }

            const date = request.createdAt?.toDate?.()
                ?.toLocaleString("en-IN") || "Not available";

            card.innerHTML = `
                <h4>Player UID: ${walletEscape(request.uid)}</h4>

                <p>Withdrawal:
                    <strong>${walletEscape(coins)} Coins (₹${walletEscape(request.amountRupees)})</strong>
                </p>

                <p>Method:
                    <strong>${walletEscape(method.toUpperCase())}</strong>
                </p>

                ${payoutDetails}

                <p>Date:
                    ${walletEscape(date)}
                </p>

                <p>Status:
                    <strong>${walletEscape(status.toUpperCase())}</strong>
                </p>

                <p>Request ID:
                    <small>${walletEscape(request.id)}</small>
                </p>

                ${
                    status === "pending"
                    ? `
                        <div class="wallet-request-actions">

                            <button
                                class="pay-withdrawal-request"
                                data-id="${walletEscape(request.id)}">
                                MARK PAID
                            </button>

                            <button
                                class="reject-withdrawal-request"
                                data-id="${walletEscape(request.id)}">
                                REJECT
                            </button>

                        </div>
                    `
                    : ""
                }
            `;

            withdrawalRequestsList.appendChild(card);

        });

    } catch (error) {

        console.error("Withdrawal requests error:", error);

        withdrawalRequestsList.textContent =
            "Unable to load withdrawals: " + error.message;
    }
}

 // =====================================
 // PROCESS WITHDRAWAL REQUESTS
 // =====================================

withdrawalRequestsList.addEventListener("click", async e => {

    if (!adminVerified) return;

    const paidButton =
        e.target.closest(".pay-withdrawal-request");

    const rejectButton =
        e.target.closest(".reject-withdrawal-request");

    const button = paidButton || rejectButton;

    if (!button || button.disabled) return;

    const requestId = button.dataset.id;
    const isPaid = Boolean(paidButton);

    if (isPaid) {

        if (!confirm(
            "Have you actually sent the payment to the player's UPI or bank account?"
        )) return;

    } else {

        if (!confirm(
            "Reject this withdrawal? The player's coins will be refunded automatically."
        )) return;

    }

    let payoutReference = "";

    if (isPaid) {

        payoutReference = prompt(
            "Enter the actual UPI UTR / bank payment reference:"
        );

        if (payoutReference === null) return;

        payoutReference = payoutReference.trim();

        if (
            payoutReference.length < 4 ||
            payoutReference.length > 80
        ) {
            alert("Reference must be 4 to 80 characters.");
            return;
        }
    }

    button.disabled = true;

    try {

        const requestRef = doc(
            db,
            "withdrawalRequests",
            requestId
        );

        await runTransaction(db, async transaction => {

            const requestSnap =
                await transaction.get(requestRef);

            if (!requestSnap.exists()) {
                throw new Error("Withdrawal request not found.");
            }

            const request = requestSnap.data();

            if (request.status !== "pending") {
                throw new Error(
                    "This withdrawal is already processed."
                );
            }

            const uid = request.uid;
            const coins = Number(request.coins);

            if (
                !uid ||
                !Number.isSafeInteger(coins) ||
                coins < 10 ||
                Number(request.amountRupees) !== coins
            ) {
                throw new Error("Invalid withdrawal details.");
            }

            const historyId = isPaid
                ? "withdrawal_paid_" + requestId
                : "withdrawal_refund_" + requestId;

            const historyRef = doc(
                db,
                "walletTransactions",
                historyId
            );

            const historySnap =
                await transaction.get(historyRef);

            if (historySnap.exists()) {
                throw new Error(
                    "Transaction history already exists."
                );
            }

            if (isPaid) {

                transaction.update(requestRef, {
                    status: "paid",
                    processedAt: serverTimestamp(),
                    processedBy: auth.currentUser.uid,
                    payoutReference: payoutReference
                });

                transaction.set(historyRef, {
                    uid: uid,
                    amount: coins,
                    type: "withdrawal_paid",
                    description: "Withdrawal paid • Reference: " + payoutReference,
                    requestId: requestId,
                    createdAt: serverTimestamp()
                });

            } else {

                const walletRef = doc(db, "wallets", uid);

                const walletSnap =
                    await transaction.get(walletRef);

                if (!walletSnap.exists()) {
                    throw new Error("Player wallet not found.");
                }

                const currentBalance =
                    Number(walletSnap.data().balance);

                if (
                    !Number.isSafeInteger(currentBalance) ||
                    currentBalance < 0 ||
                    currentBalance + coins > 1000000000
                ) {
                    throw new Error("Invalid wallet balance.");
                }

                transaction.update(walletRef, {
                    balance: currentBalance + coins,
                    updatedAt: serverTimestamp()
                });

                transaction.update(requestRef, {
                    status: "rejected",
                    processedAt: serverTimestamp(),
                    processedBy: auth.currentUser.uid
                });

                transaction.set(historyRef, {
                    uid: uid,
                    amount: coins,
                    type: "withdrawal_refund",
                    description: "Withdrawal rejected • Coins refunded",
                    requestId: requestId,
                    createdAt: serverTimestamp()
                });

            }

        });

        alert(
            isPaid
            ? "Withdrawal marked as PAID successfully."
            : "Withdrawal rejected. Coins refunded successfully."
        );

        await loadWalletManagement();

    } catch (error) {

        console.error("Withdrawal processing error:", error);

        alert(error.message || "Withdrawal processing failed.");

        button.disabled = false;
    }

});
        
// =====================================
// APPROVE / REJECT UPI REQUEST
// =====================================

coinRequestsList.addEventListener("click", async e => {

    if (!adminVerified) return;

    const approveButton =
        e.target.closest(".approve-coin-request");

    const rejectButton =
        e.target.closest(".reject-coin-request");

    const button = approveButton || rejectButton;

    if (!button) return;

    const requestId = button.dataset.id;
    const approve = Boolean(approveButton);

    if (button.disabled) return;

    if (!confirm(
        approve
        ? "Have you verified this UPI payment in your bank/UPI app? Approve and credit coins?"
        : "Are you sure you want to reject this payment request?"
    )) {
        return;
    }

    button.disabled = true;

    try {

        const requestRef = doc(db, "coinRequests", requestId);

        await runTransaction(db, async transaction => {

            // READ REQUEST FIRST

            const requestSnap =
                await transaction.get(requestRef);

            if (!requestSnap.exists()) {
                throw new Error("Payment request not found.");
            }

            const request = requestSnap.data();

            if (request.status !== "pending") {
                throw new Error(
                    "This request has already been processed."
                );
            }

            const amount = Number(request.amount);
            const coins = Number(request.coins);
            const uid = request.uid;
            const utr = String(request.utr || "").trim().toUpperCase();

            if (
                !uid ||
                !COIN_PACKAGES.includes(amount) ||
                coins !== amount ||
                !/^[A-Z0-9]{8,20}$/.test(utr)
            ) {
                throw new Error("Invalid payment request details.");
            }

            // READ UTR CLAIM

            const claimRef = doc(db, "utrClaims", utr);

            const claimSnap =
                await transaction.get(claimRef);

            if (!claimSnap.exists()) {
                throw new Error("UTR claim not found. Cannot process.");
            }

            const claim = claimSnap.data();

            if (
                claim.uid !== uid ||
                claim.requestId !== requestId ||
                claim.status !== "pending"
            ) {
                throw new Error(
                    "UTR claim does not match this request."
                );
            }

            // REJECT REQUEST

            if (!approve) {

                transaction.update(requestRef, {
                    status: "rejected",
                    processedAt: serverTimestamp(),
                    processedBy: auth.currentUser.uid
                });

                transaction.update(claimRef, {
                    status: "rejected",
                    processedAt: serverTimestamp()
                });

                return;
            }

            // READ WALLET

            const walletRef = doc(db, "wallets", uid);

            const walletSnap =
                await transaction.get(walletRef);

            const currentBalance = walletSnap.exists()
                ? Number(walletSnap.data().balance || 0)
                : 0;

            if (
                !Number.isSafeInteger(currentBalance) ||
                currentBalance < 0 ||
                currentBalance + coins > 1000000000
            ) {
                throw new Error("Invalid wallet balance.");
            }

            // DETERMINISTIC TRANSACTION ID
            // ONE REQUEST = ONE CREDIT RECORD

            const historyRef = doc(
                db,
                "walletTransactions",
                "deposit_" + requestId
            );

            const historySnap =
                await transaction.get(historyRef);

            if (historySnap.exists()) {
                throw new Error(
                    "A transaction already exists for this request."
                );
            }

            // CREDIT WALLET

            transaction.set(walletRef, {
                uid: uid,
                balance: currentBalance + coins,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // UPDATE REQUEST

            transaction.update(requestRef, {
                status: "approved",
                processedAt: serverTimestamp(),
                processedBy: auth.currentUser.uid
            });

            // UPDATE UTR CLAIM

            transaction.update(claimRef, {
                status: "approved",
                processedAt: serverTimestamp()
            });

            // CREATE TRANSACTION HISTORY

            transaction.set(historyRef, {
                uid: uid,
                amount: coins,
                type: "deposit_approved",
                description: "UPI coin package approved - ₹" + amount,
                requestId: requestId,
                createdAt: serverTimestamp()
            });

        });

        alert(
            approve
            ? "Payment approved! Coins credited successfully."
            : "Payment request rejected successfully."
        );

        await loadWalletManagement();

    } catch (error) {

        console.error("Payment processing error:", error);

        alert(error.message || "Payment processing failed.");

        button.disabled = false;
    }
});

// =====================================
// ADMIN BONUS COINS
// =====================================

bonusForm.addEventListener("submit", async e => {

    e.preventDefault();

    if (!adminVerified) return;

    const uid =
        document.getElementById("bonusUid").value.trim();

    const amount =
        Number(document.getElementById("bonusAmount").value);

    const note =
        document.getElementById("bonusNote").value.trim();

    if (
        !uid ||
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 100000
    ) {
        bonusMessage.textContent =
            "Enter a valid UID and coin amount.";

        return;
    }

    bonusMessage.textContent = "Adding bonus coins...";

    try {

        const userSnap = await getDoc(doc(db, "users", uid));

        if (!userSnap.exists()) {
            throw new Error(
                "Player profile not found. Check the UID."
            );
        }

        await runTransaction(db, async transaction => {

            const walletRef = doc(db, "wallets", uid);

            const walletSnap =
                await transaction.get(walletRef);

            const currentBalance = walletSnap.exists()
                ? Number(walletSnap.data().balance || 0)
                : 0;

            if (
                !Number.isSafeInteger(currentBalance) ||
                currentBalance < 0 ||
                currentBalance + amount > 1000000000
            ) {
                throw new Error("Invalid wallet balance.");
            }

            const historyRef = doc(
                collection(db, "walletTransactions")
            );

            transaction.set(walletRef, {
                uid: uid,
                balance: currentBalance + amount,
                updatedAt: serverTimestamp()
            }, { merge: true });

            transaction.set(historyRef, {
                uid: uid,
                amount: amount,
                type: "admin_bonus",
                description: note || "Admin bonus coins",
                createdAt: serverTimestamp()
            });

        });

        bonusForm.reset();

        bonusMessage.textContent =
            "Bonus coins added successfully!";

        await loadAdminWalletHistory();

    } catch (error) {

        console.error("Bonus error:", error);

        bonusMessage.textContent =
            error.message || "Unable to add bonus.";
    }
});

// =====================================
// ADMIN WALLET HISTORY
// =====================================

async function loadAdminWalletHistory() {

    if (!adminVerified) return;

    adminWalletHistory.textContent = "Loading history...";

    try {

        const snapshot = await getDocs(
            collection(db, "walletTransactions")
        );

        if (snapshot.empty) {

            adminWalletHistory.innerHTML =
                "<p>No wallet transactions yet.</p>";

            return;
        }

        const records = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        records.sort((a, b) => {

            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;

            return bTime - aTime;
        });

        adminWalletHistory.innerHTML = "";

        records.slice(0, 30).forEach(record => {

            const item = document.createElement("div");

            item.className = "wallet-history-item";

            item.innerHTML = `
                <strong>${walletEscape(record.type)}</strong>

                <p>
                    Player:
                    ${walletEscape(record.uid)}
                </p>

                <p>
    Coins:
    ${record.type === "withdrawal_paid" ? "-" : "+"}${walletEscape(record.amount)}
</p>

                <small>
                    ${walletEscape(record.description || "")}
                </small>
            `;

            adminWalletHistory.appendChild(item);
        });

    } catch (error) {

        console.error("Wallet history error:", error);

        adminWalletHistory.textContent =
            "Unable to load history: " + error.message;
    }
}

// =====================================
// REFRESH WALLET REQUESTS
// =====================================

refreshRequests.addEventListener("click", async () => {

    if (!adminVerified) return;

    refreshRequests.disabled = true;

    try {
        await loadWalletManagement();
    } finally {
        refreshRequests.disabled = false;
    }
});
