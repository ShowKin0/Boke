(function () {
  const adminList = {
    _cfgs: {},

    register(key, cfg) {
      this._cfgs[key] = {
        searchFields: cfg.searchFields || [],
        searchInputId: cfg.searchInputId || key + 'SearchInput',
        pageInputId: cfg.pageInputId || key + 'Page',
        pageSize: cfg.pageSize || 10,
        sortFn: cfg.sortFn || null,
      };
    },

    getFiltered(key, items) {
      const cfg = this._cfgs[key];
      const q = (document.getElementById(cfg.searchInputId)?.value || '').trim().toLowerCase();
      const result = q
        ? items.filter(item =>
            cfg.searchFields.some(field => {
              const val = field(item);
              return val && val.toLowerCase().includes(q);
            })
          )
        : [...items];
      if (cfg.sortFn) result.sort(cfg.sortFn);
      return result;
    },

    getPage(key, items) {
      const cfg = this._cfgs[key];
      const page = parseInt(document.getElementById(cfg.pageInputId)?.value || '1');
      const totalPages = Math.ceil(items.length / cfg.pageSize) || 1;
      return { items: items.slice((page - 1) * cfg.pageSize, page * cfg.pageSize), page, totalPages };
    },

    pageNav(key, page, totalPages, loadFnName, colspan) {
      if (totalPages <= 1) return '';
      const nav = `<div class="admin-pagination">
      <button class="page-btn" onclick="window._adminPagePrev('${key}')" ${page <= 1 ? 'disabled' : ''}>←</button>
      <span>${page}/${totalPages}</span>
      <button class="page-btn" onclick="window._adminPageNext('${key}')" ${page >= totalPages ? 'disabled' : ''}>→</button>
    </div>`;
      if (colspan === 'card') {
        return `<div class="admin-pagination-wrap">${nav}</div>`;
      }
      return `<tr class="pagination-row"><td colspan="${colspan}">${nav}</td></tr>`;
    },

    filter(key, loadFn) {
      const inp = document.getElementById(this._cfgs[key].pageInputId);
      if (inp) inp.value = 1;
      loadFn();
    },
  };

  window.BokeAdminList = adminList;
  window._adminPagePrev = function (key) {
    const cfg = adminList._cfgs[key];
    const inp = document.getElementById(cfg.pageInputId);
    const page = parseInt(inp?.value || '1');
    if (page > 1) inp.value = page - 1;
    window[key]?.load();
  };
  window._adminPageNext = function (key) {
    const cfg = adminList._cfgs[key];
    const inp = document.getElementById(cfg.pageInputId);
    const page = parseInt(inp?.value || '1');
    inp.value = page + 1;
    window[key]?.load();
  };
})();
