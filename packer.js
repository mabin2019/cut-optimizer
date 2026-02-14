// 2D Bin Packing — Maximal Rectangles with Multi-Strategy Optimization
// Packs rectangles into fixed-size bins (plywood sheets)
// Uses overlapping free rectangles for optimal space utilization
// Supports rotation and kerf (blade width) between pieces
//
// Optimizations:
// 1. Multi-strategy: tries multiple sort orders and placement heuristics,
//    keeps the result that uses the fewest sheets with least waste.
// 2. Bottom-left bias: breaks ties by preferring placements closer to the
//    origin, keeping free space contiguous.
// 3. Post-packing consolidation: attempts to move pieces from sparse sheets
//    into gaps on fuller sheets to reduce total sheet count.

/**
 * Pack a list of pieces onto sheets of the given dimensions.
 * Runs multiple strategies and returns the best result.
 */
function packPieces(pieces, sheetW, sheetH, kerf, maxSheets) {
  if (pieces.length === 0) {
    return { sheets: [], unplaced: [], suggestions: [] };
  }

  // --- Sort strategies ---
  const sortStrategies = [
    // Area descending, then longest side
    (a, b) => {
      const d = b.width * b.height - a.width * a.height;
      return d !== 0 ? d : Math.max(b.width, b.height) - Math.max(a.width, a.height);
    },
    // Perimeter descending
    (a, b) => {
      const d = (b.width + b.height) - (a.width + a.height);
      return d !== 0 ? d : b.width * b.height - a.width * a.height;
    },
    // Longest side descending
    (a, b) => {
      const d = Math.max(b.width, b.height) - Math.max(a.width, a.height);
      return d !== 0 ? d : b.width * b.height - a.width * a.height;
    },
    // Width descending (favors wide pieces first)
    (a, b) => {
      const d = Math.max(b.width, b.height) - Math.max(a.width, a.height);
      if (d !== 0) return d;
      return Math.min(b.width, b.height) - Math.min(a.width, a.height);
    },
  ];

  // --- Placement heuristics ---
  const HEURISTIC_BSSF = "bssf"; // Best Short Side Fit
  const HEURISTIC_BLSF = "blsf"; // Best Long Side Fit
  const HEURISTIC_BAF  = "baf";  // Best Area Fit
  const heuristics = [HEURISTIC_BSSF, HEURISTIC_BLSF, HEURISTIC_BAF];

  // --- Core helpers (shared across strategies) ---

  function newSheet() {
    return {
      freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }],
      pieces: [],
      usedArea: 0,
    };
  }

  function isContained(a, b) {
    return a.x >= b.x && a.y >= b.y &&
           a.x + a.w <= b.x + b.w &&
           a.y + a.h <= b.y + b.h;
  }

  function pruneFreeRects(sheet) {
    const rects = sheet.freeRects;
    const keep = new Array(rects.length).fill(true);
    for (let i = 0; i < rects.length; i++) {
      if (!keep[i]) continue;
      for (let j = i + 1; j < rects.length; j++) {
        if (!keep[j]) continue;
        if (isContained(rects[i], rects[j])) {
          keep[i] = false;
          break;
        }
        if (isContained(rects[j], rects[i])) {
          keep[j] = false;
        }
      }
    }
    sheet.freeRects = rects.filter((_, i) => keep[i]);
  }

  function placeRect(sheet, x, y, w, h) {
    const pw = w + kerf;
    const ph = h + kerf;
    const px2 = Math.min(x + pw, sheetW);
    const py2 = Math.min(y + ph, sheetH);

    const newFree = [];
    for (let i = 0; i < sheet.freeRects.length; i++) {
      const r = sheet.freeRects[i];
      if (x >= r.x + r.w || px2 <= r.x || y >= r.y + r.h || py2 <= r.y) {
        newFree.push(r);
        continue;
      }
      if (x > r.x) newFree.push({ x: r.x, y: r.y, w: x - r.x, h: r.h });
      if (px2 < r.x + r.w) newFree.push({ x: px2, y: r.y, w: r.x + r.w - px2, h: r.h });
      if (y > r.y) newFree.push({ x: r.x, y: r.y, w: r.w, h: y - r.y });
      if (py2 < r.y + r.h) newFree.push({ x: r.x, y: py2, w: r.w, h: r.y + r.h - py2 });
    }
    sheet.freeRects = newFree.filter(r => r.w > 0.5 && r.h > 0.5);
    pruneFreeRects(sheet);
  }

  // Score a candidate placement for a given heuristic.
  // Lower score = better fit. Returns null if piece doesn't fit.
  function scoreFit(r, pw, ph, heuristic) {
    const leftoverW = r.w - pw;
    const leftoverH = r.h - ph;
    let primary, secondary;

    if (heuristic === HEURISTIC_BSSF) {
      primary = Math.min(leftoverW, leftoverH);
      secondary = Math.max(leftoverW, leftoverH);
    } else if (heuristic === HEURISTIC_BLSF) {
      primary = Math.max(leftoverW, leftoverH);
      secondary = Math.min(leftoverW, leftoverH);
    } else {
      // BAF — Best Area Fit: minimize leftover area
      primary = leftoverW * leftoverH + leftoverW + leftoverH;
      secondary = Math.min(leftoverW, leftoverH);
    }

    // Bottom-left bias: break ties by preferring positions closer to origin
    const positionScore = r.y * sheetW + r.x;
    return { primary, secondary, positionScore };
  }

  function isBetterScore(a, b) {
    if (a.primary !== b.primary) return a.primary < b.primary;
    if (a.secondary !== b.secondary) return a.secondary < b.secondary;
    return a.positionScore < b.positionScore;
  }

  function findBestFit(sheet, pw, ph, heuristic) {
    let bestScore = null;
    let bestRect = null;
    let bestW = pw, bestH = ph;

    for (let i = 0; i < sheet.freeRects.length; i++) {
      const r = sheet.freeRects[i];

      // Normal orientation
      if (pw <= r.w && ph <= r.h) {
        const score = scoreFit(r, pw, ph, heuristic);
        if (!bestScore || isBetterScore(score, bestScore)) {
          bestScore = score;
          bestRect = r;
          bestW = pw;
          bestH = ph;
        }
      }

      // Rotated
      if (ph <= r.w && pw <= r.h && pw !== ph) {
        const score = scoreFit(r, ph, pw, heuristic);
        if (!bestScore || isBetterScore(score, bestScore)) {
          bestScore = score;
          bestRect = r;
          bestW = ph;
          bestH = pw;
        }
      }
    }

    if (!bestRect) return null;
    return { rect: bestRect, w: bestW, h: bestH, rotated: bestW !== pw, score: bestScore };
  }

  function tryPlace(piece, sheet, heuristic) {
    const fit = findBestFit(sheet, piece.width, piece.height, heuristic);
    if (!fit) return false;

    sheet.pieces.push({
      x: fit.rect.x,
      y: fit.rect.y,
      w: fit.w,
      h: fit.h,
      rotated: fit.rotated,
      id: piece.id,
      label: piece.label,
      furniture: piece.furniture,
      color: piece.color,
      origW: piece.width,
      origH: piece.height,
    });
    sheet.usedArea += fit.w * fit.h;
    placeRect(sheet, fit.rect.x, fit.rect.y, fit.w, fit.h);
    return true;
  }

  // --- Run a single packing strategy ---
  function runStrategy(sorted, heuristic) {
    const sheets = [];
    const unplaced = [];

    for (const piece of sorted) {
      const fitsAtAll =
        (piece.width <= sheetW && piece.height <= sheetH) ||
        (piece.height <= sheetW && piece.width <= sheetH);
      if (!fitsAtAll) {
        unplaced.push({ ...piece, reason: "Too large for sheet" });
        continue;
      }

      // Try every existing sheet — pick the one with the tightest fit
      let bestSheetIdx = -1;
      let bestScore = null;

      for (let i = 0; i < sheets.length; i++) {
        const fit = findBestFit(sheets[i], piece.width, piece.height, heuristic);
        if (fit && (!bestScore || isBetterScore(fit.score, bestScore))) {
          bestScore = fit.score;
          bestSheetIdx = i;
        }
      }

      if (bestSheetIdx >= 0) {
        tryPlace(piece, sheets[bestSheetIdx], heuristic);
        continue;
      }

      // Open a new sheet
      if (sheets.length >= maxSheets) {
        unplaced.push({ ...piece, reason: "No sheets remaining" });
        continue;
      }
      const s = newSheet();
      if (tryPlace(piece, s, heuristic)) {
        sheets.push(s);
      } else {
        unplaced.push({ ...piece, reason: "Could not place" });
      }
    }

    return { sheets, unplaced };
  }

  // --- Score a result for comparison ---
  function resultScore(r) {
    const totalArea = sheetW * sheetH;
    const totalUsed = r.sheets.reduce((s, sh) => s + sh.usedArea, 0);
    const totalSheetArea = r.sheets.length * totalArea;
    const wasteRatio = totalSheetArea > 0 ? 1 - totalUsed / totalSheetArea : 0;
    // Primary: fewer sheets. Secondary: less waste. Tertiary: fewer unplaced.
    return {
      sheetCount: r.sheets.length,
      waste: wasteRatio,
      unplacedCount: r.unplaced.length,
    };
  }

  function isBetterResult(a, b) {
    const sa = resultScore(a);
    const sb = resultScore(b);
    if (sa.unplacedCount !== sb.unplacedCount) return sa.unplacedCount < sb.unplacedCount;
    if (sa.sheetCount !== sb.sheetCount) return sa.sheetCount < sb.sheetCount;
    return sa.waste < sb.waste;
  }

  // --- Try all strategy combinations, keep the best ---
  let bestResult = null;

  for (const sortFn of sortStrategies) {
    const sorted = pieces.slice().sort(sortFn);
    for (const heuristic of heuristics) {
      const result = runStrategy(sorted, heuristic);
      if (!bestResult || isBetterResult(result, bestResult)) {
        bestResult = result;
      }
    }
  }

  // --- Post-packing consolidation ---
  // Try to move pieces from the last (sparsest) sheet into earlier sheets.
  // Repeat until no more moves are possible.
  if (bestResult.sheets.length > 1) {
    bestResult = consolidateSheets(bestResult);
  }

  // --- Build final output ---
  const totalArea = sheetW * sheetH;
  const resultSheets = bestResult.sheets.map((s) => {
    let largestFree = { w: 0, h: 0, area: 0 };
    for (const r of s.freeRects) {
      const a = r.w * r.h;
      if (a > largestFree.area) {
        largestFree = { w: r.w, h: r.h, area: a, x: r.x, y: r.y };
      }
    }
    const totalFreeArea = computeActualFreeArea(s.freeRects, sheetW, sheetH);

    return {
      pieces: s.pieces,
      wastePercent: ((1 - s.usedArea / totalArea) * 100).toFixed(1),
      usedArea: s.usedArea,
      freeRects: s.freeRects,
      largestFree,
      totalFreeArea,
    };
  });

  const suggestions = generateSuggestions(resultSheets, sheetW, sheetH, bestResult.unplaced);
  return { sheets: resultSheets, unplaced: bestResult.unplaced, suggestions };

  // --- Consolidation logic (hoisted) ---
  function consolidateSheets(result) {
    let improved = true;
    while (improved) {
      improved = false;
      if (result.sheets.length <= 1) break;

      // Sort sheets so sparsest is last
      result.sheets.sort((a, b) => b.usedArea - a.usedArea);

      const lastSheet = result.sheets[result.sheets.length - 1];
      const piecesToMove = lastSheet.pieces.slice();

      // Try to fit each piece from the last sheet into an earlier sheet
      const movedIndices = new Set();
      for (let pi = 0; pi < piecesToMove.length; pi++) {
        const p = piecesToMove[pi];
        const fakePiece = {
          id: p.id, label: p.label, furniture: p.furniture,
          color: p.color, width: p.origW, height: p.origH,
        };

        // Try each earlier sheet
        for (let si = 0; si < result.sheets.length - 1; si++) {
          const fit = findBestFit(result.sheets[si], fakePiece.width, fakePiece.height, HEURISTIC_BSSF);
          if (fit) {
            // Place it
            tryPlace(fakePiece, result.sheets[si], HEURISTIC_BSSF);
            movedIndices.add(pi);
            improved = true;
            break;
          }
        }
      }

      if (movedIndices.size > 0) {
        // Rebuild the last sheet without the moved pieces
        if (movedIndices.size === piecesToMove.length) {
          // Removed all pieces — drop the sheet entirely
          result.sheets.pop();
        } else {
          // Rebuild the last sheet with remaining pieces
          const remaining = piecesToMove.filter((_, i) => !movedIndices.has(i));
          const rebuilt = newSheet();
          for (const p of remaining) {
            const fakePiece = {
              id: p.id, label: p.label, furniture: p.furniture,
              color: p.color, width: p.origW, height: p.origH,
            };
            tryPlace(fakePiece, rebuilt, HEURISTIC_BSSF);
          }
          result.sheets[result.sheets.length - 1] = rebuilt;
        }
      }
    }
    return result;
  }
}

