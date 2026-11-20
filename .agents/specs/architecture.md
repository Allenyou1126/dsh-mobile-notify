# 架构、协议与状态机

> 状态：规格定稿（2026-11-20），尚未实现。
> 接口基线：[plugin-contract.md](../../../dsh-android-shell/.agents/specs/plugin-contract.md) v1；产品取舍：[DECISION.md](../../../DECISION.md)；目标 DSH `0.2.2-rc.5`。
> 本文里的“契约”指 Shell ↔ 本插件的 v1 契约；本文新增的兼容性扩展集中在 §11。

## 1. 组件与数据流

```text
┌────────────────────────── 浏览器 / Android WebView ──────────────────────────┐
│  dsh-mobile-notify Client（本仓库）                                          │
│   ├─ uiSession.sessionStatus（所有会话的 pendingInteraction）                 │
│   ├─ 页内条（shell.bottom） + 浏览器 Notification（页面存活时）               │
│   ├─ presence / ack → POST /mobile/presence, /mobile/ack                     │
│   ├─ GET /mobile/config（客户端开关）                                        │
│   └─ window.__dshMobile.openSession/setForeground                            │
│                                                                             │
│  Android Shell（另一仓库）只负责 WebView、登录、scopen extras、JS 桥调用      │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ 同一 HTTPS 页面 / DSH Cookie
┌──────────────────────────────────┴──────────────────────────────────────────┐
│ DSH Web 进程 + dsh-mobile-notify Host（本仓库）                              │
│   ├─ 观察 approval/request、user-questions/request、session/event            │
│   ├─ 归一化 + debounce + pending store + resolved 清理                       │
│   ├─ presence 表（web/shell，TTL）+ ack 表                                   │
│   ├─ 回退决策：Web 未 delivered + 手机不在前台 → Server酱³                    │
│   └─ /mobile/bootstrap、/mobile/config、/mobile/presence、/mobile/ack、      │
│      /mobile/push/test、/mobile/health                                      │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTPS POST（服务端 SendKey）
                     ┌─────────────┴──────────────┐
                     ▼                            ▼
              Server酱³ API                （无 FCM / MiPush SDK /
              → Server酱³ App（MiPush）       无轮询 / 无 SSE / 无长连接）
              → scopen://top.allenyou.dsh
              → Android Shell 的 MainActivity
```

职责边界：

| 组件 | 负责 | 不负责 |
|---|---|---|
| Host（本仓库） | 事件观察/归一化、pending、presence/ack、回退决策、Server酱³、HTTP 路由、配置/日志 | 不改审批结果、不读工具参数全文、不持设备 token |
| Client（本仓库） | 全量 pending 观察、页内条、Web Notification、presence/ack、JS 桥、设置行 | 不直接发 Server酱³、不持 SendKey、不做审批动作 |
| Android Shell（另一仓库） | WebView、bootstrap、Cookie、`scopen` extras、文件/返回/Insets | 不发 HTTP presence/ack、不做 Web 通知、不实现 Host |
| Server酱³ App | MiPush 收信、展示通知、按 `scopen` 拉起 DSH | 不保证 MIUI 关联启动放行、不是 DSH 的通知图标 |
| oauth2-proxy/Zitadel | `/mobile/*` 的外部认证、DSH 浏览器 Cookie 的登录流程 | 不参与 presence/ack 语义 |

## 2. 术语与常量

| 名称 | 值/含义 |
|---|---|
| `kind` | `approval` / `question` / `plan-review` / `turn` |
| `sessionId` | DSH 会话 id；推送深链只放这个标识 |
| `callId` | DSH 工具调用 id；用于更精确的关联/深链 `requestId`，可缺省 |
| `clientId` | 页面级 UUID，存 `sessionStorage`；刷新复用、关闭标签失效 |
| `baseKey` | `sessionId + ':' + kind`，有 `callId` 时加 `':' + callId`；Host 关联/去重的主键 |
| `debounceMs` | 1500ms（自动审批去抖） |
| `graceMs` | 4000ms（等 Web ack 的窗口） |
| `settleMs` | 500ms（Client 显示前的短去抖，减少自动审批闪烁） |
| `webTtlMs` | 120000ms（web presence 的“是否还有页面可等 ack”） |
| `shellTtlMs` | 15000ms（android-shell 前台判定） |
| `heartbeatMs` | 10000ms（页面可见时的 presence 心跳） |
| `bodyBytes` | 2048（presence/ack 请求体上限） |
| `inPageCountsAsDelivered` | 页面可见+聚焦时，页内条显示即算 delivered；默认 `true` |

时间基准：

- presence/ack 的 TTL 用 **Host 收到请求的时间**，不信任客户端 `at`；`at` 只用于日志/诊断。
- 所有时间比较用注入的 `Clock`；测试不需要真实等待。
- 所有 timer `.unref()`，插件 dispose 时清理。

## 3. Host 事件流水线

### 3.1 事件源

| 事件 | 观察方式 | 归一化 | 默认推送 |
|---|---|---|---|
| `approval/request` | waterfall，`prepend: true`，调用 `next()` | `kind=approval`，`sessionId=req.agent.id`，`callId=req.callId?`，`toolName`，`reason=req.reason ?? req.displayReason?.en` | 是（`notify.approval`） |
| `user-questions/request` | waterfall，`prepend: true`，调用 `next()` | `kind=question`；任一问题 `intent.kind === 'plan-review'` 时 `kind=plan-review`；`sessionId=request.agent?.id`；`callId=request.wait?.callId`；摘要取第一个 `question` | 是（`question` / `planReview`） |
| `session/event` 的 `turn/end` | emit 监听 | `kind=turn`，`sessionId=session.id`，`turn=event.data.turn`，`reason=event.data.reason.kind` | 否（`turnDone=false`） |
| resolved | `next()` 返回/抛错 | 删除 pending、取消未发推送 | — |

