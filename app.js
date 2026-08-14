/* BorregaVeloz — página de reservas.
 *
 * O token vem no fragmento do URL (#t=…), não na query string: assim nunca
 * aparece em logs de servidor nem no cabeçalho Referer que a página envia ao
 * Google. Todo o acesso à base de dados passa por RPCs que exigem esse token
 * — a chave Supabase publicada aqui, sozinha, não lê nada.
 *
 * O preço mostrado é sempre o que o servidor devolve. Nunca é calculado aqui:
 * ao submeter, a RPC recalcula tudo e ignora o que o browser diga.
 */
(function () {
  'use strict';

  var CFG = window.CFG;
  var $ = function (id) { return document.getElementById(id); };

  var TOKEN = (location.hash.match(/[#&]t=([a-f0-9]+)/i) || [])[1] || '';
  var BOOT = null;      // resposta do session_bootstrap
  var SVC = null;       // serviço escolhido
  var KIND = 'once';    // 'once' | 'regular' | 'school'
  var ORIGIN = null, DEST = null, SCHOOL = null;   // {addr, lat, lon}
  var QUOTE = null;
  var VOUCHER = '';
  var BUSY = false;

  var DAYNUM = {
    'Segunda-feira': 1, 'Terca-feira': 2, 'Terça-feira': 2, 'Quarta-feira': 3,
    'Quinta-feira': 4, 'Sexta-feira': 5, 'Sabado': 6, 'Sábado': 6, 'Domingo': 7
  };
  var DAYABBR = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom' };

  /* ------------------------------------------------------------------ API */

  function rpc(fn, body) {
    return fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': CFG.SUPABASE_KEY,
        'Authorization': 'Bearer ' + CFG.SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
      return r.json();
    });
  }

  var eur = function (v) { return Number(v).toFixed(2).replace('.', ',') + ' €'; };

  /* ---------------------------------------------------- moradas (2 fontes)
   *
   * Com chave Google usa-se o Places (New) — melhor qualidade em Portugal.
   * Sem chave cai para o Photon (OpenStreetMap), que não precisa de chave.
   * Ambos devolvem a mesma forma: {main, secondary, resolve()->{addr,lat,lon}}
   * para o resto da página não ter de saber qual está a ser usado.
   */
  var USE_GOOGLE = !!(CFG.GOOGLE_KEY && CFG.GOOGLE_KEY.length > 10);

  var placesSession = null;
  function newPlacesSession() {
    placesSession = (crypto.randomUUID ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2));
  }
  newPlacesSession();

  function googleSuggest(text) {
    return fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CFG.GOOGLE_KEY },
      body: JSON.stringify({
        input: text, includedRegionCodes: ['pt'], languageCode: 'pt', sessionToken: placesSession
      })
    }).then(function (r) { return r.ok ? r.json() : { suggestions: [] }; })
      .then(function (d) {
        return (d.suggestions || []).map(function (s) { return s.placePrediction; }).filter(Boolean)
          .map(function (p) {
            var sf = p.structuredFormat || {};
            return {
              main: (sf.mainText && sf.mainText.text) || p.text.text,
              secondary: (sf.secondaryText && sf.secondaryText.text) || '',
              full: p.text.text,
              resolve: function () {
                return fetch('https://places.googleapis.com/v1/' + p.place +
                  '?languageCode=pt&sessionToken=' + encodeURIComponent(placesSession), {
                  headers: { 'X-Goog-Api-Key': CFG.GOOGLE_KEY, 'X-Goog-FieldMask': 'location,formattedAddress' }
                }).then(function (r) { return r.ok ? r.json() : null; })
                  .then(function (d) {
                    newPlacesSession();
                    if (!d || !d.location) return null;
                    return { addr: d.formattedAddress || p.text.text, lat: d.location.latitude, lon: d.location.longitude };
                  }).catch(function () { return null; });
              }
            };
          });
      }).catch(function () { return []; });
  }

  function photonSuggest(text) {
    // enviesado para Santarém, que é onde vive quase toda a procura
    var url = 'https://photon.komoot.io/api/?limit=6&lang=default&lat=39.2362&lon=-8.6870&q=' +
      encodeURIComponent(text + ', Portugal');
    return fetch(url).then(function (r) { return r.ok ? r.json() : { features: [] }; })
      .then(function (d) {
        return (d.features || []).filter(function (f) {
          return f.properties && f.properties.countrycode === 'PT';
        }).map(function (f) {
          var p = f.properties;
          var main = [p.name, p.housenumber].filter(Boolean).join(' ');
          if (!main) main = p.street || p.city || '';
          var sec = [p.street && p.name !== p.street ? p.street : null, p.postcode, p.city, p.state]
            .filter(Boolean).join(', ');
          var full = [main, sec].filter(Boolean).join(', ');
          return {
            main: main, secondary: sec, full: full,
            resolve: function () {
              return Promise.resolve({
                addr: full,
                lat: f.geometry.coordinates[1],
                lon: f.geometry.coordinates[0]
              });
            }
          };
        });
      }).catch(function () { return []; });
  }

  function suggestAddresses(text) {
    return USE_GOOGLE ? googleSuggest(text) : photonSuggest(text);
  }

  /* Liga um input a uma lista de sugestões. onPick recebe {addr,lat,lon}. */
  function attachAutocomplete(input, list, onPick) {
    var timer = null, items = [], sel = -1, lastPicked = '';

    function close() { list.hidden = true; list.innerHTML = ''; items = []; sel = -1; }

    function draw() {
      list.innerHTML = '';
      items.forEach(function (p, i) {
        var li = document.createElement('li');
        if (i === sel) li.className = 'sel';
        li.textContent = p.main;
        if (p.secondary) {
          var s = document.createElement('span'); s.className = 'sub'; s.textContent = p.secondary;
          li.appendChild(s);
        }
        li.addEventListener('mousedown', function (e) { e.preventDefault(); pick(i); });
        list.appendChild(li);
      });
      list.hidden = !items.length;
    }

    function pick(i) {
      var p = items[i]; if (!p) return;
      input.value = p.full;
      lastPicked = p.full;
      close();
      input.classList.remove('bad');
      p.resolve().then(function (loc) {
        if (!loc) { input.classList.add('bad'); onPick(null); return; }
        onPick(loc);
      });
    }

    input.addEventListener('input', function () {
      onPick(null);                       // morada mexida = coordenadas já não valem
      input.classList.remove('bad');
      clearTimeout(timer);
      var v = input.value.trim();
      if (v.length < 3) { close(); return; }
      timer = setTimeout(function () {
        suggestAddresses(v).then(function (res) {
          if (input.value.trim() !== v) return;
          items = res; sel = -1;
          if (!items.length) {
            list.innerHTML = '<li class="muted">Sem resultados — tente com mais detalhe.</li>';
            list.hidden = false;
          } else draw();
        });
      }, 320);
    });

    input.addEventListener('keydown', function (e) {
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, items.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(sel < 0 ? 0 : sel); }
      else if (e.key === 'Escape') close();
    });

    input.addEventListener('blur', function () {
      setTimeout(function () {
        close();
        // escreveu à mão e não escolheu da lista: não temos coordenadas
        if (input.value.trim() && input.value.trim() !== lastPicked) input.classList.add('bad');
      }, 150);
    });
  }

  /* ------------------------------------------------------------ arranque */

  function fail(msg) {
    $('gateSpin').hidden = true;
    $('gateMsg').textContent = msg;
    var wa = $('gateWa');
    wa.href = 'https://wa.me/' + CFG.WHATSAPP;
    wa.hidden = false;
  }

  function boot() {
    $('gateLogo').src = CFG.LOGO;
    $('hdrLogo').src = CFG.LOGO;
    $('doneLogo').src = CFG.LOGO;
    $('termsLink').href = CFG.TERMOS;

    if (!TOKEN) {
      return fail('Este link não é válido. Peça um novo no WhatsApp escrevendo "agendar".');
    }

    rpc('session_bootstrap', { p_token: TOKEN }).then(function (d) {
      if (!d || !d.ok) {
        return fail('O seu link expirou. Volte ao WhatsApp e escreva "agendar" para receber um novo.');
      }
      BOOT = d;
      $('gate').hidden = true;
      $('app').hidden = false;
      var ht = $('heroTitle');   // só existe no desenho com foto no topo
      if (ht) {
        ht.textContent = d.client.first_name
          ? ('Para onde vamos, ' + d.client.first_name + '?')
          : 'Para onde vamos?';
        $('hello').textContent = 'Reserve em menos de um minuto.';
      } else {
        $('hello').textContent = d.client.first_name
          ? ('Olá, ' + d.client.first_name + '! Preencha abaixo — leva menos de um minuto.')
          : 'Preencha abaixo — leva menos de um minuto.';
      }
      renderServices();
    }).catch(function () {
      fail('Não foi possível abrir a sua reserva. Verifique a ligação à internet e tente de novo.');
    });
  }

  /* ------------------------------------------------------------ serviços */

  var DESCS = {
    ocasional: 'Uma viagem, na data e hora que escolher',
    regular: 'Todas as semanas, nos mesmos dias e horas',
    escolar: 'Levar e trazer da escola, todas as semanas',
    privado: 'Motorista à sua disposição, ao tempo',
    partilhado: 'Viagem partilhada com outros passageiros'
  };

  function renderServices() {
    var box = $('services');
    box.innerHTML = '';
    (BOOT.services || []).forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'svc'; b.setAttribute('aria-pressed', 'false');
      // o ícone é desenhado pelo CSS (mask SVG) a partir do data-svc: assim é
      // monocromático em traço e herda a cor, em vez de um emoji de sistema
      b.innerHTML = '<span class="ic" data-svc="' + s.key + '"></span>' +
        '<span class="nm">' + s.name + '<span class="ds">' + (DESCS[s.key] || '') + '</span></span>';
      b.addEventListener('click', function () { chooseService(s, b); });
      box.appendChild(b);
    });
  }

  function chooseService(s, btn) {
    SVC = s;
    KIND = s.key === 'escolar' ? 'school' : (s.key === 'regular' ? 'regular' : 'once');
    Array.prototype.forEach.call($('services').children, function (el) {
      el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
    });
    // o topo troca para a fotografia deste serviço (o CSS trata do fade;
    // sem imagem definida para a chave, fica a foto base)
    var hero = $('hero');
    if (hero) hero.setAttribute('data-svc', s.key);
    // ida/volta: se só um for permitido, fica escolhido sem perguntar
    TRIP = s.allows_one_way ? 'one_way' : 'round_trip';
    if (KIND === 'school') TRIP = 'round_trip';
    layout();
    scheduleQuote();
    // no telemóvel o passo seguinte fica fora do ecrã depois de escolher —
    // trazê-lo à vista poupa um scroll a quem está a usar uma mão só
    var next = $('secTrip').hidden ? ($('secSchool').hidden ? $('secWhere') : $('secSchool')) : $('secTrip');
    setTimeout(function () {
      try { next.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }, 90);
  }

  /* -------------------------------------------------------------- layout */

  var TRIP = 'one_way';

  function layout() {
    if (!SVC) return;
    var perHour = SVC.pricing_mode === 'per_hour';
    var isSub = KIND !== 'once';
    var bothTrips = SVC.allows_one_way && SVC.allows_round_trip;

    // tipo de viagem — só se houver mesmo escolha
    show('secTrip', KIND !== 'school' && bothTrips);
    Array.prototype.forEach.call($('tripSeg').children, function (b) {
      b.setAttribute('aria-pressed', b.dataset.v === TRIP ? 'true' : 'false');
    });
    show('fldWait', KIND === 'once' && TRIP === 'round_trip');

    show('secSchool', KIND === 'school');
    show('secWhere', true);
    show('wrapDest', !perHour && KIND !== 'school');
    $('whereTitle').textContent = KIND === 'school' ? 'Onde recolhemos as crianças?'
      : (perHour ? 'Onde começa o serviço?' : 'Onde vamos?');
    $('lblOrigin').textContent = KIND === 'school' ? 'Morada de recolha (casa)' : 'Morada de origem';

    show('secWhen', true);
    show('whenOnce', !isSub);
    show('whenSub', isSub);
    show('fldDuration', perHour);
    show('fldTimeRet', !(KIND === 'regular' && TRIP === 'one_way'));
    $('lblTimeOut').textContent = KIND === 'school' ? 'Hora de entrada na escola' : 'Hora da ida';
    $('lblTimeRet').textContent = KIND === 'school' ? 'Hora de saída da escola' : 'Hora do regresso';

    show('secVoucher', KIND === 'once');
    show('secPay', KIND !== 'school' && BOOT.mbway_enabled);
    show('secFinal', true);
    show('fldNotes', KIND === 'once');

    $('rules').textContent = 'Máx. ' + (SVC.max_passengers || 4) +
      ' pessoas · proibido transportar animais · bagagem mediante disponibilidade.';

    renderDays();
    setDateLimits();
    number();
    $('bar').hidden = false;
  }

  function show(id, on) { var e = $(id); if (e) e.hidden = !on; }

  function number() {
    var n = 2; // 1 é sempre "Que serviço precisa?"
    ['secTrip', 'secSchool', 'secWhere', 'secWhen', 'secVoucher', 'secPay', 'secFinal'].forEach(function (id) {
      var sec = $(id);
      if (!sec || sec.hidden) return;
      var badge = sec.querySelector('h2 .n');
      if (badge) badge.textContent = n++;
    });
  }

  function renderDays() {
    var box = $('days');
    if (KIND === 'once') { box.innerHTML = ''; return; }
    var open = (SVC.open_weekdays || []).map(function (d) { return DAYNUM[d]; })
      .filter(Boolean).sort(function (a, b) { return a - b; });
    if (!open.length) open = [1, 2, 3, 4, 5];
    if (box.dataset.for === SVC.key) return;         // não repor escolhas do utilizador
    box.dataset.for = SVC.key;
    box.innerHTML = '';
    open.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'day'; b.dataset.d = d;
      b.setAttribute('aria-pressed', 'true');        // por omissão, todos
      b.textContent = DAYABBR[d];
      b.addEventListener('click', function () {
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        scheduleQuote();
      });
      box.appendChild(b);
    });
  }

  function chosenDays() {
    return Array.prototype.filter.call($('days').children, function (b) {
      return b.getAttribute('aria-pressed') === 'true';
    }).map(function (b) { return Number(b.dataset.d); });
  }

  function setDateLimits() {
    var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
    var today = t.toISOString().slice(0, 10);
    t.setDate(t.getDate() + 1);
    var tomorrow = t.toISOString().slice(0, 10);
    $('date').min = today;
    $('startDate').min = tomorrow;
    if (!$('startDate').value) $('startDate').value = tomorrow;
  }

  /* ------------------------------------------------------------- orçamento */

  var quoteTimer = null;
  function scheduleQuote() {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(runQuote, 550);
    if (KIND !== 'school') setBar('calc', 'A calcular…', '');
  }

  function setBar(mode, val, note, lbl) {
    $('barLbl').textContent = lbl || 'Valor';
    $('barVal').textContent = val;
    $('barVal').className = 'bar-val' + (mode === 'calc' ? ' calc' : '');
    $('barNote').textContent = note || '';
  }

  function ready() {
    // campos mínimos para valer a pena perguntar o preço ao servidor
    if (!SVC) return false;
    if (!ORIGIN) return false;
    if (KIND === 'once') {
      if (SVC.pricing_mode !== 'per_hour' && !DEST) return false;
      return !!($('date').value && $('time').value);
    }
    if (KIND === 'regular') {
      return !!(DEST && chosenDays().length && $('timeOut').value && $('startDate').value &&
        (TRIP === 'one_way' || $('timeRet').value));
    }
    return false; // escolar não tem preço automático
  }

  function runQuote() {
    if (KIND === 'school') {
      QUOTE = null;
      setBar('calc', 'Valor proposto pela nossa equipa', 'Recebe a proposta no WhatsApp antes de pagar.');
      $('btnGo').disabled = !schoolReady();
      return Promise.resolve(null);
    }
    if (!ready()) {
      QUOTE = null;
      setBar('calc', '—', 'Preencha os campos acima.');
      $('btnGo').disabled = true;
      return Promise.resolve(null);
    }

    var call = KIND === 'regular'
      ? rpc('quote_subscription', {
        p_token: TOKEN, p_service_key: SVC.key, p_trip_type: TRIP,
        p_origin_lat: ORIGIN.lat, p_origin_lon: ORIGIN.lon,
        p_dest_lat: DEST.lat, p_dest_lon: DEST.lon,
        p_days: chosenDays(), p_time_out: $('timeOut').value,
        p_time_return: TRIP === 'round_trip' ? $('timeRet').value : null,
        p_start_date: $('startDate').value
      })
      : rpc('quote_booking', {
        p_token: TOKEN, p_service_key: SVC.key, p_trip_type: TRIP,
        p_origin_lat: ORIGIN.lat, p_origin_lon: ORIGIN.lon,
        p_dest_lat: DEST ? DEST.lat : null, p_dest_lon: DEST ? DEST.lon : null,
        p_date: $('date').value, p_time: $('time').value,
        p_wait_minutes: TRIP === 'round_trip' ? Number($('waitMin').value || 0) : 0,
        p_duration_min: SVC.pricing_mode === 'per_hour' ? Math.round(Number($('duration').value || 0) * 60) : null,
        p_voucher_code: VOUCHER || null
      });

    return call.then(function (q) {
      QUOTE = q;
      if (q && q.error === 'SESSION_INVALID') {
        fail('O seu link expirou. Volte ao WhatsApp e escreva "agendar" para receber um novo.');
        return null;
      }
      showErrors((q && q.errors) || []);
      if (KIND === 'regular') {
        if (q.week_price == null) { setBar('calc', '—', 'Preencha os campos acima.'); $('btnGo').disabled = true; return q; }
        var note = q.trips_per_week + ' viagens/semana';
        if (q.p1_amount != null && q.p1_amount !== q.week_price) note += ' · 1ª semana ' + eur(q.p1_amount);
        setBar('ok', eur(q.week_price), note, 'Por semana');
      } else {
        if (q.price == null) { setBar('calc', '—', 'Preencha os campos acima.'); $('btnGo').disabled = true; return q; }
        var bits = [];
        if (q.billed_km != null) bits.push(Number(q.billed_km).toFixed(1).replace('.', ',') + ' km');
        if (q.surcharge) bits.push('supl. ' + q.surcharge);
        if (q.min_applied) bits.push('tarifa mínima');
        if (q.discount_amount) bits.push('desconto −' + eur(q.discount_amount));
        setBar('ok', eur(q.price), bits.join(' · '));
      }
      $('btnGo').disabled = !(q && q.ok) || !$('terms').checked;
      return q;
    }).catch(function () {
      setBar('calc', '—', 'Não consegui calcular agora. Tente de novo.');
      $('btnGo').disabled = true;
      return null;
    });
  }

  function schoolReady() {
    return !!(ORIGIN && SCHOOL && $('schoolName').value.trim() &&
      chosenDays().length && $('timeOut').value && $('timeRet').value &&
      $('startDate').value && $('terms').checked);
  }

  function showErrors(list) {
    var box = $('errors');
    if (!list || !list.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = '<ul>' + list.map(function (e) {
      return '<li>' + String(e.message || '').replace(/</g, '&lt;') + '</li>';
    }).join('') + '</ul>';
    box.hidden = false;
  }

  /* --------------------------------------------------------------- submit */

  function submit() {
    if (BUSY) return;
    if (!$('terms').checked) { showErrors([{ message: 'Precisa de aceitar os Termos e Condições.' }]); return; }
    var phone = $('mbway').value.replace(/\D/g, '');
    if (phone.indexOf('351') === 0) phone = phone.slice(3);
    // Mesma validação da ifthenpay (ifthenpay-sdk-php, Utils/Validation.php:
    // regex_mobile). Um `^9\d{8}$` deixava passar 94/95/97, que não são gamas
    // de telemóvel portuguesas: o pedido saía e vinha recusado.
    if (KIND !== 'school' && BOOT.mbway_enabled && !/^9[123689]\d{7}$/.test(phone)) {
      showErrors([{ message: 'Indique um telemóvel português com MBWAY (9 dígitos).' }]);
      $('mbway').classList.add('bad'); $('mbway').focus();
      return;
    }

    BUSY = true;
    $('btnGo').disabled = true;
    $('btnGo').textContent = 'A enviar…';

    var call;
    if (KIND === 'once') {
      call = rpc('submit_booking', {
        p_token: TOKEN, p_service_key: SVC.key, p_trip_type: TRIP,
        p_origin_address: ORIGIN.addr, p_origin_lat: ORIGIN.lat, p_origin_lon: ORIGIN.lon,
        p_dest_address: DEST ? DEST.addr : null,
        p_dest_lat: DEST ? DEST.lat : null, p_dest_lon: DEST ? DEST.lon : null,
        p_date: $('date').value, p_time: $('time').value,
        p_wait_minutes: TRIP === 'round_trip' ? Number($('waitMin').value || 0) : 0,
        p_duration_min: SVC.pricing_mode === 'per_hour' ? Math.round(Number($('duration').value || 0) * 60) : null,
        p_voucher_code: VOUCHER || null,
        p_mbway_phone: phone,
        p_notes: $('notes').value.trim() || null
      });
    } else {
      call = rpc('submit_subscription', {
        p_token: TOKEN,
        p_sub_type: KIND === 'school' ? 'school' : 'door_to_door',
        p_service_key: SVC.key,
        p_trip_type: KIND === 'school' ? 'round_trip' : TRIP,
        p_origin_address: ORIGIN.addr, p_origin_lat: ORIGIN.lat, p_origin_lon: ORIGIN.lon,
        p_dest_address: KIND === 'school' ? (SCHOOL ? SCHOOL.addr : null) : (DEST ? DEST.addr : null),
        p_dest_lat: KIND === 'school' ? (SCHOOL ? SCHOOL.lat : null) : (DEST ? DEST.lat : null),
        p_dest_lon: KIND === 'school' ? (SCHOOL ? SCHOOL.lon : null) : (DEST ? DEST.lon : null),
        p_days: chosenDays(),
        p_time_out: $('timeOut').value,
        p_time_return: (KIND === 'school' || TRIP === 'round_trip') ? $('timeRet').value : null,
        p_start_date: $('startDate').value,
        p_school_name: KIND === 'school' ? $('schoolName').value.trim() : null,
        p_children_count: KIND === 'school' ? Number($('children').value || 1) : null,
        p_mbway_phone: KIND === 'school' ? null : phone
      });
    }

    call.then(function (r) {
      BUSY = false;
      $('btnGo').textContent = 'Confirmar';
      if (!r || !r.ok) {
        $('btnGo').disabled = false;
        if (r && r.error === 'SESSION_INVALID') {
          return fail('O seu link expirou. Volte ao WhatsApp e escreva "agendar" para receber um novo.');
        }
        showErrors((r && r.errors) || [{ message: 'Não foi possível registar. Verifique os campos e tente de novo.' }]);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return;
      }
      finish(r);
    }).catch(function () {
      BUSY = false;
      $('btnGo').disabled = false; $('btnGo').textContent = 'Confirmar';
      showErrors([{ message: 'Falha de ligação. Tente de novo.' }]);
    });
  }

  function finish(r) {
    $('app').hidden = true;
    $('done').hidden = false;
    $('doneWa').href = 'https://wa.me/' + CFG.WHATSAPP;
    $('doneCode').textContent = r.booking_code || r.sub_code || '';
    $('doneCode').hidden = !(r.booking_code || r.sub_code);

    if (r.kind === 'school') {
      $('doneTitle').textContent = 'Pedido registado!';
      $('doneMsg').textContent = 'A nossa equipa vai preparar a proposta de valores e envia-a no WhatsApp em breve. ' +
        'Só decide se avança depois de a ver.';
    } else if (r.kind === 'subscription') {
      $('doneTitle').textContent = 'Subscrição registada!';
      $('doneMsg').textContent = 'Vamos enviar já um pedido MBWAY de ' + eur(r.first_amount) +
        ' para o ' + r.mbway_phone + '. Aprove na app MBWAY e as viagens ficam agendadas.';
    } else if (r.awaiting_payment) {
      $('doneTitle').textContent = 'Reserva registada!';
      $('doneMsg').textContent = 'Vamos enviar já um pedido MBWAY de ' + eur(r.price) +
        ' para o ' + r.mbway_phone + '. Depois do pagamento é atribuído um motorista.';
    } else {
      $('doneTitle').textContent = 'Reserva registada!';
      $('doneMsg').textContent = 'A sua viagem está em validação — em breve será atribuído um motorista.';
    }
  }

  /* ------------------------------------------------------------- ligações */

  function wire() {
    attachAutocomplete($('origin'), $('acOrigin'), function (p) { ORIGIN = p; scheduleQuote(); });
    attachAutocomplete($('dest'), $('acDest'), function (p) { DEST = p; scheduleQuote(); });
    attachAutocomplete($('schoolAddr'), $('acSchoolAddr'), function (p) { SCHOOL = p; scheduleQuote(); });

    Array.prototype.forEach.call($('tripSeg').children, function (b) {
      b.addEventListener('click', function () { TRIP = b.dataset.v; layout(); scheduleQuote(); });
    });

    ['date', 'time', 'duration', 'waitMin', 'timeOut', 'timeRet', 'startDate']
      .forEach(function (id) { $(id).addEventListener('change', scheduleQuote); });
    ['schoolName', 'children'].forEach(function (id) { $(id).addEventListener('input', scheduleQuote); });

    $('btnVoucher').addEventListener('click', function () {
      VOUCHER = $('voucher').value.trim();
      var msg = $('voucherMsg');
      if (!VOUCHER) { msg.hidden = true; scheduleQuote(); return; }
      msg.hidden = false; msg.className = 'hint'; msg.textContent = 'A validar…';
      if (!ready()) {
        msg.className = 'hint';
        msg.textContent = 'Preencha primeiro a viagem — o desconto depende do valor.';
        return;
      }
      clearTimeout(quoteTimer);
      runQuote().then(function (q) {
        var v = q && q.voucher;
        if (v && v.valid) {
          msg.className = 'hint ok';
          msg.textContent = '✓ Código ' + v.code + ' aplicado — desconto de ' + eur(v.discount_amount) + '.';
        } else {
          msg.className = 'hint bad';
          msg.textContent = (v && v.reason) || 'Não foi possível validar o código.';
          VOUCHER = '';
          runQuote();   // volta ao valor sem desconto
        }
      });
    });

    $('terms').addEventListener('change', function () {
      $('btnGo').disabled = KIND === 'school'
        ? !schoolReady()
        : !(QUOTE && QUOTE.ok && $('terms').checked);
    });

    $('mbway').addEventListener('input', function () { $('mbway').classList.remove('bad'); });
    $('btnGo').addEventListener('click', submit);
    $('form').addEventListener('submit', function (e) { e.preventDefault(); });

    // Com o teclado aberto, a barra fixa do preço tapa metade do ecrã e ainda
    // esconde o campo que se está a preencher. O visualViewport encolhe quando
    // o teclado sobe — é o único sinal fiável disto no iOS.
    if (window.visualViewport) {
      var vv = window.visualViewport;
      vv.addEventListener('resize', function () {
        document.body.classList.toggle('kb', (window.innerHeight - vv.height) > 150);
      });
    }
  }

  wire();
  boot();
})();
