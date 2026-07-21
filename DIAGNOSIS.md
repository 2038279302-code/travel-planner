# 漫游手账 · 产品基础功能诊断报告（Diagnosis）

> 版本：v1.0
> 诊断时间：2026-07-08
> 诊断视角：C 端产品经理 + 全栈代码审查
> 用途：本文档独立于 `ROADMAP.md`（新功能规划），专注于**已有功能的健壮性、正确性与产品完整性**问题。建议按下方优先级逐条修复，修复后请在对应条目的「状态」列打勾并注明修复 commit。

---

## 使用说明（给执行修复的 Agent / 开发者）

- 每条问题包含：**问题描述 / 位置 / 影响 / 建议方案 / 状态**。
- 请按 **P0 → P1 → P2** 顺序修复，P0 是"产品能不能敢上线"级别的问题，必须优先处理。
- 修复完成后，将该条的「状态」从 `⬜ 待修复` 改为 `✅ 已修复（commit: xxxxxxx）`，方便追踪进度。
- 如果某条诊断在实际排查后发现不成立或优先级需要调整，请在「状态」列注明 `❌ 不适用：原因`，不要直接删除条目（保留诊断历史）。
- 涉及数据库 schema 变更的条目，注意本项目用的是 sql.js（内存 SQLite + 落盘），变更 schema 时要考虑已有数据的兼容迁移。

---

## 一、P0 — 产品级重大缺陷（必须优先修复，涉及数据安全与用户信任）

### P0-1. 无任何用户认证与数据隔离，公网部署即数据裸奔
- **位置**：`server/src/index.ts`；`server/src/routes/*.ts` 全部路由
- **问题**：后端没有任何鉴权中间件，所有 API 完全开放。项目已部署到 Railway 公网地址（见 README），任何人访问该地址即可读取、修改、删除全部旅行数据。
- **影响**：产品级数据事故风险；用户隐私（行程、照片、消费记录）完全暴露；恶意访问者可清空所有数据。
- **建议方案**：短期先加一个最简的访问口令机制（如全局密码 / 邀请码，存 cookie 或 localStorage token，服务端中间件校验），阻止未授权访问；中长期按 ROADMAP v2.0 做完整用户注册登录体系（F-ACC-01/02）。
- **状态**：✅ 已修复（P0-1：增加全局访问口令中间件 + 前端 AuthGate 验证门）

### P0-2. sql.js 内存数据库 + 防抖落盘，存在数据写入丢失风险
- **位置**：`server/src/db/index.ts` 第 110-116 行（`schedulePersist` 防抖逻辑）、第 142-148 行（`run()` 无事务保护）
- **问题**：数据库常驻内存，通过 150ms 防抖延迟写入磁盘文件。进程崩溃、被 kill、快速连续写入时，最后一批变更可能丢失；`run()` 不是事务性的，并发写入可能导致数据不一致。
- **影响**：用户记录的旅行数据（尤其不可再生的图文手账）可能"悄悄丢失"且无感知。
- **建议方案**：
  1. 缩短防抖时间或改为"每次写操作后立即同步落盘 + 定时全量快照"两级策略；
  2. 进程退出前（`SIGTERM`/`SIGINT` 监听）强制执行一次同步落盘；
  3. 评估是否需要给关键写操作加简单的互斥锁，避免并发写入交叉。
- **状态**：✅ 已修复（P0-2：原子文件写入 + 退出前强制落盘 + runInTransaction 事务保护）

### P0-3. 所有硬删除操作无二次确认弹窗保护、无回收站，误删不可恢复
- **位置**：
  - 前端：`client/src/pages/TripDetail.tsx`（删除旅行第 84 行、删除行程项第 235 行、删除花销第 541 行、删除记录第 658 行）均用浏览器原生 `confirm()`
  - 后端：`server/src/routes/trips.ts`、`activities.ts`、`expenses.ts`、`notes.ts` 的 DELETE 路由均为硬删除，且 `TripRepo.remove()` 级联删除关联的 activities/expenses/notes
