(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function openLogin() {
    const modal = $("v14Login");

    if (!modal) {
      console.error("Bell429: v14Login not found");
      return;
    }

    modal.classList.add("show");

    const user = $("v14LoginUser");
    const pass = $("v14LoginPass");
    const loginButton = $("v14LoginBtn");
    const logoutButton = $("v14LoginLogout");
    const closeButton = $("v14LoginClose");
    const message = $("v14LoginMsg");

    if (user) {
      user.disabled = false;
      user.focus();
    }

    if (pass) {
      pass.disabled = false;
    }

    if (loginButton) {
      loginButton.style.display = "inline-flex";
      loginButton.disabled = false;
    }

    if (logoutButton) {
      logoutButton.style.display = "none";
    }

    if (closeButton) {
      closeButton.style.display = "inline-flex";
    }

    if (message) {
      message.textContent = "";
    }
  }

  function closeLogin() {
    $("v14Login")?.classList.remove("show");
  }

  /*
   * Navigation
   * جميع أزرار data-page يتم توصيلها بـ showPage()
   */
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;

      if (!target) return;

      /*
       * أزرار التنقل الرئيسية
       */
      const navButton = target.closest(
        ".nav button[data-page]"
      );

      if (navButton) {
        event.preventDefault();

        const page = navButton.dataset.page;

        if (
          page &&
          typeof window.showPage === "function"
        ) {
          window.showPage(page);
        }

        return;
      }

      /*
       * دخول المشرفين
       */
      const loginButton = target.closest(
        "#secureLoginNav, #v14AdminNav, #secureAdminNav"
      );

      if (loginButton) {
        event.preventDefault();

        /*
         * إذا كان زر لوحة المصمم بعد تسجيل الدخول
         * افتح الصفحة مباشرة.
         */
        if (
          loginButton.id === "secureAdminNav" &&
          typeof window.showPage === "function"
        ) {
          window.showPage("admin");
          return;
        }

        openLogin();
        return;
      }

      /*
       * إغلاق نافذة الدخول
       */
      const closeButton = target.closest(
        "#v14LoginClose"
      );

      if (closeButton) {
        event.preventDefault();
        closeLogin();
        return;
      }

      /*
       * تسجيل الدخول
       */
      const submitLogin = target.closest(
        "#v14LoginBtn"
      );

      if (submitLogin) {
        event.preventDefault();

        if (
          typeof window.__bell429Login ===
          "function"
        ) {
          window.__bell429Login();
        }

        return;
      }

      /*
       * تسجيل الخروج
       */
      const logoutButton = target.closest(
        "#v14LoginLogout"
      );

      if (logoutButton) {
        event.preventDefault();

        if (
          typeof window.__bell429Logout ===
          "function"
        ) {
          window.__bell429Logout();
        }

        return;
      }

      /*
       * زر إنشاء الطلب
       *
       * مهم:
       * لا نفتح تسجيل الدخول هنا.
       *
       * إنشاء طلب جديد Public.
       * secure-app.js هو المسؤول عن saveOrder().
       */
      const saveButton = target.closest("#save");

      if (saveButton) {
        return;
      }
    },
    true
  );

  /*
   * نموذج تسجيل الدخول فقط
   */
  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;

      if (
        form &&
        (
          form.id === "v14LoginForm" ||
          form.closest("#v14Login")
        )
      ) {
        event.preventDefault();

        if (
          typeof window.__bell429Login ===
          "function"
        ) {
          window.__bell429Login();
        }
      }
    },
    true
  );

  /*
   * Enter داخل بيانات الدخول
   */
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") return;

      const target = event.target;

      if (!target) return;

      if (
        target.id === "v14LoginUser" ||
        target.id === "v14LoginPass"
      ) {
        event.preventDefault();

        const button = $("v14LoginBtn");

        if (
          button &&
          !button.disabled &&
          button.style.display !== "none"
        ) {
          button.click();
        }
      }
    },
    true
  );

  /*
   * نربط دوال secure-app.js بعد تحميله.
   *
   * secure-app.js يحتوي login() و logout().
   * نعرضهما للواجهة بدون تخزين أي بيانات اعتماد.
   */
  function connectSecureApp() {
    if (
      typeof window.login === "function"
    ) {
      window.__bell429Login =
        window.login;
    }

    if (
      typeof window.logout === "function"
    ) {
      window.__bell429Logout =
        window.logout;
    }
  }

  /*
   * secure-app.js يتم تحميله أيضًا بواسطة middleware
   * لذلك نحاول الربط بعد DOM ثم نعيد المحاولة عدة مرات.
   */
  connectSecureApp();

  let attempts = 0;

  const timer = setInterval(() => {
    connectSecureApp();

    attempts++;

    if (
      attempts >= 40 ||
      (
        typeof window.__bell429Login ===
          "function" &&
        typeof window.__bell429Logout ===
          "function"
      )
    ) {
      clearInterval(timer);
    }
  }, 250);

  /*
   * تأكد من أن نافذة الدخول مغلقة عند البداية.
   */
  function normalizeLogin() {
    const modal = $("v14Login");

    if (!modal) return;

    if (!modal.classList.contains("show")) {
      modal.classList.remove("show");
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      normalizeLogin,
      { once: true }
    );
  } else {
    normalizeLogin();
  }

  console.info(
    "Bell429 UI bindings loaded."
  );
})();