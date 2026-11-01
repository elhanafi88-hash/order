/* METAPLEX STEEL — Supabase backend for the public site.
   Gives the page the same db / assets / downloads interface it uses on claude.ai,
   backed by Supabase: everyone can read, signed-in staff can write. */
(function () {
  "use strict";
  var CFG = window.MX_SUPABASE || {};
  var sb = window.supabase.createClient(CFG.url, CFG.anonKey);
  var BUCKET = "files";
  var session = null;
  var ready = sb.auth.getSession().then(function (r) { session = r.data.session; return session; });

  sb.auth.onAuthStateChange(function (ev, s) {
    var was = !!session; session = s;
    if (ev === "SIGNED_IN" && !was) location.reload();
    if (ev === "SIGNED_OUT" && was) location.reload();
  });

  /* ---------- login UI ---------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "on") Object.keys(attrs.on).forEach(function (ev) { e.addEventListener(ev, attrs.on[ev]); });
      else if (k === "text") e.textContent = attrs.text;
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  var dlg = null;
  function openLogin() {
    if (dlg) { dlg.hidden = false; return; }
    var em = el("input", { type: "email", autocomplete: "username", placeholder: "الإيميل / Email", class: "mx-in", required: "" });
    var pw = el("input", { type: "password", autocomplete: "current-password", placeholder: "الباسورد / Password", class: "mx-in", required: "" });
    var msg = el("div", { class: "mx-msg", role: "status" });
    var form = el("form", { class: "mx-card", on: { submit: function (e) {
      e.preventDefault(); msg.textContent = "جاري الدخول...";
      sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value }).then(function (r) {
        if (r.error) msg.textContent = "الإيميل أو الباسورد غلط.";
      });
    } } }, [
      el("h2", { text: "دخول الموظفين" }),
      el("p", { class: "mx-sub", text: "التعديل للموظفين بس. الحسابات بيعملها صاحب الموقع." }),
      em, pw, msg,
      el("div", { class: "mx-row" }, [
        el("button", { type: "button", class: "btn", text: "إلغاء", on: { click: function () { dlg.hidden = true; } } }),
        el("button", { type: "submit", class: "btn primary", text: "دخول" })
      ])
    ]);
    dlg = el("div", { class: "mx-scrim", dir: "rtl", lang: "ar", "data-noi18n": "" }, [form]);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.hidden = true; });
    document.body.appendChild(dlg);
    em.focus();
  }

  function mountBar() {
    var bar = document.getElementById("uibar");
    if (!bar) return;
    var b;
    if (session) {
      b = el("button", { class: "chip", type: "button", text: "خروج (" + (session.user.email || "") + ")",
        on: { click: function () { sb.auth.signOut(); } } });
    } else {
      b = el("button", { class: "chip", type: "button", text: "🔒 دخول الموظفين", on: { click: openLogin } });
      document.body.classList.add("mx-readonly");
    }
    b.setAttribute("data-noi18n", "");
    bar.appendChild(b);
  }
  ready.then(function () {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountBar); else mountBar();
  });

  function needLogin() {
    openLogin();
    var e = new Error("سجّل دخول الأول عشان تعدّل."); e.code = "not_signed_in";
    return Promise.reject(e);
  }

  /* ---------- db ---------- */
  var db = {
    collection: function (col) {
      return {
        onSnapshot: function (cb, onErr) {
          function load() {
            return sb.from("docs").select("id,data").eq("col", col).then(function (r) {
              if (r.error) { if (onErr) onErr(r.error); return; }
              cb({ docs: r.data.map(function (row) { return { id: row.id, data: function () { return row.data || {}; } }; }) });
            });
          }
          load();
          var t = 0;
          var ch = sb.channel("docs-" + col)
            .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "col=eq." + col },
              function () { clearTimeout(t); t = setTimeout(load, 150); })
            .subscribe();
          return function () { sb.removeChannel(ch); };
        }
      };
    },
    doc: function (path) {
      var i = path.indexOf("/"), col = path.slice(0, i), id = path.slice(i + 1);
      return {
        set: function (data) {
          if (!session) return needLogin();
          return sb.from("docs").upsert({ col: col, id: id, data: data, updated_at: new Date().toISOString() })
            .then(function (r) { if (r.error) throw r.error; });
        },
        delete: function () {
          if (!session) return needLogin();
          return sb.from("docs").delete().eq("col", col).eq("id", id)
            .then(function (r) { if (r.error) throw r.error; });
        }
      };
    }
  };

  /* ---------- files (staff only) ---------- */
  function uid() { return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  var assets = {
    upload: function (blob, opts) {
      var id = uid(), type = (opts && opts.type) || blob.type || "application/octet-stream";
      return sb.storage.from(BUCKET).upload(id, blob, { contentType: type }).then(function (r) {
        if (r.error) throw r.error;
        return { id: id, url: "/_blob/" + id, sizeBytes: blob.size, contentType: type };
      });
    },
    delete: function (id) {
      return sb.storage.from(BUCKET).remove([id]).then(function (r) { if (r.error) throw r.error; });
    }
  };
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.indexOf("/_blob/") === 0) {
      var id = input.slice(7);
      return sb.storage.from(BUCKET).download(id).then(function (r) {
        if (r.error) return new Response(null, { status: 403 });
        return new Response(r.data, { status: 200, headers: { "Content-Type": r.data.type } });
      });
    }
    return realFetch(input, init);
  };

  /* ---------- downloads ---------- */
  var downloads = {
    save: function (o) {
      var b = o.data instanceof Blob ? o.data : new Blob([o.data]);
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = o.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return Promise.resolve();
    }
  };

  window.claude = {
    use: function (name) {
      return ready.then(function () {
        if (name === "db") return db;
        if (name === "downloads") return downloads;
        if (name === "assets") return session ? assets : null;
        return null;
      });
    }
  };
})();
