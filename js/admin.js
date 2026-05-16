// ============================================================
// ADMIN.JS — Lógica da área administrativa
// ============================================================

let currentAdmin = null;

// ---- Toast ----
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentAdmin = await checkSession('admin');
    initAdminUI();
    await Promise.all([
      loadDashboard(),
      loadServices(),
      loadSpecialists(),
      loadGalleryAdmin(),
      loadSettings(),
      loadAllAppointments()
    ]);
  } catch (e) {
    console.error('Erro init admin:', e);
  }
});

function initAdminUI() {
  const adminName = document.getElementById('admin-name');
  if (adminName) adminName.textContent = currentAdmin.email?.split('@')[0] || 'Admin';

  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      showPage(page);
      closeSidebar();
    });
  });

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('visible');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  document.getElementById('btn-logout')?.addEventListener('click', logoutUser);
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(i => {
    i.classList.toggle('active', i.getAttribute('data-page') === name);
  });
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

// ============================================================
// DASHBOARD
// ============================================================

// Período ativo do painel de receita
let currentPeriod = 'mes';
let allAppointments = []; // cache para trocar período sem re-buscar

function changePeriod(btn, period) {
  currentPeriod = period;
  document.querySelectorAll('#receita-period-btns .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReceitaEspecialistas(allAppointments, period);
}

async function loadDashboard() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snap = await db.collection('appointments').get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allAppointments = all;

    const todayApts = all.filter(a => a.data === today);
    const pending   = all.filter(a => a.status === 'pendente');
    const confirmed = all.filter(a => a.status === 'confirmado');
    const totalRevenue = all
      .filter(a => a.status === 'concluido')
      .reduce((s, a) => s + (Number(a.preco) || 0), 0);

    setVal('stat-hoje',       todayApts.length);
    setVal('stat-pendentes',  pending.length);
    setVal('stat-confirmados',confirmed.length);
    setVal('stat-receita',    'R$ ' + totalRevenue.toFixed(2));

    renderRecentAppointments(todayApts.slice(0, 5));
    renderReceitaEspecialistas(all, currentPeriod);
  } catch (e) { console.error('Dashboard:', e); }
}

// Calcula o range de datas do período
function getPeriodRange(period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (period === 'total') return { ini: '0000-00-00', fim: '9999-99-99' };

  if (period === 'semana') {
    const dow = now.getDay(); // 0=dom
    const ini = new Date(now); ini.setDate(now.getDate() - dow);
    const fim = new Date(now); fim.setDate(now.getDate() + (6 - dow));
    return {
      ini: ini.toISOString().split('T')[0],
      fim: fim.toISOString().split('T')[0]
    };
  }

  // mês
  const ini = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const fim = today;
  return { ini, fim };
}

function renderReceitaEspecialistas(all, period) {
  const container = document.getElementById('receita-especialistas');
  if (!container) return;

  const { ini, fim } = getPeriodRange(period);

  // Filtra apenas concluídos dentro do período
  const concluidos = all.filter(a =>
    a.status === 'concluido' && a.data >= ini && a.data <= fim
  );

  // Agrega por especialista
  const mapa = {}; // specialistNome → { receita, qtd, foto }
  concluidos.forEach(a => {
    const nome = a.specialistNome || 'A definir';
    if (!mapa[nome]) mapa[nome] = { receita: 0, qtd: 0 };
    mapa[nome].receita += Number(a.preco) || 0;
    mapa[nome].qtd++;
  });

  // Inclui especialistas sem concluídos no período (mostra zerado)
  // (usamos allAppointments para pegar nomes conhecidos)
  all.forEach(a => {
    const nome = a.specialistNome;
    if (nome && nome !== 'A definir' && !mapa[nome]) {
      mapa[nome] = { receita: 0, qtd: 0 };
    }
  });

  const lista = Object.entries(mapa).sort((a, b) => b[1].receita - a[1].receita);
  const totalGeral = lista.reduce((s, [, v]) => s + v.receita, 0);

  if (!lista.length) {
    container.innerHTML = '<p style="color:var(--text-2);text-align:center;padding:16px">Nenhum dado no período.</p>';
    return;
  }

  const labelPeriodo = { mes: 'este mês', semana: 'esta semana', total: 'total geral' }[period];

  container.innerHTML = `
    <div style="margin-bottom:16px;font-size:13px;color:var(--text-2)">
      Receita <strong style="color:var(--text)">${labelPeriodo}</strong> · apenas serviços <span class="badge badge-concluido">Concluídos</span>
    </div>
    <div class="receita-list">
      ${lista.map(([nome, { receita, qtd }]) => {
        const pct = totalGeral > 0 ? (receita / totalGeral * 100).toFixed(1) : 0;
        const initials = nome.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
        return `
        <div class="receita-row">
          <div class="receita-avatar">${initials}</div>
          <div class="receita-info">
            <div class="receita-nome">${nome}</div>
            <div class="receita-bar-wrap">
              <div class="receita-bar" style="width:${pct}%"></div>
            </div>
            <div class="receita-meta">${qtd} serviço${qtd !== 1 ? 's' : ''} concluído${qtd !== 1 ? 's' : ''}</div>
          </div>
          <div class="receita-valor">
            <div class="receita-rs">R$ ${receita.toFixed(2)}</div>
            <div class="receita-pct">${pct}%</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="receita-total-row">
      <span>Total do período</span>
      <span style="color:var(--gold);font-family:var(--font-display);font-size:22px;font-weight:900">R$ ${totalGeral.toFixed(2)}</span>
    </div>`;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderRecentAppointments(list) {
  const tbody = document.getElementById('today-appointments');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-2);padding:24px">Nenhum agendamento hoje</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${a.hora}</td>
      <td><strong>${a.clienteNome}</strong></td>
      <td>${a.serviceNome}</td>
      <td>${a.specialistNome || '—'}</td>
      <td><span class="badge badge-${a.status}">${labelStatus(a.status)}</span></td>
    </tr>`).join('');
}

