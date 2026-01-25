// =========================
// GOOGLE SHEETS SETTINGS
// =========================
const SHEET_ID = "16K_pRwbgO58TGwY_n8vHdH_lH-JG5U8wJ9pHl7XEcRE";
// ⚠️ Change to your exact tab name (bottom tab label in Google Sheets)
const TAB_NAME = "Sheet1";

// A: PUBLISH TIME (date+time), B GAME, C ODDS, D TIP, E OUTCOME, F STAKE SIZE, G PROFIT
function sheetUrl() {
    const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
    const params = new URLSearchParams({
        sheet: TAB_NAME,
        tq: "select A,B,C,D,E,F,G",
        tqx: "out:json",
    });
    return `${base}?${params.toString()}`;
}

// DOM
const tipsGrid = document.getElementById("tipsGrid");
const searchEl = document.getElementById("search");
const sortByEl = document.getElementById("sortBy");

const paginationWrap = document.getElementById("paginationWrap");
const paginationBtns = document.getElementById("paginationBtns");
const backToFirstBtn = document.getElementById("backToFirstBtn");

const totalProfitText = document.getElementById("totalProfitText");
const winLossText = document.getElementById("winLossText");
const winsCountEl = document.getElementById("winsCount");
const lossesCountEl = document.getElementById("lossesCount");
const refundCountEl = document.getElementById("refundCount");

const profitCanvas = document.getElementById("profitChart");
const profitCtx = profitCanvas.getContext("2d");

const stickySub = document.getElementById("stickySub");
const stickyChip = document.getElementById("stickyChip");

// Quick stats (hero left bubble)
const statWinRateEl = document.getElementById("statWinRate");
const statRoiEl = document.getElementById("statROI");
const statAvgOddsEl = document.getElementById("statAvgOdds");
const statUpdatedEl = document.getElementById("statUpdated");

// Toggles
const toggleFavorites = document.getElementById("toggleFavorites");
const toggleWins = document.getElementById("toggleWins");
const togglePending = document.getElementById("togglePending");

