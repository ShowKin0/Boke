const PASS = 'zhang';
const {
  loadStoreOrDefault,
  saveStore,
  getDefaultStore,
  genId,
  now,
  syncToServer: syncDataToServer,
  escapeHtml,
  formatDate,
} = window.Boke;

// ===== 服务器同步 =====
async function syncToServer(type, data) {
  try {
    await syncDataToServer(type, data);
  } catch (e) {
    // 服务器未运行时静默降级
    console.warn('服务器未运行，数据仅保存在 localStorage');
  }
}

let store = loadStoreOrDefault();
let currentTab = 'articles';

function showToast(msg, type) { const t=document.getElementById('toast'); t.textContent=msg; t.className='toast '+(type||'success'); t.style.display='block'; setTimeout(()=>t.style.display='none',2500); }

// ===== 富文本编辑器通用工厂 =====
let activeEditor = null;

/** 创建一个富文本编辑器（工具栏 + contenteditable） */
function createRichEditor(editorId, placeholder) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';
  wrap.innerHTML = `
    <div class="editor-toolbar">
      <button type="button" class="ed-btn" data-cmd="bold" title="粗体"><b>B</b></button>
      <button type="button" class="ed-btn" data-cmd="italic" title="斜体"><i>I</i></button>
      <button type="button" class="ed-btn" data-cmd="strikeThrough" title="删除线"><s>S</s></button>
      <button type="button" class="ed-btn ed-color-btn" data-cmd="foreColor" title="文字颜色" style="font-weight:700;position:relative;font-size:14px;">A</button>
      <span class="ed-divider"></span>
      <button type="button" class="ed-btn" data-cmd="h2" title="二级标题">H2</button>
      <button type="button" class="ed-btn" data-cmd="h3" title="三级标题">H3</button>
      <span class="ed-divider"></span>
      <button type="button" class="ed-btn" data-cmd="insertUnorderedList" title="无序列表">•</button>
      <button type="button" class="ed-btn" data-cmd="insertOrderedList" title="有序列表">1.</button>
      <button type="button" class="ed-btn" data-cmd="blockquote" title="引用">💬</button>
      <span class="ed-divider"></span>
      <button type="button" class="ed-btn" data-cmd="link" title="链接">🔗</button>
      <button type="button" class="ed-btn" data-cmd="image" title="图片">📷</button>
      <button type="button" class="ed-btn" data-cmd="hr" title="分割线">—</button>
      <span class="ed-divider"></span>
      <button type="button" class="ed-btn code-btn" data-cmd="codeBlock" title="代码块">▨ 代码块</button>
    </div>
    <div contenteditable="true" class="article-editor" id="${editorId}" data-placeholder="${placeholder || ''}"></div>
  `;
  // 工具栏点击委派
  wrap.querySelector('.editor-toolbar').addEventListener('click', function(e) {
    const btn = e.target.closest('.ed-btn');
    if (!btn) return;
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    const ed = activeEditor || document.getElementById(editorId);
    ed.focus();
    switch (cmd) {
      case 'bold': case 'italic': case 'strikeThrough':
      case 'insertUnorderedList': case 'insertOrderedList':
        document.execCommand(cmd, false, null);
        break;
      case 'h2':
      case 'h3':
      case 'blockquote': {
        // 点击已激活的格式 → 取消（恢复为段落）
        let cur = '';
        try { cur = document.queryCommandValue('formatBlock'); } catch {}
        const tag = cmd === 'blockquote' ? 'blockquote' : cmd;
        if (cur === tag || cur === '<' + tag + '>') {
          document.execCommand('formatBlock', false, 'p');
        } else {
          document.execCommand('formatBlock', false, cmd === 'blockquote' ? 'blockquote' : cmd);
        }
        break;
      }
      case 'hr': document.execCommand('insertHorizontalRule', false, null); break;
      case 'link': {
        const url = prompt('输入链接 URL:', 'https://');
        if (url) document.execCommand('createLink', false, url);
        break;
      }
      case 'image': {
        const input = document.getElementById('imageFileInput');
        input.value = '';
        input.click();
        break;
      }
      case 'codeBlock': openCodeModal(ed); break;
      case 'foreColor': {
        // 如果文字已有颜色 → 取消（恢复默认）
        let cur = '';
        try { cur = document.queryCommandValue('foreColor'); } catch {}
        const DEFAULT = 'rgb(45, 45, 45)';
        if (cur && cur !== DEFAULT) {
          document.execCommand('foreColor', false, '#2d2d2d');
          updateToolbarState();
          break;
        }
        // 没有颜色 → 打开拾色器（一次性监听，防止堆积）
        const input = document.getElementById('foreColorInput');
        input.value = '#e74c3c';
        const handler = () => {
          document.execCommand('foreColor', false, input.value);
          updateToolbarState();
          input.removeEventListener('change', handler);
        };
        input.removeEventListener('change', handler);
        input.addEventListener('change', handler);
        input.click();
        break;
      }
    }
    updateToolbarState();
  });
  // 焦点跟踪 + 选中态更新
  const editor = wrap.querySelector('.article-editor');
  editor.addEventListener('focus', () => { activeEditor = editor; });
  editor.addEventListener('mouseup', updateToolbarState);
  editor.addEventListener('keyup', updateToolbarState);
  return wrap;
}

