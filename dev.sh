#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ ! -d node_modules ]]; then
  echo "Instalando dependências..."
  npm install
fi

DATA_DIR="web/public/data"
if [[ ! -f "$DATA_DIR/cursos.json" ]]; then
  echo "Erro: $DATA_DIR/cursos.json não encontrado."
  echo "Gere os dados com: npm run scrape"
  exit 1
fi

TURMAS=$(find "$DATA_DIR/turmas" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l)
if [[ "$TURMAS" -lt 1 ]]; then
  echo "Erro: nenhum arquivo em $DATA_DIR/turmas/"
  echo "Gere os dados com: npm run scrape"
  exit 1
fi

echo "Dados OK ($TURMAS turmas). Abrindo http://localhost:5173 no navegador..."
exec npm run dev -w web -- --open --host
