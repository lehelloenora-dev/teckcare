/* ==========================================================================
   TECKCARE — script.js
   Modules : utilitaires · UTM · A/B · analytics (GA4 + debug local) · packshots
             · panier · calculateur · produit · checkout démo · rappel/réachat · UI
   Les réglages (prix, formule, GA4, test A/B) vivent dans config.js.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.TECKCARE_CONFIG;
  if (!CFG) { console.error('[TeckCare] config.js introuvable.'); return; }

  var BASE = document.documentElement.getAttribute('data-base') || '';
  var FORMATS = CFG.product.formats;
  var R = CFG.ration;

  /* ---------- Utilitaires ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function mk(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var sess = {
    get: function (k, d) { var v = safe(function () { return sessionStorage.getItem(k); }); if (v == null) return d; try { return JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { safe(function () { sessionStorage.setItem(k, JSON.stringify(v)); }); },
    del: function (k) { safe(function () { sessionStorage.removeItem(k); }); }
  };
  var fmtEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: CFG.site.currency || 'EUR' });
  function eur(n) { return fmtEur.format(n); }
  function num1(n) { return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n); }
  function dateFr(d, withYear) { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined }).format(d); }
  function reduceMotion() { return !document.documentElement.classList.contains('motion-ok'); }
  var EXTRAS = (CFG.extras || []).map(function (x) { x.extra = true; return x; });
  function fmtById(id) { for (var i = 0; i < FORMATS.length; i++) if (FORMATS[i].id === id) return FORMATS[i]; for (var j = 0; j < EXTRAS.length; j++) if (EXTRAS[j].id === id) return EXTRAS[j]; return null; }
  function itemThumb(f) { return f.extra ? '<img src="' + BASE + f.img + '" alt="" style="width:100%;height:100%;object-fit:contain">' : bagSVG(f.kg); }
  function itemName(f) { return f.extra ? f.name : CFG.product.name; }
  function kgLabel(f) { return f.label; }
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('is-on'); }, 3200);
  }

  /* ======================================================================
     1. UTM — captés dans l'URL, conservés pour la session, propagés
     ====================================================================== */
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  function captureUTM() {
    var p = new URLSearchParams(location.search), found = {};
    UTM_KEYS.forEach(function (k) { var v = p.get(k); if (v) found[k] = v.slice(0, 100); });
    if (Object.keys(found).length) sess.set('tc_utm', found);
    return sess.get('tc_utm', {});
  }
  var UTM = captureUTM();
  function decorateLinks() {
    if (!Object.keys(UTM).length) return;
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!h || /^(#|mailto:|tel:|https?:|javascript:)/i.test(h)) return;
      try {
        var u = new URL(h, location.href);
        Object.keys(UTM).forEach(function (k) { if (!u.searchParams.has(k)) u.searchParams.set(k, UTM[k]); });
        a.setAttribute('href', h.split(/[?#]/)[0] + u.search + u.hash);
      } catch (e) { /* lien laissé tel quel */ }
    });
  }

  /* ======================================================================
     2. Test A/B — une seule variable à la fois (config.experiments)
     ====================================================================== */
  var EXP = null;
  function initExperiment() {
    var E = CFG.experiments, id = E && E.active, def = id && E.definitions && E.definitions[id];
    document.documentElement.classList.remove('exp-pending');
    if (!def) return;
    var forced = (new URLSearchParams(location.search).get('ab') || '').toUpperCase();
    var v = (forced && def.variants[forced]) ? forced : sess.get('tc_exp_' + id, null);
    if (!v || !def.variants[v]) {
      var keys = Object.keys(def.variants), total = 0, r;
      keys.forEach(function (k) { total += def.variants[k].weight || 1; });
      r = Math.random() * total;
      for (var i = 0; i < keys.length; i++) { r -= (def.variants[keys[i]].weight || 1); if (r <= 0) { v = keys[i]; break; } }
      v = v || keys[0];
    }
    sess.set('tc_exp_' + id, v);
    var els = $$('[data-exp="' + id + '"]');
    els.forEach(function (el) { var vv = def.variants[v]; if (vv && vv.text) el.textContent = vv.text; });
    EXP = { experiment_id: id, variant_id: v };
    EXP._present = els.length > 0;
  }
  function expParams() { return EXP ? { experiment_id: EXP.experiment_id, variant_id: EXP.variant_id } : {}; }

  /* ======================================================================
     3. Analytics — GA4 (après consentement) + journal local de debug
     ====================================================================== */
  var AN = { id: String((CFG.analytics && CFG.analytics.measurementId) || '').trim(), loaded: false };
  var EVENTS = [];
  window.teckcareEvents = EVENTS;
  var dbgEls = null;

  (function handleDebugParam() {
    var d = new URLSearchParams(location.search).get('debug');
    if (d === '1') sess.set('tc_debug', '1');
    if (d === '0') sess.del('tc_debug');
  })();
  function debugOn() { return !!(CFG.analytics && CFG.analytics.debugMode) || sess.get('tc_debug', null) === '1'; }

  function loadGA() {
    if (AN.loaded || !AN.id) return;
    AN.loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    var cfg = {};
    if (debugOn()) cfg.debug_mode = true;      // active DebugView
    window.gtag('config', AN.id, cfg);
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(AN.id);
    document.head.appendChild(s);
    updateDebug();
  }

  function track(name, params) {
    var payload = {};
    [expParams(), UTM, params || {}].forEach(function (o) { Object.keys(o).forEach(function (k) { payload[k] = o[k]; }); });
    var entry = { ts: new Date().toISOString(), name: name, params: payload, sent_to_ga4: false };
    if (AN.id && AN.loaded && typeof window.gtag === 'function') { window.gtag('event', name, payload); entry.sent_to_ga4 = true; }
    EVENTS.push(entry);
    if (debugOn()) { try { console.info('[TeckCare analytics]', name, payload, entry.sent_to_ga4 ? '→ GA4' : '(local uniquement)'); } catch (e) {} }
    updateDebug();
  }
  window.tcTrack = track;
  function gaItem(f, q) {
    return { item_id: f.id, item_name: itemName(f), item_variant: f.label, item_category: f.extra ? 'Pâtée chiot teckel' : 'Croquettes chiot teckel', price: f.price, quantity: q };
  }

  /* Consentement */
  function showConsent() {
    var old = $('#consent'); if (old) old.remove();
    var el = mk(
      '<div class="consent" id="consent" role="dialog" aria-labelledby="consent-t" aria-modal="false">' +
      '<h2 id="consent-t">Votre accord pour la mesure d’audience</h2>' +
      '<p>Avec votre accord, nous utilisons Google Analytics pour compter les visites et savoir si le calculateur est utile. Rien n’est déposé avant votre choix. <a href="' + BASE + 'confidentialite.html">En savoir plus</a></p>' +
      '<div class="row"><button type="button" class="btn btn--ghost" data-consent="no">Refuser</button><button type="button" class="btn btn--ghost" data-consent="yes">Accepter</button></div></div>');
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]'); if (!b) return;
      var yes = b.getAttribute('data-consent') === 'yes';
      store.set('tc_consent', { analytics: yes, ts: Date.now() });
      el.remove();
      if (yes) { loadGA(); toast('Merci, mesure d’audience activée.'); }
      else { toast('Compris, aucune mesure d’audience.'); updateDebug(); }
    });
  }
  function initConsent() {
    var buttons = $$('[data-manage-cookies]');
    if (!AN.id) { buttons.forEach(function (b) { b.hidden = true; }); return; }
    var c = store.get('tc_consent', null);
    if (c === null) showConsent(); else if (c.analytics) loadGA();
    buttons.forEach(function (b) { b.hidden = false; b.addEventListener('click', showConsent); });
  }

  /* Panneau de debug local (?debug=1) */
  function initDebug() {
    if (!debugOn() || dbgEls) return;
    var el = mk(
      '<div class="dbg" id="dbg"><div class="dbg-head" role="button" tabindex="0" aria-expanded="true"><b>Debug analytics</b><span class="dbg-badge local" id="dbg-mode"></span><span aria-hidden="true">▾</span></div>' +
      '<div class="dbg-body" id="dbg-body"></div>' +
      '<div class="dbg-actions"><button type="button" data-dbg="clear">Vider</button><button type="button" data-dbg="copy">Copier JSON</button><button type="button" data-dbg="off">Fermer</button></div></div>');
    document.body.appendChild(el);
    dbgEls = { root: el, head: $('.dbg-head', el), body: $('#dbg-body', el), mode: $('#dbg-mode', el) };
    function toggle() { var open = dbgEls.body.hidden; dbgEls.body.hidden = !open; $('.dbg-actions', el).hidden = !open; dbgEls.head.setAttribute('aria-expanded', String(open)); }
    dbgEls.head.addEventListener('click', toggle);
    dbgEls.head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dbg]'); if (!b) return;
      var a = b.getAttribute('data-dbg');
      if (a === 'clear') { EVENTS.length = 0; updateDebug(); }
      if (a === 'copy') { safe(function () { navigator.clipboard.writeText(JSON.stringify(EVENTS, null, 2)); toast('Journal copié'); }); }
      if (a === 'off') { sess.del('tc_debug'); el.remove(); dbgEls = null; }
    });
    updateDebug();
  }
  function updateDebug() {
    if (!dbgEls) return;
    var consent = store.get('tc_consent', null);
    var mode, note;
    if (!AN.id) { mode = 'LOCAL'; note = 'Aucun Measurement ID dans config.js : ces événements ne sont PAS envoyés à GA4. Ils servent uniquement à vérifier le déclenchement.'; dbgEls.mode.className = 'dbg-badge local'; }
    else if (AN.loaded) { mode = 'GA4 ACTIF'; note = 'Événements transmis à GA4 (' + esc(AN.id) + '). Vérifiez-les dans Admin → DebugView.'; dbgEls.mode.className = 'dbg-badge ga'; }
    else { mode = 'GA4 EN ATTENTE'; note = consent && consent.analytics === false ? 'Consentement refusé : rien n’est envoyé à GA4.' : 'En attente du consentement : rien n’est envoyé à GA4.'; dbgEls.mode.className = 'dbg-badge local'; }
    dbgEls.mode.textContent = mode;
    var counts = {}; EVENTS.forEach(function (e) { counts[e.name] = (counts[e.name] || 0) + 1; });
    var html = '<p class="dbg-note">' + note + '</p>';
    html += '<div class="dbg-ev"><i>Compteurs :</i> ' + (Object.keys(counts).map(function (k) { return '<b>' + k + '</b>×' + counts[k]; }).join(' · ') || '—') + '</div>';
    EVENTS.slice(-25).reverse().forEach(function (e) {
      html += '<div class="dbg-ev"><b>' + esc(e.name) + '</b> <i>' + e.ts.slice(11, 19) + (e.sent_to_ga4 ? ' → GA4' : ' · local') + '</i><br>' + esc(JSON.stringify(e.params)) + '</div>';
    });
    dbgEls.body.innerHTML = html;
  }

  /* ======================================================================
     4. Sacs TeckCare (photos des maquettes) + étiquette au prénom du chiot
     ====================================================================== */
  function pupDe(n) { return n && /^[aeiouyhàâäéèêëîïôöùûüœ]/i.test(n) ? 'd’' : 'de '; }
  function longCls(n) { n = n || ''; return n.length > 14 ? '2' : (n.length > 9 ? '1' : '0'); }
  function bagSVG(kg) {
    var n = (kg >= 4) ? 5 : 2, label = String(kg).replace('.', ',');
    var dim = n === 5 ? [588, 846, 346, 507] : [520, 794, 371, 523];
    var nm = pupName(), who = nm || 'mon teckel';
    return '<span class="pbag" data-kg="' + n + '" data-long="' + longCls(nm) + '">' +
      '<img class="pk pk-front" src="' + BASE + 'assets/pack/photo/bag' + n + '-front.webp" alt="Sac de croquettes TeckCare Poulet & Saumon, ' + label + ' kg" width="' + dim[0] + '" height="' + dim[1] + '" decoding="async">' +
      '<img class="pk pk-back" src="' + BASE + 'assets/pack/photo/bag' + n + '-back.webp" alt="Dos du sac TeckCare ' + label + ' kg : composition et constituants" width="' + dim[2] + '" height="' + dim[3] + '" loading="lazy" decoding="async"></span>';
  }
  function injectBags() { $$('[data-bag]').forEach(function (el) { el.innerHTML = bagSVG(parseFloat(el.getAttribute('data-bag'))); }); }

  /* ======================================================================
     5. Panier
     ====================================================================== */
  var cart = (store.get('tc_cart', []) || []).filter(function (i) { return fmtById(i.id) && i.qty > 0; });
  var lastFocus = null;

  function cartTotals() {
    var sub = 0, count = 0;
    cart.forEach(function (i) { var f = fmtById(i.id); sub += f.price * i.qty; count += i.qty; });
    var ship = cart.length ? CFG.shipping.fee : 0;
    return { sub: sub, ship: ship, total: sub + ship, count: count };
  }
  function gaItems() { return cart.map(function (i) { return gaItem(fmtById(i.id), i.qty); }); }
  function saveCart() { store.set('tc_cart', cart); renderCart(); updateBadge(); }
  function updateBadge() {
    var c = cartTotals().count;
    $$('[data-cart-count]').forEach(function (b) {
      b.textContent = c; b.classList.toggle('has-items', c > 0);
    });
  }
  function bumpBadge() {
    $$('[data-cart-count]').forEach(function (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); });
  }
  window.tcAddToCart = function (id, src) { addToCart(id, 1, src); };
  function addToCart(id, qty, source, quiet) {
    var f = fmtById(id); if (!f) return;
    qty = qty || 1;
    var ex = cart.filter(function (i) { return i.id === id; })[0];
    if (ex) ex.qty += qty; else cart.push({ id: id, qty: qty });
    saveCart(); bumpBadge();
    track('add_to_cart', { currency: CFG.site.currency, value: +(f.price * qty).toFixed(2), items: [gaItem(f, qty)], source: source || 'product' });
    if (!quiet) openCart();
  }
  function renderCart() {
    var body = $('#cart-body'), foot = $('#cart-foot'); if (!body) return;
    if (!cart.length) {
      body.innerHTML = '<div class="cart-empty"><p>Votre panier est vide pour le moment.</p><button class="btn btn--primary" type="button" data-cart-calc>Ouvrir son carnet</button></div>';
      foot.innerHTML = ''; foot.hidden = true; return;
    }
    foot.hidden = false;
    body.innerHTML = cart.map(function (i) {
      var f = fmtById(i.id);
      return '<div class="cart-item" data-id="' + f.id + '">' +
        '<div class="thumb">' + itemThumb(f) + '</div>' +
        '<div><div class="name">' + esc(itemName(f)) + '</div><div class="variant">' + (f.extra ? '' : 'Sac de ') + esc(f.label) + ' · ' + eur(f.price) + '</div>' +
        '<div class="qty" role="group" aria-label="Quantité"><button type="button" data-qty="-1" aria-label="Retirer un sac">−</button><output aria-live="polite">' + i.qty + '</output><button type="button" data-qty="1" aria-label="Ajouter un sac">+</button></div></div>' +
        '<div><div class="line-price">' + eur(f.price * i.qty) + '</div><button type="button" class="remove-btn" data-remove>Supprimer</button></div></div>';
    }).join('');
    var t = cartTotals();
    foot.innerHTML =
      '<p class="demo-mini">Précommande : aucun paiement n’est demandé aujourd’hui.</p>' +
      '<div class="totals"><div><span>Sous-total</span><span>' + eur(t.sub) + '</span></div>' +
      '<div><span>' + esc(CFG.shipping.label) + '</span><span>' + (t.ship ? eur(t.ship) : 'Offerte') + '</span></div>' +
      '<div class="grand"><span>Total</span><span>' + eur(t.total) + '</span></div></div>' +
      '<button class="btn btn--primary btn--lg btn--block" type="button" data-checkout>Passer la commande</button>' +
      '<button class="btn btn--text" type="button" data-close-cart>Continuer mes achats</button>';
  }
  function setOpen(el, ov, open) {
    if (open) {
      el.hidden = false; ov.hidden = false;
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-open'); ov.classList.add('is-open'); }); });
    } else {
      el.classList.remove('is-open'); ov.classList.remove('is-open');
      setTimeout(function () { if (!el.classList.contains('is-open')) { el.hidden = true; ov.hidden = true; } }, reduceMotion() ? 0 : 380);
    }
  }
  function openCart() {
    var d = $('#cart-drawer'); if (!d) { location.href = BASE + 'index.html?cart=1'; return; }
    lastFocus = document.activeElement;
    renderCart(); setOpen(d, $('#overlay'), true);
    document.documentElement.classList.add('no-scroll');
    setTimeout(function () { var c = $('[data-close-cart]', d); if (c) c.focus(); }, 60);
  }
  function closeCart() {
    var d = $('#cart-drawer'); if (!d || d.hidden) return;
    setOpen(d, $('#overlay'), false);
    document.documentElement.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function initCart() {
    updateBadge();
    $$('[data-open-cart]').forEach(function (b) { b.addEventListener('click', openCart); });
    var d = $('#cart-drawer'); if (!d) return;
    renderCart();
    $('#overlay').addEventListener('click', closeCart);
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-close-cart]')) return closeCart();
      if (t.closest('[data-cart-calc]')) { closeCart(); var c = $('#calculateur'); if (c) c.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' }); return; }
      if (t.closest('[data-checkout]')) return openCheckout();
      var row = t.closest('.cart-item'); if (!row) return;
      var item = cart.filter(function (i) { return i.id === row.getAttribute('data-id'); })[0]; if (!item) return;
      var q = t.closest('[data-qty]');
      if (q) { item.qty += parseInt(q.getAttribute('data-qty'), 10); if (item.qty < 1) cart.splice(cart.indexOf(item), 1); saveCart(); }
      else if (t.closest('[data-remove]')) { cart.splice(cart.indexOf(item), 1); saveCart(); }
    });
    d.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('button,a[href],input,select', d).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    if (new URLSearchParams(location.search).get('cart') === '1') openCart();
  }

  /* ======================================================================
     6. Calculateur de ration
     ====================================================================== */
  var calc = { started: false, step: 1, result: null };
  var ration = store.get('tc_ration', null);
  var selectedFormat = (FORMATS[1] || FORMATS[0]).id;

  function ageParams(age) {
    for (var i = 0; i < R.factorsByAge.length; i++) if (age >= R.factorsByAge[i].from && age <= R.factorsByAge[i].to) return R.factorsByAge[i];
    return R.factorsByAge[R.factorsByAge.length - 1];
  }
  function computeRation(age, w, shape) {
    var rer = R.rer.coef * Math.pow(w, R.rer.exponent);
    var ap = ageParams(age);
    var sm = (R.silhouette[shape] || R.silhouette.ideale).multiplier;
    var kcal = rer * ap.factor * sm;
    var grams = Math.max(10, Math.round(kcal / R.kcalPerKg * 1000 / 5) * 5);
    return { rer: rer, factor: ap.factor, meals: ap.meals, sm: sm, kcal: kcal, grams: grams, perMeal: Math.round(grams / ap.meals) };
  }
  function bagDays(f, grams) { return Math.floor(f.kg * 1000 / grams); }
  function recommendedFormat(grams) {
    var best = null, bd = Infinity;
    FORMATS.forEach(function (f) { var d = Math.abs(bagDays(f, grams) - R.targetBagDays); if (d < bd) { bd = d; best = f; } });
    return best;
  }
  function parseWeight(v) {
    if (v == null) return NaN;
    var s = String(v).replace(',', '.').replace(/[^0-9.]/g, '');
    if (!s || (s.match(/\./g) || []).length > 1) return NaN;
    return parseFloat(s);
  }
  function fmtWeight(w) { return w.toFixed(1).replace('.', ','); }

  function markStarted(trigger) {
    if (calc.started) return;
    calc.started = true;
    track('calculator_started', { trigger: trigger });
  }

  /* Place un élément juste sous la navigation fixe */
  function headerOffset() {
    var h = document.querySelector('.site-header .header-inner') || document.querySelector('.site-header');
    var b = h ? h.getBoundingClientRect().bottom : 0;
    return Math.max(0, b) + 14;
  }
  function scrollUnderHeader(el) {
    if (!el) return;
    function go() { var top = el.getBoundingClientRect().top + window.pageYOffset - Math.max(headerOffset(), 96); window.scrollTo({ top: Math.max(0, top), behavior: 'instant' }); }
    go(); requestAnimationFrame(function () { requestAnimationFrame(go); }); setTimeout(go, 350);
  }
  window.tcShowStep = function (n) { showStep(n, true); };
  function showStep(n, focusHeading) {
    var card = $('#calc'); calc.step = n;
    card.setAttribute('data-step', n);
    $$('.calc-step', card).forEach(function (s) {
      var on = parseInt(s.getAttribute('data-step'), 10) === n;
      s.hidden = !on; s.classList.toggle('is-active', on);
      if (on && !reduceMotion()) { s.classList.remove('anim-in'); void s.offsetWidth; s.classList.add('anim-in'); }
    });
    $('#calc-result').hidden = true;
    $('#calc-form').hidden = false;
    var sec0 = $('#calculateur'); if (sec0) sec0.classList.remove('is-result'); var rc0 = $('#calc-recap'); if (rc0) rc0.hidden = true;
    $$('.calc-progress li', card).forEach(function (li) {
      var k = parseInt(li.getAttribute('data-ind'), 10);
      li.classList.toggle('is-active', k === n); li.classList.toggle('is-done', k < n);
    });
    $('.calc-bar i', card).style.width = (n / 3 * 100) + '%';
    $('.calc-bar', card).setAttribute('aria-valuenow', n);
    if (focusHeading) { var h = $('.calc-step[data-step="' + n + '"] h3', card); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } scrollUnderHeader(card); }
  }

  function updateAgeUI(confirm) {
    var a = $('#age'); if (!a) return;
    if (confirm) { calc.ageSet = true; var am = $('#age-msg'); if (am) am.textContent = ''; a.removeAttribute('aria-invalid'); }
    var p = (a.value - a.min) / (a.max - a.min) * 100;
    a.style.setProperty('--p', p + '%');
    var out = $('#age-out');
    out.classList.toggle('is-unset', !calc.ageSet);
    out.innerHTML = calc.ageSet ? '<b>' + a.value + '</b> mois' : '<span class="age-unset">Glissez pour choisir son âge</span>';
    document.dispatchEvent(new CustomEvent('tc:age', { detail: { age: +a.value } }));
  }

  function validateWeight() {
    var inp = $('#weight'), msg = $('#weight-msg');
    var w = parseWeight(inp.value);
    var bad = null;
    if (!inp.value.trim()) bad = 'Indiquez le poids de votre chiot, par exemple 3,2.';
    else if (isNaN(w)) bad = 'Saisissez un nombre en kilos, avec une virgule ou un point (3,2 ou 3.2).';
    else if (w < R.weightRange.min || w > R.weightRange.max) bad = 'Le poids doit être compris entre ' + fmtWeight(R.weightRange.min) + ' et ' + R.weightRange.max + ' kg.';
    inp.setAttribute('aria-invalid', bad ? 'true' : 'false');
    msg.textContent = bad || '';
    if (bad) { inp.focus(); return null; }
    return w;
  }

  function renderExplainer() {
    var el = $('#calc-explainer'); if (!el) return;
    el.innerHTML =
      '<p>Nous estimons le besoin énergétique quotidien de votre chiot, puis nous le convertissons en grammes de croquettes.</p>' +
      '<p class="formula">besoin (kcal) = ' + R.rer.coef + ' × poids<sup>' + String(R.rer.exponent).replace('.', ',') + '</sup> × facteur de croissance × silhouette<br>ration (g/jour) = besoin ÷ ' + R.kcalPerKg.toLocaleString('fr-FR') + ' kcal/kg × 1000</p>' +
      '<div class="table-scroll"><table class="age-table"><thead><tr><th>Âge</th><th>Facteur de croissance</th><th>Repas par jour</th></tr></thead><tbody>' +
      R.factorsByAge.map(function (a) { return '<tr><td>' + a.from + (a.to !== a.from ? ' à ' + a.to : '') + ' mois</td><td>× ' + String(a.factor).replace('.', ',') + '</td><td>' + a.meals + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<p class="note">Ces facteurs et la densité énergétique sont des valeurs courantes de la littérature vétérinaire. La silhouette ne modifie pas la ration automatiquement : votre vétérinaire l’ajuste si besoin. C’est une estimation : pesez votre chiot chaque semaine et ajustez avec votre vétérinaire.</p>';
    var comp = $('#composition-list');
    if (comp) comp.innerHTML = CFG.composition.items.map(function (i) { return '<div><dt>' + esc(i.label) + '</dt><dd>' + esc(i.value) + '</dd></div>'; }).join('');
  }

  /* Prénom du chiot : facultatif, gardé uniquement sur l'appareil (clé tc_name) */
  function pupName() {
    var i = $('#pup-name'), v = i ? i.value : (store.get('tc_name', '') || '');
    return String(v).replace(/[<>]/g, '').trim().slice(0, 20);
  }
  function paintName() {
    var n = pupName();
    $$('.js-pup').forEach(function (e) { e.textContent = n || 'mon teckel'; });
    $$('.js-pup-de').forEach(function (e) { e.textContent = pupDe(n); });
    $$('.js-pupn').forEach(function (e) { e.textContent = n || ''; });
    $$('.pbag').forEach(function (b) { b.setAttribute('data-long', longCls(n)); if (n) b.setAttribute('data-named', ''); else b.removeAttribute('data-named'); });
    $$('[data-clear-name]').forEach(function (b) { b.hidden = !n; });
  }
  function applyName() {
    var n = pupName(), a = $('#q-age'), w = $('#q-weight');
    if (a) a.textContent = n ? 'Quel âge a ' + n + '\u00a0?' : 'Quel âge a votre chiot teckel\u00a0?';
    if (w) w.textContent = n ? 'Combien pèse ' + n + '\u00a0?' : 'Combien pèse-t-il\u00a0?';
    store.set('tc_name', n);
    paintName();
  }
  function bowlSVG(grams) {
    var f = Math.max(.12, Math.min(1, grams / 260));
    return '<svg class="bowl" viewBox="0 0 120 76" aria-hidden="true" style="--f:0"><defs><clipPath id="bowl-clip"><path d="M10 22h100l-8 34a10 10 0 0 1-10 8H28a10 10 0 0 1-10-8z"/></clipPath></defs>' +
      '<g clip-path="url(#bowl-clip)"><rect class="bowl-fill" x="0" y="0" width="120" height="76" data-f="' + f.toFixed(2) + '"/></g>' +
      '<path d="M10 22h100l-8 34a10 10 0 0 1-10 8H28a10 10 0 0 1-10-8z" fill="none" stroke="#3B2218" stroke-width="4" stroke-linejoin="round"/><path d="M22 70h76" stroke="#3B2218" stroke-width="4" stroke-linecap="round"/></svg>';
  }
  function downloadSheet() {
    var c = calc.result; if (!c) return;
    var n = pupName(), r = c.r, shapeLbl = ({ mince: 'mince', ideale: 'idéale', ronde: 'ronde' })[c.shape] || c.shape;
    var rows = FORMATS.map(function (f) { return '<tr><td>' + esc(f.label) + '</td><td>≈ ' + bagDays(f, r.grams) + ' jours</td></tr>'; }).join('');
    var html = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Fiche de ration' + (n ? ' de ' + esc(n) : '') + ' — TeckCare</title>' +
      '<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#2A1A12;background:#F6EEDC}h1{font-size:2rem;margin:0 0 4px}.big{font-size:4rem;font-weight:800;color:#9A4519;margin:10px 0 0}table{border-collapse:collapse;width:100%;margin:12px 0}td{border-bottom:2px dashed #bba;padding:8px 4px}.warn{background:#FFE08A;padding:12px;border:2px solid #3B2218;border-radius:10px;font-size:.9rem}</style>' +
      '<h1>' + (n ? 'La ration de ' + esc(n) : 'Fiche de ration') + '</h1><p>TeckCare · croquettes pour chiots teckels</p>' +
      '<p>' + c.age + ' mois · ' + fmtWeight(c.weight) + ' kg · silhouette ' + esc(shapeLbl) + '</p>' +
      '<p class="big">' + r.grams + ' g <small style="font-size:1.2rem">/ jour</small></p><p>soit ' + r.meals + ' repas d’environ ' + r.perMeal + ' g.</p>' +
      '<h2>Durée d’un sac</h2><table>' + rows + '</table>' +
      '<p class="warn">Estimation indicative : elle ne remplace pas l’avis de votre vétérinaire. Pesez votre chiot chaque semaine et ajustez.</p>' +
      '<p style="font-size:.85rem;color:#675548">Fiche créée le ' + new Date().toLocaleDateString('fr-FR') + '.</p></html>';
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var a = document.createElement('a'); a.href = url; a.download = 'fiche-ration-teckcare' + (n ? '-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '') + '.html';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    track('cta_click', { cta: 'download_sheet', label: 'Télécharger la fiche' });
  }


  /* Menu croquettes + pâtées selon l'hydratation et le rythme de vie */
  function menuBlock(b, r, nm) {
    var P = CFG.pates || { gourmande: { grams: 80, kcalPer100g: 100 }, nomade: { grams: 100, kcalPer100g: 100 } };
    var eq = function (p) { return Math.round(p.grams * p.kcalPer100g / 100 / R.kcalPerKg * 1000); };
    var who = esc(nm || 'votre chiot');
    var wet = calc.water === 'peu' || b <= 3, move = calc.activity === 'actif' || calc.activity === 'voyage';
    if (!wet && !move) return '<p class="plan-tip">Envie de varier&nbsp;? La <a href="#sc-balade">pâtée nomade</a> se verse sur ses croquettes, et la <a href="#patees">pâtée gourmande</a> l’aide à boire et à manger plus lentement.</p>';
    var kib = r.grams, items = [], why = [];
    if (wet) { kib -= eq(P.gourmande); items.push('<li><img src="' + BASE + 'assets/pack/photo/tray-front.webp" alt=""><b>1 pâtée gourmande</b><span>par jour, au repas du soir</span></li>'); why.push(calc.water === 'peu' ? 'il boit peu&nbsp;: la pâtée l’hydrate' : 'sa silhouette est fine&nbsp;: la pâtée lui donne envie de manger'); }
    if (move) { items.push('<li><img src="' + BASE + 'assets/pack/photo/pouch-front.webp" alt=""><b>1 pâtée nomade</b><span>' + (calc.activity === 'voyage' ? 'les jours de voyage' : 'les jours de grande balade') + '</span></li>'); why.push(calc.activity === 'voyage' ? 'il voyage souvent&nbsp;: la gourde se donne sans gamelle' : 'il se dépense beaucoup&nbsp;: la gourde le réhydrate en balade'); }
    items.unshift('<li><img src="' + BASE + 'assets/pack/photo/kibble-1.webp" alt=""><b>' + Math.max(10, kib) + '&nbsp;g de croquettes</b><span>par jour' + (wet ? ', au lieu de ' + r.grams + '&nbsp;g' : '') + '</span></li>');
    var adj = move ? '<p class="menu-note">Les jours où il reçoit la pâtée nomade, retirez environ ' + eq(P.nomade) + '&nbsp;g de croquettes.</p>' : '';
    return '<div class="plan-menu"><p class="pm-k">Son menu conseillé</p><p class="pm-why">Pour ' + who + '&nbsp;: ' + why.join('&nbsp;; ') + '.</p><ul class="pm-list">' + items.join('') + '</ul>' + adj + '</div>';
  }
  /* Recommandation selon la corpulence estimée : 3 niveaux */
  function planBlock(b, w, rec, r, nm) {
    var who = esc(nm || 'votre chiot'), bag = esc(rec.label);
    var heavy = w > R.weightSoftWarnAbove;
    var tier = (b <= 2 || b >= 7) ? 'veto' : ((b === 3 || b === 6) ? 'ajuste' : 'ideal');
    var fine = b <= 3;
    var vetBtn = '<a class="btn btn--primary" href="#veterinaires" data-plan-vet>Consulter un vétérinaire</a>';
    var bagBtn = function (primary) { return '<button type="button" class="btn ' + (primary ? 'btn--primary' : 'btn--ghost') + '" data-choose-bag>Choisir le sac de ' + bag + '</button>'; };
    var h = '';
    if (tier === 'ideal') {
      h = '<div class="plan plan--ideal"><p class="plan-k"><i>✓</i>Notre conseil</p><h4>' + who + ' est dans le bon repère&nbsp;: on continue.</h4>' +
        '<ul class="plan-list"><li><b>Le sac de ' + bag + '</b> Poulet &amp; Saumon, adapté à sa ration de ' + r.grams + '&nbsp;g par jour.</li>' +
        '<li><b>' + r.meals + ' repas</b> d’environ ' + r.perMeal + '&nbsp;g, croquettes pesées.</li>' +
        '<li><b>Une pesée par semaine</b>, et un check-up croissance chez le vétérinaire vers 6 et 9&nbsp;mois.</li></ul>' +
        menuBlock(b, r, nm) +
        '<p class="plan-gift">🎁 Avec son 1<sup>er</sup> sac TeckCare, <b>une consultation vétérinaire est offerte</b> chez le vétérinaire de votre choix.</p>' +
        '<div class="plan-actions">' + bagBtn(true) + '<a class="btn btn--ghost" href="#veterinaires">Parole de véto</a></div></div>';
    } else if (tier === 'ajuste') {
      h = '<div class="plan plan--ajuste"><p class="plan-k"><i>~</i>Notre conseil</p><h4>Une alimentation suivie de près pour ' + who + '.</h4>' +
        '<p class="plan-intro">Sa silhouette est ' + (fine ? 'un peu fine' : 'un peu ronde') + '&nbsp;: rien d’alarmant, mais elle mérite un suivi.</p>' +
        '<ul class="plan-list"><li><b>Le sac de ' + bag + '</b> Poulet &amp; Saumon, pour garder la même recette sans changement brutal.</li>' +
        (fine ? '<li><b>Ration répartie en ' + r.meals + ' repas</b> et gamelle finie à chaque repas&nbsp;: notez s’il en laisse.</li>'
              : '<li><b>Croquettes pesées, pas de friandises en plus</b>&nbsp;: les extras comptent dans sa ration.</li>') +
        '<li><b>Une nouvelle pesée dans 2 semaines</b>&nbsp;: refaites le parcours pour voir l’évolution.</li>' +
        '<li><b>Un avis vétérinaire</b> pour ajuster sa ration si besoin.</li></ul>' +
        '<form class="vet-find vet-find--plan" data-vet-find novalidate><label for="vf-cp-r">Le vétérinaire le plus proche de chez vous</label><div class="vf-row"><input id="vf-cp-r" type="text" inputmode="numeric" maxlength="5" placeholder="Code postal" autocomplete="postal-code"><a class="btn btn--primary" href="https://www.google.com/maps/search/v%C3%A9t%C3%A9rinaire" target="_blank" rel="noopener" data-vf-go>Trouver un véto</a></div></form>' +
        menuBlock(b, r, nm) +
        '<p class="plan-gift">🎁 Avec son 1<sup>er</sup> sac TeckCare, <b>une consultation vétérinaire est offerte</b> chez le vétérinaire de votre choix.</p>' +
        '<div class="plan-actions">' + bagBtn(true) + '<a class="btn btn--ghost" href="#veterinaires">Demander l’avis d’un véto</a></div></div>';
    } else {
      h = '<div class="plan plan--veto"><p class="plan-k"><i>!</i>Notre conseil</p><h4>D’abord, une consultation vétérinaire pour ' + who + '.</h4>' +
        '<p class="plan-intro">Ses réponses décrivent une silhouette ' + (fine ? 'nettement fine' : 'nettement ronde') + '. Avant de changer quoi que ce soit à son alimentation, un vétérinaire doit confirmer sa corpulence et vous dire quelle quantité lui donner. Nos croquettes ne sont pas un traitement.</p>' +
        '<ul class="plan-list"><li><b>Prenez rendez-vous</b> avec le vétérinaire de votre choix.</li>' +
        '<li><b>Apportez sa fiche de ration</b>&nbsp;: son poids, son âge et ses réponses.</li>' +
        '<li><b>Ensuite seulement</b>, adaptez son sac et sa ration avec lui.</li></ul>' +
        '<form class="vet-find vet-find--plan" data-vet-find novalidate><label for="vf-cp-r">Le vétérinaire le plus proche de chez vous</label><div class="vf-row"><input id="vf-cp-r" type="text" inputmode="numeric" maxlength="5" placeholder="Code postal" autocomplete="postal-code"><a class="btn btn--primary" href="https://www.google.com/maps/search/v%C3%A9t%C3%A9rinaire" target="_blank" rel="noopener" data-vf-go>Trouver un véto</a></div></form>' +
        '<p class="plan-gift">🎁 Avec son 1<sup>er</sup> sac TeckCare, <b>une consultation vétérinaire est offerte</b> chez le vétérinaire de votre choix.</p>' +
        '<div class="plan-actions">' + vetBtn + '<button type="button" class="btn btn--ghost" data-sheet>Télécharger sa fiche</button></div></div>';
    }
    if (heavy) h += '<div class="result-consult"><b>Vérifiez la pesée.</b> Ce poids est inhabituel pour un chiot teckel&nbsp;: si elle est exacte, parlez-en à votre vétérinaire.</div>';
    return h;
  }

  function showResult(age, w, shape) {
    var r = computeRation(age, w, shape);
    var rec = recommendedFormat(r.grams);
    calc.result = { age: age, weight: w, shape: shape, r: r, rec: rec };
    ration = { age: age, weight: w, shape: shape, grams: r.grams, meals: r.meals, perMeal: r.perMeal, rec: rec.id, ts: Date.now() };
    store.set('tc_ration', ration);

    calc.resFmt = rec.id;
    calc.travel = ($('input[name="travel"]:checked') || {}).value || '';
    var nm = pupName(), who = esc(nm || 'mon teckel'), de = pupDe(nm);
    var VAR = { kaninchen: 'kaninchen', nain: 'nain', standard: 'standard' };
    var b = calc.bcs || 5, cat = b <= 3 ? 'mince' : (b >= 6 ? 'ronde' : 'ideale'), ok = cat === 'ideale' && w <= R.weightSoftWarnAbove;
    var consult = planBlock(b, w, rec, r, nm);
    var tier = (b <= 2 || b >= 7) ? 'veto' : ((b === 3 || b === 6) ? 'ajuste' : 'ideal');
    ration.tier = tier; ration.silhouette = cat; ration.heavy = w > R.weightSoftWarnAbove; store.set('tc_ration', ration);
    document.dispatchEvent(new CustomEvent('tc:ration'));

    var fine = b <= 3;
    var silTxt = tier === 'ideal'
      ? 'D’après vos réponses, sa silhouette semble correspondre au repère idéal.'
      : tier === 'ajuste'
        ? 'D’après vos réponses, sa silhouette semble s’écarter un peu du repère idéal&nbsp;: parlez-en à votre vétérinaire lors de sa prochaine visite.'
        : 'D’après vos réponses, sa silhouette semble s’écarter du repère idéal&nbsp;: demandez l’avis de votre vétérinaire avant de changer son alimentation.';
    var advice = '<p class="res-sil res-sil--' + tier + '">' + silTxt + '</p>';
    if (w > R.weightSoftWarnAbove) advice += '<p class="res-sil res-sil--ajuste">Ce poids est inhabituel pour un chiot teckel&nbsp;: vérifiez la pesée.</p>';
    var vetBlock = tier === 'ideal' ? '' :
      '<div class="vet-urg vet-urg--' + (tier === 'veto' ? 3 : 2) + '" role="group" aria-label="Son vétérinaire">' +
      '<p class="vu-q">Son vétérinaire</p>' +
      '<p class="vu-t">' + (tier === 'veto' ? 'Un avis vétérinaire est conseillé avant de modifier son alimentation.' : 'Si sa silhouette ne revient pas vers le repère idéal dans 2&nbsp;semaines, prenez rendez-vous.') + '</p>' +
      '<form class="vet-find vet-find--plan" data-vet-find novalidate><label for="vf-cp-r">Un vétérinaire près de chez vous</label><div class="vf-row"><input id="vf-cp-r" type="text" inputmode="numeric" maxlength="5" placeholder="Code postal" autocomplete="postal-code"><a class="btn btn--primary" href="https://www.google.com/maps/search/v%C3%A9t%C3%A9rinaire" target="_blank" rel="noopener" data-vf-go>Trouver un véto</a></div></form>' +
      '<p class="vu-note">Dos voûté, douleur, difficulté à marcher, vomissements ou diarrhée qui durent&nbsp;: consultez sans attendre.</p>' +
      '</div>';

    calc.mix = null; calc.choice = null; calc.remGrams = null; calc.menuKey = null;
    calc.fx = { seules: { fmt: null }, gourmande: { freq: 'daily', fmt: null, n: 1 }, nomade: { freq: calc.travel === 'souvent' ? 'daily' : 'occ', fmt: null, n: 1 } };
    calc.fxTier = tier;

    var PKc = CFG.pates || {};
    var pateHow = pateOptions(r.grams).map(function (o) {
      return '<li>' + esc(o.x.name) + ' (' + esc(o.x.label) + ')&nbsp;: environ ' + Math.round(o.k.grams * o.k.kcalPer100g / 100) + '&nbsp;kcal, soit l’équivalent de ' + o.eq + '&nbsp;g de croquettes. Les jours où il en mange une, retirez ' + o.eq + '&nbsp;g de croquettes.</li>';
    }).join('');

    /* Repère de silhouette : illustration + libellé simple, sans note chiffrée ni diagnostic */
    var SIL = { mince: { lbl: 'Plutôt mince', pic: 'side-1' }, ideale: { lbl: 'Dans les repères', pic: 'side-2' }, ronde: { lbl: 'Plutôt ronde', pic: 'side-3' } }[cat];
    var silTip = tier === 'ideal'
      ? 'Gardez sa ration et pesez-le chaque semaine&nbsp;: elle évolue avec lui.'
      : tier === 'ajuste'
        ? 'Pesez-le chaque semaine et parlez-en à votre vétérinaire lors de sa prochaine visite.'
        : 'Demandez l’avis de votre vétérinaire avant de changer son alimentation.';
    var silCard = '<section class="sr-sil" data-cat="' + cat + '" aria-labelledby="sr-sil-t">' +
      '<img class="sr-sil-pic" src="' + BASE + 'assets/bcs/' + SIL.pic + '.webp" alt="" width="520" height="260">' +
      '<div><p class="sr-k" id="sr-sil-t">Repère de silhouette <span>indicatif</span></p><p class="sr-sil-l">' + SIL.lbl + '</p>' +
      '<p class="sr-sil-tip">' + silTip + '</p><p class="sr-note">Un repère basé sur vos réponses, pas un diagnostic. Il ne modifie pas la ration estimée.</p></div></section>';

    /* Sac conseillé : format le plus proche de la durée visée, croquettes seules */
    var bagCard = function (f) {
      var d = bagDays(f, r.grams);
      return '<img class="sr-bag-img" src="' + BASE + 'assets/pack/photo/bag' + f.kg + '-front.webp" alt="Sac TeckCare Poulet & Saumon ' + esc(f.label) + '" width="300" height="430">' +
        '<div class="sr-bag-c"><p class="sr-k">' + (f.id === rec.id ? 'Sac conseillé' : 'Autre format') + '</p>' +
        '<p class="sr-bag-n">Croquettes Poulet &amp; Saumon · <b>' + esc(f.label) + '</b></p>' +
        '<p class="sr-bag-p"><b>' + eur(f.price) + '</b> · environ <b>' + d + '&nbsp;jours</b></p>' +
        '<div class="sr-fmt" role="group" aria-label="Format du sac">' + FORMATS.map(function (g) { return '<button type="button" class="sr-fmt-b" data-sr-fmt="' + g.id + '" aria-pressed="' + (g.id === f.id) + '">' + esc(g.label) + (g.id === rec.id ? ' <small>conseillé</small>' : '') + '</button>'; }).join('') + '</div>' +
        '<button type="button" class="btn btn--primary sr-add" data-sr-add="' + f.id + '">Ajouter ce sac au panier</button>' +
        '<p class="res-added" role="status" aria-live="polite"></p></div>';
    };
    calc.srBag = bagCard;

    /* Un seul complément : nomade si sorties ou voyages fréquents, sinon gourmande */
    var popts = pateOptions(r.grams), pk = calc.travel === 'souvent' ? 'pate-nomade-100g' : 'pate-gourmande-80g';
    var po = popts.filter(function (o) { return o.id === pk; })[0];
    var extraCard = !po ? '' :
      '<section class="sr-extra" aria-labelledby="sr-extra-t"><h4 id="sr-extra-t">Pour compléter sa gamelle</h4>' +
      '<div class="sr-extra-b"><img src="' + BASE + po.x.img + '" alt="' + esc(po.x.name + ' ' + po.x.label) + '" width="160" height="200" loading="lazy">' +
      '<div><p class="sr-extra-n">' + esc(po.k.label) + ' ' + esc(po.x.label) + ' <span>' + eur(po.x.price) + '</span></p>' +
      '<p class="sr-extra-w">' + (pk === 'pate-nomade-100g' ? 'Il vous suit souvent en sortie ou en voyage&nbsp;: une gourde prête à servir, facile à emporter.' : 'Une barquette à mélanger à ses croquettes pour varier ses repas.') + '</p>' +
      '<p class="sr-extra-q">Le jour où vous la lui donnez, retirez environ <b>' + po.eq + '&nbsp;g de croquettes</b>, soit ' + po.rest + '&nbsp;g ce jour-là.</p>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-sr-pate="' + po.id + '">Ajouter</button><p class="res-added" role="status" aria-live="polite"></p></div></div></section>';

    var title = nm ? 'La gamelle de <span class="js-pup">' + esc(nm) + '</span>' : 'Sa gamelle';
    var html =
      '<div class="result fx fx-sheet sr">' +
      '<header class="fs-head"><h3 class="result-title">' + title + '</h3>' +
      '<p class="fs-prof">' + age + '&nbsp;mois · ' + fmtWeight(w) + '&nbsp;kg' + (calc.variety && VAR[calc.variety] ? ' · Teckel ' + VAR[calc.variety] : '') + ' · <button type="button" class="btn btn--text fx-edit" data-edit-recap>Modifier</button></p></header>' +
      '<section class="fs-main" aria-label="Sa ration">' +
      '<div class="bowl-stage bowl-stage--img res-bowl fs-bowl" data-grams="' + r.grams + '" aria-hidden="true">' +
      '<img class="bowl-img" src="' + BASE + 'assets/bowl-full.webp" width="560" height="329" alt="">' +
      '<div class="bowl-pile"></div>' +
      '<svg class="bowl-label" viewBox="0 0 560 329" aria-hidden="true"><path id="bowl-arc-res" d="M60 160 Q280 234 500 160" fill="none"/><text text-anchor="middle"><textPath href="#bowl-arc-res" startOffset="50%">' + esc((nm || 'Sa gamelle').toUpperCase()) + '</textPath></text></svg></div>' +
      '<div class="fs-rat"><p class="sr-k">Ration quotidienne estimée</p><p class="fs-big"><b>' + r.grams + '&nbsp;g</b> par jour</p>' +
      '<p class="fs-meals"><b>' + r.meals + ' repas</b> d’environ <b>' + r.perMeal + '&nbsp;g</b></p>' +
      '<p class="fx-sec">Estimation indicative, à ajuster avec <span class="nw"><a href="#veterinaires" class="step-link" data-vet-link>notre vétérinaire partenaire</a>.</span></p></div>' +
      '</section>' +
      '<section class="sr-bag" id="sr-bag" aria-label="Sac conseillé">' + bagCard(rec) + '</section>' +
      silCard +
      extraCard +
      '<details class="result-how fx-acc"><summary>Sa silhouette en détail</summary>' +
      '<p class="fx-sil-t">' + silTxt + '</p>' + advice.replace(/^<p class="res-sil[^>]*>[\s\S]*?<\/p>/, '') + vetBlock + '</details>' +
      '<details class="result-how fx-acc"><summary>Comprendre le calcul</summary>' +
      '<ol class="fx-how">' +
      '<li><span class="fx-how-i" aria-hidden="true">🐾</span><p><b>Son énergie de base</b>À ' + fmtWeight(w) + '&nbsp;kg, il dépense environ ' + Math.round(r.rer) + '&nbsp;kcal par jour au repos.</p></li>' +
      '<li><span class="fx-how-i" aria-hidden="true">🌱</span><p><b>Le bonus croissance</b>À ' + age + '&nbsp;mois, il grandit encore&nbsp;: × ' + String(r.factor).replace('.', ',') + ', soit ' + Math.round(r.kcal) + '&nbsp;kcal par jour.</p></li>' +
      '<li><span class="fx-how-i" aria-hidden="true">🥣</span><p><b>Dans sa gamelle</b>Converti en croquettes, cela fait ' + r.grams + '&nbsp;g par jour, en ' + r.meals + ' repas.</p></li>' +
      '</ol><p class="fx-how-n">Le sac conseillé est le format dont la durée se rapproche le plus de ' + R.targetBagDays + '&nbsp;jours avec cette ration. Le repère de silhouette ne change pas ce calcul.</p></details>' +
      (pateHow ? '<details class="result-how fx-acc"><summary>Les pâtées et sa ration</summary><p class="fx-how-n">Une pâtée remplace une partie des croquettes, à calories égales&nbsp;:</p><ul class="fx-how-l">' + pateHow + '</ul><p class="fx-how-n">Votre rappel de fin de sac reste calculé sur la ration en croquettes seules.</p></details>' : '') +
      '<div class="result-links"><button type="button" class="btn btn--text" data-edit>← Retour</button></div>' +
      '</div>';

    var recap = $('#calc-recap');
    if (recap) {
      recap.innerHTML = '<p class="cr-k">Votre chiot</p><p class="cr-name">' + esc(nm || 'Votre teckel') + '</p>' +
        '<p class="cr-pills"><span class="rp-pill">' + age + '&nbsp;mois</span><span class="rp-pill">' + fmtWeight(w) + '&nbsp;kg</span>' + (calc.variety && VAR[calc.variety] ? '<span class="rp-pill">Teckel ' + VAR[calc.variety] + '</span>' : '') + '</p>' +
        '<button type="button" class="btn btn--text cr-edit" data-edit-recap>Modifier mes réponses</button>';
      recap.hidden = true;
    }
    var sec = $('#calculateur'); if (sec) sec.classList.add('is-result');
    var box = $('#calc-result');
    box.innerHTML = html;
    $('#calc-form').hidden = true;
    box.hidden = false;
    var mo = $('#res-menu-out', box);
    if (mo) {
      calc.water = ''; calc.activity = 'calme';
      var paint = function () { mo.innerHTML = menuBlock(b, r, nm); };
      paint();
      $$('.res-menu input', box).forEach(function (inp) {
        inp.addEventListener('change', function () {
          calc.water = ($('input[name="rm-water"]:checked', box) || {}).value || '';
          calc.activity = ($('input[name="rm-act"]:checked', box) || {}).value || 'calme';
          paint(); track('menu_options', { water: calc.water || 'nsp', activity: calc.activity });
        });
      });
      var dm = $('.res-menu', box); if (dm) dm.addEventListener('toggle', function () { if (dm.open) track('menu_opened', {}); });
    }
    if (!reduceMotion()) { box.classList.remove('anim-in'); void box.offsetWidth; box.classList.add('anim-in'); }

    // progression
    var card = $('#calc'); card.setAttribute('data-step', 3);
    $$('.calc-progress li', card).forEach(function (li) { var k = parseInt(li.getAttribute('data-ind'), 10); li.classList.toggle('is-active', k === 3); li.classList.toggle('is-done', k < 3); });
    $('.calc-bar i', card).style.width = '100%'; $('.calc-bar', card).setAttribute('aria-valuenow', 3);

    // animations d'affichage
    setResFormat(rec.id);
    var h = $('.result-title', box); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    scrollUnderHeader(card);

    // ÉVÉNEMENT : le résultat valide est effectivement affiché à l'écran
    document.dispatchEvent(new CustomEvent('tc:result', { detail: { grams: r.grams, age: age } }));
    track('recommendation_shown', { water: calc.water || 'nsp', activity: calc.activity || 'calme', tier: tier, body_condition_score: b, recommended_format: rec.label });
    track('calculator_completed', { age_months: age, weight_kg: w, silhouette: shape, body_condition_score: calc.bcs || null, ration_g: r.grams, meals_per_day: r.meals, recommended_format: rec.label });

    selectedFormat = calc.resFmt;
    refreshProduct();
    refreshLoyalty();
    var rg = $('#rem-grams'); if (rg) { rg.value = r.grams; renderEstimate(); }
  }

  /* « IMC » du chien : score de condition corporelle estimé (1 à 9, repère WSAVA) */
  var BCS_MAP = { 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8 };
  function bcsScore() {
    var a = ['bcs-ribs', 'bcs-waist', 'bcs-belly'].map(function (n) { var i = $('input[name="' + n + '"]:checked'); return i ? +i.value : 0; });
    if (a.indexOf(0) !== -1) return null;
    var score = BCS_MAP[a[0] + a[1] + a[2]];
    return { score: score, shape: score <= 3 ? 'mince' : (score >= 6 ? 'ronde' : 'ideale'), label: score <= 3 ? 'En dessous de l’idéal' : (score >= 6 ? 'Au-dessus de l’idéal' : 'Idéal') };
  }
  function paintBcsLive() {
    var b = bcsScore(), box = $('.bcs-live'); if (!box) return;
    var answered = $$('.bcs-q input:checked').length;
    box.classList.toggle('is-set', !!b);
    if (b) {
      box.style.setProperty('--s', b.score);
      box.setAttribute('data-cat', b.shape);
      var L = { mince: ['Plutôt mince', 'side-1'], ideale: ['Dans les repères', 'side-2'], ronde: ['Plutôt ronde', 'side-3'] }[b.shape];
      $('#bcs-live-txt').innerHTML = '<img class="bcs-live-pic" src="' + BASE + 'assets/bcs/' + L[1] + '.webp" alt="" width="520" height="260"><span><span class="bcs-live-k">Repère indicatif</span><b>' + L[0] + '</b></span>';
    } else {
      $('#bcs-live-txt').textContent = answered ? 'Encore ' + (3 - answered) + ' question' + (3 - answered > 1 ? 's' : '') + '…' : 'Répondez aux trois questions pour voir son estimation.';
    }
  }
  function bcsBlock(score) {
    var cat = score <= 3 ? 'mince' : (score >= 6 ? 'ronde' : 'ideale');
    var lbl = score <= 2 ? 'En dessous du repère idéal' : score === 3 ? 'Juste en dessous du repère idéal' : score <= 5 ? 'Repère idéal' : score === 6 ? 'Juste au-dessus du repère idéal' : 'Au-dessus du repère idéal';
    var adv = cat === 'ideale' ? 'Côtes senties sans être vues, taille visible : sa silhouette correspond au repère « idéal » (4 à 5 sur 9).'
      : cat === 'mince' ? 'Ses réponses le situent en dessous du repère idéal (4 à 5 sur 9).'
      : 'Ses réponses le situent au-dessus du repère idéal (4 à 5 sur 9).';
    adv += ' Chez un chiot, ce repère s’interprète avec sa croissance : faites-le confirmer par <span class="nw">l’un de nos</span> <a href="#veterinaires" class="step-link" data-vet-link>vétérinaires partenaires</a>.';
    var pic = { mince: 'ribs-1', ideale: 'ribs-2', ronde: 'ribs-3' }[cat];
    return '<div class="result-bcs" data-cat="' + cat + '" style="--s:' + score + '"><img class="rb-pic" src="' + BASE + 'assets/bcs/' + pic + '.webp" alt="" aria-hidden="true"><div class="rb-head"><p class="rb-k">Son indice de silhouette</p><p class="rb-v"><b>' + score + '</b>/9 <span>' + lbl + '</span></p></div>' +
      '<div class="bcs-gauge" aria-hidden="true"><i class="bcs-mark"></i></div><div class="bcs-scale" aria-hidden="true"><span>1</span><span>4–5 · repère idéal</span><span>9</span></div>' +
      '<p class="rb-adv">' + adv + '</p></div>';
  }

  /* Pâtées : équivalence à apport énergétique égal (données config.pates + kcalPerKg) */
  function pateOptions(grams) {
    var PK = CFG.pates || {}, EX = CFG.extras || [];
    return [{ x: EX[1], k: PK.gourmande, unit: 'barquette' }, { x: EX[0], k: PK.nomade, unit: 'gourde' }]
      .filter(function (o) { return o.x && o.k; })
      .map(function (o) {
        var eq = Math.round(o.k.grams * o.k.kcalPer100g / 100 / R.kcalPerKg * 1000);
        o.id = o.x.id; o.eq = eq; o.rest = Math.max(0, grams - eq); return o;
      });
  }
  function mixInfo() {
    if (!calc.mix || !calc.result) return null;
    return pateOptions(calc.result.r.grams).filter(function (o) { return o.id === calc.mix; })[0] || null;
  }
  function setMix(id) {
    var c = calc.result; if (!c) return;
    calc.mix = (id && calc.mix !== id) ? id : null;
    var mx = mixInfo();
    $$('[data-mix]').forEach(function (b) {
      var on = !!mx && b.getAttribute('data-mix') === mx.id;
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '✓ Choisie tous les jours (annuler)' : 'En donner tous les jours';
    });
    var box = $('#res-mix');
    if (box) {
      if (mx) {
        var per = Math.round(mx.rest / c.r.meals);
        box.innerHTML = '<p><b>Alimentation mixte, tous les jours&nbsp;:</b> ' + mx.rest + '&nbsp;g de croquettes (' + c.r.meals + ' repas d’environ ' + per + '&nbsp;g) + 1 ' + esc(mx.x.name.toLowerCase().replace(' poulet & saumon', '')) + ' par jour.</p>' +
          '<button type="button" class="btn btn--text btn--sm" data-mix-off>Revenir aux croquettes seules</button>';
        box.hidden = false;
      } else { box.innerHTML = ''; box.hidden = true; }
    }
    setResFormat(calc.resFmt || c.rec.id);
    track('mix_daily', { item: mx ? mx.id : 'none' });
  }
  /* Formules comparables : croquettes seules / + pâtée gourmande / + pâtée nomade */
  var FX = {
    seules: { name: 'Croquettes seules', use: 'Tous ses repas en croquettes, sans rien changer.', pate: null },
    gourmande: { name: 'Croquettes + pâtée gourmande', use: 'Une barquette à mélanger à ses croquettes, pour varier ses repas à la maison.', pate: 'pate-gourmande-80g' },
    nomade: { name: 'Croquettes + pâtée nomade', use: 'Une gourde prête à servir, facile à emporter en sortie ou en voyage.', pate: 'pate-nomade-100g' }
  };
  function plural(n, w) { return n + ' ' + w + (n > 1 ? 's' : ''); }
  function fxCalc(key) {
    var c = calc.result; if (!c) return null;
    var r = c.r, st = calc.fx[key], d = FX[key], o = null;
    if (d.pate) { o = pateOptions(r.grams).filter(function (p) { return p.id === d.pate; })[0]; if (!o) return null; }
    var daily = !!o && st.freq === 'daily';
    var g = daily ? o.rest : r.grams;
    var f = fmtById(st.fmt) || recommendedFormat(g);
    var n = 0, days;
    if (!o) days = bagDays(f, g);
    else if (daily) { days = bagDays(f, g); n = days; }
    else { n = Math.max(1, st.n || 1); days = Math.floor((f.kg * 1000 + n * o.eq) / r.grams); if (n > days) n = days; }
    return { key: key, d: d, o: o, daily: daily, g: g, f: f, n: n, days: days, total: f.price + (o ? n * o.x.price : 0), avg: Math.round(f.kg * 1000 / days) };
  }
  function fxCard(key) {
    var x = fxCalc(key); if (!x) return '';
    var r = calc.result.r, o = x.o, chosen = calc.choice === key;
    var travel = key === 'nomade' && (calc.travel === 'souvent' || calc.travel === 'parfois');
    var imgs = '<div class="fx-imgs"><img class="fx-img-bag" src="' + BASE + 'assets/pack/photo/bag' + (x.f.kg >= 4 ? 5 : 2) + '-front.webp" alt="Sac de croquettes ' + esc(x.f.label) + '" loading="lazy">' +
      (o ? '<img class="fx-img-pate" src="' + BASE + o.x.img + '" alt="' + esc(o.x.name) + '" loading="lazy">' : '') + '</div>';
    var mode = o ? '<div class="fx-seg fx-freq" role="group" aria-label="Fréquence de la pâtée">' +
      '<button type="button" data-fx-freq="' + key + '" data-v="daily" aria-pressed="' + x.daily + '">Chaque jour</button>' +
      '<button type="button" data-fx-freq="' + key + '" data-v="occ" aria-pressed="' + !x.daily + '">De temps en temps</button></div>'
      : '<p class="fx-freq fx-freq--none">Sans pâtée</p>';
    var qty = !o ? 'Chaque jour&nbsp;: <b>' + r.grams + '&nbsp;g</b> de croquettes.'
      : x.daily ? 'Chaque jour&nbsp;: <b>' + x.g + '&nbsp;g</b> de croquettes + <b>1 ' + o.unit + '</b>.'
      : 'Les jours sans pâtée&nbsp;: <b>' + r.grams + '&nbsp;g</b> de croquettes. Les jours avec pâtée&nbsp;: <b>' + o.rest + '&nbsp;g</b> + <b>1 ' + o.unit + '</b>.';
    var fmts = '<span class="fx-seg fx-fmt" role="group" aria-label="Format du sac">' + FORMATS.map(function (f) {
      return '<button type="button" data-fx-fmt="' + key + '" data-v="' + f.id + '" aria-pressed="' + (f.id === x.f.id) + '">' + esc(f.label) + '</button>'; }).join('') + '</span>';
    var buy = '<ul class="fx-list"><li><span>1 sac de ' + esc(x.f.label) + '</span>' + fmts + '</li>' +
      (o ? '<li><span>' + plural(x.n, o.unit) + ' de ' + esc(o.x.label) + (x.daily ? ', une par jour pendant la durée du sac' : ', pour quelques repas') + '</span>' +
        (x.daily ? '' : '<span class="fx-step" role="group" aria-label="Nombre de ' + o.unit + 's"><button type="button" data-fx-n="' + key + '" data-v="-1" aria-label="Une de moins">−</button><output>' + x.n + '</output><button type="button" data-fx-n="' + key + '" data-v="1" aria-label="Une de plus">+</button></span>') + '</li>'
        : '<li><span>Aucune pâtée</span></li>') + '</ul>';
    var sc = fxScore(x);
    return '<article class="fx-card' + (chosen ? ' is-chosen' : '') + (calc.menuKey === key ? ' is-menu' : '') + '" data-fx="' + key + '">' +
      (calc.fxTier === 'veto' ? imgs : imgs.replace('<div class="fx-imgs">', '<div class="fx-imgs"><span class="fx-score">' + sc.total + '<small>/100</small></span>')) +
      '<h4 class="fx-name">' + x.d.name + (travel ? ' <span class="fx-badge">Pratique pour vos déplacements</span>' : '') + '</h4>' +
      '<p class="fx-use">' + x.d.use + '</p>' + mode +
      '<p class="fx-v">' + qty + '</p>' + buy +
      '<p class="fx-price">Total&nbsp;: <b>' + eur(x.total) + '</b>' + (o ? ' <span class="fx-dt">(sac ' + eur(x.f.price) + ' + ' + x.n + ' × ' + eur(o.x.price) + ')</span>' : '') + '</p>' +
      '<button type="button" class="btn ' + (chosen ? 'btn--ghost' : 'btn--primary') + ' fx-go" data-fx-choose="' + key + '" aria-pressed="' + chosen + '">' + (chosen ? '✓ Option choisie' : 'Choisir cette option') + '</button>' +
      '</article>';
  }
  function fxChoice() {}
  /* Synchronise rappel, format et ration mixte avec l'option affichée */
  function fxSync(x) {
    var o = x.o;
    calc.resFmt = x.f.id; calc.remGrams = o && !x.daily ? (bagDays(x.f, calc.result.r.grams) === x.days ? calc.result.r.grams : x.avg) : x.g;
    calc.mix = o && x.daily ? o.id : null;
    var rf = $('#rem-format'), rg = $('#rem-grams'); if (rf) rf.value = x.f.id; if (rg) rg.value = calc.remGrams; if (rf || rg) renderEstimate();
    selectedFormat = x.f.id; refreshProduct();
  }
  /* Score de compatibilité : points attribués sur des critères explicites, affichés au client */
  function fxScore(x) {
    var tv = calc.travel, crit = [];
    crit.push({ ok: true, pts: 30, max: 30, t: 'Quantités calculées pour son âge et son poids' });
    var dp = Math.max(0, 25 - Math.abs(x.days - R.targetBagDays));
    crit.push({ ok: dp >= 15, pts: dp, max: 25, t: 'Un sac qui dure environ ' + x.days + '&nbsp;jours (idéal&nbsp;: un mois)' });
    var vp = !x.o ? 0 : (x.daily ? 20 : 12);
    crit.push({ ok: vp > 0, pts: vp, max: 20, t: !x.o ? 'Pas de pâtée pour varier ses repas' : x.daily ? 'Des repas variés chaque jour' : 'Des repas variés de temps en temps' });
    var lp = x.key === 'nomade' ? ((tv === 'souvent' || tv === 'parfois') ? 15 : 5) : x.key === 'gourmande' ? ((tv === 'souvent') ? 5 : 15) : 5;
    crit.push({ ok: lp >= 15, pts: lp, max: 15, t: x.key === 'nomade' ? ((tv === 'souvent' || tv === 'parfois') ? 'Pratique pour vos sorties et voyages' : 'Pensée surtout pour les sorties') : x.key === 'gourmande' ? 'Adaptée à ses repas à la maison' : 'Le plus simple au quotidien' });
    var sp = calc.fxTier === 'ideal' ? 10 : 0;
    crit.push({ ok: sp > 0, pts: sp, max: 10, t: sp ? 'Silhouette dans le repère idéal' : 'Silhouette à faire vérifier' });
    var total = crit.reduce(function (a, c) { return a + c.pts; }, 0);
    return { total: total, crit: crit, label: total >= 85 ? 'Match parfait' : total >= 70 ? 'Très bon match' : 'Bon match' };
  }
  function fxShownKey() { return calc.choice || calc.menuKey; }
  function fxMenu() {
    var box = $('#fx-menu'); if (!box) return;
    var key = fxShownKey(), x = key && fxCalc(key); if (!x) { box.hidden = true; return; }
    var sc = fxScore(x), o = x.o, nm = pupName(), chosen = calc.choice === key, veto = calc.fxTier === 'veto';
    var own = calc.choice && calc.choice !== calc.menuKey;
    var fmts = '<span class="fx-seg fx-fmt" role="group" aria-label="Format du sac">' + FORMATS.map(function (f) {
      return '<button type="button" data-fx-fmt="' + key + '" data-v="' + f.id + '" aria-pressed="' + (f.id === x.f.id) + '">' + esc(f.label) + '</button>'; }).join('') + '</span>';
    box.hidden = false;
    box.innerHTML = '<div class="fx-imgs fp-imgs"><img class="fx-img-bag" src="' + BASE + 'assets/pack/photo/bag' + (x.f.kg >= 4 ? 5 : 2) + '-front.webp" alt="Sac de croquettes ' + esc(x.f.label) + '">' + (o ? '<img class="fx-img-pate" src="' + BASE + o.x.img + '" alt="' + esc(o.x.name) + '">' : '') + '</div>' +
      '<div class="fp-info">' +
      '<p class="fp-k">' + (own ? 'Votre option' : '🍽️ ' + (nm ? 'Le menu de ' + esc(nm) : 'Le menu conseillé')) + (veto ? '' : ' <span class="fp-score" title="Score de compatibilité">' + sc.total + '/100 · ' + sc.label + '</span>') + '</p>' +
      '<h4 class="fx-name" id="fx-menu-t">' + x.d.name + '</h4>' +
      (o ? '<div class="fx-seg fx-freq" role="group" aria-label="Fréquence de la pâtée"><button type="button" data-fx-freq="' + key + '" data-v="daily" aria-pressed="' + x.daily + '">Chaque jour</button><button type="button" data-fx-freq="' + key + '" data-v="occ" aria-pressed="' + !x.daily + '">De temps en temps</button></div>' : '') +
      '<p class="fx-v">' + (o && x.daily ? 'Chaque jour&nbsp;: <b>' + x.g + '&nbsp;g</b> de croquettes + <b>1 ' + o.unit + '</b>.' : o ? 'Les jours avec pâtée&nbsp;: <b>' + o.rest + '&nbsp;g</b> de croquettes + <b>1 ' + o.unit + '</b>.' : 'Que des croquettes, sans rien changer.') + '</p>' +
      '<div class="fp-buy"><span>1 sac de ' + esc(x.f.label) + (o ? ' + ' + plural(x.n, o.unit) : '') + '</span>' + fmts +
      (o && !x.daily ? '<span class="fx-step" role="group" aria-label="Nombre de ' + o.unit + 's"><button type="button" data-fx-n="' + key + '" data-v="-1" aria-label="Une de moins">−</button><output>' + x.n + '</output><button type="button" data-fx-n="' + key + '" data-v="1" aria-label="Une de plus">+</button></span>' : '') + '</div>' +
      '<div class="fp-foot"><p class="fp-price"><b>' + eur(x.total) + '</b></p>' +
      (chosen ? '<button type="button" class="btn btn--primary fx-go" data-fx-add>Ajouter au panier</button>' : '<button type="button" class="btn btn--primary fx-go" data-fx-choose="' + key + '">Choisir cette option</button>') + '</div>' +
      '<p class="res-added" role="status" aria-live="polite"></p>' +
      '</div>';
    var rem = $('#fx-rem');
    if (rem) rem.innerHTML = '<span class="fs-cal" aria-hidden="true">📅</span><p>' + (calc.choice ? 'Avec cette option' : 'Avec ce menu') + ', son sac dure environ <b>' + x.days + '&nbsp;jours</b>' + (o && !x.daily ? ' (dont ' + plural(x.n, 'jour') + ' avec pâtée)' : '') + '.</p><button type="button" class="btn btn--ghost" data-open-reminder>Créer mon rappel</button>';
    var how = $('#fx-score-how');
    if (how) how.innerHTML = veto ? '' : '<p class="fx-how-n">Le score ' + sc.total + '/100 de cette option additionne ces critères&nbsp;: c’est un repère ludique, pas un avis vétérinaire.</p><ul class="fm-crit">' + sc.crit.map(function (c) { return '<li class="' + (c.ok ? 'is-ok' : '') + '"><span aria-hidden="true">' + (c.ok ? '✓' : '○') + '</span>' + c.t + '<em>+' + c.pts + '</em></li>'; }).join('') + '</ul>';
    fxSync(x);
  }
  function fxRender(focusSel) {
    var host = $('#fx-cards'); if (!host) return;
    var keys = calc.fxTier === 'veto' ? ['seules'] : ['seules', 'gourmande', 'nomade'];
    if (!calc.menuKey) {
      var best = null; keys.forEach(function (k) { var x = fxCalc(k); if (!x) return; var t = fxScore(x).total; if (!best || t > best.t) best = { k: k, t: t }; });
      calc.menuKey = best ? best.k : null;
    }
    fxMenu();
    var more = $('#fx-more'); if (more) more.hidden = keys.length < 2;
    host.className = 'fx-cards fx-cards--' + keys.length;
    host.innerHTML = keys.map(fxCard).join('');
    if (focusSel) { var el = $(focusSel); if (el) try { el.focus({ preventScroll: true }); } catch (e) {} }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-fx-freq],[data-fx-fmt],[data-fx-n],[data-fx-choose],[data-fx-add]'); if (!t || !calc.fx) return;
    var k, v, pre = t.closest('#fx-cards') ? '#fx-cards ' : '#fx-menu ';
    if ((k = t.getAttribute('data-fx-freq'))) { calc.fx[k].freq = t.getAttribute('data-v'); calc.fx[k].fmt = null; fxRender(pre + '[data-fx-freq="' + k + '"][data-v="' + t.getAttribute('data-v') + '"]'); track('formula_frequency', { formula: k, freq: calc.fx[k].freq }); return; }
    if ((k = t.getAttribute('data-fx-fmt'))) { calc.fx[k].fmt = t.getAttribute('data-v'); fxRender(pre + '[data-fx-fmt="' + k + '"][data-v="' + t.getAttribute('data-v') + '"]'); return; }
    if ((k = t.getAttribute('data-fx-n'))) { var st = calc.fx[k]; st.n = Math.max(1, Math.min(60, (st.n || 1) + (+t.getAttribute('data-v')))); fxRender(pre + '[data-fx-n="' + k + '"][data-v="' + t.getAttribute('data-v') + '"]'); return; }
    if ((k = t.getAttribute('data-fx-choose'))) {
      var fromCard = !!t.closest('#fx-cards');
      calc.choice = k; fxRender('#fx-menu [data-fx-add]');
      track('formula_chosen', { formula: k, freq: (calc.fx[k] || {}).freq || 'none', travel: calc.travel || 'nsp' });
      if (fromCard) { var mb = $('#fx-menu'); if (mb) scrollUnderHeader(mb); }
      return;
    }
    if (t.hasAttribute('data-fx-add') && calc.choice) {
      var x = fxCalc(calc.choice);
      addToCart(x.f.id, 1, 'result_formula', true);
      if (x.o && x.n) addToCart(x.o.id, x.n, 'result_formula', true);
      var p = $('#fx-menu .res-added'); if (p) p.innerHTML = '✓ Ajouté au panier&nbsp;: 1 sac de ' + esc(x.f.label) + (x.o ? ' et ' + plural(x.n, x.o.unit) : '') + '. <button type="button" class="btn btn--text btn--sm" data-res-cart>Voir le panier</button>';
    }
  });

  /* Bouton « Créer mon rappel » du bandeau sous « Nos produits » */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#rappel [data-open-reminder]'); if (!b) return;
    openReminder(); b.hidden = true;
  });

  function resAdded(btn, html) {
    var host = btn.closest('.res-pate, .rbz-info'); var p = host && $('.res-added', host); if (!p) return;
    p.innerHTML = html + ' <button type="button" class="btn btn--text btn--sm" data-res-cart>Voir le panier</button>';
  }

  /* Format choisi dans le résultat : durée, prix par jour, sac, rappel et fiche produit suivent */
  function setResFormat(id) {
    var c = calc.result, f = fmtById(id); if (!c || !f) return;
    calc.resFmt = id;
    var mx = mixInfo(), g = mx ? mx.rest : c.r.grams;
    var d = bagDays(f, g);
    $$('[data-res-fmt]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-res-fmt') === id)); });
    var out = $('#res-dur'); if (out) out.innerHTML = '<p class="rd-price"><b>' + eur(f.price) + '</b> le sac de ' + esc(f.label) + '</p>' +
      (mx
        ? '<p class="rd-line">Avec ' + g + '&nbsp;g de croquettes par jour&nbsp;: environ <strong>' + d + '&nbsp;jours</strong></p><p class="rd-line rd-sub">' + eur(f.price / d) + ' par jour en croquettes · <b>' + eur(f.price / d + mx.x.price) + ' par jour avec la pâtée</b> (1 ' + mx.unit + ' à ' + eur(mx.x.price) + ')</p>'
        : '<p class="rd-line">Environ <strong>' + d + '&nbsp;jours</strong> · ' + eur(f.price / d) + ' par jour (croquettes seules)</p>');
    var why = $('#res-why'); if (why) why.innerHTML = id === c.rec.id ? 'Conseillé&nbsp;: avec sa ration, c’est le format dont la durée se rapproche le plus de ' + R.targetBagDays + '&nbsp;jours.' : 'Le format conseillé est le sac de ' + esc(c.rec.label) + '&nbsp;: sa durée se rapproche le plus de ' + R.targetBagDays + '&nbsp;jours avec sa ration.';
    var rb = $('#result-bag'); if (rb) rb.innerHTML = bagSVG(f.kg);
    if (calc.resFmtShown && calc.resFmtShown !== id) { var ra0 = $('.rbz-info .res-added'); if (ra0) ra0.innerHTML = ''; }
    calc.resFmtShown = id;
    var rf = $('#rem-format'); if (rf) { rf.value = id; }
    var rgm = $('#rem-grams'); if (rgm) rgm.value = g;
    if (rf || rgm) renderEstimate();
    selectedFormat = id; refreshProduct();
  }
  function openReminder() {
    var p = $('#reminder-panel'); if (!p) return;
    refreshLoyalty();
    if (calc.result) {
      $('#rem-format').value = calc.resFmt || calc.result.rec.id;
      var mx0 = mixInfo(); $('#rem-grams').value = calc.remGrams || (mx0 ? mx0.rest : calc.result.r.grams);
      if (!$('#rem-start').value) $('#rem-start').value = toISODate(new Date());
      renderEstimate();
    }
    p.hidden = false;
    p.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    var t = $('#rem-title'); if (t) setTimeout(function () { t.focus({ preventScroll: true }); }, reduceMotion() ? 0 : 400);
  }

  /* Exemples de rations : calculés à la volée avec la même formule */
  function renderExamples() {
    var g = $('#examples-grid'); if (!g) return;
    g.innerHTML = (CFG.examples || []).map(function (e, i) {
      var r = computeRation(e.age, e.weight, e.shape), rec = recommendedFormat(r.grams), d = bagDays(rec, r.grams);
      return '<article class="ex-card" data-reveal><p class="ex-title">' + esc(e.title) + '</p>' +
        '<p class="ex-prof">' + e.age + ' mois · ' + fmtWeight(e.weight) + ' kg</p>' +
        '<p class="ex-grams"><b>' + r.grams + '</b> g <span>par jour</span></p>' +
        '<p class="ex-meals">' + r.meals + ' repas d’environ ' + r.perMeal + ' g</p>' +
        '<p class="ex-bag">Sac de ' + esc(rec.label) + ' : environ ' + d + ' jours, soit ' + eur(rec.price / d) + ' / jour</p>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-ex="' + i + '">Calculer pour mon chiot</button></article>';
    }).join('');
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ex]'); if (!b) return;
      var e = CFG.examples[+b.getAttribute('data-ex')];
      track('cta_click', { cta: 'example_profile', label: e.title });
      markStarted('cta_example');
      $('#age').value = e.age; updateAgeUI(); $('#weight').value = fmtWeight(e.weight);
      showStep(2, false);
      $('#calc').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    });
  }

  function initCalculator() {
    var card = $('#calc'); if (!card) return;
    var age = $('#age'), form = $('#calc-form'), wInp = $('#weight');
    renderExplainer(); renderExamples();
    var nm = $('#pup-name'); if (nm) { nm.value = store.get('tc_name', '') || ''; applyName(); nm.addEventListener('input', applyName); }

    if (ration) {            // pré-remplissage discret (visite de retour)
      age.value = ration.age; wInp.value = fmtWeight(ration.weight);
      var r = $('input[name="shape"][value="' + ration.shape + '"]'); if (r) r.checked = true;
    }
    if (ration && ration.age) calc.ageSet = true;
    updateAgeUI();
    age.addEventListener('input', function () { updateAgeUI(true); });

    // Démarrage mesuré : première interaction réelle ou clic sur un bouton d'appel
    ['pointerdown', 'keydown', 'focusin'].forEach(function (ev) {
      card.addEventListener(ev, function () { markStarted('interaction'); }, { once: false });
    });
    $$('.js-calc-cta').forEach(function (a) {
      a.addEventListener('click', function () {
        var which = a.getAttribute('data-cta') || (a.classList.contains('header-cta') ? 'header' : 'link');
        track('cta_click', { cta: which, label: a.textContent.trim() });
        markStarted('cta_' + which);
        var m = $('#mobile-menu'); if (m) closeMenu();
      });
    });

    card.addEventListener('click', function (e) {
      var t = e.target;
      var ab = t.closest('[data-age]');
      if (ab) { var v = Math.min(R.ageRange.max, Math.max(R.ageRange.min, parseInt(age.value, 10) + parseInt(ab.getAttribute('data-age'), 10))); age.value = v; updateAgeUI(true); return; }
      if (t.closest('[data-next]')) { showStep(2, true); return; }
      if (t.closest('[data-prev]')) { showStep(Math.max(1, calc.step - 1), true); return; }
      var wb = t.closest('[data-weight]');
      if (wb) {
        var cur = parseWeight(wInp.value), step = parseFloat(wb.getAttribute('data-weight'));
        if (isNaN(cur)) cur = 3.0 - step;
        cur = Math.min(R.weightRange.max, Math.max(R.weightRange.min, Math.round((cur + step) * 10) / 10));
        wInp.value = fmtWeight(cur); wInp.setAttribute('aria-invalid', 'false'); $('#weight-msg').textContent = '';
        return;
      }
      if (t.closest('[data-edit]')) { showStep(1, true); return; }
      if (t.closest('[data-sheet]')) { downloadSheet(); return; }
      var rf = t.closest('[data-res-fmt]');
      if (rf) { setResFormat(rf.getAttribute('data-res-fmt')); return; }
      if (t.closest('[data-open-reminder]')) { openReminder(); return; }
      var ra = t.closest('[data-res-add]');
      if (ra) {
        var rid = ra.getAttribute('data-res-add');
        if (rid === 'bag') {
          var fb = fmtById(calc.resFmt || (calc.result ? calc.result.rec.id : selectedFormat));
          addToCart(fb.id, 1, 'result_bag', true); selectedFormat = fb.id; refreshProduct();
          resAdded(ra, '✓ Sac de ' + esc(fb.label) + ' ajouté au panier.');
        } else {
          var fp = fmtById(rid); addToCart(rid, 1, 'result_pate', true);
          resAdded(ra, '✓ ' + esc(fp.name) + ' ajoutée au panier.');
        }
        return;
      }
      if (t.closest('[data-res-cart]')) { openCart(); return; }
      var srf = t.closest('[data-sr-fmt]');
      if (srf && calc.srBag) { var fid = srf.getAttribute('data-sr-fmt'), bx = $('#sr-bag'); if (bx) bx.innerHTML = calc.srBag(fmtById(fid)); setResFormat(fid); track('formula_chosen', { format: fid, from: 'result' }); var nb = bx && bx.querySelector('[data-sr-fmt="' + fid + '"]'); if (nb) nb.focus(); return; }
      var sra = t.closest('[data-sr-add]');
      if (sra) { var af = fmtById(sra.getAttribute('data-sr-add')); addToCart(af.id, 1, 'result_bag', true); var m1 = sra.parentNode.querySelector('.res-added'); if (m1) m1.innerHTML = '✓ Sac de ' + esc(af.label) + ' ajouté au panier. <button type="button" class="btn btn--text btn--sm" data-res-cart>Voir le panier</button>'; return; }
      var srp = t.closest('[data-sr-pate]');
      if (srp) { var pf = fmtById(srp.getAttribute('data-sr-pate')); addToCart(pf.id, 1, 'result_complement', true); var m2 = srp.parentNode.querySelector('.res-added'); if (m2) m2.innerHTML = '✓ ' + esc(pf.name) + ' ajoutée au panier. <button type="button" class="btn btn--text btn--sm" data-res-cart>Voir le panier</button>'; return; }
      var mxb = t.closest('[data-mix]'); if (mxb) { setMix(mxb.getAttribute('data-mix')); return; }
      if (t.closest('[data-mix-off]')) { setMix(null); return; }
      var ch = t.closest('[data-choose-bag]');
      if (ch) {
        selectedFormat = calc.resFmt || (calc.result ? calc.result.rec.id : selectedFormat); refreshProduct();
        track('cta_click', { cta: 'choose_bag', label: 'Choisir ce sac' });
        var pr = $('#croquettes'); if (pr) pr.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
        return;
      }
      if (t.closest('[data-clear-name]')) { var nmi = $('#pup-name'); nmi.value = ''; nmi.dispatchEvent(new Event('input', { bubbles: true })); nmi.focus(); return; }
    });
    wInp.addEventListener('input', function () { wInp.setAttribute('aria-invalid', 'false'); $('#weight-msg').textContent = ''; });
    form.addEventListener('change', function (e) { if (e.target && /^bcs-/.test(e.target.name)) { $('#bcs-msg').textContent = ''; paintBcsLive(); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (calc.step === 1 && !calc.ageSet) {
        var am = $('#age-msg'); if (am) am.textContent = 'Choisissez son âge avec le curseur ou les boutons − et +.';
        age.setAttribute('aria-invalid', 'true'); age.focus(); return;
      }
      var w = validateWeight(); if (w == null) { showStep(1, false); $('#weight').focus(); return; }
      if (calc.step === 1) { calc.variety = ($('input[name="variety"]:checked') || {}).value || ''; calc.water = ($('input[name="water"]:checked') || {}).value || ''; calc.activity = ($('input[name="activity"]:checked') || {}).value || 'calme'; showStep(2, true); return; }
      var b = bcsScore();
      if (!b) { $('#bcs-msg').textContent = 'Répondez aux trois questions pour estimer sa silhouette.'; return; }
      $('#bcs-msg').textContent = '';
      calc.bcs = b.score;
      track('body_condition_estimated', { body_condition_score: b.score, category: b.shape, variety: calc.variety || 'non_renseignee' });
      showResult(parseInt(age.value, 10), w, 'ideale');
    });
    $$('[data-open-details]').forEach(function (a) {
      a.addEventListener('click', function () { var d = document.getElementById(a.getAttribute('data-open-details')); if (d) d.open = true; });
    });
  }

  /* ======================================================================
     7. Produit
     ====================================================================== */
  function refreshProduct() {
    var grid = $('#format-grid'); if (!grid) return;
    var recId = ration ? ration.rec : null;
    grid.innerHTML = FORMATS.map(function (f) {
      var nd = ration ? bagDays(f, ration.grams) : 0, d = ration ? '≈ ' + nd + ' jours · ' + eur(f.price / nd) + ' / jour' : '';
      return '<label class="format-card">' + (f.id === recId ? '<span class="f-rec">Recommandé</span>' : '') +
        '<input type="radio" name="format" value="' + f.id + '"' + (f.id === selectedFormat ? ' checked' : '') + '>' +
        '<span class="f-label">' + esc(f.label) + '</span><span class="f-price">' + eur(f.price) + '</span>' +
        '<span class="f-kg">' + eur(f.price / f.kg) + ' / kg</span>' + (d ? '<span class="f-days">' + d + '</span>' : '') + '</label>';
    }).join('');
    renderSelectedFormat();
  }
  var STAGE_SCALE = { '2': .9, '5': 1 };
  function renderSelectedFormat() {
    var f = fmtById(selectedFormat) || FORMATS[0];
    $('#price').textContent = eur(f.price);
    $('#per-kg').textContent = 'soit ' + eur(f.price / f.kg) + ' / kg';
    var stage = $('#stage-bag');
    if (stage) { stage.style.setProperty('--s', STAGE_SCALE[String(f.kg)] || 1); stage.classList.remove('is-back'); var fb = $('#flip-bag'); if (fb) { fb.setAttribute('aria-pressed', 'false'); fb.textContent = 'Voir le dos du sac'; }
    stage.innerHTML = bagSVG(f.kg); }
    var gi = $('#gm-croq-img'); if (gi) { var n = f.kg >= 4 ? 5 : 2; gi.src = BASE + 'assets/pack/photo/bag' + n + '-front.webp'; gi.alt = 'Sac de croquettes TeckCare Poulet & Saumon, ' + f.label; gi.width = n === 5 ? 588 : 520; gi.height = n === 5 ? 846 : 794; }
    var dur = $('#duration');
    if (!dur) {} else if (ration) dur.textContent = 'Avec la ration estimée de ' + ration.grams + ' g par jour : ce sac dure environ ' + bagDays(f, ration.grams) + ' jours.';
    else dur.innerHTML = 'Pas encore de ration ? <a href="#calculateur">Calculez-la</a> pour connaître la durée de ce sac.';
    var badge = $('#rec-badge'); if (badge) badge.hidden = !(ration && ration.rec === f.id);
  }
  function initProduct() {
    var grid = $('#format-grid'); if (!grid) return;
    if (ration && fmtById(ration.rec)) selectedFormat = ration.rec;
    refreshProduct();
    grid.addEventListener('change', function (e) { if (e.target.name === 'format') { selectedFormat = e.target.value; renderSelectedFormat(); } });
    $('#add-to-cart').addEventListener('click', function () { addToCart(selectedFormat, 1, 'product_section'); });
    var stage = $('#product-stage'), bag = $('#stage-bag');
    if (stage && bag && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      stage.addEventListener('pointermove', function (e) {
        if (reduceMotion()) return;
        var b = stage.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
        bag.style.setProperty('--ry', (x * 16) + 'deg'); bag.style.setProperty('--rx', (-y * 12) + 'deg');
      });
      stage.addEventListener('pointerleave', function () { bag.style.setProperty('--ry', '0deg'); bag.style.setProperty('--rx', '0deg'); });
    }
  }

  /* ======================================================================
     8. Checkout de démonstration
     ====================================================================== */
  function openCheckout() {
    var dlg = $('#checkout'); if (!dlg) return;
    if (!cart.length) { toast('Votre panier est vide.'); return; }
    closeCart();
    var t = cartTotals();
    $('#order-lines').innerHTML = cart.map(function (i) {
      var f = fmtById(i.id);
      return '<div class="order-line"><div class="thumb">' + itemThumb(f) + '</div><div><strong>' + esc(itemName(f)) + '</strong><br><small>' + (f.extra ? '' : 'Sac de ') + esc(f.label) + ' × ' + i.qty + '</small></div><strong>' + eur(f.price * i.qty) + '</strong></div>';
    }).join('');
    $('#order-totals').innerHTML = '<div><dt>Sous-total</dt><dd>' + eur(t.sub) + '</dd></div><div><dt>' + esc(CFG.shipping.label) + '</dt><dd>' + (t.ship ? eur(t.ship) : 'Offerte') + '</dd></div><div class="grand"><dt>Total</dt><dd>' + eur(t.total) + '</dd></div>';
    var grid = $('#source-grid');
    if (!grid.children.length) grid.innerHTML = CFG.acquisitionSources.map(function (s) { return '<label class="pill"><input type="radio" name="source" value="' + s.id + '"><span>' + esc(s.label) + '</span></label>'; }).join('');
    $('#checkout-form-view').hidden = false; $('#checkout-done-view').hidden = true;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    // ÉVÉNEMENT : ouverture du checkout
    track('checkout_started', { currency: CFG.site.currency, value: +t.total.toFixed(2), items: gaItems(), demo_mode: true });
  }
  function closeCheckout() { var dlg = $('#checkout'); if (dlg && dlg.open) dlg.close(); }

  function initCheckout() {
    var dlg = $('#checkout'); if (!dlg) return;
    $$('[data-close-checkout]').forEach(function (b) { b.addEventListener('click', closeCheckout); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeCheckout(); });
    $('#checkout-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = cartTotals(), src = ($('input[name="source"]:checked', dlg) || {}).value || '';
      var name = $('#co-name').value.trim();
      var order = {
        id: 'TC-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
        ts: Date.now(), total: t.total,
        items: cart.map(function (i) { var f = fmtById(i.id); return { id: i.id, qty: i.qty, label: f.label, kg: f.kg, price: f.price }; }),
        source: src, demo: true
      };
      store.set('tc_last_order', order);
      document.dispatchEvent(new CustomEvent('tc:order'));
      if (src) track('acquisition_source_declared', { source: src });
      track('demo_order_completed', { transaction_id: order.id, currency: CFG.site.currency, value: +t.total.toFixed(2), items: gaItems(), source: src || 'non_renseigne', demo_mode: true });
      var wantsReminder = $('#co-reminder').checked;
      cart = []; saveCart();
      var first = order.items[0], days = ration ? bagDays(fmtById(first.id), ration.grams) * first.qty : null;
      var done = $('#checkout-done-view');
      done.innerHTML =
        '<div class="done"><div class="tick"><svg width="44" height="44" aria-hidden="true"><use href="#i-check"/></svg></div>' +
        '<h2>Merci' + (name ? ' ' + esc(name) : '') + ' !</h2>' +
        '<p>Votre précommande est notée.<br>Aucun paiement n’a été demandé aujourd’hui.</p>' +
        '<p class="order-no">' + order.id + '</p>' +
        (days ? '<p>Avec la ration estimée (' + ration.grams + ' g par jour), votre sac devrait durer environ <strong>' + days + ' jours</strong>.</p>' : '') +
        '<div class="done-ref"><p><b>Parrainez un ami teckel&nbsp;!</b> Son premier sac est à −20&nbsp;% avec votre code, et au 3<sup>e</sup> filleul votre prochain sac de 2&nbsp;kg est offert.</p><p class="done-code"><code>' + esc(((name || 'TECKEL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 10) || 'TECKEL') + '20') + '</code><button type="button" class="btn btn--ghost btn--sm" data-copy-code>Copier</button></p></div>' +
        '<div><button type="button" class="btn btn--primary btn--lg" data-go-reminder>Préparer mon rappel de fin de sac</button> <button type="button" class="btn btn--ghost btn--lg" data-close-checkout>Fermer</button></div></div>';
      $('#checkout-form-view').hidden = true; done.hidden = false;
      $$('[data-close-checkout]', done).forEach(function (b) { b.addEventListener('click', closeCheckout); });
      $('[data-go-reminder]', done).addEventListener('click', function () { closeCheckout(); goReminder(); });
      refreshLoyalty();
      if (wantsReminder) { closeCheckout(); setTimeout(goReminder, 150); }
    });
  }

  /* ======================================================================
     9. Rappel de fin de sac + réachat
     ====================================================================== */
  function lastOrder() { return store.get('tc_last_order', null); }
  function goReminder() {
    refreshLoyalty();
    openReminder();
  }
  function toISODate(d) { var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function computeReminder() {
    var f = fmtById($('#rem-format').value), g = parseInt($('#rem-grams').value, 10), s = $('#rem-start').value;
    if (!f || !g || g < 10 || !s) return null;
    var start = new Date(s + 'T09:00:00'), days = bagDays(f, g);
    var end = new Date(start); end.setDate(end.getDate() + days);
    var rem = new Date(end); rem.setDate(rem.getDate() - CFG.reminder.daysBefore);
    if (rem < start) rem = new Date(start);
    return { f: f, g: g, days: days, start: start, end: end, rem: rem };
  }
  function ymd(x) { var p = function (n) { return String(n).padStart(2, '0'); }; return x.getFullYear() + p(x.getMonth() + 1) + p(x.getDate()); }
  function shopLink() { return location.origin && location.origin !== 'null' ? location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html#croquettes' : ''; }
  function gcalUrl(c) {
    var next = new Date(c.rem); next.setDate(next.getDate() + 1);
    var det = 'Votre sac TeckCare de ' + c.f.label + ' devrait se terminer vers le ' + dateFr(c.end) + ' (ration : ' + c.g + ' g/jour). Pensez à recommander pour éviter un changement d’aliment brutal.' + (shopLink() ? ' ' + shopLink() : '');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Racheter les croquettes TeckCare (sac de ' + c.f.label + ')') + '&dates=' + ymd(c.rem) + '/' + ymd(next) + '&details=' + encodeURIComponent(det);
  }
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function renderCal(c) {
    var g = $('#cal-grid'), m = $('#cal-month'); if (!g) return;
    var start = c ? c.start : new Date(), end = c ? c.end : null, rem = c ? c.rem : null;
    var first, last;
    if (end) {
      first = new Date(end); first.setDate(first.getDate() - 27);
      if (start > first && (end - start) / 864e5 <= 34) first = new Date(start);
      first.setDate(first.getDate() - (first.getDay() + 6) % 7);
      last = new Date(end); last.setDate(last.getDate() + (7 - last.getDay()) % 7);
    } else {
      first = new Date(start.getFullYear(), start.getMonth(), 1); first.setDate(first.getDate() - (first.getDay() + 6) % 7);
      last = new Date(start.getFullYear(), start.getMonth() + 1, 0); last.setDate(last.getDate() + (7 - last.getDay()) % 7);
    }
    var f7 = new Date(first); f7.setDate(f7.getDate() + 6);
    m.textContent = MOIS[f7.getMonth()] + (last.getMonth() !== f7.getMonth() ? ' – ' + MOIS[last.getMonth()] : '') + ' ' + last.getFullYear();
    var sub = $('#cal-sub'); if (sub) sub.textContent = end ? (start < first ? 'Sac ouvert le ' + dateFr(start) + ' · ' : '') + c.days + ' jours' : 'Votre sac en un coup d’œil';
    var same = function (a, b) { return a && b && a.toDateString() === b.toDateString(); };
    var h = '', d = new Date(first);
    while (d <= last) {
      var cls = 'cd';
      if (end && d > start && d < end) cls += ' cd--in';
      if (same(d, start)) cls += ' cd--open';
      if (same(d, rem)) cls += ' cd--rem';
      if (same(d, end)) cls += ' cd--end';
      if (d.getDate() === 1) cls += ' cd--m1';
      if (end && d < start) cls += ' cd--before';
      h += '<span class="' + cls + '">' + d.getDate() + (same(d, rem) ? '<i>J-' + CFG.reminder.daysBefore + '</i>' : '') + '</span>';
      d.setDate(d.getDate() + 1);
    }
    g.innerHTML = h;
  }
  function renderEstimate() {
    var c = computeReminder(), out = $('#rem-estimate'), gl = $('#rem-gcal'), hint = $('#rem-hint');
    renderCal(c);
    if (hint) hint.hidden = !!($('#rem-grams').value);
    if (!c) { out.textContent = 'Renseignez la ration pour estimer la fin du sac.'; if (gl) { gl.setAttribute('aria-disabled', 'true'); gl.href = '#rappel'; } return; }
    out.innerHTML = 'Ce sac devrait durer environ <strong>' + c.days + ' jours</strong>, jusqu’au ' + dateFr(c.end) + '. Rappel prévu le <strong>' + dateFr(c.rem) + '</strong>.';
    if (gl) { gl.removeAttribute('aria-disabled'); gl.href = gcalUrl(c); }
  }
  function downloadICS(c) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    var d = function (x) { return x.getFullYear() + p(x.getMonth() + 1) + p(x.getDate()); };
    var next = new Date(c.rem); next.setDate(next.getDate() + 1);
    var now = new Date(), stamp = now.getUTCFullYear() + p(now.getUTCMonth() + 1) + p(now.getUTCDate()) + 'T' + p(now.getUTCHours()) + p(now.getUTCMinutes()) + p(now.getUTCSeconds()) + 'Z';
    var link = shopLink();
    var ics = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TeckCare//Rappel fin de sac//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + Date.now() + '-' + Math.random().toString(36).slice(2) + '@teckcare', 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + d(c.rem), 'DTEND;VALUE=DATE:' + d(next),
      'SUMMARY:' + ics('Racheter les croquettes TeckCare (sac de ' + c.f.label + ')'),
      'DESCRIPTION:' + ics('Votre sac TeckCare de ' + c.f.label + ' devrait se terminer vers le ' + dateFr(c.end) + ' (ration : ' + c.g + ' g/jour). ' + (link ? 'Recommander : ' + link : '')),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Racheter les croquettes TeckCare', 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rappel-teckcare.ics';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function setMsg(text, ok) { var m = $('#rem-msg'); m.textContent = text; m.className = 'form-msg ' + (ok ? 'is-ok' : 'is-err'); }

  function refreshLoyalty() {
    var sel = $('#rem-format'); if (!sel) return;
    var prev = sel.value, lo = lastOrder();
    if (!sel.options.length) sel.innerHTML = FORMATS.map(function (f) { return '<option value="' + f.id + '">' + esc(f.label) + ' — ' + eur(f.price) + '</option>'; }).join('');
    var wanted = (lo && lo.items[0] && lo.items[0].id) || (ration && ration.rec) || prev || selectedFormat;
    if (fmtById(wanted)) sel.value = wanted;
    if (!$('#rem-start').value) $('#rem-start').value = toISODate(new Date());
    if (!$('#rem-grams').value && ration) $('#rem-grams').value = ration.grams;
    renderEstimate();

    // carte « Recommander le même sac » (facultative)
    if (!$('#reorder-bag')) return;
    var rid = (lo && lo.items[0] && lo.items[0].id) || (ration && ration.rec) || selectedFormat, f = fmtById(rid) || FORMATS[0];
    $('#reorder-bag').innerHTML = bagSVG(f.kg);
    $('#reorder-name').textContent = CFG.product.name + ' — ' + f.label;
    $('#reorder-sub').textContent = lo ? 'Votre dernière commande, le ' + dateFr(new Date(lo.ts)) + '. Un clic suffit.' : 'Après votre première commande, votre dernier sac apparaîtra ici.';
    $('#reorder-badge').textContent = lo ? 'Bon retour !' : 'Réachat express';
    $('#reorder-btn').setAttribute('data-id', f.id);
  }

  function initLoyalty() {
    var form = $('#reminder-form'); if (!form) return;
    refreshLoyalty();
    ['#rem-format', '#rem-start', '#rem-grams'].forEach(function (s) { $(s).addEventListener('input', renderEstimate); $(s).addEventListener('change', renderEstimate); });

    var gl = $('#rem-gcal'); if (gl) gl.addEventListener('click', function (e) {
      var c = computeReminder();
      if (!c) { e.preventDefault(); setMsg('Indiquez la ration par jour (en grammes) et la date d’ouverture du sac.', false); $('#rem-grams').focus(); $('#rem-grams').setAttribute('aria-invalid', 'true'); return; }
      track('reminder_requested', { method: 'google_calendar', days_before: CFG.reminder.daysBefore, bag: c.f.label });
      setMsg('Google Agenda s’ouvre dans un nouvel onglet : enregistrez l’événement du ' + dateFr(c.rem) + '.', true);
    });
    document.addEventListener('tc:result', function (e) {
      if (e.detail && e.detail.grams) { $('#rem-grams').value = Math.round(e.detail.grams); if (calc.resFmt || (calc.result && calc.result.rec)) $('#rem-format').value = calc.resFmt || calc.result.rec.id; renderEstimate(); }
    });
    $('#rem-ics').addEventListener('click', function () {
      var c = computeReminder();
      if (!c) { setMsg('Indiquez la ration par jour (en grammes) et la date d’ouverture du sac.', false); $('#rem-grams').focus(); $('#rem-grams').setAttribute('aria-invalid', 'true'); return; }
      $('#rem-grams').setAttribute('aria-invalid', 'false');
      downloadICS(c);
      track('reminder_requested', { method: 'calendar', days_before: CFG.reminder.daysBefore, bag: c.f.label });
      setMsg('Rappel téléchargé : ouvrez le fichier pour l’ajouter à votre calendrier (le ' + dateFr(c.rem) + ').', true);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = computeReminder(), email = $('#rem-email').value.trim();
      if (!c) { setMsg('Indiquez d’abord la ration par jour et la date d’ouverture du sac.', false); $('#rem-grams').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setMsg('Saisissez une adresse e-mail valide pour être prévenu par e-mail.', false); $('#rem-email').setAttribute('aria-invalid', 'true'); $('#rem-email').focus(); return; }
      $('#rem-email').setAttribute('aria-invalid', 'false');
      if (!$('#rem-consent').checked) { setMsg('Cochez la case de consentement pour recevoir l’e-mail de rappel.', false); $('#rem-consent').focus(); return; }
      var rec = { email: email, format: c.f.id, daily_g: c.g, end_date: toISODate(c.end), reminder_date: toISODate(c.rem), consent: true, consent_ts: new Date().toISOString() };
      var list = store.get('tc_reminders', []); list.push(rec); store.set('tc_reminders', list);
      track('reminder_requested', { method: 'email', days_before: CFG.reminder.daysBefore, bag: c.f.label, consent: true });   // l'adresse n'est jamais envoyée à GA4
      if (CFG.reminder.endpoint) {
        safe(function () { fetch(CFG.reminder.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) }); });
        setMsg('Demande envoyée : vous serez prévenu(e) vers le ' + dateFr(c.rem) + '. Désinscription possible à tout moment.', true);
      } else {
        setMsg('Demande enregistrée. Pour ne rien oublier, ajoutez aussi le rappel à votre agenda.', true);
      }
    });

    var rob = $('#reorder-btn'); if (rob) rob.addEventListener('click', function () {
      var id = this.getAttribute('data-id'), f = fmtById(id), lo = lastOrder();
      // ÉVÉNEMENT : nouvelle commande demandée depuis le parcours de retour
      track('reorder_clicked', { item_id: f.id, item_variant: f.label, has_previous_order: !!lo, value: f.price, currency: CFG.site.currency, source: 'reorder_card' });
      addToCart(id, 1, 'reorder');
    });

    if (new URLSearchParams(location.search).get('reorder') === '1') {
      setTimeout(function () {
        goReminder();
        var rc = $('#reorder-card'); if (rc) { rc.classList.add('is-highlight'); setTimeout(function () { rc.classList.remove('is-highlight'); }, 3600); }
        else { var cs = $('#croquettes'); if (cs) cs.scrollIntoView(); }
      }, 400);
    }
  }

  /* ======================================================================
     10. Interface : header, menu mobile, reveal, photos
     ====================================================================== */
  function closeMenu() {
    var m = $('#mobile-menu'), b = $('.menu-btn'); if (!m || !b) return;
    m.hidden = true; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Ouvrir le menu');
  }
  function initHeader() {
    var h = $('.site-header'); if (!h) return;
    var onScroll = function () { h.classList.toggle('is-stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    var b = $('.menu-btn'), m = $('#mobile-menu');
    if (b && m) {
      b.addEventListener('click', function () {
        var open = m.hidden; m.hidden = !open;
        b.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      });
      m.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
      window.matchMedia('(min-width:980px)').addEventListener('change', function (e) { if (e.matches) closeMenu(); });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeMenu(); closeCart();
    });
    $$('[data-contact-email]').forEach(function (a) { a.textContent = CFG.site.contactEmail; a.setAttribute('href', 'mailto:' + CFG.site.contactEmail); });
  }
  function initReveal() {
    var els = $$('[data-reveal]'); if (!els.length) return;
    if (!('IntersectionObserver' in window) || reduceMotion()) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(function () { els.forEach(function (e) { e.classList.add('is-in'); }); }, 6000);   // filet de sécurité
  }
  function initPhotos() {
    $$('.photo[data-photo]').forEach(function (box) {
      var src = BASE + box.getAttribute('data-photo');
      var img = new Image();
      img.onload = function () { img.alt = box.getAttribute('data-alt') || ''; img.loading = 'lazy'; box.appendChild(img); box.classList.add('has-img'); };
      img.src = src;
      if (debugOn()) box.insertAdjacentHTML('beforeend', '<span class="photo-label">Emplacement photo : ' + esc(box.getAttribute('data-photo')) + '</span>');
    });
  }

  /* ======================================================================
     Démarrage
     ====================================================================== */
  function init() {
    initExperiment();
    initConsent();
    initDebug();
    injectBags();
    initHeader();
    initCart();
    initCalculator();
    initProduct();
    initCheckout();
    initLoyalty();
    initReveal();
    initPhotos();
    decorateLinks();
    if (EXP && EXP._present && !sess.get('tc_exp_logged', false)) {
      sess.set('tc_exp_logged', true);
      track('experiment_exposure', { description: CFG.experiments.definitions[EXP.experiment_id].description });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


/* ---------- Parrainage : code à partir du prénom, partage / copie ---------- */
(function () {
  var codeEl = document.getElementById('ref-code'); if (!codeEl) return;
  var msg = document.getElementById('ref-msg');
  function code() {
    var i = document.getElementById('pup-name') || document.getElementById('hero-name');
    var n = (i && i.value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 10);
    return (n || 'TECKEL') + '20';
  }
  function paint() { codeEl.textContent = code(); }
  paint();
  ['pup-name', 'hero-name'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', paint); });
  function say(t) { if (msg) msg.textContent = t; }
  function track(a) { try { if (window.tcTrack) window.tcTrack('referral_' + a, { code: code() }); } catch (e) {} }
  function copy() {
    var t = code();
    try { navigator.clipboard.writeText(t).then(function () { say('Code ' + t + ' copié !'); }, function () { say('Votre code : ' + t); }); }
    catch (e) { say('Votre code : ' + t); }
    track('copy');
  }
  document.getElementById('ref-copy').addEventListener('click', copy);
  document.getElementById('ref-share').addEventListener('click', function () {
    var t = 'Mon teckel mange TeckCare : -20 % sur ton premier sac avec le code ' + code() + ' 🐾';
    track('share');
    var done = false;
    try { if (navigator.share) { navigator.share({ title: 'TeckCare', text: t, url: location.href.split('#')[0] }).then(function () { done = true; }, function () { if (!done) copy(); }); return; } } catch (e) {}
    copy();
  });
})();


/* Trouver un vétérinaire proche (lien vers une vraie recherche de carte) */
(function () {
  function upd(form) {
    var cp = (form.querySelector('input').value || '').replace(/\D/g, '').slice(0, 5), a = form.querySelector('[data-vf-go]');
    a.href = 'https://www.google.com/maps/search/' + encodeURIComponent('vétérinaire ' + (cp || 'près de moi'));
  }
  document.addEventListener('input', function (e) { var f = e.target.closest && e.target.closest('[data-vet-find]'); if (f) upd(f); });
  document.addEventListener('submit', function (e) { var f = e.target.closest && e.target.closest('[data-vet-find]'); if (f) { e.preventDefault(); upd(f); f.querySelector('[data-vf-go]').click(); } });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-vf-go]'); if (!a) return;
    upd(a.closest('[data-vet-find]'));
    if (window.tcVetSearch) { e.preventDefault(); window.tcVetSearch((a.closest('[data-vet-find]').querySelector('input').value || '').trim()); }
    try { if (window.tcTrack) window.tcTrack('vet_finder_click', { from: a.closest('.vet-find--plan') ? 'result' : 'network' }); } catch (x) {}
  });
})();

/* Bouton « Voir nos produits » de l'en-tête : mesure du clic */
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('[data-buy-cta]'); if (!a) return;
  try { if (window.tcTrack) window.tcTrack('cta_click', { cta: 'header_buy', label: 'Voir nos produits' }); } catch (x) {}
});

/* Club TeckCare : inscription à la lettre (enregistrée localement tant qu'aucun service d'envoi n'est branché) */
(function () {
  var form = document.getElementById('club-form'); if (!form) return;
  var msg = document.getElementById('club-msg'), dog = document.getElementById('club-dog');
  var cpRow = document.getElementById('club-cp-row'), cp = document.getElementById('club-cp'), ageP = document.getElementById('club-age');
  function track(n, p) { try { if (window.tcTrack) window.tcTrack(n, p || {}); } catch (x) {} }
  function getJ(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (x) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* Âge actuel estimé à partir du calculateur : âge saisi + mois écoulés depuis */
  function ageNow() {
    var r = getJ('tc_ration'); if (!r || !r.age) return null;
    var m = r.age + (r.ts ? Math.floor((Date.now() - r.ts) / (30.44 * 864e5)) : 0);
    return m;
  }
  function known() {
    var i = document.getElementById('pup-name'), n = (i && i.value) || getJ('tc_name') || '';
    return { name: String(n || '').trim(), age: ageNow() };
  }
  function prefill() {
    var k = known();
    if (k.name && !dog.value) dog.value = k.name;
    var who = document.getElementById('club-letter-who'); if (who) who.textContent = k.name || 'Votre chiot';
    if (k.age) { ageP.hidden = false; ageP.innerHTML = '🎂 Sa lettre sera adaptée à son âge&nbsp;: <b>' + (k.age >= 24 ? Math.floor(k.age / 12) + '&nbsp;ans' : k.age + '&nbsp;mois') + '</b> (d’après le calculateur).'; }
    else ageP.hidden = true;
  }
  prefill();
  document.addEventListener('tc:ration', prefill);
  var club = document.getElementById('club');
  if (club && 'MutationObserver' in window) new MutationObserver(function () { if (!club.hidden) prefill(); }).observe(club, { attributes: true, attributeFilter: ['hidden'] });

  function syncCp() { var on = form.querySelector('input[value="rencontres"]').checked; cpRow.hidden = !on; }
  form.addEventListener('change', function (e) { if (e.target.name === 'club-int') syncCp(); });
  syncCp();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.querySelector('#club-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Indiquez une adresse e-mail valide.'; form.querySelector('#club-email').focus(); return; }
    var ints = [].slice.call(form.querySelectorAll('input[name="club-int"]:checked')).map(function (i) { return i.value; });
    if (!ints.length) { msg.textContent = 'Choisissez au moins un centre d’intérêt.'; return; }
    var c = (cp.value || '').trim();
    if (ints.indexOf('rencontres') > -1 && !/^\d{5}$/.test(c)) { msg.textContent = 'Indiquez votre code postal à 5 chiffres pour recevoir les rencontres près de chez vous.'; cp.focus(); return; }
    if (!form.querySelector('#club-consent').checked) { msg.textContent = 'Cochez la case pour accepter de recevoir la lettre du club.'; return; }
    var k = known(), rec = { email: email, dog: (dog.value || '').trim(), cp: ints.indexOf('rencontres') > -1 ? c : '', interests: ints, age: k.age || null, ts: new Date().toISOString() };
    try { localStorage.setItem('tc_club', JSON.stringify(rec)); } catch (x) {}
    track('newsletter_signup', { interests: ints.join(','), has_dog_name: !!rec.dog, age_known: !!rec.age });
    track('club_signup_complete', { interests: ints.join(','), age_known: !!rec.age });
    var nm = rec.dog ? esc(rec.dog) + ' et vous' : 'vous deux';
    form.innerHTML = '<div class="club-done" tabindex="-1"><p class="club-done-i" aria-hidden="true">🐾</p><h3>Bienvenue au club, ' + nm + '&nbsp;!</h3>' +
      '<p>Votre première lettre arrive à <b>' + esc(email) + '</b>.</p>' +
      '<ul class="club-prefs"><li>Centres d’intérêt&nbsp;: ' + ints.map(function (i) { return i === 'conseils' ? 'les conseils' : 'les rencontres'; }).join(' et ') + '</li>' +
      (rec.cp ? '<li>Rencontres autour de ' + esc(rec.cp) + '</li>' : '') +
      (rec.age ? '<li>Lettre adaptée à ses ' + rec.age + '&nbsp;mois</li>' : '') + '</ul>' +
      (rec.age ? '' : '<div class="club-bd"><label for="club-bd">Son mois de naissance <small>(pour une lettre adaptée à son âge)</small></label><span><input type="month" id="club-bd" max="' + new Date().toISOString().slice(0, 7) + '"><button type="button" class="btn btn--ghost btn--sm" data-club-bd>Enregistrer</button></span><p class="club-help" id="club-bd-msg" role="status"></p></div>') +
      '<div class="club-next"><a class="btn btn--primary btn--sm" href="#conseils" data-club-link="conseils">Lire nos articles</a>' +
      (rec.interests.indexOf('rencontres') > -1 ? '<a class="btn btn--ghost btn--sm" href="#club" data-club-link="rencontres" data-club-walk>Voir comment se passent les balades</a>' : '<a class="btn btn--ghost btn--sm" href="#sante" data-club-link="veto">Trouver un vétérinaire</a>') + '</div></div>';
    var d = form.querySelector('.club-done'); if (d) d.focus();
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-club-link]');
    if (a) {
      var done = !!a.closest('.club-done');
      track(a.getAttribute('data-club-link') === 'rencontres' ? 'club_events_click' : 'club_content_click', { target: a.getAttribute('data-club-link'), from: done ? 'confirmation' : 'apercu', href: a.getAttribute('href') });
      if (a.hasAttribute('data-club-walk')) { e.preventDefault(); var w = document.querySelector('.club-walk'); if (w) { w.scrollIntoView({ block: 'center', behavior: 'smooth' }); w.classList.add('is-hi'); setTimeout(function () { w.classList.remove('is-hi'); }, 1600); } }
    }
    if (e.target.closest && e.target.closest('[data-club-bd]')) {
      var v = (document.getElementById('club-bd') || {}).value, out = document.getElementById('club-bd-msg');
      if (!v) { out.textContent = 'Choisissez un mois.'; return; }
      var p = v.split('-'), now = new Date(), m = (now.getFullYear() - +p[0]) * 12 + now.getMonth() + 1 - +p[1];
      if (m < 0 || m > 240) { out.textContent = 'Vérifiez la date.'; return; }
      var rec = getJ('tc_club') || {}; rec.birth = v; rec.age = m; try { localStorage.setItem('tc_club', JSON.stringify(rec)); } catch (x) {}
      out.textContent = 'C’est noté : sa lettre suivra ses ' + m + ' mois.';
      track('club_birthdate_added', { age_months: m });
    }
  });
})();


