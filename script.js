/* ==========================================================================
   BARBER STUDIO — script.js
   Lógica do site: navegação, agendamento, disponibilidade, WhatsApp,
   cancelamento e animações.
   ========================================================================== */

const NUMERO_WHATSAPP = "5517988343422"; // formato internacional sem "+" nem espaços

const SERVICOS = {
  corte: { nome: "Corte Masculino", preco: 60, duracaoMin: 40 },
  barba: { nome: "Barba", preco: 40, duracaoMin: 30 },
  corte_barba: { nome: "Corte + Barba", preco: 90, duracaoMin: 60 },
  pigmentacao: { nome: "Pigmentação", preco: 50, duracaoMin: 30 },
  sobrancelha: { nome: "Sobrancelha", preco: 25, duracaoMin: 15 },
};

const HORARIOS_FUNCIONAMENTO = [
  "09:00", "09:40", "10:20", "11:00", "11:40",
  "14:00", "14:40", "15:20", "16:00", "16:40", "17:20", "18:00", "18:40",
];

let horarioSelecionado = null;
let ultimoAgendamentoCriado = null;

/* ==========================================================================
   NAVEGAÇÃO / HEADER / MENU MOBILE / HASH ROUTER
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initHeaderScroll();
  initMobileMenu();
  initRouter();
  initRevealAnimations();
  initBookingForm();
  initCalendarioPersonalizado();
  initCancelForm();
  preencherAnoFooter();
});

function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 40);
  });
}

function initMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");
  if (!toggle || !mobileNav) return;

  toggle.addEventListener("click", () => {
    mobileNav.classList.toggle("open");
  });

  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => mobileNav.classList.remove("open"));
  });
}

// Roteamento simples por hash: #/home, #/sobre, #/servicos, #/contato,
// #/agendar, #/cancelar
function initRouter() {
  window.addEventListener("hashchange", renderRota);
  renderRota();
}

function renderRota() {
  const hash = window.location.hash || "#/home";
  const rota = hash.replace("#/", "") || "home";

  document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
  const alvo = document.getElementById(`page-${rota}`) || document.getElementById("page-home");
  if (alvo) alvo.classList.add("active");

  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

  if (rota === "agendar") {
    const dataInput = document.getElementById("agendamento-data");
    if (dataInput && dataInput.value) carregarHorariosDisponiveis(dataInput.value);
  }
}

function initRevealAnimations() {
  const els = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((el) => observer.observe(el));
}

function preencherAnoFooter() {
  const anoEl = document.getElementById("ano-atual");
  if (anoEl) anoEl.textContent = new Date().getFullYear();
}

/* ==========================================================================
   FORMULÁRIO DE AGENDAMENTO
   ========================================================================== */

function initBookingForm() {
  const form = document.getElementById("form-agendamento");
  if (!form) return;

  const dataInput = document.getElementById("agendamento-data");
  const hoje = new Date();
  const hojeStr = formatarDataISO(hoje);
  dataInput.min = hojeStr;

  dataInput.addEventListener("change", () => {
    horarioSelecionado = null;
    renderizarSlotsVazios();
    if (dataInput.value) carregarHorariosDisponiveis(dataInput.value);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await tentarCriarAgendamento();
  });

  // Botões de "Agendar Horário" nas seções home/serviços levam para #/agendar
  document.querySelectorAll("[data-ir-agendar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.hash = "#/agendar";
    });
  });

  document.querySelectorAll("[data-servico-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.hash = "#/agendar";
      const select = document.getElementById("agendamento-servico");
      if (select) select.value = btn.getAttribute("data-servico-preset");
    });
  });
}

function formatarDataISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderizarSlotsVazios() {
  const container = document.getElementById("time-slots-container");
  if (!container) return;
  container.innerHTML = `<p class="time-slots-empty">Selecione uma data para ver os horários disponíveis.</p>`;
}

