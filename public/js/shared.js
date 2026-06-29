(function () {
  const STORE_KEY = 'boke_data';
  const TOKEN_KEY = 'boke_token';
  const DEFAULT_THEME = {
    bgColor: '#fff5f7',
    primaryColor: '#ffb0c0',
    secondaryColor: '#87ceeb',
    cardBg: 'rgba(255,255,255,0.6)',
    textColor: '#2d2d2d',
    textSecondary: '#888888',
  };

  function getDefaultStore() {
    return {
      articles: [],
      updates: [],
      explores: [],
      music: [],
      theme: { ...DEFAULT_THEME },
    };
  }

  function loadStore(fallback = null) {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || fallback;
    } catch {
      return fallback;
    }
  }

  function loadStoreOrDefault() {
    return loadStore(getDefaultStore());
  }

  function saveStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function createToast(id = 'homeToast') {
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 24px;border-radius:12px;background:var(--card-bg);backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,0.12);font-size:14px;border:1px solid rgba(255,255,255,0.3);transition:opacity 0.3s;';
    document.body.appendChild(el);
    return el;
  }

  function showToast(msg, type = 'success', opts = {}) {
    const id = opts.id || 'toast';
    const fallbackId = opts.fallbackId || 'homeToast';
    const existing = byId(id);
    const toast = existing || byId(fallbackId) || createToast(fallbackId);

    toast.textContent = msg;
    if (existing) {
      toast.className = `toast ${type || 'success'}`;
    }
    toast.style.display = 'block';
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 300);
    }, opts.duration || 2500);
  }

  function renderPagination(page, totalPages, onChange) {
    if (totalPages <= 1) return '';
    return `<div class="pagination">
    <button class="page-btn" onclick="${onChange}(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← 上一页</button>
    <span class="page-info">${page} / ${totalPages}</span>
    <button class="page-btn" onclick="${onChange}(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页 →</button>
  </div>`;
  }

  function applyThemeVariables(theme = {}, root = document.documentElement) {
    const styles = root.style;
    const mapping = {
      bgColor: '--bg',
      primaryColor: '--primary',
      secondaryColor: '--secondary',
      cardBg: '--card-bg',
      textColor: '--text',
      textSecondary: '--text-secondary',
    };

    for (const [key, variable] of Object.entries(mapping)) {
      if (theme[key]) styles.setProperty(variable, theme[key]);
    }
  }

  async function loadDataWithFallback(types = ['articles', 'updates', 'explores', 'music', 'theme']) {
    const sources = [
      async () => {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error('API offline');
        return res.json();
      },
      () => loadStore(),
      async () => {
        const data = {};
        for (const key of types) {
          const res = await fetch(`data/${key}.json`);
          if (res.ok) data[key] = await res.json();
        }
        if (!data.articles) throw new Error('No seed data');
        return data;
      },
    ];

    for (const source of sources) {
      try {
        const data = await source();
        if (data) return data;
      } catch {}
    }

    return null;
  }

  async function syncToServer(type, data, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(`/api/data/${type}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = new Error(`Failed to sync ${type} (${res.status})`);
      error.status = res.status;
      throw error;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  // 简单缓存：最近 N 个结果
  function memoize(fn, size = 64) {
    const cache = new Map();
    return (key) => {
      if (cache.has(key)) return cache.get(key);
      const val = fn(key);
      if (cache.size >= size) cache.delete(cache.keys().next().value);
      cache.set(key, val);
      return val;
    };
  }

  // 受控截断：超过 maxLen 自动加 …
  function truncate(str, maxLen) {
    if (!str) return str ?? '';
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
  }

  function formatDate(date) {
    return date ? new Date(date).toLocaleDateString('zh-CN') : '';
  }

  // 缓存版本的 formatDate（文章列表/动态列表经常重复格式化相同日期）
  const formatDateCached = memoize(d => d ? new Date(d).toLocaleDateString('zh-CN') : '');

  function genId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function now() {
    return new Date().toISOString();
  }

  // ===== Token 认证管理 =====
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function saveToken(token, persistent) {
    if (persistent) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  async function loginWithServer(password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const error = new Error('登录失败');
      error.status = res.status;
      throw error;
    }
    const data = await res.json();
    return data.token;
  }

  async function logoutFromServer() {
    const token = getToken();
    if (!token) return;
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
    } catch {}
    clearToken();
  }

  async function incrementView(type, id) {
    try {
      await fetch(`/api/data/${type}/${id}/view`, { method: 'POST' });
    } catch {}
  }

  window.Boke = {
    STORE_KEY,
    DEFAULT_THEME,
    getDefaultStore,
    loadStore,
    loadStoreOrDefault,
    saveStore,
    $,
    $all,
    byId,
    showToast,
    renderPagination,
    applyThemeVariables,
    loadDataWithFallback,
    syncToServer,
    escapeHtml,
    truncate,
    memoize,
    formatDate,
    formatDateCached,
    genId,
    now,
    getToken,
    saveToken,
    clearToken,
    loginWithServer,
    logoutFromServer,
    incrementView,
    TOKEN_KEY,
  };
})();