约束：

- 没有 `agent` 的 `user-questions/request`（非会话级请求）**跳过 Host 推送**；仍调用 `next()`，不影响回答。Client 端仍可能看到 pending（来自 DSH 自身），但没有 Host 记录可关联。
- 审批/提问的观察者**必须**调用 `next()`；不能吞掉事件、不能改变返回值。
- 观察者里的任何异常都必须被捕获；不能冒泡到 waterfall。参考实现骨架：

  ```ts
  ctx.on('approval/request', async (req, next) => {
    try { tracker.beginApproval(req) } catch (error) { log(error) }
    try {
      return await next()
    } finally {
      try { tracker.resolve('approval', req) } catch (error) { log(error) }
    }
  }, true)
  ```

  `beginApproval` 只创建记录和 timer，不做网络/await；`resolve` 只做清理。推送在 timer 回调里异步启动，不阻塞 `next()` 的返回。

- `session/event` 的监听器只做同步判断/调度，绝不 await 推送；turn 事件不能拖慢会话日志。

### 3.2 归一化记录

```ts
interface NormalizedEvent {
  readonly eventId: string          // 内部唯一，仅日志/测试；不发给 Client
  readonly kind: 'approval' | 'question' | 'plan-review' | 'turn'
  readonly sessionId: string
  readonly callId?: string
  readonly sessionTitle: string     // 取不到时用短 sessionId
  readonly toolName?: string
  readonly reason?: string          // 已截断，去换行/控制字符
  readonly question?: string        // 第一个问题，已截断
  readonly turn?: number
  readonly createdAt: number
}
```

- 会话标题：优先 `ctx.get('sessionTitle')?.get(ctx.sessions.get(sessionId))?.title`；服务缺失/无标题时用 `sessionId` 前 8 位。不要为了标题读整个会话日志。
- 文本清洗：去换行/控制字符，压缩空白，按字段截断（标题 ≤80、原因/问题 ≤200、`short` 总计 ≤100）。Server酱³ 侧再做最终截断。
- 不保存工具参数、代码块、完整审批内容；`ApprovalRequestEvent` 本身也不含参数。

### 3.3 去抖与 resolved

```text
t0 事件到达
  ├─ 创建 PendingRecord（state=debouncing）
  ├─ 立即调用 next()（不等待）
  └─ t0 + debounceMs 时 → evaluate(record)

resolved（next 返回/抛错/abort）：
  ├─ state=resolved；从 pending map 删除
  ├─ 清除 debounce/grace timer
  └─ 若推送尚未发出 → abort；已发出 → 不撤回
```

- 自动审批（`dsh-experimental-auto-review`）通常在 1s 内返回；此时 timer 被清除，不推送。
- `next()` 抛错（取消、异常）也视为 resolved；清理后把错误继续抛给调用方。
- 同一 `baseKey` 在已有活动记录时再次到达：视为重复/替换，**不重置 debounce、不重复推送**；记录 debug 日志。若旧记录已 resolved，新事件创建新记录（正常推送）。
- resolved 后不保留推送历史；DSH 重启/插件重载也不补推（符合 DECISION）。

### 3.4 turn/end（可选）

- 仅 `notify.turnDone=true` 时创建 `kind=turn` 记录；默认 false。
- `baseKey = sessionId + ':turn'`；同一会话在用户读掉（`completionUnread` 变 false）之前最多一条。
- 不推送子代理：用会话元数据里的 `origin`/父会话信息判断。取不到可靠判定时，turn-done **保守不推**（审批/提问不受影响）；默认配置本来关闭，漏推只影响“完成提醒”，不影响可回答性。
- turn 记录的 ack 由 Client 观察 `sessionStatus.completionUnread` 变化上报 `kind=turn`；Host 只需在窗口内等 delivered。若 Client 未实现，回退为“无 web 就推、有 web 超时推”；不会阻塞审批链。

## 4. Pending store

### 4.1 记录

```ts
interface PendingRecord {
  readonly event: NormalizedEvent
  readonly baseKey: string
  state: 'debouncing' | 'waiting-ack' | 'pushing' | 'pushed' | 'suppressed' | 'resolved'
  readonly acks: Map<string, AckRecord>       // clientId → 最近一次 ack
  expectedWebClientIds: Set<string>            // evaluate 时的 live web 集合
  debounceTimer?: Timer
  graceTimer?: Timer
  pushAbort?: AbortController
  pushStartedAt?: number
  pushResult?: 'ok' | 'failed' | 'dry-run'
}
```

- `pending` 以 `baseKey` 索引；同一时刻最多一条活动记录。
- 记录只存在内存；插件 dispose 全部清除并 abort 未完成推送。
- 不保存完整请求体/工具参数。

### 4.2 关联键

- Host 关联事件与 ack：`sessionId + kind (+ callId)`。
- Client 的 `wait.key` 只用于客户端去重和日志（契约要求），不假设它等于 Host 的 request id。
- ack 携带可选 `callId`（本仓库扩展，见 §11），Host 优先用 `sessionId+kind+callId` 查找；没有则用 `sessionId+kind`。
- 同一会话同一时刻通常只有一个待处理；若同一 `sessionId+kind` 且无 `callId` 的两条重叠，只跟踪最新一条并记录 warning（DSH Client 也只投影最高优先级的一条）。

### 4.3 去重与单飞

