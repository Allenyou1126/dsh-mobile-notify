# dsh-mobile-notify

> Web-first notifications for DeepSeek Harness — in-page cards and browser notifications first, Server酱³ App only as a fallback.

DeepSeek Harness 的 Web 优先通知插件（Host + Client bundle）。它不会一有审批或提问就推手机，而是先在 DSH 页面内提醒；只有 Web 侧没有成功提醒、且 Android Shell 不在前台时，才通过 Server酱³ App 推送。推送可以带 `scopen` 深链，并用低基数 TAG 在 App 内分组过滤。

## 特性

- **审批 / 提问**：右下角浮动提醒卡；点击直接回到对应会话。
- **当前会话不打扰**：事件属于你正在查看的 Session 时，不重复弹浮动卡；DSH 会话内已经显示 pending，按已提醒处理。
- **浏览器通知**：页面隐藏或未聚焦时使用 Web Notification；通知成功显示后会 ack，Host 不再推送 Server酱³。
- **turn 完成**：可选开启。Client 观察 `running: true → false`，成功显示 Web Notification 后才抑制 Server酱³；不生成浮动卡。
- **Server酱³ 回退**：只有 Web 未成功提醒、且 Android Shell 不在前台时才发送；不会无条件把所有事件推手机。
- **`scopen` 深链**：消息里的 `scopen://top.allenyou.dsh?...` 可由配套 Android 薄壳拉起并回到会话；薄壳不在本仓库。
- **TAG 分组**：默认 `dsh` + `dsh-approval` / `dsh-question` / `dsh-plan-review` / `dsh-turn` / `dsh-test`；只用稳定分组，不用会话名/原因等动态内容。
- **图形配置**：在 **Plugins → 移动通知 → Configuration** 完成，不用手工编辑服务器配置。
- **密钥隔离**：Server酱³ SendKey 存入 DSH `credentials`，不写入配置、不返回浏览器。

## 工作方式

```text
DSH approval / question / turn event
        │
        ▼
Host decision engine
        │
        ├── Client 浮动卡 / Web Notification 成功 ──► delivered ack ──► 抑制 Server酱³
        │
        └── Web 未成功提醒、手机不在前台 ─────────► Server酱³ App
```

Host 使用 presence（页面可见/聚焦、Android Shell 前后台）和 Client ack 决定是否回退；Client 在页内提醒真正挂载、浏览器通知确认显示后发 ack。

## 要求

- DeepSeek Harness `0.2.2-rc.5`（`engines.dsh` 精确匹配）。
- Node.js `>= 24.9.0`。
- DSH Web profile。
- 可选：
  - Server酱³ App 的 `sctp...` SendKey（用于手机回退）。
  - 配套 Android 薄壳（用于 `scopen` 深链；不包含在本仓库）。

## 安装

### 从 GitHub 安装

```bash
dsh plugin --profile <profile> add github:Allenyou1126/dsh-mobile-notify
# 重启 DSH Web，刷新页面
```

也可以在 DSH 的 **Plugins → 添加插件** 中安装仓库地址。

如果之前启用了旧的 `dsh-web-ui-notify`，请先移除/停用，避免两套通知同时响。

### 本地开发安装

```bash
git clone https://github.com/Allenyou1126/dsh-mobile-notify.git
cd dsh-mobile-notify
npm install
npm run build
dsh plugin --profile <profile> add /absolute/path/to/dsh-mobile-notify
```

`lib/` 是构建产物，但为了支持从 GitHub 直接安装，本仓库会提交它；改源码后请重新执行 `npm run build`。

## 配置

安装后打开 **Plugins → 移动通知 → Configuration**。

| 配置 | 说明 |
|---|---|
| DSH 外部地址 | 外部可访问的 DSH 基址，经 oauth2-proxy/反向代理；用于 bootstrap 与 `scopen` 回退链接。bundle 里有一个可启动的默认值，不是你的域名时务必修改。 |
| 推送通道 | 先保持 `dryRun` 联调；确认 presence/ack 与浮动卡正常后切到 `Server酱³`。 |
| SendKey | Server酱³ App 的 `sctp...` 密钥。写入 DSH credentials，页面只显示“已配置”，可清除。 |
| Android 包名 / fallback URL | `scopen` 拉起目标与拉起失败时的网页地址；使用自己的薄壳时改成自己的包名。 |
| TAG 分组 | 启用/关闭、namespace、是否发送 catch-all/事件 Tag、逐项覆盖、额外 Tag。 |
| 提醒行为 | 审批、提问、计划确认、turn 完成；浮动卡、Web Notification、严格/普通送达、切换等待时间。 |
| 内容详细度 / 隐私 | `summary` / `title` / `generic`，以及会话标题、原因、工具名是否进入通知。 |
| 高级限额 | 请求体、入站限流、推送频率/超时/重试。 |

