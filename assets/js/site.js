/* TDK Designs: small, dependency-free script.
   1. Mobile menu   2. Gallery filter   3. Photo lightbox   4. Contact form */

(function () {
  "use strict";

  /* ---------- 1. Mobile menu ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      if (open) { nav.setAttribute("data-open", ""); } else { nav.removeAttribute("data-open"); }
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.hasAttribute("data-open")) { setOpen(false); toggle.focus(); }
    });
  }

  /* ---------- 2. Gallery filter (Our work page) ---------- */
  var filters = document.querySelectorAll(".filter");
  if (filters.length) {
    var items = document.querySelectorAll(".gallery__item");
    var apply = function (cat) {
      filters.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.filter === cat));
      });
      items.forEach(function (it) {
        it.hidden = !(cat === "all" || it.dataset.cat === cat);
      });
    };
    filters.forEach(function (b) {
      b.addEventListener("click", function () {
        apply(b.dataset.filter);
        if (history.replaceState) {
          history.replaceState(null, "", b.dataset.filter === "all" ? location.pathname : "#" + b.dataset.filter);
        }
      });
    });
    var fromHash = function () {
      var cat = location.hash.replace("#", "");
      if (cat && document.querySelector('.filter[data-filter="' + cat + '"]')) { apply(cat); }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
  }

  /* ---------- 3. Lightbox ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll("a[data-lightbox]"));
  if (links.length && typeof HTMLDialogElement === "function") {
    var dlg = document.createElement("dialog");
    dlg.className = "lightbox on-dark";
    dlg.setAttribute("aria-label", "Photo viewer");
    dlg.innerHTML =
      '<div class="lightbox__in">' +
        '<div class="lightbox__bar"><span class="lightbox__count" aria-live="polite"></span>' +
        '<button type="button" data-close>Close</button></div>' +
        '<div class="lightbox__stage"><img alt=""></div>' +
        '<div class="lightbox__foot"><p class="lightbox__caption"><strong></strong><span></span></p>' +
        '<div class="lightbox__nav">' +
          '<button type="button" data-prev aria-label="Previous photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
          '<button type="button" data-next aria-label="Next photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
        '</div></div>' +
      '</div>';
    document.body.appendChild(dlg);

    var img = dlg.querySelector("img");
    var title = dlg.querySelector(".lightbox__caption strong");
    var kind = dlg.querySelector(".lightbox__caption span");
    var count = dlg.querySelector(".lightbox__count");
    var set = [];
    var at = 0;

    var show = function (i) {
      at = (i + set.length) % set.length;
      var a = set[at];
      img.src = a.getAttribute("href");
      img.alt = (a.querySelector("img") || {}).alt || "";
      title.textContent = a.dataset.title || "";
      kind.textContent = a.dataset.kind || "";
      count.textContent = (at + 1) + " of " + set.length;
    };

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        // Only step through photos that are currently visible (respects the filter).
        set = links.filter(function (l) {
          var item = l.closest(".gallery__item");
          return !item || !item.hidden;
        });
        show(set.indexOf(a));
        dlg.showModal();
      });
    });

    dlg.querySelector("[data-close]").addEventListener("click", function () { dlg.close(); });
    dlg.querySelector("[data-prev]").addEventListener("click", function () { show(at - 1); });
    dlg.querySelector("[data-next]").addEventListener("click", function () { show(at + 1); });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.classList.contains("lightbox__stage")) { dlg.close(); }
    });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { show(at - 1); }
      if (e.key === "ArrowRight") { show(at + 1); }
    });
    dlg.addEventListener("close", function () { img.removeAttribute("src"); });
  }

  /* ---------- 4. Contact form ---------- */
  var form = document.getElementById("quote-form");
  if (form) {
    var status = form.querySelector(".form__status");
    var button = form.querySelector('button[type="submit"]');
    var say = function (state, text) {
      status.dataset.state = state;
      status.textContent = text;
    };

    // After a non-JavaScript submit, contact.php sends people back here with ?sent=1 or ?sent=0.
    var sent = new URLSearchParams(location.search).get("sent");
    if (sent === "1") { say("ok", "Quote request sent. We will get back to you as soon as we can."); }
    if (sent === "0") { say("error", "Your message was not sent. Please call or WhatsApp us on 071 373 6835."); }

    form.addEventListener("submit", function (e) {
      if (!window.fetch) { return; }
      e.preventDefault();
      if (!form.reportValidity()) { return; }
      var picked = form.querySelector('input[type="file"]');
      if (picked && picked.files && picked.files[0] && picked.files[0].size > 5 * 1024 * 1024) {
        say("error", "That file is larger than 5 MB. Please choose a smaller one, or send it on WhatsApp: 071 373 6835.");
        return;
      }
      button.disabled = true;
      say("", "Sending your quote request\u2026");
      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { "X-Requested-With": "fetch" }
      })
        .then(function (r) {
          return r.text().then(function (t) { return { ok: r.ok, text: t }; });
        })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            say("ok", "Quote request sent. We will get back to you as soon as we can.");
          } else {
            say("error", res.text && res.text.length < 240 && res.text.indexOf("<") === -1
              ? res.text
              : "Your message was not sent. Please call or WhatsApp us on 071 373 6835.");
          }
        })
        .catch(function () {
          say("error", "Your message was not sent. Check your connection, or call or WhatsApp us on 071 373 6835.");
        })
        .then(function () { button.disabled = false; });
    });
  }

  /* ---------- 5. Motion: reveal on scroll, counters, progress line ---------- */
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canWatch = "IntersectionObserver" in window;

  if (canWatch) {
    var rise = ".section__head, .tile, .why__intro, .why__list li, .mosaic__item, .gallery__item, " +
      ".valuegrid li, .steps li, .clientgrid li, .statement, .offer__panel, .stats > div, " +
      ".split > div, .split > h2, .split > ul, .details > div, .form, .cta__in > *, .filters, .review, " +
      ".site-footer .colourbar";
    var wipe = ".split > img, .videoframe";

    var mark = function (el, kind) {
      el.setAttribute("data-reveal", kind);
      // Stagger siblings that arrive together, restarting every six so nothing waits long.
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) {
        return c.hasAttribute("data-reveal");
      });
      el.style.setProperty("--i", String((sibs.length - 1) % 6));
    };
    document.querySelectorAll(rise).forEach(function (el) { mark(el, "rise"); });
    document.querySelectorAll(wipe).forEach(function (el) { mark(el, "print"); });

    var watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        en.target.classList.add("is-in");
        watcher.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    document.querySelectorAll("[data-reveal]").forEach(function (el) { watcher.observe(el); });

    // Counters: 7+, 500+, 700+ count up the first time they are seen.
    var counters = document.querySelectorAll(".stats dt");
    if (counters.length && !calm) {
      var count = function (el) {
        var m = /^(\d+)(.*)$/.exec(el.textContent.trim());
        if (!m) { return; }
        var end = parseInt(m[1], 10), tail = m[2], t0 = null;
        var tick = function (t) {
          if (t0 === null) { t0 = t; }
          var k = Math.min(1, (t - t0) / 1400);
          var eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(end * eased) + tail;
          if (k < 1) { requestAnimationFrame(tick); }
        };
        el.textContent = "0" + tail;
        requestAnimationFrame(tick);
      };
      var cw = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { count(en.target); cw.unobserve(en.target); }
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { cw.observe(el); });
    }
  }

  // Orange line under the header shows how far down the page you are.
  var bar = document.querySelector(".progress");
  if (bar) {
    var queued = false;
    var paint = function () {
      queued = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
    };
    window.addEventListener("scroll", function () {
      if (!queued) { queued = true; requestAnimationFrame(paint); }
    }, { passive: true });
    paint();
  }

  /* ---------- Footer year ---------- */
  var y = document.querySelector("[data-year]");
  if (y) { y.textContent = String(new Date().getFullYear()); }
})();
