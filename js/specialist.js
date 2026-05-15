// ============================================================
// SPECIALIST.JS — Lógica da área do especialista
// ============================================================

let currentSpecialist = null;
let specialistData    = null;

function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    currentSpecialist = await checkSession('specialist');
    await loadSpecialistProfile();
    await loadGanhos();
    await loadMyAppointments();
    setupNav();
  } catch (e) {
    console.error('Specialist init:', e);
  }
});

// ---- Perfil ----
async function loadSpecialistProfile() {
  if (!currentSpecialist.specialistId) return;
  const doc = await db.collection('specialists').doc(currentSpecialist.specialistId).get();
  if (!doc.exists) return;
  specialistData = { id: doc.id, ...doc.data() };
  renderProfile();
}



// ============================================================
// MEUS GANHOS
// ============================================================

let _specAllApts = [];   // cache de todos os agendamentos do especialista
let _specPeriod  = 'semana';

function changeGanhosPeriod(btn, period) {
  _specPeriod = period;
  document.querySelectorAll('#ganhos-period-btns .filter-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGanhos(_specAllApts, period);
}

function getSpecPeriodRange(period) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  if (period === 'total') return { ini: '0000-00-00', fim: '9999-99-99' };

  if (period === 'semana') {
    const dow = now.getDay();
    const ini = new Date(now); ini.setDate(now.getDate() - dow);
    const fim = new Date(now); fim.setDate(now.getDate() + (6 - dow));
    return { ini: ini.toISOString().split('T')[0], fim: fim.toISOString().split('T')[0] };
  }

  if (period === 'mes') {
    const ini = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    return { ini, fim: today };
  }

  if (period === 'ano') {
    const ini = `${now.getFullYear()}-01-01`;
    return { ini, fim: today };
  }

  return { ini: '0000-00-00', fim: '9999-99-99' };
}