/**
 * Compute the actual (non-overlapping) free area from maximal rects.
 */
function computeActualFreeArea(freeRects, sheetW, sheetH) {
  const sum = freeRects.reduce((s, r) => s + r.w * r.h, 0);
  return Math.min(sum, sheetW * sheetH);
}

/**
 * Generate smart suggestions for optimizing sheet usage.
 */
function generateSuggestions(sheets, sheetW, sheetH, unplaced) {
  const suggestions = [];
  const totalArea = sheetW * sheetH;

  sheets.forEach((sheet, idx) => {
    const wasteNum = parseFloat(sheet.wastePercent);

    if (sheet.largestFree.area > 0) {
      const freePercent = ((sheet.totalFreeArea / totalArea) * 100).toFixed(0);

      if (wasteNum > 15) {
        const fitExamples = [];
        const seen = new Set();
        for (const r of sheet.freeRects) {
          if (r.w >= 200 && r.h >= 200) {
            const key = `${Math.floor(r.w)}x${Math.floor(r.h)}`;
            if (!seen.has(key)) {
              seen.add(key);
              fitExamples.push(key);
            }
          }
        }

        if (fitExamples.length > 0) {
          suggestions.push({
            type: "fill_gaps",
            sheet: idx + 1,
            message: `Sheet ${idx + 1} has ${freePercent}% free space. Usable gaps: ${fitExamples.slice(0, 3).join(", ")}. Consider adding smaller parts here to reduce waste.`,
          });
        }
      }

      if (idx < sheets.length - 1 && wasteNum > 30) {
        suggestions.push({
          type: "consolidate",
          sheet: idx + 1,
          message: `Sheet ${idx + 1} is only ${(100 - wasteNum).toFixed(0)}% used. Smaller pieces from later sheets could potentially fill gaps here.`,
        });
      }
    }
  });

  if (sheets.length > 0) {
    const lastSheet = sheets[sheets.length - 1];
    const lastWaste = parseFloat(lastSheet.wastePercent);
    if (lastWaste > 20) {
      const lf = lastSheet.largestFree;
      suggestions.push({
        type: "future_use",
        sheet: sheets.length,
        message: `Sheet ${sheets.length} (last used) has a largest free area of ${Math.floor(lf.w)}x${Math.floor(lf.h)} — available for future furniture.`,
      });
    }
  }

  if (sheets.length > 1) {
    const totalUsed = sheets.reduce((s, sh) => s + sh.usedArea, 0);
    const minSheetsNeeded = Math.ceil(totalUsed / totalArea);
    if (minSheetsNeeded < sheets.length) {
      suggestions.push({
        type: "efficiency",
        sheet: 0,
        message: `Theoretical minimum: ${minSheetsNeeded} sheet${minSheetsNeeded > 1 ? "s" : ""}. Current: ${sheets.length} sheets. The extra space is available for future cuts.`,
      });
    }
  }

  return suggestions;
}
