// Gentle fade-in as sections scroll into view. Content stays visible if
// JavaScript is off or the visitor prefers reduced motion.
(() => {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const targets = document.querySelectorAll(
    ".pitch-block > .eyebrow, .pitch-block > .fig-kicker, .fig-row > li, .intro.cta > *"
  );
  document.documentElement.classList.add("reveal-on");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  targets.forEach((el, i) => {
    const siblings = el.parentElement ? [...el.parentElement.children] : [];
    el.style.setProperty("--reveal-delay", `${Math.min(siblings.indexOf(el), 4) * 70}ms`);
    io.observe(el);
  });
})();
