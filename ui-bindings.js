(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /*
   * ============================================================
   * Bell429 Secure UI Bindings
   * ============================================================
   * - Creates the login modal if index.html does not contain it.
   * - Handles supervisor login/logout.
   * - Handles navigation.
   * - Handles password visibility toggle.
   * - Does NOT require supervisor login to create a new order.
   * ============================================================
   */

  function ensureLoginModal() {
    if ($("v14Login")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "bell429-secure-login-style";

    style.textContent = `
      #v14Login {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(3, 15, 25, .72);
        backdrop-filter: blur(5px);
      }

      #v14Login.show {
        display: flex;
      }

      #v14Login .bell429-login-modal {
        width: min(100%, 430px);
        background: #fff;
        color: #142a3a;
        border-radius: 16px;
        border: 1px solid #dbe4ea;
        box-shadow: 0 25px 80px rgba(0,0,0,.35);
        padding: 20px;
        direction: rtl;
      }

      #v14Login h3 {
        margin: 0 0 7px;
        font-size: 20px;
      }

      #v14Login .bell429-login-hint {
        margin: 0 0 16px;
        color: #6c7d89;
        font-size: 11px;
        line-height: 1.6;
      }

      #v14Login .bell429-login-field {
        margin-bottom: 12px;
      }

      #v14Login label {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        font-weight: 900;
      }

      #v14Login input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cfdbe3;
        border-radius: 9px;
        padding: 11px 12px;
        background: #fff;
        color: #142a3a;
        outline: none;
        font-size: 14px;
      }

      #v14Login input:focus {
        border-color: #0e5b8d;
        box-shadow: 0 0 0 3px rgba(14,91,141,.12);
      }

      #v14LoginMsg {
        min-height: 20px;
        margin: 8px 0;
        color: #a51d2c;
        font-size: 11px;
        font-weight: 800;
      }

      #v14Login .bell429-login-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      #v14Login button {
        border: 0;
        border-radius: 9px;
        padding: 10px 14px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      #v14LoginBtn {
        background: #e51f43;
        color: #fff;
      }

      #v14LoginClose {
        background: #edf3f7;
        color: #071b2b;
      }

      #v14LoginLogout {
        background: #fff0f2;
        color: #9a1831;
        border: 1px solid #efc3cc !important;
      }

      #v14Login button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      @media(max-width:600px) {
        #v14Login {
          padding: 12px;
        }

        #v14Login .bell429-login-modal {
          padding: 17px;
        }
      }
    `;

    document.head.appendChild(style);

    const modal = document.createElement("div");

    modal.id = "v14Login";

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute(
      "aria-labelledby",
      "bell429LoginTitle"
    );

    modal.innerHTML = `
      <div class="bell429-login-modal">

        <h3 id="bell429LoginTitle">
          🔐 دخول المشرفين
        </h3>

        <p class="bell429-login-hint">
          أدخل اسم المستخدم وكلمة المرور الخاصة بالحساب الإداري.
        </p>

        <div class="bell429-login-field">
          <label for="v14LoginUser">
            اسم المستخدم
          </label>

          <input
            id="v14LoginUser"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
          >
        </div>

        <div class="bell429-login-field">
          <label for="v14LoginPass">
            كلمة المرور
          </label>

          <div
            style="
              position:relative;
              display:flex;
              align-items:center;
            "
          >
            <input
              id="v14LoginPass"
              type="password"
              autocomplete="current-password"
              style="
                padding-left:44px;
              "
            >

            <button
              type="button"
              id="v14TogglePassword"
              aria-label="إظهار كلمة المرور"
              title="إظهار كلمة المرور"
              style="
                position:absolute;
                left:7px;
                top:50%;
                transform:translateY(-50%);
                width:32px;
                height:32px;
                padding:0;
                margin:0;
                border:0;
                border-radius:7px;
                background:#edf3f7;
                color:#0e5b8d;
                font-size:16px;
                line-height:1;
                cursor:pointer;
              "
            >👁️</button>
          </div>
        </div>

        <div id="v14LoginMsg"></div>

        <div class="bell429-login-actions">

          <button
            type="button"
            id="v14LoginBtn"
          >
            دخول
          </button>

          <button
            type="button"
            id="v14LoginClose"
          >
            إلغاء
          </button>

          <button
            type="button"
            id="v14LoginLogout"
            style="display:none"
          >
            🚪 تسجيل الخروج
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    /*
     * ============================================================
     * إظهار / إخفاء كلمة المرور
     * ============================================================
     */

    const togglePasswordButton =
      $("v14TogglePassword");

    const passwordInput =
      $("v14LoginPass");

    if (
      togglePasswordButton &&
      passwordInput
    ) {
      togglePasswordButton.addEventListener(
        "click",
        () => {

          const isHidden =
            passwordInput.type === "password";

          passwordInput.type =
            isHidden ? "text" : "password";

          togglePasswordButton.textContent =
            isHidden ? "🙈" : "👁️";

          togglePasswordButton.setAttribute(
            "aria-label",
            isHidden
              ? "إخفاء كلمة المرور"
              : "إظهار كلمة المرور"
          );

          togglePasswordButton.setAttribute(
            "title",
            isHidden
              ? "إخفاء كلمة المرور"
              : "إظهار كلمة المرور"
          );
        }
      );
    }

    /*
     * إغلاق النافذة عند الضغط خارجها
     */
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeLogin();
      }
    });
  }

  function openLogin() {
    ensureLoginModal();

    const modal = $("v14Login");

    if (!modal) {
      console.error(
        "Bell429: login modal could not be created"
      );

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
      pass.value = "";
      pass.type = "password";
    }

    /*
     * إعادة زر العين إلى حالته الأصلية
     */
    const togglePasswordButton =
      $("v14TogglePassword");

    if (togglePasswordButton) {
      togglePasswordButton.textContent = "👁️";

      togglePasswordButton.setAttribute(
        "aria-label",
        "إظهار كلمة المرور"
      );

      togglePasswordButton.setAttribute(
        "title",
        "إظهار كلمة المرور"
      );
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
    ensureLoginModal();

    const userEl = $("v14LoginUser");
    const passEl = $("v14LoginPass");
    const button = $("v14LoginBtn");
    const message = $("v14LoginMsg");

    const username =
      userEl?.value?.trim() || "";

    const password =
      passEl?.value || "";

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
       * إعادة تحميل الصفحة مهمة هنا:
       * secure-app.js سيقرأ الجلسة الجديدة
       * من /api/auth/me.
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

  /*
   * Navigation + Login controls
   */
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
       * لوحة المصمم
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
       * إغلاق الدخول
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
       * مهم:
       *
       * لا نوقف زر إنشاء الطلب.
       *
       * secure-app.js هو المسؤول عن:
       * POST /api/orders
       *
       * وإنشاء الطلب الجديد لا يحتاج
       * إلى جلسة مشرف.
       */
      if (
        target.closest("#save")
      ) {
        return;
      }
    },
    true
  );

  /*
   * Submit login form
   */
  document.addEventListener(
    "submit",
    (event) => {

      const form =
        event.target;

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
   * Enter / Escape داخل نافذة الدخول
   */
  document.addEventListener(
    "keydown",
    (event) => {

      const target =
        event.target;

      if (!target) {
        return;
      }

      /*
       * Enter
       */
      if (
        event.key === "Enter" &&
        (
          target.id ===
            "v14LoginUser" ||
          target.id ===
            "v14LoginPass"
        )
      ) {

        event.preventDefault();

        performLogin();

        return;
      }

     