// Modal
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const modalPick = document.getElementById("modalPick");
const modalKv = document.getElementById("modalKv");
const modalOutcomePill = document.getElementById("modalOutcomePill");
const modalDatePill = document.getElementById("modalDatePill");
const modalFavBtn = document.getElementById("modalFavBtn");
const modalCopyBtn = document.getElementById("modalCopyBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalGoCalc = document.getElementById("modalGoCalc");
const modalShare = document.getElementById("modalShare");

// Toast
const toast = document.getElementById("toast");

let tips = [];
let currentPage = 1;
const PAGE_SIZE = 9;

// Local storage keys
const LS_FAVS = "bethouse_favs_v1";
const LS_FILTERS = "bethouse_filters_v1";

// State
let favs = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let filters = JSON.parse(localStorage.getItem(LS_FILTERS) || "{}");
let activeModalId = null;

// Last refresh time (for "Updated …")
let lastUpdatedAt = null;

// Helpers
function parseGviz(jsonText) {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    return JSON.parse(jsonText.slice(start, end + 1));
}

function escapeHtml(s) {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function toISOorDate(value) {
    if (value == null || value === "") return null;

    if (typeof value === "string" && value.startsWith("Date(")) {
        const parts = value
            .replace("Date(", "")
            .replace(")", "")
            .split(",")
            .map((n) => parseInt(n.trim(), 10));
        const [y, m, d, hh = 0, mm = 0, ss = 0] = parts;
        return new Date(y, m, d, hh, mm, ss).toISOString();
    }

    if (typeof value === "number" && isFinite(value)) {
        const ms = (value - 25569) * 86400 * 1000;
        const dt = new Date(ms);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }

    const dt = new Date(value);
    if (!isNaN(dt.getTime())) return dt.toISOString();

    return String(value);
}

function fmtPublishTime(isoOrString) {
    if (!isoOrString) return "—";
    const d = new Date(isoOrString);
    if (isNaN(d.getTime())) return String(isoOrString);
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function normalizeOutcome(outcomeRaw) {
    return (outcomeRaw ?? "").toString().trim().toLowerCase();
}
function isPendingOutcome(outcome) {
    return (
        !outcome ||
        outcome === "pending" ||
        outcome === "open" ||
        outcome === "unsettled" ||
        outcome === "tbd"
    );
}

function cardClassForOutcome(outcomeRaw) {
    const o = normalizeOutcome(outcomeRaw);
    if (o === "win" || o === "won") return "win";
    if (o === "lost" || o === "loss") return "loss";
    if (o === "refund" || o === "void" || o === "push") return "refund";
    if (isPendingOutcome(o)) return "pending";
    return "pending";
}

function outcomePill(outcomeRaw) {
    const o = normalizeOutcome(outcomeRaw);
    if (o === "win" || o === "won") return `<span class="pill green">WIN</span>`;
    if (o === "lost" || o === "loss") return `<span class="pill red">LOST</span>`;
    if (o === "refund" || o === "void" || o === "push") return `<span class="pill blue">REFUND</span>`;
    return `<span class="pill yellow">PENDING</span>`;
}

function outcomeText(outcomeRaw) {
    const o = normalizeOutcome(outcomeRaw);
    if (o === "win" || o === "won") return "WIN";
    if (o === "lost" || o === "loss") return "LOST";
    if (o === "refund" || o === "void" || o === "push") return "REFUND";
    return "PENDING";
}

function computeSignedProfit(profitRaw, outcomeRaw) {
    const o = normalizeOutcome(outcomeRaw);
    const n = Number(profitRaw);
    if (!isFinite(n)) return null;

    const abs = Math.abs(n);
    if (o === "win" || o === "won") return +abs;
    if (o === "lost" || o === "loss") return -abs;
    if (o === "refund" || o === "void" || o === "push") return 0;
    if (isPendingOutcome(o)) return 0;
    return n;
}

function formatStakeSize(stakeRaw) {
    if (stakeRaw == null || stakeRaw === "") return "—";
    const n = Number(stakeRaw);
    if (isFinite(n)) {
        const abs = Math.abs(n);
        const hasDecimals = Math.round(abs) !== abs;
        return hasDecimals ? abs.toFixed(2) : abs.toFixed(0);
    }
    return String(stakeRaw).trim();
}

function formatProfitForCard(profitRaw, outcomeRaw) {
    const o = normalizeOutcome(outcomeRaw);
    if (isPendingOutcome(o)) return { text: "—", cls: "", bold: false };

    if (profitRaw == null || profitRaw === "") return { text: "—", cls: "", bold: false };

    const n = Number(profitRaw);
    if (isFinite(n)) {
        const abs = Math.abs(n);
        const hasDecimals = Math.round(abs) !== abs;
        const base = hasDecimals ? abs.toFixed(2) : abs.toFixed(0);

        if (o === "win" || o === "won") return { text: `+${base}`, cls: "positive", bold: true };
        if (o === "lost" || o === "loss") return { text: `-${base}`, cls: "negative", bold: false };
        if (o === "refund" || o === "void" || o === "push") return { text: `0`, cls: "", bold: false };

        return { text: String(n), cls: "", bold: false };
    }

    const s = String(profitRaw).trim();
    const alreadySigned = s.startsWith("+") || s.startsWith("-");
    if (o === "win" || o === "won") return { text: alreadySigned ? s : "+" + s, cls: "positive", bold: true };
    if (o === "lost" || o === "loss") return { text: alreadySigned ? s : "-" + s, cls: "negative", bold: false };
    if (o === "refund" || o === "void" || o === "push") return { text: "0", cls: "", bold: false };
    return { text: s, cls: "", bold: false };
}

function tipId(t) {
    return btoa(unescape(encodeURIComponent(`${t.dateRaw}|${t.game}|${t.tip}|${t.odds}|${t.stakeRaw}`))).slice(0, 24);
}

function saveFavs() {
    localStorage.setItem(LS_FAVS, JSON.stringify([...favs]));
}

function saveFilters() {
    localStorage.setItem(LS_FILTERS, JSON.stringify(filters));
}

function toastMsg(title, message) {
    const el = document.createElement("div");
    el.className = "t";
    el.innerHTML = `
    <div>
      <div style="font-weight:950">${escapeHtml(title)}</div>
      <small>${escapeHtml(message)}</small>
    </div>
    <div class="x" title="Dismiss">✕</div>
  `;
    el.querySelector(".x").onclick = () => el.remove();
    toast.appendChild(el);
    setTimeout(() => { if (el.isConnected) el.remove(); }, 3600);
}

/* =========================
   PAGINATION
========================= */
function getPagedRows(rows) {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
}

function renderPagination(totalCount, isSearching) {
    if (isSearching) {
        paginationWrap.style.display = "none";
        return;
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    paginationWrap.style.display = totalPages > 1 ? "flex" : "none";

    backToFirstBtn.style.display = (currentPage > 1) ? "inline-flex" : "none";
    backToFirstBtn.onclick = () => {
        currentPage = 1;
        renderTips();
        document.getElementById("tips").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    paginationBtns.innerHTML = "";

    const makeBtn = (p) => {
        const b = document.createElement("button");
        b.className = "btn page" + (p === currentPage ? " active" : "");
        b.textContent = String(p);
        b.onclick = () => {
            currentPage = p;
            renderTips();
            document.getElementById("tips").scrollIntoView({ behavior: "smooth", block: "start" });
        };
        return b;
    };

    const makeDots = () => {
        const s = document.createElement("span");
        s.textContent = "…";
        s.style.color = "rgba(167,177,207,.85)";
        s.style.fontWeight = "950";
        s.style.padding = "0 6px";
        return s;
    };

    const total = totalPages;
    const p = currentPage;

    const pages = new Set([1, total, p, p - 1, p + 1, p - 2, p + 2]);
    const arr = [...pages].filter(x => x >= 1 && x <= total).sort((a, b) => a - b);

    let prev = 0;
    for (const page of arr) {
        if (prev && page - prev > 1) paginationBtns.appendChild(makeDots());
        paginationBtns.appendChild(makeBtn(page));
        prev = page;
    }
}

/* =========================
   FILTERS / TOGGLES
========================= */
function setToggle(el, on) {
    el.classList.toggle("on", !!on);
}

function initTogglesFromStorage() {
    setToggle(toggleFavorites, !!filters.favsOnly);
    setToggle(toggleWins, !!filters.winsOnly);
    setToggle(togglePending, !!filters.pendingOnly);

    if (filters.winsOnly && filters.pendingOnly) {
        filters.pendingOnly = false;
        setToggle(togglePending, false);
        saveFilters();
    }
}

toggleFavorites.onclick = () => {
    filters.favsOnly = !filters.favsOnly;
    setToggle(toggleFavorites, filters.favsOnly);
    saveFilters();
    currentPage = 1;
    renderTips();
};

toggleWins.onclick = () => {
    filters.winsOnly = !filters.winsOnly;
    if (filters.winsOnly) filters.pendingOnly = false;
    setToggle(toggleWins, filters.winsOnly);
    setToggle(togglePending, filters.pendingOnly);
    saveFilters();
    currentPage = 1;
    renderTips();
};

togglePending.onclick = () => {
    filters.pendingOnly = !filters.pendingOnly;
    if (filters.pendingOnly) filters.winsOnly = false;
    setToggle(togglePending, filters.pendingOnly);
    setToggle(toggleWins, filters.winsOnly);
    saveFilters();
    currentPage = 1;
    renderTips();
};

/* =========================
   RENDER TIPS
========================= */
function renderTips() {
    const q = (searchEl.value || "").trim().toLowerCase();
    const sort = sortByEl.value;

    let rows = tips.slice();

    if (filters.favsOnly) rows = rows.filter(t => favs.has(t.id));
    if (filters.winsOnly) rows = rows.filter(t => ["win", "won"].includes(normalizeOutcome(t.outcome)));
    if (filters.pendingOnly) rows = rows.filter(t => isPendingOutcome(normalizeOutcome(t.outcome)));

    if (q) {
        rows = rows.filter(t => {
            const hay = `${t.game} ${t.tip} ${t.outcome ?? ""} ${t.odds ?? ""} ${t.stakeRaw ?? ""} ${t.profitRaw ?? ""} ${t.dateRaw ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }

    if (sort === "NEWEST") {
        rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sort === "HIGHEST_ODDS") {
        rows.sort((a, b) => (b.odds ?? -999) - (a.odds ?? -999));
    } else if (sort === "LOWEST_ODDS") {
        rows.sort((a, b) => (a.odds ?? 999) - (b.odds ?? 999));
    } else if (sort === "HIGHEST_STAKE") {
        rows.sort((a, b) => {
            const an = Number(a.stakeRaw); const bn = Number(b.stakeRaw);
            const av = isFinite(an) ? Math.abs(an) : -999999;
            const bv = isFinite(bn) ? Math.abs(bn) : -999999;
            return bv - av;
        });
    }

    const isSearching = q.length > 0;
    if (isSearching) currentPage = 1;

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const displayRows = isSearching ? rows : getPagedRows(rows);

    tipsGrid.innerHTML = "";

    if (!rows.length) {
        tipsGrid.innerHTML = `<div class="empty">No tips match your filters/search. Try adjusting toggles or keywords.</div>`;
        renderPagination(0, false);
        return;
    }

    displayRows.forEach(t => {
        const oddsStr = Number.isFinite(t.odds) ? t.odds.toFixed(2) : (t.odds ?? "—");
        const stakeSizeStr = formatStakeSize(t.stakeRaw);
        const profitFmt = formatProfitForCard(t.profitRaw, t.outcome);
        const cardClass = cardClassForOutcome(t.outcome);

        const fav = favs.has(t.id);

        const card = document.createElement("div");
        card.className = `tip-card ${cardClass}`;
        card.setAttribute("data-id", t.id);

        card.innerHTML = `
      <div class="tip-top">
        <div class="badge"><span class="mini"></span> Tip</div>
        <button class="pill ghost fav-btn" title="Toggle favorite" type="button">
          ${fav ? "★" : "☆"} Favorite
        </button>
      </div>

      <h3 class="tip-title">${escapeHtml(t.game || "Game")}</h3>

      <p class="tip-desc">
        <strong style="color:var(--text)">Pick:</strong> ${escapeHtml(t.tip || "—")}<br/>
        <span style="color: var(--muted);">Stake:</span> ${escapeHtml(stakeSizeStr)}<br/>
        <span style="color: var(--muted);">Profit:</span>
        <span class="${profitFmt.cls}">${escapeHtml(profitFmt.text)}</span>
      </p>

      <div class="tip-bottom">
        <span class="pill blue">Odds: ${escapeHtml(String(oddsStr))}</span>
        ${outcomePill(t.outcome)}
        <span class="pill ghost">📅 ${escapeHtml(fmtPublishTime(t.date))}</span>
      </div>
    `;

        const favBtn = card.querySelector(".fav-btn");
        favBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (favs.has(t.id)) favs.delete(t.id);
            else favs.add(t.id);
            saveFavs();
            renderTips();
            toastMsg("Saved", favs.has(t.id) ? "Added to favorites." : "Removed from favorites.");
        });

        card.addEventListener("click", () => openModal(t.id));

        tipsGrid.appendChild(card);
    });

    renderPagination(rows.length, isSearching);
}

/* =========================
   STATS + CHART + QUICK STATS
========================= */
function resizeCanvasForDPR(canvas, ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setQuickStats({ winRateText, roiText, avgOddsText, updatedText }) {
    if (statWinRateEl) statWinRateEl.textContent = winRateText ?? "—";
    if (statRoiEl) statRoiEl.textContent = roiText ?? "—";
    if (statAvgOddsEl) statAvgOddsEl.textContent = avgOddsText ?? "—";
    if (statUpdatedEl) statUpdatedEl.textContent = updatedText ?? "—";
}

function computeStatsAndChart() {
    const byDate = tips
        .filter(t => t.date && !isNaN(new Date(t.date).getTime()))
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    let wins = 0, losses = 0, refunds = 0;
    let totalProfit = 0;

    // For quick stats
    let totalStakeAbs = 0; // sum abs stake for settled (win/loss/refund) only
    let oddsSum = 0;
    let oddsCount = 0;

    const series = [];
    for (const t of byDate) {
        const o = normalizeOutcome(t.outcome);

        const isWin = o === "win" || o === "won";
        const isLoss = o === "lost" || o === "loss";
        const isRefund = o === "refund" || o === "void" || o === "push";
        const isPending = isPendingOutcome(o);

        if (isWin) wins++;
        else if (isLoss) losses++;
        else if (isRefund) refunds++;

        const signed = computeSignedProfit(t.profitRaw, t.outcome);
        if (signed != null) totalProfit += signed;
        series.push(totalProfit);

        // stake sum for ROI: exclude pending
        if (!isPending) {
            const st = Number(t.stakeRaw);
            if (isFinite(st)) totalStakeAbs += Math.abs(st);
        }

        // avg odds: exclude pending, require numeric odds
        if (!isPending && Number.isFinite(t.odds)) {
            oddsSum += t.odds;
            oddsCount++;
        }
    }

    // Right card
    winsCountEl.textContent = String(wins);
    lossesCountEl.textContent = String(losses);
    refundCountEl.textContent = String(refunds);

    const totalStr = (totalProfit >= 0 ? "+" : "") + totalProfit.toFixed(2);
    totalProfitText.innerHTML = `<span class="${totalProfit >= 0 ? "positive" : "negative"}">${escapeHtml(totalStr)}</span>`;
    winLossText.textContent = `${wins}W • ${losses}L • ${refunds}R (cumulative)`;

    // Quick stats texts
    const denomWL = wins + losses;
    const winRate = denomWL > 0 ? (wins / denomWL) * 100 : null;
    const roi = totalStakeAbs > 0 ? (totalProfit / totalStakeAbs) * 100 : null;
    const avgOdds = oddsCount > 0 ? (oddsSum / oddsCount) : null;

    const updatedText =
        lastUpdatedAt instanceof Date && !isNaN(lastUpdatedAt.getTime())
            ? lastUpdatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
            : "—";

    setQuickStats({
        winRateText: winRate == null ? "—" : `${winRate.toFixed(1)}%`,
        roiText: roi == null ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
        avgOddsText: avgOdds == null ? "—" : avgOdds.toFixed(2),
        updatedText
    });

    drawLineChart(series);
    updateStickyLatest();
}

function drawLineChart(series) {
    const ctx = profitCtx;
    resizeCanvasForDPR(profitCanvas, ctx);

    const rect = profitCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    if (!series.length) {
        ctx.globalAlpha = 1;
        ctx.font = "900 14px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(238,241,247,.86)";
        ctx.fillText("No numeric profits yet.", 14, 42);
        ctx.font = "13px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(167,177,207,.86)";
        ctx.fillText("Add numbers to column G to show the graph.", 14, 64);
        return;
    }

    const pad = 14;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    const min = Math.min(...series, 0);
    const max = Math.max(...series, 0);
    const range = (max - min) || 1;

    const x = (i) => pad + (i * (innerW / Math.max(series.length - 1, 1)));
    const y = (v) => pad + (innerH - ((v - min) / range) * innerH);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        const yy = pad + (innerH * i / 4);
        ctx.beginPath();
        ctx.moveTo(pad, yy);
        ctx.lineTo(w - pad, yy);
        ctx.stroke();
    }
    ctx.restore();

    const y0 = y(0);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(pad, y0);
    ctx.lineTo(w - pad, y0);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x(0), y(series[0]));
    for (let i = 1; i < series.length; i++) ctx.lineTo(x(i), y(series[i]));
    ctx.lineTo(x(series.length - 1), h - pad);
    ctx.lineTo(x(0), h - pad);
    ctx.closePath();
    ctx.fillStyle = "rgba(92,124,250,.10)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x(0), y(series[0]));
    for (let i = 1; i < series.length; i++) ctx.lineTo(x(i), y(series[i]));
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(92,124,250,.95)";
    ctx.stroke();
    ctx.restore();

    const lastX = x(series.length - 1);
    const lastY = y(series[series.length - 1]);
    ctx.save();
    ctx.fillStyle = "rgba(238,241,247,.95)";
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(167,177,207,.92)";
    ctx.fillText(max.toFixed(2), pad, pad + 12);
    ctx.fillText(min.toFixed(2), pad, h - pad);
    ctx.restore();
}

window.addEventListener("resize", () => drawLineChart(
    tips
        .filter(t => t.date && !isNaN(new Date(t.date).getTime()))
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .reduce((acc, t) => {
            const prev = acc.length ? acc[acc.length - 1] : 0;
            const signed = computeSignedProfit(t.profitRaw, t.outcome) ?? 0;
            acc.push(prev + signed);
            return acc;
        }, [])
));

/* =========================
   MODAL
========================= */
function openModal(id) {
    const t = tips.find(x => x.id === id);
    if (!t) return;
    activeModalId = id;

    modalTitle.textContent = t.game || "Tip details";
    modalSub.textContent = `Odds ${Number.isFinite(t.odds) ? t.odds.toFixed(2) : (t.odds ?? "—")} • Stake ${formatStakeSize(t.stakeRaw)} • Profit ${formatProfitForCard(t.profitRaw, t.outcome).text}`;
    modalPick.textContent = t.tip || "—";

    const profitFmt = formatProfitForCard(t.profitRaw, t.outcome);
    const outcome = outcomeText(t.outcome);

    const kv = [
        ["Published", fmtPublishTime(t.date)],
        ["Outcome", outcome],
        ["Odds", Number.isFinite(t.odds) ? t.odds.toFixed(2) : (t.odds ?? "—")],
        ["Stake", formatStakeSize(t.stakeRaw)],
        ["Profit", profitFmt.text],
    ];

    modalKv.innerHTML = kv.map(([k, v]) => `
    <div>${escapeHtml(k)}</div><div>${escapeHtml(v)}</div>
  `).join("");

    modalOutcomePill.className = "pill " + (
        outcome === "WIN" ? "green" :
            outcome === "LOST" ? "red" :
                outcome === "REFUND" ? "blue" : "yellow"
    );
    modalOutcomePill.textContent = `Outcome: ${outcome}`;
    modalDatePill.textContent = `📅 ${fmtPublishTime(t.date)}`;

    modalFavBtn.textContent = favs.has(t.id) ? "★" : "☆";

    modalBackdrop.style.display = "flex";
    modalBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    modalBackdrop.style.display = "none";
    modalBackdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeModalId = null;
}

modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
});
modalCloseBtn.onclick = closeModal;
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalBackdrop.style.display === "flex") closeModal();
});

modalFavBtn.onclick = () => {
    if (!activeModalId) return;
    const t = tips.find(x => x.id === activeModalId);
    if (!t) return;
    if (favs.has(t.id)) favs.delete(t.id);
    else favs.add(t.id);
    saveFavs();
    modalFavBtn.textContent = favs.has(t.id) ? "★" : "☆";
    renderTips();
    toastMsg("Saved", favs.has(t.id) ? "Added to favorites." : "Removed from favorites.");
};

modalCopyBtn.onclick = async () => {
    if (!activeModalId) return;
    const t = tips.find(x => x.id === activeModalId);
    if (!t) return;
    const text = `${t.game}\nPick: ${t.tip}\nOdds: ${Number.isFinite(t.odds) ? t.odds.toFixed(2) : (t.odds ?? "—")}\nStake: ${formatStakeSize(t.stakeRaw)}\nOutcome: ${outcomeText(t.outcome)}\nPublished: ${fmtPublishTime(t.date)}`;
    try {
        await navigator.clipboard.writeText(text);
        toastMsg("Copied", "Tip copied to clipboard.");
    } catch {
        toastMsg("Copy failed", "Your browser blocked clipboard access.");
    }
};

modalGoCalc.onclick = () => {
    closeModal();
    document.getElementById("calculator").scrollIntoView({ behavior: "smooth", block: "start" });
};

modalShare.onclick = async () => {
    if (!activeModalId) return;
    const url = new URL(window.location.href);
    url.hash = "#tips";
    url.searchParams.set("tip", activeModalId);
    try {
        await navigator.clipboard.writeText(url.toString());
        toastMsg("Link copied", "Share link copied to clipboard.");
    } catch {
        toastMsg("Copy failed", "Your browser blocked clipboard access.");
    }
};

/* =========================
   STICKY CTA
========================= */
function updateStickyLatest() {
    if (!tips.length) {
        stickySub.textContent = "No tips yet.";
        stickyChip.textContent = "—";
        return;
    }
    const newest = tips.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const outcome = outcomeText(newest.outcome);
    stickySub.textContent = `${newest.game || "Tip"} — ${newest.tip || "—"}`;
    stickyChip.textContent = `${outcome} • ${fmtPublishTime(newest.date)}`;
}

/* =========================
   EV CALCULATOR
========================= */
function calculateEV() {
    const sharpOver = parseFloat(document.getElementById('sharpOver').value);
    const sharpUnder = parseFloat(document.getElementById('sharpUnder').value);
    const soft = parseFloat(document.getElementById('softOdds').value);
    const bankroll = parseFloat(document.getElementById('bankroll').value);
    const market = document.getElementById('market').value;
    const softSide = document.getElementById('softSide').value;

    if ([sharpOver, sharpUnder, soft, bankroll].some(Number.isNaN)) {
        toastMsg("Missing fields", "Fill in sharp odds, soft odds, and bankroll.");
        return;
    }
    if (sharpOver <= 1 || sharpUnder <= 1 || soft <= 1 || bankroll <= 0) {
        toastMsg("Invalid values", "Odds must be > 1 and bankroll > 0.");
        return;
    }

    const pO = 1 / sharpOver;
    const pU = 1 / sharpUnder;
    const vig = pO + pU;

    const fairProbO = pO / vig;
    const fairProbU = pU / vig;

    const fairO = 1 / fairProbO;
    const fairU = 1 / fairProbU;

    const fairLow = Math.min(fairO, fairU);
    const fairHigh = Math.max(fairO, fairU);

    const bettingOver = softSide === "OVER";
    const fairProb = bettingOver ? fairProbO : fairProbU;

    const ev = (soft * fairProb) - 1;
    const evPct = ev * 100;
    const positive = ev >= 0.02;

    document.getElementById('fairRange').textContent = `${fairLow.toFixed(2)} – ${fairHigh.toFixed(2)}`;

    const evSpan = document.getElementById('evPercent');
    evSpan.textContent = (ev >= 0 ? '+' : '') + evPct.toFixed(2) + '%';
    evSpan.className = positive ? 'positive' : 'negative';

    const stakeRow = document.getElementById('stakeRow');
    if (positive) {
        const factor = market === 'FIRST_HALF' ? 0.5 : 1;
        let stake = bankroll * ev * 0.3 * factor;
        stake = Math.max(stake, bankroll * 0.003);
        stakeRow.style.display = 'flex';
        document.getElementById('stakeAmount').textContent = '€' + stake.toFixed(2);
    } else {
        stakeRow.style.display = 'none';
    }

    const decision = document.getElementById('decisionText');
    decision.textContent = positive
        ? `BET APPROVED (${bettingOver ? "OVER" : "UNDER"})`
        : `NO BET (${bettingOver ? "OVER" : "UNDER"})`;
    decision.className = positive ? 'positive' : 'negative';

    document.getElementById('result').style.display = 'block';

    toastMsg("EV calculated", positive ? "Edge found — consider the suggested stake." : "Not enough edge — skip.");
}
window.calculateEV = calculateEV;

/* =========================
   LOAD TIPS
========================= */
async function loadTipsFromSheet() {
    try {
        const res = await fetch(sheetUrl(), { cache: "no-store" });
        const text = await res.text();
        const data = parseGviz(text);

        const rows = data?.table?.rows ?? [];

        tips = rows.map((r) => {
            const c = (n) => r?.c?.[n]?.v ?? null;
            const publishVal = c(0);
            const publishISO = toISOorDate(publishVal);

            const t = {
                date: publishISO,
                dateRaw: publishVal,
                game: c(1),
                odds: c(2) != null ? Number(c(2)) : null,
                tip: c(3),
                outcome: c(4),
                stakeRaw: c(5),
                profitRaw: c(6)
            };
            t.id = tipId(t);
            return t;
        }).filter(t => t.game || t.tip);

        lastUpdatedAt = new Date();

        sortByEl.value = sortByEl.value || "NEWEST";
        if (!searchEl.value) currentPage = 1;

        renderTips();
        computeStatsAndChart();

        const url = new URL(window.location.href);
        const deep = url.searchParams.get("tip");
        if (deep && tips.some(t => t.id === deep)) {
            openModal(deep);
        }
    } catch (e) {
        tipsGrid.innerHTML = `
      <div class="empty">
        Could not load tips from Google Sheets.<br/>
        ✅ Make sure you did <strong>File → Share → Publish to web</strong> on the correct tab.<br/>
        ✅ Set <strong>TAB_NAME</strong> to match your sheet tab name.<br/>
        ✅ Column A must be <strong>Date time</strong> to show time.
      </div>
    `;
        console.error(e);
    }
}

/* =========================
   EVENTS / UX
========================= */
document.getElementById("year").textContent = new Date().getFullYear();

searchEl.addEventListener("input", () => {
    currentPage = 1;
    renderTips();
});

sortByEl.addEventListener("change", () => {
    currentPage = 1;
    renderTips();
});

// Buttons
document.getElementById("btnScrollTips").onclick = () => {
    document.getElementById("tips").scrollIntoView({ behavior: "smooth", block: "start" });
};

document.getElementById("btnScrollJoin").onclick = () => {
    document.getElementById("premium").scrollIntoView({ behavior: "smooth", block: "start" });
};

document.getElementById("btnCtaTips").onclick = () => {
    document.getElementById("tips").scrollIntoView({ behavior: "smooth", block: "start" });
};

document.getElementById("btnCtaFavorites").onclick = () => {
    filters.favsOnly = true;
    setToggle(toggleFavorites, true);
    saveFilters();
    currentPage = 1;
    renderTips();
    document.getElementById("tips").scrollIntoView({ behavior: "smooth", block: "start" });
    toastMsg("Favorites", "Showing your saved tips.");
};

document.getElementById("btnRandomTip").onclick = () => {
    if (!tips.length) return;
    const t = tips[Math.floor(Math.random() * tips.length)];
    openModal(t.id);
};

document.getElementById("btnFillExample").onclick = () => {
    document.getElementById('sharpOver').value = "1.92";
    document.getElementById('sharpUnder').value = "1.95";
    document.getElementById('softOdds').value = "2.05";
    document.getElementById('bankroll').value = "1000";
    document.getElementById('softSide').value = "OVER";
    document.getElementById('market').value = "FULL_TIME";
    toastMsg("Example loaded", "Now click Calculate EV.");
};

// Hero premium join CTA
const btnPremiumJoinTop = document.getElementById("btnPremiumJoinTop");
if (btnPremiumJoinTop) {
    btnPremiumJoinTop.onclick = () => {
        document.getElementById("premium").scrollIntoView({ behavior: "smooth", block: "start" });
    };
}

// Save filter state
function applyStoredFilters() {
    if (typeof filters !== "object" || filters === null) filters = {};
    initTogglesFromStorage();
}

// Initial
applyStoredFilters();
loadTipsFromSheet();

// Auto-refresh every 2 min
setInterval(loadTipsFromSheet, 2 * 60 * 1000);

// =========================
// PREMIUM CTA SETTINGS
// =========================
const TELEGRAM_PREMIUM_LINK = "https://t.me/YOUR_PREMIUM_LINK";
const CHECKOUT_URL = "https://your-payment-link.com"; // Stripe/Gumroad/etc.

function openCheckout() {
    window.open(CHECKOUT_URL, "_blank", "noopener,noreferrer");
}

document.getElementById("btnPremiumJoin").onclick = openCheckout;
document.getElementById("btnPremiumJoin2").onclick = openCheckout;
document.getElementById("btnGoCheckout").onclick = openCheckout;

document.getElementById("btnPremiumCopy").onclick = async () => {
    try {
        await navigator.clipboard.writeText(TELEGRAM_PREMIUM_LINK);
        toastMsg("Copied", "Telegram premium link copied.");
    } catch {
        toastMsg("Copy failed", "Clipboard blocked by your browser.");
    }
};

document.getElementById("btnPremiumLearn").onclick = () => {
    toastMsg("Premium", "Premium members get all tips + early alerts in Telegram.");
};

document.getElementById("btnPremiumFaq").onclick = () => {
    toastMsg("FAQ", "After payment you receive the Telegram invite link instantly.");
};
