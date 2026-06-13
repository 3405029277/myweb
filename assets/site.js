(function () {
  if (window.__SITE_APP_READY__) return;
  window.__SITE_APP_READY__ = true;

  var root = document.documentElement;
  var header = document.getElementById('siteHeader');
  var themeToggle = document.getElementById('themeToggle');
  var menuToggle = document.getElementById('menuToggle');
  var scrollProgress = document.getElementById('scrollProgress');
  var routeCleanup = [];
  var navSeq = 0;
  var SITE_START_DATE = '2026-03-17';
  var WALLPAPERS = ['assets/xiaowu.png'];
  var POSTS_PER_PAGE = 8;
  var initialPage = getRoutePage(new URL(window.location.href));

  /* ============================== preferences ============================== */

  function getTheme() {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) {}
    var sun = document.getElementById('iconSun');
    var moon = document.getElementById('iconMoon');
    if (sun && moon) {
      sun.style.display = theme === 'dark' ? 'block' : 'none';
      moon.style.display = theme === 'dark' ? 'none' : 'block';
    }
  }

  function getHue() {
    var saved = parseInt(localStorage.getItem('hue'), 10);
    return Number.isFinite(saved) ? Math.max(0, Math.min(360, saved)) : 275;
  }

  function applyHue(hue) {
    root.style.setProperty('--hue', String(hue));
    try { localStorage.setItem('hue', String(hue)); } catch (e) {}
  }

  function getWallpaperMode() {
    var saved = localStorage.getItem('wallpaperMode');
    return saved === 'full' || saved === 'hidden' ? saved : 'banner';
  }

  function applyWallpaperMode(mode) {
    root.dataset.wallpaperMode = mode;
    try { localStorage.setItem('wallpaperMode', mode); } catch (e) {}
    syncSettingButtons();
  }

  function getListLayout() {
    var saved = localStorage.getItem('postListLayout');
    return saved === 'list' ? 'list' : 'grid';
  }

  function applyListLayout(layout) {
    root.dataset.listLayout = layout;
    try { localStorage.setItem('postListLayout', layout); } catch (e) {}
    var grid = document.getElementById('postGrid');
    if (grid) grid.classList.toggle('list-mode', layout === 'list');
    syncSettingButtons();
  }

  function syncSettingButtons() {
    var mode = root.dataset.wallpaperMode || 'banner';
    var layout = root.dataset.listLayout || 'grid';
    document.querySelectorAll('[data-wallpaper]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.wallpaper === mode);
    });
    document.querySelectorAll('[data-layout]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.layout === layout);
    });
  }

  /* ============================== helpers ============================== */

  function formatDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  function formatDateLong(value) {
    if (!value) return '';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
  }

  function safeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function countWords(text) {
    var plain = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`\-\[\]()!]/g, ' ');
    var cjk = (plain.match(/[一-鿿]/g) || []).length;
    var latin = (plain.match(/[A-Za-z0-9]+/g) || []).length;
    return cjk + latin;
  }

  function getPostWordCount(post) {
    if (post && Number.isFinite(post.wordCount) && post.wordCount > 0) return post.wordCount;
    if (post && post.content) return countWords(post.content);
    return 0;
  }

  function getYearMonth(post) {
    if (post && /^\d{4}-\d{2}$/.test(String(post.yearMonth || ''))) return post.yearMonth;
    var d = new Date(post && post.date || '');
    if (Number.isNaN(d.getTime())) return '未注明';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  /* ============================== math / markdown ============================== */

  function renderMathText(input) {
    function normalizeMath(expr) {
      return String(expr || '')
        .replace(/\\times/g, '×')
        .replace(/\\cdot/g, '·')
        .replace(/\\equiv/g, '≡')
        .replace(/\\neq/g, '≠')
        .replace(/\\geq/g, '≥')
        .replace(/\\leq/g, '≤')
        .replace(/\\approx/g, '≈')
        .replace(/\\to/g, '→')
        .replace(/\\left/g, '')
        .replace(/\\right/g, '')
        .replace(/\\pmod\{([^}]+)\}/g, '(mod $1)')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
        .replace(/\s+/g, ' ')
        .trim();
    }

    var text = String(input == null ? '' : input);
    var withBlock = text.replace(/\$\$([\s\S]+?)\$\$/g, function (_, expr) {
      return '<span class="math-block">' + safeHtml(normalizeMath(expr)) + '</span>';
    });
    return withBlock.replace(/\$([^$\n]+)\$/g, function (_, expr) {
      return '<span class="math-inline">' + safeHtml(normalizeMath(expr)) + '</span>';
    });
  }

  function detectCodeLanguage(text) {
    var source = String(text || '');
    if (/#include\s*<|std::|cout\s*<<|cin\s*>>|vector<|unordered_map<|int\s+main\s*\(/.test(source)) return 'cpp';
    return '';
  }

  function highlightCpp(source) {
    var code = String(source || '');
    var tokens = [];

    function stash(pattern, cls) {
      code = code.replace(pattern, function (match) {
        var key = '@@TOK_' + tokens.length + '@@';
        tokens.push('<span class="tok ' + cls + '">' + safeHtml(match) + '</span>');
        return key;
      });
    }

    stash(/\/\*[\s\S]*?\*\//g, 'comment');
    stash(/\/\/[^\n]*/g, 'comment');
    stash(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, 'string');

    code = safeHtml(code);
    code = code.replace(/\b(constexpr|const|volatile|mutable|static|extern|auto|register|unsigned|signed|long|short|bool|char|int|float|double|void|class|struct|enum|union|namespace|template|typename|using|public|private|protected|virtual|override|final|friend|inline|if|else|for|while|do|switch|case|default|break|continue|return|try|catch|throw|new|delete|this|nullptr|true|false|std|string|vector|map|set|unordered_map|unordered_set|queue|stack|pair|tuple|optional|variant|unique_ptr|shared_ptr|\d+(?:\.\d+)?)\b/g, function (match) {
      if (/^\d/.test(match)) return '<span class="tok number">' + match + '</span>';
      if (/^(std|string|vector|map|set|unordered_map|unordered_set|queue|stack|pair|tuple|optional|variant|unique_ptr|shared_ptr)$/.test(match)) return '<span class="tok type">' + match + '</span>';
      return '<span class="tok keyword">' + match + '</span>';
    });

    code = code.replace(/@@TOK_(\d+)@@/g, function (_, index) {
      return tokens[Number(index)] || '';
    });

    return code;
  }

  function highlightCodeBlocks(scope) {
    var rootEl = scope || document;
    var blocks = rootEl.querySelectorAll('.prose pre code');
    if (!blocks.length) return;

    blocks.forEach(function (codeEl) {
      var raw = codeEl.textContent || '';
      var pre = codeEl.parentElement;
      var cls = codeEl.className || '';
      var matched = cls.match(/language-([a-z0-9#+_-]+)/i);
      var lang = matched ? matched[1].toLowerCase() : '';
      if (!lang && pre && pre.dataset && pre.dataset.lang) lang = String(pre.dataset.lang).toLowerCase();
      if (!lang) lang = detectCodeLanguage(raw);

      if (/^(cpp|c\+\+|cc|cxx|hpp|h)$/.test(lang)) {
        codeEl.innerHTML = highlightCpp(raw);
        if (pre) pre.dataset.lang = 'cpp';
      } else {
        codeEl.innerHTML = safeHtml(raw);
      }

      if (pre && !pre.querySelector('.code-copy')) {
        var copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy';
        copyBtn.type = 'button';
        copyBtn.textContent = '复制';
        copyBtn.addEventListener('click', function () {
          try {
            navigator.clipboard.writeText(raw);
            copyBtn.textContent = '已复制';
            window.setTimeout(function () { copyBtn.textContent = '复制'; }, 1200);
          } catch (e) { copyBtn.textContent = '失败'; }
        });
        pre.appendChild(copyBtn);
      }
    });
  }

  async function fetchJson(url) {
    var r = await fetch(url);
    if (!r.ok) throw new Error('Request failed: ' + url);
    return r.json();
  }

  var postsCache = null;
  async function getPosts() {
    if (postsCache) return postsCache;
    try {
      var posts = await fetchJson('/api/posts');
      if (Array.isArray(posts) && posts.length) { postsCache = posts; return posts; }
    } catch (e) {}
    postsCache = Array.isArray(window.__SITE_POSTS__) ? window.__SITE_POSTS__ : [];
    return postsCache;
  }

  function sortPosts(posts) {
    return posts.slice().sort(function (a, b) {
      var pa = a.pinned ? 1 : 0;
      var pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }

  function parseFrontMatter(markdown, slug) {
    var source = String(markdown || '');
    var data = {};
    var body = source;
    var match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (match) {
      body = source.slice(match[0].length);
      var currentKey = '';
      match[1].split(/\r?\n/).forEach(function (line) {
        var pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (pair) {
          currentKey = pair[1];
          data[currentKey] = pair[2].trim();
          if (currentKey === 'tags') data[currentKey] = [];
          return;
        }
        var listItem = line.match(/^\s*-\s*(.+)$/);
        if (listItem && currentKey && Array.isArray(data[currentKey])) {
          data[currentKey].push(listItem[1].trim());
        }
      });
    }

    var heading = body.match(/^#\s+(.+)$/m);
    return {
      slug: slug,
      title: data.title || (heading ? heading[1].trim() : slug),
      date: data.date || '',
      description: data.description || '',
      category: data.category || 'Article',
      tags: Array.isArray(data.tags) ? data.tags : [],
      gameUrl: data.gameUrl || '',
      cover: data.cover || '',
      content: body
    };
  }

  function markdownToHtml(markdown) {
    var lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    var html = [];
    var inCode = false;
    var codeLang = '';
    var inList = false;
    var paragraph = [];

    function inlineFormat(text) {
      var out = renderMathText(safeHtml(text));
      out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
        if (/^(javascript|data):/i.test(src)) return '';
        return '<img src="' + src + '" alt="' + alt + '" loading="lazy">';
      });
      out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, href) {
        if (/^javascript:/i.test(href)) return label;
        return '<a href="' + href + '">' + label + '</a>';
      });
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
      return out;
    }

    function flushParagraph() {
      if (paragraph.length) {
        html.push('<p>' + inlineFormat(paragraph.join(' ')) + '</p>');
        paragraph = [];
      }
    }

    function closeList() {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
    }

    lines.forEach(function (line) {
      var fence = line.trim().match(/^```([a-zA-Z0-9#+_-]+)?\s*$/);
      if (fence) {
        flushParagraph();
        closeList();
        if (!inCode) {
          codeLang = (fence[1] || '').toLowerCase();
          var langClass = codeLang ? ' class="language-' + safeHtml(codeLang) + '"' : '';
          var langData = codeLang ? ' data-lang="' + safeHtml(codeLang) + '"' : '';
          html.push('<pre' + langData + '><code' + langClass + '>');
        } else {
          html.push('</code></pre>');
          codeLang = '';
        }
        inCode = !inCode;
        return;
      }
      if (inCode) {
        html.push(safeHtml(line) + '\n');
        return;
      }

      if (!line.trim()) {
        flushParagraph();
        closeList();
        return;
      }

      var heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        var level = heading[1].length;
        html.push('<h' + level + '>' + inlineFormat(heading[2]) + '</h' + level + '>');
        return;
      }

      var quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        html.push('<blockquote><p>' + inlineFormat(quote[1]) + '</p></blockquote>');
        return;
      }

      var listItem = line.match(/^\s*[-*]\s+(.+)$/);
      if (listItem) {
        flushParagraph();
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push('<li>' + inlineFormat(listItem[1]) + '</li>');
        return;
      }

      paragraph.push(line.trim());
    });

    flushParagraph();
    closeList();
    if (inCode) html.push('</code></pre>');
    return html.join('');
  }

  async function fetchLocalPost(slug) {
    var response = await fetch('posts/' + encodeURIComponent(slug) + '.md');
    if (!response.ok) throw new Error('Local post not found: ' + slug);
    var markdown = await response.text();
    var article = parseFrontMatter(markdown, slug);
    article.html = markdownToHtml(article.content);
    article.wordCount = countWords(article.content);
    return article;
  }

  /* ============================== typewriter ============================== */

  function initTypewriters(scope) {
    var rootEl = scope || document;
    rootEl.querySelectorAll('.typewriter[data-text]').forEach(function (el) {
      if (el.__twActive) return;
      var texts;
      try { texts = JSON.parse(el.dataset.text); } catch (e) { texts = [el.dataset.text]; }
      if (!Array.isArray(texts) || !texts.length) return;
      var speed = parseInt(el.dataset.speed, 10) || 100;
      var deleteSpeed = parseInt(el.dataset.deleteSpeed, 10) || 50;
      var pauseTime = parseInt(el.dataset.pauseTime, 10) || 2000;
      var textIndex = 0;
      var charIndex = 0;
      var deleting = false;
      var timer = null;
      el.__twActive = true;

      function tick() {
        var current = String(texts[textIndex % texts.length]);
        if (!deleting) {
          charIndex += 1;
          el.textContent = current.slice(0, charIndex);
          if (charIndex >= current.length) {
            if (texts.length === 1) return;
            deleting = true;
            timer = window.setTimeout(tick, pauseTime);
            return;
          }
          timer = window.setTimeout(tick, speed);
        } else {
          charIndex -= 1;
          el.textContent = current.slice(0, charIndex);
          if (charIndex <= 0) {
            deleting = false;
            textIndex += 1;
          }
          timer = window.setTimeout(tick, deleteSpeed);
        }
      }

      timer = window.setTimeout(tick, 300);
      addRouteCleanup(function () {
        window.clearTimeout(timer);
        el.__twActive = false;
      });
    });
  }

  /* ============================== wallpaper carousel ============================== */

  function initWallpaperCarousel() {
    var bgWrap = document.getElementById('siteBgCarousel');
    var banner = document.getElementById('siteBanner');
    if (bgWrap && !bgWrap.childElementCount) {
      WALLPAPERS.forEach(function (src, i) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = '';
        if (i === 0) img.classList.add('is-active');
        bgWrap.appendChild(img);
      });
    }
    if (WALLPAPERS.length < 2) return;
    var index = 0;
    var timer = window.setInterval(function () {
      index = (index + 1) % WALLPAPERS.length;
      [bgWrap, banner].forEach(function (wrap) {
        if (!wrap) return;
        var imgs = wrap.querySelectorAll('img');
        imgs.forEach(function (img, i) { img.classList.toggle('is-active', i === index); });
      });
    }, 8000);
    window.addEventListener('beforeunload', function () { window.clearInterval(timer); });
  }

  /* ============================== sidebar widgets ============================== */

  function renderTagCloud(posts) {
    var tags = {};
    posts.forEach(function (p) { (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var html = Object.entries(tags).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) {
      return '<a class="tag" href="archive.html?tag=' + encodeURIComponent(e[0]) + '">' + safeHtml(e[0]) + '</a>';
    }).join('');
    ['tagCloud', 'tagCloudSide'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  }

  function renderCategoryRank(posts) {
    var el = document.getElementById('categoryRank');
    if (!el) return;
    var counts = {};
    posts.forEach(function (p) { var c = p.category || 'Article'; counts[c] = (counts[c] || 0) + 1; });
    el.innerHTML = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) {
      return '<a class="category-link" href="archive.html?category=' + encodeURIComponent(e[0]) + '"><span>' + safeHtml(e[0]) + '</span><strong>' + e[1] + '</strong></a>';
    }).join('');
  }

  function renderLatestList(posts) {
    var el = document.getElementById('latestList');
    if (!el) return;
    var ordered = posts.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    el.innerHTML = ordered.slice(0, 5).map(function (p) {
      return '<a href="post.html?slug=' + encodeURIComponent(p.slug) + '"><span>' + safeHtml(p.title) + '</span><small>' + safeHtml(formatDate(p.date)) + '</small></a>';
    }).join('');
  }

  function renderSidebarStats(posts) {
    var categories = {};
    var tags = {};
    var totalWords = 0;
    var latest = '';
    posts.forEach(function (p) {
      categories[p.category || 'Article'] = true;
      (p.tags || []).forEach(function (t) { tags[t] = true; });
      totalWords += getPostWordCount(p);
      if (String(p.date || '') > latest) latest = p.date;
    });
    var runDays = Math.max(1, Math.round((Date.now() - new Date(SITE_START_DATE).getTime()) / 86400000));
    var setText = function (id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('statPostCount', String(posts.length));
    setText('statCategoryCount', String(Object.keys(categories).length));
    setText('statTagCount', String(Object.keys(tags).length));
    setText('statWordCount', totalWords > 0 ? totalWords.toLocaleString('en-US') : '-');
    setText('statRunDays', runDays + ' 天');
    setText('statLatestDate', latest ? formatDate(latest) : '-');
  }

  function renderCalendarWidget(posts) {
    var el = document.getElementById('calendarWidget');
    if (!el) return;
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var postDays = {};
    (posts || []).forEach(function (p) {
      var d = new Date(p.date || '');
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) postDays[d.getDate()] = true;
    });
    var cells = ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<span>' + w + '</span>'; });
    for (var i = 0; i < firstDay; i += 1) cells.push('<span></span>');
    for (var day = 1; day <= daysInMonth; day += 1) {
      var cls = day === now.getDate() ? ' class="today"' : '';
      cells.push(postDays[day] && day !== now.getDate() ? '<b>' + day + '</b>' : '<span' + cls + '>' + day + '</span>');
    }
    el.innerHTML = '<div class="calendar-head"><strong>' + year + ' 年 ' + (month + 1) + ' 月</strong><span>CAL</span></div><div class="calendar-grid">' + cells.join('') + '</div>';
  }

  /* ============================== Mizuki post cards ============================== */

  var ICONS = {
    pin: '<svg class="pin-icon" viewBox="0 0 24 24"><path d="M16 12V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14zM5 8V6h14v2z"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8z"/></svg>',
    words: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 13h8v2H8zm0 4h8v2H8z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="M9.4 18 8 16.6l4.6-4.6L8 7.4 9.4 6l6 6z"/></svg>'
  };

  function renderPostCard(post, index) {
    var hasCover = !!(post.cover && String(post.cover).trim());
    var url = 'post.html?slug=' + encodeURIComponent(post.slug);
    var words = getPostWordCount(post);
    var metaItems = [
      '<span class="meta-item"><span class="meta-icon">' + ICONS.calendar + '</span>' + safeHtml(formatDate(post.date) || '未注明') + '</span>',
      '<span class="meta-item"><span class="meta-icon">' + ICONS.folder + '</span><a href="archive.html?category=' + encodeURIComponent(post.category || 'Article') + '">' + safeHtml(post.category || 'Article') + '</a></span>'
    ];
    if (words > 0) metaItems.push('<span class="meta-item"><span class="meta-icon">' + ICONS.words + '</span>' + words + ' 字</span>');
    var tags = (post.tags || []).map(function (t) {
      return '<a class="tag" href="archive.html?tag=' + encodeURIComponent(t) + '"># ' + safeHtml(t) + '</a>';
    }).join('');
    var coverHtml = hasCover
      ? '<a class="post-cover" href="' + url + '" tabindex="-1"><img src="' + safeHtml(post.cover) + '" alt="" loading="lazy"></a>'
      : '';
    return '<article class="post-card onload-animation' + (hasCover ? ' has-cover' : '') + '" style="--i:' + (index + 2) + '">' +
      coverHtml +
      '<div class="post-card-main">' +
        '<h2 class="post-title">' + (post.pinned ? ICONS.pin : '') + '<a href="' + url + '">' + safeHtml(post.title) + '</a></h2>' +
        '<div class="post-meta-line">' + metaItems.join('') + '</div>' +
        (post.description ? '<p class="post-desc">' + safeHtml(post.description) + '</p>' : '') +
        (tags ? '<div class="tag-list">' + tags + '</div>' : '') +
      '</div>' +
      '<a class="post-enter" href="' + url + '" aria-label="阅读文章">' + ICONS.chevron + '</a>' +
    '</article>';
  }

  function renderPostList(posts, page) {
    var el = document.getElementById('postGrid');
    if (!el) return;
    el.classList.toggle('list-mode', getListLayout() === 'list');
    if (!posts.length) {
      el.innerHTML = '<article class="empty-state card-base">暂无文章</article>';
      renderPagination(0, 1);
      return;
    }
    var totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
    var current = Math.min(Math.max(1, page || 1), totalPages);
    var slice = posts.slice((current - 1) * POSTS_PER_PAGE, current * POSTS_PER_PAGE);
    el.innerHTML = slice.map(renderPostCard).join('');
    renderPagination(totalPages, current);
  }

  function renderPagination(totalPages, current) {
    var el = document.getElementById('pagination');
    if (!el) return;
    if (totalPages < 2) { el.innerHTML = ''; return; }
    var html = [];
    for (var p = 1; p <= totalPages; p += 1) {
      html.push('<button type="button" data-page="' + p + '"' + (p === current ? ' class="active"' : '') + '>' + p + '</button>');
    }
    el.innerHTML = html.join('');
  }

  /* ============================== category bar (home) ============================== */

  function renderCategoryBar(posts, activeValue) {
    var el = document.getElementById('categoryBar');
    if (!el) return;
    var counts = {};
    posts.forEach(function (p) { var c = p.category || 'Article'; counts[c] = (counts[c] || 0) + 1; });
    var pills = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) {
      var active = activeValue === e[0] ? ' active' : '';
      return '<button class="category-pill' + active + '" type="button" data-category="' + safeHtml(e[0]) + '">' + safeHtml(e[0]) + ' <small>' + e[1] + '</small></button>';
    }).join('');
    el.innerHTML =
      '<button class="category-pill category-home' + (activeValue === 'all' ? ' active' : '') + '" type="button" data-category="all" aria-label="全部">🏠</button>' +
      '<a class="category-pill" href="archive.html">归档 <small>' + posts.length + '</small></a>' +
      '<span class="category-divider"></span>' +
      '<div class="category-scroll">' + pills + '</div>';
  }

  /* ============================== route lifecycle ============================== */

  function addRouteCleanup(fn) {
    routeCleanup.push(fn);
  }

  function cleanupRoute() {
    routeCleanup.splice(0).forEach(function (fn) {
      try { fn(); } catch (e) {}
    });
  }

  /* ============================== home page ============================== */

  async function loadHome() {
    try {
      var posts = sortPosts(await getPosts());
      var activeCategory = 'all';
      var currentPage = 1;

      function applyFilter() {
        var filtered = activeCategory === 'all' ? posts : posts.filter(function (p) { return (p.category || 'Article') === activeCategory; });
        renderCategoryBar(posts, activeCategory);
        renderPostList(filtered, currentPage);
      }

      function onCategoryClick(e) {
        var pill = e.target.closest('.category-pill[data-category]');
        if (!pill) return;
        activeCategory = pill.dataset.category;
        currentPage = 1;
        applyFilter();
      }

      function onPageClick(e) {
        var btn = e.target.closest('button[data-page]');
        if (!btn) return;
        currentPage = parseInt(btn.dataset.page, 10) || 1;
        applyFilter();
        var grid = document.getElementById('postGrid');
        if (grid) {
          var top = grid.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 12;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
      }

      var bar = document.getElementById('categoryBar');
      var pager = document.getElementById('pagination');
      if (bar) bar.addEventListener('click', onCategoryClick);
      if (pager) pager.addEventListener('click', onPageClick);
      addRouteCleanup(function () {
        if (bar) bar.removeEventListener('click', onCategoryClick);
        if (pager) pager.removeEventListener('click', onPageClick);
      });

      applyFilter();
      renderTagCloud(posts);
      renderCategoryRank(posts);
      renderLatestList(posts);
      renderSidebarStats(posts);
      renderCalendarWidget(posts);
    } catch (error) {
      var grid = document.getElementById('postGrid');
      if (grid) grid.innerHTML = '<article class="empty-state card-base">文章加载失败，请检查 posts 目录和接口。</article>';
    }
  }

  /* ============================== archive page ============================== */

  async function renderArchivePage() {
    var groupsEl = document.getElementById('archiveGroups');
    var filtersEl = document.getElementById('archiveFilters');
    if (!groupsEl) return;
    try {
      var posts = sortPosts(await getPosts());
      var params = new URLSearchParams(window.location.search);
      var activeCategory = params.get('category') || '';
      var activeTag = params.get('tag') || '';

      function currentFiltered() {
        return posts.filter(function (p) {
          if (activeCategory && (p.category || 'Article') !== activeCategory) return false;
          if (activeTag && (p.tags || []).indexOf(activeTag) < 0) return false;
          return true;
        });
      }

      function renderFilters() {
        if (!filtersEl) return;
        var counts = {};
        posts.forEach(function (p) { var c = p.category || 'Article'; counts[c] = (counts[c] || 0) + 1; });
        var buttons = ['<button class="filter-button' + (!activeCategory && !activeTag ? ' active' : '') + '" type="button" data-filter="all">全部 ' + posts.length + '</button>'];
        Object.entries(counts).forEach(function (e) {
          buttons.push('<button class="filter-button' + (activeCategory === e[0] ? ' active' : '') + '" type="button" data-filter-category="' + safeHtml(e[0]) + '">' + safeHtml(e[0]) + ' ' + e[1] + '</button>');
        });
        if (activeTag) buttons.push('<button class="filter-button active" type="button" data-filter="all"># ' + safeHtml(activeTag) + ' ×</button>');
        filtersEl.innerHTML = buttons.join('');
      }

      function renderGroups() {
        var filtered = currentFiltered();
        if (!filtered.length) { groupsEl.innerHTML = '<article class="empty-state">没有符合条件的文章</article>'; return; }
        var groups = {};
        var order = [];
        filtered.forEach(function (p) {
          var ym = getYearMonth(p);
          if (!groups[ym]) { groups[ym] = []; order.push(ym); }
          groups[ym].push(p);
        });
        groupsEl.innerHTML = order.map(function (ym) {
          var rows = groups[ym].map(function (p) {
            return '<a class="archive-row" href="post.html?slug=' + encodeURIComponent(p.slug) + '"><span>' + safeHtml(p.title) + '</span><small>' + safeHtml(formatDate(p.date)) + ' · ' + safeHtml(p.category || 'Article') + '</small></a>';
          }).join('');
          return '<section class="archive-month"><h2>' + safeHtml(ym) + '</h2>' + rows + '</section>';
        }).join('');
      }

      function onFilterClick(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.filter === 'all') { activeCategory = ''; activeTag = ''; }
        else if (btn.dataset.filterCategory) { activeCategory = btn.dataset.filterCategory; activeTag = ''; }
        renderFilters();
        renderGroups();
      }

      if (filtersEl) {
        filtersEl.addEventListener('click', onFilterClick);
        addRouteCleanup(function () { filtersEl.removeEventListener('click', onFilterClick); });
      }

      renderFilters();
      renderGroups();
      renderTagCloud(posts);
      renderCategoryRank(posts);
      renderLatestList(posts);
      renderSidebarStats(posts);
      renderCalendarWidget(posts);
    } catch (error) {
      groupsEl.innerHTML = '<article class="empty-state">归档加载失败</article>';
    }
  }

  /* ============================== generic side data (about/links/comments) ============================== */

  async function loadSideWidgets() {
    try {
      var posts = sortPosts(await getPosts());
      renderTagCloud(posts);
      renderCategoryRank(posts);
      renderLatestList(posts);
      renderSidebarStats(posts);
      renderCalendarWidget(posts);
    } catch (e) {}
  }

  /* ============================== article page ============================== */

  function buildToc(contentEl, tocEl) {
    if (!tocEl) return;
    var headings = contentEl.querySelectorAll('h2, h3');
    if (!headings.length) { tocEl.innerHTML = '<p style="color:var(--text-50);margin:0">当前页面没有目录</p>'; return; }
    tocEl.innerHTML = Array.from(headings).map(function (h, i) {
      if (!h.id) h.id = 'section-' + (i + 1);
      var cls = h.tagName === 'H3' ? ' class="level-h3"' : '';
      return '<a href="#' + safeHtml(h.id) + '"' + cls + '>' + safeHtml(h.textContent) + '</a>';
    }).join('');
    var tocLinks = tocEl.querySelectorAll('a');
    function highlightToc() {
      var headerH = header ? header.offsetHeight : 0;
      var active = null;
      headings.forEach(function (h) { if (h.getBoundingClientRect().top < headerH + 100) active = h; });
      tocLinks.forEach(function (a) {
        var isActive = active && a.getAttribute('href') === '#' + active.id;
        a.style.color = isActive ? 'var(--primary)' : '';
        a.style.background = isActive ? 'var(--btn-regular-bg)' : '';
      });
    }
    window.addEventListener('scroll', highlightToc, { passive: true });
    addRouteCleanup(function () { window.removeEventListener('scroll', highlightToc); });
    highlightToc();
  }

  async function loadArticle(seq) {
    var contentEl = document.getElementById('articleContent');
    if (!contentEl) return;
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');
    if (!slug) { contentEl.innerHTML = '<p class="empty-state">缺少文章 slug</p>'; return; }
    try {
      var article;
      try {
        article = await fetchJson('/api/posts/' + encodeURIComponent(slug));
      } catch (apiError) {
        article = await fetchLocalPost(slug);
      }
      if (seq && seq !== navSeq) return;
      document.title = article.title + ' | cjx 知微录';
      var title = document.getElementById('articleTitle');
      var category = document.getElementById('articleCategory');
      var meta = document.getElementById('articleMeta');
      var cover = document.getElementById('articleCover');
      if (title) title.textContent = article.title;
      if (category) category.textContent = article.category || 'Article';
      if (cover && article.cover) {
        cover.style.backgroundImage = 'linear-gradient(180deg, rgb(0 0 0 / 0.35), rgb(0 0 0 / 0.18) 45%, rgb(0 0 0 / 0.35)), url("' + article.cover + '")';
      }
      var metaParts = [];
      if (article.date) metaParts.push('<span>📅 ' + safeHtml(formatDateLong(article.date)) + '</span>');
      var words = getPostWordCount(article);
      if (words > 0) metaParts.push('<span>📄 ' + words + ' 字</span>');
      if (Array.isArray(article.tags) && article.tags.length) metaParts.push('<span># ' + safeHtml(article.tags.join(' · ')) + '</span>');
      if (meta) meta.innerHTML = metaParts.join('');
      contentEl.innerHTML = article.html;
      contentEl.innerHTML = renderMathText(contentEl.innerHTML);
      highlightCodeBlocks(contentEl);
      buildToc(contentEl, document.getElementById('articleToc'));
      buildToc(contentEl, document.getElementById('articleTocMobile'));
      buildToc(contentEl, document.getElementById('articleTocFloating'));
      loadSideWidgets();
    } catch (error) {
      var errTitle = document.getElementById('articleTitle');
      var errCategory = document.getElementById('articleCategory');
      if (errTitle) errTitle.textContent = '文章加载失败';
      if (errCategory) errCategory.textContent = 'Error';
      contentEl.innerHTML = '<p class="empty-state">文章加载失败</p>';
    }
  }

  function setupCopyLink() {
    var button = document.getElementById('copyArticleLink');
    if (!button) return;
    function onCopy() {
      try {
        navigator.clipboard.writeText(window.location.href);
        button.textContent = '已复制';
        window.setTimeout(function () { button.textContent = '复制链接'; }, 1200);
      } catch (e) { button.textContent = '复制失败'; }
    }
    button.addEventListener('click', onCopy);
    addRouteCleanup(function () { button.removeEventListener('click', onCopy); });
  }

  /* ============================== search panel ============================== */

  function initSearchPanel() {
    var panel = document.getElementById('searchPanel');
    if (!panel || panel.__searchReady) return;
    panel.__searchReady = true;
    var input = document.getElementById('searchInput');
    var results = document.getElementById('searchResults');

    function open() {
      panel.hidden = false;
      window.setTimeout(function () { if (input) input.focus(); }, 50);
    }

    function close() { panel.hidden = true; }

    async function runSearch() {
      if (!input || !results) return;
      var q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ''; return; }
      var posts = await getPosts();
      var matched = posts.filter(function (p) {
        var hay = [p.title, p.description, p.category].concat(p.tags || []).join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      results.innerHTML = matched.length
        ? matched.slice(0, 12).map(function (p) {
            return '<a href="post.html?slug=' + encodeURIComponent(p.slug) + '"><strong>' + safeHtml(p.title) + '</strong><span>' + safeHtml(formatDate(p.date)) + ' · ' + safeHtml(p.category || 'Article') + '</span></a>';
          }).join('')
        : '<span>没有匹配的文章</span>';
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-search]')) { e.preventDefault(); open(); }
      if (e.target.closest('[data-close-search]') || (e.target.classList && e.target.classList.contains('modal-backdrop') && !panel.hidden && panel.contains(e.target))) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      if (e.key === '/' && panel.hidden && !/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) {
        e.preventDefault();
        open();
      }
    });
    if (input) input.addEventListener('input', runSearch);
  }

  /* ============================== display settings ============================== */

  function initDisplaySettings() {
    var panel = document.getElementById('displaySettings');
    if (!panel || panel.__settingsReady) return;
    panel.__settingsReady = true;
    var hueRange = document.getElementById('hueRange');
    if (hueRange) {
      hueRange.value = String(getHue());
      hueRange.addEventListener('input', function () { applyHue(parseInt(hueRange.value, 10) || 0); });
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-settings]')) { e.preventDefault(); panel.hidden = false; syncSettingButtons(); }
      if (e.target.closest('[data-close-settings]') || (e.target.classList && e.target.classList.contains('modal-backdrop') && !panel.hidden && panel.contains(e.target))) panel.hidden = true;
      var wall = e.target.closest('[data-wallpaper]');
      if (wall) applyWallpaperMode(wall.dataset.wallpaper);
      var layout = e.target.closest('[data-layout]');
      if (layout) applyListLayout(layout.dataset.layout);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') panel.hidden = true;
    });
  }

  /* ============================== floating controls ============================== */

  function initFloatingControls() {
    var backBtn = document.getElementById('backToTopBtn');
    if (backBtn && !backBtn.__ready) {
      backBtn.__ready = true;
      backBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
      window.addEventListener('scroll', function () {
        backBtn.classList.toggle('hide', (window.scrollY || 0) < 300);
      }, { passive: true });
    }
    var tocBtn = document.getElementById('floating-toc-btn');
    var tocPanel = document.getElementById('floatingTocPanel');
    if (tocBtn && tocPanel && !tocBtn.__ready) {
      tocBtn.__ready = true;
      tocBtn.addEventListener('click', function () { tocPanel.hidden = !tocPanel.hidden; });
      document.addEventListener('click', function (e) {
        if (tocPanel.hidden) return;
        if (e.target === tocBtn || tocBtn.contains(e.target) || tocPanel.contains(e.target)) return;
        tocPanel.hidden = true;
      });
    }
  }

  /* ============================== scroll progress ============================== */

  function updateScrollProgress() {
    if (!scrollProgress) return;
    var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    scrollProgress.style.width = (scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0) + '%';
  }

  /* ============================== SPA routing ============================== */

  function getRoutePage(url) {
    var pathname = normalizePath(url.pathname);
    if (pathname === '/' || /\/index\.html$/i.test(pathname)) return 'home';
    if (/\/post\.html$/i.test(pathname)) return 'post';
    if (/\/comments\.html$/i.test(pathname)) return 'comments';
    if (/\/archive\.html$/i.test(pathname)) return 'archive';
    if (/\/about\.html$/i.test(pathname)) return 'about';
    if (/\/links\.html$/i.test(pathname)) return 'links';
    return '';
  }

  function normalizePath(pathname) {
    return ('/' + String(pathname || '/').replace(/^\/+/, '')).replace(/\/+/g, '/');
  }

  function shouldInterceptLink(event, anchor) {
    if (!anchor || event.defaultPrevented) return false;
    if (event.button != null && event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;
    var rawHref = anchor.getAttribute('href') || '';
    if (!rawHref || /^(mailto:|tel:|javascript:)/i.test(rawHref)) return false;
    var url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    var path = normalizePath(url.pathname);
    if (/\/(五子棋|中国象棋ai|你画我猜)\.html$/i.test(path)) return false;
    if (rawHref.charAt(0) === '#') {
      if (rawHref.length < 2) return false;
      return !!document.getElementById(decodeURIComponent(rawHref.slice(1)));
    }
    return !!getRoutePage(url);
  }

  async function navigate(href, options) {
    options = options || {};
    var targetUrl = new URL(href, window.location.href);
    var page = getRoutePage(targetUrl);
    if (!page) {
      window.location.href = targetUrl.href;
      return;
    }

    var currentUrl = new URL(window.location.href);
    if (sameRouteExceptHash(currentUrl, targetUrl)) {
      if (!options.fromPopstate && targetUrl.href !== currentUrl.href) history.pushState({ siteRoute: true, url: targetUrl.href }, '', targetUrl.href);
      closeMobileMenu();
      scrollAfterNavigation(targetUrl);
      return;
    }

    var seq = ++navSeq;
    try {
      var response = await fetch(targetUrl.href, { headers: { 'X-Requested-With': 'site-spa' } });
      if (!response.ok) throw new Error('Route request failed');
      var html = await response.text();
      if (seq !== navSeq) return;
      var nextDoc = new DOMParser().parseFromString(html, 'text/html');
      renderRoute(nextDoc, targetUrl);
      if (!options.fromPopstate) {
        if (options.replace) history.replaceState({ siteRoute: true, url: targetUrl.href }, '', targetUrl.href);
        else history.pushState({ siteRoute: true, url: targetUrl.href }, '', targetUrl.href);
      }
      initRoute(page, seq);
      scrollAfterNavigation(targetUrl);
    } catch (error) {
      window.location.href = targetUrl.href;
    }
  }

  function sameRouteExceptHash(a, b) {
    return normalizePath(a.pathname) === normalizePath(b.pathname) && a.search === b.search;
  }

  function renderRoute(nextDoc, targetUrl) {
    cleanupRoute();
    var currentRoute = document.getElementById('siteRoute') || document.querySelector('main.shell-inner.page-grid');
    var nextRoute = nextDoc.getElementById('siteRoute') || nextDoc.querySelector('main.shell-inner.page-grid');
    if (!currentRoute || !nextRoute) throw new Error('Route container missing');
    currentRoute.replaceWith(document.importNode(nextRoute, true));

    var currentHero = document.querySelector('.hero-banner, .hero-bar, .article-cover');
    var nextHero = nextDoc.querySelector('.hero-banner, .hero-bar, .article-cover');
    if (currentHero && nextHero) currentHero.replaceWith(document.importNode(nextHero, true));

    var nextBody = nextDoc.body;
    document.body.dataset.page = getRoutePage(targetUrl);
    document.body.classList.toggle('has-banner', !nextBody || nextBody.classList.contains('has-banner'));
    document.title = nextDoc.title || document.title;
    closeMobileMenu();
    updateScrollProgress();
  }

  function initRoute(page, seq) {
    var loadPromise = Promise.resolve();
    if (page === 'home') {
      loadPromise = loadHome();
    } else if (page === 'post') {
      loadPromise = loadArticle(seq);
      setupCopyLink();
    } else if (page === 'archive') {
      loadPromise = renderArchivePage();
    } else if (page === 'comments') {
      loadPromise = loadSideWidgets();
      if (window.SiteComments && typeof window.SiteComments.mountComments === 'function') {
        window.SiteComments.mountComments();
      }
    } else if (page === 'about' || page === 'links') {
      loadPromise = loadSideWidgets();
    }
    applyListLayout(getListLayout());
    initTypewriters(document);
    initFloatingControls();
    return loadPromise;
  }

  function scrollAfterNavigation(url) {
    window.requestAnimationFrame(function () {
      if (url.hash) scrollToHash(url.hash);
      else window.scrollTo({ top: 0, behavior: 'auto' });
      updateScrollProgress();
    });
  }

  function scrollToHash(hash) {
    if (!hash) return;
    var id = decodeURIComponent(hash.slice(1));
    var target = document.getElementById(id);
    if (!target) return;
    var headerH = header ? header.offsetHeight : 0;
    var top = target.getBoundingClientRect().top + window.scrollY - headerH - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function closeMobileMenu() {
    if (header) header.classList.remove('open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  }

  /* ============================== boot ============================== */

  applyTheme(getTheme());
  applyHue(getHue());
  applyWallpaperMode(getWallpaperMode());

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      var open = header.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  window.addEventListener('scroll', function () {
    if (header) header.classList.toggle('scrolled', (window.scrollY || 0) > 30);
    updateScrollProgress();
  }, { passive: true });

  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (anchor && shouldInterceptLink(event, anchor)) {
      var rawHref = anchor.getAttribute('href') || '';
      if (rawHref.charAt(0) === '#') {
        event.preventDefault();
        scrollToHash(rawHref);
        return;
      }
      event.preventDefault();
      navigate(anchor.href);
      return;
    }
    if (!header || !header.classList.contains('open')) return;
    if (header.contains(event.target)) return;
    closeMobileMenu();
  });

  window.addEventListener('popstate', function () {
    navigate(window.location.href, { fromPopstate: true, replace: true });
  });

  history.replaceState({ siteRoute: true, url: window.location.href }, '', window.location.href);

  initSearchPanel();
  initDisplaySettings();
  initWallpaperCarousel();
  initRoute(initialPage, ++navSeq);

  window.SiteApp = {
    navigate: navigate,
    initRoute: initRoute
  };
})();
