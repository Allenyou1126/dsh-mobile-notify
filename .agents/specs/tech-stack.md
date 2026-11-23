# 技术选型

> 状态：**已定（2026-11-20）**；M1/M2 基础已按本选型实现，待安装/真机联调。本文的选择是实现依据；与 [DECISION.md](../../../DECISION.md) 冲突时以 DECISION 为准，与本目录其它文档冲突时以本文为准并回头修正。
> 目标 DSH：`0.2.3-alpha.2`；Node：`^24.22.3 || >=26.13.1`；包名/Client bundle id：`dsh-mobile-notify`。

## 1. 结论表

| 维度 | 选择 | 一句话理由 |
|---|---|---|
| 语言 | TypeScript 5.x，`strict` | DSH 的事件/客户端 API 类型复杂；编译期发现漂移 |
| 运行时 | Node `^24.22.3 || >=26.13.1`（Host）；浏览器 ES2022（Client） | 与 DSH `0.2.3-alpha.2` 的引擎要求一致 |
| 插件框架 | DSH 原生 Cordis 插件（Host `apply/Config`） | 不引入第二套生命周期；effect 自动释放 |
| 包形态 | **单包双面**：一个 `package.json` 同时声明 `dsh.bundle` + `dsh.client` | 一次安装、一份配置、Host/Client 协议不漂移 |
| 配置校验 | `@deepseek-ai/schemastery`（DSH 自带） | DSH 官方 Config 形态；加载时失败、可操作 |
| 模型工具 | `@deepseek-ai/dsh-tools` 的 `defineTool`（DSH 自带） | 参数/输出 schema 与工具执行走 DSH 官方管线；运行时不打包 |
| HTTP 服务 | DSH `ctx.webServer.register` + Node `IncomingMessage/ServerResponse` | 不引入 Express/Koa；只注册 8 个精确路由 |
| 认证 | DSH 浏览器 Cookie + Origin；路由声明 `auth: 'required'`，由 `webServer` 在 handler 前准入 | 不引入 deviceToken/配对；复用现有 oauth2 会话 |
| 外发 HTTP | Node 内置 `fetch` + `AbortSignal.timeout` | 零第三方依赖；足够处理一次 JSON POST |
| 客户端 UI | React 18（DSH 前端模块表提供）+ DSH 插槽 | 官方扩展点；主题/语言/插件页配置卡一致 |
| 客户端通知 | `Notification` API（页面存活期） | 没有 Service Worker/Web Push；页面关闭后由 Host 回退 |
| 构建 | esbuild + `tsc --noEmit` | Host ESM、Client CJS `__ModuleLoader__` 手写包装，esbuild 最直接 |
| 测试 | Node 内置 `node:test` + `node:assert/strict` | 零测试框架依赖；Node 24 可直接跑 `.ts` |
| 包管理器 | pnpm | DSH profile 使用 pnpm；本地插件安装一致 |
| 状态 | pending/presence/ack 内存；按对话设置写 Session 插件记录 | pending 可从 DSH 重建；turnDone 覆盖可跨重启保留 |
| 会话状态 | `ctx.sessionProjections` + `appendPluginRecord` | 通知与按对话设置通过既有 control stream 广播，不新增轮询/长连接 |
| 回退通道 | Server酱³ App（`serverchan3`；联调用 `dryRun`） | 个人环境唯一“无 GMS、无长连接、可深链”的组合 |
| Server酱³ 分组 | 低基数 TAG：namespace + 每类事件 + extra | 利用 App 的 Tag 过滤/阅读偏好；避免动态 Tag 膨胀 |
| 明确不实现 | FCM / Mi Push / WorkManager / SSE / FGS / Web Push / deviceToken / 第三方 relay | 见 §12 被否方案 |
| 类型来源 | 本机安装的 DSH `0.2.3-alpha.2`（devDependencies 或离线 link farm） | 不凭记忆写 API；不把 DSH 类型 vendor 进仓库 |
| DSH 兼容 | `engines.dsh: ^0.2.3-alpha.2` | 客户端 API 在预发布之间会变；升版必须回归 |
| 分发 | 本地 `dsh plugin`/Plugin Manager 安装；`private: true` | 自用、不上架、不发布 npm |
| 许可 | 私有自用；复用旧插件代码保留 BSD-3-Clause 声明 | 不把第三方代码洗成自有 |