/** 更新工具栏按钮选中态（粗体/斜体/列表等） */
function updateToolbarState() {
  const toolbar = activeEditor?.closest('.editor-wrap')?.querySelector('.editor-toolbar');
  if (!toolbar) return;
  const activeCmds = {
    bold: false, italic: false, strikeThrough: false,
    insertUnorderedList: false, insertOrderedList: false,
  };
  Object.keys(activeCmds).forEach(cmd => {
    try { activeCmds[cmd] = document.queryCommandState(cmd); } catch {}
  });
  let formatBlock = '', foreColor = '';
  try { formatBlock = document.queryCommandValue('formatBlock'); } catch {}
  try { foreColor = document.queryCommandValue('foreColor'); } catch {}
  // 标题本身有加粗效果，但不点亮加粗按钮
  const isHeading = formatBlock && /^h[1-6]$|^<h[1-6]>$/.test(formatBlock);
  // 浏览器无颜色时返回的各种可能值
  const noColor = ['rgb(0,0,0)', 'rgb(0, 0, 0)', 'rgb(45,45,45)', 'rgb(45, 45, 45)', '', 'inherit', 'transparent', undefined, null];
  toolbar.querySelectorAll('.ed-btn[data-cmd]').forEach(btn => {
    const cmd = btn.dataset.cmd;
    let on = activeCmds[cmd];
    // 标题自带加粗，不点亮 B 按钮
    if (cmd === 'bold' && isHeading) on = false;
    if (cmd === 'h2' || cmd === 'h3' || cmd === 'blockquote') {
      on = formatBlock === cmd || formatBlock === '<' + cmd + '>';
    }
    if (cmd === 'foreColor') {
      on = foreColor && !noColor.includes(foreColor.toLowerCase ? foreColor.toLowerCase() : foreColor);
      const color = on ? foreColor : '#999';
      btn.style.setProperty('--color', color);
    }
    btn.classList.toggle('active', !!on);
  });
}

