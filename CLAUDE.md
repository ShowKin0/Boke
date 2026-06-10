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
├── index.html      # 博客前端主页 — 展示所有内容
├── admin.html      # 后台管理页 — 内容 CRUD + 主题自定义
├── server.js       # Node.js 服务器 — 静态文件 + REST API + 图片上传
├── data/           # 数据文件（磁盘持久化，git 跟踪）
│   ├── articles.json   # 文章
│   ├── updates.json    # 动态
│   ├── explores.json   # 探索链接
│   ├── music.json      # 音乐列表
│   ├── theme.json      # 主题配色
│   └── uploads/        # 上传的图片文件
│       ├── <timestamp>_<random>.jpg
│       └── ...
└── package.json    # 项目配置
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

### 服务端（server.js）
- `GET  /api/data` → 读取所有 data/*.json，合并返回
- `POST /api/data/:type` → 写入某一类型的 JSON 文件
- `POST /api/upload` → 接收 base64 图片，存到 data/uploads/，返回 URL
- `GET  /*` → 静态文件服务（HTML/CSS/JS/图片）

### 前端（index.html）
- `loadAll()` → 优先从 `/api/data` 加载 → localStorage 降级 → data/*.json 降级
- `applyTheme(theme)` → 应用主题 CSS 变量
- `showArticle(id)` → 打开文章详情弹窗
- 四个区域：首页（时钟+播放器）→ 文章 → 动态 → 探索（单页滚动）

### 后台（admin.html）
- **登录密码**: `zhang`（硬编码，纯前端项目请自行修改）
- `createCRUD(cfg)` → CRUD 工厂函数，统一管理所有数据类型的增删改查
- 每次保存自动调用 `syncToServer(type, data)` 写入磁盘文件
- 图片上传 → 服务器存到 `data/uploads/` → 文章引用路径
- 编辑器支持：WYSIWYG 富文本（contenteditable）、代码块弹窗（Atom One Dark 风格语法高亮）、图片文件选择上传

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
