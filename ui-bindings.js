(() => {
  "use strict";

  /*
   * UI bindings
   * - Navigation
   * - Secure admin login modal
   * - No localStorage authentication
   * - No legacy credentials
   */

  const NAV_SELECTOR = ".nav button[data-page]";
  const LOGIN_MODAL_ID = "v14Login";

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

  function handleNavigationClick(event) {
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
   * إنشاء نافذة تسجيل دخول المشرفين.
   *
   * secure-app.js يعتمد على هذه العناصر:
   * v14Login
   * v14LoginUser
   * v14LoginPass
   * v14LoginBtn
   * v14LoginClose
   * v14LoginLogout
   * v14LoginMsg
   *
   * لذلك ننشئها هنا بدل إعادة JavaScript القديم.
   */
  function ensureLoginModal() {
    let modal = document.getElementById(LOGIN_MODAL_ID);

    if (modal) {
      return modal;
    }

    const styleId = "secure-login-modal-style";

    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");

      style.id = styleId;

      style.textContent = `
        #v14Login.v14-modal-backdrop{
          position:fixed;
          inset:0;
          background:rgba(2,12,20,.72);
          display:none;
          align-items:center;
          justify-content:center;
          z-index:9999;
          padding:18px;
        }

        #v14Login.v14-modal-backdrop.show{
          display:flex;
        }

        #v14Login .v14-modal{
          width:min(460px,100%);
          background:#fff;
          border-radius:18px;
          padding:22px;
          box-shadow:0 25px 80px rgba(0,0,0,.35);
          direction:rtl;
        }

        #v14Login .v14-modal h3{
          margin:0 0 14px;
        }

        #v14Login .v14-modal .hint{
          color:#68747d;
          font-size:13px;
          margin-bottom:14px;
        }

        #v14Login .field{
          margin:10px 0;
        }

        #v14Login .field label{
          display:block;
          font-size:13px;
          font-weight:800;
          margin-bottom:5px;
        }

        #v14Login input{
          width:100%;
          box-sizing:border-box;
          padding:11px;
          border:1px solid #cfd8df;
          border-radius:10px;
          font-size:14px;
          outline:none;
        }

        #v14Login input:focus{
          border-color:#12364d;
          box-shadow:0 0 0 3px rgba(18,54,77,.12);
        }

        #v14Login .v14-small{
          min-height:22px;
          margin-top:8px;
          color:#a91e2c;
          font-size:12px;
          font-weight:800;
        }

        #v14Login .v14-actions{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:14px;
        }

        #v14Login .v14-actions button{
          border:0;
          border-radius:10px;
          padding:10px 14px;
          font-weight:800;
          cursor:pointer;
        }

        #v14Login .v14-primary{
          background:#12364d;
          color:#fff;
        }

        #v14Login .v14-secondary{
          background:#edf2f5;
          color:#17384e;
        }

        #v14Login .v14-danger{
          background:#b42318;
          color:#fff;
        }

        #v14Login .v14-link{
          color:#075b73;
          font-weight:700;
          font-size:13px;
        }
      `;

      document.head.appendChild(style);
    }

    modal = document.createElement("div");

    modal.id = LOGIN_MODAL_ID;
    modal.className = "v14-modal-backdrop";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div
        class="v14-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="v14LoginTitle"
      >

        <h3 id="v14LoginTitle">
          دخول المشرفين
        </h3>

        <p class="hint">
          أدخل اسم المستخدم وكلمة المرور.
        </p>

        <div class="field">
          <label for="v14LoginUser">
            اسم المستخدم
          </label>

          <input
            id="v14LoginUser"
            type="text"
            autocomplete="username"
            inputmode="text"
          >
        </div>

        <div class="field">
          <label for="v14LoginPass">
            كلمة المرور
          </label>

          <input
            id="v14LoginPass"
            type="password"
            autocomplete="current-password"
          >
        </div>

        <div
          id="v14LoginMsg"
          class="v14-small"
          role="alert"
          aria-live="polite"
        ></div>

        <div class="v14-actions">

          <button
            id="v14LoginBtn"
            type="button"
            class="v14-primary"
          >
            دخول
          </button>

          <button
            id="v14LoginClose"
            type="button"
            class="v14-secondary"
          >
            إلغاء
          </button>

          <button
            id="v14LoginLogout"
            type="button"
            class="v14-danger"
            style="display:none"
          >
            🚪 تسجيل الخروج
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    };

    const open = () => {
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");

      document
        .getElementById("v14LoginMsg")
        ?.replaceChildren();

      const input =
        document.getElementById("v14LoginUser");

      input?.focus();
    };

    const login = async () => {
      const username =
        document
          .getElementById("v14LoginUser")
          ?.value
          .trim();

      const password =
        document
          .getElementById("v14LoginPass")
          ?.value || "";

      const msg =
        document.getElementById("v14LoginMsg");

      const button =
        document.getElementById("v14LoginBtn");

      if (!username || !password) {
        if (msg) {
          msg.textContent =
            "أدخل اسم المستخدم وكلمة المرور.";
        }

        return;
      }

      button.disabled = true;

      if (msg) {
        msg.textContent =
          "جاري تسجيل الدخول…";
      }

      try {
        const response =
          await fetch(
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
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            data?.error ||
            `HTTP ${response.status}`
          );
        }

        /*
         * نعيد تحميل الصفحة حتى يقوم
         * secure-app.js بقراءة الجلسة
         * وCSRF token من /api/auth/me.
         */
        window.location.reload();

      } catch (error) {

        if (msg) {
          msg.textContent =
            error?.message ||
            "تعذر تسجيل الدخول.";
        }

        button.disabled = false;
      }
    };

    const logout = async () => {
      try {
        const me =
          await fetch(
            "/api/auth/me",
            {
              credentials:
                "same-origin"
            }
          );

        const data =
          await me.json();

        if (
          data?.csrfToken
        ) {
          await fetch(
            "/api/auth/logout",
            {
              method: "POST",

              credentials:
                "same-origin",

              headers: {
                "X-CSRF-Token":
                  data.csrfToken
              }
            }
          );
        }

      } catch {}

      window.location.reload();
    };

    document
      .getElementById("v14LoginClose")
      ?.addEventListener(
        "click",
        close
      );

    document
      .getElementById("v14LoginBtn")
      ?.addEventListener(
        "click",
        login
      );

    document
      .getElementById("v14LoginLogout")
      ?.addEventListener(
        "click",
        logout
      );

    document
      .getElementById("v14LoginPass")
      ?.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter") {
            login();
          }
        }
      );

    modal.addEventListener(
      "click",
      (event) => {
        if (event.target === modal) {
          close();
        }
      }
    );

    /*
     * secure-app.js يستدعي openLogin()
     * داخليًا، لذلك نربط زر دخول
     * المشرفين بطريقة مباشرة أيضًا.
     *
     * لا نستخدم onclick inline.
     */
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "#secureLoginNav"
          );

        if (!button) return;

        /*
         * secure-app.js يملك onclick
         * خاصًا به. إذا استدعاه، سيصل
         * إلى نفس النافذة الآن لأنها
         * أصبحت موجودة.
         *
         * لا نمنع الحدث حتى لا نكسر
         * handler الأصلي.
         */
        if (
          typeof window.openLogin ===
          "function"
        ) {
          return;
        }

        open();
      },
      false
    );

    return modal;
  }

  function initialize() {
    markNavigationButtons();
    ensureLoginModal();
  }

  document.addEventListener(
    "click",
    handleNavigationClick,
    false
  );

  document.addEventListener(
    "keydown",
    handleNavigationKeydown,
    false
  );

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

  const observer =
    new MutationObserver(() => {
      markNavigationButtons();
    });

  if (document.documentElement) {
    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

  let attempts = 0;
  const maxAttempts = 50;

  const waitForShowPage =
    setInterval(() => {
      attempts++;

      if (
        typeof window.showPage ===
        "function"
      ) {
        markNavigationButtons();
        clearInterval(
          waitForShowPage
        );
        return;
      }

      if (
        attempts >= maxAttempts
      ) {
        clearInterval(
          waitForShowPage
        );
      }
    }, 100);

})();
