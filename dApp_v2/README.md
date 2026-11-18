# Evidências do Dataset — dApp de estudo (v2)

Projeto introdutório de blockchain: um contrato **Solidity** na **Sepolia** + frontend em
**HTML/CSS/JS puros + Web3.js v4 + MetaMask**, seguindo o `guia.docx`.
Evolui o exemplo `dApp_v1` (Mural de Mensagens) para um caso com regra de negócio.

## 1. Tema e problema resolvido

O dataset `dataset/twitter_training.csv` tem 74.682 tweets (`tweet_id, entidade, sentimento, texto`).
Quando alguém diz *“a entidade Borderlands tem 1020 tweets Positive”*, como outras pessoas sabem
se isso é verdade, e **em qual versão do arquivo**?

O contrato **não guarda o dataset** (caro demais). Ele guarda só:

| On-chain | Para quê |
|---|---|
| `DATASET_HASH` (SHA-256 do CSV) | fixa **qual** arquivo é a base — quem alterar uma vírgula obtém outro hash |
| a **afirmação**: entidade + sentimento + quantidade | o que se alega |
| `evidenciaHash` + `evidenciaURI` | **como chegar à evidência**: URL do arquivo e a impressão digital dele |
| depósito, apoios, status, reputação | incentivo para afirmar com verdade e verificar |

**Por que blockchain aqui?** O registro é público, tem data e autoria, e não pode ser editado
depois (só se pode registrar uma nova versão). Ninguém precisa confiar em quem afirmou:
qualquer um baixa o CSV, confere o hash e refaz a conta.

### Fluxo

```
 autor                       contrato                         curador (dono)
   │ python3 scripts/evidencia.py contar Borderlands Positive
   │   → quantidade=1020, evidenciaHash, arquivo evidencias/*.txt (publica no GitHub)
   │── registrarAfirmacao(...) + 0,001 ETH ─▶ Pendente
   │                               ▲ apoiar(id)  ← outros reproduzem e apoiam
   │                               │ anexarEvidencia(id) / cancelar(id)
   │                               │◀──────────── resolver(id, true|false) ──
   │◀── depósito volta (Confirmada) ou vai ao dono (Refutada) → sacar()
```

Estados (`enum Status`): `Pendente → Confirmada | Refutada | Cancelada`.

## 2. Integrantes e papéis

| Integrante | Papel |
|---|---|
| _preencher_ | Contrato (Solidity, testes no Remix) |
| _preencher_ | Frontend (HTML/CSS) |
| _preencher_ | Integração Web3 |
| _preencher_ | Documentação e QA |

## 3. Dados do deploy (preencher após implantar)

| Item | Valor |
|---|---|
| Rede | Sepolia (Chain ID 11155111) |
| Endereço do contrato | `0x…` |
| Hash da transação de deploy | `0x…` |
| Bloco | `…` |
| Etherscan | `https://sepolia.etherscan.io/address/0x…` |
| URL da dApp (Vercel) | `https://<projeto>.vercel.app` |
| Vídeo de demonstração | _link_ |

## 4. Estrutura

```
dApp_v2/
├── contracts/EvidenciasDataset.sol   contrato comentado (NatSpec + marcas // [Recurso: …])
├── frontend/
│   ├── index.html  style.css  app.js
│   └── contrato.js                   ABI + endereço (editar após o deploy)
├── scripts/evidencia.py              gera hash do CSV, contagens e arquivos de evidência
├── evidencias/                       exemplo gerado: Borderlands_Positive.txt
├── docs/prints/                      capturas do Remix, MetaMask e Etherscan
└── README.md
```

## 5. Funções do contrato

| Função | Quem chama | O que faz | Eventos | Erros possíveis |
|---|---|---|---|---|
| `constructor(nome, hash, linhas, uri)` | quem implanta (vira o dono) | fixa dataset e dono | — | `CampoInvalido` |
| `registrarAfirmacao(...)` **payable** | qualquer um | cria afirmação `Pendente`; exige **exatamente** 0,001 ETH | `AfirmacaoRegistrada` | `ValorIncorreto`, `CampoInvalido`, `AfirmacaoDuplicada`, `require` (entidade) |
| `anexarEvidencia(id, hash, uri)` | só o autor | troca hash/URL da evidência (`Pendente`) | `EvidenciaAnexada` | `AfirmacaoInexistente`, `ApenasAutor`, `EstadoInvalido`, `CampoInvalido` |
| `apoiar(id)` | qualquer um, menos o autor | “reproduzi e concordo”; 1 por conta | `AfirmacaoApoiada` | `AfirmacaoInexistente`, `EstadoInvalido`, `AutoApoio`, `JaApoiou` |
| `cancelar(id)` | só o autor | desiste; depósito vira saldo | `AfirmacaoCancelada` | `AfirmacaoInexistente`, `ApenasAutor`, `EstadoInvalido` |
| `resolver(id, confirmada)` | **só o dono** | confirma (+1 reputação, devolve depósito) ou refuta (−1, depósito ao dono) | `AfirmacaoResolvida` | `ApenasDono`, `AfirmacaoInexistente`, `EstadoInvalido` |
| `sacar()` | qualquer um com saldo | transfere o saldo acumulado (*pull payment*) | `Sacado` | `SaldoInsuficiente`, `require` (falha no envio) |
| `obterAfirmacao(id)`, `listar(inicio, limite)`, `totalAfirmacoes()`, `resumoDoAutor(addr)`, `datasetConfere(hash)`, `impressao(...)` | qualquer um | leituras gratuitas | — | `AfirmacaoInexistente` |

