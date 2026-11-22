/* StudySpace social layer: profile customisation, Friends (inside Life),
   Chat + Pokes (inside Academics -> Communications), live study room invites,
   Customer Service, the developer Reports inbox and the Log Out flow.
   Loaded after accounts.js; every hook is guarded so a failure never stops
   the rest of the app from working. */
(function () {
  try {
    var API = typeof AI_WORKER_URL !== 'undefined' ? AI_WORKER_URL : '';
    var AV_KEYS = ['av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7', 'av8'];
    var BG_KEYS = ['sage', 'rose', 'ocean', 'sunset', 'lavender', 'mint', 'peach', 'midnight', 'starlight'];
    var BG_BTN = { sage: '#d5e6d8', rose: '#f3d3dc', ocean: '#cfe0f2', sunset: '#f8d3bd', lavender: '#e0d3f5', mint: '#c9ecdf', peach: '#f9d9c7', midnight: '#26303f', starlight: '#262544' };
    var BG_LABEL = { sage: 'Sage', rose: 'Rose', ocean: 'Ocean', sunset: 'Sunset', lavender: 'Lavender', mint: 'Mint', peach: 'Peach', midnight: 'Midnight', starlight: 'Starlight' };
    var CATS = ['Bug', 'Concern', 'Feedback', 'Suggestion'];

    var SVG = {
      poke: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.7 1.7 0 0 1 3.4 0V11M12.4 10.5V4.8a1.6 1.6 0 0 1 3.2 0v5.7M15.6 10.8V6.4a1.6 1.6 0 0 1 3.2 0V14a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.7-2.3L3 14.3a1.6 1.6 0 0 1 2.5-2l1.9 2"/></svg>',
      chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11h-9l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/></svg>',
      send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-3.2-6.6L4 12Z"/><path d="M20 4 10.8 13.4"/></svg>',
      back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
      add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
      close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
      heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
      users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8"/></svg>'
    };

    var st = {
      who: '', loaded: false, loading: false, error: '',
      friends: [], requests: [], counts: { friends: 0, requests: 0, unreadMessages: 0, unreadPokes: 0 },
      search: '', results: null, searching: false,
      profile: null,
      tab: 'messages', thread: null, threadFriend: null, messages: [], msgLoaded: false, msgLoading: false,
      threads: null, threadsLoading: false,
      pokes: null, pokesLoading: false,
      reports: null, reportsLoading: false,
      cat: 'Bug', supportMsg: '', supportNote: '',
      inviteOpen: null, inviteReason: '',
      pending: {},
      seenInvite: {}, sentSeen: {},
      countsAt: 0, msgAt: 0, sentAt: 0, inviteAt: 0
    };

    /* ---------------- small helpers ---------------- */
    function acc() { try { return window.ssAccounts || null; } catch (e) { return null } }
    function token() { var a = acc(); return (a && a.state && a.state.token) || ''; }
    function me() { var a = acc(); return (a && a.state && a.state.user) || null; }
    function username() { var u = me(); return (u && u.username) || ''; }
    function isDev() { var u = me(); return !!u && String(u.role || '').toUpperCase() === 'DEV'; }
    function isOwnerDev() { return username() === 'urdevjaja'; }
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function q(id) { return document.getElementById(id); }
    function isTyping() {
      var a = document.activeElement;
      return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    }
    function fmtTime(ts) {
      try {
        var d = new Date(Number(ts) || Date.now());
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } catch (e) { return ''; }
    }
    function fmtDay(ts) {
      try {
        var d = new Date(Number(ts) || Date.now());
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + fmtTime(ts);
      } catch (e) { return ''; }
    }
    function ago(ts) {
      var s = Math.max(0, Math.floor((Date.now() - (Number(ts) || 0)) / 1000));
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + ' min ago';
      if (s < 86400) return Math.floor(s / 3600) + ' h ago';
      return Math.floor(s / 86400) + ' d ago';
    }
    function focusText(min) {
      min = Number(min) || 0;
      if (min >= 60) {
        var h = min / 60;
        return (h >= 10 ? Math.round(h) : Math.round(h * 10) / 10) + 'h';
      }
      return min + 'm';
    }
    function initials(name) {
      var s = String(name || '?').trim().replace(/^@/, '');
      var parts = s.split(/[\s._-]+/).filter(Boolean);
      if (!parts.length) return '?';
      return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    }
    function avInner(p) {
      p = p || {};
      var av = String(p.avatar || '');
      if (/^data:image\//.test(av)) return '<img src="' + esc(av) + '" alt="">';
      var m = /^av([1-8])$/.exec(av);
      var label = initials(p.displayName || p.username);
      if (m) return '<span class="ss-av-g av' + m[1] + '">' + esc(label) + '</span>';
      return '<span class="ss-av-g ss-av-plain">' + esc(label) + '</span>';
    }
    function avatarHTML(p, cls) {
      return '<span class="ss-avatar ' + (cls || '') + '">' + avInner(p) + '</span>';
    }
    function devBadge(p) {
      if (!p || String(p.role || '').toUpperCase() !== 'DEV') return '';
      return '<span class="ss-dev' + (p.username === 'urdevkk' ? ' kk' : '') + '">DEV</span>';
    }
    function statBox(v, l) {
      return '<div><b>' + esc(v) + '</b><small>' + esc(l) + '</small></div>';
    }
    function bgClass(p) {
      var key = String((p && p.bg) || 'sage');
      return 'ss-bg-' + (BG_KEYS.indexOf(key) >= 0 ? key : 'sage');
    }
    /* urdevkk keeps the rose-gold look unless she picks a different background. */
    function kkClass(p) {
      if (!p || p.username !== 'urdevkk') return '';
      var bg = String(p.bg || '');
      return (!bg || bg === 'rose') ? ' kk' : '';
    }
    function heartsHTML() {
      return '<div class="ss-hearts" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b><b></b><b></b></div>';
    }

    function api(path, opts) {
      opts = opts || {};
      var headers = { 'Content-Type': 'application/json' };
      var t = token();
      if (t) headers.Authorization = 'Bearer ' + t;
      return fetch(API + path, {
        method: opts.method || 'GET',
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
        var err = new Error('Could not reach the StudySpace server.');
        err.network = true;
        throw err;
      });
    }

    /* ---------------- navigation + refresh ---------------- */
    function swap() {
      try {
        var v = q('view');
        if (!v) return;
        v.classList.remove('ss-swap');
        void v.offsetWidth;
        v.classList.add('ss-swap');
        clearTimeout(swap._t);
        swap._t = setTimeout(function () { v.classList.remove('ss-swap'); }, 460);
      } catch (e) {}
    }
    function nav(t, h) {
      try {
        tab = t; hv = h; curSub = null; L = null; moreSub = '';
        render();
        var v = q('view');
        if (v) v.scrollTop = 0;
        swap();
      } catch (e) {}
    }
    function inSocial() {
      try {
        if (tab === 'life' && (hv === 'friends' || hv === 'friend')) return true;
        if (tab === 'acad' && hv === 'chat') return true;
        if (tab === 'more' && (moreSub === 'support' || moreSub === 'reports')) return true;
      } catch (e) {}
      return false;
    }
    function refresh() {
      if (inSocial() && !isTyping()) { try { render(); } catch (e) {} }
      else paintCounts();
    }

    function unreadCount() { return (st.counts.unreadMessages || 0) + (st.counts.unreadPokes || 0); }
    function friendCount() { return st.friends.length || st.counts.friends || 0; }
    function requestCount() { return st.requests.length || st.counts.requests || 0; }

    function paintCounts() {
      try {
        var n = unreadCount();
        var tile = document.querySelector('.sschat');
        if (tile) {
          var b = tile.querySelector('.ss-tile-badge');
          if (n > 0) {
            if (!b) { b = document.createElement('span'); b.className = 'ss-tile-badge'; tile.appendChild(b); }
            var txt = n > 99 ? '99+' : String(n);
            if (b.textContent !== txt) b.textContent = txt;
          } else if (b) b.remove();
        }
        var sub = document.querySelector('.tile[data-mod="friends"] small');
        if (sub && st.loaded && typeof friendsSub === 'function') {
          var f = friendsSub();
          if (sub.textContent !== f) sub.textContent = f;
        }
      } catch (e) {}
    }

    /* ---------------- data loading ---------------- */
    function loadFriends(force) {
      if (!token()) return Promise.resolve();
      if (st.loading) return Promise.resolve();
      if (st.loaded && !force) return Promise.resolve();
      st.loading = true;
      return api('/friends').then(function (d) {
        st.loading = false;
        st.loaded = true;
        st.error = '';
        st.friends = d.friends || [];
        st.requests = d.requests || [];
        st.counts = d.counts || st.counts;
        paintCounts();
        refresh();
      }, function (err) {
        st.loading = false;
        if (err.status === 401) return;
        st.error = err.message || 'Could not load your friends.';
        refresh();
      });
    }
    function loadThreads(force) {
      if (!token()) return Promise.resolve();
      if (st.threadsLoading) return Promise.resolve();
      if (st.threads && !force) return Promise.resolve();
      st.threadsLoading = true;
      return api('/chat/threads').then(function (d) {
        st.threadsLoading = false;
        st.threads = d.threads || [];
        refresh();
      }, function () { st.threadsLoading = false; st.threads = st.threads || []; refresh(); });
    }
    function loadMessages(friendId, silent) {
      if (!token() || !friendId) return Promise.resolve();
      if (st.msgLoading) return Promise.resolve();
      st.msgLoading = true;
      return api('/chat/messages?friendId=' + encodeURIComponent(friendId)).then(function (d) {
        st.msgLoading = false;
        st.threadFriend = d.friend || st.threadFriend;
        st.msgLoaded = true;
        applyMessages(d.messages || [], silent);
        loadFriends(true);
        if (st.threads) st.threads = null;
      }, function (err) {
        st.msgLoading = false;
        st.msgLoaded = true;
        if (err.status !== 401) banner(err.message || 'Could not load this chat.');
        refresh();
      });
    }
    function applyMessages(list, silent) {
      var same = list.length === st.messages.length;
      if (same) {
        for (var i = 0; i < list.length; i++) { if (list[i].id !== st.messages[i].id) { same = false; break; } }
      }
      if (same) return;
      var inp = q('ssChatInput');
      var val = inp ? inp.value : '';
      var hadFocus = inp && document.activeElement === inp;
      st.messages = list;
      try { render(); } catch (e) {}
      var next = q('ssChatInput');
      if (next) {
        if (val) next.value = val;
        if (hadFocus) next.focus();
      }
      scrollChat();
      if (!silent) paintCounts();
    }
    function loadPokes() {
      if (!token()) return Promise.resolve();
      if (st.pokesLoading) return Promise.resolve();
      st.pokesLoading = true;
      return api('/chat/pokes').then(function (d) {
        st.pokesLoading = false;
        st.pokes = d.pokes || [];
        st.counts.unreadPokes = 0;
        paintCounts();
        refresh();
      }, function () { st.pokesLoading = false; st.pokes = st.pokes || []; refresh(); });
    }
    function loadReports(force) {
      if (!token()) return Promise.resolve();
      if (st.reportsLoading) return Promise.resolve();
      if (st.reports && !force) return Promise.resolve();
      st.reportsLoading = true;
      return api('/reports/list').then(function (d) {
        st.reportsLoading = false;
        st.reports = d.reports || [];
        refresh();
      }, function (err) {
        st.reportsLoading = false;
        st.reports = st.reports || [];
        if (err.status !== 403) banner(err.message || 'Could not load reports.');
        refresh();
      });
    }
    function syncOwnProfile() {
      var u = me();
      if (!u || !u.id || typeof S === 'undefined') return;
      api('/friends/profile?id=' + encodeURIComponent(u.id)).then(function (d) {
        var prof = d.profile;
        if (!prof) return;
        if (!S.prof || typeof S.prof !== 'object') S.prof = { name: '', age: '', level: '', done: false };
        var p = S.prof, changed = false;
        if (prof.avatar && p.avatar !== prof.avatar) { p.avatar = prof.avatar; changed = true; }
        if (prof.bg && p.bg !== prof.bg) { p.bg = prof.bg; changed = true; }
        if (prof.displayName && !p.name) { p.name = prof.displayName; changed = true; }
        if (changed) { try { save(); } catch (e) {} refresh(); }
      }, function () {});
    }

    /* ---------------- profile customisation ---------------- */
    function selfProfile() {
      var u = me() || {};
      var p = (typeof S !== 'undefined' && S.prof) || {};
      return {
        id: u.id || '',
        username: u.username || '',
        displayName: p.name || u.displayName || u.username || 'StudySpace',
        role: String(u.role || 'USER').toUpperCase(),
        avatar: p.avatar || u.avatar || '',
        bg: p.bg || u.bg || 'sage'
      };
    }

    function profileHero() {
      var p = selfProfile();
      var open = 0, focus = 0, days = 0;
      try {
        focus = typeof focusToday === 'function' ? focusToday() : 0;
        days = typeof streak === 'function' ? streak() : 0;
        open = S.tasks.filter(function (t) { return !t.done; }).length;
      } catch (e) {}
      var kk = p.username === 'urdevkk';
      var activeBg = BG_KEYS.indexOf(String(p.bg)) >= 0 ? p.bg : 'sage';
      var h = '<div class="ss-prof ' + bgClass(p) + kkClass(p) + '">' + (kk ? heartsHTML() : '') +
        '<div class="ss-prof-top">' + avatarHTML(p, 'lg') +
        '<div class="ss-prof-id"><b>' + esc(p.displayName) + devBadge(p) + '</b><small>@' + esc(p.username || 'studyspace') + (kk ? ' · rose gold' : '') + '</small></div></div>' +
        '<div class="ss-prof-stats">' + statBox(focus, 'Focused time') + statBox(days, 'Day streak') + statBox(open, 'Tasks open') + '</div>' +
        '<div class="ss-prof-tools">' +
        '<span class="ss-lbl">Profile picture</span><div class="ss-avpick">' +
        AV_KEYS.map(function (k, i) {
          var on = String(p.avatar || '') === k;
          return '<button type="button" class="ss-av-g ' + k + (on ? ' on' : '') + '" data-ss-avatar="' + k + '" aria-label="Avatar ' + (i + 1) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(initials(p.displayName)) + '</button>';
        }).join('') +
        '<button type="button" class="ss-btn ghost" data-ss-avup style="height:36px;min-height:36px">Upload photo</button>' +
        '</div>' +
        '<input id="ssAvFile" type="file" accept="image/*" hidden>' +
        '<span class="ss-lbl">Profile background</span><div class="ss-bgpick">' +
        BG_KEYS.map(function (k) {
          var on = activeBg === k;
          return '<button type="button" class="ss-bg-' + k + (on ? ' on' : '') + '" data-ss-bg="' + k + '" aria-label="' + BG_LABEL[k] + ' background" aria-pressed="' + (on ? 'true' : 'false') + '"></button>';
        }).join('') +
        '</div></div></div>';
      return h;
    }

    function setProf(patch) {
      if (typeof S === 'undefined') return;
      if (!S.prof || typeof S.prof !== 'object') S.prof = { name: '', age: '', level: '', done: false };
      if (patch.avatar !== undefined) S.prof.avatar = patch.avatar;
      if (patch.bg !== undefined) S.prof.bg = patch.bg;
      try { save(); } catch (e) {}
      if (inSocial() || (tab === 'more' && moreSub === 'profile')) { try { render(); } catch (e) {} }
      else paintCounts();
      api('/profile/update', { method: 'POST', body: patch }).then(function (d) {
        if (d.user && acc() && acc().state) acc().state.user = d.user;
      }, function (err) { banner(err.message || 'Could not save your profile.'); });
    }

    function shrinkPhoto(file) {
      return new Promise(function (ok, no) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () {
          try {
            var k = Math.min(1, 320 / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * k));
            c.height = Math.max(1, Math.round(img.height * k));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            var data = c.toDataURL('image/jpeg', .72);
            URL.revokeObjectURL(url);
            ok(data);
          } catch (e) { URL.revokeObjectURL(url); no(e); }
        };
        img.onerror = function () { URL.revokeObjectURL(url); no(new Error('That photo could not be read.')); };
        img.src = url;
      });
    }

    /* ---------------- friends view (Life) ---------------- */
    function signInNotice() {
      return '<h1>Friends</h1><p class="sub">Study together</p><div class="card"><p class="ss-empty">Sign in to add friends, send pokes and chat.</p><button class="ss-btn" data-acc-open-auth style="min-height:44px;width:100%">Sign In</button></div>';
    }

    function friendRow(f) {
      return '<button type="button" class="ss-row tap" data-ss-openfriend="' + esc(f.id) + '">' +
        avatarHTML(f) +
        '<span class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b>' +
        '<small>@' + esc(f.username) + (f.stats ? ' · ' + focusText(f.stats.focus) + ' focused · ' + (Number(f.stats.streak) || 0) + '-day streak' : '') + '</small></span>' +
        '<span class="ss-iconbtn chat" style="pointer-events:none">' + SVG.chat + '</span></button>';
    }

    function requestRow(r) {
      var f = r.from || {};
      return '<div class="ss-row">' + avatarHTML(f) +
        '<div class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b><small>@' + esc(f.username) + ' · ' + ago(r.createdAt) + '</small></div>' +
        '<div class="ss-act"><button type="button" class="ss-btn" data-ss-accept="' + esc(r.id) + '">Accept</button>' +
        '<button type="button" class="ss-btn ghost" data-ss-decline="' + esc(r.id) + '">Decline</button></div></div>';
    }

    function resultsHTML() {
      if (st.searching) return '<p class="ss-empty">Searching…</p>';
      if (!st.results) return '<p class="ss-empty">Type at least 2 letters of a username.</p>';
      if (!st.results.length) return '<p class="ss-empty">No account matches “' + esc(st.search) + '”.</p>';
      return st.results.map(function (f) {
        return '<div class="ss-row">' + avatarHTML(f) +
          '<div class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b><small>@' + esc(f.username) + '</small></div>' +
          (f.friend
            ? '<span class="ss-chip">Friend</span>'
            : f.pending || st.pending[f.username]
              ? '<span class="ss-chip">Requested</span>'
              : f.incoming
                ? '<span class="ss-chip">Check requests</span>'
                : '<button type="button" class="ss-btn" data-ss-add="' + esc(f.username) + '">Add</button>') + '</div>';
      }).join('');
    }

    function friendProfileView() {
      var f = st.profile;
      if (!f) return friendsView();
      var kk = f.username === 'urdevkk';
      var stats = f.stats || { focus: 0, streak: 0, open: 0 };
      return '<button class="ghost" data-ss-backfriends style="width:auto;padding:6px 14px;margin-bottom:10px">‹ Friends</button>' +
        '<div class="ss-fprofile ' + bgClass(f) + kkClass(f) + '">' + (kk ? heartsHTML() : '') +
        '<div class="ss-fp-head">' + avatarHTML(f, 'lg') +
        '<div class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b><small>@' + esc(f.username) + '</small></div></div>' +
        '<div class="ss-prof-stats">' + statBox(focusText(stats.focus), 'Focused time') + statBox(Number(stats.streak) || 0, 'Day streak') + statBox(Number(stats.open) || 0, 'Tasks open') + '</div>' +
        '<div class="ss-act">' +
        '<button type="button" class="ss-iconbtn poke" data-ss-poke="' + esc(f.id) + '" aria-label="Poke ' + esc(f.displayName || f.username) + '" title="Poke">' + SVG.poke + '</button>' +
        '<button type="button" class="ss-iconbtn chat" data-ss-chat="' + esc(f.id) + '" aria-label="Chat with ' + esc(f.displayName || f.username) + '" title="Chat">' + SVG.chat + '</button>' +
        '</div><p class="ss-hint">Poke to say hi, or open a private chat.</p></div>';
    }

    function friendsView() {
      if (!token()) return signInNotice();
      if (st.profile) return friendProfileView();
      loadFriends();
      var h = '<h1>Friends</h1><p class="sub">Add classmates, send pokes and start a chat</p>';
      h += '<div class="card"><div class="ss-row" style="padding-top:0"><div class="ss-who"><b>Friend Requests ' +
        (st.requests.length ? '<span class="ss-chip">' + st.requests.length + ' pending</span>' : '') +
        '</b><small>People who want to study with you</small></div></div>' +
        (st.requests.length ? st.requests.map(requestRow).join('') : '<p class="ss-empty">' + (st.loading ? 'Loading…' : 'No pending requests.') + '</p>') + '</div>';
      h += '<div class="card" style="margin-top:12px"><b>Find friends</b><div class="ss-search">' +
        '<input id="ssFriendQ" placeholder="Search by username" maxlength="24" value="' + esc(st.search) + '" autocapitalize="none" autocomplete="off" spellcheck="false">' +
        '<button type="button" class="ss-btn" data-ss-search>Search</button></div><div id="ssResults">' + resultsHTML() + '</div>' +
        (st.error ? '<p class="ss-empty" style="color:#b23b3b">' + esc(st.error) + '</p>' : '') + '</div>';
      h += '<div class="lbl">My Friends</div><div class="card">' +
        (st.friends.length ? st.friends.map(friendRow).join('') :
          '<p class="ss-empty">No friends yet. Search for a username above, or share yours: <b>@' + esc(username()) + '</b></p>') + '</div>';
      h += '<p class="ss-friend-code">Your username is @' + esc(username()) + '. Friends can find you with it.</p>';
      return h;
    }

    function openFriendProfile(id) {
      var cached = st.friends.filter(function (f) { return f.id === id; })[0] || null;
      if (cached) { st.profile = cached; nav('life', 'friend'); }
      api('/friends/profile?id=' + encodeURIComponent(id)).then(function (d) {
        st.profile = d.profile || cached;
        if (cached) refresh(); else nav('life', 'friend');
      }, function (err) {
        banner(err.message || 'Could not open that profile.');
        if (cached) nav('life', 'friend');
      });
    }

    /* ---------------- chat view (Academics -> Communications) ---------------- */
    function threadsPanel() {
      loadFriends();
      loadThreads(false);
      var friends = st.friends;
      var h = '<div class="card"><b>New chat</b><div class="ss-hint" style="color:var(--muted);font-size:11.5px;margin-top:2px">Choose a friend to message</div>' +
        (friends.length ? '<div class="ss-pick">' + friends.map(function (f) {
          return '<button type="button" data-ss-chat="' + esc(f.id) + '">' + avatarHTML(f, 'sm') + '<span>' + esc(f.displayName || f.username) + '</span></button>';
        }).join('') + '</div>' : '<p class="ss-empty">Add friends in Life → Friends first.</p>' +
          '<button type="button" class="ss-btn ghost" style="margin-top:10px" data-ss-gofriends>Open Friends</button>') + '</div>';
      h += '<div class="lbl">Conversations</div><div class="card">';
      if (!st.threads) h += '<p class="ss-empty">Loading conversations…</p>';
      else if (!st.threads.length) h += '<p class="ss-empty">No conversations yet. Pick a friend above to say hello.</p>';
      else h += st.threads.map(function (t) {
        var f = t.friend || {};
        var preview = t.last ? (t.last.mine ? 'You: ' : '') + t.last.text : 'Say hello';
        return '<button type="button" class="ss-row tap" data-ss-chat="' + esc(f.id) + '">' + avatarHTML(f) +
          '<span class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b><small>' + esc(preview) + '</small></span>' +
          (t.unread ? '<span class="ss-count" style="min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#c2410c;color:#fff;font-size:10.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">' + t.unread + '</span>'
            : '<span style="color:var(--muted);font-size:10.5px">' + fmtTime(t.at) + '</span>') + '</button>';
      }).join('');
      h += '</div>';
      return h;
    }

    function threadPanel() {
      var f = st.threadFriend || st.friends.filter(function (x) { return x.id === st.thread; })[0] || { id: st.thread, username: 'friend', displayName: 'Friend' };
      if (!st.msgLoaded) loadMessages(st.thread);
      var bubbles = st.messages.length ? st.messages.map(function (m) {
        return '<div class="ss-bub ' + (m.mine ? 'mine' : 'theirs') + '">' + esc(m.text) + '<span class="ss-time">' + esc(fmtTime(m.createdAt)) + '</span></div>';
      }).join('') : '<p class="ss-empty" style="margin:auto;text-align:center">' + (st.msgLoaded ? 'No messages yet. Say hello to @' + esc(f.username) + '.' : 'Loading messages…') + '</p>';
      setTimeout(scrollChat, 30);
      return '<div class="card"><div class="ss-thread-head">' +
        '<button type="button" class="ss-iconbtn" data-ss-threadback aria-label="Back to conversations">' + SVG.back + '</button>' +
        avatarHTML(f, 'sm') +
        '<div class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b><small>@' + esc(f.username) + '</small></div>' +
        '<button type="button" class="ss-iconbtn poke" data-ss-poke="' + esc(f.id) + '" aria-label="Poke ' + esc(f.displayName || f.username) + '">' + SVG.poke + '</button></div>' +
        '<div class="ss-chat-scroll" id="ssChatScroll">' + bubbles + '</div>' +
        '<form class="ss-composer" data-ss-chatform><input id="ssChatInput" placeholder="Message @' + esc(f.username) + '" maxlength="2000" autocomplete="off" enterkeyhint="send">' +
        '<button type="submit" aria-label="Send message">' + SVG.send + '</button></form></div>';
    }

    function pokesPanel() {
      if (!st.pokes) loadPokes();
      var h = '<div class="card ss-pokes">';
      if (!st.pokes) h += '<p class="ss-empty">Loading pokes…</p>';
      else if (!st.pokes.length) h += '<p class="ss-empty">No pokes yet. Poke a friend from their profile in Life → Friends.</p>';
      else h += st.pokes.map(function (p) {
        var f = p.sender || {};
        return '<div class="ss-row">' + avatarHTML(f) +
          '<div class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b><small>' + esc(f.displayName || f.username) + ' poked you · ' + ago(p.createdAt) + '</small></div>' +
          '<div class="ss-act"><button type="button" class="ss-iconbtn poke" data-ss-poke="' + esc(f.id) + '" aria-label="Poke back">' + SVG.poke + '</button>' +
          '<button type="button" class="ss-iconbtn chat" data-ss-chat="' + esc(f.id) + '" aria-label="Chat with ' + esc(f.displayName || f.username) + '">' + SVG.chat + '</button></div></div>';
      }).join('');
      h += '</div>';
      return h;
    }

    function chatView() {
      if (!token()) {
        return '<h1>Chat</h1><p class="sub">Messages and pokes</p><div class="card"><p class="ss-empty">Sign in to chat with your friends.</p><button class="ss-btn" data-acc-open-auth style="min-height:44px;width:100%">Sign In</button></div>';
      }
      loadFriends();
      var unread = st.counts.unreadPokes || 0;
      var h = '<h1>Chat</h1><p class="sub">Messages and pokes from your friends</p>' +
        '<div class="ss-tabs"><button type="button" data-ss-chattab="messages" class="' + (st.tab !== 'pokes' ? 'on' : '') + '">Messages</button>' +
        '<button type="button" data-ss-chattab="pokes" class="' + (st.tab === 'pokes' ? 'on' : '') + '">Pokes' +
        (unread ? '<span class="ss-count">' + (unread > 99 ? '99+' : unread) + '</span>' : '') + '</button></div>';
      if (st.tab === 'pokes') return h + pokesPanel();
      if (st.thread) return h + threadPanel();
      return h + threadsPanel();
    }

    function openFriendChat(id) {
      if (!id) return;
      var f = st.friends.filter(function (x) { return x.id === id; })[0] || null;
      st.thread = id;
      st.threadFriend = f;
      st.messages = [];
      st.msgLoaded = false;
      st.tab = 'messages';
      nav('acad', 'chat');
      loadMessages(id);
    }

    function scrollChat() {
      try {
        var sc = q('ssChatScroll');
        if (sc) sc.scrollTop = sc.scrollHeight;
      } catch (e) {}
    }

    function sendMessage() {
      var inp = q('ssChatInput');
      var text = inp ? String(inp.value || '').trim() : '';
      if (!text || !st.thread) return;
      if (inp) { inp.value = ''; }
      var temp = { id: 'tmp' + Date.now(), fromId: (me() || {}).id, toId: st.thread, text: text, createdAt: Date.now(), mine: true };
      st.messages = st.messages.concat([temp]);
      try { render(); } catch (e) {}
      scrollChat();
      api('/chat/send', { method: 'POST', body: { friendId: st.thread, text: text } }).then(function (d) {
        var msg = d.message || temp;
        st.messages = st.messages.map(function (m) { return m.id === temp.id ? msg : m; });
        st.threads = null;
        try { render(); } catch (e) {}
        scrollChat();
      }, function (err) {
        st.messages = st.messages.filter(function (m) { return m.id !== temp.id; });
        if (inp) inp.value = text;
        banner(err.message || 'Could not send that message.');
        try { render(); } catch (e) {}
      });
    }

    function poke(friendId, btn) {
      if (!friendId) return;
      var f = st.friends.filter(function (x) { return x.id === friendId; })[0] || st.profile || {};
      if (btn) {
        btn.classList.remove('pulse');
        void btn.offsetWidth;
        btn.classList.add('pulse');
      }
      try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
      api('/chat/poke', { method: 'POST', body: { friendId: friendId } }).then(function () {
        banner('You poked ' + (f.displayName || f.username || 'your friend') + '!');
      }, function (err) {
        banner(err.message || 'Could not poke right now.');
      });
    }

    /* ---------------- customer service + reports ---------------- */
    function supportHTML() {
      var h = '<h1>Customer Service</h1><p class="sub">Tell the StudySpace developers what is on your mind</p><div class="card"><b>What is this about?</b><div class="ss-cats">' +
        CATS.map(function (c) {
          return '<button type="button" class="' + (st.cat === c ? 'on' : '') + '" data-ss-cat="' + c + '">' + c + '</button>';
        }).join('') + '</div>' +
        '<form data-ss-supportform><textarea id="ssSupportMsg" maxlength="4000" placeholder="Describe it in your own words. If it is a bug, say what you tapped and what happened." style="min-height:130px">' + esc(st.supportMsg) + '</textarea>' +
        '<p class="acc-msg" id="ssSupportNote" role="alert">' + esc(st.supportNote) + '</p>' +
        '<button type="submit" class="ss-btn" style="width:100%;min-height:46px">Send to the developers</button></form></div>' +
        '<p class="ss-empty">Every message goes privately to the StudySpace developers.</p>';
      return h;
    }

    function reportsHTML() {
      if (!token() || !isOwnerDev()) {
        return '<h1>Reports</h1><div class="card"><p class="ss-empty">This inbox is only available to the StudySpace developers.</p></div>';
      }
      loadReports(false);
      var h = '<h1>Reports</h1><p class="sub">What students sent from Customer Service</p>';
      if (!st.reports) return h + '<div class="card"><p class="ss-empty">Loading reports…</p></div>';
      if (!st.reports.length) return h + '<div class="card"><p class="ss-empty">No reports yet.</p></div>';
      return h + st.reports.map(function (r) {
        var f = r.from || {};
        return '<article class="ss-report' + (r.status === 'resolved' ? ' resolved' : '') + '"><header>' + avatarHTML(f, 'sm') +
          '<div class="ss-who"><b>' + esc(f.displayName || f.username) + '</b><small>@' + esc(f.username) + ' · ' + fmtDay(r.createdAt) + '</small></div>' +
          '<span class="ss-chip">' + esc(r.category) + '</span></header>' +
          '<p>' + esc(r.message) + '</p><div class="ss-acts">' +
          (r.status === 'resolved' ? '<span class="ss-chip">Resolved</span>' : '<button type="button" class="ss-btn" data-ss-resolve="' + esc(r.id) + '">Mark resolved</button>') +
          '<button type="button" class="ss-btn danger" data-ss-rdel="' + esc(r.id) + '">Delete</button></div></article>';
      }).join('');
    }

    /* ---------------- log out ---------------- */
    function modal(html) {
      var m = q('ssModal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'ssModal';
        m.className = 'ss-modal';
        document.body.appendChild(m);
      }
      m.innerHTML = '<div class="ss-modal-bk" data-ss-modal-close></div><div class="ss-modal-card" role="dialog" aria-modal="true">' + html + '</div>';
      m.hidden = false;
      return m;
    }
    function closeModal() {
      var m = q('ssModal');
      if (m) { m.hidden = true; m.innerHTML = ''; }
    }
    function openLogout() {
      modal('<b>Do you wish to log out?</b><p>Your study data stays saved on this device and in your cloud account. You can sign back in any time.</p>' +
        '<div class="ss-modal-actions"><button type="button" class="ghost" data-ss-logout-cancel>Cancel</button>' +
        '<button type="button" class="ss-danger" data-ss-logout-yes>Confirm</button></div>');
    }
    function doLogout() {
      closeModal();
      /* Clear anything the previous account left on screen: toasts, the invite
         drawer and remembered invite ids. */
      var bn = document.getElementById('bn');
      if (bn) bn.remove();
      var draw = q('ssInviteDrawer');
      if (draw) draw.remove();
      st.inviteOpen = null;
      st.seenInvite = {}; st.sentSeen = {}; st.pending = {};
      st.invites = []; st.sentAt = 0; st.inviteAt = 0; st.countsAt = 0; st.msgAt = 0;
      document.documentElement.classList.add('ss-out');
      setTimeout(function () {
        document.documentElement.classList.remove('ss-out');
        st.loaded = false; st.friends = []; st.requests = []; st.threads = null; st.thread = null;
        st.messages = []; st.msgLoaded = false; st.pokes = null; st.profile = null;
        st.who = ''; st.search = ''; st.results = null;
        try { moreSub = ''; } catch (e) {}
        var a = acc();
        if (a && typeof a.signOut === 'function') a.signOut();
      }, 240);
    }

    /* ---------------- live room invitations ---------------- */
    function roomInviteDrawer() {
      if (!window.ssRoom || !ssRoom.inRoom()) { banner('Create or join a study room first.'); return; }
      var host = q('gsroom');
      if (!host) return;
      var draw = function () {
        var h2 = q('gsroom');
        if (!h2) return;
        var old = q('ssInviteDrawer');
        if (old) old.remove();
        var d = document.createElement('div');
        d.id = 'ssInviteDrawer';
        d.className = 'ss-drawer';
        d.innerHTML = '<div class="ss-drawer-bk" data-ss-drawer-close></div><div class="ss-drawer-card" role="dialog" aria-label="Invite a friend">' +
          '<header><b>Invite a friend</b><button type="button" data-ss-drawer-close aria-label="Close">×</button></header>' +
          '<p class="ss-hint">They get a notification and can accept or decline.</p>' +
          '<div class="ss-drawer-list">' + (st.friends.length ? st.friends.map(function (f) {
            return '<div class="ss-row">' + avatarHTML(f, 'sm') +
              '<div class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b><small>@' + esc(f.username) + '</small></div>' +
              '<button type="button" class="ss-btn" data-ss-invite="' + esc(f.id) + '">Invite</button></div>';
          }).join('') : '<p class="ss-empty">Add friends first in Life → Friends.</p>') + '</div></div>';
        h2.appendChild(d);
      };
      if (st.loaded) draw();
      else loadFriends().then(draw);
    }

    function sendInvite(btn, friendId) {
      var room = window.ssRoom && ssRoom.code ? ssRoom.code() : '';
      if (!room) { banner('Start a study room first.'); return; }
      btn.disabled = true;
      api('/room/invite', { method: 'POST', body: { friendId: friendId, roomCode: room } }).then(function () {
        btn.disabled = false;
        btn.textContent = 'Invited ✓';
        btn.classList.add('ghost');
        banner('Invitation sent.');
      }, function (err) {
        btn.disabled = false;
        banner(err.message || 'Could not send that invitation.');
      });
    }

    function showInvite(inv) {
      if (!inv || st.inviteOpen) return;
      st.inviteOpen = inv.id;
      st.inviteReason = '';
      var f = inv.from || {};
      modal('<b>Study room invitation</b>' +
        '<div class="ss-invite-from">' + avatarHTML(f, 'sm') + '<div class="ss-who"><b>' + esc(f.displayName || f.username) + devBadge(f) + '</b> <small>invited you to a Live Study Room</small></div></div>' +
        '<p>Room code <b>' + esc(inv.roomCode) + '</b>. Joining turns on your microphone.</p>' +
        '<div id="ssInviteReasonWrap" hidden><input id="ssInviteReason" maxlength="200" placeholder="Reason (optional)"></div>' +
        '<div class="ss-modal-actions"><button type="button" class="ghost" data-ss-inv-decline>Decline</button>' +
        '<button type="button" class="ss-btn" data-ss-inv-accept style="min-height:44px;border-radius:13px;font-weight:800">Accept</button></div>');
    }

    function respondInvite(accept) {
      var inv = st.inviteOpen;
      if (!inv) return;
      var code = '';
      var list = st.invites || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === inv) code = list[i].roomCode;
      var reasonEl = q('ssInviteReason');
      var reason = reasonEl ? String(reasonEl.value || '').trim() : '';
      st.inviteOpen = null;
      closeModal();
      api('/room/invites/respond', { method: 'POST', body: { inviteId: inv, accept: !!accept, reason: reason } }).then(function (d) {
        if (accept) {
          if (!code && d.roomCode) code = d.roomCode;
          if (code && window.ssRoom && ssRoom.join) ssRoom.join(code);
        } else {
          banner('Invitation declined.');
        }
      }, function (err) {
        banner(err.message || 'Could not answer that invitation.');
      });
    }

    function pollInvites() {
      if (!token() || Date.now() - st.inviteAt < 10000) return;
      st.inviteAt = Date.now();
      api('/room/invites').then(function (d) {
        st.invites = d.invites || [];
        var fresh = null;
        st.invites.forEach(function (inv) {
          if (!st.seenInvite[inv.id]) { st.seenInvite[inv.id] = 1; if (!fresh) fresh = inv; }
        });
        if (fresh && !st.inviteOpen) showInvite(fresh);
      }, function () {});
    }

    function pollSent() {
      if (!token() || Date.now() - st.sentAt < 7000) return;
      var room = window.ssRoom && ssRoom.code ? ssRoom.code() : '';
      if (!room) return;
      st.sentAt = Date.now();
      api('/room/invites/sent?roomCode=' + encodeURIComponent(room)).then(function (d) {
        (d.sent || []).forEach(function (inv) {
          if (inv.status === 'pending') return;
          var key = inv.id + ':' + inv.status;
          if (st.sentSeen[key]) return;
          st.sentSeen[key] = 1;
          var who = (inv.to && (inv.to.displayName || inv.to.username)) || 'Your friend';
          if (inv.status === 'accepted') banner(who + ' joined your study room.');
          else banner(who + ' declined the invite' + (inv.reason ? ' · ' + inv.reason : '') + '.');
        });
      }, function () {});
    }

    /* ---------------- events ---------------- */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var el;
      if ((el = t.closest('[data-ss-avatar]'))) { setProf({ avatar: el.getAttribute('data-ss-avatar') }); return; }
      if ((el = t.closest('[data-ss-bg]'))) { setProf({ bg: el.getAttribute('data-ss-bg') }); return; }
      if (t.closest('[data-ss-avup]')) { var f = q('ssAvFile'); if (f) f.click(); return; }
      if ((el = t.closest('[data-ss-backfriends]'))) { st.profile = null; nav('life', 'friends'); return; }
      if ((el = t.closest('[data-ss-openfriend]'))) { openFriendProfile(el.getAttribute('data-ss-openfriend')); return; }
      if ((el = t.closest('[data-ss-search]'))) { doSearch(); return; }
      if ((el = t.closest('[data-ss-add]'))) { addFriend(el); return; }
      if ((el = t.closest('[data-ss-accept]'))) { answerRequest(el, true); return; }
      if ((el = t.closest('[data-ss-decline]'))) { answerRequest(el, false); return; }
      if ((el = t.closest('[data-ss-poke]'))) { poke(el.getAttribute('data-ss-poke'), el); return; }
      if ((el = t.closest('[data-ss-chat]'))) { openFriendChat(el.getAttribute('data-ss-chat')); return; }
      if ((el = t.closest('[data-ss-gofriends]'))) { nav('life', 'friends'); return; }
      if ((el = t.closest('[data-ss-chattab]'))) {
        st.tab = el.getAttribute('data-ss-chattab');
        if (st.tab === 'pokes') { st.pokes = null; loadPokes(); }
        else loadThreads(true);
        try { render(); } catch (err) {}
        return;
      }
      if ((el = t.closest('[data-ss-threadback]'))) {
        st.thread = null; st.threadFriend = null; st.messages = []; st.msgLoaded = false;
        loadThreads(true);
        try { render(); } catch (err) {}
        return;
      }
      if ((el = t.closest('[data-ss-cat]'))) {
        st.cat = el.getAttribute('data-ss-cat');
        var msg = q('ssSupportMsg');
        st.supportMsg = msg ? msg.value : st.supportMsg;
        try { render(); } catch (err) {}
        return;
      }
      if ((el = t.closest('[data-ss-resolve]'))) { reportAction(el.getAttribute('data-ss-resolve'), 'resolve'); return; }
      if ((el = t.closest('[data-ss-rdel]'))) { reportAction(el.getAttribute('data-ss-rdel'), 'delete'); return; }
      if (t.closest('[data-chat="open"]')) {
        st.tab = 'messages';
        st.thread = null; st.threadFriend = null;
        nav('acad', 'chat');
        return;
      }
      if (t.closest('[data-ss-logout]')) { openLogout(); return; }
      if (t.closest('[data-ss-logout-cancel]') || t.closest('[data-ss-modal-close]')) { closeModal(); return; }
      if (t.closest('[data-ss-logout-yes]')) { doLogout(); return; }
      if ((el = t.closest('[data-ss-drawer-close]'))) { var d = q('ssInviteDrawer'); if (d) d.remove(); return; }
      if ((el = t.closest('[data-ss-invite]'))) { sendInvite(el, el.getAttribute('data-ss-invite')); return; }
      if (t.closest('[data-ss-inv-accept]')) { respondInvite(true); return; }
      if ((el = t.closest('[data-ss-inv-decline]'))) {
        var wrap = q('ssInviteReasonWrap');
        if (wrap && wrap.hidden) {
          wrap.hidden = false;
          el.textContent = 'Send decline';
          el.setAttribute('data-ss-inv-decline-send', '1');
          var r = q('ssInviteReason');
          if (r) r.focus();
          return;
        }
        respondInvite(false); return;
      }
    });

    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || !f.matches) return;
      if (f.matches('[data-ss-chatform]')) { e.preventDefault(); sendMessage(); return; }
      if (f.matches('[data-ss-supportform]')) { e.preventDefault(); submitSupport(); return; }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'ssFriendQ') {
        e.preventDefault();
        doSearch();
      }
    });

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el && el.id === 'ssAvFile' && el.files && el.files[0]) {
        shrinkPhoto(el.files[0]).then(function (data) { setProf({ avatar: data }); }, function (err) { banner(err.message || 'That photo could not be read.'); });
        el.value = '';
      }
    });

    function doSearch() {
      var inp = q('ssFriendQ');
      var term = inp ? String(inp.value || '').trim() : st.search;
      st.search = term;
      if (term.length < 2) { st.results = null; st.searching = false; refresh(); return; }
      st.searching = true;
      st.results = null;
      refresh();
      api('/friends/search?q=' + encodeURIComponent(term)).then(function (d) {
        st.searching = false;
        st.results = d.results || [];
        refresh();
      }, function (err) {
        st.searching = false;
        st.results = [];
        st.error = err.message || 'Search failed.';
        refresh();
      });
    }

    function addFriend(btn) {
      var uname = btn.getAttribute('data-ss-add');
      btn.disabled = true;
      api('/friends/request', { method: 'POST', body: { username: uname } }).then(function (d) {
        btn.disabled = false;
        if (d.accepted || d.already) {
          btn.outerHTML = '<span class="ss-chip">Friend</span>';
          banner(d.accepted ? 'You are now friends.' : 'You are already friends.');
          loadFriends(true);
        } else {
          st.pending[uname] = 1;
          btn.textContent = 'Requested';
          btn.classList.add('ghost');
          banner('Friend request sent.');
        }
      }, function (err) {
        btn.disabled = false;
        banner(err.message || 'Could not send that request.');
      });
    }

    function answerRequest(btn, accept) {
      var id = btn.getAttribute(accept ? 'data-ss-accept' : 'data-ss-decline');
      btn.disabled = true;
      api(accept ? '/friends/accept' : '/friends/decline', { method: 'POST', body: { requestId: id } }).then(function () {
        banner(accept ? 'Friend added.' : 'Request declined.');
        st.loaded = false;
        loadFriends(true);
      }, function (err) {
        btn.disabled = false;
        banner(err.message || 'Could not answer that request.');
      });
    }

    function submitSupport() {
      var ta = q('ssSupportMsg');
      var note = q('ssSupportNote');
      var text = ta ? String(ta.value || '').trim() : '';
      st.supportMsg = text;
      if (text.length < 5) {
        st.supportNote = 'Tell us a little more (at least 5 characters).';
        if (note) note.textContent = st.supportNote;
        if (ta) ta.focus();
        return;
      }
      if (note) { note.textContent = 'Sending…'; note.classList.remove('ok'); }
      api('/reports/submit', { method: 'POST', body: { category: st.cat, message: text } }).then(function () {
        st.supportMsg = '';
        st.supportNote = 'Thank you. Your message reached the StudySpace developers.';
        try { render(); } catch (e) {}
        var n2 = q('ssSupportNote');
        if (n2) n2.classList.add('ok');
      }, function (err) {
        st.supportNote = err.message || 'Could not send that message.';
        var n3 = q('ssSupportNote');
        if (n3) n3.textContent = st.supportNote;
      });
    }

    function reportAction(id, action) {
      api('/reports/update', { method: 'POST', body: { id: id, action: action } }).then(function () {
        st.reports = null;
        loadReports(true);
      }, function (err) { banner(err.message || 'Could not update that report.'); });
    }

    /* ---------------- hooks into the app ---------------- */
    if (typeof window.personalizeHTML === 'function') {
      var prevPersonalize = window.personalizeHTML;
      window.personalizeHTML = function () {
        return profileHero() + prevPersonalize.apply(this, arguments);
      };
    }

    /* Developer accounts have no daily AI limits. The visible counters say
       Unlimited and the worker also skips its quota for a DEV session. */
    try {
      ['aiLeft', 'buddyOnlineLeft', 'buddyOfflineLeft', 'acctLeft'].forEach(function (name) {
        var prev = window[name];
        if (typeof prev !== 'function') return;
        window[name] = function () {
          if (isDev()) return 999;
          return prev.apply(this, arguments);
        };
      });
    } catch (e) {}

    /* AI calls carry the session token so the worker can recognise a DEV account.
       Regular accounts are unaffected: the header is simply ignored. */
    try {
      var prevAiFetch = window.aiFetch;
      if (typeof prevAiFetch === 'function') {
        window.aiFetch = function (url, opts) {
          opts = opts || {};
          var t = token();
          if (t) {
            var headers = {}, src = opts.headers || {};
            for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) headers[k] = src[k];
            if (!headers.Authorization) headers.Authorization = 'Bearer ' + t;
            opts.headers = headers;
          }
          return prevAiFetch.call(this, url, opts);
        };
      }
    } catch (e) {}

    /* A social view is rendered by the main app through these wrappers, so the
       tab and sub-view variables stay shared with the rest of StudySpace. */
    window.ssSocial = {
      friendsView: friendsView,
      chatView: chatView,
      supportHTML: supportHTML,
      reportsHTML: reportsHTML,
      profileHero: profileHero,
      openFriendChat: openFriendChat,
      roomInviteDrawer: roomInviteDrawer,
      unreadCount: unreadCount,
      friendCount: friendCount,
      requestCount: requestCount
    };

    /* ---------------- background sync ---------------- */
    function tick() {
      if (!token()) return;
      var u = me();
      if (u && u.username !== st.who) {
        st.who = u.username;
        st.loaded = false;
        st.threads = null;
        st.pokes = null;
        st.reports = null;
        syncOwnProfile();
        loadFriends(true);
      }
      if (Date.now() - st.countsAt > 20000) {
        st.countsAt = Date.now();
        loadFriends(true);
      }
      pollInvites();
      pollSent();
      if (st.thread && tab === 'acad' && hv === 'chat' && Date.now() - st.msgAt > 5000) {
        st.msgAt = Date.now();
        loadMessages(st.thread, true);
      }
    }

    setTimeout(function () {
      if (token()) { loadFriends(true); syncOwnProfile(); }
    }, 800);
    setInterval(tick, 4000);
  } catch (err) {
    try { console.error('social layer failed', err); } catch (e) {}
  }
})();
