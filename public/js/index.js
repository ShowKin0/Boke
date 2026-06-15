// ===== 状态管理 =====
const { loadStore, saveStore, escapeHtml, truncate, formatDateCached } = window.Boke;

// 检查 ?clear 参数，清除 localStorage 缓存
if (window.location.search.includes('clear')) {
  localStorage.removeItem('boke_data');
  // 移除 URL 参数，防止刷新后再次触发
  const url = new URL(window.location);
  url.searchParams.delete('clear');
  window.history.replaceState({}, '', url);
}
let articles = [], updates = [], explores = [], musicList = [], theme = {};
let currentCategory = 'blog';
let currentSongIndex = 0;
let isPlaying = false;
let articlesPage = 1;
let updatesPage = 1;
let selectedTag = null;
let searchQuery = '';
let archiveMode = false;
const ARTICLE_PAGE_SIZE = 9;
const UPDATE_PAGE_SIZE = 4;
const audio = new Audio();


// ===== 从 localStorage / data 文件加载数据 =====
function applyData(data) {
  if (!data) return;
  articles = data.articles || [];
  updates = data.updates || [];
  explores = data.explores || [];
  musicList = data.music || [];
  articlesPage = 1;
  updatesPage = 1;
  if (data.theme) { theme = data.theme; applyTheme(theme); }
  renderHomeArticles();
  renderHomeUpdates();
  renderArticles();
  renderUpdates();
  renderExploreTabs();
  renderExplores(currentCategory);
  renderPlaylist();
  initFadeUp();
}

async function loadAll() {
  // 数据源链：依次尝试，第一个成功的就用
  const sources = [
    // 1. 服务器 API（数据来自 data/*.json 文件）
    async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('API offline');
      return res.json();
    },
    // 2. localStorage 缓存
    () => loadStore(),
    // 3. 首次访问：从 data/*.json 种子文件加载
    async () => {
      const files = ['articles', 'updates', 'explores', 'music', 'theme'];
      const data = {};
      for (const key of files) {
        const res = await fetch(`data/${key}.json`);
        if (res.ok) data[key] = await res.json();
      }
      if (!data.articles) throw new Error('No seed data');
      data.theme = data.theme || {};
      return data;
    },
  ];
  for (const src of sources) {
    try {
      const data = await src();
      if (data) {
        saveStore(data);
        applyData(data);
        return;
      }
    } catch { /* 尝试下一个源 */ }
  }
  // 都没数据，渲染空白状态
  applyData(null);
}

// ===== 主题 =====
function applyTheme(t) {
  const r = document.documentElement.style;
  if (t.bgColor) r.setProperty('--bg', t.bgColor);
  if (t.primaryColor) r.setProperty('--primary', t.primaryColor);
  if (t.secondaryColor) r.setProperty('--secondary', t.secondaryColor);
  if (t.cardBg) r.setProperty('--card-bg', t.cardBg);
  if (t.textColor) r.setProperty('--text', t.textColor);
  if (t.textSecondary) r.setProperty('--text-secondary', t.textSecondary);
}

// ===== 时钟（DOM 引用缓存，每秒高频调用） =====
const $clockTime = document.getElementById('clockTime');
const $clockDate = document.getElementById('clockDate');
const $clockFrame = document.getElementById('clockFrame');
const DAY_NAMES = ['日','一','二','三','四','五','六'];

