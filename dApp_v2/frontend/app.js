// ============================================================
// app.js — lógica do frontend (Web3.js v4 + MetaMask)
// Depende de contrato.js (CONTRACT_ADDRESS, BLOCO_DEPLOY, ABI), carregado antes.
//
// Seções:
//   1. Configuração e helpers
//   2. Conexão, rede e conta
//   3. Leitura  (.call()  — grátis, sem transação)
//   4. Escrita  (.send()  — transação assinada na MetaMask)
//   5. Tradução de erros (rejeição, revert customizado, saldo)
//   6. Eventos  (getPastEvents)
//   7. Verificador de hash (SHA-256 local)
//   8. Ligações de UI e eventos da carteira
// ============================================================

// ---------- 1) Configuração e helpers ----------
const SEPOLIA = {
  id: 11155111,
  hex: "0xaa36a7",
  nome: "Sepolia",
  explorer: "https://sepolia.etherscan.io",
  rpc: "https://ethereum-sepolia-rpc.publicnode.com",
};

// Mesma ordem dos enums do contrato (Sentimento e Status).
const SENTIMENTOS = ["Positive", "Negative", "Neutral", "Irrelevant"];
const STATUS = ["Pendente", "Confirmada", "Refutada", "Cancelada"];

// Entidades do dataset (só para o autocompletar do formulário).
const ENTIDADES = [
  "Amazon", "ApexLegends", "AssassinsCreed", "Battlefield", "Borderlands", "CS-GO", "CallOfDuty",
  "CallOfDutyBlackopsColdWar", "Cyberpunk2077", "Dota2", "FIFA", "Facebook", "Fortnite", "Google",
  "GrandTheftAuto(GTA)", "Hearthstone", "HomeDepot", "LeagueOfLegends", "MaddenNFL", "Microsoft",
  "NBA2K", "Nvidia", "Overwatch", "PlayStation5(PS5)", "PlayerUnknownsBattlegrounds(PUBG)",
  "RedDeadRedemption(RDR)", "TomClancysGhostRecon", "TomClancysRainbowSix", "Verizon",
  "WorldOfCraft", "Xbox(Xseries)", "johnson&johnson",
];

// Estado da aplicação
let web3, contrato, conta;
let naRede = false;
let ehDono = false;
let taxa = 0n; // TAXA_REGISTRO em wei (BigInt)
let totalLinhas = 0n;
let afirmacoes = []; // última página lida (usada pelo verificador de hash)
let mapaErros = {}; // seletor de 4 bytes → definição do erro na ABI

const $ = (id) => document.getElementById(id);
const encurtar = (s) => (s && s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);
const eth = (wei) => web3.utils.fromWei(wei.toString(), "ether");
const mesmoEndereco = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const linkTx = (h) => `${SEPOLIA.explorer}/tx/${h}`;

function aviso(msg, tipo = "") {
  $("status").textContent = msg;
  $("status").className = `status ${tipo}`;
}

// Cria elementos via DOM (textContent): dados on-chain são entrada não
// confiável e NUNCA devem ir para innerHTML (risco de XSS).
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => (k === "class" ? (e.className = v) : (e[k] = v)));
  filhos.forEach((f) => e.append(f));
  return e;
}

