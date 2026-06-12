# Bōkè — 个人博客

纯前端个人博客系统，搭配零依赖 Node.js 服务器，数据直接存储在 `data/*.json` 文件中，随 Git 一起管理。

## 技术栈

- **语言**: 原生 HTML + CSS + JavaScript（无框架、无构建工具）
- **服务端**: Node.js 内置 `http` 模块（零依赖）
- **存储**: `data/*.json` 文件（磁盘持久化，git 跟踪）
- **缓存**: `localStorage`（离线降级 + 快速访问）

## 项目架构

```
Boke/
├── index.html              # 前台页面骨架
├── admin.html              # 后台页面骨架
├── style.css               # 前后台共享富文本样式
├── public/
│   ├── css/
│   │   ├── index.css       # 前台页面样式
│   │   └── admin.css       # 后台页面样式
│   └── js/
│       ├── shared.js       # 前后台共享工具：本地存储、日期、转义、同步
│       ├── index.js        # 前台页面逻辑
│       └── admin.js        # 后台管理逻辑
├── server.js               # 服务端启动入口
├── src/server/
│   ├── app.js              # HTTP 服务创建和总分发
│   ├── api-routes.js       # /api/data 与 /api/upload 路由
│   ├── data-store.js       # data/*.json 初始化、读写和白名单
│   ├── upload-store.js     # base64 上传落盘
│   ├── static-files.js     # 静态文件服务
│   ├── http-utils.js       # JSON body、JSON 响应、错误响应
│   └── config.js           # 路径、端口、默认数据
├── data/                   # 数据文件（磁盘持久化，git 跟踪）
│   ├── articles.json
│   ├── updates.json
│   ├── explores.json
│   ├── music.json
│   ├── theme.json
│   └── uploads/
└── package.json
```

## 数据流

```
写作时:
  选择图片 → POST /api/upload → 存到 data/uploads/ → 返回路径
  保存文章 → POST /api/data/articles → 更新 data/articles.json

浏览时:
  index.html → GET /api/data → 读取所有 data/*.json → 渲染
  文章引用图片 → <img src="data/uploads/xxx.jpg"> → 静态文件服务直出

git:
  git add data/  → 新文章、新图片全部被追踪
  git commit -m "new post" → 数据跟着项目走
```

## 关键路径

### 启动

```bash
node server.js
# 或 npm start
```

然后打开 `http://localhost:3000` 浏览，`http://localhost:3000/admin.html` 管理。

### 服务端（server.js / src/server）

- `GET  /api/data` → 读取所有 data/\*.json，合并返回
- `POST /api/data/:type` → 写入某一类型的 JSON 文件
- `POST /api/upload` → 接收 base64 图片，存到 data/uploads/，返回 URL
- `GET  /*` → 静态文件服务（HTML/CSS/JS/图片）
- 新增数据类型时，先在 `src/server/config.js` 的 `DATA_TYPES` 和 `DEFAULT_DATA` 中登记，再补前后台渲染/管理逻辑

### 前端（index.html + public/js/index.js）

- `loadAll()` → 优先从 `/api/data` 加载 → localStorage 降级 → data/\*.json 降级
- `applyTheme(theme)` → 应用主题 CSS 变量
- `showArticle(id)` → 打开文章详情弹窗
- 四个区域：首页（时钟+播放器）→ 文章 → 动态 → 探索（单页滚动）

### 后台（admin.html + public/js/admin.js）

- **登录密码**: `zhang`（硬编码，纯前端项目请自行修改）
- `createCRUD(cfg)` → CRUD 工厂函数，统一管理所有数据类型的增删改查
- 每次保存自动调用 `syncToServer(type, data)` 写入磁盘文件
- 图片上传 → 服务器存到 `data/uploads/` → 文章引用路径
- 编辑器支持：WYSIWYG 富文本（contenteditable）、代码块弹窗（Atom One Dark 风格语法高亮）、图片文件选择上传

### 共享前端工具（public/js/shared.js）

- `loadStore()` / `saveStore()` → localStorage 读写
- `syncToServer(type, data)` → 写入 `/api/data/:type`
- `escapeHtml()` / `formatDate()` → 页面渲染通用工具
- `getDefaultStore()` → 前后台一致的空数据结构

## 数据格式

`data/*.json` 文件直接存储，与 localStorage 格式一致：

```json
// articles.json
[{ "id", "title", "summary", "content", "tags", "createdAt" }]

// theme.json
{ "bgColor", "primaryColor", "secondaryColor", "cardBg", "textColor", "textSecondary" }
```

## 使用方式

```bash
# 启动服务器
npm start

# 浏览前台
open http://localhost:3000

# 管理后台
open http://localhost:3000/admin.html
# 密码: zhang
```

## 数据迁移

数据已经直接存在 `data/` 目录下，克隆仓库即可。

如需导出，后台左侧底部有 **📤 导出**（下载 JSON）和 **📥 导入**（从 JSON 恢复）按钮。

## 离线开发（不启动服务器时）

如果直接双击 HTML 文件打开，系统会自动降级到 `localStorage`：

- `index.html` 从 localStorage 读取数据（如果有缓存）
- `admin.html` 只能读写 localStorage，无法保存到磁盘文件
- 图片会降级为 base64 嵌入

## 注意事项

- 图片以文件形式存储在 `data/uploads/`，单图建议不超过 5MB
- 文章内容为富文本 HTML（由 WYSIWYG 编辑器生成）
- 代码块使用 Atom One Dark 配色，支持 JS/TS/Python/C++/Java/Go/Rust/C/SQL 等语言
- 如果修改了 `data/` 目录外的文件（如 `index.html`、`admin.html`），需要重启服务器

## 代码调教

每次完成几个功能之后，都优化一下代码，检测项目结构和逻辑，看有没有重复写的地方可以优化，缩减代码，方便未来维护。
在不理解用户的输入时，或者用户给出的内容不精确时，提出问题，询问用户，之后再实行内容。