## 2. 语言与运行时

### 2.1 TypeScript

- 版本：TypeScript 5.7+（开发依赖精确锁定；不跟随 DSH 包内置版本）。
- 编译目标：`ES2022`；模块 `ESNext`；`moduleResolution: bundler`；`verbatimModuleSyntax`；`isolatedModules`。
- 严格性：`strict`、`noUncheckedIndexedAccess`、`noImplicitOverride`、`noFallthroughCasesInSwitch`。`exactOptionalPropertyTypes` 暂关，避免与 DSH 的可选字段/React props 反复摩擦。
- 只做类型检查：`tsc -p tsconfig.json --noEmit`；不产 `.d.ts`（自用 bundle，不需要给外部消费者类型）。
- 源码允许 `import './x.ts'`（`allowImportingTsExtensions`），因为 esbuild 和 Node 24 都直接接受；不引入路径别名（避免运行时要额外解析）。
- 禁止 `enum`/`namespace`/参数属性，保证 Node 24 类型剥离可直接跑测试；类型用 union/`as const` 表达。
- 不用 `any`；DSH 边界用 `unknown` + 类型守卫/窄接口，不把第三方对象断言成复杂内部类型。

### 2.2 Node 24

- `engines.node: "^24.22.3 || >=26.13.1"`，与 DSH CLI 的引擎一致。
- Host 只使用 Node 内置模块：`node:http` 类型（实际由 DSH 传入）、`node:crypto`（如需短哈希）、`fetch`、`AbortSignal.timeout`、`node:test`（测试）。
- 不引入 `dotenv`、`axios`、`express`、`ws`、`undici`（Node 自带 fetch）。
- 定时器统一 `setTimeout(...).unref?.()`；插件卸载时 `ctx.effect` 清理。测试注入 clock，不用真实等待。

### 2.3 浏览器端

- 目标 ES2022；不使用需要 polyfill 的 API。
- 只用页面生命期内的能力：`Notification`、`fetch`、`document.visibilityState`、`window`/`sessionStorage`。
- 不依赖 Service Worker、Web Push、IndexedDB、localStorage 持久配置。
- `clientId` 用 `crypto.randomUUID()`（不可用时回退到时间戳+随机串），存 `sessionStorage`，刷新复用、关闭标签即失效。

## 3. 插件框架与包形态

### 3.1 单包双面

`package.json` 的核心声明：

```json
{
  "name": "dsh-mobile-notify",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg",
    "./package.json": "./package.json"
  },
  "files": ["lib", "cordis.patch.yml", "locale", "docs", "icon.svg", "README.md"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-api-session-controller",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-ui-session",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-ui-workspace"
      ]
    }
  },
  "engines": { "node": "^24.22.3 || >=26.13.1", "dsh": "^0.2.3-alpha.2" }
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-mobile-notify
      name: 'dsh-mobile-notify'
      config:
        publicBase: 'https://dsh.allenyou.top/'
```

- **单包**：Host 根导出与 Client `./client` 同包；一次安装、一份版本号。
- **不加 flavor/子包**：不做 `fcm`/`poll`/`realtime` 变体；未来若加 FCM，再拆包，不预先复杂化。
- **不放进 monorepo**：本仓库独立；与 Shell 通过契约耦合，不通过 workspace 耦合。

### 3.2 Host 入口

```ts
export const name = 'dsh-mobile-notify'
export const inject = ['webServer', 'sessions', 'sessionProjections', 'tools']
export const Config: Schema<Config> = ...
export function apply(ctx: Context, config: Config): void { ... }
```

