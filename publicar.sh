#!/usr/bin/env bash
#
# Publica a página: carimba a versão, faz commit e envia para o GitHub Pages.
#
#   ./publicar.sh "mensagem do commit"
#
# A versão deixou de se escrever à mão (18-08-2026). Era suposto subir-se a
# cada alteração visível e à segunda vez já tinha ficado para trás — um rodapé
# que mente na versão é pior do que não ter rodapé.
#
# Porque não é o SHA do commit: o SHA só existe depois de o commit estar feito,
# e escrevê-lo no config.js obriga a outro commit, que tem outro SHA. Ficaria
# sempre a apontar para o commit anterior ao que está publicado.
#
# É antes uma impressão digital do conteúdo que o cliente recebe. O config.js
# entra sem a própria linha da VERSION, senão carimbá-la mudava a impressão que
# se estava a calcular — e nunca estabilizava.
set -euo pipefail
cd "$(dirname "$0")"

impressao() {
  { cat index.html app.js styles.css
    grep -v "VERSION:" config.js
  } | sha256sum | cut -c1-7
}

V=$(impressao)
sed -i -E "s/(VERSION: *')[^']*(')/\1${V}\2/" config.js

# Se o carimbo mudou a impressão, alguma coisa está errada no que se exclui.
[ "$(impressao)" = "$V" ] || { echo "ERRO: a impressão digital não estabilizou"; exit 1; }

echo "versão: ${V}"

if git diff --quiet && git diff --cached --quiet; then
  echo "nada para publicar."
  exit 0
fi

git add -A
git commit -q -m "${1:-publicação}"

TOKEN=$(grep -m1 '^GH_PAGES_TOKEN=' /root/n8n/.env | cut -d= -f2- | tr -d '"<>')
git -c credential.helper= -c "http.https://github.com/.extraheader=" \
    push "https://x-access-token:${TOKEN}@github.com/borregaveloz/reservas.git" HEAD:main 2>&1 \
  | sed "s/${TOKEN}/***/g"

echo "à espera do GitHub Pages…"
for _ in $(seq 1 30); do
  R=$(curl -s "https://borregaveloz.github.io/reservas/config.js?cb=$RANDOM" | grep -o "VERSION: *'[^']*'" || true)
  case "$R" in *"${V}"*) echo "publicado: ${R}"; exit 0;; esac
  sleep 15
done
echo "ainda não publicado ao fim de 7 min — ver o estado do build:"
echo "  GET /repos/borregaveloz/reservas/pages/builds/latest"
exit 1
