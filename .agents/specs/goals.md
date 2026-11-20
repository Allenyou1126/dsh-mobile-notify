# 实施目标与验收

> 状态：**规格定稿（2026-11-20）**；M1 Host 核心 + M2 Client 基础已实现，`npm run check` 通过；未安装、未真机联调。
> 依据：[DECISION.md](../../../DECISION.md)（最终决议）、[PLAN.md](../../../PLAN.md)（背景）、[plugin-contract.md](../../../dsh-android-shell/.agents/specs/plugin-contract.md)（v1 接口）。
> 本文只回答“本仓库要交付什么、不交付什么、怎么算完成”；实现细节见 [architecture.md](architecture.md)，技术选型见 [tech-stack.md](tech-stack.md)。

## 1. 问题与定位

DSH 的“需要人处理”事件有两类：**审批**（`approval/request`）和**提问/计划审批**（`user-questions/request`）。桌面页面开着时，页面内提示或浏览器通知就能提醒；页面关了或人不在电脑前时，需要一条不依赖 DSH 常驻长连接的外发通道。

本机/目标环境已确定：

- 小米 HyperOS、只自用、侧载、大陆网络；
- 目标机无 GMS，FCM 不可用；个人侧载无法接 Mi Push；
- 不接受常驻前台服务、SSE/长连接、15 分钟轮询；
- 公网部署为 `https://dsh.allenyou.top`（oauth2-proxy + Zitadel），DSH 自身只绑 loopback。

因此本仓库实现一个 **DSH Host + Client 双面 bundle**：

```text
Host 观察事件 / 维护 pending / 判断该不该推手机 / 调 Server酱³
Client 观察所有会话 pending / 页内提示 / 浏览器通知 / 上报 presence 与 ack
Shell 只负责 WebView、登录、scopen extras 和 JS 桥（另一个仓库）
```

## 2. 实施目标

### G1 Host 事件观察与归一化

- 用 `prepend: true` 观察 `approval/request` 和 `user-questions/request` waterfall，**不阻塞、不改变审批链**；观察者调用 `next()` 拿结果，推送逻辑异步执行。
- 把事件归一化为统一记录：`kind`（`approval` / `question` / `plan-review` / `turn`）、`sessionId`、`callId?`、会话标题、工具名/原因/问题摘要、创建时间。
- `session/event` 的 `turn/end` 只作为可选 turn-done 来源；默认不推送。
- 自动审批去抖 `debounceMs=1500`：`next()` 在去抖窗口内返回时 Host 不通知/不推送；Web 端可能因 DSH 自身状态短暂闪一下。
- 事件 resolved 后删除 pending、取消尚未发出的推送；已发出的 Server酱³ 不撤回（API 不支持）。

### G2 Web 优先与 presence/ack 决策

- 客户端上报 presence（`clientId`、`platform`、`visible/focused`、通知权限；`activeSessionId` 可选）与 ack（`delivered`、`via`、`reason`）。
- Host 维护 presence TTL：`web=120s`、`android-shell=15s`；`phoneForeground()` 只认新鲜的 `android-shell && visible && focused`。
- 回退规则必须与 DECISION 一致：

  ```text
  debounce 内 resolved            → 不通知
  phoneForeground() + inPage + inPageCountsAsDelivered → 不推手机
  无新鲜 web presence             → 推 Server酱³
  有 web presence                 → 等 graceMs(4000) 的 ack
       任一 ack.delivered=true    → 不推
       全部 false 或超时          → 推 Server酱³
  ```

- 手机在 grace 窗口内回到前台：取消尚未发出的推送。
- 多标签/多端：任一端 `delivered=true` 即抑制；全部 false 才推。
- 去重：同一事件只推一次；resolved 后再出现的新事件是新的记录，不被旧记录误吞。

### G3 Server酱³ 回退适配器