- 一个 `baseKey` 同时只有一个推送在途；重复事件不重复推。
- resolved 后删除记录；新的同 key 事件是新的记录。
- 推送失败重试在适配器内部完成，不重入决策状态机。
- Client 通知用 `${sessionId}:${wait.key}` 去重，跨重连稳定；pending 消失时关闭对应通知。

## 5. presence 与 ack

### 5.1 presence 记录

```ts
interface PresenceRecord {
  clientId: string
  platform: 'web' | 'android-shell'
  visibility: 'visible' | 'hidden'
  focused: boolean
  notification: 'granted' | 'denied' | 'default' | 'unsupported'
  activeSessionId?: string
  receivedAt: number       // Host 时钟；TTL 以此为准
  clientAt?: string        // 客户端时间，仅日志
}
```

- 以 `clientId` 覆盖；页面刷新保留 `clientId`（`sessionStorage`）。
- TTL：`web=120s`、`android-shell=15s`；过期只视为离线，不立即删除（下一次上报覆盖，清理任务回收）。
- 清理任务每 30s 跑一次（可配置内部常量）；`ctx.effect` 清理 timer。
- `phoneForeground()`：存在未过期的 `android-shell` 且 `visibility=visible` 且 `focused=true`。
- `liveWebClients()`：未过期的 `web` 记录（不管 visible/focused）；用于“是否等 ack”。
- `notification` 只用于诊断/优化，不直接决定推送；真正的 delivered 以 ack 为准。

### 5.2 ack 记录

```ts
interface AckRecord {
  clientId: string
  platform: 'web' | 'android-shell'
  sessionId: string
  kind: Kind
  key: string
  callId?: string
  delivered: boolean
  via: 'in-page' | 'web-notification' | 'none'
  reason: 'none' | 'permission-denied' | 'unsupported' | 'constructor-error' | 'hidden-no-notification'
  receivedAt: number
}
```

- ack 是“是否还需要推手机”的信号，不改变审批/回答结果。
- 重复 ack 幂等：同一 clientId 以最新一条为准；`delivered=true` 一旦出现即抑制。
- ack 早于 debounce 到达是**正常路径**（Client 500ms settle + Host 1500ms debounce）：存在记录的 `acks` 里，等 evaluate 时使用；不能因为“还没开始等”就丢弃。
- 找不到活动记录（已 resolved/未知）仍返回 204，只记 debug；不创建 pending。

### 5.3 竞态

| 竞态 | 处理 |
|---|---|
| ack true 在 debounce 前到达 | 存起来；evaluate 时直接抑制 |
| 全部 ack false 在 grace 内到达 | 立即推（不必等满 4s） |
| 部分客户端不 ack | 到 `graceMs` 超时推 |
| 手机在 grace 内回到前台，且 `inPage=true` | presence 更新触发取消尚未发出的推送 |
| 手机在前台但 `inPage=false` | 不提前抑制、不取消；页内条不存在，应按 ack/超时推 |
| 页面在 ack 前关闭 | 无 ack；grace 超时推（若手机不在前台） |
| resolved 与推送同时 | 以状态机先到者为准；resolved 后 abort 未发出的请求；已发出的不撤回 |
| 新 web 客户端在 grace 中出现 | 不计入 `expectedWebClientIds`；若它 ack true 仍可抑制；否则超时推 |
| 多事件并发 | 每个 `baseKey` 独立 timer/状态；互不影响 |

## 6. 回退状态机

```text
onEvent(event):
  if !enabled(event.kind): return
  if pending[baseKey] exists: return            # 重复
  record = create(event)                         # debouncing
  schedule(debounceMs):
    if record.state != debouncing: return
    if config.notify.inPage and phoneForeground():
      record.state = suppressed; return           # 页内已可见，不推手机
    if liveWebClients().isEmpty():
      push(record); return                        # 没有页面可提醒
    record.expectedWebClientIds = liveWebClients().ids
    record.state = waiting-ack
    schedule(graceMs):
      if record.state != waiting-ack: return
      if config.notify.inPage and phoneForeground(): record.state = suppressed; return
      if anyAckDelivered(record): record.state = suppressed; return
      push(record)
    # ack 到达时（debounce 后、grace 内）：
    #   delivered=true → suppressed；全部 expected 都 false → push 立即
  end
```

时间线示例：

```text
t0        事件到达，开始 debounce
t0+0.5s   Client 显示页内条 → ack delivered=true（可能早于 debounce）
t0+1.5s   debounce 结束：看到 ack true → 不推
          或：没有 ack → 开始 grace 4s
t0+5.5s   grace 超时：手机不在前台 → 推 Server酱³
t0+?      手机回到前台（grace 内，且 inPage=true）→ 取消未发推送
```

补充规则：

- 手机在 evaluate 时就在前台且 `notify.inPage=true`：直接 suppressed，不进入 grace；之后手机退到后台也不补推（用户已看到页内提示）。这是 v1 的明确取舍。
- `notify.inPage=false` 时不做“手机前台”提前抑制：此时页内条不存在，手机前台也无法通过页内条提醒，应继续走 ack/grace；手机没有可用的系统通知时 ack false，Host 会推 Server酱³。
- `graceMs=0` 仅用于测试/调试；等价于立即超时推。
- `debounceMs=0` 也允许（测试），但生产默认 1500。
- 没有 android-shell presence 时 `phoneForeground=false`；没有 web presence 时直接推。
- `inPageCountsAsDelivered=true` 只在 `notify.inPage=true` 时有意义；`inPage=false` 时 Client 不会用页内条作为 delivered。
- 推送是异步单飞；push 失败只记录，不重入状态机、不阻塞审批。
- `resolved` 在任何状态都清理 timer、删除记录；`pushAbort` 用于中止尚未完成的 HTTP 请求。

## 7. HTTP API

