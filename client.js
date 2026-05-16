// ============================================================
// CLIENT.JS — J&E Estética Automotiva
// Suporte a múltiplos serviços por agendamento
// ============================================================

// ---- Estado global ----
const state = {
  selectedServices:   [],   // array de serviços selecionados
  selectedSpecialist: null,
  selectedDate:       null,
  selectedTime:       null,
  services:           [],
  specialists:        [],
  settings:           { inicio: '08:00', fim: '18:00', diasSemana: [1,2,3,4,5,6] }
};

// ---- Toast ----
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = 'tst ' + ({ success:'tst-ok', error:'tst-err', info:'tst-inf', warning:'tst-warn' }[type] || 'tst-inf');
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('tc').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---- Navegação ----
const PAGES = ['inicio','servicos','agendar','galeria','contato'];

function nav(name) {
  PAGES.forEach(p => {
    const el = document.getElementById('pg-' + p);
    if (el) el.classList.toggle('on', p === name);
  });
  document.querySelectorAll('.nb').forEach((btn, i) => {
    btn.classList.toggle('on', PAGES[i] === name);
  });
  const el = document.getElementById('pg-' + name);
  if (el) el.scrollTop = 0;

  if (name === 'galeria') loadGallery();
  if (name === 'agendar') updateBookingSummary();
  if (name === 'contato') loadContactSpecialists();
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  setupWhatsApp();
  setupMaps();
  document.getElementById('btn-confirm-booking')?.addEventListener('click', confirmBooking);
  await loadSettings();
  generateDates();
  await loadServices();
  await loadSpecialists();
});

// ---- Configurações ----
async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc('horarios').get();
    if (doc.exists) {
      state.settings = { ...state.settings, ...doc.data() };
      const h = document.getElementById('hero-horario');
      if (h) {
        h.textContent = state.settings.inicio + '–' + state.settings.fim;
      }
    }
  } catch(e) { console.error(e); }
}

// ---- Serviços ----
async function loadServices() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;
  try {
    const snap = await db.collection('services').where('ativo','==',true).get();
    state.services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderServices();
  } catch(e) {
    grid.innerHTML = '<div style="color:#FF4D4F;padding:20px;grid-column:1/-1">Erro ao carregar serviços</div>';
  }
}

function renderServices() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;
  if (!state.services.length) {
    grid.innerHTML = '<p style="color:#8A9BB8;grid-column:1/-1;padding:20px;text-align:center">Nenhum serviço cadastrado ainda.</p>';
    return;
  }
  grid.innerHTML = state.services.map(s => `
    <div class="scard" id="sc-${s.id}" onclick="toggleService('${s.id}')">
      <div class="simg">
        ${s.fotoUrl ? `<img src="${s.fotoUrl}" alt="${s.nome}" loading="lazy">` : '🚗'}
        <span class="sdur-badge">⏱ ${s.duracao||30} min</span>
      </div>
      <div class="sinf">
        <div class="snom">${s.nome}</div>
        <div class="sdesc">${s.descricao || ''}</div>
        <div class="smeta">
          <div class="spreco">${s.preco ? 'R$ '+Number(s.preco).toFixed(2) : 'Consultar'}</div>
        </div>
      </div>
    </div>`).join('');
  updateServiceCards();
}

// Alterna seleção de serviço (multi-select)
function toggleService(id) {
  const svc = state.services.find(s => s.id === id);
  if (!svc) return;

  const idx = state.selectedServices.findIndex(s => s.id === id);
  if (idx >= 0) {
    state.selectedServices.splice(idx, 1); // remove
  } else {
    state.selectedServices.push(svc);       // adiciona
  }

  updateServiceCards();
  updateServicePreview();
  if (state.selectedDate) loadSlots();
  updateBookingSummary();
}

function updateServiceCards() {
  const ids = new Set(state.selectedServices.map(s => s.id));
  document.querySelectorAll('.scard').forEach(c => {
    const id = c.id.replace('sc-', '');
    c.classList.toggle('sel', ids.has(id));
  });
}

// Calcula totais
function getTotalDuration() {
  return state.selectedServices.reduce((acc, s) => acc + (s.duracao || 30), 0);
}
function getTotalPrice() {
  return state.selectedServices.reduce((acc, s) => acc + (Number(s.preco) || 0), 0);
}

