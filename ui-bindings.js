(() => {
  "use strict";

  function createLoginModal() {
    if (document.getElementById("v14Login")) {
      return;
    }

    const style = document.createElement("style");

    style.textContent = `
      .v14-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(2,12,20,.78);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        padding: 18px;
      }

      .v14-modal-backdrop.show {
        display: flex;
      }

      .v14-modal {
        width: min(460px, 100%);
        background: #fff;
        color: #142a3a;
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 25px 80px rgba(0,0,0,.35);
        direction: rtl;
      }

      .v14-modal h3 {
        margin: 0 0 14px;
        font-size: 20px;
      }

      .v14-modal .hint {
        color: #6c7d89;
        font-size: 11px;
        margin-bottom: 14px;
      }

      .v14-modal .field {
        margin: 10px 0;
      }

      .v14-modal .field label {
        display: block;
        font-size: 11px;
        font-weight: 900;
        margin-bottom: 5px;
      }

      .v14-modal input {
        width: 100%;
        box-sizing: border-box;
        padding: 11px;
        border: 1px solid #cfd8df;
        border-radius: 10px;
        font-size: 14px;
        background: #fff;
        color: #142a3a;
      }

      .v14-modal input:focus {
        outline: none;
        border-color: #0e5b8d;
        box-shadow: 0 0 0 3px rgba(14,91,141,.12);
      }

      .v14-login-msg {
        min-height: 20px;
        margin-top: 8px;
        color: #b51d2c;
        font-size: 11px;
        font-weight: 800;
      }

      .v14-login-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .v14-login-actions button {
        border: 0;
        border-radius: 9px;
        padding: 11px 15px;
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
        border: 1px solid #dbe4ea;
      }

      #v14LoginBtn:disabled {
        opacity: .6;
      }

      @media(max-width:600px) {
        .v14-modal {
          padding: 18px;
          border-radius: 15px;
        }
      }
    `;

    document.head.appendChild(style);

    const modal = document.createElement("div");

    modal.id = "v14Login";
    modal.className = "v14-modal-backdrop";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="v14-modal" role="dialog" aria-modal="true">
        <h3>دخول المشرفين</h3>

        <p class="hint">
          أدخل اسم المستخدم وكلمة المرور.
        </p>

        <div class="field">
          <label>اسم المستخدم</label>
          <input
            id="v14LoginUser"
            type="text"
            autocomplete="username"
          >
        </div>

        <div class="field">
          <label>كلمة المرور</label>
          <input
            id="v14LoginPass"
            type="password"
            autocomplete="current-password"
          >
        </div>

        <div
          id="v14LoginMsg"
          class="v14-login-msg"
        ></div>

        <div class="v14-login-actions">
          <button
            id="v14LoginBtn"
            type="button"
          >
            دخول
          </button>

          <button
            id="v14LoginClose"
            type="button"
          >
            إلغاء
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

      const userInput =
        document.getElementById("v14LoginUser");

      const passInput =
        document.getElementById("v14LoginPass");

      const msg =
        document.getElementById("v14LoginMsg");

      if (msg) {
        msg.textContent = "";
      }

      if (userInput) {
        userInput.focus();
      }

      if (passInput) {
        passInput.value = "";
      }
    };

    async function login() {
      const userInput =
        document.getElementById("v14LoginUser");

      const passInput =
        document.getElementById("v14LoginPass");

      const msg =
        document.getElementById("v14LoginMsg");

      const button =
        document.getElementById("v14LoginBtn");

      const username =
        userInput?.value.trim() || "";

      const password =
        passInput?.value || "";

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
          "جارٍ تسجيل الدخول...";
      }

      try {
        const response =
          await fetch(
            "/api/auth/login",
            {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "content-type":
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
          data =
            text
              ? JSON.parse(text)
              : null;
        } catch {}

        if (!response.ok) {
          throw new Error(
            data?.error ||
            `HTTP ${response.status}`
          );
        }

        close();

        /*
         * إعادة تحميل الصفحة بعد نجاح الدخول
         * حتى يقرأ secure-app.js الجلسة الجديدة
         * عن طريق /api/auth/me.
         */
        window.location.reload();

      } catch (error) {
        if (msg) {
          msg.textContent =
            error?.message ||
            "فشل تسجيل الدخول.";
        }

        button.disabled = false;
      }
    }

    document
      .getElementById("v14LoginBtn")
      ?.addEventListener(
        "click",
        login
      );

    document
      .getElementById("v14LoginClose")
      ?.addEventListener(
        "click",
        close
      );

    modal.addEventListener(
      "click",
      (event) => {
        if (
          event.target === modal
        ) {
          close();
        }
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          modal.classList.contains("show")
        ) {
          close();
        }
      }
    );

    /*
     * زر دخول المشرفين الذي ينشئه secure-app.js
     * أو أي زر يحمل نفس المعنى.
     */
    function bindLoginButton() {
      const button =
        document.getElementById(
          "secureLoginNav"
        );

      if (
        button &&
        button.dataset.loginUiBound !== "1"
      ) {
        button.dataset.loginUiBound = "1";

        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            open();
          },
          true
        );
      }
    }

    bindLoginButton();

    const observer =
      new MutationObserver(
        bindLoginButton
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  function bindNavigation() {
    if (
      typeof window.showPage !==
      "function"
    ) {
      return;
    }

    document
      .querySelectorAll(
        ".nav button[data-page]"
      )
      .forEach((button) => {
        if (
          button.dataset.uiBound ===
          "1"
        ) {
          return;
        }

        button.dataset.uiBound = "1";

        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();

            const page =
              button.dataset.page;

            if (page) {
              window.showPage(page);
            }
          }
        );
      });
  }

  function boot() {
    createLoginModal();
    bindNavigation();

    if (
      document.readyState ===
      "loading"
    ) {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          createLoginModal();
          bindNavigation();
        },
        {
          once: true
        }
      );
    }

    const observer =
      new MutationObserver(() => {
        createLoginModal();
        bindNavigation();
      });

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );
  }

  boot();
})();