/* Code parrain proposé après la commande */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-copy-code]'); if (!b) return;
  var c = b.parentNode.querySelector('code'), t = c ? c.textContent : '';
  try { navigator.clipboard.writeText(t).then(function () { b.textContent = 'Copié !'; }, function () { b.textContent = t; }); } catch (x) { b.textContent = t; }
  try { if (window.tcTrack) window.tcTrack('referral_copy', { code: t, from: 'order_done' }); } catch (x) {}
});

/* Formulaire de rappel toujours visible : date d'ouverture du sac préremplie */
(function () {
  var d = document.getElementById('rem-start');
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
})();

/* Une page à la fois : chaque section est une page, l'accueil est affiché seul.
   Les liens #ancre et les scrollIntoView changent de page ; les onglets sont gérés ici aussi. */
(function () {
  var root = document.documentElement;
  var views = [].slice.call(document.querySelectorAll('main > section'));
  var home = views[0];
  var homeExtra = document.getElementById('pourquoi'); /* « Votre parcours » s'affiche à la suite de l'accueil */
  var prodPage = document.getElementById('croquettes'), prodExtras = [document.getElementById('rappel'), document.getElementById('atouts')]; /* rappel et pâtées suivent « Nos produits » */
  var vetPage = document.getElementById('sante'), vetExtra = document.getElementById('conseils'); /* les conseils suivent « Mon véto » */
  function pageOf(sec) { return sec === homeExtra ? home : (prodExtras.indexOf(sec) > -1 ? prodPage : (sec === vetExtra ? vetPage : sec)); }
  function isExtra(sec) { return sec === homeExtra || sec === vetExtra || prodExtras.indexOf(sec) > -1; }
  var nativeScroll = Element.prototype.scrollIntoView;

  function tabsOf(g) { return [].slice.call(g.querySelectorAll('[role="tab"]')); }
  function activate(tab, focus) {
    var g = tab.closest('[data-tabs]');
    tabsOf(g).forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = document.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on;
    });
    if (focus) tab.focus();
    var l = tab.parentNode; if (l.scrollWidth > l.clientWidth) l.scrollLeft = tab.offsetLeft - (l.clientWidth - tab.offsetWidth) / 2;
  }
  /* Ouvre l'onglet qui contient l'élément */
  function reveal(el) {
    var p = el.closest('[role="tabpanel"]'); if (!p || !p.hidden) return;
    var t = document.getElementById('tab-' + p.id); if (t) activate(t);
  }
  function toTop() { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
  function show(sec) {
    sec = pageOf(sec);
    views.forEach(function (v) { v.hidden = !(v === sec || (sec === home && v === homeExtra) || (sec === prodPage && prodExtras.indexOf(v) > -1) || (sec === vetPage && v === vetExtra)); });
    root.classList.toggle('is-home', sec === home);
    window.dispatchEvent(new Event('scroll'));
  }
  function urlFor(sec, id) { return (pageOf(sec) === home && (!id || id === home.id)) ? location.pathname + location.search : '#' + id; }

  /* Va à une ancre ; false si elle ne correspond à aucune page */
  function go(id, push) {
    var el = id ? document.getElementById(id) : home;
    var sec = el && el.closest('main > section');
    if (!sec) return false;
    var changed = sec.hidden;
    reveal(el);
    show(sec);
    if (push) history.pushState(null, '', urlFor(sec, id));
    if (el === sec && !isExtra(sec)) toTop();
    else nativeScroll.call(el, { block: 'start', behavior: changed ? 'instant' : 'smooth' });
    return true;
  }

  /* Le code existant demande souvent de « défiler jusqu'à » une section : on change de page d'abord */
  Element.prototype.scrollIntoView = function (o) {
    var sec = this.closest && this.closest('main > section');
    if (!sec) return nativeScroll.call(this, o);
    var changed = sec.hidden;
    reveal(this);
    if (changed) { show(sec); history.pushState(null, '', urlFor(sec, sec.id)); }
    if (this === sec && !isExtra(sec)) return toTop();
    nativeScroll.call(this, changed ? { block: (o && o.block) || 'start', behavior: 'instant' } : o);
  };

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var t = e.target.closest('[data-tabs] [role="tab"]');
    if (t) { activate(t); return; }
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.target) return;
    var id = a.getAttribute('href').slice(1);
    if (id && go(id, true)) e.preventDefault();
  }, true);
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('[data-tabs] [role="tab"]'); if (!t) return;
    var all = tabsOf(t.closest('[data-tabs]')), i = all.indexOf(t), n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % all.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + all.length) % all.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = all.length - 1;
    if (n < 0) return;
    e.preventDefault(); activate(all[n], true);
  });

  function fromUrl() { if (!go(location.hash.slice(1), false)) go('', false); }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('popstate', fromUrl);
  fromUrl();
  root.classList.add('views-ready');
})();