// Só transforma em link URLs http(s) ou ipfs:// — bloqueia "javascript:" etc.
function urlSegura(texto) {
  try {
    const t = String(texto).trim();
    if (t.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${t.slice(7)}`;
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function linkOuTexto(texto) {
  const href = urlSegura(texto);
  return href ? el("a", { href, target: "_blank", rel: "noopener noreferrer", textContent: texto }) : document.createTextNode(texto);
}

const ehHash = (s) => /^0x[0-9a-fA-F]{64}$/.test(s);

// ---------- 2) Conexão, rede e conta ----------
// window.ethereum é o provider EIP-1193 injetado pela MetaMask: ele guarda as
// chaves e assina; o frontend só pede. A Web3.js é construída sobre ele.
async function conectar() {
  if (!window.ethereum) return aviso("MetaMask não encontrada. Instale a extensão e recarregue.", "erro");
  if (!Web3.utils.isAddress(CONTRACT_ADDRESS) || /^0x0+$/.test(CONTRACT_ADDRESS)) {
    return aviso("Configure CONTRACT_ADDRESS em contrato.js com o endereço do deploy.", "erro");
  }
  try {
    const contas = await window.ethereum.request({ method: "eth_requestAccounts" });
    await iniciarSessao(contas[0]);
  } catch (err) {
    aviso(traduzirErro(err), "erro");
  }
}

// Monta (ou remonta) tudo para a conta atual. Também é chamada ao trocar de conta.
async function iniciarSessao(novaConta) {
  conta = novaConta;
  web3 = new Web3(window.ethereum);
  mapaErros = montarMapaErros();

  const chainId = Number(await web3.eth.getChainId()); // BigInt na v4
  naRede = chainId === SEPOLIA.id;
  $("rede").textContent = naRede ? `${SEPOLIA.nome} (${chainId})` : `Rede errada (${chainId})`;
  $("avisoRede").hidden = naRede;
  $("conta").textContent = encurtar(conta);
  $("btnConectar").textContent = "Conectado";
  $("btnConectar").disabled = true;
  await atualizarSaldoCarteira();

  if (!naRede) {
    habilitar(false);
    return aviso("Troque para a rede Sepolia para usar a dApp.", "erro");
  }

  const codigo = await web3.eth.getCode(CONTRACT_ADDRESS);
  if (codigo === "0x") {
    habilitar(false);
    return aviso("Não há contrato neste endereço na Sepolia. Confira contrato.js.", "erro");
  }
  contrato = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
  habilitar(true);
  await recarregar();
  aviso("Carteira conectada.", "ok");
}

// Pede à MetaMask para trocar para a Sepolia (e adiciona a rede se faltar).
async function trocarRede() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA.hex }] });
  } catch (err) {
    if (err.code === 4902) {
      // 4902 = rede ainda não cadastrada na carteira
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: SEPOLIA.hex,
            chainName: "Sepolia",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [SEPOLIA.rpc],
            blockExplorerUrls: [SEPOLIA.explorer],
          }],
        });
      } catch (e) {
        aviso(traduzirErro(e), "erro");
      }
    } else {
      aviso(traduzirErro(err), "erro");
    }
  }
  // Após a troca a MetaMask dispara "chainChanged" (tratado na seção 8).
}

async function atualizarSaldoCarteira() {
  const saldo = await web3.eth.getBalance(conta); // wei como BigInt
  $("saldoEth").textContent = `${Number(eth(saldo)).toFixed(4)} ETH`;
}

function habilitar(on) {
  ["btnRegistrar", "btnAtualizar", "btnSacar"].forEach((id) => ($(id).disabled = !on));
  document.querySelectorAll("#formEvidencia button, .af-acoes button").forEach((b) => (b.disabled = !on));
}

// ---------- 3) Leitura — .call() ----------
// .call() = eth_call: o nó executa a função localmente e devolve o resultado.
// Não gera transação, não custa gas e não exige assinatura.
async function recarregar() {
  const m = contrato.methods;
  const [dono, nome, hash, linhas, uri, taxaWei, total, saldoCt, rep] = await Promise.all([
    m.DONO().call(),
    m.nomeDataset().call(),
    m.DATASET_HASH().call(),
    m.TOTAL_LINHAS().call(),
    m.uriDataset().call(),
    m.TAXA_REGISTRO().call(),
    m.totalAfirmacoes().call(),
    m.saldos(conta).call(),
    m.reputacao(conta).call(),
  ]);

  taxa = BigInt(taxaWei);
  totalLinhas = BigInt(linhas);
  ehDono = mesmoEndereco(dono, conta);

  $("dsNome").textContent = nome;
  $("dsHash").textContent = hash;
  $("dsLinhas").textContent = linhas.toString();
  $("dsUri").replaceChildren(linkOuTexto(uri));
  $("ctLink").replaceChildren(
    el("a", { href: `${SEPOLIA.explorer}/address/${CONTRACT_ADDRESS}`, target: "_blank", rel: "noopener noreferrer", textContent: encurtar(CONTRACT_ADDRESS) })
  );
  $("taxaTxt").textContent = `${eth(taxa)} ETH`;
  $("saldoContrato").textContent = eth(saldoCt);
  $("reputacao").textContent = rep.toString(); // int256 → pode ser negativo
  $("papel").textContent = ehDono ? "(dono)" : "";
  $("cardAdmin").hidden = !ehDono; // interface exclusiva do dono
  $("cardAutor").hidden = false;
  $("totalAf").textContent = `(${total} no total)`;

  await carregarAfirmacoes(Number(total));
  await carregarHistorico();
  await atualizarSaldoCarteira();
}

// Lê as 20 afirmações mais recentes com UMA chamada (listar é paginada no contrato).
async function carregarAfirmacoes(total) {
  const PAGINA = 20;
  const inicio = Math.max(0, total - PAGINA);
  afirmacoes = total === 0 ? [] : [...(await contrato.methods.listar(inicio, PAGINA).call())].reverse();

  // Quais afirmações pendentes eu já apoiei? (mapping aninhado apoiou[id][conta])
  const jaApoiei = {};
  await Promise.all(
    afirmacoes
      .filter((a) => Number(a.status) === 0)
      .map(async (a) => (jaApoiei[a.id] = await contrato.methods.apoiou(a.id, conta).call()))
  );

  const lista = $("listaAf");
  lista.replaceChildren();
  if (afirmacoes.length === 0) {
    lista.append(el("p", { class: "vazio", textContent: "Nenhuma afirmação registrada ainda." }));
  }
  afirmacoes.forEach((a) => lista.append(cartaoAfirmacao(a, !!jaApoiei[a.id])));
  $("admPendentes").textContent = afirmacoes.filter((a) => Number(a.status) === 0).length;
}

function cartaoAfirmacao(a, jaApoiou) {
  const status = STATUS[Number(a.status)];
  const pendente = Number(a.status) === 0;
  const souAutor = mesmoEndereco(a.autor, conta);
  const id = Number(a.id);

  const acoes = el("div", { class: "af-acoes" });
  if (pendente && !souAutor) {
    acoes.append(
      el("button", {
        class: "pequeno secundario",
        textContent: jaApoiou ? "Apoiado ✓" : "👍 Reproduzi e apoio",
        disabled: jaApoiou || !naRede,
        onclick: () => executar(`Apoiar #${id}`, contrato.methods.apoiar(id)),
      })
    );
  }
  if (pendente && souAutor) {
    acoes.append(
      el("button", {
        class: "pequeno perigo",
        textContent: "Cancelar e recuperar depósito",
        onclick: () => executar(`Cancelar #${id}`, contrato.methods.cancelar(id)),
      })
    );
  }
  if (pendente && ehDono) {
    acoes.append(
      el("button", { class: "pequeno sucesso", textContent: "Confirmar", onclick: () => executar(`Confirmar #${id}`, contrato.methods.resolver(id, true)) }),
      el("button", { class: "pequeno perigo", textContent: "Refutar", onclick: () => executar(`Refutar #${id}`, contrato.methods.resolver(id, false)) })
    );
  }

  return el(
    "article",
    { class: "af" },
    el("div", { class: "af-topo" },
      el("span", { class: "af-titulo", textContent: `#${id} · ${a.entidade}` }),
      el("span", { class: `selo ${status}`, textContent: status })
    ),
    el("div", { class: "af-qtd", textContent: `${a.quantidade} linhas com sentimento ${SENTIMENTOS[Number(a.sentimento)]}` }),
    el("small", { textContent: `autor ${encurtar(a.autor)}${souAutor ? " (você)" : ""} · ${new Date(Number(a.criadaEm) * 1000).toLocaleString("pt-BR")} · ${a.apoios} apoio(s) · depósito ${eth(a.deposito)} ETH` }),
    el("small", { textContent: `evidência (sha256): ${a.evidenciaHash}` }),
    el("small", {}, "onde achar: ", linkOuTexto(a.evidenciaURI)),
    acoes
  );
}