- 所有监听器用 `ctx.on(..., { prepend: true })` 或等价格式注册，随 plugin fiber 释放。
- 所有路由由 `registerRoutes()` 一次性注册；同一 path 的 GET/PUT 在 handler 内按 method 分派（DSH 不允许重复 exact path）。注册失败时先撤销已注册路由再抛错，避免 HMR 残留半套路由。
- `sessionTitle` 是可选服务：`ctx.get('sessionTitle')`，缺失时用短 sessionId，不阻塞加载。
- 不注入 `approval`/`userQuestions` 服务（只观察事件），避免不必要的加载顺序依赖。
- `tools` 是必需的：Host 通过 `defineTool` 注册 `mobile_notify`；`notify.modelTool=false` 时只跳过工具，不影响路由/事件。
- `sessionProjections` 是必需的：`mobileNotify` projection 广播模型通知和按对话 turnDone；插件记录使用 `plugin:dsh-mobile-notify/*` 命名。
- Client 入口注入 `uiSession.sessionStatus`（DSH 0.2.3 起该服务由 `@deepseek-ai/dsh-client-ui-session-status` 提供）。
- 加载失败策略：
  - `publicBase` 缺失/非法 → Config 校验失败；bundle patch 给 `https://dsh.allenyou.top/` 默认值，安装后即可进配置页；
  - `transport=serverchan3` 无 SendKey → 插件仍加载，发送时返回 credentials missing；配置卡可写入 SendKey；
  - `webServer`/`sessions`/`sessionProjections`/`tools` 缺失 → 依赖注入失败，不静默降级；`mobile_notify` 注册失败只 warning。
- SendKey 通过 `ctx.get('credentials')` 读取，不进入 Config；配置卡保存走 `ctx.get('configEditor').edit(ctx.fiber.entry, ...)`。

### 3.3 Client 入口

```ts
export const inject = ['sessions', 'slots', 'locale', 'uiSession', 'uiWorkspace']
export function apply(ctx: Context): void { ... }
```

- 用 `ctx.slots.inject('shell.overlay', ...)` 注册右下角浮动提醒卡；该槽不存在时只告警，不退回 DOM hack。
- 通过 `ctx.uiSession.adapter.current.getSnapshot().key` 读取当前主视图 Session；仅当页面可见/聚焦且正常会走 in-page 时，若事件就属于该 Session，则跳过浮动卡并 ack delivered，避免重复提醒和手机回退。
- 用 `ctx.slots.inject('plugins.bundle.config', ...)` 在 **Plugins → 移动通知 → Configuration** 注册配置卡（`key = dsh-mobile-notify`）；该槽不存在时跳过，数据走 Host `/mobile/settings`。不依赖 `configForms.whileServed`，因为普通字段不是 `.volatile()`；这是与 `dsh-context` 的实现差异。
- 用 `ctx.locale.register(NS, { zh, en })` 注册运行时文案；`locale/*.json` 供 Plugin Manager 的 `meta.*` 使用。
- 注入 `window.__dshMobile`；在 `ctx.effect` 的清理里删除本插件设置的同名全局（仅当仍是本次注入的对象）。
- 不 import `react-dom`；React/JSX runtime 由 DSH 模块表提供。不打包 React。

## 4. HTTP 与状态

### 4.1 路由

| 路由 | 方法 | 认证 | 用途 |
|---|---|---|---|
| `/mobile/bootstrap` | GET | `auth: 'anonymous'` + oauth2-proxy（外部） | 302 到配置的 `publicBase` |
| `/mobile/config` | GET | DSH `auth: 'required'`（Cookie + Origin） | 客户端需要的非敏感开关（本仓库的兼容性扩展） |
| `/mobile/presence` | POST | DSH `auth: 'required'`（Cookie + Origin） | presence 心跳 |
| `/mobile/ack` | POST | DSH `auth: 'required'`（Cookie + Origin） | delivered/failed 回执 |
| `/mobile/push/test` | POST | DSH `auth: 'required'`（Cookie + Origin） | 配置卡测试推送 |
| `/mobile/health` | GET | DSH `auth: 'required'`（Cookie + Origin） | 非敏感诊断 |
| `/mobile/settings` | GET/PUT | DSH `auth: 'required'`（Cookie + Origin） | 插件页图形配置 |
| `/mobile/session-settings` | PUT | DSH `auth: 'required'`（Cookie + Origin） | 对话粒度 turnDone 覆盖 |