// Preview dos serviços selecionados na aba Agendar
function updateServicePreview() {
  const prev = document.getElementById('sum-service-preview');
  if (!prev) return;

  if (!state.selectedServices.length) {
    prev.innerHTML = '<span style="color:#8A9BB8;font-size:13px">Nenhum serviço selecionado ainda</span>';
    return;
  }

  const total = getTotalDuration();
  const price = getTotalPrice();

  prev.innerHTML = state.selectedServices.map(s =>
    `<div class="selected-svc-tag">
      <span class="svc-nome">${s.nome}</span>
      <span class="svc-meta">⏱ ${s.duracao||30}min${s.preco ? ' · R$ '+Number(s.preco).toFixed(2) : ''}</span>
      <button class="svc-rm" onclick="toggleService('${s.id}');event.stopPropagation()">✕</button>
    </div>`
  ).join('') +
  (state.selectedServices.length > 1 ? `
    <div class="svc-totals">
      <span>⏱ Total: <strong>${total} min</strong></span>
      ${price > 0 ? `<span>💰 Total: <strong>R$ ${price.toFixed(2)}</strong></span>` : ''}
    </div>` : '');
}

// ---- Especialistas ----
async function loadSpecialists() {
  const row = document.getElementById('specialists-row');
  if (!row) return;
  try {
    const snap = await db.collection('specialists').where('ativo','==',true).get();
    state.specialists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSpecialists();
  } catch(e) { console.error(e); }
}

function renderSpecialists() {
  const row = document.getElementById('specialists-row');
  if (!row) return;

  const todos = `<div class="specc sel" id="spc-any" onclick="selectSpecialist(null)">
    <img src="https://ui-avatars.com/api/?name=?&background=1A1A1A&color=D4AF37&bold=true&size=52" alt="">
    <div class="specc-info">
      <span class="spnome">Qualquer</span>
      <span class="spesp">Disponível</span>
    </div>
  </div>`;

  const cards = state.specialists.map(sp => `
    <div class="specc" id="spc-${sp.id}" onclick="selectSpecialist('${sp.id}')">
      <img src="${sp.fotoUrl || 'https://ui-avatars.com/api/?name='+encodeURIComponent(sp.nome)+'&background=1A1A1A&color=D4AF37&bold=true&size=52'}" alt="${sp.nome}">
      <div class="specc-info">
        <span class="spnome">${sp.nome.split(' ')[0]}</span>
        <span class="spesp">${(sp.especialidades||[]).slice(0,2).join(' · ')}</span>
      </div>
    </div>`).join('');

  row.innerHTML = todos + cards;
}

function selectSpecialist(id) {
  state.selectedSpecialist = id ? state.specialists.find(s => s.id === id) : null;
  document.querySelectorAll('.specc').forEach(c => c.classList.remove('sel'));
  const el = id ? document.getElementById('spc-'+id) : document.getElementById('spc-any');
  if (el) el.classList.add('sel');
  updateBookingSummary();
}

// ---- Galeria ----
async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  if (grid.dataset.loaded === 'true') return;
  grid.dataset.loaded = 'true';

  try {
    const snap = await db.collection('gallery').orderBy('uploadedAt','desc').limit(10).get();
    if (snap.empty) {
      grid.innerHTML = '<p style="grid-column:1/-1;color:#8A9BB8;text-align:center;padding:40px">Galeria em breve...</p>';
      return;
    }
    grid.innerHTML = snap.docs.map(d => {
      const { fotoUrl, legenda } = d.data();
      return `<div class="gitem" onclick="openLightbox('${fotoUrl}')"><img src="${fotoUrl}" alt="${legenda||''}" loading="lazy"></div>`;
    }).join('');
  } catch(e) { console.error(e); }
}

function openLightbox(url) {
  const lb = document.getElementById('lb');
  lb.querySelector('img').src = url;
  lb.style.display = 'flex';
}

// ---- Contato dinâmico ----
async function loadContactSpecialists() {
  const container = document.getElementById('contact-specialists');
  if (!container || container.dataset.loaded === 'true') return;
  container.dataset.loaded = 'true';

  // Usa especialistas já carregados ou busca novamente
  let specs = state.specialists;
  if (!specs.length) {
    try {
      const snap = await db.collection('specialists').where('ativo','==',true).get();
      specs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error(e); }
  }

  if (!specs.length) {
    container.innerHTML = '<p style="color:#8A9BB8;text-align:center;padding:20px">Nenhum especialista cadastrado.</p>';
    return;
  }

  container.innerHTML = specs.map(sp => {
    const foto = sp.fotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(sp.nome)}&background=1A1F2E&color=D4AF37&bold=true&size=96`;
    const fone = sp.fone ? sp.fone.replace(/\D/g,'') : '';
    const waNum = fone.startsWith('55') ? fone : '55' + fone;
    const msg = encodeURIComponent('Olá, ' + sp.nome.split(' ')[0] + '! Vim pelo site da J&E Estética 🚗');
    const waLink = fone ? `https://wa.me/${waNum}?text=${msg}` : '#';

    return `
    <div class="ctcard">
      <div class="ctav-foto">
        <img src="${foto}" alt="${sp.nome}" class="ctav-img">
      </div>
      <div>
        <div class="ctnome">${sp.nome}</div>
        ${sp.especialidades?.length ? `<div class="ctesp">${sp.especialidades.join(' · ')}</div>` : ''}
        <div class="ctfone">${sp.fone || '—'}</div>
        <a class="btn btn-wa btn-sm" href="${waLink}" target="_blank" rel="noopener noreferrer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </a>
      </div>
    </div>`;
  }).join('');
}

