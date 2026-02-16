// App state and UI logic

const state = {
  furniture: [], // { id, name, qty, cuts: [{name, width, height, qty}], presetKey? }
  nextId: 1,
};

// --- Custom presets (saved to localStorage) ---
const CUSTOM_PRESETS_KEY = "plywoodOptimizer_customPresets";

function loadCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCustomPresets(presets) {
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

function addCustomPreset(name, cuts) {
  const presets = loadCustomPresets();
  const key = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_" + Date.now();
  presets[key] = { name, cuts: cuts.map((c) => ({ ...c })) };
  saveCustomPresets(presets);
  populatePresetDropdown();
  return key;
}

function deleteCustomPreset(key) {
  const presets = loadCustomPresets();
  delete presets[key];
  saveCustomPresets(presets);
  populatePresetDropdown();
}

// Color palette for furniture types
const COLORS = [
  "#3498db", "#e74c3c", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#34495e",
  "#16a085", "#c0392b", "#8e44ad", "#d35400",
];

// --- Populate preset dropdown ---
function populatePresetDropdown() {
  const sel = document.getElementById("presetSelect");
  sel.innerHTML = '<option value="">Add preset...</option>';

  // Built-in presets
  for (const key in FURNITURE_PRESETS) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = FURNITURE_PRESETS[key].name;
    sel.appendChild(opt);
  }

  // Custom saved presets
  const custom = loadCustomPresets();
  const customKeys = Object.keys(custom);
  if (customKeys.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "My Saved Presets";
    customKeys.forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = custom[key].name;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  }
}

// --- Render furniture list ---
function renderFurnitureList() {
  const container = document.getElementById("furnitureList");
  container.innerHTML = "";

  if (state.furniture.length === 0) {
    container.innerHTML = '<p style="font-size:.85rem;color:#999;">No furniture added yet.</p>';
    return;
  }

  state.furniture.forEach((item) => {
    const div = document.createElement("div");
    div.className = "furniture-item";
    const cutsDesc = item.cuts
      .map((c) => `${c.qty}x ${c.name} (${c.width}x${c.height})`)
      .join(", ");

    const isCustom = !item.presetKey;
    const isCustomPreset = item.presetKey && item.presetKey.startsWith("custom_");
    div.innerHTML = `
      <div class="furniture-header">
        <strong>${item.name}</strong>
        <div class="furniture-qty">
          <label style="margin:0;font-size:.8rem;">Qty:</label>
          <input type="number" min="1" max="100" value="${item.qty}" data-id="${item.id}" class="qty-input">
          <button class="btn btn-danger" data-remove="${item.id}">Remove</button>
        </div>
      </div>
      <div class="furniture-cuts">${cutsDesc}</div>
      <div class="furniture-actions">
        ${isCustom ? `<button class="btn btn-save-preset" data-save="${item.id}">Save as Preset</button>` : ""}
        ${isCustomPreset ? `<button class="btn btn-delete-preset" data-delete-preset="${item.presetKey}">Remove Preset</button>` : ""}
      </div>
    `;
    container.appendChild(div);
  });

  // Qty change handlers
  container.querySelectorAll(".qty-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const id = parseInt(e.target.dataset.id);
      const item = state.furniture.find((f) => f.id === id);
      if (item) item.qty = Math.max(1, parseInt(e.target.value) || 1);
    });
  });

  // Remove handlers
  container.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.target.dataset.remove);
      state.furniture = state.furniture.filter((f) => f.id !== id);
      renderFurnitureList();
    });
  });

  // Save as preset handlers
  container.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.target.dataset.save);
      const item = state.furniture.find((f) => f.id === id);
      if (!item) return;
      const key = addCustomPreset(item.name, item.cuts);
      item.presetKey = key;
      renderFurnitureList();
    });
  });

  // Delete custom preset handlers
  container.querySelectorAll("[data-delete-preset]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const key = e.target.dataset.deletePreset;
      if (confirm("Remove this saved preset? (Furniture already added won't be affected.)")) {
        deleteCustomPreset(key);
        // Clear presetKey from any furniture using this preset
        state.furniture.forEach((f) => {
          if (f.presetKey === key) f.presetKey = undefined;
        });
        renderFurnitureList();
      }
    });
  });
}

// --- Add preset ---
function addPreset() {
  const sel = document.getElementById("presetSelect");
  const key = sel.value;
  if (!key) return;

  // Look up in built-in presets first, then custom
  const preset = FURNITURE_PRESETS[key] || loadCustomPresets()[key];
  if (!preset) return;

  state.furniture.push({
    id: state.nextId++,
    name: preset.name,
    qty: 1,
    cuts: preset.cuts.map((c) => ({ ...c })),
    presetKey: key,
  });
  sel.value = "";
  renderFurnitureList();
}

