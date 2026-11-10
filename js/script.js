/* ==========================================================
   Os Simpsons - Personagens
   Consome a API publica dos Simpsons e cria os cards via JS.
   ========================================================== */

/* ---------- 1. Configuracao, elementos e estado ---------- */

const URL_API = "https://apisimpsons.fly.dev/api/personajes?limit=1000";
const POR_LOTE = 24; // quantos cards aparecem por vez

// Elementos que ja existem no index.html
const lista = document.getElementById("lista-personagens");
const mensagem = document.getElementById("mensagem");
const btnMais = document.getElementById("btn-carregar-mais");
const campoBusca = document.getElementById("busca");
const contador = document.getElementById("contador");

let todosPersonagens = []; // tudo que veio da API
let filtrados = [];        // resultado atual da busca
let exibidos = 0;          // quantos cards ja estao na tela
const favoritos = new Set(); // guarda o _id dos favoritados

// Imagem alternativa (SVG embutido) para quando a imagem da API falhar
const IMAGEM_PADRAO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
      '<rect width="200" height="200" fill="#e3e3e3"/>' +
      '<text x="100" y="108" font-size="16" text-anchor="middle" ' +
      'fill="#888" font-family="Arial">Sem imagem</text></svg>'
  );

// Se a URL for de uma miniatura (/thumb/.../200px-x.png), devolve a URL do
// arquivo original; caso contrario devolve null
function urlOriginal(url) {
  const m = url.match(/^(.*)\/thumb\/(.+?\.(?:png|jpe?g|gif))\/[^/]+$/i);
  return m ? m[1] + "/" + m[2] : null;
}

// Traducao dos valores de Estado (o que nao estiver aqui aparece como veio)
const TRADUCAO_STATUS = {
  Vivo: "Vivo",
  Fallecido: "Falecido",
  Ficticio: "Fictício",
  Desconocido: "Desconhecido",
  Divino: "Divino",
  Robot: "Robô",
  Estatua: "Estátua",
};

/* ---------- 2. Criacao de um card ---------- */

// Recebe um personagem da API e devolve o card pronto (ainda fora da pagina)
function criarCard(p) {
  // Valores padrao para campos ausentes ou vazios
  const nome = (p.Nombre || "").trim() || "Sem nome";
  const estadoOriginal = (p.Estado || "").trim();
  const status = TRADUCAO_STATUS[estadoOriginal] || estadoOriginal || "Não informado";
  const ocupacao = (p.Ocupacion || "").trim() || "Não informada";
  const historia = (p.Historia || "").trim() || "Sem descrição disponível.";

  const card = document.createElement("article");
  card.classList.add("card");

  // Topo: nome + coracao de favorito
  const topo = document.createElement("div");
  topo.classList.add("card-topo");

  const titulo = document.createElement("h2");
  titulo.classList.add("card-nome");
  titulo.textContent = nome;

  const btnFav = document.createElement("button");
  btnFav.type = "button";
  btnFav.classList.add("btn-favorito");
  atualizarCoracao(btnFav, favoritos.has(p._id), nome);
  btnFav.addEventListener("click", () => {
    if (favoritos.has(p._id)) {
      favoritos.delete(p._id);
    } else {
      favoritos.add(p._id);
    }
    atualizarCoracao(btnFav, favoritos.has(p._id), nome);
  });

  topo.appendChild(titulo);
  topo.appendChild(btnFav);

  // Imagem
  const img = document.createElement("img");
  img.classList.add("card-imagem");
  img.alt = nome;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  let tentouOriginal = false;
  img.onerror = () => {
    // 1a falha: se era miniatura, tenta o arquivo original
    const original = urlOriginal(img.src);
    if (original && !tentouOriginal) {
      tentouOriginal = true;
      img.src = original;
      return;
    }
    img.onerror = null; // evita loop se a imagem padrao tambem falhar
    img.src = IMAGEM_PADRAO;
  };
  img.src = p.Imagen || IMAGEM_PADRAO;

  // Corpo: status, ocupacao e descricao
  const corpo = document.createElement("div");
  corpo.classList.add("card-corpo");

  const badge = document.createElement("span");
  badge.classList.add("badge-status", classeDoStatus(estadoOriginal));
  badge.textContent = status;

  const pOcupacao = document.createElement("p");
  pOcupacao.classList.add("card-ocupacao");
  pOcupacao.textContent = "Ocupação: " + ocupacao;
  pOcupacao.title = ocupacao; // texto completo ao passar o mouse

  const pDescricao = document.createElement("p");
  pDescricao.classList.add("card-descricao");
  pDescricao.textContent = historia;
  pDescricao.title = historia; // texto completo ao passar o mouse

  corpo.appendChild(badge);
  corpo.appendChild(pOcupacao);
  corpo.appendChild(pDescricao);

  card.appendChild(topo);
  card.appendChild(img);
  card.appendChild(corpo);

  return card;
}