function updateClock() {
  const now = new Date();
  $clockTime.textContent =
    `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  $clockDate.textContent =
    `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${DAY_NAMES[now.getDay()]}`;

  // 时钟阴影随太阳位置变化
  const hour = now.getHours() + now.getMinutes() / 60;
  const rad = ((hour / 24) * 360 * Math.PI) / 180;
  $clockFrame.style.boxShadow =
    `${(Math.sin(rad) * 24).toFixed(1)}px ${(Math.cos(rad) * 24).toFixed(1)}px ${(24 + Math.sin(rad) * 12).toFixed(1)}px rgba(0,0,0,${(0.04 + Math.abs(Math.sin(rad)) * 0.06).toFixed(3)})`;
}
setInterval(updateClock, 1000);
updateClock();

// ===== 滚动触发动画（单例 observer） =====
let _fadeObserver = null;
function initFadeUp() {
  if (!_fadeObserver) {
    _fadeObserver = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); _fadeObserver.unobserve(e.target); } });
    }, { threshold: 0.1 });
  }
  document.querySelectorAll('.fade-up:not(.visible)').forEach(el => _fadeObserver.observe(el));
}

// ===== 导航栏（双栏交叉淡入淡出） =====
const topNav = document.getElementById('topNav');
const leftNav = document.getElementById('leftNav');
const indicatorTop = document.getElementById('indicatorTop');
const indicatorLeft = document.getElementById('indicatorLeft');
const navItemsAll = document.querySelectorAll('.nav-item[data-section]');
let navDebounceTimer = null;

function updateNavbar() {
  const homeEl = document.getElementById('home');
  const homeBottom = homeEl ? homeEl.getBoundingClientRect().bottom : window.innerHeight;
  const threshold = Math.min(window.innerHeight * 0.6, homeEl ? homeEl.offsetHeight - 100 : 400);
  const pastHome = homeBottom < threshold;

  // 交叉淡入淡出
  topNav.classList.toggle('hidden', pastHome);
  leftNav.classList.toggle('visible', pastHome);

  updateActiveSection();
}

function updateActiveSection() {
  const sections = ['home','articles','updates','explore'];
  let active = 'home';
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 200) active = id;
    }
  });
  navItemsAll.forEach(item => {
    item.classList.toggle('active', item.dataset.section === active);
  });
  // 同时更新两个指示器
  updateIndicator(active, topNav, indicatorTop, true);
  updateIndicator(active, leftNav, indicatorLeft, false);
}

function updateIndicator(active, navEl, indEl, isTop) {
  const activeItem = navEl.querySelector(`.nav-item[data-section="${active}"]`);
  if (!activeItem || (navEl.classList.contains('hidden') && isTop) || (!navEl.classList.contains('visible') && !isTop)) {
    if (indEl) indEl.style.opacity = '0';
    return;
  }
  if (indEl) indEl.style.opacity = '1';
  if (!activeItem) return;
  const rect = activeItem.getBoundingClientRect();
  const navRect = navEl.getBoundingClientRect();
  if (isTop) {
    indEl.style.cssText =
      `left:${rect.left - navRect.left + 8}px;width:${rect.width - 16}px;bottom:4px;height:3px;top:auto;right:auto;opacity:1;`;
  } else {
    indEl.style.cssText =
      `top:${rect.top - navRect.top + 6}px;height:${rect.height - 12}px;right:4px;width:3px;left:auto;bottom:auto;opacity:1;`;
  }
}

window.addEventListener('scroll', () => {
  if (navDebounceTimer) cancelAnimationFrame(navDebounceTimer);
  navDebounceTimer = requestAnimationFrame(() => { updateNavbar(); });
}, { passive: true });

window.addEventListener('resize', updateActiveSection);
setTimeout(() => { updateNavbar(); }, 100);

navItemsAll.forEach(item => {
  item.addEventListener('click', () => {
    const section = item.dataset.section;
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
  });
});


// ===== 首页 - 最新文章（小卡片） =====
function renderHomeArticles() {
  const col = document.getElementById('homeArticlesCol');
  if (!articles.length) {
    col.innerHTML = '<h4>📖 最新文章</h4><div class="empty-state" style="padding:20px;"><div class="icon" style="font-size:28px;">📝</div><p style="font-size:13px;">暂无文章</p></div>';
    return;
  }
  let html = '<h4>📖 最新文章</h4>';
  articles.slice(0, 5).forEach(a => {
    html += `<div class="mini-card" onclick="showArticle('${a.id}')">
      <div class="mini-title">${a.title || '无标题'}</div>
      ${a.summary ? `<div class="mini-content">${escapeHtml(a.summary)}</div>` : ''}
      <div class="mini-meta">${formatDateCached(a.createdAt)}${a.views ? ` · 👁️ ${a.views}` : ''}</div>
    </div>`;
  });
  col.innerHTML = html;
}

// ===== 首页 - 最新动态（小卡片） =====
function renderHomeUpdates() {
  const col = document.getElementById('homeUpdatesCol');
  if (!updates.length) {
    col.innerHTML = '<h4>💬 最新动态</h4><div class="empty-state" style="padding:20px;"><div class="icon" style="font-size:28px;">💬</div><p style="font-size:13px;">暂无动态</p></div>';
    return;
  }
  let html = '<h4>💬 最新动态</h4>';
  updates.slice(0, 5).forEach(u => {
    html += `<div class="mini-card" onclick="document.getElementById('updates').scrollIntoView({behavior:'smooth'})">
      <div class="mini-content">${u.content || ''}</div>
      <div class="mini-meta">${formatDateCached(u.createdAt)}</div>
    </div>`;
  });
  col.innerHTML = html;
}

// ===== 通用分页渲染 =====
function renderPagination(page, totalPages, onChange) {
  if (totalPages <= 1) return '';
  return `<div class="pagination">
    <button class="page-btn" onclick="${onChange}(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 上一页</button>
    <span class="page-info">${page} / ${totalPages}</span>
    <button class="page-btn" onclick="${onChange}(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页 →</button>
  </div>`;
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// ===== 文章过滤工具 =====
function matchArticle(a, q) {
  return (a.title||'').toLowerCase().includes(q) || (a.summary||'').toLowerCase().includes(q) || (a.content||'').toLowerCase().includes(q) || (a.tags||[]).some(t => t.toLowerCase().includes(q));
}

// ===== 文章区 =====
function getArticleTags() {
  const tagSet = new Set();
  articles.forEach(a => (a.tags || []).forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

function renderArticleToolbar() {
  const container = document.getElementById('articleToolbar');
  if (!container) return;
  const tags = getArticleTags();
  let tagHtml = tags.map(t => `<button class="article-tag-btn ${selectedTag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
  container.innerHTML = `
    <div class="article-toolbar-row">
      <div class="article-search-wrap">
        <input id="articleSearch" type="text" placeholder="搜索文章..." value="${escapeHtml(searchQuery)}" class="article-search-input">
      </div>
      <button class="archive-toggle-btn" onclick="toggleArchive()" title="切换归档视图">${archiveMode ? '📋 网格视图' : '📅 归档视图'}</button>
    </div>
    ${tags.length ? `<div class="article-tags-bar">${tagHtml}</div>` : ''}
  `;
  // 搜索输入防抖
  const searchInput = document.getElementById('articleSearch');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', function() {
      clearTimeout(timer);
      timer = setTimeout(() => { searchQuery = this.value; articlesPage = 1; renderArticles(); renderArticleToolbar(); }, 300);
    });
  }
  // 标签点击
  container.querySelectorAll('.article-tag-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tag = this.dataset.tag;
      selectedTag = selectedTag === tag ? null : tag;
      articlesPage = 1;
      renderArticles();
      renderArticleToolbar();
    });
  });
}