- 用 DSH credentials 中的 SendKey（解析出 uid）调 `POST https://<uid>.push.ft07.com/send/<sendkey>.send`。
- 推送正文包含单行、正确 percent-encode 的 `scopen://top.allenyou.dsh?...` 深链；`sc.market=0`、`sc.fallback=<publicBase>`；不带 token/SendKey/代码/完整工具参数。
- 支持 `detail=summary|title|generic` 隐私档位；默认 summary（用户已选择显示摘要）。
- **TAG 分组**：默认 `dsh`（全部）+ `dsh-approval`/`dsh-question`/`dsh-plan-review`/`dsh-turn`/`dsh-test`；可配 namespace、是否发 catch-all/kind、逐项覆盖、额外 Tag。TAG 只做低基数、稳定分组，不用会话名/原因/sessionId 等动态内容；详细规则见 [architecture.md](architecture.md) §8.3。
- 失败重试 2 次、超时 8s、默认最多 50 条/分钟；失败只写日志，**不阻塞审批链**。
- `dryRun` 模式只记录 payload（脱敏），不发网络请求；首次安装/联调默认用它。
- 实现是 Server酱³ **App 版**（`sctp...` SendKey），不是 Server酱 Turbo 的微信通道。

### G4 客户端 Web 通知与页内提示

- 观察 `ctx.uiSession.sessionStatus` 的所有会话 `pendingInteraction`（approval/question/plan-review），用 `${sessionId}:${wait.key}` 去重。
- 页内提示：在 DSH 布局的全局底部槽（`shell.bottom`）显示待处理条/角标；点击打开对应会话。空内容不占高度。
- 浏览器系统通知：页面不可见/未聚焦且权限允许时用 `new Notification(...)`；点击聚焦并打开会话；不设 `requireInteraction`（桌面自己决定弹出时长）。
- 客户端在显示前做约 500ms 的短去抖，自动审批的“闪一下”尽量收敛；pending 消失则取消。
- delivered 判定：
  - 页面 `visible && focused` 且页内提示已显示 → `delivered=true, via=in-page`；
  - 否则尝试系统通知：成功 → `web-notification`；失败/不支持/权限拒绝 → `false` + `reason`。
  - `inPageCountsAsDelivered=false` 时只有系统通知成功才算 delivered。
- 通知里**不提供批准/拒绝**，只打开会话。

### G5 Android Shell 集成（本仓库侧）

- 注入 `window.__dshMobile`：

  ```ts
  interface DshMobileBridge {
    openSession(sessionId: string): boolean
    setForeground(foreground: boolean): void
  }
  ```

- `openSession` 走 `ctx.uiWorkspace.openSession(sessionId)`；会话暂时不在列表时接受请求并最多重试 ~5s，仍找不到显示 App 内提示，不抛异常。合法请求返回 true（含排队重试），非法/无法接受返回 false。
- `setForeground` 幂等，立即更新 presence；同时保留 `visibilitychange`/`focus`/`blur` 作为兜底。
- 读取 `window.__DSH_SHELL__`/UA 后缀 `DSHAndroidShell/` 判定 `platform=android-shell`；否则为 `web`。
- 不依赖 Shell 内部实现；只依赖契约 v1 的全局与 HTTP 行为。

### G6 配置、隐私与可观测性

- 用 DSH 的配置 schema 校验所有可调项（见 [architecture.md](architecture.md) §9）；非法配置在加载时失败，错误可操作。
- 图形配置放在 **Plugins → 移动通知 → Configuration**：普通字段用 `ctx.configEditor` 写 profile patch，SendKey 用 `ctx.credentials` record；不要求用户手工编辑服务器配置文件。
- 默认隐私：`detail=summary`；`privacy.includeSessionTitle=includeReason=includeToolName=true`（用户已选择摘要）；可一键降级为 `title`/`generic`。
- 不把 SendKey、Cookie、token、审批全文写进日志；会话 id 只打短前缀。
- `/mobile/health` 返回 transport、pending/presence 计数等非敏感诊断；`/mobile/config` 只返回客户端需要的非敏感开关。

### G7 安装、替换与不重复打扰

- 交付可被 `dsh plugin`/Plugin Manager 安装的 bundle：`package.json` 声明 `dsh.bundle` + `dsh.client`，`cordis.patch.yml` 插入一行。
- 安装到目标 profile 后，必须**停用/移除 `dsh-web-ui-notify`**，避免两套通知同时响。
- 本仓库不复用旧插件作为基座；如复用其 `notify.ts`/配置 UI 代码，保留 BSD-3-Clause 版权声明并记录来源。
- 提供 `dryRun` 测试推送和配置卡“发送测试推送”；不要求先有真实审批才能验证链路。

### G8 测试、文档与可维护性