- 全部 `kind: 'exact'`；`Cache-Control: no-store`；不设 CORS 头；不走 Express 中间件。
- 认证统一：每个 exact route 声明 `auth: 'required'`，由 DSH `webServer` 在 handler 前完成 Origin 与凭据准入；handler 内不再调用 Connection 辅助方法。
- **Health 也要求 DSH Cookie**（比契约的“loopback 或 Cookie”更严格）。理由：DSH 在反向代理后看到的远端地址是 loopback，按远端地址放行会把诊断路由暴露给公网。
- `/mobile/bootstrap` 的安全性依赖部署：DSH 只绑 loopback、nginx 的 oauth2-proxy 保护 `/mobile/*`。如果 DSH 直接暴露，bootstrap 会变成绕过 oauth2 的入口；插件无法在代码里可靠判断，必须在部署文档中写成硬前提。

### 4.2 Body 与限流

- 只接受 `application/json`（允许 `; charset=utf-8`），否则 415。
- 读取上限 2KB；超出 413；非对象/数组 400；JSON 解析失败 400。
- 限流：默认 120 次/分钟/`clientId`，另加按远端地址的粗粒度上限；超出 429 + `Retry-After`。滑动窗口实现，定时清理过期 key。
- 不记录请求体；日志只记录结果码、clientId 短前缀、kind、delivered。
- 错误响应统一 `{ "error": "...", "message"?: "..." }`，不返回内部堆栈/上游响应体。

### 4.3 状态

- `PendingRecord`、`PresenceRecord`、`AckRecord` 全部内存存储；不使用数据库/文件。
- 插件重载/DSH 重启后状态清空，符合“不补推历史”。
- 定时器（debounce/grace/清理）全部可取消；插件卸载时 abort 未完成的推送（已发出的不撤回）。
- 使用注入的 `Clock` 接口（`now`、`setTimeout`、`clearTimeout`）驱动状态机，测试可完全确定。

## 5. 构建

### 5.1 产物

```text
lib/index.js    # Host：ESM，Target node24（实际运行时 >=24.9）
lib/client.js   # Client：CJS，包在 window.__ModuleLoader__.load({ id, factory }) 里
```

- `lib/` 是构建产物，**不入库**（`.gitignore`）；本地安装前先 `pnpm build`。
- 生成 sourcemap；不生成 `.d.ts`。
- 不把 DSH 包、React、Node 内置模块打进产物。

### 5.2 esbuild 配置

Host：

```js
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node24'],
  sourcemap: true,
  external: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', '@deepseek-ai/dsh-*'],
  logLevel: 'info',
})
```

Client：

```js
await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: true,
  jsx: 'automatic',
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-*',
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
  ],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'dsh-mobile-notify', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
})
```

- banner/footer 的 `id` 必须等于包名；否则 bundle 能加载但注册不到插件。
- 不引入 CSS Modules/lightningcss；浮动提醒卡与插件页配置卡用 React 内联 `style` + DSH 主题 CSS 变量。减少一条构建链。
- 不用 `tsup`/`vite`/`webpack`；这个插件只有两个入口。

### 5.3 类型来源

> **实现修订（2026-11-20，2026-11-21 更新）**：v1 代码在 DSH 边界使用窄结构接口（Host `HostContext` / Client `ClientContext`），不 import 完整 DSH 类型包；只保留 `@deepseek-ai/schemastery`、`@deepseek-ai/dsh-tools` 与 React 类型为开发依赖。`dsh-tools` 仅用于 `defineTool` 的参数/输出 schema 与类型；它在运行期由 DSH 提供，不打进 bundle。这样构建/测试不依赖 pnpm 类型农场，但**升级 DSH 时必须按本节核对文档/源码并补回归**。

