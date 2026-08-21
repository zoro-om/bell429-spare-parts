(() => {
  "use strict";

  /*
   * UI bindings — stable event delegation
   *
   * الهدف:
   * 1. جعل أزرار التنقل تعمل حتى لو أُنشئت ديناميكياً.
   * 2. عدم استخدام stopPropagation حتى لا نعطل handlers أخرى.
   * 3. عدم ربط الزر أكثر من مرة.
   * 4. انتظار تحميل showPage إذا لم تكن موجودة بعد.
   */

  const NAV_SELECTOR = ".nav button[data-page]";

  function callShowPage(page) {
    if (!page) return false;

    if (typeof window.showPage === "function") {
      window.showPage(page);
      return true;
    }

    return false;
  }

  function markNavigationButtons() {
    document.querySelectorAll(NAV_SELECTOR).forEach((button) => {
      if (!button.hasAttribute("type")) {
        button.setAttribute("type", "button");
      }
    });
  }

  /*
   * Event delegation:
   * نربط مستمعاً واحداً على document بدلاً من ربط
   * مستمع منفصل بكل زر.
   *
   * مهم جداً:
   * لا نستخدم stopPropagation().
   */
  function handleNavigationClick(event) {
    const button = event.target.closest(NAV_SELECTOR);

    if (!button) return;

    if (!document.documentElement.contains(button)) return;

    const page = button.dataset.page;

    if (!page) return;

    /*
     * بعض الأزرار قد تحتوي على onclick خاص بها.
     * إذا كان لها onclick، نتركه يعمل ولا ننفذ showPage مرة ثانية.
     */
    if (typeof button.onclick === "function") {
      return;
    }

    event.preventDefault();

    if (!callShowPage(page)) {
      /*
       * showPage قد لا تكون جاهزة لحظة الضغط.
       * نعيد المحاولة بعد انتهاء دورة JavaScript الحالية.
       */
      setTimeout(() => {
        callShowPage(page);
      }, 0);
    }
  }

  /*
   * Keyboard accessibility
   */
  function handleNavigationKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const button = event.target.closest(NAV_SELECTOR);

    if (!button) return;

    if (!document.documentElement.contains(button)) return;

    const page = button.dataset.page;

    if (!page) return;

    if (typeof button.onclick === "function") {
      return;
    }

    event.preventDefault();

    if (!callShowPage(page)) {
      setTimeout(() => {
        callShowPage(page);
      }, 0);
    }
  }

  /*
   * تجهيز الأزرار الموجودة حالياً.
   */
  function initialize() {
    markNavigationButtons();
  }

  /*
   * مستمع واحد فقط للنقرات.
   */
  document.addEventListener(
    "click",
    handleNavigationClick,
    false
  );

  /*
   * دعم لوحة المفاتيح.
   */
  document.addEventListener(
    "keydown",
    handleNavigationKeydown,
    false
  );

  /*
   * تشغيل أولي.
   */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

  /*
   * مراقبة العناصر التي تُضاف لاحقاً.
   */
  const observer = new MutationObserver(() => {
    markNavigationButtons();
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /*
   * فحص متكرر قصير للتأكد من أن showPage أصبح متاحاً
   * إذا تم تحميل هذا الملف قبل secure-app.js.
   */
  let attempts = 0;
  const maxAttempts = 50;

  const waitForShowPage = setInterval(() => {
    attempts++;

    if (typeof window.showPage === "function") {
      markNavigationButtons();
      clearInterval(waitForShowPage);
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(waitForShowPage);
    }
  }, 100);
})();
