// src/config.ts
import Schema from "@deepseek-ai/schemastery";

// src/shared/errors.ts
var ConfigError = class extends Error {
  name = "ConfigError";
};

// src/shared/tags.ts
var DEFAULT_NAMESPACE = "dsh";
var MAX_TAGS = 8;
var MAX_EXTRA_TAGS = 6;
var MAX_TAG_LENGTH = 32;
var TAG_PATTERN = /^[\p{L}\p{N}._-]{1,32}$/u;
var KIND_KEYS = ["approval", "question", "planReview", "turn", "test", "notice"];
function kindTagKey(kind) {
  if (kind === "plan-review") return "planReview";
  return kind;
}
function kindSlug(kind) {
  return kind;
}
function resolveTagConfig(input) {
  const kindTags = {};
  for (const key of KIND_KEYS) {
    const value = input?.kindTags?.[key];
    if (typeof value === "string") kindTags[key] = value.trim();
  }
  return {
    enabled: input?.enabled ?? true,
    namespace: (input?.namespace ?? DEFAULT_NAMESPACE).trim(),
    includeNamespace: input?.includeNamespace ?? true,
    includeKind: input?.includeKind ?? true,
    kindTags,
    extra: Array.isArray(input?.extra) ? input.extra.map((value) => value.trim()) : []
  };
}
function assertTag(value, label) {
  if (!TAG_PATTERN.test(value)) {
    throw new ConfigError(
      `${label} must be 1-${MAX_TAG_LENGTH} letters/numbers/._- characters (no whitespace or '|')`
    );
  }
}
function kindTag(kind, config) {
  const key = kindTagKey(kind);
  const override = config.kindTags[key];
  if (override !== void 0 && override !== "") return override;
  return `${config.namespace}-${kindSlug(kind)}`;
}
function validateTagConfig(config) {
  assertTag(config.namespace, "serverchan3.tags.namespace");
  for (const key of KIND_KEYS) {
    const value = config.kindTags[key];
    if (value !== void 0) assertTag(value, `serverchan3.tags.kindTags.${key}`);
  }
  if (config.extra.length > MAX_EXTRA_TAGS) {
    throw new ConfigError(`serverchan3.tags.extra may contain at most ${MAX_EXTRA_TAGS} tags`);
  }
  for (const [index, value] of config.extra.entries()) {
    assertTag(value, `serverchan3.tags.extra[${index}]`);
  }
  if (!config.enabled) return;
  const kinds = ["approval", "question", "plan-review", "turn", "notice"];
  for (const kind of kinds) {
    if (config.includeKind) assertTag(kindTag(kind, config), `serverchan3.tags for ${kind}`);
  }
  assertTag(kindTag("test", config), "serverchan3.tags for test");
}
function buildTags(kind, config) {
  if (!config.enabled) return { tags: [], dropped: [] };
  const candidates = [];
  if (config.includeNamespace) candidates.push(config.namespace);
  if (kind === "test" || config.includeKind) candidates.push(kindTag(kind, config));
  candidates.push(...config.extra);
  const tags = [];
  const dropped = [];
  for (const candidate of candidates) {
    if (!TAG_PATTERN.test(candidate)) {
      dropped.push(candidate);
      continue;
    }
    if (tags.includes(candidate)) continue;
    if (tags.length >= MAX_TAGS) {
      dropped.push(candidate);
      continue;
    }
    tags.push(candidate);
  }
  return { tags, dropped };
}

// src/config.ts
var SCOPE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/u;
var tagsSchema = Schema.object({
  enabled: Schema.boolean().default(true),
  namespace: Schema.string().default("dsh"),
  includeNamespace: Schema.boolean().default(true),
  includeKind: Schema.boolean().default(true),
  kindTags: Schema.object({
    approval: Schema.string(),
    question: Schema.string(),
    planReview: Schema.string(),
    turn: Schema.string(),
    test: Schema.string(),
    notice: Schema.string()
  }).default({}),
  extra: Schema.array(Schema.string()).default([])
}).default({});
var serverChan3Schema = Schema.object({
  appPackage: Schema.string().default("top.allenyou.dsh"),
  fallbackUrl: Schema.string(),
  tags: tagsSchema
}).default({});
var notifySchema = Schema.object({
  approval: Schema.boolean().default(true),
  question: Schema.boolean().default(true),
  planReview: Schema.boolean().default(true),
  turnDone: Schema.boolean().default(false),
  modelTool: Schema.boolean().default(true),
  debounceMs: Schema.number().default(1500),
  graceMs: Schema.number().default(4e3),
  settleMs: Schema.number().default(500),
  detail: Schema.union(["summary", "title", "generic"]).default("summary"),
  inPage: Schema.boolean().default(true),
  webNotification: Schema.boolean().default(true),
  inPageCountsAsDelivered: Schema.boolean().default(true)
}).default({});
var privacySchema = Schema.object({
  includeSessionTitle: Schema.boolean().default(true),
  includeReason: Schema.boolean().default(true),
  includeToolName: Schema.boolean().default(true)
}).default({});
var limitsSchema = Schema.object({
  bodyBytes: Schema.number().default(2048),
  ratePerMinute: Schema.number().default(120),
  pushPerMinute: Schema.number().default(50),
  pushTimeoutMs: Schema.number().default(8e3),
  pushRetries: Schema.number().default(2)
}).default({});
var Config = Schema.object({
  publicBase: Schema.string().required(),
  transport: Schema.union(["dryRun", "serverchan3"]).default("dryRun"),
  serverchan3: serverChan3Schema,
  notify: notifySchema,
  privacy: privacySchema,
  limits: limitsSchema
});
function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError(`${label} is required`);
  }
  return value.trim();
}
function optionalString(value) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed === "" ? void 0 : trimmed;
}
function boolValue(value, fallback, label) {
  if (value === void 0) return fallback;
  if (typeof value !== "boolean") throw new ConfigError(`${label} must be a boolean`);
  return value;
}
function intValue(value, fallback, min, max, label) {
  if (value === void 0) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return value;
}
function detailValue(value) {
  if (value === void 0) return "summary";
  if (value === "summary" || value === "title" || value === "generic") return value;
  throw new ConfigError("notify.detail must be 'summary', 'title', or 'generic'");
}
function transportValue(value) {
  if (value === void 0) return "dryRun";
  if (value === "dryRun" || value === "serverchan3") return value;
  throw new ConfigError("transport must be 'dryRun' or 'serverchan3'");
}
function normalizeBase(value, label) {
  const raw = requiredString(value, label);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`${label} must be an absolute http(s) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigError(`${label} must use http or https`);
  }
  if (url.username !== "" || url.password !== "") {
    throw new ConfigError(`${label} must not contain credentials`);
  }
  if (url.search !== "" || url.hash !== "") {
    throw new ConfigError(`${label} must not contain a query or fragment`);
  }
  if (!url.pathname.endsWith("/")) url.pathname = `${url.pathname}/`;
  return url.toString();
}
function normalizeServerChan3(input, publicBase) {
  const source = input ?? {};
  const appPackage = optionalString(source.appPackage) ?? "top.allenyou.dsh";
  if (!SCOPE_KEY_PATTERN.test(appPackage)) {
    throw new ConfigError("serverchan3.appPackage must be a dotted package name");
  }
  const fallbackUrl = normalizeBase(source.fallbackUrl ?? publicBase, "serverchan3.fallbackUrl");
  const tags = resolveTagConfig(source.tags);
  validateTagConfig(tags);
  return { appPackage, fallbackUrl, tags };
}
function resolveConfig(input) {
  if (typeof input !== "object" || input === null) {
    throw new ConfigError("plugin config must be an object");
  }
  const publicBase = normalizeBase(input.publicBase, "publicBase");
  const transport = transportValue(input.transport);
  const notifyInput = input.notify ?? {};
  const privacyInput = input.privacy ?? {};
  const limitsInput = input.limits ?? {};
  const notify = {
    approval: boolValue(notifyInput.approval, true, "notify.approval"),
    question: boolValue(notifyInput.question, true, "notify.question"),
    planReview: boolValue(notifyInput.planReview, true, "notify.planReview"),
    turnDone: boolValue(notifyInput.turnDone, false, "notify.turnDone"),
    modelTool: boolValue(notifyInput.modelTool, true, "notify.modelTool"),
    debounceMs: intValue(notifyInput.debounceMs, 1500, 0, 1e4, "notify.debounceMs"),
    graceMs: intValue(notifyInput.graceMs, 4e3, 0, 3e4, "notify.graceMs"),
    settleMs: intValue(notifyInput.settleMs, 500, 0, 2e3, "notify.settleMs"),
    detail: detailValue(notifyInput.detail),
    inPage: boolValue(notifyInput.inPage, true, "notify.inPage"),
    webNotification: boolValue(notifyInput.webNotification, true, "notify.webNotification"),
    inPageCountsAsDelivered: boolValue(
      notifyInput.inPageCountsAsDelivered,
      true,
      "notify.inPageCountsAsDelivered"
    )
  };
  const privacy = {
    includeSessionTitle: boolValue(privacyInput.includeSessionTitle, true, "privacy.includeSessionTitle"),
    includeReason: boolValue(privacyInput.includeReason, true, "privacy.includeReason"),
    includeToolName: boolValue(privacyInput.includeToolName, true, "privacy.includeToolName")
  };
  const limits = {
    bodyBytes: intValue(limitsInput.bodyBytes, 2048, 512, 2048, "limits.bodyBytes"),
    ratePerMinute: intValue(limitsInput.ratePerMinute, 120, 10, 600, "limits.ratePerMinute"),
    pushPerMinute: intValue(limitsInput.pushPerMinute, 50, 1, 50, "limits.pushPerMinute"),
    pushTimeoutMs: intValue(limitsInput.pushTimeoutMs, 8e3, 1e3, 3e4, "limits.pushTimeoutMs"),
    pushRetries: intValue(limitsInput.pushRetries, 2, 0, 3, "limits.pushRetries")
  };
  return {
    publicBase,
    transport,
    serverchan3: normalizeServerChan3(input.serverchan3, publicBase),
    notify,
    privacy,
    limits
  };
}

// src/host/clock.ts
var systemClock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    handle.unref?.();
    return handle;
  },
  clearTimeout: (handle) => clearTimeout(handle)
};
function sleep(ms) {
  return new Promise((resolve) => {
    const handle = setTimeout(resolve, ms);
    handle.unref?.();
  });
}

// src/shared/serverchan.ts
var SENDKEY_PATTERN = /^sctp\d+t[A-Za-z0-9_-]+$/u;
function isSendkey(value) {
  return typeof value === "string" && SENDKEY_PATTERN.test(value);
}
function uidFromSendkey(value) {
  return /^sctp(\d+)t/u.exec(value)?.[1];
}

// src/host/credentials.ts
var SENDKEY_RECORD = "dsh-mobile-notify/serverchan3";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function credentialsOf(ctx) {
  const candidate = ctx.get("credentials");
  if (!isRecord(candidate)) return void 0;
  if (typeof candidate.readRecord !== "function" || typeof candidate.describeRecord !== "function" || typeof candidate.modifyRecord !== "function") return void 0;
  return candidate;
}
async function readSendkey(service) {
  if (service === void 0) return void 0;
  try {
    const record = await service.readRecord(SENDKEY_RECORD);
    if (record?.kind !== "grant" || !isRecord(record.payload)) return void 0;
    const value = record.payload.sendkey;
    return isSendkey(value) ? value : void 0;
  } catch {
    return void 0;
  }
}
async function sendkeyStatus(service) {
  if (service === void 0) return { configured: false, writable: false };
  try {
    const info = await service.describeRecord(SENDKEY_RECORD);
    return { configured: info.configured, writable: info.writable };
  } catch {
    return { configured: false, writable: false };
  }
}
async function writeSendkey(service, value) {
  if (service === void 0) throw new Error("credentials service unavailable");
  if (value === null) {
    if (service.deleteRecord === void 0) throw new Error("credentials record cannot be cleared");
    await service.deleteRecord(SENDKEY_RECORD);
    return;
  }
  await service.modifyRecord(SENDKEY_RECORD, async () => ({
    kind: "grant",
    payload: { sendkey: value }
  }));
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
function cleanMultiline(value, max) {
  if (typeof value !== "string") return void 0;
  const text = value.replace(/\r\n?/gu, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ").replace(/[ \t]+/gu, " ").replace(/ *\n */gu, "\n").replace(/\n{3,}/gu, "\n\n").trim();
  if (text === "") return void 0;
  return truncate(text, max);
}
function escapeMarkdown(value) {
  return value.replace(/([\\`*_{}[\]()#<>|~])/gu, "\\$1");
}
function shortId(value) {
  return value.length <= 8 ? value : value.slice(0, 8);
}

