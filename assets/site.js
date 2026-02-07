/* =========================================================
  家轩的博客 - 统一脚本（主页/子页共用）
  - 主题：localStorage('theme') 同步 + Shift 点击恢复跟随系统
  - 导航：滚动渐变（RAF 节流）
  - 移动菜单：点击展开/点外部或 ESC 关闭/点链接自动收起
  - 头像：骨架加载后淡入
  - 子页：目录 TOC 自动生成 + 返回顶部按钮
========================================================= */

(function(){
  const root = document.documentElement;

  const nav = document.getElementById('nav');
  const year = document.getElementById('year');
  const themeToggle = document.getElementById('themeToggle');
  const menuToggle = document.getElementById('menuToggle');
  const menu = document.getElementById('menu');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  const avatar = document.getElementById('avatar');
  const backTop = document.getElementById('backTop');

  const tocEl = document.getElementById('toc');
  const article = document.getElementById('article');

  // 年份
  if (year) year.textContent = String(new Date().getFullYear());

  // ---------- 滚动：导航渐变 + 返回顶部显示 ----------
  let ticking = false;
  function updateOnScroll(){
    const y = window.scrollY || 0;
    if (nav) nav.classList.toggle('scrolled', y > 8);
    if (backTop) backTop.classList.toggle('show', y > 420);
    ticking = false;
  }
  updateOnScroll();
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateOnScroll);
  }, { passive: true });

  if (backTop){
    backTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---------- 主题：系统 + 手动 ----------
  const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  const storage = {
    get(){ try { return localStorage.getItem('theme'); } catch(e){ return null; } },
    set(v){ try { localStorage.setItem('theme', v); } catch(e){} },
    clear(){ try { localStorage.removeItem('theme'); } catch(e){} }
  };

  function getEffectiveTheme(){
    const saved = storage.get();
    if (saved === 'light' || saved === 'dark') return saved;
    return (mql && mql.matches) ? 'dark' : 'light';
  }

  function syncThemeUI(){
    const theme = getEffectiveTheme();
    root.classList.toggle('is-dark', theme === 'dark');

    if (themeColorMeta){
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#0b1225' : '#f5f7fb');
    }

    // 有按钮才更新提示
    if (themeToggle){
      const saved = storage.get();
      const hint = saved
        ? `当前：${saved === 'dark' ? '深色' : '浅色'}（点击切换；Shift+点击跟随系统）`
        : `当前：跟随系统（点击锁定为${theme === 'dark' ? '浅色' : '深色'}；Shift+点击保持跟随）`;

      themeToggle.setAttribute('title', hint);
      themeToggle.setAttribute('aria-label', hint);
    }
  }

  function applyTheme(pref){
    if (pref === 'light' || pref === 'dark'){
      root.dataset.theme = pref;
      storage.set(pref);
    } else {
      delete root.dataset.theme;
      storage.clear();
    }
    syncThemeUI();
  }

  syncThemeUI();

  function onSystemThemeChange(){
    const saved = storage.get();
    if (saved !== 'light' && saved !== 'dark') syncThemeUI();
  }
  if (mql){
    if (mql.addEventListener) mql.addEventListener('change', onSystemThemeChange);
    else if (mql.addListener) mql.addListener(onSystemThemeChange);
  }

  if (themeToggle){
    themeToggle.addEventListener('click', (e) => {
      if (e.shiftKey){
        applyTheme(null); // 恢复跟随系统
        return;
      }
      const current = getEffectiveTheme();
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // ---------- 移动菜单 ----------
  function setMenuOpen(open){
    if (!nav) return;
    nav.classList.toggle('open', open);
    if (menuToggle) menuToggle.setAttribute('aria-expanded', String(open));
  }

  if (menuToggle){
    menuToggle.addEventListener('click', () => {
      if (!nav) return;
      setMenuOpen(!nav.classList.contains('open'));
    });
  }

  if (menu){
    // 点菜单链接后（移动端）自动收起
    menu.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      if (window.matchMedia && window.matchMedia('(max-width: 720px)').matches){
        setMenuOpen(false);
      }
    });
  }

  // 点外部关闭（pointerdown 兼容鼠标/触屏）
  document.addEventListener('pointerdown', (e) => {
    if (!nav || !nav.classList.contains('open')) return;
    if (nav.contains(e.target)) return;
    setMenuOpen(false);
  }, { passive: true });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMenuOpen(false);
  });

  // 视口从移动切回桌面时：强制关闭
  if (window.matchMedia){
    const mqMobile = window.matchMedia('(max-width: 720px)');
    const onWidthChange = () => { if (!mqMobile.matches) setMenuOpen(false); };
    if (mqMobile.addEventListener) mqMobile.addEventListener('change', onWidthChange);
    else if (mqMobile.addListener) mqMobile.addListener(onWidthChange);
  }

  // ---------- 头像加载骨架屏 ----------
  if (avatar){
    const avatarImg = avatar.querySelector('img');
    if (avatarImg){
      const done = () => avatar.classList.add('loaded');
      if (avatarImg.complete && avatarImg.naturalWidth > 0) done();
      avatarImg.addEventListener('load', done);
      avatarImg.addEventListener('error', () => {
        avatarImg.style.display = 'none'; // 保留 ME 占位
      });
    }
  }

  // ---------- 子页目录 TOC ----------
  if (tocEl && article){
    const headings = Array.from(article.querySelectorAll('.prose h2'));
    if (headings.length === 0){
      tocEl.innerHTML = '<span style="color:rgba(125,125,125,.9); font-size:13px;">暂无小标题</span>';
      return;
    }

    headings.forEach((h, idx) => {
      if (!h.id) h.id = 'sec-' + (idx + 1);
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      tocEl.appendChild(a);
    });

    const links = Array.from(tocEl.querySelectorAll('a'));
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));

    if ('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach(a => a.classList.remove('active'));
          const hit = map.get(id);
          if (hit) hit.classList.add('active');
        });
      }, { rootMargin: '-20% 0px -70% 0px', threshold: 0.01 });

      headings.forEach(h => io.observe(h));
    }
  }
})();