// ===== 代码块弹窗 =====
function openCodeModal(editor) {
  activeEditor = editor || activeEditor || document.getElementById('articleContent');
  document.getElementById('codeModal').style.display = 'block';
  document.getElementById('codeInput').value = '';
  document.getElementById('codeOverlayContent').innerHTML = '';
  document.getElementById('codeGutter').textContent = '1';
  document.getElementById('codeLangSelect').value = '';
  document.getElementById('codeInput').focus();
}
function closeCodeModal() {
  document.getElementById('codeModal').style.display = 'none';
}
// 图片上传 — 通用（使用 activeEditor）
document.getElementById('imageFileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片超过 5MB 限制', 'error');
    this.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = async function(ev) {
    const base64 = ev.target.result;
    const editor = activeEditor || document.getElementById('articleContent');
    editor.focus();
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, name: file.name }),
      });
      if (res.ok) {
        const result = await res.json();
        const img = `<img src="${result.url}" alt="${file.name}" style="max-width:55%;max-height:260px;float:left;margin:0.5em 1em 0.5em 0;border-radius:8px;object-fit:contain;">`;
        document.execCommand('insertHTML', false, img);
        showToast('图片已上传到 data/uploads/');
        return;
      }
    } catch { console.warn('图片上传失败，降级为 base64'); }
    const img = `<img src="${base64}" alt="${file.name}" style="max-width:55%;max-height:260px;float:left;margin:0.5em 1em 0.5em 0;border-radius:8px;object-fit:contain;">`;
    document.execCommand('insertHTML', false, img);
    showToast('图片已插入（本地模式）');
  };
  reader.onerror = function() { showToast('图片读取失败', 'error'); };
  reader.readAsDataURL(file);
  this.value = '';
});
// 音乐文件上传 — 上传到 data/uploads/ 并填入 URL 输入框
document.getElementById('musicFileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    showToast('音频文件超过 20MB 限制', 'error');
    this.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = async function(ev) {
    const base64 = ev.target.result;
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, name: file.name }),
      });
      if (res.ok) {
        const result = await res.json();
        document.getElementById('musicUrl').value = result.url;
        showToast('音频已上传到 data/uploads/');
        return;
      }
    } catch { console.warn('音频上传失败，降级为 base64'); }
    document.getElementById('musicUrl').value = base64;
    showToast('音频已转为 base64（服务器未运行）');
  };
  reader.readAsDataURL(file);
  this.value = '';
});
// 音乐封面图片上传
document.getElementById('musicCoverInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('封面图片超过 5MB 限制', 'error');
    this.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = async function(ev) {
    const base64 = ev.target.result;
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, name: file.name }),
      });
      if (res.ok) {
        const result = await res.json();
        document.getElementById('musicCover').value = result.url;
        showCoverPreview(result.url);
        return;
      }
    } catch { console.warn('封面上传失败，降级为 base64'); }
    document.getElementById('musicCover').value = base64;
    showCoverPreview(base64);
  };
  reader.readAsDataURL(file);
  this.value = '';
});
function showCoverPreview(url) {
  const preview = document.getElementById('musicCoverPreview');
  preview.style.display = 'block';
  preview.innerHTML = '';
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:12px;';
  preview.appendChild(img);
}
// 代码语法高亮渲染
function highlightCodeText(code, lang) {
  if (!code) return '';
  let html = escapeHtml(code);
  const kwSets = {
    javascript: 'async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield',
    typescript: 'async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|with|yield',
    python: 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|self|True|try|while|with|yield',
    cpp: 'auto|bool|break|case|catch|class|const|continue|default|delete|do|else|enum|explicit|export|extern|false|float|for|friend|goto|if|include|inline|int|long|namespace|new|operator|override|private|protected|public|return|short|signed|sizeof|static|struct|switch|template|this|throw|true|try|typedef|typename|union|unsigned|using|virtual|void|volatile|while',
    java: 'abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|false|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|true|try|void|volatile|while',
    go: 'break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var',
    rust: 'as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while',
    sql: 'ADD|ALL|ALTER|AND|AS|ASC|BETWEEN|BY|CREATE|DELETE|DESC|DISTINCT|DROP|FROM|GROUP|HAVING|IN|INSERT|INTO|IS|JOIN|LEFT|LIKE|LIMIT|NOT|NULL|OR|ORDER|RIGHT|SELECT|SET|TABLE|TOP|TRUNCATE|UNION|UPDATE|VALUES|VIEW|WHERE',
    html: 'html|head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|form|input|button|select|option|textarea|h1|h2|h3|h4|h5|h6|br|hr|meta|link|script|style|section|nav|header|footer|main|article|aside|figure|figcaption|blockquote|code|pre|em|strong|i|b|u|s|mark|small|sub|sup',
    css: 'color|background|margin|padding|border|font|text|display|position|width|height|top|left|right|bottom|flex|grid|align|justify|transform|transition|animation|overflow|opacity|z-index|box-shadow|filter|backdrop-filter',
  };
  const typeSets = {
    javascript: 'string|number|boolean|null|undefined|void|any|never|unknown|object|symbol|bigint|Array|Promise|Map|Set|Function',
    typescript: 'string|number|boolean|null|undefined|void|any|never|unknown|object|symbol|bigint|Array|Promise|Map|Set|Record|Partial|Required|Pick|Omit|Exclude|ReturnType',
    python: 'int|float|bool|str|list|dict|tuple|set|None|True|False|bytes|range|map|filter|type|object',
    cpp: 'int|float|double|char|bool|void|string|vector|map|set|list|auto|long|short|unsigned|size_t|int8_t|int16_t|int32_t|int64_t|nullptr',
    java: 'int|float|double|char|boolean|void|long|short|byte|String|Integer|Float|Double|Boolean|List|Map|Set|ArrayList|HashMap|Object|Class|Thread',
    go: 'int|int8|int16|int32|int64|uint|float32|float64|bool|string|byte|rune|error|map|chan|struct|interface|slice',
    rust: 'i32|i64|u32|u64|f32|f64|bool|char|str|String|Vec|HashMap|Option|Result|Box|Arc|Mutex|dyn|impl',
  };
  const builtinSets = {
    javascript: 'console|Math|JSON|Promise|Symbol|Reflect|Proxy|RegExp|Date|Error|SyntaxError|TypeError|RangeError|ReferenceError|EvalError|URIError|parseInt|parseFloat|setTimeout|setInterval|clearTimeout|clearInterval|fetch|require|module|exports|process|global|Buffer|ArrayBuffer|Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array|BigInt|BigInt64Array|BigUint64Array|WeakMap|WeakSet|WeakRef|FinalizationRegistry|Atomics|SharedArrayBuffer',
    typescript: 'console|Math|JSON|Promise|Symbol|Reflect|Proxy|RegExp|Date|Error|parseInt|parseFloat|setTimeout|setInterval|clearTimeout|clearInterval|fetch|ArrayBuffer|Map|Set|WeakMap|WeakSet',
    python: 'print|len|range|int|float|str|list|dict|tuple|set|type|open|input|map|filter|zip|enumerate|sorted|reversed|min|max|sum|abs|round|isinstance|hasattr|getattr|setattr|super|object|property|staticmethod|classmethod|iter|next|all|any|bin|bool|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dir|divmod|eval|exec|exit|format|frozenset|globals|hash|help|hex|id|issubclass|iter|locals|memoryview|oct|ord|pow|quit|repr|reversed|round|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip|__import__',
    cpp: 'cout|cin|endl|printf|scanf|fprintf|sprintf|fscanf|fopen|fclose|fgets|fputs|fread|fwrite|fseek|ftell|rewind|remove|rename|tmpfile|tmpnam|stdin|stdout|stderr|NULL|nullptr|true|false|std|make_shared|make_unique|static_cast|dynamic_cast|reinterpret_cast|const_cast|std::cout|std::cin|std::endl|std::string|std::vector|std::map|std::set|std::list|std::queue|std::stack|std::deque|std::pair|std::make_pair',
    java: 'System|Math|Arrays|Collections|Objects|StringBuilder|StringBuffer|Pattern|Matcher|Comparator|Comparable|Iterator|Iterable|Scanner|BufferedReader|InputStreamReader|FileReader|FileWriter|BufferedWriter|PrintWriter|FileInputStream|FileOutputStream|ObjectInputStream|ObjectOutputStream|ClassLoader|Runtime|System|Thread|Runnable|Callable|Future|Executor|Executors|ThreadPoolExecutor|ScheduledExecutorService|Optional|Stream|Collectors|Function|Predicate|Consumer|Supplier|BiFunction',
    go: 'fmt|print|println|printf|sprintf|Sprintf|Fprintf|Sprintln|Sprint|append|copy|make|new|close|delete|panic|recover|error|len|cap|complex|real|imag|iota|nil|true|false|iota|string|bool|int|int8|int16|int32|int64|uint|float32|float64|byte|rune|uintptr|complex64|complex128',
    rust: 'println!|print!|format!|write!|writeln!|eprint!|eprintln!|vec!|Some|None|Ok|Err|String|Vec|HashMap|Box|Arc|Mutex|Rc|Cell|RefCell|Result|Option|Iterator|into_iter|iter|map|collect|unwrap|expect|clone|copied|as_ref|as_mut|take|borrow|borrow_mut|try!|panic!|unreachable!|unimplemented!|todo!|dbg!|assert!|assert_eq!|assert_ne!|debug_assert!',
  };
  // 先处理注释和字符串（它们在 HTML 标签里，后面的匹配要跳过标签）
  html = html.replace(/(\/\/[^\n]*)/g, '<span class="hl-cmt">$1</span>');
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-cmt">$1</span>');
  html = html.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="hl-str">$1</span>');
  // 匹配关键词/类型/内置函数/数字时跳过已生成的 HTML 标签
  function replaceOutsideHTML(re, fn) {
    return html.replace(/(<[^>]*>)|(\b\w+\b)/g, (m, tag, word) => {
      if (tag) return tag; // 保留已有 HTML 不动
      return fn(word);
    });
  }
  const kw = kwSets[lang];
  if (kw) {
    const words = new Set(kw.split('|'));
    html = replaceOutsideHTML(null, w => words.has(w) ? `<span class="hl-kw">${w}</span>` : w);
  }
  const types = typeSets[lang];
  if (types) {
    const words = new Set(types.split('|'));
    html = replaceOutsideHTML(null, w => words.has(w) ? `<span class="hl-type">${w}</span>` : w);
  }
  const builtins = builtinSets[lang];
  if (builtins) {
    const words = new Set(builtins.split('|'));
    html = replaceOutsideHTML(null, w => words.has(w) ? `<span class="hl-builtin">${w}</span>` : w);
  }
  html = replaceOutsideHTML(null, w => /^\d+(?:\.\d+)?$/.test(w) ? `<span class="hl-num">${w}</span>` : w);
  return html;
}
function updateCodePreview() {
  const ta = document.getElementById('codeInput');
  const code = ta.value;
  const lang = document.getElementById('codeLangSelect').value;
  // 更新行号
  const lines = code.split('\n').length;
  let gutterHtml = '';
  for (let i = 1; i <= lines; i++) gutterHtml += i + '\n';
  document.getElementById('codeGutter').textContent = gutterHtml;
  // 更新高亮
  document.getElementById('codeOverlayContent').innerHTML = highlightCodeText(code, lang);
  // 同步滚动
  document.getElementById('codeOverlay').scrollTop = ta.scrollTop;
}
function insertCodeBlock() {
  const code = document.getElementById('codeInput').value;
  if (!code.trim()) { showToast('请输入代码', 'error'); return; }
  const lang = document.getElementById('codeLangSelect').value;
  const editor = activeEditor || document.getElementById('articleContent');
  editor.focus();
  // 用 pre 标签包装代码块
  const highlighted = highlightCodeText(code, lang);
  const langAttr = lang ? ` data-lang="${lang}"` : '';
  const html = `<pre${langAttr}><code class="language-${lang || 'plaintext'}">${highlighted}</code></pre>`;
  document.execCommand('insertHTML', false, html + '<p><br></p>');
  closeCodeModal();
  showToast('代码块已插入');
}
// 代码输入同步滚动 + 编辑器初始化
document.addEventListener('DOMContentLoaded', () => {
  const codeInput = document.getElementById('codeInput');
  if (codeInput) {
    codeInput.addEventListener('input', updateCodePreview);
    codeInput.addEventListener('scroll', function() {
      document.getElementById('codeOverlay').scrollTop = this.scrollTop;
    });
    // Tab 键插入空格，不跳转焦点
    codeInput.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
        updateCodePreview();
      }
    });
  }
  const langSelect = document.getElementById('codeLangSelect');
  if (langSelect) langSelect.addEventListener('change', updateCodePreview);

  // ===== 初始化所有富文本编辑器 =====
  // 文章编辑器
  const articleContainer = document.getElementById('articleEditorContainer');
  if (articleContainer) {
    articleContainer.appendChild(createRichEditor('articleContent', '开始写作...'));
  }
  // 动态编辑器
  const updateContainer = document.getElementById('updateEditorContainer');
  if (updateContainer) {
    updateContainer.appendChild(createRichEditor('updateContent', '记录生活...'));
  }
  // 探索描述编辑器
  const descContainer = document.getElementById('exploreDescContainer');
  if (descContainer) {
    descContainer.appendChild(createRichEditor('exploreDescription', '描述...'));
  }
});
// ===== 数据导出/导入 =====
function exportData() {
  const store = loadStore();
  // 拆成每个数据类型的文件，逐一导出
  const entries = [
    { name: 'articles.json', data: store.articles || [] },
    { name: 'updates.json', data: store.updates || [] },
    { name: 'explores.json', data: store.explores || [] },
    { name: 'music.json', data: store.music || [] },
    { name: 'theme.json', data: store.theme || getDefaultStore().theme },
  ];
  // 打包成一个 ZIP 风格的单一 JSON（浏览器无法直接批量下载文件夹）
  // 改为导出单文件 boke-data.json（兼容后续导入）
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'boke-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('已导出 boke-data.json，请替换到 data/ 目录');
}
function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      let store;
      if (Array.isArray(data) && data[0] && data[0].name) {
        // 新格式: [{name, data}, ...]
        store = getDefaultStore();
        data.forEach(item => {
          const key = item.name.replace('.json', '');
          if (key === 'theme') store.theme = item.data;
          else if (Array.isArray(item.data)) store[key] = item.data;
        });
      } else if (data.articles || data.updates) {
        // 兼容旧格式: {articles, updates, ...}
        store = { ...getDefaultStore(), ...data };
      } else {
        showToast('无法识别的数据格式', 'error'); return;
      }
      saveStore(store);
      // 同步到服务器
      ['articles','updates','explores','music','theme'].forEach(k => {
        if (store[k]) syncToServer(k, store[k]);
      });
      showToast('数据已导入并同步到文件！页面即将刷新');
      setTimeout(() => location.reload(), 1000);
    } catch(err) {
      showToast('导入失败: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  input.value = '';
}
function login() {
  const pw = document.getElementById('passwordInput').value.trim();
  if (!pw) { showToast('请输入密码', 'error'); return; }
  if (pw === PASS) { document.getElementById('loginPage').style.display='none'; document.getElementById('adminPage').style.display='block'; loadAll(); }
  else { document.getElementById('loginError').style.display='block'; }
}
function logout() {
  document.getElementById('loginPage').style.display='flex'; document.getElementById('adminPage').style.display='none';
  document.getElementById('passwordInput').value=''; document.getElementById('loginError').style.display='none';
}
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.admin-nav-item[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(el => el.style.display = el.id === 'tab-'+tab ? 'block' : 'none');
}

// ===== CRUD 工厂（统一增删改查模式） =====
function createCRUD(cfg) {
  let items = [];
  function load() {
    items = store[cfg.key] || [];
    cfg.render(items);
  }
  function edit(id) {
    const item = items.find(x => x.id === id);
    if (!item) return;
    cfg.fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (el) {
        const val = f.get ? f.get(item) : (item[f.prop] || '');
        if (f.set) f.set(el, val);
        else el.value = val;
      }
    });
    document.getElementById(cfg.editId).value = id;
    if (cfg.formTitleId) document.getElementById(cfg.formTitleId).textContent = cfg.editTitle;
    if (cfg.submitBtnId) document.getElementById(cfg.submitBtnId).textContent = cfg.editBtn;
    document.getElementById(cfg.cancelBtnId).style.display = 'inline-block';
    if (cfg.onEdit) cfg.onEdit(item);
  }
  function cancel() {
    cfg.fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (el) {
        if (f.set) f.set(el, '');
        else el.value = '';
      }
    });
    if (cfg.onCancel) cfg.onCancel();
    document.getElementById(cfg.editId).value = '';
    if (cfg.formTitleId) document.getElementById(cfg.formTitleId).textContent = cfg.addTitle;
    if (cfg.submitBtnId) document.getElementById(cfg.submitBtnId).textContent = cfg.addBtn;
    document.getElementById(cfg.cancelBtnId).style.display = 'none';
  }
  function save() {
    const id = document.getElementById(cfg.editId).value;
    const data = cfg.buildData();
    if (id) { const idx = items.findIndex(i => i.id === id); if (idx !== -1) items[idx] = { ...items[idx], ...data }; }
    else { items.unshift({ id: genId(), ...data, createdAt: now() }); }
    store[cfg.key] = items; saveStore(store);
    syncToServer(cfg.key, items);
    showToast(id ? '已更新' : cfg.addedMsg || '已添加');
    cancel(); load();
  }
  function del(id) {
    if (!confirm('确定删除？')) return;
    if (cfg.onDelete) cfg.onDelete(items.find(i => i.id === id));
    items = items.filter(i => i.id !== id);
    store[cfg.key] = items; saveStore(store);
    syncToServer(cfg.key, items);
    showToast('已删除'); load();
  }
  return { load, edit, cancel, save, remove: del, get items() { return items; } };
}

