window.__ModuleLoader__.load({ id: "dsh-mobile-notify", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react4 = require("react");

// src/client/Banner.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var card = {
  position: "absolute",
  right: 20,
  bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
  zIndex: 40,
  boxSizing: "border-box",
  width: "min(380px, calc(100vw - 32px))",
  maxHeight: "min(70vh, 560px)",
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 9,
  padding: "12px 12px 10px",
  border: "1px solid var(--dsw-alias-border-l2, var(--dsh-color-border, rgba(127,127,127,.32)))",
  borderRadius: 14,
  background: "var(--dsw-alias-bg-layer-1, var(--dsh-color-surface, #fff))",
  color: "var(--dsw-alias-label-primary, var(--dsh-color-text, inherit))",
  boxShadow: "0 16px 40px rgba(15,23,42,.18), 0 2px 8px rgba(15,23,42,.08)",
  pointerEvents: "auto",
  fontSize: 12,
  lineHeight: 1.45
};
var header = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 2px"
};
var title = {
  flex: "1 1 auto",
  minWidth: 0,
  fontSize: 13,
  fontWeight: 650,
  letterSpacing: ".1px"
};
var dot = {
  flex: "0 0 auto",
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "var(--dsw-alias-accent, var(--dsh-color-accent, #4f46e5))"
};
var count = {
  flex: "0 0 auto",
  fontSize: 10,
  fontWeight: 650,
  lineHeight: "16px",
  minWidth: 18,
  padding: "0 6px",
  borderRadius: 999,
  textAlign: "center",
  color: "var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))",
  background: "var(--dsw-alias-bg-overlay, rgba(127,127,127,.1))"
};
var list = {
  display: "flex",
  flexDirection: "column",
  gap: 6
};
var itemButton = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  border: "1px solid var(--dsw-alias-border-l1, var(--dsh-color-border, rgba(127,127,127,.26)))",
  borderRadius: 10,
  background: "var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-2, rgba(127,127,127,.055)))",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer"
};
var itemTop = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0
};
var kindChip = {
  flex: "0 0 auto",
  padding: "0 6px",
  borderRadius: 999,
  border: "1px solid var(--dsw-alias-border-l2, var(--dsh-color-border, rgba(127,127,127,.3)))",
  color: "var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))",
  fontSize: 10,
  fontWeight: 650,
  lineHeight: "17px"
};
var sessionLabel = {
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 600
};
var summaryText = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))",
  fontSize: 11
};
var openHint = {
  marginTop: 1,
  color: "var(--dsw-alias-accent, var(--dsh-color-accent, #4f46e5))",
  fontSize: 11,
  fontWeight: 600
};
var moreRow = {
  padding: "1px 3px 0",
  color: "var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))",
  fontSize: 11
};
var noticeRow = {
  padding: "6px 8px",
  borderRadius: 8,
  background: "var(--dsw-alias-bg-layer-2, rgba(127,127,127,.08))",
  color: "var(--dsw-alias-label-secondary, var(--dsh-color-text-secondary, rgba(127,127,127,.95)))",
  fontSize: 11
};
function Banner({ store, t, onShown, onOpen }) {
  const snapshot = (0, import_react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [entered, setEntered] = (0, import_react.useState)(false);
  const items = snapshot.items;
  const notice = snapshot.notice;
  const visible = items.length > 0 || notice !== void 0;
  (0, import_react.useEffect)(() => {
    for (const item of items) {
      if (item.needsAck) onShown(item.key);
    }
  }, [items, onShown]);
  (0, import_react.useEffect)(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);
  if (!visible) return null;
  const motion = {
    opacity: entered ? 1 : 0,
    transform: entered ? "translateY(0) scale(1)" : "translateY(8px) scale(.985)",
    transformOrigin: "right bottom",
    transition: "opacity 160ms ease, transform 180ms cubic-bezier(.2,.8,.2,1)"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, ...motion }, role: "status", "aria-live": "polite", "aria-label": t("banner.title"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: dot, "aria-hidden": "true" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: title, children: t("banner.title") }),
      items.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: count, children: items.length }) : null
    ] }),
    items.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: list, children: [
      items.slice(0, 3).map((item) => {
        const showSummary = item.summary !== "" && item.summary !== item.label && item.summary !== item.kindTitle;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            style: itemButton,
            onClick: () => onOpen(item.sessionId),
            title: `${item.kindTitle}${item.label === "" ? "" : ` \xB7 ${item.label}`}${showSummary ? ` \u2014 ${item.summary}` : ""}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: itemTop, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: kindChip, children: item.kindTitle }),
                item.label === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: sessionLabel, children: item.label })
              ] }),
              showSummary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: summaryText, children: item.summary }) : null,
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: openHint, children: [
                t("banner.open"),
                " \u2192"
              ] })
            ]
          },
          item.key
        );
      }),
      items.length > 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: moreRow, children: t("banner.more", { count: String(items.length - 3) }) }) : null
    ] }),
    notice === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: noticeRow, children: notice })
  ] });
}

// src/client/ConfigCard.tsx
var import_react2 = require("react");

// src/client/http.ts
async function requestJson(path, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetch(path, {
      ...init,
      credentials: "same-origin",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}
function postJson(path, body, timeoutMs) {
  return requestJson(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }, timeoutMs);
}
function putJson(path, body, timeoutMs) {
  return requestJson(path, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }, timeoutMs);
}

// src/client/ConfigCard.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var section = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "14px 0",
  borderTop: "1px solid var(--dsh-color-border, rgba(127,127,127,.28))"
};
var sectionTitle = { fontSize: 13, fontWeight: 650 };
var muted = { fontSize: 12, lineHeight: 1.5, color: "var(--dsh-color-text-secondary, rgba(127,127,127,.95))" };
var row = { display: "grid", gridTemplateColumns: "minmax(140px, 220px) minmax(0, 1fr)", gap: 10, alignItems: "center" };
var rowLabel = { fontSize: 12, color: "var(--dsh-color-text-secondary, rgba(127,127,127,.95))" };
var input = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid var(--dsh-color-border, rgba(127,127,127,.4))",
  borderRadius: 6,
  background: "transparent",
  color: "inherit",
  padding: "5px 8px",
  fontSize: 12
};
var button = {
  border: "1px solid var(--dsh-color-border, rgba(127,127,127,.45))",
  borderRadius: 6,
  background: "transparent",
  color: "inherit",
  padding: "5px 10px",
  fontSize: 12,
  cursor: "pointer"
};
var primary = { ...button, background: "var(--dsh-color-accent, #4f46e5)", color: "#fff", borderColor: "transparent" };
var checks = { display: "flex", flexWrap: "wrap", gap: "8px 18px" };
var check = { display: "flex", gap: 6, alignItems: "center", fontSize: 12 };
var actions = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
var badge = {
  alignSelf: "flex-start",
  flexShrink: 0,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid var(--dsh-color-border, rgba(127,127,127,.4))",
  fontSize: 11,
  lineHeight: 1.5,
  whiteSpace: "nowrap"
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function errorText(value) {
  if (isRecord(value) && typeof value.message === "string") return value.message;
  if (isRecord(value) && typeof value.error === "string") return value.error;
  return "";
}
var kindKeys = ["approval", "question", "planReview", "turn", "test", "notice"];
function ConfigCard({ t, sendTest }) {
  const [view, setView] = (0, import_react2.useState)(void 0);
  const [draft, setDraft] = (0, import_react2.useState)(void 0);
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const [loadError, setLoadError] = (0, import_react2.useState)("");
  const [saveState, setSaveState] = (0, import_react2.useState)("idle");
  const [saveMessage, setSaveMessage] = (0, import_react2.useState)("");
  const [sendkey, setSendkey] = (0, import_react2.useState)("");
  const [clearSendkey, setClearSendkey] = (0, import_react2.useState)(false);
  const [testing, setTesting] = (0, import_react2.useState)(false);
  const [testResult, setTestResult] = (0, import_react2.useState)(void 0);
  const [permission, setPermission] = (0, import_react2.useState)(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await requestJson("/mobile/settings", { headers: { accept: "application/json" } }, 5e3);
      if (!response.ok) {
        const body2 = await response.json().catch(() => void 0);
        throw new Error(errorText(body2) || `HTTP ${response.status}`);
      }
      const body = await response.json();
      const next = JSON.parse(JSON.stringify(body.settings));
      setView(body);
      setDraft(next);
      setSendkey("");
      setClearSendkey(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("config.loadFailed"));
    } finally {
      setLoading(false);
    }
  };
  (0, import_react2.useEffect)(() => {
    let mounted = true;
    void (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const mutate = (change) => {
    setDraft((current) => current === void 0 ? current : change(current));
  };
  const server = (patch) => mutate((current) => ({
    ...current,
    serverchan3: { ...current.serverchan3, ...patch }
  }));
  const tags = (patch) => mutate((current) => ({
    ...current,
    serverchan3: {
      ...current.serverchan3,
      tags: { ...current.serverchan3.tags, ...patch }
    }
  }));
  const notify = (patch) => mutate((current) => ({ ...current, notify: { ...current.notify, ...patch } }));
  const privacy = (patch) => mutate((current) => ({ ...current, privacy: { ...current.privacy, ...patch } }));
  const limits = (patch) => mutate((current) => ({ ...current, limits: { ...current.limits, ...patch } }));
  const setKindTag = (key, value) => {
    mutate((current) => {
      const kindTags = { ...current.serverchan3.tags.kindTags };
      if (value.trim() === "") delete kindTags[key];
      else kindTags[key] = value.trim();
      return {
        ...current,
        serverchan3: {
          ...current.serverchan3,
          tags: { ...current.serverchan3.tags, kindTags }
        }
      };
    });
  };
  const save = async (event) => {
    event.preventDefault();
    if (draft === void 0 || view?.editable === false || saveState === "saving") return;
    if (draft.notify.turnDone && typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        setPermission(await Notification.requestPermission());
      } catch {
      }
    }
    setSaveState("saving");
    setSaveMessage("");
    const body = { settings: draft };
    if (clearSendkey) body.sendkey = null;
    else if (sendkey.trim() !== "") body.sendkey = sendkey.trim();
    try {
      const response = await putJson("/mobile/settings", body, 3e4);
      const payload = await response.json().catch(() => void 0);
      if (!response.ok) throw new Error(errorText(payload) || t("config.saveFailed"));
      setSaveState("saved");
      setSaveMessage(t("config.saved"));
      setSendkey("");
      setClearSendkey(false);
      setTimeout(() => {
        void load();
      }, 900);
    } catch (error) {
      setSaveState("uncertain");
      setSaveMessage(error instanceof Error && error.message !== "" ? `${t("config.saveUncertain")} (${error.message})` : t("config.saveUncertain"));
      setTimeout(() => {
        void load();
      }, 1500);
    }
  };
  const test = async () => {
    if (testing) return;
    setTesting(true);
    setTestResult(void 0);
    try {
      setTestResult(await sendTest());
    } catch {
      setTestResult("failed");
    } finally {
      setTesting(false);
    }
  };
  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission(permission);
    }
  };
  if (loading && draft === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: section, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: muted, children: t("config.loading") }) });
  }
  if (draft === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: muted, children: t("config.loadFailed") }),
      loadError === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: muted, children: loadError }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: button, onClick: () => {
        void load();
      }, children: t("config.reload") }) })
    ] });
  }
  const editable = view?.editable !== false;
  const sendkeyStatus = view?.sendkey;
  const note = sendkeyStatus === void 0 ? t("config.sendkeyMissing") : sendkeyStatus.configured ? t("config.sendkeyConfigured") : t("config.sendkeyMissing");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { style: { display: "flex", flexDirection: "column" }, onSubmit: (event) => {
    void save(event);
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 14, fontWeight: 700 }, children: t("config.title") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: muted, children: t("config.description") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: badge, children: view?.sendkey.available === false ? t("config.credentialsUnavailable") : t("config.pluginConfig") })
      ] }),
      editable ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...muted, color: "var(--dsh-color-warning, #b45309)" }, children: t("config.readOnly") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: sectionTitle, children: t("config.deployment") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.publicBase") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "url", value: draft.publicBase, disabled: !editable, onChange: (e) => mutate((c) => ({ ...c, publicBase: e.target.value })) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.transport") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { style: input, value: draft.transport, disabled: !editable, onChange: (e) => mutate((c) => ({ ...c, transport: e.target.value })), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "dryRun", children: t("config.transportDryRun") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "serverchan3", children: t("config.transportServerchan3") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.appPackage") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, value: draft.serverchan3.appPackage, disabled: !editable, onChange: (e) => server({ appPackage: e.target.value }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.fallbackUrl") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "url", value: draft.serverchan3.fallbackUrl, disabled: !editable, onChange: (e) => server({ fallbackUrl: e.target.value }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: sectionTitle, children: t("config.serverchan3") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.sendkey") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: { ...input, flex: "1 1 260px" }, type: "password", autoComplete: "new-password", placeholder: t("config.sendkeyHint"), value: sendkey, disabled: !editable || clearSendkey, onChange: (e) => setSendkey(e.target.value) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: badge, children: note })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: checks, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: clearSendkey, disabled: !editable, onChange: (e) => setClearSendkey(e.target.checked) }),
              t("config.clearSendkey")
            ] }),
            sendkeyStatus?.available === false ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: muted, children: t("config.credentialsUnavailable") }) : null
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: sectionTitle, children: t("config.tags") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: checks, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.serverchan3.tags.enabled, disabled: !editable, onChange: (e) => tags({ enabled: e.target.checked }) }),
          t("config.tagsEnabled")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.serverchan3.tags.includeNamespace, disabled: !editable, onChange: (e) => tags({ includeNamespace: e.target.checked }) }),
          t("config.includeNamespace")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.serverchan3.tags.includeKind, disabled: !editable, onChange: (e) => tags({ includeKind: e.target.checked }) }),
          t("config.includeKind")
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.namespace") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, value: draft.serverchan3.tags.namespace, disabled: !editable, onChange: (e) => tags({ namespace: e.target.value }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.extraTags") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, value: draft.serverchan3.tags.extra.join(", "), disabled: !editable, onChange: (e) => tags({ extra: e.target.value.split(/[,\n]/u).map((v) => v.trim()).filter((v) => v !== "") }), placeholder: "homelab, work" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { style: { ...muted, cursor: "pointer" }, children: t("config.kindTags") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }, children: kindKeys.map((key) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: key }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, value: draft.serverchan3.tags.kindTags[key] ?? "", placeholder: key === "planReview" ? "dsh-plan-review" : `dsh-${key}`, disabled: !editable, onChange: (e) => setKindTag(key, e.target.value) })
        ] }, key)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: sectionTitle, children: t("config.notify") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: checks, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.approval, disabled: !editable, onChange: (e) => notify({ approval: e.target.checked }) }),
          t("config.approval")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.question, disabled: !editable, onChange: (e) => notify({ question: e.target.checked }) }),
          t("config.question")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.planReview, disabled: !editable, onChange: (e) => notify({ planReview: e.target.checked }) }),
          t("config.planReview")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.turnDone, disabled: !editable, onChange: (e) => notify({ turnDone: e.target.checked }) }),
          t("config.turnDone")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.modelTool, disabled: !editable, onChange: (e) => notify({ modelTool: e.target.checked }) }),
          t("config.modelTool")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.inPage, disabled: !editable, onChange: (e) => notify({ inPage: e.target.checked }) }),
          t("config.inPage")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.webNotification, disabled: !editable, onChange: (e) => notify({ webNotification: e.target.checked }) }),
          t("config.webNotification")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.notify.inPageCountsAsDelivered, disabled: !editable, onChange: (e) => notify({ inPageCountsAsDelivered: e.target.checked }) }),
          t("config.inPageCounts")
        ] })
      ] }),
      draft.notify.turnDone && permission !== "granted" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: muted, children: t("config.turnDonePermissionHint") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.detail") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { style: input, value: draft.notify.detail, disabled: !editable, onChange: (e) => notify({ detail: e.target.value }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "summary", children: t("config.detailSummary") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "title", children: t("config.detailTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "generic", children: t("config.detailGeneric") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.debounce") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 0, max: 1e4, value: draft.notify.debounceMs, disabled: !editable, onChange: (e) => notify({ debounceMs: Number(e.target.value) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.grace") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 0, max: 3e4, value: draft.notify.graceMs, disabled: !editable, onChange: (e) => notify({ graceMs: Number(e.target.value) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.settle") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 0, max: 2e3, value: draft.notify.settleMs, disabled: !editable, onChange: (e) => notify({ settleMs: Number(e.target.value) }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: sectionTitle, children: t("config.privacy") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: checks, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.privacy.includeSessionTitle, disabled: !editable, onChange: (e) => privacy({ includeSessionTitle: e.target.checked }) }),
          t("config.includeSession")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.privacy.includeReason, disabled: !editable, onChange: (e) => privacy({ includeReason: e.target.checked }) }),
          t("config.includeReason")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: check, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "checkbox", checked: draft.privacy.includeToolName, disabled: !editable, onChange: (e) => privacy({ includeToolName: e.target.checked }) }),
          t("config.includeTool")
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: section, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { style: { ...muted, cursor: "pointer" }, children: t("config.limits") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.bodyBytes") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 512, max: 2048, value: draft.limits.bodyBytes, disabled: !editable, onChange: (e) => limits({ bodyBytes: Number(e.target.value) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.ratePerMinute") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 10, max: 600, value: draft.limits.ratePerMinute, disabled: !editable, onChange: (e) => limits({ ratePerMinute: Number(e.target.value) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.pushPerMinute") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 1, max: 50, value: draft.limits.pushPerMinute, disabled: !editable, onChange: (e) => limits({ pushPerMinute: Number(e.target.value) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.pushTimeout") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 1e3, max: 3e4, value: draft.limits.pushTimeoutMs, disabled: !editable, onChange: (e) => limits({ pushTimeoutMs: Number(e.target.value) }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: row, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: rowLabel, children: t("config.pushRetries") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { style: input, type: "number", min: 0, max: 3, value: draft.limits.pushRetries, disabled: !editable, onChange: (e) => limits({ pushRetries: Number(e.target.value) }) })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: sectionTitle, children: t("config.permission") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: actions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: muted, children: permission }),
        permission === "granted" || permission === "unsupported" ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: button, onClick: () => {
          void requestPermission();
        }, children: t("config.requestPermission") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...section, flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: actions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "submit", style: { ...primary, opacity: editable && saveState !== "saving" ? 1 : 0.55 }, disabled: !editable || saveState === "saving", children: saveState === "saving" ? t("config.saving") : t("config.save") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: button, disabled: !editable, onClick: () => {
          void load();
        }, children: t("config.reload") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: button, disabled: testing, onClick: () => {
          void test();
        }, children: testing ? t("config.testing") : t("config.test") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: muted, children: saveMessage !== "" ? saveMessage : testResult === void 0 ? "" : testResult === "ok" ? t("config.testOk") : testResult === "dryRun" ? t("config.testDryRun") : t("config.testFailed") })
    ] })
  ] });
}

// src/client/ack.ts
function buildAckPayload(item, clientId, platform, delivered, via, reason, now = /* @__PURE__ */ new Date()) {
  return {
    contract: 1,
    clientId,
    platform,
    sessionId: item.sessionId,
    kind: item.kind,
    key: item.waitKey,
    delivered,
    via,
    reason,
    at: now.toISOString(),
    ...item.callId === void 0 ? {} : { callId: item.callId }
  };
}

// src/shared/text.ts
function normalize(value) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
}
function truncate(text, max) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}\u2026`;
}
function cleanText(value, max) {
  if (typeof value !== "string") return void 0;
  const text = normalize(value);
  if (text === "") return void 0;
  return truncate(text, max);
}
function shortId(value) {
  return value.length <= 8 ? value : value.slice(0, 8);
}

// src/client/delivery.ts
function decideDelivery(input2, config) {
  if (config.inPage && config.inPageCountsAsDelivered && input2.visible && input2.focused && input2.bannerAvailable) {
    if (input2.viewingSession === true) {
      return {
        mode: "in-page",
        via: "in-page",
        reason: "none",
        needsInPageAck: false,
        suppressCard: true
      };
    }
    return { mode: "in-page", via: "in-page", reason: "none", needsInPageAck: true };
  }
  if (config.webNotification && input2.notification === "granted") {
    return { mode: "web-notification", via: "web-notification", reason: "none", needsInPageAck: false };
  }
  const reason = input2.notification === "unsupported" ? "unsupported" : input2.notification === "denied" || input2.notification === "default" ? "permission-denied" : "hidden-no-notification";
  return { mode: "failed", via: "none", reason, needsInPageAck: false };
}
function kindTitle(kind, t) {
  switch (kind) {
    case "approval":
      return t("banner.approval");
    case "question":
      return t("banner.question");
    case "plan-review":
      return t("banner.planReview");
    case "turn":
      return t("banner.turn");
    case "notice":
      return t("banner.notice");
  }
}
function summarizePending(item, config, t) {
  if (config.detail === "generic") return t("banner.generic");
  const parts = [];
  if (config.includeSessionTitle && item.label !== "") parts.push(item.label);
  if (item.kind === "notice") {
    if (config.detail === "summary" && config.includeReason) {
      const text = cleanText(item.noticeBody ?? item.noticeTitle, 100);
      if (text !== void 0) parts.push(text);
    }
    if (parts.length === 0) parts.push(kindTitle(item.kind, t));
    return parts.join(" \xB7 ");
  }
  if (config.detail === "summary") {
    if (config.includeToolName) {
      const tool = cleanText(item.toolName, 60);
      if (tool !== void 0) parts.push(tool);
    }
    if (config.includeReason) {
      const text = cleanText(item.question ?? item.reason, 100);
      if (text !== void 0) parts.push(text);
    }
  }
  if (parts.length === 0) parts.push(kindTitle(item.kind, t));
  return parts.join(" \xB7 ");
}
function notificationTitle(item, t, config) {
  if (config?.detail === "generic") return t("banner.generic");
  const title2 = kindTitle(item.kind, t);
  if (config?.includeSessionTitle === false) return title2;
  return item.label === "" ? title2 : `${item.label} \xB7 ${title2}`;
}

// src/client/locale.ts
var NS = "dsh-mobile-notify";
var zh = {
  "banner.title": "\u5F85\u5904\u7406\u63D0\u9192",
  "banner.approval": "\u9700\u8981\u5BA1\u6279",
  "banner.question": "\u9700\u8981\u56DE\u7B54",
  "banner.planReview": "\u9700\u8981\u786E\u8BA4\u8BA1\u5212",
  "banner.turn": "\u672C\u8F6E\u5B8C\u6210",
  "banner.notice": "\u6A21\u578B\u901A\u77E5",
  "banner.generic": "DSH \u6709\u5F85\u5904\u7406\u63D0\u9192",
  "header.turnLabel": "\u5B8C\u6210\u901A\u77E5",
  "header.turnOn": "\u672C\u8F6E\u5B8C\u6210\u901A\u77E5\u5DF2\u5F00\u542F",
  "header.turnOff": "\u672C\u8F6E\u5B8C\u6210\u901A\u77E5\u5DF2\u5173\u95ED",
  "header.turnFailed": "\u672C\u8F6E\u5B8C\u6210\u901A\u77E5\u5207\u6362\u5931\u8D25",
  "banner.open": "\u6253\u5F00\u4F1A\u8BDD",
  "banner.more": "\u8FD8\u6709 {count} \u9879",
  "banner.unavailable": "\u4F1A\u8BDD\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5728 DSH \u4F1A\u8BDD\u5217\u8868\u4E2D\u6253\u5F00",
  "settings.title": "\u79FB\u52A8\u901A\u77E5",
  "settings.description": "\u9875\u5185\u63D0\u793A / \u6D4F\u89C8\u5668\u901A\u77E5\u4F18\u5148\uFF1B\u672A\u63D0\u9192\u5230\u4E14\u624B\u673A\u4E0D\u5728\u524D\u53F0\u65F6\u7531 Server\u9171\xB3 \u63A8\u9001\u3002",
  "settings.permission": "\u6D4F\u89C8\u5668\u901A\u77E5\u6743\u9650",
  "settings.granted": "\u5DF2\u5141\u8BB8",
  "settings.denied": "\u5DF2\u62D2\u7EDD\uFF0C\u53EF\u5728\u6D4F\u89C8\u5668\u7AD9\u70B9\u8BBE\u7F6E\u4E2D\u6062\u590D",
  "settings.default": "\u5C1A\u672A\u6388\u6743",
  "settings.unsupported": "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u6D4F\u89C8\u5668\u901A\u77E5",
  "settings.request": "\u8BF7\u6C42\u901A\u77E5\u6743\u9650",
  "settings.test": "\u53D1\u9001\u6D4B\u8BD5\u63A8\u9001",
  "settings.testing": "\u53D1\u9001\u4E2D\u2026",
  "settings.testOk": "\u6D4B\u8BD5\u63A8\u9001\u5DF2\u53D1\u9001",
  "settings.testDryRun": "dryRun\uFF1A\u5DF2\u8BB0\u5F55\uFF0C\u672A\u771F\u6B63\u53D1\u9001",
  "settings.testFailed": "\u6D4B\u8BD5\u63A8\u9001\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B DSH \u65E5\u5FD7",
  "settings.platform": "\u5E73\u53F0",
  "settings.platformWeb": "\u6D4F\u89C8\u5668",
  "settings.platformShell": "Android Shell",
  "config.title": "\u79FB\u52A8\u901A\u77E5\u8BBE\u7F6E",
  "config.description": "\u9875\u9762/\u6D4F\u89C8\u5668\u63D0\u9192\u4F18\u5148\uFF1BWeb \u672A\u9001\u8FBE\u4E14\u624B\u673A\u4E0D\u5728\u524D\u53F0\u65F6\u56DE\u9000 Server\u9171\xB3\u3002",
  "config.pluginConfig": "\u63D2\u4EF6\u914D\u7F6E",
  "config.loading": "\u6B63\u5728\u8BFB\u53D6\u914D\u7F6E\u2026",
  "config.loadFailed": "\u8BFB\u53D6\u914D\u7F6E\u5931\u8D25",
  "config.reload": "\u5237\u65B0",
  "config.save": "\u4FDD\u5B58",
  "config.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "config.saved": "\u5DF2\u4FDD\u5B58\uFF0C\u914D\u7F6E\u5DF2\u5E94\u7528",
  "config.saveFailed": "\u4FDD\u5B58\u5931\u8D25",
  "config.saveUncertain": "\u4FDD\u5B58\u8BF7\u6C42\u5DF2\u53D1\u51FA\uFF0C\u6B63\u5728\u786E\u8BA4\u2026",
  "config.test": "\u53D1\u9001\u6D4B\u8BD5\u63A8\u9001",
  "config.testing": "\u53D1\u9001\u4E2D\u2026",
  "config.testOk": "\u6D4B\u8BD5\u63A8\u9001\u5DF2\u53D1\u9001",
  "config.testDryRun": "dryRun\uFF1A\u5DF2\u8BB0\u5F55\uFF0C\u672A\u771F\u6B63\u53D1\u9001",
  "config.testFailed": "\u6D4B\u8BD5\u63A8\u9001\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u65E5\u5FD7",
  "config.readOnly": "\u5F53\u524D profile \u672A\u63D0\u4F9B\u914D\u7F6E\u7F16\u8F91\u5668\uFF0C\u53EA\u80FD\u67E5\u770B\u3002",
  "config.credentialsUnavailable": "\u51ED\u636E\u670D\u52A1\u4E0D\u53EF\u7528\uFF0CSendKey \u65E0\u6CD5\u4FDD\u5B58",
  "config.deployment": "\u90E8\u7F72\u4E0E\u901A\u9053",
  "config.publicBase": "DSH \u5916\u90E8\u5730\u5740",
  "config.transport": "\u63A8\u9001\u901A\u9053",
  "config.transportDryRun": "dryRun\uFF08\u53EA\u8BB0\u5F55\uFF0C\u4E0D\u771F\u7684\u63A8\u9001\uFF09",
  "config.transportServerchan3": "Server\u9171\xB3",
  "config.appPackage": "Android \u5305\u540D",
  "config.fallbackUrl": "\u62C9\u8D77\u5931\u8D25\u65F6\u7684\u7F51\u9875\u5730\u5740",
  "config.serverchan3": "Server\u9171\xB3",
  "config.sendkey": "SendKey",
  "config.sendkeyHint": "\u5DF2\u914D\u7F6E\u65F6\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8",
  "config.sendkeyConfigured": "\u5DF2\u914D\u7F6E",
  "config.sendkeyMissing": "\u672A\u914D\u7F6E",
  "config.clearSendkey": "\u6E05\u9664\u5DF2\u4FDD\u5B58\u7684 SendKey",
  "config.tags": "TAG \u5206\u7EC4",
  "config.tagsEnabled": "\u542F\u7528 TAG",
  "config.includeNamespace": "\u53D1\u9001 catch-all Tag",
  "config.includeKind": "\u53D1\u9001\u4E8B\u4EF6 Tag",
  "config.namespace": "namespace",
  "config.extraTags": "\u989D\u5916 Tag\uFF08\u9017\u53F7\u5206\u9694\uFF09",
  "config.kindTags": "\u9010\u9879\u8986\u76D6\u4E8B\u4EF6 Tag",
  "config.notify": "\u63D0\u9192\u884C\u4E3A",
  "config.approval": "\u5BA1\u6279",
  "config.question": "\u63D0\u95EE",
  "config.planReview": "\u8BA1\u5212\u786E\u8BA4",
  "config.turnDone": "turn \u5B8C\u6210",
  "config.modelTool": "\u5141\u8BB8\u6A21\u578B\u4E3B\u52A8\u63A8\u9001\uFF08mobile_notify\uFF09",
  "config.turnDonePermissionHint": "turn \u5B8C\u6210\u63D0\u9192\u9700\u8981\u6D4F\u89C8\u5668\u901A\u77E5\u6743\u9650\uFF1B\u672A\u6388\u6743\u6216\u53D1\u9001\u5931\u8D25\u65F6\u4F1A\u56DE\u9000 Server\u9171\xB3\u3002",
  "config.inPage": "\u6D6E\u52A8\u63D0\u9192\u5361",
  "config.webNotification": "\u6D4F\u89C8\u5668\u7CFB\u7EDF\u901A\u77E5",
  "config.inPageCounts": "\u6D6E\u52A8\u5361\u7B97\u5DF2\u9001\u8FBE",
  "config.detail": "\u5185\u5BB9\u8BE6\u7EC6\u5EA6",
  "config.detailSummary": "\u6458\u8981\uFF08\u4F1A\u8BDD/\u5DE5\u5177/\u539F\u56E0\uFF09",
  "config.detailTitle": "\u6807\u9898\uFF08\u4EC5\u4F1A\u8BDD\uFF09",
  "config.detailGeneric": "\u901A\u7528\uFF08\u4E0D\u663E\u793A\u4F1A\u8BDD/\u539F\u56E0\uFF09",
  "config.debounce": "\u81EA\u52A8\u5BA1\u6279\u53BB\u6296 ms",
  "config.grace": "\u7B49\u5F85 ack ms",
  "config.settle": "\u5BA2\u6237\u7AEF\u663E\u793A\u524D\u7B49\u5F85 ms",
  "config.privacy": "\u9690\u79C1",
  "config.includeSession": "\u5305\u542B\u4F1A\u8BDD\u6807\u9898",
  "config.includeReason": "\u5305\u542B\u539F\u56E0/\u95EE\u9898",
  "config.includeTool": "\u5305\u542B\u5DE5\u5177\u540D",
  "config.limits": "\u9AD8\u7EA7\u9650\u989D",
  "config.bodyBytes": "\u8BF7\u6C42\u4F53\u4E0A\u9650",
  "config.ratePerMinute": "\u5165\u7AD9\u9650\u6D41/\u5206\u949F",
  "config.pushPerMinute": "\u63A8\u9001\u4E0A\u9650/\u5206\u949F",
  "config.pushTimeout": "\u63A8\u9001\u8D85\u65F6 ms",
  "config.pushRetries": "\u63A8\u9001\u91CD\u8BD5\u6B21\u6570",
  "config.permission": "\u6D4F\u89C8\u5668\u901A\u77E5\u6743\u9650",
  "config.requestPermission": "\u8BF7\u6C42\u901A\u77E5\u6743\u9650"
};
var en = {
  "banner.title": "Pending reminders",
  "banner.approval": "Needs approval",
  "banner.question": "Needs an answer",
  "banner.planReview": "Needs plan review",
  "banner.turn": "Turn finished",
  "banner.notice": "Model notice",
  "banner.generic": "DSH has a pending reminder",
  "header.turnLabel": "Turn notices",
  "header.turnOn": "Turn-completion notices are on for this conversation",
  "header.turnOff": "Turn-completion notices are off for this conversation",
  "header.turnFailed": "Could not switch turn-completion notices",
  "banner.open": "Open session",
  "banner.more": "{count} more",
  "banner.unavailable": "Session is not available yet; open it from the DSH session list",
  "settings.title": "Mobile notifications",
  "settings.description": "In-page and browser notifications first; Server\u9171\xB3 only when Web did not deliver and the phone is not in the foreground.",
  "settings.permission": "Browser notification permission",
  "settings.granted": "Granted",
  "settings.denied": "Denied \u2014 restore it in the browser site settings",
  "settings.default": "Not requested yet",
  "settings.unsupported": "Browser notifications are not supported here",
  "settings.request": "Request permission",
  "settings.test": "Send test push",
  "settings.testing": "Sending\u2026",
  "settings.testOk": "Test push sent",
  "settings.testDryRun": "dryRun: recorded, not sent",
  "settings.testFailed": "Test push failed; check the DSH log",
  "settings.platform": "Platform",
  "settings.platformWeb": "Browser",
  "settings.platformShell": "Android Shell",
  "config.title": "Mobile notification settings",
  "config.description": "In-page and browser notifications first; Server\u9171\xB3 only when Web did not deliver and the phone is not in the foreground.",
  "config.pluginConfig": "Plugin config",
  "config.loading": "Loading settings\u2026",
  "config.loadFailed": "Could not load settings",
  "config.reload": "Reload",
  "config.save": "Save",
  "config.saving": "Saving\u2026",
  "config.saved": "Saved; configuration applied",
  "config.saveFailed": "Save failed",
  "config.saveUncertain": "Save was sent; confirming\u2026",
  "config.test": "Send test push",
  "config.testing": "Sending\u2026",
  "config.testOk": "Test push sent",
  "config.testDryRun": "dryRun: recorded, not sent",
  "config.testFailed": "Test push failed; check the log",
  "config.readOnly": "This profile does not expose a configuration editor; read-only.",
  "config.credentialsUnavailable": "Credentials service unavailable; SendKey cannot be stored",
  "config.deployment": "Deployment and transport",
  "config.publicBase": "DSH public URL",
  "config.transport": "Transport",
  "config.transportDryRun": "dryRun (record only)",
  "config.transportServerchan3": "Server\u9171\xB3",
  "config.appPackage": "Android package",
  "config.fallbackUrl": "Web fallback URL",
  "config.serverchan3": "Server\u9171\xB3",
  "config.sendkey": "SendKey",
  "config.sendkeyHint": "Leave blank to keep the stored key",
  "config.sendkeyConfigured": "Configured",
  "config.sendkeyMissing": "Missing",
  "config.clearSendkey": "Clear the stored SendKey",
  "config.tags": "TAG grouping",
  "config.tagsEnabled": "Enable TAGs",
  "config.includeNamespace": "Send catch-all tag",
  "config.includeKind": "Send event tags",
  "config.namespace": "namespace",
  "config.extraTags": "Extra tags (comma-separated)",
  "config.kindTags": "Override kind tags",
  "config.notify": "Notification behavior",
  "config.approval": "Approvals",
  "config.question": "Questions",
  "config.planReview": "Plan review",
  "config.turnDone": "Turn completion",
  "config.modelTool": "Allow model-initiated pushes (mobile_notify)",
  "config.turnDonePermissionHint": "Turn completion needs browser notification permission; without it (or if sending fails) Server\u9171\xB3 fallback applies.",
  "config.inPage": "Floating reminder card",
  "config.webNotification": "Browser notifications",
  "config.inPageCounts": "Floating card counts as delivered",
  "config.detail": "Detail level",
  "config.detailSummary": "Summary (session/tool/reason)",
  "config.detailTitle": "Title (session only)",
  "config.detailGeneric": "Generic (no session/reason)",
  "config.debounce": "Auto-approval debounce ms",
  "config.grace": "Ack grace ms",
  "config.settle": "Client settle ms",
  "config.privacy": "Privacy",
  "config.includeSession": "Include session title",
  "config.includeReason": "Include reason/question",
  "config.includeTool": "Include tool name",
  "config.limits": "Advanced limits",
  "config.bodyBytes": "Body limit",
  "config.ratePerMinute": "Inbound rate/min",
  "config.pushPerMinute": "Push rate/min",
  "config.pushTimeout": "Push timeout ms",
  "config.pushRetries": "Push retries",
  "config.permission": "Browser notification permission",
  "config.requestPermission": "Request permission"
};
var dictionaries = { zh, en };

// src/client/types.ts
var DEFAULT_CLIENT_CONFIG = {
  inPage: true,
  webNotification: true,
  inPageCountsAsDelivered: true,
  turnDone: false,
  settleMs: 500,
  detail: "summary",
  includeSessionTitle: true,
  includeReason: true,
  includeToolName: true
};

// src/client/config.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseClientConfig(value) {
  if (!isRecord2(value) || !isRecord2(value.client)) return void 0;
  const client = value.client;
  const bool = (key, fallback) => typeof client[key] === "boolean" ? client[key] : fallback;
  const detail = client.detail;
  const settle = client.settleMs;
  return {
    inPage: bool("inPage", DEFAULT_CLIENT_CONFIG.inPage),
    webNotification: bool("webNotification", DEFAULT_CLIENT_CONFIG.webNotification),
    inPageCountsAsDelivered: bool(
      "inPageCountsAsDelivered",
      DEFAULT_CLIENT_CONFIG.inPageCountsAsDelivered
    ),
    turnDone: bool("turnDone", DEFAULT_CLIENT_CONFIG.turnDone),
    settleMs: typeof settle === "number" && Number.isFinite(settle) && settle >= 0 && settle <= 2e3 ? Math.round(settle) : DEFAULT_CLIENT_CONFIG.settleMs,
    detail: detail === "summary" || detail === "title" || detail === "generic" ? detail : DEFAULT_CLIENT_CONFIG.detail,
    includeSessionTitle: bool("includeSessionTitle", DEFAULT_CLIENT_CONFIG.includeSessionTitle),
    includeReason: bool("includeReason", DEFAULT_CLIENT_CONFIG.includeReason),
    includeToolName: bool("includeToolName", DEFAULT_CLIENT_CONFIG.includeToolName)
  };
}

// src/client/turn.ts
var TurnTracker = class {
  running = /* @__PURE__ */ new Map();
  /** Apply one status snapshot and return Sessions that just finished a turn. */
  update(status) {
    const ended = [];
    const next = /* @__PURE__ */ new Map();
    for (const [sessionId, row2] of status) {
      const running = row2.running;
      if (this.running.get(sessionId) === true && running === false) ended.push(sessionId);
      next.set(sessionId, running);
    }
    this.running = next;
    return ended;
  }
  /** Forget baselines (used on teardown). */
  clear() {
    this.running.clear();
  }
};

// src/client/presence.ts
function notificationState() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
function readEnvironment() {
  if (typeof document === "undefined") {
    return { visibility: "hidden", focused: false, notification: notificationState() };
  }
  const visibility = document.visibilityState === "visible" ? "visible" : "hidden";
  let focused = false;
  try {
    focused = document.hasFocus();
  } catch {
    focused = visibility === "visible";
  }
  return { visibility, focused, notification: notificationState() };
}
function environmentWithShell(environment, shellForeground) {
  if (shellForeground === void 0) return environment;
  return {
    visibility: shellForeground ? "visible" : "hidden",
    focused: shellForeground,
    notification: environment.notification
  };
}
function buildPresencePayload(clientId, platform, environment, now = /* @__PURE__ */ new Date()) {
  return {
    contract: 1,
    clientId,
    platform,
    visibility: environment.visibility,
    focused: environment.focused,
    notification: environment.notification,
    at: now.toISOString()
  };
}

// src/client/store.ts
var EMPTY = { items: [] };
var BannerStore = class {
  snapshot = EMPTY;
  listeners = /* @__PURE__ */ new Set();
  noticeTimer;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  setItems(items) {
    const previous = this.snapshot;
    if (previous.items.length === items.length && previous.items.every((item, index) => {
      const next = items[index];
      return next !== void 0 && item.key === next.key && item.label === next.label && item.kindTitle === next.kindTitle && item.summary === next.summary && item.needsAck === next.needsAck;
    }) && previous.notice === void 0) return;
    this.snapshot = { items: [...items], ...previous.notice === void 0 ? {} : { notice: previous.notice } };
    this.emit();
  }
  markAcked(key) {
    let changed = false;
    const items = this.snapshot.items.map((item) => {
      if (item.key !== key || !item.needsAck) return item;
      changed = true;
      return { ...item, needsAck: false };
    });
    if (!changed) return;
    this.snapshot = { ...this.snapshot, items };
    this.emit();
  }
  showNotice(text) {
    if (this.noticeTimer !== void 0) clearTimeout(this.noticeTimer);
    this.snapshot = { ...this.snapshot, notice: text };
    this.emit();
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = void 0;
      const { notice: _notice, ...rest } = this.snapshot;
      this.snapshot = rest;
      this.emit();
    }, 4e3);
  }
  dispose() {
    if (this.noticeTimer !== void 0) clearTimeout(this.noticeTimer);
    this.noticeTimer = void 0;
    this.snapshot = EMPTY;
    this.listeners.clear();
  }
  emit() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
      }
    }
  }
};