## 6. Tabela de recursos de Solidity (7 grupos)

Linhas de `contracts/EvidenciasDataset.sol`. Cada grupo está marcado no código com `// [Recurso: …]`.

| Grupo | Onde aparece | Por que foi usado |
|---|---|---|
| **TiposDeDados** | `uint256` (`quantidade`, `TAXA_REGISTRO`); `int256` (`reputacao`, l.72 — pode ser negativa); `bool` (`confirmada`, `apoiou`); `address payable immutable DONO` (l.51); `string` (`entidade`, `evidenciaURI`); `bytes32` (`DATASET_HASH`, `evidenciaHash`); `constant` (l.58–63); `immutable` (l.51–55) | hashes SHA-256 cabem em `bytes32`; dono/dataset nunca mudam (`immutable` é mais barato e prova imutabilidade); a taxa é fixa (`constant`) |
| **Funcoes** | `constructor` l.166; `external` (`registrarAfirmacao`, `apoiar`, `resolver`…); `public view` `obterAfirmacao` l.309 (reusada por `listar`); `public pure` `impressao` l.368; `internal` `_validarCampos` l.377; `private` `_creditar` l.396; `payable` `registrarAfirmacao` l.190 | cada visibilidade tem uso real: validação compartilhada é `internal`, o mapa de saldos só é tocado por `private` |
| **EstruturasDeControle** | `if/else if` e laço `for` limitado em `resumoDoAutor` (l.347–358) e `listar` (l.332); `require` em `_validarCampos` (l.384) e `sacar` (l.303) | laços sempre limitados por `MAX_PAGINA` (20) para não estourar o gas |
| **ArraysEMappings** | array dinâmico `Afirmacao[] afirmacoes` (l.79); mapping simples `saldos` (l.82) e `reputacao`; mapping aninhado `apoiou[id][conta]` (l.85); mapping→array `idsDoAutor` (l.88); `jaRegistrada` (l.91) | o array guarda a lista paginável; o aninhado garante 1 apoio por conta; o simples guarda saldos |
| **StructsEEnums** | `struct Afirmacao` com 11 campos (l.31); `enum Sentimento` (l.24, igual aos rótulos do CSV); `enum Status` (l.27, ciclo de vida) | agrupa os dados de uma afirmação; o enum impede estados inválidos |
| **Modificadores** | `apenasDono` (l.133); `afirmacaoExiste(id)` (l.139); `noEstado(id, esperado)` (l.145, com parâmetro); `apenasAutor(id)` (l.152) | evitam repetir checagens e deixam as regras de acesso/estado explícitas |
| **EventosEErros** | 6 eventos com `indexed` (l.97–115); 10 erros customizados (l.117–126) usados com `revert`; `require` com mensagem | eventos alimentam o histórico do frontend; erros customizados dão dados (ex.: `ValorIncorreto(enviado, exigido)`) e custam menos gas que strings |

### Segurança (resumo)
- **Checks-Effects-Interactions** / *pull payment*: `resolver` e `cancelar` só alteram estado; o ETH sai em `sacar()`, que zera o saldo **antes** do `call`.
- Controle de acesso: `resolver` só para o dono; `anexarEvidencia`/`cancelar` só para o autor.
- Valor exato exigido no registro (nada de ETH “preso” por troco); strings com tamanho máximo; laços limitados.
- Frontend: dados on-chain são exibidos com `textContent`, links só `http(s)`/`ipfs` (sem XSS).

## 7. Como usar

### 7.1 Gerar os valores a partir do CSV
```bash
python3 scripts/evidencia.py hash                          # SHA-256 e nº de linhas (constructor)
python3 scripts/evidencia.py entidades                     # tabela entidade x sentimento
python3 scripts/evidencia.py contar Borderlands Positive   # quantidade + evidenciaHash + arquivo
```
Valores deste dataset: `_hash = 0x68ebaee4f44bda5de49b96b5e5630184f1af894970b994aa6bb0aa5e1dbfe9a0`, `_linhas = 74682`.

O arquivo de evidência é a lista de `tweet_id` (um por linha, ordem do CSV). Publique-o (ex.: GitHub,
URL “raw”) e use essa URL como `evidenciaURI`.

### 7.2 Deploy no Remix (Sepolia)
1. https://remix.ethereum.org → crie `EvidenciasDataset.sol` com o conteúdo de `contracts/`.
2. **Solidity Compiler**: versão `0.8.24` ou superior → Compile.
3. **Deploy & Run**: Environment **Injected Provider – MetaMask** (rede Sepolia; *não* use Remix VM).
4. Argumentos do constructor:
   `"twitter_training.csv"`, `0x68ebaee4f44bda5de49b96b5e5630184f1af894970b994aa6bb0aa5e1dbfe9a0`, `74682`, `"<URL de download do CSV>"`.