// src/host/presence.ts
var WEB_TTL_MS = 12e4;
var SHELL_TTL_MS = 15e3;
var PresenceStore = class {
  records = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  clock;
  constructor(clock) {
    this.clock = clock;
  }
  /** Insert or replace one client's presence; TTL starts at server receipt time. */
  update(input) {
    this.records.set(input.clientId, { ...input, receivedAt: this.clock.now() });
    this.emit();
  }
  /** Remove expired records and notify listeners when anything changed. */
  prune() {
    const now = this.clock.now();
    let changed = false;
    for (const [clientId, record] of this.records) {
      if (now - record.receivedAt > this.ttlFor(record.platform)) {
        this.records.delete(clientId);
        changed = true;
      }
    }
    if (changed) this.emit();
  }
  /** True while an Android shell reports itself visible and focused. */
  phoneForeground() {
    const now = this.clock.now();
    for (const record of this.records.values()) {
      if (record.platform === "android-shell" && record.visibility === "visible" && record.focused && this.fresh(record, now)) return true;
    }
    return false;
  }
  /** Fresh web clients, regardless of visibility, used to decide whether to wait for an ack. */
  liveWebClientIds() {
    const now = this.clock.now();
    const ids = [];
    for (const record of this.records.values()) {
      if (record.platform === "web" && this.fresh(record, now)) ids.push(record.clientId);
    }
    return ids;
  }
  /** Counts for the health route; expires first. */
  counts() {
    this.prune();
    const now = this.clock.now();
    let web = 0;
    let androidShell = 0;
    for (const record of this.records.values()) {
      if (!this.fresh(record, now)) continue;
      if (record.platform === "web") web += 1;
      else androidShell += 1;
    }
    return { web, androidShell };
  }
  /** Subscribe to updates/prunes; returns an idempotent unsubscribe. */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  clear() {
    if (this.records.size === 0) return;
    this.records.clear();
    this.emit();
  }
  ttlFor(platform) {
    return platform === "android-shell" ? SHELL_TTL_MS : WEB_TTL_MS;
  }
  fresh(record, now) {
    return now - record.receivedAt <= this.ttlFor(record.platform);
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

// src/host/decision.ts
function baseKeyFor(event) {
  return `${event.sessionId}:${event.kind}${event.callId === void 0 ? "" : `:${event.callId}`}`;
}
function keyForAck(ack) {
  return `${ack.sessionId}:${ack.kind}${ack.callId === void 0 ? "" : `:${ack.callId}`}`;
}
function isEnabled(config, kind) {
  switch (kind) {
    case "approval":
      return config.notify.approval;
    case "question":
      return config.notify.question;
    case "plan-review":
      return config.notify.planReview;
    case "turn":
      return config.notify.turnDone;
    case "notice":
      return config.notify.modelTool;
    case "test":
      return false;
  }
}
var DecisionEngine = class {
  records = /* @__PURE__ */ new Map();
  deps;
  unsubscribe;
  constructor(deps) {
    this.deps = deps;
    this.unsubscribe = deps.presence.subscribe(() => this.onPresenceChanged());
  }
  /** Number of live records (approved/resolved records are removed). */
  get pendingCount() {
    return this.records.size;
  }
  /**
   * Start debounce for one waterfall event. Returns false when the event is
   * disabled or is a duplicate of an active record.
   */
  begin(event) {
    if (!isEnabled(this.deps.config, event.kind)) return false;
    const baseKey = baseKeyFor(event);
    if (this.records.has(baseKey)) {
      this.deps.logger.debug(`dsh-mobile-notify: duplicate event ${baseKey}`);
      return false;
    }
    const record = {
      event,
      baseKey,
      state: "debouncing",
      acks: /* @__PURE__ */ new Map(),
      expectedClientIds: /* @__PURE__ */ new Set()
    };
    this.records.set(baseKey, record);
    record.debounceTimer = this.deps.clock.setTimeout(
      () => this.evaluate(record),
      this.deps.config.notify.debounceMs
    );
    return true;
  }
  /** Called when the waterfall returns: clear pending and cancel any unsent push. */
  resolve(event) {
    this.delete(baseKeyFor(event));
  }
  /** Apply a client delivery acknowledgement. */
  onAck(ack) {
    const record = this.findRecord(ack);
    if (record === void 0) {
      this.deps.logger.debug(`dsh-mobile-notify: ack for unknown ${shortId(ack.sessionId)}:${ack.kind}`);
      return;
    }
    record.acks.set(ack.clientId, ack);
    if (ack.delivered) {
      this.suppress(record);
      return;
    }
    if (record.state === "waiting-ack" && this.allExpectedAckedFalse(record)) {
      this.push(record);
    }
  }
  /** Release all timers and listeners. */
  dispose() {
    for (const record of [...this.records.values()]) this.delete(record.baseKey);
    this.unsubscribe();
  }
  findRecord(ack) {
    const exact = this.records.get(keyForAck(ack));
    if (exact !== void 0) return exact;
    const candidates = [...this.records.values()].filter(
      (record) => record.event.sessionId === ack.sessionId && record.event.kind === ack.kind
    );
    if (candidates.length > 1) {
      this.deps.logger.warn(`dsh-mobile-notify: ambiguous ack for ${shortId(ack.sessionId)}:${ack.kind}`);
      return void 0;
    }
    return candidates[0];
  }
  evaluate(record) {
    if (this.records.get(record.baseKey) !== record || record.state !== "debouncing") return;
    record.debounceTimer = void 0;
    const config = this.deps.config;
    if (config.notify.inPage && config.notify.inPageCountsAsDelivered && this.deps.presence.phoneForeground()) {
      this.suppress(record);
      return;
    }
    const webClients = this.deps.presence.liveWebClientIds();
    if (webClients.length === 0) {
      this.push(record);
      return;
    }
    record.state = "waiting-ack";
    for (const clientId of webClients) record.expectedClientIds.add(clientId);
    if (this.anyAckDelivered(record)) {
      this.suppress(record);
      return;
    }
    if (this.allExpectedAckedFalse(record)) {
      this.push(record);
      return;
    }
    record.graceTimer = this.deps.clock.setTimeout(
      () => this.onGraceTimeout(record),
      config.notify.graceMs
    );
  }
  onGraceTimeout(record) {
    if (this.records.get(record.baseKey) !== record || record.state !== "waiting-ack") return;
    record.graceTimer = void 0;
    if (this.deps.config.notify.inPage && this.deps.config.notify.inPageCountsAsDelivered && this.deps.presence.phoneForeground()) {
      this.suppress(record);
      return;
    }
    if (this.anyAckDelivered(record)) {
      this.suppress(record);
      return;
    }
    this.push(record);
  }
  onPresenceChanged() {
    for (const record of this.records.values()) {
      if (record.state !== "waiting-ack") continue;
      if (this.deps.config.notify.inPage && this.deps.config.notify.inPageCountsAsDelivered && this.deps.presence.phoneForeground()) {
        this.suppress(record);
      }
    }
  }
  anyAckDelivered(record) {
    for (const ack of record.acks.values()) {
      if (ack.delivered) return true;
    }
    return false;
  }
  allExpectedAckedFalse(record) {
    if (record.expectedClientIds.size === 0) return false;
    for (const clientId of record.expectedClientIds) {
      const ack = record.acks.get(clientId);
      if (ack === void 0 || ack.delivered) return false;
    }
    return true;
  }
  suppress(record) {
    if (this.records.get(record.baseKey) !== record) return;
    this.clearTimers(record);
    record.state = "suppressed";
    record.pushAbort?.abort();
    record.pushAbort = void 0;
    this.endNotice(record, "suppressed");
    this.deps.logger.debug(`dsh-mobile-notify: suppressed ${shortId(record.event.sessionId)}:${record.event.kind}`);
    if (record.event.oneShot) this.delete(record.baseKey);
  }
  endNotice(record, outcome) {
    if (record.event.kind !== "notice" || record.ended === true) return;
    record.ended = true;
    try {
      this.deps.onNoticeEnd?.(record.event, outcome);
    } catch (error) {
      this.deps.logger.warn("dsh-mobile-notify: notice end callback failed", error);
    }
  }
  push(record) {
    if (this.records.get(record.baseKey) !== record) return;
    if (record.state === "pushing" || record.state === "pushed") return;
    this.clearTimers(record);
    record.state = "pushing";
    const controller = new AbortController();
    record.pushAbort = controller;
    this.deps.logger.info(
      `dsh-mobile-notify: pushing ${record.event.kind} ${shortId(record.event.sessionId)}`
    );
    Promise.resolve().then(() => this.deps.transport.send(record.event, controller.signal)).then((result) => {
      if (this.records.get(record.baseKey) !== record) return;
      record.pushResult = result;
      record.pushAbort = void 0;
      record.state = "pushed";
      try {
        this.deps.onPushResult?.(record.event, result);
      } catch (error) {
        this.deps.logger.warn("dsh-mobile-notify: push result callback failed", error);
      }
      this.endNotice(record, result.ok ? "pushed" : "failed");
      if (!result.ok) {
        this.deps.logger.warn(
          `dsh-mobile-notify: push failed for ${shortId(record.event.sessionId)}: ${result.error ?? "unknown"}`
        );
      }
      if (record.event.oneShot) this.delete(record.baseKey);
    }).catch((error) => {
      if (this.records.get(record.baseKey) !== record) return;
      record.pushAbort = void 0;
      record.state = "pushed";
      record.pushResult = { ok: false, dryRun: false, error: "exception" };
      this.endNotice(record, "failed");
      this.deps.logger.warn("dsh-mobile-notify: push threw", error);
      if (record.event.oneShot) this.delete(record.baseKey);
    });
  }
  clearTimers(record) {
    if (record.debounceTimer !== void 0) {
      this.deps.clock.clearTimeout(record.debounceTimer);
      record.debounceTimer = void 0;
    }
    if (record.graceTimer !== void 0) {
      this.deps.clock.clearTimeout(record.graceTimer);
      record.graceTimer = void 0;
    }
  }
  delete(baseKey) {
    const record = this.records.get(baseKey);
    if (record === void 0) return;
    this.clearTimers(record);
    record.pushAbort?.abort();
    record.pushAbort = void 0;
    record.state = "resolved";
    this.records.delete(baseKey);
  }
};

// src/host/events.ts
function isTitleService(value) {
  return typeof value === "object" && value !== null && "get" in value && typeof value.get === "function";
}
function sessionTitle(ctx, sessionId) {
  const service = ctx.get("sessionTitle");
  if (!isTitleService(service)) return shortId(sessionId);
  try {
    const session = ctx.sessions.get(sessionId);
    if (session === void 0) return shortId(sessionId);
    const title = service.get(session)?.title;
    if (typeof title === "string" && title.trim() !== "") return title.trim();
  } catch {
  }
  return shortId(sessionId);
}
function eventId(kind, sessionId, callId) {
  return `${sessionId}:${kind}:${callId ?? "none"}:${Date.now()}`;
}
function approvalEvent(ctx, req) {
  const sessionId = req.agent?.id;
  if (typeof sessionId !== "string" || sessionId === "") return void 0;
  const reason = cleanText(req.reason, 200) ?? cleanText(req.displayReason?.en, 200);
  const toolName = cleanText(req.toolName, 60);
  return {
    eventId: eventId("approval", sessionId, req.callId),
    kind: "approval",
    sessionId,
    sessionTitle: sessionTitle(ctx, sessionId),
    createdAt: Date.now(),
    ...typeof req.callId === "string" && req.callId !== "" ? { callId: req.callId } : {},
    ...toolName === void 0 ? {} : { toolName },
    ...reason === void 0 ? {} : { reason }
  };
}
function questionEvent(ctx, req) {
  const sessionId = req.agent?.id;
  if (typeof sessionId !== "string" || sessionId === "") return void 0;
  const questions = Array.isArray(req.questions) ? req.questions : [];
  const planReview = questions.some((question) => question.intent?.kind === "plan-review");
  const firstQuestion = cleanText(questions[0]?.question, 200);
  const callId = typeof req.wait?.callId === "string" && req.wait.callId !== "" ? req.wait.callId : void 0;
  return {
    eventId: eventId(planReview ? "plan-review" : "question", sessionId, callId),
    kind: planReview ? "plan-review" : "question",
    sessionId,
    sessionTitle: sessionTitle(ctx, sessionId),
    createdAt: Date.now(),
    ...callId === void 0 ? {} : { callId },
    ...firstQuestion === void 0 ? {} : { question: firstQuestion }
  };
}
function turnEvent(ctx, session, event) {
  if (event.type !== "turn/end") return void 0;
  if (session.header?.origin === "subagent") return void 0;
  const sessionId = session.id;
  if (typeof sessionId !== "string" || sessionId === "") return void 0;
  const turn = event.data?.turn;
  return {
    eventId: eventId("turn", sessionId),
    kind: "turn",
    sessionId,
    sessionTitle: sessionTitle(ctx, sessionId),
    createdAt: Date.now(),
    ...typeof turn === "number" ? { turn } : {}
  };
}
function registerEventObservers(ctx, engine, options) {
  ctx.on("approval/request", async (req, next) => {
    let event;
    let accepted = false;
    try {
      event = approvalEvent(ctx, req);
      if (event !== void 0) accepted = engine.begin(event);
    } catch (error) {
      ctx.logger.warn("dsh-mobile-notify: approval observer failed", error);
    }
    try {
      return await next();
    } finally {
      if (event !== void 0 && accepted) {
        try {
          engine.resolve(event);
        } catch (error) {
          ctx.logger.warn("dsh-mobile-notify: approval resolve failed", error);
        }
      }
    }
  }, true);
  ctx.on("user-questions/request", async (req, next) => {
    let event;
    let accepted = false;
    try {
      event = questionEvent(ctx, req);
      if (event !== void 0) accepted = engine.begin(event);
    } catch (error) {
      ctx.logger.warn("dsh-mobile-notify: question observer failed", error);
    }
    try {
      return await next();
    } finally {
      if (event !== void 0 && accepted) {
        try {
          engine.resolve(event);
        } catch (error) {
          ctx.logger.warn("dsh-mobile-notify: question resolve failed", error);
        }
      }
    }
  }, true);
  ctx.on("session/event", (session, event) => {
    if (event.type !== "turn/end") return;
    let enabled = false;
    try {
      enabled = options.turnDone(session);
    } catch (error) {
      ctx.logger.warn("dsh-mobile-notify: turnDone predicate failed", error);
      return;
    }
    if (!enabled) return;
    try {
      const normalized = turnEvent(ctx, session, event);
      if (normalized !== void 0) {
        engine.begin({ ...normalized, oneShot: true });
      }
    } catch (error) {
      ctx.logger.warn("dsh-mobile-notify: turn observer failed", error);
    }
  });
}

// src/host/settings.ts
function configEditorOf(ctx) {
  const candidate = ctx.get("configEditor");
  if (!isRecord2(candidate) || typeof candidate.edit !== "function") return void 0;
  return candidate;
}
var SettingsError = class extends Error {
  name = "SettingsError";
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function copySettings(config) {
  return {
    publicBase: config.publicBase,
    transport: config.transport,
    serverchan3: {
      appPackage: config.serverchan3.appPackage,
      fallbackUrl: config.serverchan3.fallbackUrl,
      tags: {
        ...config.serverchan3.tags,
        kindTags: { ...config.serverchan3.tags.kindTags },
        extra: [...config.serverchan3.tags.extra]
      }
    },
    notify: { ...config.notify },
    privacy: { ...config.privacy },
    limits: { ...config.limits }
  };
}
function rawConfig(settings) {
  return {
    publicBase: settings.publicBase,
    transport: settings.transport,
    serverchan3: {
      appPackage: settings.serverchan3.appPackage,
      fallbackUrl: settings.serverchan3.fallbackUrl,
      tags: {
        enabled: settings.serverchan3.tags.enabled,
        namespace: settings.serverchan3.tags.namespace,
        includeNamespace: settings.serverchan3.tags.includeNamespace,
        includeKind: settings.serverchan3.tags.includeKind,
        kindTags: settings.serverchan3.tags.kindTags,
        extra: settings.serverchan3.tags.extra
      }
    },
    notify: settings.notify,
    privacy: settings.privacy,
    limits: settings.limits
  };
}
var SettingsService = class {
  deps;
  constructor(deps) {
    this.deps = deps;
  }
  get editable() {
    return this.deps.configEditor !== void 0 && this.deps.entry !== void 0;
  }
  async read() {
    const status = await sendkeyStatus(this.deps.credentials);
    return {
      contract: 1,
      editable: this.editable,
      sendkey: {
        ...status,
        available: this.deps.credentials !== void 0
      },
      settings: copySettings(this.deps.config)
    };
  }
  /**
   * Persist non-secret config through configEditor and optionally replace/clear
   * the SendKey record. A config change restarts the plugin; the HTTP handler
   * that owns this request may finish after that replacement.
   */
  async write(input) {
    if (!isRecord2(input) || !isRecord2(input.settings)) {
      throw new SettingsError(400, "settings must be an object");
    }
    const settings = input.settings;
    if (!isRecord2(settings) || !isRecord2(settings.serverchan3) || !isRecord2(settings.serverchan3.tags) || !isRecord2(settings.notify) || !isRecord2(settings.privacy) || !isRecord2(settings.limits)) {
      throw new SettingsError(400, "settings is missing required sections");
    }
    try {
      resolveConfig(rawConfig(settings));
    } catch (error) {
      if (error instanceof ConfigError) throw new SettingsError(400, error.message);
      throw error;
    }
    const editor = this.deps.configEditor;
    const entry = this.deps.entry;
    if (editor === void 0 || entry === void 0) {
      throw new SettingsError(503, "this profile does not expose a configuration editor");
    }
    if (input.sendkey !== void 0) {
      const credentials = this.deps.credentials;
      if (credentials === void 0) {
        throw new SettingsError(503, "the credentials service is not available in this profile");
      }
      const status = await sendkeyStatus(credentials);
      if (!status.writable) throw new SettingsError(409, "the stored SendKey is not writable");
      if (input.sendkey === null) {
        await writeSendkey(credentials, null);
      } else if (typeof input.sendkey === "string") {
        const value = input.sendkey.trim();
        if (!isSendkey(value)) {
          throw new SettingsError(400, "SendKey must look like sctp<uid>t<token>");
        }
        await writeSendkey(credentials, value);
      } else {
        throw new SettingsError(400, "sendkey must be a string or null");
      }
    }
    const next = rawConfig(settings);
    try {
      await editor.edit(entry, (current, _inherited) => {
        const currentServer = isRecord2(current.serverchan3) ? current.serverchan3 : {};
        const nextServer = next.serverchan3 ?? {};
        const serverchan3 = { ...currentServer, ...nextServer };
        delete serverchan3.sendkey;
        delete serverchan3.uid;
        return {
          ...current,
          ...next,
          serverchan3
        };
      });
    } catch (error) {
      this.deps.logger.warn("dsh-mobile-notify: settings save failed", error);
      throw new SettingsError(502, error instanceof Error ? error.message : "configuration save failed");
    }
    return { ok: true, restarting: true };
  }
};

// src/host/rate-limit.ts
var RateLimiter = class {
  hits = /* @__PURE__ */ new Map();
  clock;
  constructor(clock) {
    this.clock = clock;
  }
  /**
   * Record one hit for `key` and report whether it is allowed.
   * @param key - client identity or a fixed outbound bucket.
   * @param limit - maximum hits in the window.
   * @param windowMs - sliding window length.
   */
  take(key, limit, windowMs) {
    const now = this.clock.now();
    const cutoff = now - windowMs;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > cutoff);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
  /** Drop all buckets whose hits are older than `windowMs`. */
  prune(windowMs) {
    const cutoff = this.clock.now() - windowMs;
    for (const [key, hits] of this.hits) {
      const recent = hits.filter((at) => at > cutoff);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
};

// src/host/routes.ts
var CLIENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
var SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
var KINDS = ["approval", "question", "plan-review", "turn", "notice"];
var VIA = ["in-page", "web-notification", "none"];
var REASONS = ["none", "permission-denied", "unsupported", "constructor-error", "hidden-no-notification"];
var PLATFORMS = ["web", "android-shell"];
var VISIBILITIES = ["visible", "hidden"];
var NOTIFICATIONS = ["granted", "denied", "default", "unsupported"];
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readString(record, key) {
  const value = record[key];
  return typeof value === "string" ? value : void 0;
}
function readBoolean(record, key) {
  const value = record[key];
  return typeof value === "boolean" ? value : void 0;
}
function isOneOf(value, list) {
  return typeof value === "string" && list.includes(value);
}
function hasControlCharacters(value) {
  return /[\u0000-\u001f\u007f]/u.test(value);
}
function parseContract(record) {
  const value = record.contract;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return { ok: false, message: "contract must be a positive integer" };
  }
  return { ok: true, value };
}
function parseAt(record) {
  const value = readString(record, "at");
  if (value === void 0 || Number.isNaN(Date.parse(value))) {
    return { ok: false, message: "at must be an RFC3339 timestamp" };
  }
  return { ok: true, value };
}
function parsePresence(value) {
  if (!isRecord3(value)) return { ok: false, message: "body must be a JSON object" };
  const contract = parseContract(value);
  if (!contract.ok) return contract;
  const clientId = readString(value, "clientId");
  if (clientId === void 0 || !CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, message: "clientId is invalid" };
  }
  const platform = value.platform;
  if (!isOneOf(platform, PLATFORMS)) return { ok: false, message: "platform is invalid" };
  const visibility = value.visibility;
  if (!isOneOf(visibility, VISIBILITIES)) {
    return { ok: false, message: "visibility is invalid" };
  }
  const focused = readBoolean(value, "focused");
  if (focused === void 0) return { ok: false, message: "focused must be boolean" };
  const notification = value.notification;
  if (!isOneOf(notification, NOTIFICATIONS)) return { ok: false, message: "notification is invalid" };
  const at = parseAt(value);
  if (!at.ok) return at;
  const activeSessionId = readString(value, "activeSessionId");
  if (activeSessionId !== void 0 && !SESSION_ID_PATTERN.test(activeSessionId)) {
    return { ok: false, message: "activeSessionId is invalid" };
  }
  return {
    ok: true,
    value: {
      clientId,
      platform,
      visibility,
      focused,
      notification,
      at: at.value,
      ...activeSessionId === void 0 ? {} : { activeSessionId }
    }
  };
}
function parseSessionTurnDone(value) {
  if (!isRecord3(value)) return { ok: false, message: "body must be a JSON object" };
  const sessionId = readString(value, "sessionId");
  if (sessionId === void 0 || !SESSION_ID_PATTERN.test(sessionId)) {
    return { ok: false, message: "sessionId is invalid" };
  }
  const turnDone = value.turnDone;
  if (turnDone !== true && turnDone !== false && turnDone !== null) {
    return { ok: false, message: "turnDone must be boolean or null" };
  }
  return { ok: true, value: { sessionId, turnDone } };
}
function parseAck(value) {
  if (!isRecord3(value)) return { ok: false, message: "body must be a JSON object" };
  const contract = parseContract(value);
  if (!contract.ok) return contract;
  const clientId = readString(value, "clientId");
  if (clientId === void 0 || !CLIENT_ID_PATTERN.test(clientId)) {
    return { ok: false, message: "clientId is invalid" };
  }
  const platform = value.platform;
  if (!isOneOf(platform, PLATFORMS)) return { ok: false, message: "platform is invalid" };
  const sessionId = readString(value, "sessionId");
  if (sessionId === void 0 || !SESSION_ID_PATTERN.test(sessionId)) {
    return { ok: false, message: "sessionId is invalid" };
  }
  const kind = value.kind;
  if (!isOneOf(kind, KINDS)) return { ok: false, message: "kind is invalid" };
  const key = readString(value, "key");
  if (key === void 0 || key.length === 0 || key.length > 256 || hasControlCharacters(key)) {
    return { ok: false, message: "key is invalid" };
  }
  const callId = readString(value, "callId");
  if (callId !== void 0 && (callId.length === 0 || callId.length > 128 || hasControlCharacters(callId))) {
    return { ok: false, message: "callId is invalid" };
  }
  const delivered = readBoolean(value, "delivered");
  if (delivered === void 0) return { ok: false, message: "delivered must be boolean" };
  const via = value.via;
  if (!isOneOf(via, VIA)) return { ok: false, message: "via is invalid" };
  const reason = value.reason;
  if (!isOneOf(reason, REASONS)) return { ok: false, message: "reason is invalid" };
  if (delivered && (via === "none" || reason !== "none")) {
    return { ok: false, message: "delivered ack must use a delivery channel and reason=none" };
  }
  if (!delivered && (via !== "none" || reason === "none")) {
    return { ok: false, message: "failed ack must use via=none and a failure reason" };
  }
  const at = parseAt(value);
  if (!at.ok) return at;
  return {
    ok: true,
    value: {
      clientId,
      platform,
      sessionId,
      kind,
      key,
      delivered,
      via,
      reason,
      at: at.value,
      ...callId === void 0 ? {} : { callId }
    }
  };
}
function headerValue(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return void 0;
}
function jsonContentType(req) {
  const type = headerValue(req.headers["content-type"])?.split(";")[0]?.trim().toLowerCase();
  return type === "application/json";
}
function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(body));
}
function sendError(res, status, error, message) {
  sendJson(res, status, message === void 0 ? { error } : { error, message });
}
function sendEmpty(res, status) {
  res.writeHead(status, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end();
}
function sendRateLimited(res) {
  res.writeHead(429, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "retry-after": "60"
  });
  res.end(JSON.stringify({ error: "rate_limited" }));
}
function sendMethodNotAllowed(res, allow) {
  res.writeHead(405, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    allow
  });
  res.end(JSON.stringify({ error: "method_not_allowed" }));
}
async function readJson(req, res, maxBytes) {
  if (!jsonContentType(req)) {
    sendError(res, 415, "unsupported_media_type");
    req.resume();
    return { ok: false, message: "unsupported media type" };
  }
  const declared = Number(headerValue(req.headers["content-length"]) ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    sendError(res, 413, "payload_too_large");
    req.resume();
    return { ok: false, message: "payload too large" };
  }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        sendError(res, 413, "payload_too_large");
        req.destroy();
        return { ok: false, message: "payload too large" };
      }
      chunks.push(buffer);
    }
  } catch {
    if (!res.writableEnded) sendError(res, 400, "invalid_request");
    return { ok: false, message: "body read failed" };
  }
  if (size === 0) return { ok: false, message: "body is empty" };
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    sendError(res, 400, "invalid_request", "body must be valid JSON");
    return { ok: false, message: "invalid json" };
  }
}
function authorize(req, res, connection) {
  const rejection = connection.requestRejection({ headers: req.headers });
  if (rejection !== void 0) {
    sendError(res, rejection, rejection === 401 ? "unauthorized" : "forbidden");
    req.resume();
    return false;
  }
  const admitted = connection.admit({ headers: req.headers });
  if ("rejection" in admitted) {
    sendError(res, admitted.rejection, admitted.rejection === 401 ? "unauthorized" : "forbidden");
    req.resume();
    return false;
  }
  return true;
}
function ipKey(req) {
  return `ip:${req.socket.remoteAddress ?? "unknown"}`;
}
function bootstrap(res, deps, connection) {
  try {
    const location = connection.authenticatedUrl(deps.config.publicBase);
    res.writeHead(302, {
      location,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer"
    });
    res.end();
  } catch (error) {
    deps.logger.error("dsh-mobile-notify: bootstrap failed", error);
    sendError(res, 500, "internal_error");
  }
}
function clientConfig(config) {
  return {
    contract: 1,
    client: {
      inPage: config.notify.inPage,
      webNotification: config.notify.webNotification,
      inPageCountsAsDelivered: config.notify.inPageCountsAsDelivered,
      turnDone: config.notify.turnDone,
      settleMs: config.notify.settleMs,
      detail: config.notify.detail,
      includeSessionTitle: config.privacy.includeSessionTitle,
      includeReason: config.privacy.includeReason,
      includeToolName: config.privacy.includeToolName
    }
  };
}
function health(config, deps) {
  return {
    ok: true,
    contract: 1,
    version: deps.version,
    transport: config.transport,
    pending: deps.engine.pendingCount,
    presence: mapPresence(deps.presence.counts()),
    projection: deps.projectionStatus(),
    lastPush: deps.health.lastPush ?? null
  };
}
function mapPresence(counts) {
  return { web: counts.web, androidShell: counts.androidShell };
}
function registerRoutes(context, deps) {
  const ipLimiter = new RateLimiter(deps.clock);
  const clientLimiter = new RateLimiter(deps.clock);
  const pushLimiter = new RateLimiter(deps.clock);
  const settingsLimiter = new RateLimiter(deps.clock);
  const disposers = [];
  const handlersByPath = /* @__PURE__ */ new Map();
  const register = (method, path, run) => {
    const existing = handlersByPath.get(path);
    if (existing !== void 0) {
      existing.handlers[method] = run;
      return;
    }
    const handlers = { [method]: run };
    handlersByPath.set(path, { handlers });
    disposers.push(context.webServer.register({
      kind: "exact",
      path,
      handler: async (req, res) => {
        try {
          const runner = req.method === void 0 ? void 0 : handlers[req.method];
          if (runner === void 0) {
            sendMethodNotAllowed(res, Object.keys(handlers).join(", "));
            req.resume();
            return;
          }
          if (!ipLimiter.take(ipKey(req), 240, 6e4)) {
            sendRateLimited(res);
            req.resume();
            return;
          }
          ipLimiter.prune(6e4);
          await runner(req, res);
        } catch (error) {
          deps.logger.error(`dsh-mobile-notify: ${req.method ?? "?"} ${path} failed`, error);
          if (!res.writableEnded) sendError(res, 500, "internal_error");
        }
      }
    }));
  };
  try {
    register("GET", "/mobile/bootstrap", (_req, res) => {
      bootstrap(res, deps, context.connection);
    });
    register("GET", "/mobile/config", (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      sendJson(res, 200, clientConfig(deps.config));
    });
    register("POST", "/mobile/presence", async (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      const body = await readJson(req, res, deps.config.limits.bodyBytes);
      if (!body.ok) {
        if (!res.writableEnded) sendError(res, 400, "invalid_request", body.message);
        return;
      }
      const parsed = parsePresence(body.value);
      if (!parsed.ok) {
        sendError(res, 400, "invalid_request", parsed.message);
        return;
      }
      if (!clientLimiter.take(`client:${parsed.value.clientId}`, deps.config.limits.ratePerMinute, 6e4)) {
        sendRateLimited(res);
        return;
      }
      deps.presence.update(parsed.value);
      sendEmpty(res, 204);
    });
    register("POST", "/mobile/ack", async (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      const body = await readJson(req, res, deps.config.limits.bodyBytes);
      if (!body.ok) {
        if (!res.writableEnded) sendError(res, 400, "invalid_request", body.message);
        return;
      }
      const parsed = parseAck(body.value);
      if (!parsed.ok) {
        sendError(res, 400, "invalid_request", parsed.message);
        return;
      }
      if (!clientLimiter.take(`client:${parsed.value.clientId}`, deps.config.limits.ratePerMinute, 6e4)) {
        sendRateLimited(res);
        return;
      }
      deps.engine.onAck(parsed.value);
      sendEmpty(res, 204);
    });
    register("POST", "/mobile/push/test", async (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      req.resume();
      if (!pushLimiter.take("push-test", 10, 6e4)) {
        sendRateLimited(res);
        return;
      }
      const controller = new AbortController();
      const result = await deps.sendTest(controller.signal);
      deps.health.lastPush = {
        at: (/* @__PURE__ */ new Date()).toISOString(),
        ok: result.ok,
        kind: "test"
      };
      if (result.ok) sendJson(res, 202, { ok: true, dryRun: result.dryRun });
      else sendError(res, 502, "upstream_failed", result.error);
    });
    register("GET", "/mobile/health", (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      sendJson(res, 200, health(deps.config, deps));
    });
    register("PUT", "/mobile/session-settings", async (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      if (!settingsLimiter.take(ipKey(req), 20, 6e4)) {
        sendRateLimited(res);
        req.resume();
        return;
      }
      const body = await readJson(req, res, 4096);
      if (!body.ok) {
        if (!res.writableEnded) sendError(res, 400, "invalid_request", body.message);
        return;
      }
      const parsed = parseSessionTurnDone(body.value);
      if (!parsed.ok) {
        sendError(res, 400, "invalid_request", parsed.message);
        return;
      }
      const changed = await deps.setSessionTurnDone(parsed.value.sessionId, parsed.value.turnDone);
      if (!changed) {
        sendError(res, 404, "session_not_found");
        return;
      }
      sendJson(res, 200, { ok: true, sessionId: parsed.value.sessionId, turnDone: parsed.value.turnDone });
    });
    register("GET", "/mobile/settings", async (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      const view = await deps.settings.read();
      sendJson(res, 200, view);
    });
    register("PUT", "/mobile/settings", async (req, res) => {
      if (!authorize(req, res, context.connection)) return;
      if (!settingsLimiter.take(ipKey(req), 20, 6e4)) {
        sendRateLimited(res);
        req.resume();
        return;
      }
      const body = await readJson(req, res, 16384);
      if (!body.ok) {
        if (!res.writableEnded) sendError(res, 400, "invalid_request", body.message);
        return;
      }
      try {
        const result = await deps.settings.write(body.value);
        sendJson(res, 200, result);
      } catch (error) {
        if (error instanceof SettingsError) {
          sendError(res, error.status, error.status === 400 ? "invalid_settings" : "settings_unavailable", error.message);
          return;
        }
        throw error;
      }
    });
  } catch (error) {
    for (const dispose of disposers.reverse()) {
      try {
        dispose();
      } catch {
      }
    }
    throw error;
  }
  return () => {
    for (const dispose of disposers.reverse()) {
      try {
        dispose();
      } catch {
      }
    }
  };
}

