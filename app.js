(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Expand / Collapse all details panels
  const btnExpandAll = $("#btnExpandAll");
  const btnCollapseAll = $("#btnCollapseAll");

  btnExpandAll?.addEventListener("click", () => {
    $$("details.panel").forEach(d => d.open = true);
  });

  btnCollapseAll?.addEventListener("click", () => {
    $$("details.panel").forEach(d => d.open = false);
    // keep the first open if you want: $$("details.panel")[0].open = true;
  });

  // Lightbox
  const lightbox = $("#lightbox");
  const imgEl = $("#lightboxImg");
  const titleEl = $("#lightboxTitle");
  const stage = $("#stage");

  const btnClose = $("#btnClose");
  const btnZoomIn = $("#btnZoomIn");
  const btnZoomOut = $("#btnZoomOut");
  const btnZoomReset = $("#btnZoomReset");
  const btnFullscreen = $("#btnFullscreen");

  let isOpen = false;
  let scale = 1;
  let minScale = 0.2;
  let maxScale = 6;
  let tx = 0; // pan x (px)
  let ty = 0; // pan y (px)
  let drag = { active: false, x: 0, y: 0, startTx: 0, startTy: 0 };

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

  function applyTransform(){
    if (!imgEl) return;
    imgEl.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`;
    if (btnZoomReset) btnZoomReset.textContent = `${Math.round(scale * 100)}%`;
  }

  function resetView(){
    scale = 1;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function openLightbox(src, alt){
    if (!lightbox || !imgEl) return;
    isOpen = true;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");

    imgEl.src = src;
    imgEl.alt = alt || "";
    titleEl.textContent = (alt || "Bild").trim() || "Bild";

    resetView();
    // prevent background scroll
    document.documentElement.style.overflow = "hidden";
  }

  function closeLightbox(){
    if (!lightbox || !imgEl) return;
    isOpen = false;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    imgEl.src = "";
    // allow background scroll
    document.documentElement.style.overflow = "";
    // exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Click images to open
  $$("img[data-lightbox]").forEach(img => {
    img.addEventListener("click", () => openLightbox(img.getAttribute("src"), img.getAttribute("alt")));
  });

  // Close buttons
  btnClose?.addEventListener("click", closeLightbox);
  $$("[data-close]").forEach(el => el.addEventListener("click", closeLightbox));

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "+" || e.key === "=") { zoomBy(1.15); }
    if (e.key === "-" || e.key === "_") { zoomBy(1/1.15); }
    if (e.key.toLowerCase() === "f") { toggleFullscreen(); }
    if (e.key.toLowerCase() === "0") { resetView(); }
  });

  // Zoom helpers
  function zoomBy(factor, anchorClientX=null, anchorClientY=null){
    const prev = scale;
    const next = clamp(scale * factor, minScale, maxScale);
    if (next === prev) return;

    // if we have an anchor point in stage coords, zoom around it
    if (anchorClientX != null && anchorClientY != null && stage){
      const rect = stage.getBoundingClientRect();
      const ax = anchorClientX - (rect.left + rect.width / 2);
      const ay = anchorClientY - (rect.top + rect.height / 2);

      // Adjust translation so that the anchor feels stable during zoom
      const ratio = next / prev;
      tx = tx * ratio + ax * (1 - ratio);
      ty = ty * ratio + ay * (1 - ratio);
    }

    scale = next;
    applyTransform();
  }

  btnZoomIn?.addEventListener("click", () => zoomBy(1.2));
  btnZoomOut?.addEventListener("click", () => zoomBy(1/1.2));
  btnZoomReset?.addEventListener("click", resetView);

  // Wheel zoom (trackpad/mouse)
  stage?.addEventListener("wheel", (e) => {
    if (!isOpen) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1/1.12;
    zoomBy(factor, e.clientX, e.clientY);
  }, { passive: false });

  // Drag to pan
  stage?.addEventListener("pointerdown", (e) => {
    if (!isOpen) return;
    drag.active = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.startTx = tx;
    drag.startTy = ty;
    stage.setPointerCapture(e.pointerId);
  });

  stage?.addEventListener("pointermove", (e) => {
    if (!drag.active) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    tx = drag.startTx + dx;
    ty = drag.startTy + dy;
    applyTransform();
  });

  stage?.addEventListener("pointerup", () => { drag.active = false; });
  stage?.addEventListener("pointercancel", () => { drag.active = false; });

  // Double click to zoom in/out
  stage?.addEventListener("dblclick", (e) => {
    if (!isOpen) return;
    // toggle between 100% and 200% around cursor
    if (Math.abs(scale - 1) < 0.05) zoomBy(2, e.clientX, e.clientY);
    else resetView();
  });

  // Fullscreen
  function toggleFullscreen(){
    const panel = $(".lightbox__panel");
    if (!panel) return;
    if (!document.fullscreenElement) {
      panel.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
  btnFullscreen?.addEventListener("click", toggleFullscreen);
})();
