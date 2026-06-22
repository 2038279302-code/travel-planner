# 🗺️ 漫游手账 · 旅行规划与记录

一款活泼多彩的**个人旅行 / 差旅 / 周末出行**行程规划与记录全栈网页应用。
支持行程规划、每日安排、预算花销管理、旅行手账记录，并内置 **AI 行程推荐** 与 **灵感发现**（小红书风格）功能。

🌐 **在线体验** → [https://laudable-acceptance-production-182e.up.railway.app](https://laudable-acceptance-production-182e.up.railway.app)

![tech](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![tech](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![tech](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![tech](https://img.shields.io/badge/SQLite-sql.js-003B57?logo=sqlite&logoColor=white)
![deploy](https://img.shields.io/badge/Deployed%20on-Railway-7B2FBE?logo=railway&logoColor=white)

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
- **数据库**：SQLite（基于 [sql.js](https://github.com/sql-js/sql.js)，纯 JS/WASM，零原生依赖，数据持久化到 `server/data/travel.db`）
- **AI**：兼容 OpenAI 接口规范（可接入 OpenAI / DeepSeek / 通义千问 等），未配置 Key 时自动使用内置智能 Mock

> 💡 **关于数据库选型**：本项目使用 `sql.js`（SQLite 的 WebAssembly 版本）作为数据库引擎，
> 无需任何原生编译或外部二进制下载，在任意环境中都能开箱即用，同时保留了完整的关系型数据库能力。

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

### 4. 配置环境变量（可选）

```bash
cp server/.env.example server/.env
```

如需启用真实 AI 推荐，编辑 `server/.env`：

```ini
AI_API_KEY="你的-api-key"
AI_BASE_URL="https://api.openai.com/v1"   # 也可填 DeepSeek / 通义等兼容地址
AI_MODEL="gpt-4o-mini"
```

> 不配置 Key 也能正常使用，AI 推荐会返回内置的智能示例行程。

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

## ☁️ Railway 云端部署

本项目已部署在 [Railway](https://railway.app)，采用**全栈单服务**方式：Express 后端在生产环境同时托管前端构建产物（`server/public`），只需一个服务即可运行。

### 部署架构

```
Railway 单服务
└── Docker 容器
    ├── 构建阶段：npm install + vite build + tsc
    └── 运行阶段：node server/dist/index.js
        ├── GET  /api/*         → Express API 路由
        └── GET  /*             → 托管 server/public（前端 SPA）
```

### 重新部署步骤

```bash
# 安装 Railway CLI（首次）
curl -fsSL https://railway.app/install.sh | sh

# 登录
railway login

# 部署（在项目根目录）
railway up
```

> 每次推送代码后运行 `railway up` 即可更新线上版本。

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
