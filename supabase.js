/* ==========================================================================
   BARBER STUDIO — supabase.js
   Configuração da conexão com o Supabase + funções de acesso ao banco.
   Este arquivo é usado tanto pelo site (script.js) quanto pelo painel
   administrativo (admin.js).
   ========================================================================== */

/*
  ATENÇÃO — COMO CONFIGURAR:
  1. Crie um projeto em https://supabase.com
  2. Vá em "Project Settings" > "API"
  3. Copie a "Project URL" e cole em SUPABASE_URL abaixo
  4. Copie a "anon public" key e cole em SUPABASE_ANON_KEY abaixo
  5. Rode o script SQL que está no arquivo README.md (seção Supabase) dentro
     do "SQL Editor" do Supabase para criar a tabela "agendamentos".

  Essas chaves (URL e ANON KEY) são seguras para ficar no código do site,
  pois a "anon key" é uma chave pública, feita para ser usada no navegador.
  A segurança real fica nas regras de RLS (Row Level Security) configuradas
  no Supabase, que estão explicadas no README.md.
*/

const SUPABASE_URL = "https://mdnvbxugkntpevotkkyr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kbnZieHVna250cGV2b3Rra3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NTIwMTIsImV4cCI6MjA5OTAyODAxMn0.VTx40ZHW8zBw30bdoPrHrWU-EQ82Z3YPQXkfh5o5hWE";
// Carrega o cliente Supabase (via CDN, adicionado no HTML)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==========================================================================
   FUNÇÕES DE AGENDAMENTO (usadas no site público)
   ========================================================================== */

/**
 * Busca todos os agendamentos de uma data específica (para saber quais
 * horários já estão ocupados).
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {Promise<Array>} lista de agendamentos daquele dia (não cancelados)
 */
async function buscarAgendamentosPorData(data) {
  const { data: agendamentos, error } = await supabaseClient
    .from("agendamentos")
    .select("*")
    .eq("data", data)
    .eq("status", "confirmado");

  if (error) {
    console.error("Erro ao buscar agendamentos:", error);
    return [];
  }
  return agendamentos;
}

/**
 * Cria um novo agendamento no banco de dados.
 * @param {Object} agendamento - {nome, telefone, servico, data, horario}
 * @returns {Promise<Object|null>} o agendamento criado (com id e código) ou null se erro
 */
async function criarAgendamento(agendamento) {
  const codigoCancelamento = gerarCodigoCancelamento();

  const { data, error } = await supabaseClient
    .from("agendamentos")
    .insert([
      {
        nome: agendamento.nome,
        telefone: agendamento.telefone,
        servico: agendamento.servico,
        data: agendamento.data,
        horario: agendamento.horario,
        codigo_cancelamento: codigoCancelamento,
        status: "confirmado",
      },
    ])
    .select();

  if (error) {
    console.error("Erro ao criar agendamento:", error);
    return null;
  }

  return data && data[0] ? data[0] : null;
}

/**
 * Cancela um agendamento verificando telefone + código de cancelamento.
 * @param {string} telefone
 * @param {string} codigo
 * @returns {Promise<{sucesso: boolean, mensagem: string}>}
 */
async function cancelarAgendamento(telefone, codigo) {
  const telefoneNormalizado = telefone.replace(/\D/g, "");

  const { data: encontrados, error: erroBusca } = await supabaseClient
    .from("agendamentos")
    .select("*")
    .eq("codigo_cancelamento", codigo.toUpperCase().trim())
    .eq("status", "confirmado");

  if (erroBusca) {
    console.error("Erro ao buscar agendamento para cancelar:", erroBusca);
    return { sucesso: false, mensagem: "Erro ao consultar o sistema. Tente novamente." };
  }

  const agendamento = (encontrados || []).find(
    (a) => a.telefone.replace(/\D/g, "") === telefoneNormalizado
  );

  if (!agendamento) {
    return {
      sucesso: false,
      mensagem: "Não encontramos nenhum agendamento com esse telefone e código.",
    };
  }

  const { error: erroUpdate } = await supabaseClient
    .from("agendamentos")
    .update({ status: "cancelado" })
    .eq("id", agendamento.id);

  if (erroUpdate) {
    console.error("Erro ao cancelar:", erroUpdate);
    return { sucesso: false, mensagem: "Erro ao cancelar. Tente novamente." };
  }

  return { sucesso: true, mensagem: "Agendamento cancelado com sucesso!" };
}

