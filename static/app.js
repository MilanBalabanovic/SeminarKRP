"use strict";

const COLORS = {
  EMPTY:     "#f5f5f5",
  OBSTACLE:  "#2d3436",
  START:     "#e17055",
  GOAL:      "#6c5ce7",
  FOCAL:     "#e67e22",
  OPEN:      "#fdcb6e",
  CLOSED:    "#74b9ff",
  PATH:      "#00b894",
  GRID_LINE: "#cccccc",
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

// ── State ───────────────────────────────────────────────────────────────────
let gridData    = null;
let editMode    = false;
let runnerTimer = null;

let configs = [
  { algo: "wastar", weight: 1.5, hhat: 1.5 },
];

// sessions[i] = { sessionId, searchState, done }
let sessions = [];

// canvasItems[i] = { canvas, ctx, labelEl, statusEl, metaTextEl }
let canvasItems = [];

// ── DOM refs ────────────────────────────────────────────────────────────────
let btnGenerate, btnReset, btnStep, btnRun, btnStop;
let inpSpeed, chkEdit, configsList;

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

  buildConfigUI();
  onGenerate();
});

// ── Config UI ───────────────────────────────────────────────────────────────
function needsWeight(algo) {
  return algo !== "astar" && algo !== "greedy";
}

function configLabel(cfg) {
  var base = ALGO_LABELS[cfg.algo] || cfg.algo;
  return needsWeight(cfg.algo) ? base + " (w = " + cfg.weight + ")" : base;
}

function buildConfigUI() {
  configsList.innerHTML = "";

  for (var i = 0; i < configs.length; i++) {
    configsList.appendChild(makeConfigItem(i));
  }
}

function makeConfigItem(i) {
  var cfg = configs[i];

  var div = document.createElement("div");
  div.className = "config-item";
  div.setAttribute("data-index", i);

  // Header row
  var header = document.createElement("div");
  header.className = "config-header";

  var numSpan = document.createElement("span");
  numSpan.className   = "config-num";
  numSpan.textContent = "Config " + (i + 1);
  header.appendChild(numSpan);

  if (configs.length > 1) {
    var removeBtn = document.createElement("button");
    removeBtn.className   = "btn-remove-config";
    removeBtn.title       = "Remove";
    removeBtn.textContent = "\u2715";
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
  var algoRow = document.createElement("div");
  algoRow.className = "form-row";
  var algoLabel = document.createElement("label");
  algoLabel.textContent = "Algorithm";
  var algoSelect = document.createElement("select");
  algoSelect.className = "cfg-algo";
  algoSelect.setAttribute("data-i", i);
  for (var j = 0; j < ALGO_OPTIONS.length; j++) {
    var opt = document.createElement("option");
    opt.value       = ALGO_OPTIONS[j].value;
    opt.textContent = ALGO_OPTIONS[j].label;
    if (ALGO_OPTIONS[j].value === cfg.algo) opt.selected = true;
    algoSelect.appendChild(opt);
  }
  (function (idx) {
    algoSelect.addEventListener("change", function (e) {
      configs[idx].algo = e.target.value;
      // update visibility of weight/hhat rows
      var item = configsList.querySelector(".config-item[data-index='" + idx + "']");
      if (item) {
        item.querySelector(".cfg-weight-row").style.display = needsWeight(configs[idx].algo) ? "" : "none";
        item.querySelector(".cfg-hhat-row").style.display   = configs[idx].algo === "ees"    ? "" : "none";
      }
      if (canvasItems[idx]) canvasItems[idx].labelEl.textContent = configLabel(configs[idx]);
      resetSession(idx);
    });
  }(i));
  algoRow.appendChild(algoLabel);
  algoRow.appendChild(algoSelect);
  div.appendChild(algoRow);

  // Weight row
  var weightRow = document.createElement("div");
  weightRow.className = "form-row cfg-weight-row";
  weightRow.style.display = needsWeight(cfg.algo) ? "" : "none";
  var weightLabel = document.createElement("label");
  weightLabel.textContent = "Weight w";
  var weightInput = document.createElement("input");
  weightInput.type      = "number";
  weightInput.className = "cfg-weight";
  weightInput.setAttribute("data-i", i);
  weightInput.min   = "1.0";
  weightInput.max   = "10.0";
  weightInput.step  = "0.05";
  weightInput.value = cfg.weight;
  (function (idx) {
    weightInput.addEventListener("change", function (e) {
      configs[idx].weight = parseFloat(e.target.value);
      if (canvasItems[idx]) canvasItems[idx].labelEl.textContent = configLabel(configs[idx]);
      resetSession(idx);
    });
  }(i));
  weightRow.appendChild(weightLabel);
  weightRow.appendChild(weightInput);
  div.appendChild(weightRow);

  // Hhat row
  var hhatRow = document.createElement("div");
  hhatRow.className = "form-row cfg-hhat-row";
  hhatRow.style.display = cfg.algo === "ees" ? "" : "none";
  var hhatLabel = document.createElement("label");
  hhatLabel.textContent = "\u0125 inflation";
  var hhatInput = document.createElement("input");
  hhatInput.type      = "number";
  hhatInput.className = "cfg-hhat";
  hhatInput.setAttribute("data-i", i);
  hhatInput.min   = "1.0";
  hhatInput.max   = "5.0";
  hhatInput.step  = "0.1";
  hhatInput.value = cfg.hhat;
  (function (idx) {
    hhatInput.addEventListener("change", function (e) {
      configs[idx].hhat = parseFloat(e.target.value);
      resetSession(idx);
    });
  }(i));
  hhatRow.appendChild(hhatLabel);
  hhatRow.appendChild(hhatInput);
  div.appendChild(hhatRow);

  return div;
}

function addConfig() {
  configs.push({ algo: "astar", weight: 1.5, hhat: 1.5 });
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
      metaTextEl.textContent = "Expanded: \u2014 | Cost: \u2014 | Ratio: \u2014";

      metricsEl.appendChild(statusEl);
      metricsEl.appendChild(metaTextEl);
      wrapper.appendChild(labelEl);
      wrapper.appendChild(canvas);
      wrapper.appendChild(metricsEl);
      container.appendChild(wrapper);

      canvasItems.push({
        canvas:    canvas,
        ctx:       canvas.getContext("2d"),
        labelEl:   labelEl,
        statusEl:  statusEl,
        metaTextEl: metaTextEl,
      });
    }(i));
  }

  resizeCanvases();
  drawAll();
}