### 7.1 通用

- 全部 exact route：`ctx.webServer.register({ kind: 'exact', path, handler })`。
- 响应头：`Cache-Control: no-store`；JSON 接口 `Content-Type: application/json; charset=utf-8`；不设 CORS。
- 认证（除 bootstrap）：`requestRejection` → `admit`；失败返回 401/403，不读 body 之外的状态。
- 方法不符：405 + `Allow`。
- `presence`/`ack` 请求体：`application/json`，≤2KB，JSON 对象；否则 415/413/400。`push/test` 接受空 body 或 `{}`；GET 路由无 body。
- 错误体：

  ```json
  { "error": "invalid_request", "message": "optional human text" }
  ```

  不返回内部堆栈、上游响应体、SendKey、完整 sessionId。
- 速率限制：clientId 120/min；IP 粗粒度上限（默认 240/min，内部常量）；超限 429 + `Retry-After: 60`。
- 所有 handler 用 try/catch 包住；意外错误 → 500 + 通用文案，日志记录错误摘要。

### 7.2 `GET /mobile/bootstrap`

- 认证：依赖外部 oauth2-proxy（不在插件内校验 DSH Cookie；DSH 端口只绑 loopback）。
- 行为：`302`，`Location: ctx.connection.authenticatedUrl(config.publicBase)`。
- 头：`Cache-Control: no-store`、`Referrer-Policy: no-referrer`。
- 不记录 token；不缓存；不拼 query。
- 失败：`authenticatedUrl` 抛错 → 500 通用文案，日志记录原因（不含 token）。
- **部署硬前提**：此路由在公网必须被 oauth2-proxy 保护；否则等同于绕过登录。

### 7.3 `GET /mobile/config`（本仓库扩展）

- 认证：同 presence。
- 返回客户端需要的非敏感开关；不含 transport、SendKey、uid、路径、会话数据。

  ```json
  {
    "contract": 1,
    "client": {
      "inPage": true,
      "webNotification": true,
      "inPageCountsAsDelivered": true,
      "settleMs": 500,
      "detail": "summary",
      "includeSessionTitle": true,
      "includeReason": true,
      "includeToolName": true
    }
  }
  ```

- `Cache-Control: no-store`；不允许 POST。
- Client 拉取失败时使用与 Host 默认一致的默认值（见 §9.2）；不因此阻塞页面。

### 7.4 `POST /mobile/presence`

请求：

```json
{
  "contract": 1,
  "clientId": "b1f0c2d4-...",
  "platform": "web",
  "visibility": "visible",
  "focused": true,
  "notification": "granted",
  "activeSessionId": "optional",
  "at": "2026-11-20T22:50:00+08:00"
}
```

- 必填：`contract`、`clientId`、`platform`、`visibility`、`focused`、`notification`、`at`；`activeSessionId` 可选。
- 校验：`clientId` 1–128、`sessionId` 若存在 1–128/白名单字符；枚举严格；未知字段忽略。
- 成功：`204 No Content`。
- 失败：`400/401/403/413/415/429`。
- `at` 只存日志；TTL 用收到时间。

### 7.5 `POST /mobile/ack`

请求：

```json
{
  "contract": 1,
  "clientId": "b1f0c2d4-...",
  "platform": "android-shell",
  "sessionId": "01J...",
  "kind": "approval",
  "key": "client-wait-key",
  "callId": "optional-tool-call-id",
  "delivered": true,
  "via": "in-page",
  "reason": "none",
  "at": "2026-11-20T22:50:02+08:00"
}
```

- 必填同上；`callId` 是本仓库的**可选扩展**（契约 v1 没有；旧实现可忽略）。
- `kind`：`approval` / `question` / `plan-review` / `turn`；`via`：`in-page` / `web-notification` / `none`；`reason`：见 §5.2。
- 成功：`204`；重复/未知记录也 204（幂等）。
- `delivered=true` 后同一 `baseKey` 的推送立即抑制；已发出的不撤回。
- 不改变审批/回答本身。

### 7.6 `POST /mobile/push/test`

- 认证：同 presence；无请求体或空 JSON 对象 `{}`（有 body 时仍受 §7.1 的大小/类型限制）。
- 作用：设置行“发送测试推送”；内容通用，不含真实会话/审批。
- 走当前 transport：`dryRun` → 只记录脱敏 payload；`serverchan3` → 真发。
- 成功：`202 { "ok": true, "dryRun": <boolean> }`；上游失败：`502 { "ok": false, "error": "upstream_failed" }`；限流：429。
- 不写 pending、不影响回退状态机。

### 7.7 `GET /mobile/health`

- 认证：同 presence（**不走 loopback 放行**；理由见 [tech-stack.md](tech-stack.md) §4.1）。
- 返回：

  ```json
  {
    "ok": true,
    "contract": 1,
    "version": "0.1.0",
    "transport": "dryRun",
    "pending": 1,
    "presence": { "web": 1, "androidShell": 0 },
    "lastPush": { "at": "2026-11-20T22:50:05+08:00", "ok": true, "kind": "approval" }
  }
  ```

- 不含 SendKey/uid/publicBase、会话标题/原因等敏感配置。
- `transport` 只报枚举；`lastPush` 可为 null。

## 8. Server酱³ 适配器

### 8.1 配置

```ts
interface ServerChan3Config {
  uid?: string           // 数字；缺省时从 sendkey 解析
  sendkey: string        // sctp...；只在 Host
  appPackage: string     // top.allenyou.dsh
  fallbackUrl: string    // 默认 publicBase
}
```

