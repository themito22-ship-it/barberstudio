/* ==========================================================================
   BARBER STUDIO — admin.js
   Lógica do painel administrativo: login simples, dashboard, listagem,
   filtros, edição e cancelamento de agendamentos.
   ========================================================================== */

/*
  ATENÇÃO SOBRE SEGURANÇA DA SENHA:
  Esta é uma proteção simples do lado do cliente (client-side), adequada para
  uma barbearia pequena que só precisa impedir acesso casual ao painel.
  Ela NÃO substitui autenticação real. Se no futuro você quiser mais
  segurança, o ideal é usar o Supabase Auth (login de verdade com e-mail/senha).
  Por enquanto, troque a senha abaixo por uma senha forte só sua.
*/
const ADMIN_SENHA = "barbershop@22"; // <-- TROQUE ESTA SENHA
const NOMES_SERVICOS = {
  corte: "Corte Masculino",
  barba: "Barba",
  corte_barba: "Corte + Barba",
  pigmentacao: "Pigmentação",
  sobrancelha: "Sobrancelha",
};

const HORARIOS_DIA = [
  "09:00", "09:40", "10:20", "11:00", "11:40",
  "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00", "18:40",
];

let todosAgendamentosCache = [];

document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initFiltros();
  initModalEdicao();
});

/* ==========================================================================
   LOGIN
   ========================================================================== */

function initLogin() {
  const form = document.getElementById("form-login");
  const senhaInput = document.getElementById("admin-senha");
  const erroMsg = document.getElementById("login-error");

  // Mantém sessão simples enquanto a aba estiver aberta (sessionStorage)
  if (sessionStorage.getItem("bs_admin_logado") === "true") {
    entrarNoPainel();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (senhaInput.value === ADMIN_SENHA) {
      sessionStorage.setItem("bs_admin_logado", "true");
      erroMsg.classList.remove("show");
      entrarNoPainel();
    } else {
      erroMsg.classList.add("show");
    }
  });

  document.getElementById("btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem("bs_admin_logado");
    document.getElementById("admin-shell").classList.remove("visible");
    document.getElementById("login-screen").style.display = "flex";
    senhaInput.value = "";
  });
}

function entrarNoPainel() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("admin-shell").classList.add("visible");
  carregarDados();
}

/* ==========================================================================
   CARREGAMENTO E RENDERIZAÇÃO
   ========================================================================== */

async function carregarDados(filtros = {}) {
  const agendamentos = await adminBuscarAgendamentos(filtros);
  todosAgendamentosCache = agendamentos;
  renderizarTabela(agendamentos);

  // Dashboard usa sempre o conjunto completo (sem filtro) para números reais
  const todos = Object.keys(filtros).length ? await adminBuscarAgendamentos({}) : agendamentos;
  renderizarDashboard(todos);
}

