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

    if (message) {
      message.textContent = "";
    }

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
  }

  function closeLogin() {
    $("v14Login")?.classList.remove("show");
  }

  async function performLogin() {
    const userEl = $("v14LoginUser");
    const passEl = $("v14LoginPass");
    const button = $("v14LoginBtn");
    const message = $("v14LoginMsg");

    const username = userEl?.value?.trim() || "";
    const password = passEl?.value || "";

    if (!username || !password) {
      if (message) {
        message.textContent =
          "أدخل اسم المستخدم وكلمة المرور.";
      }

      return;
    }

    if (button) {
      button.disabled = true;
    }

    if (message) {
      message.textContent =
        "جاري تسجيل الدخول...";
    }

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            username,
            password
          })
        }
      );

      const text =
        await response.text();

      let data = null;

      try {
        data = text
          ? JSON.parse(text)
          : null;
      } catch {}

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "فشل تسجيل الدخول"
        );
      }

      closeLogin();

      /*
       * بعد نجاح الدخول يتم تحديث الصفحة.
       * secure-app.js سيقرأ الجلسة من
       * /api/auth/me ويعيد مزامنة الواجهة.
       */
      window.location.reload();

    } catch (error) {

      if (message) {
        message.textContent =
          error?.message ||
          "فشل تسجيل الدخول";
      }

      if (button) {
        button.disabled = false;
      }
    }
  }

  async function performLogout() {
    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "same-origin"
        }
      );
    } catch {}

    window.location.reload();
  }

  document.addEventListener(
    "click",
    (event) => {

      const target = event.target;

      if (!target) {
        return;
      }

      /*
       * Navigation
       */
      const navButton =
        target.closest(
          ".nav button[data-page]"
        );

      if (navButton) {

        const page =
          navButton.dataset.page;

        if (
          page &&
          typeof window.showPage ===
            "function"
        ) {
          event.preventDefault();

          window.showPage(page);
        }

        return;
      }

      /*
       * دخول المشرفين
       */
      const loginNav =
        target.closest(
          "#secureLoginNav, #v14AdminNav"
        );

      if (loginNav) {

        event.preventDefault();

        openLogin();

        return;
      }

      /*
       * لوحة المصمم بعد الدخول
       */
      const adminNav =
        target.closest(
          "#secureAdminNav"
        );

      if (adminNav) {

        event.preventDefault();

        if (
          typeof window.showPage ===
          "function"
        ) {
          window.showPage("admin");
        }

        return;
      }

      /*
       * إغلاق نافذة الدخول
       */
      const closeButton =
        target.closest(
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
      const loginButton =
        target.closest(
          "#v14LoginBtn"
        );

      if (loginButton) {

        event.preventDefault();

        performLogin();

        return;
      }

      /*
       * تسجيل الخروج
       */
      const logoutButton =
        target.closest(
          "#v14LoginLogout"
        );

      if (logoutButton) {

        event.preventDefault();

        performLogout();

        return;
      }

      /*
       * إنشاء الطلب:
       * لا يتم طلب تسجيل دخول هنا.
       * secure-app.js يعالج POST العام.
       */
      const saveButton =
        target.closest("#save");

      if (saveButton) {
        return;
      }
    },
    true
  );

  /*
   * نموذج تسجيل الدخول
   */
  document.addEventListener(
    "submit",
    (event) => {

      const form = event.target;

      if (
        form &&
        (
          form.id ===
            "v14LoginForm" ||
          form.closest("#v14Login")
        )
      ) {

        event.preventDefault();

        performLogin();
      }
    },
    true
  );

  /*
   * Enter داخل حقول الدخول
   */
  document.addEventListener(
    "keydown",
    (event) => {

      if (event.key !== "Enter") {
        return;
      }

      const target = event.target;

      if (!target) {
        return;
      }

      if (
        target.id ===
          "v14LoginUser" ||
        target.id ===
          "v14LoginPass"
      ) {

        event.preventDefault();

        performLogin();
      }
    },
    true
  );

  function normalizeLogin() {

    const modal =
      $("v14Login");

    if (!modal) {
      return;
    }

    if (
      !modal.classList.contains(
        "show"
      )
    ) {
      modal.classList.remove(
        "show"
      );
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