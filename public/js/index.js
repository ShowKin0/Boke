// ===== 状态管理 =====
const { loadStore, saveStore, escapeHtml } = window.Boke;

// 检查 ?clear 参数，清除 localStorage 缓存
if (window.location.search.includes('clear')) {
  localStorage.removeItem('boke_data');
  // 移除 URL 参数，防止刷新后再次触发
  const url = new URL(window.location);
  url.searchParams.delete('clear');
  window.history.replaceState({}, '', url);
}
let articles = [], updates = [], explores = [], musicList = [], theme = {};
let currentCategory = 'all';
let currentSongIndex = 0;
let isPlaying = false;
const audio = new Audio();


// ===== 从 localStorage / data 文件加载数据 =====
function applyData(data) {
  if (!data) return;
  articles = data.articles || [];
  updates = data.updates || [];
  explores = data.explores || [];
  musicList = data.music || [];
  if (data.theme) { theme = data.theme; applyTheme(theme); }
  renderHomeArticles();
  renderHomeUpdates();
  renderArticles();
  renderUpdates();
  renderExploreTabs();
  renderExplores();
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

// ===== 时钟 =====
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clockTime').textContent = `${h}:${m}:${s}`;
  const days = ['日','一','二','三','四','五','六'];
  document.getElementById('clockDate').textContent =
    `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${days[now.getDay()]}`;

  // 时钟阴影随太阳位置变化
  const hour = now.getHours() + now.getMinutes() / 60;
  const angle = (hour / 24) * 360;
  const rad = (angle * Math.PI) / 180;
  const shadowX = Math.sin(rad) * 24;
  const shadowY = Math.cos(rad) * 24;
  const blur = 24 + Math.sin(rad) * 12;
  const opacity = 0.04 + Math.abs(Math.sin(rad)) * 0.06;
  document.getElementById('clockFrame').style.boxShadow =
    `${shadowX.toFixed(1)}px ${shadowY.toFixed(1)}px ${blur.toFixed(1)}px rgba(0,0,0,${opacity.toFixed(3)})`;
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
  const top3 = articles.slice(0, 3);
  let html = '<h4>📖 最新文章</h4>';
  top3.forEach(a => {
    html += `<div class="mini-card" onclick="document.getElementById('articles').scrollIntoView({behavior:'smooth'})">
      <div class="mini-title">${a.title || '无标题'}</div>
      <div class="mini-meta">${a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN') : ''} · ${(a.summary || '暂无摘要').substring(0, 24)}${(a.summary||'').length > 24 ? '…' : ''}</div>
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
  const top3 = updates.slice(0, 3);
  let html = '<h4>💬 最新动态</h4>';
  top3.forEach(u => {
    html += `<div class="mini-card" onclick="document.getElementById('updates').scrollIntoView({behavior:'smooth'})">
      <div class="mini-title">${(u.content || '无内容').substring(0, 30)}${(u.content||'').length > 30 ? '…' : ''}</div>
      <div class="mini-meta">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : ''}</div>
    </div>`;
  });
  col.innerHTML = html;
}

// ===== 文章区 =====
function renderArticles() {
  const container = document.getElementById('articlesContainer');
  const loading = document.getElementById('articlesLoading');
  if (loading) loading.style.display = 'none';
  if (!articles.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📝</div><p>暂无文章</p></div>`;
    return;
  }
  let html = '';
  // 置顶/首篇
  const featured = articles[0];
  html += `<div class="article-featured fade-up" onclick="showArticle('${featured.id}')" style="cursor:pointer;">
    <div class="article-featured-body">
      <h2>${featured.title || '无标题'}</h2>
      <p>${featured.summary || '暂无摘要'}</p>
      <div class="meta">
        ${featured.createdAt ? new Date(featured.createdAt).toLocaleDateString('zh-CN') : ''}
        ${featured.tags ? featured.tags.map(t => `<span class="card-tag">${t}</span>`).join('') : ''}
      </div>
    </div>
  </div>`;

  // 其余文章
  const rest = articles.slice(1);
  if (rest.length) {
    html += '<div class="articles-grid" style="margin-top:24px;">';
    rest.forEach(a => {
      html += `<div class="glass-card fade-up" onclick="showArticle('${a.id}')" style="cursor:pointer;">
        <h3>${a.title || '无标题'}</h3>
        <div class="card-date">${a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN') : ''}</div>
        <div class="card-summary">${(a.summary || '').substring(0, 80)}${(a.summary||'').length > 80 ? '...' : ''}</div>
        ${a.tags ? a.tags.map(t => `<span class="card-tag">${t}</span>`).join('') : ''}
      </div>`;
    });
    html += '</div>';
  }
  container.innerHTML = html;
  initFadeUp();
}

