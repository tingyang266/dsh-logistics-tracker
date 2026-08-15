# dsh-logistics-tracker

> DeepSeek Harness（DSH）插件 · 授权后聚合查询拼多多 / 淘宝 / 抖音等电商平台的商品快递物流信息

个人买家输入运单号即可跨平台查轨迹，无需绑定店铺；对话与面板双形态，快递鸟 / 快递100 双通道自动识别承运商。

## ✨ 特性

- 🔍 **跨平台聚合**：一个 key 覆盖拼多多 / 淘宝 / 抖音等平台的所有快递公司，自动识别承运商
- 💬 **对话式查询**：直接说「帮我查一下运单号 xxx 的物流」，AI 自动调用 `logistics_trace` / `logistics_detect` 工具
- 📦 **侧边栏面板**：侧边栏底部「📦 查物流」入口，点击展开面板即可查询，无需经过对话
- 🔐 **密钥安全**：密钥只存在宿主侧（`.credentials.yaml`），浏览器面板经宿主 HTTP 路由查询，不接触任何密钥
- 🏷️ **状态归一**：各快递状态码统一收敛为 暂无 / 已揽收 / 运输中 / 派送中 / 已签收 / 问题件 / 已退回

> 为什么用聚合物流而非平台官方接口？拼多多 / 淘宝 / 抖店官方开放平台的物流接口都是**商家侧**的（需开发者账号 + 应用审核 + OAuth 授权店铺），不面向个人买家。聚合物流一个 key 覆盖三家平台所有快递公司。

## 📁 目录结构

```
dsh-logistics-tracker/
├── package.json          # dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml      # bundle 补丁：把本插件挂到 profile 插件树
├── src/
│   ├── index.js          # 宿主插件：注册工具 + HTTP 路由
│   ├── service.js        # 物流服务编排（工具与面板共用）
│   └── providers/
│       ├── constants.js  # 状态码 / 快递公司名映射
│       ├── kdniao.js     # 快递鸟适配器（MD5+Base64+URLEncode 签名）
│       └── kuaidi100.js  # 快递100适配器（MD5 大写签名 + 免费单号识别）
├── client/
│   └── client.js         # 浏览器侧查询面板（注入 sidebar.footer.action 槽位）
└── README.md
```

## 🔑 获取密钥（授权）

二选一即可，都填则按 `provider` 配置优先使用。

| 服务商 | 获取方式 |
|---|---|
| **快递鸟** | 注册 <https://www.kdniao.com/> → 会员中心 → 我的应用，拿 EBusinessID + API Key |
| **快递100** | 注册 <https://www.kuaidi100.com/openapi/> → 企业管理后台 → 授权信息，拿 customer + key |

把密钥写进 `$DSH_HOME/.credentials.yaml`（Windows 默认 `C:\Users\<你>\.dsh\.credentials.yaml`）：

```yaml
KDNIAO_EBUSINESS_ID: 你的EBusinessID
KDNIAO_APP_KEY: 你的AppKey
# 或
KUAIDI100_CUSTOMER: 你的customer
KUAIDI100_KEY: 你的key
```

> 也可用环境变量 `KDNIAO_EBUSINESS_ID` / `KDNIAO_APP_KEY` / `KUAIDI100_CUSTOMER` / `KUAIDI100_KEY`，或在 `cordis.patch.yml` 里直接写明文（不推荐）。

> ⚠️ **安全提醒**：`.credentials.yaml` 和密钥**切勿提交到 GitHub**，请务必加入 `.gitignore`。本仓库不包含任何密钥。

## 📦 安装

```bash
# 用你本机已内置 dsh 的桌面端 CLI（--profile web 指定 web profile）
dsh plugin --profile web add file:/绝对路径/dsh-logistics-tracker
```

安装后重启桌面端即可。验证是否挂载：

```bash
dsh --profile web --dump-config | grep -A6 logistics-tracker
```

## 🚀 使用

**对话式**（AI 自动调用工具）：

```
帮我查一下运单号 SF1234567890123 的物流到哪了
```

**面板式**：侧边栏底部的「📦 查物流」入口，点击展开面板后直接输入运单号查询（无需经过对话）。侧边栏收起时入口显示为 📦 图标，点击后以浮层形式展开。

## ⚙️ 技术要点

- 插件是标准 Cordis 插件：`{ name, inject: ['tools'], apply(ctx, config) }`，通过 `ctx.tools.register(defineTool({...}))` 注册工具，卸载自动回滚。
- 密钥经 credentials seam（`ctx.get('credentials').resolve(ref)`）解析，浏览器面板只读宿主 HTTP 路由，不接触密钥。
- 签名：快递鸟 `DataSign = URLEncode(Base64(MD5(RequestData + AppKey)))`；快递100 `sign = MD5(param + key + customer).toUpperCase()`。
- 状态码收敛为统一枚举：暂无 / 已揽收 / 运输中 / 派送中 / 已签收 / 问题件 / 已退回。

## 📝 已知限制

- 官方平台买家侧无接口，查询依赖聚合物流；顺丰等个别快递需手机号后四位。
- 高频查询请留意快递鸟 / 快递100 的免费额度与 QPS 限制。

## 📄 License

[MIT](./LICENSE) © 2026 [你的名字]
