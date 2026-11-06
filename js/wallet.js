
import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

export async function renderWallet(container) {
  if (!container) return;

  const user = auth.currentUser;

  if (!user) {
    container.innerHTML = `<div class="wallet-message">Please login to view your wallet.</div>`;
    return;
  }

  container.innerHTML = `
    <section class="wallet-page">
      <div class="wallet-heading">
        <span class="wallet-kicker">RAAVAN ESPORTS</span>
        <h2>My Wallet</h2>
        <p>Your game coins and activity</p>
      </div>

      <div class="wallet-balance-card">
        <span class="wallet-balance-label">AVAILABLE COINS</span>
        <div class="wallet-balance">
          <span class="wallet-coin-icon">◆</span>
          <strong id="walletBalance">...</strong>
        </div>
        <span class="wallet-balance-note">Non-cash game points</span>
      </div>

      <div class="wallet-info-card">
        <div class="wallet-info-icon">＋</div>
        <div>
          <h3>Get Game Coins</h3>
          <p>Coins can be awarded by the Raavan eSports admin.</p>
          <small>Coins have no cash value and cannot be withdrawn.</small>
        </div>
      </div>

      <div class="wallet-history-heading">
        <h3>Transaction History</h3>
        <span>Latest activity</span>
      </div>

      <div id="walletTransactions" class="wallet-transactions">
        <div class="wallet-message">Loading transactions...</div>
      </div>
    </section>
  `;

  const balanceElement = container.querySelector("#walletBalance");
  const transactionsElement = container.querySelector("#walletTransactions");

  try {
    const walletRef = doc(db, "wallets", user.uid);
    const walletSnap = await getDoc(walletRef);

    const balance = walletSnap.exists()
      ? Number(walletSnap.data().balance || 0)
      : 0;

    balanceElement.textContent = Number.isFinite(balance)
      ? Math.max(0, balance).toLocaleString("en-IN")
      : "0";

    const transactionsRef = collection(
      db,
      "wallets",
      user.uid,
      "transactions"
    );

    const transactionsQuery = query(
      transactionsRef,
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const transactionSnap = await getDocs(transactionsQuery);

    if (transactionSnap.empty) {
      transactionsElement.innerHTML = `
        <div class="wallet-empty">
          <div class="wallet-empty-icon">◈</div>
          <h4>No transactions yet</h4>
          <p>Your coin activity will appear here.</p>
        </div>
      `;
      return;
    }

    transactionsElement.innerHTML = transactionSnap.docs.map(item => {
      const data = item.data();
      const coins = Math.max(0, Number(data.coins || 0));
      const status = ["pending", "approved", "rejected"].includes(
        String(data.status || "").toLowerCase()
      ) ? String(data.status).toLowerCase() : "pending";

      const title = escapeHTML(data.note || "Coin transaction");
      const date = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleString("en-IN")
        : "Date unavailable";

      return `
        <div class="wallet-transaction">
          <div class="wallet-transaction-icon">◆</div>
          <div class="wallet-transaction-details">
            <strong>${title}</strong>
            <span>${escapeHTML(date)}</span>
            <small class="wallet-status ${status}">${status.toUpperCase()}</small>
          </div>
          <div class="wallet-transaction-coins">+${coins}</div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("Wallet loading error:", error);
    balanceElement.textContent = "—";
    transactionsElement.innerHTML = `
      <div class="wallet-message wallet-error">
        Wallet could not load. Please try again later.
      </div>
    `;
  }
}

