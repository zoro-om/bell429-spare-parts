(() => {
  "use strict";

  const NAV_SELECTOR = ".nav button[data-page]";
  const LOGIN_MODAL_ID = "v14Login";

  function callShowPage(page) {
    if (!page) return false;

    if (typeof window.showPage !== "function") {
      return false;
    }

    window.showPage(page);
    return true;
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
    callShowPage(page);
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
    callShowPage(page);
  }

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
        #v14Login.v14-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2,12,20,.72);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 18px;
        }

        #v14Login.v14-modal-backdrop.show {
          display: flex;
        }

        #v14Login .v14-modal {
          width: min(460px,100%);
          background: #fff;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 25px 80px rgba(0,0,0,.35);
          direction: rtl;
        }

        #v14Login .v14-modal h3 {
          margin: 0 0 14px;
        }

        #v14Login .hint {
          color: #68747d;
          font-size: 13px;
          margin-bottom: 14px;
        }

        #v14Login .field {
          margin: 10px 0;
        }

        #v14Login .field label {
          display: block;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        #v14Login input {
          width: 100%;
          box-sizing: border-box;
          padding: 11px;
          border: 1px solid #cfd8df;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
        }

        #v14Login input:focus {
          border-color: #12364d;
          box-shadow: 0 0 0 3px rgba(18,54,77,.12);
        }

        #v14Login .v14-small {
          min-height: 22px;
          margin-top: 8px;
          color: #a91e2c;
          font-size: 12px;
          font-weight: 800;
        }

        #v14Login .v14-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        #v14Login .v14-actions button {
          border: 0;
          border-radius: 10px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        #v14Login .v14-primary {
          background: #12364d;
          color: #fff;
        }

        #v14Login .v14-secondary {
          background: #edf2f5;
          color: #17384e;
        }

        #v14Login .v14-danger {
          background: #b42318;
          color: #fff;
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

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
      }
    });

    /*
     * مهم جدًا:
     *
     * ui-bindings.js لا ينفذ Login ولا Logout.
     *
     * secure-app.js هو المسؤول الوحيد عن:
     * /api/auth/login
     * /api/auth/logout
     * CSRF
     * Session
     */

    return modal;
  }

  function initialize() {
    /*
     * ننشئ نافذة الدخول أولًا.
     * بعدها يقوم secure-app.js بربط أزرارها.
     */
    ensureLoginModal();

    markNavigationButtons();
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

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

  const observer = new MutationObserver(
    markNavigationButtons
  );

  if (document.documentElement) {
    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

})();
