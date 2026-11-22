/* StudySpace accounts: 3D-flip auth gate, first-run onboarding, private cloud
   sync and profile security. Loaded after the app so it can wrap save() and
   personalizeHTML(); everything is guarded so a failure never blocks the app. */
(function () {
  try {
    var API = typeof AI_WORKER_URL !== 'undefined' ? AI_WORKER_URL : '';
    var SKEY = 'studyspace-session';
    var OKEY = 'studyspace-owner';
    /* Device-local state is deliberately absent: icon theme, home-screen widget
       settings, quick-add position, floating notes and UI colours stay on the
       phone and are never uploaded or replaced by a login. */
    var SYNC_KEYS = ['subjects', 'tasks', 'sessions', 'exams', 'notes', 'decks', 'res', 'reviews', 'grades', 'wallet', 'journal', 'habits', 'sleep', 'stickies', 'home', 'theme', 'prof'];

    var st = { token: '', user: null, busy: false, syncing: false, last: 0, err: '', applying: false, onb: false };
    var syncT = null;
    var whyI = 0;
    var WHY = [
      {
        title: 'Personal AI Buddies',
        text: 'Meet StudyBuddy and LifeBuddy: one explains your lessons, the other listens when the day gets heavy.',
        icon: '<path d="M12 4.2c-4.6 0-8.3 3.1-8.3 7 0 2.2 1.2 4.1 3.2 5.4l-.6 3.2 3.3-2.1c.8.2 1.6.3 2.4.3 4.6 0 8.3-3.1 8.3-6.9S16.6 4.2 12 4.2Z"/><path d="M9 10.4h.01M15 10.4h.01M9.6 13.2c1.4 1.3 3.4 1.3 4.8 0"/>'
      },
      {
        title: 'Live Group Study',
        text: 'Voice-only study lounges for up to five classmates. No feeds, no cameras, just focus together.',
        icon: '<path d="M4 13a8 8 0 0 1 16 0"/><path d="M3 13h4v7H3zM17 13h4v7h-4z"/><path d="M12 21h2a3 3 0 0 0 3-3"/>'
      },
      {
        title: 'Smart Focus & Exams',
        text: 'Pomodoro sessions, live exam countdowns and a weekly streak that keeps your momentum honest.',
        icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.6 2M9 2h6"/>'
      },
      {
        title: 'Notes, Sticky Notes & Widgets',
        text: 'Pin a journal line or a reminder on your Home screen, and keep every subject note one tap away.',
        icon: '<path d="M5 4h14v10l-5 5H5z"/><path d="M14 19v-5h5M8.5 8.5h7M8.5 11.5h4.5"/>'
      }
    ];

    var ICON = {
      shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
      eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
      arrowL: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
      arrowR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
      book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.2c2.7-.9 5.4-.9 8 .6 2.6-1.5 5.3-1.5 8-.6v13c-2.7-.9-5.4-.9-8 .6-2.6-1.5-5.3-1.5-8-.6z"/><path d="M12 5.8v13"/></svg>',
      timer: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.4"/><path d="M12 9.2v4.2l2.4 1.8M9.5 3h5"/></svg>',
      spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
      note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h11v11l-5 5H4V9z"/><path d="M20 15h-5v5M7 8h6M7 11h4"/></svg>',
      head: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.8" y="13.2" width="4.4" height="7" rx="2.2"/><rect x="16.8" y="13.2" width="4.4" height="7" rx="2.2"/></svg>',
      trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M12 13v3M9 20h6"/></svg>',
      star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2L4.5 9.6l5.2-.7z"/></svg>',
      moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4 8.6 8.6 0 1 0 20 14.4Z"/></svg>'
    };

    var floats = '<div class="acc-floats" aria-hidden="true">' +
      '<span class="acc-float acc-f-book">' + ICON.book + '</span>' +
      '<span class="acc-float acc-f-timer">' + ICON.timer + '</span>' +
      '<span class="acc-float acc-f-spark">' + ICON.spark + '</span>' +
      '<span class="acc-float acc-f-note">' + ICON.note + '</span>' +
      '<span class="acc-float acc-f-head">' + ICON.head + '</span>' +
      '<span class="acc-float acc-f-trophy">' + ICON.trophy + '</span>' +
      '<span class="acc-float acc-f-star">' + ICON.star + '</span>' +
      '<span class="acc-float acc-f-moon">' + ICON.moon + '</span>' +
      '</div>';

    var brand = '<div class="acc-brand"><span class="acc-mark">' + ICON.book + '</span>StudySpace</div>';
    var legal = '<span>© 2026 StudySpace. All rights reserved.</span><button type="button" data-acc-legal>Privacy &amp; Terms</button>';

    /* ---------------- helpers ---------------- */
    function el(id) { return document.getElementById(id); }
    function show(node, on) { if (node) node.hidden = !on; }
    function lock(on) { document.documentElement.classList.toggle('acc-lock', !!on); }
    function loadSession() {
      try {
        var raw = JSON.parse(localStorage.getItem(SKEY) || 'null');
        if (raw && raw.token) return raw;
      } catch (e) {}
      return null;
    }
    function saveSession() {
      try {
        if (st.token) localStorage.setItem(SKEY, JSON.stringify({ token: st.token, user: st.user }));
        else localStorage.removeItem(SKEY);
      } catch (e) {}
    }
    function owner() { try { return localStorage.getItem(OKEY) || ''; } catch (e) { return ''; } }
    function setOwner(name) { try { localStorage.setItem(OKEY, name || ''); } catch (e) {} }
    function clearSession() {
      st.token = ''; st.user = null; st.err = ''; st.syncing = false;
      clearTimeout(syncT); saveSession();
    }
    function api(path, opts) {
      opts = opts || {};
      var headers = { 'Content-Type': 'application/json' };
      if (st.token) headers.Authorization = 'Bearer ' + st.token;
      return fetch(API + path, {
        method: opts.method || 'POST',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store'
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = {};
          try { data = JSON.parse(text) || {}; } catch (e) {}
          if (!res.ok) {
            var msg = (data.error && (data.error.message || data.error)) || ('Server error ' + res.status);
            var err = new Error(String(msg));
            err.status = res.status;
            err.code = data.error && data.error.code;
            throw err;
          }
          return data;
        });
      }, function () {
        var err = new Error('Could not reach the StudySpace server. Check your internet and try again.');
        err.network = true;
        throw err;
      });
    }
    function setMsg(node, text, ok) {
      if (!node) return;
      node.textContent = text || '';
      node.classList.toggle('ok', !!ok);
    }
    function busy(btn, on) {
      if (!btn) return;
      btn.disabled = !!on;
      btn.classList.toggle('busy', !!on);
    }
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    /* ---------------- auth screen ---------------- */
    function authHTML() {
      return floats +
        '<div class="acc-stage">' +
        brand +
        '<div class="acc-tabs" role="tablist" aria-label="Account">' +
        '<button type="button" class="on" data-acc-tab="in" role="tab" aria-selected="true">Sign In</button>' +
        '<button type="button" data-acc-tab="up" role="tab" aria-selected="false">Sign Up</button>' +
        '</div>' +
        '<div class="acc-flipwrap"><div class="acc-card" id="accCard">' +
        '<section class="acc-face acc-front" id="accFront" aria-label="Sign in">' +
        '<h1>Welcome back</h1>' +
        '<p class="acc-lede">Your notes, focus streaks and buddies, wherever you study.</p>' +
        '<form id="accIn" novalidate>' +
        '<label class="acc-field" for="accInUser">Username<input id="accInUser" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="24" placeholder="your.handle"></label>' +
        '<label class="acc-field" for="accInPass">Password<span class="acc-pass"><input id="accInPass" name="password" type="password" autocomplete="current-password" maxlength="128" placeholder="Your password"><button type="button" class="acc-eye" data-acc-eye="accInPass" aria-label="Show password">' + ICON.eye + '</button></span></label>' +
        '<p class="acc-msg" id="accInMsg" role="alert"></p>' +
        '<button class="acc-primary" id="accInGo" type="submit">Sign In</button>' +
        '</form>' +
        '<div class="acc-social"><span>Continue with Socials</span><small>Coming soon</small></div>' +
        '</section>' +
        '<section class="acc-face acc-back" id="accBack" aria-label="Create an account" aria-hidden="true">' +
        '<h1>Create your account</h1>' +
        '<p class="acc-lede">One account keeps your study in sync.</p>' +
        '<form id="accUp" novalidate>' +
        '<label class="acc-field" for="accUpUser">Username<input id="accUpUser" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="24" placeholder="letters, numbers, dots"></label>' +
        '<label class="acc-field" for="accUpPass">Password<span class="acc-pass"><input id="accUpPass" name="password" type="password" autocomplete="new-password" maxlength="128" placeholder="8 characters or more"><button type="button" class="acc-eye" data-acc-eye="accUpPass" aria-label="Show password">' + ICON.eye + '</button></span></label>' +
        '<label class="acc-field" for="accUpPass2">Confirm password<span class="acc-pass"><input id="accUpPass2" type="password" autocomplete="new-password" maxlength="128" placeholder="Type it again"><button type="button" class="acc-eye" data-acc-eye="accUpPass2" aria-label="Show password">' + ICON.eye + '</button></span></label>' +
        '<p class="acc-msg" id="accUpMsg" role="alert"></p>' +
        '<button class="acc-primary" id="accUpGo" type="submit">Create Account</button>' +
        '</form>' +
        '</section>' +
        '</div></div>' +
        '<footer class="acc-foot">' +
        '<p class="acc-trust">' + ICON.shield + 'Your details are encrypted and synced privately to your account.</p>' +
        '<p class="acc-legal">' + legal + '</p>' +
        '</footer>' +
        '</div>' +
        '<div class="acc-success" aria-hidden="true"><div class="acc-check">' + ICON.check + '</div></div>' +
        '<div class="acc-veil" id="accVeil" hidden><span class="acc-spin" aria-label="Loading"></span></div>';
    }

    function showAuth(notice) {
      var gate = el('accAuth');
      if (!gate) {
        gate = document.createElement('div');
        gate.id = 'accAuth';
        gate.className = 'acc-shell';
        gate.setAttribute('role', 'dialog');
        gate.setAttribute('aria-label', 'StudySpace account');
        gate.innerHTML = authHTML();
        document.body.appendChild(gate);
        wireGate(gate);
      }
      show(gate, true);
      show(el('accOnb'), false);
      lock(true);
      var veil = el('accVeil');
      if (veil) veil.hidden = true;
      setTab('in', true);
      var msg = el('accInMsg');
      if (msg) setMsg(msg, notice || '', false);
      setTimeout(function () { var u = el('accInUser'); if (u && innerWidth > 700) u.focus(); }, 80);
    }

    function hideAuth() {
      var gate = el('accAuth');
      if (!gate) return;
      gate.hidden = true;
      gate.classList.remove('ok');
      var dots = gate.querySelector('.acc-success');
      if (dots) dots.classList.remove('on');
      if (el('accOnb')) return;
      lock(false);
    }

    function setTab(which, instant) {
      var card = el('accCard');
      if (!card) return;
      var up = which === 'up';
      if (instant) card.style.transition = 'none';
      card.classList.toggle('flip', up);
      if (instant) { void card.offsetWidth; card.style.transition = ''; }
      var front = el('accFront'), back = el('accBack');
      if (front) { front.setAttribute('aria-hidden', up ? 'true' : 'false'); front.inert = up; }
      if (back) { back.setAttribute('aria-hidden', up ? 'false' : 'true'); back.inert = !up; }
      document.querySelectorAll('#accAuth [data-acc-tab]').forEach(function (b) {
        var on = b.getAttribute('data-acc-tab') === which;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      var focusId = up ? 'accUpUser' : 'accInUser';
      if (!instant && innerWidth > 700) setTimeout(function () { var f = el(focusId); if (f) f.focus(); }, 420);
    }

    function wireGate(gate) {
      gate.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-acc-tab]') || e.target.closest('[data-acc-goto]');
        if (tab) { setTab(tab.getAttribute('data-acc-tab') || tab.getAttribute('data-acc-goto')); return; }
        var eye = e.target.closest('[data-acc-eye]');
        if (eye) {
          var input = el(eye.getAttribute('data-acc-eye'));
          if (!input) return;
          var reveal = input.type === 'password';
          input.type = reveal ? 'text' : 'password';
          eye.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
          eye.classList.toggle('on', reveal);
          return;
        }
        if (e.target.closest('[data-acc-legal]')) { openLegal(); return; }
        if (e.target.closest('[data-acc-sheet-close]')) { closeSheet(); return; }
      });
      gate.addEventListener('submit', function (e) {
        if (e.target.id === 'accIn') { e.preventDefault(); submitAuth('in'); }
        else if (e.target.id === 'accUp') { e.preventDefault(); submitAuth('up'); }
      });
    }

    function submitAuth(mode) {
      if (st.busy) return;
      var up = mode === 'up';
      var user = (el(up ? 'accUpUser' : 'accInUser').value || '').trim().toLowerCase();
      var pass = el(up ? 'accUpPass' : 'accInPass').value || '';
      var msg = el(up ? 'accUpMsg' : 'accInMsg');
      var btn = el(up ? 'accUpGo' : 'accInGo');
      if (!/^[a-z0-9._]{3,24}$/.test(user)) {
        return setMsg(msg, 'Usernames are 3–24 characters: letters, numbers, dots or underscores.');
      }
      if (pass.length < 8) return setMsg(msg, 'Use at least 8 characters for your password.');
      if (up) {
        var again = el('accUpPass2').value || '';
        if (pass !== again) return setMsg(msg, 'The two passwords do not match.');
      }
      setMsg(msg, '');
      st.busy = true;
      busy(btn, true);
      api(up ? '/auth/signup' : '/auth/signin', { body: { username: user, password: pass } })
        .then(function (data) {
          st.busy = false;
          busy(btn, false);
          finishAuth(data);
        })
        .catch(function (err) {
          st.busy = false;
          busy(btn, false);
          setMsg(msg, err.message || 'Could not sign in. Please try again.');
        });
    }

    function finishAuth(data) {
      if (!data || !data.token || !data.user) return;
      st.token = data.token;
      st.user = data.user;
      saveSession();
      /* A different account on this device must not inherit the previous
         account's local study data when the cloud copy is empty. */
      var prev = owner();
      if (prev && prev !== data.user.username && !data.syncPayload) resetSynced();
      setOwner(data.user.username);
      if (data.syncPayload) applyPayload(data.syncPayload);
      st.last = data.updatedAt ? Number(data.updatedAt) : 0;
      var gate = el('accAuth');
      var ok = gate && gate.querySelector('.acc-success');
      if (gate) gate.classList.add('ok');
      if (ok) ok.classList.add('on');
      setTimeout(function () {
        if (gate) { gate.hidden = true; gate.classList.remove('ok'); }
        if (ok) ok.classList.remove('on');
        if (data.user.onboardingCompleted) {
          enterApp();
        } else {
          openOnboarding(data.user);
        }
      }, 760);
    }

    function expireSession() {
      clearSession();
      hideOnb();
      showAuth('Your session expired. Please sign in again.');
    }

    /* ---------------- onboarding ---------------- */
    var GRADES = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'College 1st Year', 'College 2nd Year', 'College 3rd Year', 'College 4th Year', 'Other'];

    function onbHTML(step) {
      var inner;
      if (step === 1) {
        var name = (st.user && st.user.displayName) || '';
        inner = '<div class="acc-ob-card" id="accObCard">' +
          '<span class="acc-ob-step"><i></i>Step 1 of 2</span>' +
          '<h1>Let’s set up your space</h1>' +
          '<p class="acc-ob-sub">Just the basics, so StudySpace greets you properly.</p>' +
          '<form id="accObForm" novalidate>' +
          '<div class="acc-ob-fields">' +
          '<label class="acc-field" for="accObName">First Name<input id="accObName" maxlength="30" autocomplete="given-name" placeholder="Alex" value="' + esc(name) + '"></label>' +
          '<label class="acc-field" for="accObAge">Age<input id="accObAge" type="number" inputmode="numeric" min="5" max="99" placeholder="17" value="' + (st.user && st.user.age ? esc(st.user.age) : '') + '"></label>' +
          '<label class="acc-field" for="accObGrade">Grade / Year Level<select id="accObGrade"><option value="">Choose your level</option>' +
          GRADES.map(function (g) {
            var sel = st.user && st.user.gradeLevel === g ? ' selected' : '';
            return '<option value="' + esc(g) + '"' + sel + '>' + esc(g) + '</option>';
          }).join('') + '</select></label>' +
          '</div>' +
          '<p class="acc-msg" id="accObMsg" role="alert"></p>' +
          '<div class="acc-ob-foot"><button class="acc-primary" id="accObGo" type="submit">Continue</button></div>' +
          '</form></div>';
      } else {
        inner = '<div class="acc-ob-card" id="accObCard">' +
          '<span class="acc-ob-step"><i></i>Step 2 of 2</span>' +
          '<h1>Why StudySpace?</h1>' +
          '<p class="acc-ob-sub">Four things that make studying feel lighter.</p>' +
          '<div class="acc-why">' +
          '<div class="acc-why-viewport"><div class="acc-why-track" id="accWhyTrack">' +
          WHY.map(function (w, i) {
            return '<article class="acc-why-card' + (i === 0 ? ' on' : '') + '" data-why="' + i + '">' +
              '<span class="acc-why-icon">' + '<svg viewBox="0 0 24 24" aria-hidden="true">' + w.icon + '</svg></span>' +
              '<h3>' + esc(w.title) + '</h3><p>' + esc(w.text) + '</p></article>';
          }).join('') +
          '</div></div>' +
          '<div class="acc-why-nav">' +
          '<button type="button" class="acc-arrow" id="accWhyPrev" aria-label="Previous card" disabled>' + ICON.arrowL + '</button>' +
          '<div class="acc-dots" id="accWhyDots">' + WHY.map(function (_, i) {
            return '<i class="' + (i === 0 ? 'on' : '') + '"></i>';
          }).join('') + '</div>' +
          '<button type="button" class="acc-arrow" id="accWhyNext" aria-label="Next card">' + ICON.arrowR + '</button>' +
          '</div>' +
          '</div></div>';
      }
      return floats + '<div class="acc-stage">' + brand + inner +
        '<footer class="acc-foot"><p class="acc-trust">' + ICON.shield + 'Your profile is saved to your private account.</p><p class="acc-legal">' + legal + '</p></footer></div>';
    }

    function openOnboarding(user) {
      hideAuth(true);
      var host = el('accOnb');
      if (!host) {
        host = document.createElement('div');
        host.id = 'accOnb';
        host.className = 'acc-shell';
        host.setAttribute('role', 'dialog');
        host.setAttribute('aria-label', 'Set up StudySpace');
        document.body.appendChild(host);
        host.addEventListener('click', function (e) {
          if (e.target.closest('[data-acc-legal]')) { openLegal(); return; }
          if (e.target.closest('[data-acc-sheet-close]')) { closeSheet(); return; }
          if (e.target.closest('#accWhyPrev')) return whyGo(-1);
          if (e.target.closest('#accWhyNext')) return whyI === WHY.length - 1 ? enterApp() : whyGo(1);
        });
        host.addEventListener('submit', function (e) {
          if (e.target.id === 'accObForm') { e.preventDefault(); saveProfile(); }
        });
      }
      whyI = 0;
      host.innerHTML = onbHTML(1);
      show(host, true);
      lock(true);
      setTimeout(function () {
        var n = el('accObName');
        if (n && innerWidth > 700) n.focus();
      }, 120);
    }

    function hideOnb() {
      var host = el('accOnb');
      if (host) host.hidden = true;
      if ((!el('accAuth') || el('accAuth').hidden)) lock(false);
    }

    function saveProfile() {
      if (st.busy) return;
      var nameEl = el('accObName'), ageEl = el('accObAge'), gradeEl = el('accObGrade'), msg = el('accObMsg'), btn = el('accObGo');
      var name = String(nameEl && nameEl.value || '').replace(/\s+/g, ' ').trim();
      var age = Number(ageEl && ageEl.value);
      var grade = gradeEl ? gradeEl.value : '';
      if (!name) return setMsg(msg, 'Please enter your first name.');
      if (!(age >= 5 && age <= 99)) return setMsg(msg, 'Please enter an age between 5 and 99.');
      if (!grade) return setMsg(msg, 'Please choose your grade or year level.');
      st.busy = true;
      busy(btn, true);
      setMsg(msg, '');
      api('/auth/onboarding', { body: { displayName: name, age: age, gradeLevel: grade } })
        .then(function (data) {
          st.busy = false;
          if (data.user) { st.user = data.user; saveSession(); }
          st.onb = true;
          S.prof = { name: name.slice(0, 30), age: age, level: grade, done: true };
          save();
          st.onb = false;
          showWhy();
        })
        .catch(function (err) {
          st.busy = false;
          busy(btn, false);
          setMsg(msg, err.message || 'Could not save your profile. Please try again.');
        });
    }

    function showWhy() {
      var host = el('accOnb');
      if (!host) return;
      whyI = 0;
      host.innerHTML = onbHTML(2);
      var next = el('accWhyNext');
      if (next) next.setAttribute('aria-label', 'Next card');
      paintWhy();
      /* The final next button becomes Enter StudySpace, so reset it here. */
    }

    function paintWhy() {
      var track = el('accWhyTrack');
      if (!track) return;
      track.style.transform = 'translateX(' + (-whyI * 100) + '%)';
      track.querySelectorAll('.acc-why-card').forEach(function (c, i) {
        c.classList.toggle('on', i === whyI);
        c.setAttribute('aria-hidden', i === whyI ? 'false' : 'true');
      });
      document.querySelectorAll('#accWhyDots i').forEach(function (d, i) {
        d.classList.toggle('on', i === whyI);
      });
      var prev = el('accWhyPrev'), next = el('accWhyNext');
      var last = whyI === WHY.length - 1;
      var nav = document.querySelector('#accOnb .acc-why-nav');
      if (nav) nav.classList.toggle('final', last);
      if (prev) prev.disabled = whyI === 0;
      if (next) {
        next.classList.toggle('acc-next-enter', last);
        next.innerHTML = last ? 'Enter StudySpace' : ICON.arrowR;
        next.setAttribute('aria-label', last ? 'Enter StudySpace' : 'Next card');
      }
    }

    function whyGo(dir) {
      var next = whyI + dir;
      if (next < 0 || next >= WHY.length) return;
      whyI = next;
      paintWhy();
    }

    function enterApp() {
      hideAuth(true);
      hideOnb();
      lock(false);
      if (st.user) {
        setOwner(st.user.username);
        var u = st.user;
        var p = S.prof && typeof S.prof === 'object' ? S.prof : {};
        var changed = false;
        if (u.displayName && p.name !== u.displayName) { p.name = u.displayName; changed = true; }
        if (u.age && Number(p.age) !== Number(u.age)) { p.age = u.age; changed = true; }
        if (u.gradeLevel && p.level !== u.gradeLevel) { p.level = u.gradeLevel; changed = true; }
        if (u.onboardingCompleted && !p.done) { p.done = true; changed = true; }
        S.prof = p;
        if (changed) save();
        st.err = '';
      }
      try { applyTheme(); } catch (e) {}
      try { applyUI(); } catch (e) {}
      try { render(); } catch (e) {}
      paintSync();
      if (st.token) setTimeout(function () { if (st.token && !st.last) syncNow(); }, 1400);
    }

    /* ---------------- sync ---------------- */
    function payloadData() {
      var data = {};
      SYNC_KEYS.forEach(function (k) { if (S[k] !== undefined) data[k] = S[k]; });
      return { v: 1, app: 'studyspace', data: data };
    }

    function applyPayload(payload) {
      if (!payload || !payload.data || typeof payload.data !== 'object') return false;
      st.applying = true;
      try {
        var data = payload.data;
        SYNC_KEYS.forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(data, k)) S[k] = data[k];
        });
        try { localStorage.setItem('studyspace1', JSON.stringify(S)); } catch (e) {}
        S = load();
        try { applyTheme(); } catch (e) {}
        try { applyUI(); } catch (e) {}
        save();
      } finally {
        st.applying = false;
      }
      return true;
    }

    function resetSynced() {
      var fresh = blank();
      SYNC_KEYS.forEach(function (k) { if (fresh[k] !== undefined) S[k] = fresh[k]; });
      try { localStorage.setItem('studyspace1', JSON.stringify(S)); } catch (e) {}
      S = load();
    }

    function queueSync() {
      if (!st.token || st.applying || st.onb) return;
      clearTimeout(syncT);
      syncT = setTimeout(function () { syncNow(); }, 1600);
    }

    function syncNow() {
      if (!st.token || st.syncing) return Promise.resolve(false);
      var payload;
      try {
        payload = payloadData();
        if (JSON.stringify(payload).length > 900000) {
          st.err = 'Too much data to sync (about 900 KB).';
          paintSync();
          return Promise.resolve(false);
        }
      } catch (e) {
        st.err = 'Could not prepare your data for sync.';
        paintSync();
        return Promise.resolve(false);
      }
      st.syncing = true;
      st.err = '';
      paintSync();
      return api('/sync', { body: { payload: payload } }).then(function (data) {
        st.syncing = false;
        st.last = Number(data.updatedAt) || Date.now();
        paintSync();
        return true;
      }, function (err) {
        st.syncing = false;
        if (err.status === 401 || err.code === 'auth') { expireSession(); return false; }
        st.err = err.network ? 'Sync paused — you are offline.' : 'Could not save to the cloud.';
        paintSync();
        return false;
      });
    }

    function syncText() {
      if (!st.token) return 'Not signed in';
      if (st.syncing) return 'Private cloud sync · saving…';
      if (st.err) return st.err;
      if (!st.last) return 'Private cloud sync is on';
      var mins = Math.floor((Date.now() - st.last) / 60000);
      if (mins < 1) return 'Private cloud sync · saved just now';
      if (mins < 60) return 'Private cloud sync · saved ' + mins + ' min ago';
      return 'Private cloud sync · saved ' + new Date(st.last).toLocaleDateString();
    }

    function paintSync() {
      var node = el('accSyncState');
      if (node) node.textContent = syncText();
      var note = el('accSyncNote');
      if (note) note.textContent = st.token ? 'Signed in as @' + ((st.user && st.user.username) || '') : 'Sign in to sync your data.';
    }

    function agoText() { return syncText(); }

    /* ---------------- profile security ---------------- */
    function securityHTML() {
      if (!st.token) {
        return '<h2>Security &amp; Privacy</h2><div class="card acc-sec"><div class="acc-status"><span class="acc-avatar">' + ICON.shield + '</span><div><b>Cloud account</b><small id="accSyncState">Not signed in</small></div></div><p class="acc-sec-note">Sign in to keep your subjects, notes and journal backed up privately.</p><div class="acc-sec-actions"><button class="ghost" data-acc-open-auth>Sign In</button></div></div>';
      }
      var username = (st.user && st.user.username) || '';
      return '<h2>Security &amp; Privacy</h2>' +
        '<div class="card acc-sec">' +
        '<div class="acc-status"><span class="acc-avatar">' + esc((username[0] || 'S').toUpperCase()) + '</span>' +
        '<div><b>@' + esc(username) + '</b><small id="accSyncState">' + esc(syncText()) + '</small></div>' +
        '<span class="acc-badge">' + ICON.shield + 'Encrypted</span></div>' +
        '<p class="acc-sec-note" id="accSyncNote">Signed in as @' + esc(username) + '. Your password is stored only as a PBKDF2 hash and your study data syncs privately to this account.</p>' +
        '<hr class="acc-hr">' +
        '<form id="accPwForm" novalidate>' +
        '<label class="acc-field" for="accPwCur">Current password<input id="accPwCur" type="password" autocomplete="current-password" maxlength="128" placeholder="Your current password"></label>' +
        '<label class="acc-field" for="accPwNew">New password<input id="accPwNew" type="password" autocomplete="new-password" maxlength="128" placeholder="8 characters or more"></label>' +
        '<label class="acc-field" for="accPw2">Confirm new password<input id="accPw2" type="password" autocomplete="new-password" maxlength="128" placeholder="Type it again"></label>' +
        '<p class="acc-msg" id="accPwMsg" role="alert"></p>' +
        '<button class="acc-primary" id="accPwGo" type="submit">Change Password</button>' +
        '</form>' +
        '<div class="acc-links"><button type="button" data-acc-legal>Privacy &amp; Data Protection Notice</button><button type="button" data-acc-legal>Copyright</button></div>' +
        '<div class="acc-sec-actions">' +
        '<button class="ghost" data-acc-signout>Sign Out</button>' +
        '<button class="acc-danger" data-acc-del>Delete Account</button>' +
        '</div></div>';
    }

    function changePassword(e) {
      e.preventDefault();
      if (st.busy) return;
      var cur = el('accPwCur'), next = el('accPwNew'), again = el('accPw2'), msg = el('accPwMsg'), btn = el('accPwGo');
      var a = cur.value || '', b = next.value || '';
      if (!a) return setMsg(msg, 'Enter your current password.');
      if (b.length < 8) return setMsg(msg, 'Use at least 8 characters for the new password.');
      if (b !== (again.value || '')) return setMsg(msg, 'The two new passwords do not match.');
      st.busy = true;
      busy(btn, true);
      setMsg(msg, '');
      api('/auth/change-password', { body: { currentPassword: a, newPassword: b } })
        .then(function () {
          st.busy = false;
          busy(btn, false);
          cur.value = ''; next.value = ''; again.value = '';
          setMsg(msg, 'Password changed. Use it the next time you sign in.', true);
        })
        .catch(function (err) {
          st.busy = false;
          busy(btn, false);
          setMsg(msg, err.message || 'Could not change your password.');
        });
    }

    function signOut() {
      if (st.busy) return;
      st.busy = true;
      var done = function () {
        st.busy = false;
        clearSession();
        closeSheet();
        hideOnb();
        var gate = el('accAuth');
        if (gate) { gate.remove(); }
        showAuth('You are signed out. Your study data is still on this device.');
        var card = el('accCard');
        if (card) card.classList.remove('flip');
      };
      if (st.token) syncNow().then(done, done); else done();
    }

    function deleteAccount(e) {
      e.preventDefault();
      if (st.busy) return;
      var passEl = el('accDelPass'), msg = el('accDelMsg'), btn = el('accDelGo');
      var pass = passEl ? passEl.value : '';
      if (!pass) return setMsg(msg, 'Enter your password to confirm.');
      st.busy = true;
      busy(btn, true);
      setMsg(msg, '');
      api('/auth/delete-account', { body: { password: pass } })
        .then(function () {
          st.busy = false;
          try {
            localStorage.removeItem('studyspace1');
            localStorage.removeItem('studyspace-lb');
            localStorage.removeItem('studyspace-assign');
            localStorage.removeItem(OKEY);
          } catch (x) {}
          S = load();
          clearSession();
          closeSheet();
          hideOnb();
          var gate = el('accAuth');
          if (gate) gate.remove();
          showAuth('Your account and cloud data were deleted.');
        })
        .catch(function (err) {
          st.busy = false;
          busy(btn, false);
          setMsg(msg, err.message || 'Could not delete the account.');
        });
    }

    function openDelete() {
      openSheet('<h2>Delete your account?</h2>' +
        '<p>This permanently deletes your account and every synced subject, task, note, exam and journal entry. This cannot be undone.</p>' +
        '<form id="accDelForm" novalidate>' +
        '<label class="acc-field" for="accDelPass">Password<input id="accDelPass" type="password" autocomplete="current-password" maxlength="128" placeholder="Confirm with your password"></label>' +
        '<p class="acc-msg" id="accDelMsg" role="alert"></p>' +
        '<div class="acc-sec-actions"><button type="submit" class="acc-danger" id="accDelGo">Delete my account forever</button>' +
        '<button type="button" class="acc-ghost" data-acc-sheet-close>Keep my account</button></div></form>');
      setTimeout(function () { var p = el('accDelPass'); if (p) p.focus(); }, 80);
    }

    function openLegal() {
      openSheet('<h2>Privacy &amp; Data Protection</h2>' +
        '<h3>What we store</h3><p>Your username, an encrypted password hash and the study data you choose to sync: subjects, class times, assignments, exams, focus sessions, notes, grades, wallet entries, habits, mood history and Daily Journal sticky notes.</p>' +
        '<h3>How it is protected</h3><p>Passwords are never stored in plain text. StudySpace uses PBKDF2-SHA256 with a random salt. Your session token is signed, lives only on this device and expires after 30 days.</p>' +
        '<h3>What stays on your phone</h3><p>Home-screen widgets, your custom app icon, quick-add position, floating notes and appearance colours are device-local and are never uploaded or overwritten by a login.</p>' +
        '<h3>Your choices</h3><p>You can sign out at any time, and you can permanently delete your account and all synced data from More → Profile → Security &amp; Privacy. Deletion removes the account and its cloud copy.</p>' +
        '<p>© 2026 StudySpace. All rights reserved.</p>' +
        '<button class="acc-primary" data-acc-sheet-close>Close</button>');
    }

    function openSheet(html) {
      var sheet = el('accSheet');
      if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'accSheet';
        sheet.className = 'acc-sheet';
        document.body.appendChild(sheet);
        sheet.addEventListener('click', function (e) {
          if (e.target.closest('[data-acc-sheet-close]') || e.target.classList.contains('acc-sheet-bk')) closeSheet();
        });
      }
      sheet.innerHTML = '<div class="acc-sheet-bk"></div><div class="acc-sheet-card" role="dialog" aria-modal="true"><button type="button" class="acc-sheet-x" data-acc-sheet-close aria-label="Close">×</button>' + html + '</div>';
      sheet.hidden = false;
      var card = sheet.querySelector('.acc-sheet-card');
      if (card) card.scrollTop = 0;
    }

    function closeSheet() {
      var sheet = el('accSheet');
      if (sheet) { sheet.hidden = true; sheet.innerHTML = ''; }
    }

    /* ---------------- boot ---------------- */
    function boot() {
      /* The old device-only welcome screen is replaced by the account flow. */
      var old = el('onb');
      if (old) old.remove();
      try { window.onboard = function () {}; } catch (e) {}

      var saved = loadSession();
      if (saved && saved.token) {
        st.token = saved.token;
        st.user = saved.user || null;
        showAuth('');
        var veil = el('accVeil');
        if (veil) veil.hidden = false;
        api('/sync', { method: 'GET' })
          .then(function (data) {
            if (data.user) { st.user = data.user; saveSession(); }
            if (data.syncPayload) applyPayload(data.syncPayload);
            st.last = Number(data.updatedAt) || 0;
            var veil2 = el('accVeil');
            if (veil2) veil2.hidden = true;
            if (st.user && st.user.onboardingCompleted) enterApp();
            else { hideAuth(true); openOnboarding(st.user || {}); }
          })
          .catch(function (err) {
            var veil3 = el('accVeil');
            if (veil3) veil3.hidden = true;
            if (err.status === 401 || err.code === 'auth') {
              clearSession();
              showAuth('Please sign in again.');
              return;
            }
            /* Offline: let a returning student keep working; sync resumes later. */
            st.err = 'Sync paused — you are offline.';
            if (st.user && st.user.onboardingCompleted) enterApp();
            else { hideAuth(true); openOnboarding(st.user || {}); }
            try { banner('You are offline. Cloud sync will resume when you reconnect.'); } catch (e) {}
          });
        return;
      }
      showAuth('');
    }

    /* ---------------- hooks ---------------- */
    try {
      var oldSave = window.save;
      window.save = function () {
        var out = oldSave.apply(this, arguments);
        if (st.token && !st.applying) queueSync();
        return out;
      };
    } catch (e) {}

    if (typeof window.personalizeHTML === 'function') {
      var oldPersonalize = window.personalizeHTML;
      window.personalizeHTML = function () {
        return oldPersonalize.apply(this, arguments) + securityHTML();
      };
    }

    document.addEventListener('submit', function (e) {
      if (e.target && e.target.id === 'accPwForm') changePassword(e);
      else if (e.target && e.target.id === 'accDelForm') deleteAccount(e);
    });
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-acc-legal]')) { openLegal(); return; }
      if (t.closest('[data-acc-sheet-close]')) { closeSheet(); return; }
      if (t.closest('[data-acc-signout]')) { signOut(); return; }
      if (t.closest('[data-acc-del]')) { openDelete(); return; }
      if (t.closest('[data-acc-open-auth]')) { showAuth(''); return; }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var sheet = el('accSheet');
        if (sheet && !sheet.hidden) { e.preventDefault(); closeSheet(); }
      }
    });
    window.addEventListener('online', function () { if (st.token) syncNow(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && st.token) {
        try {
          var payload = payloadData();
          fetch(API + '/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + st.token },
            body: JSON.stringify({ payload: payload }),
            keepalive: true
          }).catch(function () {});
        } catch (e) {}
      }
    });
    setInterval(paintSync, 8000);

    window.ssAccounts = {
      state: st,
      syncNow: syncNow,
      signOut: signOut,
      securityHTML: securityHTML
    };

    boot();
  } catch (err) {
    try { console.error('accounts layer failed', err); } catch (e) {}
  }
})();