function toggleArchive() {
  archiveMode = !archiveMode;
  articlesPage = 1;
  renderArticles();
  renderArticleToolbar();
}

function renderArchiveView(articles) {
  if (!articles.length) return '<div class="empty-state"><div class="icon">📝</div><p>暂无文章</p></div>';
  // 按年月分组
  const groups = {};
  articles.forEach(a => {
    const d = new Date(a.createdAt);
    const key = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  let html = '';
  sortedKeys.forEach(key => {
    html += `<div class="archive-group fade-up"><h3 class="archive-month">${key}</h3><div class="archive-list">`;
    groups[key].forEach(a => {
      const day = new Date(a.createdAt).getDate();
      html += `<div class="archive-item" onclick="showArticle('${a.id}')">
        <span class="archive-day">${day}日</span>
        <span class="archive-title">${escapeHtml(a.title || '无标题')}</span>
        ${a.tags && a.tags.length ? a.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('') : ''}
      </div>`;
    });
    html += '</div></div>';
  });
  return html;
}

function renderArticles() {
  const container = document.getElementById('articlesContainer');
  const loading = document.getElementById('articlesLoading');
  if (loading) loading.style.display = 'none';

  // 搜索 + 标签过滤
  let filtered = [...articles];
  if (selectedTag) filtered = filtered.filter(a => a.tags && a.tags.includes(selectedTag));
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(a => matchArticle(a, q));
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>${articles.length ? '没有匹配的文章' : '暂无文章'}</p></div>`;
    return;
  }

  if (archiveMode) {
    container.innerHTML = renderArchiveView(filtered);
    initFadeUp();
    return;
  }

  let html = '';
  // 置顶文章（如果有）
  const featured = filtered.find(a => a.pinned) || filtered[0];
  const coverUrl = featured.cover;
  html += `<div class="article-featured fade-up" onclick="showArticle('${featured.id}')" style="cursor:pointer;">
    ${coverUrl ? `<div class="article-featured-cover"><img src="${coverUrl}" alt=""></div>` : ''}
    <div class="article-featured-body">
      <h2>${featured.title || '无标题'}</h2>
      <p>${featured.summary || '暂无摘要'}</p>
      <div class="meta">
        ${formatDateCached(featured.createdAt)}
        ${featured.tags ? featured.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('') : ''}
        ${featured.views ? `<span class="view-count">👁️ ${featured.views}</span>` : ''}
      </div>
    </div>
  </div>`;

  // 其余文章（分页，排除置顶那篇）
  const rest = filtered.filter(a => a.id !== featured.id);
  if (rest.length) {
    const totalPages = Math.ceil(rest.length / ARTICLE_PAGE_SIZE);
    if (articlesPage > totalPages) articlesPage = totalPages;
    const start = (articlesPage - 1) * ARTICLE_PAGE_SIZE;
    const pageItems = rest.slice(start, start + ARTICLE_PAGE_SIZE);

    html += '<div class="articles-grid" style="margin-top:24px;">';
    pageItems.forEach(a => {
      html += `<div class="glass-card fade-up" onclick="showArticle('${a.id}')" style="cursor:pointer;${a.cover ? 'padding:0;overflow:hidden;' : ''}">
        ${a.cover ? `<div class="article-card-cover"><img src="${a.cover}" alt=""></div>` : ''}
        <div class="article-card-body" style="${a.cover ? 'padding:16px 20px;' : ''}">
          <h3>${a.title || '无标题'}</h3>
          <div class="card-date">${formatDateCached(a.createdAt)} ${a.views ? `👁️ ${a.views}` : ''}</div>
          <div class="card-summary">${truncate(a.summary, 80)}</div>
          ${a.tags ? a.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('') : ''}
        </div>
      </div>`;
    });
    html += '</div>';

    // 分页按钮
    html += renderPagination(articlesPage, totalPages, 'changeArticlesPage');
  }
  container.innerHTML = html;
  initFadeUp();
}

function changeArticlesPage(page) {
  articlesPage = page;
  renderArticles();
  scrollToSection('articles');
}

// ===== 动态区 =====
function renderUpdates() {
  const container = document.getElementById('updatesContainer');
  if (!updates.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">💬</div><p>暂无动态</p></div>`;
    return;
  }
  const totalPages = Math.ceil(updates.length / UPDATE_PAGE_SIZE);
  if (updatesPage > totalPages) updatesPage = totalPages;
  const start = (updatesPage - 1) * UPDATE_PAGE_SIZE;
  const pageItems = updates.slice(start, start + UPDATE_PAGE_SIZE);

  let html = pageItems.map(u => `<div class="update-card fade-up">
    <div class="update-header">
      <div class="update-avatar">👤</div>
      <div>
        <div class="update-name">站主</div>
        <div class="update-time">${u.createdAt ? new Date(u.createdAt).toLocaleString('zh-CN') : ''}</div>
      </div>
    </div>
    <div class="update-content prose">${u.content || ''}</div>
  </div>`).join('');

  // 分页按钮
  html += renderPagination(updatesPage, totalPages, 'changeUpdatesPage');

  container.innerHTML = html;
  initFadeUp();
}

function changeUpdatesPage(page) {
  updatesPage = page;
  renderUpdates();
  scrollToSection('updates');
}

// ===== 探索区 =====
const CATEGORY_ORDER = ['blog', 'website', 'source', 'video'];
const CATEGORY_LABELS = { blog:'📝 博客推荐', website:'🌐 网站推荐', source:'📦 源码', video:'🎬 学习视频' };
function renderExploreTabs() {
  const tabs = document.getElementById('exploreTabs');
  tabs.innerHTML = '';
  CATEGORY_ORDER.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'explore-tab';
    btn.dataset.category = cat;
    btn.textContent = CATEGORY_LABELS[cat] || cat;
    if (cat === currentCategory) btn.classList.add('active');
    tabs.appendChild(btn);
  });
}
function renderExplores(category) {
  const container = document.getElementById('exploreContainer');
  const filtered = category ? explores.filter(e => e.category === category) : explores;
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🔍</div><p>暂无${CATEGORY_LABELS[category] || ''}项目</p></div>`;
    return;
  }
  let html = '';
  filtered.forEach(e => {
    const categoryLabel = CATEGORY_LABELS[e.category] || e.category || '其他';
    const iconHtml = (e.icon && (e.icon.startsWith('data:') || e.icon.startsWith('data/') || e.icon.startsWith('http')))
      ? `<img class="explore-icon-img" src="${escapeHtml(e.icon)}" alt="">`
      : `<span class="icon">${e.icon || '🔗'}</span>`;
    html += `<a class="explore-item fade-up" href="${e.url || '#'}" target="_blank" rel="noopener">
      ${iconHtml}
      <h4>${escapeHtml(e.title || '')}</h4>
      <p>${e.description || ''}</p>
      <span class="explore-category">${categoryLabel}</span>
    </a>`;
  });
  container.innerHTML = html;
  initFadeUp();
}

// ===== 文章详情 =====
function estimateReadingTime(html) {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  // 中文阅读速度约 400 字/分钟
  const mins = Math.ceil(text.length / 400);
  if (mins < 1) return '不到 1 分钟';
  return `约 ${mins} 分钟`;
}

function generateTOC(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  const headings = div.querySelectorAll('h2, h3');
  if (!headings.length) return '';
  let toc = '<nav class="article-toc"><h4>📑 目录</h4><ul>';
  headings.forEach((h, i) => {
    const id = `toc-${i}`;
    h.id = id;
    const indent = h.tagName === 'H3' ? ' style="padding-left:16px;"' : '';
    toc += `<li${indent}><a href="#${id}" onclick="event.preventDefault();document.getElementById('${id}').scrollIntoView({behavior:'smooth'})">${escapeHtml(h.textContent)}</a></li>`;
  });
  toc += '</ul></nav>';
  // 返回修改后的 HTML 和 TOC
  return { toc, html: div.innerHTML };
}

function showArticle(id) {
  const a = articles.find(x => x.id === id);
  if (!a) return;
  const tags = a.tags ? a.tags.map(t => `<span class="card-tag" style="display:inline-block;padding:2px 12px;background:rgba(135,206,235,0.15);color:var(--secondary);border-radius:6px;font-size:13px;margin-right:4px;">${t}</span>`).join('') : '';
  const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'}) : '';
  const readingTime = estimateReadingTime(a.content);
  const tocResult = generateTOC(a.content);
  const finalContent = tocResult ? tocResult.html : (a.content || '');
  const tocHtml = tocResult ? tocResult.toc : '';

  // SEO: 动态更新标题
  document.title = a.title ? `${a.title} - Bōkè` : 'Bōkè - 个人博客';

  document.getElementById('articleDetailContent').innerHTML = `
    ${a.cover ? `<div class="article-detail-cover"><img src="${a.cover}" alt=""></div>` : ''}
    <h1>${escapeHtml(a.title || '')}</h1>
    <div class="meta">${date} ${readingTime ? `<span class="reading-time">📖 ${readingTime}</span>` : ''} ${tags}</div>
    <div class="article-detail-layout">
      ${tocHtml ? `<div class="article-detail-sidebar">${tocHtml}</div>` : ''}
      <div class="content prose${tocHtml ? ' with-toc' : ''}">${finalContent}</div>
    </div>
  `;
  document.getElementById('articleDetail').classList.add('open');
  document.body.style.overflow = 'hidden';

  // 代码块复制按钮
  addCodeCopyButtons();

  // 图片缩放光标（点击由全局委派处理）
  document.querySelectorAll('.article-detail-card .prose img').forEach(img => {
    img.style.cursor = 'zoom-in';
  });

  // 阅读计数
  if (window.Boke && window.Boke.incrementView) {
    window.Boke.incrementView('articles', a.id);
    a.views = (a.views || 0) + 1;
  }
}

function closeArticle() {
  document.getElementById('articleDetail').classList.remove('open');
  document.body.style.overflow = '';
  // 恢复标题
  document.title = 'Bōkè - 个人博客';
}

function addCodeCopyButtons() {
  document.querySelectorAll('.article-detail-card .prose pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '📋 复制';
    btn.onclick = async function() {
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = '✅ 已复制';
        setTimeout(() => { btn.textContent = '📋 复制'; }, 2000);
      } catch {
        btn.textContent = '❌ 失败';
        setTimeout(() => { btn.textContent = '📋 复制'; }, 2000);
      }
    };
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

// ===== 灯箱 =====
function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!lb || !img) return;
  img.src = src;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// ===== 全局图片点击 → 灯箱（动态、文章等区域的图片） =====
document.addEventListener('click', (e) => {
  const img = e.target.closest('.update-content img, .article-detail-card .prose img');
  if (img && !e.target.closest('.copy-btn, .lightbox')) {
    openLightbox(img.src);
  }
});

// ===== 全局 Toast（首页用） =====
function showToast(msg, type) {
  const t = document.getElementById('homeToast') || (() => {
    const el = document.createElement('div');
    el.id = 'homeToast';
    el.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:12px;background:var(--card-bg);backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.12);font-size:14px;border:1px solid rgba(255,255,255,0.3);transition:opacity 0.3s;';
    document.body.appendChild(el);
    return el;
  })();
  t.textContent = msg;
  t.style.display = 'block';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.style.display = 'none', 300); }, 2500);
}

// ===== 全局搜索 =====
function doGlobalSearch() {
  const q = document.getElementById('globalSearchInput')?.value.trim().toLowerCase();
  if (!q) { clearSearchHighlight(); return; }

  const articleMatches = articles.filter(a => matchArticle(a, q));
  const updateMatches = updates.filter(u =>
    (u.content||'').replace(/<[^>]+>/g,'').toLowerCase().includes(q)
  );
  const exploreMatches = explores.filter(e =>
    (e.title||'').toLowerCase().includes(q) ||
    (e.description||'').replace(/<[^>]+>/g,'').toLowerCase().includes(q)
  );

  if (articleMatches.length) {
    selectedTag = null;
    searchQuery = q;
    renderArticles();
    renderArticleToolbar();
    setTimeout(() => scrollToSection('articles'), 100);
  } else if (updateMatches.length) {
    setTimeout(() => scrollToSection('updates'), 100);
  } else if (exploreMatches.length) {
    setTimeout(() => scrollToSection('explore'), 100);
  }

  const total = articleMatches.length + updateMatches.length + exploreMatches.length;
  const parts = [];
  if (articleMatches.length) parts.push(`文章 ${articleMatches.length} 条`);
  if (updateMatches.length) parts.push(`动态 ${updateMatches.length} 条`);
  if (exploreMatches.length) parts.push(`探索 ${exploreMatches.length} 条`);
  showToast(total > 0 ? `"${q}" — 找到 ${parts.join('，')}` : '未找到相关内容');
}

function clearSearchHighlight() {
  searchQuery = '';
  renderArticles();
  renderArticleToolbar();
}

// ===== 搜索候选 =====
function renderSearchSuggestions(q) {
  const container = document.getElementById('searchSuggestions');
  const query = q.trim().toLowerCase();
  if (!query) { container.classList.remove('open'); return; }

  const results = [];
  const MAX = 8;

  for (const a of articles) {
    if (results.length >= MAX) break;
    if (matchArticle(a, query)) results.push({ type:'article', id:a.id, label:a.title||'无标题' });
  }
  for (const u of updates) {
    if (results.length >= MAX) break;
    const text = (u.content||'').replace(/<[^>]+>/g, '');
    if (text.toLowerCase().includes(query)) results.push({ type:'update', id:u.id, label:truncate(text, 50) });
  }
  for (const e of explores) {
    if (results.length >= MAX) break;
    if ((e.title||'').toLowerCase().includes(query) || (e.description||'').toLowerCase().includes(query))
      results.push({ type:'explore', id:e.url, label:e.title||'无标题' });
  }

  if (!results.length) { container.classList.remove('open'); return; }

  const ICONS = { article:'📝', update:'💬', explore:'🔍' };
  const LABELS = { article:'文章', update:'动态', explore:'探索' };
  container.innerHTML = results.map((r, i) =>
    `<div class="suggestion-item${i===0?' highlight':''}" data-type="${r.type}" data-id="${escapeHtml(r.id)}" data-index="${i}">
      <span class="suggestion-icon">${ICONS[r.type]}</span>
      <span class="suggestion-text">${escapeHtml(r.label)}</span>
      <span class="suggestion-badge">${LABELS[r.type]}</span>
    </div>`
  ).join('');
  container.classList.add('open');
}

function selectSuggestion(el) {
  const type = el.dataset.type;
  const id = el.dataset.id;
  document.getElementById('searchSuggestions').classList.remove('open');
  document.getElementById('globalSearchInput').value = el.querySelector('.suggestion-text').textContent;

  if (type === 'article') {
    showArticle(id);
  } else if (type === 'update') {
    document.getElementById('updates').scrollIntoView({ behavior:'smooth' });
  } else if (type === 'explore') {
    document.getElementById('explore').scrollIntoView({ behavior:'smooth' });
  }
}

// 委派建议项点击（mousedown 优先于 blur 触发）
document.addEventListener('mousedown', (e) => {
  const item = e.target.closest('.suggestion-item');
  if (item) selectSuggestion(item);
});

// 搜索按钮/回车 + 候选
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('globalSearchBtn');
  const inp = document.getElementById('globalSearchInput');
  if (btn) btn.addEventListener('click', doGlobalSearch);
  if (inp) {
    inp.addEventListener('keydown', (e) => {
      const container = document.getElementById('searchSuggestions');
      if (container.classList.contains('open')) {
        const items = container.querySelectorAll('.suggestion-item');
        const cur = container.querySelector('.highlight');
        let idx = cur ? parseInt(cur.dataset.index) : -1;
        if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx+1, items.length-1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx-1, 0); }
        else if (e.key === 'Enter') { e.preventDefault(); if (cur) selectSuggestion(cur); return; }
        else if (e.key === 'Escape') { container.classList.remove('open'); return; }
        else return;
        items.forEach(el => el.classList.remove('highlight'));
        items[idx]?.classList.add('highlight');
        items[idx]?.scrollIntoView({ block:'nearest' });
      } else if (e.key === 'Enter') {
        doGlobalSearch();
      }
    });
    inp.addEventListener('input', function() {
      if (!this.value.trim()) clearSearchHighlight();
      renderSearchSuggestions(this.value);
    });
    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#homeSearch')) document.getElementById('searchSuggestions')?.classList.remove('open');
    });
  }
});

// ===== 音乐播放器 =====
const PLAY_MODES = ['sequential', 'shuffle', 'loop'];
const MODE_CONFIG = {
  sequential: { icon: '➡️', label: '顺序播放', cls: 'mode-sequential' },
  shuffle:    { icon: '🔀', label: '随机播放', cls: 'mode-shuffle' },
  loop:       { icon: '🔁', label: '列表循环', cls: 'mode-loop' },
};
let playMode = 'sequential';

function getModeBtn() { return document.getElementById('modeBtn'); }

function updateModeUI() {
  const btn = getModeBtn();
  if (!btn) return;
  const cfg = MODE_CONFIG[playMode];
  btn.textContent = cfg.icon;
  btn.title = cfg.label;
  btn.className = `player-btn small mode-btn ${cfg.cls}`;
}

function cyclePlayMode() {
  const idx = PLAY_MODES.indexOf(playMode);
  playMode = PLAY_MODES[(idx + 1) % PLAY_MODES.length];
  updateModeUI();
  showToast(`播放模式：${MODE_CONFIG[playMode].label}`, 'info');
}
function renderPlaylist() {
  const playlist = document.getElementById('playlist');
  if (!musicList.length) {
    playlist.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:14px;">暂无歌曲</div>';
    return;
  }
  playlist.innerHTML = musicList.map((s, i) =>
    `<div class="playlist-item ${i === currentSongIndex ? 'active' : ''}" onclick="playSong(${i})">
      <span>${i === currentSongIndex && isPlaying ? '🔊' : '🎵'}</span>
      <span>${s.title || '未知'} - ${s.artist || '未知'}</span>
    </div>`
  ).join('');
}

function playSong(index) {
  if (!musicList[index] || !musicList[index].url) return;
  currentSongIndex = index;
  audio.src = musicList[index].url;
  audio.play().then(() => {
    isPlaying = true;
    updatePlayerUI();
    renderPlaylist();
  }).catch(() => {});
}

document.getElementById('playBtn').addEventListener('click', () => {
  if (!musicList.length) return;
  if (audio.src) {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      // 乐观更新：先设状态再播放，失败回退
      isPlaying = true;
      audio.play().catch(() => { isPlaying = false; updatePlayerUI(); });
    }
    updatePlayerUI();
  } else if (musicList.length) {
    playSong(0);
  }
});
document.getElementById('prevBtn').addEventListener('click', () => {
  if (!musicList.length) return;
  currentSongIndex = (currentSongIndex - 1 + musicList.length) % musicList.length;
  playSong(currentSongIndex);
});
document.getElementById('nextBtn').addEventListener('click', () => {
  if (!musicList.length) return;
  currentSongIndex = (currentSongIndex + 1) % musicList.length;
  playSong(currentSongIndex);
});
document.getElementById('listToggleBtn').addEventListener('click', () => {
  document.getElementById('playlist').classList.toggle('open');
});
document.getElementById('modeBtn').addEventListener('click', cyclePlayMode);

// 进度条
document.getElementById('progressWrap').addEventListener('click', (e) => {
  if (!audio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
});

audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('ended', () => {
  if (!musicList.length) return;
  if (playMode === 'loop') {
    // 列表循环：播下一首
    currentSongIndex = (currentSongIndex + 1) % musicList.length;
    playSong(currentSongIndex);
  } else if (playMode === 'shuffle') {
    // 随机播放：从列表中随机选一首（不重样，除非只剩一首）
    if (musicList.length > 1) {
      let next;
      do { next = Math.floor(Math.random() * musicList.length); }
      while (next === currentSongIndex);
      currentSongIndex = next;
    }
    playSong(currentSongIndex);
  } else {
    // 顺序播放：播下一首（到底停止）
    if (currentSongIndex < musicList.length - 1) {
      currentSongIndex++;
      playSong(currentSongIndex);
    } else {
      isPlaying = false;
      updatePlayerUI();
    }
  }
});

function updateProgress() {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
  const m = Math.floor(audio.currentTime / 60);
  const s = Math.floor(audio.currentTime % 60);
  document.getElementById('timeDisplay').textContent = `${m}:${String(s).padStart(2,'0')}`;
}

function updatePlayerUI() {
  const btn = document.getElementById('playBtn');
  btn.textContent = isPlaying ? '⏸' : '▶';
  const cover = document.getElementById('playerCover');
  cover.classList.toggle('playing', isPlaying);
  if (musicList[currentSongIndex]) {
    const song = musicList[currentSongIndex];
    document.getElementById('songTitle').textContent = song.title || '未知';
    document.getElementById('songArtist').textContent = song.artist || '未知';
    // 封面图片
    if (song.cover) {
      cover.innerHTML = '';
      const img = document.createElement('img');
      img.src = song.cover;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:12px;';
      cover.appendChild(img);
    } else {
      cover.textContent = '🎵';
    }
  }
}

// ===== 探索标签切换 =====
document.getElementById('exploreTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.explore-tab');
  if (!tab) return;
  document.querySelectorAll('.explore-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentCategory = tab.dataset.category;
  renderExplores(currentCategory);
});

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => { loadAll(); updateModeUI(); });
