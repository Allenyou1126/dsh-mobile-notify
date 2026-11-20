# dsh-mobile-notify

审批、提问和（可选）turn-done 的 Web 优先通知插件。

- **Web 优先**：页面可见且聚焦时在右下角弹出浮动提醒卡；如果当前正在查看的就是触发事件的那个 Session，不弹卡（会话内已显示 pending），按已提醒处理。页面隐藏/未聚焦时使用浏览器系统通知。
- **手机回退**：只有 Web 未成功提醒、且 Android Shell 不在前台时，才通过 Server酱³ App 推送。
- **深链**：Server酱³ 消息里的 `scopen://top.allenyou.dsh?...` 可由 Android 薄壳拉起并回到对应会话。
- **TAG 分组**：默认 `dsh` + `dsh-approval` / `dsh-question` / `dsh-plan-review` / `dsh-turn` / `dsh-test`，可在 Server酱³ App 内过滤。

## 安装

```sh
pnpm install
pnpm build
dsh plugin --profile <profile> add /absolute/path/to/dsh-mobile-notify
# 重启 DSH Web，刷新页面
```

必须做：

1. 打开 **Plugins → 移动通知 → Configuration**。bundle 自带 `publicBase: https://dsh.allenyou.top/` 默认值；如部署地址不同，在配置卡里改“DSH 外部地址”。
2. 首次联调保持 `dryRun`；确认 presence/ack/浮动提醒卡正常，再在配置卡里切 `Server酱³`。
3. 在配置卡填写 App 版 `sctp...` SendKey。它写入 DSH `credentials`，不会出现在 profile 配置或客户端响应中；可随时清除。
4. 确认手机 App 通知权限、MiPush 和 `scopen` 关联启动已放行。
5. 旧通知插件应已移除（本次安装已执行）；不要与 `dsh-web-ui-notify` 同时启用。

配置卡保存普通字段后 DSH 会重启本插件；“保存请求已发出，正在确认…”期间不要重复提交。完整字段和 TAG 规则见仓库 `.agents/specs/architecture.md` §8.3 / §9 / §10；本文件不重复维护。

## TAG 用法

- `dsh`：全部 DSH 消息。
- `dsh-approval` / `dsh-question` / `dsh-plan-review`：需要处理的入口。
- `dsh-test`：配置卡“发送测试推送”的测试消息；可在 App 内单独过滤/清理。
- 不使用会话名/原因/sessionId 做动态 Tag；Tag 总数默认 ≤8，`extra` ≤6。
- Tag 只有在出现含它的消息后才会出现在 App 侧栏；先发一次测试推送再设置过滤偏好。

## 限制

- 页面关闭后没有 Web Notification；由 Host 在 grace 超时后回退 Server酱³（若手机不在前台）。
- 浏览器通知权限默认拒绝时，右下角浮动提醒卡仍在；手机推送按回退规则执行。
- Server酱³ 的锁屏详情、Tag 过滤和阅读偏好由 App 控制，插件无法替用户设置。
- 不提供通知内批准/拒绝；必须打开会话。
- 当前实现默认不做 FCM/Mi Push SDK、轮询、SSE/FGS；本仓库不包含 Android Shell。
- `turnDone` 目前只有 Host 推送回退；Client 不额外生成完成提醒/通知（默认关闭）。

## 排障

- `/mobile/health`：查看 transport、pending/presence 计数、最近推送结果（需 DSH 登录）。
- 配置卡“发送测试推送”：验证 Server酱³ 链路与 TAG；dryRun 时只记录不发送。
- 浮动提醒卡不出现：检查 `shell.overlay` 是否可用，或 `notify.inPage=false`。
- 手机收不到：先测 App 通知权限/MiPush；再测 `scopen` 拉起；最后看 Host 日志中的 `upstream_failed` / `rate_limited`。
- `/mobile/bootstrap` 必须经 oauth2-proxy，DSH 只绑 loopback；不要直接公网暴露。
