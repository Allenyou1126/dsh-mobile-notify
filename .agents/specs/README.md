# dsh-mobile-notify — specs

本目录是 **dsh-mobile-notify 仓库唯一的 Agent 文档来源**。改实现前先读这里；根目录 `README.md` 只做入口，不重复规格。

## 本仓库是什么

DSH Web 通知 bundle（Host + Client 双面），负责：

- 观察 DSH 的审批、提问/计划审批和（可选）turn-done 事件；
- 在网页内用**页内提示 + 浏览器系统通知**优先提醒；
- 用 presence/ack 判断“Web 是否真的提醒到人”，只在 **Web 未成功提醒且手机 App 不在前台**时，调用 **Server酱³ App** 推送；
- 推送正文带 `scopen://top.allenyou.dsh?...`，由 Android 薄壳接收并回到对应会话；Server酱³ 消息带低基数 TAG（`dsh` / `dsh-<kind>`），便于 App 内过滤；
- 提供 `window.__dshMobile.openSession/setForeground` JS 桥、设置行、测试推送和健康检查。

## 本仓库不是什么

- **不是 Android Shell**。Shell（WebView、bootstrap、Cookie、`scopen` extras、文件/返回/Insets）在 [dsh-android-shell](../../../dsh-android-shell) 仓库实现。
- **不是** GitHub `zjhaaa042-cloud/dsh-mobile-notify` 的 fork。那个项目是 Host-only、以 turn-done 和十个渠道为主，不观察审批/提问、没有 pending 快照/深链，且 Server酱是微信版 Turbo；本项目只借鉴“渠道适配”的思路，不复用其代码作为基座。
- 不做 FCM、Mi Push、WorkManager 轮询、前台服务/SSE、WebSocket 长连接、`/mobile/pair`、deviceToken 或 `/mobile/events`。

## 权威来源与冲突规则

按以下顺序取事实；**冲突时编号小的优先**：

1. [DECISION.md](../../../DECISION.md)（2026-11-20，最终决议；相对本文件 `../../../DECISION.md`）
2. [PLAN.md](../../../PLAN.md)（分析与备选方案；只在不与 DECISION 冲突时作为背景）
3. [plugin-contract.md](../../../dsh-android-shell/.agents/specs/plugin-contract.md)（Android Shell ↔ 本插件的 v1 接口契约）
4. 本目录的 `goals.md` / `tech-stack.md` / `architecture.md`（本仓库的实施规格）

规则：

- **协议行为**以契约 v1 为准；本仓库的实现必须对契约 v1 向后兼容。
- **产品取舍**（Web 优先、Server酱³ 回退、不做 FCM/轮询/FGS、隐私档位）以 DECISION 为准。
- 本仓库对契约的**兼容性扩展**（例如 ack 里可选的 `callId`、客户端配置只读路由）必须在 [architecture.md](architecture.md) 里登记；破坏性变更必须先在 `dsh-android-shell` 仓库升 `contract` 版本，再改本仓库。
- 代码与文档冲突时，先改文档再改代码；不接受“代码即文档”。

## 文档索引

| 文档 | 内容 |
|---|---|
| [goals.md](goals.md) | 实施目标、非目标、交付物、里程碑、验收清单、完成定义 |
| [tech-stack.md](tech-stack.md) | 语言/运行时/框架/构建/测试/依赖/部署/安全/兼容性选型与理由，以及被否方案 |
| [architecture.md](architecture.md) | 组件与数据流、事件归一化、presence/ack 状态机、HTTP 与 JS 桥、Server酱³ 适配（含 TAG 分组）、模块划分、配置 schema、测试策略 |

## 命名

| 项 | 值 |
|---|---|
| 仓库 / npm 包 / bundle / Client bundle id | `dsh-mobile-notify` |
| 契约中的逻辑名 | `dsh-mobile`（Shell 契约文档的称呼；实际交付包名以本节为准） |
| Cordis 配置行 id | `dsh-mobile-notify` |
| 服务端路由前缀 | `/mobile/*` |
| Android 包名 | `top.allenyou.dsh` |
| 契约版本 | `1` |
| 目标 DSH | `0.2.2-rc.5`（精确锁定；升 DSH 需重新回归） |
| 目标 Android Shell | `0.1.x`（[dsh-android-shell](../../../dsh-android-shell)） |
| 推送 App | Server酱³ App（`com.ft07.serverchan.app3.server_app3`，支持 MiPush 与 `scopen`） |

## 状态

- 2026-11-20：规格定稿；**M1 Host 核心 + M2 Client 基础已实现**，`npm run check`（typecheck + node:test + build）通过。
- 已构建 `lib/index.js` / `lib/client.js`；**尚未安装到目标 profile，未做真实 DSH/浏览器/HyperOS 联调**。
- 本目录的“验收”仍是目标，不是已通过的结果；M2.5/M3 真机项按 [goals.md](goals.md) §7 逐条验证。
- 不要把“代码能构建”当成功能完成；Server酱³/MiPush/`scopen` 必须真机验证。

## 目录规则

1. 所有 Agent 文档只能放在 `.agents/specs/` 下；根目录 `README.md` 只读入口，不放规格。
2. 不把 SendKey、Cookie、profile 路径、真实会话内容写进文档；示例一律脱敏。
3. 新增或改变行为时，同步更新对应 spec，不留下“临时说明”在代码注释里。
4. 本目录的文档用中文写，代码标识符/协议字段用英文原文，避免翻译字段名。
