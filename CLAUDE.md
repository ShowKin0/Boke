# Boke - 个人博客

纯前端个人博客系统，搭配零依赖 Node.js 服务器。数据直接存储在 `data/*.json` 文件中，随 Git 一起管理。

## 语言规则

- 与用户交流必须使用中文。
- 修改代码前先阅读现有结构，优先沿用项目当前的原生 HTML/CSS/JavaScript 风格。
- 本项目保持零依赖：不引入框架、构建工具、数据库或第三方运行时依赖，除非用户明确要求。

## 技术栈

- 前端：原生 HTML + CSS + JavaScript
- 服务端：Node.js 内置 `http` 模块
- 存储：`data/*.json` 文件和 `data/uploads/`
- 缓存：`localStorage`
- 测试：Node.js 内置 `node:test`

## 项目结构

```text
Boke/
├── index.html
├── admin.html
├── style.css
├── public/
│   ├── css/
│   │   ├── index.css
│   │   └── admin.css
│   └── js/
│       ├── shared.js              # 前后台共享工具
│       ├── index.js               # 前台主逻辑
│       ├── index-player-config.js # 前台播放器配置
│       ├── admin.js               # 后台主逻辑
│       └── admin-list.js          # 后台列表搜索和分页
├── server.js
├── src/server/
│   ├── app.js
│   ├── api-routes.js
│   ├── config.js
│   ├── data-store.js
│   ├── http-utils.js
│   ├── static-files.js
│   └── upload-store.js
├── data/
│   ├── articles.json
│   ├── updates.json
│   ├── explores.json
│   ├── music.json
│   ├── theme.json
│   └── uploads/
├── test/
│   ├── server.test.js
│   └── smoke.test.js
└── package.json
```

## 启动与验证

```bash
npm start
npm.cmd run check
npm.cmd test
npm.cmd run smoke
```

如果 PowerShell 拦截 `npm`，使用 `npm.cmd`。

访问地址：

- 前台：`http://localhost:3000`
- 后台：`http://localhost:3000/admin.html`

## 服务端接口

- `GET /api/data`：读取所有数据文件并合并返回。
- `GET /api/data/:type`：读取单个数据类型。
- `POST /api/data/:type`：写入单个数据类型，需要登录 Token。
- `POST /api/upload`：接收 base64 data URL，保存到 `data/uploads/`，需要登录 Token。
- `POST /api/login`：后台登录。
- `POST /api/logout`：后台退出。
- `GET /api/verify`：验证 Token。
- `POST /api/data/:type/:id/view`：增加阅读计数。
- `GET /feed.xml`：RSS。
- `GET /sitemap.xml`：站点地图。

## 环境变量

- `PORT`：服务端端口，默认 `3000`。
- `BOKE_ADMIN_PASSWORD`：后台服务端登录密码，默认 `zhang`。
- `BOKE_TOKEN_TTL_MS`：登录 Token 有效期，默认 24 小时。
- `BOKE_DATA_DIR`：数据目录，默认项目内 `data/`。测试和冒烟检查可用临时目录。

## 数据格式

`articles`、`updates`、`explores`、`music` 顶层必须是对象数组。

```json
[
  {
    "id": "post-id",
    "title": "标题",
    "summary": "摘要",
    "content": "富文本 HTML",
    "tags": [],
    "createdAt": "2026-06-29T00:00:00.000Z"
  }
]
```

`theme` 顶层必须是对象。

```json
{
  "bgColor": "#fff5f7",
  "primaryColor": "#ffb0c0",
  "secondaryColor": "#87ceeb",
  "cardBg": "rgba(255,255,255,0.6)",
  "textColor": "#2d2d2d",
  "textSecondary": "#888888"
}
```

## 维护优化记录

2026-06-29 已完成一轮代码维护优化：

- `public/js/shared.js` 集中管理 Toast、分页、主题变量应用、DOM 查询、数据加载兜底链等通用逻辑。
- `public/js/admin-list.js` 拆出后台列表搜索和分页逻辑。
- `public/js/index-player-config.js` 拆出播放器模式配置。
- 后台登录优先走服务端认证；离线打开 `admin.html` 时才使用本地开发兜底密码。
- 服务端登录密码、Token 有效期和数据目录支持环境变量配置。
- 数据写入增加顶层结构校验，避免错误导入破坏前台渲染。
- 上传保留 base64 data URL 格式，同时增加 MIME 白名单和 20MB 上限。
- 新增 `check`、`test`、`smoke` 脚本。
- 新增 Node 内置测试，覆盖数据校验、路径防护、上传拒绝、Token 过期和 API 冒烟。

## 后续建议

- 继续减少 HTML 字符串中的内联 `style=` 和 `onclick=`，逐步改为 CSS class 与事件委托。
- 继续拆分 `admin.js` 中的富文本编辑器、上传绑定、主题管理逻辑。
- 继续拆分 `index.js` 中的文章渲染、搜索、探索页和播放器逻辑。
- 后续功能优先考虑：草稿/自动保存、图片资源管理、文章 slug/SEO、备份恢复。