/* « Comment ça marche » : le lien rappel ouvre le formulaire, le bouton ouvre le questionnaire */
document.addEventListener('click', function (e) {
  var r = e.target.closest && e.target.closest('[data-open-rem]');
  if (r) {
    var p = document.getElementById('reminder-panel'), b = document.querySelector('#rappel [data-open-reminder]');
    if (p && p.hidden) { if (b) b.click(); else p.hidden = false; }
    return;
  }
  var q = e.target.closest && e.target.closest('[data-open-quiz]');
  if (q) {
    setTimeout(function () { var f = document.getElementById('pup-name') || document.getElementById('weight'); if (f) try { f.focus({ preventScroll: true }); } catch (x) {} }, 600);
    try { if (window.tcTrack) window.tcTrack('cta_click', { cta: 'steps_create_bag' }); } catch (x) {}
  }
});

/* « Votre parcours » : la fiche de l'étape 1 affiche le prénom saisi, sinon « Noisette » */
(function () {
  function paint() {
    var i = document.getElementById('pup-name') || document.getElementById('hero-name');
    var n = ((i && i.value) || '').replace(/[<>]/g, '').trim().slice(0, 20);
    if (!n) { var h = document.getElementById('hero-name'); n = ((h && h.value) || '').trim().slice(0, 20); }
    document.querySelectorAll('.js-step-name').forEach(function (e) { e.textContent = n || 'Noisette'; });
  }
  ['pup-name', 'hero-name'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', paint); });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-clear-name]')) setTimeout(paint, 0); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
  window.addEventListener('hashchange', paint);
})();

