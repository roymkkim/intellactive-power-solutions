const grid = document.querySelector(".stat-grid");
const story = document.querySelector("[data-grid-story]") || document.querySelector(".market-story");
const pinScope = story ? story.querySelector(".pin-scope") : null;
const stickyScope = story ? story.querySelector("[data-sticky-scope]") || pinScope : null;
const storySticky = story ? story.querySelector(".story-sticky") : null;
const sticky = story ? story.querySelector(".grid-sticky") : null;
const runway = story ? story.querySelector(".grid-runway") : null;
const afterGrid = story ? story.querySelector(".after-grid") : null;
const afterSlot = story ? story.querySelector(".after-grid-slot") : null;
const opportunity = document.querySelector("#opportunity");
const business = document.querySelector("#business-model");

const gridAnimOff =
  document.body.classList.contains("grid-anim-off") ||
  document.documentElement.classList.contains("grid-anim-off");

// remove grid-anim-off to restore
if (!gridAnimOff && grid && story && pinScope && stickyScope && storySticky && sticky && runway && afterGrid && afterSlot && opportunity && business) {
  const COLS = 50;
  const TOTAL = 1000;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const square1pct = (row, col) => {
    const cells = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        cells.push((row + r) * COLS + (col + c));
      }
    }
    return cells;
  };

  const clusters = [
    { row: 4, col: 9 },
    { row: 11, col: 34 },
  ];
  const alive = new Set(
    clusters.flatMap(({ row, col }) => square1pct(row, col))
  );
  const centers = clusters.map(({ row, col }) => ({
    r: row + 1,
    c: col + 1,
  }));

  const dots = [];
  const distances = new Float32Array(TOTAL);
  let maxDist = 0;

  for (let i = 0; i < TOTAL; i += 1) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    let dist = Infinity;
    for (let n = 0; n < centers.length; n += 1) {
      const next = Math.hypot(row - centers[n].r, col - centers[n].c);
      if (next < dist) dist = next;
    }
    distances[i] = dist;
    if (dist > maxDist) maxDist = dist;

    const dot = document.createElement("span");
    if (alive.has(i)) dot.className = "is-alive";
    grid.appendChild(dot);
    dots.push(dot);
  }

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const states = new Uint8Array(TOTAL);
  let lastProgress = -1;

  const applyProgress = (progress) => {
    const rounded = Math.round(progress * 400) / 400;
    if (rounded === lastProgress) return;
    lastProgress = rounded;

    grid.style.setProperty("--square", String(clamp01(progress / 0.2)));
    const wave = clamp01((progress - 0.1) / 0.9);
    const done = progress >= 0.97;

    for (let i = 0; i < TOTAL; i += 1) {
      const converted = done || (wave > 0 && distances[i] <= maxDist * wave + 0.001);
      let next = 0;
      if (converted) next = 2;
      else if (alive.has(i)) next = 1;
      if (states[i] === next) continue;
      states[i] = next;
      dots[i].className = next === 2 ? "is-cell" : next === 1 ? "is-alive" : "";
    }
  };

  const lockGapPx = () => {
    const spacer = story.querySelector("[data-pin-spacer]");
    const value = spacer ? spacer.offsetHeight : 54;
    return value > 0 ? value : 54;
  };

  const pinTopPx = () => {
    const wordmark = document.querySelector(".wordmark");
    return wordmark ? wordmark.offsetHeight : 120;
  };

  const pageY = (el) => {
    let y = 0;
    for (let node = el; node; node = node.offsetParent) y += node.offsetTop;
    return y;
  };

  const heading = story.querySelector(".story-heading");
  let headingH = heading ? heading.offsetHeight : 0;
  let cached = { start: 0, end: 1 };

  const layoutAnchors = () => {
    const pin = parseFloat(getComputedStyle(storySticky).top) || pinTopPx();
    const headingGap = heading
      ? parseFloat(getComputedStyle(heading).marginBottom) || 0
      : 0;
    // storySticky is position:sticky — once pinned, offsetTop is the visual
    // offset from its relative parent, so pageY(storySticky) tracks scroll.
    const flowTop = heading
      ? pageY(heading) + heading.offsetHeight + headingGap
      : pageY(storySticky);
    const start = Math.max(0, flowTop - pin);
    const end = Math.max(
      start + 1,
      pageY(afterSlot) - pin - grid.offsetHeight - lockGapPx()
    );
    cached = { start, end };
    return cached;
  };

  let attached = false;

  const attachLock = () => {
    if (attached) return;
    afterSlot.style.height = `${afterGrid.offsetHeight}px`;
    storySticky.appendChild(afterGrid);
    attached = true;
  };

  const detachLock = () => {
    if (!attached) return;
    afterSlot.appendChild(afterGrid);
    afterSlot.style.height = "";
    attached = false;
  };

  const measure = () => {
    const lockExtra = attached ? afterGrid.offsetHeight : 0;
    const lockLine = grid.getBoundingClientRect().bottom + lockGapPx();
    const remain = afterSlot.getBoundingClientRect().top - lockLine;
    const traveled = Math.max(0, window.scrollY - lockExtra - cached.start);
    const span = traveled + Math.max(0, remain);
    if (span <= 1) return remain <= 0 ? 1 : 0;
    return clamp01(traveled / span);
  };

  const steps = story.querySelector(".steps");
  const market = story.querySelector(".market");
  const mobileFade = window.matchMedia("(max-width: 860px)");

  const fadeBehindGrid = (el) => {
    if (!el) return 0;
    const box = el.getBoundingClientRect();
    const line = grid.getBoundingClientRect().bottom;
    const span = Math.max(72, box.height * 0.9);
    return clamp01((line - box.top) / span);
  };

  const remasureLayout = () => {
    if (heading) headingH = heading.offsetHeight;
    syncGridH();
    layoutAnchors();
  };

  let frame = 0;
  const paint = () => {
    frame = 0;
    remasureLayout();
    const progress = reduced ? (measure() > 0.55 ? 1 : 0) : measure();
    const fade = clamp01(progress * 1.4);
    if (mobileFade.matches) {
      const headingFade = fadeBehindGrid(heading);
      const stepsFade = fadeBehindGrid(steps);
      const marketFade = fadeBehindGrid(market);
      story.style.setProperty("--copy-fade", String(Math.max(headingFade, stepsFade)));
      if (heading) {
        heading.style.opacity = String(1 - headingFade);
        heading.style.transform = `translateY(${-headingH * headingFade}px)`;
      }
      if (steps) steps.style.opacity = String(1 - stepsFade);
      if (market) market.style.opacity = String(1 - marketFade);
    } else {
      story.style.setProperty("--copy-fade", String(fade));
      if (heading) {
        heading.style.opacity = "";
        heading.style.transform = `translateY(${-headingH * fade}px)`;
      }
      if (steps) steps.style.opacity = "";
      if (market) market.style.opacity = "";
    }
    const gridTop = grid.getBoundingClientRect().top;
    const settled = pinTopPx();
    const headingGap = heading
      ? parseFloat(getComputedStyle(heading).marginBottom) || 0
      : 0;
    const clusterStart = settled + headingH + headingGap;
    const clusterIn = reduced
      ? 1
      : clamp01((clusterStart - gridTop) / Math.max(1, clusterStart - settled));
    grid.style.setProperty("--alive-cluster", String(clusterIn));
    applyProgress(progress);

    const lockLine = grid.getBoundingClientRect().bottom + lockGapPx();
    const slotTop = afterSlot.getBoundingClientRect().top;
    if (!attached && slotTop <= lockLine) attachLock();
    if (attached && window.scrollY < cached.end - 64 && slotTop > lockLine + 24) {
      detachLock();
    }

    const stillPinned = stickyScope.getBoundingClientRect().bottom > storySticky.getBoundingClientRect().top + 40;
    const pinning = stillPinned && progress > 0.02 && progress < 0.98;
    const complete = progress >= 0.98;
    story.classList.toggle("is-pinning", pinning);
    story.classList.toggle("is-complete", complete);
    pinScope.classList.toggle("is-pinning", pinning);
    pinScope.classList.toggle("is-complete", complete);
    stickyScope.classList.toggle("is-pinning", pinning);
    stickyScope.classList.toggle("is-complete", complete);
  };

  const requestPaint = () => {
    if (frame) return;
    frame = requestAnimationFrame(paint);
  };

  const syncGridH = () => {
    const value = `${grid.offsetHeight}px`;
    story.style.setProperty("--stat-grid-h", value);
    document.documentElement.style.setProperty("--stat-grid-h", value);
  };
  remasureLayout();

  const kickLayout = () => {
    remasureLayout();
    requestPaint();
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(kickLayout);
  }
  window.addEventListener("load", kickLayout);
  requestAnimationFrame(() => {
    kickLayout();
    requestAnimationFrame(kickLayout);
  });
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(kickLayout);
    ro.observe(story);
    ro.observe(afterSlot);
  }

  window.addEventListener("scroll", requestPaint, { passive: true });
  window.addEventListener("resize", () => {
    detachLock();
    if (heading) heading.style.transform = "";
    remasureLayout();
    requestPaint();
  });
  paint();
}

(() => {
  const header = document.querySelector(".wordmark");
  const heroLogo = document.querySelector(".hero-logo-cubes") || document.querySelector("[data-hero-logo]");
  if (!header || !heroLogo) return;
  const logoBox = () =>
    document.querySelector("[data-hero-logo] canvas") || heroLogo;
  const lastCubeY = () => {
    if (typeof window.__heroLogoBottomY === "function") {
      const y = window.__heroLogoBottomY();
      if (Number.isFinite(y)) return y;
    }
    return logoBox().getBoundingClientRect().bottom;
  };
  const syncDocked = () => {
    const headerBottom = header.getBoundingClientRect().bottom;
    header.classList.toggle("is-docked", lastCubeY() <= headerBottom);
  };
  window.addEventListener("scroll", syncDocked, { passive: true });
  window.addEventListener("resize", syncDocked);
  syncDocked();
})();

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
