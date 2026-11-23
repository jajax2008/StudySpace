/* StudySpace Calendar — a current-year month grid with day notes and real
   device alarms.

   · Every note and reminder lives in S.cal, which accounts.js syncs to
     Cloudflare D1, so the same calendar appears on every device.
   · In the Android app the reminders are scheduled with
     @capacitor/local-notifications (exact alarm + wake lock + sound +
     vibration) so they ring even when the app is closed. The notification
     icon is the user's currently equipped custom app icon.
   · In a browser the same reminders fire as in-page notifications while the
     app is open, so nothing is silently lost. */
(function () {
  try {
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DAY_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var CHANNEL = 'studyspace-alarm';
    var ICON_COLOR = { default: '#3d7a5a', theme1: '#7fa98f', theme2: '#4a6fa5', theme3: '#5d8f6d', theme4: '#c08a3e', theme5: '#c06a86' };
    var ID_KEY = 'ss-cal-alarm-ids';

    var st = { y: new Date().getFullYear(), m: new Date().getMonth(), day: todayStr(), status: '', tone: '', busy: false };
    var saveT = 0;

    function q(id) { return document.getElementById(id); }
    function pad(n) { return String(n).padStart(2, '0'); }
    function keyOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
    function cal() {
      if (typeof S === 'undefined') return { notes: {} };
      if (!S.cal || typeof S.cal !== 'object') S.cal = { notes: {} };
      if (!S.cal.notes || typeof S.cal.notes !== 'object') S.cal.notes = {};
      return S.cal;
    }
    function dayEntry(key, create) {
      var c = cal();
      var e = c.notes[key];
      if ((!e || typeof e !== 'object') && create) {
        e = { text: '', reminders: [] };
        c.notes[key] = e;
      }
      if (!e) return null;
      if (!Array.isArray(e.reminders)) e.reminders = [];
      return e;
    }
    function cleanEmpty(key) {
      var e = dayEntry(key);
      if (e && !String(e.text || '').trim() && !(e.reminders || []).length) delete cal().notes[key];
    }
    function whenOf(key, time) {
      var at = new Date(key + 'T' + (time || '08:00'));
      return isNaN(at.getTime()) ? 0 : at.getTime();
    }
    function fmtWhen(key, time) {
      return fmtT(time) + ' · ' + new Date(key + 'T' + (time || '08:00')).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    function allReminders() {
      var c = cal(), out = [];
      Object.keys(c.notes).forEach(function (key) {
        var e = c.notes[key];
        if (!e || !Array.isArray(e.reminders)) return;
        e.reminders.forEach(function (r) {
          if (!r || !r.time || !r.title) return;
          out.push({ key: key, id: r.id, title: r.title, time: r.time, alarm: r.alarm !== false, at: whenOf(key, r.time) });
        });
      });
      out.sort(function (a, b) { return a.at - b.at; });
      return out;
    }
    function nextAlarm() {
      var now = Date.now(), list = allReminders();
      for (var i = 0; i < list.length; i++) if (list[i].alarm && list[i].at >= now) return list[i];
      return null;
    }
    function sub() {
      var n = allReminders().filter(function (r) { return r.alarm && r.at >= Date.now(); }).length;
      var next = nextAlarm();
      if (next) {
        var today = next.key === todayStr();
        return (today ? 'Next ' : 'Next · ') + fmtT(next.time);
      }
      if (n) return n + ' alarm' + (n === 1 ? '' : 's');
      var e = dayEntry(todayStr());
      if (e && String(e.text || '').trim()) return 'Note for today';
      return 'Notes & alarms';
    }

    /* ---------------- native alarm bridge ---------------- */
    function LN() {
      try {
        var C = window.Capacitor;
        if (!C || !C.Plugins) return null;
        var P = C.Plugins.LocalNotifications;
        if (!P) return null;
        if (C.isNativePlatform && !C.isNativePlatform()) return null;
        return P;
      } catch (e) { return null; }
    }
    function iconVariant() {
      var style = 'style1', theme = 'default';
      try {
        var w = iconState();
        if (w && w.style) style = w.style;
        if (w && w.theme) theme = w.theme;
      } catch (e) {}
      return { style: style, theme: theme };
    }
    function notifIcon() {
      var v = iconVariant();
      /* drawable/ic_notify_<style>_<theme> is generated from the exact launcher
         icon the user has equipped, so the notification shows that app icon. */
      return { name: 'ic_notify_' + v.style + '_' + v.theme, color: ICON_COLOR[v.theme] || ICON_COLOR.default };
    }
    function intId(text) {
      var h = 2166136261;
      var s = String(text || '');
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0) % 2147483000 + 1;
    }
    function readIds() {
      try { var a = JSON.parse(localStorage.getItem(ID_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    function writeIds(list) {
      try { localStorage.setItem(ID_KEY, JSON.stringify(list || [])); } catch (e) {}
    }

    var syncT = 0;
    function syncAlarms() {
      var P = LN();
      var list = allReminders().filter(function (r) { return r.alarm && r.at > Date.now() - 60000; });
      if (!P) { armWeb(list); return; }
      clearTimeout(syncT);
      syncT = setTimeout(function () {
        var ids = list.map(function (r) { return intId(r.key + ':' + r.id); });
        var icon = notifIcon();
        var old = readIds();
        var removed = old.filter(function (id) { return ids.indexOf(id) < 0; });
        (function () {
          return P.checkPermissions().then(function (perm) {
            if (!perm || perm.display !== 'granted') return P.requestPermissions();
            return perm;
          }).catch(function () {});
        })().then(function () {
          var ch = {
            id: CHANNEL, name: 'StudySpace alarms', description: 'Calendar reminders and class alarms',
            importance: 5, visibility: 1, vibration: true, lights: true, lightColor: icon.color, sound: 'default'
          };
          return P.createChannel ? P.createChannel(ch).catch(function () {}) : null;
        }).then(function () {
          if (removed.length) return P.cancel({ notifications: removed.map(function (id) { return { id: id }; }) }).catch(function () {});
        }).then(function () {
          if (!list.length) return null;
          return P.schedule({
            notifications: list.map(function (r) {
              return {
                id: intId(r.key + ':' + r.id),
                title: r.title,
                body: fmtWhen(r.key, r.time) + ' · StudySpace Calendar',
                channelId: CHANNEL,
                smallIcon: 'ic_stat_studyspace',
                largeIcon: icon.name,
                iconColor: icon.color,
                autoCancel: true,
                ongoing: false,
                extra: { kind: 'ss-calendar', key: r.key, reminder: r.id },
                schedule: { at: new Date(r.at), allowWhileIdle: true }
              };
            })
          });
        }).then(function () {
          writeIds(ids);
          st.status = list.length ? 'Alarm' + (list.length === 1 ? '' : 's') + ' scheduled on this device.' : 'No device alarms are scheduled.';
          st.tone = 'ok';
          paintNote();
        }).catch(function (err) {
          st.status = 'Could not schedule the device alarm' + (err && err.message ? ': ' + err.message : '.');
          st.tone = 'warn';
          paintNote();
        });
      }, 700);
    }

    /* Browser fallback: fire while StudySpace is open. */
    var webTimers = {};
    function armWeb(list) {
      Object.keys(webTimers).forEach(function (k) { clearTimeout(webTimers[k]); delete webTimers[k]; });
      if (!window.Notification) return;
      list.forEach(function (r) {
        var wait = r.at - Date.now();
        if (wait < 0 || wait > 6 * 3600 * 1000) return;
        webTimers[r.key + ':' + r.id] = setTimeout(function () {
          try {
            if (Notification.permission === 'granted') new Notification(r.title, { body: fmtWhen(r.key, r.time), icon: 'icons/icon-192.png', tag: 'ss-cal-' + r.id });
          } catch (e) {}
          try { if (navigator.vibrate) navigator.vibrate([300, 160, 300]); } catch (e) {}
          if (typeof banner === 'function') banner('Alarm · ' + r.title + ' (' + fmtT(r.time) + ')');
        }, wait);
      });
    }
    function askWebPermission() {
      try {
        if (!window.Notification) return;
        if (Notification.permission === 'default') Notification.requestPermission().then(function () { syncAlarms(); });
      } catch (e) {}
    }

    /* ---------------- view ---------------- */
    function grid() {
      var first = new Date(st.y, st.m, 1);
      var startDow = first.getDay();
      var days = new Date(st.y, st.m + 1, 0).getDate();
      var prevDays = new Date(st.y, st.m, 0).getDate();
      var cells = [];
      var i;
      for (i = 0; i < startDow; i++) {
        var pd = prevDays - startDow + 1 + i;
        var pm = st.m === 0 ? 11 : st.m - 1, py = st.m === 0 ? st.y - 1 : st.y;
        cells.push({ y: py, m: pm, d: pd, out: true });
      }
      for (i = 1; i <= days; i++) cells.push({ y: st.y, m: st.m, d: i, out: false });
      var guard = 0;
      while (cells.length % 7 !== 0 && guard++ < 14) {
        var nd = cells.length - startDow - days + 1;
        var nm = st.m === 11 ? 0 : st.m + 1, ny = st.m === 11 ? st.y + 1 : st.y;
        cells.push({ y: ny, m: nm, d: nd, out: true });
      }
      return cells;
    }

    function dayHTML(c) {
      var key = keyOf(c.y, c.m, c.d);
      var e = dayEntry(key);
      var has = !!(e && (String(e.text || '').trim() || (e.reminders || []).length));
      var alarm = !!(e && (e.reminders || []).some(function (r) { return r.alarm !== false; }));
      var cls = (c.out ? 'out' : '') + (key === todayStr() ? ' today' : '') + (key === st.day ? ' sel' : '');
      return '<button type="button" class="' + cls.trim() + '" data-cald="' + key + '" aria-label="' + key + (has ? ', has notes' : '') + '" aria-pressed="' + (key === st.day ? 'true' : 'false') + '">' + c.d +
        (has ? '<span class="cdot' + (alarm ? ' alarm' : '') + '"></span>' : '') + '</button>';
    }

    function remindersHTML(key) {
      var e = dayEntry(key);
      var list = (e && e.reminders || []).slice().sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); });
      if (!list.length) return '<p class="cal-empty">No reminders for this day yet.</p>';
      var now = Date.now();
      return list.map(function (r) {
        var past = whenOf(key, r.time) < now;
        return '<div class="cal-rem' + (past ? ' past' : '') + '">' +
          '<span class="ctime">' + esc(fmtT(r.time)) + '</span>' +
          '<span class="ct"><b>' + esc(r.title) + '</b><small>' + (r.alarm !== false ? 'Alarm' : 'Reminder only') + (past ? ' · past' : '') + '</small></span>' +
          '<button type="button" class="cal-x" data-caldel="' + esc(r.id) + '" aria-label="Delete reminder">×</button></div>';
      }).join('');
    }

    function view() {
      var cells = grid();
      var isThisMonth = st.y === new Date().getFullYear() && st.m === new Date().getMonth();
      var e = dayEntry(st.day);
      var selDate = new Date(st.day + 'T12:00:00');
      var native = !!LN();
      return '<h1>Calendar</h1><p class="sub">' + st.y + ' · notes, deadlines and real alarms</p>' +
        '<div class="card cal-card" style="margin-top:0">' +
        '<div class="cal-head"><span class="cal-title"><b>' + MONTHS[st.m] + ' ' + st.y + '</b><small>' + (isThisMonth ? 'This month' : 'Tap Today to come back') + '</small></span>' +
        '<span class="cal-nav"><button type="button" data-calmv="-1" aria-label="Previous month">‹</button>' +
        '<button type="button" class="today" data-caltoday>Today</button>' +
        '<button type="button" data-calmv="1" aria-label="Next month">›</button></span></div>' +
        '<div class="cal-week">' + DAY_S.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
        '<div class="cal-grid">' + cells.map(dayHTML).join('') + '</div></div>' +
        '<div class="card cal-card"><h2>' + selDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + '</h2>' +
        '<p class="cal-day">Note for the day</p>' +
        '<textarea id="calNote" maxlength="2000" placeholder="What is happening on this day? Add a class, an exam, a deadline...">' + esc((e && e.text) || '') + '</textarea>' +
        '<div style="margin-top:14px"><b style="font-size:13.5px">Reminders & alarms</b></div>' +
        '<div id="calRems">' + remindersHTML(st.day) + '</div>' +
        '<form class="cal-form" data-calform="1"><input id="calTitle" maxlength="80" placeholder="Reminder title, e.g. Math exam" autocomplete="off">' +
        '<div class="cal-line"><label>Time<input id="calTime" type="time" value="07:30"></label>' +
        '<button type="submit" style="min-height:44px;padding:0 16px">Add</button></div>' +
        '<label class="cal-check"><input id="calAlarm" type="checkbox" checked>Ring this device like an alarm</label>' +
        '</form>' +
        '<p class="cal-note' + (st.tone ? ' ' + st.tone : '') + '" id="calStatus">' + esc(st.status || (native ? 'Alarms use your exact alarm setting and the app icon you have equipped.' : 'In a browser, alarms ring while StudySpace is open. Install the Android app for closed-app alarms.')) + '</p>' +
        (st.needExact ? '<button type="button" class="ghost" data-calexact style="width:100%;margin-top:8px;min-height:42px">Allow exact alarms</button>' : '') +
        '</div>';
    }

    function paintNote() {
      var n = q('calStatus');
      if (n) { n.textContent = st.status; n.className = 'cal-note' + (st.tone ? ' ' + st.tone : ''); }
    }
    function repaint() { try { render(); } catch (e) {} }

    /* ---------------- events ---------------- */
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var mv = t.closest('[data-calmv]');
      if (mv) {
        var d = Number(mv.getAttribute('data-calmv')) || 0;
        var nd = new Date(st.y, st.m + d, 1);
        st.y = nd.getFullYear(); st.m = nd.getMonth();
        repaint();
        return;
      }
      if (t.closest('[data-caltoday]')) {
        var now = new Date();
        st.y = now.getFullYear(); st.m = now.getMonth(); st.day = todayStr();
        repaint();
        return;
      }
      var day = t.closest('[data-cald]');
      if (day) {
        st.day = day.getAttribute('data-cald');
        st.status = '';
        st.tone = '';
        repaint();
        return;
      }
      if (t.closest('[data-calexact]')) {
        var P = LN();
        try { if (P && P.changeExactNotificationSetting) P.changeExactNotificationSetting(); } catch (e) {}
        return;
      }
      var del = t.closest('[data-caldel]');
      if (del) {
        var id = del.getAttribute('data-caldel');
        var e = dayEntry(st.day, true);
        e.reminders = (e.reminders || []).filter(function (r) { return r.id !== id; });
        cleanEmpty(st.day);
        try { save(); } catch (er) {}
        syncAlarms();
        repaint();
        return;
      }
    });

    document.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (!f || !f.matches || !f.matches('[data-calform]')) return;
      ev.preventDefault();
      var titleEl = q('calTitle'), timeEl = q('calTime'), alarmEl = q('calAlarm');
      var title = String(titleEl && titleEl.value || '').trim();
      var time = String(timeEl && timeEl.value || '').trim();
      if (!title) { if (titleEl) titleEl.focus(); return; }
      if (!/^\d{2}:\d{2}$/.test(time)) { if (timeEl) timeEl.focus(); return; }
      var e = dayEntry(st.day, true);
      e.reminders = (e.reminders || []).filter(function (r) { return !(r.title === title && r.time === time); });
      e.reminders.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title: title.slice(0, 80), time: time, alarm: !!(alarmEl && alarmEl.checked) });
      try { save(); } catch (er) {}
      st.status = 'Saved for ' + fmtWhen(st.day, time) + '.';
      st.tone = 'ok';
      askWebPermission();
      syncAlarms();
      repaint();
    });

    document.addEventListener('input', function (ev) {
      var t = ev.target;
      if (!t || t.id !== 'calNote') return;
      var e = dayEntry(st.day, true);
      e.text = String(t.value || '');
      clearTimeout(saveT);
      saveT = setTimeout(function () {
        try { save(); } catch (er) {}
        cleanEmpty(st.day);
      }, 420);
    });

    /* Keep the schedule in step with edits made elsewhere (sync, account switch). */
    function checkExact() {
      var P = LN();
      if (!P || !P.checkExactNotificationSetting) return;
      try {
        P.checkExactNotificationSetting().then(function (r) {
          var ok = !r || r.exact_alarm !== 'denied';
          if (ok === !st.needExact) return;
          st.needExact = !ok;
          try { if (tab === 'life' && hv === 'calendar') render(); } catch (e) {}
        }, function () {});
      } catch (e) {}
    }

    var bootT = setTimeout(function () { syncAlarms(); checkExact(); }, 2200);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) syncAlarms();
    });
    try {
      var prevSave = window.save;
      if (typeof prevSave === 'function') {
        window.save = function () {
          var out = prevSave.apply(this, arguments);
          clearTimeout(bootT);
          syncAlarms();
          return out;
        };
      }
    } catch (e) {}

    window.ssCalendar = { view: view, sub: sub, sync: syncAlarms, next: nextAlarm, reset: function () { st.y = new Date().getFullYear(); st.m = new Date().getMonth(); st.day = todayStr(); } };
  } catch (err) {
    try { console.error('calendar layer failed', err); } catch (e) {}
  }
})();
