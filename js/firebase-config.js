import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    push,
    update,
    remove,
    onValue
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "gamadiem.firebaseapp.com",
    databaseURL: "https://gamadiem-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gamadiem",
    storageBucket: "gamadiem.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

function isPlaceholderValue(value) {
    return !value || typeof value !== "string" || value.indexOf("YOUR_") === 0;
}

const hasDatabaseConfig = Boolean(firebaseConfig.databaseURL && firebaseConfig.projectId);
const hasFullWebConfig =
    !isPlaceholderValue(firebaseConfig.apiKey) &&
    !isPlaceholderValue(firebaseConfig.messagingSenderId) &&
    !isPlaceholderValue(firebaseConfig.appId);

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Expose db and SDK helpers for non-module scripts
window.gamadiemFirebase = {
    app,
    db,
    ref,
    set,
    get,
    push,
    update,
    remove,
    onValue,
    isConfigured: hasDatabaseConfig,
    hasFullWebConfig,
    connected: false,
    status: hasDatabaseConfig ? "connecting" : "not-configured",
    databaseURL: firebaseConfig.databaseURL
};

if (hasDatabaseConfig) {
    try {
        onValue(
            ref(db, ".info/connected"),
            (snapshot) => {
                const isConnected = snapshot.val() === true;
                window.gamadiemFirebase.connected = isConnected;
                if (window.gamadiemFirebase.status !== "permission-denied") {
                    window.gamadiemFirebase.status = isConnected ? "connected" : "offline";
                }
                window.dispatchEvent(
                    new CustomEvent("gamadiem-firebase-status", {
                        detail: {
                            connected: isConnected,
                            status: window.gamadiemFirebase.status
                        }
                    })
                );
            },
            (err) => {
                window.gamadiemFirebase.connected = false;
                window.gamadiemFirebase.status = "error";
                window.gamadiemFirebase.lastError = err && err.message ? err.message : "Connection failed";
                window.dispatchEvent(
                    new CustomEvent("gamadiem-firebase-status", {
                        detail: {
                            connected: false,
                            status: "error",
                            error: window.gamadiemFirebase.lastError
                        }
                    })
                );
            }
        );
    } catch (err) {
        window.gamadiemFirebase.status = "error";
        window.gamadiemFirebase.lastError = err && err.message ? err.message : "Initialization failed";
    }
}

window.dispatchEvent(new Event("gamadiem-firebase-ready"));