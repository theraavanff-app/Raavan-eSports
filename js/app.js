
import { initHomepage } from "./homepage.js";
import { initAuthPage } from "./auth.js";
import { auth } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const app = document.getElementById("app");
const loader = document.getElementById("app-loader");

let currentPage = "";

async function loadPage(page) {
    if (page === "home" && !auth.currentUser) {
        page = "login";
    }

    if (page === currentPage) return;

    const files = {
        login: "pages/login.html",
        register: "pages/register.html",
        home: "pages/home.html"
    };

    try {
        const response = await fetch(files[page]);

        if (!response.ok) {
            throw new Error("Page could not load: " + page);
        }

        app.innerHTML = await response.text();
        currentPage = page;

        if (page === "home") {
            initHomepage();
        } else {
            initAuthPage();
        }

    } catch (error) {
        console.error(error);
        app.innerHTML = `
            <div style="padding:30px;text-align:center;color:white">
                <h2>Unable to load page</h2>
                <p>Please check your project files.</p>
            </div>
        `;
    }
}

// Login/Register page navigation
document.addEventListener("click", (event) => {
    const link = event.target.closest("a");

    if (!link) return;

    const href = link.getAttribute("href");

    if (href === "pages/login.html" || href === "pages/register.html") {
        event.preventDefault();

        const page = href.includes("register") ? "register" : "login";
        loadPage(page);
    }
});

// Firebase login status
onAuthStateChanged(auth, async (user) => {
    await loadPage(user ? "home" : "login");

    if (loader) {
        loader.classList.add("hide");
        setTimeout(() => loader.remove(), 350);
    }
});
