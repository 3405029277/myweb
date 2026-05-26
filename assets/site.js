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
  var initialPage = getRoutePage(new URL(window.location.href));

  function getTheme() {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    var sun = document.getElementById('iconSun');
    var moon = document.getElementById('iconMoon');
    if (sun && moon) {
      sun.style.display = theme === 'dark' ? 'block' : 'none';
      moon.style.display = theme === 'dark' ? 'none' : 'block';
    }
  }

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
    });
  }

  async function fetchJson(url) {
    var r = await fetch(url);
    if (!r.ok) throw new Error('Request failed: ' + url);
    return r.json();
  }

  async function getPosts() {
    try {
      var posts = await fetchJson('/api/posts');
      if (Array.isArray(posts) && posts.length) return posts;
    } catch (e) {}
    return Array.isArray(window.__SITE_POSTS__) ? window.__SITE_POSTS__ : [];
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

    function flushParagraph() {
      if (paragraph.length) {
        html.push('<p>' + renderMathText(safeHtml(paragraph.join(' '))) + '</p>');
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
        html.push('<h' + level + '>' + renderMathText(safeHtml(heading[2])) + '</h' + level + '>');
        return;
      }

      var listItem = line.match(/^\s*[-*]\s+(.+)$/);
      if (listItem) {
        flushParagraph();
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push('<li>' + renderMathText(safeHtml(listItem[1])) + '</li>');
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
    return article;
  }

  function renderCategoryList(posts) {
    var el = document.getElementById('categoryList');
    if (!el) return;
    var counts = {};
    posts.forEach(function (p) { var c = p.category || 'Article'; counts[c] = (counts[c] || 0) + 1; });
    el.innerHTML = Object.entries(counts).map(function (e) {
      return '<a class="category-link" href="#posts" data-filter-category="' + safeHtml(e[0]) + '"><span>' + safeHtml(e[0]) + '</span><span class="count">' + e[1] + '</span></a>';
    }).join('');
  }

  function renderTagCloud(posts) {
    var el = document.getElementById('tagCloud');
    if (!el) return;
    var tags = {};
    posts.forEach(function (p) { (p.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    el.innerHTML = Object.entries(tags).map(function (e) {
      return '<a class="tag" href="#posts" data-filter-tag="' + safeHtml(e[0]) + '">' + safeHtml(e[0]) + '</a>';
    }).join('');
  }

  function renderLatestList(posts) {
    var el = document.getElementById('latestList');
    if (!el) return;
    el.innerHTML = posts.slice(0, 5).map(function (p) {
      return '<a class="latest-link" href="post.html?slug=' + safeHtml(p.slug) + '"><span>' + safeHtml(p.title) + '</span><span class="date">' + safeHtml(formatDate(p.date)) + '</span></a>';
    }).join('');
  }

  function renderSidebarStats(posts) {
    var postCount = document.getElementById('statPostCount');
    var latestDate = document.getElementById('statLatestDate');
    if (postCount) postCount.textContent = String(posts.length);
    if (latestDate) {
      var first = posts && posts.length ? posts[0] : null;
      latestDate.textContent = first && first.date ? formatDate(first.date) : '-';
    }
  }

  function renderTimeline(posts) {
    var el = document.getElementById('recentTimeline');
    if (!el || !posts.length) return;
    var f = posts[0];
    el.innerHTML = '<div class="timeline-item"><a href="post.html?slug=' + safeHtml(f.slug) + '">' + safeHtml(f.title) + '</a><div class="timeline-date">' + safeHtml(formatDateLong(f.date)) + '</div>' + (f.description ? '<div class="timeline-desc">' + safeHtml(f.description) + '</div>' : '') + '</div>';
  }

  function getCoverLine(post, index) {
    var lines = ['字里春风', '山海有信', '知行小记', '风物可期', '缓缓归真', '明月照章'];
    var seed = String((post && post.slug) || index || 0).split('').reduce(function (acc, ch) { return acc + ch.charCodeAt(0); }, 0);
    return lines[seed % lines.length];
  }

  function getCoverMark(post) {
    var title = String((post && post.title) || '').trim();
    return title ? title.charAt(0) : '文';
  }

  function renderMagazineList(posts) {
    var el = document.getElementById('postGrid');
    if (!el) return;
    if (!posts.length) { el.innerHTML = '<article class="empty-state">暂无文章</article>'; return; }
    el.innerHTML = posts.map(function (p, index) {
      var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + safeHtml(t) + '</span>'; }).join('');
      var coverLine = getCoverLine(p, index);
      var coverMark = getCoverMark(p);
      return '<article class="magazine-card"><div class="magazine-cover"><div class="cover-mark">' + safeHtml(coverMark) + '</div><div class="cover-kicker">' + safeHtml(p.category || 'Article') + '</div><div class="cover-date">' + safeHtml(formatDate(p.date) || '未标注日期') + '</div><div class="cover-line">' + safeHtml(coverLine) + '</div></div><div class="magazine-body"><h3><a href="post.html?slug=' + safeHtml(p.slug) + '">' + safeHtml(p.title) + '</a></h3><p class="desc">' + safeHtml(p.description || '') + '</p><div class="magazine-meta"><span>' + safeHtml(formatDate(p.date)) + '</span><div class="tag-list">' + tags + '</div></div></div></article>';
    }).join('');
  }

  function addRouteCleanup(fn) {
    routeCleanup.push(fn);
  }

  function cleanupRoute() {
    routeCleanup.splice(0).forEach(function (fn) {
      try { fn(); } catch (e) {}
    });
  }

  function setupHomeFilters(posts) {
    var el = document.getElementById('postFilters');
    if (!el) return;
    var cats = {};
    posts.forEach(function (p) { var c = p.category || 'Article'; if (!cats[c]) cats[c] = { label: c, value: c }; });
    var filters = [{ label: '全部', value: 'all' }].concat(Object.values(cats));
    el.innerHTML = filters.map(function (f, i) {
      return '<button class="filter-button' + (i === 0 ? ' active' : '') + '" data-filter="' + safeHtml(f.value) + '">' + safeHtml(f.label) + '</button>';
    }).join('');
    function apply(v) {
      var filtered = v === 'all' ? posts : posts.filter(function (p) { return (p.category || 'Article') === v; });
      el.querySelectorAll('.filter-button').forEach(function (b) { b.classList.toggle('active', b.dataset.filter === v); });
      renderMagazineList(filtered);
    }
    function onFilterClick(e) {
      var b = e.target.closest('.filter-button');
      if (b) apply(b.dataset.filter);
    }
    function onDocClick(e) {
      var l1 = e.target.closest('[data-filter-tag]'); if (l1) { e.preventDefault(); apply('all'); scrollToHash('#posts'); }
      var l2 = e.target.closest('[data-filter-category]'); if (l2) { e.preventDefault(); apply(l2.dataset.filterCategory); scrollToHash('#posts'); }
    }
    el.addEventListener('click', onFilterClick);
    document.addEventListener('click', onDocClick);
    addRouteCleanup(function () {
      el.removeEventListener('click', onFilterClick);
      document.removeEventListener('click', onDocClick);
    });
    renderMagazineList(posts);
  }

  function buildToc(contentEl, tocEl) {
    if (!tocEl) return;
    var headings = contentEl.querySelectorAll('h2, h3');
    if (!headings.length) { tocEl.innerHTML = '<p style="color:var(--muted)">暂无目录</p>'; return; }
    tocEl.innerHTML = Array.from(headings).map(function (h, i) {
      if (!h.id) h.id = 'section-' + (i + 1);
      var indent = h.tagName === 'H3' ? ' style="padding-left:16px"' : '';
      return '<a href="#' + safeHtml(h.id) + '"' + indent + '>' + safeHtml(h.textContent) + '</a>';
    }).join('');
    var tocLinks = tocEl.querySelectorAll('a');
    function highlightToc() {
      var headerH = header ? header.offsetHeight : 0;
      var active = null;
      headings.forEach(function (h) { if (h.getBoundingClientRect().top < headerH + 100) active = h; });
      tocLinks.forEach(function (a) {
        var isActive = active && a.getAttribute('href') === '#' + active.id;
        a.style.color = isActive ? 'var(--accent-2)' : 'var(--muted)';
        a.style.borderLeftColor = isActive ? 'var(--accent-2)' : 'transparent';
      });
    }
    window.addEventListener('scroll', highlightToc, { passive: true });
    addRouteCleanup(function () { window.removeEventListener('scroll', highlightToc); });
    highlightToc();
  }

  async function loadHome() {
    try {
      var posts = await getPosts();
      var summary = document.getElementById('postSummary');
      if (summary) summary.textContent = '共 ' + posts.length + ' 篇文章';
      renderCategoryList(posts);
      renderTagCloud(posts);
      renderLatestList(posts);
      renderSidebarStats(posts);
      renderTimeline(posts);
      setupHomeFilters(posts);
    } catch (error) {
      var grid = document.getElementById('postGrid');
      var summaryError = document.getElementById('postSummary');
      if (summaryError) summaryError.textContent = '文章加载失败';
      if (grid) grid.innerHTML = '<article class="empty-state">文章加载失败，请检查 posts 目录和接口。</article>';
    }
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
      if (title) title.textContent = article.title;
      if (category) category.textContent = article.category || 'Article';
      var metaParts = [];
      if (article.date) metaParts.push('<span>' + safeHtml(formatDateLong(article.date)) + '</span>');
      if (Array.isArray(article.tags) && article.tags.length) metaParts.push('<span>' + safeHtml(article.tags.join(' / ')) + '</span>');
      if (meta) meta.innerHTML = metaParts.join('<span>·</span>');
      contentEl.innerHTML = article.html;
      contentEl.innerHTML = renderMathText(contentEl.innerHTML);
      highlightCodeBlocks(contentEl);
      buildToc(contentEl, document.getElementById('articleToc'));
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
    button.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(window.location.href);
        button.textContent = '已复制';
        window.setTimeout(function () { button.textContent = '复制链接'; }, 1200);
      } catch (e) { button.textContent = '复制失败'; }
    });
  }

  function updateScrollProgress() {
    if (!scrollProgress) return;
    var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    scrollProgress.style.width = (scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0) + '%';
  }

  function setupStaggerReveal() {
    document.querySelectorAll('.reveal').forEach(function (el) {
      var children = el.querySelectorAll(':scope > *');
      children.forEach(function (child, i) {
        child.style.opacity = '0';
        child.style.transform = 'translateY(14px)';
        child.style.transition = 'opacity 0.5s ease ' + (i * 0.07) + 's, transform 0.5s ease ' + (i * 0.07) + 's';
      });
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) {
          el.querySelectorAll(':scope > *').forEach(function (child) { child.style.opacity = '1'; child.style.transform = 'translateY(0)'; });
          observer.unobserve(el);
        }});
      }, { threshold: 0.15 });
      observer.observe(el);
      addRouteCleanup(function () { observer.disconnect(); });
    });
  }

  function setupXiaowuParallax() {
    var card = document.querySelector('.xiaowu-showcase');
    if (!card) return;
    var finePointer = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
    if (!finePointer) return;

    function updateFromEvent(event) {
      var rect = card.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width;
      var y = (event.clientY - rect.top) / rect.height;
      var moveX = (x - 0.5) * 12;
      var moveY = (y - 0.5) * 10;
      card.style.setProperty('--move-x', moveX.toFixed(2) + 'px');
      card.style.setProperty('--move-y', moveY.toFixed(2) + 'px');
    }

    function resetMove() {
      card.style.setProperty('--move-x', '0px');
      card.style.setProperty('--move-y', '0px');
    }

    card.addEventListener('pointermove', updateFromEvent);
    card.addEventListener('pointerleave', resetMove);
    addRouteCleanup(function () {
      card.removeEventListener('pointermove', updateFromEvent);
      card.removeEventListener('pointerleave', resetMove);
    });
  }

  function setupPageLoader(loadPromise) {
    var loader = document.getElementById('pageLoader');
    if (!loader) return;
    var ring = document.getElementById('loaderRing');
    var poem = document.getElementById('loaderPoem');
    var progressText = document.getElementById('loaderProgressText');
    var poems = ['两情若是久长时，又岂在朝朝暮暮。', '愿得一心人，白头不相离。', '身无彩凤双飞翼，心有灵犀一点通。', '衣带渐宽终不悔，为伊消得人憔悴。', '在天愿作比翼鸟，在地愿为连理枝。', '玲珑骰子安红豆，入骨相思知不知。'];
    var startIndex = Math.floor(Math.random() * poems.length);
    var progress = 0;
    var poemTimer = null;

    function setProgress(value) {
      var v = Math.max(0, Math.min(100, value));
      progress = v;
      if (ring) ring.style.setProperty('--loader-progress', (v * 3.6).toFixed(1) + 'deg');
      if (progressText) progressText.textContent = '加载中 ' + v + '%';
    }

    function switchPoem(index) {
      if (!poem) return;
      poem.style.opacity = '0';
      poem.style.transform = 'translateY(6px)';
      window.setTimeout(function () {
        poem.textContent = poems[index % poems.length];
        poem.style.opacity = '1';
        poem.style.transform = 'translateY(0)';
      }, 180);
    }

    switchPoem(startIndex);
    setProgress(0);
    poemTimer = window.setInterval(function () { startIndex += 1; switchPoem(startIndex); }, 1800);
    var startTime = Date.now();
    var progressTimer = window.setInterval(function () {
      if (progress >= 88) return;
      setProgress(progress + (2 + Math.floor(Math.random() * 5)));
    }, 140);

    Promise.all([
      Promise.resolve(loadPromise).catch(function () {}),
      new Promise(function (resolve) { window.setTimeout(resolve, 1300); })
    ]).then(function () {
      var elapsed = Date.now() - startTime;
      var remain = Math.max(0, 1800 - elapsed);
      window.setTimeout(function () {
        window.clearInterval(progressTimer);
        window.clearInterval(poemTimer);
        setProgress(100);
        loader.classList.add('hidden');
        window.setTimeout(function () {
          if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
        }, 650);
      }, remain);
    });
  }

  function getRoutePage(url) {
    var pathname = normalizePath(url.pathname);
    if (pathname === '/' || pathname === '/index.html' || /\/index\.html$/i.test(pathname)) return 'home';
    if (pathname === '/post.html' || /\/post\.html$/i.test(pathname)) return 'post';
    if (pathname === '/comments.html' || /\/comments\.html$/i.test(pathname)) return 'comments';
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
      return getRoutePage(new URL(window.location.href)) === 'home' && !!document.getElementById(decodeURIComponent(rawHref.slice(1)));
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
    document.body.dataset.page = getRoutePage(targetUrl);
    document.title = nextDoc.title || document.title;
    closeMobileMenu();
    updateScrollProgress();
  }

  function initRoute(page, seq) {
    var loadPromise = Promise.resolve();
    if (page === 'home') {
      loadPromise = loadHome();
      setupXiaowuParallax();
    } else if (page === 'post') {
      loadPromise = loadArticle(seq);
      setupCopyLink();
    } else if (page === 'comments' && window.SiteComments && typeof window.SiteComments.mountComments === 'function') {
      window.SiteComments.mountComments();
    }
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () { setupStaggerReveal(); });
    }
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

  applyTheme(getTheme());

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
    if (header) header.classList.toggle('scrolled', (window.scrollY || 0) > 12);
    updateScrollProgress();
  }, { passive: true });

  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (anchor && shouldInterceptLink(event, anchor)) {
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

  var homeLoadPromise = initRoute(initialPage, ++navSeq);
  if (initialPage === 'home') setupPageLoader(homeLoadPromise);

  window.SiteApp = {
    navigate: navigate,
    initRoute: initRoute
  };
})();
