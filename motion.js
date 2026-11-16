/* StudySpace motion layer.
   Loaded after the app script, so it can hook the existing render cycle.
   Purely additive: everything is wrapped in try/catch, and if any part fails
   the app keeps working exactly as it did before. Styles live in motion.css. */
(function () {
  try {
    /* ---------- TAB BAR ICONS ---------- */
    var NIC = {
      home: 'M4 11.6 12 5l8 6.6V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
      acad: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
      focus: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9.2v3.4l2.4 1.7M9.5 2.6h5',
      life: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
      more: 'M4 8h16M4 16h16M14 5.4v5.2M10 13.4v5.2'
    };
    var ARIA = { home: 'Home', acad: 'Academics', focus: 'Focus', life: 'Life', more: 'More and settings' };
    var nav = document.querySelector('nav');

    if (nav) {
      [].forEach.call(nav.querySelectorAll('button[data-t]'), function (b) {
        if (b.querySelector('svg') || !NIC[b.dataset.t]) return;
        var label = (b.textContent || '').trim() || ARIA[b.dataset.t] || '';
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', NIC[b.dataset.t]);
        path.setAttribute('pathLength', '100');
        svg.appendChild(path);
        var span = document.createElement('span');
        span.textContent = label;
        b.textContent = '';
        b.appendChild(svg);
        b.appendChild(span);
        b.setAttribute('aria-label', ARIA[b.dataset.t] || label);
      });
    }

    /* ---------- RENDER HOOK ----------
       Wraps the app's render() to add: directional page transitions, icon
       path lengths for the draw-in, and per-tile stagger delays. */
    var ORDER = { home: 0, acad: 1, focus: 2, life: 3, more: 4 };
    var lastTab = null;
    var renderApp = (typeof render === 'function') ? render : null;

    if (renderApp) {
      var hooked = function () {
        var dir = '';
        try {
          if (lastTab && tab && ORDER[tab] !== undefined && ORDER[lastTab] !== undefined && ORDER[tab] !== ORDER[lastTab]) {
            dir = ORDER[tab] > ORDER[lastTab] ? 'ss-pg-fwd' : 'ss-pg-back';
          }
        } catch (e) {}

        var result = renderApp.apply(this, arguments);

        try {
          var view = document.getElementById('view');
          if (view) {
            if (dir) {
              view.classList.remove('ss-pg-fwd', 'ss-pg-back');
              void view.offsetWidth;
              view.classList.add(dir);
            }
            [].forEach.call(view.querySelectorAll('.ti svg path,.ht svg path'), function (p) {
              try { p.setAttribute('pathLength', '100') } catch (e) {}
            });
            [].forEach.call(view.querySelectorAll('.hg .ht,.tiles .tile'), function (el, i) {
              el.style.setProperty('--i', i % 12);
            });
          }
          if (nav && lastTab !== tab) {
            var active = nav.querySelector('button[data-t="' + tab + '"] svg');
            if (active) {
              active.classList.remove('ss-pop');
              void active.offsetWidth;
              active.classList.add('ss-pop');
            }
          }
        } catch (e) {}

        try { lastTab = tab } catch (e) {}
        return result;
      };

      /* Keep the old name working everywhere the app calls render(). */
      render = hooked;
      try { window.render = hooked } catch (e) {}
    }

    /* ---------- TOUCH RIPPLE ---------- */
    document.addEventListener('pointerdown', function (e) {
      var target = e.target.closest && e.target.closest('button,.tile,.ht,.subcard,.choice-btn');
      if (!target || target.disabled) return;
      try {
        var box = target.getBoundingClientRect();
        var size = Math.max(box.width, box.height) * 1.7;
        var dot = document.createElement('span');
        dot.className = 'ss-ripple';
        dot.style.cssText =
          'width:' + size + 'px;height:' + size + 'px;left:' +
          (e.clientX - box.left - size / 2) + 'px;top:' +
          (e.clientY - box.top - size / 2) + 'px';
        target.appendChild(dot);
        setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot) }, 650);
      } catch (x) {}
    }, true);

    /* ---------- HAPTIC TAPS (tabs + primary actions only) ---------- */
    var BUZZ = { tgo: 1, bsend: 1, lbsend: 1, acctsend: 1, addtask: 1, addsub: 1, addtx: 1, obgo: 1, widsync: 1, ssFab: 1 };
    document.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (!(b.dataset && b.dataset.t) && !BUZZ[b.id]) return;
      try { if (navigator.vibrate) navigator.vibrate(7) } catch (x) {}
    }, true);

    /* ---------- COUNTDOWN DIGIT FLIP ----------
       The exam timer writes new digits into .tm b every second; flip only the
       digits that actually changed. */
    try {
      var appEl = document.getElementById('app');
      if (appEl && window.MutationObserver) {
        var mo = new MutationObserver(function (list) {
          for (var i = 0; i < list.length; i++) {
            var node = list[i].target;
            var el = node.nodeType === 3 ? node.parentNode : node;
            if (!el || !el.matches || !el.matches('.tm b')) continue;
            if (el.textContent === el.getAttribute('data-ss')) continue;
            el.setAttribute('data-ss', el.textContent);
            el.classList.remove('ss-flip');
            void el.offsetWidth;
            el.classList.add('ss-flip');
          }
        });
        mo.observe(appEl, { subtree: true, characterData: true });
      }
    } catch (x) {}

    /* ---------- SCROLL SHADOW ---------- */
    var viewEl = document.getElementById('view');
    function ssShadow() {
      var app = document.getElementById('app');
      if (app && viewEl) app.classList.toggle('ss-scrolled', viewEl.scrollTop > 4);
    }
    if (viewEl) viewEl.addEventListener('scroll', ssShadow, { passive: true });
    ssShadow();
  } catch (err) {
    try { console.error('motion layer failed', err) } catch (x) {}
  }
})();
