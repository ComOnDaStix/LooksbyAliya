/* =================================================================
   LOOKS BY ALIYA — app.js  (shared across pages)
   ================================================================= */
document.addEventListener("DOMContentLoaded", function () {

  /* ---------- Hero film (mobile) ----------
     A muted inline <video> autoplays and loops on its own on most phones. The
     one case autoplay can't win is iOS Low Power Mode, which blocks AUTOMATIC
     playback - but a play() called inside a user gesture is still allowed. So
     we also start it on the very first touch/tap/scroll, which happens within a
     second of landing. That is why the girl's phone (Low Power on) now plays it
     the moment she touches the screen. Minimal by design: no watchdog, no
     reload, no seeking - those caused freezes before. */
  const v = document.querySelector("video.hero__video");
  if (v) {
    /* defaultMuted too: some Android browsers drop the muted attribute on a
       bfcache restore, and an unmuted video is not allowed to autoplay. */
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    play();
    v.addEventListener("loadeddata", play, { once: true });
    v.addEventListener("canplay", play, { once: true });
    /* Loop backup: some webviews (Instagram/Facebook in-app browsers) drop
       the `loop` attribute and just stop at the end - restart by hand. When
       `loop` works this event never fires, so it costs nothing. */
    v.addEventListener("ended", () => { try { v.currentTime = 0; } catch (e) {} play(); });
    /* A user gesture unlocks playback where autoplay is blocked (iOS Low
       Power Mode, Android power-saving/webview configs). The listeners stay
       armed until the film is actually PLAYING - the old one-shot unbind was
       the freeze: iOS fires a gesture-less scroll on reload (scroll
       restoration) and on #fragment arrival, which spent the single attempt
       before the first real touch, so play() was rejected and never asked
       again inside a gesture. scroll is gone from the list (it never carries
       activation; a finger-scroll always fires touchstart first anyway).
       touchend + pointerup matter on Android, where touchstart and
       pointerdown(touch) do NOT grant activation - only the gesture's end
       does. Once playing, everything unbinds. */
    const KICK_EVS = ["touchstart", "touchend", "pointerdown", "pointerup", "click", "keydown"];
    const kick = () => play();
    const unbind = () => KICK_EVS.forEach((ev) => window.removeEventListener(ev, kick));
    KICK_EVS.forEach((ev) => window.addEventListener(ev, kick, { passive: true }));
    v.addEventListener("playing", unbind, { once: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) play(); });
    window.addEventListener("pageshow", play);
    /* Gentle watchdog. The old aggressive one (load()/reseek) mistook initial
       buffering for a freeze and reload-looped, so this one is play()-only:
       - paused but not ended (browser paused it under memory pressure, a
         system dialog, tab juggling): just ask it to play again. play() on an
         already-playing or still-buffering video is a no-op, and in Low Power
         Mode it rejects quietly until the first touch - all safe.
       - the one seek allowed: currentTime pinned AT THE VERY END for two
         ticks. That is the known iOS "wedged at the loop point" stall (tail
         not buffered yet). It cannot fire during initial buffering, where
         currentTime sits near 0. */
    let lastT = -1, endStuck = 0;
    setInterval(() => {
      if (document.hidden) return;
      if (v.ended) { try { v.currentTime = 0; } catch (e) {} play(); return; }
      if (v.paused) { play(); return; }
      if (v.currentTime === lastT && v.duration && v.currentTime > v.duration - 0.5) {
        if (++endStuck >= 2) { try { v.currentTime = 0; } catch (e) {} play(); endStuck = 0; }
      } else { endStuck = 0; }
      lastT = v.currentTime;
    }, 2000);
  }

  /* ---------- Intro splash (home page, once per session) ---------- */
  const splash = document.getElementById("splash");
  if (splash) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || sessionStorage.getItem("lba_splash")) {
      splash.remove();
    } else {
      sessionStorage.setItem("lba_splash", "1");
      document.body.classList.add("splash-lock");
      window.setTimeout(function () { document.body.classList.remove("splash-lock"); }, 2700);
    }
  }

  /* ---------- Sticky nav: solid background after scrolling ----------
     (sub-pages add .nav--solid in markup so it's solid from the top) */
  const nav = document.getElementById("nav");
  if (nav && !nav.classList.contains("nav--solid")) {
    const onScroll = () => nav.classList.toggle("nav--scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile menu toggle ---------- */
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (toggle && links) {
    const isOpen = () => links.classList.contains("is-open");
    const setMenu = (open) => {
      links.classList.toggle("is-open", open);
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    const closeMenu = () => setMenu(false);

    /* TOUCH: fire on touchstart - the earliest signal iOS gives, dispatched
       the instant a finger lands even while a momentum scroll is still
       gliding. click is no good here: iOS discards the click that ends a
       momentum scroll, and pointerdown can be withheld while Safari decides
       whether the touch is a scroll gesture. Both left the button dead until
       the page fully settled.
       preventDefault stops the synthetic mouse/click iOS would emit after,
       so the menu can't toggle a second time and snap shut. */
    let lastTouchAt = -Infinity;
    toggle.addEventListener("touchstart", (e) => {
      lastTouchAt = e.timeStamp;
      e.preventDefault();
      setMenu(!isOpen());
    }, { passive: false });

    /* MOUSE + KEYBOARD: touch never reaches here thanks to preventDefault,
       but guard anyway in case a browser emits the synthetic click regardless. */
    toggle.addEventListener("click", (e) => {
      /* detail === 0 means keyboard (Enter/Space) - always honour it, whatever
         the timing. Only a pointer-driven click (detail >= 1) arriving right
         after a touch is the synthetic twin worth dropping. */
      if (e.detail !== 0 && e.timeStamp - lastTouchAt < 700) return;
      setMenu(!isOpen());
    });

    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
  }

  /* ---------- Before / After slider ---------- */
  const range = document.getElementById("baRange");
  const before = document.getElementById("baBefore");
  const divider = document.getElementById("baDivider");
  if (range && before && divider) {
    const setSplit = (value) => {
      before.style.clipPath = "inset(0 " + (100 - value) + "% 0 0)";
      divider.style.left = value + "%";
    };
    range.addEventListener("input", (e) => setSplit(e.target.value));
    setSplit(range.value);
  }

  /* ---------- Reviews: open all in a pop-up ----------
     The modal scrolls inside itself, so closing it returns the visitor to
     the exact spot on the page instead of stranding them 145 cards down. */
  const revOpen = document.getElementById("reviewsOpen");
  const revModal = document.getElementById("reviewsModal");
  const revClose = document.getElementById("reviewsClose");
  if (revOpen && revModal) {
    const open = () => {
      revModal.classList.add("is-open");
      revModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      /* always start at the first review, not where a previous open left off */
      const body = revModal.querySelector(".reviews-modal__body");
      if (body) body.scrollTop = 0;
      if (revClose) revClose.focus();
    };
    const close = () => {
      revModal.classList.remove("is-open");
      revModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      revOpen.focus();
    };
    /* Fire on touchstart, not just click: iOS can swallow the click that
       ends a scroll (same fix as the burger menu), which left the button
       feeling dead on a phone. detail === 0 keeps keyboard activation working. */
    const onActivate = (el, handler) => {
      if (!el) return;
      let lastTouch = -Infinity;
      el.addEventListener("touchstart", (e) => { lastTouch = e.timeStamp; e.preventDefault(); handler(e); }, { passive: false });
      el.addEventListener("click", (e) => { if (e.detail !== 0 && e.timeStamp - lastTouch < 700) return; handler(e); });
    };
    onActivate(revOpen, open);
    onActivate(revClose, close);
    revModal.querySelectorAll("[data-close]").forEach((el) => onActivate(el, close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && revModal.classList.contains("is-open")) close();
    });
  }

  /* ---------- Email signup (front-end only; wire to Mailchimp later) ---------- */
  const form = document.getElementById("signupForm");
  if (form) {
    const note = document.getElementById("signupNote");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]');
      if (note) {
        note.textContent = "Thank you! You're on the list. ✨";
        note.classList.add("ok");
      }
      form.reset();
      if (email) email.blur();
    });
  }

  /* ---------- Contact form (front-end only; wire to Formspree/email later) ---------- */
  const cform = document.getElementById("contactForm");
  if (cform) {
    const cnote = document.getElementById("contactNote");
    cform.addEventListener("submit", (e) => {
      e.preventDefault();
      if (cnote) {
        cnote.textContent = "Thank you! Your message has been sent. ✨";
        cnote.classList.add("ok");
      }
      cform.reset();
    });
  }

  /* ---------- Scroll reveal ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
      /* threshold is a fraction of the ELEMENT's box, not the viewport. A
         percentage target is unreachable for anything taller than the screen
         - the 1-column portfolio grid is ~7000px on a phone, so it topped out
         at ~11% and never hit 0.12, leaving the whole grid at opacity 0.
         Trigger on first contact instead and use rootMargin for the delay. */
    }, { threshold: 0, rootMargin: "0px 0px -80px 0px" });
    reveals.forEach((el) => {
      /* Already on screen when the page opens? Show it outright, no fade.
         Animating it in left the page looking blank for a beat on arrival,
         which read as a flicker. Only below-fold content gets the reveal.
         This runs before first paint (app.js is a blocking script at the end
         of body), so nothing is ever painted in the hidden state. */
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add("reveal--now");
      } else {
        io.observe(el);
      }
    });
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }
  /* Tells the inline head watchdog the reveal is wired up, so it leaves the
     .js class alone. If we never get here, it un-hides everything at 2s. */
  document.documentElement.setAttribute("data-reveal-ready", "1");

});
