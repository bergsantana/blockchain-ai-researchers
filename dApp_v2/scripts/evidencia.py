#!/usr/bin/env python3
"""Gera, a partir do CSV, os valores que vão para o contrato EvidenciasDataset.

Só usa a biblioteca padrão do Python (3.8+). Exemplos:

  python3 scripts/evidencia.py hash
  python3 scripts/evidencia.py entidades
  python3 scripts/evidencia.py contar Borderlands Positive

O CSV não tem cabeçalho; as colunas são: tweet_id, entidade, sentimento, texto.

Formato do ARQUIVO DE EVIDÊNCIA (para que o hash seja reproduzível):
  um tweet_id por linha, na ordem do CSV, terminando com "\\n" (UTF-8).
  Ex.: as 1020 linhas Borderlands+Positive viram 1020 ids; o SHA-256 desse
  arquivo é o `evidenciaHash` registrado no contrato.
"""
import argparse
import csv
import hashlib
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSV_PADRAO = RAIZ.parent / "dataset" / "twitter_training.csv"
SENTIMENTOS = ["Positive", "Negative", "Neutral", "Irrelevant"]  # = enum Sentimento


def sha256_arquivo(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def ler_linhas(caminho: Path):
    with open(caminho, newline="", encoding="utf-8") as f:
        yield from csv.reader(f)


def cmd_hash(args):
    linhas = sum(1 for _ in ler_linhas(args.csv))
    print(f"arquivo : {args.csv}")
    print(f"sha256  : 0x{sha256_arquivo(args.csv)}   <- _hash do constructor")
    print(f"linhas  : {linhas}   <- _linhas do constructor")


def cmd_entidades(args):
    cont = Counter((r[1], r[2]) for r in ler_linhas(args.csv))
    entidades = sorted({e for e, _ in cont})
    print(f"{'entidade':36}" + "".join(f"{s:>11}" for s in SENTIMENTOS))
    for e in entidades:
        print(f"{e:36}" + "".join(f"{cont[(e, s)]:>11}" for s in SENTIMENTOS))


def cmd_contar(args):
    if args.sentimento not in SENTIMENTOS:
        sys.exit(f"Sentimento inválido. Use um de: {', '.join(SENTIMENTOS)}")
    ids = [r[0] for r in ler_linhas(args.csv) if r[1] == args.entidade and r[2] == args.sentimento]
    if not ids:
        sys.exit(f"Nenhuma linha para '{args.entidade}' + '{args.sentimento}' (a grafia é exata).")

    args.saida.mkdir(parents=True, exist_ok=True)
    arquivo = args.saida / f"{args.entidade}_{args.sentimento}.txt"
    conteudo = "".join(f"{i}\n" for i in ids).encode("utf-8")
    arquivo.write_bytes(conteudo)

    print(f"entidade      : {args.entidade}")
    print(f"sentimento    : {args.sentimento} (enum = {SENTIMENTOS.index(args.sentimento)})")
    print(f"quantidade    : {len(ids)}")
    print(f"evidenciaHash : 0x{hashlib.sha256(conteudo).hexdigest()}")
    print(f"arquivo       : {arquivo}")
    print("Publique o arquivo (ex.: GitHub raw) e use a URL como evidenciaURI.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--csv", type=Path, default=CSV_PADRAO, help="caminho do twitter_training.csv")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("hash", help="SHA-256 e nº de linhas do CSV").set_defaults(f=cmd_hash)
    sub.add_parser("entidades", help="tabela entidade x sentimento").set_defaults(f=cmd_entidades)
    c = sub.add_parser("contar", help="conta linhas e gera o arquivo de evidência")
    c.add_argument("entidade")
    c.add_argument("sentimento")
    c.add_argument("--saida", type=Path, default=RAIZ / "evidencias")
    c.set_defaults(f=cmd_contar)
    args = p.parse_args()
    args.f(args)


if __name__ == "__main__":
    main()
