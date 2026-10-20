/* =====================================================================
   Хранилище данных дашборда.

   Два режима:
   1) GitHub — JSON-файл в репозитории через GitHub Contents API.
   2) Локальный — только localStorage (пока GitHub не подключён).

   В любом режиме данные дублируются в localStorage, чтобы приложение
   открывалось без сети и не теряло введённые записи.
   ===================================================================== */
(function (global) {
  "use strict";

  var KEYS = {
    config: "income.config.v1",
    cache: "income.cache.v1",
    pending: "income.pending.v1",
    theme: "income.theme.v1",
  };

  var DEFAULTS = {
    branch: "main",
    path: "data/income.json",
  };

  var config = readJSON(KEYS.config, null);
  var pending = readJSON(KEYS.pending, false);
  var sha = null;

  /* ------------------------- localStorage ------------------------- */

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }

  /* ---------------------------- данные ---------------------------- */

  function uid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function emptyData() {
    return { version: 1, updatedAt: null, entries: [] };
  }

  function normalize(data) {
    var out = emptyData();
    if (!data || typeof data !== "object") return out;

    var list = Array.isArray(data.entries) ? data.entries : [];
    out.entries = list
      .filter(function (item) {
        return item && typeof item === "object";
      })
      .map(function (item) {
        var amount = Number(String(item.amount == null ? 0 : item.amount).replace(",", "."));
        return {
          id: typeof item.id === "string" && item.id ? item.id : uid(),
          date: typeof item.date === "string" ? item.date.slice(0, 10) : "",
          type: typeof item.type === "string" ? item.type : "side",
          amount: isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
          method: item.method === "bank" ? "bank" : "cash",
          source: typeof item.source === "string" ? item.source.slice(0, 120) : "",
          note: typeof item.note === "string" ? item.note.slice(0, 300) : "",
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || null,
        };
      })
      .filter(function (item) {
        return Boolean(item.date);
      });

    out.updatedAt = typeof data.updatedAt === "string" ? data.updatedAt : null;
    return out;
  }

  function localData() {
    return normalize(readJSON(KEYS.cache, null));
  }

  function hasLocalData() {
    var data = readJSON(KEYS.cache, null);
    return !!(data && Array.isArray(data.entries) && data.entries.length);
  }

  /* --------------------------- настройки -------------------------- */

  function getConfig() {
    if (!config) return null;
    return {
      owner: config.owner || "",
      repo: config.repo || "",
      branch: config.branch || DEFAULTS.branch,
      path: config.path || DEFAULTS.path,
      token: config.token || "",
    };
  }

  function saveConfig(next) {
    config = {
      owner: String(next.owner || "").trim(),
      repo: String(next.repo || "").trim(),
      branch: String(next.branch || DEFAULTS.branch).trim(),
      path: String(next.path || DEFAULTS.path).trim().replace(/^\/+/, ""),
      token: String(next.token || "").trim(),
    };
    writeJSON(KEYS.config, config);
    sha = null;
    pending = false;
    writeJSON(KEYS.pending, false);
  }

  function clearConfig() {
    config = null;
    sha = null;
    pending = false;
    removeKey(KEYS.config);
    writeJSON(KEYS.pending, false);
  }

  function isConnected() {
    return !!(config && config.owner && config.repo && config.token);
  }

  function hasPending() {
    return pending === true;
  }

  /* ------------------------- GitHub API --------------------------- */

  function apiUrl(cfg) {
    var path = String(cfg.path || DEFAULTS.path)
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");

    return (
      "https://api.github.com/repos/" +
      encodeURIComponent(cfg.owner) +
      "/" +
      encodeURIComponent(cfg.repo) +
      "/contents/" +
      path
    );
  }

  function headers(cfg) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + cfg.token,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  function repoUrl(cfg) {
    return (
      "https://api.github.com/repos/" +
      encodeURIComponent(cfg.owner) +
      "/" +
      encodeURIComponent(cfg.repo)
    );
  }

  // Проверяем, что репозиторий существует и токену доступен.
  function repoCheck(cfg) {
    return fetch(repoUrl(cfg), { headers: headers(cfg), cache: "no-store" }).then(function (res) {
      if (!res.ok) return httpError(res).then(function (err) { throw err; });
      return res.json();
    });
  }

  // Проверяем ветку до записи файла, чтобы не сохранить заведомо неверные настройки.
  function branchCheck(cfg) {
    var branch = cfg.branch || DEFAULTS.branch;

    return fetch(repoUrl(cfg) + "/branches/" + encodeURIComponent(branch), {
      headers: headers(cfg),
      cache: "no-store",
    }).then(function (res) {
      if (res.status === 404) {
        var err = new Error("Ветка «" + branch + "» не найдена в репозитории.");
        err.status = 404;
        throw err;
      }
      if (!res.ok) return httpError(res).then(function (err) { throw err; });
      return res.json();
    });
  }

  function httpError(res) {
    return res
      .json()
      .catch(function () {
        return {};
      })
      .then(function (body) {
        var message = body && body.message ? " (" + body.message + ")" : "";
        var text;

        if (res.status === 401) {
          text = "GitHub не принял токен (401). Проверьте токен в настройках.";
        } else if (res.status === 403) {
          text =
            "Нет доступа к репозиторию (403). Токену нужно право Contents: Read and write.";
        } else if (res.status === 404) {
          text =
            "Репозиторий не найден или нет доступа (404). Проверьте владельца, название и права токена.";
        } else if (res.status === 409) {
          text = "Файл на GitHub изменился параллельно (409).";
        } else if (res.status === 422) {
          text = "GitHub отклонил запрос (422). Проверьте ветку и путь к файлу.";
        } else {
          text = "GitHub вернул ошибку " + res.status + ".";
        }

        var err = new Error(text + message);
        err.status = res.status;
        return err;
      });
  }

  function b64encode(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = "";
    var chunk = 0x8000;

    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function b64decode(base64) {
    var binary = atob(String(base64).replace(/\s/g, ""));
    var bytes = new Uint8Array(binary.length);

    for (var i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function remoteGet(cfg) {
    cfg = cfg || getConfig();
    if (!cfg || !cfg.owner || !cfg.repo) {
      return Promise.reject(new Error("Не указан репозиторий."));
    }

    var url =
      apiUrl(cfg) + "?ref=" + encodeURIComponent(cfg.branch || "main") + "&t=" + Date.now();

    return fetch(url, { headers: headers(cfg), cache: "no-store" }).then(function (res) {
      if (res.status === 404) {
        return { data: null, sha: null, exists: false };
      }
      if (!res.ok) return httpError(res).then(function (err) { throw err; });

      return res.json().then(function (body) {
        var text = "";

        if (body && body.content) {
          try {
            text = b64decode(body.content);
          } catch (err) {
            text = "";
          }
        }

        var data = null;
        if (text.trim()) {
          try {
            data = JSON.parse(text);
          } catch (err) {
            throw new Error("Файл на GitHub повреждён: это не корректный JSON.");
          }
        }

        return { data: data, sha: (body && body.sha) || null, exists: true };
      });
    });
  }

  function remotePut(cfg, data, baseSha) {
    var body = {
      message:
        "income: обновление данных " +
        new Date().toLocaleString("ru-RU", { timeZone: "UTC" }) +
        " UTC",
      content: b64encode(JSON.stringify(data, null, 2) + "\n"),
      branch: cfg.branch || "main",
    };

    if (baseSha) body.sha = baseSha;

    return fetch(apiUrl(cfg), {
      method: "PUT",
      headers: headers(cfg),
      body: JSON.stringify(body),
    }).then(function (res) {
      if (!res.ok) return httpError(res).then(function (err) { throw err; });
      return res.json().then(function (json) {
        return (json && json.content && json.content.sha) || null;
      });
    });
  }

  function testConfig(cfg) {
    return repoCheck(cfg)
      .then(function () { return branchCheck(cfg); })
      .then(function () { return remoteGet(cfg); })
      .then(function (res) {
        return {
          exists: res.exists,
          sha: res.sha,
          entries:
            res.data && Array.isArray(res.data.entries) ? res.data.entries.length : 0,
        };
      });
  }

  /* --------------------------- чтение ----------------------------- */

  function load() {
    var local = localData();

    if (!isConnected()) {
      return Promise.resolve({ data: local, mode: "local" });
    }

    // Есть несохранённые изменения — показываем их, а не затираем данными с GitHub.
    if (pending) {
      return Promise.resolve({ data: local, mode: "github", pending: true });
    }

    return remoteGet()
      .then(function (res) {
        sha = res.sha;

        if (!res.exists) {
          // Файла ещё нет: работаем с локальной копией, создадим при сохранении.
          return { data: local, mode: "github", missing: true };
        }

        var remote = normalize(res.data);
        writeJSON(KEYS.cache, remote);
        return { data: remote, mode: "github" };
      })
      .catch(function (err) {
        var hasCache = readJSON(KEYS.cache, null) !== null;
        if (hasCache) {
          return {
            data: local,
            mode: "github",
            offline: true,
            error: friendlyNetworkError(err),
          };
        }
        throw err;
      });
  }

  /* --------------------------- запись ----------------------------- */

  function attemptPush(data) {
    var cfg = getConfig();
    var ready = sha
      ? Promise.resolve()
      : remoteGet(cfg).then(function (res) {
          sha = res.sha;
          if (res.exists) {
            // Файл существует, но мы его не читали — не перезаписываем вслепую.
            var err = new Error(
              "На GitHub уже есть файл с данными. Перезагрузите страницу, чтобы получить актуальную версию."
            );
            err.conflict = true;
            throw err;
          }
        });

    return ready.then(function () {
      return remotePut(cfg, data, sha);
    });
  }

  function save(data) {
    var clean = normalize(data);
    clean.updatedAt = new Date().toISOString();
    writeJSON(KEYS.cache, clean);

    if (!isConnected()) {
      pending = false;
      writeJSON(KEYS.pending, false);
      return Promise.resolve({ mode: "local", data: clean });
    }

    return attemptPush(clean).then(
      function (newSha) {
        sha = newSha;
        pending = false;
        writeJSON(KEYS.pending, false);
        return { mode: "github", data: clean };
      },
      function (err) {
        // Конфликт версий: один повтор с актуальным sha.
        if (err && err.status === 409 && !err.retried) {
          return remoteGet()
            .then(function (res) {
              sha = res.sha;
              return remotePut(getConfig(), clean, sha);
            })
            .then(function (newSha) {
              sha = newSha;
              pending = false;
              writeJSON(KEYS.pending, false);
              return { mode: "github", data: clean, retried: true };
            })
            .catch(function (secondErr) {
              pending = true;
              writeJSON(KEYS.pending, true);
              secondErr.pending = true;
              secondErr.message = friendlyNetworkError(secondErr);
              throw secondErr;
            });
        }

        pending = true;
        writeJSON(KEYS.pending, true);
        err.pending = true;
        err.message = friendlyNetworkError(err);
        throw err;
      }
    );
  }

  function syncNow(data) {
    pending = readJSON(KEYS.pending, false);
    if (pending) return save(data);
    return load();
  }

  /* --------------------------- утилиты ---------------------------- */

  function friendlyNetworkError(err) {
    if (!err) return "Неизвестная ошибка.";
    if (err.conflict) return err.message;
    if (err.status) return err.message;
    if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(err.message || "")) {
      return "Нет связи с GitHub. Проверьте интернет — изменения сохранены на устройстве.";
    }
    return err.message || "Не удалось связаться с GitHub.";
  }

  function getTheme() {
    var value = readJSON(KEYS.theme, null);
    return value === "light" || value === "dark" ? value : null;
  }

  function setTheme(theme) {
    writeJSON(KEYS.theme, theme);
  }

  function exportData(data) {
    return JSON.stringify(normalize(data), null, 2) + "\n";
  }

  function clearAll() {
    var empty = emptyData();
    writeJSON(KEYS.cache, empty);
    pending = false;
    writeJSON(KEYS.pending, false);
    sha = null;
    return empty;
  }

  global.Store = {
    DEFAULTS: DEFAULTS,
    uid: uid,
    normalize: normalize,
    emptyData: emptyData,
    getConfig: getConfig,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    isConnected: isConnected,
    hasPending: hasPending,
    hasLocalData: hasLocalData,
    load: load,
    save: save,
    syncNow: syncNow,
    testConfig: testConfig,
    getTheme: getTheme,
    setTheme: setTheme,
    exportData: exportData,
    clearAll: clearAll,
  };
})(window);
