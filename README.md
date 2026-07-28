# 🗺️ 漫游手账 · 旅行规划与记录

一款活泼多彩的**个人旅行 / 差旅 / 周末出行**行程规划与记录全栈网页应用。
支持行程规划、每日安排、预算花销管理、旅行手账记录，并内置 **AI 行程推荐** 与 **灵感发现**（小红书风格）功能。

![tech](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![tech](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![tech](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![tech](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![deploy](https://img.shields.io/badge/Deployed%20on-Render%20%2B%20Neon-46E3B7?logo=render&logoColor=white)

---

## 📸 界面预览

### 🏠 旅行仪表盘
> 一览旅行总数、去过城市、累计花费，卡片墙展示所有旅程

![仪表盘](docs/screenshots/01-dashboard.png)

### 📅 旅行详情 · 每日规划
> 按天安排行程，景点/餐饮/交通/住宿分类展示，支持一键打卡完成

![旅行详情](docs/screenshots/02-trip-detail.png)

### 💸 预算花销
> 预算 vs 实际花费对比，剩余额度实时显示

![预算花销](docs/screenshots/03-budget.png)

### 🤖 AI 行程规划
> 输入目的地、天数和偏好，一键生成完整行程方案

![AI规划](docs/screenshots/04-ai-planner.png)

### 🔥 灵感发现
> 小红书风格瀑布流，收藏目的地灵感，支持关键词搜索

![灵感发现](docs/screenshots/05-discover.png)

---

## ✨ 功能特性

| 模块 | 说明 |
|------|------|
| 🧳 **旅行管理** | 创建/编辑/删除旅行，支持旅行、差旅、周末三种类型，自定义封面色与图标 |
| 🏠 **仪表盘** | 旅行卡片墙、统计概览（旅行总数、去过城市、累计花费、已完成数） |
| 📅 **每日规划** | 按天安排行程项（景点/餐饮/交通/住宿/会议等），支持打卡完成 |
| 💸 **预算花销** | 预算 vs 实际花费可视化，分类汇总，超支提醒 |
| 📝 **旅行记录** | 图文手账、心情记录，瀑布流展示 |
| 🤖 **AI 行程规划** | 输入目的地/天数/偏好，一键生成行程并可保存为正式旅行 |
| 🔥 **灵感发现** | 小红书风格的目的地灵感卡片，支持关键词搜索 |

---

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + React Router + Zustand
- **后端**：Node.js + Express + TypeScript + Zod 校验
- **数据库**：PostgreSQL（通过 [pg](https://node-postgres.com/) 驱动连接，推荐搭配 [Neon](https://neon.tech) 永久免费云数据库）
- **AI**：兼容 OpenAI 接口规范（可接入 OpenAI / DeepSeek / 通义千问 等），未配置 Key 时自动使用内置智能 Mock

> 💡 **关于数据库选型**：本项目使用标准 PostgreSQL，可搭配 Neon / Supabase 等永久免费的云数据库服务，
> 也可自建 Postgres 实例，具备完整的关系型数据库能力与更好的生产环境持久性保障。

---

## 📁 项目结构

```
travel-planner/
├── client/                  # 前端（React + Vite）
│   └── src/
│       ├── api/             # 接口封装
│       ├── components/      # 通用组件（Layout/Modal/Toast/各表单）
│       ├── pages/           # 页面（Dashboard/TripDetail/AiPlanner/Discover）
│       ├── store/           # Zustand 状态管理
│       ├── types/           # TS 类型定义
│       └── utils/           # 工具函数与常量
├── server/                  # 后端（Express）
│   └── src/
│       ├── db/              # sql.js 封装、数据访问层、种子数据
│       ├── routes/          # 路由（trips/activities/expenses/notes/ai）
│       ├── services/        # AI 推荐、灵感发现服务
│       └── lib/             # Zod 校验
├── package.json             # 根脚本（一键启动前后端）
└── README.md
```

---

## 🚀 快速开始

### 1. 环境要求
- Node.js >= 18
- npm >= 9

### 2. 安装依赖

```bash
# 在项目根目录一键安装前端 + 后端 + 根依赖
npm run install:all
```

### 3. 初始化数据库（写入示例数据）

```bash
npm run db:setup
```

### 4. 配置环境变量（必填：数据库连接）

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，配置 PostgreSQL 连接串（必填）：

```ini
# 推荐用 Neon（https://neon.tech）免费创建一个 PostgreSQL 数据库，复制其连接串
DATABASE_URL="postgresql://用户名:密码@主机:端口/数据库名?sslmode=require"
```

如需启用真实 AI 推荐，可继续编辑：

```ini
AI_API_KEY="你的-api-key"
AI_BASE_URL="https://api.openai.com/v1"   # 也可填 DeepSeek / 通义等兼容地址
AI_MODEL="gpt-4o-mini"
```

> 不配置 AI Key 也能正常使用，AI 推荐会返回内置的智能示例行程；但 `DATABASE_URL` 是必填项，服务启动时会校验。

### 5. 启动开发环境

```bash
# 同时启动前端(5173)和后端(4000)
npm run dev
```

打开浏览器访问 👉 **http://localhost:5173**

---

## 📜 可用脚本（根目录）

| 命令 | 说明 |
|------|------|
| `npm run install:all` | 安装所有依赖 |
| `npm run db:setup` | 初始化数据库并写入示例数据 |
| `npm run dev` | 同时启动前后端开发服务器 |
| `npm run dev:server` | 仅启动后端 |
| `npm run dev:client` | 仅启动前端 |
| `npm run build` | 构建前端生产包 |

---

## ☁️ 云端部署（Render + Neon，永久免费）

本项目采用 **Render 免费 Web Service + Neon 免费 PostgreSQL** 的组合部署，两者均提供长期免费额度（无到期时间限制），
采用**全栈单服务**方式：Express 后端在生产环境同时托管前端构建产物（`server/public`），只需一个服务即可运行。

### 部署架构

```
Render Web Service（免费档）
└── Docker 容器
    ├── 构建阶段：npm install + vite build + tsc
    └── 运行阶段：node server/dist/index.js
        ├── GET  /api/*         → Express API 路由（数据读写至 Neon PostgreSQL）
        └── GET  /*             → 托管 server/public（前端 SPA）

Neon（免费档 PostgreSQL）
└── 独立于 Web Service 之外，长期免费保存数据，不随容器重启/重新部署而丢失
```

### 部署步骤

1. **创建 Neon 数据库**：访问 [neon.tech](https://neon.tech) 注册并创建一个免费项目，复制生成的连接串（形如 `postgresql://user:pass@xxx.neon.tech/dbname?sslmode=require`）。

2. **创建 Render Web Service**：访问 [render.com](https://render.com)，选择 *New + → Web Service*，连接本项目的 Git 仓库，Environment 选择 `Docker`（会自动识别根目录的 `Dockerfile`）。

3. **配置环境变量**：在 Render 的 Environment 设置中添加：
   - `DATABASE_URL`：第 1 步复制的 Neon 连接串
   - `NODE_ENV`：`production`
   - 其他可选变量（`AI_API_KEY`、`ACCESS_CODE` 等）按需配置，见 `server/.env.example`

4. **首次部署后初始化数据（可选）**：如需写入示例数据，可在本地把 `DATABASE_URL` 临时指向同一个 Neon 数据库，执行 `npm run db:setup`。

5. 推送代码到 Git 仓库后，Render 会自动触发重新构建部署；免费档 15 分钟无请求会休眠，下次访问时自动唤醒（有几秒延迟属正常现象）。

> 💡 数据库与 Web 服务解耦部署的好处：Web Service 容器可以随意重启、重新部署甚至重建，Neon 中的数据完全不受影响。

---

## 🔌 API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/trips` | 旅行列表 |
| GET | `/api/trips/stats/overview` | 仪表盘统计 |
| GET | `/api/trips/:id` | 旅行详情（含子数据） |
| POST/PUT/DELETE | `/api/trips/:id` | 旅行增改删 |
| * | `/api/trips/:tripId/activities` | 行程项 CRUD |
| * | `/api/trips/:tripId/expenses` | 花销 CRUD |
| * | `/api/trips/:tripId/notes` | 记录 CRUD |
| POST | `/api/ai/recommend` | AI 行程推荐 |
| GET | `/api/ai/inspirations` | 灵感发现卡片 |

---

## 🔮 后续可扩展

- 接入真实地图（高德/Google Maps）展示行程路线
- 行程导出 PDF / 分享链接
- 多用户登录与云端同步（切换 PostgreSQL）
- 接入合规的内容数据源替换灵感发现 Mock
- 图片上传与相册功能

---

## 📄 License

MIT
