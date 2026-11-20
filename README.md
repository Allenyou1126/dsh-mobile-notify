# dsh-mobile-notify

DeepSeek Harness 的 Web 通知插件（Host + Client bundle）：页面/桌面优先提醒，只有“Web 未成功提醒 + 手机不在前台”时才回退到 Server酱³ App；与 Android 薄壳 [dsh-android-shell](../dsh-android-shell) 配套，用 `scopen` 深链回到对应会话；Server酱³ 推送带低基数 TAG（`dsh` / `dsh-approval` / …），便于在 App 内过滤。

- Agent 文档入口：[.agents/specs/README.md](.agents/specs/README.md)
- 实施目标与验收：[.agents/specs/goals.md](.agents/specs/goals.md)
- 技术选型：[.agents/specs/tech-stack.md](.agents/specs/tech-stack.md)
- 架构、协议与状态机：[.agents/specs/architecture.md](.agents/specs/architecture.md)
- 插件详情/排障：[docs/DETAIL.md](docs/DETAIL.md)

## 状态

M1 Host + M2 Client + M2.5 安装/图形配置已实现：

- Host：配置/TAG、审批/提问/turn 事件观察、去抖、presence/ack 状态机、HTTP 路由、Server酱³ 适配器、dryRun、测试推送、health。
- Client：`sessionStatus` pending 观察、`shell.overlay` 右下角浮动提醒卡、Web Notification、presence/ack、插件页 Configuration 配置卡、`window.__dshMobile` 桥。
- 当前主视图正在查看的 Session 不弹浮动卡：DSH 会话内已经显示 pending 内容，按“已在会话内提醒”ack，避免重复打扰和回退手机推送。
- 配置卡位于 **Plugins → 移动通知 → Configuration**，保存非敏感配置走 DSH `configEditor`，SendKey 存在 DSH `credentials`，不出现在配置或客户端响应里。
- 构建、`node:test` 与隔离 profile 的图形保存/清除 SendKey 已验证；主实例已重启并运行最新代码。真机/HyperOS 的 Server酱³、MiPush、`scopen` 拉起仍需实机验证。
- `turnDone` 目前只有 Host 推送回退；Client 不额外生成完成提醒（默认关闭）。

## 构建与测试

```bash
pnpm install
pnpm check        # typecheck + node:test + esbuild
pnpm build        # lib/index.js + lib/client.js
```

`lib/` 是构建产物，不入库；本地安装前先构建。

## 安装（开发/自用）

```bash
pnpm build
dsh plugin --profile <profile> add /absolute/path/to/dsh-mobile-notify
# 重启 DSH Web，刷新页面
```

bundle 自带 `publicBase: https://dsh.allenyou.top/` 的部署默认值，安装后即可打开配置页；在 **Plugins → 移动通知 → Configuration** 修改：

- DSH 外部地址、`dryRun`/Server酱³、Android 包名、fallback URL；
- Server酱³ SendKey（写入后只显示“已配置”，可清除；不落配置、不回传客户端）；
- TAG 分组、提醒开关、内容详细度、隐私开关和限额；
- “发送测试推送”，以及浏览器通知权限。

保存普通配置会按 DSH 规则重启插件；配置卡会显示“保存请求已发出，正在确认…”，随后重新读取。完整字段与 TAG/Server酱³ 说明见 [.agents/specs/architecture.md](.agents/specs/architecture.md) §8–§10。必须先移除/停用 `dsh-web-ui-notify`，并确保 `/mobile/*` 经现有 oauth2-proxy、DSH 只绑 loopback。

## 边界

本仓库**不**实现 Android Shell，也**不是** GitHub 上同名社区插件的 fork。不做 FCM、Mi Push SDK、轮询、SSE/FGS、Web Push、deviceToken、通知内批准/拒绝。
