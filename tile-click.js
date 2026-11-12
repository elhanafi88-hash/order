/* tile-click.js — يخلّي كروت الإحصائيات (.tiles .tile) قابلة للضغط في كل السيستم.
   الضغط على الكارت بيشغّل الفلتر (الـ chip) اللي بيطابقه وينزل للقائمة.
   حطه في index.html قبل </body>:  <script src="tile-click.js"></script>        */
(function () {
  // لو اسم الكارت مش شبه اسم الفلتر، اربطهم هنا يدويًا:  "اسم الكارت": "أول كلام في زرار الفلتر"
  var MAP = {
    'في الإنتاج دلوقتي': 'الكل',
    'متأخر أو هيتأخر عن التسليم': 'متأخر',
    'خامات في المخزنين': 'الكل',
    'ممكن تحجز منها دلوقتي': 'ممكن تحجز منها'
  };

  var css = document.createElement('style');
  css.textContent =
    '.tiles .tile{cursor:pointer;transition:transform .12s,box-shadow .12s}' +
    '.tiles .tile:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.12)}' +
    '.tiles .tile:focus-visible{outline:2px solid #2563eb;outline-offset:2px}' +
    '.tiles .tile.tile-active{box-shadow:0 0 0 2px currentColor inset}' +
    '.tile-flash{animation:tileFlash 1.2s ease}' +
    '@keyframes tileFlash{0%{background:rgba(37,99,235,.18)}100%{background:transparent}}';
  document.head.appendChild(css);

  function clean(s) { return (s || '').replace(/\(\s*\d+\s*\)/g, '').replace(/\s+/g, ' ').trim(); }
  function labelOf(tile) { var l = tile.querySelector('.l'); return clean(l ? l.textContent : tile.textContent); }

  // الـ chips اللي فيها عدد (الكل (30)، متأخر (3) ...) هي فلاتر الحالة
  function statusChips(root) {
    return Array.prototype.filter.call(root.querySelectorAll('button.chip'), function (b) {
      return /\(\s*\d+\s*\)/.test(b.textContent);
    });
  }

  function findChip(tile) {
    var root = tile.closest('main') || document;
    var chips = statusChips(root);
    var label = labelOf(tile);
    var want = MAP[label] ? clean(MAP[label]) : null;
    var hit = null;
    chips.forEach(function (b) {
      if (hit) return;
      var c = clean(b.textContent);
      if (want ? c.indexOf(want) === 0 : (c === label || label.indexOf(c) === 0 || c.indexOf(label) === 0)) hit = b;
    });
    return hit;
  }

  function activate(tile) {
    var chip = findChip(tile);
    if (!chip) { tile.classList.add('tile-flash'); setTimeout(function () { tile.classList.remove('tile-flash'); }, 1200); return; }
    var label = labelOf(tile);
    chip.click();
    // الصفحة ممكن تعيد الرسم بعد الضغط، فبندور على العناصر تاني
    setTimeout(function () {
      document.querySelectorAll('.tiles .tile').forEach(function (t) {
        t.classList.toggle('tile-active', labelOf(t) === label);
      });
      var target = document.querySelector('main .tablebox') || document.querySelector('main .grow2') ||
                   findFreshChip(label);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('tile-flash');
        setTimeout(function () { target.classList.remove('tile-flash'); }, 1200);
      }
    }, 80);
  }

  function findFreshChip(label) {
    var t = Array.prototype.find.call(document.querySelectorAll('.tiles .tile'), function (x) { return labelOf(x) === label; });
    return t ? findChip(t) : null;
  }

  document.addEventListener('click', function (e) {
    var tile = e.target.closest && e.target.closest('.tiles .tile');
    if (tile) activate(tile);
  });
  document.addEventListener('keydown', function (e) {
    var tile = e.target.closest && e.target.closest('.tiles .tile');
    if (tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(tile); }
  });

  // إتاحة الكيبورد وقارئ الشاشة للكروت حتى بعد إعادة الرسم
  function enhance() {
    document.querySelectorAll('.tiles .tile:not([data-clickable])').forEach(function (t) {
      t.setAttribute('data-clickable', '1');
      t.setAttribute('role', 'button');
      t.setAttribute('tabindex', '0');
      t.title = 'اضغط لعرض: ' + labelOf(t);
    });
  }
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
  enhance();
})();
