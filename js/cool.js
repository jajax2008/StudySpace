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

    progress();
  } catch (err) {
    try { console.error('cool layer failed', err) } catch (x) {}
  }
})();
