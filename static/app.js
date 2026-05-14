"use strict";

const COLORS = {
  EMPTY:              "#f5f5f5",
  OBSTACLE:           "#2d3436",
  START:              "#e17055",
  GOAL:               "#6c5ce7",
  FOCAL:              "#e67e22",
  OPEN:               "#fdcb6e",
  CLOSED:             "#74b9ff",
  PATH:               "#00b894",   // on both found + optimal
  PATH_FOUND_ONLY:    "#fab1a0",   // suboptimal detour (found but not optimal)
  PATH_OPTIMAL_ONLY:  "#a29bfe",   // optimal route not taken by this algo
  GRID_LINE:          "#cccccc",
};

const ALGO_LABELS = {
  astar:  "A*",
  greedy: "Greedy BFS",
  wastar: "Weighted A*",
  ees:    "EES",
  focal:  "Focal Search",
};

const ALGO_OPTIONS = [
  { value: "astar",  label: "A* (optimal)" },
  { value: "greedy", label: "Greedy BFS" },
  { value: "wastar", label: "Weighted A*" },
  { value: "ees",    label: "EES" },
  { value: "focal",  label: "Focal Search" },
];

const HEURISTIC_OPTIONS = [
  { value: "manhattan", label: "Manhattan  (|dr|+|dc|)" },
  { value: "euclidean", label: "Euclidean  (sqrt(dr²+dc²))" },
  { value: "chebyshev", label: "Chebyshev  (max(|dr|,|dc|))" },
  { value: "octile",    label: "Octile     (diagonal approx)" },
  { value: "custom",    label: "Custom expression…" },
];

const HEURISTIC_SHORT = {
  manhattan: "Manhattan",
  euclidean: "Euclidean",
  chebyshev: "Chebyshev",
  octile:    "Octile",
  custom:    "Custom",
};

// ── State ───────────────────────────────────────────────────────────────────
var gridData    = null;
var editMode    = false;
var runnerTimer = null;

var configs = [
  { algo: "wastar", weight: 1.5, hhat: 1.5, heuristic: "manhattan", customExpr: "" },
];

// sessions[i] = { sessionId, searchState, done }
var sessions = [];

// canvasItems[i] = { canvas, ctx, labelEl, statusEl, metaTextEl }
var canvasItems = [];

// configUIRefs[i] = { showExprError(msg), clearExprError() }
var configUIRefs = [];

// ── DOM refs ────────────────────────────────────────────────────────────────
var btnGenerate, btnReset, btnStep, btnRun, btnStop;
var inpSpeed, chkEdit, configsList;

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  btnGenerate = document.getElementById("btn-generate");
  btnReset    = document.getElementById("btn-reset");
  btnStep     = document.getElementById("btn-step");
  btnRun      = document.getElementById("btn-run");
  btnStop     = document.getElementById("btn-stop");
  inpSpeed    = document.getElementById("inp-speed");
  chkEdit     = document.getElementById("chk-edit");
  configsList = document.getElementById("configs-list");

  btnGenerate.addEventListener("click", onGenerate);
  btnReset.addEventListener("click", onReset);
  btnStep.addEventListener("click", onStep);
  btnRun.addEventListener("click", onRun);
  btnStop.addEventListener("click", onStop);

  chkEdit.addEventListener("change", function () {
    editMode = chkEdit.checked;
    for (var k = 0; k < canvasItems.length; k++) {
      canvasItems[k].canvas.className = editMode ? "canvas-el edit-mode" : "canvas-el";
    }
  });

  inpSpeed.addEventListener("change", function () {
    if (runnerTimer !== null) {
      clearInterval(runnerTimer);
      runnerTimer = setInterval(autoStep, 1000 / (parseInt(inpSpeed.value) || 15));
    }
  });

  document.getElementById("btn-add-config").addEventListener("click", addConfig);

  // Load preset list and populate dropdown
  loadPresetList();

  buildConfigUI();
  onGenerate();
});