function renderGanhos(all, period) {
  const valorEl   = document.getElementById('ganhos-valor');
  const subEl     = document.getElementById('ganhos-sub');
  const labelEl   = document.getElementById('ganhos-label');
  const detalheEl = document.getElementById('ganhos-detalhe');
  if (!valorEl) return;

  const labels = { semana:'Esta Semana', mes:'Este Mês', ano:'Este Ano', total:'Total Geral' };
  if (labelEl) labelEl.textContent = labels[period] || '';

  const { ini, fim } = getSpecPeriodRange(period);

  // Filtra todos os agendamentos concluídos do especialista (sem restrição de período)
  const todosConc = all.filter(a => a.status === 'concluido');

  // Filtra pelo período selecionado (para o hero)
  const concluidos = todosConc.filter(a => a.data >= ini && a.data <= fim);

  const totalVal = concluidos.reduce((s, a) => s + (Number(a.preco) || 0), 0);
  valorEl.textContent = 'R$ ' + totalVal.toFixed(2);
  subEl.textContent   = `${concluidos.length} serviço${concluidos.length !== 1 ? 's' : ''} concluído${concluidos.length !== 1 ? 's' : ''}`;

  if (!detalheEl) return;

  // ---- Sempre monta as barras do período, independente de ter dados ----
  let linhas = [];

  if (period === 'semana') {
    const dias   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const now    = new Date();
    const dow    = now.getDay();
    const semIni = new Date(now); semIni.setDate(now.getDate() - dow);
    const todayIso = now.toISOString().split('T')[0];

    linhas = Array.from({ length: 7 }, (_, i) => {
      const d   = new Date(semIni); d.setDate(semIni.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const apts = todosConc.filter(a => a.data === iso);  // usa todosConc (sem filtro de período)
      const val  = apts.reduce((s, a) => s + (Number(a.preco) || 0), 0);
      return { label: dias[d.getDay()] + ' ' + d.getDate(), val, qtd: apts.length, today: iso === todayIso };
    });

  } else if (period === 'mes') {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    // Quantas semanas tem o mês atual
    const diasNoMes = new Date(ano, mes, 0).getDate();
    const numSemanas = Math.ceil(diasNoMes / 7);
    const weeks = {};

    // Usa concluidos filtrados pelo mês
    concluidos.forEach(a => {
      const day = parseInt(a.data.slice(8, 10));
      const wk  = Math.ceil(day / 7);
      const key = `Sem ${wk}`;
      if (!weeks[key]) weeks[key] = { val: 0, qtd: 0 };
      weeks[key].val += Number(a.preco) || 0;
      weeks[key].qtd++;
    });

    linhas = Array.from({ length: numSemanas }, (_, i) => {
      const key = `Sem ${i+1}`;
      const dIni = i * 7 + 1;
      const dFim = Math.min((i+1) * 7, diasNoMes);
      return {
        label: `${dIni}–${dFim}`,
        val:   weeks[key]?.val || 0,
        qtd:   weeks[key]?.qtd || 0
      };
    });

  } else if (period === 'ano') {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const curMes = new Date().getMonth() + 1;
    const byMes  = {};

    // Usa todos os concluídos do ano atual
    const anoAtual = String(new Date().getFullYear());
    todosConc
      .filter(a => a.data.startsWith(anoAtual))
      .forEach(a => {
        const m = a.data.slice(5, 7);
        if (!byMes[m]) byMes[m] = { val: 0, qtd: 0 };
        byMes[m].val += Number(a.preco) || 0;
        byMes[m].qtd++;
      });

    linhas = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return {
        label:  meses[i],
        val:    byMes[m]?.val || 0,
        qtd:    byMes[m]?.qtd || 0,
        future: (i + 1) > curMes
      };
    });

  } else {
    // Total: agrupa por ano
    const byAno = {};
    todosConc.forEach(a => {
      const ano = a.data ? a.data.slice(0, 4) : 'N/A';
      if (!byAno[ano]) byAno[ano] = { val: 0, qtd: 0 };
      byAno[ano].val += Number(a.preco) || 0;
      byAno[ano].qtd++;
    });

    linhas = Object.entries(byAno)
      .sort()
      .map(([ano, { val, qtd }]) => ({ label: ano, val, qtd }));

    // Se nunca houve nenhum concluído, mostra mensagem
    if (!linhas.length) {
      detalheEl.innerHTML = '<p style="color:var(--text-2);font-size:13px;text-align:center;padding:20px">Nenhum serviço concluído ainda.</p>';
      return;
    }
  }

  const maxVal = Math.max(...linhas.map(l => l.val), 1);

  detalheEl.innerHTML = `
    <div class="ganhos-bars">
      ${linhas.map(l => `
        <div class="ganhos-bar-col ${l.today ? 'today' : ''} ${l.future ? 'future' : ''}">
          <div class="ganhos-bar-label-val">${l.val > 0 ? 'R$&nbsp;' + l.val.toFixed(0) : ''}</div>
          <div class="ganhos-bar-outer">
            <div class="ganhos-bar-inner" style="height:${l.val > 0 ? Math.max((l.val / maxVal) * 100, 4) : 0}%"></div>
          </div>
          <div class="ganhos-bar-label">${l.label}</div>
          <div class="ganhos-bar-qtd">${l.qtd > 0 ? l.qtd + '×' : ''}</div>
        </div>`
      ).join('')}
    </div>`;
}

async function loadGanhos() {
  if (!specialistData) return;
  try {
    const snap = await db.collection('appointments')
      .where('specialistId', '==', specialistData.id)
      .get();
    _specAllApts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGanhos(_specAllApts, _specPeriod);
  } catch(e) {
    const el = document.getElementById('ganhos-detalhe');
    if (el) el.innerHTML = '<p style="color:var(--danger);font-size:13px">Erro ao carregar ganhos.</p>';
    console.error(e);
  }
}

