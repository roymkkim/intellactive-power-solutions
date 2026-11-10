(() => {
  if (!window.THREE) return;

  const THREE = window.THREE;
  const ORANGE = "#e35a1a";
  const HIDDEN_BRAIN = 0x3a3a3a;
  const HIDDEN_LOGO = 0x1c1c1c;
  const SAMPLE = 22;
  const ALPHA = 20;
  const RIPPLE_MS = 2000;
  const REST_MS = 600;
  const CYCLE_MS = RIPPLE_MS + REST_MS;
  const RIPPLE_WIDTH = 0.2;
  const RIPPLE_TRAVEL = 1.45;
  const LOGO_GLOW_MS = 1800;
  const LOGO_HOLD_MS = 560;
  const LOGO_COL_MS = 140;
  const LOGO_FADE_COLS = 1.2;
  const LOGO_FLOW_COL_MS = 88;
  const LOGO_FLOW_FADE = 4.2;
  const LOGO_FULL_MS = 720;
  const LOGO_REST_MS = 500;
  const PITCH = 8.2;
  const CUBE = 2.1;
  const AMBIENT_MS = 4200;
  const AMBIENT_STRENGTH = 0.22;
  const EMOJI = "🧠";
  const FONT_STACK =
    '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif';
  const COLS = 20;
  const ROWS = 17;
  const LAYERS = 9;
  const LOGO_GRID = 24;
  const LOGO_CLUSTER = 6;
  const LOGO_STROKE = 6;
  const LOGO_GAP = 1;
  const LOGO_LAYERS = 6;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const getPixelData = (char, resolution) => {
    const off = document.createElement("canvas");
    off.width = resolution;
    off.height = resolution;
    const oc = off.getContext("2d", { willReadFrequently: true });
    if (!oc) return null;
    oc.clearRect(0, 0, resolution, resolution);
    oc.font = `${Math.floor(resolution * 0.78)}px ${FONT_STACK}`;
    oc.textAlign = "center";
    oc.textBaseline = "middle";
    const renderChar = char.includes("\uFE0F") ? char : `${char}\uFE0F`;
    oc.fillText(renderChar, resolution / 2, resolution / 2 + resolution * 0.04);
    return oc.getImageData(0, 0, resolution, resolution);
  };

  const fillHoles = (solid, w, h) => {
    const outside = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = y * w + x;
      if (solid[i] || outside[i]) return;
      outside[i] = 1;
      stack.push(i);
    };
    for (let x = 0; x < w; x += 1) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y += 1) {
      push(0, y);
      push(w - 1, y);
    }
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      push(x - 1, y);
      push(x + 1, y);
      push(x, y - 1);
      push(x, y + 1);
    }
    for (let i = 0; i < solid.length; i += 1) {
      if (!outside[i]) solid[i] = 1;
    }
    return solid;
  };

  const isRimMask = (solid, w, h) => {
    let inner = 0;
    let innerHit = 0;
    let outer = 0;
    const x0 = Math.floor(w * 0.28);
    const x1 = Math.ceil(w * 0.72);
    const y0 = Math.floor(h * 0.28);
    const y1 = Math.ceil(h * 0.72);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (!solid[y * w + x]) continue;
        outer += 1;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) {
          inner += 1;
          innerHit += 1;
        }
      }
    }
    const innerArea = Math.max(1, (x1 - x0) * (y1 - y0));
    return outer < 180 || inner / innerArea < 0.28 || innerHit / outer < 0.22;
  };

  const sampleEmojiXY = () => {
    const data = getPixelData(EMOJI, SAMPLE);
    if (!data) return null;
    const pixels = data.data;
    const raw = new Uint8Array(SAMPLE * SAMPLE);
    let count = 0;
    let minX = SAMPLE;
    let minY = SAMPLE;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < SAMPLE; y += 1) {
      for (let x = 0; x < SAMPLE; x += 1) {
        if (pixels[(y * SAMPLE + x) * 4 + 3] <= ALPHA) continue;
        raw[y * SAMPLE + x] = 1;
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (count < 80) return null;
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(SAMPLE - 1, maxX + 1);
    maxY = Math.min(SAMPLE - 1, maxY + 1);
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const cropped = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        cropped[y * cols + x] = raw[(y + minY) * SAMPLE + (x + minX)];
      }
    }
    fillHoles(cropped, cols, rows);
    closeMidline(cropped, cols, rows);
    if (isRimMask(cropped, cols, rows)) return null;
    return { solid: cropped, cols, rows };
  };

  const closeMidline = (solid, w, h) => {
    const mid = Math.round((w - 1) / 2);
    const band = 2;
    for (let y = 0; y < h; y += 1) {
      let left = false;
      let right = false;
      for (let x = 0; x < w; x += 1) {
        if (!solid[y * w + x]) continue;
        if (x < mid - band) left = true;
        if (x > mid + band) right = true;
      }
      if (!left || !right) continue;
      for (let x = mid - band; x <= mid + band; x += 1) {
        if (x >= 0 && x < w) solid[y * w + x] = 1;
      }
    }
  };

  const distField = (solid, w, h) => {
    const dist = new Float32Array(w * h);
    for (let i = 0; i < dist.length; i += 1) dist[i] = solid[i] ? 1e6 : 0;
    const pass = (dx, dy) => {
      for (let y = dy >= 0 ? 0 : h - 1; dy >= 0 ? y < h : y >= 0; y += dy >= 0 ? 1 : -1) {
        for (let x = dx >= 0 ? 0 : w - 1; dx >= 0 ? x < w : x >= 0; x += dx >= 0 ? 1 : -1) {
          const i = y * w + x;
          if (!solid[i]) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          dist[i] = Math.min(dist[i], dist[ny * w + nx] + 1);
        }
      }
    };
    for (let n = 0; n < 2; n += 1) {
      pass(1, 0);
      pass(0, 1);
      pass(-1, 0);
      pass(0, -1);
    }
    for (let i = 0; i < dist.length; i += 1) {
      if (solid[i] && dist[i] > 1e5) dist[i] = 1;
    }
    return dist;
  };

  const inHemisphere = (x, y, z, side) => {
    const wrinkle =
      0.06 * Math.sin(x * 8.4 + y * 6.2) +
      0.04 * Math.cos(y * 7.1 - x * 5.4 + z * 4.2);
    const hx = side * 0.34;
    const e =
      ((x - hx) / 0.6) ** 2 + ((y + 0.04) / 0.76) ** 2 + (z / 0.56) ** 2;
    return e < 1 + wrinkle;
  };

  const inCerebellum = (x, y, z) => {
    const left = ((x + 0.22) / 0.32) ** 2 + ((y - 0.6) / 0.26) ** 2 + (z / 0.4) ** 2;
    const right = ((x - 0.22) / 0.32) ** 2 + ((y - 0.6) / 0.26) ** 2 + (z / 0.4) ** 2;
    return left < 0.96 || right < 0.96;
  };

  const proceduralSolid = (ix, iy, iz, cols, rows, layers) => {
    const x = (ix - (cols - 1) / 2) / ((cols - 1) / 2);
    const y = (iy - (rows - 1) / 2) / ((rows - 1) / 2);
    const z = layers <= 1 ? 0 : (iz - (layers - 1) / 2) / ((layers - 1) / 2);
    const left = inHemisphere(x, y, z, -1);
    const right = inHemisphere(x, y, z, 1);
    const cereb = inCerebellum(x, y, z);
    return left || right || cereb;
  };

  const buildBrainCells = () => {
    const emoji = sampleEmojiXY();
    const cols = emoji ? emoji.cols : COLS;
    const rows = emoji ? emoji.rows : ROWS;
    const layers = LAYERS;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const cz = (layers - 1) / 2;
    const midX = Math.round(cx);
    const midY = Math.round(cy);
    const midZ = Math.round(cz);
    const field = emoji ? distField(emoji.solid, cols, rows) : null;
    let maxField = 1;
    if (field) {
      for (let i = 0; i < field.length; i += 1) {
        if (field[i] < 1e5 && field[i] > maxField) maxField = field[i];
      }
    }
    const maxHalfZ = (layers - 1) / 2;
    const cells = [];
    let maxDist = 1;

    for (let iy = 0; iy < rows; iy += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        let halfZ = 0;
        const seedXY = ix === midX && iy === midY;
        if (emoji) {
          if (!emoji.solid[iy * cols + ix] && !seedXY) continue;
          const rx = (ix - cx) / Math.max(1, cols / 2);
          const ry = (iy - cy) / Math.max(1, rows / 2);
          const dome = Math.sqrt(Math.max(0, 1 - rx * rx * 0.92 - ry * ry * 0.92));
          const depth = field[iy * cols + ix] / maxField;
          halfZ = Math.max(1, Math.round(maxHalfZ * dome * (0.4 + 0.6 * depth)));
        }
        for (let iz = 0; iz < layers; iz += 1) {
          const zOff = iz - cz;
          const keep = emoji
            ? Math.abs(zOff) <= halfZ
            : proceduralSolid(ix, iy, iz, cols, rows, layers);
          const center = ix === midX && iy === midY && iz === midZ;
          if (seedXY && !center) continue;
          if (!keep && !center) continue;
          const order = Math.hypot(ix - cx, iy - cy);
          if (order > maxDist) maxDist = order;
          cells.push({ ix, iy, iz, center, order, always: false });
        }
      }
    }

    cells.forEach((cell) => {
      cell.center = cell.ix === midX && cell.iy === midY && cell.iz === midZ;
    });
    if (!cells.some((cell) => cell.center)) {
      cells.push({ ix: midX, iy: midY, iz: midZ, center: true, order: 0, always: false });
    }
    cells.forEach((cell) => {
      cell.order /= maxDist;
    });
    return { cells, cols, rows, layers, cx, cy, cz };
  };

  const logoHookPaths = () => ({
    top: new Path2D(
      "M16.0335 0V12.9999H30.3334C35.1198 12.9999 39 16.8801 39 21.6665V38.9997V51.9996H51.9999V21.6665C51.9999 9.70042 42.2994 0 30.3334 0H16.0335Z"
    ),
    bot: new Path2D(
      "M35.9664 51.9996V38.9997H21.6665C16.8801 38.9997 12.9999 35.1195 12.9999 30.3331V16.0332H0V30.3331C0 42.2992 9.70042 51.9996 21.6665 51.9996H35.9664Z"
    ),
  });

  const cellInHook = (ctx, hooks, ix, iy, grid) => {
    const step = 52 / grid;
    const hits = [
      [0.28, 0.28],
      [0.72, 0.28],
      [0.5, 0.5],
      [0.28, 0.72],
      [0.72, 0.72],
    ];
    let n = 0;
    for (let i = 0; i < hits.length; i += 1) {
      const x = (ix + hits[i][0]) * step;
      const y = (iy + hits[i][1]) * step;
      if (ctx.isPointInPath(hooks.top, x, y) || ctx.isPointInPath(hooks.bot, x, y)) n += 1;
    }
    return n >= 2;
  };

  const floodFrom = (solid, seeds, w, h) => {
    const dist = new Float32Array(w * h);
    dist.fill(1e9);
    const q = [];
    seeds.forEach((i) => {
      if (!solid[i]) return;
      dist[i] = 0;
      q.push(i);
    });
    let head = 0;
    while (head < q.length) {
      const i = q[head];
      head += 1;
      const x = i % w;
      const y = (i - x) / w;
      const next = [i - 1, i + 1, i - w, i + w];
      const ok = [x > 0, x < w - 1, y > 0, y < h - 1];
      for (let n = 0; n < 4; n += 1) {
        if (!ok[n]) continue;
        const ni = next[n];
        if (!solid[ni] || dist[ni] <= dist[i] + 1) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  };

  const sampleLogoXY = () => {
    const grid = LOGO_GRID;
    const cluster = LOGO_CLUSTER;
    const gap = LOGO_GAP;
    const off = document.createElement("canvas");
    const oc = off.getContext("2d");
    if (!oc) return null;
    const hooks = logoHookPaths();
    const solid = new Uint8Array(grid * grid);
    const orange = new Uint8Array(grid * grid);
    const gapMask = new Uint8Array(grid * grid);
    const linked = new Uint8Array(grid * grid);
    const seeds = [];

    for (let iy = 0; iy < grid; iy += 1) {
      for (let ix = 0; ix < grid; ix += 1) {
        const idx = iy * grid + ix;
        const inCluster = ix < cluster && iy < cluster;
        const nearCluster =
          !inCluster && ix < cluster + gap && iy < cluster + gap;
        if (inCluster) {
          orange[idx] = 1;
          solid[idx] = 1;
          linked[idx] = 1;
          seeds.push(idx);
          continue;
        }
        const onHook = cellInHook(oc, hooks, ix, iy, grid);
        if (nearCluster && !onHook) {
          gapMask[idx] = 1;
          linked[idx] = 1;
          continue;
        }
        if (onHook) {
          solid[idx] = 1;
          linked[idx] = 1;
        }
      }
    }

    const travel = floodFrom(linked, seeds, grid, grid);
    return { solid, orange, gapMask, travel, cols: grid, rows: grid };
  };

  const buildLogoCells = () => {
    const mask = sampleLogoXY();
    if (!mask) return { cells: [], cols: 1, rows: 1, layers: 1, cx: 0, cy: 0, cz: 0, pathCols: 0 };
    const { solid, orange, gapMask, travel, cols, rows } = mask;
    const layers = LOGO_LAYERS;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const cz = (layers - 1) / 2;
    const bands = [];
    for (let i = 0; i < solid.length; i += 1) {
      if (!solid[i] || orange[i] || travel[i] >= 1e8) continue;
      bands.push(travel[i]);
    }
    const unique = [...new Set(bands)].sort((a, b) => a - b);
    const colOf = new Map(unique.map((dist, i) => [dist, i]));
    const cells = [];

    for (let iy = 0; iy < rows; iy += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        const idx = iy * cols + ix;
        const cluster = !!orange[idx];
        const gap = !!gapMask[idx];
        if (!solid[idx] && !gap) continue;
        const col = cluster || gap ? -1 : (colOf.get(travel[idx]) ?? -1);
        for (let iz = 0; iz < layers; iz += 1) {
          cells.push({
            ix,
            iy,
            iz,
            center: false,
            cluster,
            gap,
            col,
            pathCols: unique.length,
            order: cluster ? 0 : Math.max(0, col),
          });
        }
      }
    }
    return { cells, cols, rows, layers, cx, cy, cz, pathCols: unique.length };
  };

  const rippleAmp = (order, cycleMs) => {
    if (reduced) return 0;
    if (cycleMs >= RIPPLE_MS) return 0;
    const t = cycleMs / RIPPLE_MS;
    const peak = t * RIPPLE_TRAVEL;
    const x = (order - peak) / RIPPLE_WIDTH;
    return Math.exp(-0.5 * x * x);
  };

  const logoEase = (t) => {
    const u = Math.min(1, Math.max(0, t));
    return u * u * (3 - 2 * u);
  };

  const logoFlowEase = (t) => {
    const u = Math.min(1, Math.max(0, t));
    return u * u * u * (u * (u * 6 - 15) + 10);
  };

  const logoFirstDur = LOGO_COL_MS * LOGO_FADE_COLS;

  const logoPhases = (colCount) => {
    const n = Math.max(1, colCount);
    const flowCols = Math.max(0, n - 1);
    const radiate = logoFirstDur + (flowCols + LOGO_FLOW_FADE) * LOGO_FLOW_COL_MS;
    const glowInEnd = LOGO_GLOW_MS;
    const holdEnd = glowInEnd + LOGO_HOLD_MS;
    const firstEnd = holdEnd + logoFirstDur;
    const radiateEnd = holdEnd + radiate;
    const fullEnd = radiateEnd + LOGO_FULL_MS;
    const glowOutEnd = fullEnd + LOGO_GLOW_MS;
    return {
      glowInEnd,
      holdEnd,
      firstEnd,
      radiateEnd,
      fullEnd,
      glowOutEnd,
      cycle: glowOutEnd + LOGO_REST_MS,
    };
  };

  const logoPathAmp = (cell, t, phase) => {
    if (cell.col < 0) return 0;
    if (t < phase.holdEnd) return 0;
    if (t >= phase.radiateEnd) return 1;
    if (cell.col === 0) {
      if (t >= phase.firstEnd) return 1;
      return logoEase((t - phase.holdEnd) / logoFirstDur);
    }
    if (t < phase.firstEnd) return 0;
    const front = 1 + (t - phase.firstEnd) / LOGO_FLOW_COL_MS;
    const u = (front - cell.col) / LOGO_FLOW_FADE;
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    return logoFlowEase(u);
  };

  const logoCellAmp = (cell, now) => {
    if (cell.gap) return 0;
    if (reduced) return cell.cluster ? 1 : 0;
    const phase = logoPhases(cell.pathCols || 1);
    const t = ((now % phase.cycle) + phase.cycle) % phase.cycle;
    const glowOut = t >= phase.fullEnd && t < phase.glowOutEnd
      ? 1 - logoEase((t - phase.fullEnd) / LOGO_GLOW_MS)
      : t >= phase.glowOutEnd
        ? 0
        : null;
    if (cell.cluster) {
      if (glowOut !== null) return glowOut;
      if (t < phase.glowInEnd) return logoEase(t / LOGO_GLOW_MS);
      return 1;
    }
    if (glowOut !== null) return glowOut;
    return logoPathAmp(cell, t, phase);
  };

  const mountField = (mount, options) => {
    if (!mount) return false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x000000, 1);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    if (options.objectScale) group.scale.setScalar(options.objectScale);
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.75);
    key.position.set(5, 7, 10);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-6, -2, 5);
    scene.add(rim);

    const dummy = new THREE.Object3D();
    const orange = new THREE.Color(ORANGE);
    const hidden = new THREE.Color(options.hidden);
    const tint = new THREE.Color();
    let mesh = null;
    let grid = { cells: [], cols: 1, rows: 1, layers: 1, cx: 0, cy: 0, cz: 0 };

    let yaw = 0;
    let pitch = 0;
    const pitchLimit = 1.15;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const placeInstance = (cell, i, amp) => {
      dummy.position.set(
        (cell.ix - grid.cx) * PITCH,
        (grid.cy - cell.iy) * PITCH,
        (cell.iz - grid.cz) * PITCH
      );
      dummy.scale.setScalar(cell.gap ? 0 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (cell.gap) tint.setRGB(0, 0, 0);
      else if (cell.center) tint.copy(orange);
      else tint.copy(hidden).lerp(orange, amp);
      mesh.setColorAt(i, tint);
    };

    const applyLit = (now) => {
      if (!mesh) return;
      const clock = Number.isFinite(window.__heroLogoT) ? window.__heroLogoT : now;
      const travelMs = options.travelMs || RIPPLE_MS;
      const cycleMs = options.phaseClock
        ? clock
        : reduced
          ? travelMs
          : clock % (options.cycleMs || CYCLE_MS);
      const ampAt = options.ampAt || ((cell, ms) => rippleAmp(cell.order, ms));
      grid.cells.forEach((cell, i) => {
        placeInstance(cell, i, ampAt(cell, cycleMs));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    const fitCamera = () => {
      if (!grid.cells.length) return;
      if (options.fit === "box") {
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        grid.cells.forEach((cell) => {
          const x = (cell.ix - grid.cx) * PITCH;
          const y = (grid.cy - cell.iy) * PITCH;
          const z = (cell.iz - grid.cz) * PITCH;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        });
        const halfW = (maxX - minX) * 0.5 + CUBE;
        const halfH = (maxY - minY) * 0.5 + CUBE;
        const halfD = (maxZ - minZ) * 0.5 + CUBE;
        const fov = (camera.fov * Math.PI) / 180;
        const aspect = Math.max(0.001, camera.aspect);
        const vFit = halfH / Math.tan(fov / 2);
        const hFit = halfW / (Math.tan(fov / 2) * aspect);
        const dFit = halfD / Math.tan(fov / 2);
        const radius = Math.hypot(halfW, halfH, halfD);
        const pad = options.fitPad || 1.18;
        const dist = Math.max(vFit, hFit, dFit, radius / Math.tan(fov / 2)) * pad;
        camera.position.set(0, 0, dist);
        camera.near = Math.max(0.1, dist / 80);
        camera.far = dist * 6;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        return;
      }
      let radius = CUBE;
      grid.cells.forEach((cell) => {
        const x = (cell.ix - grid.cx) * PITCH;
        const y = (grid.cy - cell.iy) * PITCH;
        const z = (cell.iz - grid.cz) * PITCH;
        radius = Math.max(radius, Math.hypot(x, y, z) + CUBE * 0.5);
      });
      const fov = (camera.fov * Math.PI) / 180;
      const aspect = Math.max(0.001, camera.aspect);
      const vFit = radius / Math.tan(fov / 2);
      const hFit = radius / (Math.tan(fov / 2) * aspect);
      const dist = Math.max(vFit, hFit) * (options.fitPad || 1.2);
      camera.position.set(0, 0, dist);
      camera.near = Math.max(0.1, dist / 80);
      camera.far = dist * 6;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };

    const build = () => {
      grid = options.buildCells();
      if (!grid.cells.length) return;
      const geo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.4,
        metalness: 0.06,
        transparent: false,
        opacity: 1,
        depthWrite: true,
        depthTest: true,
      });
      mesh = new THREE.InstancedMesh(geo, mat, grid.cells.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      applyLit(0);
      group.add(mesh);
      window.__heroDebug = window.__heroDebug || [];
      window.__heroDebug.push({
        cells: grid.cells.length,
        cols: grid.cols,
        rows: grid.rows,
        layers: grid.layers,
        pathCols: grid.pathCols || 0,
      });
      window.__heroSetOrbit = (nextYaw, nextPitch) => {
        yaw = nextYaw;
        pitch = Math.max(-pitchLimit, Math.min(pitchLimit, nextPitch));
      };

      const hideProbe = new THREE.Vector3();
      let lastRow = [];
      let maxIy = -Infinity;
      grid.cells.forEach((cell) => {
        if (!cell.gap && cell.iy > maxIy) maxIy = cell.iy;
      });
      const seenRow = new Set();
      grid.cells.forEach((cell) => {
        if (cell.gap || cell.iy !== maxIy) return;
        const key = `${cell.ix}:${cell.iy}`;
        if (seenRow.has(key)) return;
        seenRow.add(key);
        lastRow.push(cell);
      });
      window.__heroLogoBottomY = () => {
        if (!lastRow.length) return NaN;
        group.updateMatrixWorld(true);
        const rect = renderer.domElement.getBoundingClientRect();
        let bottom = -Infinity;
        lastRow.forEach((cell) => {
          hideProbe.set(
            (cell.ix - grid.cx) * PITCH,
            (grid.cy - cell.iy) * PITCH - CUBE * 0.5,
            (cell.iz - grid.cz) * PITCH
          );
          hideProbe.applyMatrix4(group.matrixWorld);
          hideProbe.project(camera);
          const y = rect.top + (1 - hideProbe.y) * 0.5 * rect.height;
          if (y > bottom) bottom = y;
        });
        return bottom;
      };

      const seed = grid.cells.find((cell) => cell.center);
      if (seed) {
        const seedMat = new THREE.MeshStandardMaterial({
          color: ORANGE,
          roughness: 0.4,
          metalness: 0.06,
          transparent: false,
          opacity: 1,
          depthWrite: true,
          depthTest: true,
        });
        const seedMesh = new THREE.Mesh(geo.clone(), seedMat);
        seedMesh.position.set(
          (seed.ix - grid.cx) * PITCH,
          (grid.cy - seed.iy) * PITCH,
          (seed.iz - grid.cz) * PITCH
        );
        seedMesh.scale.setScalar(1.08);
        seedMesh.renderOrder = 10;
        seedMesh.frustumCulled = false;
        group.add(seedMesh);
      }
      fitCamera();
    };

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const bleed = options.canvasBleed || 1;
      const w = Math.max(1, Math.round(rect.width * bleed));
      const h = Math.max(1, Math.round(rect.height * bleed));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, true);
      camera.aspect = w / h;
      fitCamera();
      if (window.__heroDebug && window.__heroDebug.length) {
        const last = window.__heroDebug[window.__heroDebug.length - 1];
        last.camZ = camera.position.z;
        last.aspect = camera.aspect;
        last.mount = [w, h];
      }
    };

    const onPointerDown = (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };

    const onPointerMove = (event) => {
      if (!dragging) return;
      yaw += (event.clientX - lastX) * 0.008;
      pitch = Math.max(
        -pitchLimit,
        Math.min(pitchLimit, pitch + (event.clientY - lastY) * 0.008)
      );
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onPointerUp = (event) => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    const start = () => {
      build();
      if (!mesh) return false;
      resize();
      new ResizeObserver(resize).observe(mount);

      if (reduced) {
        group.rotation.set(pitch, yaw, 0);
        renderer.render(scene, camera);
        return true;
      }

      let frame = 0;
      const tick = (now) => {
        group.rotation.set(pitch, yaw, 0);
        applyLit(now);
        renderer.render(scene, camera);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          cancelAnimationFrame(frame);
          return;
        }
        frame = requestAnimationFrame(tick);
      });
    };

    start();
    return !!mesh;
  };

  let brainStarted = false;
  const startBrain = () => {
    if (brainStarted) return;
    const mount = document.querySelector("[data-hero-cylinder]");
    if (!mount) return;
    try {
      brainStarted = !!mountField(mount, {
        hidden: HIDDEN_BRAIN,
        buildCells: buildBrainCells,
        fit: "sphere",
      });
    } catch (err) {
      brainStarted = false;
    }
  };

  const startLogo = () => {
    const wrap = document.querySelector(".hero-logo-cubes");
    const mount = document.querySelector("[data-hero-logo]");
    if (!wrap || !mount) return;
    try {
      const ok = mountField(mount, {
        hidden: HIDDEN_LOGO,
        buildCells: buildLogoCells,
        fit: "sphere",
        fitPad: 1.22,
        objectScale: 1.214,
        canvasBleed: 1,
        ampAt: logoCellAmp,
        phaseClock: true,
      });
      if (ok) wrap.classList.add("is-on");
      else wrap.classList.remove("is-on");
    } catch (err) {
      wrap.classList.remove("is-on");
      mount.replaceChildren();
    }
  };

  startLogo();
})();