function atualizarCoracao(botao, ativo, nome) {
  botao.textContent = ativo ? "\u2665" : "\u2661"; // coracao cheio / vazio
  botao.classList.toggle("ativo", ativo);
  botao.setAttribute("aria-pressed", String(ativo));
  botao.setAttribute(
    "aria-label",
    (ativo ? "Remover dos favoritos: " : "Favoritar: ") + nome
  );
}

// Classe CSS usada para colorir o status
function classeDoStatus(estado) {
  if (estado === "Vivo") return "status-vivo";
  if (estado === "Fallecido") return "status-falecido";
  return "status-outro";
}

/* ---------- 3. Exibicao em lotes ---------- */

function mostrarMaisCards() {
  const lote = filtrados.slice(exibidos, exibidos + POR_LOTE);

  lote.forEach((personagem) => {
    lista.appendChild(criarCard(personagem));
  });

  exibidos += lote.length;
  atualizarContadorEBotao();
}

function atualizarContadorEBotao() {
  contador.textContent =
    "Exibindo " + exibidos + " de " + filtrados.length + " personagens";
  btnMais.hidden = exibidos >= filtrados.length;
}

/* ---------- 4. Busca por nome ---------- */

// Remove acentos e deixa minusculo, para a busca nao ser sensivel a eles
function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function aplicarBusca() {
  const termo = normalizar(campoBusca.value.trim());

  filtrados = todosPersonagens.filter((p) =>
    normalizar(p.Nombre || "").includes(termo)
  );

  lista.replaceChildren(); // limpa os cards atuais
  exibidos = 0;

  if (filtrados.length === 0) {
    mensagem.textContent = "Nenhum personagem encontrado para essa busca.";
  } else {
    mensagem.textContent = "";
  }

  mostrarMaisCards();
}

/* ---------- 5. Consumo da API ---------- */

function carregarPersonagens() {
  mensagem.textContent = "Carregando personagens...";

  fetch(URL_API)
    .then((resposta) => {
      // fetch so rejeita em falha de rede; erros HTTP precisamos checar
      if (!resposta.ok) {
        throw new Error("A API respondeu com status " + resposta.status);
      }
      return resposta.json();
    })
    .then((dados) => {
      if (!Array.isArray(dados.docs)) {
        throw new Error("Formato de resposta inesperado");
      }
      todosPersonagens = dados.docs;
      filtrados = todosPersonagens;
      mensagem.textContent = "";
      mostrarMaisCards();
    })
    .catch((erro) => {
      console.error("Falha ao consultar a API:", erro);
      mensagem.textContent =
        "Não foi possível carregar os personagens. Verifique sua conexão e recarregue a página.";
    });
}

/* ---------- Eventos e inicio ---------- */

btnMais.addEventListener("click", mostrarMaisCards);
campoBusca.addEventListener("input", aplicarBusca);

carregarPersonagens();