function renderProfile() {
  const sp = specialistData;
  const fotoEl = document.getElementById('prof-foto');
  const nomeEl = document.getElementById('prof-nome');
  const espEl  = document.getElementById('prof-esp');
  const foneEl = document.getElementById('prof-fone');
  const navNome = document.getElementById('nav-spec-nome');

  if (fotoEl) fotoEl.src = sp.fotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(sp.nome)}&background=1A1F2E&color=00D4FF&bold=true&size=128`;
  if (nomeEl) nomeEl.textContent = sp.nome;
  if (espEl)  espEl.textContent  = (sp.especialidades || []).join(' · ') || 'Especialista';
  if (foneEl) foneEl.textContent = sp.fone || '—';
  if (navNome) navNome.textContent = sp.nome?.split(' ')[0] || 'Especialista';
}

// ---- Alterar foto de perfil ----
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('foto-input')?.addEventListener('change', async function() {
    if (!this.files[0] || !specialistData) return;
    const btn = document.getElementById('btn-change-foto');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
    try {
      const url = await uploadToCloudinary(this.files[0], 'specialists');
      await db.collection('specialists').doc(specialistData.id).update({ fotoUrl: url });
      specialistData.fotoUrl = url;
      renderProfile();
      toast('Foto atualizada!', 'success');
    } catch (e) {
      toast('Erro ao atualizar foto: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '📷 Alterar Foto'; }
    }
  });

  document.getElementById('btn-logout-spec')?.addEventListener('click', logoutUser);
});

// ---- Meus agendamentos ----
async function loadMyAppointments(filter = 'todos') {
  const tbody = document.getElementById('my-appointments-tbody');
  if (!tbody || !specialistData) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px"><span class="spinner"></span></td></tr>';

  try {
    // Busca só por specialistId (sem orderBy = sem índice composto necessário)
    const snap = await db.collection('appointments')
      .where('specialistId', '==', specialistData.id)
      .get();

    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ordena data desc → hora desc em JS
    list.sort((a, b) => {
      const dc = (b.data || '').localeCompare(a.data || '');
      if (dc !== 0) return dc;
      return (b.hora || '').localeCompare(a.hora || '');
    });

    const today = new Date().toISOString().split('T')[0];

    // Stats sempre com total real (antes do filtro de aba)
    setVal('spec-total',    list.length);
    setVal('spec-hoje',     list.filter(a => a.data === today).length);
    setVal('spec-pendentes',list.filter(a => a.status === 'pendente').length);

    // Aplica filtro de aba
    const filtered = filter === 'todos' ? list : list.filter(a => a.status === filter);

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-2);padding:24px">Nenhum agendamento</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(a => {
      const acoes = [
        a.status === 'pendente'
          ? `<button class="btn btn-primary btn-sm" onclick="specUpdateStatus('${a.id}','confirmado')">✔ Confirmar</button>`
          : '',
        a.status === 'confirmado'
          ? `<button class="btn btn-success btn-sm" onclick="specUpdateStatus('${a.id}','concluido')">✅ Concluir</button>`
          : '',
      ].filter(Boolean).join('');

      return `
      <tr>
        <td>${formatDate(a.data)} <strong>${a.hora}</strong></td>
        <td>${a.clienteNome}</td>
        <td>${a.clienteFone}</td>
        <td>${a.serviceNome}</td>
        <td><span class="badge badge-${a.status}">${labelStatus(a.status)}</span></td>
        <td><div style="display:flex;gap:6px">${acoes}</div></td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--danger);padding:16px">Erro ao carregar</td></tr>';
    console.error(e);
  }
}

async function specUpdateStatus(id, status) {
  try {
    await db.collection('appointments').doc(id).update({
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    toast(status === 'confirmado' ? 'Agendamento confirmado! ✔' : 'Serviço concluído! ✅', 'success');
    const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'todos';
    await loadMyAppointments(activeFilter);
  } catch(e) {
    toast('Erro ao atualizar: ' + e.message, 'error');
  }
}

function setupNav() {
  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', () => showPage(item.getAttribute('data-page')));
  });
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadMyAppointments(btn.getAttribute('data-filter'));
    });
  });
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('visible');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
  });
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(i =>
    i.classList.toggle('active', i.getAttribute('data-page') === name));
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function labelStatus(s) {
  return { pendente:'Pendente', confirmado:'Confirmado', concluido:'Concluído', cancelado:'Cancelado' }[s] || s;
}
function formatDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}