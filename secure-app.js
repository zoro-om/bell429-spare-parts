(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const stages = [
    "خروج الطلب من القسم",
    "اعتماد الطلب في إمداد قاعدة صلالة الجوية",
    "وصول الطلب إلى مدينة السيب",
    "خروج الطلب من عمان",
    "وصول القطعة إلى السيب",
    "وصول القطعة إلى مخزن صلالة"
  ];

  let user = null;
  let csrf = "";
  let orders = [];
  let trash = [];
  let currentId = null;
  let editingId = null;
  let catalogTimer = null;

  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[m])
    );

  const toast = (msg) => {
    const el = $("toast");

    if (!el) return;

    el.textContent = msg;
    el.classList.remove("hidden");

    clearTimeout(window.__t);

    window.__t = setTimeout(
      () => el.classList.add("hidden"),
      2400
    );
  };

  async function api(url, opts = {}) {
    const headers = new Headers(
      opts.headers || {}
    );

    if (
      opts.body &&
      !headers.has("content-type")
    ) {
      headers.set(
        "content-type",
        "application/json"
      );
    }

    if (opts.csrf) {
      headers.set(
        "X-CSRF-Token",
        csrf
      );
    }

    const r = await fetch(url, {
      ...opts,
      headers,
      credentials: "same-origin"
    });

    const text = await r.text();

    let data = null;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch {}

    if (!r.ok) {
      throw new Error(
        data?.error || `HTTP ${r.status}`
      );
    }

    return data;
  }

  function isAuth() {
    return !!user;
  }

  function can(p) {
    return (
      user?.role === "designer" ||
      user?.permissions?.[p] === true
    );
  }

  function showPage(p) {
    const ids = {
      new: "newPage",
      track: "trackPage",
      orders: "ordersPage",
      urgent: "urgentPage",
      trash: "v14TrashPage",
      admin: "v14AdminPage"
    };

    Object.entries(ids).forEach(
      ([k, id]) => {
        $(id)?.classList.toggle(
          "hidden",
          k !== p
        );
      }
    );

    document
      .querySelectorAll(
        ".nav button[data-page]"
      )
      .forEach((b) =>
        b.classList.toggle(
          "active",
          b.dataset.page === p
        )
      );

    if (p === "orders")
      renderOrders();

    if (p === "urgent")
      renderUrgent();

    if (p === "track")
      renderTrack();

    if (p === "trash")
      renderTrash();

    if (p === "admin")
      renderAdmin();
  }

  window.showPage = showPage;

  function addNav() {
    const nav =
      document.querySelector(".nav");

    if (!nav) return;

    if ($("secureLoginNav"))
      return;

    const login =
      document.createElement("button");

    login.id = "secureLoginNav";
    login.textContent =
      "🔐 دخول المشرفين";

    login.onclick = () =>
      openLogin();

    nav.appendChild(login);

    const trashBtn =
      document.createElement("button");

    trashBtn.dataset.page = "trash";
    trashBtn.textContent =
      "🗑️ المحذوفة";

    trashBtn.onclick = () =>
      showPage("trash");

    nav.appendChild(trashBtn);

    const admin =
      document.createElement("button");

    admin.id = "secureAdminNav";
    admin.textContent =
      "🛡️ لوحة المصمم";

    admin.style.display = "none";

    admin.onclick = () =>
      showPage("admin");

    nav.appendChild(admin);
  }

  function updateNav() {
    $("secureLoginNav")
      ?.style.setProperty(
        "display",
        user
          ? "none"
          : "inline-flex"
      );

    const a =
      $("secureAdminNav");

    if (a) {
      a.style.display = user
        ? "inline-flex"
        : "none";
    }

    if ($("cloudStatus")) {
      $("cloudStatus").textContent =
        user
          ? "☁ متصل بالنظام الآمن"
          : "🔒 يلزم تسجيل الدخول لإدارة الطلبات";

      $("cloudStatus").className =
        user
          ? "cloud-status cloud-ok"
          : "cloud-status cloud-warn";
    }
  }

  function openLogin() {
    const m = $("v14Login");

    if (!m) return;

    m.classList.add("show");

    $("v14LoginMsg").textContent =
      user
        ? `أهلاً ${user.username}`
        : "";

    $("v14LoginUser").disabled =
      !!user;

    $("v14LoginPass").disabled =
      !!user;

    $("v14LoginBtn").style.display =
      user
        ? "none"
        : "inline-flex";

    $("v14LoginLogout").style.display =
      user
        ? "inline-flex"
        : "none";

    if (!user) {
      $("v14LoginUser").focus();
    }
  }

  function closeLogin() {
    $("v14Login")
      ?.classList.remove("show");
  }

  async function login() {
    try {
      const d = await api(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            username:
              $("v14LoginUser")
                .value
                .trim(),

            password:
              $("v14LoginPass")
                .value
          })
        }
      );

      user = d.user;
      csrf = d.csrfToken;

      closeLogin();
      updateNav();

      await loadData();

      toast(
        "تم تسجيل الدخول بأمان"
      );
    } catch (e) {
      $("v14LoginMsg").textContent =
        e.message;
    }
  }

  async function logout() {
    try {
      await api(
        "/api/auth/logout",
        {
          method: "POST",
          csrf: true
        }
      );
    } catch {}

    user = null;
    csrf = "";
    orders = [];
    trash = [];
    currentId = null;

    updateNav();
    showPage("new");

    toast("تم تسجيل الخروج");
  }

  function formData() {
    return {
      requester:
        $("requester")
          .value
          .trim(),

      orderNo:
        $("orderNo")
          .value
          .trim(),

      uin:
        $("uin")
          .value
          .trim(),

      vote:
        $("vote")
          .value
          .trim(),

      departmentPhone:
        $("departmentPhone")
          .value
          .trim(),

      classification:
        $("classification")
          .value,

      pn:
        $("pn")
          .value
          .trim(),

      partSN:
        $("partSN")
          .value
          .trim(),

      partName:
        $("partName")
          .value
          .trim(),

      requestDate:
        $("requestDate")
          .value,

      qty:
        $("qty")
          .value,

      type:
        $("type")
          .value,

      requestNotes:
        $("requestNotes")
          .value
          .trim(),

      urgent:
        $("urgent")
          .checked
    };
  }

  function fillForm(o) {
    [
      "requester",
      "orderNo",
      "uin",
      "vote",
      "departmentPhone",
      "pn",
      "partSN",
      "partName",
      "requestNotes"
    ].forEach(
      (k) => {
        $(k).value =
          o[k] ?? "";
      }
    );

    $("requestDate").value =
      o.requestDate || "";

    $("qty").value =
      o.qty || 1;

    $("type").value =
      o.type || "";

    $("classification").value =
      o.classification || "";

    $("urgent").checked =
      !!o.urgent;

    editingId = o.id;

    $("save").textContent =
      "حفظ تعديلات الطلب";

    showPage("new");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /*
   * إنشاء الطلب:
   *
   * إنشاء طلب جديد = لا يحتاج Login.
   *
   * تعديل طلب موجود = يحتاج Login.
   */
  async function saveOrder() {
    const d = formData();

    const required = [
      "requester",
      "orderNo",
      "uin",
      "vote",
      "departmentPhone",
      "classification",
      "pn",
      "partName",
      "requestDate",
      "type"
    ];

    if (
      required.some(
        (k) => !d[k]
      )
    ) {
      toast(
        "أكمل جميع الحقول المطلوبة (*)"
      );

      return;
    }

    const isEditing =
      !!editingId;

    /*
     * لا نطلب Login عند إنشاء طلب جديد.
     *
     * Login مطلوب فقط عند تعديل
     * طلب موجود.
     */
    if (
     