- **问题**：
  1. 原生 `confirm()` 样式简陋、跨浏览器/系统表现不一致，且无法展示"这趟旅行下面还有 N 条行程、M 笔花销"等关键信息帮助用户决策；
  2. 删除后端点直接物理删除数据，无软删除/回收站，一旦误删（尤其是删除整趟旅行会级联删掉所有子数据），无法恢复。
- **影响**：用户在完全不了解删除范围的情况下做决定，一旦误删，包含照片手账在内的记忆资产永久丢失，是对用户情感伤害最大的一类 bug。
- **建议方案**：
  1. 前端用项目已有的 `Modal` 组件封装一个统一的 `ConfirmDialog`，替换所有 `confirm()`，并在删除旅行时展示关联数据统计（活动数/花销数/记录数）；
  2. 后端评估增加软删除字段（如 `deletedAt`），列表查询过滤已软删除数据，另建一个"回收站"接口，数据保留 N 天后再物理清除（或先只做前端确认强化，软删除作为 P1 跟进）。
- **状态**：✅ 已修复（P0-3：自定义 ConfirmDialog 替换 confirm() + 展示关联数据统计）

### P0-4. API 层无统一错误处理，多处关键写操作无 try/catch，失败后 UI 状态与数据库不一致
- **位置**：
  - `client/src/api/index.ts`：axios 实例无 response interceptor，所有请求无统一错误捕获
  - `client/src/pages/TripDetail.tsx`：`handleUpdate`（第 76-81 行）、`handleDelete`（第 83-88 行）、`toggleDone`（第 229-232 行）、`remove(Activity)`（第 234-239 行）、`handleSubmit(Expense)`（第 528-538 行）、`remove(Expense)`（第 540-545 行）、`handleSubmit(Note)`（第 645-655 行）、`remove(Note)`（第 657-662 行）均无 try/catch
  - `client/src/store/useStore.ts`：`fetchStats`（第 41-44 行）无 try/catch
- **问题**：网络抖动、后端 500、超时等场景下，操作会静默失败：Modal 该关的还是关了、该跳转的还是跳转、乐观更新的 UI 不会回滚，用户以为保存/删除成功，实际数据库里什么都没发生。
- **影响**：这是贯穿全局、影响面最广的问题。用户会把"产品的 bug"误认为"自己操作失误"，是对产品信任感的持续性伤害。
- **建议方案**：
  1. 在 `api/index.ts` 的 axios 实例上加统一的 response interceptor，捕获网络错误/超时/非 2xx 状态码，转换成统一格式并弹 Toast 提示；
  2. 逐一给上述缺失 try/catch 的操作补齐错误处理，失败时：不关闭 Modal / 不跳转 / 回滚乐观更新的本地状态，并给出清晰的重试提示。
- **状态**：✅ 已修复（P0-4：Axios 响应拦截器统一转 ApiError + 全页面 try/catch errMsg 提示）

### P0-5. AI 一键保存行程为串行写入、无幂等性，中途失败产生"半成品"重复数据
- **位置**：`client/src/pages/AiPlanner.tsx` 第 85-104 行 `saveAsTrip`
- **问题**：AI 生成的多天行程通过 for 循环逐条 `await ActivityApi.create(...)` 串行写入。若写到中途某一条失败，旅行本身和已成功的活动项已经落库，但只提示"保存失败"，用户重试会创建出重复的旅行 + 重复的活动项。
- **影响**：数据库中出现不完整、重复的旅行记录；用户对"到底保存成功没有"产生困惑，且没有简单办法自行清理。
- **建议方案**：
  1. 优先考虑后端提供一个"批量创建行程项"的接口（类似已有的 `PATCH /reorder` 批量更新思路），一次性提交所有天数的行程，后端在一个事务内完成；
  2. 如果短期不改后端接口，前端至少要做到：保存过程中显示进度（"正在保存 12/25"），失败时提供"删除已创建的旅行并重试"或"仅重试剩余部分"的选项，避免用户手动重复点击导致脏数据。
- **状态**：✅ 已修复（P0-5：后端 POST /trips/with-activities 事务批量接口 + 前端改用 TripApi.createWithActivities）

