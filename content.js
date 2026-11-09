(() => {
  if (window.__slNeonLoaded) return;
  window.__slNeonLoaded = true;

  const DEFAULTS = {
    theme: true, tilt: true, composeFx: true, privacy: false,
    color: "purple", background: "aurora", font: "slack"
  };
  const COLORS = new Set(["purple", "blue", "pink", "cyan", "green", "bullet"]);
  const BACKGROUNDS = new Set(["aurora", "stars", "matrix", "synthwave", "bokeh", "warp", "rain", "fireflies", "orbit", "bullet", "none"]);
  const FONTS = new Set(["slack", "mono", "opensans", "arial"]);
  const settings = { ...DEFAULTS };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let fx;
  let scanTimer = 0;

  // ---------- Fundo animado ----------
  function ensureFx() {
    if (fx?.isConnected) return;
    fx = document.createElement("div");
    fx.id = "sln-fx";
    fx.setAttribute("aria-hidden", "true");
    const shape = document.createElement("div");
    shape.className = "sln-fx-shape";
    const particles = document.createElement("div");
    particles.className = "sln-fx-particles";
    for (let i = 0; i < 22; i++) {
      const span = document.createElement("span");
      span.style.setProperty("--i", i);
      span.style.setProperty("--x", ((i * 43 + 17) % 97) + "%");
      span.style.setProperty("--y", ((i * 29 + 11) % 83) + "%");
      span.style.setProperty("--d", ((i * 7) % 11) + "s");
      span.style.setProperty("--s", (3 + (i * 5) % 10) + "px");
      span.textContent = i % 2 ? "1" : "0";
      particles.appendChild(span);
    }
    fx.append(shape, particles);
    document.body.appendChild(fx);
  }

  // O fundo cobre só a área da conversa: começa onde a barra lateral termina.
  function placeFx() {
    if (!fx) return;
    const view = document.querySelector(".p-view_contents--primary, .p-workspace__primary_view, .p-message_pane");
    const r = view?.getBoundingClientRect();
    if (r && r.width > 200) {
      fx.style.inset = `${Math.max(0, r.top)}px 0 0 ${Math.max(0, r.left)}px`;
    } else {
      fx.style.removeProperty("inset");
    }
  }

  function applySettings() {
    ensureFx();
    const body = document.body;
    body.classList.toggle("sln-theme", !!settings.theme);
    body.classList.toggle("sln-tilt-on", !!settings.tilt && !!settings.theme);
    body.classList.toggle("sln-compose-on", !!settings.composeFx && !!settings.theme);
    body.classList.toggle("sln-privacy", !!settings.privacy);
    body.dataset.slnColor = COLORS.has(settings.color) ? settings.color : "purple";
    body.dataset.slnBg = settings.theme && BACKGROUNDS.has(settings.background) ? settings.background : "none";
    body.dataset.slnFont = FONTS.has(settings.font) ? settings.font : "slack";
    // fundo Bullet: o bullet-fx.js desenha num canvas dentro de #sln-fx
    // no Slack o fundo fica atrás de muita leitura: menos balas ao mesmo tempo
    document.documentElement.dataset.bulletFxDensity = "0.3";
    document.documentElement.dataset.bulletFx = body.dataset.slnBg === "bullet" ? "#sln-fx" : "off";
    if (!settings.tilt || !settings.theme) { resetTilt(); endFollow(); }
    placeFx();
    if (settings.theme) setTimeout(fixContrast, 300);
  }

  chrome.storage.local.get(DEFAULTS).then((stored) => {
    Object.assign(settings, stored);
    applySettings();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) settings[key] = changes[key].newValue ?? DEFAULTS[key];
    }
    applySettings();
  });

  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type === "ping") reply({ ok: true, theme: !!settings.theme });
  });

  // ---------- Hover 3D nas mensagens ----------
  // Mensagens são altas: a inclinação é bem menor que nas linhas do Gmail, para não atrapalhar a leitura.
  const MESSAGE_SELECTOR = ".c-message_kit__background";
  let activeRow = null;
  let pointer = null;
  let tiltFrame = 0;

  function resetTilt() {
    if (tiltFrame) cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
    if (!activeRow) return;
    activeRow.classList.remove("sln-tilting");
    activeRow.style.removeProperty("transform");
    activeRow.style.removeProperty("--sln-x");
    activeRow.style.removeProperty("--sln-y");
    activeRow = null;
  }

  function paintTilt() {
    tiltFrame = 0;
    if (!activeRow?.isConnected || !pointer || !settings.tilt || !settings.theme || reducedMotion.matches) return resetTilt();
    const rect = activeRow.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (pointer.x - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (pointer.y - rect.top) / rect.height));
    activeRow.style.setProperty("--sln-x", (x * 100).toFixed(1) + "%");
    activeRow.style.setProperty("--sln-y", (y * 100).toFixed(1) + "%");
    const tallness = Math.min(1, 60 / Math.max(rect.height, 1)); // mensagens longas inclinam ainda menos
    activeRow.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 6 * tallness).toFixed(2)}deg) rotateY(${((x - 0.5) * 3).toFixed(2)}deg) scale(1.006)`;
  }

  // ---------- Hover 3D que segue o mouse: barra lateral, faixa da esquerda, reações ----------
  const FOLLOW_SELECTOR = ".p-channel_sidebar__channel, .p-channel_sidebar__link, .p-tab_rail button, .p-tab_rail [role=tab], .c-reaction, .c-reaction_add, .c-message__reply_bar, .c-button--primary";
  let followEl = null;
  let followSpot = null;
  let followRestorePos = false;
  let followFrame = 0;
  let followPoint = null;

  function endFollow() {
    if (followFrame) cancelAnimationFrame(followFrame);
    followFrame = 0;
    if (!followEl) return;
    followEl.classList.remove("sln-follow");
    for (const p of ["--sln-rx", "--sln-ry", "--sln-x", "--sln-y"]) followEl.style.removeProperty(p);
    if (followRestorePos) followEl.style.removeProperty("position");
    followSpot?.remove();
    followEl = followSpot = null;
    followRestorePos = false;
  }

  function paintFollow() {
    followFrame = 0;
    if (!followEl?.isConnected || !followPoint) return endFollow();
    const r = followEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (followPoint.x - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (followPoint.y - r.top) / r.height));
    const tiltY = r.width > 120 ? 12 : 22;
    const tiltX = r.height > 30 ? 16 : 22;
    followEl.style.setProperty("--sln-ry", ((x - 0.5) * tiltY).toFixed(2) + "deg");
    followEl.style.setProperty("--sln-rx", ((0.5 - y) * tiltX).toFixed(2) + "deg");
    followEl.style.setProperty("--sln-x", (x * 100).toFixed(1) + "%");
    followEl.style.setProperty("--sln-y", (y * 100).toFixed(1) + "%");
  }

  function followPointer(event) {
    const target = event.target instanceof Element ? event.target.closest(FOLLOW_SELECTOR) : null;
    if (target !== followEl) {
      endFollow();
      if (!target) return;
      followEl = target;
      if (getComputedStyle(target).position === "static") {
        target.style.position = "relative";
        followRestorePos = true;
      }
      followSpot = document.createElement("span");
      followSpot.className = "sln-spot";
      followSpot.setAttribute("aria-hidden", "true");
      target.appendChild(followSpot);
      target.classList.add("sln-follow");
    }
    followPoint = { x: event.clientX, y: event.clientY };
    if (!followFrame) followFrame = requestAnimationFrame(paintFollow);
  }

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !settings.tilt || !settings.theme || reducedMotion.matches) return;
    followPointer(event);
    const row = event.target instanceof Element ? event.target.closest(MESSAGE_SELECTOR) : null;
    if (row !== activeRow) {
      resetTilt();
      if (row) {
        activeRow = row;
        row.classList.add("sln-tilting");
      }
    }
    if (!activeRow) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!tiltFrame) tiltFrame = requestAnimationFrame(paintTilt);
  }, { passive: true, capture: true });
  document.addEventListener("pointerleave", () => { resetTilt(); endFollow(); });
  window.addEventListener("blur", () => { resetTilt(); endFollow(); });
  reducedMotion.addEventListener("change", () => { resetTilt(); endFollow(); });
  window.addEventListener("resize", placeFx, { passive: true });

  // ---------- Modo discreto: Alt+P ----------
  document.addEventListener("keydown", (event) => {
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === "KeyP") {
      event.preventDefault();
      event.stopPropagation();
      chrome.storage.local.set({ privacy: !settings.privacy });
    }
  }, true);

  // ---------- Animação ao enviar ----------
  function launchSpark(fromEl) {
    if (!settings.composeFx || !settings.theme || reducedMotion.matches) return;
    const rect = fromEl.getBoundingClientRect();
    const spark = document.createElement("div");
    spark.className = "sln-send-spark";
    spark.textContent = "✦";
    spark.style.left = rect.right - 34 + "px";
    spark.style.top = rect.top - 6 + "px";
    document.body.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove());
    setTimeout(() => spark.remove(), 1500);
  }

  // Enter sem Shift no compositor envia a mensagem no Slack (configuração padrão).
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.isComposing) return;
    const editor = event.target instanceof Element ? event.target.closest(".ql-editor, .c-texty_input, [contenteditable=true]") : null;
    const box = editor?.closest(".c-wysiwyg_container, .p-message_input, .c-texty_input_unstyled__container");
    if (!box || !editor.textContent.trim()) return;
    // Lista de sugestões (menção, emoji) aberta: o Enter escolhe a sugestão, não envia.
    if (document.querySelector(".c-texty_autocomplete, .c-search_autocomplete__suggestion_list, [role=listbox][id*=autocomplete]")) return;
    launchSpark(box);
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest(".c-wysiwyg_container__button--send, [data-qa=texty_send_button]") : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    launchSpark(button.closest(".c-wysiwyg_container") || button);
  }, true);

  // ---------- Corretor de contraste ----------
  // O Slack às vezes mantém superfícies claras (modais antigos, cards de apps, prévias) mesmo com
  // as variáveis trocadas. Superfícies claras viram escuras; texto escuro sobre fundo escuro vira claro.
  // Cada elemento é checado uma vez. Imagens, emojis, avatares e prévias de arquivo ficam de fora.
  const contrastChecked = new WeakSet();
  const SKIP = "img,svg,path,video,canvas,iframe,script,style,.c-emoji,.c-avatar,.c-base_icon,.p-file_image_thumbnail__wrapper,#sln-fx,.sln-send-spark";

  function luminance(color) {
    const m = color.match(/[\d.]+/g);
    if (!m) return 1;
    const [r, g, b] = m.map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function isTransparent(color) {
    return color === "transparent" || /rgba\(.*,\s*0\)$/.test(color);
  }
  function effectiveBg(el) {
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (!isTransparent(bg)) return bg;
    }
    return "rgb(16, 11, 26)";
  }

  let lastContrast = 0;
  let contrastRetry = 0;
  function fixContrast() {
    if (!settings.theme) return;
    const now = performance.now();
    if (now - lastContrast < 1000) { clearTimeout(contrastRetry); contrastRetry = setTimeout(fixContrast, 1050); return; }
    lastContrast = now;
    let budget = 2500;
    for (const el of document.body.querySelectorAll("*")) {
      if (contrastChecked.has(el)) continue;
      if (!el.getClientRects().length) continue; // oculto: checa de novo quando aparecer
      if (--budget < 0) { contrastRetry = setTimeout(fixContrast, 1050); return; }
      contrastChecked.add(el);
      if (el.matches(SKIP) || el.closest(".c-emoji, .c-avatar, #sln-fx")) continue;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const bg = style.backgroundColor;
      if (!isTransparent(bg) && luminance(bg) > 0.72 && style.backgroundImage === "none" && rect.width > 14 && rect.height > 14) {
        el.classList.add("sln-surface");
      }
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || el.matches("input, textarea");
      if (!hasText) continue;
      if (luminance(effectiveBg(el)) < 0.4 && luminance(style.color) < 0.5) {
        el.classList.add(el.closest("a") ? "sln-ink-link" : "sln-ink");
      }
    }
  }

  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = 0; ensureFx(); placeFx(); fixContrast(); }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