- 类型检查针对**本机安装的 DSH `0.2.3-alpha.2`**，不针对记忆或旧版本。
- 首选：`devDependencies` 精确锁 `0.2.3-alpha.2` 的 DSH 类型包（`@deepseek-ai/dsh-session`、`@deepseek-ai/dsh-tools`；Client 仍用窄结构接口，不 import 完整类型包）。
- 离线/本机包不在 npm 时：`scripts/link-types.mjs` 从 `DSH_INSTALL_DIR` / `which dsh` 的安装目录建立 `node_modules/@deepseek-ai` 符号链接农场（参考 `dsh-web-ui-notify` 的做法）；`tsconfig` 开 `preserveSymlinks`。脚本必须可重复执行、只改符号链接，不删除真实目录。
- **不 vendor DSH 类型**：版本一变就会假通过；宁可 typecheck 失败。

## 6. 测试

### 6.1 框架

- **Node 内置 `node:test`** + `node:assert/strict`；不引入 Vitest/Jest/Mocha。
- 直接执行 TypeScript：Node 24 类型剥离；测试文件 `test/**/*.test.ts`；`package.json` 的 `test` 为 `node --test`。
- 不使用 jsdom。客户端纯逻辑通过可注入的 `DocumentLike`/`NotificationLike`/`WindowLike` 接口测试；React 组件只做类型检查 + 真机/浏览器手工验收，不在 v1 写 DOM 渲染测试。
- 不 mock 整个 DSH；写一个 `test/fakes/ctx.ts`，只实现本插件用到的 `webServer.register`、`sessions`、`sessionTitle`、`logger`、`effect`、`on`。
- 时间相关逻辑注入 `Clock`；不 `sleep`。等待 promise 用明确的 deferred，不用轮询。
- 网络相关：`ServerChan3Transport` 注入 `fetch`；测试返回固定响应，不联网。

### 6.2 必测清单

| 模块 | 场景 |
|---|---|
| 决策状态机 | debounce 内 resolved、phone 前台、无 web、有 web + ack true/false/超时、grace 内手机回前台、多客户端、并发事件、resolved 取消 |
| pending | 同一 key 不重复推；resolved 删除；新事件不被旧记录误吞；插件卸载清理 |
| presence | TTL 过期、web/shell 平台、visible/focused 组合、clientId 覆盖、异常字段拒绝 |
| ack | delivered true 抑制、全部 false 才推、重复 ack 幂等、非法枚举拒绝、可选 callId 关联 |
| Server酱³ | payload 字段、detail 三档、单行链接、percent-encode、sc. 保留键、超时/重试/限流、失败不抛 |
| Server酱³ TAG | 默认/覆盖/顺序/去重/空列表/字符与数量上限/`enabled=false`；test 用 test Tag |
| 路由 | bootstrap 302/`Cache-Control`、错误 Origin、缺 Cookie、Content-Type、2KB、429、错误 method |
| 配置 | 默认值、非法 publicBase、serverchan3 缺凭据、未知字段忽略、数值边界 |
| 客户端纯函数 | delivered 判定、`via/reason`、通知 tag 去重、500ms 去抖取消、页面隐藏/聚焦、权限 unsupported/denied |
| 构建/包 | `lib/index.js` 可 import；`lib/client.js` 在 fake loader 下注册 id；package exports/files 完整 |

### 6.3 不放进自动化门禁

- 真实 Server酱³ 推送/MiPush、Android `scopen`、HyperOS 关联启动、锁屏展示、WebView 前后台：这些是 M3 真机项，用检查表记录。
- 浏览器通知的实际桌面样式：依赖 OS/桌面，自动化只能断言“是否构造”，不能断言“用户看到”。
- Playwright：v1 不引入；如果后续需要回归 UI，可单独评估，不作为本插件依赖。