// ── Preset handling ───────────────────────────────────────────────────────────
function loadPresetList() {
  var sel = document.getElementById("sel-preset");
  if (!sel) return;
  fetch("/api/grid/presets")
    .then(function (r) { return r.json(); })
    .then(function (presets) {
      for (var i = 0; i < presets.length; i++) {
        var opt = document.createElement("option");
        opt.value       = presets[i].key;
        opt.title       = presets[i].description;
        opt.textContent = presets[i].label;
        sel.appendChild(opt);
      }
    })
    .catch(function () {});
  sel.addEventListener("change", function () {
    if (!sel.value) return;
    onLoadPreset(sel.value);
    sel.value = "";
  });
}

async function onLoadPreset(key) {
  stopRunner();
  try {
    gridData = await fetch("/api/grid/preset/" + key).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    rebuildCanvases();
  } catch (e) {
    alert("Preset error: " + e.message);
  }
}

// ── Config UI ───────────────────────────────────────────────────────────────
function needsWeight(algo) {
  return algo !== "astar" && algo !== "greedy";
}

function configLabel(cfg) {
  var base   = ALGO_LABELS[cfg.algo] || cfg.algo;
  var hShort = HEURISTIC_SHORT[cfg.heuristic] || cfg.heuristic;
  var parts  = [];
  if (needsWeight(cfg.algo)) parts.push("w=" + cfg.weight);
  parts.push(hShort);
  return base + " (" + parts.join(", ") + ")";
}

function buildConfigUI() {
  configsList.innerHTML = "";
  configUIRefs = [];
  for (var i = 0; i < configs.length; i++) {
    configsList.appendChild(makeConfigItem(i));
  }
}