5. Anote endereço, hash do deploy e bloco. Opcional: verifique o código no Etherscan.

### 7.3 Configurar o frontend
Em `frontend/contrato.js` preencha `CONTRACT_ADDRESS` e `BLOCO_DEPLOY`.
A ABI já está lá (se mudar o contrato, copie a nova no Remix → Compiler → ABI).

### 7.4 Rodar local
A MetaMask não funciona em `file://`; sirva por HTTP:
```bash
cd frontend && python3 -m http.server 8000      # abra http://localhost:8000
```

### 7.5 MetaMask na Sepolia
Ative “Mostrar redes de teste” (ou use o botão **Trocar para Sepolia** da dApp). Obtenha SepoliaETH em um
faucet. Use **duas contas**: uma é o dono (quem fez o deploy), outra é o usuário. Nunca use carteira com fundos reais.

### 7.6 Publicar na Vercel (obrigatório)
Suba o repositório no GitHub → Vercel → *Add New Project* → importe o repositório → **Root Directory:
`frontend`**, Framework Preset *Other*, sem build. A URL `https://<projeto>.vercel.app` (HTTPS) é a que vai no README.

## 8. Roteiro de teste (avaliador)

1. Abra a URL da Vercel com a MetaMask na conta **usuário**. Clique **Conectar MetaMask** → endereço, saldo e rede aparecem.
2. (Opcional) Mude a MetaMask para outra rede → aparece o aviso; clique **Trocar para Sepolia**.
3. Veja o card **Dataset de referência** (leitura on-chain). Em *Verificar um arquivo*, escolha `twitter_training.csv` → “✓ é o dataset oficial”.
4. **Registrar afirmação**: `Borderlands` / `Positive` / `1020` / hash `0x5b6fbf44221285a7203ed3ef819890c133232c188f7bfd4c1ca78cd413997595` (de `evidencias/Borderlands_Positive.txt`) / uma URL → confirme 0,001 ETH. Acompanhe *pendente → confirmada* e o link do Etherscan.
5. **Provocar erro**: registre de novo a mesma afirmação → “Já existe uma afirmação ativa idêntica…”. Rejeite uma transação na MetaMask → “Você rejeitou a operação…”.
6. Troque para a **outra conta**: clique **Reproduzi e apoio** na afirmação (e tente apoiar de novo → botão “Apoiado ✓”).
7. Troque para a conta do **dono**: aparece o *Painel do dono* e os botões **Confirmar/Refutar**. Confirme.
8. Volte à conta do autor: *Meu saldo no contrato* = 0,001 ETH, reputação 1 → **Sacar**.
9. Veja o **Histórico**: `AfirmacaoRegistrada`, `AfirmacaoApoiada`, `AfirmacaoResolvida`, `Sacado`.

## 9. Limitações conhecidas e melhorias

- **Confiança no curador**: quem decide `Confirmada/Refutada` é o dono — ele poderia refutar uma afirmação verdadeira e ficar com o depósito. Melhorias: limiar de apoios, votação, ou prova verificável.
- O contrato **não confere** a contagem (processar 74 mil linhas on-chain é inviável). Alternativas: Merkle tree das linhas, oráculo/ZK.
- A evidência vive fora da cadeia: se a URL sair do ar o hash continua válido, mas o arquivo some (use IPFS).
- Um único dataset por contrato; entidade é texto livre (grafia exata do CSV, sensível a maiúsculas).
- Histórico limitado aos 30 eventos mais recentes; lista às 20 afirmações mais recentes (paginação simples).
- Os testes foram feitos contra um nó local (Hardhat) — veja a seção 10.

## 10. Como foi testado

- Compilação com `solc 0.8.28`, sem avisos.
- Suíte de contrato em nó local com a mesma chain ID da Sepolia: registro, duplicata, valor errado, campos inválidos, autoapoio, apoio duplicado, acesso do dono/autor, confirmação, refutação com perda do depósito, cancelamento e novo registro, saque (conferido o valor líquido de gas), paginação e laços.
- Fluxo do frontend (`index.html` + `app.js` + `contrato.js` reais) em jsdom, com um `window.ethereum` simulado ligado ao nó local: conexão, rede errada/troca, leitura, envio com ETH, erro customizado traduzido, rejeição do usuário, troca de conta, painel do dono, eventos e verificador de hash.
- **Não** foi testado: deploy real na Sepolia, MetaMask real e Vercel (dependem da sua carteira/conta). Faça o roteiro da seção 8 após o deploy.

## 11. Declaração de uso de IA

Código (contrato, frontend, script) e este README foram gerados com auxílio do Claude Code (Anthropic) a
partir do `guia.docx` e do `dApp_v1`; a equipe deve revisar,
estudar e ser capaz de explicar cada parte na arguição. Dependência de terceiros: apenas a Web3.js v4 (CDN).