// --- Custom furniture modal ---
function openCustomModal() {
  const modal = document.getElementById("customModal");
  document.getElementById("customName").value = "";
  const cutsDiv = document.getElementById("customCuts");
  cutsDiv.innerHTML = "";
  addCutRowToModal();
  modal.style.display = "flex";
}

function addCutRowToModal() {
  const cutsDiv = document.getElementById("customCuts");
  const row = document.createElement("div");
  row.className = "cut-row";
  row.innerHTML = `
    <label>Name<input type="text" class="cut-name" placeholder="Part"></label>
    <label>W<input type="number" class="cut-w" value="100" min="1"></label>
    <label>H<input type="number" class="cut-h" value="100" min="1"></label>
    <label>Qty<input type="number" class="cut-qty" value="1" min="1"></label>
    <button class="btn btn-danger cut-remove">X</button>
  `;
  row.querySelector(".cut-remove").addEventListener("click", () => {
    row.remove();
  });
  cutsDiv.appendChild(row);
}

function saveCustom() {
  const name = document.getElementById("customName").value.trim() || "Custom";
  const rows = document.querySelectorAll("#customCuts .cut-row");
  const cuts = [];
  rows.forEach((row) => {
    const n = row.querySelector(".cut-name").value.trim() || "Part";
    const w = parseInt(row.querySelector(".cut-w").value) || 100;
    const h = parseInt(row.querySelector(".cut-h").value) || 100;
    const q = parseInt(row.querySelector(".cut-qty").value) || 1;
    cuts.push({ name: n, width: w, height: h, qty: q });
  });

  if (cuts.length === 0) return;

  state.furniture.push({
    id: state.nextId++,
    name: name,
    qty: 1,
    cuts: cuts,
  });

  document.getElementById("customModal").style.display = "none";
  renderFurnitureList();
}

// --- Calculation ---
function calculate() {
  const sheetW = parseFloat(document.getElementById("sheetWidth").value) || 2440;
  const sheetH = parseFloat(document.getElementById("sheetHeight").value) || 1220;
  const sheetQty = parseInt(document.getElementById("sheetQty").value) || 5;
  const kerf = parseFloat(document.getElementById("kerf").value) || 0;
  const unit = document.getElementById("unit").value;

  // Expand all furniture into individual pieces
  const pieces = [];
  state.furniture.forEach((item, fIdx) => {
    const color = COLORS[fIdx % COLORS.length];
    for (let fq = 0; fq < item.qty; fq++) {
      item.cuts.forEach((cut) => {
        for (let cq = 0; cq < cut.qty; cq++) {
          pieces.push({
            id: `${item.id}-${fq}-${cut.name}-${cq}`,
            label: cut.name,
            width: cut.width,
            height: cut.height,
            furniture: item.name + (item.qty > 1 ? ` #${fq + 1}` : ""),
            color: color,
          });
        }
      });
    }
  });

  if (pieces.length === 0) return;

  const result = packPieces(pieces, sheetW, sheetH, kerf, sheetQty);
  renderDiagram(result, sheetW, sheetH, unit);
  renderResults(result, pieces.length, sheetW, sheetH, unit);
}

// --- Canvas rendering ---
function renderDiagram(result, sheetW, sheetH, unit) {
  const area = document.getElementById("diagramArea");
  area.innerHTML = "";

  if (result.sheets.length === 0) {
    area.innerHTML = '<p style="padding:16px;color:#999;">No pieces to display.</p>';
    return;
  }

  const maxCanvasWidth = area.clientWidth - 32 || 700;
  const scale = Math.min(maxCanvasWidth / sheetW, 500 / sheetH);

  result.sheets.forEach((sheet, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "sheet-diagram";

    const heading = document.createElement("h3");
    const lfInfo = sheet.largestFree && sheet.largestFree.area > 0
      ? ` | largest free: ${Math.floor(sheet.largestFree.w)}x${Math.floor(sheet.largestFree.h)}`
      : "";
    heading.textContent = `Sheet ${idx + 1} — ${sheet.wastePercent}% waste${lfInfo}`;
    wrapper.appendChild(heading);

    const canvas = document.createElement("canvas");
    const cw = Math.round(sheetW * scale);
    const ch = Math.round(sheetH * scale);
    canvas.width = cw;
    canvas.height = ch;
    wrapper.appendChild(canvas);
    area.appendChild(wrapper);

    const ctx = canvas.getContext("2d");

    // Background (waste)
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, cw, ch);

    // Draw free rectangles with dashed borders
    if (sheet.freeRects) {
      sheet.freeRects.forEach((r) => {
        const rx = r.x * scale;
        const ry = r.y * scale;
        const rw = r.w * scale;
        const rh = r.h * scale;

        // Light pattern for free space
        ctx.fillStyle = "#f5f5dc";
        ctx.globalAlpha = 0.4;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.globalAlpha = 1;

        // Dashed border
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "#999";
        ctx.lineWidth = 1;
        ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
        ctx.setLineDash([]);

        // Show dimensions if large enough
        if (rw > 50 && rh > 20) {
          const fs = Math.max(8, Math.min(11, Math.min(rw, rh) * 0.15));
          ctx.fillStyle = "#888";
          ctx.font = `${fs}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${Math.floor(r.w)}x${Math.floor(r.h)}`, rx + rw / 2, ry + rh / 2, rw - 4);
        }
      });
    }

    // Draw pieces
    sheet.pieces.forEach((p) => {
      const x = p.x * scale;
      const y = p.y * scale;
      const w = p.w * scale;
      const h = p.h * scale;

      // Fill
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      // Label
      const fontSize = Math.max(9, Math.min(14, Math.min(w, h) * 0.18));
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const labelText = p.label;
      const dimText = `${p.origW}x${p.origH}`;

      if (h > fontSize * 3 && w > 30) {
        ctx.fillText(labelText, x + w / 2, y + h / 2 - fontSize * 0.6, w - 4);
        ctx.font = `${fontSize * 0.8}px sans-serif`;
        ctx.fillText(dimText, x + w / 2, y + h / 2 + fontSize * 0.6, w - 4);
      } else if (w > 30 && h > fontSize * 1.5) {
        ctx.fillText(labelText, x + w / 2, y + h / 2, w - 4);
      }
    });

    // Sheet border
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, cw, ch);
  });
}