// ---------- 4) Escrita — .send() ----------
// Fluxo de uma transação:
//   1) simula com .call() → se o contrato fosse reverter, mostramos o motivo
//      SEM gastar gas nem abrir a MetaMask;
//   2) .send() → MetaMask pede assinatura → "transactionHash" (pendente);
//   3) recibo → confirmada (ou falhou); recarregamos a tela.
async function executar(rotulo, metodo, valorWei = "0") {
  if (!naRede || !contrato) return aviso("Conecte a carteira na Sepolia primeiro.", "erro");
  const item = novoItemTx(rotulo);
  try {
    await metodo.call({ from: conta, value: valorWei }); // simulação
    atualizarItemTx(item, "pendente", "aguardando assinatura na MetaMask…");

    const envio = metodo.send({ from: conta, value: valorWei });
    envio.on("transactionHash", (hash) => atualizarItemTx(item, "pendente", "pendente — aguardando bloco…", hash));
    const recibo = await envio;

    atualizarItemTx(item, "confirmada", `confirmada no bloco ${recibo.blockNumber} (gas usado: ${recibo.gasUsed})`, recibo.transactionHash);
    aviso(`${rotulo}: confirmada.`, "ok");
    await recarregar();
    return true;
  } catch (err) {
    const msg = traduzirErro(err);
    atualizarItemTx(item, "falhou", `falhou — ${msg}`, err?.receipt?.transactionHash);
    aviso(`${rotulo}: ${msg}`, "erro");
    return false;
  }
}