// src/host/serverchan3.ts
var SESSION_ID_PATTERN2 = /^[A-Za-z0-9._:-]{1,128}$/u;
var FALLBACK_LABEL = "\u6253\u5F00 DSH";
function noticeTitle(event, detail) {
  if (detail !== "summary") return "DSH \xB7 \u901A\u77E5";
  const title = cleanOrEmpty(event.noticeTitle, 60);
  const base = title === "" ? "\u901A\u77E5" : title;
  return base.startsWith("DSH") ? base : `DSH \xB7 ${base}`;
}
function titleFor(event, detail) {
  if (event.kind === "notice") return noticeTitle(event, detail);
  const kind = event.kind;
  if (detail === "generic") {
    return kind === "turn" ? "DSH \xB7 \u4EFB\u52A1\u5B8C\u6210" : kind === "test" ? "DSH \xB7 \u6D4B\u8BD5\u901A\u77E5" : "DSH \xB7 \u6709\u5F85\u5904\u7406\u63D0\u9192";
  }
  switch (kind) {
    case "approval":
      return "DSH \xB7 \u9700\u8981\u5BA1\u6279";
    case "question":
      return "DSH \xB7 \u9700\u8981\u56DE\u7B54";
    case "plan-review":
      return "DSH \xB7 \u9700\u8981\u786E\u8BA4\u8BA1\u5212";
    case "turn":
      return "DSH \xB7 \u4EFB\u52A1\u5B8C\u6210";
    case "test":
      return "DSH \xB7 \u6D4B\u8BD5\u901A\u77E5";
  }
}
function genericShort(kind) {
  if (kind === "turn") return "DSH \u672C\u8F6E\u4EFB\u52A1\u5B8C\u6210";
  if (kind === "test") return "\u8FD9\u662F\u4E00\u6761\u6D4B\u8BD5\u63A8\u9001";
  if (kind === "notice") return "DSH \u901A\u77E5";
  return "DSH \u6709\u5F85\u5904\u7406\u63D0\u9192";
}
function detailFor(config) {
  return config.notify.detail;
}
function includeSession(event, config) {
  return detailFor(config) !== "generic" && config.privacy.includeSessionTitle && event.sessionTitle !== "";
}
function includeDetail(event, config) {
  return detailFor(config) === "summary" && (config.privacy.includeReason || config.privacy.includeToolName);
}
function cleanOrEmpty(value, max) {
  return cleanText(value, max) ?? "";
}
function buildShort(event, config) {
  const detail = detailFor(config);
  if (event.kind === "notice") {
    if (detail === "generic") return genericShort("notice");
    const parts2 = [];
    if (includeSession(event, config)) parts2.push(event.sessionTitle);
    if (detail === "summary" && config.privacy.includeReason) {
      const body = cleanOrEmpty(event.noticeBody ?? event.noticeTitle, 100);
      if (body !== "") parts2.push(body);
    }
    return parts2.length === 0 ? genericShort("notice") : truncate(parts2.join(" \xB7 "), 100);
  }
  if (detail === "generic" || event.kind === "test") return genericShort(event.kind);
  const parts = [];
  if (includeSession(event, config)) parts.push(event.sessionTitle);
  if (detail === "summary" && config.privacy.includeToolName) {
    const tool = cleanOrEmpty(event.toolName, 60);
    if (tool !== "") parts.push(tool);
  }
  if (detail === "summary" && config.privacy.includeReason) {
    const text = cleanOrEmpty(event.kind === "question" || event.kind === "plan-review" ? event.question : event.reason, 100);
    if (text !== "") parts.push(text);
  }
  if (parts.length === 0) parts.push(genericShort(event.kind));
  return truncate(parts.join(" \xB7 "), 100);
}
function buildScopenUrl(event, config) {
  if (event.kind === "test" || event.sessionId === "") return void 0;
  if (!SESSION_ID_PATTERN2.test(event.sessionId)) return void 0;
  const requestId = event.callId ?? (event.turn === void 0 ? void 0 : String(event.turn));
  const params = [
    ["sessionId", event.sessionId],
    ["kind", event.kind],
    ...requestId === void 0 || requestId === "" ? [] : [["requestId", requestId]],
    ["sc.market", "0"],
    ["sc.fallback", config.serverchan3.fallbackUrl]
  ];
  return `scopen://${config.serverchan3.appPackage}?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}
function linkLine(event, config) {
  const deepLink = buildScopenUrl(event, config);
  const target = deepLink ?? config.serverchan3.fallbackUrl;
  return `[${FALLBACK_LABEL}](${target})`;
}
function buildDesp(event, config) {
  if (event.kind === "test") {
    return `\u8FD9\u662F\u4E00\u6761\u6765\u81EA DeepSeek Harness \u7684\u6D4B\u8BD5\u63A8\u9001\u3002

${linkLine(event, config)}`;
  }
  if (event.kind === "notice") {
    const detail2 = detailFor(config);
    const lines2 = [];
    if (detail2 !== "generic" && includeSession(event, config)) {
      lines2.push(`**\u4F1A\u8BDD**\uFF1A${escapeMarkdown(cleanOrEmpty(event.sessionTitle, 80))}`);
      lines2.push("");
    }
    if (detail2 === "summary" && config.privacy.includeReason) {
      const body = cleanMultiline(event.noticeBody ?? event.noticeTitle, 1e3);
      if (body !== void 0) {
        lines2.push(escapeMarkdown(body));
        lines2.push("");
      }
    }
    if (lines2.length === 0) {
      lines2.push(genericShort("notice"));
      lines2.push("");
    }
    lines2.push(linkLine(event, config));
    return lines2.join("\n");
  }
  const detail = detailFor(config);
  const lines = [];
  if (includeSession(event, config)) {
    lines.push(`**\u4F1A\u8BDD**\uFF1A${escapeMarkdown(cleanOrEmpty(event.sessionTitle, 80))}`);
    lines.push("");
  }
  if (detail === "summary" && includeDetail(event, config)) {
    if (config.privacy.includeToolName && event.toolName !== void 0) {
      const tool = cleanOrEmpty(event.toolName, 60);
      if (tool !== "") lines.push(`**\u5DE5\u5177**\uFF1A${escapeMarkdown(tool)}`);
    }
    if (config.privacy.includeReason) {
      const text = cleanOrEmpty(
        event.kind === "question" || event.kind === "plan-review" ? event.question : event.reason,
        200
      );
      if (text !== "") {
        lines.push(`${event.kind === "question" || event.kind === "plan-review" ? "**\u95EE\u9898**" : "**\u539F\u56E0**"}\uFF1A${escapeMarkdown(text)}`);
      }
    }
    if (event.kind === "turn") lines.push("**\u72B6\u6001**\uFF1A\u672C\u8F6E\u5DF2\u5B8C\u6210");
  } else {
    lines.push(genericShort(event.kind));
  }
  lines.push("");
  lines.push(linkLine(event, config));
  return lines.join("\n");
}
function buildPayload(event, config) {
  const { tags, dropped } = buildTags(event.kind, config.serverchan3.tags);
  const payload = {
    title: titleFor(event, config.notify.detail),
    desp: buildDesp(event, config),
    short: buildShort(event, config)
  };
  const joined = tags.length === 0 ? void 0 : tags.join("|");
  if (joined !== void 0) payload.tags = joined;
  return { payload, droppedTags: dropped };
}
var ServerChanTransport = class {
  deps;
  fetchImpl;
  limiter;
  constructor(deps) {
    this.deps = deps;
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.limiter = deps.limiter ?? new RateLimiter(deps.clock);
  }
  async send(event, signal) {
    const config = this.deps.config;
    const built = buildPayload(event, config);
    if (built.droppedTags.length > 0) {
      this.deps.logger.warn(
        `dsh-mobile-notify: dropped invalid tags: ${built.droppedTags.map((tag) => `"${tag}"`).join(", ")}`
      );
    }
    if (config.transport === "dryRun") {
      this.deps.logger.info(
        `dsh-mobile-notify: dryRun push ${event.kind} ${shortId(event.sessionId)} tags=${built.payload.tags ?? "(none)"}`
      );
      return { ok: true, dryRun: true };
    }
    const sendkey = await this.deps.sendkey();
    if (!isSendkey(sendkey)) {
      return { ok: false, dryRun: false, error: "serverchan3 credentials missing" };
    }
    const uid = uidFromSendkey(sendkey);
    if (uid === void 0) {
      return { ok: false, dryRun: false, error: "serverchan3 uid missing from SendKey" };
    }
    if (!this.limiter.take("push", config.limits.pushPerMinute, 6e4)) {
      this.deps.logger.warn("dsh-mobile-notify: outbound push rate limit reached");
      return { ok: false, dryRun: false, error: "rate_limited" };
    }
    const endpoint = `https://${uid}.push.ft07.com/send/${sendkey}.send`;
    const attempts = config.limits.pushRetries + 1;
    let lastError = "unknown";
    let lastStatus;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (signal.aborted) return { ok: false, dryRun: false, error: "aborted" };
      try {
        const response = await this.post(endpoint, built.payload, signal);
        lastStatus = response.status;
        if (response.ok) {
          const body = await response.text().catch(() => "");
          const code = parseResponseCode(body);
          if (code === void 0 || code === 0) return { ok: true, dryRun: false, status: response.status };
          lastError = `upstream code ${code}`;
        } else {
          lastError = `http ${response.status}`;
        }
        if (!isRetryable(response.status) || attempt + 1 >= attempts) break;
      } catch (error) {
        if (signal.aborted) return { ok: false, dryRun: false, error: "aborted" };
        const message = error instanceof Error ? error.message : "network error";
        lastError = redactSecret(message, sendkey);
      }
      if (attempt + 1 < attempts) await sleep(attempt === 0 ? 500 : 1500);
    }
    this.deps.logger.warn(
      `dsh-mobile-notify: serverchan3 push failed kind=${event.kind} session=${shortId(event.sessionId)} status=${lastStatus ?? "n/a"} error=${lastError}`
    );
    return { ok: false, dryRun: false, status: lastStatus, error: lastError };
  }
  /** Send a generic test push; tags still use the configured test tag. */
  sendTest(signal) {
    const event = {
      eventId: "test",
      kind: "test",
      sessionId: "test",
      sessionTitle: "",
      createdAt: Date.now()
    };
    return this.send(event, signal);
  }
  async post(endpoint, payload, external) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.deps.config.limits.pushTimeoutMs);
    timer.unref?.();
    const onAbort = () => controller.abort();
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onAbort, { once: true });
    try {
      return await this.fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
      external.removeEventListener("abort", onAbort);
    }
  }
};
function parseResponseCode(body) {
  if (body.trim() === "") return void 0;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return void 0;
    const code = parsed.code;
    return typeof code === "number" ? code : void 0;
  } catch {
    return void 0;
  }
}
function isRetryable(status) {
  return status === 429 || status >= 500;
}
function redactSecret(value, secret) {
  if (secret === "") return value;
  return value.split(secret).join("***");
}

