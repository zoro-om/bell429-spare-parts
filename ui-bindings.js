(() => {
  "use strict";

  function bindNavigation() {
    if (typeof window.showPage !== "function") return;

    document
      .querySelectorAll(".nav button[data-page]")
      .forEach((button) => {
        if (button.dataset.uiBound === "1") return;

        button.dataset.uiBound = "1";

        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const page = button.dataset.page;
          if (page) window.showPage(page);
        });
      });
  }

  bindNavigation();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindNavigation);
  }

  const observer = new MutationObserver(bindNavigation);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();