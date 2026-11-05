
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

export function initAuthPage() {

    // LOGIN
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
            } catch (error) {
                errorBox.textContent = error.message;
                button.disabled = false;
                button.textContent = "LOGIN";
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
                    name: name,
                    email: result.user.email,
                    playerId: playerId,
                    createdAt: serverTimestamp()
                });

            } catch (error) {
                console.error("Registration error:", error);
                errorBox.textContent = error.message;
                button.disabled = false;
                button.textContent = "CREATE ACCOUNT";
            }
        });
    }
                    }