function novoItemTx(rotulo) {
  const lista = $("txLista");
  lista.querySelector(".vazio")?.remove();
  const li = el("li", { class: "pendente" }, el("strong", { textContent: rotulo }), el("span", { textContent: " — simulando…" }), el("small"));
  lista.prepend(li);
  return li;
}

function atualizarItemTx(li, estado, texto, hash) {
  li.className = estado;
  li.children[1].textContent = ` — ${texto}`;
  if (hash) {
    li.children[2].replaceChildren(el("a", { href: linkTx(hash), target: "_blank", rel: "noopener noreferrer", textContent: `${hash} ↗ Etherscan` }));
  }
}

async function registrar(ev) {
  ev.preventDefault();
  const entidade = $("fEntidade").value.trim();
  const sentimento = Number($("fSentimento").value);
  const qtdTxt = $("fQuantidade").value.trim();
  const hash = $("fHash").value.trim();
  const uri = $("fUri").value.trim();

  if (!entidade) return aviso("Informe a entidade.", "erro");
  if (!/^\d+$/.test(qtdTxt)) return aviso("Quantidade deve ser um inteiro ≥ 0.", "erro");
  if (BigInt(qtdTxt) > totalLinhas) return aviso(`Quantidade maior que o total de linhas do dataset (${totalLinhas}).`, "erro");
  if (!ehHash(hash)) return aviso("O hash precisa ter o formato 0x + 64 caracteres hexadecimais.", "erro");
  if (!uri) return aviso("Informe onde achar a evidência.", "erro");

  const ok = await executar(
    `Registrar ${entidade}/${SENTIMENTOS[sentimento]}`,
    contrato.methods.registrarAfirmacao(entidade, sentimento, qtdTxt, hash, uri),
    taxa.toString() // ETH enviado junto da transação (payable)
  );
  if (ok) $("formRegistro").reset();
}

async function anexarEvidencia(ev) {
  ev.preventDefault();
  const id = $("eId").value.trim();
  const hash = $("eHash").value.trim();
  const uri = $("eUri").value.trim();
  if (!ehHash(hash)) return aviso("Hash inválido (0x + 64 hex).", "erro");
  await executar(`Anexar evidência #${id}`, contrato.methods.anexarEvidencia(id, hash, uri));
}

const sacar = () => executar("Sacar saldo", contrato.methods.sacar());

// ---------- 5) Tradução de erros ----------
// Três famílias: (a) usuário rejeitou (código 4001), (b) revert do contrato
// (erro customizado ou require), (c) falta de saldo/gas.
const MENSAGENS = {
  ApenasDono: () => "Apenas o dono (curador) pode fazer isso.",
  ApenasAutor: (a) => `Só o autor da afirmação #${a.id} pode fazer isso.`,
  AfirmacaoInexistente: (a) => `A afirmação #${a.id} não existe.`,
  EstadoInvalido: (a) => `A afirmação está "${STATUS[Number(a.atual)]}", mas a ação exige "${STATUS[Number(a.esperado)]}".`,
  ValorIncorreto: (a) => `Valor enviado (${eth(a.enviado)} ETH) difere do depósito exigido (${eth(a.exigido)} ETH).`,
  CampoInvalido: (a) => `Campo inválido: ${a.campo}.`,
  AfirmacaoDuplicada: () => "Já existe uma afirmação ativa idêntica (mesma entidade, sentimento e quantidade).",
  JaApoiou: (a) => `Você já apoiou a afirmação #${a.id}.`,
  AutoApoio: () => "Você não pode apoiar a sua própria afirmação.",
  SaldoInsuficiente: () => "Você não tem saldo no contrato para sacar.",
  Error: (a) => `O contrato recusou: ${a[0] ?? a.message}`, // require(..., "mensagem")
};