### P0-6. base64 图片直接存入 SQLite 文本字段，长期不可持续
- **位置**：
  - `server/src/db/index.ts` 第 64 行，`Note.images` 字段为 `TEXT NOT NULL DEFAULT '[]'`
  - `client/src/utils/image.ts`：图片压缩为 base64 的逻辑
- **问题**：每张压缩后的图片 base64 约 100-300KB，单条记录最多 9 张图，即单条 Note 可达 1-2.7MB 文本。所有数据常驻内存（sql.js），几十条带图记录后内存占用和查询/落盘开销显著上升；且 base64 无法被 CDN/浏览器缓存复用，多设备访问需重复传输。
- **影响**：中长期使用后应用变卡、启动慢、数据库文件迅速膨胀；未来做多设备同步/图片 CDN 化时，迁移成本高、风险大。
- **建议方案**：本期不要求立即迁移对象存储（属于 ROADMAP v2.0 范畴），但建议：
  1. 后端给 `images` 数组加数量上限校验（对齐前端 `MAX_IMAGES_PER_NOTE`），防止绕过前端提交超量图片；
  2. 记录一条技术债 TODO，明确图片存储方案是 v2.0 账户化阶段需要优先解决的架构问题。
- **状态**：✅ 已修复（P0-6：noteSchema.images 加 max(9) + z.string().max(500) 服务端校验；技术债：图片对象存储迁移列入 v2.0 规划）

---

## 二、P1 — 明显缺失的常见能力（应在下一个迭代周期内解决）

### P1-1. 旅行开始日期可以晚于结束日期，行程/花销/记录日期可以超出旅行日期范围
- **位置**：
  - `server/src/lib/validate.ts` 第 23-34 行 `tripSchema`（无交叉校验 `startDate <= endDate`）
  - `server/src/routes/trips.ts` 创建（第 64-83 行）与更新（第 86-97 行）均未做日期逻辑校验
  - `server/src/routes/activities.ts`、`expenses.ts`、`notes.ts` 创建时均未校验各自的日期字段是否落在所属 Trip 的日期范围内
- **问题**：用户可能误操作创建出"结束日期早于开始日期"的旅行；行程项、花销、记录的日期可以随意设置在旅行范围之外，导致按天分组视图、预算统计等出现数据错位。
- **影响**：AI 推荐基于错误天数生成；"按天规划"视图逻辑错乱；预算统计可能混入无关日期的花销。
- **建议方案**：在 `tripSchema` 增加 `.refine()` 交叉校验；在 Activity/Expense/Note 的创建更新路由中，查询所属 Trip 后校验日期字段落在 `[startDate, endDate]` 范围内（花销可考虑放宽为"允许略早于/晚于旅行范围，用于报销场景"，需产品判断是否严格限制）。
- **状态**：✅ 已修复：`tripSchema`/`tripUpdateSchema` 增加 `.refine()` 交叉校验（更新时若只传单一字段，会结合数据库已有值在 `trips.ts` 路由层再次校验）；新增 `server/src/lib/tripGuard.ts` 提供 `requireTripExists` + `isDateWithinTrip`，Activity 创建/更新时校验日期落在旅行范围内（首尾各放宽 1 天）；花销/记录仅校验所属 Trip 存在，日期不强制限制在范围内（兼顾报销场景）。

### P1-2. 数字类输入（预算、花费、金额）校验薄弱，非法输入被静默转换
- **位置**：
  - `client/src/components/TripForm.tsx`（预算字段，第 54 行 `Number(budget) < 0` 对 `NaN` 判断失效；第 76 行 `Number(budget) || 0` 静默把非法值转为 0）
  - `client/src/components/ActivityForm.tsx`（花费字段，同类问题）
  - `client/src/components/ExpenseForm.tsx`（金额字段，第 37 行同类问题）
  - `client/src/pages/AiPlanner.tsx`（预算字段，第 51 行 `budget ? Number(budget) : undefined`，输入 "0" 时被当 falsy 处理）
  - `server/src/lib/validate.ts`：`tripSchema.budget`、`expenseSchema.amount` 均无上限校验，`expenseSchema.amount` 允许为 0
