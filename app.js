/* =================================================================
   LOOKS BY ALIYA — app.js  (shared across pages)
   ================================================================= */
document.addEventListener("DOMContentLoaded", function () {

  /* ---------- Hero film (mobile) ----------
     Autoplays via markup, but iOS pauses muted video on lots of occasions
     (app/tab switch, scrolling it off-screen, Low Power Mode, the odd stall
     at the loop point) and leaves it frozen on a frame. So instead of a
     one-shot play(), keep nudging it back whenever it should be running. If
     it truly can't play, the poster/background still shows the still. */
  const heroVideo = document.querySelector(".hero__video");
  if (heroVideo) {
    const wantsVideo =
      window.matchMedia("(max-width: 900px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (wantsVideo && heroVideo.dataset.src) {
      const v = heroVideo;
      /* poster is deferred too: as a plain attribute it is fetched while the
         page parses, before this runs, so desktop paid for it despite never
         showing the video. */
      if (v.dataset.poster) v.poster = v.dataset.poster;
      v.src = v.dataset.src;

      const inView = () => {
        const r = v.getBoundingClientRect();
        return r.bottom > 0 && r.top < (window.innerHeight || 0);
      };
      /* force=false: only act if it's actually paused (cheap, for events).
         force=true: recover a decode STALL too - the frame is frozen while
         the element still reports playing (paused===false), which the plain
         paused check would miss. Jog the decoder with a tiny re-seek, then
         play. hard=true is the last resort: reload the pipeline. */
      const kick = (force, hard) => {
        if (document.hidden || !inView()) return;
        try {
          if (hard) { v.load(); v.play().catch(() => {}); return; }
          if (v.ended) v.currentTime = 0;
          if (v.paused) { v.play().catch(() => {}); return; }
          if (force) { v.currentTime = Math.max(0, v.currentTime - 0.04); v.play().catch(() => {}); }
        } catch (e) {}
      };

      kick(false);
      // resume on the events that commonly pause/stall it on iOS
      v.addEventListener("pause", () => setTimeout(() => kick(false), 60));
      v.addEventListener("ended", () => kick(false)); // manual-loop backup
      ["stalled", "suspend", "waiting"].forEach((ev) =>
        v.addEventListener(ev, () => setTimeout(() => kick(true), 120)));
      document.addEventListener("visibilitychange", () => kick(false));
      document.addEventListener("touchstart", () => kick(false), { passive: true });
      window.addEventListener("pageshow", () => kick(false));
      window.addEventListener("focus", () => kick(false));
      // resume when it scrolls back into view
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && kick(false)),
          { threshold: 0.1 }).observe(v);
      }
      /* backstop watchdog: if currentTime stops advancing while on-screen
         (paused OR a silent stall), escalate - nudge at ~1.6s, hard reload
         at ~3.2s. Catches anything the events above miss. */
      let prev = 0, stuck = 0, reloaded = false;
      setInterval(() => {
        if (document.hidden || !inView()) { stuck = 0; return; }
        if (v.paused || Math.abs(v.currentTime - prev) < 0.01) {
          stuck++;
          if (stuck === 2) kick(true);
          else if (stuck >= 4 && !reloaded) { reloaded = true; kick(false, true); }
        } else { stuck = 0; reloaded = false; }
        prev = v.currentTime;
      }, 800);
    } else {
      heroVideo.remove();
    }
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