/**
 * Busca todos os agendamentos futuros (hoje ou depois) de um telefone,
 * usados na tela de cancelamento simplificado (sem código).
 * @param {string} telefone
 * @returns {Promise<Array>} lista de agendamentos confirmados, mais recentes primeiro
 */
async function buscarAgendamentosPorTelefone(telefone) {
  const telefoneNormalizado = telefone.replace(/\D/g, "");

  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabaseClient
    .from("agendamentos")
    .select("*")
    .eq("status", "confirmado")
    .gte("data", hojeISO)
    .order("data", { ascending: true })
    .order("horario", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agendamentos por telefone:", error);
    return [];
  }

  // Filtra pelo telefone normalizado (ignorando espaços, parênteses e traços)
  return (data || []).filter((a) => a.telefone.replace(/\D/g, "") === telefoneNormalizado);
}

/**
 * Cancela um agendamento diretamente pelo id (usado no cancelamento
 * simplificado, depois que o cliente já escolheu qual agendamento é seu).
 * @param {string} id
 * @returns {Promise<{sucesso: boolean, mensagem: string}>}
 */
async function cancelarAgendamentoPorId(id) {
  const { error } = await supabaseClient
    .from("agendamentos")
    .update({ status: "cancelado" })
    .eq("id", id)
    .eq("status", "confirmado");

  if (error) {
    console.error("Erro ao cancelar por id:", error);
    return { sucesso: false, mensagem: "Erro ao cancelar. Tente novamente." };
  }

  return { sucesso: true, mensagem: "Agendamento cancelado com sucesso!" };
}

/**
 * Gera um código único de cancelamento no formato BS-XXXX (letras e números).
 */
function gerarCodigoCancelamento() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O, 0, I, 1 (confusos)
  let codigo = "BS-";
  for (let i = 0; i < 5; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

/* ==========================================================================
   FUNÇÕES DO PAINEL ADMINISTRATIVO
   ========================================================================== */

/**
 * Busca todos os agendamentos, com filtros opcionais.
 * @param {Object} filtros - {data, servico, cliente}
 */
async function adminBuscarAgendamentos(filtros = {}) {
  let query = supabaseClient.from("agendamentos").select("*").order("data", { ascending: true }).order("horario", { ascending: true });

  if (filtros.data) {
    query = query.eq("data", filtros.data);
  }
  if (filtros.servico) {
    query = query.eq("servico", filtros.servico);
  }
  if (filtros.cliente) {
    query = query.ilike("nome", `%${filtros.cliente}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar agendamentos (admin):", error);
    return [];
  }
  return data;
}

/**
 * Atualiza um agendamento existente (edição pelo admin).
 */
async function adminAtualizarAgendamento(id, novosDados) {
  const { error } = await supabaseClient
    .from("agendamentos")
    .update(novosDados)
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar agendamento:", error);
    return false;
  }
  return true;
}

/**
 * Cancela um agendamento a partir do painel administrativo (por id).
 */
async function adminCancelarAgendamento(id) {
  const { error } = await supabaseClient
    .from("agendamentos")
    .update({ status: "cancelado" })
    .eq("id", id);

  if (error) {
    console.error("Erro ao cancelar (admin):", error);
    return false;
  }
  return true;
}

/**
 * Exclui definitivamente um agendamento do banco (uso administrativo).
 */
async function adminExcluirAgendamento(id) {
  const { error } = await supabaseClient.from("agendamentos").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir agendamento:", error);
    return false;
  }
  return true;
}
