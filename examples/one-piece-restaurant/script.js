/* Shared interactivity: mobile nav toggle. No-op if button absent. */
(function () {
  function init() {
    var toggle = document.querySelector("[data-nav-toggle]");
    if (!toggle) return;

    toggle.addEventListener("click", function () {
      var header = toggle.closest(".site-header");
      if (!header) return;
      var open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