// --- Results summary ---
function renderResults(result, totalPieces, sheetW, sheetH, unit) {
  const card = document.getElementById("resultsCard");
  const div = document.getElementById("resultsSummary");
  card.style.display = "block";

  const totalArea = sheetW * sheetH;
  const totalUsed = result.sheets.reduce((s, sh) => s + sh.usedArea, 0);
  const totalSheetArea = result.sheets.length * totalArea;
  const overallWaste = totalSheetArea > 0
    ? ((1 - totalUsed / totalSheetArea) * 100).toFixed(1)
    : 0;
  const placedCount = result.sheets.reduce((s, sh) => s + sh.pieces.length, 0);

  let html = `
    <div class="stat"><span class="stat-label">Sheets needed</span><span class="stat-value">${result.sheets.length}</span></div>
    <div class="stat"><span class="stat-label">Pieces placed</span><span class="stat-value">${placedCount} / ${totalPieces}</span></div>
    <div class="stat"><span class="stat-label">Overall waste</span><span class="stat-value">${overallWaste}%</span></div>
  `;

  result.sheets.forEach((sh, i) => {
    const lfText = sh.largestFree && sh.largestFree.area > 0
      ? ` (largest free: ${Math.floor(sh.largestFree.w)}x${Math.floor(sh.largestFree.h)})`
      : "";
    html += `<div class="stat"><span class="stat-label">Sheet ${i + 1} waste</span><span class="stat-value">${sh.wastePercent}%${lfText}</span></div>`;
  });

  if (result.unplaced.length > 0) {
    html += '<div class="unplaced-warning"><strong>Could not place:</strong><br>';
    result.unplaced.forEach((p) => {
      html += `${p.label} (${p.width}x${p.height}${unit}) — ${p.reason}<br>`;
    });
    html += "</div>";
  }

  // Optimization suggestions
  if (result.suggestions && result.suggestions.length > 0) {
    html += '<div class="suggestions-section"><h3>Optimization Suggestions</h3>';
    result.suggestions.forEach((s) => {
      const icon = s.type === "fill_gaps" ? "&#9998;" : s.type === "future_use" ? "&#9733;" : s.type === "consolidate" ? "&#8644;" : "&#9432;";
      html += `<div class="suggestion ${s.type}"><span class="suggestion-icon">${icon}</span> ${s.message}</div>`;
    });
    html += "</div>";
  }

  div.innerHTML = html;
}

// --- Event wiring ---
document.addEventListener("DOMContentLoaded", () => {
  populatePresetDropdown();
  renderFurnitureList();

  document.getElementById("addPresetBtn").addEventListener("click", addPreset);
  document.getElementById("presetSelect").addEventListener("change", (e) => {
    if (e.target.value) addPreset();
  });
  document.getElementById("addCustomBtn").addEventListener("click", openCustomModal);
  document.getElementById("addCutRow").addEventListener("click", addCutRowToModal);
  document.getElementById("customCancel").addEventListener("click", () => {
    document.getElementById("customModal").style.display = "none";
  });
  document.getElementById("customSave").addEventListener("click", saveCustom);
  document.getElementById("calculateBtn").addEventListener("click", calculate);

  // Close modal on overlay click
  document.getElementById("customModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.style.display = "none";
    }
  });
});
