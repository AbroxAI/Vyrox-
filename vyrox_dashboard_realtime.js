(() => {
    "use strict";

    const CONFIG = {
        statusUrl: "/api/vyrox/status",
        controlUrl: "/api/vyrox/control",
        telegramTestUrl: "/api/vyrox/telegram/test",
        refreshMs: 2000,
        requestTimeoutMs: 8000,
        maxHistoryRows: 50,
    };

    const $ = (id) => document.getElementById(id);

    const els = {
        connectionStatus: $("connectionStatus"),
        statusText: $("statusText"),
        lastUpdate: $("lastUpdate"),

        balance: $("balance"),
        balanceChange: $("balanceChange"),
        balanceTradeCount: $("balanceTradeCount"),

        todayPnl: $("todayPnl"),
        todayPnlPercent: $("todayPnlPercent"),
        todayTradeCount: $("todayTradeCount"),

        totalPnl: $("totalPnl"),
        totalPnlPercent: $("totalPnlPercent"),
        totalTradeCount: $("totalTradeCount"),

        winRate: $("winRate"),
        rewardRisk: $("rewardRisk"),

        positionStatus: $("positionStatus"),
        posType: $("posType"),
        posEntry: $("posEntry"),
        posCurrent: $("posCurrent"),
        posPnl: $("posPnl"),
        posSl: $("posSl"),
        posTp: $("posTp"),
        posDuration: $("posDuration"),

        regimeBadge: $("regimeBadge"),
        regimeAdx: $("regimeAdx"),
        regimeConfidence: $("regimeConfidence"),
        regimeSignal: $("regimeSignal"),
        regimeHistory: $("regimeHistory"),

        tradeHistoryBody: $("tradeHistoryBody"),

        dailyLossValue: $("dailyLossValue"),
        dailyLossBar: $("dailyLossBar"),
        dailyProfitValue: $("dailyProfitValue"),
        dailyProfitBar: $("dailyProfitBar"),
        drawdownValue: $("drawdownValue"),
        drawdownBar: $("drawdownBar"),
        consecutiveLosses: $("consecutiveLosses"),
        consecutiveBar: $("consecutiveBar"),

        telegramStatus: $("telegramStatus"),
        lastAlert: $("lastAlert"),
        alertTime: $("alertTime"),

        botLog: $("botLog"),

        refreshBtn: $("refreshBtn"),
        stopBotBtn: $("stopBotBtn"),
        startBotBtn: $("startBotBtn"),
        testAlertBtn: $("testAlertBtn"),
        telegramSetupBtn: $("telegramSetupBtn"),
        viewAllBtn: $("viewAllBtn"),
        exportCsvBtn: $("exportCsvBtn"),
    };

    let state = null;
    let latestTrades = [];
    let pollTimer = null;
    let polling = false;

    function tg() {
        return window.Telegram?.WebApp || null;
    }

    function telegramInitData() {
        return tg()?.initData || "";
    }

    function formatNumber(value, decimals = 2) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toFixed(decimals) : "—";
    }

    function formatPlainMoney(value, decimals = 2) {
        const n = Number(value);
        return Number.isFinite(n)
            ? `$${n.toFixed(decimals)}`
            : "—";
    }

    function formatMoney(value, decimals = 2) {
        const n = Number(value);

        if (!Number.isFinite(n)) {
            return "—";
        }

        return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(decimals)}`;
    }

    function formatPercent(value, decimals = 1) {
        const n = Number(value);
        return Number.isFinite(n)
            ? `${n.toFixed(decimals)}%`
            : "—";
    }

    function formatTime(value) {
        if (!value) {
            return "—";
        }

        const d = new Date(value);

        if (Number.isNaN(d.getTime())) {
            return String(value);
        }

        return d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function setConnectionStatus(online) {
        els.statusText.textContent =
            online ? "ONLINE" : "OFFLINE";

        els.connectionStatus.classList.toggle(
            "offline",
            !online
        );
    }

    function setTelegramStatus(active) {
        els.telegramStatus.textContent =
            active ? "ACTIVE" : "UNAVAILABLE";

        els.telegramStatus.style.background =
            active
                ? "var(--telegram-blue)"
                : "var(--bg-card)";

        els.telegramStatus.style.color =
            active
                ? "#fff"
                : "var(--text-secondary)";
    }

    function setPnlClass(element, value) {
        if (!element) {
            return;
        }

        element.classList.remove(
            "green",
            "red",
            "cyan"
        );

        const n = Number(value);

        if (!Number.isFinite(n)) {
            return;
        }

        element.classList.add(
            n > 0
                ? "green"
                : n < 0
                    ? "red"
                    : "cyan"
        );
    }

    function renderMetrics(data) {
        els.balance.textContent =
            formatPlainMoney(data.balance);

        els.balanceChange.textContent =
            data.balance_change_percent == null
                ? "—"
                : `${Number(data.balance_change_percent) >= 0 ? "▲" : "▼"} ${Math.abs(Number(data.balance_change_percent)).toFixed(1)}%`;

        els.balanceTradeCount.textContent =
            `Trades: ${Number(
                data.trades_today ??
                data.trades ??
                0
            )}`;

        els.todayPnl.textContent =
            formatMoney(data.today_pnl);

        setPnlClass(
            els.todayPnl,
            data.today_pnl
        );

        els.todayPnlPercent.textContent =
            data.today_pnl_percent == null
                ? "—"
                : `${Number(data.today_pnl_percent) >= 0 ? "▲" : "▼"} ${Math.abs(Number(data.today_pnl_percent)).toFixed(1)}%`;

        els.todayTradeCount.textContent =
            `Trades: ${Number(
                data.trades_today ??
                data.trades ??
                0
            )}`;

        els.totalPnl.textContent =
            formatMoney(data.total_pnl);

        setPnlClass(
            els.totalPnl,
            data.total_pnl
        );

        els.totalPnlPercent.textContent =
            data.total_pnl_percent == null
                ? "—"
                : `${Number(data.total_pnl_percent) >= 0 ? "▲" : "▼"} ${Math.abs(Number(data.total_pnl_percent)).toFixed(1)}%`;

        els.totalTradeCount.textContent =
            `Trades: ${Number(
                data.total_trades ??
                data.trades ??
                0
            )}`;

        els.winRate.textContent =
            formatPercent(
                data.win_rate
            );

        els.rewardRisk.textContent =
            `Reward / Risk: ${
                data.reward_risk ?? "—"
            }`;
    }

    function renderPosition(position = {}) {
        if (!position.open) {
            els.positionStatus.textContent =
                "⏸️ No position open";

            for (const element of [
                els.posType,
                els.posEntry,
                els.posCurrent,
                els.posPnl,
                els.posSl,
                els.posTp,
                els.posDuration,
            ]) {
                element.textContent = "—";
            }

            els.posPnl.classList.remove(
                "green",
                "red"
            );

            return;
        }

        els.positionStatus.textContent =
            "🟢 Position open";

        els.posType.textContent =
            position.type ??
            position.contract_type ??
            "—";

        els.posEntry.textContent =
            formatPlainMoney(
                position.entry ??
                position.buy_price
            );

        els.posCurrent.textContent =
            formatNumber(
                position.current ??
                position.current_spot
            );

        const pnl =
            position.pnl ??
            position.profit ??
            0;

        els.posPnl.textContent =
            formatMoney(pnl);

        els.posPnl.classList.remove(
            "green",
            "red"
        );

        els.posPnl.classList.add(
            Number(pnl) >= 0
                ? "green"
                : "red"
        );

        els.posSl.textContent =
            formatNumber(
                position.sl
            );

        els.posTp.textContent =
            formatNumber(
                position.tp
            );

        els.posDuration.textContent =
            position.duration ??
            "—";
    }

    function normalizeRegime(value) {
        const regime =
            String(
                value ?? "UNKNOWN"
            ).toUpperCase();

        if (regime.includes("TREND")) {
            return "TREND";
        }

        if (regime.includes("RANGE")) {
            return "RANGE";
        }

        if (regime.includes("VOLATILE")) {
            return "VOLATILE";
        }

        return "UNKNOWN";
    }

    function renderRegime(data) {
        const regime =
            normalizeRegime(
                data.regime
            );

        const className =
            regime === "TREND"
                ? "trend"
                : regime === "RANGE"
                    ? "range"
                    : regime === "VOLATILE"
                        ? "volatile"
                        : "";

        els.regimeBadge.className =
            `regime-badge ${className}`.trim();

        els.regimeBadge.textContent =
            regime;

        els.regimeAdx.textContent =
            formatNumber(
                data.adx
            );

        els.regimeConfidence.textContent =
            data.regime_confidence == null
                ? "—"
                : formatPercent(
                    data.regime_confidence
                );

        els.regimeSignal.textContent =
            data.signal ?? "—";

        const history =
            Array.isArray(
                data.regime_history
            )
                ? data.regime_history.slice(-10)
                : [];

        els.regimeHistory.innerHTML = "";

        if (!history.length) {
            els.regimeHistory.innerHTML =
                '<span class="empty-state">Waiting for regime history...</span>';

            return;
        }

        history.forEach(
            (item, index) => {
                const tag =
                    document.createElement(
                        "span"
                    );

                tag.className =
                    `tag${
                        index === history.length - 1
                            ? " active"
                            : ""
                    }`;

                tag.textContent =
                    String(item);

                els.regimeHistory.appendChild(
                    tag
                );

                if (
                    index <
                    history.length - 1
                ) {
                    const arrow =
                        document.createElement(
                            "span"
                        );

                    arrow.className =
                        "arrow";

                    arrow.textContent =
                        "→";

                    els.regimeHistory.appendChild(
                        arrow
                    );
                }
            }
        );
    }

    function renderTrades(trades = []) {
        latestTrades =
            Array.isArray(trades)
                ? trades.slice(
                    0,
                    CONFIG.maxHistoryRows
                )
                : [];

        if (!latestTrades.length) {
            els.tradeHistoryBody.innerHTML =
                `
                <tr>
                    <td
                        colspan="5"
                        class="empty-state"
                    >
                        No completed trades yet.
                    </td>
                </tr>
                `;

            return;
        }

        els.tradeHistoryBody.innerHTML =
            latestTrades
                .slice(0, 5)
                .map(
                    (trade) => {
                        const pnl =
                            trade.pnl ??
                            trade.profit ??
                            trade.profit_loss ??
                            0;

                        const pnlClass =
                            Number(pnl) >= 0
                                ? "profit"
                                : "loss";

                        return `
                            <tr>
                                <td>
                                    ${escapeHtml(
                                        formatTime(
                                            trade.time ??
                                            trade.timestamp ??
                                            trade.timestamp_utc
                                        )
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        trade.type ??
                                        trade.signal ??
                                        trade.contract_type ??
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        formatNumber(
                                            trade.entry ??
                                            trade.buy_price
                                        )
                                    )}
                                </td>

                                <td>
                                    ${escapeHtml(
                                        formatNumber(
                                            trade.exit ??
                                            trade.exit_spot
                                        )
                                    )}
                                </td>

                                <td
                                    class="${pnlClass}"
                                >
                                    ${escapeHtml(
                                        formatMoney(pnl)
                                    )}
                                </td>
                            </tr>
                        `;
                    }
                )
                .join("");
    }

    function setBar(
        element,
        percent
    ) {
        const value =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(percent) || 0
                )
            );

        element.style.width =
            `${value}%`;
    }

    function renderRisk(
        risk = {}
    ) {
        const loss =
            Number(
                risk.daily_loss_pct ??
                risk.daily_loss ??
                0
            );

        const lossLimit =
            Number(
                risk.max_daily_loss_pct ??
                risk.max_daily_loss ??
                0
            );

        const profit =
            Number(
                risk.daily_profit_pct ??
                risk.daily_profit ??
                0
            );

        const profitTarget =
            Number(
                risk.daily_profit_target_pct ??
                risk.daily_profit_target ??
                10
            );

        const drawdown =
            Number(
                risk.drawdown_pct ??
                risk.drawdown ??
                0
            );

        const drawdownLimit =
            Number(
                risk.max_drawdown_pct ??
                risk.max_drawdown ??
                15
            );

        const consecutive =
            Number(
                risk.consecutive_losses ??
                0
            );

        const consecutiveLimit =
            Number(
                risk.max_consecutive_losses ??
                3
            );

        const lossPct =
            lossLimit > 0
                ? Math.abs(loss) /
                    Math.abs(lossLimit) *
                    100
                : 0;

        const profitPct =
            profitTarget > 0
                ? Math.max(
                    0,
                    profit /
                    profitTarget *
                    100
                )
                : 0;

        const drawdownPct =
            drawdownLimit > 0
                ? Math.abs(drawdown) /
                    drawdownLimit *
                    100
                : 0;

        const consecutivePct =
            consecutiveLimit > 0
                ? consecutive /
                    consecutiveLimit *
                    100
                : 0;

        els.dailyLossValue.textContent =
            `${Math.abs(loss).toFixed(2)}%`;

        els.dailyLossValue
            .nextElementSibling
            .textContent =
            `(Limit: ${
                lossLimit || "—"
            }%)`;

        setBar(
            els.dailyLossBar,
            lossPct
        );

        els.dailyProfitValue.textContent =
            `${profit.toFixed(2)}%`;

        els.dailyProfitValue
            .nextElementSibling
            .textContent =
            `(Target: ${
                profitTarget || "—"
            }%)`;

        setBar(
            els.dailyProfitBar,
            profitPct
        );

        els.drawdownValue.textContent =
            `${drawdown.toFixed(2)}%`;

        els.drawdownValue
            .nextElementSibling
            .textContent =
            `(Limit: ${
                drawdownLimit || "—"
            }%)`;

        setBar(
            els.drawdownBar,
            drawdownPct
        );

        els.consecutiveLosses.textContent =
            String(consecutive);

        els.consecutiveLosses
            .nextElementSibling
            .textContent =
            `/ ${consecutiveLimit}`;

        setBar(
            els.consecutiveBar,
            consecutivePct
        );
    }

    function renderAlerts(data) {
        const alert =
            data.last_alert ??
            data.alert ??
            null;

        if (!alert) {
            els.lastAlert.textContent =
                "No Telegram alerts yet.";

            els.alertTime.textContent =
                "—";

            return;
        }

        if (
            typeof alert ===
            "string"
        ) {
            els.lastAlert.textContent =
                alert;

            els.alertTime.textContent =
                data.alert_time ??
                "—";

            return;
        }

        els.lastAlert.textContent =
            alert.message ??
            "—";

        els.alertTime.textContent =
            formatTime(
                alert.time ??
                alert.timestamp
            );
    }

    function renderLogs(
        logs = []
    ) {
        if (
            !Array.isArray(logs) ||
            !logs.length
        ) {
            els.botLog.innerHTML =
                `
                <div class="empty-state">
                    No bot logs yet.
                </div>
                `;

            return;
        }

        els.botLog.innerHTML =
            logs
                .slice(0, 10)
                .map(
                    (item) => `
                        <div class="log-item">

                            <span class="log-icon">
                                ${escapeHtml(
                                    item.icon ??
                                    "•"
                                )}
                            </span>

                            <span class="log-time">
                                ${escapeHtml(
                                    formatTime(
                                        item.time ??
                                        item.timestamp
                                    )
                                )}
                            </span>

                            <span class="log-msg">
                                ${escapeHtml(
                                    item.message ??
                                    item.msg ??
                                    ""
                                )}
                            </span>

                        </div>
                    `
                )
                .join("");
    }

    function renderStatus(
        data
    ) {
        const online =
            String(
                data.status ??
                "OFFLINE"
            ).toUpperCase() ===
            "ONLINE";

        setConnectionStatus(
            online
        );

        els.lastUpdate.textContent =
            `Last Update: ${
                formatTime(
                    data.updated_at ??
                    data.last_update ??
                    Date.now()
                )
            }`;
    }

    function renderDashboard(
        data
    ) {
        state = data;

        renderStatus(
            data
        );

        renderMetrics(
            data
        );

        renderPosition(
            data.position ?? {}
        );

        renderRegime(
            data
        );

        renderTrades(
            data.trades ?? []
        );

        renderRisk(
            data.risk ?? {}
        );

        renderAlerts(
            data
        );

        renderLogs(
            data.logs ??
            data.log ??
            []
        );

        setTelegramStatus(
            Boolean(
                telegramInitData()
            )
        );

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function setDashboardOffline(
        message
    ) {
        setConnectionStatus(
            false
        );

        els.balance.textContent =
            "—";

        els.todayPnl.textContent =
            "—";

        els.totalPnl.textContent =
            "—";

        els.winRate.textContent =
            "—";

        els.positionStatus.textContent =
            "⚠️ Dashboard disconnected";

        if (message) {
            els.lastAlert.textContent =
                message;
        }
    }

    async function fetchWithTimeout(
        url,
        options = {}
    ) {
        const controller =
            new AbortController();

        const timer =
            window.setTimeout(
                () =>
                    controller.abort(),
                CONFIG.requestTimeoutMs
            );

        try {
            return await fetch(
                url,
                {
                    ...options,
                    signal:
                        controller.signal,
                    cache:
                        "no-store",
                }
            );
        } finally {
            window.clearTimeout(
                timer
            );
        }
    }

    async function apiGet(
        url
    ) {
        const response =
            await fetchWithTimeout(
                url
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        return response.json();
    }

    async function apiPost(
        url,
        payload = {}
    ) {
        const response =
            await fetchWithTimeout(
                url,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body:
                        JSON.stringify(
                            payload
                        ),
                }
            );

        if (!response.ok) {
            const body =
                await response.text();

            throw new Error(
                `HTTP ${response.status}: ${body}`
            );
        }

        return response.json();
    }

    async function fetchStatus() {
        if (polling) {
            return;
        }

        polling = true;

        try {
            const data =
                await apiGet(
                    CONFIG.statusUrl
                );

            renderDashboard(
                data
            );

        } catch (error) {
            console.error(
                "VYROX status error:",
                error
            );

            setDashboardOffline(
                "Unable to reach VYROX backend."
            );

        } finally {
            polling = false;
        }
    }

    async function controlBot(
        action
    ) {
        return apiPost(
            CONFIG.controlUrl,
            {
                action,
                initData:
                    telegramInitData(),
            }
        );
    }

    async function sendTestAlert() {
        return apiPost(
            CONFIG.telegramTestUrl,
            {
                initData:
                    telegramInitData(),
            }
        );
    }

    function downloadTradeCsv() {
        if (!latestTrades.length) {
            window.alert(
                "No trade history available."
            );

            return;
        }

        const headers = [
            "Time",
            "Type",
            "Entry",
            "Exit",
            "PnL",
            "Status",
            "Contract ID",
        ];

        const rows =
            latestTrades.map(
                (trade) => [
                    trade.time ??
                    trade.timestamp ??
                    trade.timestamp_utc ??
                    "",

                    trade.type ??
                    trade.signal ??
                    trade.contract_type ??
                    "",

                    trade.entry ??
                    trade.buy_price ??
                    "",

                    trade.exit ??
                    trade.exit_spot ??
                    "",

                    trade.pnl ??
                    trade.profit ??
                    trade.profit_loss ??
                    "",

                    trade.status ??
                    "",

                    trade.contract_id ??
                    "",
                ]
            );

        const csv =
            [
                headers,
                ...rows,
            ]
                .map(
                    (row) =>
                        row
                            .map(
                                (value) =>
                                    `"${String(
                                        value
                                    ).replaceAll(
                                        '"',
                                        '""'
                                    )}"`
                            )
                            .join(",")
                )
                .join("\n");

        const blob =
            new Blob(
                [csv],
                {
                    type:
                        "text/csv;charset=utf-8;",
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const anchor =
            document.createElement(
                "a"
            );

        anchor.href =
            url;

        anchor.download =
            "vyrox_trades.csv";

        document.body.appendChild(
            anchor
        );

        anchor.click();

        anchor.remove();

        URL.revokeObjectURL(
            url
        );
    }

    async function runControl(
        button,
        action
    ) {
        if (!button) {
            return;
        }

        const original =
            button.innerHTML;

        try {
            button.disabled =
                true;

            button.textContent =
                action === "START"
                    ? "⏳ Starting..."
                    : "⏳ Stopping...";

            await controlBot(
                action
            );

            await fetchStatus();

        } catch (error) {
            console.error(
                `${action} bot error:`,
                error
            );

            window.alert(
                `Unable to ${
                    action.toLowerCase()
                } VYROX.`
            );

        } finally {
            button.disabled =
                false;

            button.innerHTML =
                original;

            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }

    function wireEvents() {
        els.refreshBtn?.addEventListener(
            "click",
            fetchStatus
        );

        els.startBotBtn?.addEventListener(
            "click",
            () =>
                runControl(
                    els.startBotBtn,
                    "START"
                )
        );

        els.stopBotBtn?.addEventListener(
            "click",
            () =>
                runControl(
                    els.stopBotBtn,
                    "STOP"
                )
        );

        els.testAlertBtn?.addEventListener(
            "click",
            async () => {
                const original =
                    els.testAlertBtn
                        .innerHTML;

                try {
                    els.testAlertBtn.disabled =
                        true;

                    els.testAlertBtn.textContent =
                        "⏳ Sending...";

                    await sendTestAlert();

                    await fetchStatus();

                } catch (error) {
                    console.error(
                        "Telegram test error:",
                        error
                    );

                    window.alert(
                        "Unable to send Telegram test alert."
                    );

                } finally {
                    els.testAlertBtn.disabled =
                        false;

                    els.testAlertBtn.innerHTML =
                        original;

                    if (window.lucide) {
                        window.lucide.createIcons();
                    }
                }
            }
        );

        els.telegramSetupBtn?.addEventListener(
            "click",
            () => {
                window.alert(
                    "Telegram setup is handled by the VYROX backend. Keep the bot token server-side; never put it in this JavaScript file."
                );
            }
        );

        els.viewAllBtn?.addEventListener(
            "click",
            () => {
                window.alert(
                    latestTrades.length
                        ? `VYROX has ${latestTrades.length} available trade record(s).`
                        : "No trade history available."
                );
            }
        );

        els.exportCsvBtn?.addEventListener(
            "click",
            downloadTradeCsv
        );
    }

    function initializeTelegram() {
        const app =
            tg();

        if (!app) {
            setTelegramStatus(
                false
            );

            return;
        }

        try {
            app.ready();

            app.expand();

            if (
                typeof app.setHeaderColor ===
                "function"
            ) {
                app.setHeaderColor(
                    "#0A0E17"
                );
            }

            if (
                typeof app.setBackgroundColor ===
                "function"
            ) {
                app.setBackgroundColor(
                    "#0A0E17"
                );
            }

            setTelegramStatus(
                Boolean(
                    app.initData
                )
            );

        } catch (error) {
            console.warn(
                "Telegram Mini App initialization warning:",
                error
            );

            setTelegramStatus(
                false
            );
        }
    }

    function startPolling() {
        if (pollTimer) {
            window.clearInterval(
                pollTimer
            );
        }

        pollTimer =
            window.setInterval(
                fetchStatus,
                CONFIG.refreshMs
            );
    }

    function init() {
        initializeTelegram();

        wireEvents();

        if (window.lucide) {
            window.lucide.createIcons();
        }

        fetchStatus();

        startPolling();
    }

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

    window.VyroxDashboard = {
        fetchStatus,
        controlBot,
        sendTestAlert,
        getState: () => state,
    };
})();