// src/host/tool.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
var TITLE_MAX = 60;
var BODY_MAX = 1e3;
var SESSION_ID_PATTERN3 = /^[A-Za-z0-9._:-]{1,128}$/u;
function toolsOf(ctx) {
  const candidate = ctx.get("tools");
  if (typeof candidate !== "object" || candidate === null) return void 0;
  if (typeof candidate.register !== "function") return void 0;
  return candidate;
}
function requireTitle(value) {
  if (typeof value !== "string") throw new Error("title must be a string");
  const raw = value.trim();
  if (raw === "") throw new Error("title must not be empty");
  if (Array.from(raw).length > TITLE_MAX) {
    throw new Error(`title must be at most ${TITLE_MAX} characters`);
  }
  const cleaned = cleanText(raw, TITLE_MAX);
  if (cleaned === void 0) throw new Error("title must not be empty");
  return cleaned;
}
function optionalBody(value) {
  if (value === void 0) return void 0;
  if (typeof value !== "string") throw new Error("body must be a string");
  if (Array.from(value.trim()).length > BODY_MAX) {
    throw new Error(`body must be at most ${BODY_MAX} characters`);
  }
  return cleanMultiline(value, BODY_MAX);
}
function callingSession(agent) {
  if (typeof agent !== "object" || agent === null) return void 0;
  const session = agent.session;
  if (typeof session !== "object" || session === null) return void 0;
  const candidate = session;
  if (typeof candidate.id !== "string" || !SESSION_ID_PATTERN3.test(candidate.id)) return void 0;
  if (typeof candidate.append !== "function") return void 0;
  return candidate;
}
function createNotifyToolDefinition(deps) {
  return defineTool({
    name: "mobile_notify",
    description: 'Queue a notification through the same web-first flow as approval/question reminders: the open page gets the in-page card or browser notification first, and Server\u9171\xB3 is only a fallback. Use it only when the user explicitly asks to be notified, or when the user asked to hear about a long-running result. The title is prefixed with "DSH \xB7"; body line breaks are preserved. The notice follows the configured detail/privacy level, debounce/grace timing, presence/ack, and push rate limits.',
    parameters: {
      title: {
        type: "string",
        required: true,
        description: `Short notification title, at most ${TITLE_MAX} characters. Do not include secrets.`
      },
      body: {
        type: "string",
        description: `Plain-text notification body, at most ${BODY_MAX} characters. Line breaks are preserved. Defaults to the title.`
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          queued: { type: "boolean", required: true }
        }
      },
      render: (args, value) => [{
        type: "text",
        text: value.queued ? `Notification queued through the web-first flow: ${args.title}` : `Notification was not queued: ${args.title}`
      }]
    },
    async execute(args, exec) {
      const title = requireTitle(args.title);
      const body = optionalBody(args.body);
      const session = callingSession(exec.agent);
      const createdAt = deps.clock.now();
      const key = `notice-${createdAt}-${Math.random().toString(36).slice(2, 10)}`;
      const event = {
        eventId: key,
        kind: "notice",
        sessionId: session?.id ?? "",
        callId: key,
        sessionTitle: "",
        noticeTitle: title,
        ...body === void 0 ? {} : { noticeBody: body },
        createdAt,
        oneShot: true
      };
      if (!deps.engine.begin(event)) {
        throw new Error("mobile_notify could not start: notification tool is disabled or already pending");
      }
      try {
        if (session !== void 0) {
          deps.sessionState.appendNotice(session, {
            key,
            title,
            ...body === void 0 ? {} : { body },
            createdAt
          });
        }
      } catch (error) {
        deps.engine.resolve(event);
        throw error;
      }
      return { ok: true, queued: true };
    }
  });
}
function registerNotifyTool(ctx, deps) {
  if (!deps.config.notify.modelTool) return void 0;
  const tools = toolsOf(ctx);
  if (tools === void 0) {
    deps.logger.warn("dsh-mobile-notify: tools service missing; mobile_notify was not registered");
    return void 0;
  }
  try {
    return tools.register(createNotifyToolDefinition(deps));
  } catch (error) {
    deps.logger.warn("dsh-mobile-notify: mobile_notify registration failed", error);
    return void 0;
  }
}

