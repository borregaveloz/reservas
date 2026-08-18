#!/usr/bin/env bash
#
# Publica a página: carimba o build, faz commit e envia para o GitHub Pages.
#
#   ./publicar.sh "mensagem do commit"           # mantém a versão
#   ./publicar.sh "mensagem do commit" 1.3.0     # sobe também a versão
#
# O rodapé mostra "Versão 1.2.3 (build a1b2c3d) 18-08-2026", com três origens:
#
#   versão  escrita à mão no config.js, para as pessoas
#   build   carimbado aqui, impressão digital do conteúdo, para as máquinas
#   data    do Last-Modified que o GitHub Pages envia
#
# Porque o build não é o SHA do commit: o SHA só existe depois de o commit
# estar feito, e escrevê-lo no config.js obriga a outro commit, com outro SHA.
# Ficaria sempre a apontar para o commit anterior ao que está publicado.
#
# O build é também colado às referências dos ficheiros no index.html
# (`app.js?v=…`). Sem isso, o GitHub Pages manda `cache-control: max-age=600` e
# quem já tinha aberto a página continuava a receber o JavaScript antigo — uma
# publicação podia demorar dez minutos a aparecer, ou não aparecer de todo até
# a pessoa forçar a actualização. Aconteceu a 18-08-2026 e deu a entender que a
# publicação tinha falhado quando não tinha.
#
# A impressão ignora tanto a linha do BUILD como os `?v=` do index.html: são
# justamente o que este script escreve, e sem os ignorar a impressão mudava ao
# ser carimbada e nunca estabilizava. A linha da VERSION entra, porque subir a
# versão é uma alteração ao que o cliente recebe.
set -euo pipefail
cd "$(dirname "$0")"

impressao() {
  { sed -E 's/\?v=[a-z0-9]*//g' index.html
    cat app.js styles.css
    grep -v "BUILD:" config.js
  } | sha256sum | cut -c1-7
}

if [ -n "${2:-}" ]; then
  sed -i -E "s/(VERSION: *')[^']*(')/\1${2}\2/" config.js
  echo "versão: ${2}"
fi

B=$(impressao)
sed -i -E "s/(BUILD: *')[^']*(')/\1${B}\2/" config.js
sed -i -E "s#(src=\"(config|app)\.js)(\?v=[a-z0-9]*)?\"#\1?v=${B}\"#g" index.html
sed -i -E "s#(href=\"styles\.css)(\?v=[a-z0-9]*)?\"#\1?v=${B}\"#g" index.html

[ "$(impressao)" = "$B" ] || { echo "ERRO: a impressão digital não estabilizou"; exit 1; }

V=$(grep -o "VERSION: *'[^']*'" config.js | grep -o "'[^']*'" | tr -d "'")
echo "a publicar: Versão ${V} (build ${B})"
grep -oE '(src|href)="(config|app)\.js\?v=[a-z0-9]*"|href="styles\.css\?v=[a-z0-9]*"' index.html | sed 's/^/  /'

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
  R=$(curl -s "https://borregaveloz.github.io/reservas/config.js?cb=$RANDOM" | grep -o "BUILD: *'[^']*'" || true)
  case "$R" in *"${B}"*) echo "publicado: Versão ${V} (build ${B})"; exit 0;; esac
  sleep 15
done
echo "ainda não publicado ao fim de 7 min — ver o estado do build:"
echo "  GET /repos/borregaveloz/reservas/pages/builds/latest"
exit 1
