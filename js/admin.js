
import app, { auth, db } from "./firebase.js";

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
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

// Existing Firebase admin account
const ADMIN_EMAIL = "the.raavanff@gmail.com";

const storage = getStorage(app);

const $ = (id) => document.getElementById(id);

let adminReady = false;

// AUTH CHECK
onAuthStateChanged(auth, async (user) => {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
        alert("Admin account required. Please login with the authorized Firebase account.");
        window.location.href = "./login.html";
        return;
    }

    adminReady = true;

    await loadTournaments();
    await loadSettings();
    await loadBanners();
});

// LOGOUT
$("adminLogout").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "./login.html";
});

// ADD TOURNAMENT
$("tournamentForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!adminReady) return;

    const button = $("addTournamentBtn");
    const message = $("tournamentMessage");

    const capacity = Number($("tCapacity").value);
    const players = Number($("tPlayers").value);

    if (capacity < 1 || players < 0 || players > capacity) {
        message.textContent = "Please check player count and capacity.";
        return;
    }

    const tournament = {
        name: $("tName").value.trim(),
        category: $("tCategory").value,
        prizePool: Number($("tPrize").value || 0),
        perKillReward: Number($("tPerKill").value || 0),
        booyahPrize: Number($("tBooyah").value || 0),
        entryFees: Number($("tEntry").value || 0),
        map: $("tMap").value.trim(),
        time: $("tTime").value.trim(),
        players,
        capacity,
        isActive: true,
        createdAt: serverTimestamp()
    };

    if (!tournament.name || !tournament.category ||
        !tournament.map || !tournament.time) {
        message.textContent = "Please fill all required fields.";
        return;
    }

    button.disabled = true;
    button.textContent = "ADDING...";

    try {
        await addDoc(collection(db, "tournaments"), tournament);

        $("tournamentForm").reset();
        $("tPlayers").value = 0;
        $("tCapacity").value = 48;

        message.textContent = "Tournament added successfully!";
        await loadTournaments();

    } catch (error) {
        console.error(error);
        message.textContent = "Could not add tournament: " + error.message;
    }

    button.disabled = false;
    button.textContent = "+ ADD TOURNAMENT";
});

// LOAD TOURNAMENTS
async function loadTournaments() {
    if (!adminReady) return;

    const list = $("tournamentList");
    list.textContent = "Loading...";

    try {
        const snapshot = await getDocs(collection(db, "tournaments"));
        list.replaceChildren();

        if (snapshot.empty) {
            list.textContent = "No tournaments added yet.";
            return;
        }

        snapshot.forEach((item) => {
            const data = item.data();

            const row = document.createElement("div");
            row.className = "admin-item";

            const info = document.createElement("div");

            const title = document.createElement("strong");
            title.textContent = data.name || "Untitled Tournament";

            const details = document.createElement("small");
            details.textContent =
                `${data.category || ""} • ${data.map || ""} • ${data.players || 0}/${data.capacity || 0}`;

            info.append(title, details);

            const remove = document.createElement("button");
            remove.className = "delete-btn";
            remove.textContent = "DELETE";

            remove.addEventListener("click", async () => {
                if (!confirm(`Delete "${data.name}"?`)) return;

                try {
                    await deleteDoc(doc(db, "tournaments", item.id));
                    await loadTournaments();
                } catch (error) {
                    alert("Delete failed: " + error.message);
                }
            });

            row.append(info, remove);
            list.appendChild(row);
        });

    } catch (error) {
        console.error(error);
        list.textContent = "Unable to load tournaments: " + error.message;
    }
}

// LOAD CARD DISPLAY SETTINGS
async function loadSettings() {
    if (!adminReady) return;

    try {
        const settingsRef = doc(db, "appSettings", "cardFields");
        const snapshot = await getDoc(settingsRef);

        if (snapshot.exists()) {
            const settings = snapshot.data();

            document.querySelectorAll("[data-field]").forEach((input) => {
                const field = input.dataset.field;

                if (typeof settings[field] === "boolean") {
                    input.checked = settings[field];
                }
            });
        }
    } catch (error) {
        console.error("Settings load error:", error);
        $("settingsMessage").textContent = error.message;
    }
}

// SAVE CARD DISPLAY SETTINGS
$("saveDisplaySettings").addEventListener("click", async () => {
    if (!adminReady) return;

    const settings = {};

    document.querySelectorAll("[data-field]").forEach((input) => {
        settings[input.dataset.field] = input.checked;
    });

    try {
        await setDoc(
            doc(db, "appSettings", "cardFields"),
            settings,
            { merge: true }
        );

        $("settingsMessage").textContent = "Display settings saved!";
    } catch (error) {
        $("settingsMessage").textContent =
            "Save failed: " + error.message;
    }
});

// UPLOAD BANNER
$("bannerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!adminReady) return;

    const file = $("bannerImage").files[0];
    const message = $("bannerMessage");
    const button = $("uploadBannerBtn");

    if (!file) {
        message.textContent = "Please select an image.";
        return;
    }

    if (!file.type.startsWith("image/")) {
        message.textContent = "Only image files are allowed.";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        message.textContent = "Image must be smaller than 5 MB.";
        return;
    }

    button.disabled = true;
    button.textContent = "UPLOADING...";

    try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `banners/${Date.now()}-${safeName}`;
        const imageRef = ref(storage, storagePath);

        await uploadBytes(imageRef, file, {
            contentType: file.type
        });

        const imageUrl = await getDownloadURL(imageRef);

        await addDoc(collection(db, "banners"), {
            imageUrl,
            storagePath,
            createdAt: serverTimestamp()
        });

        $("bannerForm").reset();
        message.textContent = "Banner uploaded successfully!";

        await loadBanners();

    } catch (error) {
        console.error(error);
        message.textContent = "Upload failed: " + error.message;
    }

    button.disabled = false;
    button.textContent = "UPLOAD BANNER";
});

// LOAD BANNERS
async function loadBanners() {
    if (!adminReady) return;

    const list = $("bannerList");
    list.textContent = "Loading banners...";

    try {
        const snapshot = await getDocs(collection(db, "banners"));
        list.replaceChildren();

        if (snapshot.empty) {
            list.textContent = "No banners uploaded yet.";
            return;
        }

        snapshot.forEach((item) => {
            const data = item.data();

            const row = document.createElement("div");
            row.className = "banner-admin-item";

            const image = document.createElement("img");
            image.src = data.imageUrl;
            image.alt = "Tournament banner";

            const remove = document.createElement("button");
            remove.className = "delete-btn";
            remove.textContent = "DELETE";

            remove.addEventListener("click", async () => {
                if (!confirm("Delete this banner?")) return;

                try {
                    if (data.storagePath) {
                        try {
                            await deleteObject(ref(storage, data.storagePath));
                        } catch (storageError) {
                            console.warn("Storage file removal:", storageError);
                        }
                    }

                    await deleteDoc(doc(db, "banners", item.id));
                    await loadBanners();

                } catch (error) {
                    alert("Banner delete failed: " + error.message);
                }
            });

            row.append(image, remove);
            list.appendChild(row);
        });

    } catch (error) {
        console.error(error);
        list.textContent = "Unable to load banners: " + error.message;
    }
}