// seletor (4 bytes) → definição, montado a partir da ABI
function montarMapaErros() {
  const mapa = {};
  ABI.filter((x) => x.type === "error").forEach((e) => {
    mapa[web3.eth.abi.encodeFunctionSignature({ name: e.name, type: "function", inputs: e.inputs })] = e;
  });
  mapa["0x08c379a0"] = { name: "Error", inputs: [{ type: "string", name: "message" }] }; // require
  return mapa;
}

// Procura os bytes de retorno do revert em qualquer ponto do objeto de erro
// (a forma muda conforme provider/versão).
function acharDadosRevert(obj, prof = 0) {
  if (!obj || typeof obj !== "object" || prof > 6) return null;
  if (typeof obj.data === "string" && /^0x[0-9a-fA-F]{8,}$/.test(obj.data)) return obj.data;
  for (const k of ["data", "cause", "error", "originalError", "innerError", "info"]) {
    const r = acharDadosRevert(obj[k], prof + 1);
    if (r) return r;
  }
  return null;
}

function lerErroContrato(err) {
  // Caminho 1: a Web3.js v4 já decodifica erros que estão na ABI.
  if (err?.cause?.errorName) return { nome: err.cause.errorName, args: err.cause.errorArgs || {} };
  // Caminho 2: decodificação manual dos bytes do revert.
  const dados = acharDadosRevert(err);
  const def = dados && mapaErros[dados.slice(0, 10)];
  if (!def) return null;
  const args = def.inputs.length ? web3.eth.abi.decodeParameters(def.inputs, `0x${dados.slice(10)}`) : {};
  return { nome: def.name, args };
}

function traduzirErro(err) {
  const texto = String(err?.message || err?.cause?.message || err || "");
  const codigo = err?.code ?? err?.cause?.code ?? err?.data?.originalError?.code;
  if (codigo === 4001 || codigo === "ACTION_REJECTED" || /user (denied|rejected)/i.test(texto)) {
    return "Você rejeitou a operação na MetaMask.";
  }
  if (codigo === -32002) return "Já existe um pedido pendente na MetaMask. Abra a extensão.";
  try {
    const e = lerErroContrato(err);
    if (e && MENSAGENS[e.nome]) return MENSAGENS[e.nome](e.args);
  } catch {
    /* cai nas mensagens genéricas abaixo */
  }
  if (/insufficient funds|exceeds balance|gas required exceeds/i.test(texto)) {
    return "Saldo de SepoliaETH insuficiente para o valor + gas. Use um faucet da Sepolia.";
  }
  return `Erro inesperado: ${texto.slice(0, 160)}`;
}

// ---------- 6) Eventos ----------
// Cada `emit` do contrato vira um log na blockchain. getPastEvents os consulta
// e decodifica com a ABI. "allEvents" traz todos os tipos de uma vez.
function descreverEvento(ev) {
  const r = ev.returnValues;
  switch (ev.event) {
    case "AfirmacaoRegistrada":
      return `#${r.id} registrada por ${encurtar(r.autor)}: ${r.entidade} / ${SENTIMENTOS[Number(r.sentimento)]} = ${r.quantidade} linhas`;
    case "EvidenciaAnexada":
      return `#${r.id}: evidência atualizada por ${encurtar(r.autor)}`;
    case "AfirmacaoApoiada":
      return `#${r.id} apoiada por ${encurtar(r.apoiador)} (total: ${r.totalApoios})`;
    case "AfirmacaoResolvida":
      return `#${r.id} ${STATUS[Number(r.status)].toLowerCase()} (reputação do autor: ${r.reputacaoDoAutor})`;
    case "AfirmacaoCancelada":
      return `#${r.id} cancelada pelo autor ${encurtar(r.autor)}`;
    case "Sacado":
      return `${encurtar(r.quem)} sacou ${eth(r.valor)} ETH`;
    default:
      return ev.event;
  }
}