- 纯逻辑（决策状态机、payload、TAG 构建/校验、URL 编码、配置解析、presence TTL、限流、body 校验）有自动化测试，不依赖真机。
- 路由与事件用 fake `ctx` 驱动；客户端纯函数用 fake DOM/`Notification` 驱动。
- 文档说明：安装、配置、隐私档位、故障排查、与 Shell 的契约边界、真机验证范围。
- 质量门禁：`pnpm check`（类型检查 + 测试 + 构建）通过。

## 3. 非目标

| 编号 | 不做 | 原因/归属 |
|---|---|---|
| N1 | Android WebView Shell、`MainActivity`、Cookie、文件/返回/Insets | 属 [dsh-android-shell](../../../dsh-android-shell) 仓库 |
| N2 | FCM / Firebase SDK / `google-services.json` | 目标机无 GMS；DECISION 已排除 |
| N3 | Mi Push SDK、小米开发者上架/企业资质 | 个人侧载不可用；借 Server酱³ 的 MiPush |
| N4 | WorkManager 轮询、开机自启、JobScheduler 周期任务 | 延迟与保活问题；DECISION 已排除 |
| N5 | 前台服务、SSE、WebSocket 长连接、“实时模式”开关 | 耗电；默认零后台服务 |
| N6 | Web Push / Service Worker 交付 | DSH PWA 无 SW，WebView 不支持 |
| N7 | `/mobile/pair`、deviceToken、FCM token、`/mobile/events` | v1 用已认证页面 + DSH 浏览器 Cookie |
| N8 | 微信/企微/飞书/Server酱 Turbo 等其它 relay | v1 只实现 Server酱³；保留 transport 接口但不写实现 |
| N9 | 通知内批准/拒绝、回复问题、执行命令 | 必须进 App 看上下文 |
| N10 | 通知里包含代码、完整工具参数、审批全文 | 隐私底线；摘要可降级 |
| N11 | FastPush 零点击自动拉起 | 会打断当前操作；需要时再评估 |
| N12 | 把所有会话的 pending 做成独立“收件箱”页面 | v1 用页内条 + 系统通知 + 会话跳转；不做新导航 |
| N13 | 多设备配对、设备撤销、推送 token 轮换 | 没有 deviceToken；依赖 DSH 会话 |
| N14 | 浏览器通知的持久化/历史管理 | 交给操作系统；插件不保存通知内容 |
| N15 | 公开上架、Play 发布、CI/CD 平台建设 | 自用；v1 只要求本地可构建 |
| N16 | 每会话/每原因/每请求的动态 TAG | Server酱³ Tag 由消息自动聚合、不能手工改名/删除；动态 Tag 会膨胀 App 侧边栏并泄露会话信息 |

## 4. 交付物

### 4.1 代码与包

```text
dsh-mobile-notify/
  .agents/specs/          # 本目录（Agent 文档；唯一规格来源）
  src/
    index.ts              # Host 入口（apply/Config）
    config.ts             # 配置 schema 与派生
    contract.ts           # 协议常量/类型/校验（Host+Client 共用）
    host/                 # 事件、pending、presence、决策、路由、Server酱³
    client/               # 状态观察、页内条、Web Notification、presence/ack、桥
    shared/               # 只放类型与纯函数
  test/                   # node:test + fake ctx/DOM
  build.mjs               # esbuild：Host ESM + Client CJS（__ModuleLoader__）
  cordis.patch.yml        # bundle 插入行
  locale/en.json          # meta.title/description/detail（英文）
  locale/zh.json          # 同上（中文）
  docs/DETAIL.md          # 插件详情页（用户向，不是 Agent 文档）
  icon.svg                # 原始/可再分发图标
  package.json            # dsh.bundle + dsh.client
  tsconfig.json
  README.md               # 安装/配置/使用（用户向）
```

### 4.2 文档

- 根 `README.md`：定位 + 构建/安装/最小配置 + 指向 `.agents/specs`。
- `docs/DETAIL.md`：功能、限制、隐私档位、故障排查（Plugin Manager 详情页用）。
- `.agents/specs/*`：本目录；不随实现漂移。

### 4.3 明确不交付

- APK/AAB、签名密钥、firmware、ADB 脚本（Shell 仓库负责）。
- nginx/oauth2-proxy/Zitadel 的服务器配置变更（部署前提见 §5）。
- 真实 SendKey、Cookie、profile 路径或任何凭据。

## 5. 约束与不变量

