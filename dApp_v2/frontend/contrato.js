// ============================================================
// contrato.js — ABI + endereço do contrato implantado
// ------------------------------------------------------------
// Depois do deploy no Remix (Injected Provider - MetaMask, rede Sepolia):
//   1. Cole o endereço em CONTRACT_ADDRESS.
//   2. Cole o número do bloco do deploy em BLOCO_DEPLOY (Etherscan > Transaction
//      > Block). É de onde começamos a ler eventos.
// Se alterar o contrato, recompile e substitua a ABI (Remix > Solidity Compiler > ABI).
// ============================================================
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO: endereço do deploy
const BLOCO_DEPLOY = 0; // TODO: bloco do deploy

const ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_nome",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "_hash",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_linhas",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "_uri",
        "type": "string"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AfirmacaoDuplicada",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "AfirmacaoInexistente",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "chamador",
        "type": "address"
      }
    ],
    "name": "ApenasAutor",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "chamador",
        "type": "address"
      }
    ],
    "name": "ApenasDono",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "AutoApoio",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "campo",
        "type": "string"
      }
    ],
    "name": "CampoInvalido",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "enum EvidenciasDataset.Status",
        "name": "atual",
        "type": "uint8"
      },
      {
        "internalType": "enum EvidenciasDataset.Status",
        "name": "esperado",
        "type": "uint8"
      }
    ],
    "name": "EstadoInvalido",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "JaApoiou",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "disponivel",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "solicitado",
        "type": "uint256"
      }
    ],
    "name": "SaldoInsuficiente",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "enviado",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "exigido",
        "type": "uint256"
      }
    ],
    "name": "ValorIncorreto",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "apoiador",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalApoios",
        "type": "uint256"
      }
    ],
    "name": "AfirmacaoApoiada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "autor",
        "type": "address"
      }
    ],
    "name": "AfirmacaoCancelada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "autor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "entidade",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "enum EvidenciasDataset.Sentimento",
        "name": "sentimento",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "quantidade",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "evidenciaHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "evidenciaURI",
        "type": "string"
      }
    ],
    "name": "AfirmacaoRegistrada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "enum EvidenciasDataset.Status",
        "name": "status",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "int256",
        "name": "reputacaoDoAutor",
        "type": "int256"
      }
    ],
    "name": "AfirmacaoResolvida",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "autor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "evidenciaHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "evidenciaURI",
        "type": "string"
      }
    ],
    "name": "EvidenciaAnexada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "quem",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valor",
        "type": "uint256"
      }
    ],
    "name": "Sacado",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DATASET_HASH",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DONO",
    "outputs": [
      {
        "internalType": "address payable",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_PAGINA",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TAXA_REGISTRO",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TOTAL_LINHAS",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "evidenciaHash",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "evidenciaURI",
        "type": "string"
      }
    ],
    "name": "anexarEvidencia",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "apoiar",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "apoiou",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "cancelar",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "hashLocal",
        "type": "bytes32"
      }
    ],
    "name": "datasetConfere",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "entidade",
        "type": "string"
      },
      {
        "internalType": "enum EvidenciasDataset.Sentimento",
        "name": "sentimento",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "quantidade",
        "type": "uint256"
      }
    ],
    "name": "impressao",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "inicio",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "limite",
        "type": "uint256"
      }
    ],
    "name": "listar",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "autor",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "entidade",
            "type": "string"
          },
          {
            "internalType": "enum EvidenciasDataset.Sentimento",
            "name": "sentimento",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "quantidade",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "evidenciaHash",
            "type": "bytes32"
          },
          {
            "internalType": "string",
            "name": "evidenciaURI",
            "type": "string"
          },
          {
            "internalType": "enum EvidenciasDataset.Status",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "apoios",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deposito",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "criadaEm",
            "type": "uint256"
          }
        ],
        "internalType": "struct EvidenciasDataset.Afirmacao[]",
        "name": "lista",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nomeDataset",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "obterAfirmacao",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "autor",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "entidade",
            "type": "string"
          },
          {
            "internalType": "enum EvidenciasDataset.Sentimento",
            "name": "sentimento",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "quantidade",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "evidenciaHash",
            "type": "bytes32"
          },
          {
            "internalType": "string",
            "name": "evidenciaURI",
            "type": "string"
          },
          {
            "internalType": "enum EvidenciasDataset.Status",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "apoios",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "deposito",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "criadaEm",
            "type": "uint256"
          }
        ],
        "internalType": "struct EvidenciasDataset.Afirmacao",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "entidade",
        "type": "string"
      },
      {
        "internalType": "enum EvidenciasDataset.Sentimento",
        "name": "sentimento",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "quantidade",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "evidenciaHash",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "evidenciaURI",
        "type": "string"
      }
    ],
    "name": "registrarAfirmacao",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "reputacao",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "confirmada",
        "type": "bool"
      }
    ],
    "name": "resolver",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "autor",
        "type": "address"
      }
    ],
    "name": "resumoDoAutor",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "pendentes",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "confirmadas",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "refutadas",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "total",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "sacar",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "saldos",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalAfirmacoes",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "uriDataset",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