- 校验：`sendkey` 匹配 `^sctp\d+t[A-Za-z0-9_-]+$`（只允许 URL 安全字符；以实际 SendKey 为准，若官方格式含其它字符，调整正则并补测试）；`uid` 数字；两者解析结果不一致 → 配置错误（不静默用错）。
- 端点：`POST https://${uid}.push.ft07.com/send/${sendkey}.send`；不拼接 query，不记录完整 URL。
- `transport=dryRun` 时不要求凭据；`transport=serverchan3` 缺凭据 → 插件加载失败。
- 不把 SendKey 放进 `/mobile/config`、health、日志、通知或异常消息。

### 8.2 请求

```json
{
  "title": "DSH · 需要审批",
  "desp": "**会话**：重构数据库\n\n**审批**：bash 需要批准\n**原因**：要删除临时文件\n\n[打开 DSH 处理](scopen://top.allenyou.dsh?sessionId=abc&kind=approval&requestId=call1&sc.market=0&sc.fallback=https%3A%2F%2Fdsh.allenyou.top%2F)",
  "short": "重构数据库 · bash · 要删除临时文件",
  "tags": "dsh|approval"
}
```

- `Content-Type: application/json`；`AbortSignal.timeout(pushTimeoutMs)`（默认 8000）。
- 成功判定：HTTP 2xx 且（若响应 JSON 有 `code`）`code === 0`；否则失败。
- 超时/网络/5xx/429：最多重试 `pushRetries`（默认 2，总尝试 3），退避 500ms/1500ms；4xx 不重试。
- 失败：写日志（状态码/错误码/脱敏消息），返回失败；不影响审批。

### 8.3 内容与隐私档位

| `detail` | 标题 | `short` | `desp` |
|---|---|---|---|
| `summary`（默认） | `DSH · 需要审批/回答/确认计划/任务完成` | 会话标题 + 工具名/问题摘要 + 原因（截断 100） | 会话、审批/问题、原因/摘要 + 链接 |
| `title` | 同上 | 只含会话标题（无工具/原因） | 会话 + 通用说明 + 链接 |
| `generic` | `DSH · 有待处理提醒` / `DSH · 任务完成` | 固定通用文案 | 通用文案 + 链接（不含会话名/原因） |

- `privacy.includeSessionTitle=false` 时，即使 `detail=summary` 也不显示会话标题；`includeReason/includeToolName` 同理。`generic` 优先级最高。
- 文本先做：去换行/控制字符、压缩空白、截断；Markdown 值不做富文本渲染，避免链接/强调注入。
- 不发送代码块、完整工具参数、审批全文、问题选项全文；问题只取第一个 `question` 文本。
- `turn`：默认不推送；开启后只发“任务完成 + 会话标题”（按 privacy），不含最终答案正文。
- 锁屏详情由 Server酱³ App 控制，插件无法强制隐藏；敏感时用 `detail=generic`。

### 8.4 `scopen` 链接构造

```text
scopen://<appPackage>?sessionId=<enc>&kind=<enc>[&requestId=<enc>]&sc.market=0&sc.fallback=<enc>
```

- 每个值 `encodeURIComponent`；不用 `URLSearchParams`（空格会变 `+`）。
- 链接必须是**一整行**；任何换行都会破坏 markdown。
- `sessionId` 必须匹配 `^[A-Za-z0-9._:-]{1,128}$`；不合法则不生成深链，改用 `fallbackUrl` 作为链接并记 warning。
- `requestId` 用 `callId`（审批/提问）或 `turn`（turn-done）；可缺省。
- `sc.market=0` 固定；`sc.fallback` 固定指向 `fallbackUrl`；不设 `sc.confirm`（默认 1，白名单后可被 Server酱³ 忽略）。
- 不放 token/Cookie/SendKey/完整参数；`sc.` 前缀是 Server酱³ 保留键，不当作 extras。

### 8.5 dryRun 与测试

- `dryRun`：构造 payload、做与真实发送相同的校验/截断，但不发请求；日志只记录 `kind`、`sessionId` 短前缀、字段是否包含原因/标题，不记录完整 `desp`。
- `/mobile/push/test` 在 `dryRun` 下返回 `202 { ok: true, dryRun: true }`；在 serverchan3 下真发并返回结果。
- 测试推送不进入 pending/去重；可以更新 lastPush（用于 health），但不参与回退判断。

## 9. 配置 schema

### 9.1 TypeScript 形态

```ts
interface Config {
  publicBase: string
  transport: 'dryRun' | 'serverchan3'
  serverchan3?: {
    uid?: string
    sendkey?: string
    appPackage: string
    fallbackUrl?: string
  }
  notify: {
    approval: boolean
    question: boolean
    planReview: boolean
    turnDone: boolean
    debounceMs: number
    graceMs: number
    settleMs: number
    detail: 'summary' | 'title' | 'generic'
    inPage: boolean
    webNotification: boolean
    inPageCountsAsDelivered: boolean
  }
  privacy: {
    includeSessionTitle: boolean
    includeReason: boolean
    includeToolName: boolean
  }
  limits: {
    bodyBytes: number
    ratePerMinute: number
    pushPerMinute: number
    pushTimeoutMs: number
    pushRetries: number
  }
}
```

### 9.2 默认值与校验

