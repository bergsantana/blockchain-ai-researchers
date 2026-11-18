// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EvidenciasDataset
/// @author Projeto de estudo — introdução a blockchain
/// @notice Registro on-chain de AFIRMAÇÕES (claims) sobre um dataset público de
///         tweets (twitter_training.csv: tweet_id, entidade, sentimento, texto)
///         e de COMO CHEGAR às evidências que as sustentam.
/// @dev O contrato NÃO guarda o dataset nem as evidências (seria caro demais).
///      Guarda apenas "impressões digitais" (hash SHA-256) e um ponteiro (URI):
///        - DATASET_HASH      → identifica exatamente qual versão do CSV é a base;
///        - evidenciaHash     → hash do arquivo de evidência (lista de tweet_ids);
///        - evidenciaURI      → onde baixar esse arquivo (GitHub raw, ipfs://...).
///      Qualquer pessoa baixa o CSV, confere o hash, refaz a contagem com
///      scripts/evidencia.py e confirma se a afirmação é verdadeira.
///      Para evitar spam, quem afirma deixa um depósito (TAXA_REGISTRO): é
///      devolvido se a afirmação for confirmada e perdido se for refutada.
contract EvidenciasDataset {
    // ---------------------------------------------------------------
    // [Recurso: StructsEEnums] — enums de estado + struct com 11 campos
    // ---------------------------------------------------------------

    /// @dev A ordem espelha os rótulos do dataset (coluna 3 do CSV).
    enum Sentimento { Positive, Negative, Neutral, Irrelevant }

    /// @dev Ciclo de vida: Pendente → Confirmada | Refutada | Cancelada.
    enum Status { Pendente, Confirmada, Refutada, Cancelada }

    /// @notice Uma afirmação do tipo "o dataset tem `quantidade` linhas da
    ///         entidade X com sentimento Y", mais o caminho até a evidência.
    struct Afirmacao {
        uint256 id;
        address autor;
        string entidade;        // ex.: "Borderlands" (grafia exata do CSV)
        Sentimento sentimento;
        uint256 quantidade;     // nº de linhas afirmado
        bytes32 evidenciaHash;  // SHA-256 do arquivo de evidência
        string evidenciaURI;    // como alcançar o arquivo
        Status status;
        uint256 apoios;         // quantos endereços reproduziram/apoiaram
        uint256 deposito;       // wei em garantia
        uint256 criadaEm;       // block.timestamp
    }

    // ---------------------------------------------------------------
    // [Recurso: TiposDeDados] — uint256, int256, bool, address payable,
    // string, bytes32, constant e immutable
    // ---------------------------------------------------------------

    /// @notice Dono/curador: único que confirma ou refuta afirmações.
    address payable public immutable DONO;
    /// @notice SHA-256 do CSV usado como base (imutável após o deploy).
    bytes32 public immutable DATASET_HASH;
    /// @notice Total de linhas do CSV (teto lógico para qualquer contagem).
    uint256 public immutable TOTAL_LINHAS;

    /// @notice Depósito exigido de quem registra uma afirmação.
    uint256 public constant TAXA_REGISTRO = 0.001 ether;
    /// @notice Máximo de itens devolvidos por consulta paginada.
    uint256 public constant MAX_PAGINA = 20;
    /// @dev Limites de tamanho (em bytes) para strings vindas do usuário.
    uint256 private constant MAX_ENTIDADE = 64;
    uint256 private constant MAX_URI = 200;

    /// @notice Nome legível do dataset.
    string public nomeDataset;
    /// @notice Onde baixar o CSV original.
    string public uriDataset;

    /// @notice Reputação: +1 por afirmação confirmada, −1 por refutada (int256
    ///         porque pode ficar negativa).
    mapping(address => int256) public reputacao;

    // ---------------------------------------------------------------
    // [Recurso: ArraysEMappings]
    // ---------------------------------------------------------------

    /// @notice Array dinâmico de todas as afirmações (o índice é o id).
    Afirmacao[] private afirmacoes;

    /// @notice Mapping simples: saldo retirável (pull payment) de cada endereço.
    mapping(address => uint256) public saldos;

    /// @notice Mapping aninhado: id da afirmação → endereço → já apoiou?
    mapping(uint256 => mapping(address => bool)) public apoiou;

    /// @dev Mapping → array: ids das afirmações de cada autor.
    mapping(address => uint256[]) private idsDoAutor;

    /// @dev Impede registrar duas vezes a mesma afirmação ativa.
    mapping(bytes32 => bool) private jaRegistrada;

    // ---------------------------------------------------------------
    // [Recurso: EventosEErros] — eventos com `indexed` e erros customizados
    // ---------------------------------------------------------------

    event AfirmacaoRegistrada(
        uint256 indexed id,
        address indexed autor,
        string entidade,
        Sentimento sentimento,
        uint256 quantidade,
        bytes32 evidenciaHash,
        string evidenciaURI
    );
    event EvidenciaAnexada(
        uint256 indexed id,
        address indexed autor,
        bytes32 evidenciaHash,
        string evidenciaURI
    );
    event AfirmacaoApoiada(uint256 indexed id, address indexed apoiador, uint256 totalApoios);
    event AfirmacaoResolvida(uint256 indexed id, Status indexed status, int256 reputacaoDoAutor);
    event AfirmacaoCancelada(uint256 indexed id, address indexed autor);
    event Sacado(address indexed quem, uint256 valor);

    error ApenasDono(address chamador);
    error ApenasAutor(uint256 id, address chamador);
    error AfirmacaoInexistente(uint256 id);
    error EstadoInvalido(Status atual, Status esperado);
    error ValorIncorreto(uint256 enviado, uint256 exigido);
    error CampoInvalido(string campo);
    error AfirmacaoDuplicada();
    error JaApoiou(uint256 id);
    error AutoApoio(uint256 id);
    error SaldoInsuficiente(uint256 disponivel, uint256 solicitado);

    // ---------------------------------------------------------------
    // [Recurso: Modificadores] — 3 modificadores próprios (2 com parâmetro)
    // ---------------------------------------------------------------

    /// @dev Restringe a função ao dono (controle de acesso).
    modifier apenasDono() {
        if (msg.sender != DONO) revert ApenasDono(msg.sender);
        _;
    }

    /// @dev Garante que o id existe no array.
    modifier afirmacaoExiste(uint256 id) {
        if (id >= afirmacoes.length) revert AfirmacaoInexistente(id);
        _;
    }

    /// @dev Garante que a afirmação está no estado `esperado`.
    modifier noEstado(uint256 id, Status esperado) {
        Status atual = afirmacoes[id].status;
        if (atual != esperado) revert EstadoInvalido(atual, esperado);
        _;
    }

    /// @dev Garante que quem chama é o autor da afirmação.
    modifier apenasAutor(uint256 id) {
        if (afirmacoes[id].autor != msg.sender) revert ApenasAutor(id, msg.sender);
        _;
    }

    // ---------------------------------------------------------------
    // [Recurso: Funcoes] — constructor, external, public, internal, private,
    // view, pure e payable
    // ---------------------------------------------------------------

    /// @param _nome Nome do dataset.
    /// @param _hash SHA-256 do arquivo CSV (use `python3 scripts/evidencia.py hash`).
    /// @param _linhas Número de linhas do CSV (74682 no twitter_training.csv).
    /// @param _uri Onde baixar o CSV.
    constructor(string memory _nome, bytes32 _hash, uint256 _linhas, string memory _uri) {
        if (_hash == bytes32(0)) revert CampoInvalido("hash do dataset");
        if (_linhas == 0) revert CampoInvalido("linhas do dataset");
        DONO = payable(msg.sender);
        DATASET_HASH = _hash;
        TOTAL_LINHAS = _linhas;
        nomeDataset = _nome;
        uriDataset = _uri;
    }

    /// @notice Registra uma afirmação sobre o dataset e o caminho até a evidência.
    /// @dev payable: exige exatamente TAXA_REGISTRO como depósito.
    /// @param entidade Entidade da coluna 2 do CSV (ex.: "Borderlands").
    /// @param sentimento Sentimento da coluna 3 do CSV.
    /// @param quantidade Quantas linhas têm essa entidade + sentimento.
    /// @param evidenciaHash SHA-256 do arquivo de evidência.
    /// @param evidenciaURI Onde baixar o arquivo de evidência.
    /// @return id Identificador da nova afirmação.
    function registrarAfirmacao(
        string calldata entidade,
        Sentimento sentimento,
        uint256 quantidade,
        bytes32 evidenciaHash,
        string calldata evidenciaURI
    ) external payable returns (uint256 id) {
        if (msg.value != TAXA_REGISTRO) revert ValorIncorreto(msg.value, TAXA_REGISTRO);
        _validarCampos(entidade, quantidade, evidenciaHash, evidenciaURI);

        bytes32 chave = impressao(entidade, sentimento, quantidade);
        if (jaRegistrada[chave]) revert AfirmacaoDuplicada();
        jaRegistrada[chave] = true;

        id = afirmacoes.length;
        afirmacoes.push(
            Afirmacao({
                id: id,
                autor: msg.sender,
                entidade: entidade,
                sentimento: sentimento,
                quantidade: quantidade,
                evidenciaHash: evidenciaHash,
                evidenciaURI: evidenciaURI,
                status: Status.Pendente,
                apoios: 0,
                deposito: msg.value,
                criadaEm: block.timestamp
            })
        );
        idsDoAutor[msg.sender].push(id);

        emit AfirmacaoRegistrada(id, msg.sender, entidade, sentimento, quantidade, evidenciaHash, evidenciaURI);
    }

    /// @notice O autor troca a evidência (ex.: corrigiu o arquivo ou mudou o link).
    /// @param id Afirmação a atualizar (precisa estar Pendente).
    /// @param evidenciaHash Novo SHA-256.
    /// @param evidenciaURI Novo ponteiro.
    function anexarEvidencia(uint256 id, bytes32 evidenciaHash, string calldata evidenciaURI)
        external
        afirmacaoExiste(id)
        apenasAutor(id)
        noEstado(id, Status.Pendente)
    {
        if (evidenciaHash == bytes32(0)) revert CampoInvalido("evidenciaHash");
        if (bytes(evidenciaURI).length == 0 || bytes(evidenciaURI).length > MAX_URI) {
            revert CampoInvalido("evidenciaURI");
        }
        Afirmacao storage a = afirmacoes[id];
        a.evidenciaHash = evidenciaHash;
        a.evidenciaURI = evidenciaURI;
        emit EvidenciaAnexada(id, msg.sender, evidenciaHash, evidenciaURI);
    }

    /// @notice Registra que você reproduziu a contagem e concorda com a afirmação.
    /// @param id Afirmação apoiada (Pendente; não pode ser a sua; 1 apoio por conta).
    function apoiar(uint256 id) external afirmacaoExiste(id) noEstado(id, Status.Pendente) {
        Afirmacao storage a = afirmacoes[id];
        if (a.autor == msg.sender) revert AutoApoio(id);
        if (apoiou[id][msg.sender]) revert JaApoiou(id);

        apoiou[id][msg.sender] = true;
        a.apoios += 1;
        emit AfirmacaoApoiada(id, msg.sender, a.apoios);
    }

    /// @notice O autor desiste da afirmação e recupera o depósito.
    /// @param id Afirmação a cancelar (precisa estar Pendente).
    function cancelar(uint256 id)
        external
        afirmacaoExiste(id)
        apenasAutor(id)
        noEstado(id, Status.Pendente)
    {
        Afirmacao storage a = afirmacoes[id];
        // Checks-Effects-Interactions: só altera estado aqui; o ETH sai em sacar().
        a.status = Status.Cancelada;
        jaRegistrada[impressao(a.entidade, a.sentimento, a.quantidade)] = false; // pode ser refeita
        uint256 valor = a.deposito;
        a.deposito = 0;
        _creditar(msg.sender, valor);
        emit AfirmacaoCancelada(id, msg.sender);
    }

    /// @notice O dono confere a evidência fora da cadeia e decide o resultado.
    /// @dev Confirmada → depósito volta ao autor e reputação +1.
    ///      Refutada   → depósito vai para o dono e reputação −1.
    /// @param id Afirmação a resolver (precisa estar Pendente).
    /// @param confirmada true = confirma; false = refuta.
    function resolver(uint256 id, bool confirmada)
        external
        apenasDono
        afirmacaoExiste(id)
        noEstado(id, Status.Pendente)
    {
        Afirmacao storage a = afirmacoes[id];
        uint256 valor = a.deposito;
        a.deposito = 0;

        if (confirmada) {
            a.status = Status.Confirmada;
            reputacao[a.autor] += 1;
            _creditar(a.autor, valor);
        } else {
            a.status = Status.Refutada;
            reputacao[a.autor] -= 1;
            _creditar(DONO, valor);
        }
        emit AfirmacaoResolvida(id, a.status, reputacao[a.autor]);
    }

    /// @notice Retira todo o saldo creditado ao chamador (pull payment).
    function sacar() external {
        uint256 valor = saldos[msg.sender];
        if (valor == 0) revert SaldoInsuficiente(0, 1);

        saldos[msg.sender] = 0; // efeito ANTES da interação (evita reentrância)
        (bool ok, ) = payable(msg.sender).call{value: valor}("");
        require(ok, "Falha ao enviar ETH");
        emit Sacado(msg.sender, valor);
    }

    /// @notice Lê uma afirmação pelo id.
    /// @param id Identificador.
    function obterAfirmacao(uint256 id) public view afirmacaoExiste(id) returns (Afirmacao memory) {
        return afirmacoes[id];
    }

    /// @notice Quantas afirmações existem.
    function totalAfirmacoes() external view returns (uint256) {
        return afirmacoes.length;
    }

    /// @notice Lista afirmações em páginas de no máximo MAX_PAGINA itens.
    /// @param inicio Primeiro id a devolver.
    /// @param limite Quantos itens (será cortado em MAX_PAGINA).
    function listar(uint256 inicio, uint256 limite) external view returns (Afirmacao[] memory lista) {
        uint256 total = afirmacoes.length;
        if (inicio >= total) {
            return new Afirmacao[](0);
        }
        uint256 n = limite > MAX_PAGINA ? MAX_PAGINA : limite;
        if (inicio + n > total) {
            n = total - inicio;
        }
        lista = new Afirmacao[](n);
        // [Recurso: EstruturasDeControle] laço limitado por MAX_PAGINA
        for (uint256 i = 0; i < n; i++) {
            lista[i] = obterAfirmacao(inicio + i);
        }
    }

    /// @notice Resume as afirmações de um autor por estado.
    /// @dev Percorre no máximo MAX_PAGINA ids do autor (os mais antigos).
    function resumoDoAutor(address autor)
        external
        view
        returns (uint256 pendentes, uint256 confirmadas, uint256 refutadas, uint256 total)
    {
        uint256[] storage ids = idsDoAutor[autor];
        total = ids.length;
        uint256 limite = total > MAX_PAGINA ? MAX_PAGINA : total;
        // [Recurso: EstruturasDeControle] laço limitado + if/else
        for (uint256 i = 0; i < limite; i++) {
            Status s = afirmacoes[ids[i]].status;
            if (s == Status.Pendente) {
                pendentes++;
            } else if (s == Status.Confirmada) {
                confirmadas++;
            } else if (s == Status.Refutada) {
                refutadas++;
            }
        }
    }

    /// @notice Confere se um hash (calculado do SEU CSV) é o do dataset oficial.
    /// @param hashLocal SHA-256 do arquivo que você baixou.
    function datasetConfere(bytes32 hashLocal) external view returns (bool) {
        return hashLocal == DATASET_HASH;
    }

    /// @notice Impressão digital de uma afirmação (usada contra duplicatas).
    /// @dev pure: não lê nem escreve estado.
    function impressao(string memory entidade, Sentimento sentimento, uint256 quantidade)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(entidade, sentimento, quantidade));
    }

    /// @dev internal: validações compartilhadas do registro.
    function _validarCampos(
        string calldata entidade,
        uint256 quantidade,
        bytes32 evidenciaHash,
        string calldata evidenciaURI
    ) internal view {
        // require com mensagem (além dos erros customizados)
        require(
            bytes(entidade).length > 0 && bytes(entidade).length <= MAX_ENTIDADE,
            "Entidade vazia ou longa demais"
        );
        if (quantidade > TOTAL_LINHAS) revert CampoInvalido("quantidade");
        if (evidenciaHash == bytes32(0)) revert CampoInvalido("evidenciaHash");
        if (bytes(evidenciaURI).length == 0 || bytes(evidenciaURI).length > MAX_URI) {
            revert CampoInvalido("evidenciaURI");
        }
    }

    /// @dev private: só este contrato mexe no mapa de saldos.
    function _creditar(address quem, uint256 valor) private {
        if (valor > 0) {
            saldos[quem] += valor;
        }
    }
}
