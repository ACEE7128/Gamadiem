(function (global) {
  const SETTINGS_KEY = "gamadiem_userSettings";
  const USERS_KEY = "gamadiem_users";
  const ACTIVE_USER_KEY = "gamadiem_active_user";
  const HISTORY_KEY = "history";

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function isValidDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] &&
      date.getMonth() === parts[1] - 1 &&
      date.getDate() === parts[2];
  }

  function normalizeSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const name = typeof value.name === "string"
      ? value.name.trim()
      : typeof value.user === "string" ? value.user.trim() : "";
    const allowanceValue = value.totalAllowance === undefined ? value.allowance : value.totalAllowance;
    const savingsValue = value.savingTarget === undefined ? value.savingsTarget : value.savingTarget;
    const cycleValue = value.cycleDurationDays === undefined
      ? value.daysLeft === undefined ? 30 : value.daysLeft
      : value.cycleDurationDays;
    const totalAllowance = Number(allowanceValue);
    const rentPrice = value.rentPrice === undefined ? 0 : Number(value.rentPrice);
    const electricity = value.electricity === undefined ? 0 : Number(value.electricity);
    const cycleDurationDays = Number(cycleValue);
    const savingTarget = savingsValue === undefined ? 0 : Number(savingsValue);
    const cycleStartDate = value.cycleStartDate === undefined
      ? localDateKey(new Date())
      : value.cycleStartDate;

    if (!name ||
      !Number.isSafeInteger(totalAllowance) || totalAllowance <= 0 ||
      !Number.isSafeInteger(rentPrice) || rentPrice < 0 ||
      !Number.isSafeInteger(electricity) || electricity < 0 ||
      !Number.isSafeInteger(cycleDurationDays) || cycleDurationDays < 1 || cycleDurationDays > 365 ||
      !Number.isSafeInteger(savingTarget) || savingTarget < 0 ||
      !isValidDateKey(cycleStartDate)) {
      return null;
    }

    return {
      name: name,
      totalAllowance: totalAllowance,
      rentPrice: rentPrice,
      electricity: electricity,
      cycleDurationDays: cycleDurationDays,
      savingTarget: savingTarget,
      cycleStartDate: cycleStartDate
    };
  }

  function readUsers() {
    const serialized = localStorage.getItem(USERS_KEY);
    if (serialized === null) return {};
    const users = JSON.parse(serialized);
    if (!users || typeof users !== "object" || Array.isArray(users)) {
      throw new TypeError("Stored Gamadiem accounts must be an object.");
    }
    return users;
  }

  function readSettings() {
    const serialized = localStorage.getItem(SETTINGS_KEY);
    if (serialized === null) return null;
    const settings = normalizeSettings(JSON.parse(serialized));
    if (!settings) throw new TypeError("Stored Gamadiem financial settings are invalid.");
    return settings;
  }

  function settingsFromAccount(account) {
    if (!account || typeof account !== "object") return null;
    const source = account.userSettings && typeof account.userSettings === "object"
      ? account.userSettings
      : {
        name: account.user,
        totalAllowance: account.allowance,
        rentPrice: account.rentPrice,
        electricity: account.electricity,
        cycleDurationDays: account.cycleDurationDays === undefined ? account.daysLeft : account.cycleDurationDays,
        savingTarget: account.savingsTarget,
        cycleStartDate: account.cycleStartDate
      };
    return normalizeSettings(source);
  }

  function loadSettings() {
    const savedSettings = readSettings();
    if (savedSettings) return savedSettings;

    const email = localStorage.getItem(ACTIVE_USER_KEY);
    if (!email) return null;
    const users = readUsers();
    const settings = settingsFromAccount(users[email]);
    if (!settings) return null;
    return saveSettings(settings);
  }

  function saveSettings(value) {
    const settings = normalizeSettings(value);
    if (!settings) throw new TypeError("Financial settings are invalid.");
    const email = localStorage.getItem(ACTIVE_USER_KEY);
    if (!email) throw new Error("No active Gamadiem account was found.");

    const users = readUsers();
    const account = users[email];
    if (!account || typeof account !== "object") {
      throw new Error("The active Gamadiem account could not be found.");
    }

    users[email] = Object.assign({}, account, {
      user: settings.name,
      allowance: settings.totalAllowance,
      rentPrice: settings.rentPrice,
      electricity: settings.electricity,
      savingsTarget: settings.savingTarget,
      cycleDurationDays: settings.cycleDurationDays,
      daysLeft: settings.cycleDurationDays,
      cycleStartDate: settings.cycleStartDate,
      userSettings: settings
    });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  }

  function readHistory() {
    const serialized = localStorage.getItem(HISTORY_KEY);
    if (serialized === null) return [];
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) throw new TypeError("Stored purchase history must be an array.");

    const history = parsed.filter(function (item) {
      return item !== null &&
        typeof item === "object" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        Number.isSafeInteger(item.amount) &&
        item.amount > 0;
    });
    if (history.length !== parsed.length) {
      console.error("Invalid purchase history entries were skipped while calculating balances.");
    }
    return history;
  }

  function saveHistory(history) {
    if (!Array.isArray(history)) throw new TypeError("Purchase history must be an array.");
    const email = localStorage.getItem(ACTIVE_USER_KEY);
    if (!email) throw new Error("No active Gamadiem account was found.");

    const users = readUsers();
    const account = users[email];
    if (!account || typeof account !== "object") {
      throw new Error("The active Gamadiem account could not be found.");
    }

    users[email] = Object.assign({}, account, { history: history });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function initializeSession(email, settings, history) {
    localStorage.setItem(ACTIVE_USER_KEY, email);
    saveSettings(settings);
    saveHistory(history);
    localStorage.setItem("gamadiem_isLoggedIn", "true");
  }

  function remainingCycleDays(settings, now) {
    const duration = settings.cycleDurationDays;
    const startParts = settings.cycleStartDate.split("-").map(Number);
    const cycleStart = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const elapsedDays = Math.max(0, Math.floor((today.getTime() - cycleStart.getTime()) / 86400000));
    return duration - (elapsedDays % duration);
  }

  function getTransactionDateKey(transaction) {
    if (!transaction || typeof transaction !== "object") return "";
    if (typeof transaction.date === "string" && isValidDateKey(transaction.date)) {
      return transaction.date;
    }
    const timestamp = transaction.createdAt || transaction.timestamp;
    if (typeof timestamp === "string") {
      const parsed = new Date(timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        return localDateKey(parsed);
      }
    }
    return "";
  }

  function calculateBalances(settings, history, now) {
    if (!settings) throw new TypeError("Financial settings are required to calculate balances.");
    if (!Array.isArray(history)) throw new TypeError("Purchase history must be an array.");
    const referenceNow = now || new Date();
    const todayKey = localDateKey(referenceNow);

    let totalSpent = 0;
    let spentToday = 0;

    history.forEach(function (transaction) {
      if (!transaction || !Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) {
        return;
      }
      totalSpent += transaction.amount;
      if (getTransactionDateKey(transaction) === todayKey) {
        spentToday += transaction.amount;
      }
    });

    const remaining = remainingCycleDays(settings, referenceNow);
    const baseNetAllowance =
      settings.totalAllowance -
      settings.rentPrice -
      settings.electricity -
      settings.savingTarget;

    const spendableBalance = Math.max(0, baseNetAllowance - totalSpent);
    const spentBeforeToday = Math.max(0, totalSpent - spentToday);
    const spendableBeforeToday = Math.max(0, baseNetAllowance - spentBeforeToday);
    const dailyBudget = spendableBeforeToday === 0 ? 0 : Math.floor(spendableBeforeToday / remaining);
    const safeToSpendToday = Math.max(0, dailyBudget - spentToday);
    const overDailyBy = Math.max(0, spentToday - dailyBudget);

    return {
      totalSpent: totalSpent,
      spentToday: spentToday,
      remainingDays: remaining,
      spendableBalance: spendableBalance,
      piggyBank: settings.savingTarget,
      dailyBudget: dailyBudget,
      safeToSpendToday: safeToSpendToday,
      overDailyBy: overDailyBy,
      isOverDailyLimit: overDailyBy > 0
    };
  }

  function formatCurrency(amount) {
    return "Rp " + Number(amount || 0).toLocaleString("id-ID");
  }

  function parseMoneyInput(value) {
    const digits = String(value).replace(/\D/g, "");
    const amount = digits ? Number(digits) : NaN;
    return Number.isSafeInteger(amount) ? amount : NaN;
  }

  function attachThousandsFormatter(input) {
    input.addEventListener("input", function () {
      const rawValue = input.value;
      const cursor = input.selectionStart === null ? rawValue.length : input.selectionStart;
      const digitsBeforeCursor = rawValue.slice(0, cursor).replace(/\D/g, "").length;
      const digits = rawValue.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      const formattedValue = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      input.value = formattedValue;

      let nextCursor = 0;
      let digitsCounted = 0;
      while (nextCursor < formattedValue.length && digitsCounted < digitsBeforeCursor) {
        if (/\d/.test(formattedValue.charAt(nextCursor))) digitsCounted += 1;
        nextCursor += 1;
      }
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function renderUserIdentity(settings) {
    const savedSettings = settings || loadSettings();
    if (!savedSettings) return;
    document.querySelectorAll("[data-user-name]").forEach(function (element) {
      element.textContent = savedSettings.name;
    });
    document.querySelectorAll("[data-user-initial]").forEach(function (element) {
      element.textContent = savedSettings.name.charAt(0).toUpperCase();
    });
  }

  global.GamadiemFinance = {
    attachThousandsFormatter: attachThousandsFormatter,
    calculateBalances: calculateBalances,
    formatCurrency: formatCurrency,
    initializeSession: initializeSession,
    loadSettings: loadSettings,
    localDateKey: localDateKey,
    normalizeSettings: normalizeSettings,
    parseMoneyInput: parseMoneyInput,
    readHistory: readHistory,
    renderUserIdentity: renderUserIdentity,
    saveHistory: saveHistory,
    saveSettings: saveSettings,
    settingsFromAccount: settingsFromAccount
  };

  try {
    renderUserIdentity(loadSettings());
  } catch (error) {
    console.error("Could not load Gamadiem user settings.", error);
  }
  function sanitizeUserKey(emailOrId) {
    return String(emailOrId || "guest").replace(/[.#$[\]/]/g, "_");
  }

  function onFirebaseReady(callback) {
    if (typeof callback !== "function") return;
    if (global.gamadiemFirebase) {
      callback(global.gamadiemFirebase);
      return;
    }
    global.addEventListener("gamadiem-firebase-ready", function () {
      callback(global.gamadiemFirebase);
    }, { once: true });
  }

  function reportRtdbError(fb, err) {
    const message = err && err.message ? err.message : String(err || "");
    const isPermissionDenied = /permission_denied|permission denied/i.test(message);
    fb.status = isPermissionDenied ? "permission-denied" : "error";
    fb.lastError = message;
    global.dispatchEvent(new CustomEvent("gamadiem-firebase-status", {
      detail: {
        connected: Boolean(fb.connected),
        status: fb.status,
        error: message
      }
    }));
  }

  function getFirebaseConnectionState() {
    const fb = global.gamadiemFirebase;
    if (!fb) {
      return {
        configured: false,
        connected: false,
        status: "loading",
        label: "Checking Firebase..."
      };
    }
    if (!fb.isConfigured) {
      return {
        configured: false,
        connected: false,
        status: "not-configured",
        label: "Not configured (missing databaseURL in js/firebase-config.js)"
      };
    }
    if (fb.status === "permission-denied") {
      return {
        configured: true,
        connected: Boolean(fb.connected),
        status: "permission-denied",
        label: "Connected to " + fb.databaseURL + ", but Firebase RTDB Rules returned PERMISSION_DENIED"
      };
    }
    if (fb.connected) {
      return {
        configured: true,
        connected: true,
        status: "connected",
        label: "Connected to " + fb.databaseURL
      };
    }
    return {
      configured: true,
      connected: false,
      status: fb.status || "offline",
      label: fb.status === "error"
        ? "Firebase error: " + (fb.lastError || "connection failed")
        : "Connecting to " + fb.databaseURL + "..."
    };
  }

  function syncAccountToRtdb() {
    const fb = global.gamadiemFirebase;
    if (!fb || !fb.isConfigured || !fb.db || !fb.ref || !fb.set) {
      return Promise.resolve(false);
    }

    const activeEmail = localStorage.getItem(ACTIVE_USER_KEY);
    if (!activeEmail) return Promise.resolve(false);

    const userKey = sanitizeUserKey(activeEmail);
    let users = {};
    try {
      users = readUsers();
    } catch (e) {
      users = {};
    }

    const account = users[activeEmail] || {};
    let settings = null;
    let history = [];
    try {
      settings = readSettings();
      history = readHistory();
    } catch (e) {
      // Ignore incomplete local state during initial load
    }

    return fb.set(fb.ref(fb.db, "gamadiemUsers/" + userKey), {
      email: activeEmail,
      account: account,
      settings: settings,
      history: history,
      updatedAt: Date.now()
    }).then(function () {
      if (fb.status === "permission-denied") {
        fb.status = fb.connected ? "connected" : "offline";
      }
      return true;
    }).catch(function (err) {
      console.error("Gagal sync ke Realtime Database:", err);
      reportRtdbError(fb, err);
      return false;
    });
  }

  function fetchUserFromRtdb(email) {
    const fb = global.gamadiemFirebase;
    if (!fb || !fb.isConfigured || !fb.db || !fb.ref || !fb.get || !email) {
      return Promise.resolve(null);
    }
    const userKey = sanitizeUserKey(email);
    return fb.get(fb.ref(fb.db, "gamadiemUsers/" + userKey))
      .then(function (snapshot) {
        return snapshot.exists() ? snapshot.val() : null;
      })
      .catch(function (err) {
        console.error("Gagal mengambil akun dari Realtime Database:", err);
        reportRtdbError(fb, err);
        return null;
      });
  }

  let activeRtdbListenerKey = null;

  function listenUserFromRtdb(onSynced) {
    const fb = global.gamadiemFirebase;
    if (!fb || !fb.isConfigured || !fb.db || !fb.ref || !fb.onValue) return;

    const activeEmail = localStorage.getItem(ACTIVE_USER_KEY);
    if (!activeEmail) return;

    const userKey = sanitizeUserKey(activeEmail);
    if (activeRtdbListenerKey === userKey && typeof onSynced !== "function") return;
    activeRtdbListenerKey = userKey;

    fb.onValue(fb.ref(fb.db, "gamadiemUsers/" + userKey), function (snapshot) {
      const remote = snapshot.val();
      if (!remote) {
        syncAccountToRtdb();
        return;
      }

      if (remote.settings) {
        const normalized = normalizeSettings(remote.settings);
        if (normalized) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
        }
      }
      if (Array.isArray(remote.history)) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(remote.history));
      }
      if (typeof onSynced === "function") {
        onSynced(remote);
      }
    }, function (err) {
      console.error("Gagal listen Realtime Database:", err);
      reportRtdbError(fb, err);
    });
  }

  // Bungkus saveSettings & saveHistory agar otomatis ikut sync ke RTDB
  const originalSaveSettings = saveSettings;
  saveSettings = function (value) {
    const result = originalSaveSettings(value);
    syncAccountToRtdb();
    return result;
  };

  const originalSaveHistory = saveHistory;
  saveHistory = function (history) {
    originalSaveHistory(history);
    syncAccountToRtdb();
  };

  global.GamadiemFinance.saveSettings = saveSettings;
  global.GamadiemFinance.saveHistory = saveHistory;
  global.GamadiemFinance.syncAccountToRtdb = syncAccountToRtdb;
  global.GamadiemFinance.listenUserFromRtdb = listenUserFromRtdb;
  global.GamadiemFinance.fetchUserFromRtdb = fetchUserFromRtdb;
  global.GamadiemFinance.onFirebaseReady = onFirebaseReady;
  global.GamadiemFinance.getFirebaseConnectionState = getFirebaseConnectionState;

  onFirebaseReady(function () {
    listenUserFromRtdb(function () {
      try {
        renderUserIdentity(loadSettings());
      } catch (e) {
        // Ignore if not logged in yet
      }
    });
  });
})(window);