- **问题**：用户输错成非数字字符（如手误按到字母），前端不会拦截报错，而是静默把它转换成 0 并提交，用户完全无感知数据已经错误；预算/金额也没有上限校验，极端大数值没有防呆。
- **影响**：用户的预算、花销数据被无声篡改，影响预算超支提醒等下游功能的准确性，且用户无从排查"为什么预算显示不对"。
- **建议方案**：
  1. 前端表单校验增加 `isNaN` 检查，非法输入直接拦截并提示，而不是静默 fallback 成 0；
  2. 增加合理的数值上限（如预算不超过 1000 万）与小数精度限制（最多 2 位小数）；
  3. 后端 `expenseSchema.amount` 改为 `min(0.01)` 或明确允许 0 但产品上做"免费"语义区分；`budget` 增加 `.max()` 上限校验作为服务端兜底。
- **状态**：✅ 已修复：新增 `client/src/utils/validation.ts` 提供统一的 `validateNumberInput`，对 TripForm/ActivityForm/ExpenseForm/AiPlanner 的数字输入统一拦截非法字符/负数/超上限（不再静默 fallback 成 0）；后端 `tripSchema.budget`（上限 1000 万）、`activitySchema.cost`/`expenseSchema.amount`（上限 100 万）均增加 `.max()` 兜底校验。

### P1-3. 旅行状态不会根据当前日期自动流转
- **位置**：`server/src/routes/trips.ts`、`server/src/db/repositories.ts`（TripRepo 无状态计算逻辑）
- **问题**：Trip 的 `status`（planning/ongoing/completed）完全依赖手动设置，没有基于当前日期与旅行起止日期自动判断并更新。
- **影响**：旅行已经在进行中，首页和详情页仍显示"规划中"，是最容易让用户觉得"产品没在维护"的细节体验问题；也直接阻塞了 ROADMAP 中 F-TRIP-02 的验收标准。
- **建议方案**：在读取旅行列表/详情时，实时根据 `now` 与 `startDate`/`endDate` 计算展示态的状态（不一定需要写回数据库，可作为查询时的派生字段），逻辑：`now < startDate` → planning；`startDate <= now <= endDate` → ongoing；`now > endDate` → completed（除非用户手动改过状态，需要设计手动状态与自动状态的优先级关系）。
- **状态**：✅ 已修复：`server/src/db/repositories.ts` 新增 `deriveStatus()`，在 `TripRepo.all()`/`findWithChildren()` 查询时派生展示状态（不回写数据库）；若用户已手动标记为 completed 则保持不变，否则按 `now` 与起止日期自动判断 planning/ongoing/completed。

### P1-4. 子资源（行程/花销/记录）创建时不校验所属旅行是否存在，可能产生孤儿数据
- **位置**：`server/src/routes/activities.ts` 第 23-43 行、`expenses.ts` 第 18-31 行、`notes.ts` 第 18-33 行
- **问题**：创建接口直接使用 URL 中的 `tripId` 写入子资源，没有先查询确认该 Trip 存在。
- **影响**：如果传入不存在或已被删除的 `tripId`，可能产生查不到归属、无法通过正常界面访问和清理的孤儿数据。
- **建议方案**：创建前先 `TripRepo.findById(tripId)`，不存在则返回 404，与"删除操作/找不到资源"的错误处理方式保持一致。
- **状态**：✅ 已修复：新增 `server/src/lib/tripGuard.ts` 中的 `requireTripExists` 中间件，已接入 activities/expenses/notes 三个子资源路由的所有写操作，Trip 不存在时统一返回 404。

