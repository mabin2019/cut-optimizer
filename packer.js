// 2D Bin Packing — Guillotine Best Area Fit with consolidation
// Packs rectangles into fixed-size bins (plywood sheets)
// Prioritizes filling existing sheets before opening new ones
// Supports rotation and kerf (blade width) between pieces

/**
 * Pack a list of pieces onto sheets of the given dimensions.
 * Strategy: consolidate onto fewest sheets, leaving later sheets maximally free.
 */
function packPieces(pieces, sheetW, sheetH, kerf, maxSheets) {
  // Sort pieces by area descending (big pieces first for better packing)
  const sorted = pieces.slice().sort((a, b) => {
    const aArea = a.width * a.height;
    const bArea = b.width * b.height;
    if (bArea !== aArea) return bArea - aArea;
    return Math.max(b.width, b.height) - Math.max(a.width, a.height);
  });

  const sheets = [];
  const unplaced = [];

  function newSheet() {
    // Guillotine: track list of free rectangles
    return {
      freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }],
      pieces: [],
      usedArea: 0,
    };
  }

  // Find the best free rect for a piece (Best Area Fit)
  function findBestFit(sheet, pw, ph) {
    let bestScore = Infinity;
    let bestRect = null;
    let bestIdx = -1;
    let bestW = pw, bestH = ph;

    for (let i = 0; i < sheet.freeRects.length; i++) {
      const r = sheet.freeRects[i];

      // Try normal orientation
      if (pw <= r.w && ph <= r.h) {
        const areaFit = r.w * r.h - pw * ph;
        if (areaFit < bestScore) {
          bestScore = areaFit;
          bestRect = r;
          bestIdx = i;
          bestW = pw;
          bestH = ph;
        }
      }

      // Try rotated
      if (ph <= r.w && pw <= r.h && (pw !== ph)) {
        const areaFit = r.w * r.h - pw * ph;
        if (areaFit < bestScore) {
          bestScore = areaFit;
          bestRect = r;
          bestIdx = i;
          bestW = ph;
          bestH = pw;
        }
      }
    }

    if (!bestRect) return null;
    return { rect: bestRect, idx: bestIdx, w: bestW, h: bestH, rotated: bestW !== pw };
  }

  // Split a free rect after placing a piece using guillotine split (max rect style)
  function splitRect(sheet, fit) {
    const { rect, idx, w, h } = fit;
    const kw = w + kerf;
    const kh = h + kerf;

    // Remove the used rect
    sheet.freeRects.splice(idx, 1);

    // Right remainder
    if (rect.x + kw < rect.x + rect.w) {
      sheet.freeRects.push({
        x: rect.x + kw,
        y: rect.y,
        w: rect.w - kw,
        h: rect.h,
      });
    }

    // Bottom remainder
    if (rect.y + kh < rect.y + rect.h) {
      sheet.freeRects.push({
        x: rect.x,
        y: rect.y + kh,
        w: w,  // only width of piece, not full rect
        h: rect.h - kh,
      });
    }

    // Merge overlapping free rects isn't needed for guillotine,
    // but we remove any degenerate rects
    sheet.freeRects = sheet.freeRects.filter(r => r.w > 0 && r.h > 0);
  }

  function tryPlace(piece, sheet) {
    const fit = findBestFit(sheet, piece.width, piece.height);
    if (!fit) return false;

    const placed = {
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
    };

    sheet.pieces.push(placed);
    sheet.usedArea += fit.w * fit.h;
    splitRect(sheet, fit);
    return true;
  }

  // Main packing loop — always try all existing sheets before opening a new one
  for (const piece of sorted) {
    const fitsAtAll =
      (piece.width <= sheetW && piece.height <= sheetH) ||
      (piece.height <= sheetW && piece.width <= sheetH);
    if (!fitsAtAll) {
      unplaced.push({ ...piece, reason: "Too large for sheet" });
      continue;
    }

    // Try every existing sheet (prefer the one with least waste after placing)
    let placed = false;
    let bestSheetIdx = -1;
    let bestFitScore = Infinity;

    for (let i = 0; i < sheets.length; i++) {
      const fit = findBestFit(sheets[i], piece.width, piece.height);
      if (fit) {
        const score = fit.rect.w * fit.rect.h - piece.width * piece.height;
        if (score < bestFitScore) {
          bestFitScore = score;
          bestSheetIdx = i;
        }
      }
    }

    if (bestSheetIdx >= 0) {
      tryPlace(piece, sheets[bestSheetIdx]);
      placed = true;
    }

    if (!placed) {
      // Open a new sheet
      if (sheets.length >= maxSheets) {
        unplaced.push({ ...piece, reason: "No sheets remaining" });
        continue;
      }
      const s = newSheet();
      if (tryPlace(piece, s)) {
        sheets.push(s);
      } else {
        unplaced.push({ ...piece, reason: "Could not place" });
      }
    }
  }

  // Calculate waste & largest free area per sheet
  const totalArea = sheetW * sheetH;
  const result = sheets.map((s) => {
    // Find largest free rectangle
    let largestFree = { w: 0, h: 0, area: 0 };
    for (const r of s.freeRects) {
      const a = r.w * r.h;
      if (a > largestFree.area) {
        largestFree = { w: r.w, h: r.h, area: a, x: r.x, y: r.y };
      }
    }

    // Total free area
    const totalFreeArea = s.freeRects.reduce((sum, r) => sum + r.w * r.h, 0);

    return {
      pieces: s.pieces,
      wastePercent: ((1 - s.usedArea / totalArea) * 100).toFixed(1),
      usedArea: s.usedArea,
      freeRects: s.freeRects,
      largestFree,
      totalFreeArea,
    };
  });

  // Generate optimization suggestions
  const suggestions = generateSuggestions(result, sheetW, sheetH, unplaced);

  return { sheets: result, unplaced, suggestions };
}

/**
 * Generate smart suggestions for optimizing sheet usage.
 */
function generateSuggestions(sheets, sheetW, sheetH, unplaced) {
  const suggestions = [];
  const totalArea = sheetW * sheetH;

  sheets.forEach((sheet, idx) => {
    const wasteNum = parseFloat(sheet.wastePercent);

    // If there's significant usable free space
    if (sheet.largestFree.area > 0) {
      const lf = sheet.largestFree;
      const freePercent = ((sheet.totalFreeArea / totalArea) * 100).toFixed(0);

      if (wasteNum > 15) {
        // Gather what sizes could still fit
        const fitExamples = [];
        for (const r of sheet.freeRects) {
          if (r.w >= 200 && r.h >= 200) {
            fitExamples.push(`${Math.floor(r.w)}x${Math.floor(r.h)}`);
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

      // If this is not the last sheet, suggest consolidation
      if (idx < sheets.length - 1 && wasteNum > 30) {
        suggestions.push({
          type: "consolidate",
          sheet: idx + 1,
          message: `Sheet ${idx + 1} is only ${(100 - wasteNum).toFixed(0)}% used. Smaller pieces from later sheets could potentially fill gaps here.`,
        });
      }
    }
  });

  // Last sheet tip — highlight remaining space for future use
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

  // If multiple sheets are used, add a total summary suggestion
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