// ---- Datas ----
function generateDates() {
  const container = document.getElementById('date-picker');
  if (!container) return;
  const { diasSemana } = state.settings;
  const dias  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const today = new Date(); today.setHours(0,0,0,0);

  container.innerHTML = '';
  let count = 0;

  for (let i = 0; i < 30 && count < 14; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (diasSemana && !diasSemana.includes(dow)) continue;
    count++;

    const iso = d.toISOString().split('T')[0];
    const btn = document.createElement('button');
    btn.className = 'dbtn' + (iso === state.selectedDate ? ' sel' : '');
    btn.setAttribute('data-date', iso);
    btn.innerHTML = `<span class="dn">${dias[dow]}</span><span class="dd">${d.getDate()}</span><span class="dm">${meses[d.getMonth()]}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dbtn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      state.selectedDate = iso;
      state.selectedTime = null;
      loadSlots();
      updateBookingSummary();
    });
    container.appendChild(btn);
  }

  if (count === 0) {
    container.innerHTML = '<p style="color:#8A9BB8;font-size:13px">Nenhum dia de atendimento configurado.</p>';
  }
}

// ---- Slots ----
async function loadSlots() {
  const grid = document.getElementById('slots-grid');
  if (!grid || !state.selectedDate) return;
  grid.innerHTML = '<span class="sp"></span>';

  const dur = getTotalDuration() || 30;
  const slots = gerarSlots(state.settings.inicio, state.settings.fim, dur);

  try {
    // Busca só por data (único where = sem índice composto necessário)
    // Filtra status em JS para evitar erro de índice com operador 'in'
    const snap = await db.collection('appointments')
      .where('data', '==', state.selectedDate)
      .get();

    const ocupados = new Set();
    snap.docs.forEach(doc => {
      const d = doc.data();
      // Ignora cancelados/concluídos
      if (d.status === 'cancelado' || d.status === 'concluido') return;
      const durApt = d.totalDuracao || d.duracao || 30;
      const startMin = timeToMin(d.hora);
      slots.forEach(sl => {
        const slMin = timeToMin(sl);
        if (slMin >= startMin && slMin < startMin + durApt) {
          ocupados.add(sl);
        }
      });
    });

    if (!slots.length) {
      grid.innerHTML = '<p style="color:#8A9BB8;font-size:13px">Nenhum horário disponível.</p>';
      return;
    }

    // Verifica horários passados para o dia de hoje
    const nowDate = new Date();
    const todayStr = nowDate.toISOString().split('T')[0];
    const isToday = state.selectedDate === todayStr;
    const nowMin = isToday ? nowDate.getHours() * 60 + nowDate.getMinutes() : -1;

    grid.innerHTML = slots.map(t => {
      const occ = ocupados.has(t);
      const past = isToday && timeToMin(t) <= nowMin;
      const off = occ || past;
      return `<button class="slbtn ${occ ? 'occ' : ''} ${past ? 'past' : ''} ${t === state.selectedTime ? 'sel' : ''}"
        ${off ? 'disabled' : `onclick="selectTime('${t}')"`}>${t}</button>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = '<p style="color:#FF4D4F">Erro ao carregar horários</p>';
  }
}

function timeToMin(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function gerarSlots(inicio, fim, durMin) {
  const slots = [];
  let [h, m] = inicio.split(':').map(Number);
  const [fh, fm] = fim.split(':').map(Number);
  const fimMin = fh * 60 + fm;
  while (h * 60 + m + durMin <= fimMin) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += durMin;
    if (m >= 60) { h += Math.floor(m/60); m = m % 60; }
  }
  return slots;
}

function selectTime(t) {
  state.selectedTime = t;
  document.querySelectorAll('.slbtn').forEach(b => {
    b.classList.toggle('sel', b.textContent.trim() === t);
  });
  updateBookingSummary();
}