### P1-5. AI 接口无速率限制，可能被滥用导致 API Key 费用超支
- **位置**：`server/src/routes/ai.ts`（`POST /recommend`、`POST /regenerate-day` 均无限流）
- **问题**：任何人都可以无限调用 AI 生成接口，PRD 已明确识别此风险（§10 风险与依赖）但代码未实现任何限流。
- **影响**：一旦配置了真实的大模型 API Key（ROADMAP F-AI-02 待办事项），存在被脚本刷调用导致费用失控的风险。
- **建议方案**：加简单的基于 IP 或 session 的速率限制中间件（如每分钟/每小时调用次数上限），可选用 `express-rate-limit` 一类的轻量依赖。
- **状态**：✅ 已修复：新增 `server/src/lib/rateLimit.ts` 实现基于内存的 IP 级限流中间件（无需额外依赖），应用于 `/api/ai/recommend` 和 `/api/ai/regenerate-day`，每 IP 每分钟最多 10 次，超过返回 429；生产环境同时开启 `trust proxy` 以正确识别反向代理后的真实客户端 IP。

### P1-6. AI 调用失败降级为 Mock 数据时，前端未向用户明确提示
- **位置**：`server/src/services/aiService.ts` 第 122-125 行（返回 `source: 'mock'`）；前端消费该字段的位置需要核实是否有对应 UI 提示
- **问题**：PRD 明确要求"AI 调用失败时优雅降级到规则推荐，并提示用户"，当前后端虽然做了降级，但没有确认前端是否真正向用户展示了"这是本地模板方案而非 AI 定制结果"的提示。
- **影响**：用户可能误以为通用模板行程是针对自己偏好和目的地定制的 AI 结果，产生错误预期，进而影响对"AI 推荐"这个核心卖点的信任。
- **建议方案**：核对 `AiPlanner.tsx` 是否使用了 `result.source` 字段；如未使用，增加一个醒目但不打扰的提示条（如"当前使用离线推荐模板，配置 AI Key 后可获得更懂你的专属方案"）。
- **状态**：✅ 已修复：`AiPlanner.tsx` 在 `result.source !== 'ai'` 时展示醒目的黄色提示条，明确告知用户当前为离线推荐模板（原有的小 chip 标签也保留）。

### P1-7. 列表接口无分页/排序参数，全量返回
- **位置**：`server/src/db/repositories.ts`（`TripRepo.all()`、`ActivityRepo.byTrip()` 等均硬编码排序、无分页）
- **问题**：旅行、花销、记录数量增长后，接口响应体积和前端渲染压力会明显上升，尤其结合图片 base64 问题（P0-6）会进一步放大。
- **影响**：数据量大的老用户会明显感觉到加载变慢、页面卡顿。
- **建议方案**：本期不要求做完整分页 UI，但建议至少给核心列表接口预留 `limit`/`offset` 或游标参数，避免未来重构接口签名产生兼容性问题。
- **状态**：✅ 已修复：`TripRepo.all()` 新增 `TripListQuery`（keyword/sortBy/sortOrder/limit/offset），`GET /api/trips` 路由已透传对应 query 参数，接口层具备分页与排序能力。

### P1-8. 列表页缺少搜索、排序、筛选能力
- **位置**：`client/src/pages/Dashboard.tsx`（旅行列表，仅支持按类型筛选）、`client/src/pages/TripDetail.tsx` 的 BudgetTab（花销列表）、NotesTab（记录列表）
- **问题**：旅行列表没有搜索框和按日期/预算排序；花销明细不能按金额/日期/分类排序筛选；旅行记录不能按日期/心情搜索筛选。
- **影响**：随着用户使用时间变长、数据积累增多（如一次多日游产生几十条花销），找到目标数据的成本显著上升。
- **建议方案**：优先给 Dashboard 加搜索框（按标题/目的地模糊匹配）和排序选项（按日期/创建时间）；BudgetTab 加按分类筛选和金额/日期排序。
- **状态**：✅ 已修复：`Dashboard.tsx` 增加标题/目的地搜索框与按日期/预算排序（本地筛选排序，搜索无结果时有区分提示）；`BudgetTab` 增加按分类筛选与按日期/金额排序；`NotesTab` 增加内容搜索、按心情筛选与按日期排序。