## 7. 依赖策略

- **零第三方运行时依赖**：`dependencies` 为空。
- 允许使用 DSH 宿主提供的运行时包：`@deepseek-ai/schemastery`（Config）、`@deepseek-ai/dsh-tools`（`defineTool`）、`@deepseek-ai/dsh-session`（`appendPluginRecord`）、React 及 DSH Client 模块（由前端模块表提供）。它们不打进 bundle。
- 开发依赖仅：`typescript`、`esbuild`、`@types/node`、`@types/react`、`@deepseek-ai/dsh-tools`/`@deepseek-ai/dsh-session`（类型/测试），以及 §5.3 的类型包。
- 不引入：`zod`（手写 2KB 级校验足够）、`axios`、`express`、`ws`、`pino`、`dotenv`、`date-fns`、`nanoid`（`crypto.randomUUID`）、`lodash`。
- 不依赖 Server酱³ SDK：官方只有 HTTP API；自己封一个 100 行适配器更可控。
- 不用 `npm`/`yarn`：仓库/profile 都用 pnpm；提交 `pnpm-lock.yaml`（代码开始后）。

## 8. 配置与部署

### 8.1 配置形态

配置通过 Cordis 插件行传入（与 DSH bundle 规范一致）。示例见 [architecture.md](architecture.md) §9；关键字段：

- `publicBase`：schema 必填；bundle patch 默认 `https://dsh.allenyou.top/`，可在配置卡修改。
- `transport`：`serverchan3` / `dryRun`（默认 `dryRun`，首次安装不误发）。
- `serverchan3.appPackage/fallbackUrl`：有默认值；`uid` 从 SendKey 解析。
- SendKey：**不写配置**；在配置卡输入，Host 存 DSH credentials（`dsh-mobile-notify/serverchan3`）。配置卡只回传 `{configured,writable,available}`，不回传值。
- 图形配置：`/mobile/settings` GET/PUT + `configEditor`；普通字段保存会重启插件。SendKey 写入/清除也走该 API。
- `serverchan3.tags.*`：`enabled`、`namespace`、`includeNamespace`、`includeKind`、`kindTags`、`extra`；默认 `dsh` + `dsh-<kind>`（含 `dsh-notice`），只做低基数分组。
- **TAG 的用法**：官方 API 的 `tags` 是 `|` 分隔的字符串，App 会按消息自动聚合 Tag、允许过滤/阅读偏好，但不能手工改名/删除；所以只用稳定、低基数的分组，不用会话名/原因/sessionId。细节见 [architecture.md](architecture.md) §8.3。
- `notify.*`：事件开关、`modelTool`（是否注册 `mobile_notify`）、`turnDone`（全局默认）、`debounceMs`、`graceMs`、`detail`、`inPageCountsAsDelivered`、`webNotification`、`inPage`。
- 按对话 turnDone：不属于 Config；通过 `PUT /mobile/session-settings` 写 Session 插件记录，未设置时跟随全局 `notify.turnDone`。
- `privacy.*`：会话标题/原因/工具名是否进入摘要。
- `limits.*`：body 大小、限流、推送超时/重试/每分钟上限。

### 8.2 安装与部署

```bash
pnpm install
pnpm build
dsh plugin --profile <profile> add /absolute/path/to/dsh-mobile-notify
# 重启 DSH Web；浏览器刷新
```