// ---- Resumo ----
function updateBookingSummary() {
  updateServicePreview();

  const sp    = state.selectedSpecialist;
  const d     = state.selectedDate;
  const t     = state.selectedTime;
  const price = getTotalPrice();
  const dur   = getTotalDuration();

  const fmtDate = d
    ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })
    : '—';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Resumo de serviços (summary card)
  const svcEl = document.getElementById('sum-service');
  if (svcEl) {
    if (!state.selectedServices.length) {
      svcEl.textContent = '—';
    } else if (state.selectedServices.length === 1) {
      svcEl.textContent = state.selectedServices[0].nome;
    } else {
      svcEl.textContent = state.selectedServices.map(s => s.nome).join(', ');
    }
  }

  set('sum-specialist', sp?.nome || 'Qualquer especialista');
  set('sum-date',       fmtDate);
  set('sum-time',       t || '—');

  const priceEl = document.getElementById('sum-price');
  if (priceEl) {
    priceEl.textContent = price > 0 ? 'R$ ' + price.toFixed(2) : '—';
  }

  const durEl = document.getElementById('sum-duration');
  if (durEl) {
    durEl.textContent = dur ? dur + ' min' : '—';
  }
}

// ---- Confirmar agendamento ----
async function confirmBooking() {
  const nome  = document.getElementById('client-name')?.value?.trim();
  const fone  = document.getElementById('client-phone')?.value?.trim();

  if (!state.selectedServices.length) { toast('Selecione pelo menos um serviço', 'error'); nav('servicos'); return; }
  if (!state.selectedDate)            { toast('Selecione uma data', 'error'); return; }
  if (!state.selectedTime)            { toast('Selecione um horário', 'error'); return; }
  if (!nome)                          { toast('Informe seu nome', 'error'); return; }
  if (!fone)                          { toast('Informe seu WhatsApp', 'error'); return; }

  const btn = document.getElementById('btn-confirm-booking');
  btn.disabled = true;
  btn.innerHTML = '<span class="sp"></span> Agendando...';

  const totalPreco   = getTotalPrice();
  const totalDuracao = getTotalDuration();
  const serviceNome  = state.selectedServices.map(s => s.nome).join(', ');
  const serviceIds   = state.selectedServices.map(s => s.id);

  try {
    await db.collection('appointments').add({
      clienteNome:    nome,
      clienteFone:    fone,
      // Compatibilidade: guarda o primeiro serviço no campo legado + array completo
      serviceId:      state.selectedServices[0].id,
      serviceNome:    serviceNome,
      services:       state.selectedServices.map(s => ({ id: s.id, nome: s.nome, preco: s.preco || 0, duracao: s.duracao || 30 })),
      serviceIds,
      specialistId:   state.selectedSpecialist?.id || null,
      specialistNome: state.selectedSpecialist?.nome || 'A definir',
      data:           state.selectedDate,
      hora:           state.selectedTime,
      preco:          totalPreco,
      totalDuracao:   totalDuracao,
      status:         'pendente',
      createdAt:      firebase.firestore.FieldValue.serverTimestamp()
    });

    // Reset
    state.selectedServices = [];
    state.selectedTime     = null;
    state.selectedDate     = null;
    document.getElementById('client-name').value  = '';
    document.getElementById('client-phone').value = '';
    updateServiceCards();
    generateDates();
    updateBookingSummary();
    document.getElementById('modal-ok').style.display = 'flex';

  } catch(e) {
    toast('Erro ao agendar. Tente novamente.', 'error');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🎯 Confirmar Agendamento';
  }
}

// ---- WhatsApp ----
function setupWhatsApp() {
  // Os números hardcoded em index.html continuam funcionando
  const nums = { edielson: '5511949322857', jadson: '5511943324633' };
  const msg  = encodeURIComponent('Olá! Vim pelo site e gostaria de falar com um especialista 🚗');
  document.querySelectorAll('[data-whatsapp]').forEach(el => {
    const num = nums[el.getAttribute('data-whatsapp')] || nums.edielson;
    el.href   = `https://wa.me/${num}?text=${msg}`;
    el.target = '_blank';
    el.rel    = 'noopener noreferrer';
  });
}

// ---- Google Maps ----
function setupMaps() {
  const end = 'Av+Alfredo+Barbosa,+1853+Jardim+Palmira+Guarulhos+SP';
  document.querySelectorAll('[data-maps]').forEach(el => {
    el.href   = `https://www.google.com/maps/search/?api=1&query=${end}`;
    el.target = '_blank';
    el.rel    = 'noopener noreferrer';
  });
}