/* Étape 2 : achat rapide depuis la vignette produit */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-quick-add]'); if (!b) return;
  e.preventDefault();
  if (window.tcAddToCart) window.tcAddToCart(b.getAttribute('data-quick-add'), 'steps_quick_add');
});


/* Lien « l’un de nos vétérinaires partenaires » du résultat : ouvre l'encart de recherche et place le curseur dans le code postal */
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('[data-vet-link]'); if (!a) return;
  setTimeout(function () { var i = document.getElementById('vf-cp'); if (i) try { i.focus({ preventScroll: true }); } catch (x) {} }, 500);
  try { if (window.tcTrack) window.tcTrack('vet_link_click', { from: 'result' }); } catch (x) {}
});


/* Barre de progression : cliquer sur une étape déjà faite pour y revenir (réponses conservées) */
(function () {
  var card = document.getElementById('calc'); if (!card) return;
  function sync() {
    var cur = parseInt(card.getAttribute('data-step'), 10) || 1;
    [].forEach.call(card.querySelectorAll('.calc-progress li'), function (li) {
      var k = parseInt(li.getAttribute('data-ind'), 10), can = k < cur && k < 3;
      li.classList.toggle('is-clickable', can);
      if (can) { li.setAttribute('role', 'button'); li.setAttribute('tabindex', '0'); li.setAttribute('aria-label', 'Revenir à l’étape ' + k + ' : ' + li.textContent.replace(/^\s*\d+\s*/, '').trim()); }
      else { li.removeAttribute('role'); li.removeAttribute('tabindex'); li.removeAttribute('aria-label'); }
    });
  }
  function go(li) {
    if (!li || !li.classList.contains('is-clickable') || !window.tcShowStep) return;
    window.tcShowStep(parseInt(li.getAttribute('data-ind'), 10));
    try { if (window.tcTrack) window.tcTrack('calc_step_back', { to: li.getAttribute('data-ind') }); } catch (x) {}
  }
  card.addEventListener('click', function (e) { go(e.target.closest('.calc-progress li')); });
  card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { var li = e.target.closest('.calc-progress li'); if (li && li.classList.contains('is-clickable')) { e.preventDefault(); go(li); } } });
  new MutationObserver(sync).observe(card, { attributes: true, attributeFilter: ['data-step'] });
  sync();
})();

/* Récapitulatif du chiot (colonne de gauche au résultat) : retour à l'étape 1 */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-edit-recap]'); if (!b) return;
  if (window.tcShowStep) window.tcShowStep(1);
});

/* « Détails du produit » : fiche propre à chaque produit, en fenêtre */
document.addEventListener('click', function (e) {
  var o = e.target.closest && e.target.closest('[data-pdetail]');
  if (o) { var d = document.getElementById(o.getAttribute('data-pdetail')); if (d && d.showModal) { d.showModal(); try { if (window.tcTrack) window.tcTrack('product_details_open', { product: o.getAttribute('data-pdetail') }); } catch (x) {} } return; }
  var c = e.target.closest && e.target.closest('[data-pdclose]'); if (c) { c.closest('dialog').close(); return; }
  var l = e.target.closest && e.target.closest('.pdlg a[href]'); if (l) { var dl = l.closest('dialog'); if (dl && dl.open) dl.close(); }
  if (e.target.classList && e.target.classList.contains('pdlg')) e.target.close();
});