function makeConfigItem(i) {
  var cfg = configs[i];

  var div = document.createElement("div");
  div.className = "config-item";
  div.setAttribute("data-index", i);

  // Header
  var header  = document.createElement("div");
  header.className = "config-header";
  var numSpan = document.createElement("span");
  numSpan.className   = "config-num";
  numSpan.textContent = "Config " + (i + 1);
  header.appendChild(numSpan);

  if (configs.length > 1) {
    var removeBtn = document.createElement("button");
    removeBtn.className   = "btn-remove-config";
    removeBtn.title       = "Remove";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("data-i", i);
    removeBtn.addEventListener("click", function (e) {
      var idx = parseInt(e.currentTarget.getAttribute("data-i"), 10);
      configs.splice(idx, 1);
      buildConfigUI();
      rebuildCanvases();
    });
    header.appendChild(removeBtn);
  }
  div.appendChild(header);

  // Algorithm row
  div.appendChild(_makeSelectRow("Algorithm", "cfg-algo", i, ALGO_OPTIONS, cfg.algo,
    function (idx, val) {
      configs[idx].algo = val;
      var item = configsList.querySelector(".config-item[data-index='" + idx + "']");
      if (item) {
        item.querySelector(".cfg-weight-row").style.display = needsWeight(val) ? "" : "none";
        item.querySelector(".cfg-hhat-row").style.display   = val === "ees"    ? "" : "none";
      }
      if (canvasItems[idx]) canvasItems[idx].labelEl.textContent = configLabel(configs[idx]);
      resetSession(idx);
    }
  ));

  // Weight row
  var weightRow = _makeNumberRow("Weight w", "cfg-weight", i, 1.0, 10.0, 0.05, cfg.weight,
    function (idx, val) {
      configs[idx].weight = val;
      if (canvasItems[idx]) canvasItems[idx].labelEl.textContent = configLabel(configs[idx]);
      resetSession(idx);
    }
  );
  weightRow.className += " cfg-weight-row";
  weightRow.style.display = needsWeight(cfg.algo) ? "" : "none";
  div.appendChild(weightRow);

  // Hhat row (EES only)
  var hhatRow = _makeNumberRow("ĥ inflation", "cfg-hhat", i, 1.0, 5.0, 0.1, cfg.hhat,
    function (idx, val) {
      configs[idx].hhat = val;
      resetSession(idx);
    }
  );
  hhatRow.className += " cfg-hhat-row";
  hhatRow.style.display = cfg.algo === "ees" ? "" : "none";
  div.appendChild(hhatRow);

  // Heuristic row
  div.appendChild(_makeSelectRow("Heuristic", "cfg-heuristic", i, HEURISTIC_OPTIONS, cfg.heuristic,
    function (idx, val) {
      configs[idx].heuristic = val;
      var item = configsList.querySelector(".config-item[data-index='" + idx + "']");
      if (item) {
        item.querySelector(".cfg-custom-row").style.display = val === "custom" ? "" : "none";
      }
      if (canvasItems[idx]) canvasItems[idx].labelEl.textContent = configLabel(configs[idx]);
      resetSession(idx);
    }
  ));

  // Custom expression row
  var customRow = document.createElement("div");
  customRow.className = "form-row cfg-custom-row";
  customRow.style.display = cfg.heuristic === "custom" ? "" : "none";
  customRow.style.flexDirection = "column";
  customRow.style.alignItems    = "flex-start";
  customRow.style.gap           = "0.25rem";

  var customLabel = document.createElement("label");
  customLabel.textContent = "Expression (vars: r, c)";
  customLabel.style.minWidth = "0";

  var exprWrap = document.createElement("div");
  exprWrap.className = "expr-wrap";

  var customInput = document.createElement("input");
  customInput.type        = "text";
  customInput.placeholder = "e.g. sqrt(r*r + c*c)";
  customInput.value       = cfg.customExpr || "";
  customInput.setAttribute("data-i", i);

  var exprTooltip = document.createElement("div");
  exprTooltip.className = "expr-tooltip";

  exprWrap.appendChild(customInput);
  exprWrap.appendChild(exprTooltip);

  var customHint = document.createElement("div");
  customHint.style.fontSize  = "0.7rem";
  customHint.style.color     = "#6c757d";
  customHint.textContent     = "vars: r, c  —  sqrt, min, max, abs, floor, ceil, pi";

  function applyValidation(val) {
    if (!val.trim()) {
      exprWrap.className = "expr-wrap";
      return;
    }
    var result = validateCustomExpr(val);
    if (result.valid) {
      exprWrap.className = "expr-wrap valid";
    } else {
      exprTooltip.textContent = result.error;
      exprWrap.className = "expr-wrap invalid";
    }
  }

  configUIRefs[i] = {
    showExprError: function (msg) {
      exprTooltip.textContent = msg;
      exprWrap.className = "expr-wrap invalid";
    },
    clearExprError: function () {
      if (exprWrap.className === "expr-wrap invalid") exprWrap.className = "expr-wrap";
    },
  };

  if (cfg.customExpr) applyValidation(cfg.customExpr);

  (function (idx) {
    customInput.addEventListener("input", function (e) {
      applyValidation(e.target.value);
    });
    customInput.addEventListener("change", function (e) {
      var val = e.target.value;
      configs[idx].customExpr = val;
      if (validateCustomExpr(val).valid) resetSession(idx);
      // if invalid, keep session intact so the user can fix it before running
    });
  }(i));

  customRow.appendChild(customLabel);
  customRow.appendChild(exprWrap);
  customRow.appendChild(customHint);
  div.appendChild(customRow);

  return div;
}

function _makeSelectRow(labelText, cls, i, options, current, onChange) {
  var row = document.createElement("div");
  row.className = "form-row";

  var lbl = document.createElement("label");
  lbl.textContent = labelText;

  var sel = document.createElement("select");
  sel.className = cls;
  sel.setAttribute("data-i", i);
  for (var j = 0; j < options.length; j++) {
    var opt = document.createElement("option");
    opt.value       = options[j].value;
    opt.textContent = options[j].label;
    if (options[j].value === current) opt.selected = true;
    sel.appendChild(opt);
  }
  (function (idx) {
    sel.addEventListener("change", function (e) { onChange(idx, e.target.value); });
  }(i));

  row.appendChild(lbl);
  row.appendChild(sel);
  return row;
}