// ============================================================
// SERVIÇOS
// ============================================================
async function loadServices() {
  const container = document.getElementById('services-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-2)">Carregando...</p>';
  try {
    const snap = await db.collection('services').get();
    const services = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!services.length) {
      container.innerHTML = '<p style="color:var(--text-2)">Nenhum serviço cadastrado.</p>';
      return;
    }
    container.innerHTML = services.map(s => `
      <div class="admin-list-item">
        <div class="admin-list-img">
          ${s.fotoUrl ? `<img src="${s.fotoUrl}" alt="${s.nome}">` : '🚗'}
        </div>
        <div class="admin-list-info">
          <div class="admin-list-name">${s.nome}</div>
          <div class="admin-list-meta">
            ${s.preco ? 'R$ ' + Number(s.preco).toFixed(2) + ' · ' : ''}
            ⏱ ${s.duracao || 30} min
            ${s.ativo ? '' : ' · <span style="color:var(--danger)">Inativo</span>'}
          </div>
        </div>
        <div class="admin-list-actions">
          <button class="btn btn-outline btn-sm" onclick="editService('${s.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteService('${s.id}','${s.nome.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </div>`).join('');
  } catch (e) { console.error('Services:', e); }
}

function openServiceModal(service = null) {
  const modal = document.getElementById('service-modal');
  document.getElementById('service-modal-title').textContent = service ? 'Editar Serviço' : 'Novo Serviço';
  document.getElementById('service-id').value      = service?.id || '';
  document.getElementById('service-nome').value    = service?.nome || '';
  document.getElementById('service-desc').value    = service?.descricao || '';
  document.getElementById('service-preco').value   = service?.preco || '';
  document.getElementById('service-duracao').value = service?.duracao || '30';
  document.getElementById('service-ativo').checked = service?.ativo !== false;
  const prev = document.getElementById('service-foto-preview');
  if (service?.fotoUrl) {
    prev.src = service.fotoUrl;
    prev.style.display = 'block';
  } else {
    prev.src = '';
    prev.style.display = 'none';
  }
  document.getElementById('service-foto-input').value = '';
  modal.classList.remove('hidden');
}

async function editService(id) {
  const doc = await db.collection('services').doc(id).get();
  openServiceModal({ id, ...doc.data() });
}

function closeServiceModal() {
  document.getElementById('service-modal').classList.add('hidden');
}