### P1-9. CORS 完全开放，无域名限制
- **位置**：`server/src/index.ts` 第 18 行 `app.use(cors())`
- **问题**：未配置 `origin` 白名单，任何网页都可以通过前端 JS 跨域调用后端 API。
- **影响**：结合 P0-1（无认证）问题会被放大，即便未来加了认证，开放的 CORS 也扩大了攻击面。
- **建议方案**：生产环境下将 `origin` 限制为实际部署的前端域名。
- **状态**：✅ 已修复：`server/src/index.ts` 支持 `CORS_ORIGIN` 环境变量配置白名单，生产环境下未显式配置时默认不开放跨域（同源访问不受影响）。

---

## 三、P2 — 打磨类细节（可在日常迭代中逐步优化）

### P2-1. 数据库缺少 schema 迁移机制
- **位置**：`server/src/db/index.ts`（`CREATE TABLE IF NOT EXISTS`，无版本追踪表）
- **问题**：新增字段（如 ROADMAP 计划给 Activity 加 `lat/lng/address/poiId`）目前只能手动改表或清库重建。
- **建议方案**：引入一个简单的 `schema_migrations` 版本表 + 迁移脚本机制，即使是最简化的版本号 diff 执行方式也比裸 `CREATE TABLE IF NOT EXISTS` 更可控。
- **状态**：✅ 已修复——新增 `schema_migrations` 版本表，`MIGRATIONS` 数组按版本号顺序执行未应用的迁移，每条迁移在事务中执行并记录版本号，旧数据库启动时会自动补齐缺失的迁移。

### P2-2. Activity、Expense 缺少 updatedAt 字段
- **位置**：`server/src/db/index.ts` Activity 表定义（第 29-44 行）、Expense 表定义（第 46-55 行）
- **问题**：拖拽排序、打卡、改金额等操作无法追踪最后修改时间，为未来的多端同步/冲突检测埋下障碍。
- **建议方案**：补充 `updatedAt` 字段，写操作时同步更新。
- **状态**：✅ 已修复——通过 v2 迁移给 Activity/Expense 补充 `updatedAt`（旧数据用 `createdAt` 回填），并在 create/update/reorder 等写操作中同步维护。

### P2-3. 统计接口存在 N+1 查询
- **位置**：`server/src/routes/trips.ts` 第 17-50 行 `GET /stats/overview`
- **问题**：先查所有 Trip，再逐个查询每个 Trip 的花销总和，属于典型 N+1 查询模式。
- **建议方案**：改为一条 `SELECT tripId, SUM(amount) FROM Expense GROUP BY tripId` 聚合查询。
- **状态**：✅ 已修复——新增 `sumExpensesByTrip()` 一次性聚合查询，统计接口改为查表 Map 而非逐个 Trip 查询。

### P2-4. Toast 提示时长固定 2.8 秒，不区分错误/成功类型
- **位置**：`client/src/store/useStore.ts` 第 53 行
- **问题**：重要的错误提示和普通的成功提示用同样的展示时长，用户可能来不及看清错误详情就消失了。
- **建议方案**：错误类 Toast 适当延长展示时间或要求手动关闭，成功类保持当前时长。
- **状态**：✅ 已修复——error 类型展示 5000ms，success/info 保持 2800ms 不变，另外保留点击手动关闭能力。

### P2-5. 加载态仅为纯文本"加载中…"，缺少骨架屏
- **位置**：`client/src/pages/Dashboard.tsx` 第 87-88 行、`client/src/pages/Discover.tsx` 第 69-70 行、`client/src/pages/TripDetail.tsx` 第 73 行
- **问题**：相比 AiPlanner 页面有 emoji 动画的加载态，这几处显得比较简陋，首屏加载体验参差不齐。
- **建议方案**：统一封装一个轻量骨架屏组件或复用 AiPlanner 的加载态风格。
- **状态**：✅ 已修复——新增 `components/Skeleton.tsx`，提供 `PageLoading`（emoji 动画风格，复用于 TripDetail）与 `CardGridSkeleton`（卡片骨架屏，应用于 Dashboard/Discover）。

