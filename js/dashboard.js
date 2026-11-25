let isLoggedIn = false;
try {
  isLoggedIn = localStorage.getItem("gamadiem_isLoggedIn") === "true";
} catch (error) {
  console.error("Could not read Gamadiem login status.", error);
}

if (!isLoggedIn) {
  window.location.replace("index.html");
} else {
  const feedbackEl = document.getElementById("feedback");
  let feedbackTimer;

  function showFeedback(message, isError) {
    feedbackEl.textContent = message;
    feedbackEl.classList.toggle("error", Boolean(isError));
    feedbackEl.classList.add("visible");
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(function () {
      feedbackEl.classList.remove("visible");
    }, 3200);
  }

  function loadArray(key, fallback, isValidItem) {
    let serialized;
    try {
      serialized = localStorage.getItem(key);
    } catch (error) {
      console.error("Could not read " + key + " from localStorage.", error);
      showFeedback("Data lokal tidak dapat dibaca. Periksa pengaturan browser.", true);
      return fallback.map(function (item) { return { ...item }; });
    }

    if (serialized === null) {
      return fallback.map(function (item) { return { ...item }; });
    }

    let parsed;
    try {
      parsed = JSON.parse(serialized);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      console.error("Stored " + key + " data is not valid JSON.", error);
      showFeedback("Data " + key + " rusak dan tidak dapat dimuat.", true);
      return fallback.map(function (item) { return { ...item }; });
    }

    if (!Array.isArray(parsed)) {
      console.error("Stored " + key + " data must be an array.");
      showFeedback("Format data " + key + " tidak valid.", true);
      return fallback.map(function (item) { return { ...item }; });
    }

    const validItems = parsed.filter(isValidItem);
    if (validItems.length !== parsed.length) {
      console.error("Some stored " + key + " entries were invalid and skipped.");
      showFeedback("Sebagian data " + key + " tidak valid dan dilewati.", true);
    }
    return validItems;
  }

  function saveArray(key, items) {
    try {
      if (key === "history") {
        window.GamadiemFinance.saveHistory(items);
      } else {
        localStorage.setItem(key, JSON.stringify(items));
      }
      return true;
    } catch (error) {
      console.error("Could not save " + key + " to localStorage.", error);
      showFeedback("Data tidak berhasil disimpan. Periksa ruang penyimpanan browser.", true);
      return false;
    }
  }

  function isValidTransaction(item) {
    return item !== null &&
      typeof item === "object" &&
      typeof item.name === "string" &&
      item.name.trim().length > 0 &&
      Number.isSafeInteger(item.amount) &&
      item.amount > 0 &&
      typeof item.date === "string";
  }

  function isValidWishlistItem(item) {
    return item !== null &&
      typeof item === "object" &&
      typeof item.name === "string" &&
      item.name.trim().length > 0 &&
      Number.isSafeInteger(item.amount) &&
      item.amount > 0;
  }

  const state = {
    history: loadArray("history", [], isValidTransaction),
    wishlist: loadArray("wishlist", [], isValidWishlistItem)
  };
  let financialSettings = null;
  try {
    financialSettings = window.GamadiemFinance.loadSettings();
    if (!financialSettings) {
      showFeedback("Pengaturan keuangan tidak ditemukan. Lengkapi pengaturan akun terlebih dahulu.", true);
    } else {
      window.GamadiemFinance.renderUserIdentity(financialSettings);
    }
  } catch (error) {
    console.error("Could not load financial settings for the dashboard.", error);
    showFeedback("Pengaturan keuangan tidak dapat dibaca.", true);
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function formatRupiah(amount) {
    return "Rp. " + amount.toLocaleString("id-ID");
  }

  function formatThousands(value) {
    const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function parseRupiahInput(input) {
    const digits = input.value.replace(/\D/g, "");
    return digits ? Number(digits) : NaN;
  }

  function attachThousandsFormatter(input) {
    input.addEventListener("input", function () {
      const rawValue = input.value;
      const cursor = input.selectionStart === null ? rawValue.length : input.selectionStart;
      const digitsBeforeCursor = rawValue.slice(0, cursor).replace(/\D/g, "").length;
      const formattedValue = formatThousands(rawValue);
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

  function renderWishlist() {
    const wishlistEl = document.getElementById("wishlist");
    wishlistEl.replaceChildren();

    if (state.wishlist.length === 0) {
      const emptyState = document.createElement("li");
      emptyState.className = "wishlist-empty";
      emptyState.textContent = "No wishlist items yet.";
      wishlistEl.appendChild(emptyState);
      return;
    }

    state.wishlist.forEach(function (item) {
      const row = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = item.name;
      const price = document.createElement("span");
      price.className = "price";
      price.textContent = formatRupiah(item.amount);
      row.append(name, price);
      wishlistEl.appendChild(row);
    });
  }

  const safeCardEl = document.getElementById("safeCard");
  const safeMetaEl = document.getElementById("safeMeta");
  const safeWarningIconEl = document.getElementById("safeWarningIcon");
  const safeCheckBannerEl = document.getElementById("safeCheckBanner");
  const safeCheckIconEl = document.getElementById("safeCheckIcon");
  const safeCheckTitleEl = document.getElementById("safeCheckTitle");
  const safeCheckMessageEl = document.getElementById("safeCheckMessage");
  const priceInputEl = document.getElementById("price");
  const itemNameInputEl = document.getElementById("itemName");

  const overLimitModal = document.getElementById("overLimitModal");
  const overLimitMessageEl = document.getElementById("overLimitMessage");
  const confirmOverLimitButton = document.getElementById("confirmOverLimit");
  const cancelOverLimitButton = document.getElementById("cancelOverLimit");
  let pendingOverLimitPurchase = null;

  function getCurrentBalances() {
    return financialSettings
      ? window.GamadiemFinance.calculateBalances(financialSettings, state.history, new Date())
      : {
        spendableBalance: 0,
        piggyBank: 0,
        dailyBudget: 0,
        spentToday: 0,
        safeToSpendToday: 0,
        overDailyBy: 0,
        isOverDailyLimit: false,
        remainingDays: 1
      };
  }

  function setSafeBanner(mode, title, message, showWarningIcon) {
    safeCheckBannerEl.classList.remove("hidden", "status-safe", "status-warn", "status-danger");
    safeCheckBannerEl.classList.add("status-" + mode);
    safeCheckIconEl.classList.toggle("hidden", !showWarningIcon);
    safeCheckTitleEl.textContent = title;
    safeCheckMessageEl.textContent = message;
  }

  function renderSafeSpendCheck() {
    if (!financialSettings) {
      safeCheckBannerEl.classList.add("hidden");
      return;
    }

    const balances = getCurrentBalances();
    const enteredAmount = parseRupiahInput(priceInputEl);
    const hasEnteredAmount = Number.isSafeInteger(enteredAmount) && enteredAmount > 0;
    const itemLabel = itemNameInputEl.value.trim() || "this item";

    if (hasEnteredAmount) {
      if (enteredAmount > balances.spendableBalance) {
        setSafeBanner(
          "danger",
          "Insufficient Spendable Balance",
          "You cannot buy " + itemLabel + " because it exceeds your Spendable Balance by " +
          formatRupiah(enteredAmount - balances.spendableBalance) + ".",
          true
        );
        return;
      }

      if (enteredAmount > balances.safeToSpendToday) {
        const remainingAfter = Math.max(0, balances.spendableBalance - enteredAmount);
        const projectedDaily = balances.remainingDays > 1
          ? " Future daily budget drops to " + formatRupiah(Math.floor(remainingAfter / (balances.remainingDays - 1))) + "/day."
          : " Remaining balance will be " + formatRupiah(remainingAfter) + ".";
        const detail = balances.safeToSpendToday === 0
          ? "You have Rp. 0 Safe-to-Spend Today left."
          : "Exceeds today's Safe-to-Spend by " + formatRupiah(enteredAmount - balances.safeToSpendToday) + ".";
        setSafeBanner(
          "warn",
          "Warning: Exceeds Safe-to-Spend Today",
          detail + projectedDaily,
          true
        );
        return;
      }

      const leftAfterToday = balances.safeToSpendToday - enteredAmount;
      setSafeBanner(
        "safe",
        "You can buy this!",
        "You can buy " + itemLabel + " because you have enough Safe-to-Spend Today (" +
        formatRupiah(leftAfterToday) + " left today after purchase).",
        false
      );
      return;
    }

    if (balances.isOverDailyLimit) {
      setSafeBanner(
        "warn",
        "Daily Safe-to-Spend Limit Exceeded",
        "You have spent " + formatRupiah(balances.spentToday) + " today — " +
        formatRupiah(balances.overDailyBy) + " over today's budget (" + formatRupiah(balances.dailyBudget) + ").",
        true
      );
      return;
    }

    if (balances.dailyBudget > 0 && balances.safeToSpendToday === 0) {
      setSafeBanner(
        "warn",
        "Today's Safe-to-Spend Limit Reached",
        "You have used your full " + formatRupiah(balances.dailyBudget) +
        " daily allowance today. Extra purchases today will reduce tomorrow's budget.",
        true
      );
      return;
    }

    safeCheckBannerEl.classList.add("hidden");
  }

  function renderBalances() {
    const balances = getCurrentBalances();

    document.getElementById("spendableBalance").textContent = formatRupiah(balances.spendableBalance);
    document.getElementById("virtualPiggyBank").textContent = formatRupiah(balances.piggyBank);
    document.getElementById("safeToSpendToday").textContent = formatRupiah(balances.safeToSpendToday);

    safeCardEl.classList.toggle("over-limit", balances.isOverDailyLimit);
    safeCardEl.classList.toggle("at-limit", !balances.isOverDailyLimit && balances.dailyBudget > 0 && balances.safeToSpendToday === 0);
    safeWarningIconEl.classList.toggle(
      "hidden",
      !(balances.isOverDailyLimit || (balances.dailyBudget > 0 && balances.safeToSpendToday === 0))
    );

    if (balances.isOverDailyLimit) {
      safeMetaEl.textContent = "Over daily limit by " + formatRupiah(balances.overDailyBy) +
        " · Spent " + formatRupiah(balances.spentToday) + " today";
    } else if (balances.dailyBudget > 0 && balances.safeToSpendToday === 0) {
      safeMetaEl.textContent = "Daily limit reached · Spent " + formatRupiah(balances.spentToday) +
        " / " + formatRupiah(balances.dailyBudget) + " today";
    } else {
      safeMetaEl.textContent = "Daily limit: " + formatRupiah(balances.dailyBudget) +
        " · Spent today: " + formatRupiah(balances.spentToday);
    }

    renderSafeSpendCheck();
  }

  const dateEl = document.getElementById("date");
  const today = new Date();
  dateEl.textContent = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  dateEl.dateTime = localDateKey(today);

  document.getElementById("logoutLink").addEventListener("click", function (event) {
    event.preventDefault();
    openLogoutModal();
  });

  const logoutModal = document.getElementById("logoutModal");
  const logoutLink = document.getElementById("logoutLink");
  const cancelLogoutButton = document.getElementById("cancelLogout");
  const confirmLogoutButton = document.getElementById("confirmLogout");

  function openLogoutModal() {
    logoutModal.classList.remove("hidden");
    logoutModal.setAttribute("aria-hidden", "false");
    confirmLogoutButton.focus();
  }

  function closeLogoutModal() {
    logoutModal.classList.add("hidden");
    logoutModal.setAttribute("aria-hidden", "true");
    logoutLink.focus();
  }

  cancelLogoutButton.addEventListener("click", closeLogoutModal);
  logoutModal.addEventListener("click", function (event) {
    if (event.target === logoutModal) closeLogoutModal();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (!overLimitModal.classList.contains("hidden")) {
        closeOverLimitModal();
      } else if (!logoutModal.classList.contains("hidden")) {
        closeLogoutModal();
      }
    }
  });
  confirmLogoutButton.addEventListener("click", function () {
    try {
      localStorage.removeItem("gamadiem_isLoggedIn");
    } catch (error) {
      console.error("Could not clear Gamadiem login status.", error);
      showFeedback("Status login tidak dapat dihapus. Coba lagi.", true);
      return;
    }
    window.location.assign("index.html");
  });

  const catButtons = document.querySelectorAll(".cat");
  catButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      catButtons.forEach(function (categoryButton) {
        categoryButton.classList.remove("active");
        categoryButton.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
    });
  });

  attachThousandsFormatter(priceInputEl);
  attachThousandsFormatter(document.getElementById("wishlistPrice"));
  priceInputEl.addEventListener("input", renderSafeSpendCheck);
  itemNameInputEl.addEventListener("input", renderSafeSpendCheck);

  function openOverLimitModal(transaction, balances) {
    pendingOverLimitPurchase = transaction;
    const excess = transaction.amount - balances.safeToSpendToday;
    const remainingAfter = Math.max(0, balances.spendableBalance - transaction.amount);
    const futureText = balances.remainingDays > 1
      ? " Future days' Safe-to-Spend will shrink to " + formatRupiah(Math.floor(remainingAfter / (balances.remainingDays - 1))) + "/day."
      : "";
    overLimitMessageEl.textContent =
      "\"" + transaction.name + "\" (" + formatRupiah(transaction.amount) + ") exceeds your remaining Safe-to-Spend Today (" +
      formatRupiah(balances.safeToSpendToday) + ") by " + formatRupiah(excess) + "." + futureText;
    overLimitModal.classList.remove("hidden");
    overLimitModal.setAttribute("aria-hidden", "false");
    confirmOverLimitButton.focus();
  }

  function closeOverLimitModal() {
    pendingOverLimitPurchase = null;
    overLimitModal.classList.add("hidden");
    overLimitModal.setAttribute("aria-hidden", "true");
    priceInputEl.focus();
  }

  cancelOverLimitButton.addEventListener("click", closeOverLimitModal);
  overLimitModal.addEventListener("click", function (event) {
    if (event.target === overLimitModal) closeOverLimitModal();
  });
  confirmOverLimitButton.addEventListener("click", function () {
    if (!pendingOverLimitPurchase) {
      closeOverLimitModal();
      return;
    }
    const confirmedTx = pendingOverLimitPurchase;
    closeOverLimitModal();
    commitPurchase(confirmedTx, true);
  });

  function commitPurchase(transaction, wasOverDailyLimit) {
    const updatedHistory = state.history.concat(transaction);
    if (!saveArray("history", updatedHistory)) return;

    state.history = updatedHistory;
    document.getElementById("buyForm").reset();
    catButtons.forEach(function (button, index) {
      const selected = index === 0;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderBalances();

    const updatedBalances = getCurrentBalances();
    if (wasOverDailyLimit || updatedBalances.isOverDailyLimit) {
      showFeedback(
        "Purchased! Warning: Safe-to-Spend Today exceeded by " + formatRupiah(updatedBalances.overDailyBy) + ".",
        true
      );
    } else {
      showFeedback(
        "Purchased! Within Safe-to-Spend Today (" + formatRupiah(updatedBalances.safeToSpendToday) + " left today).",
        false
      );
    }
  }

  document.getElementById("buyForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const name = itemNameInputEl.value.trim();
    const amount = parseRupiahInput(priceInputEl);
    if (!name || !Number.isSafeInteger(amount) || amount <= 0) {
      showFeedback("Masukkan nama barang dan nominal yang valid.", true);
      return;
    }

    if (!financialSettings) {
      showFeedback("Pengaturan keuangan tidak tersedia. Perbarui Settings terlebih dahulu.", true);
      return;
    }

    const balances = getCurrentBalances();
    if (amount > balances.spendableBalance) {
      showFeedback("Pengeluaran melebihi Spendable Balance.", true);
      return;
    }

    const purchasedAt = new Date();
    const transaction = {
      name: name,
      amount: amount,
      category: document.querySelector(".cat.active").textContent.trim(),
      notes: document.getElementById("notes").value.trim(),
      date: localDateKey(purchasedAt),
      createdAt: purchasedAt.toISOString()
    };

    if (amount > balances.safeToSpendToday) {
      openOverLimitModal(transaction, balances);
      return;
    }

    commitPurchase(transaction, false);
  });

  document.getElementById("wishlistForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("wishlistItemName").value.trim();
    const amount = parseRupiahInput(document.getElementById("wishlistPrice"));
    if (!name || !Number.isSafeInteger(amount) || amount <= 0) {
      showFeedback("Masukkan nama item dan harga yang valid.", true);
      return;
    }

    const updatedWishlist = state.wishlist.concat({ name: name, amount: amount });
    if (!saveArray("wishlist", updatedWishlist)) return;

    state.wishlist = updatedWishlist;
    renderWishlist();
    event.currentTarget.reset();
    showFeedback("Item berhasil ditambahkan ke Wishlist.", false);
  });

  renderWishlist();
  renderBalances();
  function syncDashboardWishlistToRtdb() {
    const fb = window.gamadiemFirebase;
    if (!fb || !fb.db || !fb.ref || !fb.set) return;

    const activeEmail = localStorage.getItem("gamadiem_active_user");
    if (!activeEmail) return;

    const userKey = String(activeEmail).replace(/[.#$[\]/]/g, "_");
    fb.set(fb.ref(fb.db, "gamadiemUsers/" + userKey + "/wishlist"), state.wishlist)
      .catch(function (err) {
        console.error("Gagal sync wishlist ke RTDB:", err);
      });
  }

  function refreshDashboardFromRtdb(remote) {
    try {
      financialSettings = window.GamadiemFinance.loadSettings();
      if (financialSettings) {
        window.GamadiemFinance.renderUserIdentity(financialSettings);
      }
    } catch (err) {
      console.error("Gagal memuat ulang settings setelah sync RTDB:", err);
    }

    try {
      state.history = window.GamadiemFinance.readHistory();
    } catch (err) {
      console.error("Gagal memuat ulang history setelah sync RTDB:", err);
    }

    if (remote && Array.isArray(remote.wishlist)) {
      const validWishlist = remote.wishlist.filter(isValidWishlistItem);
      state.wishlist = validWishlist;
      localStorage.setItem("wishlist", JSON.stringify(validWishlist));
      renderWishlist();
    }

    renderBalances();
  }

  // Bungkus saveArray agar setiap perubahan wishlist juga ikut ke RTDB
  const originalSaveArray = saveArray;
  saveArray = function (key, items) {
    const ok = originalSaveArray(key, items);
    if (ok && key === "wishlist") {
      syncDashboardWishlistToRtdb();
    }
    return ok;
  };

  if (window.GamadiemFinance && typeof window.GamadiemFinance.onFirebaseReady === "function") {
    window.GamadiemFinance.onFirebaseReady(function () {
      syncDashboardWishlistToRtdb();
      if (typeof window.GamadiemFinance.listenUserFromRtdb === "function") {
        window.GamadiemFinance.listenUserFromRtdb(function (remote) {
          refreshDashboardFromRtdb(remote);
        });
      }
    });
  }
}