| 字段 | 默认 | 约束 |
|---|---|---|
| `publicBase` | 无（必填） | http/https URL；无 query/hash；规范化尾斜杠；生产必须 https |
| `transport` | `dryRun` | 枚举；`serverchan3` 时凭据必填 |
| `serverchan3.uid` | 由 sendkey 解析 | 数字；与 sendkey 不一致则报错 |
| `serverchan3.sendkey` | 无（serverchan3 时必填） | `sctp...`；仅 URL 安全字符 |
| `serverchan3.appPackage` | `top.allenyou.dsh` | 包名正则 |
| `serverchan3.fallbackUrl` | `publicBase` | http/https URL |
| `notify.approval/question/planReview` | `true` | boolean |
| `notify.turnDone` | `false` | boolean |
| `notify.debounceMs` | 1500 | 0–10000 整数 |
| `notify.graceMs` | 4000 | 0–30000 整数 |
| `notify.settleMs` | 500 | 0–2000 整数 |
| `notify.detail` | `summary` | 枚举 |
| `notify.inPage/webNotification/inPageCountsAsDelivered` | `true` | boolean |
| `privacy.*` | `true` | boolean |
| `limits.bodyBytes` | 2048 | 512–2048（契约上限 2KB） |
| `limits.ratePerMinute` | 120 | 10–600 |
| `limits.pushPerMinute` | 50 | 1–50 |
| `limits.pushTimeoutMs` | 8000 | 1000–30000 |
| `limits.pushRetries` | 2 | 0–3 |

未知字段：忽略（Cordis schema 默认行为）；不因未知字段失败。

### 9.3 配置示例

```yaml
# profile 的 cordis.patch.yml（覆盖 bundle 默认行）
- insert:
    - id: dsh-mobile-notify
      name: 'dsh-mobile-notify'
      config:
        publicBase: 'https://dsh.allenyou.top/'
        transport: 'serverchan3'          # 首次联调先用 dryRun
        serverchan3:
          uid: '123'
          sendkey: 'sctp123tREDACTED'    # 不提交真实值
          appPackage: 'top.allenyou.dsh'
          fallbackUrl: 'https://dsh.allenyou.top/'
        notify:
          approval: true
          question: true
          planReview: true
          turnDone: false
          debounceMs: 1500
          graceMs: 4000
          settleMs: 500
          detail: 'summary'
          inPage: true
          webNotification: true
          inPageCountsAsDelivered: true
        privacy:
          includeSessionTitle: true
          includeReason: true
          includeToolName: true
        limits:
          bodyBytes: 2048
          ratePerMinute: 120
          pushPerMinute: 50
          pushTimeoutMs: 8000
          pushRetries: 2
```

## 10. Client

### 10.1 启动顺序

```text
apply(ctx)
  1. 解析 platform：window.__DSH_SHELL__ 或 UA 后缀 DSHAndroidShell/ → android-shell；否则 web
  2. clientId = sessionStorage['dsh-mobile-notify:clientId'] ?? crypto.randomUUID()
     （sessionStorage/randomUUID 不可用时退回内存 id + 时间戳随机串）
  3. 注册 locale（zh/en）
  4. 注入 window.__dshMobile（尽早；Shell 的 scopen 可能已在排队）
  5. 异步拉 /mobile/config（失败用默认）
  6. 订阅 ctx.uiSession.sessionStatus
  7. 注册 shell.bottom 页内条 + settings.general.item 设置行
  8. 发送首个 presence；启动可见时的 10s 心跳
```

- 任何一步失败都不得让页面崩溃；记录 console/日志，继续可用的部分。
- `window.__dshMobile` 若已存在（另一个插件？）不要覆盖；记录 warning。正常只有本插件注入。
- 页面刷新/重连后重新走启动；`clientId` 复用；通知去重状态从 pending 当前值重建，不重放历史。

### 10.2 pending 观察与去抖

- 数据源：`ctx.uiSession.sessionStatus.getSnapshot()`，每个会话一行；只关心 `row.pendingInteraction`。
- 对每个 `wait`：
  - `key = ${sessionId}:${wait.key}`；`kind = wait.kind`；`callId = wait.callId?`。
  - 若 `notified` 已含该 key → 跳过。
  - 启动 `settleMs` timer；期间 pending 消失 → 取消，不展示、不 ack。
  - timer 到期且仍 pending → 展示页内条/尝试通知 → ack → 标记 `notified`。
- pending 消失时：关闭对应 Notification，删除 `notified` 标记；若用户已在 DSH 回答，Host 也会 resolved。
- 多标签：每个标签独立观察；`clientId` 不同；任一 delivered true 抑制 Host 推送。
- 子代理：审批/提问照常展示；turn-done 由 Host 默认关闭，Client 不主动为子代理创建完成提醒。

### 10.3 页内条（`shell.bottom`）

- 注册：`ctx.slots.inject('shell.bottom', () => ctx.slots.register({ name: 'shell.bottom', id: 'dsh-mobile-notify', locale: NS, order: 40 }, Banner))`。
- 内容：最多 3 条 pending 会话；每行显示会话标题 + 事件类型/摘要；点击打开会话；更多显示 `+N`。
- 高度：仅在有 pending 时渲染；空时返回 `null`，不预留高度。
- 样式：内联 `CSSProperties` + DSH 主题变量；不硬编码亮/暗色；`role="status"`、`aria-live="polite"`；按钮可键盘操作。
- `notify.inPage=false` 时不渲染；其 ack 走系统通知或 false。
- 若 `shell.bottom` 已被其它插件占用或注册抛错：记录 warning，跳过页内条，继续 Web Notification/回退；不抢占、不覆盖。
- 点击只导航，不执行审批/回答；打开后由 DSH 自身的卡片处理。
- 页内条在**真正挂载后**回调 controller；只有该回调成功才 ack `via=in-page`。若组件挂载/槽注册失败，按“页内条未显示”处理，继续尝试系统通知或 ack false。
- 标准 DSH Web 组合提供 `shell.bottom`；若被其它插件占用/注册失败，记录 error。Host 的“手机前台提前抑制”假设页内条可用，因此这是不支持的组合错误，应修复插槽冲突，不要静默假装已提醒。

