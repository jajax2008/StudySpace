/* StudySpace live buddies.
   Swaps the static StudyBuddy / Life Buddy faces for reactive avatars and adds
   a "hero" avatar to the buddy chat screens. Purely additive: if anything here
   fails the original faces keep working, and every interaction is guarded. */
(function () {
  try {
    var NS = 'http://www.w3.org/2000/svg';

    /* ---------- AVATAR MARKUP ---------- */
    function avatar(kind) {
      var study = kind !== 'life';
      return '<svg class="sb-av" viewBox="0 0 72 72" data-kind="' + (study ? 'study' : 'life') +
        '" data-mood="idle" role="img" aria-label="' + (study ? 'StudyBuddy' : 'Life Buddy') + '">' +
        '<ellipse class="sb-ground" cx="36" cy="67" rx="14" ry="2.6"/>' +
        '<g class="sb-tilt">' +
          '<g class="sb-paw"><ellipse cx="17.5" cy="47" rx="4.7" ry="5.6"/></g>' +
          '<g class="sb-paw sb-paw-r"><ellipse cx="54.5" cy="47" rx="4.7" ry="5.6"/></g>' +
          '<circle class="sb-skin" cx="36" cy="38" r="20"/>' +
          (study
            ? '<g class="sb-hat"><path class="sb-cap" d="M18 24 36 15 54 24 36 32Z"/><path class="sb-capband" d="M52 25v6"/></g>'
            : '<g class="sb-leaf"><path d="M36 18c-.5-6 4-9 8-8-.5 4.5-3 8-8 8Z"/><path d="M36 18c.5-6-4-9-8-8 .5 4.5 3 8 8 8Z"/></g>') +
          '<g class="sb-face">' +
            '<path class="sb-brow" d="M24 30h8"/><path class="sb-brow" d="M40 30h8"/>' +
            '<g class="sb-eyes">' +
              '<g class="sb-eye"><ellipse cx="29" cy="37" rx="3.3" ry="4.1"/><circle class="sb-glint" cx="30.2" cy="35.4" r="1.1"/></g>' +
              '<g class="sb-eye"><ellipse cx="43" cy="37" rx="3.3" ry="4.1"/><circle class="sb-glint" cx="44.2" cy="35.4" r="1.1"/></g>' +
            '</g>' +
            '<g class="sb-blush"><ellipse cx="22" cy="43.5" rx="4" ry="2.3"/><ellipse cx="50" cy="43.5" rx="4" ry="2.3"/></g>' +
            '<path class="sb-smile" d="M32 45.5q4 4 8 0"/>' +
            '<path class="sb-frown" d="M32 47.5q4-4 8 0"/>' +
            '<ellipse class="sb-omouth" cx="36" cy="46" rx="3" ry="2.6"/>' +
          '</g>' +
        '</g>' +
        '<g class="sb-fx"></g>' +
        '<g class="sb-dots"><circle cx="29" cy="9" r="1.7"/><circle cx="36" cy="7.5" r="1.7"/><circle cx="43" cy="9" r="1.7"/></g>' +
        '<text class="sb-zzz" x="52" y="16">z</text>' +
        '</svg>';
    }

    /* The app builds the home cards through budSVG(), so overriding it swaps
       both faces without touching buddyBoxes(). */
    try {
      budSVG = function (kind) { return avatar(kind === 'l' ? 'life' : 'study') };
      window.budSVG = budSVG;
    } catch (e) {}

    /* ---------- STATE ---------- */
    function isNight() {
      var h = new Date().getHours();
      return h >= 22 || h < 5;
    }
    function busy(kind) {
      try { return kind === 'life' ? !!(LB && LB.busy) : !!(B && B.busy) } catch (e) { return false }
    }
    function outOfQuota(kind) {
      try {
        if (kind === 'life') return typeof lbLeft === 'function' && lbLeft() <= 0;
        return !!(S && S.ai && S.ai.mode === 'online') && typeof buddyOnlineLeft === 'function' && buddyOnlineLeft() <= 0;
      } catch (e) { return false }
    }
    function modeLabel() {
      try {
        if (S.ai.mode === 'offline') return 'Instant';
        if (S.ai.mode === 'device') return 'On-device';
        return 'Online';
      } catch (e) { return '' }
    }
    function caption(kind) {
      if (busy(kind)) return kind === 'life' ? 'Listening…' : 'Thinking…';
      if (outOfQuota(kind)) return kind === 'life' ? 'Resting until tomorrow' : 'Out of AI answers for today';
      if (isNight()) return 'Sleepy… but still here';
      if (kind === 'life') return 'I’m here to listen';
      var m = modeLabel();
      return m === 'Instant' ? 'Instant answers from your notes'
        : m === 'On-device' ? 'Running on your phone'
        : 'Ask me anything';
    }
    function baseMood(kind) {
      if (busy(kind)) return 'thinking';
      if (outOfQuota(kind)) return kind === 'life' ? 'sleepy' : 'sad';
      if (isNight()) return 'sleepy';
      return 'idle';
    }

    /* ---------- SOUND + HAPTICS ---------- */
    var AC = null;
    function chirp() {
      try {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        AC = AC || new C();
        if (AC.state === 'suspended') AC.resume();
        var t = AC.currentTime, g = AC.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        g.connect(AC.destination);
        [659, 880].forEach(function (f, i) {
          var o = AC.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t + i * 0.07);
          o.connect(g);
          o.start(t + i * 0.07);
          o.stop(t + i * 0.07 + 0.13);
        });
      } catch (e) {}
    }
    function buzz(ms) {
      try { if (navigator.vibrate) navigator.vibrate(ms) } catch (e) {}
    }

    /* ---------- PETTING ---------- */
    function pet(el) {
      if (!el) return;
      var now = Date.now();
      if (el.__petAt && now - el.__petAt < 260) return; // debounce rapid taps
      el.__petAt = now;

      el.dataset.mood = 'happy';
      el.dataset.pet = '1';
      el.classList.remove('sb-pet');
      void el.getBoundingClientRect();
      el.classList.add('sb-pet');

      clearTimeout(el.__petT);
      el.__petT = setTimeout(function () {
        delete el.dataset.pet;
        el.classList.remove('sb-pet');
        el.dataset.mood = baseMood(el.dataset.kind === 'life' ? 'life' : 'study');
      }, 1700);

      var fx = el.querySelector('.sb-fx');
      if (fx) {
        for (var i = 0; i < 5; i++) {
          (function (i) {
            var t = document.createElementNS(NS, 'text');
            t.setAttribute('x', (26 + Math.random() * 20).toFixed(1));
            t.setAttribute('y', '36');
            t.textContent = i % 2 ? '♥' : '✦';
            t.style.animation = 'sbHeart 1s ease-out ' + (i * 0.07).toFixed(2) + 's forwards';
            fx.appendChild(t);
            setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t) }, 1500);
          })(i);
        }
      }

      var line = document.querySelector('#ssBuddyHead small');
      if (line) {
        var was = line.textContent;
        line.textContent = 'Hehe ♥';
        line.dataset.locked = '1';
        clearTimeout(line.__t);
        line.__t = setTimeout(function () {
          delete line.dataset.locked;
          line.textContent = was;
        }, 1500);
      }

      chirp();
      buzz(12);
    }

    /* ---------- HERO HEADER IN THE CHAT SCREENS ---------- */
    function mountHead() {
      var view = document.getElementById('view');
      if (!view) return;
      var t = typeof tab !== 'undefined' ? tab : '';
      var h = typeof hv !== 'undefined' ? hv : '';
      var kind = (t === 'acad' && h === 'buddy') ? 'study' : (t === 'life' && h === 'lifebuddy') ? 'life' : '';
      var old = document.getElementById('ssBuddyHead');

      if (!kind) { if (old) old.remove(); return }
      if (old) {
        if (old.dataset.kind === kind) return;
        old.remove();
      }

      var head = document.createElement('div');
      head.id = 'ssBuddyHead';
      head.className = 'sb-head';
      head.dataset.kind = kind;
      head.style.setProperty('--bc', kind === 'study' ? 'var(--accent)' : '#c0793b');
      head.innerHTML = avatar(kind) +
        '<div class="sb-head-txt"><b>' + (kind === 'study' ? 'StudyBuddy' : 'Life Buddy') +
        '</b><small>' + caption(kind) + '</small></div>' +
        '<span class="sb-pill">' + (kind === 'study' ? modeLabel() : '') + '</span>';

      var sub = view.querySelector('p.sub');
      if (sub && sub.parentNode === view) sub.insertAdjacentElement('afterend', head);
      else view.insertBefore(head, view.firstChild);

      var face = head.querySelector('.sb-av');
      if (face) {
        face.setAttribute('tabindex', '0');
        face.style.cursor = 'pointer';
      }
      head.querySelector('.sb-pill').hidden = kind !== 'study';
    }

    /* ---------- POINTER TRACKING ---------- */
    var raf = 0, lastMove = 0;
    function track(x, y) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var avs = document.querySelectorAll('.sb-av');
        for (var i = 0; i < avs.length; i++) {
          var el = avs[i], r = el.getBoundingClientRect();
          if (!r.width) continue;
          if (r.bottom < -40 || r.top > innerHeight + 40) continue;
          var dx = Math.max(-1, Math.min(1, (x - (r.left + r.width / 2)) / 150));
          var dy = Math.max(-1, Math.min(1, (y - (r.top + r.height * 0.55)) / 150));
          el.style.setProperty('--lx', dx.toFixed(2));
          el.style.setProperty('--ly', dy.toFixed(2));
        }
      });
    }
    document.addEventListener('pointermove', function (e) {
      lastMove = Date.now();
      track(e.clientX, e.clientY);
    }, { passive: true });

    /* idle look-around when nobody is pointing */
    setInterval(function () {
      if (Date.now() - lastMove < 3500) return;
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        if (Math.random() > 0.35) continue;
        avs[i].style.setProperty('--lx', (Math.random() * 1.4 - 0.7).toFixed(2));
        avs[i].style.setProperty('--ly', (Math.random() * 1.1 - 0.55).toFixed(2));
      }
    }, 4200);

    /* ---------- BLINKING ---------- */
    setInterval(function () {
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        if (Math.random() > 0.24) continue;
        (function (el) {
          el.classList.add('sb-blink');
          setTimeout(function () { el.classList.remove('sb-blink') }, 150);
        })(avs[i]);
      }
    }, 1400);

    /* ---------- MOOD + CAPTION TICKER ---------- */
    setInterval(function () {
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        var el = avs[i];
        if (el.dataset.pet === '1') continue;
        var m = baseMood(el.dataset.kind === 'life' ? 'life' : 'study');
        if (el.dataset.mood !== m) el.dataset.mood = m;
      }
      var head = document.getElementById('ssBuddyHead');
      if (!head) return;
      var kind = head.dataset.kind;
      var line = head.querySelector('small');
      if (line && !line.dataset.locked) {
        var c = caption(kind);
        if (line.textContent !== c) line.textContent = c;
      }
      var pill = head.querySelector('.sb-pill');
      if (pill && kind === 'study') {
        var label = modeLabel();
        if (pill.textContent !== label) pill.textContent = label;
      }
    }, 600);

    /* ---------- EVENTS ---------- */
    document.addEventListener('click', function (e) {
      var big = e.target.closest && e.target.closest('#ssBuddyHead .sb-av');
      if (big) {
        e.preventDefault();
        e.stopPropagation();
        pet(big);
      }
    }, true);

    document.addEventListener('keydown', function (e) {
      var big = e.target.closest && e.target.closest('#ssBuddyHead .sb-av');
      if (big && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        pet(big);
      }
    });

    /* long-press the little card faces to pet them without leaving the screen */
    var lp = null, suppress = false;
    document.addEventListener('pointerdown', function (e) {
      var av = e.target.closest && e.target.closest('.bcard .sb-av');
      if (!av) return;
      clearTimeout(lp);
      lp = setTimeout(function () {
        suppress = true;
        pet(av);
        setTimeout(function () { suppress = false }, 800);
      }, 430);
    }, true);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      document.addEventListener(ev, function () { clearTimeout(lp) }, true);
    });
    document.addEventListener('click', function (e) {
      if (suppress && e.target.closest && e.target.closest('.bcard')) {
        e.preventDefault();
        e.stopPropagation();
        suppress = false;
      }
    }, true);

    /* ---------- HOOK RENDER ---------- */
    function decorate() {
      try { mountHead() } catch (e) {}
    }
    try {
      var renderOld = render;
      render = function () {
        var out = renderOld.apply(this, arguments);
        decorate();
        return out;
      };
    } catch (e) {}

    decorate();
    try { render() } catch (e) {}
  } catch (err) {
    try { console.error('buddies layer failed', err) } catch (e) {}
  }
})();