// src/client/SessionTurnToggle.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var button2 = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  maxWidth: 150,
  boxSizing: "border-box",
  border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35))",
  borderRadius: 999,
  background: "transparent",
  color: "var(--dsw-alias-label-secondary, rgba(127,127,127,.95))",
  padding: "2px 8px",
  fontSize: 11,
  lineHeight: 1.5,
  cursor: "pointer",
  whiteSpace: "nowrap"
};
var enabledStyle = {
  color: "var(--dsw-alias-accent, #4f46e5)",
  borderColor: "color-mix(in srgb, var(--dsw-alias-accent, #4f46e5) 55%, transparent)",
  background: "color-mix(in srgb, var(--dsw-alias-accent, #4f46e5) 8%, transparent)"
};
function noticeState(snapshot, sessionId) {
  const projected = snapshot.projectionsBySession?.[sessionId]?.values?.["mobileNotify"];
  if (typeof projected !== "object" || projected === null) return void 0;
  return projected;
}
function SessionTurnToggle({
  sessionId,
  currentSessionId,
  t,
  getConfig,
  subscribe,
  getSnapshot,
  onToggle
}) {
  const snapshot = (0, import_react3.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
  const target = sessionId === void 0 || sessionId === "" ? currentSessionId?.() : sessionId;
  if (target === void 0 || target === "") return null;
  const override = noticeState(snapshot, target)?.turnDone;
  const enabled = typeof override === "boolean" ? override : getConfig().turnDone;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "button",
    {
      type: "button",
      style: { ...button2, ...enabled ? enabledStyle : {} },
      "aria-pressed": enabled,
      title: enabled ? t("header.turnOn") : t("header.turnOff"),
      onClick: () => onToggle(target, !enabled),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { "aria-hidden": "true", style: { opacity: enabled ? 1 : 0.45 }, children: "\u{1F514}" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("header.turnLabel") })
      ]
    }
  );
}