// ===== 动态区 =====
function renderUpdates() {
  const container = document.getElementById('updatesContainer');
  if (!updates.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">💬</div><p>暂无动态</p></div>`;
    return;
  }
  container.innerHTML = updates.map(u => `<div class="update-card fade-up">
    <div class="update-header">
      <div class="update-avatar">👤</div>
      <div>
        <div class="update-name">站主</div>
        <div class="update-time">${u.createdAt ? new Date(u.createdAt).toLocaleString('zh-CN') : ''}</div>
      </div>
    </div>
    <div class="update-content prose">${u.content || ''}</div>
  </div>`).join('');
  initFadeUp();
}

// ===== 探索区 =====
const CATEGORY_LABELS = { website:'🌐 网站推荐', source:'📦 源码', video:'🎬 学习视频' };
function renderExploreTabs() {
  const tabs = document.getElementById('exploreTabs');
  // 保留"全部"按钮，去重动态生成其余标签
  const allBtn = tabs.querySelector('[data-category="all"]');
  tabs.innerHTML = '';
  tabs.appendChild(allBtn);
  const cats = [...new Set(explores.map(e => e.category).filter(Boolean))];
  cats.forEach(cat => {
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
  const filtered = category && category !== 'all' ? explores.filter(e => e.category === category) : explores;
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🔍</div><p>暂无探索项目</p></div>`;
    return;
  }
  let html = '';
  filtered.forEach(e => {
    const categoryLabel = CATEGORY_LABELS[e.category] || e.category || '其他';
    html += `<a class="explore-item fade-up" href="${e.url || '#'}" target="_blank" rel="noopener">
      <span class="icon">${e.icon || '🔗'}</span>
      <h4>${escapeHtml(e.title || '')}</h4>
      <p>${e.description || ''}</p>
      <span class="explore-category">${categoryLabel}</span>
    </a>`;
  });
  container.innerHTML = html;
  initFadeUp();
}

// ===== 文章详情 =====
function showArticle(id) {
  const a = articles.find(x => x.id === id);
  if (!a) return;
  const tags = a.tags ? a.tags.map(t => `<span class="card-tag" style="display:inline-block;padding:2px 12px;background:rgba(135,206,235,0.15);color:var(--secondary);border-radius:6px;font-size:13px;margin-right:4px;">${t}</span>`).join('') : '';
  const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN', {year:'numeric',month:'long',day:'numeric'}) : '';
  document.getElementById('articleDetailContent').innerHTML = `
    <h1>${escapeHtml(a.title || '')}</h1>
    <div class="meta">${date} ${tags}</div>
    <div class="content prose">${a.content || ''}</div>
  `;
  document.getElementById('articleDetail').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeArticle() {
  document.getElementById('articleDetail').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('articleDetail').addEventListener('click', (e) => {
  if (e.target.closest('.article-detail-card')) return;
  closeArticle();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeArticle(); });

// ===== 音乐播放器 =====
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

// 进度条
document.getElementById('progressWrap').addEventListener('click', (e) => {
  if (!audio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
});

audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('ended', () => {
  if (musicList.length) {
    currentSongIndex = (currentSongIndex + 1) % musicList.length;
    playSong(currentSongIndex);
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
document.addEventListener('DOMContentLoaded', loadAll);
