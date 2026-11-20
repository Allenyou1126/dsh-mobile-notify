# dsh-mobile-notify

DeepSeek Harness 的 Web 通知插件（Host + Client bundle）：页面/桌面优先提醒，只有“Web 未成功提醒 + 手机不在前台”时才回退到 Server酱³ App；与 Android 薄壳 [dsh-android-shell](../dsh-android-shell) 配套，用 `scopen` 深链回到对应会话；Server酱³ 推送带低基数 TAG（`dsh` / `dsh-approval` / …），便于在 App 内过滤。

- Agent 文档入口：[.agents/specs/README.md](.agents/specs/README.md)
- 实施目标与验收：[.agents/specs/goals.md](.agents/specs/goals.md)
- 技术选型：[.agents/specs/tech-stack.md](.agents/specs/tech-stack.md)
- 架构、协议与状态机：[.agents/specs/architecture.md](.agents/specs/architecture.md)
- 插件详情/排障：[docs/DETAIL.md](docs/DETAIL.md)

## 状态

M1 Host 核心 + M2 Client 基础已实现：

- Host：配置/TAG、审批/提问/turn 事件观察、去抖、presence/ack 状态机、HTTP 路由、Server酱³ 适配器、dryRun、测试推送、health。
- Client：`sessionStatus` pending 观察、`shell.bottom` 页内条、Web Notification、presence/ack、设置行、`window.__dshMobile` 桥。
- 构建与 `node:test` 单测通过；**尚未安装到 profile、未做真机/HyperOS 验证**。
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

最小配置：

```yaml
- insert:
    - id: dsh-mobile-notify
      name: 'dsh-mobile-notify'
      config:
        publicBase: 'https://dsh.allenyou.top/'
        transport: 'dryRun'          # 联调通过后改 serverchan3
```

完整配置与 TAG/Server酱³ 说明见 [.agents/specs/architecture.md](.agents/specs/architecture.md) §8–§9。必须先停用 `dsh-web-ui-notify`，并确保 `/mobile/*` 经现有 oauth2-proxy、DSH 只绑 loopback。

## 边界

本仓库**不**实现 Android Shell，也**不是** GitHub 上同名社区插件的 fork。不做 FCM、Mi Push SDK、轮询、SSE/FGS、Web Push、deviceToken、通知内批准/拒绝。
