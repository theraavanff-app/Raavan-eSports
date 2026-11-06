
import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_ID = "devloper gautam";
const ADMIN_EMAIL = "the.raavanff@gmail.com";

export function initAuthPage() {

    // NORMAL LOGIN
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("loginEmail").value.trim();
            const password = document.getElementById("loginPassword").value;
            const errorBox = document.getElementById("loginError");
            const button = document.getElementById("loginBtn");

            errorBox.textContent = "";
            button.disabled = true;
            button.textContent = "PLEASE WAIT...";

            try {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = "./home.html";

            } catch (error) {
                errorBox.textContent = error.message;
                button.disabled = false;
                button.textContent = "LOGIN";
            }
        });

        // AUTHORIZED LOGIN BUTTON
        const adminButton = document.createElement("button");

        adminButton.type = "button";
        adminButton.textContent = "AUTHORIZED LOGIN";

        adminButton.style.cssText = `
            display:block;
            margin:18px auto 0;
            padding:9px 17px;
            background:transparent;
            color:#f5bd45;
            border:1px solid #f5bd45;
            border-radius:20px;
            font-size:11px;
            font-weight:bold;
            letter-spacing:1px;
            cursor:pointer;
        `;

        loginForm.insertAdjacentElement("afterend", adminButton);

        // ADMIN POPUP
        const popup = document.createElement("div");

        popup.style.cssText = `
            display:none;
            position:fixed;
            inset:0;
            background:rgba(0,0,0,.85);
            z-index:9999;
            align-items:center;
            justify-content:center;
            padding:20px;
        `;

        popup.innerHTML = `
            <div style="
                background:#14141b;
                border:1px solid #ed202b;
                border-radius:15px;
                padding:24px;
                width:100%;
                max-width:330px;
                color:white;
                font-family:Arial;
            ">
                <h3 style="text-align:center;color:#f5bd45;margin-top:0">
                    ADMIN ACCESS
                </h3>

                <input id="adminID"
                    placeholder="Admin ID"
                    autocomplete="off"
                    style="width:100%;box-sizing:border-box;padding:13px;margin:8px 0;background:#09090d;color:white;border:1px solid #333;border-radius:8px">

                <input id="adminPassword"
                    type="password"
                    placeholder="Firebase Admin Password"
                    autocomplete="current-password"
                    style="width:100%;box-sizing:border-box;padding:13px;margin:8px 0;background:#09090d;color:white;border:1px solid #333;border-radius:8px">

                <p id="adminError" style="color:#ff5555;font-size:12px;text-align:center"></p>

                <button id="adminSubmit"
                    style="width:100%;padding:13px;background:#ed202b;color:white;border:0;border-radius:8px;font-weight:bold">
                    ENTER ADMIN PANEL
                </button>

                <button id="adminClose"
                    style="width:100%;padding:10px;margin-top:9px;background:#292933;color:white;border:0;border-radius:8px">
                    CANCEL
                </button>
            </div>
        `;

        document.body.appendChild(popup);

        adminButton.addEventListener("click", () => {
            popup.style.display = "flex";
        });

        document.getElementById("adminClose").addEventListener("click", () => {
            popup.style.display = "none";
        });

        document.getElementById("adminSubmit").addEventListener("click", async () => {

            const id = document.getElementById("adminID").value.trim();
            const password = document.getElementById("adminPassword").value;
            const error = document.getElementById("adminError");
            const submitButton = document.getElementById("adminSubmit");

            error.textContent = "";

            if (id !== ADMIN_ID) {
                error.textContent = "Incorrect Admin ID!";
                return;
            }

            if (!password) {
                error.textContent = "Enter Firebase Admin Password!";
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "VERIFYING...";

            try {
                const result = await signInWithEmailAndPassword(
                    auth,
                    ADMIN_EMAIL,
                    password
                );

                if (result.user.email !== ADMIN_EMAIL) {
                    throw new Error("Admin account verification failed.");
                }

                window.location.href = "./admin.html";

            } catch (error) {
                console.error("Admin login error:", error);

                error.textContent =
                    error.code === "auth/invalid-credential"
                    ? "Wrong Firebase Admin Password!"
                    : error.message;

                submitButton.disabled = false;
                submitButton.textContent = "ENTER ADMIN PANEL";
            }
        });
    }

    // REGISTER
    const registerForm = document.getElementById("registerForm");

    if (registerForm) {

        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("registerName").value.trim();
            const email = document.getElementById("registerEmail").value.trim();
            const password = document.getElementById("registerPassword").value;
            const confirm = document.getElementById("confirmPassword").value;

            const errorBox = document.getElementById("registerError");
            const button = document.getElementById("registerBtn");

            errorBox.textContent = "";

            if (!name) {
                errorBox.textContent = "Please enter your player name.";
                return;
            }

            if (password !== confirm) {
                errorBox.textContent = "Passwords do not match!";
                return;
            }

            button.disabled = true;
            button.textContent = "CREATING ACCOUNT...";

            try {
                const result = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

                await updateProfile(result.user, {
                    displayName: name
                });

                const playerId = "RAAVAN-" +
                    result.user.uid.slice(0, 8).toUpperCase();

                await setDoc(doc(db, "users", result.user.uid), {
                    uid: result.user.uid,
                    name,
                    email: result.user.email,
                    playerId,
                    createdAt: serverTimestamp()
                });

                window.location.href = "./home.html";

            } catch (error) {
                console.error("Registration error:", error);
                errorBox.textContent = error.message;
                button.disabled = false;
                button.textContent = "CREATE ACCOUNT";
            }
        });
    }
        }
