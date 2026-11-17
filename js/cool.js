/* StudySpace "cool" layer behaviour.
   Runs after the app, the UI upgrade and the motion layer. Builds the aurora
   backdrop, the scroll progress line and the quick-add FAB + bottom sheet.
   Everything is wrapped in try/catch: if any part fails the app still runs. */
(function () {
  try {
    /* ---------- AURORA BACKDROP ---------- */
    var aura = document.createElement('div');
    aura.id = 'ssAura';
    aura.setAttribute('aria-hidden', 'true');
    aura.innerHTML = '<i></i><i></i><i></i>';
    document.body.appendChild(aura);

    /* A background photo set through Personalize should win over the aurora. */
    try {
      var applyUIOld = applyUI;
      applyUI = function () {
        var out = applyUIOld.apply(this, arguments);
        try {
          var bi = getComputedStyle(document.body).backgroundImage || '';
          document.documentElement.dataset.ssbg =
            (bi && bi !== 'none' && bi.indexOf('url(') !== -1) ? '1' : '0';
        } catch (e) {}
        return out;
      };
      applyUI();
    } catch (e) {}

    /* ---------- SCROLL PROGRESS ---------- */
    var bar = document.createElement('div');
    bar.id = 'ssBar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    function progress() {
      var view = document.getElementById('view');
      if (!view) return;
      var max = view.scrollHeight - view.clientHeight;
      var p = max > 8 ? Math.min(1, Math.max(0, view.scrollTop / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }

    var scrollTarget = document.getElementById('view');
    if (scrollTarget) scrollTarget.addEventListener('scroll', progress, { passive: true });

    try {
      var renderOld = render;
      render = function () {
        var out = renderOld.apply(this, arguments);
        progress();
        return out;
      };
    } catch (e) {}

    /* ---------- QUICK ADD ---------- */
    var ACTIONS = [
      { k: 'task', l: 'New task', d: 'M5 12l4.5 4.5L19 7' },
      { k: 'exam', l: 'New exam', d: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4' },
      { k: 'money', l: 'New expense', d: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7V6a2 2 0 0 1 2-2h11M16 13.5h.01' },
      { k: 'note', l: 'New note', d: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6' }
    ];

    var fab = document.createElement('button');
    fab.id = 'ssFab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Quick add');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    document.body.appendChild(fab);

    var sheet = null;

    function closeSheet() {
      if (!sheet) return;
      var node = sheet;
      sheet = null;
      fab.classList.remove('open');
      fab.setAttribute('aria-expanded', 'false');
      node.classList.add('ss-out');
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 240);
    }

    function openSheet() {
      if (sheet || document.getElementById('onb')) return;
      fab.classList.add('open');
      fab.setAttribute('aria-expanded', 'true');
      sheet = document.createElement('div');
      sheet.id = 'ssSheet';
      sheet.innerHTML =
        '<div class="sh" role="dialog" aria-modal="true" aria-label="Quick add">' +
        '<div class="grab"></div><h2>Quick add</h2><div class="qa">' +
        ACTIONS.map(function (a, i) {
          return '<button type="button" data-qa="' + a.k + '" style="--i:' + i + '">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + a.d + '"/></svg>' + a.l +
            '</button>';
        }).join('') +
        '</div></div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', function (e) {
        if (e.target === sheet) return closeSheet();
        var b = e.target.closest && e.target.closest('[data-qa]');
        if (b) go(b.dataset.qa);
      });
    }

    function focusEl(id) {
      var el = document.getElementById(id);
      if (!el) return;
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch (e) {}
      setTimeout(function () {
        try { el.focus({ preventScroll: true }) } catch (e) { try { el.focus() } catch (x) {} }
      }, 140);
    }

    /* Reuses the app's own views and forms instead of duplicating them. */
    function go(kind) {
      closeSheet();
      setTimeout(function () {
        try {
          if (kind === 'task') {
            if (!S.subjects.length) {
              tab = 'acad'; hv = null; curSub = null; render(); focusEl('subname');
              return;
            }
            tab = 'acad'; hv = null; curSub = S.subjects[0].id; render(); focusEl('ttitle');
          } else if (kind === 'exam') {
            tab = 'acad'; hv = 'exams'; curSub = null; render(); focusEl('etitle');
          } else if (kind === 'money') {
            tab = 'life'; hv = 'wallet'; curSub = null; render(); focusEl('wamt');
          } else if (kind === 'note') {
            tab = 'acad'; hv = 'notes'; curSub = null; render();
            var nb = document.getElementById('newnote');
            if (nb) nb.click();
          }
        } catch (e) {}
      }, 170);
    }

    fab.addEventListener('click', function () {
      if (sheet) closeSheet(); else openSheet();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet) closeSheet();
    });

    progress();
  } catch (err) {
    try { console.error('cool layer failed', err) } catch (x) {}
  }
})();