// src/host/session-state.ts
import { appendPluginRecord } from "@deepseek-ai/dsh-session";
var MOBILE_NOTIFY_PROJECTION = "mobileNotify";
var NOTICE_EVENT = "plugin:dsh-mobile-notify/notice";
var NOTICE_CLEAR_EVENT = "plugin:dsh-mobile-notify/clear";
var TURN_DONE_EVENT = "plugin:dsh-mobile-notify/turn-done";
var defaultAppendRecord = appendPluginRecord;
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value, max) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  if (trimmed === "" || Array.from(trimmed).length > max) return void 0;
  return trimmed;
}
function parseNotice(value) {
  if (value === null || value === void 0) return null;
  if (!isRecord4(value)) throw new Error("notice must be an object or null");
  const key = nonEmptyString(value.key, 128);
  const title = nonEmptyString(value.title, 80);
  const createdAt = value.createdAt;
  if (key === void 0) throw new Error("notice.key is invalid");
  if (title === void 0) throw new Error("notice.title is invalid");
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) {
    throw new Error("notice.createdAt is invalid");
  }
  const body = value.body === void 0 ? void 0 : nonEmptyString(value.body, 1200);
  return { key, title, createdAt, ...body === void 0 ? {} : { body } };
}
function parseState(value) {
  if (!isRecord4(value)) throw new Error("mobile state must be an object");
  const notice = parseNotice(value.notice);
  const turnDone = value.turnDone;
  if (turnDone !== null && turnDone !== void 0 && typeof turnDone !== "boolean") {
    throw new Error("mobile state turnDone must be boolean or null");
  }
  return { notice, turnDone: turnDone === true ? true : turnDone === false ? false : null };
}
var stateSchema = { parse: parseState };
function noticeFromEvent(value) {
  return parseNotice(value);
}
function eventTurnDone(value) {
  if (!isRecord4(value)) throw new Error("turn-done event must be an object");
  const turnDone = value.turnDone;
  if (turnDone !== true && turnDone !== false && turnDone !== null) {
    throw new Error("turn-done event must carry boolean or null");
  }
  return turnDone;
}
function createSessionState(ctx, logger, appendRecord = defaultAppendRecord) {
  const candidate = ctx.get("sessionProjections");
  if (typeof candidate !== "object" || candidate === null || typeof candidate.register !== "function") {
    logger.warn("dsh-mobile-notify: sessionProjections missing; notices cannot reach the web UI");
    return {
      appendNotice: () => {
      },
      clearNotice: () => {
      },
      setTurnDone: () => {
      },
      turnDoneFor: () => null,
      status: () => "missing"
    };
  }
  const registry = candidate;
  let handle;
  let status = "registering";
  const ready = registry.register({
    key: MOBILE_NOTIFY_PROJECTION,
    stateSchema,
    init: () => ({ notice: null, turnDone: null }),
    apply: (state, event) => {
      if (event.type === NOTICE_EVENT) {
        return { ...state, notice: noticeFromEvent(event.data) };
      }
      if (event.type === NOTICE_CLEAR_EVENT) {
        const data = isRecord4(event.data) ? event.data : {};
        return state.notice !== null && state.notice.key === data.key ? { ...state, notice: null } : state;
      }
      if (event.type === TURN_DONE_EVENT) {
        return { ...state, turnDone: eventTurnDone(event.data) };
      }
      return state;
    },
    wire: {
      viewSchema: stateSchema,
      view: (state) => state,
      summary: true
    },
    stateVersion: 1
  });
  void ready.then(
    (value) => {
      handle = value;
      status = "ready";
    },
    (error) => {
      status = "error";
      logger.warn("dsh-mobile-notify: session projection registration failed", error);
    }
  );
  return {
    appendNotice: (session, notice) => {
      appendRecord(session, NOTICE_EVENT, notice);
    },
    clearNotice: (session, key) => {
      appendRecord(session, NOTICE_CLEAR_EVENT, { key });
    },
    setTurnDone: (session, turnDone) => {
      appendRecord(session, TURN_DONE_EVENT, { turnDone });
    },
    turnDoneFor: (session) => {
      if (handle === void 0) return null;
      try {
        const state = parseState(handle.stateOf(session));
        return state.turnDone;
      } catch {
        return null;
      }
    },
    status: () => status
  };
}

