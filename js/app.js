
import { initHomepage } from "./homepage.js";

const app = document.getElementById("app");
const loader = document.getElementById("app-loader");

async function startApp() {
    try {
        const response = await fetch("pages/home.html");

        if (!response.ok) {
            throw new Error("Homepage file could not load");
        }

        app.innerHTML = await response.text();

        initHomepage();

        loader.classList.add("hide");
        setTimeout(() => loader.remove(), 350);

    } catch (error) {
        console.error("App loading error:", error);

        app.innerHTML = `
            <div style="padding:30px;text-align:center;color:white">
                <h2>Unable to load Raavan eSports</h2>
                <p>Please check your project files.</p>
            </div>
        `;
    }
}

startApp();
