/* ==========================================================================
   TeckCare — Mon véto : annuaire de vétérinaires partenaires et réservation
   PROJET ÉTUDIANT : cliniques, vétérinaires, tarifs et réservations FICTIFS.
   Aucune réservation ni aucun message n'est transmis : tout reste dans ce navigateur.
   Établissements : OpenStreetMap via l'API Overpass (amenity=veterinary), chargés par zone recherchée,
   mis en cache 7 jours. Noms d'établissements et de vétérinaires remplacés par des identités fictives
   stables ; téléphones, sites et liens réels jamais affichés. Couverture non exhaustive.
   Si l'API est inaccessible (aperçu Claude), un extrait d'exemple TeckCare clairement signalé est utilisé.
   Carte : Leaflet (fichiers locaux) + fond CARTO/OpenStreetMap, sinon carte simplifiée intégrée.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('veterinaires'); if (!root) return;

  /* ---------- Horaires types (minutes depuis minuit, par jour 1 = lundi … 6 = samedi) ---------- */
  var WEEK = function (open, close, satOpen, satClose) { var h = {}; for (var d = 1; d <= 5; d++) h[d] = [[open, close]]; if (satOpen != null) h[6] = [[satOpen, satClose]]; return h; };
  var H_A = { h: WEEK(540, 1140, 540, 780), txt: 'Lun–ven 9h–19h · sam 9h–13h' };
  var H_B = { h: WEEK(510, 1170, 540, 1020), txt: 'Lun–ven 8h30–19h30 · sam 9h–17h' };
  var H_C = { h: WEEK(540, 1080), txt: 'Lun–ven 9h–18h' };
  var PRICE = { premiere: 45, vaccins: 62, bilan: 48 };

  /* ---------- Extrait d'exemple (hors OpenStreetMap) : utilisé seulement si l'API Overpass est inaccessible ---------- */
  var SAMPLE = [
    { id: 'par-11', name: 'Clinique vétérinaire Oberkampf', vet: 'Dr Camille Lefort', address: '48 rue Oberkampf', city: 'Paris', cp: '75011', lat: 48.8652, lng: 2.3776, phone: '01 99 00 00 11', hours: H_B, prices: { premiere: 48, vaccins: 65, bilan: 52 } },
    { id: 'par-15', name: 'Cabinet vétérinaire du Commerce', vet: 'Dr Hugo Marchal', address: '31 rue du Commerce', city: 'Paris', cp: '75015', lat: 48.8462, lng: 2.2955, phone: '01 99 00 00 15', hours: H_A },
    { id: 'par-18', name: 'Clinique vétérinaire Caulaincourt', vet: 'Dr Inès Bréval', address: '62 rue Caulaincourt', city: 'Paris', cp: '75018', lat: 48.8893, lng: 2.3374, phone: '01 99 00 00 18', hours: H_A },
    { id: 'lyo-03', name: 'Clinique vétérinaire Lafayette', vet: 'Dr Léa Fontanel', address: '120 cours Lafayette', city: 'Lyon', cp: '69003', lat: 45.7632, lng: 4.8560, phone: '04 99 00 00 03', hours: H_B },
    { id: 'lyo-06', name: 'Cabinet vétérinaire Vitton', vet: 'Dr Nathan Corvel', address: '45 cours Vitton', city: 'Lyon', cp: '69006', lat: 45.7697, lng: 4.8560, phone: '04 99 00 00 06', hours: H_C },
    { id: 'mar-06', name: 'Clinique vétérinaire Paradis', vet: 'Dr Sarah Delmonte', address: '210 rue Paradis', city: 'Marseille', cp: '13006', lat: 43.2858, lng: 5.3795, phone: '04 99 00 13 06', hours: H_A },
    { id: 'bdx-00', name: 'Clinique vétérinaire Sainte-Catherine', vet: 'Dr Julien Arcelin', address: '95 rue Sainte-Catherine', city: 'Bordeaux', cp: '33000', lat: 44.8392, lng: -0.5736, phone: '05 99 00 33 00', hours: H_B },
    { id: 'lil-00', name: 'Clinique vétérinaire Nationale', vet: 'Dr Thomas Vandeau', address: '140 rue Nationale', city: 'Lille', cp: '59000', lat: 50.6343, lng: 3.0545, phone: '03 99 00 59 00', hours: H_A },
    { id: 'tls-00', name: 'Clinique vétérinaire Alsace-Lorraine', vet: 'Dr Chloé Garric', address: '36 rue d’Alsace-Lorraine', city: 'Toulouse', cp: '31000', lat: 43.6029, lng: 1.4446, phone: '05 99 00 31 00', hours: H_B },
    { id: 'nan-00', name: 'Cabinet vétérinaire Crébillon', vet: 'Dr Emma Rouzic', address: '12 rue Crébillon', city: 'Nantes', cp: '44000', lat: 47.2133, lng: -1.5617, phone: '02 99 00 44 00', hours: H_A },
    { id: 'str-00', name: 'Clinique vétérinaire Grand’Rue', vet: 'Dr Paul Hirtzel', address: '78 Grand’Rue', city: 'Strasbourg', cp: '67000', lat: 48.5809, lng: 7.7426, phone: '03 99 00 67 00', hours: H_A },
    { id: 'ren-00', name: 'Cabinet vétérinaire d’Antrain', vet: 'Dr Zoé Kerval', address: '27 rue d’Antrain', city: 'Rennes', cp: '35000', lat: 48.1158, lng: -1.6772, phone: '02 99 00 35 00', hours: H_C },
    { id: 'nic-00', name: 'Clinique vétérinaire Rue de France', vet: 'Dr Louis Barelli', address: '64 rue de France', city: 'Nice', cp: '06000', lat: 43.6962, lng: 7.2600, phone: '04 99 00 06 00', hours: H_A },
    { id: 'mtp-00', name: 'Clinique vétérinaire de la Loge', vet: 'Dr Alice Ferrand', address: '9 rue de la Loge', city: 'Montpellier', cp: '34000', lat: 43.6109, lng: 3.8767, phone: '04 99 00 34 00', hours: H_B, prices: { premiere: 44, vaccins: 60, bilan: 46 } }
  ];
  var byId = {}; SAMPLE.forEach(function (c) { c.src = 'sample'; c.prices = c.prices || PRICE; byId[c.id] = c; });
  var CLINICS = SAMPLE; /* jeu courant affiché */
  var MOTIFS = { premiere: '1re consultation', vaccins: 'Vaccins', bilan: 'Bilan de croissance' };

  /* ---------- Outils ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’'\-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function track(n, p) { try { if (window.tcTrack) window.tcTrack(n, p || {}); } catch (e) {} }
  function eur(n) { return n === 0 ? '0&nbsp;€' : String(n).replace('.', ',') + '&nbsp;€'; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fromIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longDate(s) { var d = fromIso(s); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function shortDate(s) { var d = fromIso(s); return DAYS[d.getDay()].slice(0, 3) + '. ' + d.getDate() + ' ' + MS[d.getMonth()]; }
  function hm(t) { return t.replace(':', 'h'); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function fmtKm(km) { return km < 10 ? km.toFixed(1).replace('.', ',') + '&nbsp;km' : Math.round(km) + '&nbsp;km'; }
  function haversine(a, b, c, d) { var R = 6371, t = Math.PI / 180, dl = (c - a) * t, dg = (d - b) * t, x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * t) * Math.cos(c * t) * Math.sin(dg / 2) * Math.sin(dg / 2); return 2 * R * Math.asin(Math.sqrt(x)); }

  /* ---------- Identités fictives stables (dérivées de l'identifiant OpenStreetMap) ---------- */
  var N_TYPE = ['Clinique vétérinaire', 'Cabinet vétérinaire', 'Centre vétérinaire', 'Clinique vétérinaire', 'Cabinet vétérinaire'];
  var N_PLACE = ['des Tilleuls', 'du Parc', 'des Lilas', 'des Coquelicots', 'des Acacias', 'du Moulin', 'des Platanes', 'de la Fontaine', 'des Glycines', 'du Verger', 'des Peupliers', 'des Marronniers', 'de la Roseraie', 'des Hirondelles', 'du Val', 'des Saules', 'de l’Orée', 'des Cèdres', 'du Belvédère', 'des Mimosas', 'du Clos', 'des Bruyères', 'de la Source', 'des Pins'];
  var F_NAMES = ['Camille', 'Hugo', 'Inès', 'Léa', 'Nathan', 'Sarah', 'Julien', 'Thomas', 'Chloé', 'Emma', 'Paul', 'Zoé', 'Louis', 'Alice', 'Manon', 'Lucas', 'Clara', 'Antoine', 'Juliette', 'Maxime', 'Laura', 'Théo', 'Pauline', 'Romain', 'Marion', 'Adrien', 'Élise', 'Quentin'];
  var L_NAMES = ['Lefort', 'Marchal', 'Bréval', 'Fontanel', 'Corvel', 'Delmonte', 'Arcelin', 'Vandeau', 'Garric', 'Rouzic', 'Hirtzel', 'Kerval', 'Barelli', 'Ferrand', 'Pessac', 'Saverne', 'Morand', 'Daviaud', 'Lacombe', 'Ternier', 'Valois', 'Ribault', 'Castel', 'Aubriot', 'Mévil', 'Sorbier', 'Dorval', 'Grandin'];
  var HOURS = [H_A, H_B, H_C];
  function fromOsm(el) {
    var t = el.tags || {}, key = el.type + '/' + el.id, h = hash(key);
    var lat = el.lat != null ? el.lat : el.center && el.center.lat, lng = el.lon != null ? el.lon : el.center && el.center.lon;
    if (lat == null || lng == null) return null;
    var street = [t['addr:housenumber'], t['addr:street'] || t['addr:place']].filter(Boolean).join(' ');
    var p = PRICE, k = h % 3;
    return { id: 'osm-' + el.type[0] + el.id, osm: key, src: 'osm', lat: lat, lng: lng,
      name: N_TYPE[h % N_TYPE.length] + ' ' + N_PLACE[(h >>> 3) % N_PLACE.length],
      vet: 'Dr ' + F_NAMES[(h >>> 8) % F_NAMES.length] + ' ' + L_NAMES[(h >>> 14) % L_NAMES.length],
      address: street || 'Adresse non renseignée dans OpenStreetMap', city: t['addr:city'] || '', cp: t['addr:postcode'] || '',
      phone: fakePhone(t['addr:postcode'] || '', h),
      hours: HOURS[(h >>> 5) % 3], prices: { premiere: p.premiere + k * 2, vaccins: p.vaccins + k * 2, bilan: p.bilan + k * 2 } };
  }
  /* Numéros de la tranche réservée à la fiction (0X 99 00 xx xx) : jamais le vrai numéro */
  function fakePhone(cp, h) { var z = { '75': 1, '77': 1, '78': 1, '91': 1, '92': 1, '93': 1, '94': 1, '95': 1 }[cp.slice(0, 2)] || ({ '1': 2, '2': 2, '3': 3, '4': 4, '5': 5, '6': 4, '0': 4, '8': 3, '9': 5, '7': 4 }[cp.slice(0, 1)] || (1 + h % 5)); return '0' + z + ' 99 00 ' + String((h >>> 4) % 100).padStart(2, '0') + ' ' + String((h >>> 12) % 100).padStart(2, '0'); }
  function snap(c) { return { id: c.id, src: c.src, osm: c.osm, lat: c.lat, lng: c.lng, name: c.name, vet: c.vet, address: c.address, city: c.city, cp: c.cp, phone: c.phone, hoursKey: HOURS.indexOf(c.hours), prices: c.prices }; }
  function unsnap(o) { var c = JSON.parse(JSON.stringify(o)); c.hours = HOURS[o.hoursKey] || H_A; return c; }

  /* ---------- API Overpass (OpenStreetMap) avec cache local ---------- */
  /* Instances publiques listées sur le wiki OSM ; une seule requête à la fois, pause de 30 s après un 429/406 */
  var ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  var inflight = null, pauseUntil = 0;
  var TTL = 7 * 24 * 3600 * 1000, memCache = {};
  /* ---------- Réseau : journal des requêtes et classement des erreurs ---------- */
  var GEO_API = 'https://geo.api.gouv.fr';
  var vetLog = window.tcVetLog = [], cspBlocked = {};
  document.addEventListener('securitypolicyviolation', function (e) { try { var h = new URL(e.blockedURI).host; if (h) cspBlocked[h] = e.effectiveDirective || e.violatedDirective || 'csp'; } catch (x) {} });
  function logReq(o) { vetLog.push(o); if (vetLog.length > 40) vetLog.shift(); try { console.info('[TeckCare · Mon véto]', o.service, o.status, o.count != null ? o.count + ' élément(s)' : '', o.ms != null ? o.ms + ' ms' : '', o.url); } catch (e) {} renderDiag(); }
  function hostOf(u) { try { return new URL(u).host; } catch (e) { return ''; } }
  /* Requête JSON avec délai, journalisée. Les erreurs portent un type : http, timeout, csp (bloqué par la page), network (réseau ou CORS). */
  function getJSON(service, url, opts, countOf) {
    opts = opts || {};
    var t0 = Date.now(), ctrl = 'AbortController' in window ? new AbortController() : null, to = setTimeout(function () { if (ctrl) ctrl.abort(); }, opts.timeout || 20000);
    if (opts.track) opts.track(ctrl);
    var shown = opts.logUrl || url;
    return fetch(url, { method: opts.method || 'GET', body: opts.body, headers: opts.headers, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(to);
        if (!r.ok) { var e = new Error('HTTP ' + r.status); e.kind = 'http'; e.http = r.status; throw e; }
        return r.json().then(function (j) { logReq({ service: service, url: shown, status: r.status, ms: Date.now() - t0, count: countOf ? countOf(j) : null }); return j; });
      })
      .catch(function (e) {
        clearTimeout(to);
        return new Promise(function (res) { setTimeout(res, 60); }).then(function () {
          if (!e.kind) {
            var h = hostOf(url);
            if (e.name === 'AbortError') { e.kind = opts.aborted && opts.aborted() ? 'aborted' : 'timeout'; }
            else if (cspBlocked[h]) { e.kind = 'csp'; e.directive = cspBlocked[h]; }
            else e.kind = 'network';
            e.host = h;
          }
          if (e.kind !== 'aborted') logReq({ service: service, url: shown, status: e.kind === 'http' ? e.http : e.kind === 'csp' ? 'bloquée (' + e.directive + ')' : e.kind === 'timeout' ? 'délai dépassé' : 'échec réseau / CORS', ms: Date.now() - t0, count: null });
          throw e;
        });
      });
  }
  function errText(e) {
    if (e.kind === 'csp') return 'connexion à ' + e.host + ' bloquée par la politique de sécurité de cette page (' + e.directive + ')';
    if (e.kind === 'timeout') return e.host + ' n’a pas répondu à temps';
    if (e.kind === 'http') return 'le service a répondu par une erreur HTTP ' + e.http + (e.http === 429 ? ' (trop de requêtes)' : e.http === 504 ? ' (serveur saturé)' : '');
    return 'connexion à ' + (e.host || 'ce service') + ' impossible (réseau coupé ou accès refusé par le navigateur)';
  }
  function renderDiag() {
    var d = $('#vd-diag'); if (!d) return;
    if (!vetLog.length) { d.hidden = true; return; }
    d.hidden = false;
    $('#vd-diag-list').innerHTML = vetLog.slice(-8).reverse().map(function (o) {
      return '<li><b>' + esc(o.service) + '</b> · ' + esc(String(o.status)) + (o.count != null ? ' · ' + o.count + ' élément(s)' : '') + (o.ms != null ? ' · ' + o.ms + ' ms' : '') + '<br><code>' + esc(o.url.length > 160 ? o.url.slice(0, 160) + '…' : o.url) + '</code></li>';
    }).join('');
  }

  /* ---------- Géocodage : ville, code postal ou département → coordonnées (API Découpage administratif, geo.api.gouv.fr) ---------- */
  var geoCache = {};
  function radiusFor(pop, arr) { return arr ? 1500 : pop > 1000000 ? 6000 : pop > 300000 ? 5000 : pop > 100000 ? 4000 : pop > 20000 ? 3000 : 2500; }
  function geocode(pq) {
    if (pq.kind === 'around') return Promise.resolve({ lat: pq.v.lat, lon: pq.v.lng, r: pq.v.r, label: '', src: 'position' });
    if (pq.kind === 'dep') {
      var b = null; if (depLayer) depLayer.eachLayer(function (l) { if (l.feature.properties.code === pq.v) b = l; });
      if (!b) { var e0 = new Error('dep'); e0.kind = 'notfound'; return Promise.reject(e0); }
      var bb = b.getBounds(), c = bb.getCenter();
      logReq({ service: 'Localisation (contour local du département)', url: 'assets/geo/france.js · ' + pq.v, status: 'OK', ms: 0, count: 1 });
      return Promise.resolve({ lat: c.lat, lon: c.lng, bbox: [bb.getSouth(), bb.getWest(), bb.getNorth(), bb.getEast()], label: b.feature.properties.nom, src: 'local' });
    }
    var url = pq.kind === 'cp'
      ? GEO_API + '/communes?codePostal=' + pq.v + '&type=commune-actuelle,arrondissement-municipal&fields=nom,code,centre,population,codesPostaux&format=json'
      : GEO_API + '/communes?nom=' + encodeURIComponent(pq.v) + '&type=commune-actuelle,arrondissement-municipal&fields=nom,code,centre,population,codesPostaux&boost=population&limit=5&format=json';
    if (geoCache[url]) return Promise.resolve(geoCache[url]);
    return getJSON('Localisation (geo.api.gouv.fr)', url, { timeout: 12000 }, function (j) { return (j || []).length; }).then(function (list) {
      list = (list || []).filter(function (x) { return x.centre && x.centre.coordinates; });
      if (!list.length) { var e = new Error('notfound'); e.kind = 'notfound'; throw e; }
      var arr = list.filter(function (x) { return / arrondissement/i.test(x.nom); });
      var pick = pq.kind === 'cp' ? (arr[0] || list.sort(function (a, b) { return (b.population || 0) - (a.population || 0); })[0]) : list[0];
      var isArr = / arrondissement/i.test(pick.nom);
      var out = { lat: pick.centre.coordinates[1], lon: pick.centre.coordinates[0], r: radiusFor(pick.population || 0, isArr), label: pick.nom, insee: pick.code, src: 'geo.api.gouv.fr' };
      geoCache[url] = out; return out;
    });
  }

  /* ---------- Établissements : requête Overpass (OpenStreetMap), filtre amenity=veterinary ---------- */
  function buildQuery(loc) {
    var head = '[out:json][timeout:25];', vets = 'nwr["amenity"="veterinary"]';
    if (loc.bbox) return head + vets + '(' + loc.bbox.map(function (n) { return n.toFixed(4); }).join(',') + ');out center tags 120;';
    return head + vets + '(around:' + loc.r + ',' + loc.lat.toFixed(5) + ',' + loc.lon.toFixed(5) + ');out center tags 80;';
  }
  function overpass(loc) {
    var q = buildQuery(loc), ck = 'q:' + q, cache = get('tc_vet_osm_cache', {}), hit = memCache[ck] || cache[ck];
    if (hit && Date.now() - hit.ts < TTL) { logReq({ service: 'Établissements (cache local, requête Overpass précédente)', url: q, status: 'cache', ms: 0, count: hit.data.els.length }); return Promise.resolve({ data: hit.data, cached: true }); }
    if (Date.now() < pauseUntil) { var pe = new Error('pause'); pe.kind = 'http'; pe.http = 429; pe.wait = Math.ceil((pauseUntil - Date.now()) / 1000); return Promise.reject(pe); }
    if (inflight) try { inflight.abort(); } catch (e) {}
    var i = 0, mine = null, retried = false;
    function attempt() {
      return getJSON('Établissements (Overpass · ' + hostOf(ENDPOINTS[i]) + ')', ENDPOINTS[i], {
        method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000,
        logUrl: ENDPOINTS[i] + ' ← ' + q,
        track: function (c) { inflight = mine = c; }, aborted: function () { return inflight !== mine; }
      }, function (j) { return (j.elements || []).length; })
        .then(function (j) {
          var data = { els: (j.elements || []).filter(function (e) { return e.tags && e.tags.amenity === 'veterinary'; }) };
          memCache[ck] = { ts: Date.now(), data: data };
          try { var c2 = get('tc_vet_osm_cache', {}), keys = Object.keys(c2); if (keys.length > 25) delete c2[keys[0]]; c2[ck] = memCache[ck]; set('tc_vet_osm_cache', c2); } catch (e) {}
          return { data: data, cached: false };
        })
        .catch(function (e) {
          if (e.kind !== 'aborted' && e.kind !== 'csp' && i < ENDPOINTS.length - 1) { i++; return attempt(); }
          if ((e.http === 502 || e.http === 503 || e.http === 504 || e.kind === 'timeout') && !retried) { retried = true; i = 0; return new Promise(function (r) { setTimeout(r, 2500); }).then(attempt); }
          if (e.http === 429 || e.http === 406) { pauseUntil = Date.now() + 30000; e.wait = 30; }
          throw e;
        });
    }
    return attempt();
  }

  /* ---------- Réservations (stockage local) ---------- */
  function bookings() { return get('tc_vet_bookings', []); }
  function saveBookings(a) { set('tc_vet_bookings', a); }

  /* Créneaux : dans les horaires de la clinique, futurs (au moins 1 h à l'avance), hors créneaux déjà réservés.
     La disponibilité est déterministe par clinique et par jour, pour que la fiche et la fenêtre de réservation concordent. */
  function slotsFor(c, day, ignoreId) {
    var d = fromIso(day), ranges = c.hours.h[d.getDay()] || [], out = [], now = new Date(), today = iso(now), min = now.getHours() * 60 + now.getMinutes() + 60;
    var taken = bookings().filter(function (b) { return b.clinicId === c.id && b.date === day && b.id !== ignoreId; }).map(function (b) { return b.time; });
    ranges.forEach(function (r) {
      for (var m = r[0]; m + 30 <= r[1]; m += 30) {
        if (hash(c.id + day + m) % 10 < 4) continue;
        if (day === today && m < min) continue;
        var t = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
        if (taken.indexOf(t) === -1) out.push(t);
      }
    });
    return out;
  }
  function nextDays(c, n, ignoreId) {
    var out = [], d = new Date(); d.setHours(12, 0, 0, 0);
    for (var i = 0; out.length < n && i < 30; i++) { var s = iso(d); if (slotsFor(c, s, ignoreId).length) out.push(s); d.setDate(d.getDate() + 1); }
    return out;
  }
  function nextSlot(c) { var d = nextDays(c, 1)[0]; return d ? { date: d, time: slotsFor(c, d)[0] } : null; }

  /* ---------- Bilan de croissance offert ---------- */
  function offerState() {
    var r = get('tc_ration', null), order = get('tc_last_order', null), used = get('tc_bilan_used', null);
    if (!r || !r.tier) return 'none';
    if (r.heavy) return 'uncertain';
    if (r.tier === 'ideal') return 'ineligible';
    if (used) return 'used';
    return order ? 'ready' : 'wait';
  }
  var OFFER_RULE = 'Selon le résultat du calculateur, un bilan de croissance est offert après votre première commande.';
  function renderOffer() {
    var box = $('#vd-offer'), st = offerState(), r = get('tc_ration', null) || {};
    var sil = r.silhouette === 'mince' ? 'plutôt mince' : 'plutôt ronde';
    var msg = {
      none: ['Selon ses résultats au calculateur, profitez d’un bilan chez un vétérinaire partenaire après votre première commande.', '<a class="btn btn--sm vd-offer-btn" href="#calculateur" data-open-quiz data-vd-offer-btn>Mon chiot peut-il en profiter&nbsp;?</a>'],
      ineligible: ['Sa silhouette semble dans les repères&nbsp;: le bilan n’est pas offert, la réservation reste possible.', ''],
      uncertain: ['Certaines réponses semblent inhabituelles (son poids&nbsp;?). Vérifiez-les avant de conclure.', '<a class="btn btn--ghost btn--sm" href="#calculateur" data-open-quiz data-vd-offer-btn>Vérifier mes réponses</a>'],
      wait: ['Silhouette ' + sil + '&nbsp;: <b>votre bilan sera offert après votre première commande.</b>', '<a class="btn btn--ghost btn--sm" href="#croquettes" data-vd-offer-btn>Voir nos produits</a>'],
      ready: ['<b>Votre bilan de croissance est offert.</b> Il vous sera proposé à la réservation.', '<button type="button" class="btn btn--primary btn--sm" data-vd-offer-go data-vd-offer-btn>Réserver mon bilan offert</button>'],
      used: ['<b>Votre bilan offert est déjà réservé</b> (un par client).', '']
    }[st];
    box.className = 'vd-offer vd-offer--' + st;
    var ico = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v5a5 5 0 0 0 10 0V3"/><path d="M4 3h2M14 3h2"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/></svg>';
    box.innerHTML = '<span class="vd-offer-i">' + ico + '</span><div class="vd-offer-t"><p class="vd-offer-h">Un bilan de croissance offert pour votre chiot</p><p class="vd-offer-d">' + msg[0] + '</p></div>' + (msg[1] ? '<div class="vd-offer-a">' + msg[1].replace('class="btn btn--ghost btn--sm"', 'class="btn btn--sm vd-offer-btn"').replace('class="btn btn--primary btn--sm"', 'class="btn btn--sm vd-offer-btn"') + '</div>' : '');
  }

  function clinicOf(b) { if (byId[b.clinicId]) return byId[b.clinicId]; if (b.clinic) { byId[b.clinicId] = unsnap(b.clinic); return byId[b.clinicId]; } return null; }
  bookings().forEach(clinicOf);

  /* ---------- Rendez-vous enregistrés ---------- */
  function renderBookings() {
    var box = $('#vd-bookings'), list = bookings().sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<p class="vd-k">Vos rendez-vous</p>' + list.map(function (b) {
      var c = clinicOf(b); if (!c) return '';
      return '<div class="vd-bk"><div><p class="vd-bk-t"><b>' + esc(longDate(b.date)) + ' à ' + esc(hm(b.time)) + '</b> · ' + esc(MOTIFS[b.motif] || '') + ' · ' + esc(b.pup) + '</p>' +
        '<p>' + esc(c.name) + ', ' + esc(addr(c)) + ' · ' + (b.offer ? '<span class="vd-gift">Bilan offert</span>' : eur(b.price) + ' à régler sur place') + ' · <span class="vd-ref">Réf. ' + esc(b.id) + '</span></p></div>' +
        '<span class="vd-bk-a"><button type="button" class="btn btn--text btn--sm" data-vd-edit="' + esc(b.id) + '">Modifier</button><button type="button" class="btn btn--text btn--sm" data-vd-cal="' + esc(b.id) + '">Ajouter à mon agenda</button><button type="button" class="btn btn--text btn--sm" data-vd-cancel="' + esc(b.id) + '">Annuler</button></span></div>';
    }).join('');
  }

  /* ---------- Recherche ---------- */
  var state = { q: '', results: [], sel: null, view: 'list', dist: null, src: null, area: null, radius: 0, busy: false, searched: false };
  function parseQuery(q) {
    var n = norm(q);
    var arr = n.match(/^(paris|lyon|marseille)\s*(\d{1,2})\s*(e|er|eme|ieme|em)?(\s*arrondissement)?$/);
    if (arr) { var num = +arr[2], pre = { paris: '750', lyon: '6900', marseille: '130' }[arr[1]], max = { paris: 20, lyon: 9, marseille: 16 }[arr[1]]; if (num >= 1 && num <= max) n = pre === '6900' ? '6900' + num : pre + String(num).padStart(2, '0'); }
    var d = n.replace(/\s/g, '');
    if (/^\d{5}$/.test(d)) return { kind: 'cp', v: d };
    if (/^(\d{2}|2a|2b)$/.test(d)) return { kind: 'dep', v: d.toUpperCase() };
    if (/^\d+$/.test(d)) return { kind: 'bad', v: d };
    return n ? { kind: 'city', v: n } : null;
  }
  function setResults(list, src) {
    CLINICS = list; state.results = list; state.src = src;
    list.forEach(function (c) { byId[c.id] = c; });
    if (state.sel && !list.some(function (c) { return c.id === state.sel; })) state.sel = null;
  }
  function sampleSearch(pq) {
    if (!pq) return SAMPLE.slice();
    if (pq.kind === 'cp') { var r = SAMPLE.filter(function (c) { return c.cp === pq.v; }); return r.length ? r : SAMPLE.filter(function (c) { return c.cp.slice(0, 2) === pq.v.slice(0, 2); }); }
    if (pq.kind === 'dep') return SAMPLE.filter(function (c) { return c.cp.slice(0, 2) === pq.v; });
    if (pq.kind === 'around') return SAMPLE.slice().sort(function (a, b) { return haversine(pq.v.lat, pq.v.lng, a.lat, a.lng) - haversine(pq.v.lat, pq.v.lng, b.lat, b.lng); }).slice(0, 6);
    return SAMPLE.filter(function (c) { return norm(c.city).indexOf(pq.v) === 0; });
  }
  function srcNote() {
    var n = $('#vd-src');
    if (state.src === 'sample') { n.className = 'vd-src vd-src--sample'; n.innerHTML = '<b>Liste enregistrée TeckCare</b>&nbsp;: données fixes intégrées au site, affichées à votre demande. Ce n’est pas le résultat d’une recherche OpenStreetMap.'; n.hidden = false; }
    else if (state.src === 'osm') { n.className = 'vd-src'; n.innerHTML = 'Emplacements et adresses&nbsp;: © contributeurs OpenStreetMap, requête Overpass <code>amenity=veterinary</code> (liste non exhaustive).' + (state.cached ? ' <span>(résultats en cache)</span>' : ''); n.hidden = false; }
    else n.hidden = true;
  }
  function search(q, opts) {
    opts = opts || {};
    var pq = opts.pq || parseQuery(q), cnt = $('#vd-count');
    state.q = q || ''; state.dist = null; state.searched = !!pq; state.pq = pq;
    if (!pq) { setResults([], null); renderList(); renderMap(true); cnt.textContent = ''; srcNote(); return; }
    if (pq.kind === 'bad') { cnt.textContent = 'Saisissez un code postal à 5 chiffres, un département (ex. 69) ou un nom de ville.'; return; }
    state.busy = true; state.area = null; renderList(true);
    var btn = $('#vd-form button[type=submit]'); btn.disabled = true;
    var tok = state.tok = (state.tok || 0) + 1;
    state.lastPq = pq; state.lastQ = q;
    function stop() { state.busy = false; btn.disabled = false; }
    cnt.innerHTML = '<span class="vd-spin" aria-hidden="true"></span> Localisation de ' + (pq.kind === 'around' ? 'la zone' : '«&nbsp;' + esc(q) + '&nbsp;»') + '…';
    geocode(pq).then(function (loc) {
      if (tok !== state.tok) return;
      if (pq.kind === 'around') loc.r = pq.v.r;
      state.area = { lat: loc.lat, lon: loc.lon }; state.radius = loc.bbox ? 0 : loc.r; state.loc = loc;
      setResults([], null); renderMap(true);
      cnt.innerHTML = '<span class="vd-spin" aria-hidden="true"></span> ' + (loc.label ? esc(loc.label) + ' localisé. ' : '') + 'Recherche des établissements vétérinaires dans OpenStreetMap…';
      return overpass(loc).then(function (res) {
        if (tok !== state.tok) return;
        var list = res.data.els.map(fromOsm).filter(Boolean);
        list.forEach(function (c) { if (!c.city && loc.label) c.city = loc.label.replace(/ \d+e? Arrondissement$/i, ''); });
        state.cached = res.cached; stop();
        setResults(list, 'osm'); done(pq, q);
        track('vet_search', { query_type: pq.kind, results: list.length, source: 'osm', cached: res.cached });
      }, function (err) {
        if (tok !== state.tok || err.kind === 'aborted') return;
        stop(); setResults([], 'error'); renderList(); renderMap(true); srcNote();
        cnt.innerHTML = '<span class="vd-err-t">Établissements indisponibles</span>&nbsp;: ' + (loc.label ? esc(loc.label) + ' a bien été localisé, mais ' : '') + esc(errText(err)) + '.' +
          (err.wait ? ' Réessayez dans ' + err.wait + '&nbsp;s.' : '') + ' <button type="button" class="btn btn--text btn--sm" data-vd-retry>Réessayer</button> <button type="button" class="btn btn--text btn--sm" data-vd-all>Afficher les cliniques TeckCare enregistrées</button>';
        track('vet_search_error', { step: 'establishments', kind: err.kind, status: err.http || null });
      });
    }, function (err) {
      if (tok !== state.tok) return;
      stop(); setResults([], 'error'); renderList(); renderMap(true); srcNote();
      if (err.kind === 'notfound') cnt.innerHTML = '<span class="vd-err-t">Lieu introuvable</span>&nbsp;: aucune commune ne correspond à «&nbsp;' + esc(q) + '&nbsp;». Vérifiez l’orthographe ou saisissez un code postal.';
      else cnt.innerHTML = '<span class="vd-err-t">Localisation impossible</span>&nbsp;: ' + esc(errText(err)) + '. <button type="button" class="btn btn--text btn--sm" data-vd-retry>Réessayer</button> <button type="button" class="btn btn--text btn--sm" data-vd-all>Afficher les cliniques TeckCare enregistrées</button>';
      track('vet_search_error', { step: 'geocoding', kind: err.kind, status: err.http || null });
    });
  }
  function done(pq, q) {
    state.busy = false; $('#vd-form button[type=submit]').disabled = false;
    if (pq.kind === 'around' && state.src === 'osm') { state.dist = {}; state.results.forEach(function (c) { state.dist[c.id] = haversine(pq.v.lat, pq.v.lng, c.lat, c.lng); }); state.results.sort(function (a, b) { return state.dist[a.id] - state.dist[b.id]; }); }
    renderList(); renderMap(true); srcNote();
    var k = state.results.length, cnt = $('#vd-count'), where = pq.kind === 'around' ? (pq.label || 'autour de vous') : '«&nbsp;' + esc(q) + '&nbsp;»';
    if (pq.kind === 'sample') { cnt.innerHTML = k + ' cliniques TeckCare enregistrées (données fixes).'; return; }
    if (k) cnt.innerHTML = k + (k > 1 ? ' établissements trouvés ' : ' établissement trouvé ') + (pq.kind === 'around' ? where : 'pour ' + where) + '.';
    else {
      var c = state.area, wide = state.radius || 0;
      cnt.innerHTML = 'Aucun établissement trouvé ' + (pq.kind === 'around' ? where : 'pour ' + where) + '.' +
        (c && wide && wide < 40000 ? ' <button type="button" class="btn btn--text btn--sm" data-vd-widen="' + (wide >= 15000 ? 40000 : 15000) + '">Élargir à ' + (wide >= 15000 ? 40 : 15) + '&nbsp;km</button>' : '') +
        (state.src === 'sample' ? ' <button type="button" class="btn btn--text btn--sm" data-vd-all>Voir tout l’extrait</button>' : '');
      renderWaitlist(pq.kind === 'cp' ? pq.v : '');
    }
  }
  function widen(r) {
    var c = state.area; if (!c) return;
    search(state.q, { pq: { kind: 'around', v: { lat: c.lat, lng: c.lon, r: r }, label: 'dans un rayon de ' + (r / 1000) + '&nbsp;km autour de «&nbsp;' + esc(state.q) + '&nbsp;»' } });
  }

  function addr(c) { return [c.address, [c.cp, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '); }
  function renderList(loading) {
    var ul = $('#vd-list');
    ul.setAttribute('aria-busy', String(!!loading));
    if (loading) { ul.innerHTML = '<li class="vd-skel"></li><li class="vd-skel"></li><li class="vd-skel"></li>'; return; }
    var vb = $('.vd-body'), tg = $('.vd-toggle'); var idle = !state.searched || state.src === 'error'; if (vb) vb.classList.toggle('is-idle', idle); if (tg) tg.hidden = idle;
    if (!state.searched) { ul.innerHTML = ''; return; }
    if (!state.results.length) { ul.innerHTML = '<li class="vd-empty" id="vd-wait"></li>'; return; }
    ul.innerHTML = state.results.map(function (c) {
      var on = c.id === state.sel, ns = nextSlot(c);
      return '<li class="vd-card' + (on ? ' is-sel' : '') + '" data-vd-id="' + c.id + '" id="vd-c-' + c.id + '">' +
        '<button type="button" class="vd-pick" data-vd-pick="' + c.id + '" aria-pressed="' + on + '"><span class="vd-name">' + esc(c.name) + '</span><span class="vd-vetn">' + esc(c.vet) + '</span></button>' +
        '<p class="vd-addr">' + esc(addr(c)) + (state.dist && state.dist[c.id] != null ? ' · <b class="vd-km">à ' + fmtKm(state.dist[c.id]) + '</b>' : '') + '</p>' +
        '<dl class="vd-info"><div><dt>Horaires</dt><dd>' + esc(c.hours.txt) + '</dd></div><div><dt>Téléphone</dt><dd>' + esc(c.phone) + '</dd></div>' +
        '<div><dt>Prochain créneau</dt><dd class="vd-next-slot">' + (ns ? esc(shortDate(ns.date)) + ' à ' + esc(hm(ns.time)) : 'Aucun dans les 30 jours') + '</dd></div></dl>' +
        '<button type="button" class="btn btn--primary btn--sm vd-rdv" data-vd-book="' + c.id + '"' + (ns ? '' : ' disabled') + '>Prendre rendez-vous</button></li>';
    }).join('');
  }

  /* Aucun résultat : liste d'attente locale */
  function renderWaitlist(cp) {
    var li = $('#vd-wait'); if (!li) return;
    li.innerHTML = '<form class="vd-wl" id="vd-wl" novalidate><p class="vd-wl-t">Prévenez-moi quand une clinique ouvre près de chez moi</p>' +
      '<div class="vd-wl-row"><label>E-mail<input name="email" type="email" required autocomplete="email" maxlength="80"></label>' +
      '<label>Code postal<input name="cp" inputmode="numeric" maxlength="5" value="' + esc(/^\d{5}$/.test(cp) ? cp : '') + '" autocomplete="postal-code"></label></div>' +
      '<label class="vd-check"><input type="checkbox" name="ok" required> J’accepte d’être prévenu(e) de l’ouverture d’une clinique partenaire près de chez moi.</label>' +
      '<p class="vd-err" id="vd-wl-msg" role="status" aria-live="polite"></p><button type="submit" class="btn btn--primary btn--sm">Me prévenir</button></form>';
  }

  /* ---------- Carte : Leaflet + fond vectoriel local (France, Corse comprise) ; plan des rues CARTO ajouté s'il se charge ---------- */
  var map = null, markers = {}, mapMode = 'loading', tilesOk = false, depLayer = null, cityLayer = null;
  var mapHost = $('#vd-map');
  var FR_BOUNDS = [[41.3, -5.2], [51.15, 9.6]];
  function setMapStatus(txt) { var s = $('#vd-map-status'); if (s) { s.textContent = txt || ''; s.hidden = !txt; } }
  function initLeaflet() {
    if (!window.L) return false;
    var G = window.TC_GEO || null;
    mapHost.innerHTML = '<div id="vd-leaflet" class="vd-leaflet" role="region" aria-label="Carte de France des cliniques partenaires"></div><p class="vd-map-status" id="vd-map-status" role="status" hidden></p><p class="vd-map-hint" id="vd-map-hint"></p>';
    map = L.map('vd-leaflet', { zoomControl: true, scrollWheelZoom: false, attributionControl: true, minZoom: 4, maxZoom: 18, maxBounds: [[36, -14], [56, 20]], maxBoundsViscosity: 0.8, zoomSnap: 0.25, zoomAnimation: !reduce, fadeAnimation: !reduce, markerZoomAnimation: !reduce, preferCanvas: false });
    map.fitBounds(FR_BOUNDS);
    map.attributionControl.setPrefix(false);
    if (G) {
      map.createPane('vdBase').style.zIndex = 150;
      map.createPane('vdLines').style.zIndex = 250;
      map.createPane('vdLabels').style.zIndex = 450;
      map.getPane('vdLabels').style.pointerEvents = 'none';
      L.geoJSON(G.countries, { pane: 'vdBase', interactive: false, style: { color: '#D9CDB6', weight: 1, fillColor: '#EEE6D6', fillOpacity: 1 } }).addTo(map);
      depLayer = L.geoJSON(G.dep, { pane: 'vdBase', interactive: false, style: { color: '#B9C98F', weight: 1, fillColor: '#FFFAF0', fillOpacity: 1 } }).addTo(map);
      L.geoJSON(G.rivers, { pane: 'vdLines', interactive: false, style: { color: '#9EC3D6', weight: 1.4, opacity: .9 } }).addTo(map);
      L.geoJSON(G.roads, { pane: 'vdLines', interactive: false, style: function (f) { var big = f.properties.type === 'Major Highway'; return { color: big ? '#E59A55' : '#D8B48A', weight: big ? 1.6 : 1, opacity: big ? .85 : .6 }; } }).addTo(map);
      cityLayer = L.layerGroup().addTo(map);
      G.cities.forEach(function (c) {
        L.marker([c[1], c[2]], { pane: 'vdLabels', interactive: false, keyboard: false, icon: L.divIcon({ className: 'vd-cityl' + (c[3] >= 400000 ? ' is-big' : ''), html: '<i></i><span>' + esc(c[0]) + '</span>', iconSize: [0, 0] }) }).addTo(cityLayer);
      });
      var zc = function () { var z = map.getZoom(), el = $('#vd-leaflet'); if (el) { el.classList.toggle('z-lo', z < 6.5); el.classList.toggle('z-hi', z >= 11); } };
      map.on('zoomend', zc); zc();
      map.attributionControl.addAttribution('Fond : <a href="https://github.com/gregoiredavid/france-geojson">france-geojson</a> (Etalab) · <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
    }
    /* Plan des rues : en ligne seulement. Dans l'aperçu Claude, les images distantes sont bloquées : on garde le fond vectoriel. */
    var tl = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, detectRetina: true, opacity: 0, className: 'vd-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    var errs = 0;
    tl.on('tileload', function () { if (!tilesOk) { tilesOk = true; tl.setOpacity(1); var el = $('#vd-leaflet'); if (el) el.classList.add('has-tiles'); setMapStatus(''); } });
    tl.on('tileerror', function () { errs++; if (!tilesOk && errs >= 3) noTiles('error'); });
    setTimeout(function () { if (!tilesOk) noTiles('timeout'); }, 6000);
    function noTiles(why) {
      if (!map || !map.hasLayer(tl)) return;
      map.removeLayer(tl); map.setMaxZoom(12);
      var blk = Object.keys(cspBlocked).filter(function (h) { return /cartocdn/.test(h); })[0];
      setMapStatus('Plan des rues indisponible\u00a0: les images de basemaps.cartocdn.com ' + (blk ? 'sont bloquées par la politique de sécurité de cette page (' + cspBlocked[blk] + ')' : why === 'timeout' ? 'ne répondent pas' : 'ne se chargent pas') + '. Fond de carte vectoriel intégré affiché.');
      logReq({ service: 'Fond de carte (tuiles CARTO)', url: 'https://basemaps.cartocdn.com/rastertiles/voyager/…', status: blk ? 'bloquée (' + cspBlocked[blk] + ')' : why === 'timeout' ? 'délai dépassé' : 'échec', ms: null, count: null });
      if (!G) { fallback(why); return; }
      track('vet_map_fallback', { reason: why, layer: 'tiles' });
    }
    map.on('focus', function () { map.scrollWheelZoom.enable(); }); map.on('blur', function () { map.scrollWheelZoom.disable(); });
    mapMode = 'leaflet';
    return true;
  }
  function fallback(why) {
    if (mapMode === 'svg') return;
    try { if (map) map.remove(); } catch (e) {}
    map = null; markers = {}; mapMode = 'svg';
    initSvg();
    setMapStatus('La carte n’a pas pu se charger. Voici un repérage simplifié ; la liste reste complète.');
    renderMap(true);
    track('vet_map_fallback', { reason: why, layer: 'all' });
  }
  /* Zone recherchée : centre même sans résultat (département, code postal, ville connue, position) */
  function zoneOf(pq) {
    if (!pq || !window.L) return null;
    if (pq.kind === 'around') return { c: [pq.v.lat, pq.v.lng], z: 12 };
    if (state.area && state.area.lat) return { c: [state.area.lat, state.area.lon], z: pq.kind === 'around' ? 12 : 11 };
    var G = window.TC_GEO, code = null;
    if (pq.kind === 'dep') code = String(pq.v).toUpperCase();
    else if (pq.kind === 'cp' && /^\d{5}$/.test(pq.v)) code = pq.v.slice(0, 2) === '20' ? (+pq.v < 20200 ? '2A' : '2B') : pq.v.slice(0, 2);
    else if (pq.kind === 'city' && G) {
      var n = norm(pq.label || pq.v), hit = G.cities.filter(function (c) { return norm(c[0]) === n; })[0];
      if (hit) return { c: [hit[1], hit[2]], z: 11 };
    }
    if (code && depLayer) { var b = null; depLayer.eachLayer(function (l) { if (l.feature.properties.code === code) b = l.getBounds(); }); if (b) return { b: b }; }
    return null;
  }
  function pinIcon(on) { return L.divIcon({ className: 'vd-mk' + (on ? ' is-sel' : ''), html: '<span></span>', iconSize: on ? [26, 26] : [20, 20], iconAnchor: on ? [13, 13] : [10, 10] }); }
  function renderLeaflet(fit) {
    Object.keys(markers).forEach(function (id) { map.removeLayer(markers[id]); }); markers = {};
    state.results.forEach(function (c) {
      var m = L.marker([c.lat, c.lng], { icon: pinIcon(c.id === state.sel), title: c.name + ', ' + c.city, alt: c.name, keyboard: true, riseOnHover: true, zIndexOffset: c.id === state.sel ? 1000 : 0 }).addTo(map);
      m.on('click', function () { select(c.id, 'map'); });
      markers[c.id] = m;
    });
    if (!fit) return;
    var zMax = tilesOk ? 14 : 10, o = { animate: !reduce, maxZoom: tilesOk ? 14 : 12, padding: [30, 30] };
    if (state.results.length === 1) map.setView([state.results[0].lat, state.results[0].lng], tilesOk ? 14 : 10, { animate: !reduce });
    else if (state.results.length) map.fitBounds(L.latLngBounds(state.results.map(function (c) { return [c.lat, c.lng]; })).pad(0.25), o);
    else { var z = zoneOf(state.pq); if (z && z.b) map.fitBounds(z.b, { animate: !reduce, maxZoom: zMax, padding: [30, 30] }); else if (z) map.setView(z.c, Math.min(z.z, zMax), { animate: !reduce }); else map.fitBounds(FR_BOUNDS, { animate: !reduce }); }
  }

  /* Carte simplifiée (secours) */
  var FR = [[2.55,51.08],[1.85,50.95],[1.6,50.7],[1.37,50.06],[0.1,49.5],[-1.2,49.35],[-1.6,49.65],[-1.95,49.7],[-1.6,48.84],[-2.0,48.65],[-3.05,48.78],[-3.98,48.72],[-4.75,48.4],[-4.7,48.04],[-3.36,47.75],[-3.12,47.48],[-2.2,47.27],[-1.78,46.5],[-1.15,46.15],[-1.05,45.6],[-1.25,44.65],[-1.56,43.48],[-1.78,43.37],[-0.5,42.8],[0.7,42.7],[1.7,42.5],[2.6,42.4],[3.17,42.45],[3.05,43.0],[3.2,43.2],[3.7,43.4],[4.0,43.55],[4.6,43.4],[5.35,43.3],[5.93,43.1],[6.65,43.25],[7.27,43.7],[7.5,43.78],[7.0,44.2],[6.9,44.9],[6.65,45.15],[7.1,45.5],[6.8,45.85],[6.2,46.35],[6.0,46.5],[6.4,46.9],[6.85,47.35],[7.55,47.6],[7.6,48.0],[7.8,48.6],[8.2,48.97],[7.0,49.15],[6.4,49.47],[5.8,49.55],[4.85,50.15],[4.2,49.95],[3.7,50.3],[3.1,50.75]];
  var LON0 = -5.4, LAT0 = 51.4, KX = 100 * Math.cos(46.5 * Math.PI / 180), KY = 100;
  function px(lng, lat) { return [(lng - LON0) * KX, (LAT0 - lat) * KY]; }
  function initSvg() {
    var pts = FR.map(function (p) { var q = px(p[0], p[1]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    var cor = [[9.4,42.95],[9.55,42.6],[9.4,41.95],[9.2,41.37],[8.75,41.6],[8.6,42.05],[8.7,42.55]].map(function (p) { var q = px(p[0], p[1]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    mapHost.innerHTML = '<p class="vd-map-status" id="vd-map-status" role="status" hidden></p><svg class="vd-svg" viewBox="0 0 1050 1000" role="group" aria-label="Carte simplifiée des cliniques"><polygon class="vd-land" points="' + pts + '"/><polygon class="vd-land" points="' + cor + '"/><g id="vd-pins"></g></svg><p class="vd-map-hint" id="vd-map-hint"></p>';
  }
  function renderSvg() {
    var svg = $('.vd-svg'), g = $('#vd-pins'); if (!svg || !g) return;
    var list = state.results.length ? state.results : SAMPLE, xs = list.map(function (c) { return px(c.lng, c.lat); });
    var minX = Math.min.apply(null, xs.map(function (p) { return p[0]; })), maxX = Math.max.apply(null, xs.map(function (p) { return p[0]; }));
    var minY = Math.min.apply(null, xs.map(function (p) { return p[1]; })), maxY = Math.max.apply(null, xs.map(function (p) { return p[1]; }));
    var w = Math.max(maxX - minX, 220), h = Math.max(maxY - minY, 200), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var vbW = Math.min(1050, Math.max(w * 1.5, h * 1.5 * 1.05)), vbH = vbW / 1.05;
    if (!state.q) { svg.setAttribute('viewBox', '0 0 1050 1000'); vbW = 1050; } else svg.setAttribute('viewBox', (cx - vbW / 2).toFixed(1) + ' ' + (cy - vbH / 2).toFixed(1) + ' ' + vbW.toFixed(1) + ' ' + vbH.toFixed(1));
    var r = vbW * 0.014, fs = vbW * 0.028, seen = {}, placed = [];
    var labels = state.results.filter(function (c) { if (!c.city || seen[c.city]) return false; seen[c.city] = 1; return true; }).map(function (c) { var p = px(c.lng, c.lat); return '<text class="vd-city" text-anchor="middle" x="' + p[0].toFixed(1) + '" y="' + (p[1] - r * 2).toFixed(1) + '" font-size="' + fs.toFixed(1) + '">' + esc(c.city) + '</text>'; }).join('');
    g.innerHTML = labels + state.results.map(function (c) {
      var p = px(c.lng, c.lat), on = c.id === state.sel;
      for (var k = 0; k < 8 && placed.some(function (q) { return Math.hypot(q[0] - p[0], q[1] - p[1]) < r * 2.6; }); k++) p = [p[0] + r * 2.7 * (k % 2 ? -1 : 1) * Math.ceil((k + 1) / 2), p[1] + r * 1.2];
      placed.push(p);
      return '<g class="vd-pin' + (on ? ' is-sel' : '') + '" data-vd-pin="' + c.id + '" tabindex="0" role="button" aria-label="' + esc(c.name + ', ' + c.city) + '" aria-pressed="' + on + '" transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"><circle r="' + (on ? r * 1.5 : r).toFixed(2) + '"/><title>' + esc(c.name) + '</title></g>';
    }).join('');
  }
  function renderMap(fit) {
    try {
      if (mapMode === 'loading') { if (!initLeaflet()) { mapMode = 'svg'; initSvg(); setMapStatus('La bibliothèque de carte n’a pas pu se charger. Voici un repérage simplifié ; la liste reste complète.'); } }
      if (map) renderLeaflet(fit); else renderSvg();
      var hint = $('#vd-map-hint'), s = state.sel && byId[state.sel];
      if (hint) hint.innerHTML = s ? '<span><b>' + esc(s.name) + '</b> · ' + esc(addr(s)) + '</span> <button type="button" class="btn btn--primary btn--sm" data-vd-book="' + s.id + '">Prendre rendez-vous</button>' : (state.results.length ? 'Touchez un repère pour voir la clinique.' : state.searched ? 'Aucun établissement à afficher.' : '');
    } catch (e) { try { fallback('error'); } catch (x) { mapHost.innerHTML = '<p class="vd-map-status">La carte n’est pas disponible. La liste reste utilisable.</p>'; } }
  }

  function select(id, from) {
    state.sel = id; renderList();
    if (map) { Object.keys(markers).forEach(function (k) { markers[k].setIcon(pinIcon(k === id)); markers[k].setZIndexOffset(k === id ? 1000 : 0); }); var c = byId[id]; if (from === 'list') map.panTo([c.lat, c.lng], { animate: !reduce }); renderMap(false); }
    else renderMap(false);
    if (from === 'map') { var li = document.getElementById('vd-c-' + id); if (li && state.view === 'list') li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }
    track('vet_select', { clinic: id, from: from });
  }

  /* Autour de moi : géolocalisation du navigateur */
  function nearMe() {
    var cnt = $('#vd-count'), btn = $('#vd-near');
    if (!navigator.geolocation) { cnt.textContent = 'Votre navigateur ne permet pas la géolocalisation. Saisissez votre ville ou votre code postal.'; return; }
    cnt.textContent = 'Recherche de votre position…'; btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false; $('#vd-q').value = '';
      search('', { pq: { kind: 'around', v: { lat: pos.coords.latitude, lng: pos.coords.longitude, r: 10000 }, label: 'à moins de 10&nbsp;km de vous' } });
    }, function (err) {
      btn.disabled = false;
      cnt.textContent = err && err.code === 1 ? 'La géolocalisation a été refusée. Saisissez votre ville ou votre code postal.' : 'Votre position n’a pas pu être trouvée. Saisissez votre ville ou votre code postal.';
      $('#vd-q').focus();
    }, { timeout: 10000, maximumAge: 600000 });
  }

  /* ---------- Réservation : 1 motif → 2 date et créneau → 3 coordonnées → 4 récapitulatif → confirmation ---------- */
  var bk = null;
  function openBooking(id, edit) {
    var c = byId[id]; if (!c) return;
    var r = get('tc_ration', null), pupIn = document.getElementById('pup-name'), off = offerState() === 'ready';
    if (edit) { bk = JSON.parse(JSON.stringify(edit)); bk.editId = edit.id; bk.step = 2; bk.offerAvail = edit.offer || off; }
    else {
      var ns = nextSlot(c);
      bk = { clinicId: id, date: ns ? ns.date : null, time: ns ? ns.time : null, step: 1, pup: (pupIn && pupIn.value.trim()) || (r && r.name) || '', owner: '', email: '', phone: '',
        offer: off, offerAvail: off, motif: off ? 'bilan' : '', age: r && r.age ? String(r.age) : '', weight: r && r.weight ? String(r.weight).replace('.', ',') : '' };
    }
    state.sel = id; renderList(); renderMap(false);
    paint();
    var d = document.getElementById('vd-book'); if (d && d.showModal && !d.open) d.showModal();
    track(edit ? 'vet_booking_edit_open' : 'vet_booking_open', { clinic: id, offer_available: bk.offerAvail });
  }
  function price() { var c = byId[bk.clinicId]; return bk.offer && bk.motif === 'bilan' ? 0 : (c.prices[bk.motif] || 0); }
  var STEPS = ['Motif', 'Date et créneau', 'Coordonnées', 'Récapitulatif'];
  function paint() {
    var c = byId[bk.clinicId], body = $('#vd-book-body');
    var prog = bk.step <= 4 ? '<ol class="vd-steps" aria-label="Étapes">' + STEPS.map(function (s, i) { return '<li class="' + (i + 1 === bk.step ? 'is-on' : i + 1 < bk.step ? 'is-done' : '') + '"' + (i + 1 === bk.step ? ' aria-current="step"' : '') + '>' + (i + 1) + '. ' + s + '</li>'; }).join('') + '</ol>' : '';
    var head = '<h3 id="vd-book-t" tabindex="-1">' + (bk.step > 4 ? 'Rendez-vous confirmé' : bk.editId ? 'Modifier mon rendez-vous' : 'Prendre rendez-vous') + '</h3>' + prog +
      '<p class="vd-bk-c"><b>' + esc(c.name) + '</b> · ' + esc(c.vet) + '<br>' + esc(addr(c)) + '</p>';
    var nav = function (next, label) { return '<p class="vd-err" id="vd-err" role="alert"></p><div class="vd-acts">' + (bk.step > 1 && !(bk.editId && bk.step === 2) ? '<button type="button" class="btn btn--ghost" data-vd-back>Retour</button>' : '') + '<button type="' + (next ? 'submit' : 'button') + '" class="btn btn--primary"' + (next ? '' : ' data-vd-confirm') + '>' + label + '</button></div>'; };
    var html = head;
    if (bk.step === 1) {
      html += '<form class="vd-bk-form" data-step="1" novalidate><fieldset class="vd-fs"><legend>Motif du rendez-vous</legend><div class="vd-motifs">' + Object.keys(MOTIFS).map(function (k) {
        return '<label class="vd-rad"><input type="radio" name="motif" value="' + k + '"' + (bk.motif === k ? ' checked' : '') + '><span>' + MOTIFS[k] + ' <small>' + (k === 'bilan' && bk.offerAvail ? 'offert' : eur(c.prices[k])) + '</small></span></label>'; }).join('') + '</div></fieldset>' +
        (bk.offerAvail ? '<label class="vd-check"><input type="checkbox" name="offer"' + (bk.offer ? ' checked' : '') + '> Utiliser mon bilan de croissance offert</label>' : '') +
        nav(true, 'Choisir une date') + '</form>';
    } else if (bk.step === 2) {
      var days = nextDays(c, 10, bk.editId); if (bk.date && days.indexOf(bk.date) === -1) days.unshift(bk.date);
      var slots = bk.date ? slotsFor(c, bk.date, bk.editId) : [];
      html += '<form class="vd-bk-form" data-step="2" novalidate><fieldset class="vd-fs"><legend>Date</legend><div class="vd-days">' + days.map(function (d) { return '<button type="button" data-vd-day="' + d + '" aria-pressed="' + (d === bk.date) + '">' + esc(shortDate(d)) + '</button>'; }).join('') + '</div></fieldset>' +
        '<fieldset class="vd-fs"><legend>Créneau <small>(' + esc(c.hours.txt) + ')</small></legend><div class="vd-slots">' + (slots.length ? slots.map(function (t) { return '<button type="button" data-vd-slot="' + t + '" aria-pressed="' + (t === bk.time) + '">' + hm(t) + '</button>'; }).join('') : '<p>Aucun créneau ce jour-là.</p>') + '</div></fieldset>' +
        nav(true, 'Continuer') + '</form>';
    } else if (bk.step === 3) {
      html += '<form class="vd-bk-form" data-step="3" novalidate><div class="vd-fields">' +
        '<label>Prénom du chiot<input name="pup" required maxlength="20" value="' + esc(bk.pup) + '" autocomplete="off"></label>' +
        '<label>Âge (mois)<input name="age" inputmode="numeric" maxlength="2" value="' + esc(bk.age) + '"></label>' +
        '<label>Poids (kg)<input name="weight" inputmode="decimal" maxlength="5" value="' + esc(bk.weight) + '"></label>' +
        '<label>Votre nom<input name="owner" required maxlength="40" value="' + esc(bk.owner) + '" autocomplete="name"></label>' +
        '<label>E-mail<input name="email" type="email" maxlength="80" value="' + esc(bk.email) + '" autocomplete="email"></label>' +
        '<label>Téléphone<input name="phone" type="tel" maxlength="20" value="' + esc(bk.phone) + '" autocomplete="tel"></label></div>' +
        '<p class="vd-help">Un e-mail ou un téléphone suffit.</p>' + nav(true, 'Voir le récapitulatif') + '</form>';
    } else if (bk.step === 4) {
      var p = price();
      html += '<ul class="vd-recap"><li><span>Motif</span><b>' + esc(MOTIFS[bk.motif]) + '</b></li><li><span>Date</span><b>' + esc(longDate(bk.date)) + ' à ' + esc(hm(bk.time)) + '</b></li>' +
        '<li><span>Chiot</span><b>' + esc(bk.pup) + (bk.age || bk.weight ? ' · ' + esc([bk.age ? bk.age + ' mois' : '', bk.weight ? bk.weight + ' kg' : ''].filter(Boolean).join(', ')) : '') + '</b></li>' +
        '<li><span>Propriétaire</span><b>' + esc(bk.owner) + '</b></li><li><span>Contact</span><b>' + esc([bk.email, bk.phone].filter(Boolean).join(' · ')) + '</b></li>' +
        '<li><span>Bilan offert</span><b>' + (bk.offer && bk.motif === 'bilan' ? 'Oui' : bk.offerAvail ? 'Non utilisé' : 'Non') + '</b></li>' +
        '<li class="vd-total"><span>À régler à la clinique</span><b>' + eur(p) + '</b></li></ul>' +
        nav(false, bk.editId ? 'Confirmer la modification' : 'Confirmer le rendez-vous');
    } else {
      var b = bookings().filter(function (x) { return x.id === bk.id; })[0] || bk;
      html += '<p class="vd-ok">Votre référence&nbsp;: <b>' + esc(b.id) + '</b></p><ul class="vd-recap"><li><span>Motif</span><b>' + esc(MOTIFS[b.motif]) + '</b></li><li><span>Date</span><b>' + esc(longDate(b.date)) + '</b></li><li><span>Heure</span><b>' + esc(hm(b.time)) + '</b></li>' +
        '<li><span>Chiot</span><b>' + esc(b.pup) + '</b></li><li><span>Bilan offert</span><b>' + (b.offer ? 'Oui' : 'Non') + '</b></li><li class="vd-total"><span>À régler à la clinique</span><b>' + eur(b.price) + '</b></li></ul>' +
        '<div class="vd-acts vd-acts--done"><button type="button" class="btn btn--ghost" data-vd-edit="' + esc(b.id) + '">Modifier</button><button type="button" class="btn btn--ghost" data-vd-cancel="' + esc(b.id) + '">Annuler</button><button type="button" class="btn btn--primary" data-vd-cal="' + esc(b.id) + '">Ajouter à mon agenda</button></div>' +
        '<div class="vd-cal" id="vd-cal" hidden></div>' +
        '';
    }
    body.innerHTML = html;
    var t = $('#vd-book-t'); if (t) try { t.focus(); } catch (e) {}
  }
  function readStep(f) {
    if (bk.step === 1) { var m = f.querySelector('input[name="motif"]:checked'); bk.motif = m ? m.value : ''; if (f.offer) bk.offer = f.offer.checked; if (bk.offer && bk.motif !== 'bilan') bk.offer = false; }
    if (bk.step === 3) { ['pup', 'age', 'weight', 'owner', 'email', 'phone'].forEach(function (k) { bk[k] = f[k].value.trim(); }); }
  }
  function validate() {
    if (bk.step === 1 && !bk.motif) return 'Choisissez le motif du rendez-vous.';
    if (bk.step === 2) { if (!bk.date || !bk.time) return 'Choisissez une date et un créneau.'; if (slotsFor(byId[bk.clinicId], bk.date, bk.editId).indexOf(bk.time) === -1) return 'Ce créneau n’est plus disponible. Choisissez-en un autre.'; }
    if (bk.step === 3) {
      if (!bk.pup) return 'Indiquez le prénom de votre chiot.';
      if (!bk.owner) return 'Indiquez votre nom.';
      if (!bk.email && !bk.phone) return 'Indiquez un e-mail ou un téléphone.';
      if (bk.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bk.email)) return 'Vérifiez l’adresse e-mail.';
      if (bk.phone && bk.phone.replace(/\D/g, '').length < 10) return 'Vérifiez le numéro de téléphone (10 chiffres).';
      if (bk.age && !(+bk.age >= 1 && +bk.age <= 24)) return 'Indiquez un âge entre 1 et 24 mois, ou laissez vide.';
    }
    return '';
  }
  function confirmBooking() {
    var err = validate(); bk.step = 2; err = err || validate(); bk.step = 4;
    if (err) { $('#vd-err').textContent = err; return; }
    var avail = offerState() === 'ready' || (bk.editId && get('tc_bilan_used', null) === bk.editId);
    var useOffer = !!(bk.offer && bk.motif === 'bilan' && avail);
    var list = bookings(), rec = { clinicId: bk.clinicId, clinic: snap(byId[bk.clinicId]), date: bk.date, time: bk.time, motif: bk.motif, pup: bk.pup, age: bk.age, weight: bk.weight, owner: bk.owner, email: bk.email, phone: bk.phone, offer: useOffer, price: useOffer ? 0 : byId[bk.clinicId].prices[bk.motif], ts: Date.now() };
    if (bk.editId) {
      rec.id = bk.editId; list = list.map(function (x) { return x.id === bk.editId ? rec : x; });
      if (get('tc_bilan_used', null) === bk.editId && !useOffer) del('tc_bilan_used');
      track('vet_booking_modified', { clinic: bk.clinicId, offer_used: useOffer });
    } else {
      rec.id = 'TC-RDV-' + Date.now().toString(36).toUpperCase().slice(-6); list.push(rec);
      track('vet_booking_confirmed', { clinic: bk.clinicId, motif: bk.motif, offer_used: useOffer, value: rec.price, demo_mode: true });
    }
    saveBookings(list);
    if (useOffer) set('tc_bilan_used', rec.id);
    bk.id = rec.id; bk.step = 5; paint(); renderBookings(); renderOffer(); renderList();
  }
  function cancelBooking(id) {
    var list = bookings(), b = list.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    saveBookings(list.filter(function (x) { return x.id !== id; }));
    if (get('tc_bilan_used', null) === id) del('tc_bilan_used');
    renderBookings(); renderOffer(); renderList(); renderMap(false);
    var d = document.getElementById('vd-book');
    if (d && d.open && bk && bk.id === id) { $('#vd-book-body').innerHTML = '<h3 id="vd-book-t" tabindex="-1">Rendez-vous annulé</h3><p>Le créneau du ' + esc(longDate(b.date)) + ' à ' + esc(hm(b.time)) + ' est de nouveau disponible.</p><div class="vd-acts"><button type="button" class="btn btn--primary" data-pdclose>Fermer</button></div>'; $('#vd-book-t').focus(); }
    var live = $('#vd-count'); if (live && !(d && d.open)) live.textContent = 'Rendez-vous du ' + longDate(b.date) + ' annulé : le créneau est de nouveau disponible.';
    track('vet_booking_cancelled', { clinic: b.clinicId, offer_released: !!b.offer });
  }

  /* Agenda : lien Google Agenda (s'ouvre hors de la page) + fichier .ics (Apple, Outlook) */
  function icsEsc(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function calParts(b) {
    var c = clinicOf(b), d = b.date.replace(/-/g, ''), p = b.time.split(':'), s = +p[0] * 60 + +p[1], e = s + 30;
    var f = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0') + '00'; };
    return { c: c, start: d + 'T' + f(s), end: d + 'T' + f(e), title: 'Vétérinaire – ' + (MOTIFS[b.motif] || 'Rendez-vous') + ' pour ' + b.pup, loc: c.name + ', ' + addr(c) };
  }
  function showCal(id, host) {
    var b = bookings().filter(function (x) { return x.id === id; })[0]; if (!b || !host) return;
    var k = calParts(b);
    var g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(k.title) + '&dates=' + k.start + '/' + k.end + '&ctz=Europe/Paris&location=' + encodeURIComponent(k.loc) + '&details=' + encodeURIComponent('Réf. ' + b.id + ' — rendez-vous TeckCare.');
    host.innerHTML = '<a class="btn btn--ghost btn--sm" href="' + g + '" target="_blank" rel="noopener" data-vd-gcal>Google Agenda</a><button type="button" class="btn btn--ghost btn--sm" data-vd-ics="' + esc(b.id) + '">Fichier .ics (Apple, Outlook)</button><p class="vd-help" id="vd-ics-msg" role="status"></p>';
    host.hidden = false;
  }
  function exportIcs(id) {
    var b = bookings().filter(function (x) { return x.id === id; })[0]; if (!b) return;
    var k = calParts(b), now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TeckCare//Projet etudiant//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + b.id + '@teckcare.example', 'DTSTAMP:' + now,
      'DTSTART;TZID=Europe/Paris:' + k.start, 'DTEND;TZID=Europe/Paris:' + k.end, 'SUMMARY:' + icsEsc(k.title), 'LOCATION:' + icsEsc(k.loc),
      'DESCRIPTION:' + icsEsc('Réf. ' + b.id + ' — rendez-vous TeckCare.'), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    try {
      var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })), a = document.createElement('a');
      a.href = url; a.download = 'rdv-veto-' + b.date + '.ics'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      var m = $('#vd-ics-msg'); if (m) m.textContent = 'Si le téléchargement ne démarre pas (aperçu intégré), utilisez Google Agenda.';
    } catch (e) { var m2 = $('#vd-ics-msg'); if (m2) m2.textContent = 'Le fichier n’a pas pu être créé ici. Utilisez Google Agenda.'; }
    track('vet_booking_ics', { clinic: b.clinicId });
  }

  /* ---------- Événements ---------- */
  $('#vd-form').addEventListener('submit', function (e) { e.preventDefault(); search($('#vd-q').value); });
  $('#vd-q').addEventListener('input', function () { if (!this.value.trim()) search(''); });
  $('#vd-near').addEventListener('click', nearMe);
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var x;
    if ((x = t.closest('[data-vd-pick]'))) { select(x.getAttribute('data-vd-pick'), 'list'); return; }
    if ((x = t.closest('[data-vd-pin]'))) { select(x.getAttribute('data-vd-pin'), 'map'); return; }
    if ((x = t.closest('[data-vd-book]'))) { openBooking(x.getAttribute('data-vd-book')); return; }
    if ((x = t.closest('[data-vd-view]'))) { setView(x.getAttribute('data-vd-view')); return; }
    if (t.closest('[data-vd-all]')) { state.tok = (state.tok || 0) + 1; setResults(SAMPLE.slice(), 'sample'); state.searched = true; state.radius = 0; state.area = null; state.pq = null; done({ kind: 'sample' }, ''); track('vet_sample_view', {}); return; }
    if (t.closest('[data-vd-offer-go]')) { $('#vd-q').focus(); $('#vd-count').innerHTML = 'Recherchez votre ville puis «&nbsp;Prendre rendez-vous&nbsp;»&nbsp;: le bilan offert vous sera proposé.'; return; }
    if ((x = t.closest('[data-vd-cancel]'))) { cancelBooking(x.getAttribute('data-vd-cancel')); return; }
    if ((x = t.closest('[data-vd-edit]'))) { var b0 = bookings().filter(function (y) { return y.id === x.getAttribute('data-vd-edit'); })[0]; if (b0) { clinicOf(b0); openBooking(b0.clinicId, b0); } return; }
    if (t.closest('[data-vd-retry]')) { if (state.lastPq) search(state.lastQ, { pq: state.lastPq }); return; }
    if ((x = t.closest('[data-vd-widen]'))) { widen(+x.getAttribute('data-vd-widen')); return; }
    if ((x = t.closest('[data-vd-cal]'))) { var host = t.closest('#vd-book') ? $('#vd-cal') : null; if (!host) { openDone(x.getAttribute('data-vd-cal')); host = $('#vd-cal'); } showCal(x.getAttribute('data-vd-cal'), host); var gl = $('[data-vd-gcal]', host); if (gl) gl.focus(); return; }
    if ((x = t.closest('[data-vd-ics]'))) { exportIcs(x.getAttribute('data-vd-ics')); return; }
    if (!bk) return;
    if ((x = t.closest('[data-vd-day]'))) { bk.date = x.getAttribute('data-vd-day'); bk.time = null; paint(); var db = $('[data-vd-day="' + bk.date + '"]'); if (db) db.focus(); return; }
    if ((x = t.closest('[data-vd-slot]'))) { bk.time = x.getAttribute('data-vd-slot'); $$('[data-vd-slot]').forEach(function (s) { s.setAttribute('aria-pressed', String(s === x)); }); var er = $('#vd-err'); if (er) er.textContent = ''; return; }
    if (t.closest('[data-vd-back]')) { bk.step = Math.max(1, bk.step - 1); paint(); return; }
    if (t.closest('[data-vd-confirm]')) { confirmBooking(); return; }
  });
  function openDone(id) {
    var b = bookings().filter(function (x) { return x.id === id; })[0]; if (!b) return;
    bk = JSON.parse(JSON.stringify(b)); bk.step = 5; paint();
    var d = document.getElementById('vd-book'); if (d && !d.open) d.showModal();
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id === 'vd-wl') {
      e.preventDefault();
      var m = $('#vd-wl-msg'), em = f.email.value.trim(), cp = f.cp.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { m.textContent = 'Indiquez une adresse e-mail valide.'; f.email.focus(); return; }
      if (!/^\d{5}$/.test(cp)) { m.textContent = 'Indiquez un code postal à 5 chiffres.'; f.cp.focus(); return; }
      if (!f.ok.checked) { m.textContent = 'Cochez la case pour accepter d’être prévenu(e).'; f.ok.focus(); return; }
      var wl = get('tc_vet_waitlist', []); wl.push({ email: em, cp: cp, ts: Date.now() }); set('tc_vet_waitlist', wl);
      f.innerHTML = '<p class="vd-wl-ok" role="status">C’est noté&nbsp;! Vous serez prévenu(e) dès qu’une clinique partenaire ouvre près du ' + esc(cp) + '.</p>';
      track('vet_waitlist_signup', { cp: cp });
      return;
    }
    if (!f.classList || !f.classList.contains('vd-bk-form') || !bk) return;
    e.preventDefault(); readStep(f);
    var err = validate(); if (err) { $('#vd-err').textContent = err; return; }
    bk.step++; paint();
  });
  document.addEventListener('change', function (e) {
    if (!bk || !e.target.closest || !e.target.closest('.vd-bk-form')) return;
    if (e.target.name === 'offer' && e.target.checked) { var r = $('.vd-bk-form input[name="motif"][value="bilan"]'); if (r) r.checked = true; }
    if (e.target.name === 'motif' && e.target.value !== 'bilan') { var o = $('.vd-bk-form input[name="offer"]'); if (o) o.checked = false; }
    if (e.target.name === 'motif' && e.target.value === 'bilan') { var o2 = $('.vd-bk-form input[name="offer"]'); if (o2) o2.checked = true; }
  });
  document.addEventListener('keydown', function (e) { var p = e.target.closest && e.target.closest('[data-vd-pin]'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(p.getAttribute('data-vd-pin'), 'map'); } });
  var dlgEl = document.getElementById('vd-book');
  if (dlgEl) dlgEl.addEventListener('close', function () { if (!bk) return; var b = document.querySelector('#vd-list [data-vd-book="' + bk.clinicId + '"]'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {} });
  function setView(v) {
    state.view = v; $('.vd-body').setAttribute('data-view', v);
    $$('[data-vd-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-vd-view') === v)); });
    if (v === 'map') { if (map) setTimeout(function () { map.invalidateSize(); renderLeaflet(!state.sel); if (state.sel) map.setView([byId[state.sel].lat, byId[state.sel].lng], tilesOk ? 14 : 10); }, 30); else renderMap(false); }
  }
  /* La carte Leaflet doit recalculer sa taille quand la page « Mon véto » devient visible */
  var secV = document.getElementById('sante');
  if (secV && 'MutationObserver' in window) new MutationObserver(function () { if (map && !secV.hidden) setTimeout(function () { map.invalidateSize(); renderLeaflet(true); }, 60); }).observe(secV, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('tc:ration', renderOffer);
  document.addEventListener('tc:order', renderOffer);
  window.addEventListener('storage', function () { renderOffer(); renderBookings(); renderList(); });
  var ob = $('#vd-offer');
  if (ob && 'IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { track('vet_offer_view', { state: offerState() }); io.disconnect(); } }, { threshold: 0.6 }); io.observe(ob); }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-vd-offer-btn]'); if (b) track('vet_offer_click', { state: offerState() }); }, true);

  /* Recherche depuis le résultat du calculateur */
  window.tcVetMap = function () { return map; };
  window.tcVetSearch = function (q) { $('#vd-q').value = q || ''; search(q || ''); root.scrollIntoView({ block: 'start' }); };

  renderOffer(); renderBookings(); search('');
})();