// src/index.ts
var name = "dsh-mobile-notify";
var inject = ["webServer", "connection", "sessions", "sessionProjections", "tools"];
function apply(ctx, input) {
  const config = resolveConfig(input);
  const clock = systemClock;
  const health2 = {};
  ctx.logger.info(
    `dsh-mobile-notify: transport=${config.transport} tags=${config.serverchan3.tags.enabled ? "on" : "off"} detail=${config.notify.detail}`
  );
  const presence = new PresenceStore(clock);
  const credentials = credentialsOf(ctx);
  const settings = new SettingsService({
    config,
    credentials,
    configEditor: configEditorOf(ctx),
    entry: ctx.fiber?.entry,
    logger: ctx.logger
  });
  const transport = new ServerChanTransport({
    config,
    logger: ctx.logger,
    clock,
    sendkey: () => readSendkey(credentials)
  });
  const sessionState = createSessionState(ctx, ctx.logger);
  const engine = new DecisionEngine({
    config,
    clock,
    presence,
    transport,
    logger: ctx.logger,
    onPushResult: (event, result) => {
      health2.lastPush = {
        at: (/* @__PURE__ */ new Date()).toISOString(),
        ok: result.ok,
        kind: event.kind
      };
    },
    onNoticeEnd: (event) => {
      const session = ctx.sessions.get(event.sessionId);
      if (session === void 0) return;
      sessionState.clearNotice(session, event.callId ?? event.eventId);
    }
  });
  registerEventObservers(ctx, engine, {
    turnDone: (session) => sessionState.turnDoneFor(session) ?? config.notify.turnDone
  });
  registerNotifyTool(ctx, {
    config,
    engine,
    sessionState,
    logger: ctx.logger,
    clock
  });
  ctx.effect(
    () => registerRoutes(
      { webServer: ctx.webServer, connection: ctx.connection },
      {
        config,
        presence,
        engine,
        logger: ctx.logger,
        clock,
        version: "0.3.0",
        health: health2,
        settings,
        sendTest: (signal) => transport.sendTest(signal),
        projectionStatus: () => sessionState.status(),
        setSessionTurnDone: (sessionId, turnDone) => {
          const session = ctx.sessions.get(sessionId);
          if (session === void 0) return false;
          sessionState.setTurnDone(session, turnDone);
          return true;
        }
      }
    ),
    "dsh-mobile-notify: routes"
  );
  ctx.effect(() => {
    const timer = setInterval(() => presence.prune(), 3e4);
    timer.unref?.();
    return () => clearInterval(timer);
  }, "dsh-mobile-notify: presence cleanup");
  ctx.effect(() => () => engine.dispose(), "dsh-mobile-notify: decision engine");
}
export {
  Config,
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