async function carregarHistorico() {
  let eventos;
  try {
    eventos = await contrato.getPastEvents("allEvents", { fromBlock: BigInt(BLOCO_DEPLOY), toBlock: "latest" });
  } catch {
    // Alguns RPCs limitam o intervalo de blocos: tenta só os últimos 5000.
    const atual = await web3.eth.getBlockNumber();
    eventos = await contrato.getPastEvents("allEvents", { fromBlock: atual > 5000n ? atual - 5000n : 0n, toBlock: "latest" });
  }

  const lista = $("historico");
  lista.replaceChildren();
  if (eventos.length === 0) return lista.append(el("li", { class: "vazio", textContent: "Nenhum evento ainda." }));

  eventos.slice(-30).reverse().forEach((ev) => {
    lista.append(
      el("li", {},
        descreverEvento(ev),
        el("small", {}, `bloco ${ev.blockNumber} · `, el("a", { href: linkTx(ev.transactionHash), target: "_blank", rel: "noopener noreferrer", textContent: encurtar(ev.transactionHash) }))
      )
    );
  });
}

// ---------- 7) Verificador de hash (local, no navegador) ----------
// Qualquer um pode conferir que o CSV/evidência que baixou é o mesmo que o
// contrato referencia: o arquivo NÃO é enviado a lugar nenhum.
async function verificarArquivo(ev) {
  const arquivo = ev.target.files[0];
  const saida = $("resultadoHash");
  if (!arquivo) return;
  if (!contrato) return (saida.textContent = "Conecte a carteira (Sepolia) para comparar com o contrato.");
  saida.textContent = "Calculando…";

  const digest = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  const hex = "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const eDataset = await contrato.methods.datasetConfere(hex).call(); // leitura on-chain
  const acertos = afirmacoes.filter((a) => a.evidenciaHash.toLowerCase() === hex.toLowerCase());
  let veredito = "não corresponde ao dataset nem a nenhuma evidência listada.";
  if (eDataset) veredito = "✓ é o dataset oficial registrado no contrato.";
  else if (acertos.length) veredito = `✓ é a evidência da(s) afirmação(ões) ${acertos.map((a) => "#" + a.id).join(", ")}.`;
  saida.textContent = `${hex}\n${veredito}`;
  saida.style.whiteSpace = "pre-wrap";
}

// ---------- 8) Ligações de UI e eventos da carteira ----------
$("listaEntidades").append(...ENTIDADES.map((e) => el("option", { value: e })));
$("btnConectar").addEventListener("click", conectar);
$("btnTrocarRede").addEventListener("click", trocarRede);
$("btnAtualizar").addEventListener("click", async () => {
  await recarregar();
  aviso("Dados atualizados.", "ok");
});
$("btnSacar").addEventListener("click", sacar);
$("formRegistro").addEventListener("submit", registrar);
$("formEvidencia").addEventListener("submit", anexarEvidencia);
$("arquivoHash").addEventListener("change", verificarArquivo);

if (window.ethereum) {
  // Troca de conta: atualiza a tela sem recarregar a página.
  window.ethereum.on("accountsChanged", (contas) => {
    if (contas.length === 0) return window.location.reload(); // desconectou
    iniciarSessao(contas[0]).catch((e) => aviso(traduzirErro(e), "erro"));
  });
  // Troca de rede: recomendação da MetaMask é recarregar (estado limpo).
  window.ethereum.on("chainChanged", () => window.location.reload());

  // Se o site já foi autorizado antes, reconecta sem abrir popup.
  window.ethereum.request({ method: "eth_accounts" }).then((contas) => {
    if (contas.length && Web3.utils.isAddress(CONTRACT_ADDRESS) && !/^0x0+$/.test(CONTRACT_ADDRESS)) {
      iniciarSessao(contas[0]).catch((e) => aviso(traduzirErro(e), "erro"));
    }
  });
}