async function carregarHorariosDisponiveis(dataISO) {
  const container = document.getElementById("time-slots-container");
  if (!container) return;

  container.innerHTML = `<p class="time-slots-empty"><span class="spinner" style="border-top-color: var(--dourado); border-color: rgba(201,162,75,0.3);"></span> Carregando horários...</p>`;

  let ocupados = [];
  try {
    const agendamentosDoDia = await buscarAgendamentosPorData(dataISO);
    ocupados = agendamentosDoDia.map((a) => a.horario);
  } catch (err) {
    console.error(err);
  }

  const hoje = new Date();
  const dataEhHoje = dataISO === formatarDataISO(hoje);
  const horaAtualMin = hoje.getHours() * 60 + hoje.getMinutes();

  const slotsHtml = HORARIOS_FUNCIONAMENTO.map((horario) => {
    const [h, m] = horario.split(":").map(Number);
    const minutosSlot = h * 60 + m;
    const passou = dataEhHoje && minutosSlot <= horaAtualMin;
    const ocupado = ocupados.includes(horario);
    const desabilitado = passou || ocupado;

    return `<button type="button" class="time-slot${desabilitado ? " disabled" : ""}" data-horario="${horario}" ${desabilitado ? "disabled" : ""}>${horario}</button>`;
  }).join("");

  container.innerHTML = slotsHtml;

  container.querySelectorAll(".time-slot:not(.disabled)").forEach((slot) => {
    slot.addEventListener("click", () => {
      container.querySelectorAll(".time-slot").forEach((s) => s.classList.remove("selected"));
      slot.classList.add("selected");
      horarioSelecionado = slot.getAttribute("data-horario");
      limparErroCampo("agendamento-horario-erro");
    });
  });

  const todosOcupadosOuPassados = HORARIOS_FUNCIONAMENTO.every((horario) => {
    const [h, m] = horario.split(":").map(Number);
    const minutosSlot = h * 60 + m;
    return (dataEhHoje && minutosSlot <= horaAtualMin) || ocupados.includes(horario);
  });

  if (todosOcupadosOuPassados) {
    container.innerHTML += `<p class="time-slots-empty">Não há mais horários disponíveis nesta data. Tente escolher outro dia.</p>`;
  }
}

function validarCampo(input, condicaoValida) {
  const campoWrapper = input.closest(".field");
  if (!campoWrapper) return condicaoValida;
  campoWrapper.classList.toggle("invalid", !condicaoValida);
  return condicaoValida;
}

function limparErroCampo(id) {
  const el = document.getElementById(id);
  if (el) el.closest(".field")?.classList.remove("invalid");
}

