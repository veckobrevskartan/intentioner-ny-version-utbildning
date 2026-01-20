(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // =========================
  // Module interactivity
  // =========================
  const modules = $$("#modules .module");

  function applyImgTransform(img, state){
    img.style.transform = `translate(calc(-50% + ${state.tx}px), calc(-50% + ${state.ty}px)) scale(${state.scale})`;
  }

  function makeModuleInteractive(mod){
    const frame = $(".frame", mod);
    const img = $("[data-img]", mod);
    const btnOpen = $("[data-open]", mod);
    const btnFit = $("[data-fit]", mod);
    const btns = $$("[data-zoom]", mod);

    // State per module
    const st = {
      scale: 1,
      tx: 0,
      ty: 0,
      drag: { active:false, x:0, y:0, startTx:0, startTy:0 }
    };

    function fit(){
      st.scale = 1;
      st.tx = 0;
      st.ty = 0;
      applyImgTransform(img, st);
      const reset = btns.find(b => b.dataset.zoom === "reset");
      if (reset) reset.textContent = "100%";
    }

    function setScale(next, anchorX=null, anchorY=null){
      const prev = st.scale;
      next = clamp(next, 0.2, 6);
      if (next === prev) return;

      if (anchorX != null && anchorY != null && frame){
        const rect = frame.getBoundingClientRect();
        const ax = anchorX - (rect.left + rect.width/2);
        const ay = anchorY - (rect.top + rect.height/2);
        const ratio = next / prev;
        st.tx = st.tx * ratio + ax * (1 - ratio);
        st.ty = st.ty * ratio + ay * (1 - ratio);
      }

      st.scale = next;
      applyImgTransform(img, st);

      const reset = btns.find(b => b.dataset.zoom === "reset");
      if (reset) reset.textContent = `${Math.round(st.scale * 100)}%`;
    }

    // buttons
    btns.forEach(b => {
      b.addEventListener("click", () => {
        const t = b.dataset.zoom;
        if (t === "in") setScale(st.scale * 1.2);
        if (t === "out") setScale(st.scale / 1.2);
        if (t === "reset") fit();
      });
    });

    btnFit?.addEventListener("click", fit);

    // drag pan
    frame?.addEventListener("pointerdown", (e) => {
      st.drag.active = true;
      st.drag.x = e.clientX;
      st.drag.y = e.clientY;
      st.drag.startTx = st.tx;
      st.drag.startTy = st.ty;
      frame.setPointerCapture(e.pointerId);
    });
    frame?.addEventListener("pointermove", (e) => {
      if (!st.drag.active) return;
      const dx = e.clientX - st.drag.x;
      const dy = e.clientY - st.drag.y;
      st.tx = st.drag.startTx + dx;
      st.ty = st.drag.startTy + dy;
      applyImgTransform(img, st);
    });
    frame?.addEventListener("pointerup", () => st.drag.active = false);
    frame?.addEventListener("pointercancel", () => st.drag.active = false);

    // wheel zoom
    frame?.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1/1.12;
      setScale(st.scale * factor, e.clientX, e.clientY);
    }, { passive:false });

    // dblclick toggle
    frame?.addEventListener("dblclick", (e) => {
      if (Math.abs(st.scale - 1) < 0.05) setScale(2, e.clientX, e.clientY);
      else fit();
    });

    // open in viewer
    btnOpen?.addEventListener("click", (e) => {
      e.stopPropagation();
      openViewer(img.getAttribute("src"), img.getAttribute("alt") || "Bild");
    });

    // init
    fit();
    mod._state = { fit, setScale, st, img };
  }

  modules.forEach(makeModuleInteractive);

  // Reset all
  $("#btnResetAll")?.addEventListener("click", () => {
    modules.forEach(m => m._state?.fit?.());
  });

  // =========================
  // Filter + tags
  // =========================
  const filter = $("#filter");
  const tagBar = $("#tagBar");

  function applyVisibility(){
    const q = (filter?.value || "").trim().toLowerCase();
    const activeTagBtn = $(".tag.is-active", tagBar);
    const activeTag = activeTagBtn?.dataset.tag || "alla";

    modules.forEach(mod => {
      const text = mod.innerText.toLowerCase();
      const tags = (mod.dataset.tags || "").split(/\s+/).filter(Boolean);
      const tagOk = (activeTag === "alla") || tags.includes(activeTag);
      const qOk = !q || text.includes(q);
      mod.style.display = (tagOk && qOk) ? "" : "none";
    });
  }

  filter?.addEventListener("input", applyVisibility);

  tagBar?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tag");
    if (!btn) return;
    $$(".tag", tagBar).forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    applyVisibility();
  });

  // =========================
  // Viewer / Lightbox
  // =========================
  const viewer = $("#viewer");
  const vImg = $("#viewerImg");
  const vTitle = $("#viewerTitle");
  const vStage = $("#viewerStage");
  const vClose = $("#vClose");
  const vZoomIn = $("#vZoomIn");
  const vZoomOut = $("#vZoomOut");
  const vZoomReset = $("#vZoomReset");
  const vFullscreen = $("#vFullscreen");

  const vState = {
    open: false,
    scale: 1,
    tx: 0,
    ty: 0,
    drag: { active:false, x:0, y:0, startTx:0, startTy:0 }
  };

  function vApply(){
    vImg.style.transform = `translate(calc(-50% + ${vState.tx}px), calc(-50% + ${vState.ty}px)) scale(${vState.scale})`;
    vZoomReset.textContent = `${Math.round(vState.scale * 100)}%`;
  }
  function vReset(){
    vState.scale = 1;
    vState.tx = 0;
    vState.ty = 0;
    vApply();
  }
  function vSetScale(next, cx=null, cy=null){
    const prev = vState.scale;
    next = clamp(next, 0.2, 8);
    if (next === prev) return;

    if (cx != null && cy != null && vStage){
      const rect = vStage.getBoundingClientRect();
      const ax = cx - (rect.left + rect.width/2);
      const ay = cy - (rect.top + rect.height/2);
      const ratio = next / prev;
      vState.tx = vState.tx * ratio + ax * (1 - ratio);
      vState.ty = vState.ty * ratio + ay * (1 - ratio);
    }

    vState.scale = next;
    vApply();
  }

  function openViewer(src, title){
    vState.open = true;
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden","false");
    document.documentElement.style.overflow = "hidden";
    vImg.src = src;
    vImg.alt = title;
    vTitle.textContent = title;
    vReset();
  }

  function closeViewer(){
    vState.open = false;
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden","true");
    document.documentElement.style.overflow = "";
    vImg.src = "";
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }

  // Close handlers
  vClose?.addEventListener("click", closeViewer);
  $$("[data-close]").forEach(el => el.addEventListener("click", closeViewer));

  // Zoom controls
  vZoomIn?.addEventListener("click", () => vSetScale(vState.scale * 1.2));
  vZoomOut?.addEventListener("click", () => vSetScale(vState.scale / 1.2));
  vZoomReset?.addEventListener("click", vReset);

  // Wheel zoom
  vStage?.addEventListener("wheel", (e) => {
    if (!vState.open) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1/1.12;
    vSetScale(vState.scale * factor, e.clientX, e.clientY);
  }, { passive:false });

  // Drag pan
  vStage?.addEventListener("pointerdown", (e) => {
    if (!vState.open) return;
    vState.drag.active = true;
    vState.drag.x = e.clientX;
    vState.drag.y = e.clientY;
    vState.drag.startTx = vState.tx;
    vState.drag.startTy = vState.ty;
    vStage.setPointerCapture(e.pointerId);
  });
  vStage?.addEventListener("pointermove", (e) => {
    if (!vState.drag.active) return;
    const dx = e.clientX - vState.drag.x;
    const dy = e.clientY - vState.drag.y;
    vState.tx = vState.drag.startTx + dx;
    vState.ty = vState.drag.startTy + dy;
    vApply();
  });
  vStage?.addEventListener("pointerup", () => vState.drag.active = false);
  vStage?.addEventListener("pointercancel", () => vState.drag.active = false);

  // dblclick toggle
  vStage?.addEventListener("dblclick", (e) => {
    if (Math.abs(vState.scale - 1) < 0.05) vSetScale(2, e.clientX, e.clientY);
    else vReset();
  });

  // Fullscreen
  function toggleFs(){
    const panel = $(".viewer__panel");
    if (!panel) return;
    if (!document.fullscreenElement) panel.requestFullscreen?.().catch(()=>{});
    else document.exitFullscreen?.().catch(()=>{});
  }
  vFullscreen?.addEventListener("click", toggleFs);

  // expose to module open + slide
  window.openViewer = openViewer;

  // =========================
  // SLIDE MODE (module -> fullscreen slide)
  // =========================
  const slide = $("#slide");
  const sPanel = $(".slide__panel");
  const sClose = $("#sClose");
  const sPrev = $("#sPrev");
  const sNext = $("#sNext");
  const sFullscreen = $("#sFullscreen");
  const sOpenImage = $("#sOpenImage");

  const sKicker = $("#sKicker");
  const sTitle = $("#sTitle");
  const sPill = $("#sPill");
  const sImg = $("#sImg");
  const sContent = $("#sContent");

  const slideState = {
    open: false,
    idx: -1,
  };

  function visibleModules(){
    return modules.filter(m => m.style.display !== "none");
  }

  function openSlideByIndex(i){
    const vis = visibleModules();
    if (!vis.length) return;

    i = clamp(i, 0, vis.length - 1);
    const mod = vis[i];

    slideState.open = true;
    slideState.idx = i;

    slide.classList.add("is-open");
    slide.setAttribute("aria-hidden","false");
    document.documentElement.style.overflow = "hidden";

    const kickerEl = $(".module__kicker", mod);
    const titleEl = $(".module__title", mod);
    const pillEl = $(".module__pill", mod);
    const imgEl = $("[data-img]", mod);
    const lessonEl = $(".lesson", mod);

    sKicker.textContent = kickerEl?.textContent?.trim() || "Modul";
    sTitle.textContent = titleEl?.textContent?.trim() || "Titel";
    sPill.textContent = pillEl?.textContent?.trim() || "";
    sPill.style.display = sPill.textContent ? "" : "none";

    const src = imgEl?.getAttribute("src") || "";
    const alt = imgEl?.getAttribute("alt") || sTitle.textContent;

    sImg.src = src;
    sImg.alt = alt;

    // inject lesson content (clone)
    sContent.innerHTML = "";
    if (lessonEl){
      const clone = lessonEl.cloneNode(true);
      sContent.appendChild(clone);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "lesson";
      fallback.innerHTML = `<h3>Undervisning</h3><p>Ingen undervisningstext hittades för den här modulen.</p>`;
      sContent.appendChild(fallback);
    }
  }

  function closeSlide(){
    slideState.open = false;
    slideState.idx = -1;
    slide.classList.remove("is-open");
    slide.setAttribute("aria-hidden","true");
    document.documentElement.style.overflow = "";
    sImg.src = "";
    sContent.innerHTML = "";
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }

  function slidePrev(){
    const vis = visibleModules();
    if (!vis.length) return;
    openSlideByIndex(slideState.idx - 1);
  }

  function slideNext(){
    const vis = visibleModules();
    if (!vis.length) return;
    openSlideByIndex(slideState.idx + 1);
  }

  function toggleSlideFs(){
    if (!sPanel) return;
    if (!document.fullscreenElement) sPanel.requestFullscreen?.().catch(()=>{});
    else document.exitFullscreen?.().catch(()=>{});
  }

  // Click-to-open slide on module (ignore clicks on controls/buttons/inputs)
  function isInteractiveTarget(t){
    return !!t.closest("button, a, input, textarea, select, .controls, .viewer, .slide");
  }

  modules.forEach((mod) => {
    mod.addEventListener("click", (e) => {
      if (isInteractiveTarget(e.target)) return;
      const vis = visibleModules();
      const i = vis.indexOf(mod);
      if (i >= 0) openSlideByIndex(i);
    });
  });

  // Slide buttons
  sClose?.addEventListener("click", closeSlide);
  $$("[data-slide-close]").forEach(el => el.addEventListener("click", closeSlide));
  sPrev?.addEventListener("click", slidePrev);
  sNext?.addEventListener("click", slideNext);
  sFullscreen?.addEventListener("click", toggleSlideFs);

  // Open image in viewer from slide
  function openSlideImageInViewer(){
    if (!slideState.open) return;
    openViewer(sImg.src, sImg.alt || sTitle.textContent || "Bild");
  }
  sOpenImage?.addEventListener("click", openSlideImageInViewer);
  sImg?.addEventListener("click", openSlideImageInViewer);

  // Keyboard for slide + viewer
  document.addEventListener("keydown", (e) => {
    // If viewer open, viewer handler below will handle keys (but we keep this clean)
    if (vState.open) return;

    if (slideState.open){
      if (e.key === "Escape") { closeSlide(); return; }
      if (e.key === "ArrowLeft") { slidePrev(); return; }
      if (e.key === "ArrowRight") { slideNext(); return; }
      if (e.key.toLowerCase() === "f") { toggleSlideFs(); return; }
      if (e.key === "Enter") { openSlideImageInViewer(); return; }
    }
  });

  // =========================
  // Viewer keyboard (existing)
  // =========================
  document.addEventListener("keydown", (e) => {
    if (!vState.open) return;
    if (e.key === "Escape") closeViewer();
    if (e.key === "+" || e.key === "=") vSetScale(vState.scale * 1.15);
    if (e.key === "-" || e.key === "_") vSetScale(vState.scale / 1.15);
    if (e.key.toLowerCase() === "f") toggleFs();
    if (e.key === "0") vReset();
  });

  // initial filter state
  applyVisibility();
})();
