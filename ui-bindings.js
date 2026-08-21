(() => {
  "use strict";

  /*
   * Bell 429 — UI bindings
   * -----------------------------------------
   * هذا الملف مسؤول فقط عن ربط واجهة المستخدم
   * بالبنية الآمنة الجديدة.
   *
   * لا يحتوي:
   * - كلمات مرور
   * - بيانات اعتماد
   * - localStorage authentication
   * - صلاحيات مزيفة
   *
   * المصادقة الحقيقية تتم عبر:
   * /api/auth/login
   * /api/auth/me
   * /api/auth/logout
   */

  const $ = (id) => document.getElementById(id);

  function showLogin() {
    const modal = $("v14Login");

    if (!modal) {
      console.error("Bell429: v14Login modal not found");
      return;
    }

    modal.classList.add("show");

    const user = $("v14LoginUser");
    const pass = $("v14LoginPass");

    if (user) {
      user.disabled = false;
      user.focus();
    }

    if (pass) {
      pass.disabled = false;
    }

    const loginButton = $("v14LoginBtn");
    const logoutButton = $("v14LoginLogout");
    const closeButton = $("v14LoginClose");

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

    const message = $("v14LoginMsg");

    if (message) {
      message.textContent = "";
    }
  }

  function closeLogin() {
    $("v14Login")?.classList.remove("show");
  }

  /*
   * لا نستخدم onclick داخل HTML.
   * event delegation يجعل الزر يعمل حتى لو
   * تم إنشاء/إعادة رسم العنصر لاحقًا.
   */
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;

      if (!target) return;

      /*
       * دخول المشرفين
       */
      const loginNav = target.closest(
        "#secureLoginNav, #v14AdminNav"
      );

      if (loginNav) {
        event.preventDefault();
        event.stopPropagation();

        showLogin();
        return;
      }

      /*
       * إغلاق نافذة الدخول
       */
      const close = target.closest(
        "#v14LoginClose"
      );

      if (close) {
        event.preventDefault();
        event.stopPropagation();

        closeLogin();
        return;
      }
    },
    true
  );

  /*
   * منع إرسال نموذج الدخول بطريقة HTML التقليدية.
   * secure-app.js هو المسؤول عن POST الحقيقي.
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
      }
    },
    true
  );

  /*
   * زر إنشاء الطلب:
   *
   * مهم جدًا:
   * لا نتحقق من وجود المشرف هنا.
   *
   * secure-app.js يقوم بتحديد:
   * POST  = إنشاء طلب عام
   * PUT   = تعديل طلب يحتاج جلسة
   *
   * لذلك لا يجب أن تقوم الواجهة بإجبار
   * المستخدم على تسجيل الدخول عند إنشاء طلب جديد.
   */
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;

      if (!target) return;

      const saveButton = target.closest("#save");

      if (!saveButton) return;

      /*
       * إذا كان الزر هو زر إنشاء/حفظ الطلب،
       * نترك secure-app.js يعالج العملية.
       *
       * لا نفتح login هنا.
       */
      return;
    },
    true
  );

  /*
   * معالجة Enter داخل حقول تسجيل الدخول.
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
   * إذا كانت نافذة الدخول موجودة مسبقًا،
   * نتأكد أنها لا تظهر تلقائيًا.
   */
  function normalizeLoginModal() {
    const modal = $("v14Login");

    if (!modal) return;

    /*
     * لا نغير class إذا كانت مفتوحة عمدًا.
     */
    if (!modal.classList.contains("show")) {
      modal.classList.remove("show");
    }
  }

  /*
   * تشغيل بعد اكتمال DOM.
   */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      normalizeLoginModal,
      { once: true }
    );
  } else {
    normalizeLoginModal();
  }

  console.info(
    "Bell429 UI bindings loaded successfully."
  );
})();