// src/client/index.ts
var name = "dsh-mobile-notify";
var inject = ["sessions", "slots", "locale", "uiSession", "uiSession.sessionStatus", "uiWorkspace"];
var SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
var CLIENT_ID_STORAGE = "dsh-mobile-notify:clientId";
var HEARTBEAT_MS = 1e4;
var SESSION_RETRY_MS = 300;
var SESSION_RETRY_LIMIT = 17;
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function bindTranslate(ctx) {
  const bound = ctx.locale.bind(NS);
  return (key, params) => bound(key, params);
}
function makeClientId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function getClientId() {
  try {
    const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE);
    if (existing !== null && existing !== "") return existing;
    const id = makeClientId();
    window.sessionStorage.setItem(CLIENT_ID_STORAGE, id);
    return id;
  } catch {
    return makeClientId();
  }
}
function detectPlatform() {
  if (typeof window === "undefined") return "web";
  if (window.__DSH_SHELL__ !== void 0) return "android-shell";
  try {
    return /DSHAndroidShell\//u.test(navigator.userAgent) ? "android-shell" : "web";
  } catch {
    return "web";
  }
}
function shellInfo() {
  return typeof window === "undefined" ? void 0 : window.__DSH_SHELL__;
}
function sessionLabel2(ctx, sessionId) {
  const label = ctx.sessions.list.getSnapshot().byId[sessionId]?.displayTitle;
  return cleanText(label, 40) ?? shortId(sessionId);
}
function normalizeKind(raw) {
  if (raw === "approval") return "approval";
  if (raw === "question") return "question";
  if (raw === "plan-review") return "plan-review";
  if (raw === "turn") return "turn";
  if (raw === "notice") return "notice";
  return void 0;
}
function normalizePending(ctx, sessionId, wait) {
  const kind = normalizeKind(wait.kind);
  if (kind === void 0) return void 0;
  if (typeof wait.key !== "string" || wait.key === "") return void 0;
  const firstQuestion = wait.questions?.[0]?.question;
  return {
    key: `${sessionId}:${wait.key}`,
    sessionId,
    kind,
    rawKind: wait.kind,
    waitKey: wait.key,
    label: sessionLabel2(ctx, sessionId),
    ...typeof wait.callId === "string" && wait.callId !== "" ? { callId: wait.callId } : {},
    ...cleanText(wait.toolName, 60) === void 0 ? {} : { toolName: cleanText(wait.toolName, 60) },
    ...cleanText(wait.reason, 200) === void 0 ? {} : { reason: cleanText(wait.reason, 200) },
    ...cleanText(firstQuestion, 200) === void 0 ? {} : { question: cleanText(firstQuestion, 200) },
    ...cleanText(wait.noticeTitle, 80) === void 0 ? {} : { noticeTitle: cleanText(wait.noticeTitle, 80) },
    ...cleanText(wait.noticeBody, 1e3) === void 0 ? {} : { noticeBody: cleanText(wait.noticeBody, 1e3) },
    ...typeof wait.createdAt === "number" ? { createdAt: wait.createdAt } : {}
  };
}
function apply(ctx) {
  const t = bindTranslate(ctx);
  ctx.effect(() => ctx.locale.register(NS, dictionaries), "dsh-mobile-notify: locale");
  const clientId = getClientId();
  const platform = detectPlatform();
  const shell = shellInfo();
  const bannerStore = new BannerStore();
  const tracked = /* @__PURE__ */ new Map();
  const turns = new TurnTracker();
  const turnNotifications = /* @__PURE__ */ new Set();
  const retryTimers = /* @__PURE__ */ new Set();
  const opening = /* @__PURE__ */ new Set();
  let config = DEFAULT_CLIENT_CONFIG;
  let active = true;
  let bannerAvailable = false;
  let shellForeground;
  let heartbeat;
  let presenceInflight = false;
  let presenceDirty = false;
  let presenceErrorLogged = false;
  let unsubscribeStatus;
  let bridgeInstalled = false;
  let bridgeObject;
  let previousBridge;
  const publishedNotices = /* @__PURE__ */ new Map();
  const publishNotice = ctx.uiSession.registerPendingInteraction?.(() => 0);
  if (shell?.contract !== void 0 && shell.contract > 1) {
    console.debug(`dsh-mobile-notify: shell contract ${shell.contract} > 1; using v1 behavior`);
  }
  function syncNotices() {
    if (publishNotice === void 0) return;
    try {
      const snapshot = ctx.sessions.list.getSnapshot();
      const seen = /* @__PURE__ */ new Set();
      for (const sessionId of snapshot.ids) {
        const projected = snapshot.projectionsBySession?.[sessionId]?.values?.["mobileNotify"];
        if (typeof projected !== "object" || projected === null) continue;
        const state = projected;
        if (typeof state.notice !== "object" || state.notice === null) continue;
        const notice = state.notice;
        if (typeof notice.key !== "string" || notice.key === "") continue;
        if (typeof notice.title !== "string" || notice.title === "") continue;
        const createdAt = typeof notice.createdAt === "number" ? notice.createdAt : Date.now();
        seen.add(sessionId);
        const current = publishedNotices.get(sessionId);
        if (current?.key === notice.key) continue;
        current?.dispose();
        try {
          const dispose = publishNotice({
            key: notice.key,
            kind: "notice",
            sessionId,
            callId: notice.key,
            noticeTitle: notice.title,
            ...typeof notice.body === "string" && notice.body !== "" ? { noticeBody: notice.body } : {},
            createdAt
          }, async () => {
          });
          publishedNotices.set(sessionId, { key: notice.key, dispose });
        } catch (error) {
          console.debug("dsh-mobile-notify: notice publication failed", error);
        }
      }
      for (const [sessionId, record] of publishedNotices) {
        if (seen.has(sessionId)) continue;
        record.dispose();
        publishedNotices.delete(sessionId);
      }
    } catch (error) {
      console.debug("dsh-mobile-notify: notice projection scan failed", error);
    }
  }
  function currentEnvironment() {
    return environmentWithShell(readEnvironment(), shellForeground);
  }
  function startHeartbeat() {
    if (heartbeat !== void 0) return;
    heartbeat = setInterval(() => sendPresence(), HEARTBEAT_MS);
    heartbeat.unref?.();
  }
  function stopHeartbeat() {
    if (heartbeat === void 0) return;
    clearInterval(heartbeat);
    heartbeat = void 0;
  }
  function failPendingInPage() {
    for (const record of tracked.values()) {
      if (record.mode === "in-page" && !record.acked) {
        ack(record, false, "none", "hidden-no-notification");
      }
    }
  }
  function syncPresence() {
    if (!active) return;
    sendPresence();
    if (currentEnvironment().visibility === "visible") startHeartbeat();
    else {
      stopHeartbeat();
      failPendingInPage();
    }
  }
  function sendPresence() {
    if (!active) return;
    if (presenceInflight) {
      presenceDirty = true;
      return;
    }
    presenceInflight = true;
    void (async () => {
      try {
        do {
          presenceDirty = false;
          const body = buildPresencePayload(clientId, platform, currentEnvironment());
          try {
            const response = await postJson("/mobile/presence", body, 3e3);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            presenceErrorLogged = false;
          } catch (error) {
            if (!presenceErrorLogged) {
              presenceErrorLogged = true;
              console.debug("dsh-mobile-notify: presence post failed", error);
            }
          }
        } while (presenceDirty && active);
      } finally {
        presenceInflight = false;
      }
    })();
  }
  function pageHide() {
    if (!active) return;
    failPendingInPage();
    stopHeartbeat();
    try {
      const body = buildPresencePayload(clientId, platform, {
        visibility: "hidden",
        focused: false,
        notification: readEnvironment().notification
      });
      void fetch("/mobile/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: "same-origin"
      }).catch(() => {
      });
    } catch {
    }
  }
  function onVisibility() {
    syncPresence();
    if (currentEnvironment().visibility === "visible") scan();
  }
  function onFocus() {
    sendPresence();
  }
  function onBlur() {
    sendPresence();
  }
  function postAck(payload) {
    void (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await postJson("/mobile/ack", payload, 3e3);
          if (response.ok) return;
        } catch {
        }
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
      }
      console.debug("dsh-mobile-notify: ack post failed");
    })();
  }
  function ack(record, delivered, via, reason) {
    if (record.acked) return;
    record.acked = true;
    const payload = buildAckPayload(record.item, clientId, platform, delivered, via, reason);
    postAck(payload);
    updateBanner();
  }
  function showNotification(record) {
    if (typeof Notification === "undefined") {
      ack(record, false, "none", "unsupported");
      return false;
    }
    try {
      const notification = new Notification(notificationTitle(record.item, t, config), {
        body: summarizePending(record.item, config, t),
        tag: record.item.key
      });
      notification.onclick = () => {
        try {
          window.focus();
        } catch {
        }
        void openSession(record.item.sessionId);
        notification.close();
      };
      record.notification = notification;
      return true;
    } catch {
      ack(record, false, "none", "constructor-error");
      return false;
    }
  }
  function currentSessionId() {
    try {
      const key = ctx.uiSession.adapter?.current.getSnapshot()?.key;
      return typeof key === "string" && key !== "" ? key : void 0;
    } catch {
      return void 0;
    }
  }
  function settle(record) {
    record.settleTimer = void 0;
    if (!active || tracked.get(record.item.key) !== record) return;
    const environment = currentEnvironment();
    const decision = decideDelivery({
      visible: environment.visibility === "visible",
      focused: environment.focused,
      bannerAvailable,
      notification: environment.notification,
      viewingSession: record.item.kind === "notice" ? false : currentSessionId() === record.item.sessionId
    }, config);
    record.notified = true;
    record.mode = decision.mode;
    record.suppressCard = decision.suppressCard === true;
    if (decision.mode === "in-page") {
      if (record.suppressCard) {
        ack(record, true, "in-page", "none");
      }
      updateBanner();
      return;
    }
    if (decision.mode === "web-notification") {
      if (showNotification(record)) {
        ack(record, true, "web-notification", "none");
      }
      updateBanner();
      return;
    }
    ack(record, false, "none", decision.reason);
    updateBanner();
  }
  function updateBanner() {
    if (!config.inPage) {
      bannerStore.setItems([]);
      return;
    }
    const items = [];
    for (const record of tracked.values()) {
      if (!record.notified) continue;
      if (record.mode === "in-page" && record.suppressCard === true) continue;
      const generic = config.detail === "generic";
      items.push({
        key: record.item.key,
        sessionId: record.item.sessionId,
        label: generic || !config.includeSessionTitle ? "" : record.item.label,
        kindTitle: generic ? t("banner.generic") : kindTitle(record.item.kind, t),
        summary: generic ? "" : summarizePending(record.item, config, t),
        needsAck: record.mode === "in-page" && !record.acked
      });
    }
    bannerStore.setItems(items);
  }
  function onShown(key) {
    const record = tracked.get(key);
    if (record === void 0 || record.acked || record.mode !== "in-page") return;
    ack(record, true, "in-page", "none");
    bannerStore.markAcked(key);
  }
  function removeTracked(key) {
    const record = tracked.get(key);
    if (record === void 0) return;
    if (record.settleTimer !== void 0) {
      clearTimeout(record.settleTimer);
      record.settleTimer = void 0;
    }
    record.notification?.close();
    record.notification = void 0;
    tracked.delete(key);
  }
  function notifyTurnDone(sessionId) {
    if (!active || !config.turnDone || !config.webNotification) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (ctx.sessions.list.getSnapshot().byId[sessionId]?.origin === "subagent") return;
    const item = {
      key: `${sessionId}:turn`,
      sessionId,
      kind: "turn",
      rawKind: "turn",
      waitKey: "turn",
      label: sessionLabel2(ctx, sessionId)
    };
    try {
      const notification = new Notification(notificationTitle(item, t, config), {
        body: summarizePending(item, config, t),
        tag: `dsh-mobile-notify:${sessionId}:turn:${Date.now()}`
      });
      turnNotifications.add(notification);
      notification.onclose = () => {
        turnNotifications.delete(notification);
      };
      notification.onerror = () => {
        turnNotifications.delete(notification);
        console.debug("dsh-mobile-notify: turnDone notification was not shown");
      };
      notification.onclick = () => {
        try {
          window.focus();
        } catch {
        }
        void openSession(sessionId);
        notification.close();
        turnNotifications.delete(notification);
      };
      let acked = false;
      notification.onshow = () => {
        if (acked || !active) return;
        acked = true;
        const ackPayload = buildAckPayload(item, clientId, platform, true, "web-notification", "none");
        postAck(ackPayload);
        const retry = setTimeout(() => {
          if (active) postAck(ackPayload);
        }, 600);
        retry.unref?.();
      };
    } catch (error) {
      console.debug("dsh-mobile-notify: turnDone notification failed", error);
    }
  }
  function scan() {
    if (!active) return;
    try {
      const status = ctx.uiSession.sessionStatus.getSnapshot();
      const seen = /* @__PURE__ */ new Set();
      for (const [sessionId, row2] of status) {
        const wait = row2.pendingInteraction;
        if (wait === void 0) continue;
        const item = normalizePending(ctx, sessionId, wait);
        if (item === void 0) continue;
        seen.add(item.key);
        if (tracked.has(item.key)) continue;
        const record = {
          item,
          notified: false,
          acked: false,
          mode: "pending"
        };
        tracked.set(item.key, record);
        record.settleTimer = setTimeout(() => settle(record), config.settleMs);
      }
      for (const key of [...tracked.keys()]) {
        if (!seen.has(key)) removeTracked(key);
      }
      for (const sessionId of turns.update(status)) notifyTurnDone(sessionId);
      updateBanner();
    } catch (error) {
      console.debug("dsh-mobile-notify: sessionStatus scan failed", error);
    }
  }
  function tryOpen(sessionId) {
    try {
      if (ctx.sessions.list.getSnapshot().byId[sessionId] === void 0) return false;
      ctx.uiWorkspace.openSession(sessionId);
      return true;
    } catch {
      return false;
    }
  }
  function openSession(sessionId) {
    if (!SESSION_ID_PATTERN.test(sessionId)) return false;
    if (tryOpen(sessionId)) return true;
    if (opening.has(sessionId)) return true;
    opening.add(sessionId);
    let elapsed = 0;
    const timer = setInterval(() => {
      if (!active) {
        clearInterval(timer);
        retryTimers.delete(timer);
        opening.delete(sessionId);
        return;
      }
      elapsed += SESSION_RETRY_MS;
      if (tryOpen(sessionId)) {
        clearInterval(timer);
        retryTimers.delete(timer);
        opening.delete(sessionId);
        return;
      }
      if (elapsed >= SESSION_RETRY_MS * SESSION_RETRY_LIMIT) {
        clearInterval(timer);
        retryTimers.delete(timer);
        opening.delete(sessionId);
        bannerStore.showNotice(t("banner.unavailable"));
      }
    }, SESSION_RETRY_MS);
    retryTimers.add(timer);
    timer.unref?.();
    return true;
  }
  function toggleTurnDone(sessionId, next) {
    void (async () => {
      try {
        const response = await putJson("/mobile/session-settings", { sessionId, turnDone: next }, 5e3);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        console.debug("dsh-mobile-notify: per-session turn toggle failed", error);
        bannerStore.showNotice(t("header.turnFailed"));
      }
    })();
  }
  function sendTest() {
    return (async () => {
      try {
        const response = await requestJson("/mobile/push/test", { method: "POST" }, 1e4);
        if (response.status !== 202) return "failed";
        const value = await response.json().catch(() => void 0);
        return isRecord3(value) && value.dryRun === true ? "dryRun" : "ok";
      } catch {
        return "failed";
      }
    })();
  }
  function installBridge() {
    if (typeof window === "undefined") return;
    const existing = window.__dshMobile;
    const marked = existing;
    if (existing !== void 0 && marked?.__dshMobileNotify !== true) {
      console.warn("dsh-mobile-notify: window.__dshMobile already exists; leaving it untouched");
      return;
    }
    previousBridge = marked?.__dshMobileNotify === true ? void 0 : existing;
    bridgeObject = {
      openSession,
      setForeground: (foreground) => {
        shellForeground = foreground;
        syncPresence();
        if (foreground) scan();
      }
    };
    bridgeObject.__dshMobileNotify = true;
    window.__dshMobile = bridgeObject;
    bridgeInstalled = true;
  }
  function registerSlots() {
    const BannerView = (() => (0, import_react4.createElement)(Banner, {
      store: bannerStore,
      t,
      onShown,
      onOpen: (sessionId) => {
        void openSession(sessionId);
      }
    }));
    ctx.effect(() => {
      let dispose;
      ctx.slots.inject("shell.overlay", () => {
        dispose?.();
        try {
          dispose = ctx.slots.register(
            { name: "shell.overlay", id: NS, order: 40, locale: NS },
            BannerView
          );
          bannerAvailable = true;
          scan();
        } catch (error) {
          console.warn("dsh-mobile-notify: shell.overlay registration failed", error);
        }
      });
      return () => {
        dispose?.();
        dispose = void 0;
        bannerAvailable = false;
      };
    }, "dsh-mobile-notify: banner overlay");
    const TurnToggleView = (props) => (0, import_react4.createElement)(SessionTurnToggle, {
      sessionId: props.sessionId,
      currentSessionId,
      t,
      getConfig: () => config,
      subscribe: ctx.sessions.list.subscribe,
      getSnapshot: ctx.sessions.list.getSnapshot,
      onToggle: toggleTurnDone
    });
    ctx.effect(() => {
      let dispose;
      ctx.slots.inject("conversation.session.header.actions", () => {
        dispose?.();
        try {
          dispose = ctx.slots.register(
            { name: "conversation.session.header.actions", id: "mobile-notify-turn", order: 60, locale: NS },
            TurnToggleView
          );
        } catch (error) {
          console.warn("dsh-mobile-notify: turn toggle registration failed", error);
        }
      });
      return () => {
        dispose?.();
        dispose = void 0;
      };
    }, "dsh-mobile-notify: turn toggle");
    const ConfigCardView = (() => (0, import_react4.createElement)(ConfigCard, {
      t,
      sendTest
    }));
    ctx.effect(() => {
      let dispose;
      ctx.slots.inject("plugins.bundle.config", () => {
        dispose?.();
        try {
          dispose = ctx.slots.register(
            { name: "plugins.bundle.config", key: NS, locale: NS },
            ConfigCardView
          );
        } catch (error) {
          console.warn("dsh-mobile-notify: plugin config card registration failed", error);
        }
      });
      return () => {
        dispose?.();
        dispose = void 0;
      };
    }, "dsh-mobile-notify: plugin config card");
  }
  installBridge();
  registerSlots();
  ctx.effect(() => {
    const dispose = ctx.sessions.list.subscribe(() => syncNotices());
    syncNotices();
    return () => {
      dispose();
      for (const record of publishedNotices.values()) record.dispose();
      publishedNotices.clear();
    };
  }, "dsh-mobile-notify: notice projection");
  unsubscribeStatus = ctx.uiSession.sessionStatus.subscribe(() => scan());
  scan();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pagehide", pageHide);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
  }
  syncPresence();
  void (async () => {
    try {
      const response = await requestJson("/mobile/config", { headers: { accept: "application/json" } }, 3e3);
      if (!response.ok) return;
      const parsed = parseClientConfig(await response.json());
      if (parsed !== void 0 && active) {
        config = parsed;
        updateBanner();
      }
    } catch (error) {
      console.debug("dsh-mobile-notify: client config fetch failed; using defaults", error);
    }
  })();
  ctx.effect(() => () => {
    active = false;
    stopHeartbeat();
    unsubscribeStatus?.();
    unsubscribeStatus = void 0;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pagehide", pageHide);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    }
    for (const timer of retryTimers) clearInterval(timer);
    retryTimers.clear();
    opening.clear();
    for (const record of tracked.values()) {
      if (record.settleTimer !== void 0) clearTimeout(record.settleTimer);
      record.notification?.close();
    }
    tracked.clear();
    turns.clear();
    for (const notification of turnNotifications) {
      try {
        notification.close();
      } catch {
      }
    }
    turnNotifications.clear();
    bannerStore.dispose();
    if (bridgeInstalled && bridgeObject !== void 0 && typeof window !== "undefined") {
      if (window.__dshMobile === bridgeObject) {
        if (previousBridge === void 0) delete window.__dshMobile;
        else window.__dshMobile = previousBridge;
      }
    }
    bridgeInstalled = false;
    bridgeObject = void 0;
  }, "dsh-mobile-notify: client lifecycle");
}
return module.exports; } });
//# sourceMappingURL=client.js.map
