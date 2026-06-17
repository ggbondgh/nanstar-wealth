(function () {
  const storageKey = "nanstar-wealth-v1";
  const syncMetaKey = "nanstar-wealth-sync-meta";
  const syncTokenKey = "nanstar-wealth-sync-token";
  const themeKey = "nanstar-wealth-theme";
  const palette = ["#34d399", "#60a5fa", "#f59e0b", "#fb7185", "#a78bfa", "#22d3ee", "#f97316"];
  const typeNames = {
    stock: "股票",
    fund: "基金",
    etf: "ETF",
    cash: "现金",
    crypto: "加密"
  };
  const actionNames = {
    buy: "买入",
    sell: "卖出",
    auto: "定投",
    bonus: "活动",
    dividend: "分红",
    deposit: "转入",
    withdraw: "转出"
  };
  const statusNames = {
    confirmed: "确认成功",
    pending: "进行中",
    failed: "失败",
    canceled: "已撤销"
  };
  const fx = {
    CNY: 1,
    USD: 7.22,
    HKD: 0.92
  };

  const sampleState = {
    prices: {
      AAPL: 214.8,
      NVDA: 143.2,
      "510300": 4.18,
      "000001.OF": 1.42,
      CASH: 1
    },
    dayChangePct: {
      AAPL: 0.012,
      NVDA: -0.008,
      "510300": 0.004,
      "000001.OF": -0.002,
      CASH: 0
    },
    watchlist: [
      {
        symbol: "002611",
        name: "博时黄金ETF联接C",
        type: "fund",
        currency: "CNY",
        note: "黄金基金观察"
      }
    ],
    transactions: [
      {
        id: "tx-001",
        date: "2026-01-05",
        action: "deposit",
        symbol: "CASH",
        name: "现金",
        type: "cash",
        account: "主账户",
        quantity: 80000,
        price: 1,
        fee: 0,
        currency: "CNY",
        note: "年初转入投资账户"
      },
      {
        id: "tx-002",
        date: "2026-01-12",
        action: "buy",
        symbol: "510300",
        name: "沪深300ETF",
        type: "etf",
        account: "A股账户",
        quantity: 9000,
        price: 3.85,
        fee: 5,
        currency: "CNY",
        note: "核心指数仓位，分批建仓"
      },
      {
        id: "tx-003",
        date: "2026-02-03",
        action: "buy",
        symbol: "AAPL",
        name: "Apple",
        type: "stock",
        account: "美股账户",
        quantity: 28,
        price: 189.2,
        fee: 1,
        currency: "USD",
        note: "消费电子和服务收入观察仓"
      },
      {
        id: "tx-004",
        date: "2026-02-18",
        action: "buy",
        symbol: "000001.OF",
        name: "主动权益基金",
        type: "fund",
        account: "基金账户",
        quantity: 18000,
        price: 1.31,
        fee: 24,
        currency: "CNY",
        note: "基金经理稳定，控制单只占比"
      },
      {
        id: "tx-005",
        date: "2026-03-08",
        action: "buy",
        symbol: "NVDA",
        name: "NVIDIA",
        type: "stock",
        account: "美股账户",
        quantity: 18,
        price: 122.6,
        fee: 1,
        currency: "USD",
        note: "AI 算力龙头，小仓位跟踪"
      },
      {
        id: "tx-006",
        date: "2026-04-19",
        action: "sell",
        symbol: "510300",
        name: "沪深300ETF",
        type: "etf",
        account: "A股账户",
        quantity: 1500,
        price: 4.12,
        fee: 4,
        currency: "CNY",
        note: "上涨后回收部分现金"
      },
      {
        id: "tx-007",
        date: "2026-05-26",
        action: "dividend",
        symbol: "AAPL",
        name: "Apple",
        type: "stock",
        account: "美股账户",
        quantity: 28,
        price: 0.26,
        fee: 0,
        currency: "USD",
        note: "季度分红"
      }
    ]
  };

  const els = {
    pageTitle: document.getElementById("pageTitle"),
    totalValue: document.getElementById("totalValue"),
    totalCost: document.getElementById("totalCost"),
    totalPnl: document.getElementById("totalPnl"),
    totalPnlRate: document.getElementById("totalPnlRate"),
    dayChange: document.getElementById("dayChange"),
    dayChangeRate: document.getElementById("dayChangeRate"),
    cashValue: document.getElementById("cashValue"),
    cashWeight: document.getElementById("cashWeight"),
    wealthChart: document.getElementById("wealthChart"),
    allocationChart: document.getElementById("allocationChart"),
    allocationLegend: document.getElementById("allocationLegend"),
    topHoldingsBody: document.getElementById("topHoldingsBody"),
    holdingsBody: document.getElementById("holdingsBody"),
    transactionsBody: document.getElementById("transactionsBody"),
    transactionSummary: document.getElementById("transactionSummary"),
    transactionFilters: document.getElementById("transactionFilters"),
    transactionRecordList: document.getElementById("transactionRecordList"),
    recentTransactions: document.getElementById("recentTransactions"),
    riskList: document.getElementById("riskList"),
    noteList: document.getElementById("noteList"),
    transactionDrawerEyebrow: document.getElementById("transactionDrawerEyebrow"),
    transactionDrawerTitle: document.getElementById("transactionDrawerTitle"),
    saveTransactionButton: document.getElementById("saveTransactionButton"),
    searchResults: document.getElementById("instrumentSearchResults"),
    lookupPanel: document.getElementById("lookupPanel"),
    lookupTitle: document.getElementById("lookupTitle"),
    lookupStatus: document.getElementById("lookupStatus"),
    lookupStats: document.getElementById("lookupStats"),
    fundTrendChart: document.getElementById("fundTrendChart"),
    instrumentDrawer: document.getElementById("instrumentDrawer"),
    instrumentTitle: document.getElementById("instrumentTitle"),
    instrumentSummary: document.getElementById("instrumentSummary"),
    instrumentStatus: document.getElementById("instrumentStatus"),
    instrumentTrendChart: document.getElementById("instrumentTrendChart"),
    instrumentTransactions: document.getElementById("instrumentTransactions"),
    drawer: document.getElementById("transactionDrawer"),
    backdrop: document.getElementById("drawerBackdrop"),
    form: document.getElementById("transactionForm"),
    toast: document.getElementById("toast")
  };

  let localStateSource = "sample";
  const state = loadState();
  let activeType = "all";
  let activeRange = "3m";
  let activeTransactionFilter = "all";
  let latestLookup = null;
  let cloudSyncReady = false;
  let cloudSyncTimer = null;
  let cloudSyncInFlight = false;
  let cloudSyncQueued = false;
  let cloudSyncNoticeShown = false;
  const lookupBySymbol = new Map();

  init();

  function init() {
    applyTheme(localStorage.getItem(themeKey) || "dark");
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
    document.querySelectorAll("[data-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.jump));
    });
    document.querySelectorAll(".segmented button").forEach((button) => {
      button.addEventListener("click", () => {
        activeRange = button.dataset.range;
        document.querySelectorAll(".segmented button").forEach((item) => item.classList.toggle("active", item === button));
        drawWealthChart(computePortfolio());
      });
    });
    document.querySelectorAll("#assetFilters button").forEach((button) => {
      button.addEventListener("click", () => {
        activeType = button.dataset.type;
        document.querySelectorAll("#assetFilters button").forEach((item) => item.classList.toggle("active", item === button));
        renderHoldings(computePortfolio());
      });
    });

    document.getElementById("themeToggle").addEventListener("click", () => {
      const next = document.body.classList.contains("theme-light") ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem(themeKey, next);
      render();
    });
    document.getElementById("openTransactionButton").addEventListener("click", openDrawer);
    document.getElementById("openTransactionButton2").addEventListener("click", openDrawer);
    document.getElementById("openWatchlistButton").addEventListener("click", openWatchlistDrawer);
    document.getElementById("syncTokenButton").addEventListener("click", configureSyncToken);
    document.getElementById("closeDrawerButton").addEventListener("click", closeDrawer);
    document.getElementById("closeInstrumentButton").addEventListener("click", closeInstrumentDrawer);
    els.backdrop.addEventListener("click", () => {
      if (els.instrumentDrawer.classList.contains("open")) closeInstrumentDrawer();
      else closeDrawer();
    });
    document.getElementById("resetButton").addEventListener("click", resetSample);
    document.getElementById("exportCsvButton").addEventListener("click", exportCsv);
    document.getElementById("fillSampleButton").addEventListener("click", fillSampleTransaction);
    els.form.addEventListener("submit", saveTransaction);
    document.getElementById("txSymbol").addEventListener("input", debounce(handleSymbolInput, 420));
    document.getElementById("txSymbol").addEventListener("blur", handleSymbolInput);
    document.getElementById("txName").addEventListener("input", debounce(handleNameSearchInput, 420));
    document.getElementById("txDate").addEventListener("change", handleSymbolInput);
    document.getElementById("txTime").addEventListener("change", handleSymbolInput);
    document.getElementById("txType").addEventListener("change", () => {
      updateInputModeLabels();
      handleSymbolInput();
    });
    els.searchResults.addEventListener("click", handleSearchResultClick);
    document.getElementById("txInputMode").addEventListener("change", updateInputModeLabels);
    els.holdingsBody.addEventListener("click", handleHoldingsAction);
    els.topHoldingsBody.addEventListener("click", handleHoldingsAction);
    els.transactionsBody.addEventListener("click", handleTransactionAction);
    els.transactionRecordList.addEventListener("click", handleTransactionAction);
    els.transactionFilters.addEventListener("click", handleTransactionFilterClick);
    els.instrumentTransactions.addEventListener("click", handleTransactionAction);

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById("txDate").value = today;
    document.getElementById("txTime").value = "15:01";
    ensureStateShape();
    updateInputModeLabels();
    render();
    syncCloudState().finally(() => refreshMarketData());
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        localStateSource = "stored";
        return JSON.parse(stored);
      }
    } catch {
      // Ignore broken local data and fall back to the bundled sample.
    }
    return JSON.parse(JSON.stringify(sampleState));
  }

  function persist(options = {}) {
    localStorage.setItem(storageKey, JSON.stringify(state));
    const meta = getSyncMeta();
    meta.localUpdatedAt = new Date().toISOString();
    if (options.sync !== false) {
      meta.dirty = true;
      setSyncMeta(meta);
      scheduleCloudSave();
      return;
    }
    setSyncMeta(meta);
  }

  function getSyncMeta() {
    try {
      return JSON.parse(localStorage.getItem(syncMetaKey) || "{}") || {};
    } catch {
      return {};
    }
  }

  function setSyncMeta(meta) {
    localStorage.setItem(syncMetaKey, JSON.stringify(meta || {}));
  }

  function cloudHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem(syncTokenKey);
    if (token) headers["x-nanstar-sync-token"] = token;
    return headers;
  }

  function configureSyncToken() {
    const current = localStorage.getItem(syncTokenKey) || "";
    const next = window.prompt("输入 NanStar Wealth 云端同步口令。留空会清除本机口令。", current);
    if (next === null) return;
    const token = next.trim();
    if (token) {
      localStorage.setItem(syncTokenKey, token);
      cloudSyncReady = true;
      showToast("同步口令已保存");
      syncCloudState().finally(() => scheduleCloudSave(0));
      return;
    }
    localStorage.removeItem(syncTokenKey);
    cloudSyncReady = false;
    showToast("已清除同步口令");
  }

  async function syncCloudState() {
    try {
      const response = await fetch("/api/state", { cache: "no-store", headers: cloudHeaders() });
      if (response.status === 401 || response.status === 403 || response.status === 503) return;
      if (!response.ok) throw new Error(`云端同步失败 ${response.status}`);
      const data = await response.json();
      cloudSyncReady = true;
      const remoteState = data.state;
      const remoteUpdatedAt = data.updatedAt || "";
      const meta = getSyncMeta();

      if (remoteState && (localStateSource !== "stored" || (!meta.dirty && remoteUpdatedAt && remoteUpdatedAt !== meta.remoteUpdatedAt))) {
        replaceState(remoteState);
        ensureStateShape();
        persist({ sync: false });
        setSyncMeta({ ...getSyncMeta(), remoteUpdatedAt, dirty: false });
        render();
        if (!cloudSyncNoticeShown) {
          showToast("已从云端同步数据");
          cloudSyncNoticeShown = true;
        }
        return;
      }

      if (!remoteState && localStateSource === "stored") {
        scheduleCloudSave(0);
      }
    } catch {
      // Keep local-first behavior when the cloud endpoint is unavailable.
    }
  }

  function replaceState(nextState) {
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, JSON.parse(JSON.stringify(nextState || sampleState)));
  }

  function scheduleCloudSave(delay = 900) {
    if (!cloudSyncReady) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => pushCloudState(), delay);
  }

  async function pushCloudState() {
    if (cloudSyncInFlight) {
      cloudSyncQueued = true;
      return;
    }
    cloudSyncInFlight = true;
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: cloudHeaders(),
        body: JSON.stringify({ state })
      });
      if (response.status === 401 || response.status === 403 || response.status === 503) return;
      if (!response.ok) throw new Error(`云端保存失败 ${response.status}`);
      const data = await response.json();
      setSyncMeta({ ...getSyncMeta(), remoteUpdatedAt: data.updatedAt || "", dirty: false });
      if (!cloudSyncNoticeShown) {
        showToast("云端同步已开启");
        cloudSyncNoticeShown = true;
      }
    } catch {
      const meta = getSyncMeta();
      meta.dirty = true;
      setSyncMeta(meta);
    } finally {
      cloudSyncInFlight = false;
      if (cloudSyncQueued) {
        cloudSyncQueued = false;
        scheduleCloudSave(500);
      }
    }
  }

  async function refreshMarketData() {
    const instruments = new Map();
    state.transactions.forEach((tx) => {
      if (!tx.symbol || tx.type === "cash") return;
      instruments.set(tx.symbol, { symbol: tx.symbol, type: tx.type || "fund" });
    });
    (state.watchlist || []).forEach((item) => {
      if (!item.symbol || item.type === "cash") return;
      instruments.set(item.symbol, { symbol: item.symbol, type: item.type || "fund" });
    });
    if (!instruments.size) return;

    let updated = false;
    await Promise.allSettled(Array.from(instruments.values()).map(async (item) => {
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(item.symbol)}?kind=${encodeURIComponent(item.type)}`);
      const latestPrice = Number.isFinite(data.nav)
        ? data.nav
        : Number.isFinite(data.price)
          ? data.price
          : Number.isFinite(data.estimatedNav)
            ? data.estimatedNav
            : null;
      if (Number.isFinite(latestPrice)) {
        state.prices[item.symbol] = latestPrice;
        updated = true;
      }
      if (Number.isFinite(data.estimatedChangePct)) {
        state.dayChangePct[item.symbol] = data.estimatedChangePct / 100;
        updated = true;
      }
      lookupBySymbol.set(item.symbol, data);
    }));

    await Promise.allSettled(state.transactions.map(async (tx) => {
      const needsHistoricalPrice = (tx.type === "fund" || tx.type === "etf")
        && tx.inputMode === "amount"
        && (isBuyAction(tx.action) || isSellAction(tx.action))
        && tx.symbol
        && (!number(tx.price) || number(tx.price) === 1);
      if (!needsHistoricalPrice) return;
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(tx.symbol)}?kind=${encodeURIComponent(tx.type)}&date=${encodeURIComponent(tx.date || "")}&time=${encodeURIComponent(tx.time || "")}`);
      if (Number.isFinite(data.priceOnDate)) {
        tx.price = data.priceOnDate;
        updated = true;
      }
      lookupBySymbol.set(tx.symbol, data);
    }));

    if (updated) {
      persist({ sync: false });
      render();
    }
  }

  function ensureStateShape() {
    if (!Array.isArray(state.watchlist)) state.watchlist = [];
    if (!state.prices) state.prices = {};
    if (!state.dayChangePct) state.dayChangePct = {};
    if (!Array.isArray(state.transactions)) state.transactions = [];
    let migrated = false;
    state.transactions.forEach((tx) => {
      if (!tx.status) {
        tx.status = "confirmed";
        migrated = true;
      }
      if (!tx.inputMode && tx.type === "fund" && tx.action === "buy" && number(tx.quantity) <= 1 && number(tx.price) > 100) {
        tx.inputMode = "amount";
        tx.quantity = number(tx.price);
        const currentPrice = state.prices?.[tx.symbol] || 0;
        tx.price = currentPrice > 0 && currentPrice < 100 ? currentPrice : 1;
        tx.note = tx.note ? `${tx.note} · 已按金额模式修正` : "已按金额模式修正";
        migrated = true;
      }
      if (!tx.time && (tx.type === "fund" || tx.type === "etf")) {
        tx.time = "15:01";
        migrated = true;
      }
    });
    if (migrated) persist();
  }

  function applyTheme(theme) {
    document.body.classList.toggle("theme-light", theme === "light");
  }

  function switchView(view) {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
    const titles = {
      overview: "资产总览",
      holdings: "全部持仓",
      transactions: "交易流水",
      insights: "复盘与风险"
    };
    els.pageTitle.textContent = titles[view] || "资产总览";
  }

  function isBuyAction(action) {
    return action === "buy" || action === "auto";
  }

  function isSellAction(action) {
    return action === "sell";
  }

  function isDividendAction(action) {
    return action === "dividend" || action === "bonus";
  }

  function isCashInAction(action) {
    return action === "deposit";
  }

  function isCashOutAction(action) {
    return action === "withdraw";
  }

  function computePortfolio() {
    const holdingsMap = new Map();
    let cash = 0;
    let realized = 0;
    let dividends = 0;
    let invested = 0;

    getSortedTransactions().forEach((tx) => {
      if ((tx.status || "confirmed") !== "confirmed") return;
      const rate = fx[tx.currency] || 1;
      const price = number(tx.price);
      const fee = number(tx.fee);
      const quantity = getTransactionShares(tx);
      const gross = getTransactionGross(tx) * rate;
      const signedFee = fee * rate;
      const key = tx.symbol.toUpperCase();

      if (isCashInAction(tx.action)) {
        cash += gross;
        invested += gross;
        return;
      }
      if (isCashOutAction(tx.action)) {
        cash -= gross;
        invested -= gross;
        return;
      }
      if (isDividendAction(tx.action)) {
        cash += gross;
        dividends += gross;
        return;
      }

      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, {
          symbol: key,
          name: tx.name,
          type: tx.type,
          account: tx.account,
          currency: tx.currency,
          quantity: 0,
          cost: 0,
          realized: 0
        });
      }
      const holding = holdingsMap.get(key);
      holding.name = tx.name || holding.name;
      holding.type = tx.type || holding.type;
      holding.account = tx.account || holding.account;
      holding.currency = tx.currency || holding.currency;

      if (isBuyAction(tx.action)) {
        holding.quantity += quantity;
        holding.cost += gross + signedFee;
        cash -= gross + signedFee;
      }

      if (isSellAction(tx.action)) {
        const avgCost = holding.quantity > 0 ? holding.cost / holding.quantity : 0;
        const removedCost = Math.min(quantity, holding.quantity) * avgCost;
        const proceeds = gross - signedFee;
        holding.quantity -= quantity;
        holding.cost -= removedCost;
        holding.realized += proceeds - removedCost;
        realized += proceeds - removedCost;
        cash += proceeds;
      }
    });

    const holdings = Array.from(holdingsMap.values())
      .filter((holding) => Math.abs(holding.quantity) > 0.000001)
      .map((holding) => {
        const rate = fx[holding.currency] || 1;
        const price = state.prices[holding.symbol] ?? 1;
        const value = holding.quantity * price * rate;
        const pnl = value - holding.cost + holding.realized;
        const pnlRate = holding.cost > 0 ? pnl / holding.cost : 0;
        const avgCost = holding.quantity > 0 ? holding.cost / holding.quantity / rate : 0;
        const dayChange = value * (state.dayChangePct[holding.symbol] || 0);
        return { ...holding, price, value, pnl, pnlRate, avgCost, dayChange };
      });

    const cashHolding = {
      symbol: "CASH",
      name: "可用现金",
      type: "cash",
      account: "聚合",
      currency: "CNY",
      quantity: cash,
      cost: cash,
      price: 1,
      value: cash,
      pnl: 0,
      pnlRate: 0,
      avgCost: 1,
      dayChange: 0,
      realized: 0
    };
    holdings.push(cashHolding);

    const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const totalCost = holdings.reduce((sum, holding) => sum + (holding.type === "cash" ? 0 : holding.cost), 0);
    const unrealized = holdings.reduce((sum, holding) => sum + (holding.type === "cash" ? 0 : holding.value - holding.cost), 0);
    const totalPnl = unrealized + realized + dividends;
    const dayChange = holdings.reduce((sum, holding) => sum + holding.dayChange, 0);

    holdings.forEach((holding) => {
      holding.weight = totalValue > 0 ? holding.value / totalValue : 0;
    });

    return {
      holdings: holdings.sort((a, b) => b.value - a.value),
      invested,
      totalValue,
      totalCost,
      totalPnl,
      realized,
      dividends,
      dayChange,
      dayChangeRate: totalValue ? dayChange / (totalValue - dayChange) : 0,
      totalPnlRate: invested ? totalPnl / invested : 0,
      cash: cashHolding
    };
  }

  function render() {
    const portfolio = computePortfolio();
    renderMetrics(portfolio);
    renderHoldings(portfolio);
    renderTransactions();
    renderRecent();
    renderRisk(portfolio);
    renderNotes();
    drawWealthChart(portfolio);
    drawAllocationChart(portfolio);
  }

  function renderMetrics(portfolio) {
    els.totalValue.textContent = money(portfolio.totalValue);
    els.totalCost.textContent = `累计转入 ${money(portfolio.invested)}`;
    els.totalPnl.innerHTML = colorText(portfolio.totalPnl, moneySigned(portfolio.totalPnl));
    els.totalPnlRate.innerHTML = colorText(portfolio.totalPnlRate, percentSigned(portfolio.totalPnlRate));
    els.dayChange.innerHTML = colorText(portfolio.dayChange, moneySigned(portfolio.dayChange));
    els.dayChangeRate.innerHTML = colorText(portfolio.dayChangeRate, percentSigned(portfolio.dayChangeRate));
    els.cashValue.textContent = money(portfolio.cash.value);
    els.cashWeight.textContent = `${percent(portfolio.cash.weight)} of portfolio`;
  }

  function getTransactionGross(tx) {
    const rawQuantity = number(tx.quantity);
    const price = number(tx.price);
    if (tx.inputMode === "amount" && (isBuyAction(tx.action) || isSellAction(tx.action) || isCashInAction(tx.action) || isCashOutAction(tx.action) || isDividendAction(tx.action))) {
      return rawQuantity;
    }
    return rawQuantity * price;
  }

  function getTransactionShares(tx) {
    const rawQuantity = number(tx.quantity);
    const price = number(tx.price);
    if (tx.inputMode === "amount" && (isBuyAction(tx.action) || isSellAction(tx.action))) {
      return price > 0 ? rawQuantity / price : 0;
    }
    return rawQuantity;
  }

  function formatTransactionQuantity(tx) {
    const shares = getTransactionShares(tx);
    if (tx.inputMode === "amount" && (isBuyAction(tx.action) || isSellAction(tx.action))) {
      return `${money(number(tx.quantity), tx.currency)} / ${formatNumber(shares)}份`;
    }
    return formatNumber(number(tx.quantity));
  }

  function renderHoldings(portfolio) {
    const ownedSymbols = new Set(portfolio.holdings.map((holding) => holding.symbol));
    const watchOnly = getWatchOnlyRows(ownedSymbols);
    const combined = [...portfolio.holdings, ...watchOnly];
    const filtered = combined.filter((holding) => activeType === "all" || holding.type === activeType);
    els.holdingsBody.innerHTML = filtered.map(holdingRow).join("");
    els.topHoldingsBody.innerHTML = portfolio.holdings.slice(0, 5).map(topHoldingRow).join("");
  }

  function handleTransactionFilterClick(event) {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    activeTransactionFilter = button.dataset.filter || "all";
    syncTransactionFilterButtons();
    renderTransactions();
  }

  function syncTransactionFilterButtons() {
    if (!els.transactionFilters) return;
    els.transactionFilters.querySelectorAll("button[data-filter]").forEach((button) => {
      button.classList.toggle("active", (button.dataset.filter || "all") === activeTransactionFilter);
    });
  }

  function getFilteredTransactions() {
    return getSortedTransactions().filter((tx) => transactionMatchesFilter(tx, activeTransactionFilter));
  }

  function transactionMatchesFilter(tx, filter) {
    const status = tx.status || "confirmed";
    if (!filter || filter === "all") return true;
    if (filter === "pending") return status === "pending";
    return tx.action === filter;
  }

  function transactionStatusClass(status) {
    return status || "confirmed";
  }

  function transactionActionClass(action) {
    return `action-${action || "buy"}`;
  }

  function transactionActionLabel(action) {
    return actionNames[action] || action || "";
  }

  function transactionActionGlyph(action) {
    const label = transactionActionLabel(action);
    return label.length > 2 ? label.slice(0, 2) : label;
  }

  function renderTransactionSummary(transactions) {
    if (!els.transactionSummary) return;
    const rows = transactions || [];
    const all = getSortedTransactions();
    const confirmed = all.filter((tx) => (tx.status || "confirmed") === "confirmed");
    const pending = all.filter((tx) => (tx.status || "confirmed") === "pending");
    const visibleAmount = rows.reduce((sum, tx) => sum + getTransactionGross(tx), 0);
    const activeLabel = activeTransactionFilter === "all" ? "全部记录" : (activeTransactionFilter === "pending" ? "进行中" : (actionNames[activeTransactionFilter] || activeTransactionFilter));
    els.transactionSummary.innerHTML = [
      { label: "当前筛选", value: activeLabel },
      { label: "显示记录", value: `${rows.length} 条` },
      { label: "进行中", value: `${pending.length} 条` },
      { label: "显示金额", value: money(visibleAmount) }
    ].map((item) => `
      <article class="summary-tile">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </article>
    `).join("");
  }

  function renderTransactionRecords(transactions) {
    if (!els.transactionRecordList) return;
    const rows = (transactions || []).slice().reverse();
    els.transactionRecordList.innerHTML = rows.length
      ? rows.map((tx) => transactionRecordItem(tx)).join("")
      : `<article class="record-empty"><strong>暂无匹配记录</strong><span>先新增一笔交易，或切换筛选条件。</span></article>`;
  }

  function transactionRecordItem(tx, options = {}) {
    const status = tx.status || "confirmed";
    const compact = Boolean(options.compact);
    const includeActions = options.includeActions !== false;
    return `
      <article class="record-item ${transactionActionClass(tx.action)} ${compact ? "compact" : ""}" data-tx-id="${escapeHtml(tx.id)}">
        <div class="record-icon ${transactionActionClass(tx.action)}">${escapeHtml(transactionActionGlyph(tx.action))}</div>
        <div class="record-body">
          <div class="record-head">
            <div class="record-title">
              <strong>${escapeHtml(tx.name || tx.symbol)}</strong>
              <span>${escapeHtml(tx.symbol)} · ${escapeHtml(formatTransactionDateTime(tx))}</span>
            </div>
            <div class="record-meta">
              <span class="record-amount">${money(getTransactionGross(tx), tx.currency)}</span>
              <span class="status-pill ${transactionStatusClass(status)}">${escapeHtml(statusNames[status] || status)}</span>
            </div>
          </div>
          <div class="record-sub">
            <span>${escapeHtml(transactionActionLabel(tx.action))} · ${escapeHtml(formatTransactionQuantity(tx))}</span>
            <span>${escapeHtml(tx.account || "")}</span>
          </div>
          ${tx.note ? `<div class="record-note">${escapeHtml(tx.note)}</div>` : ""}
        </div>
        ${includeActions ? `
          <div class="record-actions">
            <button type="button" data-action="detail" data-symbol="${escapeHtml(tx.symbol)}" data-type="${escapeHtml(tx.type)}">详情</button>
            <button type="button" data-action="edit-tx" data-tx-id="${escapeHtml(tx.id)}">编辑</button>
          </div>
        ` : ""}
      </article>
    `;
  }

  function getWatchOnlyRows(ownedSymbols) {
    return (state.watchlist || [])
      .filter((item) => !ownedSymbols.has(item.symbol))
      .map((item) => {
        const price = state.prices[item.symbol] ?? 0;
        return {
          ...item,
          account: "自选",
          quantity: 0,
          avgCost: 0,
          price,
          value: 0,
          pnl: 0,
          pnlRate: 0,
          weight: 0,
          watchOnly: true
        };
      });
  }

  function holdingRow(holding) {
    return `
      <tr data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
        <td>
          <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
            <strong>${escapeHtml(holding.symbol)}</strong>
            <span>${escapeHtml(holding.name)}${holding.watchOnly ? " · 自选" : ""}</span>
          </button>
        </td>
        <td>${escapeHtml(holding.account)}</td>
        <td>${holding.watchOnly ? "--" : formatNumber(holding.quantity)}</td>
        <td>${holding.watchOnly ? "--" : money(holding.avgCost, holding.currency)}</td>
        <td>${money(holding.price, holding.currency)}</td>
        <td>${holding.watchOnly ? "--" : money(holding.value)}</td>
        <td>${holding.watchOnly ? "--" : colorText(holding.pnl, `${moneySigned(holding.pnl)} · ${percentSigned(holding.pnlRate)}`)}</td>
        <td>${holding.watchOnly ? "自选" : percent(holding.weight)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">详情</button>
            ${holding.watchOnly ? `<button type="button" data-action="remove-watch" data-symbol="${escapeHtml(holding.symbol)}">移除</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }

  function topHoldingRow(holding) {
    return `
      <tr data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
        <td>
          <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">
            <strong>${escapeHtml(holding.symbol)}</strong>
            <span>${escapeHtml(holding.name)}</span>
          </button>
        </td>
        <td><span class="badge">${typeNames[holding.type] || holding.type}</span></td>
        <td>${money(holding.value)}</td>
        <td>${colorText(holding.pnl, moneySigned(holding.pnl))}</td>
        <td>${percent(holding.weight)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="detail" data-symbol="${escapeHtml(holding.symbol)}" data-type="${escapeHtml(holding.type)}">详情</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderTransactions() {
    const transactions = getFilteredTransactions();
    renderTransactionSummary(transactions);
    renderTransactionRecords(transactions);
    syncTransactionFilterButtons();
    els.transactionsBody.innerHTML = transactions
      .slice()
      .reverse()
      .map((tx) => {
        const amount = getTransactionGross(tx);
        return `
          <tr data-tx-id="${escapeHtml(tx.id)}">
            <td>${escapeHtml(formatTransactionDateTime(tx))}</td>
            <td><span class="badge">${actionNames[tx.action] || tx.action}</span></td>
            <td>
              <button class="symbol-cell symbol-link" type="button" data-action="detail" data-symbol="${escapeHtml(tx.symbol)}" data-type="${escapeHtml(tx.type)}">
                <strong>${escapeHtml(tx.symbol)}</strong>
                <span>${escapeHtml(tx.name)}</span>
              </button>
            </td>
            <td>${formatTransactionQuantity(tx)}</td>
            <td>${money(number(tx.price), tx.currency)}</td>
            <td>${money(amount, tx.currency)}</td>
            <td><span class="status-pill ${transactionStatusClass(tx.status || "confirmed")}">${escapeHtml(statusNames[tx.status || "confirmed"] || tx.status || "")}</span></td>
            <td>${escapeHtml(tx.note || "")}</td>
            <td>
              <div class="row-actions">
                <button type="button" data-action="edit-tx" data-tx-id="${escapeHtml(tx.id)}">编辑</button>
                <button type="button" data-action="detail" data-symbol="${escapeHtml(tx.symbol)}" data-type="${escapeHtml(tx.type)}">详情</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderRecent() {
    els.recentTransactions.innerHTML = getSortedTransactions()
      .slice()
      .reverse()
      .slice(0, 5)
      .map((tx) => {
        const amount = getTransactionGross(tx);
        return `
          <article class="activity-item">
            <strong>${escapeHtml(formatTransactionDateTime(tx))} · ${transactionActionLabel(tx.action)} ${escapeHtml(tx.symbol)}</strong>
            <span>${escapeHtml(tx.name)} · ${money(amount, tx.currency)} · ${escapeHtml(statusNames[tx.status || "confirmed"] || tx.status || "")}</span>
          </article>
        `;
      })
      .join("");
  }

  function renderRisk(portfolio) {
    const nonCash = portfolio.holdings.filter((item) => item.type !== "cash");
    const largest = nonCash[0];
    const stockWeight = nonCash.filter((item) => item.type === "stock").reduce((sum, item) => sum + item.weight, 0);
    const fundWeight = nonCash.filter((item) => item.type === "fund" || item.type === "etf").reduce((sum, item) => sum + item.weight, 0);
    const risks = [
      {
        title: largest ? `最大单一持仓：${largest.symbol}` : "暂无风险",
        body: largest ? `${largest.name} 当前仓位 ${percent(largest.weight)}，超过 25% 时建议重点复盘。` : "还没有录入持仓。"
      },
      {
        title: "权益资产占比",
        body: `股票 ${percent(stockWeight)}，基金/ETF ${percent(fundWeight)}，现金 ${percent(portfolio.cash.weight)}。`
      },
      {
        title: "数据完整性",
        body: "交易流水是收益计算的基础，真实使用时应优先支持券商 CSV 导入和手动校验。"
      }
    ];

    els.riskList.innerHTML = risks
      .map((risk) => `
        <article class="risk-item">
          <strong>${escapeHtml(risk.title)}</strong>
          <span>${escapeHtml(risk.body)}</span>
        </article>
      `)
      .join("");
  }

  function renderNotes() {
    const notes = getSortedTransactions()
      .filter((tx) => tx.note)
      .slice()
      .reverse()
      .slice(0, 6);

    els.noteList.innerHTML = notes
      .map((tx) => `
        <article class="note-item">
          <strong>${escapeHtml(formatTransactionDateTime(tx))} · ${escapeHtml(tx.symbol)} · ${transactionActionLabel(tx.action)}</strong>
          <span>${escapeHtml(tx.note)}</span>
        </article>
      `)
      .join("");
  }

  function drawWealthChart(portfolio) {
    const canvas = els.wealthChart;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(640, Math.floor(rect.width * dpr));
    canvas.height = Math.floor(320 * dpr);
    ctx.scale(dpr, dpr);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const padding = { top: 18, right: 18, bottom: 32, left: 58 };
    const points = buildWealthSeries(portfolio, activeRange);
    const values = points.map((point) => point.value);
    const min = Math.min(...values) * 0.985;
    const max = Math.max(...values) * 1.015;

    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx, width, height, padding, min, max);

    const x = (index) => padding.left + (index / (points.length - 1)) * (width - padding.left - padding.right);
    const y = (value) => padding.top + (1 - (value - min) / (max - min || 1)) * (height - padding.top - padding.bottom);

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, "rgba(52, 211, 153, 0.32)");
    gradient.addColorStop(1, "rgba(52, 211, 153, 0)");

    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(index);
      const py = y(point.value);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineTo(x(points.length - 1), height - padding.bottom);
    ctx.lineTo(x(0), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(index);
      const py = y(point.value);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 3;
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.fillStyle = getTextColor();
    ctx.font = "700 13px Segoe UI";
    ctx.fillText(`当前 ${money(last.value)}`, padding.left, padding.top + 12);
    ctx.fillStyle = getMutedColor();
    ctx.font = "12px Segoe UI";
    ctx.fillText(points[0].date, padding.left, height - 10);
    ctx.textAlign = "right";
    ctx.fillText(last.date, width - padding.right, height - 10);
    ctx.textAlign = "left";
  }

  function drawGrid(ctx, width, height, padding, min, max) {
    ctx.strokeStyle = getLineColor();
    ctx.lineWidth = 1;
    ctx.fillStyle = getMutedColor();
    ctx.font = "12px Segoe UI";
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (i / 4) * (height - padding.top - padding.bottom);
      const value = max - (i / 4) * (max - min);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(shortMoney(value), 8, y + 4);
    }
  }

  function buildWealthSeries(portfolio, range) {
    const days = range === "1m" ? 30 : range === "1y" ? 365 : 90;
    const now = new Date();
    const points = [];
    const base = portfolio.totalValue || 1;
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - index);
      const progress = (days - index) / days;
      const wave = Math.sin(progress * Math.PI * 4) * 0.025 + Math.cos(progress * Math.PI * 2.2) * 0.018;
      const slope = (progress - 1) * -0.07;
      const value = base * (1 + slope + wave);
      points.push({
        date: date.toISOString().slice(5, 10),
        value
      });
    }
    points[points.length - 1].value = base;
    return points;
  }

  function drawAllocationChart(portfolio) {
    const canvas = els.allocationChart;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 260 * dpr;
    canvas.height = 260 * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 260, 260);

    const grouped = groupByType(portfolio.holdings);
    const total = grouped.reduce((sum, item) => sum + item.value, 0) || 1;
    let angle = -Math.PI / 2;

    grouped.forEach((item, index) => {
      const slice = (item.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(130, 130);
      ctx.arc(130, 130, 102, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = palette[index % palette.length];
      ctx.fill();
      angle += slice;
    });

    ctx.beginPath();
    ctx.arc(130, 130, 58, 0, Math.PI * 2);
    ctx.fillStyle = getSurfaceColor();
    ctx.fill();

    ctx.fillStyle = getTextColor();
    ctx.font = "800 20px Cascadia Mono, Consolas";
    ctx.textAlign = "center";
    ctx.fillText(percent(1 - portfolio.cash.weight), 130, 126);
    ctx.fillStyle = getMutedColor();
    ctx.font = "12px Segoe UI";
    ctx.fillText("权益仓位", 130, 148);
    ctx.textAlign = "left";

    els.allocationLegend.innerHTML = grouped
      .map((item, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${palette[index % palette.length]}"></span>
          <span>${typeNames[item.type] || item.type}</span>
          <strong>${percent(item.value / total)}</strong>
        </div>
      `)
      .join("");
  }

  function groupByType(holdings) {
    const map = new Map();
    holdings.forEach((holding) => {
      const current = map.get(holding.type) || { type: holding.type, value: 0 };
      current.value += Math.max(0, holding.value);
      map.set(holding.type, current);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }

  function openDrawer() {
    resetTransactionForm();
    setTransactionDrawerMode("transaction");
    els.backdrop.hidden = false;
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    document.getElementById("txDate").focus();
  }

  function openWatchlistDrawer() {
    els.form.reset();
    els.form.dataset.mode = "watchlist";
    delete els.form.dataset.editId;
    document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("txTime").value = "15:01";
    document.getElementById("txAction").value = "buy";
    document.getElementById("txStatus").value = "confirmed";
    document.getElementById("txInputMode").value = "amount";
    document.getElementById("txQuantity").value = "0";
    document.getElementById("txPrice").value = "1";
    document.getElementById("txFee").value = "0";
    document.getElementById("txAccount").value = "自选";
    updateInputModeLabels();
    setTransactionDrawerMode("watchlist");
    hideLookupPanel();
    els.backdrop.hidden = false;
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    showToast("输入代码后保存为自选");
    document.getElementById("txSymbol").focus();
  }

  function closeDrawer() {
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
    closeInstrumentDrawer();
    setTimeout(() => {
      if (!els.drawer.classList.contains("open")) els.backdrop.hidden = true;
    }, 180);
  }

  function closeInstrumentDrawer() {
    els.instrumentDrawer.classList.remove("open");
    els.instrumentDrawer.setAttribute("aria-hidden", "true");
    if (!els.drawer.classList.contains("open")) {
      setTimeout(() => {
        if (!els.instrumentDrawer.classList.contains("open") && !els.drawer.classList.contains("open")) els.backdrop.hidden = true;
      }, 180);
    }
  }

  function updateInputModeLabels() {
    const mode = document.getElementById("txInputMode").value;
    const type = document.getElementById("txType").value;
    const label = document.getElementById("txQuantityLabel");
    const priceLabel = document.getElementById("txPriceLabel");
    label.textContent = mode === "amount" ? "金额" : "份额";
    priceLabel.textContent = (type === "fund" || type === "etf") ? "买入净值" : "价格";
  }

  function handleHoldingsAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const symbol = button.dataset.symbol;
    const type = button.dataset.type || "fund";
    if (action === "detail") openInstrumentDetail(symbol, type);
    if (action === "remove-watch") removeWatchlist(symbol);
  }

  function handleTransactionAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "edit-tx") editTransaction(button.dataset.txId);
    if (action === "detail") openInstrumentDetail(button.dataset.symbol, button.dataset.type || "fund");
  }

  function removeWatchlist(symbol) {
    state.watchlist = (state.watchlist || []).filter((item) => item.symbol !== symbol);
    persist();
    render();
    showToast("已移除自选");
  }

  function editTransaction(txId) {
    const tx = state.transactions.find((item) => item.id === txId);
    if (!tx) return;
    closeInstrumentDrawer();
    els.form.dataset.mode = "transaction";
    els.form.dataset.editId = txId;
    setTransactionDrawerMode("edit");
    document.getElementById("txDate").value = tx.date || new Date().toISOString().slice(0, 10);
    document.getElementById("txTime").value = tx.time || "15:01";
    document.getElementById("txAction").value = tx.action || "buy";
    document.getElementById("txStatus").value = tx.status || "confirmed";
    document.getElementById("txSymbol").value = tx.symbol || "";
    document.getElementById("txName").value = tx.name || "";
    document.getElementById("txType").value = tx.type || "fund";
    document.getElementById("txAccount").value = tx.account || "主账户";
    document.getElementById("txInputMode").value = tx.inputMode || "shares";
    document.getElementById("txQuantity").value = String(number(tx.quantity));
    document.getElementById("txPrice").value = String(number(tx.price));
    document.getElementById("txFee").value = String(number(tx.fee));
    document.getElementById("txCurrency").value = tx.currency || "CNY";
    document.getElementById("txNote").value = tx.note || "";
    updateInputModeLabels();
    els.backdrop.hidden = false;
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    handleSymbolInput();
  }

  function setTransactionDrawerMode(mode) {
    if (mode === "edit") {
      els.transactionDrawerEyebrow.textContent = "Edit Transaction";
      els.transactionDrawerTitle.textContent = "编辑交易";
      els.saveTransactionButton.textContent = "更新交易";
      return;
    }
    if (mode === "watchlist") {
      els.transactionDrawerEyebrow.textContent = "Watchlist";
      els.transactionDrawerTitle.textContent = "添加自选";
      els.saveTransactionButton.textContent = "保存自选";
      return;
    }
    els.transactionDrawerEyebrow.textContent = "New Transaction";
    els.transactionDrawerTitle.textContent = "新增交易";
    els.saveTransactionButton.textContent = "保存交易";
  }

  async function openInstrumentDetail(symbol, type = "fund") {
    const portfolio = computePortfolio();
    const holding = portfolio.holdings.find((item) => item.symbol === symbol)
      || getWatchOnlyRows(new Set()).find((item) => item.symbol === symbol)
      || { symbol, name: symbol, type, currency: "CNY", value: 0, pnl: 0, weight: 0, quantity: 0, price: 0 };
    els.instrumentTitle.textContent = `${holding.symbol} · ${holding.name}`;
    els.instrumentSummary.innerHTML = [
      { label: "市值", value: holding.value ? money(holding.value) : "自选关注" },
      { label: "持有份额", value: holding.quantity ? formatNumber(holding.quantity) : "--" },
      { label: "盈亏", value: holding.value ? `${moneySigned(holding.pnl)} · ${percentSigned(holding.pnlRate)}` : "--", signed: holding.pnl }
    ].map((item) => `
      <div class="summary-card">
        <span>${escapeHtml(item.label)}</span>
        <strong>${item.signed === undefined ? escapeHtml(item.value) : colorText(item.signed, escapeHtml(item.value))}</strong>
      </div>
    `).join("");
    els.instrumentTransactions.innerHTML = state.transactions
      .filter((tx) => tx.symbol === symbol)
      .slice()
      .reverse()
      .map((tx) => transactionRecordItem(tx, { compact: true }))
      .join("") || `<article class="record-empty"><strong>暂无交易</strong><span>这是自选关注标的，还没有买入流水。</span></article>`;
    els.instrumentStatus.textContent = "查询中";
    els.backdrop.hidden = false;
    els.instrumentDrawer.classList.add("open");
    els.instrumentDrawer.setAttribute("aria-hidden", "false");

    try {
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(symbol)}?kind=${encodeURIComponent(type)}`);
      els.instrumentStatus.textContent = data.trend?.length ? "已更新" : "已匹配";
      if (data.name) els.instrumentTitle.textContent = `${data.code} · ${data.name}`;
      drawLineChart(els.instrumentTrendChart, data.trend || [], { height: 220, emptyText: "该标的暂无曲线数据" });
    } catch (error) {
      els.instrumentStatus.textContent = "查询失败";
      drawLineChart(els.instrumentTrendChart, [], { height: 220, emptyText: error.message || "查询失败" });
    }
  }

  async function handleSymbolInput() {
    const symbolInput = document.getElementById("txSymbol");
    const symbol = normalizeSymbol(symbolInput.value);
    if (symbol !== symbolInput.value) symbolInput.value = symbol;

    if (!symbol) {
      latestLookup = null;
      hideLookupPanel();
      return;
    }

    if (/^\d{6}$/.test(symbol) || /^[A-Z.]{1,8}$/.test(symbol)) {
      await lookupInstrument(symbol);
      return;
    }

    await searchInstrumentCandidates(symbol);
  }

  async function handleNameSearchInput() {
    const query = document.getElementById("txName").value.trim();
    if (!query) {
      hideSearchResults();
      return;
    }
    await searchInstrumentCandidates(query);
  }

  async function searchInstrumentCandidates(query) {
    const q = String(query || "").trim();
    if (q.length < 2) {
      hideSearchResults();
      return;
    }
    try {
      const data = await fetchJson(`/api/search?q=${encodeURIComponent(q)}`);
      renderSearchResults(data.results || []);
    } catch (error) {
      renderSearchResults([], error.message || "搜索失败");
    }
  }

  function renderSearchResults(results, errorText = "") {
    if (!results.length) {
      els.searchResults.hidden = false;
      els.searchResults.innerHTML = `<div class="search-result"><div><strong>${escapeHtml(errorText || "没有匹配结果")}</strong><span>换一个关键词或直接输入代码</span></div></div>`;
      return;
    }
    els.searchResults.hidden = false;
    els.searchResults.innerHTML = results.map((item) => `
      <button class="search-result" type="button"
        data-code="${escapeHtml(item.code)}"
        data-name="${escapeHtml(item.name)}"
        data-type="${escapeHtml(item.type || "fund")}"
        data-currency="${escapeHtml(item.currency || "CNY")}">
        <div>
          <strong>${escapeHtml(item.code)} · ${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.subtitle || item.source || "")}</span>
        </div>
        <small>${escapeHtml(typeNames[item.type] || item.type || "")}</small>
      </button>
    `).join("");
  }

  function hideSearchResults() {
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
  }

  function handleSearchResultClick(event) {
    const button = event.target.closest(".search-result[data-code]");
    if (!button) return;
    document.getElementById("txSymbol").value = button.dataset.code || "";
    document.getElementById("txName").value = button.dataset.name || "";
    document.getElementById("txType").value = button.dataset.type || "fund";
    document.getElementById("txCurrency").value = button.dataset.currency || "CNY";
    hideSearchResults();
    handleSymbolInput();
  }

  async function lookupInstrument(code) {
    const kind = document.getElementById("txType").value;
    const date = document.getElementById("txDate").value;
    const time = document.getElementById("txTime").value;
    const cacheKey = `${kind}:${code}:${date || ""}:${time || ""}`;
    showLookupPanel("查询中", code, []);
    try {
      const cached = lookupBySymbol.get(cacheKey);
      const data = cached || await fetchJson(`/api/instrument/${encodeURIComponent(code)}?kind=${encodeURIComponent(kind)}&date=${encodeURIComponent(date || "")}&time=${encodeURIComponent(time || "")}`);
      lookupBySymbol.set(cacheKey, data);
      lookupBySymbol.set(code, data);
      latestLookup = data;
      applyLookupToForm(data);
      renderLookup(data);
      hideSearchResults();
      showToast(`已匹配 ${data.name}`);
    } catch (error) {
      latestLookup = null;
      showLookupPanel("未匹配", code, [{ label: "错误", value: error.message || "查询失败" }]);
    }
  }

  function applyLookupToForm(data) {
    const nameInput = document.getElementById("txName");
    const typeInput = document.getElementById("txType");
    const priceInput = document.getElementById("txPrice");
    const currencyInput = document.getElementById("txCurrency");

    nameInput.value = data.name || data.code;
    typeInput.value = data.type || "fund";
    currencyInput.value = data.currency || "CNY";
    if (Number.isFinite(data.priceOnDate)) priceInput.value = String(data.priceOnDate);
    else if (Number.isFinite(data.estimatedNav)) priceInput.value = String(data.estimatedNav);
    else if (Number.isFinite(data.nav)) priceInput.value = String(data.nav);
    else if (Number.isFinite(data.price)) priceInput.value = String(data.price);
  }

  function renderLookup(data) {
    const isFund = data.type === "fund" || data.type === "etf" || (data.trend || []).length > 0;
    const stats = isFund
      ? [
      { label: "买入日净值", value: Number.isFinite(data.priceOnDate) ? `${data.priceOnDate.toFixed(4)}${data.priceDate ? ` · ${data.priceDate}` : ""}` : "--" },
          { label: "确认净值", value: Number.isFinite(data.nav) ? `${data.nav.toFixed(4)}${data.navDate ? ` · ${data.navDate}` : ""}` : "--" },
          { label: "估算净值", value: Number.isFinite(data.estimatedNav) ? data.estimatedNav.toFixed(4) : "--" },
          { label: "估算涨跌", value: Number.isFinite(data.estimatedChangePct) ? `${data.estimatedChangePct.toFixed(2)}%` : "--", signed: data.estimatedChangePct }
        ]
      : [
          { label: "最新价", value: Number.isFinite(data.price) ? data.price.toFixed(2) : "--" },
          { label: "昨收", value: Number.isFinite(data.previousClose) ? data.previousClose.toFixed(2) : "--" },
          { label: "涨跌幅", value: Number.isFinite(data.estimatedChangePct) ? `${data.estimatedChangePct.toFixed(2)}%` : "--", signed: data.estimatedChangePct },
          { label: "币种", value: data.currency || "--" }
        ];

    showLookupPanel("已匹配", `${data.code} · ${data.name}`, stats);
    drawFundTrendChart(data.trend || []);
  }

  function showLookupPanel(status, title, stats) {
    els.lookupPanel.hidden = false;
    els.lookupStatus.textContent = status;
    els.lookupTitle.textContent = title || "基金信息";
    els.lookupStats.innerHTML = stats
      .map((stat) => `
        <div class="lookup-stat">
          <span>${escapeHtml(stat.label)}</span>
          <strong>${stat.signed === undefined ? escapeHtml(stat.value) : colorText(stat.signed, escapeHtml(stat.value))}</strong>
        </div>
      `)
      .join("");
    if (!stats.length) drawFundTrendChart([]);
  }

  function hideLookupPanel() {
    els.lookupPanel.hidden = true;
    els.lookupTitle.textContent = "基金信息";
    els.lookupStatus.textContent = "待查询";
    els.lookupStats.innerHTML = "";
    drawFundTrendChart([]);
  }

  function drawFundTrendChart(trend) {
    drawLineChart(els.fundTrendChart, trend, { height: 180, emptyText: "输入 6 位基金代码后显示净值曲线" });
  }

  function drawLineChart(canvas, trend, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(360, Math.floor((rect.width || 500) * dpr));
    const chartHeight = options.height || 180;
    const height = Math.floor(chartHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    ctx.scale(dpr, dpr);

    const cssWidth = width / dpr;
    const cssHeight = height / dpr;
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const points = trend.slice(-260);
    if (points.length < 2) {
      ctx.fillStyle = getMutedColor();
      ctx.font = "12px Segoe UI";
      ctx.fillText(options.emptyText || "暂无曲线数据", 12, 28);
      return;
    }

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = { top: 16, right: 12, bottom: 24, left: 44 };
    const x = (index) => padding.left + (index / (points.length - 1)) * (cssWidth - padding.left - padding.right);
    const y = (value) => padding.top + (1 - (value - min) / (max - min || 1)) * (cssHeight - padding.top - padding.bottom);

    ctx.strokeStyle = getLineColor();
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i += 1) {
      const gy = padding.top + (i / 3) * (cssHeight - padding.top - padding.bottom);
      ctx.beginPath();
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(cssWidth - padding.right, gy);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, padding.top, 0, cssHeight - padding.bottom);
    gradient.addColorStop(0, "rgba(96, 165, 250, 0.28)");
    gradient.addColorStop(1, "rgba(96, 165, 250, 0)");
    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(index);
      const py = y(point.value);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineTo(x(points.length - 1), cssHeight - padding.bottom);
    ctx.lineTo(x(0), cssHeight - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(index);
      const py = y(point.value);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = getMutedColor();
    ctx.font = "11px Segoe UI";
    ctx.fillText(max.toFixed(4), 6, padding.top + 4);
    ctx.fillText(min.toFixed(4), 6, cssHeight - padding.bottom + 4);
    ctx.fillText(points[0].date.slice(5), padding.left, cssHeight - 6);
    ctx.textAlign = "right";
    ctx.fillText(points[points.length - 1].date.slice(5), cssWidth - padding.right, cssHeight - 6);
    ctx.textAlign = "left";
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
    return data;
  }

  function normalizeSymbol(value) {
    return String(value || "").trim().toUpperCase();
  }

  async function saveTransaction(event) {
    event.preventDefault();
    const formData = new FormData(els.form);
    const mode = els.form.dataset.mode || "transaction";
    const tx = {
      id: els.form.dataset.editId || `tx-${Date.now()}`,
      date: String(formData.get("date")),
      time: String(formData.get("time") || ""),
      action: String(formData.get("action")),
      status: String(formData.get("status") || "confirmed"),
      symbol: String(formData.get("symbol")).trim().toUpperCase(),
      name: String(formData.get("name")).trim(),
      type: String(formData.get("type")),
      account: String(formData.get("account")).trim(),
      inputMode: String(formData.get("inputMode") || "shares"),
      quantity: number(formData.get("quantity")),
      price: number(formData.get("price")),
      fee: number(formData.get("fee")),
      currency: String(formData.get("currency")),
      note: String(formData.get("note")).trim()
    };
    await hydrateTransactionPrice(tx);
    const matchedLookup = latestLookup?.code === tx.symbol ? latestLookup : lookupBySymbol.get(tx.symbol);

    if (mode === "watchlist") {
      addWatchlistItem(tx, matchedLookup);
      resetTransactionForm();
      closeDrawer();
      render();
      showToast("已添加自选");
      return;
    }

    const editIndex = state.transactions.findIndex((item) => item.id === tx.id);
    if (editIndex >= 0) state.transactions[editIndex] = tx;
    else state.transactions.push(tx);

    state.prices[tx.symbol] = Number.isFinite(matchedLookup?.nav)
      ? matchedLookup.nav
      : Number.isFinite(matchedLookup?.estimatedNav)
        ? matchedLookup.estimatedNav
        : tx.price;
    state.dayChangePct[tx.symbol] = Number.isFinite(matchedLookup?.estimatedChangePct)
      ? matchedLookup.estimatedChangePct / 100
      : (state.dayChangePct[tx.symbol] || 0);
    persist();
    resetTransactionForm();
    closeDrawer();
    render();
    showToast(editIndex >= 0 ? "交易已更新" : "交易已保存");
  }

  async function hydrateTransactionPrice(tx) {
    const shouldHydrate = (tx.type === "fund" || tx.type === "etf")
      && tx.inputMode === "amount"
      && (isBuyAction(tx.action) || isSellAction(tx.action))
      && tx.symbol
      && (!number(tx.price) || number(tx.price) === 1);
    if (!shouldHydrate) return;
    try {
      const data = await fetchJson(`/api/instrument/${encodeURIComponent(tx.symbol)}?kind=${encodeURIComponent(tx.type)}&date=${encodeURIComponent(tx.date || "")}&time=${encodeURIComponent(tx.time || "")}`);
      latestLookup = data;
      if (Number.isFinite(data.priceOnDate)) tx.price = data.priceOnDate;
      else if (Number.isFinite(data.nav)) tx.price = data.nav;
    } catch {
      // Keep the manually entered price when historical lookup is unavailable.
    }
  }

  function addWatchlistItem(tx, lookup) {
    const item = {
      symbol: tx.symbol,
      name: lookup?.name || tx.name || tx.symbol,
      type: lookup?.type || tx.type || "fund",
      currency: lookup?.currency || tx.currency || "CNY",
      note: tx.note
    };
    state.watchlist = (state.watchlist || []).filter((existing) => existing.symbol !== item.symbol);
    state.watchlist.push(item);
    if (Number.isFinite(lookup?.nav)) state.prices[item.symbol] = lookup.nav;
    else if (Number.isFinite(lookup?.estimatedNav)) state.prices[item.symbol] = lookup.estimatedNav;
    else if (Number.isFinite(lookup?.price)) state.prices[item.symbol] = lookup.price;
    if (Number.isFinite(lookup?.estimatedChangePct)) state.dayChangePct[item.symbol] = lookup.estimatedChangePct / 100;
    persist();
  }

  function resetTransactionForm() {
    els.form.reset();
    els.form.dataset.mode = "transaction";
    delete els.form.dataset.editId;
    latestLookup = null;
    hideLookupPanel();
    hideSearchResults();
    document.getElementById("txDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("txTime").value = "15:01";
    document.getElementById("txStatus").value = "confirmed";
    document.getElementById("txInputMode").value = "amount";
    document.getElementById("txQuantity").value = "2000";
    document.getElementById("txPrice").value = "1";
    document.getElementById("txFee").value = "0";
    document.getElementById("txAccount").value = "主账户";
    updateInputModeLabels();
  }

  function fillSampleTransaction() {
    document.getElementById("txDate").value = "2026-03-23";
    document.getElementById("txTime").value = "20:28";
    document.getElementById("txAction").value = "buy";
    document.getElementById("txStatus").value = "confirmed";
    document.getElementById("txSymbol").value = "002611";
    document.getElementById("txName").value = "博时黄金ETF联接C";
    document.getElementById("txType").value = "fund";
    document.getElementById("txAccount").value = "基金账户";
    document.getElementById("txInputMode").value = "amount";
    document.getElementById("txQuantity").value = "2000";
    document.getElementById("txPrice").value = "1";
    document.getElementById("txFee").value = "0";
    document.getElementById("txCurrency").value = "CNY";
    document.getElementById("txNote").value = "示例：输入基金代码后自动匹配名称和净值曲线";
    updateInputModeLabels();
    handleSymbolInput();
  }

  function resetSample() {
    localStorage.removeItem(storageKey);
    const next = JSON.parse(JSON.stringify(sampleState));
    state.prices = next.prices;
    state.dayChangePct = next.dayChangePct;
    state.transactions = next.transactions;
    state.watchlist = next.watchlist || [];
    persist();
    render();
    showToast("已恢复示例数据");
  }

  function exportCsv() {
    const header = ["date", "time", "action", "status", "symbol", "name", "type", "account", "quantity", "price", "fee", "currency", "note"];
    const rows = state.transactions.map((tx) => header.map((key) => csvCell(tx[key])).join(","));
    const csv = [header.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nanstar-wealth-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("CSV 已导出");
  }

  function getSortedTransactions() {
    return state.transactions.slice().sort((a, b) => {
      const left = `${a.date || ""} ${a.time || ""}`;
      const right = `${b.date || ""} ${b.time || ""}`;
      return left.localeCompare(right);
    });
  }

  function formatTransactionDateTime(tx) {
    if (!tx) return "";
    return tx.time ? `${tx.date} ${tx.time}` : tx.date;
  }

  function colorText(value, text) {
    const cls = value >= 0 ? "positive" : "negative";
    return `<span class="${cls}">${text}</span>`;
  }

  function money(value, currency = "CNY") {
    const symbol = currency === "USD" ? "$" : currency === "HKD" ? "HK$" : "¥";
    return `${symbol}${formatNumber(value, 2)}`;
  }

  function shortMoney(value) {
    if (Math.abs(value) >= 10000) return `¥${formatNumber(value / 10000, 1)}万`;
    return money(value);
  }

  function moneySigned(value) {
    const sign = value >= 0 ? "+" : "-";
    return `${sign}${money(Math.abs(value))}`;
  }

  function percent(value) {
    return `${(number(value) * 100).toFixed(1)}%`;
  }

  function percentSigned(value) {
    const sign = value >= 0 ? "+" : "-";
    return `${sign}${percent(Math.abs(value))}`;
  }

  function formatNumber(value, digits = 2) {
    return Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  }

  function getCssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  }

  function getTextColor() {
    return getCssVar("--text") || "#f8fafc";
  }

  function getMutedColor() {
    return getCssVar("--muted") || "#94a3b8";
  }

  function getLineColor() {
    return getCssVar("--line") || "rgba(148, 163, 184, 0.18)";
  }

  function getSurfaceColor() {
    return getCssVar("--surface") || "#161b22";
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  window.addEventListener("resize", debounce(render, 160));

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
})();
