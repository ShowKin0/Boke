(function () {
  const STORE_KEY = 'boke_data';
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

  async function syncToServer(type, data) {
    const res = await fetch(`/api/data/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`Failed to sync ${type}`);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function formatDate(date) {
    return date ? new Date(date).toLocaleDateString('zh-CN') : '';
  }

  function genId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function now() {
    return new Date().toISOString();
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
    formatDate,
    genId,
    now,
  };
})();
