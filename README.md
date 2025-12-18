# Omniknight - Telegram 群组 AI 总结系统

> 🤖 自动监听 Telegram 群组消息,使用 AI 定期生成高质量的结构化总结,并在 Web Dashboard 上聚合展示。

## 特性

- ✅ **按需拉取消息** - 使用 GramJS Userbot 拉取任意已加入群组的历史消息
- ✅ **智能过滤** - 自动过滤无价值消息(短消息、纯表情、广告等)
- ✅ **多 AI 支持** - 支持 Mock、OpenAI、Deepseek、Gemini 等
- ✅ **异步任务** - 后台生成总结,实时进度反馈
- ✅ **定时调度** - 按群组配置自动定期生成总结
- ✅ **Web Dashboard** - React 前端,可视化查看总结和管理群组
- ✅ **浏览器推送通知** - 任务完成/失败时通过 Web Push 推送通知,即使浏览器在后台也能收到

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
# 编辑 apps/backend/.env 填写配置
```

必需配置:
```bash
# Telegram API (https://my.telegram.org)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash

# AI Provider
AI_PROVIDER=deepseek  # mock | openai | deepseek | gemini
AI_API_KEY=sk-xxxxx
AI_API_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

可选配置 (Web Push 浏览器推送通知):
```bash
# 1. 生成 VAPID 密钥
cd apps/backend && pnpm exec web-push generate-vapid-keys --json

# 2. 将生成的密钥添加到 .env
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@example.com
```

### 3. 初始化 Telegram

```bash
cd apps/backend
pnpm setup
```

按提示输入手机号、验证码,选择要监听的群组。

### 4. 启动服务

**后端** (终端1):
```bash
pnpm --filter @omniknight/backend dev
# http://localhost:3000
```

**前端** (终端2):
```bash
pnpm --filter @omniknight/web dev
# http://localhost:5173
```

## 常用命令

```bash
# 开发
pnpm dev                          # 启动所有服务
pnpm --filter @omniknight/backend dev   # 仅启动后端
pnpm --filter @omniknight/web dev       # 仅启动前端

# 停止服务
pnpm stop                         # 停止所有
pnpm stop:backend                 # 停止后端
pnpm stop:web                     # 停止前端

# 数据库
pnpm db:studio                    # 打开 Drizzle Studio
pnpm db:push                      # 推送 schema 变更

# 代码质量
pnpm format                       # 格式化代码
pnpm check                        # 检查代码

# 构建
pnpm build                        # 构建所有包
```

## API 示例

### 查看群组列表

```bash
curl http://localhost:3000/api/groups
```

### 手动生成总结 (异步)

```bash
curl -X POST http://localhost:3000/api/summaries/generate \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": 1,
    "periodStart": "2025-12-14T00:00:00Z",
    "periodEnd": "2025-12-14T23:59:59Z"
  }'

# 返回: { "data": { "jobId": 123 } }
```

### 查询任务状态

```bash
curl http://localhost:3000/api/summaries/jobs/123
```

### 查看总结列表

```bash
curl "http://localhost:3000/api/summaries?groupId=1&limit=10"
```

## 技术栈

- **Monorepo**: Turborepo + pnpm
- **后端**: Node.js v24, Hono, Drizzle ORM, GramJS
- **数据库**: SQLite (better-sqlite3)
- **AI**: OpenAI 兼容 API (Deepseek/GPT-4o/Gemini)
- **前端**: React 18 + Vite, shadcn/ui, TanStack Query

## 项目结构

```
omniknight/
├── apps/
│   ├── backend/           # 后端服务
│   └── web/               # 前端应用
├── packages/
│   ├── db/                # 数据库 Schema
│   └── shared/            # 共享类型
└── docs/                  # 文档
    ├── 实现详解.md        # 完整的技术实现讲解
    └── 前端任务监控实现总结.md
```

## 文档

- [实现详解](./docs/实现详解.md) - 完整的系统架构和技术实现讲解
- [前端任务监控实现总结](./docs/前端任务监控实现总结.md) - 前端任务监控功能详解

## 重要提示

### Telegram Userbot 风险

- ⚠️ **使用测试账号**: 强烈建议使用小号进行开发
- ⚠️ **可能违反 ToS**: Userbot 可能违反 Telegram 服务条款
- ⚠️ **封号风险**: 频繁操作可能导致账号被封
- ✅ **限流保护**: 系统内置自适应限流,降低风险

### 为什么使用 Userbot?

官方 Bot API 限制:
- ❌ 无法读取非管理员群组的历史消息
- ❌ 只能接收加入后的新消息

Userbot (GramJS) 优势:
- ✅ 可以拉取任何已加入群组的历史消息
- ✅ 无需管理员权限
- ✅ 完整的 TypeScript 支持

## License

MIT

---

**注意**: 本项目仅供学习和个人使用。使用 Telegram Userbot 需遵守 Telegram 服务条款,请谨慎使用。
