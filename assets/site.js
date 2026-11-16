(() => {
  "use strict";

  function initializeNavigation() {
    const nav = document.querySelector("#site-nav");
    const toggle = document.querySelector("#nav-toggle");
    if (!nav) return;

    function setMenuOpen(open) {
      if (open) nav.setAttribute("data-open", "true");
      else nav.removeAttribute("data-open");
      toggle?.setAttribute("aria-expanded", String(open));
    }

    toggle?.addEventListener("click", () => {
      setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a[href^='#']")) {
        setMenuOpen(false);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        nav.hasAttribute("data-open") &&
        !document.querySelector("dialog[open]")
      ) {
        setMenuOpen(false);
        toggle?.focus();
      }
    });

    const sections = Array.from(nav.querySelectorAll("a[href^='#']"), (link) => {
      try {
        const id = decodeURIComponent(link.getAttribute("href").slice(1));
        return { link, section: document.getElementById(id) };
      } catch {
        return { link, section: null };
      }
    }).filter(({ section }) => section);
    if (!sections.length) return;

    const header = nav.closest("header");
    let pendingUpdate = 0;
    let currentLink;

    function markCurrentSection() {
      pendingUpdate = 0;
      const headerBottom = header?.getBoundingClientRect().bottom || 0;
      const marker = Math.max(headerBottom + 36, window.innerHeight * 0.25);
      let activeLink = null;

      for (const { link, section } of sections) {
        if (section.getBoundingClientRect().top <= marker) {
          activeLink = link;
        }
      }

      const viewportBottom = window.scrollY + window.innerHeight;
      const documentBottom = document.documentElement.scrollHeight;
      if (window.scrollY > 0 && viewportBottom >= documentBottom - 2) {
        activeLink = sections.at(-1).link;
      }

      if (activeLink === currentLink) return;
      for (const { link } of sections) {
        if (link === activeLink) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
      currentLink = activeLink;
    }

    function scheduleUpdate() {
      if (!pendingUpdate) pendingUpdate = window.requestAnimationFrame(markCurrentSection);
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);
    window.addEventListener("load", scheduleUpdate, { once: true });
    scheduleUpdate();
  }

  function initializeImagePreviews() {
    const dialog = document.querySelector("#image-dialog");
    if (typeof dialog?.showModal !== "function") return;

    const links = Array.from(document.querySelectorAll("a[data-preview][href]"));
    const title = dialog.querySelector("[data-image-title]");
    const fullImage = dialog.querySelector("[data-image-full]");
    const caption = dialog.querySelector("[data-image-caption]");
    const close = dialog.querySelector("[data-image-close]");
    const previous = dialog.querySelector("[data-image-prev]");
    const next = dialog.querySelector("[data-image-next]");
    if (!links.length || !fullImage) return;

    let index = 0;
    let opener = null;

    function showImage(newIndex) {
      index = (newIndex + links.length) % links.length;
      const link = links[index];
      const imageTitle = link.dataset.preview || link.querySelector("img")?.alt || "图片预览";
      const imageCaption = link.dataset.caption?.trim() || "";

      if (title) title.textContent = imageTitle;
      fullImage.alt = imageTitle;
      fullImage.src = link.href;
      if (caption) {
        caption.textContent = imageCaption;
        caption.hidden = !imageCaption;
      }
    }

    links.forEach((link, linkIndex) => {
      link.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
          return;
        }
        try {
          dialog.showModal();
        } catch {
          return;
        }
        event.preventDefault();
        opener = link;
        showImage(linkIndex);
        close?.focus();
      });
    });

    if (previous) previous.disabled = links.length < 2;
    if (next) next.disabled = links.length < 2;
    previous?.addEventListener("click", () => showImage(index - 1));
    next?.addEventListener("click", () => showImage(index + 1));
    close?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      opener?.focus();
      opener = null;
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (outside) dialog.close();
    });
    dialog.addEventListener("keydown", (event) => {
      if (links.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      showImage(index + (event.key === "ArrowLeft" ? -1 : 1));
    });
  }

  function initializeSignalDemo() {
    const demo = document.querySelector("#signal-demo");
    if (!demo) return;

    const canvas = demo.querySelector("#signal-canvas");
    const play = demo.querySelector("[data-signal-play]");
    const playLabel = play?.querySelector("[data-signal-play-label]") ||
      Array.from(play?.childNodes || []).find((node) => node.nodeType === Node.TEXT_NODE && /播放|暂停/.test(node.textContent));
    const timeInput = demo.querySelector("[data-signal-time]");
    const clock = demo.querySelector("[data-signal-clock]");
    const vowelButtons = Array.from(demo.querySelectorAll("[data-vowel]"));
    const context = canvas?.getContext("2d");
    if (!context || !play || !timeInput) return;

    const duration = 2000;
    const pointCount = 801;
    const settings = {
      a: { rate: 17, harmonic: 0.31, offset: 0.08, start: 0.17, end: 1.72 },
      i: { rate: 21, harmonic: 0.47, offset: 0.19, start: 0.23, end: 1.8 },
      u: { rate: 14, harmonic: 0.17, offset: 0.32, start: 0.15, end: 1.68 }
    };
    const palette = {
      audio: "#0d766d",
      vibration: "#b96d3d",
      grid: "#dce9e7",
      cursor: "#183a37",
      label: "#506b68"
    };
    let time = Math.min(duration, Math.max(0, timeInput.valueAsNumber || 0));
    let width = 0;
    let height = 0;
    let frame = 0;
    let animationStart = 0;
    let currentSeries = null;

    function buildSeries(vowel) {
      const { rate, harmonic, offset, start, end } = settings[vowel];
      const audio = new Float32Array(pointCount);
      const vibration = new Float32Array(pointCount);

      function envelope(second) {
        const attack = Math.max(0, Math.min(1, (second - start) / 0.23));
        const release = Math.max(0, Math.min(1, (end - second) / 0.26));
        const accent = 0.74 + 0.16 * Math.sin(2 * Math.PI * (second + offset) * 1.28);
        return Math.sin(attack * Math.PI / 2) * Math.sin(release * Math.PI / 2) * accent;
      }

      // This is an illustrative waveform. Its plotted cycles describe the animation only.
      for (let point = 0; point < pointCount; point++) {
        const second = point * (duration / 1000) / (pointCount - 1);
        const phase = 2 * Math.PI * rate * second;
        const delayed = phase - 0.5;
        audio[point] = envelope(second) * (
          0.74 * Math.sin(phase) +
          harmonic * Math.sin(2 * phase + 0.37) +
          0.09 * Math.sin(3 * phase - 0.44)
        ) + 0.018 * Math.sin(57 * second);
        vibration[point] = envelope(second - 0.013) * (
          0.69 * Math.sin(delayed) -
          0.22 * Math.sin(2 * delayed + offset) +
          0.06 * Math.sin(3 * delayed)
        ) + 0.012 * Math.sin(41 * second);
      }

      return { audio, vibration };
    }

    function draw() {
      if (width <= 0 || height <= 0 || !currentSeries) return;
      const left = 18;
      const right = width - 18;
      const top = 12;
      const bottom = height - 28;
      const laneHeight = (bottom - top) / 2;
      const firstLine = top + laneHeight * 0.5;
      const secondLine = top + laneHeight * 1.5;
      const amplitude = laneHeight * 0.43;
      const plotWidth = right - left;
      if (plotWidth <= 0 || laneHeight <= 0) return;

      context.clearRect(0, 0, width, height);
      context.strokeStyle = palette.grid;
      context.lineWidth = 1;

      context.beginPath();
      for (let tick = 0; tick <= 8; tick++) {
        const x = left + (plotWidth * tick) / 8;
        context.moveTo(x, top);
        context.lineTo(x, bottom);
      }
      for (const y of [top, firstLine, top + laneHeight, secondLine, bottom]) {
        context.moveTo(left, y);
        context.lineTo(right, y);
      }
      context.stroke();

      context.font = "11px system-ui, sans-serif";
      context.fillStyle = palette.label;
      const ticks = ["0", "0.5", "1.0", "1.5", "2.0 s"];
      ticks.forEach((tick, index) => {
        context.textAlign = index === 0 ? "left" : index === ticks.length - 1 ? "right" : "center";
        context.fillText(tick, left + (plotWidth * index) / (ticks.length - 1), height - 8);
      });

      function trace(series, center, color) {
        context.strokeStyle = color;
        context.lineWidth = 1.7;
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(left, center - series[0] * amplitude);
        for (let point = 1; point < pointCount; point++) {
          const x = left + plotWidth * point / (pointCount - 1);
          context.lineTo(x, center - series[point] * amplitude);
        }
        context.stroke();
      }

      trace(currentSeries.audio, firstLine, palette.audio);
      trace(currentSeries.vibration, secondLine, palette.vibration);

      const fraction = time / duration;
      const cursorX = left + plotWidth * fraction;
      context.strokeStyle = palette.cursor;
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(cursorX, top);
      context.lineTo(cursorX, bottom);
      context.stroke();

      const cursorIndex = Math.round(fraction * (pointCount - 1));
      const dots = [
        [firstLine - currentSeries.audio[cursorIndex] * amplitude, palette.audio],
        [secondLine - currentSeries.vibration[cursorIndex] * amplitude, palette.vibration]
      ];
      for (const [y, color] of dots) {
        context.fillStyle = color;
        context.beginPath();
        context.arc(cursorX, y, 3.8, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#fff";
        context.stroke();
      }
    }

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function updateTime(newTime) {
      time = Math.max(0, Math.min(duration, newTime));
      timeInput.value = String(Math.round(time));
      const seconds = (time / 1000).toFixed(2);
      timeInput.setAttribute("aria-valuetext", `${seconds} 秒`);
      if (clock && clock.textContent !== `${seconds} s`) clock.textContent = `${seconds} s`;
      draw();
    }

    function setPlaying(playing) {
      const label = playing ? "暂停" : "播放";
      play.dataset.playing = String(playing);
      play.setAttribute("aria-label", `${label}示意波形`);
      if (playLabel) playLabel.textContent = label;
    }

    function stopPlayback() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      setPlaying(false);
    }

    function animate(timestamp) {
      updateTime(timestamp - animationStart);
      if (time < duration) frame = window.requestAnimationFrame(animate);
      else stopPlayback();
    }

    function selectVowel(vowel) {
      if (!Object.hasOwn(settings, vowel)) return;
      currentSeries = buildSeries(vowel);
      for (const button of vowelButtons) {
        button.setAttribute("aria-pressed", String(button.dataset.vowel === vowel));
      }
      draw();
    }

    play.addEventListener("click", () => {
      if (frame) {
        stopPlayback();
        return;
      }
      if (time >= duration) updateTime(0);
      animationStart = window.performance.now() - time;
      setPlaying(true);
      frame = window.requestAnimationFrame(animate);
    });
    timeInput.addEventListener("input", () => {
      if (frame) stopPlayback();
      updateTime(timeInput.valueAsNumber);
    });
    for (const button of vowelButtons) {
      button.addEventListener("click", () => selectVowel(button.dataset.vowel));
    }

    clock?.setAttribute("aria-live", "off");
    const initialVowel = vowelButtons.find((button) => button.getAttribute("aria-pressed") === "true");
    selectVowel(initialVowel?.dataset.vowel || "a");
    setPlaying(false);
    updateTime(time);
    resizeCanvas();

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(resizeCanvas);
      observer.observe(canvas);
    }
    window.addEventListener("resize", resizeCanvas, { passive: true });
  }

  initializeNavigation();
  initializeImagePreviews();
  initializeSignalDemo();
})();
