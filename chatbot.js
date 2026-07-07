/* ==========================================================================
   BARBER STUDIO — chatbot.js
   Assistente virtual por MENU GUIADO (sem digitação, só cliques/toques).
   Não usa inteligência artificial — não tem custo nenhum, roda 100% no
   navegador do cliente.

   COMO FUNCIONA A ESTRUTURA:
   Cada "tela" do chat é um item dentro de MENU_ARVORE. Uma tela pode ter:
   - "mensagem": o que o bot diz ao entrar nessa tela (aceita <strong>, <br>)
   - "opcoes": lista de botões que o cliente pode clicar
       - cada opção tem "texto" (o que aparece no botão) e um destino:
         "irPara": leva para outra tela dentro do menu (por id)
         "link": abre uma URL externa (nova aba)
         "hash": navega para uma página do site (ex: "#/agendar")
   - "voltarPara": para qual tela o botão "Voltar" deve levar (se vazio,
     o botão de voltar fica escondido — é o caso da tela inicial "raiz")

   Para adicionar uma nova pergunta/opção, copie um bloco de tela existente,
   dê um novo id, e adicione uma entrada em "opcoes" de quem deve linkar
   para ela.
   ========================================================================== */

const MENU_ARVORE = {
  raiz: {
    mensagem: "Olá! 👋 Sou o assistente virtual da Barber Studio. Escolha uma opção abaixo:",
    voltarPara: null,
    opcoes: [
      { texto: "🕒 Horário de funcionamento", irPara: "horario" },
      { texto: "💈 Serviços e preços", irPara: "servicos" },
      { texto: "📅 Agendar horário", hash: "#/agendar" },
      { texto: "❌ Cancelar agendamento", hash: "#/cancelar" },
      { texto: "📍 Endereço e localização", irPara: "endereco" },
      { texto: "💳 Formas de pagamento", irPara: "pagamento" },
      { texto: "💬 Outros contatos", irPara: "contatos" },
    ],
  },

  horario: {
    mensagem: "Funcionamos de <strong>segunda a sábado, das 9h às 19h</strong>. Aos domingos ficamos fechados.",
    voltarPara: "raiz",
    opcoes: [
      { texto: "📅 Quero agendar um horário", hash: "#/agendar" },
      { texto: "⬅ Voltar ao menu", irPara: "raiz" },
    ],
  },

  servicos: {
    mensagem:
      "Nossos serviços e preços:<br><br>" +
      "✂️ Corte Masculino — R$ 60<br>" +
      "🧔 Barba — R$ 40<br>" +
      "✂️🧔 Corte + Barba — R$ 90<br>" +
      "🎨 Pigmentação — R$ 50<br>" +
      "👁️ Sobrancelha — R$ 25",
    voltarPara: "raiz",
    opcoes: [
      { texto: "📅 Agendar um desses serviços", hash: "#/agendar" },
      { texto: "⬅ Voltar ao menu", irPara: "raiz" },
    ],
  },

  endereco: {
    mensagem: "Estamos na <strong>Av. Bernardino Caballero, 1234 — Ciudad del Este, Paraguai</strong>. Você também pode ver o mapa completo na seção Contato do site.",
    voltarPara: "raiz",
    opcoes: [
      { texto: "📍 Ver página de Contato", hash: "#/contato" },
      { texto: "⬅ Voltar ao menu", irPara: "raiz" },
    ],
  },

  pagamento: {
    mensagem: "Aceitamos <strong>dinheiro, cartão de débito/crédito e Pix</strong>. O pagamento é feito no local, após o atendimento.",
    voltarPara: "raiz",
    opcoes: [
      { texto: "⬅ Voltar ao menu", irPara: "raiz" },
    ],
  },

  contatos: {
    mensagem: "Você pode falar com a gente também por aqui:",
    voltarPara: "raiz",
    opcoes: [
      { texto: "💬 WhatsApp — +55 17 98834-3422", link: "https://wa.me/5517988343422" },
      { texto: "📸 Instagram — @barberstudio", link: "https://instagram.com/barberstudio" },
      { texto: "⬅ Voltar ao menu", irPara: "raiz" },
    ],
  },
};

