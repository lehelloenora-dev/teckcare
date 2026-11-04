/* ==========================================================================
   TECKCARE — EFFETS D'INTERFACE (refonte « Il grandit avec vous »)
   Rien ici n'est indispensable : sans ce fichier, le site reste complet.
   Les animations sont coupées si l'utilisateur demande moins de mouvement
   (la classe « motion-ok » n'est alors pas posée sur <html>).
   ========================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  var MOTION = root.classList.contains('motion-ok');
  var FINE = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* Petit planificateur : un seul calcul par image, quel que soit le nombre d'écouteurs */
  var jobs = [], ticking = false;
  function onFrame(fn) { jobs.push(fn); }
  function run() { ticking = false; jobs.forEach(function (fn) { fn(); }); }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(run); } }
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req);

  /* Le teckel « marche » pendant qu'on fait défiler */
  var walkers = [], walkT;
  function walking() {
    walkers.forEach(function (w) { w.classList.add('is-walking'); });
    clearTimeout(walkT);
    walkT = setTimeout(function () { walkers.forEach(function (w) { w.classList.remove('is-walking'); }); }, 180);
  }
  if (MOTION) window.addEventListener('scroll', walking, { passive: true });

  /* ---------- 1. Barre de lecture : le teckel s'allonge de 2 à 12 mois ---------- */
  function initTape() {
    var tape = $('#tape'), out = $('#tape-m'); if (!tape) return;
    var secs = $$('[data-month]'), hero = $('#hero');
    onFrame(function () {
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      var p = clamp(window.scrollY / max, 0, 1);
      tape.style.setProperty('--p', p.toFixed(4));
      var m = Math.round(2 + 10 * p);
      if (secs.length) {            // le mois affiché suit la section lue
        var line = window.innerHeight * .4, cur = secs[0];
        secs.forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s; });
        m = +cur.getAttribute('data-month');
      }
      if (out) out.textContent = m;
      tape.classList.toggle('in-hero', !!hero && hero.getBoundingClientRect().bottom > window.innerHeight * .5);
    });
  }

  /* ---------- 2. Hero : le chiot grandit au fil du défilement ---------- */
  var CAPS = [
    [2, 'Petit, mais déjà gourmand.'],
    [4, 'Il découvre le monde (et vos chaussons).'],
    [6, 'L’ado s’allonge à vue d’œil.'],
    [9, 'Presque un grand.'],
    [12, 'Un teckel accompli, de la truffe à la queue.']
  ];
  function capFor(m) { var c = CAPS[0][1]; CAPS.forEach(function (x) { if (m >= x[0]) c = x[1]; }); return c; }

  function initHero() {
    var hero = $('#hero'), dog = $('#gdog'); if (!hero || !dog) return;
    var num = $('#grow-m'), cap = $('#grow-cap'), ticks = $$('.ruler li', hero), last = -1;
    walkers.push(dog);
    function setMonth(m) {
      if (m === last) return; last = m;
      if (num) num.textContent = m;
      $$('.js-month').forEach(function (e) { e.textContent = m; });
      ticks.forEach(function (li, i) { li.classList.toggle('is-on', i + 2 === m); });
      var txt = capFor(m);
      if (cap && cap.textContent !== txt) { cap.textContent = txt; cap.classList.remove('flash'); void cap.offsetWidth; cap.classList.add('flash'); }
    }
    /* Le chiot grandit quand on le nourrit : on touche un sac, il verse dans la gamelle */
    var g = 0, month = 2, anim = null;
    function setG(v) { hero.style.setProperty('--g', v.toFixed(4)); }
    function growTo(target) {
      var from = g, t0 = null, dur = MOTION ? 1100 : 0;
      cancelAnimationFrame(anim);
      if (!dur) { g = target; setG(g); return; }
      (function step(ts) {
        if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        g = from + (target - from) * e; setG(g);
        if (p < 1) anim = requestAnimationFrame(step);
      })(performance.now());
    }
    setG(0); setMonth(2);
    var hints = $$('.js-feed-hint', hero), feeding = false;
    function visibleBowl() { return $$('.bowl-stage--hero', hero).filter(function (x) { return x.offsetParent; })[0]; }
    function feed(bag) {
      if (feeding) return; feeding = true;
      var reset = month >= 12;
      if (reset) $$('.bowl-stage--hero', hero).forEach(function (st) { var p = $('.bowl-pile', st); if (p) p.innerHTML = ''; st.setAttribute('data-rows', '0'); });
      var bowl = visibleBowl();
      if (bowl && bag) {
        var sel = bag.closest('.hero-mob-bag') ? '.hero-mob-bag .pbag' : ['hp--2','hp--5','hp--pouch','hp--tray'].filter(function (c) { return bag.classList.contains(c); }).map(function (c) { return '.' + c; })[0] || '.hp--5';
        bowl.setAttribute('data-from', sel);
        bowl.setAttribute('data-grams', String(40 + (month - 2) * 8));
        if (MOTION) pourBowl(bowl); else { bag.classList.add('is-pouring'); setTimeout(function () { bag.classList.remove('is-pouring'); }, 600); }
      }
      setTimeout(function () {
        month = reset ? 2 : Math.min(12, month + 2);
        $$('.bowl-stage--hero', hero).forEach(function (st) {
          st.style.setProperty('--fill', ((month - 2) / 10).toFixed(2));

        });
        setMonth(month);
        growTo((month - 2) / 10);
        hero.classList.toggle('is-moving', month > 2);
        if (bub) {
          bub.textContent = reset ? 'On recommence !' : (month >= 12 ? 'Je suis grand !' : barks[n++ % barks.length]);
          bub.classList.add('is-on'); clearTimeout(bt); bt = setTimeout(function () { bub.classList.remove('is-on'); }, 1400);
        }
        dog.classList.remove('jump'); void dog.offsetWidth; dog.classList.add('jump');
        hints.forEach(function (hint) { hint.textContent = month >= 12 ? '12 mois ! Touchez pour recommencer' : 'Encore ! Touchez le sac'; });
        feeding = false;
      }, MOTION ? 1500 : 0);
    }
    $$('.hero-packs .pbag, .hero-mob-bag .pbag', hero).forEach(function (bag) {
      bag.setAttribute('role', 'button'); bag.setAttribute('tabindex', '0'); bag.setAttribute('aria-label', 'Verser des croquettes dans sa gamelle');
      bag.addEventListener('click', function () { feed(bag); });
      bag.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); feed(bag); } });
    });

    /* La tête suit le pointeur */
    var head = $('.dog-head', dog);
    if (FINE && head) {
      window.addEventListener('pointermove', function (ev) {
        var b = head.getBoundingClientRect();
        if (b.bottom < 0 || b.top > window.innerHeight) return;
        var dx = ev.clientX - (b.left + b.width * .3), dy = ev.clientY - (b.top + b.height * .35);
        var a = Math.atan2(dy, Math.abs(dx) + 80) * 180 / Math.PI;
        dog.style.setProperty('--look', clamp(dx < 0 ? a : -a * .4, -12, 12).toFixed(1) + 'deg');
      }, { passive: true });
    }

    /* Une caresse = un « Wouf ! », un saut et quelques croquettes */
    var bub = $('#woof'), barks = ['Wouf !', 'Encore !', 'Croquettes ?', 'Wouf wouf !', 'Je grandis !'], n = 0, bt;
    dog.addEventListener('click', function (ev) {
      if (bub) { bub.textContent = barks[n++ % barks.length]; bub.classList.add('is-on'); clearTimeout(bt); bt = setTimeout(function () { bub.classList.remove('is-on'); }, 1400); }
      dog.classList.remove('jump'); void dog.offsetWidth; dog.classList.add('jump');
    });
  }

  /* ---------- 3. Le teckel du calculateur s'allonge avec l'âge ---------- */
  function initLive() {
    var dog = $('#live-dog'), lbl = $('#live-age'); if (!dog) return;
    function set(age) {
      dog.style.setProperty('--k', ((age - 2) / 10).toFixed(3));
      if (lbl) lbl.textContent = age;
      if (MOTION) { dog.classList.remove('pop'); void dog.offsetWidth; dog.classList.add('pop'); }
    }
    document.addEventListener('tc:age', function (e) { set(e.detail.age); });
    var a = $('#age'); if (a) set(+a.value);
  }

  /* ---------- 4. Parcours horizontal le long du teckel ---------- */
  function initHow() {
    var sec = $('#comment'), vp = $('#how-vp'), track = $('#how-track'); if (!sec || !vp || !track) return;
    var hdog = $('.how-dog', sec); if (hdog) walkers.push(hdog);
    var mq = window.matchMedia('(min-width:900px)');
    var dist = 0;
    function layout() {
      var on = MOTION && mq.matches;
      sec.classList.toggle('is-pinned', on);
      if (!on) { sec.style.height = ''; track.style.transform = ''; return; }
      dist = Math.max(0, track.scrollWidth - vp.clientWidth);
      sec.style.height = (window.innerHeight + dist + 80) + 'px';
    }
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);
    onFrame(function () {
      if (!sec.classList.contains('is-pinned')) return;
      var r = sec.getBoundingClientRect(), span = Math.max(1, sec.offsetHeight - window.innerHeight);
      var p = clamp(-r.top / span, 0, 1);
      track.style.transform = 'translate3d(' + (-p * dist).toFixed(1) + 'px,0,0)';
    });
  }

  /* ---------- 5. Croquettes volantes ---------- */
  var layer = null;
  function burst(x, y, count) { return; /* plus de croquettes hors de la gamelle */
    if (!MOTION) return;
    layer = layer || $('#kibble-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'kibble-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); }
    var bits = [];
    for (var i = 0; i < (count || 14); i++) {
      var el = document.createElement('i'); layer.appendChild(el);
      var ang = -Math.PI / 2 + (Math.random() - .5) * 2.2, sp = 7 + Math.random() * 8;
      bits.push({ el: el, x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: Math.random() * 360, vr: (Math.random() - .5) * 30 });
    }
    var t0 = performance.now();
    (function tick(now) {
      var age = now - t0;
      bits.forEach(function (b) {
        b.vy += .5; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= .99;
        b.el.style.transform = 'translate(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px) rotate(' + b.r.toFixed(0) + 'deg)';
        b.el.style.opacity = String(clamp(1 - (age - 900) / 500, 0, 1));
      });
      if (age < 1400) requestAnimationFrame(tick); else bits.forEach(function (b) { b.el.remove(); });
    })(t0);
  }
  window.teckcareBurst = burst;

  /* Pluie de croquettes : elles tombent depuis un point et rebondissent en bas de l'écran */
  function rain(x, y, count) { return;
    if (!MOTION) return;
    layer = layer || $('#kibble-layer'); if (!layer) return;
    var H = window.innerHeight, bits = [];
    for (var i = 0; i < count; i++) {
      var el = document.createElement('i'); layer.appendChild(el);
      var s = .7 + Math.random() * .6; el.style.width = el.style.height = (18 * s).toFixed(0) + 'px';
      bits.push({ el: el, x: x + (Math.random() - .5) * 60, y: y - Math.random() * 30, vx: (Math.random() - .5) * 7, vy: -2 - Math.random() * 5, r: Math.random() * 360, vr: (Math.random() - .5) * 18, b: 0, d: i * 18 });
    }
    var t0 = performance.now();
    (function tick(now) {
      var age = now - t0, alive = false;
      bits.forEach(function (k) {
        if (age < k.d) { alive = true; return; }
        k.vy += .55; k.x += k.vx; k.y += k.vy; k.r += k.vr;
        if (k.y > H - 22 && k.b < 2) { k.y = H - 22; k.vy *= -.38; k.vx *= .6; k.vr *= .5; k.b++; }
        k.el.style.transform = 'translate(' + k.x.toFixed(1) + 'px,' + k.y.toFixed(1) + 'px) rotate(' + k.r.toFixed(0) + 'deg)';
        k.el.style.opacity = String(clamp(1 - (age - 1700) / 500, 0, 1));
        if (age < 2200) alive = true;
      });
      if (alive) requestAnimationFrame(tick); else bits.forEach(function (k) { k.el.remove(); });
    })(t0);
  }
  window.teckcareRain = rain;

  /* La gamelle : les croquettes tombent du sac et remplissent le bol selon la ration */
  function pourBowl(st) {
    st = st && st.nodeType ? st : $('.calc-result .bowl-stage'); if (!st || !st.offsetParent) return;
    var pile = $('.bowl-pile', st), g = +st.getAttribute('data-grams') || 100;
    var keep = st.classList.contains('bowl-stage--hero');
    if (!keep) pile.innerHTML = '';
    var W = pile.clientWidth, H = pile.clientHeight, k = clamp(W / 6.5, 14, 24), n = keep ? 12 : clamp(Math.round(g / 5), 10, st.hasAttribute('data-from') ? 22 : 34);
    var src = (document.documentElement.getAttribute('data-base') || '') + 'assets/pack/photo/kibble-1.webp';
    st.classList.remove('is-pouring'); void st.offsetWidth; st.classList.add('is-pouring');
    var rows = [], placed = 0, row = keep ? (+st.getAttribute('data-rows') || 0) : 0;
    if (keep) {
      /* gamelle de l'accueil : les croquettes se répartissent dans l'ouverture et le tas monte doucement */
      var lvl = row;
      for (; placed < n; placed++) {
        var t = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
        rows.push({ x: W / 2 + Math.cos(t) * r * W * .46, y: H * .55 + Math.sin(t) * r * H * .45 - lvl * k * .22 - Math.random() * k * .2 });
      }
      row = lvl + 1;
    }
    while (placed < n) {
      var y = H - k * .55 - row * k * .42, half = W * (.40 + row * .03) - row * row * 3.2;
      var cnt = Math.max(1, Math.round(half * 2 / (k * .7)));
      for (var c = 0; c < cnt && placed < n; c++, placed++) {
        rows.push({ x: W / 2 - half + (c + .5) * (half * 2 / cnt) + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 4 });
      }
      row++;
    }
    if (keep) st.setAttribute('data-rows', String(row));
    var sx = W * .2, sy = -H * 1.35, from = st.getAttribute('data-from') && $(st.getAttribute('data-from'));
    if (from) {
      var fr = from.getBoundingClientRect(), pr = pile.getBoundingClientRect();
      /* point de sortie : le coin haut gauche du sac une fois penché (bagPour : -28°), comme une ouverture */
      var cs = getComputedStyle(from), og = cs.transformOrigin.split(' '), ox = parseFloat(og[0]) || fr.width / 2, oy = parseFloat(og[1]) || fr.height / 2;
      var th = -28 * Math.PI / 180, lx = fr.width * .1 - ox, ly = fr.height * .05 - oy;
      sx = fr.left + ox + lx * Math.cos(th) - ly * Math.sin(th) - fr.width * .06 - pr.left;
      sy = fr.top + oy + lx * Math.sin(th) + ly * Math.cos(th) - fr.height * .04 - pr.top;
      from.classList.remove('is-pouring'); void from.offsetWidth; from.classList.add('is-pouring', 'poured');
      setTimeout(function () { from.classList.remove('is-pouring'); }, 380 + n * 42 + 500);
    }
    rows.forEach(function (p, i) {
      var img = document.createElement('img'); img.src = src; img.alt = ''; img.className = 'pk-k';
      var rot = Math.random() * 360, sc = .8 + Math.random() * .35;
      img.style.width = img.style.height = k.toFixed(0) + 'px'; img.style.left = (p.x - k / 2).toFixed(1) + 'px'; img.style.top = (p.y - k / 2).toFixed(1) + 'px';
      img.style.transform = 'rotate(' + rot.toFixed(0) + 'deg) scale(' + sc.toFixed(2) + ')';
      pile.appendChild(img);
      if (!MOTION || !img.animate) return;
      var dx = sx + (Math.random() - .5) * 14 - (p.x - k / 2), dy = sy - (p.y - k / 2);
      img.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (rot - 200) + 'deg) scale(' + sc + ')', opacity: 0, offset: 0 },
        { opacity: 1, offset: .08 },
        { transform: 'translate(' + (dx - W * .16) + 'px,' + (dy + H * .1) + 'px) rotate(' + (rot - 140) + 'deg) scale(' + sc + ')', offset: .3 },
        { transform: 'translate(0,0) rotate(' + rot + 'deg) scale(' + sc + ')', offset: .82, easing: 'ease-out' },
        { transform: 'translate(0,-5px) rotate(' + rot + 'deg) scale(' + sc + ')', offset: .91 },
        { transform: 'translate(0,0) rotate(' + rot + 'deg) scale(' + sc + ')', opacity: 1, offset: 1 }
      ], { duration: 760, delay: 380 + i * 42, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'backwards' });
    });
    if (MOTION) setTimeout(function () { st.classList.remove('is-pouring'); st.classList.add('is-full'); setTimeout(function () { st.classList.remove('is-full'); }, 500); }, 380 + n * 42 + 760);
  }
  function centerOf(el) { var b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }
  function initBursts() {
    document.addEventListener('tc:result', function () { setTimeout(pourBowl, 350); });
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-refill]'); if (b) pourBowl(b.closest('.bowl-stage')); });
    /* Les sacs de l'accueil : un clic fait tomber des croquettes */
    var packs = $('.hero-packs');
    ['#add-to-cart', '#reorder-btn'].forEach(function (s) {
      var b = $(s); if (b) b.addEventListener('click', function () { var c = centerOf(b); burst(c[0], c[1], 14); });
    });
  }

  /* ---------- 6. Étiquette de prix : reflète #price ---------- */
  function initTag() {
    var src = $('#price'), dst = $('#tag-price'); if (!src || !dst) return;
    var sync = function () { dst.textContent = src.textContent; };
    sync();
    new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- 7. Étagère : choisir un sac de la gamme sélectionne le format ---------- */
  function initShelf() {
    $$('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-pick');
        var radio = $('input[name=format][value="' + id + '"]');
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
        var stage = $('#product-stage');
        if (stage) stage.scrollIntoView({ behavior: MOTION ? 'smooth' : 'auto', block: 'center' });
      });
    });
    function mark() {
      var c = $('input[name=format]:checked');
      $$('.range-card').forEach(function (li) {
        var b = li.getAttribute('data-pick');
        li.classList.toggle('is-sel', !!(c && b && b === c.value));
      });
    }
    document.addEventListener('change', function (e) { if (e.target && e.target.name === 'format') mark(); });
    mark();
  }

  /* ---------- 8. Produit : galerie de vues (face, dos, croquette) ---------- */
  function initFlip() {
    var stage = $('#product-stage'), bag = $('#stage-bag'); if (!stage || !bag) return;
    var btns = $$('.thumb-btn', stage);
    function view(v) {
      bag.classList.toggle('is-back', v === 'back');
      stage.classList.toggle('show-kibble', v === 'kibble');
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === v)); });
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { view(b.getAttribute('data-view')); }); });
    function syncThumbs() {
      var fr = $('.pk-front', bag), bk = $('.pk-back', bag);
      var tf = $('[data-thumb="front"]', stage), tb = $('[data-thumb="back"]', stage);
      if (fr && tf) tf.src = fr.getAttribute('src');
      if (bk && tb) tb.src = bk.getAttribute('src');
      view('front');
    }
    new MutationObserver(syncThumbs).observe(bag, { childList: true });
    syncThumbs();
  }

  /* ---------- 9. Rappel : « Créer mon rappel » met le formulaire au point ---------- */
  function initReminderCta() {
    var a = $('#go-reminder'); if (!a) return;
    a.addEventListener('click', function (e) {
      var f = $('#rem-grams'); if (!f) return;
      e.preventDefault();
      var card = $('.reminder-card');
      if (card) card.scrollIntoView({ behavior: MOTION ? 'smooth' : 'auto', block: 'center' });
      setTimeout(function () { f.focus({ preventScroll: true }); }, MOTION ? 500 : 0);
      if (card) { card.classList.add('is-highlight'); setTimeout(function () { card.classList.remove('is-highlight'); }, 2400); }
    });
  }

  /* ---------- 10. Surlignage feutre à l'entrée dans l'écran ---------- */
  function initMarks() {
    if (!MOTION || !('IntersectionObserver' in window)) { $$('mark').forEach(function (m) { m.classList.add('swept'); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('swept'); io.unobserve(x.target); } });
    }, { threshold: .6 });
    $$('mark').forEach(function (m) { io.observe(m); });
    setTimeout(function () { $$('mark').forEach(function (m) { m.classList.add('swept'); }); }, 7000);
  }

  /* ---------- 11. Boutons « magnétiques » (souris uniquement) ---------- */
  function initMagnet() {
    if (!MOTION || !FINE) return;
    $$('.btn--xl, .btn--lg').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
        b.style.translate = (x * 10).toFixed(1) + 'px ' + (y * 8).toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });
  }

  /* ---------- 12. Bouton collant (mobile) ---------- */
  function initSticky() {
    var s = $('#sticky-cta'), hero = $('.hero-cta'), calc = $('#calculateur'), foot = $('.site-footer');
    if (!s || !hero || !('IntersectionObserver' in window)) return;
    var seen = { hero: true, calc: false, foot: false };
    function upd() {
      var on = !seen.hero && !seen.calc && !seen.foot;
      s.classList.toggle('is-on', on); s.setAttribute('aria-hidden', String(!on)); s.tabIndex = on ? 0 : -1;
    }
    [[hero, 'hero'], [calc, 'calc'], [foot, 'foot']].forEach(function (p) {
      if (!p[0]) return;
      new IntersectionObserver(function (en) { seen[p[1]] = en[0].isIntersecting; upd(); }).observe(p[0]);
    });
  }

  /* ---------- 13. Scène du teckel : un point = une explication ---------- */
  function initScene() {
    var sc = $('#scene'); if (!sc) return;
    sc.classList.add('scene-js');
    function pick(k) {
      $$('.scene-tab', sc).forEach(function (t) { t.setAttribute('aria-pressed', String(t.getAttribute('data-scene') === k)); });
      $$('.hot', sc).forEach(function (d) { d.classList.toggle('is-on', d.getAttribute('data-scene') === k); });
      $$('.scene-panel', sc).forEach(function (p) { p.hidden = p.getAttribute('data-scene') !== k; });
    }
    sc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-scene]');
      if (b && (b.classList.contains('scene-tab') || b.classList.contains('hot'))) pick(b.getAttribute('data-scene'));
    });
    pick('quantites');
  }

  /* Le logo trotte pendant le défilement */
  function initLogo() {
    var b = $('.brand'); if (!b || !MOTION) return;
    var t;
    window.addEventListener('scroll', function () {
      b.classList.add('is-trotting'); clearTimeout(t);
      t = setTimeout(function () { b.classList.remove('is-trotting'); }, 220);
    }, { passive: true });
  }

  /* ---------- Coin santé : le check-up du teckel ---------- */
  function initHealth() {
    var box = $('#checkup'); if (!box) return;
    var dog = $('#ck-dog'), fb = $('#ck-fb'), wfb = $('#ck-walk-fb'), range = $('#ck-min'), out = $('#ck-min-out');
    var SH = {
      mince: 'Taille très marquée, côtes visibles : repère « Plutôt mince ». Parlez-en à votre vétérinaire.',
      ideale: 'Côtes que l’on sent sans les voir, taille visible de dessus : repère « Dans les repères ».',
      ronde: 'Côtes difficiles à sentir, pas de taille : repère « Plutôt ronde ». Votre vétérinaire vous aidera à ajuster sa ration.'
    };
    function pick(k) {
      $$('.ck-tab', box).forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-ck') === k)); });
      $$('.ck-hot', box).forEach(function (h) { h.classList.toggle('is-on', h.getAttribute('data-ck') === k); });
      $$('.ck-panel', box).forEach(function (p) { p.hidden = p.id !== 'ck-' + k; });
      box.setAttribute('data-ck', k);
      if (k === 'dos') countUp();
      if (k === 'balade') walk();
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ck]'); if (b && b !== box && !b.classList.contains('checkup')) pick(b.getAttribute('data-ck'));
      var s = e.target.closest('.ck-shapes [data-shape]'); if (s) setShape(s.getAttribute('data-shape'), true);
    });
    box.addEventListener('keydown', function (e) {
      var t = e.target.closest('.ck-tab'); if (!t || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      var tabs = $$('.ck-tab', box), i = tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
      var n = tabs[(i + tabs.length) % tabs.length]; n.focus(); pick(n.getAttribute('data-ck'));
    });
    function setShape(v, fromUser) {
      $$('.ck-shapes [data-shape]', box).forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-shape') === v)); });
      dog.setAttribute('data-shape', v);
      if (fb) fb.textContent = SH[v] || '';
      if (fromUser) { var sync = $('#ck-sync'); if (sync) sync.textContent = 'Reporter dans le calculateur'; }
    }
    var syncBtn = $('#ck-sync'); if (syncBtn) syncBtn.addEventListener('click', function () {
      var v = dog.getAttribute('data-shape'), r = $('input[name="bcs-waist"][value="' + ({ mince: 1, ideale: 2, ronde: 3 })[v] + '"]');
      if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      this.textContent = 'C’est noté dans le calculateur ✓';
    });
    document.addEventListener('change', function (e) { if (e.target && e.target.name === 'bcs-waist') setShape(({ 1: 'mince', 2: 'ideale', 3: 'ronde' })[e.target.value], false); });
    var counted = false;
    function countUp() {
      var el = $('.ck-stat b', box); if (!el || counted) return; counted = true;
      if (!MOTION) return;
      var t0 = performance.now();
      (function tick(now) { var p = Math.min(1, (now - t0) / 900), v = 15.7 * (1 - Math.pow(1 - p, 3)); el.textContent = v.toFixed(1).replace('.', ','); if (p < 1) requestAnimationFrame(tick); })(t0);
    }
    function walk() {
      var m = +range.value;
      out.innerHTML = '<b>' + m + '</b> min';
      range.style.setProperty('--p', ((m - 10) / 110 * 100).toFixed(1) + '%');
      wfb.textContent = m < 30 ? 'Moins de 30 min par jour : dans l’étude DachsLife 2015, c’était associé à davantage de hernies discales.'
        : m <= 60 ? 'Entre 30 min et 1 h par jour : pas de différence nette dans l’étude DachsLife 2015.'
        : 'Plus d’une heure par jour : associé à moins de hernies discales dans l’étude DachsLife 2015, une piste à confirmer selon ses auteurs.';
      dog.style.setProperty('--step', (0.75 - (m - 10) / 110 * 0.5).toFixed(2) + 's');
      dog.classList.add('is-trot');
    }
    range.addEventListener('input', walk);
    setShape('ideale', false);
    pick($('#ck-silhouette') ? 'silhouette' : 'dos');
  }

  /* ---------- En-tête : un repère glisse sous la rubrique en cours ---------- */
  function initNavSpy() {
    var nav = $('.site-header .nav'); if (!nav) return;
    var links = $$('a[href^="#"]', nav), ind = document.createElement('span');
    ind.className = 'nav-ind'; ind.setAttribute('aria-hidden', 'true'); nav.appendChild(ind);
    var active = null, hover = null;
    function place(a) {
      if (!a) { ind.classList.remove('is-on'); return; }
      ind.style.left = a.offsetLeft + 'px'; ind.style.width = a.offsetWidth + 'px'; ind.classList.add('is-on');
    }
    links.forEach(function (a) {
      a.addEventListener('pointerenter', function () { hover = a; place(a); });
      a.addEventListener('pointerleave', function () { hover = null; place(active); });
    });
    var secs = links.map(function (a) { return $(a.getAttribute('href')); });
    onFrame(function () {
      var cur = null;
      secs.forEach(function (s, i) { var v = s && s.closest('main > section'); if (v && !v.hidden && ((v.id !== 'pourquoi' && v.id !== 'conseils') || v.getBoundingClientRect().top < innerHeight * 0.5)) cur = links[i]; });
      if (cur !== active) {
        if (active) { active.classList.remove('is-active'); active.removeAttribute('aria-current'); }
        active = cur;
        if (active) { active.classList.add('is-active'); active.setAttribute('aria-current', 'true'); }
        if (!hover) place(active);
      }
    });
    window.addEventListener('resize', function () { place(hover || active); });
  }

  /* ---------- Accueil : le prénom saisi remplace « your teckel's » dans le titre ---------- */
  function initHeroName() {
    var form = $('#hero-name-form'), inp = $('#hero-name'), main = $('#pup-name'), who = $('#h1-who'); if (!form || !inp || !main) return;
    inp.value = main.value;
    function paint() {
      var n = inp.value.replace(/[<>]/g, '').trim().slice(0, 20);
      var wel = $('#nc-welcome');
      $$('.hero-bowl-name').forEach(function (t) { t.textContent = (n || 'Sa gamelle').toUpperCase(); });
      var hero = $('#hero');
      if (hero) {
        var had = hero.classList.contains('has-name');
        hero.classList.toggle('has-name', !!n);
        if (n && MOTION) $$('.pbag-label--hero', hero).forEach(function (l) { l.classList.remove('bump'); void l.offsetWidth; l.classList.add(had ? 'bump' : 'stick'); });
      }
      if (wel) { wel.innerHTML = n ? 'Bienvenue <b>' + n.replace(/&/g, '&amp;') + '</b>&nbsp;! Sa gamelle l’attend.' : ''; wel.classList.toggle('is-on', !!n); }
      if (!who) return;
      who.textContent = n ? ', ' + n : '';
      who.classList.toggle('is-name', !!n);
      if (MOTION) { who.classList.remove('pop'); void who.offsetWidth; who.classList.add('pop'); }
    }
    inp.addEventListener('input', function () { main.value = inp.value; main.dispatchEvent(new Event('input', { bubbles: true })); paint(); });
    main.addEventListener('input', function () { if (document.activeElement !== inp) { inp.value = main.value; paint(); } });
    function heroBowl() { var b = $$('.bowl-stage--hero').filter(function (x) { return x.offsetParent; })[0]; return b; }
    var pourT, lastPoured = '';
    inp.addEventListener('input', function () {
      clearTimeout(pourT);
      var n = inp.value.trim();
      /* la gamelle ne se remplit qu'en touchant le sac */
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var b = heroBowl(), wait = 0;

      setTimeout(function () {
        var c = $('#calculateur'); if (c) c.scrollIntoView({ behavior: MOTION ? 'smooth' : 'auto' });
        setTimeout(function () { var w = $('#weight'); if (w) w.focus({ preventScroll: true }); }, MOTION ? 700 : 0);
      }, wait);
    });
    if (inp.value) paint();
  }

  /* ---------- Vos teckels : vidéos (quand elles seront fournies) et avis laissés sur cet appareil ---------- */
  function initTransition() {
    var r = document.getElementById('trans-day'), bin = document.getElementById('tbowl-in'), out = document.getElementById('trans-out'), n = document.getElementById('trans-day-n');
    if (!r || !bin) return;
    var grams = 0, bp = document.getElementById('tbowl-p'), bd = document.getElementById('tbowl-d');
    function pct(d) { return d <= 2 ? 25 : d <= 4 ? 50 : d <= 6 ? 75 : 100; }
    function upd() {
      var d = +r.value, p = pct(d);
      r.style.setProperty('--p', ((d - 1) / 6 * 100).toFixed(1) + '%');
      n.textContent = d; bd.textContent = 'jour ' + d; bp.textContent = p + ' %';
      bin.style.setProperty('--tp', p);
      var t = p === 100 ? '<strong>100&nbsp;% TeckCare.</strong> Ouaf&nbsp;!' : '<strong>' + p + '&nbsp;% TeckCare</strong> mélangé à ' + (100 - p) + '&nbsp;% de son ancienne alimentation.';
      if (out.closest('.pdlg')) t = ({ 25: '<strong>25&nbsp;% TeckCare</strong> · Il fait connaissance.', 50: '<strong>Moitié-moitié</strong> · Il prend ses marques.', 75: '<strong>75&nbsp;% TeckCare</strong> · Presque adopté&nbsp;!', 100: '<strong>100&nbsp;% TeckCare</strong> · Ouaf, c’est fait&nbsp;!' })[p];
      if (grams) t += ' <span class="trans-g">Pour sa ration de ' + grams + '&nbsp;g&nbsp;: ' + (p < 100 ? Math.round(grams * (100 - p) / 100) + '&nbsp;g d’ancienne + ' : '') + Math.round(grams * p / 100) + '&nbsp;g de TeckCare.</span>';
      out.innerHTML = t;
      r.setAttribute('aria-valuetext', 'Jour ' + d + ', ' + p + ' % TeckCare');
    }
    r.addEventListener('input', upd);
    document.addEventListener('tc:result', function (e) { if (e.detail && e.detail.grams) { grams = Math.round(e.detail.grams); upd(); } });
    upd();
  }
  function initFeatureVideo() {
    var v = document.getElementById('vfeat'), b = document.getElementById('vfeat-btn'); if (!v) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, user = reduce ? 'paused' : '';
    function ui() { var p = v.paused; b.classList.toggle('is-paused', p); b.setAttribute('aria-label', p ? 'Lire la vidéo' : 'Mettre en pause'); }
    b.addEventListener('click', function () { if (v.paused) { user = ''; v.play().catch(function () {}); } else { user = 'paused'; v.pause(); } });
    v.addEventListener('play', ui); v.addEventListener('pause', ui);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !user) v.play().catch(function () {}); else if (!e.isIntersecting && !v.paused) v.pause(); }); }, { threshold: .35 }).observe(v);
    } else if (!reduce) v.play().catch(function () {});
    ui();
  }
  function initCommunity() {
    $$('.video-slot').forEach(function (v) {
      var src = v.getAttribute('data-video'); if (!src) return;
      var fr = $('.vs-frame', v); fr.innerHTML = '<video src="' + src + '" controls playsinline preload="metadata"></video>';
      var sp = $('figcaption span', v); if (sp) sp.textContent = '';
    });
    var form = $('#review-form'), grid = $('#review-grid'); if (!form || !grid) return;
    var KEY = 'tc_my_review';
    function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function show(rv) {
      var old = $('.review--mine', grid); if (old) old.remove();
      if (!rv) return;
      var el = document.createElement('article'); el.className = 'review review--mine';
      el.innerHTML = '<div class="rv-stars" aria-label="' + rv.note + ' sur 5">' + '★★★★★'.slice(0, rv.note) + '<i>' + '★★★★★'.slice(rv.note) + '</i></div><p class="rv-text">' + esc(rv.text) + '</p><p class="rv-who">' + esc(rv.name || 'Vous') + ' · visible sur cet appareil uniquement</p>';
      grid.insertBefore(el, form);
    }
    try { show(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) {}
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = $('#rv-text').value.trim(), n = $('#rv-name').value.trim(), note = +(($('input[name="rv-note"]:checked', form) || {}).value || 5), msg = $('#rv-msg');
      if (t.length < 5) { msg.textContent = 'Écrivez quelques mots sur votre expérience.'; $('#rv-text').focus(); return; }
      var rv = { text: t, name: n, note: note };
      try { localStorage.setItem(KEY, JSON.stringify(rv)); } catch (er) {}
      show(rv); form.reset(); msg.textContent = 'Merci ! Votre avis est publié sur cet appareil.';
    });
  }

  function init() {
    initCommunity();
    initTransition();
    initFeatureVideo();
    initHeroName();
    initNavSpy();
    initHealth();
    initLogo();
    initScene(); initTape(); initHero(); initLive(); initHow(); initBursts();
    initTag(); initShelf(); initFlip(); initReminderCta(); initMarks(); initMagnet(); initSticky();
    run();
    root.classList.add('fx-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* Notes en croquettes (même DA que la marque) à la place des étoiles ★ */
(function () {
  function kibbles(root) {
    (root || document).querySelectorAll('.rv-stars, .hp-stars').forEach(function (el) {
      if (el.getAttribute('data-k')) return;
      var m = /^(\d)/.exec(el.getAttribute('aria-label') || ''), n = m ? +m[1] : 5, h = '';
      for (var i = 0; i < 5; i++) h += '<i class="kb' + (i < n ? '' : ' kb--off') + '"></i>';
      el.innerHTML = h; el.setAttribute('data-k', '1'); el.setAttribute('role', 'img');
    });
  }
  function boot() {
    kibbles();
    var g = document.getElementById('review-grid');
    if (g && window.MutationObserver) new MutationObserver(function () { kibbles(g); }).observe(g, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* Vidéo « Pourquoi TeckCare » : lecture muette en boucle quand elle est visible, sauf si l'animation est réduite */
(function () {
  var vids = [].slice.call(document.querySelectorAll('video[data-autoplay]')); if (!vids.length) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  vids.forEach(function (v) {
    if (reduce) { v.controls = true; return; }
    if (!('IntersectionObserver' in window)) { v.play().catch(function () { v.controls = true; }); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var p = v.play(); if (p) p.catch(function () { v.controls = true; }); } else v.pause(); }); }, { threshold: 0.35 }).observe(v);
  });
})();