function resizeCanvases() {
  if (!gridData || canvasItems.length === 0) return;
  var panel   = document.querySelector(".canvas-panel");
  var panelW  = panel.clientWidth - 40;
  var n       = canvasItems.length;
  var gap     = 20;
  var perW    = n > 1 ? (panelW - (n - 1) * gap) / n : panelW;
  var maxPx   = Math.min(perW, 600);
  var cs      = Math.max(10, Math.floor(maxPx / Math.max(gridData.rows, gridData.cols)));
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
  return Math.floor(Math.min(c.width, c.height) / Math.max(gridData.rows, gridData.cols));
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
  var pathSet   = new Set();

  if (state) {
    var ol = state.open_list   || [];
    var fl = state.focal_list  || [];
    var cl = state.closed_list || [];
    var pl = state.path        || [];
    for (var a = 0; a < ol.length; a++) openMap.set(ol[a][0] + "," + ol[a][1], ol[a][2]);
    for (var b = 0; b < fl.length; b++) focalMap.set(fl[b][0] + "," + fl[b][1], fl[b][2]);
    for (var c = 0; c < cl.length; c++) closedSet.add(cl[c][0] + "," + cl[c][1]);
    for (var d = 0; d < pl.length; d++) pathSet.add(pl[d][0] + "," + pl[d][1]);
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
      } else if (pathSet.has(key)) {
        fill = isStart ? COLORS.START : isGoal ? COLORS.GOAL : COLORS.PATH;
      } else if (isStart) {
        fill = COLORS.START;
      } else if (isGoal) {
        fill = COLORS.GOAL;
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
      } else if (cs >= 18 && !isObs && !pathSet.has(key)) {
        var h = focalMap.has(key) ? focalMap.get(key) : (openMap.has(key) ? openMap.get(key) : undefined);
        if (h !== undefined) {
          ctx.fillStyle    = "rgba(0,0,0,0.65)";
          ctx.font         = Math.max(8, Math.floor(cs * 0.33)) + "px monospace";
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(h, x + cs / 2, y + cs / 2);
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

  var expanded = (state.nodes_expanded !== undefined && state.nodes_expanded !== null) ? state.nodes_expanded : "\u2014";
  var cost     = (state.path_cost > 0) ? state.path_cost.toFixed(1) : "\u2014";
  var ratio    = (state.subopt_ratio !== null && state.subopt_ratio !== undefined) ? state.subopt_ratio.toFixed(3) : "\u2014";
  metaTextEl.textContent = "Expanded: " + expanded + " | Cost: " + cost + " | Ratio: " + ratio;

  if (state.found) {
    statusEl.textContent = "Path found!";
    statusEl.className   = "meta-status status-found";
  } else if (state.failed) {
    statusEl.textContent = "No path";
    statusEl.className   = "meta-status status-failed";
  } else {
    statusEl.textContent = "Searching\u2026";
    statusEl.className   = "meta-status status-running";
  }
}

function clearMetrics(i) {
  if (!canvasItems[i]) return;
  canvasItems[i].statusEl.textContent   = "Ready";
  canvasItems[i].statusEl.className     = "meta-status";
  canvasItems[i].metaTextEl.textContent = "Expanded: \u2014 | Cost: \u2014 | Ratio: \u2014";
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
  btnGenerate.disabled  = true;
  btnGenerate.textContent = "Generating\u2026";

  var rows    = parseInt(document.getElementById("inp-rows").value)    || 15;
  var cols    = parseInt(document.getElementById("inp-cols").value)    || 15;
  var density = parseFloat(document.getElementById("inp-density").value) || 0.28;
  try {
    gridData = await apiFetch("/api/grid/generate", { rows: rows, cols: cols, obstacle_density: density });
    rebuildCanvases();
  } catch (e) {
    alert("Generate error: " + e.message);
  } finally {
    btnGenerate.disabled    = false;
    btnGenerate.textContent = "\u2726 New Maze";
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
    alert("Step error: " + e.message);
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
    alert("Run error: " + e.message);
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

async function initSession(i) {
  if (!gridData) throw new Error("No grid loaded");
  var cfg   = configs[i];
  var state = await apiFetch("/api/search/init", {
    grid_data:      gridData,
    algorithm:      cfg.algo,
    weight:         cfg.weight,
    hhat_inflation: cfg.hhat,
  });
  sessions[i].sessionId   = state.session_id;
  sessions[i].searchState = state;
  drawGrid(i);
  updateMetrics(i, state);
}

function stopRunner() {
  if (runnerTimer !== null) {
    clearInterval(runnerTimer);
    runnerTimer = null;
  }
  if (btnStop) btnStop.disabled = true;
  if (btnRun)  btnRun.disabled  = false;
}