- 本地目录安装时 `lib/` 必须已构建；`.gitignore` 忽略 `lib/`，不要从干净 checkout 直接安装。
- 目标 profile 中停用/移除 `dsh-web-ui-notify`；两者并存会重复通知。
- **必须用本地路径安装**；不要按包名从 registry 安装，以免拿到同名社区包 `dsh-mobile-notify`。
- 先 `transport: dryRun` 验证 presence/ack/浮动提醒卡，再切 `serverchan3` 做真实推送；发一次测试推送让 `dsh`/`dsh-test` Tag 出现在 App 侧栏，再设置 Tag 过滤/阅读偏好。
- nginx：整个 `/mobile/` 前缀（至少 bootstrap/config/presence/ack/push/test/health）走现有 oauth2-proxy；不需要 SSE 的 `proxy_buffering off`，不新增长连接配置。若现有代理只精确匹配了旧路径，需要补上新增路径。
- `publicBase` 必须是外部 origin；不要填 `http://127.0.0.1:...`（除非本地开发）。
- DSH 必须只绑 loopback；`/mobile/bootstrap` 不能直接暴露公网。

### 8.3 升级/回滚

- DSH 升级：先改 `engines.dsh` 并跑 `pnpm check` + 手工验收；Client API 变化可能导致只读字段/插槽失效。0.2.3 起 `uiSession.sessionStatus` 改由独立 Client 包提供，已加入 `dsh.client.inject` 与模块 inject。
- 插件回滚：停用本插件、重新启用 `dsh-web-ui-notify`（或什么都不用）；本插件不持久化数据，无需迁移。
- 配置泄漏/换 SendKey：只改 Host 配置并重启；已发出的历史推送无法撤回。

## 9. 安全

| 面 | 选择 |
|---|---|
| 传输 | 仅 HTTPS（部署由 nginx 终止；插件不处理证书） |
| 认证 | DSH 浏览器 Cookie + Origin；`webServer.register` 的 `auth: 'required'`；不引入设备令牌 |
| Origin | 依赖 DSH 的 Host/Origin 校验；不自己解析 Cookie；不开 CORS |
| Body | 2KB 上限、JSON only、对象 only、枚举/长度/字符集校验 |
| 限流 | clientId + 远端地址；429 + `Retry-After` |
| 秘密 | SendKey 只在 Host 配置；不进客户端、日志、通知、health/config |
| 深链 | 只带 `sessionId`/`kind`/`requestId`；不读任意 extras；sessionId 长度/字符集校验 |
| 推送内容 | 默认摘要；`generic` 无会话名/原因/工具名；不含代码/参数/全文；无审批动作 |
| 推送 TAG | 只放配置的稳定分组（namespace/kind/extra）；不放会话名/原因/sessionId/SendKey；第三方可见 |
| 日志 | 只打短 sessionId、kind、delivered、状态码；不打 body/Cookie/SendKey |
| 错误 | 对外统一错误码，不回传上游响应体/堆栈 |
| 常驻 | Host 无常驻连接；Client 仅可见时 10s 心跳；隐藏停止 |
| bootstrap | 硬前提：nginx oauth2 + DSH loopback；文档反复强调，代码无法替代部署 |

## 10. 兼容性

| 组件 | 版本/假设 | 失败时 |
|---|---|---|
| DSH | `0.2.3-alpha.2` | `engines.dsh` 阻止安装/激活；升级后回归 `uiSession.sessionStatus`、slot、webServer 路由准入 |
| Node | `^24.22.3 || >=26.13.1` | 启动前检查；低版本直接报错 |
| Android Shell | `0.1.x`，契约 v1 | 页面仍可加载；`window.__dshMobile` 缺失时 Shell 只打开首页；不崩 |
| Server酱³ App | 1.1.7+（`scopen` 支持） | 无凭据/上游失败时只写日志，Web 路径不受影响 |
| 浏览器 | 支持 `Notification`/`fetch`/`visibilityState` | `Notification` 缺失 → presence `unsupported` + ack false → 回退手机 |
| oauth2-proxy | 现有 `/mobile/*` 路由 | 未保护则不要启用；部署检查项 |
| 旧插件 | `dsh-web-ui-notify` | 必须停用；不自动迁移设置 |

## 11. 代码组织与质量门禁