| 项 | 约束 |
|---|---|
| DSH | `0.2.2-rc.5`；`engines.dsh` 精确锁定；升版需回归 Client API |
| Node | `>=24.9.0`（与 DSH 运行时一致） |
| 部署 | `publicBase` 必须是 `https://dsh.allenyou.top/`；DSH 只绑 loopback |
| 代理 | `/mobile/*` 必须经过现有 oauth2-proxy；尤其是 `/mobile/bootstrap` |
| 认证 | 不引入 deviceToken；presence/ack/config/health 用 DSH 浏览器 Cookie + Origin |
| 事件 | 观察者不得延迟或否决审批/提问；任何通知异常都不得冒泡到 waterfall |
| 常驻 | Host 不启动任何长连接/定时轮询服务；Client 只在页面可见时每 10s 发 presence 心跳 |
| 状态 | pending/presence/ack 全部在内存；重启不补推历史；DSH 自身状态负责 UI 恢复 |
| 推送 | SendKey 只在 Host；不写日志、不进客户端、不进 `/mobile/config` |
| 通知内容 | 默认摘要；`generic` 不含会话名/原因/工具名；不含代码/参数/全文 |
| 通知 TAG | 只用配置的稳定分组；不含会话名/原因/sessionId 等动态内容；总数 ≤8 |
| 深链 | 只带 `sessionId`/`kind`/`requestId`；不带 token/URL；单行 + percent-encode |
| 契约 | v1 向后兼容；新增字段必须可缺省；破坏性变更先改 Shell 契约并升版本 |
| 许可 | 复用旧插件代码时保留 BSD-3-Clause 声明；不把第三方代码洗成自有 |

## 6. 里程碑

> 与 DECISION §5 对齐；M3 的真机工作是 Shell 仓库与本仓库的联合验收，不由本仓库单独完成。

| 阶段 | 本仓库工作 | 出口标准 | 预估 |
|---|---|---|---|
| **M1 Host 核心** | 配置/schema（含 TAG）、事件观察、去抖、pending、presence/ack、决策状态机、路由、Server酱³ 适配器、health/config/test push | `curl`/测试可触发 bootstrap、presence、ack、dryRun 推送；TAG 默认/覆盖/去重正确；错误 Origin/超限被拒；自动审批不产生推送 | 3–5 天 |
| **M2 Client 与 Web 通知** | `sessionStatus` 观察、页内条、Web Notification、presence/ack、`window.__dshMobile`、插件页配置卡 | 桌面可见/隐藏/权限拒绝三条路径都正确；任一端 delivered 抑制推送；桥可打开会话 | 3–4 天 |
| **M2.5 安装与替换** | 构建、安装到目标 profile、图形配置 `publicBase`/`transport`/TAG/SendKey、移除 `dsh-web-ui-notify`、测试推送 | profile 只保留一套通知；插件页 Configuration 可保存/清除 SendKey；页面加载无报错；health 正常；Server酱³ App 侧栏出现 `dsh`/`dsh-test` 且可按 Tag 过滤 | 1–2 天 |
| **M3 联调支持** | 与 [dsh-android-shell](../../../dsh-android-shell) 联合验证：`scopen`、关联启动、前后台 presence、锁屏推送、权限拒绝/恢复 | DECISION §6 的场景在真机通过；未通过项有明确记录 | 3–4 天（联合） |
| **M4 硬化与发布** | 隐私档位回归、错误处理、R8/签名不在本仓库、README/DETAIL、版本与安装说明 | 连续日常使用 3 天；无长连接/常驻；可重复安装；文档可排障 | 2–3 天 |

**总预算**：本仓库约 2 周（不含 Shell 仓库的 M3 工作），与 DECISION“总计 2–3 周”一致。不要为了提前演示跳过 M1 的决策状态机测试；它是唯一容易悄悄错的逻辑。

**实现状态（2026-11-21）**：M1/M2/M2.5 代码与安装已落地；Client 页内条/通知/presence/ack/桥、插件页 Configuration 配置卡、`/mobile/settings`、configEditor/credentials 已实现。69 项单测与构建通过；隔离 profile 中已验证配置卡保存 TAG、写入/清除 SendKey（响应不含 key）且插件保持运行。目标 profile 已移除 `dsh-web-ui-notify`；主实例需重启一次清理旧路由。M3 真机验证、M4 连续使用仍未执行。

## 7. 验收清单

> 在实现完成后逐条打勾；标“真机”的条目只能在 M3 验证。没有验证的条目不能因“代码看起来对”而算通过。