### P2-6. 时间字段（startTime/endTime）无格式与逻辑校验
- **位置**：`server/src/lib/validate.ts` 第 39-40 行
- **问题**：不校验时间字符串格式是否合法（如 "25:00" 也能通过），也不校验 `endTime > startTime`。
- **建议方案**：加正则校验时间格式，并在有值时校验 `endTime > startTime`（与前端 `ActivityForm` 的校验逻辑保持一致，做服务端兜底）。
- **状态**：✅ 已修复——Zod 新增 HH:mm 正则校验与 `refineTimeRange` 交叉校验；路由层补充“只传其中一个时间字段”时结合数据库已有值的二次校验。

### P2-7. 无障碍细节：Tab 切换缺少 `role="tablist"` 语义，Toast 缺少 `role="status"`
- **位置**：`client/src/pages/TripDetail.tsx` 第 152-165 行（Tab 切换按钮）；`client/src/components/Toast.tsx`
- **问题**：影响屏幕阅读器用户的使用体验。
- **建议方案**：Tab 容器加 `role="tablist"`，每个按钮加 `role="tab"` + `aria-selected`；Toast 容器加 `role="status"` 或 `aria-live="polite"`。
- **状态**：✅ 已修复——TripDetail Tab 容器/按钮/面板补齐 tablist/tab/tabpanel 语义，Toast 容器补齐 `role="status"` 与 `aria-live="polite"`。

### P2-8. 文案不一致：`weekend` 类型的展示文案在不同地方不统一
- **位置**：`client/src/utils/constants.ts` 第 11 行（`TRIP_TYPE.weekend.label = '周末出行'`）与 `client/src/pages/Dashboard.tsx` 第 15 行硬编码的筛选按钮文案 `'周末'`
- **问题**：同一概念在不同位置文案不一致，属于细节打磨问题，但容易在后续维护中进一步分裂。
- **建议方案**：筛选按钮统一引用 `constants.ts` 中的定义，避免硬编码。
- **状态**：✅ 已修复——Dashboard 的 `FILTERS` 改为直接引用 `TRIP_TYPE` 中的 label/emoji，不再硬编码。

### P2-9. 产品核心旅程存在断点："出行中"与"出行后"阶段体验空白
- **位置**：产品层面，非单一代码位置；对照 `PRD.md` §3.3 出行三阶段与北极星指标
- **问题**：当前功能基本只覆盖"出行前（规划）"阶段完整闭环；"出行中"没有"今日行程"聚焦视图；"出行后"没有总结/回顾页面；灵感发现卡片无法一键转化为行程（"死胡同"）；分享、多端同步功能空白。
- **影响**：PRD 强调的"回忆留存"核心价值主张缺少实际承载页面；用户逛完灵感发现后无法闭环回到规划环节。
- **建议方案**：本条不要求本轮修复，但建议纳入下一阶段规划优先级评估（部分已体现在 ROADMAP 的 v1.2/v2.0/v3.0 中，如 F-DISC-02、F-LIVE-01、F-SHARE-01）。
- **状态**：⬜ 待修复（规划中，非本轮硬性修复项）

---

## 四、修复优先级总览

| 优先级 | 条目数 | 核心关键词 |
|--------|--------|-----------|
| P0 | 6 | 数据裸奔、写入丢失、误删不可恢复、静默失败、AI 保存重复数据、图片存储不可持续 |
| P1 | 9 | 日期交叉校验、数字输入防呆、状态自动流转、孤儿数据、AI 限流、降级提示、分页、搜索排序、CORS |
| P2 | 9 | schema 迁移、updatedAt、N+1 查询、Toast 时长、加载态、时间校验、无障碍、文案一致性、产品旅程断点 |

**建议修复顺序**：严格按 P0 → P1 → P2 执行，P0 内部按编号顺序（P0-1 到 P0-4 属于"数据安全与信任"主线，建议优先于 P0-5、P0-6）。每完成一条，更新本文档对应状态，便于追踪整体修复进度。

**修复进度**：P0（6/6）、P1（9/9）、P2（8/9，P2-9 为产品规划性质，不作为本轮硬性修复项）均已完成并通过本地构建与接口冒烟测试验证。
