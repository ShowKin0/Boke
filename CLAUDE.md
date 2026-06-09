# Bōkè — 个人博客

纯前端个人博客系统，无需服务器，所有数据存储在浏览器 localStorage 中。

## 技术栈

- **语言**: 原生 HTML + CSS + JavaScript（无框架、无构建工具）
- **存储**: localStorage（数据持久化）
- **数据种子**: `data/*.json`（首次访问时作为默认数据，或手动导入）

## 项目架构

```
Boke/
├── index.html      # 博客前端主页 — 展示所有内容
├── admin.html      # 后台管理页 — 内容 CRUD + 主题自定义
├── data/           # 数据种子文件（JSON 格式）
│   ├── articles.json   # 文章
│   ├── updates.json    # 动态
│   ├── explores.json   # 探索链接
│   ├── music.json      # 音乐列表
│   └── theme.json      # 主题配色
└── 1.txt           # 原始需求文档
```

## 关键路径

### 前端（index.html）
- `loadStore()` → 从 localStorage 读取 `boke_data`
- `applyTheme(theme)` → 应用主题 CSS 变量
- `showArticle(id)` → 打开文章详情弹窗
- 四个区域：首页（时钟+播放器）→ 文章 → 动态 → 探索（单页滚动）

### 后台（admin.html）
- **登录密码**: `zhang`（硬编码，纯前端项目请自行修改）
- `createCRUD(cfg)` → CRUD 工厂函数，统一管理所有数据类型的增删改查
- 编辑器支持：WYSIWYG 富文本（contenteditable）、代码块弹窗（Atom One Dark 风格语法高亮）、图片文件选择（base64）
- 数据操作直接读写 `localStorage`

## 数据格式

localStorage 中以 `boke_data` 为 key 存储 JSON：
```json
{
  "articles": [{ "id", "title", "summary", "content", "tags", "createdAt" }],
  "updates":  [{ "id", "content", "createdAt" }],
  "explores": [{ "id", "title", "description", "url", "icon", "category", "createdAt" }],
  "music":    [{ "id", "title", "artist", "url", "type", "createdAt" }],
  "theme":    { "bgColor", "primaryColor", "secondaryColor", "cardBg", "textColor", "textSecondary" }
}
```

## 使用方式

直接用浏览器打开 `index.html` 即可浏览博客。
打开 `admin.html` 输入密码 `zhang` 进入后台管理。

## 数据迁移（换电脑/备份）

后台左侧底部有 **📤 导出** 和 **📥 导入** 按钮：

```
旧电脑 → 导出 → boke-data.json → 复制到新电脑 → 导入
```

**标准流程：**
1. 旧电脑后台点击 **📤 导出** → 下载 `boke-data.json`
2. 把该文件放入 `data/` 目录（替换原有文件）
3. 新电脑克隆项目后，打开后台点击 **📥 导入** → 选择该文件
4. 数据恢复完毕

**首次访问**时会按优先级加载数据：
1. `localStorage`（已有数据）
2. `data/*.json` 文件（首次访问，需 HTTP 方式打开）
3. 空白状态

## 注意事项

- 图片以 base64 存储在数据中，单图建议不超过 5MB
- 文章内容为富文本 HTML（由 WYSIWYG 编辑器生成）
- 代码块使用 Atom One Dark 配色，支持 JS/TS/Python/C++/Java/Go/Rust/C/SQL 等语言
