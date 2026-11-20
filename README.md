# dsh-mobile-notify

DeepSeek Harness 的 Web 通知插件（Host + Client bundle）：页面/桌面优先提醒，只有“Web 未成功提醒 + 手机不在前台”时才回退到 Server酱³ App；与 Android 薄壳 [dsh-android-shell](../dsh-android-shell) 配套，用 `scopen` 深链回到对应会话。

- Agent 文档入口：[.agents/specs/README.md](.agents/specs/README.md)
- 实施目标与验收：[.agents/specs/goals.md](.agents/specs/goals.md)
- 技术选型：[.agents/specs/tech-stack.md](.agents/specs/tech-stack.md)
- 架构、协议与状态机：[.agents/specs/architecture.md](.agents/specs/architecture.md)

状态：**规格已定，代码尚未开始**；目标 DSH `0.2.2-rc.5`。本仓库**不**实现 Android Shell，也**不是** GitHub 上同名社区插件的 fork（理由见技术选型）。

代码开始前的构建、安装和验收命令以 `.agents/specs` 为准；当前目录只有规格文档，没有可运行产物。