function renderizarTabela(agendamentos) {
  const tbody = document.getElementById("tabela-agendamentos");
  const vazio = document.getElementById("tabela-vazia");

  if (!agendamentos || agendamentos.length === 0) {
    tbody.innerHTML = "";
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  tbody.innerHTML = agendamentos
    .map((a) => {
      const statusClasse = a.status === "cancelado" ? "cancelado" : "confirmado";
      const statusTexto = a.status === "cancelado" ? "Cancelado" : "Confirmado";
      const dataFormatada = formatarDataBR(a.data);

      return `
        <tr data-id="${a.id}">
          <td>${escapeHtml(a.nome)}</td>
          <td>${escapeHtml(a.telefone)}</td>
          <td>${NOMES_SERVICOS[a.servico] || a.servico}</td>
          <td>${dataFormatada}</td>
          <td>${a.horario}</td>
          <td><span class="status-badge ${statusClasse}">${statusTexto}</span></td>
          <td>${a.codigo_cancelamento || "—"}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" title="Editar" data-acao="editar" data-id="${a.id}">✎</button>
              ${
                a.status !== "cancelado"
                  ? `<button class="icon-btn danger" title="Cancelar" data-acao="cancelar" data-id="${a.id}">✕</button>`
                  : `<button class="icon-btn danger" title="Excluir definitivamente" data-acao="excluir" data-id="${a.id}">🗑</button>`
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-acao]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const acao = btn.getAttribute("data-acao");
      if (acao === "editar") abrirModalEdicao(id);
      if (acao === "cancelar") tratarCancelamentoAdmin(id);
      if (acao === "excluir") tratarExclusaoAdmin(id);
    });
  });
}

function renderizarDashboard(agendamentos) {
  const confirmados = agendamentos.filter((a) => a.status === "confirmado");
  const hojeISO = formatarDataISO(new Date());
  const doDia = confirmados.filter((a) => a.data === hojeISO);

  document.getElementById("dash-total").textContent = confirmados.length;
  document.getElementById("dash-hoje").textContent = doDia.length;

  // Serviço mais vendido
  const contagem = {};
  confirmados.forEach((a) => {
    contagem[a.servico] = (contagem[a.servico] || 0) + 1;
  });
  const topServicoKey = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];

  if (topServicoKey) {
    document.getElementById("dash-top-servico").textContent = NOMES_SERVICOS[topServicoKey] || topServicoKey;
    document.getElementById("dash-top-servico-qtd").textContent = `${contagem[topServicoKey]} agendamento(s)`;
  } else {
    document.getElementById("dash-top-servico").textContent = "—";
    document.getElementById("dash-top-servico-qtd").textContent = "";
  }

  // Horários livres hoje
  const ocupadosHoje = doDia.map((a) => a.horario);
  const livres = HORARIOS_DIA.filter((h) => !ocupadosHoje.includes(h)).length;
  document.getElementById("dash-livres").textContent = livres;
}

/* ==========================================================================
   FILTROS
   ========================================================================== */

function initFiltros() {
  const filtroData = document.getElementById("filtro-data");
  const filtroServico = document.getElementById("filtro-servico");
  const filtroCliente = document.getElementById("filtro-cliente");
  const btnLimpar = document.getElementById("btn-limpar-filtros");

  let debounceTimer = null;
  const aplicarFiltros = () => {
    const filtros = {};
    if (filtroData.value) filtros.data = filtroData.value;
    if (filtroServico.value) filtros.servico = filtroServico.value;
    if (filtroCliente.value.trim()) filtros.cliente = filtroCliente.value.trim();
    carregarDados(filtros);
  };

  filtroData.addEventListener("change", aplicarFiltros);
  filtroServico.addEventListener("change", aplicarFiltros);
  filtroCliente.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(aplicarFiltros, 350);
  });

  btnLimpar.addEventListener("click", () => {
    filtroData.value = "";
    filtroServico.value = "";
    filtroCliente.value = "";
    carregarDados({});
  });
}

/* ==========================================================================
   AÇÕES: CANCELAR / EXCLUIR / EDITAR
   ========================================================================== */

async function tratarCancelamentoAdmin(id) {
  const confirmar = window.confirm("Tem certeza que deseja cancelar este agendamento? O horário será liberado imediatamente.");
  if (!confirmar) return;

  const ok = await adminCancelarAgendamento(id);
  if (ok) {
    recarregarComFiltrosAtuais();
  } else {
    alert("Não foi possível cancelar. Tente novamente.");
  }
}

async function tratarExclusaoAdmin(id) {
  const confirmar = window.confirm("Excluir definitivamente este registro do banco de dados? Esta ação não pode ser desfeita.");
  if (!confirmar) return;

  const ok = await adminExcluirAgendamento(id);
  if (ok) {
    recarregarComFiltrosAtuais();
  } else {
    alert("Não foi possível excluir. Tente novamente.");
  }
}

function initModalEdicao() {
  const overlay = document.getElementById("modal-editar");
  const form = document.getElementById("form-editar");
  const btnCancelar = document.getElementById("btn-cancelar-modal");

  btnCancelar.addEventListener("click", () => overlay.classList.remove("show"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("show");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editar-id").value;

    const novosDados = {
      nome: document.getElementById("editar-nome").value.trim(),
      telefone: document.getElementById("editar-telefone").value.trim(),
      servico: document.getElementById("editar-servico").value,
      data: document.getElementById("editar-data").value,
      horario: document.getElementById("editar-horario").value,
    };

    if (!novosDados.nome || !novosDados.telefone || !novosDados.data || !novosDados.horario) {
      alert("Preencha todos os campos.");
      return;
    }

    const ok = await adminAtualizarAgendamento(id, novosDados);
    if (ok) {
      overlay.classList.remove("show");
      recarregarComFiltrosAtuais();
    } else {
      alert("Não foi possível salvar as alterações.");
    }
  });
}

function abrirModalEdicao(id) {
  const agendamento = todosAgendamentosCache.find((a) => String(a.id) === String(id));
  if (!agendamento) return;

  document.getElementById("editar-id").value = agendamento.id;
  document.getElementById("editar-nome").value = agendamento.nome;
  document.getElementById("editar-telefone").value = agendamento.telefone;
  document.getElementById("editar-servico").value = agendamento.servico;
  document.getElementById("editar-data").value = agendamento.data;
  document.getElementById("editar-horario").value = agendamento.horario;

  document.getElementById("modal-editar").classList.add("show");
}

function recarregarComFiltrosAtuais() {
  const filtros = {};
  const filtroData = document.getElementById("filtro-data").value;
  const filtroServico = document.getElementById("filtro-servico").value;
  const filtroCliente = document.getElementById("filtro-cliente").value.trim();
  if (filtroData) filtros.data = filtroData;
  if (filtroServico) filtros.servico = filtroServico;
  if (filtroCliente) filtros.cliente = filtroCliente;
  carregarDados(filtros);
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
