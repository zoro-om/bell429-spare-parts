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
        })[m]
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
    const headers = new Headers(opts.headers || {});

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
      data = text ? JSON.parse(text) : null;
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

    login.id =
      "secureLoginNav";

    login.textContent =
      "🔐 دخول المشرفين";

    login.onclick =
      () => openLogin();

    nav.appendChild(login);

    const trashBtn =
      document.createElement("button");

    trashBtn.dataset.page =
      "trash";

    trashBtn.textContent =
      "🗑️ المحذوفة";

    trashBtn.onclick =
      () => showPage("trash");

    nav.appendChild(trashBtn);

    const admin =
      document.createElement("button");

    admin.id =
      "secureAdminNav";

    admin.textContent =
      "🛡️ لوحة المصمم";

    admin.style.display =
      "none";

    admin.onclick =
      () => showPage("admin");

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
      a.style.display =
        user
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
    const m =
      $("v14Login");

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

    if (!user)
      $("v14LoginUser").focus();
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

    toast(
      "تم تسجيل الخروج"
    );
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
   * إنشاء الطلب الجديد:
   * لا يحتاج Login.
   *
   * تعديل طلب موجود:
   * يحتاج Login.
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

    if (
      isEditing &&
      !user
    ) {
      openLogin();

      toast(
        "سجّل دخولك لتعديل الطلب"
      );

      return;
    }

    try {
      const opts = {
        method:
          isEditing
            ? "PUT"
            : "POST",

        body:
          JSON.stringify(d)
      };

      /*
       * CSRF مطلوب فقط
       * عند تعديل طلب موجود.
       *
       * إنشاء الطلب الجديد
       * أصبح عامًا.
       */
      if (isEditing) {
        opts.csrf = true;
      }

      const saved =
        await api(
          isEditing
            ? `/api/orders?id=${encodeURIComponent(
                editingId
              )}`
            : "/api/orders",
          opts
        );

      if (isEditing) {
        const i =
          orders.findIndex(
            (x) =>
              x.id === editingId
          );

        if (i >= 0)
          orders[i] = saved;
      } else {
        orders.unshift(saved);
      }

      currentId =
        saved.id;

      editingId = null;

      $("save").textContent =
        "حفظ الطلب وبدء التتبع";

      showPage("track");

      renderTrack();
      renderOrders();
      renderUrgent();

      toast(
        "تم حفظ الطلب بنجاح"
      );
    } catch (e) {
      toast(e.message);

      if (
        e.message.includes(
          "Authentication"
        )
      ) {
        openLogin();
      }
    }
  }

  function clearForm() {
    editingId = null;

    $("save").textContent =
      "حفظ الطلب وبدء التتبع";

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
      (k) =>
        $(k).value = ""
    );

    $("qty").value = 1;
    $("type").value = "";
    $("classification").value = "";
    $("urgent").checked = false;

    $("requestDate").value =
      new Date()
        .toISOString()
        .slice(0, 10);

    $("partPreview")
      ?.classList.add("hidden");
  }

  function renderOrders() {
    const box =
      $("orders");

    if (!box) return;

    if (!user) {
      box.innerHTML =
        '<div class="empty">سجّل الدخول لعرض الطلبات.</div>';

      return;
    }

    const sorted =
      [...orders].sort(
        (a, b) =>
          String(
            b.requestDate || ""
          ).localeCompare(
            String(
              a.requestDate || ""
            )
          ) ||
          String(
            b.createdAt || ""
          ).localeCompare(
            String(
              a.createdAt || ""
            )
          )
      );

    box.innerHTML =
      sorted.length
        ? `
          <div class="orders-toolbar">
            <span>
              ${sorted.length}
              طلب محفوظ
            </span>
          </div>
        ` +
          sorted
            .map((o) => {
              const done =
                o.stages?.filter(
                  (s) =>
                    s.done
                ).length || 0;

              const rej =
                o.stages?.some(
                  (s) =>
                    s.rejected
                );

              return `
                <div class="order ${
                  rej
                    ? "not-arrived"
                    : ""
                }">

                  <div class="order-top">

                    <span class="type-badge">
                      ${esc(o.type)}
                    </span>

                    <strong>
                      ${esc(o.orderNo)}
                      ·
                      ${esc(o.partName)}
                    </strong>

                    ${
                      o.urgent
                        ? '<span class="urgent-badge">⚠️ مستعجل</span>'
                        : ""
                    }

                  </div>

                  <div class="mini">
                    P/N:
                    ${esc(o.pn)}
                    · UIN:
                    ${esc(o.uin)}
                    · الكمية:
                    ${esc(o.qty)}
                    · ${done}/6 مراحل
                    ·
                    ${esc(o.requestDate)}
                  </div>

                  <div class="order-actions">

                    <button
                      class="secondary"
                      data-track="${esc(o.id)}"
                    >
                      فتح التتبع
                    </button>

                    <button
                      class="edit-order"
                      data-edit="${esc(o.id)}"
                    >
                      ✎ تعديل
                    </button>

                    ${
                      can("delete")
                        ? `
                          <button
                            class="danger"
                            data-del="${esc(o.id)}"
                          >
                            حذف
                          </button>
                        `
                        : ""
                    }

                  </div>

                </div>
              `;
            })
            .join("")
        : '<div class="empty">لا توجد طلبات محفوظة.</div>';

    box
      .querySelectorAll(
        "[data-track]"
      )
      .forEach(
        (b) =>
          (b.onclick = () => {
            currentId =
              b.dataset.track;

            showPage("track");
          })
      );

    box
      .querySelectorAll(
        "[data-edit]"
      )
      .forEach(
        (b) =>
          (b.onclick = () => {
            const o =
              orders.find(
                (x) =>
                  x.id ===
                  b.dataset.edit
              );

            if (o)
              fillForm(o);
          })
      );

    box
      .querySelectorAll(
        "[data-del]"
      )
      .forEach(
        (b) =>
          (b.onclick = () =>
            deleteOrder(
              b.dataset.del
            ))
      );
  }

  async function deleteOrder(id) {
    if (!can("delete"))
      return toast(
        "ليس لديك صلاحية الحذف"
      );

    if (
      !confirm(
        "نقل الطلب إلى سلة المحذوفات؟"
      )
    )
      return;

    try {
      await api(
        `/api/orders?id=${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE",
          csrf: true
        }
      );

      orders =
        orders.filter(
          (x) => x.id !== id
        );

      if (
        currentId === id
      )
        currentId = null;

      renderOrders();
      renderUrgent();

      toast(
        "تم نقل الطلب إلى السلة"
      );
    } catch (e) {
      toast(e.message);
    }
  }

  function renderUrgent() {
    const box =
      $("urgentOrders");

    if (!box) return;

    const arr =
      orders.filter(
        (o) => o.urgent
      );

    if ($("urgentCount"))
      $("urgentCount").textContent =
        `${arr.length} طلب`;

    if ($("urgentNavCount"))
      $("urgentNavCount").textContent =
        arr.length;

    box.innerHTML =
      arr.length
        ? arr
            .map(
              (o) => `
                <div class="order urgent-card">

                  <div class="order-top">

                    <span class="urgent-badge">
                      🚨 مستعجل
                    </span>

                    <strong>
                      ${esc(o.orderNo)}
                      ·
                      ${esc(o.partName)}
                    </strong>

                  </div>

                  <div class="mini">
                    P/N:
                    ${esc(o.pn)}
                    ·
                    ${esc(o.requestDate)}
                  </div>

                  <button
                    class="secondary"
                    data-track="${esc(o.id)}"
                  >
                    فتح التتبع
                  </button>

                </div>
              `
            )
            .join("")
        : '<div class="empty-urgent">لا توجد طلبات مستعجلة حاليًا.</div>';

    box
      .querySelectorAll(
        "[data-track]"
      )
      .forEach(
        (b) =>
          (b.onclick = () => {
            currentId =
              b.dataset.track;

            showPage("track");
          })
      );
  }

  function renderTrack() {
    const o =
      orders.find(
        (x) =>
          x.id === currentId
      );

    const box =
      $("trackContent");

    if (!box) return;

    if (!o) {
      $("trackLabel").textContent =
        "اختر طلبًا";

      box.innerHTML =
        '<div class="empty">اختر طلبًا من قائمة الطلبات.</div>';

      return;
    }

    $("trackLabel").textContent =
      o.orderNo;

    const d =
      o.stages?.filter(
        (s) => s.done
      ).length || 0;

    box.innerHTML = `
      <div class="track-toolbar">

        <button
          class="edit-order"
          id="editCurrent"
        >
          ✎ تعديل بيانات الطلب
        </button>

      </div>

      <div class="grid2">

        <div class="field">
          <label>أولوية الطلب</label>
          <input
            disabled
            value="${
              o.urgent
                ? "🚨 طلب مستعجل"
                : "عادي"
            }"
          >
        </div>

        <div class="field">
          <label>رافع الطلب</label>
          <input
            disabled
            value="${esc(
              o.requester
            )}"
          >
        </div>

        <div class="field">
          <label>القطعة</label>
          <input
            disabled
            value="${esc(
              o.partName
            )}"
          >
        </div>

        <div class="field">
          <label>P/N</label>
          <input
            disabled
            value="${esc(
              o.pn
            )}"
          >
        </div>

        <div class="field">
          <label>S/N القطعة</label>
          <input
            disabled
            value="${esc(
              o.partSN || "—"
            )}"
          >
        </div>

        <div class="field">
          <label>رقم الطلب</label>
          <input
            disabled
            value="${esc(
              o.orderNo
            )}"
          >
        </div>

        <div class="field">
          <label>النوع / الكمية</label>
          <input
            disabled
            value="${esc(
              o.type
            )} / ${esc(
              o.qty
            )}"
          >
        </div>

      </div>

      <div class="section">

        <h3>
          التقدم:
          ${d}/6
        </h3>

        <div class="track">
          ${
            (o.stages || [])
              .map(
                (s, i) =>
                  stageHTML(
                    o,
                    s,
                    i
                  )
              )
              .join("")
          }
        </div>

      </div>
    `;

    $("editCurrent").onclick =
      () => fillForm(o);

    box
      .querySelectorAll(
        "[data-stage]"
      )
      .forEach((el) => {
        const i =
          +el.dataset.stage;

        const s =
          o.stages[i];

        el.querySelector(
          ".person"
        ).onchange = (e) => {
          s.person =
            e.target.value;

          saveStage(o);
        };

        el.querySelector(
          ".date"
        ).onchange = (e) => {
          s.date =
            e.target.value;

          saveStage(o);
        };

        el.querySelector(
          ".notes"
        ).onchange = (e) => {
          s.notes =
            e.target.value;

          saveStage(o);
        };

        el.querySelector(
          ".rejectReason"
        ).onchange = (e) => {
          s.rejectionReason =
            e.target.value;

          saveStage(o);
        };

        el.querySelector(
          ".complete"
        ).onclick = () => {
          if (
            !s.person ||
            !s.date
          )
            return toast(
              "أدخل اسم الشخص والتاريخ أولاً"
            );

          s.done =
            !s.done;

          s.rejected =
            false;

          saveStage(o);
        };

        el.querySelector(
          ".rejectStage"
        ).onclick = () => {
          if (
            !s.person ||
            !s.date
          )
            return toast(
              "أدخل اسم الشخص والتاريخ أولاً"
            );

          const reason =
            (
              s.rejectionReason ||
              prompt(
                "سبب الرفض / الاسترجاع؟"
              ) ||
              ""
            ).trim();

          if (!reason)
            return toast(
              "سبب الرفض إلزامي"
            );

          s.rejectionReason =
            reason;

          s.rejected =
            !s.rejected;

          s.done =
            false;

          saveStage(o);
        };
      });
  }

  function stageHTML(
    o,
    s,
    i
  ) {
    return `
      <div
        class="stage ${
          s.done
            ? "done"
            : ""
        } ${
          s.rejected
            ? "rejected"
            : ""
        }"
        data-stage="${i}"
      >

        <div class="stage-head">

          <span class="dot"></span>

          <span class="stage-name">
            ${i + 1}.
            ${esc(
              stages[i]
            )}
          </span>

          <span class="stage-status">
            ${
              s.rejected
                ? "مرفوض / مسترجع"
                : s.done
                ? "مكتمل"
                : "لم يكتمل"
            }
          </span>

        </div>

        <div class="stage-fields">

          <input
            class="person"
            placeholder="اسم الشخص المنهي الإجراء"
            value="${esc(
              s.person
            )}"
          >

          <input
            class="date"
            type="date"
            value="${esc(
              s.date
            )}"
          >

          <textarea
            class="notes"
            placeholder="ملاحظات"
          >${esc(
            s.notes
          )}</textarea>

          <input
            class="rejectReason"
            placeholder="سبب الرفض / الاسترجاع"
            value="${esc(
              s.rejectionReason ||
                ""
            )}"
          >

        </div>

        <div class="stage-actions">

          <button class="complete">
            ${
              s.done
                ? "إلغاء اكتمال المرحلة"
                : "تسجيل المرحلة كمكتملة"
            }
          </button>

          <button class="rejectStage">
            ${
              s.rejected
                ? "إلغاء الرفض / الاسترجاع"
                : "✕ رفض / استرجاع"
            }
          </button>

        </div>

      </div>
    `;
  }

  async function saveStage(o) {
    try {
      const saved =
        await api(
          `/api/orders?id=${encodeURIComponent(
            o.id
          )}`,
          {
            method: "PUT",
            body:
              JSON.stringify(o),
            csrf: true
          }
        );

      const i =
        orders.findIndex(
          (x) =>
            x.id === o.id
        );

      if (i >= 0)
        orders[i] = saved;

      renderTrack();
      renderOrders();
      renderUrgent();
    } catch (e) {
      toast(e.message);
    }
  }

  async function catalogSearch(
    q,
    box
  ) {
    if (
      !q ||
      q.length < 2
    ) {
      box.classList.add(
        "hidden"
      );

      return;
    }

    try {
      const d =
        await api(
          `/api/catalog?q=${encodeURIComponent(
            q
          )}`
        );

      const rows =
        d.parts || [];

      if (!rows.length) {
        box.classList.add(
          "hidden"
        );

        return;
      }

      box.innerHTML =
        rows
          .slice(0, 8)
          .map(
            (r, i) => `
              <button
                type="button"
                data-cat="${i}"
              >

                <span class="pn">
                  ${esc(
                    r.pn ||
                      "P/N غير مفهرس"
                  )}
                </span>

                <b>
                  ${esc(
                    r.nomenclature ||
                      r.title ||
                      ""
                  )}
                </b>

                <span class="sub">
                  Bell 429 IPC
                </span>

              </button>
            `
          )
          .join("");

      box.classList.remove(
        "hidden"
      );

      box
        .querySelectorAll(
          "[data-cat]"
        )
        .forEach(
          (b, i) =>
            (b.onclick = () => {
              const r =
                rows[i];

              $("pn").value =
                r.pn;

              $("partName").value =
                r.nomenclature ||
                r.title;

              $("partPreview")
                .classList.remove(
                  "hidden"
                );

              $("partPreview")
                .innerHTML = `
                  <div class="noimg">
                    P/N موثق<br>
                    Bell IPC
                  </div>

                  <div>
                    <b>
                      ${esc(
                        r.nomenclature ||
                          r.title
                      )}
                    </b>

                    <span>
                      P/N:
                      ${esc(
                        r.pn
                      )}
                    </span>
                  </div>
                `;

              box.classList.add(
                "hidden"
              );
            })
        );
    } catch (e) {
      toast(e.message);
    }
  }

  function bindCatalog() {
    [
      "pn",
      "partName"
    ].forEach(
      (id, i) =>
        $(id)?.addEventListener(
          "input",
          (e) => {
            clearTimeout(
              catalogTimer
            );

            catalogTimer =
              setTimeout(
                () =>
                  catalogSearch(
                    e.target.value,
                    $(
                      i
                        ? "nameSuggest"
                        : "pnSuggest"
                    )
                  ),
                180
              );
          }
        )
    );
  }

  async function loadData() {
    if (!user)
      return;

    try {
      orders =
        await api(
          "/api/orders"
        );

      trash =
        await api(
          "/api/trash"
        );

      renderOrders();
      renderUrgent();
      renderTrack();
    } catch (e) {
      toast(e.message);
    }
  }

  async function renderTrash() {
    const box =
      $("v14TrashList");

    const actions =
      $("v14TrashActions");

    if (!user) {
      box.innerHTML =
        '<div class="empty">سجّل الدخول لعرض السلة.</div>';

      return;
    }

    try {
      trash =
        await api(
          "/api/trash"
        );
    } catch (e) {
      box.innerHTML =
        `<div class="empty">${esc(
          e.message
        )}</div>`;

      return;
    }

    if ($("v14TrashTotal"))
      $("v14TrashTotal")
        .textContent =
        `${trash.length} طلب`;

    actions.innerHTML =
      can("trash") &&
      trash.length
        ? `
          <button
            id="purgeTrash"
            class="v14-danger"
          >
            🔒 تفريغ السلة نهائيًا
          </button>
        `
        : "";

    box.innerHTML =
      trash.length
        ? trash
            .map(
              (o) => `
                <div class="v14-trash-card">

                  <b>
                    ${esc(
                      o.orderNo
                    )}
                    ·
                    ${esc(
                      o.partName
                    )}
                  </b>

                  <div class="v14-small">
                    P/N:
                    ${esc(
                      o.pn
                    )}
                    · الحذف:
                    ${esc(
                      o.deletedAt ||
                        ""
                    )}
                  </div>

                  <button
                    class="v14-secondary"
                    data-restore="${esc(
                      o.id
                    )}"
                  >
                    ↩ استرجاع
                  </button>

                </div>
              `
            )
            .join("")
        : '<div class="empty">سلة المحذوفات فارغة.</div>';

    box
      .querySelectorAll(
        "[data-restore]"
      )
      .forEach(
        (b) =>
          (b.onclick =
            async () => {
              try {
                await api(
                  "/api/trash",
                  {
                    method: "POST",
                    body:
                      JSON.stringify(
                        {
                          action:
                            "restore",
                          id:
                            b.dataset
                              .restore
                        }
                      ),
                    csrf: true
                  }
                );

                await loadData();
                renderTrash();
              } catch (e) {
                toast(e.message);
              }
            })
      );

    $("purgeTrash")
      ?.addEventListener(
        "click",
        async () => {
          if (
            !confirm(
              "حذف جميع العناصر نهائيًا؟"
            )
          )
            return;

          try {
            await api(
              "/api/trash",
              {
                method: "POST",
                body:
                  JSON.stringify({
                    action:
                      "purge"
                  }),
                csrf: true
              }
            );

            await loadData();
            renderTrash();

            toast(
              "تم تفريغ السلة"
            );
          } catch (e) {
            toast(e.message);
          }
        }
      );
  }

  async function renderAdmin() {
    const box =
      $("v14AdminContent");

    if (!box || !user)
      return;

    const users =
      user.role ===
      "designer"
        ? await api(
            "/api/admin/users"
          ).catch(
            () => []
          )
        : [];

    box.innerHTML = `
      <div class="v14-admin-grid">

        <div class="v14-stat">
          <div class="num">
            ${orders.length}
          </div>
          <div class="lbl">
            إجمالي الطلبات
          </div>
        </div>

        <div class="v14-stat">
          <div class="num">
            ${
              orders.filter(
                (o) =>
                  o.urgent
              ).length
            }
          </div>
          <div class="lbl">
            طلبات مستعجلة
          </div>
        </div>

        <div class="v14-stat">
          <div class="num">
            ${
              orders.filter(
                (o) =>
                  o.stages?.[5]
                    ?.done
              ).length
            }
          </div>
          <div class="lbl">
            وصلت صلالة
          </div>
        </div>

      </div>

      <div class="v14-panel">

        <h3>
          صلاحيات الحساب
        </h3>

        <div class="v14-perms">

          ${
            user.role ===
            "designer"
              ? '<span class="v14-perm">مصمم الموقع — صلاحيات كاملة</span>'
              : Object.entries(
                  user.permissions ||
                    {}
                )
                  .filter(
                    ([, v]) =>
                      v
                  )
                  .map(
                    ([k]) =>
                      `<span class="v14-perm">${esc(
                        k
                      )}</span>`
                  )
                  .join("") ||
                '<span class="v14-small">لا توجد صلاحيات إضافية</span>'
          }

        </div>

      </div>

      ${
        user.role ===
        "designer"
          ? `
            <div class="v14-panel">

              <h3>
                إدارة المشرفين
              </h3>

              <button
                id="addSupervisor"
                class="v14-primary"
              >
                ＋ إضافة مشرف
              </button>

              <div class="v14-list">

                ${
                  users
                    .map(
                      (u) => `
                        <div class="v14-list-item">

                          <b>
                            ${esc(
                              u.username
                            )}
                          </b>

                          <span>
                            ${esc(
                              u.role
                            )}
                          </span>

                          <button
                            data-del-user="${esc(
                              u.id
                            )}"
                            class="v14-danger"
                          >
                            إزالة
                          </button>

                        </div>
                      `
                    )
                    .join("") ||
                  '<span class="v14-small">لا يوجد مشرفون إضافيون.</span>'
                }

              </div>

            </div>
          `
          : ""
      }

      <div class="v14-actions">

        <button
          id="adminLogout"
          class="v14-danger"
        >
          🚪 تسجيل الخروج
        </button>

      </div>
    `;

    $("adminLogout").onclick =
      logout;

    $("addSupervisor")
      ?.addEventListener(
        "click",
        addSupervisor
      );

    box
      .querySelectorAll(
        "[data-del-user]"
      )
      .forEach(
        (b) =>
          (b.onclick =
            async () => {
              if (
                !confirm(
                  "إزالة المشرف؟"
                )
              )
                return;

              try {
                await api(
                  `/api/admin/users?id=${encodeURIComponent(
                    b.dataset
                      .delUser
                  )}`,
                  {
                    method:
                      "DELETE",
                    csrf: true
                  }
                );

                renderAdmin();
              } catch (e) {
                toast(
                  e.message
                );
              }
            })
      );
  }

  async function addSupervisor() {
    const username =
      prompt(
        "اسم المستخدم الجديد:"
      );

    if (!username)
      return;

    const password =
      prompt(
        "كلمة المرور (12 حرفًا على الأقل):"
      );

    if (!password)
      return;

    try {
      await api(
        "/api/admin/users",
        {
          method: "POST",
          body:
            JSON.stringify({
              username,
              password,
              permissions: {
                delete: true,
                trash: false,
                index: false
              }
            }),
          csrf: true
        }
      );

      renderAdmin();

      toast(
        "تم إنشاء المشرف"
      );
    } catch (e) {
      toast(e.message);
    }
  }

  async function boot() {
    addNav();

    bindCatalog();

    if ($("requestDate")) {
      $("requestDate").value =
        new Date()
          .toISOString()
          .slice(0, 10);
    }

    $("save")
      ?.addEventListener(
        "click",
        saveOrder
      );

    $("clear")
      ?.addEventListener(
        "click",
        clearForm
      );

    $("v14LoginBtn")
      ?.addEventListener(
        "click",
        login
      );

    $("v14LoginClose")
      ?.addEventListener(
        "click",
        closeLogin
      );

    $("v14LoginLogout")
      ?.addEventListener(
        "click",
        logout
      );

    $("v14AdminLogout")
      ?.addEventListener(
        "click",
        logout
      );

    $("secureLoginNav")
      ?.addEventListener(
        "click",
        openLogin
      );

    try {
      const d =
        await api(
          "/api/auth/me"
        );

      if (
        d.authenticated
      ) {
        user = d.user;
        csrf =
          d.csrfToken;

        await loadData();
      }
    } catch {}

    updateNav();

    renderOrders();
    renderUrgent();
  }

  boot();
})();