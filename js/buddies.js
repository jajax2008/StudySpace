/* StudySpace live buddies — hand-drawn characters with a full state machine.
   One SVG per buddy, drawn for the mood card upgrade:
     · StudyBuddy  — same round face as LifeBuddy, bald on top, nerdy glasses
     · LifeBuddy   — soft round companion, sprout, scarf, big warm eyes
   States: idle · sleepy (Life Tracker window) · thinking (typing) ·
   listening (message sent) · happy (tap) plus a two-minute performance loop
   (whistle / hum / playful / wave). Purely additive: every hook is guarded so
   the rest of the app keeps working if anything here fails. */
(function () {
  try {
    var NS = 'http://www.w3.org/2000/svg';

    /* ================= ART ================= */
    function mouths(y) {
      return '<path class="sb-m sb-m-smile" d="M34.5 ' + (y - 1) + 'q5.5 4.6 11 0"/>' +
        '<path class="sb-m sb-m-frown" d="M34.5 ' + (y + 3) + 'q5.5-4.4 11 0"/>' +
        '<ellipse class="sb-m sb-m-o" cx="40" cy="' + (y + 1.7) + '" rx="3" ry="3.4"/>' +
        '<circle class="sb-m sb-m-whistle" cx="40" cy="' + (y + 1) + '" r="2.3"/>' +
        '<path class="sb-m sb-m-sleep" d="M35.6 ' + (y + 1) + 'q4.4 2.3 8.8 0"/>';
    }

    /* StudyBuddy shares LifeBuddy's exact body, head, ears, hands, eyes, brows,
       blush and mouth, so both buddies read as the same family. He is bald on
       top (no sprout, no hair) and wears simple round nerdy glasses. The eyes
       and happy-arc paths keep the same groups as before, so every sleep,
       blink, thinking, listening and performance rule still applies. */
    function studyArt() {
      return '<circle class="sb-ear" cx="17.8" cy="35" r="5.4"/>' +
        '<circle class="sb-ear" cx="62.2" cy="35" r="5.4"/>' +
        '<path class="sb-sk" d="M40 15c14.4 0 24.6 10.3 24.6 24.4C64.6 54.6 53.6 65 40 65S15.4 54.6 15.4 39.4C15.4 25.3 25.6 15 40 15Z"/>' +
        '<path class="sb-sheen" d="M25.6 30.4c1.8-5 5.3-8 9.6-8.8"/>' +
        '<g class="sb-hand sb-hand-l"><ellipse cx="14.2" cy="51" rx="5.4" ry="5"/></g>' +
        '<g class="sb-hand sb-hand-r"><ellipse cx="65.8" cy="51" rx="5.4" ry="5"/></g>' +
        '<g class="sb-tilt">' +
          '<g class="sb-eyes">' +
            '<g class="sb-eye sb-eye-l"><ellipse class="sb-eye-p" cx="31.5" cy="37.6" rx="4.5" ry="5.3"/><circle class="sb-glint" cx="33" cy="35.6" r="1.5"/></g>' +
            '<g class="sb-eye sb-eye-r"><ellipse class="sb-eye-p" cx="48.5" cy="37.6" rx="4.5" ry="5.3"/><circle class="sb-glint" cx="50" cy="35.6" r="1.5"/></g>' +
          '</g>' +
          '<g class="sb-glasses">' +
            '<circle class="sb-lens" cx="31.5" cy="37.6" r="8.1"/>' +
            '<circle class="sb-lens" cx="48.5" cy="37.6" r="8.1"/>' +
            '<path class="sb-frame" d="M39.6 36.9q.9-1.3 1.8 0M23.4 37.1 19.6 35.9M56.6 37.1 60.4 35.9"/>' +
            '<path class="sb-glare" d="M27.4 34.2q1.7-2.1 4.1-2"/>' +
          '</g>' +
          '<g class="sb-happy-eyes">' +
            '<path class="sb-happy-eye" d="M26.6 38q4.9-5 9.8 0"/>' +
            '<path class="sb-happy-eye" d="M43.6 38q4.9-5 9.8 0"/>' +
          '</g>' +
          '<path class="sb-brow" d="M27 30.2q4-2.2 8 0"/>' +
          '<path class="sb-brow" d="M45 30.2q4-2.2 8 0"/>' +
          '<ellipse class="sb-blush" cx="23.4" cy="45.6" rx="4.6" ry="2.5"/>' +
          '<ellipse class="sb-blush" cx="56.6" cy="45.6" rx="4.6" ry="2.5"/>' +
          mouths(49.5) +
        '</g>';
    }

    function lifeArt() {
      return '<g class="sb-sprout">' +
          '<path class="sb-stem" d="M40 16.4v-5.2"/>' +
          '<path class="sb-leaf" d="M40 11.6c-.8-4.6-4.1-6.2-7.4-5.3.2 3.8 3 5.9 7.4 5.3Z"/>' +
          '<path class="sb-leaf" d="M40 11.6c.8-4.6 4.1-6.2 7.4-5.3-.2 3.8-3 5.9-7.4 5.3Z"/>' +
        '</g>' +
        '<circle class="sb-ear" cx="17.8" cy="35" r="5.4"/>' +
        '<circle class="sb-ear" cx="62.2" cy="35" r="5.4"/>' +
        '<path class="sb-sk" d="M40 15c14.4 0 24.6 10.3 24.6 24.4C64.6 54.6 53.6 65 40 65S15.4 54.6 15.4 39.4C15.4 25.3 25.6 15 40 15Z"/>' +
        '<path class="sb-sheen" d="M25.6 30.4c1.8-5 5.3-8 9.6-8.8"/>' +
        '<g class="sb-hand sb-hand-l"><ellipse cx="14.2" cy="51" rx="5.4" ry="5"/></g>' +
        '<g class="sb-hand sb-hand-r"><ellipse cx="65.8" cy="51" rx="5.4" ry="5"/></g>' +
        '<g class="sb-scarf">' +
          '<path class="sb-scarf-band" d="M21.6 56.8c9.4 3.9 27.4 3.9 36.8 0"/>' +
          '<path class="sb-scarf-tail" d="M52.6 58.8c3.7.9 5.6 2.9 6 6.3l-5.1-1.1c-.2-2.3-1-3.8-2.8-4.4Z"/>' +
        '</g>' +
        '<g class="sb-tilt">' +
          '<g class="sb-eyes">' +
            '<g class="sb-eye sb-eye-l"><ellipse class="sb-eye-p" cx="31.5" cy="37.6" rx="4.5" ry="5.3"/><circle class="sb-glint" cx="33" cy="35.6" r="1.5"/></g>' +
            '<g class="sb-eye sb-eye-r"><ellipse class="sb-eye-p" cx="48.5" cy="37.6" rx="4.5" ry="5.3"/><circle class="sb-glint" cx="50" cy="35.6" r="1.5"/></g>' +
            '<g class="sb-happy-eyes">' +
              '<path class="sb-happy-eye" d="M26.6 38q4.9-5 9.8 0"/>' +
              '<path class="sb-happy-eye" d="M43.6 38q4.9-5 9.8 0"/>' +
            '</g>' +
          '</g>' +
          '<path class="sb-brow" d="M27 30.2q4-2.2 8 0"/>' +
          '<path class="sb-brow" d="M45 30.2q4-2.2 8 0"/>' +
          '<ellipse class="sb-blush" cx="23.4" cy="45.6" rx="4.6" ry="2.5"/>' +
          '<ellipse class="sb-blush" cx="56.6" cy="45.6" rx="4.6" ry="2.5"/>' +
          mouths(49.5) +
        '</g>';
    }

    function avatar(kind) {
      var life = kind === 'life';
      return '<svg class="sb-av" viewBox="0 0 80 80" data-kind="' + (life ? 'life' : 'study') +
        '" data-mood="idle" data-sleep="0" role="img" aria-label="' + (life ? 'LifeBuddy' : 'StudyBuddy') + '">' +
        '<ellipse class="sb-ground" cx="40" cy="73.6" rx="14.8" ry="2.4"/>' +
        '<g class="sb-body">' + (life ? lifeArt() : studyArt()) + '</g>' +
        '<g class="sb-fx" aria-hidden="true">' +
          '<circle class="sb-ring" cx="40" cy="39" r="27"/>' +
          '<circle class="sb-ring sb-ring-b" cx="40" cy="39" r="27"/>' +
          '<g class="sb-think"><circle cx="59" cy="24" r="2.1"/><circle cx="64" cy="18.5" r="1.7"/><circle cx="68" cy="13.5" r="1.3"/></g>' +
          '<g class="sb-zzz"><text x="55" y="23">z</text><text x="60" y="16">z</text><text x="65" y="9">z</text></g>' +
        '</g>' +
        '</svg>';
    }

    /* The app builds the home cards through budSVG(), so overriding it swaps
       both faces without touching buddyBoxes(). */
    try {
      budSVG = function (kind) { return avatar(kind === 'l' ? 'life' : 'study') };
      window.budSVG = budSVG;
      window.SB_AVATAR = avatar;
    } catch (e) {}

    /* ================= READS ================= */
    function isNight() {
      try { if (typeof window.sleepTime === 'function') return !!window.sleepTime() } catch (e) {}
      try {
        var s = S.sleep, d = new Date(), m = d.getHours() * 60 + d.getMinutes();
        var bm = Number(String(s.bed).slice(0, 2)) * 60 + Number(String(s.bed).slice(3));
        var wm = Number(String(s.wake).slice(0, 2)) * 60 + Number(String(s.wake).slice(3));
        if (s.bed && s.wake && bm !== wm) return bm > wm ? (m >= bm || m < wm) : (m >= bm && m < wm);
      } catch (e) {}
      var h = new Date().getHours();
      return h >= 22 || h < 5;
    }
    function busy(kind) {
      try { return kind === 'life' ? !!(LB && LB.busy) : !!(B && B.busy) } catch (e) {}
      var i = document.getElementById(kind === 'life' ? 'lbask' : 'bask');
      return !!(i && i.disabled);
    }
    function modeLabel() {
      try {
        if (S.ai.mode === 'offline') return 'Instant';
        if (S.ai.mode === 'device') return 'On-device';
        return 'Online';
      } catch (e) { return '' }
    }
    function outOfQuota(kind) {
      try {
        if (kind === 'life') return typeof lbLeft === 'function' && lbLeft() <= 0;
        return !!(S && S.ai && S.ai.mode === 'online') && typeof buddyOnlineLeft === 'function' && buddyOnlineLeft() <= 0;
      } catch (e) { return false }
    }
    function caption(kind) {
      if (PHASE[kind] === 'listening' || busy(kind)) return kind === 'life' ? 'Listening to you…' : 'Listening…';
      if (PHASE[kind] === 'thinking' || typing(kind)) return 'Curious about that…';
      if (outOfQuota(kind)) return kind === 'life' ? 'Resting until tomorrow' : 'Out of AI answers for today';
      if (isNight()) return 'Sleeping · zzz';
      if (kind === 'life') return 'I’m here to listen';
      var m = modeLabel();
      return m === 'Instant' ? 'Instant answers from your notes'
        : m === 'On-device' ? 'Running on your phone'
        : 'Ask me anything';
    }

    /* ================= STATE ================= */
    var PHASE = { study: '', life: '' };          /* thinking | listening */
    var LISTEN_UNTIL = { study: 0, life: 0 };
    var PERFS = ['whistle', 'hum', 'playful', 'wave'];
    var PERF_MS = { whistle: 5200, hum: 5400, playful: 2700, wave: 4400, nod: 950 };
    var SAY = ['Hey there', 'That tickles me', 'Hehe'];
    var sayAt = { study: 0, life: 0 };
    var sayT = { study: 0, life: 0 };
    function kindOf(el) { return el && el.dataset && el.dataset.kind === 'life' ? 'life' : 'study' }

    function typing(kind) {
      var i = document.getElementById(kind === 'life' ? 'lbask' : 'bask');
      return !!(i && !i.disabled && i.value && i.value.trim() && document.activeElement === i);
    }

    /* Apply sleep / phase / mood to every buddy currently on screen. */
    function sync() {
      var night = isNight();
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        var el = avs[i], k = kindOf(el);
        var sleep = night ? '1' : '0';
        if (el.dataset.sleep !== sleep) el.dataset.sleep = sleep;

        var busyNow = PHASE[k] || typing(k);
        if ((night || busyNow) && el.dataset.perf) {
          clearTimeout(el.__perfT);
          delete el.dataset.perf;
        }

        var want = night ? 'sleepy'
          : PHASE[k] || (typing(k) ? 'thinking' : '')
          || (el.dataset.pet === '1' ? 'happy' : 'idle');
        if (el.dataset.mood !== want) el.dataset.mood = want;
      }
    }

    /* ================= SOUND + HAPTICS ================= */
    var AC = null;
    function chirp() {
      try {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        AC = AC || new C();
        if (AC.state === 'suspended') AC.resume();
        var t = AC.currentTime, g = AC.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        g.connect(AC.destination);
        [659, 880].forEach(function (f, n) {
          var o = AC.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t + n * 0.075);
          o.connect(g);
          o.start(t + n * 0.075);
          o.stop(t + n * 0.075 + 0.14);
        });
      } catch (e) {}
    }
    function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms) } catch (e) {} }

    /* ================= EFFECTS ================= */
    function spawn(el, node, ms) {
      var fx = el.querySelector('.sb-fx');
      if (!fx) return;
      fx.appendChild(node);
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node) }, ms || 3200);
    }
    function noteNodes(el) {
      for (var i = 0; i < 3; i++) {
        (function (i) {
          var t = document.createElementNS(NS, 'text');
          t.setAttribute('class', 'sb-note');
          t.setAttribute('x', String(46 + i * 4));
          t.setAttribute('y', String(46 - i * 4));
          t.textContent = i === 1 ? '\u266B' : '\u266A';
          t.style.animationDelay = (i * 0.3).toFixed(2) + 's';
          spawn(el, t, 3800);
        })(i);
      }
    }
    function sparkles(el, n) {
      for (var i = 0; i < n; i++) {
        (function (i) {
          var g = document.createElementNS(NS, 'g');
          g.setAttribute('transform', 'translate(' + (24 + Math.random() * 34).toFixed(1) + ' ' + (22 + Math.random() * 16).toFixed(1) + ')');
          var p = document.createElementNS(NS, 'path');
          p.setAttribute('class', 'sb-spark');
          p.setAttribute('d', 'M0 -4 1.1 -1.1 4 0 1.1 1.1 0 4 -1.1 1.1 -4 0 -1.1 -1.1Z');
          p.style.animationDelay = (i * 0.16).toFixed(2) + 's';
          g.appendChild(p);
          spawn(el, g, 2200);
        })(i);
      }
    }
    function hearts(el) {
      for (var i = 0; i < 5; i++) {
        (function (i) {
          var g = document.createElementNS(NS, 'g');
          g.setAttribute('transform', 'translate(' + (28 + Math.random() * 24).toFixed(1) + ' ' + (40 + Math.random() * 8).toFixed(1) + ')');
          var p = document.createElementNS(NS, 'path');
          p.setAttribute('class', 'sb-heart');
          p.setAttribute('d', 'M0 3.6C-5 .5-6-2.7-3.7-4.4c1.3-1 3-.6 3.7.6.7-1.2 2.4-1.6 3.7-.6C6-2.7 5 .5 0 3.6Z');
          p.style.animationDelay = (i * 0.08).toFixed(2) + 's';
          g.appendChild(p);
          spawn(el, g, 1800);
        })(i);
      }
    }
    function motionLines(el) {
      for (var i = 0; i < 3; i++) {
        (function (i) {
          var p = document.createElementNS(NS, 'path');
          p.setAttribute('class', 'sb-line');
          p.setAttribute('d', 'M' + (66 + i * 3) + ' ' + (38 + i * 5) + 'h' + (5 - i));
          p.style.animationDelay = (i * 0.12).toFixed(2) + 's';
          spawn(el, p, 1600);
        })(i);
      }
    }

    /* ================= PERFORMANCES ================= */
    function startPerf(el, name) {
      if (!el || !el.dataset) return;
      if (el.dataset.sleep === '1' || PHASE[kindOf(el)] || el.dataset.pet === '1') return;
      clearTimeout(el.__perfT);
      delete el.dataset.perf;
      void el.getBoundingClientRect();
      el.dataset.perf = name;
      if (name === 'whistle' || name === 'hum') noteNodes(el);
      if (name === 'playful') sparkles(el, 4);
      if (name === 'wave') { sparkles(el, 2); motionLines(el); }
      el.__perfT = setTimeout(function () { delete el.dataset.perf }, PERF_MS[name] || 4000);
    }
    function perform(name) {
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        (function (el, i) {
          setTimeout(function () { startPerf(el, name) }, i * 240);
        })(avs[i], i);
      }
    }
    window.sbPerf = perform;
    window.sbState = function () {
      var out = [];
      document.querySelectorAll('.sb-av').forEach(function (el) {
        out.push({ kind: el.dataset.kind, mood: el.dataset.mood, sleep: el.dataset.sleep, perf: el.dataset.perf || '' });
      });
      return { avatars: out, phase: PHASE, night: isNight() };
    };

    /* Autonomous idle performances, every two minutes. */
    setInterval(function () {
      if (document.hidden) return;
      perform(PERFS[Math.floor(Math.random() * PERFS.length)]);
    }, 120000);

    /* ================= TAPS ================= */
    function nextLine(kind) {
      var i = sayAt[kind] || 0;
      sayAt[kind] = (i + 1) % SAY.length;
      clearTimeout(sayT[kind]);
      sayT[kind] = setTimeout(function () { sayAt[kind] = 0 }, 7000);
      return SAY[i];
    }
    function say(el, text) {
      var host = el.closest && (el.closest('.bcard') || el.closest('#ssBuddyHead'));
      if (!host) return;
      var b = host.querySelector('.sb-say');
      if (!b) {
        b = document.createElement('span');
        b.className = 'sb-say';
        b.setAttribute('aria-live', 'polite');
        host.appendChild(b);
      }
      b.textContent = text;
      b.classList.remove('on');
      void b.offsetWidth;
      b.classList.add('on');
    }
    function pet(el) {
      if (!el) return;
      var now = Date.now();
      if (el.__petAt && now - el.__petAt < 240) return;
      el.__petAt = now;

      clearTimeout(el.__perfT);
      delete el.dataset.perf;
      clearTimeout(el.__petT);
      el.dataset.pet = '1';
      el.classList.remove('sb-pet');
      void el.getBoundingClientRect();
      el.classList.add('sb-pet');
      hearts(el);

      var kind = kindOf(el);
      var said = nextLine(kind);
      say(el, said);

      var line = document.querySelector('#ssBuddyHead small');
      if (line) {
        var was = line.textContent;
        line.textContent = said;
        line.dataset.locked = '1';
        clearTimeout(line.__t);
        line.__t = setTimeout(function () {
          delete line.dataset.locked;
          line.textContent = was;
        }, 1600);
      }

      el.__petT = setTimeout(function () {
        delete el.dataset.pet;
        el.classList.remove('sb-pet');
      }, 1600);

      chirp();
      buzz(12);
    }

    /* ================= NOD WHEN A REPLY LANDS ================= */
    function nod(kind) {
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        var el = avs[i];
        if (kindOf(el) !== kind || el.dataset.sleep === '1') continue;
        clearTimeout(el.__perfT);
        delete el.dataset.perf;
        void el.getBoundingClientRect();
        el.dataset.perf = 'nod';
        el.__perfT = setTimeout(function (e) { return function () { delete e.dataset.perf } }(el), PERF_MS.nod);
      }
    }

    /* ================= STARTER CHIPS ================= */
    /* A starter fills the matching composer and sends it in one tap, so a first
       visitor starts with a real answer instead of an empty screen. */
    document.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('[data-chip]');
      if (!chip) return;
      var life = !!document.getElementById('lbask');
      var inp = document.getElementById(life ? 'lbask' : 'bask');
      if (!inp || inp.disabled) return;
      var text = chip.getAttribute('data-chip') || chip.textContent || '';
      if (!text) return;
      inp.value = text;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      try { (life ? window.askLifeBuddy : window.askStudyBuddy)(); } catch (err) {}
    });

    /* ================= SEND / TYPING HOOKS ================= */
    function listen(kind) {
      PHASE[kind] = 'listening';
      LISTEN_UNTIL[kind] = Date.now() + 900;
      sync();
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('#bsend,#lbsend');
      if (!b) return;
      var kind = b.id === 'lbsend' ? 'life' : 'study';
      var inp = document.getElementById(kind === 'life' ? 'lbask' : 'bask');
      if (inp && inp.value && inp.value.trim() && !inp.disabled) listen(kind);
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var id = e.target && e.target.id;
      if (id === 'bask' || id === 'lbask') {
        if (e.target.value && e.target.value.trim()) listen(id === 'lbask' ? 'life' : 'study');
      }
    }, true);
    document.addEventListener('input', function (e) { sync() }, true);
    document.addEventListener('focusin', function (e) { sync() }, true);
    document.addEventListener('focusout', function (e) { sync() }, true);

    /* ================= POINTER TRACKING ================= */
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

    setInterval(function () {
      if (Date.now() - lastMove < 3500) return;
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        if (Math.random() > 0.4) continue;
        avs[i].style.setProperty('--lx', (Math.random() * 1.4 - 0.7).toFixed(2));
        avs[i].style.setProperty('--ly', (Math.random() * 1.1 - 0.55).toFixed(2));
      }
    }, 4800);

    /* ================= BLINKING ================= */
    setInterval(function () {
      var avs = document.querySelectorAll('.sb-av');
      for (var i = 0; i < avs.length; i++) {
        var el = avs[i];
        if (el.dataset.sleep === '1' || el.dataset.perf) continue;
        if (Math.random() > 0.3) continue;
        (function (e) {
          e.classList.add('sb-blink');
          setTimeout(function () { e.classList.remove('sb-blink') }, 130);
        })(el);
      }
    }, 1600);

    /* ================= CLICK / KEY ================= */
    document.addEventListener('click', function (e) {
      var av = e.target.closest && e.target.closest('.sb-av');
      if (!av) return;
      if (!(av.closest('.bcard') || av.closest('#ssBuddyHead'))) return;
      e.preventDefault();
      e.stopPropagation();
      pet(av);
    }, true);

    document.addEventListener('keydown', function (e) {
      var av = e.target.closest && e.target.closest('#ssBuddyHead .sb-av');
      if (av && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        pet(av);
      }
    });

    /* ================= CHAT HEADER ================= */
    function mountHead() {
      var view = document.getElementById('view');
      if (!view) return;
      var t = typeof tab !== 'undefined' ? tab : '';
      var h = typeof hv !== 'undefined' ? hv : '';
      var kind = (t === 'acad' && h === 'buddy') ? 'study' : (t === 'life' && h === 'lifebuddy') ? 'life' : '';
      var old = document.getElementById('ssBuddyHead');

      if (!kind) { if (old) old.remove(); return }
      if (old) {
        if (old.dataset.kind === kind) { sync(); return }
        old.remove();
      }

      var head = document.createElement('div');
      head.id = 'ssBuddyHead';
      head.className = 'sb-head';
      head.dataset.kind = kind;
      head.style.setProperty('--bc', kind === 'study' ? 'var(--accent)' : '#c0793b');
      head.innerHTML = avatar(kind) +
        '<div class="sb-head-txt"><b>' + (kind === 'study' ? 'StudyBuddy' : 'LifeBuddy') +
        '</b><small>' + caption(kind) + '</small></div>' +
        '<span class="sb-pill"' + (kind === 'study' ? '' : ' hidden') + '>' + (kind === 'study' ? modeLabel() : '') + '</span>';

      var sub = view.querySelector('p.sub');
      if (sub && sub.parentNode === view) sub.insertAdjacentElement('afterend', head);
      else view.insertBefore(head, view.firstChild);

      var face = head.querySelector('.sb-av');
      if (face) {
        face.setAttribute('tabindex', '0');
        face.style.cursor = 'pointer';
      }
      sync();
    }

    /* ================= TICKER ================= */
    setInterval(function () {
      ['study', 'life'].forEach(function (k) {
        if (PHASE[k] === 'listening' && !busy(k) && Date.now() > LISTEN_UNTIL[k]) {
          PHASE[k] = '';
          nod(k);
        }
      });
      sync();

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
    }, 450);

    /* ================= RENDER HOOK ================= */
    function decorate() {
      try { mountHead() } catch (e) {}
      try { sync() } catch (e) {}
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
