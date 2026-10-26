/* ===== Fantasy Roster Builder (issue #102) START ===== */
(function () {
  'use strict';

  // ---- Constants: tweak the game rules here ----
  var SALARY_CAP = 50000;            // total budget in dollars
  var SYNERGY_MAX_BONUS = 0.20;      // a 100 synergy team adds +20% to projected points
  var SYNERGY_ROLE_POINTS = 10;      // synergy points per filled role slot (max 50)
  var SYNERGY_PAIR_POINTS = 8;       // per pair of teammates on the roster ...
  var SYNERGY_PAIR_CAP = 30;         // ... capped at this
  var SYNERGY_IGL_POINTS = 10;       // per teammate of the drafted IGL ...
  var SYNERGY_IGL_CAP = 20;          // ... capped at this
  var STORAGE_KEY = 'vortex-fantasy-roster-v1';

  var ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'IGL'];
  var ROLE_COLOR = { Duelist: '#f43f5e', Initiator: '#f59e0b', Controller: '#06b6d4', Sentinel: '#22c55e', IGL: '#a855f7' };
  var ROLE_ICON = {
    Duelist: 'M5 19L19 5M15 5h4v4M7 14l3 3M4 20l2-2',
    Initiator: 'M4 12h13M12 6l6 6-6 6',
    Controller: 'M7 18a4 4 0 010-8 5 5 0 019.5-1A4.5 4.5 0 0117 18z',
    Sentinel: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    IGL: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z'
  };

  // Demo pool (made-up handles and numbers). salary in dollars, pts = projected fantasy points per match.
  var POOL = [
    { id: 'zenith',  name: 'ZENITH',  team: 'Phantom Squad', role: 'Duelist',    salary: 12800, pts: 48.5 },
    { id: 'kairo',   name: 'KAIRO',   team: 'Team Cyber',    role: 'Duelist',    salary: 11400, pts: 44.0 },
    { id: 'drift',   name: 'DRIFT',   team: 'Neon Riders',   role: 'Duelist',    salary: 9200,  pts: 37.5 },
    { id: 'rook',    name: 'ROOK',    team: 'Apex Titans',   role: 'Duelist',    salary: 7000,  pts: 29.0 },
    { id: 'pulse',   name: 'PULSE',   team: 'Team Cyber',    role: 'Initiator',  salary: 11800, pts: 42.0 },
    { id: 'sable',   name: 'SABLE',   team: 'Neon Riders',   role: 'Initiator',  salary: 10200, pts: 38.5 },
    { id: 'quill',   name: 'QUILL',   team: 'Apex Titans',   role: 'Initiator',  salary: 8400,  pts: 33.0 },
    { id: 'wren',    name: 'WREN',    team: 'Phantom Squad', role: 'Initiator',  salary: 6600,  pts: 26.5 },
    { id: 'nimbus',  name: 'NIMBUS',  team: 'Apex Titans',   role: 'Controller', salary: 11000, pts: 40.0 },
    { id: 'haze',    name: 'HAZE',    team: 'Phantom Squad', role: 'Controller', salary: 9800,  pts: 36.0 },
    { id: 'ember',   name: 'EMBER',   team: 'Team Cyber',    role: 'Controller', salary: 8000,  pts: 31.5 },
    { id: 'frost',   name: 'FROST',   team: 'Neon Riders',   role: 'Controller', salary: 6200,  pts: 24.5 },
    { id: 'warden',  name: 'WARDEN',  team: 'Neon Riders',   role: 'Sentinel',   salary: 10800, pts: 39.0 },
    { id: 'anvil',   name: 'ANVIL',   team: 'Apex Titans',   role: 'Sentinel',   salary: 9400,  pts: 35.0 },
    { id: 'lock',    name: 'LOCK',    team: 'Team Cyber',    role: 'Sentinel',   salary: 7600,  pts: 30.0 },
    { id: 'ward',    name: 'WARD',    team: 'Phantom Squad', role: 'Sentinel',   salary: 6000,  pts: 23.0 },
    { id: 'oracle',  name: 'ORACLE',  team: 'Team Cyber',    role: 'IGL',        salary: 10000, pts: 36.5 },
    { id: 'maestro', name: 'MAESTRO', team: 'Phantom Squad', role: 'IGL',        salary: 9000,  pts: 33.0 },
    { id: 'marshal', name: 'MARSHAL', team: 'Apex Titans',   role: 'IGL',        salary: 7800,  pts: 29.5 },
    { id: 'cadet',   name: 'CADET',   team: 'Neon Riders',   role: 'IGL',        salary: 5800,  pts: 21.0 }
  ];

  // ---- State ----
  var roster = {};            // role -> player id (or null)
  var filterRole = 'All';
  var sortMode = 'salary-desc';
  var els = {};
  var byId = {};
  POOL.forEach(function (p) { byId[p.id] = p; });
  ROLES.forEach(function (r) { roster[r] = null; });

  // ---- Pure helpers (rules) ----
  function money(n) { return '$' + n.toLocaleString('en-US'); }

  function drafted() {
    return ROLES.map(function (r) { return roster[r] ? byId[roster[r]] : null; }).filter(Boolean);
  }

  function spent() {
    return drafted().reduce(function (sum, p) { return sum + p.salary; }, 0);
  }

  // Net change in spend if `player` takes its role slot (replacing whoever is there).
  function netCost(player) {
    var current = roster[player.role] ? byId[roster[player.role]] : null;
    return player.salary - (current ? current.salary : 0);
  }

  function computeSynergy(team) {
    var counts = {};
    team.forEach(function (p) { counts[p.team] = (counts[p.team] || 0) + 1; });
    var pairs = 0;
    Object.keys(counts).forEach(function (t) { pairs += counts[t] * (counts[t] - 1) / 2; });
    var igl = roster.IGL ? byId[roster.IGL] : null;
    var iglMates = igl ? counts[igl.team] - 1 : 0;
    var parts = {
      coverage: team.length * SYNERGY_ROLE_POINTS,
      chemistry: Math.min(pairs * SYNERGY_PAIR_POINTS, SYNERGY_PAIR_CAP),
      iglLink: Math.min(iglMates * SYNERGY_IGL_POINTS, SYNERGY_IGL_CAP)
    };
    parts.total = Math.min(parts.coverage + parts.chemistry + parts.iglLink, 100);
    return parts;
  }

  function computeProjection(team) {
    var base = team.reduce(function (sum, p) { return sum + p.pts; }, 0);
    var syn = computeSynergy(team);
    var multiplier = 1 + (syn.total / 100) * SYNERGY_MAX_BONUS;
    return { base: base, synergy: syn, multiplier: multiplier, total: base * multiplier };
  }

  // ---- DOM helpers (textContent only, never innerHTML) ----
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function roleIcon(role) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'fr-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ROLE_ICON[role]);
    svg.appendChild(path);
    return svg;
  }

  function say(message) { els.status.textContent = message; }

  // ---- Persistence (optional, never required) ----
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(roster)); } catch (e) { /* storage blocked */ }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return false; }
    if (!data || typeof data !== 'object') return false;
    var next = {};
    var total = 0;
    ROLES.forEach(function (r) {
      var p = typeof data[r] === 'string' && Object.prototype.hasOwnProperty.call(byId, data[r]) ? byId[data[r]] : null;
      if (p && p.role === r) { next[r] = p.id; total += p.salary; } else { next[r] = null; }
    });
    if (total > SALARY_CAP) return false;   // tampered or outdated save: ignore it
    ROLES.forEach(function (r) { roster[r] = next[r]; });
    return true;
  }

  // ---- Actions ----
  function draft(player) {
    var cost = netCost(player);
    var left = SALARY_CAP - spent();
    if (cost > left) {
      say("Can't draft " + player.name + ': it needs ' + money(cost) + ' but only ' + money(left) + ' of cap is left.');
      return;
    }
    var replaced = roster[player.role] ? byId[roster[player.role]] : null;
    roster[player.role] = player.id;
    save();
    render();
    say(replaced
      ? player.name + ' replaces ' + replaced.name + ' at ' + player.role + '. ' + money(SALARY_CAP - spent()) + ' cap left.'
      : player.name + ' drafted as ' + player.role + '. ' + money(SALARY_CAP - spent()) + ' cap left.');
    if (drafted().length === ROLES.length) say(els.status.textContent + ' Roster complete.');
  }

  function release(role) {
    var p = roster[role] ? byId[roster[role]] : null;
    if (!p) return;
    roster[role] = null;
    save();
    render();
    say(p.name + ' removed from ' + role + '. ' + money(SALARY_CAP - spent()) + ' cap left.');
  }

  function clearAll() {
    ROLES.forEach(function (r) { roster[r] = null; });
    save();
    render();
    say('Roster cleared. ' + money(SALARY_CAP) + ' cap available.');
  }

  // ---- Rendering ----
  function renderDashboard() {
    var used = spent();
    var left = SALARY_CAP - used;
    var team = drafted();
    var proj = computeProjection(team);
    var pct = Math.min(used / SALARY_CAP, 1) * 100;

    els.meterFill.style.width = pct + '%';
    els.meterFill.classList.toggle('fr-warn', pct >= 85);
    els.meter.setAttribute('aria-valuenow', String(used));
    els.meter.setAttribute('aria-valuetext', money(used) + ' of ' + money(SALARY_CAP) + ' used, ' + money(left) + ' left');
    els.spent.textContent = money(used);
    els.left.textContent = money(left);
    els.count.textContent = team.length + ' / ' + ROLES.length;

    els.synergyFill.style.width = proj.synergy.total + '%';
    els.synergyBar.setAttribute('aria-valuenow', String(proj.synergy.total));
    els.synergy.textContent = String(proj.synergy.total);
    els.synergyDetail.textContent = 'Role coverage +' + proj.synergy.coverage +
      ' | Teammate chemistry +' + proj.synergy.chemistry + ' | IGL link +' + proj.synergy.iglLink;
    els.basePts.textContent = proj.base.toFixed(1);
    els.mult.textContent = 'x' + proj.multiplier.toFixed(2);
    els.totalPts.textContent = proj.total.toFixed(1);
  }

  function renderSlots() {
    els.slots.replaceChildren();
    ROLES.forEach(function (role) {
      var p = roster[role] ? byId[roster[role]] : null;
      var slot = el('li', 'fr-slot' + (p ? ' fr-filled' : ''));
      slot.style.setProperty('--role', ROLE_COLOR[role]);

      var head = el('div', 'fr-slot-head');
      head.appendChild(roleIcon(role));
      head.appendChild(el('span', 'fr-slot-role', role));
      slot.appendChild(head);

      if (p) {
        slot.appendChild(el('div', 'fr-slot-name', p.name));
        slot.appendChild(el('div', 'fr-slot-team', p.team));
        slot.appendChild(el('div', 'fr-slot-meta', money(p.salary) + ' | ' + p.pts.toFixed(1) + ' pts'));
        var rm = el('button', 'fr-btn fr-btn-ghost', 'Remove');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + p.name + ' from ' + role);
        rm.dataset.focusKey = 'rm-' + role;
        rm.addEventListener('click', function () { release(role); });
        slot.appendChild(rm);
      } else {
        slot.appendChild(el('div', 'fr-slot-empty', 'Open ' + role + ' slot'));
        var show = el('button', 'fr-btn fr-btn-ghost', 'Show ' + role + 's');
        show.type = 'button';
        show.dataset.focusKey = 'show-' + role;
        show.addEventListener('click', function () {
          filterRole = role;
          render();
          say('Showing ' + role + ' players.');
        });
        slot.appendChild(show);
      }
      els.slots.appendChild(slot);
    });
  }

  function renderFilters() {
    els.filters.replaceChildren();
    ['All'].concat(ROLES).forEach(function (r) {
      var b = el('button', 'fr-chip', r);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(filterRole === r));
      if (r !== 'All') b.style.setProperty('--role', ROLE_COLOR[r]);
      b.dataset.focusKey = 'chip-' + r;
      b.addEventListener('click', function () { filterRole = r; render(); });
      els.filters.appendChild(b);
    });
  }

  function sortedPool() {
    var list = POOL.filter(function (p) { return filterRole === 'All' || p.role === filterRole; });
    var by = {
      'salary-desc': function (a, b) { return b.salary - a.salary; },
      'salary-asc': function (a, b) { return a.salary - b.salary; },
      'pts-desc': function (a, b) { return b.pts - a.pts; },
      'name': function (a, b) { return a.name < b.name ? -1 : 1; }
    };
    return list.sort(by[sortMode]);
  }

  function renderBench() {
    var left = SALARY_CAP - spent();
    var list = sortedPool();
    els.bench.replaceChildren();
    els.benchCount.textContent = list.length + ' players shown';
    list.forEach(function (p) {
      var isIn = roster[p.role] === p.id;
      var cost = netCost(p);
      var over = !isIn && cost > left;

      var card = el('li', 'fr-card' + (isIn ? ' fr-in' : '') + (over ? ' fr-over' : ''));
      card.style.setProperty('--role', ROLE_COLOR[p.role]);

      var top = el('div', 'fr-card-top');
      top.appendChild(roleIcon(p.role));
      var who = el('div', 'fr-card-who');
      who.appendChild(el('div', 'fr-card-name', p.name));
      who.appendChild(el('div', 'fr-card-team', p.team + ' | ' + p.role));
      top.appendChild(who);
      card.appendChild(top);

      var nums = el('div', 'fr-card-nums');
      var s = el('div'); s.appendChild(el('span', 'fr-k', 'Salary')); s.appendChild(el('span', 'fr-v', money(p.salary)));
      var f = el('div'); f.appendChild(el('span', 'fr-k', 'Proj. pts')); f.appendChild(el('span', 'fr-v', p.pts.toFixed(1)));
      nums.appendChild(s); nums.appendChild(f);
      card.appendChild(nums);

      var btn = el('button', 'fr-btn');
      btn.type = 'button';
      btn.dataset.focusKey = 'pick-' + p.id;
      if (isIn) {
        btn.textContent = 'Drafted (remove)';
        btn.classList.add('fr-btn-ghost');
        btn.addEventListener('click', function () { release(p.role); });
      } else if (over) {
        btn.textContent = 'Over cap by ' + money(cost - left);
        btn.classList.add('fr-btn-blocked');
        btn.setAttribute('aria-disabled', 'true');
        btn.addEventListener('click', function () { draft(p); });   // draft() refuses and announces why
      } else {
        btn.textContent = roster[p.role] ? 'Swap in' : 'Draft';
        btn.setAttribute('aria-label', (roster[p.role] ? 'Swap in ' : 'Draft ') + p.name + ' as ' + p.role + ' for ' + money(p.salary));
        btn.addEventListener('click', function () { draft(p); });
      }
      card.appendChild(btn);
      els.bench.appendChild(card);
    });
  }

  function render() {
    var active = document.activeElement;
    var key = active && active.dataset ? active.dataset.focusKey : null;
    renderDashboard();
    renderSlots();
    renderFilters();
    renderBench();
    if (key) {
      var again = els.root.querySelector('[data-focus-key="' + key + '"]');
      if (again) again.focus();
    }
  }

  function init() {
    els.root = document.getElementById('fantasy-roster');
    if (!els.root) return;
    ['slots', 'filters', 'bench', 'status'].forEach(function (k) { els[k] = document.getElementById('fr-' + k); });
    els.meter = document.getElementById('fr-meter');
    els.meterFill = document.getElementById('fr-meter-fill');
    els.spent = document.getElementById('fr-spent');
    els.left = document.getElementById('fr-left');
    els.count = document.getElementById('fr-count');
    els.synergy = document.getElementById('fr-synergy');
    els.synergyBar = document.getElementById('fr-synergy-bar');
    els.synergyFill = document.getElementById('fr-synergy-fill');
    els.synergyDetail = document.getElementById('fr-synergy-detail');
    els.basePts = document.getElementById('fr-base');
    els.mult = document.getElementById('fr-mult');
    els.totalPts = document.getElementById('fr-total');
    els.benchCount = document.getElementById('fr-bench-count');

    els.meter.setAttribute('aria-valuemax', String(SALARY_CAP));
    document.getElementById('fr-cap-label').textContent = money(SALARY_CAP);

    var sort = document.getElementById('fr-sort');
    sort.addEventListener('change', function () { sortMode = sort.value; render(); });
    document.getElementById('fr-clear').addEventListener('click', clearAll);

    var restored = load();
    render();
    if (restored && drafted().length) say('Restored your saved roster (' + drafted().length + ' of ' + ROLES.length + ' slots).');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
/* ===== Fantasy Roster Builder (issue #102) END ===== */

function watchStream() {
  alert('Connecting to Vortex Esports Twitch stream feed...');
}