### 7.1 通知路径

| # | 场景 | 期望 |
|---|---|---|
| A1 | 桌面页面可见且聚焦，出现审批 | 页内条出现；不推 Server酱³ |
| A2 | 桌面页面可见且聚焦，页内条被点击 | 打开对应会话；pending 仍由 DSH 自身回答 |
| A3 | 桌面页面隐藏，通知权限已给 | 浏览器系统通知；不推 Server酱³ |
| A4 | 桌面页面隐藏，通知权限被拒 | ack `delivered=false`；手机不在前台时推 Server酱³ |
| A5 | 桌面页面关闭后出现审批 | 无 web presence → 手机不在前台则推 Server酱³ |
| A6 | 手机 App 前台，出现审批 | 页内条；不推 Server酱³ |
| A7 | 手机 App 后台/锁屏，出现审批 | Server酱³ 推送（MiPush 路径）；真机 |
| A8 | 点 Server酱³ 通知 → 打开 DSH | `scopen` 拉起 App 并进入对应会话；真机 |
| A9 | App 未装/拉起失败 | `sc.fallback` 打开网页版；真机 |
| A10 | 自动审批在 1.5s 内完成 | 不推 Server酱³；Web 端最多短暂闪一下 |
| A11 | 审批在桌面/手机被处理 | pending 清除；客户端关闭对应通知；不再推 |
| A12 | 重复事件/断线重连/多标签 | 同一 key 不重复推送；任一端 delivered 即抑制 |
| A13 | turn-done 默认关 | 不推手机；App 内状态正常 |
| A14 | 打开 turnDone 配置 | 完成事件按同一 presence/ack 规则推送；仍不推子代理（无法可靠判定时保守不推） |
| A15 | `detail=summary/title/generic` | 字段逐级减少；`generic` 不含会话名、原因、工具名 |
| A16 | 主机重启/插件重载 | 不补推历史；DSH 页面恢复后自行显示 pending |
| A17 | Server酱³ TAG 配置 | 默认 `dsh` + `dsh-approval` 等；namespace/kindTags/extra 生效；顺序稳定、精确去重；`enabled=false` 时不发 `tags`；test 推送带 `dsh-test` |
| A18 | 插件页 Configuration | 在 Plugins → 移动通知 → Configuration 可读取/保存 publicBase、transport、TAG、notify/privacy/limits；SendKey 只显示已配置状态，可写入/清除；保存后插件可恢复运行，响应不含 SendKey |

### 7.2 安全与错误

| # | 场景 | 期望 |
|---|---|---|
| S1 | presence/ack/config/health 错误 Origin | 401/403；不写入状态 |
| S2 | 请求体 >2KB / 非 JSON / 非对象 | 413 / 415 / 400；不写敏感日志 |
| S3 | 超过限流（默认 120/min/client） | 429 + `Retry-After` |
| S4 | SendKey 出现在客户端包/日志/通知/health/config | 不允许；检查构建产物与日志 |
| S5 | `scopen` 链接含空格/换行/未编码字符 | 不允许；单行、可解析、`sc.` 保留键不进 extras |
| S6 | health/config 未认证访问 | 401，不返回 transport 细节 |
| S7 | transport=serverchan3 缺 SendKey，或 uid 无法解析 | 插件仍可加载并打开配置页；发送返回 credentials missing/uid missing，不静默降级为 dryRun |
| S8 | 推送上游超时/500 | 重试 2 次后记录失败；审批链不受影响 |
| S9 | 日志中的会话 id | 只打短前缀/kind/delivered；不打审批全文 |
| S10 | TAG 中含会话名/原因/sessionId/SendKey | 不允许；TAG 只来自配置的稳定分组，不含动态内容 |
| S11 | TAG 非法/超长/超过数量上限 | 插件加载失败并说明字段；不在发送时静默截断（运行期意外值丢弃并 warning） |
| S12 | 配置卡保存 SendKey | 只回传 configured/writable/available；不进入 Config、日志、GET 响应或 React 持久化；清除后 record 删除 |

### 7.3 工程