function _makeNumberRow(labelText, cls, i, min, max, step, val, onChange) {
  var row = document.createElement("div");
  row.className = "form-row";

  var lbl = document.createElement("label");
  lbl.textContent = labelText;

  var inp = document.createElement("input");
  inp.type      = "number";
  inp.className = cls;
  inp.setAttribute("data-i", i);
  inp.min   = String(min);
  inp.max   = String(max);
  inp.step  = String(step);
  inp.value = String(val);
  (function (idx) {
    inp.addEventListener("change", function (e) { onChange(idx, parseFloat(e.target.value)); });
  }(i));

  row.appendChild(lbl);
  row.appendChild(inp);
  return row;
}

function validateCustomExpr(expr) {
  if (!expr || !expr.trim()) return { valid: false, error: "Expression is empty" };
  try {
    var result = Function(
      "r", "c", "sqrt", "min", "max", "abs", "floor", "ceil", "pi",
      '"use strict"; return (' + expr + ");")
    (3, 4, Math.sqrt, Math.min, Math.max, Math.abs, Math.floor, Math.ceil, Math.PI);
    if (typeof result !== "number") return { valid: false, error: "Must return a number (got " + typeof result + ")" };
    if (!isFinite(result))          return { valid: false, error: "Must return a finite number (got " + result + ")" };
    if (result < 0)                 return { valid: false, error: "Heuristic must be ≥ 0 (got " + result + ")" };
    return { valid: true, error: "" };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

function addConfig() {
  configs.push({ algo: "astar", weight: 1.5, hhat: 1.5, heuristic: "manhattan", customExpr: "" });
  buildConfigUI();
  rebuildCanvases();
}

// ── Canvas management ────────────────────────────────────────────────────────
function rebuildCanvases() {
  stopRunner();
  sessions    = configs.map(function () { return { sessionId: null, searchState: null, done: false }; });
  canvasItems = [];

  var container = document.getElementById("canvases-container");
  container.innerHTML = "";

  for (var i = 0; i < configs.length; i++) {
    (function (idx) {
      var cfg = configs[idx];

      var wrapper = document.createElement("div");
      wrapper.className = "canvas-item";

      var labelEl = document.createElement("div");
      labelEl.className   = "canvas-label";
      labelEl.textContent = configLabel(cfg);

      var canvas = document.createElement("canvas");
      canvas.className = "canvas-el";
      canvas.width  = 600;
      canvas.height = 600;
      canvas.addEventListener("click", function (e) { onCanvasClick(e, idx); });

      var metricsEl = document.createElement("div");
      metricsEl.className = "canvas-metrics";

      var statusEl = document.createElement("span");
      statusEl.className   = "meta-status";
      statusEl.textContent = "Ready";

      var metaTextEl = document.createElement("span");
      metaTextEl.className   = "meta-text";
      metaTextEl.textContent = "Expanded: — | Cost: — | Ratio: —";

      metricsEl.appendChild(statusEl);
      metricsEl.appendChild(metaTextEl);
      wrapper.appendChild(labelEl);
      wrapper.appendChild(canvas);
      wrapper.appendChild(metricsEl);
      container.appendChild(wrapper);

      canvasItems.push({
        canvas:     canvas,
        ctx:        canvas.getContext("2d"),
        labelEl:    labelEl,
        statusEl:   statusEl,
        metaTextEl: metaTextEl,
      });
    }(i));
  }

  resizeCanvases();
  drawAll();
}

function resizeCanvases() {
  if (!gridData || canvasItems.length === 0) return;
  var panel  = document.querySelector(".canvas-panel");
  var panelW = panel.clientWidth - 40;
  var n      = canvasItems.length;
  var gap    = 20;
  var perW   = n > 1 ? (panelW - (n - 1) * gap) / n : panelW;
  var maxPx  = Math.min(perW, 600);
  var cs     = Math.max(10, Math.floor(maxPx / Math.max(gridData.rows, gridData.cols)));
  for (var k = 0; k < canvasItems.length; k++) {
    canvasItems[k].canvas.width  = cs * gridData.cols;
    canvasItems[k].canvas.height = cs * gridData.rows;
  }
}

function drawAll() {
  for (var i = 0; i < canvasItems.length; i++) drawGrid(i);
}

function cellSize(i) {
  if (!gridData || !canvasItems[i]) return 30;
  var c = canvasItems[i].canvas;
  return Math.floor(Math.min(c.width / gridData.cols, c.height / gridData.rows));
}

function drawGrid(i) {
  if (!gridData || !canvasItems[i]) return;
  var canvas = canvasItems[i].canvas;
  var ctx    = canvasItems[i].ctx;
  var cs     = cellSize(i);
  var rows   = gridData.rows;
  var cols   = gridData.cols;
  var sess   = sessions[i];
  var state  = (sess && sess.searchState) ? sess.searchState : null;

  var openMap   = new Map();
  var focalMap  = new Map();
  var closedSet = new Set();
  var foundSet  = new Set();
  var optSet    = new Set();

  if (state) {
    var ol = state.open_list   || [];
    var fl = state.focal_list  || [];
    var cl = state.closed_list || [];
    var pl = state.path        || [];
    for (var a = 0; a < ol.length; a++) openMap.set(ol[a][0] + "," + ol[a][1], ol[a][2]);
    for (var b = 0; b < fl.length; b++) focalMap.set(fl[b][0] + "," + fl[b][1], fl[b][2]);
    for (var c2 = 0; c2 < cl.length; c2++) closedSet.add(cl[c2][0] + "," + cl[c2][1]);
    for (var d = 0; d < pl.length; d++) foundSet.add(pl[d][0] + "," + pl[d][1]);
  }

  // Build optimal path set (from gridData, always available after generate)
  var showOptimal = (state && state.found && gridData.optimal_path && gridData.optimal_path.length > 0);
  if (showOptimal) {
    var op = gridData.optimal_path;
    for (var e2 = 0; e2 < op.length; e2++) optSet.add(op[e2][0] + "," + op[e2][1]);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  var sr = gridData.start[0], sc = gridData.start[1];
  var gr = gridData.goal[0],  gc = gridData.goal[1];

  for (var r = 0; r < rows; r++) {
    for (var col = 0; col < cols; col++) {
      var x       = col * cs;
      var y       = r * cs;
      var key     = r + "," + col;
      var isStart = (r === sr && col === sc);
      var isGoal  = (r === gr && col === gc);
      var isObs   = gridData.grid[r][col] === 1;

      var fill;
      if (isObs) {
        fill = COLORS.OBSTACLE;
      } else if (isStart) {
        fill = COLORS.START;
      } else if (isGoal) {
        fill = COLORS.GOAL;
      } else if (showOptimal) {
        var inFound = foundSet.has(key);
        var inOpt   = optSet.has(key);
        if (inFound && inOpt) {
          fill = COLORS.PATH;
        } else if (inFound) {
          fill = COLORS.PATH_FOUND_ONLY;
        } else if (inOpt) {
          fill = COLORS.PATH_OPTIMAL_ONLY;
        } else if (closedSet.has(key)) {
          fill = COLORS.CLOSED;
        } else if (focalMap.has(key)) {
          fill = COLORS.FOCAL;
        } else if (openMap.has(key)) {
          fill = COLORS.OPEN;
        } else {
          fill = COLORS.EMPTY;
        }
      } else if (foundSet.has(key)) {
        fill = COLORS.PATH;
      } else if (closedSet.has(key)) {
        fill = COLORS.CLOSED;
      } else if (focalMap.has(key)) {
        fill = COLORS.FOCAL;
      } else if (openMap.has(key)) {
        fill = COLORS.OPEN;
      } else {
        fill = COLORS.EMPTY;
      }

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, cs, cs);
      ctx.strokeStyle = COLORS.GRID_LINE;
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(x, y, cs, cs);

      if ((isStart || isGoal) && cs >= 14) {
        ctx.fillStyle    = "#ffffff";
        ctx.font         = "bold " + Math.max(10, Math.floor(cs * 0.45)) + "px monospace";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isStart ? "S" : "G", x + cs / 2, y + cs / 2);
      } else if (cs >= 18 && !isObs && !foundSet.has(key) && !optSet.has(key)) {
        var h2 = focalMap.has(key) ? focalMap.get(key) : (openMap.has(key) ? openMap.get(key) : undefined);
        if (h2 !== undefined) {
          ctx.fillStyle    = "rgba(0,0,0,0.65)";
          ctx.font         = Math.max(8, Math.floor(cs * 0.33)) + "px monospace";
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(h2, x + cs / 2, y + cs / 2);
        }
      }
    }
  }
}

// ── Metrics ──────────────────────────────────────────────────────────────────
function updateMetrics(i, state) {
  if (!state || !canvasItems[i]) return;
  var statusEl   = canvasItems[i].statusEl;
  var metaTextEl = canvasItems[i].metaTextEl;

  var expanded = (state.nodes_expanded !== undefined && state.nodes_expanded !== null) ? state.nodes_expanded : "—";
  var cost     = (state.path_cost > 0) ? state.path_cost.toFixed(1) : "—";
  var ratio    = (state.subopt_ratio !== null && state.subopt_ratio !== undefined) ? state.subopt_ratio.toFixed(3) : "—";
  metaTextEl.textContent = "Expanded: " + expanded + " | Cost: " + cost + " | Ratio: " + ratio;

  if (state.found) {
    statusEl.textContent = "Path found!";
    statusEl.className   = "meta-status status-found";
  } else if (state.failed) {
    statusEl.textContent = "No path";
    statusEl.className   = "meta-status status-failed";
  } else {
    statusEl.textContent = "Searching…";
    statusEl.className   = "meta-status status-running";
  }
}

function clearMetrics(i) {
  if (!canvasItems[i]) return;
  canvasItems[i].statusEl.textContent   = "Ready";
  canvasItems[i].statusEl.className     = "meta-status";
  canvasItems[i].metaTextEl.textContent = "Expanded: — | Cost: — | Ratio: —";
}

function clearAllMetrics() {
  for (var i = 0; i < canvasItems.length; i++) clearMetrics(i);
}

// ── API ──────────────────────────────────────────────────────────────────────
async function apiFetch(endpoint, body) {
  var resp = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!resp.ok) {
    var err = await resp.json().catch(function () { return {}; });
    throw new Error(err.detail || "HTTP " + resp.status);
  }
  return resp.json();
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function onGenerate() {
  stopRunner();
  btnGenerate.disabled    = true;
  btnGenerate.textContent = "Generating…";

  var rows    = parseInt(document.getElementById("inp-rows").value)      || 15;
  var cols    = parseInt(document.getElementById("inp-cols").value)      || 15;
  var density = parseFloat(document.getElementById("inp-density").value) || 0.28;
  try {
    gridData = await apiFetch("/api/grid/generate", { rows: rows, cols: cols, obstacle_density: density });
    rebuildCanvases();
  } catch (e) {
    alert("Generate error: " + e.message);
  } finally {
    btnGenerate.disabled    = false;
    btnGenerate.textContent = "✦ New Maze";
  }
}

async function onReset() {
  stopRunner();
  sessions = configs.map(function () { return { sessionId: null, searchState: null, done: false }; });
  drawAll();
  clearAllMetrics();
}

function resetSession(i) {
  stopRunner();
  if (sessions[i]) {
    sessions[i] = { sessionId: null, searchState: null, done: false };
    drawGrid(i);
    clearMetrics(i);
  }
}

async function onStep() {
  if (!gridData) return;
  stopRunner();
  try {
    await initMissingSessions();
    var promises = sessions.map(function (sess, i) {
      return sess.done ? Promise.resolve() : stepSession(i);
    });
    await Promise.all(promises);
  } catch (e) {
    if (!e.bubbled) alert("Step error: " + e.message);
  }
}

async function onRun() {
  if (!gridData) return;
  stopRunner();
  try {
    await initMissingSessions();
    var speed = parseInt(inpSpeed.value) || 15;
    runnerTimer      = setInterval(autoStep, 1000 / speed);
    btnStop.disabled = false;
    btnRun.disabled  = true;
  } catch (e) {
    if (!e.bubbled) alert("Run error: " + e.message);
  }
}

async function autoStep() {
  var allDone = true;
  for (var k = 0; k < sessions.length; k++) {
    if (!sessions[k].done) { allDone = false; break; }
  }
  if (allDone) { stopRunner(); return; }

  var promises = sessions.map(function (sess, i) {
    return sess.done ? Promise.resolve() : stepSession(i);
  });
  await Promise.all(promises);
}

async function stepSession(i) {
  var sess = sessions[i];
  if (!sess || sess.done || !sess.sessionId) return;
  try {
    var state = await apiFetch("/api/search/step", { session_id: sess.sessionId });
    sess.searchState = state;
    drawGrid(i);
    updateMetrics(i, state);
    if (state.found || state.failed) sess.done = true;
  } catch (e) {
    sess.done = true;
  }
}

function onStop() { stopRunner(); }

async function onCanvasClick(e, i) {
  if (!editMode || !gridData) return;
  var cs   = cellSize(i);
  var rect = canvasItems[i].canvas.getBoundingClientRect();
  var col  = Math.floor((e.clientX - rect.left) / cs);
  var row  = Math.floor((e.clientY - rect.top)  / cs);
  if (row < 0 || row >= gridData.rows || col < 0 || col >= gridData.cols) return;
  try {
    var updated = await apiFetch("/api/grid/toggle", { grid_data: gridData, row: row, col: col });
    gridData = updated;
    sessions = configs.map(function () { return { sessionId: null, searchState: null, done: false }; });
    drawAll();
    clearAllMetrics();
  } catch (e) {
    alert("Toggle error: " + e.message);
  }
}

async function initMissingSessions() {
  var promises = sessions.map(function (sess, i) {
    return sess.sessionId ? Promise.resolve() : initSession(i);
  });
  await Promise.all(promises);
}

function _bubbleError(msg) {
  var e = new Error(msg);
  e.bubbled = true;
  return e;
}

async function initSession(i) {
  if (!gridData) throw new Error("No grid loaded");
  var cfg = configs[i];

  if (cfg.heuristic === "custom") {
    var check = validateCustomExpr(cfg.customExpr || "");
    if (!check.valid) {
      if (configUIRefs[i]) configUIRefs[i].showExprError(check.error);
      throw _bubbleError(check.error);
    }
  }

  try {
    var state = await apiFetch("/api/search/init", {
      grid_data:              gridData,
      algorithm:              cfg.algo,
      weight:                 cfg.weight,
      hhat_inflation:         cfg.hhat,
      heuristic:              cfg.heuristic,
      custom_heuristic_expr:  cfg.customExpr || null,
    });
    sessions[i].sessionId   = state.session_id;
    sessions[i].searchState = state;
    drawGrid(i);
    updateMetrics(i, state);
  } catch (e) {
    if (cfg.heuristic === "custom" && configUIRefs[i]) {
      configUIRefs[i].showExprError(e.message);
      throw _bubbleError(e.message);
    }
    throw e;
  }
}

function stopRunner() {
  if (runnerTimer !== null) {
    clearInterval(runnerTimer);
    runnerTimer = null;
  }
  if (btnStop) btnStop.disabled = true;
  if (btnRun)  btnRun.disabled  = false;
}