### 10.4 浏览器系统通知

- 条件：`webNotification=true`、`typeof Notification !== 'undefined'`、`Notification.permission === 'granted'`。
- 展示时机：
  - 页面 `visible && focused` 且 `inPageCountsAsDelivered=true`：页内条即可，**不弹**系统通知；
  - 其他情况（隐藏/未聚焦，或严格模式）：尝试 `new Notification(title, { body, tag })`。
- 选项：只传 `body`/`tag`；**不设 `requireInteraction`**（KDE/Plasma 会强制常驻，见旧插件的教训）；不设 icon，避免依赖构建资源。
- `tag`：稳定的 `${sessionId}:${kind}:${wait.key}`；过长时截断/哈希，保证去重。
- 点击：`window.focus()` → `ctx.uiWorkspace.openSession(sessionId)` → `notification.close()`。
- pending 消失：关闭对应 Notification（若仍存在）。
- 失败：捕获构造异常，ack `delivered=false` + `constructor-error`；权限拒绝 → `permission-denied`；API 缺失 → `unsupported`；配置关闭 → `hidden-no-notification`。

### 10.5 ack 判定

| 页面状态 | 页内条 | 系统通知 | delivered / via |
|---|---|---|---|
| visible && focused | 实际挂载后显示 | 不弹（默认） | true / `in-page` |
| visible && focused，`inPage=false` 或严格模式 | 不显示 | 尝试 | 成功 true/`web-notification`；失败 false/`none` |
| hidden 或未聚焦 | 不显示 | 尝试 | 成功 true/`web-notification`；失败 false/`none` |
| 任意 | 配置关闭且系统通知关闭/失败 | 不弹 | false / `none` + reason |
| 页面关闭/JS 挂起 | — | — | 无 ack；Host 超时 |

- ack 立即发；失败可重试一次（500ms 后），仍失败则放弃；Host 超时会补推（宁可多推不漏）。
- `inPageCountsAsDelivered=false` 时，即使页面可见+聚焦，也要系统通知成功才算 delivered。
- ack 的 `contract=1`；`callId` 有则带；`key` 用 `wait.key`；`at` 用客户端时间。

### 10.6 presence 发送

- 内容：`contract=1`、`clientId`、`platform`、`visibility`、`focused`、`notification`、`at`；`activeSessionId` v1 可省略（避免依赖未验证的 current API）。
- 触发：启动、`visibilitychange`、`focus`/`blur`、Shell 的 `setForeground`、可见时每 10s。
- 页面隐藏：立即发一次，停止心跳；页面恢复可见：立即发一次并恢复心跳。
- 发送合并：同一时刻最多一个 presence 请求在途；状态变化时标记 dirty，完成后发最新状态，避免慢网堆积。
- 失败：静默记录（console/debug）；下一次触发/心跳重试；不重试风暴。
- 页面卸载：尽力 `fetch(..., { keepalive: true })` 发一次 hidden；不保证送达，Host TTL 兜底。

### 10.7 JS 桥

```ts
interface DshMobileBridge {
  openSession(sessionId: string): boolean
  setForeground(foreground: boolean): void
}
```

- 校验 `sessionId` 长度/字符集；不合法返回 false，不导航。
- `openSession`：
  - 会话在 `ctx.sessions.list` 中 → `ctx.uiWorkspace.openSession(sessionId)`，返回 true；
  - 不在列表 → 接受请求并每 300ms 重试，最多 ~5s（同步 API 立即返回 true，表示“已接受、导航待完成”）；仍找不到 → 页内条显示“会话暂不可用”；不抛异常。
  - 非法 `sessionId`/桥不可用 → 返回 false，不导航。
  - 不执行审批/回答；只导航。
- `setForeground`：幂等；更新本地 `focused` 状态并立即发 presence；不阻塞。
- 与 `visibilitychange`/`focus` 双通道：以最后一次事件为准；Host 以 TTL 兜底。
- 清理：仅当 `window.__dshMobile` 仍是本插件注入的对象时删除；不覆盖其他全局。
- `window.__DSH_SHELL__` 只读；读取 `{ version, contract }` 用于诊断，不修改。

### 10.8 设置行

- 槽：`settings.general.item`，id `dsh-mobile-notify`，locale NS，order 建议 30（与旧插件相近）。
- 内容：
  - 浏览器通知权限状态（granted/denied/default/unsupported）；
  - “请求通知权限”按钮（用户手势调用 `Notification.requestPermission()`）；
  - “发送测试推送”按钮 → POST `/mobile/push/test`，展示成功/失败/限流；
  - 可选：当前平台（web/android-shell）、contract 版本、插件版本。
- 不做持久化开关；所有通知/隐私开关在 Host 配置里（避免客户端与 Host 配置不一致）。
- 槽不存在时跳过注册，仅告警。

### 10.9 生命周期与 HMR

- 所有 interval/listener/timer 用 `ctx.effect` 清理；HMR 重载不产生重复心跳/重复通知。
- 卸载时：关闭本插件创建的 Notification；清除 `window.__dshMobile`（若仍是本对象）；取消未发送的 settle timer；停止 presence。
- 不修改 DSH 的 DOM/全局（除契约全局与自己的插槽）；不读取其他插件 DOM/样式。
- Client 重新加载后 pending/`notified` 从当前状态重建；不重放历史。

## 11. 与契约 v1 的差异/扩展

