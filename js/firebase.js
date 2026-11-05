
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB7_fei6oziLaLS14EBBctFNQ1lqd7NaQo",
    authDomain: "raavan-esports-52ef5.firebaseapp.com",
    projectId: "raavan-esports-52ef5",
    storageBucket: "raavan-esports-52ef5.firebasestorage.app",
    messagingSenderId: "321535579997",
    appId: "1:321535579997:web:caf36f10287722862dfab4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
