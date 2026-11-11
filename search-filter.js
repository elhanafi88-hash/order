/* METAPLEX — بحث موحّد بالأوردر (رقم أو اسم) في كل الشيتات
   ضيف السطر ده قبل </body> في index.html:
   <script src="search-filter.js"></script>
*/
(function () {
  if (window.__sfInstalled) return;
  window.__sfInstalled = true;

  var css = document.createElement('style');
  css.textContent =
    '.sf-hide{display:none!important}' +
    '#sf-bar{display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap}' +
    '#sf-bar input{flex:1;min-width:220px;padding:9px 12px;font-size:15px;border:1px solid #ccc;border-radius:8px}' +
    '#sf-bar button{padding:8px 12px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer}' +
    '#sf-count{font-size:13px;opacity:.75;white-space:nowrap}' +
    '.sf-hit{outline:2px solid #f5b400;outline-offset:-2px}';
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.id = 'sf-bar';
  bar.innerHTML =
    '<input id="sf-q" type="search" autocomplete="off" ' +
    'placeholder="🔍 دور على الأوردر برقمه أو باسمه (في الشيت المفتوح)">' +
    '<button type="button" id="sf-clear">مسح</button>' +
    '<span id="sf-count"></span>';

  var tabs = document.getElementById('tabs');
  var view = document.getElementById('view');
  if (!view) return;
  (tabs || view).insertAdjacentElement(tabs ? 'afterend' : 'beforebegin', bar);

  var input = bar.querySelector('#sf-q');
  var countEl = bar.querySelector('#sf-count');

  // يحوّل الأرقام العربية/الفارسية لإنجليزي ويوحّد الحروف
  function norm(s) {
    return (s || '')
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x6F0; })
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .toLowerCase().trim();
  }

  // كل الكلمات لازم تكون موجودة (مثلاً: "3002 partieere")
  function matches(text, terms) {
    for (var i = 0; i < terms.length; i++) if (text.indexOf(terms[i]) === -1) return false;
    return true;
  }

  // يقسّم صفوف الجدول لمجموعات: رأس أوردر + الصفوف اللي تحته، أو صفوف rowspan، أو صف لوحده
  function groupsOf(tbody) {
    var rows = Array.prototype.slice.call(tbody.rows);
    var hasHeaders = tbody.querySelector('tr > td.oh');
    var groups = [], cur = null, spanLeft = 0;
    rows.forEach(function (r) {
      if (hasHeaders) {
        if (r.querySelector(':scope > td.oh') || !cur) { cur = []; groups.push(cur); }
        cur.push(r);
        return;
      }
      if (spanLeft > 0) { cur.push(r); spanLeft--; }
      else { cur = [r]; groups.push(cur); }
      var maxSpan = 1;
      Array.prototype.forEach.call(r.cells, function (c) {
        if (c.rowSpan > maxSpan) maxSpan = c.rowSpan;
      });
      if (maxSpan - 1 > spanLeft) spanLeft = maxSpan - 1;
    });
    return groups;
  }

  var applying = false;
  function apply() {
    applying = true;
    var terms = norm(input.value).split(' ').filter(Boolean);
    var shown = 0, total = 0;

    view.querySelectorAll('.sf-hide').forEach(function (e) { e.classList.remove('sf-hide'); });
    view.querySelectorAll('.sf-hit').forEach(function (e) { e.classList.remove('sf-hit'); });

    if (terms.length) {
      // الجداول
      view.querySelectorAll('table tbody').forEach(function (tb) {
        groupsOf(tb).forEach(function (g) {
          total++;
          var txt = norm(g.map(function (r) { return r.textContent; }).join(' '));
          if (matches(txt, terms)) shown++;
          else g.forEach(function (r) { r.classList.add('sf-hide'); });
        });
      });
      // جدول الإنتاج (Gantt)
      view.querySelectorAll('.gantt > div').forEach(function (row) {
        if (!/\d{3,}/.test(row.textContent)) return; // سيب رؤوس التواريخ
        total++;
        if (matches(norm(row.textContent), terms)) shown++;
        else row.classList.add('sf-hide');
      });
      countEl.textContent = total
        ? (shown ? shown + ' نتيجة' : 'مفيش نتايج في الشيت ده')
        : '';
    } else {
      countEl.textContent = '';
    }
    applying = false;
  }

  var pending = false;
  function schedule() {
    if (pending || applying) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; apply(); });
  }

  input.addEventListener('input', schedule);
  bar.querySelector('#sf-clear').addEventListener('click', function () {
    input.value = ''; apply(); input.focus();
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; apply(); }
  });
  // اختصار: Ctrl+K أو / يفتح البحث
  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') ||
        (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag))) {
      e.preventDefault(); input.focus(); input.select();
    }
  });

  // لما الشيت يتغير أو يترسم من جديد، الفلتر يتطبق تاني تلقائي
  new MutationObserver(function () { if (input.value) schedule(); })
    .observe(view, { childList: true, subtree: true });
})();
