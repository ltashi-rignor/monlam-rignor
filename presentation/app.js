(() => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const bar = document.getElementById("progressBar");
  const counter = document.getElementById("slideCounter");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  let index = 0;
  let animating = false;

  function clamp(n) {
    return Math.max(0, Math.min(slides.length - 1, n));
  }

  function render(next, dir = 1) {
    if (animating || next === index) return;
    animating = true;
    const current = slides[index];
    const target = slides[next];

    current.classList.remove("is-active");
    current.classList.add("is-exit");
    target.classList.add("is-active");

    window.setTimeout(() => {
      current.classList.remove("is-exit");
      animating = false;
    }, 420);

    index = next;
    const pct = ((index + 1) / slides.length) * 100;
    bar.style.width = `${pct}%`;
    counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    history.replaceState(null, "", `#${index + 1}`);
    void dir;
  }

  function go(delta) {
    render(clamp(index + delta), delta);
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      render(0);
    } else if (e.key === "End") {
      e.preventDefault();
      render(slides.length - 1);
    } else if (e.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  });

  let touchX = null;
  document.addEventListener(
    "touchstart",
    (e) => {
      touchX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].screenX - touchX;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      touchX = null;
    },
    { passive: true },
  );

  const fromHash = Number.parseInt((location.hash || "").replace("#", ""), 10);
  const start = Number.isFinite(fromHash) ? clamp(fromHash - 1) : 0;
  slides[start].classList.add("is-active");
  index = start;
  bar.style.width = `${((index + 1) / slides.length) * 100}%`;
  counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
})();