async function saveService() {
  const id      = document.getElementById('service-id').value;
  const nome    = document.getElementById('service-nome').value.trim();
  const desc    = document.getElementById('service-desc').value.trim();
  const preco   = parseFloat(document.getElementById('service-preco').value) || 0;
  const duracao = parseInt(document.getElementById('service-duracao').value) || 30;
  const ativo   = document.getElementById('service-ativo').checked;
  const fotoInput = document.getElementById('service-foto-input');

  if (!nome) { toast('Informe o nome do serviço', 'error'); return; }

  const btn = document.getElementById('btn-save-service');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    let fotoUrl = '';
    // Mantém a foto existente se não foi trocada
    const prevSrc = document.getElementById('service-foto-preview').src;
    if (prevSrc && !prevSrc.startsWith('data:')) fotoUrl = prevSrc;

    if (fotoInput.files[0]) {
      toast('Enviando foto...', 'info');
      fotoUrl = await uploadToCloudinary(fotoInput.files[0], 'services');
    }

    const data = {
      nome, descricao: desc, preco, duracao, ativo, fotoUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
      await db.collection('services').doc(id).update(data);
      toast('Serviço atualizado!', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('services').add(data);
      toast('Serviço criado!', 'success');
    }
    closeServiceModal();
    loadServices();
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Salvar';
  }
}

async function deleteService(id, nome) {
  if (!confirm(`Excluir o serviço "${nome}"?`)) return;
  await db.collection('services').doc(id).delete();
  toast('Serviço removido', 'info');
  loadServices();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('service-foto-input')?.addEventListener('change', function() {
    if (this.files[0]) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.getElementById('service-foto-preview');
        img.src = e.target.result;
        img.style.display = 'block';
      };
      reader.readAsDataURL(this.files[0]);
    }
  });
});

// ============================================================
// ESPECIALISTAS
// ============================================================
async function loadSpecialists() {
  const container = document.getElementById('specialists-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--text-2)">Carregando...</p>';
  try {
    const snap = await db.collection('specialists').get();
    const specs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!specs.length) {
      container.innerHTML = '<p style="color:var(--text-2)">Nenhum especialista cadastrado.</p>';
      return;
    }
    container.innerHTML = specs.map(sp => `
      <div class="admin-list-item">
        <img class="admin-list-img avatar"
             src="${sp.fotoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sp.nome) + '&background=1A1F2E&color=D4AF37'}"
             alt="${sp.nome}" style="border-radius:50%;width:60px;height:60px;object-fit:cover">
        <div class="admin-list-info">
          <div class="admin-list-name">${sp.nome}</div>
          <div class="admin-list-meta">
            📱 ${sp.fone || '—'} ·
            🔧 ${(sp.especialidades || []).join(', ') || '—'}
            ${sp.ativo ? '' : ' · <span style="color:var(--danger)">Inativo</span>'}
          </div>
        </div>
        <div class="admin-list-actions">
          <button class="btn btn-outline btn-sm" onclick="editSpecialist('${sp.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSpecialist('${sp.id}','${sp.nome.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </div>`).join('');
  } catch (e) { console.error('Specialists:', e); }
}