| # | 场景 | 期望 |
|---|---|---|
| E1 | `pnpm check` | link-types + typecheck + tests + build 全绿 |
| E2 | 构建产物 | `lib/index.js` 可被 Cordis 加载；`lib/client.js` 调用 `window.__ModuleLoader__.load({id:'dsh-mobile-notify',...})` |
| E3 | 安装到目标 profile | Plugin Manager 出现一行；title/description/icon 正确；无元数据诊断 |
| E4 | 与 `dsh-web-ui-notify` 并存 | **不允许**；安装本插件前停用/移除旧插件 |
| E5 | 页面加载 | 无未捕获异常；无重复 interval/listener；HMR/重载后状态干净 |
| E6 | 默认配置 | 不误发真实推送；`transport=dryRun` 时只记录脱敏 payload |
| E7 | 文档 | 根 README + DETAIL 能完成安装、配置、排障；`.agents/specs` 与实际行为一致 |

## 8. 完成定义（Definition of Done）

一个里程碑算完成，必须同时满足：

1. 对应代码已实现，且 `pnpm check` 通过；
2. 新增/变更行为已更新 `.agents/specs`（协议变更还要同步 Shell 契约）；
3. 该里程碑“出口标准”中的场景已实际执行（自动化或手工），结果记录在 PR/commit 说明中；
4. 没有把未验证项写成“已通过”；真机项明确标 M3；
5. 没有引入 N1–N16 中的非目标；
6. 没有提交 Secrets、构建产物或 profile 路径。

**整个仓库的完成**：M1–M2.5 完成、M3 真机场景通过、M4 连续使用 3 天；默认安装后没有常驻服务/长连接，且 `dsh-web-ui-notify` 已停用。

## 9. 与旧插件、其它仓库的边界

| 对象 | 关系 |
|---|---|
| [dsh-android-shell](../../../dsh-android-shell) | 消费本插件的路由/全局；契约在它的 `.agents/specs/plugin-contract.md`。本仓库不改 Shell 代码；Shell 不改本插件内部实现 |
| `dsh-web-ui-notify` | 被本插件取代；只允许复用 `notify.ts`/配置 UI 的思路或代码（BSD-3-Clause，保留声明）。两者不能同时启用；本次目标 profile 已移除 |
| 社区 `dsh-mobile-notify` | 仅作渠道/事件调研参考；不是基座、不是 fork、不沿用其 Turn-done 产品定位 |
| Server酱³ App | 外部依赖；负责 MiPush 收信与 `scopen` 拉起；不是 DSH 的通知图标 |
| oauth2-proxy/Zitadel | 部署前提；`/mobile/*` 必须经其认证，DSH 只绑 loopback |
| DSH 自身 | 事件源与 UI 宿主；本插件只观察，不改审批结果/会话内容 |

## 10. 风险与待验证（实现时跟踪）

| 风险 | 影响 | 本仓库应对 |
|---|---|---|
| Server酱³ 的 MiPush 实际依赖后台驻留 | 省电目标落空/漏推 | M3 划掉/强停实测；若必须驻留，回退方案需重新评估（不在本仓库私自加长连接） |
| MIUI “应用关联启动”拦截 `scopen` | 点通知拉不起 DSH | 文档引导放行；`sc.fallback` 兜底；真机验收 |
| Web ack 竞态/超时 | 已弹桌面仍推手机，或反之 | grace 4s；宁可多推不漏；日志可查；单测覆盖竞态 |
| 多标签/多端重复 | 重复通知 | 客户端 key 去重 + Host 任一端 delivered 抑制 + 单飞 |
| 手机前后台判定滞后 | 后台误判前台漏推 | `onPause` 主动上报 + 15s TTL；TTL 过期按后台处理 |
| DSH 升级改 `uiSession.sessionStatus`/事件 | 插件失效 | `engines.dsh` 锁 `0.2.2-rc.5`；feature detect；降级为 Host-only + 页内提示 |
| 浏览器通知权限默认拒绝 | Web 通知不弹 | 配置卡引导 + ack false 回退；页内条仍在 |
| 第三方看到审批摘要 | 隐私泄露 | `detail` 降级；不发代码/完整参数；锁屏详情由 Server酱³ 控制 |
| 摘要含 Markdown 特殊字符 | Server酱³ 排版/链接损坏 | 值去换行/控制字符并截断；链接固定标签、单行、percent-encode |
| 动态/过多 TAG | App Tag 侧边栏膨胀、泄露会话信息 | 低基数固定 Tag；每类事件一个 Tag；总数 ≤8；禁止动态内容 |
| 目标机/Server酱³ 不可用 | 无法验收 | `dryRun` + fake transport 完成 M1/M2；真机失败记录为风险，不伪造通过 |