| 项 | 契约 v1 | 本实现 | 兼容性 |
|---|---|---|---|
| 包名 | 逻辑名 `dsh-mobile` | 实际包/行 id `dsh-mobile-notify` | 不影响协议；Shell 不依赖包名 |
| `transport` | 只有 `serverchan3` | 增加 `dryRun`（默认，仅记录不发网络） | 便于首次安装/联调；生产切回 `serverchan3` |
| `GET /mobile/config` | 无 | 新增客户端只读配置 | additive；旧 Shell 不调用 |
| ack `callId` | 无 | 可选字段 | additive；旧 Host 可忽略；本 Host 优先用于关联 |
| health 认证 | “loopback 或 DSH Cookie” | 一律 DSH Cookie + Origin | 更严格；不影响 Shell |
| `/mobile/pending` | 可选 | v1 不实现 | 契约允许不提供 |
| turn-done ack | `kind=turn` 已列出，但流程未细化 | 同一 presence/ack 状态机；默认关闭 | additive/可选 |
| `scopen` 的 `kind` | 示例只写 approval/question | 允许 `plan-review`/`turn`；Shell 只读白名单 key | 不影响拉起；`kind` 仅信息 |
| `sc.confirm` | 默认 1 | 不主动设置 | 保持默认；白名单后可免确认 |
| `phoneForeground` 提前抑制 | DECISION 表述为“手机前台即不推” | 仅在 `notify.inPage=true` 时提前抑制；`inPage=false` 走 ack/grace | 更符合“页内提示已可见”的前提；默认配置下行为一致 |

如果要把这些扩展写回契约：在 `dsh-android-shell` 仓库更新 `plugin-contract.md`，兼容性字段不升 `contract` 版本；破坏性变更才升版本。本仓库不在未沟通的情况下改 Shell 契约。

## 12. 安全与隐私

- 认证/Origin/body/限流见 §7；bootstrap 的部署前提见 §7.2。
- SendKey 只在 Host；`/mobile/config`、health、日志、通知、异常消息均不含。
- 深链只带 `sessionId`/`kind`/`requestId`；不带 token/Cookie/任意 URL；Shell 只读白名单 extras（另一仓库）。
- 通知内容按 `detail`/`privacy` 降级；`generic` 不含会话名/原因/工具名；不发代码/完整参数/审批全文。
- 锁屏可见性由 Server酱³ App 控制；DSH 侧无法强制隐藏；敏感场景用 `generic`。
- 日志不写请求体、Cookie、SendKey、完整 sessionId；只写短前缀/kind/delivered/状态码。
- 通知内不提供批准/拒绝；点击只打开会话。
- 不把 Server酱³/微信 relay 伪装成 DSH 原生通知；UI 文案说明提醒来源。

## 13. 可观测性与错误处理

- 日志前缀 `dsh-mobile-notify:`；关键事件：
  - 插件加载配置摘要（transport、事件开关、detail，不含秘密）；
  - presence/ack 拒绝原因（状态码，不含 body）；
  - 推送结果（ok/failed、状态码、耗时、kind、session 短前缀）；
  - resolved/清理异常；
  - Client 侧 `unsupported`/权限拒绝/桥重试失败（console.warn）。
- `/mobile/health` 提供计数/最近推送状态，供排障；不返回敏感字段。
- 错误分层：
  - 配置错误：插件加载失败，错误说明缺什么；
  - 请求错误：4xx + 通用错误体；
  - 推送错误：记录 + 返回失败，不影响审批；
  - 客户端错误：局部降级（无页内条/无通知），不阻塞 DSH UI。
- 不引入 metrics/tracing 依赖；需要时从日志和 health 读。

## 14. 测试映射

| 架构点 | 测试 |
|---|---|
| 事件归一化（kind/sessionId/title/截断） | 纯函数单测 |
| debounce/resolved/重复 | 注入 Clock 的状态机单测 |
| presence TTL/phoneForeground/liveWeb | 状态表单测 |
| ack 早到/全部 false/超时/多端 | 状态机 + fake transport 单测 |
| 路由认证/body/限流/方法 | fake ctx + mock req/res 单测 |
| Server酱³ payload/detail/编码/重试 | 注入 fetch 的单测 + snapshot |
| bootstrap 302/头 | 路由单测 |
| Client delivered 判定/去抖/桥重试 | 纯函数 + fake Document/Notification |
| 构建/包注册 | 构建 smoke test |

## 15. 部署与安装

```bash
pnpm install
pnpm build
dsh plugin --profile <profile> add /absolute/path/to/dsh-mobile-notify
# 重启 DSH Web；浏览器刷新
```

- bundle patch 不写死域名/凭据；首次安装后必须在 profile 配置里填 `publicBase`（否则插件按设计加载失败）。先 `transport: dryRun`，验证页内条/presence/ack/测试推送；再切 `serverchan3`。
- 目标 profile 停用/移除 `dsh-web-ui-notify`；两者并存会重复通知。
- nginx：整个 `/mobile/` 前缀（至少 bootstrap/config/presence/ack/push/test/health）都要走现有 oauth2-proxy 并转发到 DSH；不需要 SSE/长连接配置；DSH 只绑 loopback。若现有配置只精确代理了旧的三个路径，需要补上新增路径。
- Client bundle 改动后需重新构建并让 DSH 提供新 bundle（HMR/重启按 DSH 行为）；Host 改动需重启 DSH。
- 回滚：停用本插件，恢复旧插件；无数据迁移。

## 16. 后续项（不在 v1）

- FastPush 零点击拉起（需用户明确接受打断）。
- FCM（换有 GMS 的设备时，另开 transport）。
- 轮询兜底（若用户接受 15 分钟延迟且重新评估保活）。
- 设置页可视化编辑 `detail`/开关（当前用 Host 配置）。
- 通知内快捷动作（目前明确不做）。
- 多设备/deviceToken（当前用 DSH Cookie）。
- 独立 pending 收件箱页面（当前用页内条 + 会话跳转）。