首次联调建议：

1. 保持 `dryRun`，发送配置卡里的测试推送。
2. 在 DSH 页面触发一次审批/提问，确认浮动卡与点击跳转。
3. 需要手机回退时填写 SendKey，切到 `Server酱³`。
4. 确认 Server酱³ App 的通知权限、MiPush 和关联启动已放行。

保存普通配置会按 DSH 规则重启插件；配置卡会显示“保存请求已发出，正在确认…”，等待重新读取即可，不要连续重复提交。

### 浏览器通知权限

`turnDone` 只有在浏览器 **确认显示 Web Notification**（`onshow`）后才抑制 Server酱³。请在配置卡的“浏览器通知权限”处点“请求通知权限”，或开启 `turnDone` 后保存（保存也是一次用户手势，会请求权限）。

权限为 `default`/`denied`、或通知显示失败时，不会产生成功 ack，Host 仍可能按回退规则推 Server酱³。这是有意的：只有真正成功的 Web Notification 才算 Web 已送达。

## Server酱³ TAG

Server酱³ 的 `tags` 是 `|` 分隔的字符串；App 会按消息自动聚合 Tag，并支持过滤/阅读偏好，但不能手工改名或删除 Tag。

默认：

| 事件 | Tag |
|---|---|
| 全部 DSH 消息 | `dsh` |
| 审批 | `dsh-approval` |
| 提问 | `dsh-question` |
| 计划确认 | `dsh-plan-review` |
| turn 完成 | `dsh-turn` |
| 测试推送 | `dsh-test` |

- 只使用稳定、低基数的分组；不使用会话名、原因、sessionId 或 SendKey 做 Tag。
- 总数默认 ≤ 8；额外 Tag ≤ 6，每个 1–32 字符。
- Tag 只有在该消息出现后才会出现在 App 侧栏；先发一次测试推送，再设置过滤偏好。
- 在 App 内关闭某类 Tag 的阅读偏好后，不会再被该类消息打扰。

## 安全与隐私

- `/mobile/presence`、`/mobile/ack`、`/mobile/health`、`/mobile/settings` 等接口使用 DSH Cookie + Origin 校验；`/mobile/bootstrap` 应放在 oauth2-proxy 后面，DSH 只监听 loopback。
- SendKey 只存在 Host 的 DSH credentials；不会出现在 profile 配置、`/mobile/config`、`/mobile/settings` 响应、health、日志或通知中。
- 推送默认只带摘要，按 `detail`/`privacy` 降级；`generic` 不包含会话名、原因或工具名。
- `scopen` 只带会话标识和必要的请求字段，不携带 token/Cookie/任意 URL；薄壳只读白名单 extras。
- 不在通知内批准/拒绝；必须打开对应会话，由 DSH 自身处理审批/回答。

## 限制

- 本仓库不包含 Android Shell，也不实现 FCM、Mi Push SDK、轮询、SSE/长连接、前台服务或 Web Push。
- 页面完全关闭后没有 Web Notification；若手机不在前台，由 Host 在 grace 超时后回退 Server酱³。
- Server酱³ 的锁屏详情、Tag 过滤和阅读偏好由 App 控制，插件无法替用户设置。
- `turnDone` 默认关闭；它没有浮动卡，只有成功显示 Web Notification 才抑制 Server酱³。
- `turnDone` 不推子代理；无法可靠判定时保守不推。
- 当前阶段未做真实 HyperOS/MIUI 设备、MiPush 和 `scopen` 关联启动的端到端验证；`dryRun` 与 Web 侧已验证。

## 开发

```bash
npm install
npm run check     # typecheck + node:test + esbuild
npm run build     # lib/index.js + lib/client.js
npm test
```

源码结构与协议细节：

- [.agents/specs/architecture.md](.agents/specs/architecture.md)：HTTP API、presence/ack、决策状态机、TAG、配置 schema。
- [.agents/specs/goals.md](.agents/specs/goals.md)：目标、非目标、里程碑与验收清单。
- [.agents/specs/tech-stack.md](.agents/specs/tech-stack.md)：技术选型与构建方式。
- [docs/DETAIL.md](docs/DETAIL.md)：插件详情、TAG 用法与排障。

## 状态

`0.1.0`，M1 Host + M2 Client + M2.5 安装/图形配置已实现；75 项单元测试和构建通过。真机与 HyperOS 的 Server酱³、MiPush、`scopen` 拉起仍需实机验证。