- 目录见 [goals.md](goals.md) §4；Host/Client 不互相 import 对方的运行时代码，只共享 `src/shared`/`src/contract.ts` 的类型和纯函数。
- 风格：2 空格、单引号、无分号、尾逗号；与本地 DSH 插件一致。注释解释“为什么”，字段/函数名英文；UI 文案走 locale。
- v1 不引入 ESLint/Prettier（减少配置面）；以 `tsc --strict` + review 为准。若后续多人协作，再补 lint，不作为当前门禁。
- 质量门禁：

  ```bash
  pnpm typecheck   # link-types + tsc --noEmit（src + test）
  pnpm test        # node --test
  pnpm build       # esbuild 两产物
  pnpm check       # 以上三步
  ```

- Git：`main` 分支；conventional commits（`docs:`/`feat:`/`fix:`/`test:`/`chore:`）；不提交 `lib/`、`node_modules/`、Secrets、profile 路径。

## 12. 被否方案

| 方案 | 否决理由 |
|---|---|
| FCM | 目标机无 GMS；大陆网络不可靠；DECISION 已排除 |
| Mi Push SDK | 个人侧载/无企业资质无法使用；只为自用上架不划算 |
| WorkManager 15 分钟轮询 | 延迟不可接受、Doze/HyperOS 更慢；还要保活设置 |
| SSE/FGS/“实时模式” | 常驻连接/前台服务正是要避免的耗电项 |
| Web Push/Service Worker | DSH PWA 没有 SW，Android WebView 不支持；页面关闭后不可用 |
| 微信/企微/飞书 relay | 通知不在 DSH/Server酱³，深链弱；v1 只做 Server酱³ |
| 直接 fork 社区 `dsh-mobile-notify` | Host-only、turn-done 导向、无审批/提问/pending/深链；Server酱是 Turbo 不是³ |
| 以 `dsh-web-ui-notify` 为基座 | 只有 Web Notification，没有 Host 路由/presence/ack/Server酱³/桥；可复用局部代码但不继承架构 |
| 拆成 `host`/`client` 两个 npm 包 | 安装/版本/协议同步成本高；单包足够 |
| 用 monorepo 管 Shell + 插件 | 两仓库独立构建/签名/发布更清晰；契约耦合而非代码耦合 |
| `zod` 做请求校验 | 2KB 级手写校验足够；避免运行时依赖 |
| `express`/`koa` | 只需 8 个精确路由；DSH 已提供 webServer |
| `axios`/`undici` | Node 24 自带 fetch；一次 JSON POST 不需要库 |
| Vitest/Jest/jsdom | Node 测试足够；客户端只测纯函数；真机/浏览器留给 M3 |
| CSS Modules/lightningcss | 两个小 UI 面，内联样式 + 主题变量足够；少一条构建链 |
| deviceToken/`/mobile/pair` | Client 在已认证页面内运行，DSH Cookie 已足够；减少秘密与攻击面 |
| FastPush 零点击拉起 | 会打断当前操作；不是默认行为 |
| 在通知里批准/拒绝 | 必须看上下文；安全边界 |
| 每会话/每原因动态 TAG | Server酱³ Tag 自动聚合且不能手工改名/删除，会膨胀侧栏并泄露会话信息 |
| Playwright 作为 v1 门禁 | 环境/账号/真机依赖重；手工清单更诚实 |

## 13. 许可与第三方代码

- 仓库私有自用；没有明确开源计划前不添加 `LICENSE` 声明为某开源许可证，`package.json` 用 `"private": true`。
- 若复用 `dsh-web-ui-notify`（BSD-3-Clause）的 `notify.ts`/配置 UI 代码：保留原版权头、在文件与 README 标注来源和许可证；修改处注明。
- 社区 `dsh-mobile-notify` 只读参考，不复制代码；如确有复制，逐文件保留 MIT 声明并记录。
- 图标必须原创或使用允许再分发的素材，并保留归属；不直接拿 DSH/Server酱³ 的商标图标。
- Server酱³、DSH、Zitadel 的名称/商标只用于事实描述，不暗示官方背书。
