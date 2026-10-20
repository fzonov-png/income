/* =====================================================================
   Логика дашборда доходов
   ===================================================================== */
(function () {
  "use strict";

  /* --------------------------- константы -------------------------- */

  var TYPES = [
    { id: "advance", label: "Аванс", color: "#38bdf8" },
    { id: "salary", label: "Окончательная зарплата", color: "#34d399" },
    { id: "plant_cash", label: "Наличные в кассе завода", color: "#fbbf24" },
    { id: "side", label: "Дополнительный заработок", color: "#a78bfa" },
    { id: "trip", label: "Командировка (суточные)", color: "#f472b6" },
  ];

  var TYPE_COLORS = [
    "#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#f472b6",
    "#f97316", "#22d3ee", "#eab308", "#fb7185", "#4ade80",
  ];

  var METHOD_LABEL = { cash: "Наличные", bank: "Безнал" };

  var MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  var MONTHS_NOM = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  var MONTHS_GEN = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];

  var ICON_MOON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
  var ICON_SUN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  var ICON_EDIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var ICON_TRASH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';
  var ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var ICON_X =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ----------------------------- DOM ------------------------------ */

  var els = {};
  function $(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    [
      "brandSub", "syncBtn", "syncDot", "syncText", "themeBtn", "settingsBtn", "addBtn",
      "kpis", "periodChips", "customRange", "fromDate", "toDate", "typeChips", "methodFilter",
      "sourceFilter", "searchInput", "chartTitle", "chartSub", "chartTotal", "bars",
      "breakdown", "breakdownSub", "listCount", "entries", "emptyState", "emptyTitle",
      "emptyText", "emptyAddBtn", "footerHint", "footerSaved", "fab",
      "entryModal", "entryTitle", "entryForm", "formTypes", "fAmount", "fDate", "fSource",
      "fNote", "formMethod", "formError", "saveEntryBtn", "sourceList", "addSourceFromForm",
      "settingsModal", "settingsForm", "sOwner", "sRepo", "sBranch", "sPath", "sToken",
      "settingsError", "settingsOk", "saveSettingsBtn", "disconnectBtn", "exportBtn",
      "importInput", "clearBtn", "storageHint", "addSourceBtn", "sourceListManager",
      "sourceModal", "sourceTitle", "sourceForm", "sourceName", "sourceError", "saveSourceBtn",
      "sourceModalList", "sourceHint",
      "typeModal", "typeTitle", "typeForm", "typeName", "typeColors", "typeError",
      "saveTypeBtn", "cancelTypeEditBtn", "typeList",
      "confirmModal", "confirmTitle", "confirmText", "confirmOk", "toasts",
    ].forEach(function (id) {
      els[id] = $(id);
    });
  }

  /* ---------------------------- состояние ------------------------- */

  var state = {
    data: null,
    mode: "local",
    sync: "local",
    period: "month",
    customFrom: "",
    customTo: "",
    types: new Set(),
    method: "all",
    source: "all",
    query: "",
    editingId: null,
    formType: "advance",
    formMethod: "cash",
    sourceEditing: null,
    sourceReturnToEntry: false,
    editingTypeId: null,
    typeColor: TYPE_COLORS[0],
    confirmCb: null,
    busy: false,
  };

  function allTypes() {
    var custom = state.data && Array.isArray(state.data.types) ? state.data.types : [];
    return TYPES.concat(custom);
  }

  function typeById(id) {
    return allTypes().find(function (type) { return type.id === id; }) || null;
  }

  function typeUsage(id) {
    return state.data.entries.filter(function (entry) { return entry.type === id; }).length;
  }

  function nextTypeColor() {
    var used = Object.create(null);
    (state.data.types || []).forEach(function (type) {
      used[String(type.color).toLowerCase()] = true;
    });

    for (var i = 0; i < TYPE_COLORS.length; i += 1) {
      if (!used[TYPE_COLORS[i].toLowerCase()]) return TYPE_COLORS[i];
    }

    return TYPE_COLORS[(state.data.types || []).length % TYPE_COLORS.length];
  }

  var nfInt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  var nfMoney = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

  /* --------------------------- утилиты ---------------------------- */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function money(value) {
    var number = Math.round((Number(value) || 0) * 100) / 100;
    var text = Number.isInteger(number) ? nfInt.format(number) : nfMoney.format(number);
    return text + "\u00A0₽";
  }

  function compact(value) {
    var number = Number(value) || 0;
    if (number >= 1000000) {
      return (number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace(".", ",") + " млн";
    }
    if (number >= 1000) {
      return (number / 1000).toFixed(number >= 100000 ? 0 : 1).replace(".", ",") + " тыс";
    }
    return String(Math.round(number));
  }

  function plural(n, one, few, many) {
    var n10 = n % 10;
    var n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  function pad2(number) {
    return String(number).padStart(2, "0");
  }

  function parseISODate(iso) {
    var parts = String(iso).split("-").map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function isoDate(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function todayISO() {
    return isoDate(new Date());
  }

  function isoDay(date) {
    var number = parseISODate(date);
    return number.getDate() + " " + MONTHS_GEN[number.getMonth()];
  }

  function isoShort(date) {
    var number = parseISODate(date);
    return number.getDate() + " " + MONTHS_SHORT[number.getMonth()] + " " + number.getFullYear();
  }

  function unique(arr) {
    return Array.from(new Set(arr));
  }

  function entryTime(entry) {
    var time = new Date(entry.updatedAt || entry.createdAt || 0).getTime();
    return isFinite(time) ? time : 0;
  }

  // Объединяет записи по id: при совпадении остаётся более свежая версия.
  function mergeEntries(localEntries, remoteEntries) {
    var map = new Map();

    remoteEntries.forEach(function (entry) {
      map.set(entry.id, entry);
    });

    localEntries.forEach(function (entry) {
      var existing = map.get(entry.id);
      if (!existing || entryTime(entry) > entryTime(existing)) {
        map.set(entry.id, entry);
      }
    });

    return Array.from(map.values());
  }

  function typeTime(type) {
    return new Date(type.updatedAt || type.createdAt || 0).getTime() || 0;
  }

  function mergeTypes(localTypes, remoteTypes) {
    var map = new Map();

    (remoteTypes || []).forEach(function (type) {
      map.set(type.id, type);
    });

    (localTypes || []).forEach(function (type) {
      var existing = map.get(type.id);
      if (!existing || typeTime(type) > typeTime(existing)) {
        map.set(type.id, type);
      }
    });

    return Array.from(map.values());
  }

  function typesDiffer(a, b) {
    var left = a || [];
    var right = b || [];
    if (left.length !== right.length) return true;

    var map = new Map();
    right.forEach(function (type) { map.set(type.id, type); });

    return left.some(function (type) {
      var other = map.get(type.id);
      return !other ||
        other.label !== type.label ||
        String(other.color).toLowerCase() !== String(type.color).toLowerCase();
    });
  }

  /* ---------------------------- период ---------------------------- */

  function getRange() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();

    if (state.period === "month") {
      return {
        from: isoDate(new Date(year, month, 1)),
        to: isoDate(new Date(year, month + 1, 0)),
      };
    }
    if (state.period === "prevMonth") {
      return {
        from: isoDate(new Date(year, month - 1, 1)),
        to: isoDate(new Date(year, month, 0)),
      };
    }
    if (state.period === "quarter") {
      return {
        from: isoDate(new Date(year, month - 2, 1)),
        to: isoDate(new Date(year, month + 1, 0)),
      };
    }
    if (state.period === "year") {
      return {
        from: isoDate(new Date(year, 0, 1)),
        to: isoDate(new Date(year, 11, 31)),
      };
    }
    if (state.period === "custom") {
      return {
        from: state.customFrom || null,
        to: state.customTo || state.customFrom || null,
      };
    }
    return { from: null, to: null };
  }

  function rangeLabel() {
    var range = getRange();
    if (!range.from) return "За всё время";

    var from = parseISODate(range.from);
    var to = parseISODate(range.to || range.from);

    if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
      return MONTHS_NOM[from.getMonth()] + " " + from.getFullYear();
    }
    return isoShort(range.from) + " — " + isoShort(range.to || range.from);
  }

  /* --------------------------- фильтрация ------------------------- */

  function getFiltered(options) {
    options = options || {};
    var range = getRange();
    var query = state.query.trim().toLowerCase();

    return state.data.entries
      .filter(function (entry) {
        if (!options.ignoreRange) {
          if (range.from && entry.date < range.from) return false;
          if (range.to && entry.date > range.to) return false;
        }
        if (!options.ignoreType && state.types.size && !state.types.has(entry.type)) return false;
        if (state.method !== "all" && entry.method !== state.method) return false;
        if (state.source !== "all" && entry.source !== state.source) return false;
        if (query) {
          var entryType = typeById(entry.type);
          var typeLabel = entryType ? entryType.label : "";
          var haystack = (entry.source + " " + entry.note + " " + entry.amount + " " + typeLabel).toLowerCase();
          if (haystack.indexOf(query) === -1) return false;
        }
        return true;
      })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
  }

  function sum(entries) {
    return entries.reduce(function (total, entry) {
      return total + (Number(entry.amount) || 0);
    }, 0);
  }

  /* ----------------------------- тема ----------------------------- */

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#eef2f8" : "#080b10");
    els.themeBtn.innerHTML = theme === "light" ? ICON_SUN : ICON_MOON;
    els.themeBtn.title = theme === "light" ? "Тёмная тема" : "Светлая тема";
  }

  function toggleTheme() {
    var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
    Store.setTheme(next);
  }

  /* --------------------------- синхронизация ---------------------- */

  function setSync(kind, text, hint) {
    state.sync = kind;
    if (!els.syncBtn) return;
    els.syncBtn.dataset.state = kind;
    els.syncText.textContent = text;
    els.syncBtn.title = hint || text;
  }

  function syncLabel() {
    if (!Store.isConnected()) {
      return { kind: "local", text: "Локально", hint: "Данные хранятся только в этом браузере. Нажмите, чтобы подключить GitHub." };
    }
    if (Store.hasPending()) {
      return { kind: "pending", text: "Не отправлено", hint: "Есть изменения, которые не ушли на GitHub. Нажмите, чтобы отправить." };
    }
    return { kind: "ok", text: "Синхронизировано", hint: "Данные синхронизированы с GitHub. Нажмите, чтобы обновить." };
  }

  function refreshSyncLabel() {
    var label = syncLabel();
    setSync(label.kind, label.text, label.hint);
  }

  function renderFooter() {
    var config = Store.getConfig();
    if (Store.isConnected() && config) {
      els.footerHint.textContent = "GitHub · " + config.owner + "/" + config.repo;
      els.brandSub.textContent = config.owner + "/" + config.repo;
    } else {
      els.footerHint.textContent = "Данные только на этом устройстве";
      els.brandSub.textContent = "личный дашборд";
    }

    if (state.data && state.data.updatedAt) {
      var date = new Date(state.data.updatedAt);
      els.footerSaved.textContent =
        "Обновлено " +
        date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) +
        ", " +
        date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } else {
      els.footerSaved.textContent = "Записей пока нет";
    }
  }

  /* ----------------------------- сводка --------------------------- */

  function monthSpan() {
    var range = getRange();

    if (!range.from) {
      var dates = getFiltered().map(function (entry) { return entry.date; }).sort();
      if (!dates.length) return 1;
      var first = parseISODate(dates[0]);
      var now = new Date();
      return Math.max(1, (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1);
    }

    var from = parseISODate(range.from);
    var to = parseISODate(range.to || range.from);
    return Math.max(1, (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1);
  }

  function renderKpis() {
    var list = getFiltered();
    var total = sum(list);
    var cash = sum(list.filter(function (entry) { return entry.method === "cash"; }));
    var bank = total - cash;
    var months = monthSpan();

    var cashShare = total > 0 ? Math.round((cash / total) * 100) : 0;
    var bankShare = total > 0 ? Math.round((bank / total) * 100) : 0;

    els.kpis.innerHTML =
      '<article class="kpi kpi--total">' +
        '<span class="kpi__label">Всего за период</span>' +
        '<strong class="kpi__value">' + esc(money(total)) + "</strong>" +
        '<span class="kpi__sub">' + list.length + " " + plural(list.length, "запись", "записи", "записей") + " · " + esc(rangeLabel()) + "</span>" +
      "</article>" +
      '<article class="kpi kpi--cash">' +
        '<span class="kpi__label">Наличные</span>' +
        '<strong class="kpi__value">' + esc(money(cash)) + "</strong>" +
        '<span class="kpi__sub">' + cashShare + "% от суммы</span>" +
      "</article>" +
      '<article class="kpi kpi--bank">' +
        '<span class="kpi__label">Безнал</span>' +
        '<strong class="kpi__value">' + esc(money(bank)) + "</strong>" +
        '<span class="kpi__sub">' + bankShare + "% от суммы</span>" +
      "</article>" +
      '<article class="kpi kpi--avg">' +
        '<span class="kpi__label">В среднем за месяц</span>' +
        '<strong class="kpi__value">' + esc(money(total / months)) + "</strong>" +
        '<span class="kpi__sub">за ' + months + " " + plural(months, "месяц", "месяца", "месяцев") + "</span>" +
      "</article>";
  }

  /* ---------------------------- графики --------------------------- */

  function monthKeyOf(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1);
  }

  function monthInPeriod(monthDate) {
    var range = getRange();
    if (!range.from) return true;

    var start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    var from = parseISODate(range.from);
    var to = parseISODate(range.to || range.from);

    return end >= from && start <= to;
  }

  // Окно графика: 12 месяцев, заканчивая месяцем выбранного периода.
  function monthWindowEnd(entries) {
    var range = getRange();

    if (range.to) {
      var end = parseISODate(range.to);
      return new Date(end.getFullYear(), end.getMonth(), 1);
    }

    var now = new Date();
    var current = new Date(now.getFullYear(), now.getMonth(), 1);

    // «Всё время»: если давно не было записей, показываем окно вокруг последней активности.
    if (entries.length) {
      var latest = entries
        .map(function (entry) { return entry.date; })
        .sort()
        .pop();
      var latestDate = parseISODate(latest);
      var latestMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
      var windowStart = new Date(current.getFullYear(), current.getMonth() - 11, 1);

      if (latestMonth < windowStart) return latestMonth;
    }

    return current;
  }

  function buildMonthBuckets(entries) {
    var endMonth = monthWindowEnd(entries);
    var start = new Date(endMonth.getFullYear(), endMonth.getMonth() - 11, 1);
    var buckets = [];

    for (var i = 0; i < 12; i += 1) {
      var monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
      buckets.push({
        key: monthKeyOf(monthDate),
        label: MONTHS_SHORT[monthDate.getMonth()],
        title: MONTHS_NOM[monthDate.getMonth()] + " " + monthDate.getFullYear(),
        value: 0,
        active: monthInPeriod(monthDate),
      });
    }

    var map = {};
    buckets.forEach(function (bucket) { map[bucket.key] = bucket; });

    entries.forEach(function (entry) {
      var bucket = map[entry.date.slice(0, 7)];
      if (bucket) bucket.value += Number(entry.amount) || 0;
    });

    return buckets;
  }

  function selectMonth(key) {
    var parts = key.split("-").map(Number);
    if (parts.length !== 2 || !parts[0] || !parts[1]) return;

    state.period = "custom";
    state.customFrom = isoDate(new Date(parts[0], parts[1] - 1, 1));
    state.customTo = isoDate(new Date(parts[0], parts[1], 0));
    els.fromDate.value = state.customFrom;
    els.toDate.value = state.customTo;
    els.customRange.hidden = false;

    Array.prototype.forEach.call(els.periodChips.querySelectorAll(".chip"), function (chip) {
      chip.classList.toggle("is-active", chip.dataset.period === "custom");
    });

    renderAll();
  }

  function renderChart() {
    // Для графика берём записи без ограничения по датам: так виден год целиком,
    // а выбранный период только подсвечивается.
    var list = getFiltered({ ignoreRange: true });
    var buckets = buildMonthBuckets(list);
    var total = buckets.reduce(function (acc, bucket) { return acc + bucket.value; }, 0);

    els.chartTitle.textContent = "Доходы по месяцам";
    els.chartSub.textContent = "Последние 12 месяцев · выбранный период подсвечен · нажмите на столбец";
    els.chartTotal.innerHTML = total > 0
      ? esc(money(total)) + '<small class="chart__total-cap">за 12 мес.</small>'
      : "";
    els.bars.classList.remove("bars--dense");

    if (total <= 0) {
      els.bars.innerHTML = '<div class="bars__empty">Нет данных за последние 12 месяцев</div>';
      return;
    }

    var max = Math.max.apply(null, buckets.map(function (bucket) { return bucket.value; }));
    var maxValue = max || 1;
    var step = buckets.length > 16 ? 3 : buckets.length > 12 ? 2 : 1;

    els.bars.innerHTML = buckets
      .map(function (bucket, index) {
        var height = bucket.value > 0 ? Math.max(4, Math.round((bucket.value / maxValue) * 100)) : 0;
        var showLabel = index % step === 0 || index === buckets.length - 1;
        var classes =
          "bar" +
          (bucket.value > 0 ? "" : " bar--zero") +
          (bucket.active ? " bar--active" : " bar--muted");

        return (
          '<button type="button" class="' + classes + '" data-month="' + bucket.key + '" title="' +
            esc(bucket.title) + ": " + esc(money(bucket.value)) + ' — выбрать месяц">' +
            '<span class="bar__value">' + (bucket.value > 0 ? esc(compact(bucket.value)) : "") + "</span>" +
            '<span class="bar__track"><span class="bar__fill" style="height:' + height + '%"></span></span>' +
            '<span class="bar__label' + (showLabel ? "" : " is-hidden") + '">' + esc(bucket.label) + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderBreakdown() {
    var list = getFiltered();
    var total = sum(list);
    var byType = {};

    list.forEach(function (entry) {
      var id = typeById(entry.type) ? entry.type : "side";
      if (!byType[id]) byType[id] = { sum: 0, count: 0 };
      byType[id].sum += Number(entry.amount) || 0;
      byType[id].count += 1;
    });

    var rows = allTypes().filter(function (type) { return byType[type.id]; })
      .map(function (type) {
        return { type: type, sum: byType[type.id].sum, count: byType[type.id].count };
      })
      .sort(function (a, b) { return b.sum - a.sum; });

    els.breakdownSub.textContent = total > 0
      ? "Всего " + money(total) + " · " + rows.length + " " + plural(rows.length, "вид", "вида", "видов")
      : "Пока нет данных";

    if (!rows.length) {
      els.breakdown.innerHTML = '<p class="breakdown__empty">Добавьте записи, чтобы увидеть структуру дохода.</p>';
      return;
    }

    els.breakdown.innerHTML = rows
      .map(function (row) {
        var share = total > 0 ? Math.round((row.sum / total) * 100) : 0;
        return (
          '<div class="bd__row" style="--bd-color:' + row.type.color + '">' +
            '<span class="bd__name"><i></i>' + esc(row.type.label) + "</span>" +
            '<span class="bd__sum">' + esc(money(row.sum)) + '<span class="bd__share">' + share + "%</span></span>" +
            '<div class="bd__track"><div class="bd__fill" style="width:' + share + '%"></div></div>' +
          "</div>"
        );
      })
      .join("");
  }

  /* ----------------------------- список --------------------------- */

  function rowHTML(entry) {
    var type = typeById(entry.type) || { label: entry.type, color: "#8ea3ba" };
    var date = parseISODate(entry.date);
    var meta = entry.source || "";
    if (entry.note) meta += (meta ? " · " : "") + entry.note;

    return (
      '<div class="row" data-id="' + esc(entry.id) + '">' +
        '<div class="row__date"><b>' + date.getDate() + "</b><span>" + MONTHS_SHORT[date.getMonth()] + "</span></div>" +
        '<div class="row__main">' +
          '<span class="row__type" style="--dot:' + type.color + '"><i></i>' + esc(type.label) + "</span>" +
          (meta ? '<span class="row__source">' + esc(meta) + "</span>" : "") +
        "</div>" +
        '<div class="row__method"><span class="pill pill--' + entry.method + '">' + METHOD_LABEL[entry.method] + "</span></div>" +
        '<div class="row__amount">' + esc(money(entry.amount)) + "</div>" +
        '<div class="row__actions">' +
          '<button class="row__action" type="button" data-act="edit" title="Редактировать" aria-label="Редактировать">' + ICON_EDIT + "</button>" +
          '<button class="row__action" type="button" data-act="delete" title="Удалить" aria-label="Удалить">' + ICON_TRASH + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function renderList() {
    var list = getFiltered();
    var total = sum(list);
    var hasAny = state.data.entries.length > 0;

    els.listCount.textContent = list.length
      ? list.length + " " + plural(list.length, "запись", "записи", "записей") + " · " + money(total)
      : "";

    if (!list.length) {
      els.entries.innerHTML = "";
      els.emptyState.hidden = false;

      if (hasAny) {
        els.emptyTitle.textContent = "Ничего не найдено";
        els.emptyText.textContent = "Под выбранные фильтры записей нет. Попробуйте изменить период, вид дохода или сбросить поиск.";
        els.emptyAddBtn.textContent = "Сбросить фильтры";
        els.emptyAddBtn.dataset.action = "reset";
      } else {
        els.emptyTitle.textContent = "Пока ни одной записи";
        els.emptyText.textContent = "Добавьте первый доход — аванс, зарплату, наличные из кассы завода или суточные.";
        els.emptyAddBtn.textContent = "Добавить доход";
        els.emptyAddBtn.dataset.action = "add";
      }
      return;
    }

    els.emptyState.hidden = true;

    var groups = new Map();
    list.forEach(function (entry) {
      var key = entry.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });

    var html = "";
    groups.forEach(function (items, key) {
      var parts = key.split("-").map(Number);
      html +=
        '<div class="month">' +
          '<div class="month__head"><span>' + MONTHS_NOM[parts[1] - 1] + " " + parts[0] + "</span><b>" + esc(money(sum(items))) + "</b></div>" +
          items.map(rowHTML).join("") +
        "</div>";
    });

    els.entries.innerHTML = html;
  }

  function renderTypeChips() {
    var types = allTypes();
    var validIds = new Set(types.map(function (type) { return type.id; }));
    Array.from(state.types).forEach(function (id) {
      if (!validIds.has(id)) state.types.delete(id);
    });

    var list = getFiltered({ ignoreType: true });
    var counts = {};
    list.forEach(function (entry) {
      counts[entry.type] = (counts[entry.type] || 0) + 1;
    });

    var html = '<button class="chip' + (state.types.size === 0 ? " is-active" : "") + '" type="button" data-type="all">Все виды</button>';

    types.forEach(function (type) {
      var active = state.types.has(type.id);
      html +=
        '<button class="chip' + (active ? " is-active" : "") + '" type="button" data-type="' + type.id + '" style="--dot:' + type.color + '">' +
          '<span class="chip__dot"></span>' + esc(type.label) +
          (counts[type.id] ? '<span class="chip__count">' + counts[type.id] + "</span>" : "") +
        "</button>";
    });

    els.typeChips.innerHTML = html;
  }

  // Все источники: сохранённый список + всё, что встречается в записях.
  function allSources() {
    var seen = Object.create(null);
    var list = [];

    function add(name) {
      name = String(name == null ? "" : name).trim();
      if (!name) return;

      var key = name.toLowerCase();
      if (seen[key]) return;

      seen[key] = true;
      list.push(name);
    }

    (state.data.sources || []).forEach(add);
    state.data.entries.forEach(function (entry) { add(entry.source); });

    return list.sort(function (a, b) { return a.localeCompare(b, "ru"); });
  }

  // Приводит введённое название к уже существующему, чтобы не было дублей в разном регистре.
  function resolveSourceName(name) {
    name = String(name == null ? "" : name).trim();
    if (!name) return "";

    var key = name.toLowerCase();
    var match = allSources().find(function (source) {
      return source.toLowerCase() === key;
    });

    return match || name;
  }

  function sourceUsage(name) {
    return state.data.entries.filter(function (entry) {
      return entry.source === name;
    }).length;
  }

  function sourceItemHTML(name, selectable) {
    if (state.sourceEditing === name) {
      return (
        '<form class="source-item source-item--editing" data-source="' + esc(name) + '" data-edit-form>' +
          '<input class="source-item__input" value="' + esc(name) + '" maxlength="120" autocomplete="off" aria-label="Название источника" />' +
          '<button class="row__action" type="submit" title="Сохранить" aria-label="Сохранить">' + ICON_CHECK + "</button>" +
          '<button class="row__action" type="button" data-act="cancel-edit" title="Отмена" aria-label="Отмена">' + ICON_X + "</button>" +
        "</form>"
      );
    }

    var count = sourceUsage(name);

    return (
      '<div class="source-item' + (selectable ? " source-item--selectable" : "") + '" data-source="' + esc(name) + '"' +
        (selectable ? ' role="button" tabindex="0"' : "") + ">" +
        '<span class="source-item__name" title="' + esc(name) + '">' + esc(name) + "</span>" +
        '<span class="source-item__meta">' +
          (count ? count + " " + plural(count, "запись", "записи", "записей") : "не используется") +
        "</span>" +
        '<button class="row__action" type="button" data-act="edit-source" title="Переименовать" aria-label="Переименовать">' + ICON_EDIT + "</button>" +
        '<button class="row__action" type="button" data-act="delete-source" title="Удалить" aria-label="Удалить">' + ICON_TRASH + "</button>" +
      "</div>"
    );
  }

  function renderSourceList(container, selectable) {
    if (!container) return;

    var sources = allSources();

    if (!sources.length) {
      container.innerHTML =
        '<p class="hint">Пока нет источников. Добавьте первый — он появится в форме записи и в фильтре.</p>';
      return;
    }

    container.innerHTML = sources
      .map(function (name) { return sourceItemHTML(name, selectable); })
      .join("");
  }

  function renderSourceManager() {
    renderSourceList(els.sourceListManager, false);
  }

  function renderSourceModalList() {
    if (!els.sourceModalList) return;

    renderSourceList(els.sourceModalList, state.sourceReturnToEntry);

    if (els.sourceHint) {
      els.sourceHint.textContent = state.sourceReturnToEntry
        ? "Выберите источник для этого дохода или добавьте новый. Карандаш — переименовать."
        : "Добавьте новый источник, переименуйте или удалите существующий.";
    }
  }

  function renderSources() {
    var sources = allSources();

    if (state.source !== "all" && sources.indexOf(state.source) === -1) {
      state.source = "all";
    }

    els.sourceFilter.innerHTML =
      '<option value="all">Все источники</option>' +
      sources.map(function (source) {
        return '<option value="' + esc(source) + '">' + esc(source) + "</option>";
      }).join("");

    els.sourceFilter.value = state.source;
    els.sourceList.innerHTML = sources
      .map(function (source) { return '<option value="' + esc(source) + '"></option>'; })
      .join("");
  }

  function renderAll() {
    renderSources();
    renderSourceManager();
    renderSourceModalList();
    renderFormTypes();
    syncFormType();
    renderTypeColors();
    renderTypeList();
    renderTypeChips();
    renderKpis();
    renderChart();
    renderBreakdown();
    renderList();
    renderFooter();
  }

  /* ----------------------------- запись --------------------------- */

  function renderFormTypes() {
    els.formTypes.innerHTML = allTypes().map(function (type) {
      return (
        '<button class="type" type="button" role="radio" data-type="' + esc(type.id) + '" style="--type-color:' + esc(type.color) + '">' +
          "<i></i><span>" + esc(type.label) + "</span>" +
        "</button>"
      );
    }).join("") +
      '<button class="type type--add" type="button" data-act="add-type">' +
        "<i>+</i><span>Свой вид</span>" +
      "</button>";
  }

  function syncFormType() {
    Array.prototype.forEach.call(els.formTypes.querySelectorAll(".type[data-type]"), function (button) {
      var active = button.dataset.type === state.formType;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", active ? "true" : "false");
    });
  }

  function syncFormMethod() {
    Array.prototype.forEach.call(els.formMethod.querySelectorAll("button"), function (button) {
      button.classList.toggle("is-active", button.dataset.method === state.formMethod);
    });
  }

  function openEntry(entry) {
    state.editingId = entry ? entry.id : null;
    state.formType = entry ? (typeById(entry.type) ? entry.type : "advance") : "advance";
    state.formMethod = entry ? entry.method : "cash";

    els.entryTitle.textContent = entry ? "Редактировать доход" : "Новый доход";
    els.saveEntryBtn.textContent = entry ? "Сохранить" : "Добавить";
    els.fAmount.value = entry ? String(entry.amount).replace(".", ",") : "";
    els.fDate.value = entry ? entry.date : todayISO();
    els.fSource.value = entry ? entry.source : (state.source !== "all" ? state.source : "");
    els.fNote.value = entry ? entry.note : "";
    els.formError.hidden = true;

    syncFormType();
    syncFormMethod();
    openModal(els.entryModal);

    window.setTimeout(function () {
      els.fAmount.focus();
    }, 60);
  }

  function parseAmount(raw) {
    var cleaned = String(raw).replace(/[\s\u00A0]/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
    return Number(cleaned);
  }

  function showFormError(message) {
    els.formError.textContent = message;
    els.formError.hidden = false;
  }

  function handleEntrySubmit(event) {
    event.preventDefault();

    var amount = parseAmount(els.fAmount.value);
    var date = els.fDate.value;
    var source = resolveSourceName(els.fSource.value);
    var note = els.fNote.value.trim();

    if (!typeById(state.formType)) {
      showFormError("Выберите вид дохода.");
      return;
    }
    if (!isFinite(amount) || amount <= 0) {
      showFormError("Укажите сумму больше нуля. Можно писать с копейками: 12500,50");
      els.fAmount.focus();
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      showFormError("Укажите дату прихода денег.");
      els.fDate.focus();
      return;
    }
    if (date > todayISO()) {
      showFormError("Дата прихода не может быть в будущем.");
      els.fDate.focus();
      return;
    }

    var now = new Date().toISOString();
    var entry;

    if (state.editingId) {
      var index = state.data.entries.findIndex(function (item) {
        return item.id === state.editingId;
      });
      if (index === -1) {
        showFormError("Запись не найдена — обновите страницу.");
        return;
      }
      entry = state.data.entries[index];
      entry.type = state.formType;
      entry.amount = amount;
      entry.date = date;
      entry.method = state.formMethod;
      entry.source = source;
      entry.note = note;
      entry.updatedAt = now;
    } else {
      entry = {
        id: Store.uid(),
        type: state.formType,
        amount: amount,
        date: date,
        method: state.formMethod,
        source: source,
        note: note,
        createdAt: now,
        updatedAt: null,
      };
      state.data.entries.push(entry);
    }

    closeModal(els.entryModal);
    persist(state.editingId ? "Запись обновлена" : "Доход добавлен");
    state.editingId = null;
  }

  function editEntry(id) {
    var entry = state.data.entries.find(function (item) { return item.id === id; });
    if (entry) openEntry(entry);
  }

  function deleteEntry(id) {
    var entry = state.data.entries.find(function (item) { return item.id === id; });
    if (!entry) return;

    var type = typeById(entry.type) || { label: "Доход" };
    confirmAction(
      "Удалить запись?",
      type.label + " · " + money(entry.amount) + " · " + isoShort(entry.date) + (entry.source ? " · " + entry.source : ""),
      "Удалить",
      function () {
        state.data.entries = state.data.entries.filter(function (item) { return item.id !== id; });
        persist("Запись удалена");
      }
    );
  }

  /* --------------------------- источники -------------------------- */

  function showSourceError(message) {
    els.sourceError.textContent = message;
    els.sourceError.hidden = false;
  }

  function openSourceManager(returnToEntry) {
    state.sourceEditing = null;
    state.sourceReturnToEntry = Boolean(returnToEntry);

    els.sourceName.value = "";
    els.sourceError.hidden = true;
    els.sourceTitle.textContent = returnToEntry ? "Источник дохода" : "Источники дохода";

    renderSourceManager();
    renderSourceModalList();
    openModal(els.sourceModal);

    // На телефоне не открываем клавиатуру, если источник можно просто выбрать из списка.
    window.setTimeout(function () {
      if (!returnToEntry || !allSources().length) {
        els.sourceName.focus();
        return;
      }

      var firstRow = els.sourceModalList && els.sourceModalList.querySelector(".source-item--selectable");
      if (firstRow) firstRow.focus();
    }, 60);
  }

  function renameSource(oldName, newName) {
    state.data.sources = (state.data.sources || []).map(function (source) {
      return source === oldName ? newName : source;
    });

    state.data.entries.forEach(function (entry) {
      if (entry.source === oldName) {
        entry.source = newName;
        entry.updatedAt = new Date().toISOString();
      }
    });

    if (state.source === oldName) state.source = newName;
    if (els.fSource.value.trim() === oldName) els.fSource.value = newName;
  }

  function handleSourceAdd(event) {
    event.preventDefault();

    var name = els.sourceName.value.trim().replace(/\s+/g, " ");
    if (!name) {
      showSourceError("Введите название источника.");
      els.sourceName.focus();
      return;
    }

    var duplicate = allSources().find(function (source) {
      return source.toLowerCase() === name.toLowerCase();
    });

    // Такой источник уже есть — просто выбираем его для дохода.
    if (duplicate) {
      if (state.sourceReturnToEntry) {
        els.fSource.value = duplicate;
        closeModal(els.sourceModal);
      } else {
        showSourceError("Такой источник уже есть.");
        els.sourceName.focus();
      }
      return;
    }

    state.data.sources = state.data.sources || [];
    state.data.sources.push(name);

    els.sourceName.value = "";
    els.sourceError.hidden = true;

    if (state.sourceReturnToEntry) {
      els.fSource.value = name;
      closeModal(els.sourceModal);
    } else {
      renderSourceModalList();
      els.sourceName.focus();
    }

    persist("Источник добавлен");
  }

  function startSourceEdit(name) {
    state.sourceEditing = name;
    els.sourceError.hidden = true;

    renderSourceManager();
    renderSourceModalList();

    var container = els.sourceModal && !els.sourceModal.hidden
      ? els.sourceModalList
      : els.sourceListManager;
    var input = container && container.querySelector(".source-item--editing input");

    if (input) {
      input.focus();
      input.select();
    }
  }

  function cancelSourceEdit() {
    state.sourceEditing = null;
    els.sourceError.hidden = true;
    renderSourceManager();
    renderSourceModalList();
  }

  function handleSourceEdit(event) {
    var form = event.target.closest("[data-edit-form]");
    if (!form) return;

    event.preventDefault();

    var oldName = form.dataset.source;
    var input = form.querySelector("input");
    var name = input.value.trim().replace(/\s+/g, " ");

    if (!name) {
      showSourceError("Введите название источника.");
      input.focus();
      return;
    }

    var duplicate = allSources().find(function (source) {
      return source.toLowerCase() === name.toLowerCase() && source !== oldName;
    });

    if (duplicate) {
      showSourceError("Источник с таким названием уже есть.");
      input.focus();
      return;
    }

    if (name !== oldName) {
      renameSource(oldName, name);
      persist("Источник переименован");
    }

    state.sourceEditing = null;
    els.sourceError.hidden = true;
    renderSourceManager();
    renderSourceModalList();
  }

  function selectSource(name) {
    els.fSource.value = name;
    closeModal(els.sourceModal);
  }

  function handleSourceListClick(event, selectable) {
    var item = event.target.closest(".source-item");
    if (!item) return;

    var action = event.target.closest("[data-act]");
    var name = item.dataset.source;

    if (action) {
      if (action.dataset.act === "edit-source") {
        startSourceEdit(name);
      } else if (action.dataset.act === "delete-source") {
        deleteSource(name);
      } else if (action.dataset.act === "cancel-edit") {
        cancelSourceEdit();
      }
      return;
    }

    if (selectable && !state.sourceEditing) selectSource(name);
  }

  function handleSourceListKeydown(event, selectable) {
    if (!selectable || state.sourceEditing) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("button, input, form")) return;

    var item = event.target.closest(".source-item");
    if (!item) return;

    event.preventDefault();
    selectSource(item.dataset.source);
  }

  function deleteSource(name) {
    var count = sourceUsage(name);

    confirmAction(
      "Удалить источник?",
      count
        ? "«" + name + "» используется в " + count + " " + plural(count, "записи", "записях", "записях") +
          ". Записи останутся, но источник у них будет очищен."
        : "«" + name + "» будет удалён из списка.",
      "Удалить",
      function () {
        state.data.sources = (state.data.sources || []).filter(function (source) {
          return source !== name;
        });
        state.data.entries.forEach(function (entry) {
          if (entry.source === name) {
            entry.source = "";
            entry.updatedAt = new Date().toISOString();
          }
        });
        if (state.source === name) state.source = "all";
        if (state.sourceEditing === name) state.sourceEditing = null;
        if (els.fSource.value.trim() === name) els.fSource.value = "";
        renderSourceManager();
        renderSourceModalList();
        persist("Источник удалён");
      }
    );
  }

  /* --------------------------- виды дохода ------------------------ */

  function renderTypeColors() {
    if (!els.typeColors) return;

    els.typeColors.innerHTML = TYPE_COLORS.map(function (color) {
      var active = state.typeColor === color;
      return (
        '<button class="swatch' + (active ? " is-active" : "") + '" type="button" data-color="' + color + '"' +
          ' style="--swatch:' + color + '" role="radio" aria-checked="' + (active ? "true" : "false") + '"' +
          ' aria-label="Цвет ' + color + '"></button>'
      );
    }).join("");
  }

  function renderTypeList() {
    if (!els.typeList) return;

    var types = state.data.types || [];

    if (!types.length) {
      els.typeList.innerHTML =
        '<p class="hint">Своих видов пока нет. Добавьте первый — он появится в форме дохода.</p>';
      return;
    }

    els.typeList.innerHTML = types.map(function (type) {
      var count = typeUsage(type.id);
      return (
        '<div class="source-item' + (state.editingTypeId === type.id ? " is-editing" : "") + '" data-type-id="' + esc(type.id) + '">' +
          '<span class="source-item__dot" style="--dot:' + esc(type.color) + '"></span>' +
          '<span class="source-item__name" title="' + esc(type.label) + '">' + esc(type.label) + "</span>" +
          '<span class="source-item__meta">' +
            (count ? count + " " + plural(count, "запись", "записи", "записей") : "не используется") +
          "</span>" +
          '<button class="row__action" type="button" data-act="edit-type" title="Переименовать" aria-label="Переименовать">' + ICON_EDIT + "</button>" +
          '<button class="row__action" type="button" data-act="delete-type" title="Удалить" aria-label="Удалить">' + ICON_TRASH + "</button>" +
        "</div>"
      );
    }).join("");
  }

  function resetTypeForm() {
    state.editingTypeId = null;
    state.typeColor = nextTypeColor();

    if (els.typeForm) els.typeForm.reset();
    if (els.typeError) els.typeError.hidden = true;
    if (els.typeTitle) els.typeTitle.textContent = "Виды дохода";
    if (els.saveTypeBtn) els.saveTypeBtn.textContent = "Добавить";
    if (els.cancelTypeEditBtn) els.cancelTypeEditBtn.hidden = true;

    renderTypeColors();
    renderTypeList();
  }

  function openTypeManager(editId) {
    resetTypeForm();

    renderTypeList();
    openModal(els.typeModal);

    if (editId) {
      startTypeEdit(editId);
    } else {
      window.setTimeout(function () {
        els.typeName.focus();
      }, 60);
    }
  }

  function startTypeEdit(id) {
    var type = (state.data.types || []).find(function (item) {
      return item.id === id;
    });
    if (!type) return;

    state.editingTypeId = id;
    state.typeColor = type.color;

    els.typeName.value = type.label;
    els.typeError.hidden = true;
    els.typeTitle.textContent = "Изменить вид дохода";
    els.saveTypeBtn.textContent = "Сохранить";
    els.cancelTypeEditBtn.hidden = false;

    renderTypeColors();
    renderTypeList();

    els.typeName.focus();
    els.typeName.select();
  }

  function cancelTypeEdit() {
    resetTypeForm();
    els.typeName.focus();
  }

  function showTypeError(message) {
    els.typeError.textContent = message;
    els.typeError.hidden = false;
  }

  function handleTypeSubmit(event) {
    event.preventDefault();

    var label = els.typeName.value.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!label) {
      showTypeError("Введите название вида дохода.");
      els.typeName.focus();
      return;
    }

    var duplicate = allTypes().find(function (type) {
      return type.label.toLowerCase() === label.toLowerCase() && type.id !== state.editingTypeId;
    });

    if (duplicate) {
      showTypeError("Вид с таким названием уже есть.");
      els.typeName.focus();
      return;
    }

    var wasEditing = Boolean(state.editingTypeId);
    var now = new Date().toISOString();
    var typeId;

    if (wasEditing) {
      var type = (state.data.types || []).find(function (item) {
        return item.id === state.editingTypeId;
      });
      if (!type) {
        showTypeError("Вид не найден — закройте окно и попробуйте снова.");
        return;
      }

      type.label = label;
      type.color = state.typeColor;
      type.updatedAt = now;
      typeId = type.id;
    } else {
      typeId = "custom-" + Store.uid();
      state.data.types = state.data.types || [];
      state.data.types.push({
        id: typeId,
        label: label,
        color: state.typeColor,
        createdAt: now,
        updatedAt: now,
      });
    }

    state.formType = typeId;
    renderFormTypes();
    syncFormType();
    renderTypeList();

    closeModal(els.typeModal);
    persist(wasEditing ? "Вид дохода изменён" : "Вид дохода добавлен");
  }

  function deleteType(id) {
    var type = (state.data.types || []).find(function (item) {
      return item.id === id;
    });
    if (!type) return;

    var count = typeUsage(id);
    if (count) {
      showTypeError(
        "Нельзя удалить: вид используется в " + count + " " +
        plural(count, "записи", "записях", "записях") + ". Сначала измените эти записи."
      );
      return;
    }

    confirmAction(
      "Удалить вид дохода?",
      "«" + type.label + "» будет удалён из списка. Записей с ним нет.",
      "Удалить",
      function () {
        state.data.types = (state.data.types || []).filter(function (item) {
          return item.id !== id;
        });

        if (state.formType === id) state.formType = "advance";
        if (state.types.has(id)) state.types.delete(id);
        if (state.editingTypeId === id) resetTypeForm();

        renderFormTypes();
        syncFormType();
        renderTypeList();
        persist("Вид дохода удалён");
      }
    );
  }

  function handleTypeListClick(event) {
    var action = event.target.closest("[data-act]");
    if (!action) return;

    var item = action.closest("[data-type-id]");
    if (!item) return;

    var id = item.dataset.typeId;
    if (action.dataset.act === "edit-type") {
      startTypeEdit(id);
    } else if (action.dataset.act === "delete-type") {
      deleteType(id);
    }
  }

  function handleTypeColorsClick(event) {
    var swatch = event.target.closest("[data-color]");
    if (!swatch) return;

    state.typeColor = swatch.dataset.color;
    els.typeError.hidden = true;
    renderTypeColors();
  }

  /* --------------------------- сохранение ------------------------- */

  function persist(successMessage) {
    setSync("loading", "Сохранение…");
    els.saveEntryBtn.disabled = true;

    Store.save(state.data).then(
      function (result) {
        state.data = result.data;
        state.mode = result.mode;
        refreshSyncLabel();
        if (successMessage) toast(successMessage);

        if (result.retried) {
          toast("Файл на GitHub был изменён — данные отправлены повторно", "warn");
        }
      },
      function (error) {
        state.mode = "github";
        setSync("error", "Не отправлено", error.message);
        toast(error.message || "Не удалось сохранить на GitHub", "error", 8000);
      }
    ).then(function () {
      els.saveEntryBtn.disabled = false;
      renderAll();
    });
  }

  function syncNow() {
    if (!Store.isConnected()) {
      openSettings();
      toast("Подключите GitHub, чтобы данные были доступны с телефона", "warn", 6000);
      return;
    }

    if (Store.hasPending()) {
      persist("Отправлено на GitHub");
      return;
    }

    setSync("loading", "Обновление…");
    Store.load().then(
      function (result) {
        if (result.offline) {
          state.data = result.data;
          setSync("error", "Нет связи", result.error);
          toast(result.error, "error", 7000);
          renderAll();
          return;
        }

        if (result.missing) {
          refreshSyncLabel();
          toast("Файл данных ещё не создан на GitHub — он появится после первой записи", "warn", 6000);
          return;
        }

        state.data = result.data;
        state.mode = result.mode;
        refreshSyncLabel();
        renderAll();
        toast("Данные обновлены из GitHub");
      },
      function (error) {
        setSync("error", "Ошибка", error.message);
        toast(error.message || "Не удалось получить данные с GitHub", "error", 8000);
      }
    );
  }

  /* --------------------------- настройки -------------------------- */

  function openSettings() {
    var config = Store.getConfig() || {};
    els.sOwner.value = config.owner || "";
    els.sRepo.value = config.repo || "";
    els.sBranch.value = config.branch || Store.DEFAULTS.branch;
    els.sPath.value = config.path || Store.DEFAULTS.path;

    // Токен не показываем в форме: он остаётся в localStorage этого браузера.
    els.sToken.value = "";
    els.sToken.placeholder = config.token
      ? "Токен сохранён · вставьте новый, чтобы заменить"
      : "github_pat_…";

    els.settingsError.hidden = true;
    els.settingsOk.hidden = true;

    var entries = state.data.entries.length;
    els.storageHint.textContent =
      (Store.isConnected()
        ? "Подключено к " + config.owner + "/" + config.repo + " · в файле " + entries + " " + plural(entries, "запись", "записи", "записей") + ". "
        : "GitHub не подключён, записи хранятся только в этом браузере. ") +
      "Токен хранится в localStorage этого браузера и отправляется только на api.github.com.";

    openModal(els.settingsModal);
  }

  function showSettingsError(message) {
    els.settingsError.textContent = message;
    els.settingsError.hidden = false;
    els.settingsOk.hidden = true;
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();

    var existing = Store.getConfig();
    var typedToken = els.sToken.value.trim();
    var token = typedToken || (existing && existing.token) || "";

    var config = {
      owner: els.sOwner.value.trim().replace(/^@/, ""),
      repo: els.sRepo.value.trim(),
      branch: els.sBranch.value.trim() || Store.DEFAULTS.branch,
      path: els.sPath.value.trim() || Store.DEFAULTS.path,
      token: token,
    };

    if (!config.owner || !config.repo) {
      showSettingsError("Заполните владельца и название репозитория.");
      return;
    }
    if (!config.token) {
      showSettingsError("Вставьте токен GitHub с правом Contents: Read and write.");
      return;
    }

    els.saveSettingsBtn.disabled = true;
    els.saveSettingsBtn.textContent = "Проверяем…";
    els.settingsError.hidden = true;
    els.settingsOk.hidden = true;

    var localSnapshot = state.data;

    Store.testConfig(config)
      .then(function (info) {
        Store.saveConfig(config);

        if (!info.exists) {
          return Store.save(localSnapshot).then(function (saveResult) {
            state.data = saveResult.data;
            return { created: true, entries: localSnapshot.entries.length };
          });
        }

        return Store.load().then(function (result) {
          var remote = result.data;
          var remoteEntries = remote.entries;
          var localSources = localSnapshot.sources || [];

          // Список источников объединяем: он не должен теряться при первом подключении.
          var mergedSources = (remote.sources || []).slice();
          localSources.forEach(function (source) {
            var exists = mergedSources.some(function (item) {
              return item.toLowerCase() === source.toLowerCase();
            });
            if (!exists) mergedSources.push(source);
          });
          localSnapshot.sources = mergedSources;

          // Свои виды дохода тоже не теряем при подключении.
          var mergedTypes = mergeTypes(localSnapshot.types || [], remote.types || []);
          localSnapshot.types = mergedTypes;

          if (!remoteEntries.length && localSnapshot.entries.length) {
            state.data = localSnapshot;
            return Store.save(localSnapshot).then(function (saveResult) {
              state.data = saveResult.data;
              return { uploaded: true, entries: localSnapshot.entries.length };
            });
          }

          // Если данные есть и на устройстве, и в файле — объединяем, чтобы ничего не потерять.
          if (remoteEntries.length && localSnapshot.entries.length) {
            var mergedData = Store.emptyData();
            mergedData.entries = mergeEntries(localSnapshot.entries, remoteEntries);
            mergedData.sources = mergedSources;
            mergedData.types = mergedTypes;

            state.data = mergedData;
            return Store.save(mergedData).then(function (saveResult) {
              state.data = saveResult.data;
              return {
                merged: true,
                entries: mergedData.entries.length,
                local: localSnapshot.entries.length,
                remote: remoteEntries.length,
              };
            });
          }

          // Локальных записей нет, но есть источники или виды, которых нет в файле — сохраняем их.
          if (mergedSources.length !== (remote.sources || []).length || typesDiffer(mergedTypes, remote.types)) {
            var mergedRemoteData = Store.normalize({
              sources: mergedSources,
              types: mergedTypes,
              entries: remoteEntries,
            });
            state.data = mergedRemoteData;
            return Store.save(mergedRemoteData).then(function (saveResult) {
              state.data = saveResult.data;
              return { loaded: true, entries: remoteEntries.length };
            });
          }

          state.data = remote;
          return { loaded: true, entries: remoteEntries.length };
        });
      })
      .then(function (result) {
        state.mode = "github";
        state.editingId = null;
        els.sToken.value = "";
        els.sToken.placeholder = "Токен сохранён · вставьте новый, чтобы заменить";
        refreshSyncLabel();
        renderAll();

        var message = result.created
          ? "GitHub подключён, файл создан. Записей: " + result.entries
          : result.uploaded
            ? "GitHub подключён, локальные записи отправлены: " + result.entries
            : result.merged
              ? "GitHub подключён. Записи объединены: " + result.entries + " (на устройстве " + result.local + ", в файле " + result.remote + ")"
              : "GitHub подключён. Загружено записей: " + result.entries;

        els.settingsOk.textContent = message;
        els.settingsOk.hidden = false;
        toast(message);

        window.setTimeout(function () {
          closeModal(els.settingsModal);
        }, 900);
      })
      .catch(function (error) {
        showSettingsError(error.message || "Не удалось подключиться к GitHub.");
      })
      .then(function () {
        els.saveSettingsBtn.disabled = false;
        els.saveSettingsBtn.textContent = "Проверить и сохранить";
      });
  }

  function disconnect() {
    Store.clearConfig();
    state.mode = "local";
    refreshSyncLabel();
    renderFooter();
    els.settingsOk.textContent = "GitHub отключён. Записи остались в этом браузере.";
    els.settingsOk.hidden = false;
    els.settingsError.hidden = true;
    toast("GitHub отключён, данные остались на устройстве", "warn");
  }

  function exportJSON() {
    var text = Store.exportData(state.data);
    var blob = new Blob([text], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "income-" + todayISO() + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast("Файл сохранён");
  }

  function importJSON(file) {
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var data = Store.normalize(parsed);

        if (!data.entries.length) {
          toast("В файле нет записей", "warn");
          return;
        }

        confirmAction(
          "Заменить данные?",
          "Сейчас в дашборде " + state.data.entries.length + " " + plural(state.data.entries.length, "запись", "записи", "записей") +
            ". Из файла загрузится " + data.entries.length + ". Текущие записи будут заменены.",
          "Заменить",
          function () {
            state.data = data;
            persist("Импортировано записей: " + data.entries.length);
            els.importInput.value = "";
          }
        );
      } catch (error) {
        toast("Не удалось прочитать файл: нужен JSON из этого дашборда", "error", 7000);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function clearAll() {
    if (!state.data.entries.length) {
      toast("Записей и так нет", "warn");
      return;
    }

    confirmAction(
      "Удалить все записи?",
      "Будет удалено " + state.data.entries.length + " " + plural(state.data.entries.length, "запись", "записи", "записей") +
        ". Это действие нельзя отменить, но данные останутся в истории GitHub.",
      "Удалить всё",
      function () {
        var sources = (state.data.sources || []).slice();
        var types = (state.data.types || []).slice();
        state.data = Store.emptyData();
        state.data.sources = sources;
        state.data.types = types;
        persist("Все записи удалены");
        closeModal(els.settingsModal);
      }
    );
  }

  /* ---------------------------- модалки --------------------------- */

  function openModal(modal) {
    modal.hidden = false;
    document.body.classList.add("is-locked");
  }

  function closeModal(modal) {
    if (modal === els.sourceModal) {
      state.sourceEditing = null;
      state.sourceReturnToEntry = false;
      renderSourceManager();
      renderSourceModalList();
    }

    if (modal === els.typeModal) {
      resetTypeForm();
    }

    modal.hidden = true;
    var anyOpen = ["entryModal", "settingsModal", "sourceModal", "typeModal", "confirmModal"].some(function (id) {
      return els[id] && !els[id].hidden;
    });
    if (!anyOpen) document.body.classList.remove("is-locked");
  }

  function closeTopModal() {
    var order = ["confirmModal", "typeModal", "sourceModal", "settingsModal", "entryModal"];
    for (var i = 0; i < order.length; i += 1) {
      var modal = els[order[i]];
      if (modal && !modal.hidden) {
        closeModal(modal);
        return;
      }
    }
  }

  function confirmAction(title, text, okLabel, callback) {
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    els.confirmOk.textContent = okLabel;
    state.confirmCb = callback;
    openModal(els.confirmModal);
  }

  /* ----------------------------- тосты ---------------------------- */

  function toast(message, kind, duration) {
    var node = document.createElement("div");
    node.className = "toast" + (kind ? " toast--" + kind : "");
    node.textContent = message;
    els.toasts.appendChild(node);

    window.setTimeout(function () {
      node.classList.add("is-out");
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 260);
    }, duration || 3800);
  }

  /* --------------------------- события ---------------------------- */

  function bindEvents() {
    els.themeBtn.addEventListener("click", toggleTheme);
    els.settingsBtn.addEventListener("click", openSettings);
    els.syncBtn.addEventListener("click", syncNow);
    els.addBtn.addEventListener("click", function () { openEntry(null); });
    els.fab.addEventListener("click", function () { openEntry(null); });
    els.emptyAddBtn.addEventListener("click", function () {
      if (els.emptyAddBtn.dataset.action === "reset") resetFilters();
      else openEntry(null);
    });

    // период
    els.periodChips.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-period]");
      if (!button) return;
      state.period = button.dataset.period;
      Array.prototype.forEach.call(els.periodChips.querySelectorAll(".chip"), function (chip) {
        chip.classList.toggle("is-active", chip === button);
      });
      els.customRange.hidden = state.period !== "custom";
      if (state.period === "custom" && !state.customFrom && !state.customTo) {
        var now = new Date();
        state.customFrom = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
        state.customTo = todayISO();
        els.fromDate.value = state.customFrom;
        els.toDate.value = state.customTo;
      }
      renderAll();
    });

    els.fromDate.addEventListener("change", function () {
      state.customFrom = els.fromDate.value;
      renderAll();
    });
    els.toDate.addEventListener("change", function () {
      state.customTo = els.toDate.value;
      renderAll();
    });

    // виды дохода
    els.typeChips.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-type]");
      if (!button) return;

      if (button.dataset.type === "all") {
        state.types.clear();
      } else if (state.types.has(button.dataset.type)) {
        state.types.delete(button.dataset.type);
      } else {
        state.types.add(button.dataset.type);
      }
      renderAll();
    });

    // способ выплаты
    els.methodFilter.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-method]");
      if (!button) return;
      state.method = button.dataset.method;
      Array.prototype.forEach.call(els.methodFilter.querySelectorAll("button"), function (chip) {
        chip.classList.toggle("is-active", chip === button);
      });
      renderAll();
    });

    els.sourceFilter.addEventListener("change", function () {
      state.source = els.sourceFilter.value;
      renderAll();
    });

    var searchTimer = null;
    els.searchInput.addEventListener("input", function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        state.query = els.searchInput.value;
        renderAll();
      }, 160);
    });

    // список
    els.entries.addEventListener("click", function (event) {
      var action = event.target.closest("[data-act]");
      if (!action) return;
      var row = action.closest(".row");
      if (!row) return;
      if (action.dataset.act === "edit") editEntry(row.dataset.id);
      if (action.dataset.act === "delete") deleteEntry(row.dataset.id);
    });

    // график: клик по столбцу выбирает месяц
    els.bars.addEventListener("click", function (event) {
      var bar = event.target.closest(".bar[data-month]");
      if (!bar) return;
      selectMonth(bar.dataset.month);
    });

    // форма записи
    els.formTypes.addEventListener("click", function (event) {
      var addButton = event.target.closest('[data-act="add-type"]');
      if (addButton) {
        openTypeManager();
        return;
      }

      var button = event.target.closest("button[data-type]");
      if (!button) return;
      state.formType = button.dataset.type;
      syncFormType();
    });

    // виды дохода
    if (els.typeForm) {
      els.typeForm.addEventListener("submit", handleTypeSubmit);
    }
    if (els.typeColors) {
      els.typeColors.addEventListener("click", handleTypeColorsClick);
    }
    if (els.cancelTypeEditBtn) {
      els.cancelTypeEditBtn.addEventListener("click", cancelTypeEdit);
    }
    if (els.typeList) {
      els.typeList.addEventListener("click", handleTypeListClick);
    }

    els.formMethod.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-method]");
      if (!button) return;
      state.formMethod = button.dataset.method;
      syncFormMethod();
    });

    els.fAmount.addEventListener("blur", function () {
      var amount = parseAmount(els.fAmount.value);
      if (isFinite(amount) && amount > 0) {
        els.fAmount.value = nfMoney.format(amount);
      }
    });

    els.entryForm.addEventListener("submit", handleEntrySubmit);

    // источники (проверяем наличие элементов: HTML и JS могут обновиться не одновременно)
    if (els.addSourceFromForm) {
      els.addSourceFromForm.addEventListener("click", function () { openSourceManager(true); });
    }
    if (els.addSourceBtn) {
      els.addSourceBtn.addEventListener("click", function () { openSourceManager(false); });
    }
    if (els.sourceForm) {
      els.sourceForm.addEventListener("submit", handleSourceAdd);
    }
    if (els.sourceListManager) {
      els.sourceListManager.addEventListener("click", function (event) {
        handleSourceListClick(event, false);
      });
      els.sourceListManager.addEventListener("submit", handleSourceEdit);
    }
    if (els.sourceModalList) {
      els.sourceModalList.addEventListener("click", function (event) {
        handleSourceListClick(event, state.sourceReturnToEntry);
      });
      els.sourceModalList.addEventListener("submit", handleSourceEdit);
      els.sourceModalList.addEventListener("keydown", function (event) {
        handleSourceListKeydown(event, state.sourceReturnToEntry);
      });
    }

    // настройки
    els.settingsForm.addEventListener("submit", handleSettingsSubmit);
    els.sToken.addEventListener("focus", function () {
      els.sToken.removeAttribute("readonly");
    });
    els.disconnectBtn.addEventListener("click", disconnect);
    els.exportBtn.addEventListener("click", exportJSON);
    els.importInput.addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      importJSON(file);
    });
    els.clearBtn.addEventListener("click", clearAll);

    // модалки
    document.addEventListener("click", function (event) {
      var closer = event.target.closest("[data-close]");
      if (!closer) return;
      var modal = closer.closest(".modal");
      if (modal) closeModal(modal);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (state.sourceEditing) {
        cancelSourceEdit();
        return;
      }
      closeTopModal();
    });

    // подтверждение
    els.confirmOk.addEventListener("click", function () {
      var callback = state.confirmCb;
      state.confirmCb = null;
      closeModal(els.confirmModal);
      if (typeof callback === "function") callback();
    });

    // при возврате на вкладку — тихо обновляем статус
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Store.isConnected() && !Store.hasPending()) refreshSyncLabel();
    });
  }

  function resetFilters() {
    state.types.clear();
    state.method = "all";
    state.source = "all";
    state.query = "";
    els.searchInput.value = "";
    Array.prototype.forEach.call(els.methodFilter.querySelectorAll("button"), function (button) {
      button.classList.toggle("is-active", button.dataset.method === "all");
    });
    renderAll();
  }

  /* ----------------------------- старт ---------------------------- */

  function loadData() {
    setSync("loading", "Загрузка…");
    Store.load().then(
      function (result) {
        state.data = result.data;
        state.mode = result.mode;

        if (result.pending) {
          setSync("pending", "Не отправлено", "Есть изменения, которые не ушли на GitHub. Нажмите, чтобы отправить.");
        } else if (result.offline) {
          setSync("error", "Нет связи", result.error);
          toast(result.error, "error", 7000);
        } else if (result.missing) {
          setSync("ok", "GitHub", "Файл данных ещё не создан — появится после первой записи.");
          toast("Файл данных ещё не создан на GitHub. Он появится после первой записи.", "warn", 6000);
        } else {
          refreshSyncLabel();
        }

        renderAll();
      },
      function (error) {
        state.data = Store.emptyData();
        setSync("error", "Ошибка", error.message);
        renderAll();
        toast(error.message || "Не удалось загрузить данные", "error", 8000);
      }
    );
  }

  function init() {
    cacheEls();

    var savedTheme = Store.getTheme();
    var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(savedTheme || (prefersLight ? "light" : "dark"));

    state.data = Store.emptyData();
    renderFormTypes();
    bindEvents();

    els.customRange.hidden = true;
    els.fromDate.value = "";
    els.toDate.value = "";

    loadData();

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function () {});
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
