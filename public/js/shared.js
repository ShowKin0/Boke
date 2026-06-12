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

  async function syncToServer(type, data, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(`/api/data/${type}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to sync ${type} (${res.status})`);
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

  // 缓存版本的 escapeHtml（适合重复调用相同字符串的场景）
  const escapeHtmlCached = memoize(escapeHtml);

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
    if (!res.ok) throw new Error('登录失败');
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
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`/api/data/${type}/${id}/view`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
    } catch {}
  }

  window.Boke = {
    STORE_KEY,
    DEFAULT_THEME,
    getDefaultStore,
    loadStore,
    loadStoreOrDefault,
    saveStore,
    syncToServer,
    escapeHtml,
    escapeHtmlCached,
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