function openSpecialistModal(sp = null) {
  const modal = document.getElementById('specialist-modal');
  document.getElementById('spec-modal-title').textContent = sp ? 'Editar Especialista' : 'Novo Especialista';
  document.getElementById('spec-id').value    = sp?.id || '';
  document.getElementById('spec-nome').value  = sp?.nome || '';
  document.getElementById('spec-fone').value  = sp?.fone || '';
  document.getElementById('spec-email').value = sp?.email || '';
  document.getElementById('spec-esp').value   = (sp?.especialidades || []).join(', ');
  document.getElementById('spec-ativo').checked = sp?.ativo !== false;
  document.getElementById('spec-foto-input').value = '';

  const prev = document.getElementById('spec-foto-preview');
  prev.src = sp?.fotoUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(sp?.nome || 'N')}&background=1A1F2E&color=D4AF37&bold=true&size=110`;

  // Campo de senha — só obrigatório para novo especialista
  const senhaGroup = document.getElementById('spec-senha-group');
  if (senhaGroup) senhaGroup.style.display = sp ? 'none' : 'flex';
  if (!sp) document.getElementById('spec-senha').value = '';

  modal.classList.remove('hidden');
}

async function editSpecialist(id) {
  const doc = await db.collection('specialists').doc(id).get();
  openSpecialistModal({ id, ...doc.data() });
}

function closeSpecialistModal() {
  document.getElementById('specialist-modal').classList.add('hidden');
}

async function saveSpecialist() {
  const id    = document.getElementById('spec-id').value;
  const nome  = document.getElementById('spec-nome').value.trim();
  const fone  = document.getElementById('spec-fone').value.trim();
  const email = document.getElementById('spec-email').value.trim();
  const esp   = document.getElementById('spec-esp').value.trim().split(',').map(s => s.trim()).filter(Boolean);
  const ativo = document.getElementById('spec-ativo').checked;
  const senha = document.getElementById('spec-senha').value;
  const fotoIn = document.getElementById('spec-foto-input');

  if (!nome) { toast('Informe o nome', 'error'); return; }
  if (!id && !email) { toast('Informe o e-mail', 'error'); return; }
  if (!id && senha.length < 6) { toast('A senha deve ter no mínimo 6 caracteres', 'error'); return; }

  const btn = document.getElementById('btn-save-specialist');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    let fotoUrl = '';
    const prevSrc = document.getElementById('spec-foto-preview').src;
    // Guarda URL do Cloudinary (começa com https), ignora avatar gerado
    if (prevSrc && prevSrc.startsWith('https://res.cloudinary.com')) fotoUrl = prevSrc;

    if (fotoIn.files[0]) {
      fotoUrl = await uploadToCloudinary(fotoIn.files[0], 'specialists');
    }

    const data = {
      nome, fone, email, especialidades: esp, ativo,
      ...(fotoUrl ? { fotoUrl } : {}),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
      await db.collection('specialists').doc(id).update(data);
      toast('Especialista atualizado!', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('specialists').add(data);
      try {
        const uid = await createSpecialistUser(email, senha, { id: ref.id });
        await ref.update({ userId: uid });
        toast('Especialista criado com acesso ao app!', 'success');
      } catch (authErr) {
        toast('Especialista salvo, mas erro na conta: ' + authErr.message, 'warning');
      }
    }
    closeSpecialistModal();
    loadSpecialists();
  } catch (e) {
    toast('Erro: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Salvar';
  }
}

async function deleteSpecialist(id, nome) {
  if (!confirm(`Excluir especialista "${nome}"?`)) return;
  await db.collection('specialists').doc(id).delete();
  toast('Especialista removido', 'info');
  loadSpecialists();
}

// ============================================================
// GALERIA
// ============================================================
async function loadGalleryAdmin() {
  const grid = document.getElementById('gallery-admin-grid');
  if (!grid) return;
  grid.innerHTML = '<p style="color:var(--text-2)">Carregando...</p>';
  try {
    const snap = await db.collection('gallery').orderBy('uploadedAt', 'desc').limit(10).get();
    const fotos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateGalleryCount(fotos.length);

    grid.innerHTML = fotos.map(f => `
      <div class="gallery-admin-item">
        <img src="${f.fotoUrl}" alt="${f.legenda || ''}">
        <button class="del-btn" onclick="deleteGalleryPhoto('${f.id}')" title="Remover">✕</button>
      </div>`).join('');

    if (fotos.length < 10) {
      grid.insertAdjacentHTML('beforeend', `
        <label class="gallery-add-slot" title="Adicionar foto">
          <span class="icon">📷</span>
          <span>Adicionar</span>
          <input type="file" accept="image/*" capture="environment" onchange="uploadGalleryPhoto(this)">
        </label>`);
    }
  } catch (e) { console.error('Gallery admin:', e); }
}

function updateGalleryCount(count) {
  const el = document.getElementById('gallery-count');
  if (el) el.textContent = `${count}/10 fotos`;
}

async function uploadGalleryPhoto(input) {
  if (!input.files[0]) return;
  const lbl = input.closest('label');
  if (lbl) { lbl.style.opacity = '0.5'; lbl.style.pointerEvents = 'none'; }
  try {
    const url = await uploadToCloudinary(input.files[0], 'gallery');
    const legenda = prompt('Legenda da foto (opcional):') || '';
    await db.collection('gallery').add({
      fotoUrl: url, legenda,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Foto adicionada!', 'success');
    loadGalleryAdmin();
  } catch (e) {
    toast('Erro ao enviar foto: ' + e.message, 'error');
    if (lbl) { lbl.style.opacity = '1'; lbl.style.pointerEvents = 'auto'; }
  }
}

async function deleteGalleryPhoto(id) {
  if (!confirm('Remover esta foto da galeria?')) return;
  await db.collection('gallery').doc(id).delete();
  toast('Foto removida', 'info');
  loadGalleryAdmin();
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
async function loadSettings() {
  try {
    const doc = await db.collection('settings').doc('horarios').get();
    if (doc.exists) {
      const { inicio, fim, diasSemana = [1,2,3,4,5,6] } = doc.data();
      const iEl = document.getElementById('hora-inicio');
      const fEl = document.getElementById('hora-fim');
      if (iEl) iEl.value = inicio || '08:00';
      if (fEl) fEl.value = fim    || '18:00';

      // Reset todos os toggles e aplica os salvos
      document.querySelectorAll('.dia-toggle').forEach(el => {
        el.classList.remove('checked');
        el.querySelector('.dia-check').textContent = '';
      });
      diasSemana.forEach(d => {
        const el = document.querySelector(`.dia-toggle[data-dia="${d}"]`);
        if (el) {
          el.classList.add('checked');
          el.querySelector('.dia-check').textContent = '✓';
        }
      });
    }
  } catch (e) { console.error('Settings:', e); }
}

async function saveSettings() {
  const inicio = document.getElementById('hora-inicio').value;
  const fim    = document.getElementById('hora-fim').value;
  const dias   = [...document.querySelectorAll('.dia-toggle.checked')]
                   .map(el => parseInt(el.getAttribute('data-dia')));

  if (!inicio || !fim) { toast('Informe os horários de abertura e fechamento', 'error'); return; }
  if (inicio >= fim)   { toast('Horário de abertura deve ser antes do fechamento', 'error'); return; }
  if (!dias.length)    { toast('Selecione pelo menos um dia de atendimento', 'error'); return; }

  const btn = document.getElementById('btn-save-settings');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvando...';
  try {
    await db.collection('settings').doc('horarios').set({
      inicio, fim, diasSemana: dias,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Configurações salvas!', 'success');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Salvar Configurações';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.dia-toggle[data-dia]').forEach(el => {
    function toggle(e) {
      e.preventDefault();
      e.stopPropagation();
      const checked = el.classList.toggle('checked');
      el.querySelector('.dia-check').textContent = checked ? '✓' : '';
    }
    el.addEventListener('touchend', toggle, { passive: false });
    el.addEventListener('click', toggle);
  });
});

// ============================================================
// AGENDAMENTOS
// ============================================================
async function loadAllAppointments(filter = 'todos') {
  const tbody = document.getElementById('appointments-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px"><span class="spinner"></span></td></tr>';

  try {
    // Sem orderBy no Firestore → sem índice necessário; ordenação feita em JS
    const snap = await db.collection('appointments').limit(200).get();

    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    list.sort((a, b) => {
      const dc = (b.data || '').localeCompare(a.data || '');
      if (dc !== 0) return dc;
      return (b.hora || '').localeCompare(a.hora || '');
    });

    if (filter !== 'todos') list = list.filter(a => a.status === filter);

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-2);padding:24px">Nenhum agendamento</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(a => `
      <tr>
        <td>${formatDate(a.data)}</td>
        <td><strong>${a.hora}</strong></td>
        <td>${a.clienteNome}</td>
        <td>${a.clienteFone}</td>
        <td title="${a.serviceNome}">${truncate(a.serviceNome, 28)}</td>
        <td>${a.specialistNome || '—'}</td>
        <td><span class="badge badge-${a.status}">${labelStatus(a.status)}</span></td>
        <td>
          <div class="actions-cell">
            ${a.status === 'pendente'   ? `<button class="btn btn-primary btn-sm" onclick="updateStatus('${a.id}','confirmado')">✔ Confirmar</button>` : ''}
            ${a.status === 'confirmado' ? `<button class="btn btn-success btn-sm" onclick="updateStatus('${a.id}','concluido')">✅ Concluir</button>` : ''}
            ${['pendente','confirmado'].includes(a.status) ? `<button class="btn btn-danger btn-sm" onclick="updateStatus('${a.id}','cancelado')">✕ Cancelar</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:var(--danger);padding:16px">Erro ao carregar</td></tr>';
    console.error(e);
  }
}

async function updateStatus(id, status) {
  await db.collection('appointments').doc(id).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  toast(`Status: ${labelStatus(status)}`, 'success');
  // Atualiza mantendo o filtro ativo
  const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'todos';
  loadAllAppointments(activeFilter);
  loadDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAllAppointments(btn.getAttribute('data-filter'));
    });
  });
});

// ============================================================
// Utilidades
// ============================================================
function labelStatus(s) {
  return { pendente:'Pendente', confirmado:'Confirmado', concluido:'Concluído', cancelado:'Cancelado' }[s] || s;
}
function formatDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}