async function tentarCriarAgendamento() {
  const nomeInput = document.getElementById("agendamento-nome");
  const telefoneInput = document.getElementById("agendamento-telefone");
  const servicoSelect = document.getElementById("agendamento-servico");
  const dataInput = document.getElementById("agendamento-data");
  const msgBox = document.getElementById("form-msg");
  const btnSubmit = document.getElementById("btn-confirmar-agendamento");

  msgBox.classList.remove("show", "error");

  const nomeValido = validarCampo(nomeInput, nomeInput.value.trim().length >= 3);
  const telefoneValido = validarCampo(telefoneInput, /^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/.test(telefoneInput.value.trim()));
  const servicoValido = validarCampo(servicoSelect, !!servicoSelect.value);
  const dataValida = validarCampo(dataInput, !!dataInput.value && dataInput.value >= formatarDataISO(new Date()));
  const horarioContainer = document.getElementById("time-slots-container");
  const horarioValido = !!horarioSelecionado;
  if (horarioContainer) {
    horarioContainer.parentElement.classList.toggle("invalid", !horarioValido);
  }

  if (!nomeValido || !telefoneValido || !servicoValido || !dataValida || !horarioValido) {
    msgBox.textContent = "Por favor, verifique os campos destacados e tente novamente.";
    msgBox.classList.add("show", "error");
    return;
  }

  btnSubmit.disabled = true;
  const textoOriginalBtn = btnSubmit.innerHTML;
  btnSubmit.innerHTML = `<span class="spinner"></span> Confirmando...`;

  try {
    // Checagem final de disponibilidade em tempo real (evita corrida entre 2 clientes)
    const agendamentosAtuais = await buscarAgendamentosPorData(dataInput.value);
    const jaOcupado = agendamentosAtuais.some((a) => a.horario === horarioSelecionado);

    if (jaOcupado) {
      msgBox.textContent = "Esse horário acabou de ser reservado por outro cliente. Escolha outro, por favor.";
      msgBox.classList.add("show", "error");
      await carregarHorariosDisponiveis(dataInput.value);
      horarioSelecionado = null;
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = textoOriginalBtn;
      return;
    }

    const novoAgendamento = {
      nome: nomeInput.value.trim(),
      telefone: telefoneInput.value.trim(),
      servico: servicoSelect.value,
      data: dataInput.value,
      horario: horarioSelecionado,
    };

    const criado = await criarAgendamento(novoAgendamento);

    if (!criado) {
      msgBox.textContent = "Não foi possível salvar o agendamento. Tente novamente em instantes.";
      msgBox.classList.add("show", "error");
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = textoOriginalBtn;
      return;
    }

    ultimoAgendamentoCriado = criado;
    exibirConfirmacao(criado);
    enviarParaWhatsApp(novoAgendamento);
  } catch (err) {
    console.error(err);
    msgBox.textContent = "Erro inesperado. Verifique sua conexão e tente novamente.";
    msgBox.classList.add("show", "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = textoOriginalBtn;
  }
}

function exibirConfirmacao(agendamento) {
  const form = document.getElementById("form-agendamento");
  const confirmBox = document.getElementById("confirm-box");
  const resumoEl = document.getElementById("confirm-resumo");

  const nomeServico = SERVICOS[agendamento.servico]?.nome || agendamento.servico;
  const dataFormatada = formatarDataBR(agendamento.data);

  form.style.display = "none";
  confirmBox.classList.add("show");
  resumoEl.textContent = `${nomeServico} · ${dataFormatada} às ${agendamento.horario}`;
}

function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function enviarParaWhatsApp(agendamento) {
  const nomeServico = SERVICOS[agendamento.servico]?.nome || agendamento.servico;
  const dataFormatada = formatarDataBR(agendamento.data);

  const mensagem =
    `Novo agendamento recebido.\n\n` +
    `Nome: ${agendamento.nome}\n` +
    `Telefone: ${agendamento.telefone}\n` +
    `Serviço: ${nomeServico}\n` +
    `Data: ${dataFormatada}\n` +
    `Horário: ${agendamento.horario}`;

  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;

  // Abre em nova aba/app do WhatsApp automaticamente
  window.open(url, "_blank");

  const linkManual = document.getElementById("confirm-whatsapp-link");
  if (linkManual) linkManual.href = url;
}

function reiniciarFormularioAgendamento() {
  const form = document.getElementById("form-agendamento");
  const confirmBox = document.getElementById("confirm-box");
  form.reset();
  form.style.display = "";
  confirmBox.classList.remove("show");
  horarioSelecionado = null;
  renderizarSlotsVazios();
  document.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
}

/* ==========================================================================
   CANCELAMENTO
   ========================================================================== */

let idParaCancelar = null;

function initCancelForm() {
  const formBusca = document.getElementById("form-buscar-cancelamento");
  if (!formBusca) return;

  formBusca.addEventListener("submit", async (e) => {
    e.preventDefault();
    await buscarEExibirAgendamentos();
  });

  const btnNovaBusca = document.getElementById("btn-nova-busca-cancelamento");
  btnNovaBusca.addEventListener("click", () => {
    document.getElementById("lista-cancelamento-container").style.display = "none";
    formBusca.style.display = "";
    formBusca.reset();
    document.getElementById("busca-cancelamento-msg").classList.remove("show", "error");
  });

  initModalCancelamento();
}

async function buscarEExibirAgendamentos() {
  const telefoneInput = document.getElementById("cancelamento-telefone");
  const msgBox = document.getElementById("busca-cancelamento-msg");
  const btn = document.getElementById("btn-buscar-cancelamento");
  const formBusca = document.getElementById("form-buscar-cancelamento");

  msgBox.classList.remove("show", "error");

  const telefoneValido = validarCampo(telefoneInput, telefoneInput.value.trim().length >= 8);
  if (!telefoneValido) {
    msgBox.textContent = "Informe um telefone válido.";
    msgBox.classList.add("show", "error");
    return;
  }

  btn.disabled = true;
  const textoOriginal = btn.innerHTML;
  btn.innerHTML = `<span class="spinner"></span> Buscando...`;

  try {
    const agendamentos = await buscarAgendamentosPorTelefone(telefoneInput.value.trim());
    renderizarListaCancelamento(agendamentos, telefoneInput.value.trim());
    formBusca.style.display = "none";
    document.getElementById("lista-cancelamento-container").style.display = "block";
  } catch (err) {
    console.error(err);
    msgBox.textContent = "Erro ao buscar seus agendamentos. Tente novamente.";
    msgBox.classList.add("show", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = textoOriginal;
  }
}

function renderizarListaCancelamento(agendamentos, telefoneUsado) {
  const container = document.getElementById("lista-cancelamento-items");

  if (!agendamentos || agendamentos.length === 0) {
    container.innerHTML = `
      <div class="cancelamento-item-vazio">
        <strong>Nenhum agendamento encontrado</strong>
        Não encontramos agendamentos futuros com o telefone informado.
      </div>
    `;
    return;
  }

  container.innerHTML = agendamentos
    .map((a) => {
      const nomeServico = SERVICOS[a.servico]?.nome || a.servico;
      const dataFormatada = formatarDataBR(a.data);
      return `
        <div class="cancelamento-item" data-id="${a.id}">
          <div class="cancelamento-item-info">
            <h4>${nomeServico}</h4>
            <p><span class="data-destaque">${dataFormatada} às ${a.horario}</span></p>
          </div>
          <button type="button" class="btn-cancelar-item" data-id="${a.id}" data-resumo="${nomeServico} · ${dataFormatada} às ${a.horario}">Cancelar</button>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".btn-cancelar-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      idParaCancelar = btn.getAttribute("data-id");
      const resumo = btn.getAttribute("data-resumo");
      document.getElementById("modal-cancelamento-resumo").textContent = resumo;
      document.getElementById("modal-confirmar-cancelamento").classList.add("show");
    });
  });
}

function initModalCancelamento() {
  const overlay = document.getElementById("modal-confirmar-cancelamento");
  const btnFechar = document.getElementById("btn-fechar-modal-cancelamento");
  const btnConfirmar = document.getElementById("btn-confirmar-cancelamento-final");

  btnFechar.addEventListener("click", () => {
    overlay.classList.remove("show");
    idParaCancelar = null;
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("show");
      idParaCancelar = null;
    }
  });

  btnConfirmar.addEventListener("click", async () => {
    if (!idParaCancelar) return;

    const textoOriginal = btnConfirmar.innerHTML;
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = `<span class="spinner"></span> Cancelando...`;

    try {
      const resultado = await cancelarAgendamentoPorId(idParaCancelar);
      overlay.classList.remove("show");

      if (resultado.sucesso) {
        // Remove o item cancelado da lista na tela, sem precisar recarregar
        const item = document.querySelector(`.cancelamento-item[data-id="${idParaCancelar}"]`);
        if (item) item.remove();

        const container = document.getElementById("lista-cancelamento-items");
        if (!container.querySelector(".cancelamento-item")) {
          container.innerHTML = `
            <div class="cancelamento-item-vazio">
              <strong>Tudo certo!</strong>
              Você não tem mais agendamentos futuros com esse telefone.
            </div>
          `;
        }
      } else {
        alert(resultado.mensagem);
      }
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao cancelar. Tente novamente.");
    } finally {
      idParaCancelar = null;
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = textoOriginal;
    }
  });
}


/* ==========================================================================
   CALENDARIO PERSONALIZADO (campo Data)
========================================================================== */

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const NOMES_DIA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

let calendarioMesExibido = null;

function initCalendarioPersonalizado() {
  const dataInput = document.getElementById("agendamento-data");
  const btnAbrir = document.getElementById("btn-abrir-calendario");
  const popup = document.getElementById("calendario-popup");
  if (!dataInput || !btnAbrir || !popup) return;

  const hoje = new Date();
  calendarioMesExibido = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  function abrirPopup() {
    renderCalendario(dataInput, popup);
    popup.classList.add("show");
  }

  function fecharPopup() {
    popup.classList.remove("show");
  }

  btnAbrir.addEventListener("click", (e) => {
    e.stopPropagation();
    if (popup.classList.contains("show")) {
      fecharPopup();
    } else {
      abrirPopup();
    }
  });

  dataInput.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!popup.classList.contains("show")) abrirPopup();
  });

  document.addEventListener("click", (e) => {
    if (!popup.contains(e.target) && e.target !== btnAbrir && !btnAbrir.contains(e.target)) {
      fecharPopup();
    }
  });

  popup.addEventListener("click", (e) => e.stopPropagation());
}

function renderCalendario(dataInput, popup) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const ano = calendarioMesExibido.getFullYear();
  const mes = calendarioMesExibido.getMonth();

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const mesAnteriorAoAtual =
    ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes < hoje.getMonth());

  let diasHtml = "";
  for (let i = 0; i < primeiroDiaSemana; i++) {
    diasHtml += `<span class="calendario-dia vazio"></span>`;
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const dataDia = new Date(ano, mes, dia);
    const dataDiaISO = formatarDataISO(dataDia);
    const desabilitado = dataDia < hoje;
    const selecionado = dataInput.value === dataDiaISO;

    diasHtml += `<button type="button" class="calendario-dia${desabilitado ? " desabilitado" : ""}${selecionado ? " selecionado" : ""}" data-data="${dataDiaISO}" ${desabilitado ? "disabled" : ""}>${dia}</button>`;
  }

  popup.innerHTML = `
    <div class="calendario-header">
      <button type="button" class="calendario-nav" id="calendario-mes-anterior" ${mesAnteriorAoAtual ? "disabled" : ""} aria-label="Mes anterior">&lsaquo;</button>
      <strong>${NOMES_MES[mes]} ${ano}</strong>
      <button type="button" class="calendario-nav" id="calendario-mes-seguinte" aria-label="Proximo mes">&rsaquo;</button>
    </div>
    <div class="calendario-semana">
      ${NOMES_DIA_SEMANA.map((d) => `<span>${d}</span>`).join("")}
    </div>
    <div class="calendario-grid">${diasHtml}</div>
  `;

  const btnAnterior = popup.querySelector("#calendario-mes-anterior");
  const btnSeguinte = popup.querySelector("#calendario-mes-seguinte");

  btnAnterior?.addEventListener("click", () => {
    calendarioMesExibido = new Date(ano, mes - 1, 1);
    renderCalendario(dataInput, popup);
  });

  btnSeguinte?.addEventListener("click", () => {
    calendarioMesExibido = new Date(ano, mes + 1, 1);
    renderCalendario(dataInput, popup);
  });

  popup.querySelectorAll(".calendario-dia:not(.vazio):not(.desabilitado)").forEach((el) => {
    el.addEventListener("click", () => {
      const dataEscolhida = el.getAttribute("data-data");
      dataInput.value = dataEscolhida;
      dataInput.closest(".field")?.classList.remove("invalid");
      popup.classList.remove("show");
      dataInput.dispatchEvent(new Event("change"));
    });
  });
}