let telaAtual = "raiz";
let historicoTelas = [];
let chatbotAberto = false;
let primeiraAberturaFeita = false;

document.addEventListener("DOMContentLoaded", initChatbot);

function initChatbot() {
  const toggle = document.getElementById("chatbot-toggle");
  const janela = document.getElementById("chatbot-window");
  if (!toggle || !janela) return;

  toggle.addEventListener("click", () => {
    chatbotAberto = !chatbotAberto;
    toggle.classList.toggle("open", chatbotAberto);
    janela.classList.toggle("open", chatbotAberto);

    const badge = document.getElementById("chatbot-badge");
    if (badge) badge.classList.add("hidden");

    if (chatbotAberto && !primeiraAberturaFeita) {
      primeiraAberturaFeita = true;
      irParaTela("raiz", { comHistorico: false });
    }
  });

  const btnVoltar = document.getElementById("chatbot-back");
  btnVoltar.addEventListener("click", voltarTela);

  const btnReiniciar = document.getElementById("chatbot-restart");
  btnReiniciar.addEventListener("click", () => {
    historicoTelas = [];
    document.getElementById("chatbot-messages").innerHTML = "";
    irParaTela("raiz", { comHistorico: false });
  });
}

function irParaTela(idTela, { comHistorico = true } = {}) {
  const telaAnterior = telaAtual;
  const tela = MENU_ARVORE[idTela];
  if (!tela) return;

  if (idTela === "raiz") {
    // Voltar ao início sempre limpa o histórico acumulado
    historicoTelas = [];
  } else if (comHistorico && telaAnterior !== idTela) {
    historicoTelas.push(telaAnterior);
  }
  telaAtual = idTela;

  atualizarBotaoVoltar();
  renderizarMensagemBot(tela.mensagem);
  renderizarMenu(tela.opcoes);
}

function voltarTela() {
  if (historicoTelas.length === 0) return;
  const anterior = historicoTelas.pop();
  telaAtual = anterior;
  atualizarBotaoVoltar();

  const tela = MENU_ARVORE[telaAtual];
  renderizarMensagemBot(tela.mensagem);
  renderizarMenu(tela.opcoes);
}

function atualizarBotaoVoltar() {
  const btnVoltar = document.getElementById("chatbot-back");
  btnVoltar.style.display = historicoTelas.length > 0 ? "flex" : "none";
}

function renderizarMenu(opcoes) {
  const menuContainer = document.getElementById("chatbot-menu");
  menuContainer.innerHTML = "";

  opcoes.forEach((opcao) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chatbot-menu-btn";
    btn.textContent = opcao.texto;

    btn.addEventListener("click", () => {
      renderizarMensagemUsuario(opcao.texto);

      if (opcao.irPara) {
        mostrarDigitando(() => irParaTela(opcao.irPara));
      } else if (opcao.hash) {
        mostrarDigitando(() => {
          renderizarMensagemBot("Te levando para lá agora mesmo...");
          setTimeout(() => {
            window.location.hash = opcao.hash;
            const janela = document.getElementById("chatbot-window");
            const toggle = document.getElementById("chatbot-toggle");
            janela.classList.remove("open");
            toggle.classList.remove("open");
            chatbotAberto = false;
          }, 500);
        });
      } else if (opcao.link) {
        window.open(opcao.link, "_blank");
      }
    });

    menuContainer.appendChild(btn);
  });
}

function mostrarDigitando(callback) {
  const container = document.getElementById("chatbot-messages");
  const typing = document.createElement("div");
  typing.className = "chat-typing";
  typing.id = "chat-typing-indicator";
  typing.innerHTML = "<span></span><span></span><span></span>";
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  const atraso = 350 + Math.random() * 300;
  setTimeout(() => {
    const el = document.getElementById("chat-typing-indicator");
    if (el) el.remove();
    callback();
  }, atraso);
}

function renderizarMensagemUsuario(texto) {
  const container = document.getElementById("chatbot-messages");
  const msg = document.createElement("div");
  msg.className = "chat-msg user";
  msg.textContent = texto;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function renderizarMensagemBot(html) {
  const container = document.getElementById("chatbot-messages");
  const msg = document.createElement("div");
  msg.className = "chat-msg bot";
  msg.innerHTML = `<p>${html}</p>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}
