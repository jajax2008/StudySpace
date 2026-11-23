/* StudySpace Study Games — hub, pre-game lobby, coins, tasks, accessory store
   and the bridge into the 3D Buddy Run engine (js/buddyrun.js).
   Everything is guarded so a failure here never blocks the rest of the app. */
(function () {
  'use strict';
  try {
    var G = {
      tab: 'hub',          // hub | lobby | tasks | store
      char: 'study',
      src: 'gk',           // gk | cards | notes | file
      file: null,
      text: '',
      loading: false,
      msg: '',
      err: '',
      cache: {},           // file questions cached per file signature
      qs: null,
      fit: 'study'         // fitting-room view: study | life | duo
    };

    var ICON = {
      run: '<path d="M6 20l3-7 3 2 2 5M9 13 6.5 9.5 9.5 7l3.5 1 2.5-3M15 4.2h.01M13.5 8.5 17 11l2.5-1.5"/>',
      lock: '<path d="M7 11V8.5a5 5 0 0 1 10 0V11M5 11h14v10H5zM12 15v2.5"/>',
      coins: '<circle cx="12" cy="12" r="8.7" style="fill:#e8b349;stroke:#a8741f"/><circle cx="12" cy="12" r="5.9" style="fill:none;stroke:#fff8e2;stroke-width:1.2;opacity:.78"/><path d="M8.3 9.7c1.1-1.7 3.5-2.1 5.2-1" style="fill:none;stroke:#fff;stroke-width:1.3;opacity:.85"/>',
      tasks: '<path d="M5 4h14v16H5zM9 9l1.6 1.6L14 7.2M9 16h6"/>',
      store: '<path d="M4 9h16l-1.2-4.2H5.2zM5.5 9v10h13V9M9.5 19v-5h5v5"/>',
      arrow: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5"/>',
      spark: '<path d="M12 4.4 13.4 9l4.6 1.4-4.6 1.4L12 16.4l-1.4-4.6L6 10.4 10.6 9z"/>',
      back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>'
    };
    function ico(name, cls) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + (ICON[name] || '') + '</svg>';
    }

    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); };
    function today() { try { return todayStr(); } catch (e) { return new Date().toISOString().slice(0, 10); } }

    /* ================= SAVED STATE ================= */
    var TASKS = [
      { id: 'correct5', t: 'Answer 5 questions correctly in one run', n: 5, r: 20, key: 'correct' },
      { id: 'dist500', t: 'Run 500 m in one run', n: 500, r: 20, key: 'dist' },
      { id: 'coins40', t: 'Collect 40 coins in one run', n: 40, r: 20, key: 'coins' },
      { id: 'dodge15', t: 'Dodge 15 obstacles in one run', n: 15, r: 20, key: 'dodged' }
    ];
    var ACAD = [
      { id: 'focus', t: 'Finish a focus session today', sub: 'Clock 1 minute or more in the Focus Room', r: 25 },
      { id: 'task', t: 'Complete an assignment today', sub: 'Tick any assignment as done', r: 25 }
    ];

    function S0() { try { return S; } catch (e) { return null; } }
    function saved() {
      var s = S0();
      if (!s) return { coins: 0, best: 0, runs: 0, day: '', prog: {}, done: {} };
      var g = s.games;
      if (!g || typeof g !== 'object') g = s.games = {};
      if (typeof g.coins !== 'number' || !isFinite(g.coins)) g.coins = 0;
      if (typeof g.best !== 'number') g.best = 0;
      if (typeof g.runs !== 'number') g.runs = 0;
      if (!g.prog || typeof g.prog !== 'object') g.prog = {};
      if (!g.done || typeof g.done !== 'object') g.done = {};
      if (g.day !== today()) { g.day = today(); g.prog = {}; g.done = {}; }
      return g;
    }
    function persist() { try { save(); } catch (e) {} }

    function hasFocusSession() {
      try { return (S.sessions || []).some(function (x) { return x.date === today() && (x.min || x.mins || x.minutes || 0) >= 1; }); } catch (e) { return false; }
    }
    function hasDoneTask() {
      try { return (S.tasks || []).some(function (t) { return t.done && t.doneAt && (typeof ymd === 'function' ? ymd(new Date(t.doneAt)) : new Date(t.doneAt).toISOString().slice(0, 10)) === today(); }); } catch (e) { return false; }
    }
    function acadDone(id) { return id === 'focus' ? hasFocusSession() : hasDoneTask(); }

    /* ================= QUESTIONS ================= */
    var GK = [
      ['What is the capital of France?', 'Paris', 'Lyon', 'Marseille', 'Paris has been France\u2019s capital for centuries.', 0],
      ['What is 7 \u00d7 8?', '56', '54', '48', '7 \u00d7 8 = 56.', 0],
      ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Mars', 'Mercury orbits closest to the Sun.', 0],
      ['What do bees collect from flowers?', 'Nectar', 'Sand', 'Seeds', 'They turn nectar into honey.', 0],
      ['What is H\u2082O commonly called?', 'Water', 'Hydrogen', 'Salt', 'Two hydrogen atoms and one oxygen atom.', 0],
      ['Which gas do plants absorb for photosynthesis?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Plants turn CO\u2082 and light into glucose.', 1],
      ['Which organelle is the powerhouse of the cell?', 'Mitochondria', 'Nucleus', 'Ribosome', 'It makes ATP, the cell\u2019s usable energy.', 1],
      ['Which is the largest ocean?', 'Pacific', 'Atlantic', 'Indian', 'The Pacific covers about a third of Earth.', 1],
      ['Who wrote \u201cRomeo and Juliet\u201d?', 'Shakespeare', 'Dickens', 'Austen', 'William Shakespeare wrote it around 1595.', 1],
      ['Which force pulls objects toward Earth?', 'Gravity', 'Friction', 'Magnetism', 'Gravity attracts masses toward each other.', 1],
      ['What is the square root of 144?', '12', '14', '11', '12 \u00d7 12 = 144.', 2],
      ['Which element has the symbol Fe?', 'Iron', 'Fluorine', 'Lead', 'Fe comes from the Latin \u201cferrum\u201d.', 2],
      ['In what year did World War II end?', '1945', '1939', '1950', 'It ended in 1945.', 2],
      ['What process do cells use to release energy from glucose?', 'Cellular respiration', 'Photosynthesis', 'Osmosis', 'Glucose is broken down to make ATP.', 2],
      ['Which part of the cell holds the DNA?', 'Nucleus', 'Vacuole', 'Membrane', 'The nucleus stores genetic material.', 2],
      ['What is 15% of 200?', '30', '15', '35', '10% is 20, 5% is 10, so 15% is 30.', 0],
      ['How many continents are there?', '7', '5', '6', 'Asia, Africa, North and South America, Antarctica, Europe, Australia.', 0],
      ['What is the boiling point of water at sea level?', '100 \u00b0C', '90 \u00b0C', '120 \u00b0C', 'Water boils at 100 \u00b0C (212 \u00b0F).', 0],
      ['Which is a primary colour of light?', 'Red', 'Green', 'Yellow', 'Red, green and blue are the primary colours of light.', 1],
      ['What does \u201cphotosynthesis\u201d produce?', 'Glucose', 'Protein', 'Salt', 'Light energy becomes chemical energy in glucose.', 1],
      ['Which is the smallest prime number?', '2', '1', '3', '1 is not prime, so 2 is the smallest.', 1],
      ['Who proposed the theory of relativity?', 'Einstein', 'Newton', 'Galileo', 'Albert Einstein published it in 1905 and 1915.', 2],
      ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Gd', 'Au comes from the Latin \u201caurum\u201d.', 2],
      ['What is the derivative of x\u00b2?', '2x', 'x', 'x\u00b3', 'The power rule gives 2x.', 2],
      ['Which country has the largest population?', 'India', 'China', 'USA', 'India passed China in 2023.', 2],
      ['What is the past tense of \u201cgo\u201d?', 'went', 'goed', 'gone', '\u201cGone\u201d is the past participle.', 0],
      ['How many sides does a hexagon have?', '6', '5', '8', 'A hexagon has six sides.', 0],
      ['What gas do we breathe in to survive?', 'Oxygen', 'Nitrogen', 'Helium', 'Cells need oxygen to release energy.', 1]
    ];
    function gkQuestions() {
      return GK.map(function (a) { return { q: a[0], a: a[1], choices: shuffle([a[1], a[2], a[3]]), e: a[4], lvl: a[5] }; });
    }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }

    function fromDecks() {
      var all = [];
      try {
        (S.decks || []).forEach(function (d) {
          (d.cards || []).forEach(function (c) { if (c && c.q && c.a) all.push(c); });
        });
      } catch (e) {}
      var pool = all.map(function (c) { return String(c.a); });
      var out = [];
      all.forEach(function (c) {
        var ch = [];
        if (Array.isArray(c.choices) && c.choices.length >= 3) ch = c.choices.filter(function (x) { return x != null && x !== ''; }).slice(0, 4);
        if (ch.indexOf(c.a) < 0) ch.push(c.a);
        while (ch.length < 3) {
          var cand = pool.filter(function (x) { return x !== c.a && ch.indexOf(x) < 0; });
          if (!cand.length) break;
          ch.push(cand[Math.floor(Math.random() * cand.length)]);
        }
        if (ch.length >= 3) out.push({ q: String(c.q), a: String(c.a), choices: shuffle(ch), e: '', lvl: -1 });
      });
      return shuffle(out).slice(0, 45);
    }

    var STOP = {};
    'about after again also because before between could during each every first from have into more most other over same should some such than that their them then there these they this those through under very what when where which while with would your'.split(' ').forEach(function (w) { STOP[w] = 1; });

    function fromText(text) {
      var items = String(text || '').replace(/[ \t]+/g, ' ').split(/(?:[.!?]+\s+)|\n+/).map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length >= 30 && s.length <= 170; })
        .map(function (s) {
          var w = (s.match(/[A-Za-z0-9][A-Za-z0-9'-]{3,}/g) || []).filter(function (x) { return !STOP[x.toLowerCase()]; });
          if (!w.length) return null;
          var score = function (x) { return x.length + (/^[A-Z0-9]/.test(x) && s.indexOf(x) > 0 ? 3 : 0); };
          w.sort(function (a, b) { return score(b) - score(a); });
          return { s: s, k: w[0] };
        }).filter(Boolean);
      var out = [];
      items.forEach(function (it, i) {
        var ds = [...new Set(items.filter(function (_, j) { return j !== i; }).map(function (o) { return o.k; })
          .filter(function (k) { return k.toLowerCase() !== it.k.toLowerCase(); }))];
        ds = shuffle(ds).slice(0, 2);
        if (ds.length >= 2) {
          out.push({ q: 'Fill in the blank: ' + it.s.replace(it.k, '_____'), a: it.k, choices: shuffle([it.k].concat(ds)), e: it.s, lvl: -1 });
        }
      });
      return out.slice(0, 45);
    }

    function fromNotes() {
      var text = '';
      try { text = (S.notes || []).map(function (n) { return (n.title ? n.title + ': ' : '') + (n.body || ''); }).join('\n\n'); } catch (e) {}
      return fromText(text);
    }

    /* ---- AI: questions from an uploaded file ---- */
    function callGameAI(text) {
      var url = (typeof AI_WORKER_URL !== 'undefined') ? AI_WORKER_URL : '';
      var body = { mode: 'game', text: String(text).slice(0, 20000), count: 12 };
      try { body.device = DEVID; } catch (e) {}
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) {
          return r.text().then(function (t) {
            var d = {}; try { d = JSON.parse(t); } catch (e) {}
            if (!r.ok) throw new Error((d.error && (d.error.message || d.error)) || ('Server error ' + r.status));
            return d;
          });
        });
    }

    /* The worker answers with the Gemini envelope; pull the JSON text out of it. */
    function unwrapAI(d) {
      if (!d || typeof d !== 'object') return {};
      if (d.questions || d.cards) return d;
      var parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
      var part = parts.filter(function (x) { return x && x.text && !x.thought; })[0] || parts[0];
      var raw = part && part.text;
      if (!raw) return d;
      var clean = String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      var a = clean.indexOf('{'), b = clean.lastIndexOf('}');
      if (a !== -1 && b > a) clean = clean.slice(a, b + 1);
      try { return JSON.parse(clean); } catch (e) { return d; }
    }

    function normalizeAI(d) {
      d = unwrapAI(d);
      var list = (d && (d.questions || d.cards)) || [];
      var out = [];
      list.forEach(function (x) {
        if (!x || !x.q || !x.a) return;
        var ch = Array.isArray(x.choices) ? x.choices : (Array.isArray(x.wrong) ? [x.a].concat(x.wrong) : []);
        ch = ch.filter(function (v) { return v != null && v !== ''; }).map(String);
        if (ch.indexOf(String(x.a)) < 0) ch.push(String(x.a));
        ch = [...new Set(ch)].slice(0, 4);
        if (ch.length < 3) return;
        out.push({ q: String(x.q), a: String(x.a), choices: shuffle(ch), e: String(x.e || x.explain || x.explanation || ''), lvl: typeof x.lvl === 'number' ? x.lvl : -1 });
      });
      return out;
    }

    function fileKey(f) { return f ? (f.name + ':' + f.size + ':' + (f.lastModified || 0)) : ''; }

    async function questionsForFile() {
      var f = G.file;
      if (!f) throw new Error('Choose a file first.');
      if (G.cache[fileKey(f)]) return G.cache[fileKey(f)];
      var txt = '';
      try {
        if (typeof fileText === 'function') txt = await fileText(f);
        else txt = await f.text();
      } catch (e) {
        throw new Error('That file could not be read. Try a .txt, .md, .pdf or .docx file.');
      }
      G.text = txt;
      if (!txt || txt.trim().length < 40) throw new Error('There is not enough text in that file to make questions.');
      try {
        if (typeof aiLeft === 'function' && aiLeft() <= 0) throw new Error('q');
        var d = await callGameAI(txt);
        var qs = normalizeAI(d);
        if (qs.length < 3) throw new Error('The AI sent too few questions.');
        try { S.ai.used = (S.ai.used || 0) + 1; S.ai.date = today(); persist(); } catch (e) {}
        G.cache[fileKey(f)] = qs;
        G.msg = 'AI wrote ' + qs.length + ' questions from ' + f.name + '.';
        return qs;
      } catch (e) {
        var fallback = fromText(txt);
        if (fallback.length < 3) {
          throw new Error(e.message === 'q' ? 'No AI uses left today. This file needs AI or longer notes.' : 'The AI could not read that file (' + e.message + ').');
        }
        G.cache[fileKey(f)] = fallback;
        G.msg = 'Built ' + fallback.length + ' questions from the file offline' + (e.message === 'q' ? ' (no AI uses left today).' : ' (cloud AI unavailable).');
        return fallback;
      }
    }

    async function collect() {
      if (G.src === 'gk') return gkQuestions();
      if (G.src === 'cards') {
        var c = fromDecks();
        if (c.length < 3) throw new Error(S.decks && S.decks.length ? 'Those decks need at least 3 cards with answers.' : 'No flashcards yet. Make a deck in Learning Techniques first.');
        return c;
      }
      if (G.src === 'notes') {
        var n = fromNotes();
        if (n.length < 3) throw new Error(S.notes && S.notes.length ? 'Your notes need a few longer sentences to make questions.' : 'No notes yet. Write a note first, or use General Knowledge.');
        return n;
      }
      return questionsForFile();
    }

    /* ================= BRIDGE TO THE 3D GAME ================= */
    function loadEngine() {
      if (window.ssRun) return Promise.resolve(true);
      return new Promise(function (resolve, reject) {
        var done = false;
        var s = document.createElement('script');
        s.type = 'module';
        s.src = 'js/buddyrun.js';
        s.onload = function () {
          if (done) return;
          var tries = 0;
          (function wait() {
            if (window.ssRun) { done = true; resolve(true); return; }
            if (++tries > 40) { done = true; reject(new Error('The 3D engine did not start.')); return; }
            setTimeout(wait, 50);
          })();
        };
        s.onerror = function () { if (!done) { done = true; reject(new Error('The 3D engine could not be loaded.')); } };
        document.head.appendChild(s);
      });
    }

    function awardRun(stats) {
      var g = saved(), got = [];
      TASKS.forEach(function (t) {
        var v = Number(stats[t.key]) || 0;
        if (v > (g.prog[t.id] || 0)) g.prog[t.id] = v;
        if (v >= t.n && !g.done[t.id]) { g.done[t.id] = 1; g.coins += t.r; got.push({ t: t.t, r: t.r }); }
      });
      g.coins += Number(stats.coins) || 0;
      if (stats.dist > g.best) g.best = stats.dist;
      g.runs++;
      persist();
      return { tasks: got, bank: g.coins };
    }

    async function play() {
      if (G.loading) return;
      G.err = ''; G.msg = '';
      G.loading = true;
      renderGame();
      try {
        var qs = await collect();
        if (!qs || qs.length < 3) throw new Error('I need at least 3 questions to start a run.');
        G.qs = qs;
        await loadEngine();
        G.loading = false;
        renderGame();
        var g = saved();
        document.documentElement.classList.add('gr-lock');
        var ok = window.ssRun.start({
          character: G.char,
          questions: qs,
          best: g.best,
          onEnd: function (stats) {
            var extra = awardRun(stats);
            try { if (typeof banner === 'function' && extra.tasks.length) banner('Task complete! +' + extra.tasks.reduce(function (a, t) { return a + t.r; }, 0) + ' coins'); } catch (e) {}
            return extra;
          },
          onQuit: function () {
            document.documentElement.classList.remove('gr-lock');
            G.tab = 'lobby';
            try { render(); } catch (e) {}
          },
          onError: function () {
            G.err = 'This device could not start the 3D runner.';
            document.documentElement.classList.remove('gr-lock');
            renderGame();
          }
        });
        if (!ok) { G.err = 'This device could not start the 3D runner.'; G.loading = false; renderGame(); }
      } catch (e) {
        G.loading = false;
        G.err = e && e.message ? e.message : 'Could not start the run.';
        renderGame();
      }
    }

    /* ================= VIEWS ================= */
    function coinChip(g) {
      return '<span class="g-coin">' + ico('coins') + '<b>' + (g.coins || 0) + '</b></span>';
    }

    function buddyCard(kind, name, tag, g) {
      var art = '';
      try { art = window.SB_AVATAR ? window.SB_AVATAR(kind) : ''; } catch (e) {}
      var on = G.char === kind;
      return '<button type="button" class="g-buddy' + (on ? ' on' : '') + '" data-games="char" data-v="' + kind + '" aria-pressed="' + on + '" style="--bc:' + (kind === 'life' ? '#c98a4b' : '#c46a8c') + '">' +
        '<span class="g-buddy-art">' + art + '</span>' +
        '<b>' + name + '</b><small>' + tag + '</small>' +
        '<span class="g-tick" aria-hidden="true">' + (on ? '&#10003;' : '') + '</span></button>';
    }

    function srcButton(v, label) {
      return '<button type="button" class="' + (G.src === v ? 'on' : '') + '" data-games="src" data-v="' + v + '" aria-pressed="' + (G.src === v) + '">' + label + '</button>';
    }

    function hubView() {
      var g = saved();
      return '<button class="ghost g-back" type="button" data-games="back">' + ico('back') + 'Techniques</button>' +
        '<div class="g-head"><div><h1>Study Games</h1><p class="sub">Run, answer, and earn coins for your buddy</p></div>' + coinChip(g) + '</div>' +
        '<div class="g-top">' +
          '<button type="button" class="g-quick" data-games="tasks"><span class="g-quick-art">' + ico('tasks') + '</span><span class="g-quick-txt"><b>Tasks</b><small>Earn coins</small></span><span class="g-quick-go" aria-hidden="true">' + ico('arrow') + '</span></button>' +
          '<button type="button" class="g-quick" data-games="store"><span class="g-quick-art">' + ico('store') + '</span><span class="g-quick-txt"><b>Accessories</b><small>Try it on</small></span><span class="g-quick-go" aria-hidden="true">' + ico('arrow') + '</span></button>' +
        '</div>' +
        '<div class="g-lbl">Games</div>' +
        '<div class="g-games">' +
          '<button type="button" class="g-run" data-games="lobby" style="background-image:linear-gradient(90deg,rgba(17,30,24,.9) 0%,rgba(17,30,24,.56) 48%,rgba(17,30,24,0) 72%),url(\'./icons/buddy-run-thumb.png\')" aria-label="Buddy Run, 3-lane quiz runner">' +
            '<span class="g-run-txt"><small>3-lane quiz runner</small><b>Buddy Run</b><span class="g-run-cta">Play</span></span>' +
            '<span class="g-run-fade" aria-hidden="true"></span>' +
          '</button>' +
          '<div class="g-wide is-soon" role="img" aria-label="Coming Soon, new study game">' +
            '<span class="g-wide-art">' + ico('lock') + '</span>' +
            '<span class="g-wide-txt"><b>Coming Soon</b><small>New study game</small></span>' +
          '</div>' +
          '<div class="g-wide is-soon" role="img" aria-label="Coming Soon, new study game">' +
            '<span class="g-wide-art">' + ico('lock') + '</span>' +
            '<span class="g-wide-txt"><b>Coming Soon</b><small>New study game</small></span>' +
          '</div>' +
        '</div>' +
        '<p class="g-note">' + ico('spark') + '<span>Coins are earned by running and by studying. Best run: <b>' + (g.best || 0) + ' m</b></p>';
    }

    function lobbyView() {
      var g = saved();
      var srcPanel = '';
      if (G.src === 'gk') {
        srcPanel = '<p class="g-src-note">' + GK.length + ' built-in questions. Works offline, any time.</p>';
      } else if (G.src === 'cards') {
        var decks = (S.decks || []).length, cards = 0;
        try { (S.decks || []).forEach(function (d) { cards += (d.cards || []).length; }); } catch (e) {}
        srcPanel = '<p class="g-src-note">' + (cards ? cards + ' cards from ' + decks + ' deck' + (decks === 1 ? '' : 's') + ' in Flashcards.' : 'No flashcards yet. Open Flashcards in Learning Techniques to make a deck.') + '</p>';
      } else if (G.src === 'notes') {
        var notes = (S.notes || []).length;
        srcPanel = '<p class="g-src-note">' + (notes ? 'Questions come from your ' + notes + ' saved note' + (notes === 1 ? '' : 's') + '.' : 'No notes yet. Write a note in Academics first.') + '</p>';
      } else {
        var ai = 0; try { ai = typeof aiLeft === 'function' ? aiLeft() : 0; } catch (e) {}
        srcPanel = '<label class="g-upload">' + ico('spark') + '<span>' + (G.file ? esc(G.file.name) : 'Choose a file (.txt, .md, .pdf, .docx)') + '</span>' +
          '<input type="file" id="gFile" accept=".txt,.md,.csv,.pdf,.docx,text/plain,application/pdf"></label>' +
          '<p class="g-src-note">The AI writes the questions. Uses 1 of your ' + ai + ' daily AI uses; if that runs out it builds them from the file offline.</p>';
      }
      return '<button class="ghost g-back" type="button" data-games="hub">' + ico('back') + 'Study Games</button>' +
        '<div class="g-head"><div><h1>Buddy Run</h1><p class="sub">Pick your buddy and where questions come from</p></div>' + coinChip(g) + '</div>' +
        '<div class="g-lbl">Your buddy</div>' +
        '<div class="g-buddies">' + buddyCard('study', 'StudyBuddy', 'Glasses & grit', g) + buddyCard('life', 'LifeBuddy', 'Sprout & second chances', g) + '</div>' +
        '<div class="g-lbl">Questions from</div>' +
        '<div class="g-seg" role="group" aria-label="Question source">' + srcButton('gk', 'General') + srcButton('cards', 'Flashcards') + srcButton('notes', 'Notes') + srcButton('file', 'Upload') + '</div>' +
        '<div class="g-src">' + srcPanel + '</div>' +
        (G.msg ? '<p class="g-ok">' + esc(G.msg) + '</p>' : '') +
        (G.err ? '<p class="g-err" role="alert">' + esc(G.err) + '</p>' : '') +
        '<div class="g-actions"><button type="button" class="g-play" id="gPlay" data-games="play"' + (G.loading ? ' disabled' : '') + '>' +
          (G.loading ? '<i class="g-spin" aria-hidden="true"></i>Preparing your run' : 'Play') + '</button></div>' +
        '<div class="g-facts"><span><b>' + (g.best || 0) + ' m</b>best run</span><span><b>' + (g.runs || 0) + '</b>runs played</span><span><b>' + g.coins + '</b>coins</span></div>' +
        '<div class="g-shortcuts">' +
          '<button type="button" class="g-short" data-games="tasks">' + ico('tasks') + '<span><b>Tasks</b><small>Earn coins</small></span></button>' +
          '<button type="button" class="g-short" data-games="store">' + ico('store') + '<span><b>Accessories</b><small>Fitting room</small></span></button>' +
        '</div>' +
        '<p class="g-tip">Lives: <b>3 hearts</b> · <b>2/2</b> correct answers win a heart back · <b>3 skips</b> per run · LifeBuddy rescues you once.</p>';
    }

    function tasksView() {
      var g = saved();
      var rows = TASKS.map(function (t) {
        var v = Math.min(t.n, g.prog[t.id] || 0), done = !!g.done[t.id];
        return '<div class="g-task' + (done ? ' done' : '') + '"><div class="g-task-main"><b>' + esc(t.t) + '</b>' +
          '<span class="g-prog"><i><b style="width:' + Math.round((v / t.n) * 100) + '%"></b></i><small>' + v + '/' + t.n + '</small></span></div>' +
          '<span class="g-reward">' + (done ? '&#10003;' : '+' + t.r) + '</span></div>';
      }).join('');
      var acad = ACAD.map(function (t) {
        var ok = acadDone(t.id), done = !!g.done['a:' + t.id];
        return '<div class="g-task' + (done ? ' done' : '') + '"><div class="g-task-main"><b>' + esc(t.t) + '</b><small>' + esc(t.sub) + '</small></div>' +
          (done ? '<span class="g-reward">&#10003;</span>' : ok ? '<button type="button" class="g-claim" data-games="claim" data-v="' + t.id + '">Claim +' + t.r + '</button>' : '<span class="g-reward muted">+' + t.r + '</span>') + '</div>';
      }).join('');
      return '<button class="ghost g-back" type="button" data-games="lobby">' + ico('back') + 'Buddy Run</button>' +
        '<div class="g-head"><div><h1>Tasks</h1><p class="sub">Coins only, no XP to juggle</p></div>' + coinChip(g) + '</div>' +
        '<div class="g-lbl">In the run <small>resets daily</small></div><div class="g-card">' + rows + '</div>' +
        '<div class="g-lbl">In StudySpace <small>resets daily</small></div><div class="g-card">' + acad + '</div>' +
        '<p class="g-tip">Coins are the only reward, and they only buy buddy accessories. The store opens soon.</p>';
    }

    function storeView() {
      var g = saved();
      var slots = ['Caps', 'Glasses', 'Scarf', 'Backpack', 'Aura', 'Trail'].map(function (n) {
        return '<div class="g-slot"><span class="g-slot-art">' + ico('lock') + '</span><b>' + n + '</b><small>Coming soon</small></div>';
      }).join('');
      var fitName = G.fit === 'life' ? 'LifeBuddy' : G.fit === 'duo' ? 'StudyBuddy &amp; LifeBuddy' : 'StudyBuddy';
      return '<button class="ghost g-back" type="button" data-games="lobby">' + ico('back') + 'Buddy Run</button>' +
        '<div class="g-head"><div><h1>Accessories</h1><p class="sub">Spin your buddies in the fitting room</p></div>' + coinChip(g) + '</div>' +
        '<div class="g-fit">' +
          '<div class="g-fit-stage" id="gFit" data-b3d-manual aria-label="3D fitting room preview"><span class="g-fit-glow" aria-hidden="true"></span></div>' +
          '<div class="g-fit-views" role="group" aria-label="Fitting room view">' +
            '<button type="button" data-games="fit" data-v="study" class="' + (G.fit === 'study' ? 'on' : '') + '" aria-pressed="' + (G.fit === 'study') + '">StudyBuddy</button>' +
            '<button type="button" data-games="fit" data-v="life" class="' + (G.fit === 'life' ? 'on' : '') + '" aria-pressed="' + (G.fit === 'life') + '">LifeBuddy</button>' +
            '<button type="button" data-games="fit" data-v="duo" class="' + (G.fit === 'duo' ? 'on' : '') + '" aria-pressed="' + (G.fit === 'duo') + '">Duo View</button>' +
          '</div>' +
          '<div class="g-fit-meta"><b>' + fitName + '</b><small>Drag to spin</small></div>' +
        '</div>' +
        '<div class="g-soon"><span class="g-soon-art">' + ico('spark') + '</span><b>Accessories coming soon</b><small>Try the fitting room now. Caps, glasses, scarves and trails arrive in a later update.</small></div>' +
        '<div class="g-grid">' + slots + '</div>' +
        '<p class="g-tip">Nothing is for sale yet, so no coins can be spent by mistake.</p>';
    }

    function gameView() {
      try { G.char = saved().char === 'life' ? 'life' : 'study'; } catch (e) {}
      var t = G.tab;
      if (t === 'lobby') return lobbyView();
      if (t === 'tasks') return tasksView();
      if (t === 'store') return storeView();
      return hubView();
    }

    /* The Buddy Run lobby takes over the screen: the tab bar is out of the way
       while you pick a buddy and start a run. */
    function syncNav() {
      try {
        var on = typeof hv !== 'undefined' && hv === 'games' && G.tab === 'lobby';
        document.documentElement.classList.toggle('gr-navless', !!on);
      } catch (e) {}
    }

    function mountFit() {
      if (G.tab !== 'store') return;
      var tries = 0;
      (function go() {
        var el = document.getElementById('gFit');
        if (!el) return;
        if (window.ssMascot) {
          try { window.ssMascot.fitting(el, G.fit); } catch (e) {}
          return;
        }
        if (tries++ > 50) return;
        setTimeout(go, 100);
      })();
    }

    function renderGame() {
      try { if (typeof render === 'function') render(); } catch (e) {}
      syncNav();
      mountFit();
      try { var v = document.getElementById('view'); if (v) v.scrollTop = 0; } catch (e) {}
    }

    /* ================= EVENTS ================= */
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-games]') : null;
      if (!b) return;
      var act = b.dataset.games, v = b.dataset.v;
      if (act === 'open') { try { hv = 'games'; G.tab = 'hub'; render(); syncNav(); var el = document.getElementById('view'); if (el) el.scrollTop = 0; } catch (err) {} return; }
      if (act === 'back') { try { hv = 'learn'; L = null; render(); syncNav(); } catch (err) {} return; }
      if (act === 'hub' || act === 'lobby' || act === 'tasks' || act === 'store') {
        G.tab = act; G.err = ''; G.msg = ''; renderGame();
        return;
      }
      if (act === 'char') {
        /* Toggle in place: both 3D buddy previews stay mounted, so switching
           never rebuilds WebGL scenes or re-compiles geometry. */
        var next = v === 'life' ? 'life' : 'study';
        if (next === G.char) return;
        G.char = next;
        try { saved().char = G.char; persist(); } catch (err) {}
        document.querySelectorAll('[data-games="char"]').forEach(function (b) {
          var on = b.dataset.v === G.char;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          var tick = b.querySelector('.g-tick');
          if (tick) tick.innerHTML = on ? '&#10003;' : '';
        });
        return;
      }
      if (act === 'fit') {
        G.fit = v === 'life' ? 'life' : v === 'duo' ? 'duo' : 'study';
        /* switch in place so the fitting room keeps its rotation and context */
        var stage = document.getElementById('gFit');
        if (stage && window.ssMascot) { try { window.ssMascot.fitting(stage, G.fit); } catch (err) {} }
        document.querySelectorAll('[data-games="fit"]').forEach(function (b) {
          var on = b.dataset.v === G.fit;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        var meta = document.querySelector('.g-fit-meta b');
        if (meta) meta.textContent = G.fit === 'life' ? 'LifeBuddy' : G.fit === 'duo' ? 'StudyBuddy & LifeBuddy' : 'StudyBuddy';
        return;
      }
      if (act === 'tab') { G.tab = v || 'hub'; renderGame(); return; }
      if (act === 'src') { G.src = ['gk', 'cards', 'notes', 'file'].indexOf(v) >= 0 ? v : 'gk'; G.err = ''; G.msg = ''; renderGame(); return; }
      if (act === 'play') { play(); return; }
      if (act === 'claim') {
        var g = saved(), task = null;
        ACAD.forEach(function (t) { if (t.id === v) task = t; });
        if (!task || g.done['a:' + task.id] || !acadDone(task.id)) return;
        g.done['a:' + task.id] = 1;
        g.coins += task.r;
        persist();
        try { if (typeof banner === 'function') banner('+' + task.r + ' coins added'); } catch (err) {}
        renderGame();
        return;
      }
    });

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || el.id !== 'gFile') return;
      var f = el.files && el.files[0];
      G.file = f || null;
      G.msg = f ? f.name + ' selected' : '';
      G.err = '';
      renderGame();
    });

    /* Record when an assignment is ticked, so the academic task can tell it
       happened today. Purely additive: the checkbox keeps its own behaviour. */
    document.addEventListener('click', function (e) {
      var box = e.target && e.target.closest ? e.target.closest('input[data-done]') : null;
      if (!box) return;
      var id = box.dataset.done;
      setTimeout(function () {
        try {
          var t = (S.tasks || []).filter(function (x) { return x.id === id; })[0];
          if (t && t.done && !t.doneAt) t.doneAt = Date.now();
          if (t && !t.done) delete t.doneAt;
          save();
        } catch (err) {}
      }, 60);
    }, true);

    /* Stop the engine if the student leaves the view some other way. */
    function watchdog() {
      try {
        if (window.ssRun && window.ssRun.current && !document.getElementById('gr')) window.ssRun.stop();
        if (!document.getElementById('gr')) document.documentElement.classList.remove('gr-lock');
        var inLobby = typeof hv !== 'undefined' && hv === 'games' && G.tab === 'lobby';
        document.documentElement.classList.toggle('gr-navless', !!inLobby);
      } catch (e) {}
    }

    window.ssGames = {
      view: function () { try { return gameView(); } catch (e) { return '<div class="card">Study Games could not load.</div>'; } },
      tab: function (t) { G.tab = t || 'hub'; },
      open: function () { G.tab = 'hub'; },
      reset: function () { G.tab = 'hub'; G.loading = false; G.err = ''; G.msg = ''; try { syncNav(); } catch (e) {} try { watchdog(); } catch (e) {} },
      coins: function () { return saved().coins; },
      watchdog: watchdog
    };
  } catch (err) {
    try { console.error('Study Games failed to load', err); } catch (e) {}
  }
})();