// ===== 文章 CRUD =====
const articles = createCRUD({
  key: 'articles',
  editId: 'articleEditId', formTitleId: 'articleFormTitle', submitBtnId: 'articleSubmitBtn', cancelBtnId: 'articleCancelBtn',
  addTitle: '新增文章', addBtn: '发布文章', addedMsg: '已发布',
  editTitle: '编辑文章', editBtn: '保存修改',
  fields: [
    { id: 'articleTitle', prop: 'title' },
    { id: 'articleTags', prop: 'tags', get: (a) => (a.tags||[]).join(', ') },
    { id: 'articleSummary', prop: 'summary' },
    { id: 'articleContent', prop: 'content', set: (el, v) => { el.innerHTML = v; } },
  ],
  buildData: () => ({
    title: document.getElementById('articleTitle').value.trim()||'无标题',
    tags: document.getElementById('articleTags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),
    summary: document.getElementById('articleSummary').value.trim(),
    content: document.getElementById('articleContent').innerHTML,
  }),
  render: (items) => {
    const tbody = document.getElementById('articlesTableBody');
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="4" class="table-empty">暂无文章</td></tr>'; return; }
    tbody.innerHTML = items.map(a => `<tr>
      <td><strong>${escapeHtml(a.title||'')}</strong></td>
      <td>${(a.tags||[]).map(t => `<span style="display:inline-block;padding:1px 8px;background:rgba(135,206,235,0.15);border-radius:4px;font-size:12px;margin:1px;">${t}</span>`).join('')}</td>
      <td>${formatDate(a.createdAt)}</td>
      <td><button class="btn-sm edit" onclick="articles.edit('${a.id}')">编辑</button><button class="btn-sm del" onclick="articles.remove('${a.id}')">删除</button></td>
    </tr>`).join('');
  },
});

// ===== 动态 CRUD =====
const updates = createCRUD({
  key: 'updates',
  editId: 'updateEditId', formTitleId: null, submitBtnId: null, cancelBtnId: 'updateCancelBtn',
  addTitle: '发布动态', addBtn: '发布动态', addedMsg: '已发布',
  editTitle: '编辑动态', editBtn: '保存修改',
  fields: [{ id: 'updateContent', prop: 'content', set: (el, v) => { el.innerHTML = v; } }],
  buildData: () => ({ content: document.getElementById('updateContent').innerHTML.trim() }),
  onEdit: () => { document.getElementById('updateForm').querySelector('h4').textContent = '编辑动态'; },
  onCancel: () => { document.getElementById('updateForm').querySelector('h4').textContent = '发布动态'; },
  render: (items) => {
    const container = document.getElementById('updatesList');
    if (!items.length) { container.innerHTML = '<div class="table-empty">暂无动态</div>'; return; }
    container.innerHTML = items.map(u => `<div style="background:var(--card-bg);backdrop-filter:blur(20px);border-radius:12px;border:1px solid rgba(255,255,255,0.3);padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;"><div class="rich-text prose">${u.content||'(无内容)'}</div>
          <div style="font-size:13px;color:var(--text2);margin-top:6px;">${formatDate(u.createdAt)}</div></div>
        <div><button class="btn-sm edit" onclick="updates.edit('${u.id}')">编辑</button><button class="btn-sm del" onclick="updates.remove('${u.id}')">删除</button></div>
      </div></div>`).join('');
  },
});

// ===== 探索 CRUD =====
const explores = createCRUD({
  key: 'explores',
  editId: 'exploreEditId', formTitleId: 'exploreFormTitle', submitBtnId: null, cancelBtnId: 'exploreCancelBtn',
  addTitle: '新增项目', addBtn: '添加', addedMsg: '已添加',
  editTitle: '编辑项目', editBtn: '保存修改',
  fields: [
    { id: 'exploreTitle', prop: 'title' },
    { id: 'exploreCategory', prop: 'category' },
    { id: 'exploreUrl', prop: 'url' },
    { id: 'exploreIcon', prop: 'icon' },
    { id: 'exploreDescription', prop: 'description', set: (el, v) => { el.innerHTML = v; } },
  ],
  buildData: () => ({
    title: document.getElementById('exploreTitle').value.trim(),
    category: document.getElementById('exploreCategory').value,
    url: document.getElementById('exploreUrl').value.trim(),
    icon: document.getElementById('exploreIcon').value.trim()||'🔗',
    description: document.getElementById('exploreDescription').innerHTML.trim(),
  }),
  onCancel: () => { document.getElementById('exploreCategory').value = 'website'; },
  render: (items) => {
    const tbody = document.getElementById('exploresTableBody');
    const labels = { website: '🌐 网站', source: '📦 源码', video: '🎬 视频' };
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="3" class="table-empty">暂无项目</td></tr>'; return; }
    tbody.innerHTML = items.map(e => `<tr><td>${escapeHtml(e.icon||'🔗')} ${escapeHtml(e.title||'')}</td><td>${labels[e.category]||e.category}</td><td><button class="btn-sm edit" onclick="explores.edit('${e.id}')">编辑</button><button class="btn-sm del" onclick="explores.remove('${e.id}')">删除</button></td></tr>`).join('');
  },
});

// ===== 音乐 CRUD =====
const music = createCRUD({
  key: 'music',
  editId: 'musicEditId', formTitleId: null, submitBtnId: null, cancelBtnId: 'musicCancelBtn',
  addTitle: '新增歌曲', addBtn: '添加歌曲', addedMsg: '已添加',
  editTitle: '编辑歌曲', editBtn: '保存修改',
  fields: [
    { id: 'musicTitle', prop: 'title' },
    { id: 'musicArtist', prop: 'artist' },
    { id: 'musicUrl', prop: 'url' },
    { id: 'musicCover', prop: 'cover' },
  ],
  buildData: () => {
    const url = document.getElementById('musicUrl').value.trim();
    return { title: document.getElementById('musicTitle').value.trim()||'未知', artist: document.getElementById('musicArtist').value.trim()||'未知', url, cover: document.getElementById('musicCover').value.trim()||'' };
  },
  onEdit: (item) => { if (item.cover) showCoverPreview(item.cover); },
  onCancel: () => { document.getElementById('musicCoverPreview').style.display = 'none'; },
  render: (items) => {
    const tbody = document.getElementById('musicTableBody');
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="4" class="table-empty">暂无歌曲</td></tr>'; return; }
    tbody.innerHTML = items.map(m => {
      const url = m.url || m.externalUrl || '';
      const typeLabel = url.startsWith('data/uploads/') ? '📁 本地文件' : (url ? '🔗 外链' : '❌ 无');
      return `<tr><td>🎵 ${escapeHtml(m.title||'未知')}</td><td>${escapeHtml(m.artist||'未知')}</td><td>${typeLabel}</td><td><button class="btn-sm edit" onclick="music.edit('${m.id}')">编辑</button><button class="btn-sm del" onclick="music.remove('${m.id}')">删除</button></td></tr>`;
    }).join('');
  },
});

// ===== 主题 =====
const DEFAULT_THEME = { bgColor:'#fff5f7', primaryColor:'#ffb0c0', secondaryColor:'#87ceeb', cardBg:'rgba(255,255,255,0.6)', textColor:'#2d2d2d', textSecondary:'#888888' };
function loadTheme() {
  const t = store.theme || DEFAULT_THEME;
  document.getElementById('themeBg').value = t.bgColor||'#fff5f7';
  document.getElementById('themePrimary').value = t.primaryColor||'#ffb0c0';
  document.getElementById('themeSecondary').value = t.secondaryColor||'#87ceeb';
  document.getElementById('themeCardBg').value = t.cardBg||'#ffffff';
  document.getElementById('themeText').value = t.textColor||'#2d2d2d';
  document.getElementById('themeTextSecondary').value = t.textSecondary||'#888888';
  previewTheme();
}
function previewTheme() {
  const g=id=>document.getElementById(id).value;
  const p=document.getElementById('themePreview');
  p.style.background=g('themeBg');
  const m = {'--text':'themeText','--primary':'themePrimary','--secondary':'themeSecondary','--text-secondary':'themeTextSecondary'};
  Object.keys(m).forEach(v => p.style.setProperty(v, g(m[v])));
}
document.querySelectorAll('#tab-theme input[type="color"]').forEach(el => el.addEventListener('input', previewTheme));
function hexToRgb(h) { return parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16); }
function getThemeData() { return { bgColor:document.getElementById('themeBg').value, primaryColor:document.getElementById('themePrimary').value, secondaryColor:document.getElementById('themeSecondary').value, cardBg:'rgba('+hexToRgb(document.getElementById('themeCardBg').value)+',0.6)', textColor:document.getElementById('themeText').value, textSecondary:document.getElementById('themeTextSecondary').value }; }
function saveTheme() { store.theme = getThemeData(); saveStore(store); syncToServer('theme', store.theme); showToast('主题已保存'); }
function resetTheme() { store.theme = {...DEFAULT_THEME}; saveStore(store); syncToServer('theme', store.theme); loadTheme(); showToast('已重置'); }

function loadAll() {
  try {
    store = loadStore();
    articles.load(); updates.load(); explores.load(); music.load(); loadTheme();
    switchTab('articles');
  } catch(e) { showToast('加载出错: '+e.message, 'error'); }
}
window.onerror = function(msg, url, line) { showToast('页面错误: '+msg+' (行'+line+')', 'error'); return true; };
