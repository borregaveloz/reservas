# BorregaVeloz — Reservas

Página de reservas do cliente, servida por GitHub Pages em
**https://borregaveloz.github.io/reservas/**

O cliente chega aqui a partir do WhatsApp: o bot cria uma sessão e manda o link
com um token no fragmento (`#t=…`). Sem token a página não faz nada — não há
formulário público de reservas.

## Como funciona

Não há servidor nem build step: são três ficheiros estáticos que falam
directamente com o Supabase (projeto `agendamento-tvde`) por RPC.

```
WhatsApp ──cria sessão──► booking_sessions ──token no link──► esta página
                                                                 │
                          session_bootstrap ◄────────────────────┤ o que mostrar
                          quote_booking / quote_subscription ◄───┤ preço em direto
                          submit_booking / submit_subscription ◄─┘ submissão
                                    │
                                    └──► bookings / subscriptions ──► n8n (MBWAY,
                                         motorista, avisos ao cliente)
```

**O preço nunca é calculado aqui.** Vem sempre das RPCs, e ao submeter é
recalculado do zero no servidor — incluindo a distância, que é pedida ao OSRM
de dentro do Postgres. O que o browser enviar é ignorado.

A chave Supabase em `config.js` é a publicável (`anon`) e, sozinha, não lê
nenhuma tabela: todas têm RLS sem policies para `anon`. O único caminho para
dentro é um token de sessão válido, que **dura 30 minutos** — tanto o link de
reserva como o de gestão, desde 17-08-2026 (o de reserva era de 3 h).

> **Cuidado ao mintar uma sessão à mão para testar**: quem põe os 30 minutos é
> quem cria o link (`p_ttl_minutes: 30`, no `sendBookingLink`/`sendManageLink`
> do Gate Router), não a RPC — o valor por omissão do `create_booking_session`
> ficou nos 180 minutos. Uma sessão criada sem esse parâmetro vive 3 h e não é
> a que o cliente tem.

## Só telemóvel

A página **só abre em telemóvel** (desde 01-09-2026). Num tablet ou num
computador mostra-se o ecrã `#nomobile` — "Abra no telemóvel" — e mais nada:
nem formulário, nem lista de viagens, nem sequer o `session_bootstrap`. A
verificação é a primeira linha do `boot()`, antes de qualquer RPC, por isso um
ecrã grande nunca chega a ver dados de reserva nenhuns. Vale para os dois
modos, o `#t=` e o `#m=`.

Não há maneira certa de saber o dispositivo; há sinais, e a ordem em que se
lêem é escolhida a pensar em qual dos dois erros custa mais — **deixar entrar
um tablet é chato, barrar um cliente com telemóvel é perder a reserva**. Por
isso o `deviceIsPhone()` confirma primeiro que *é* telemóvel e só depois
procura a prova de que não é:

| ordem | sinal | decide |
|---|---|---|
| 1 | UA diz `iPhone`/`iPod`/`Windows Phone`/`BlackBerry`/… | abre |
| 2 | UA diz `Android` | abre **só** com `Mobile` na UA — o tablet cala-o |
| 3 | UA diz `iPad`, ou diz `Macintosh` **e tem toque** | bloqueia (iPadOS 13+ diz-se Mac; o que o denuncia é o toque) |
| 4 | tem toque e o lado menor do ecrã ≤ 500 px | abre — é o "pedir versão para computador" num telemóvel |
| 5 | `navigator.userAgentData.mobile` | o que ele disser (só Chromium) |
| — | nada disto | bloqueia |

A regra 4 existe porque o "pedir versão para computador" troca a UA por uma de
secretária e, sem ela, o cliente ficava barrado no seu próprio telemóvel.
Nenhum portátil tem 500 px de lado menor — o mais pequeno anda nos 768 —, por
isso não abre a porta a ninguém.

**Não há escape**: nem parâmetro no URL, nem "continuar mesmo assim". Para
verificar o caminho do telemóvel a partir daqui usa-se o Chrome com
`--user-agent="…iPhone…"` (ver "Verificar a página" no CLAUDE.md do `/root/n8n`).

## Ficheiros

| | |
|---|---|
| `index.html` | estrutura do formulário |
| `styles.css` | desenho "A · Noite": topo com foto, Poppins, ícones em traço |
| `app.js` | lógica: sessão, moradas, orçamento, submissão |
| `config.js` | URLs e chaves públicas |
| `icons/` | 11 ícones monocromáticos, aplicados por CSS mask (ver abaixo) |
| `img/hero.webp` | fotografia do topo |
| `img/servicos/` | imagem opcional por serviço (ver LEIA-ME lá dentro) |

## Ícones

Dez dos onze vêm do conjunto de traço fino que o proprietário escolheu
(`2631186_7994.eps`, 225 ícones, o mesmo das páginas de admin do n8n) — aqui
são os **vetores verdadeiros do ficheiro**, não desenhos à mão: a secção
PostScript do EPS binário foi convertida a PDF, as demãos (`m`/`l`/`c`/`f`)
extraídas do fluxo de conteúdo e recortadas pela grelha 15×15.

| ficheiro | onde | desenho |
|---|---|---|
| `taxi.svg` | serviço *ocasional* (e omissão) | táxi |
| `repeat.svg` | serviço *regular* | setas em ciclo |
| `bus.svg` | serviço *escolar* | autocarro escolar |
| `person.svg` | serviço *privado* | pessoa de fato |
| `users.svg` | serviço *partilhado* | grupo de três |
| `pin.svg` | campo da recolha e lista de sugestões | pin de mapa |
| `signpost.svg` | campo do destino | poste indicador |
| `note.svg` | caixa das regras | bloco de notas |
| `school.svg` | rótulo da subscrição escolar | edifício da escola |
| `phone.svg` | ecrã "Abra no telemóvel" | telemóvel |
| `check.svg` | visto do ecrã final | ✕ **não** é do conjunto |

O `check.svg` ficou como estava **porque o conjunto não tem um visto isolado**
— o único que lá existe está preso dentro de uma pasta. É desenho da casa, e
não vale a pena forçar um recorte por causa disso.

**A escala é uniforme** (0,55 do tamanho original, em caixa de 24), não é o
ícone esticado até encher a caixa. Normalizar cada um à mesma altura mudava a
espessura do traço de ícone para ícone — a 17 px, ao lado uns dos outros nos
campos de morada, isso via-se. Assim mantém-se o equilíbrio óptico do conjunto
original e o traço fica igual em todos.

**São formas preenchidas, não traços** (`fill`, sem `stroke`): o conjunto é de
contorno desenhado. Não faz diferença nenhuma para o mask, que só olha ao
canal alfa, e escusa de se escalar a espessura do traço à parte.

## Versão no rodapé

O logótipo e a palavra BORREGAVELOZ saíram do cabeçalho a 17-08-2026. A marca
passou para o **rodapé**, com a versão e a data ao lado — que é o que permite
saber de que versão o cliente está a falar quando reporta um problema.

O rodapé mostra **`Versão 1.2.1 (build a1b2c3d) 18-08-2026`**, com três origens
diferentes de propósito.

```
./publicar.sh "mensagem"            # carimba o build e publica
./publicar.sh "mensagem" 1.3.0      # sobe também a versão
```

Não fazer `git push` à mão — é assim que o carimbo fica para trás.

- **A versão é para as pessoas** e escreve-se à mão no `config.js`. É o número
  que se diz em voz alta ("isso foi na 1.2"). Se ficar esquecida não se perde
  nada de essencial, porque o build ao lado não deixa dúvidas.
- **O build é para as máquinas** e é carimbado pelo `publicar.sh`: uma impressão
  digital do conteúdo publicado (`index.html` + `app.js` + `styles.css` + o
  `config.js` sem a própria linha do `BUILD`).
  - Não é o SHA do commit porque o SHA só existe **depois** de o commit estar
    feito, e escrevê-lo no `config.js` obriga a outro commit, com outro SHA —
    apontaria sempre para o commit anterior ao publicado.
  - **O build é também colado às referências no `index.html`** —
    `app.js?v=c27f19f`. Sem isso o GitHub Pages manda `cache-control:
    max-age=600` e quem já tinha a página aberta continuava a receber o
    JavaScript antigo: uma publicação demorava dez minutos a aparecer, ou não
    aparecia até se forçar a actualização. Aconteceu a 18-08-2026 e deu a
    entender que a publicação tinha falhado quando não tinha.
  - A linha do `BUILD` **e os `?v=` do `index.html`** ficam de fora da
    impressão: são justamente o que o script escreve, e sem os ignorar a
    impressão mudava ao ser carimbada e nunca estabilizava. **A linha da
    `VERSION` entra**: subir a versão é uma alteração ao que o cliente recebe.
    O script verifica esse ponto fixo e aborta se ele se perder.
- **A data não se toca.** Sai do `document.lastModified`, que o browser lê do
  cabeçalho `Last-Modified` que o GitHub Pages envia — ou seja, é a data em que
  a página foi mesmo publicada.
  - Quando esse cabeçalho falta, a norma manda o browser devolver *a hora
    actual*. Por isso o `stamp()` só mostra a data se ela for anterior ao
    arranque da página: mais vale rodapé sem data do que carimbar "compilado
    hoje" todos os dias. É por isso que em `python3 -m http.server`, com o
    ficheiro acabado de escrever, aparece só a versão — não é defeito.

## Moradas

Com `GOOGLE_KEY` preenchida usa a **Places API (New)** da Google. Sem chave cai
automaticamente para o **Photon** (OpenStreetMap), que não precisa de chave mas
tem menos qualidade em Portugal.

> ⚠️ Só pôr uma chave Google aqui depois de ela estar restrita por domínio
> (*Application restrictions → Websites* → `https://borregaveloz.github.io/*`)
> **e** limitada à Places API (New) em *API restrictions*. Este repositório é
> público e há bots que o varrem à procura de chaves Google.
>
> O domínio vai **sem caminho**: os browsers cortam o path do `Referer`
> (`strict-origin-when-cross-origin`), por isso `…github.io/reservas/*` bloqueia
> a própria página.
>
> Para confirmar que a restrição está activa:
>
> ```bash
> curl -s -X POST https://places.googleapis.com/v1/places:autocomplete \
>   -H "Content-Type: application/json" -H "X-Goog-Api-Key: <CHAVE>" \
>   -H "Referer: https://sitio-qualquer.example/" \
>   -d '{"input":"Santarem","includedRegionCodes":["pt"]}'
> ```
>
> Tem de responder **HTTP 403** com `"status": "PERMISSION_DENIED"` e
> `"reason": "API_KEY_HTTP_REFERRER_BLOCKED"`. (`REQUEST_DENIED` é da Places
> antiga — procurar essa string dá sempre "não funcionou", mesmo quando
> funcionou.) Repetir sem cabeçalho `Referer` nenhum: também tem de dar 403.
> Depois de gravar na consola, esperar ~5 min antes de testar.

> 🔌 **Esta chave não serve para o servidor.** A Geocoding API recusa qualquer
> chave com restrição por referrer (`"API keys with referer restrictions cannot
> be used with this API"`), portanto o n8n tem de usar uma chave própria,
> restrita por IP. Não juntar as duas — restringir a chave do n8n por domínio
> parte o wizard do chat em silêncio (o `geocodeAddr` engole o erro e devolve
> reservas sem coordenadas).

## Serviços

A página desenha-se a partir da tabela `service_types` — um serviço aparece
quando tem `is_active = true`, com as tarifas e horários que lá estiverem.
Não há nada codificado à mão sobre preços.

| Serviço | Fluxo na página |
|---|---|
| Transporte Ocasional | origem, destino, data/hora, espera se ida-e-volta |
| Regular Porta-a-porta | origem, destino, dias, horas, início → subscrição semanal |
| Transporte Escolar | escola, recolha, crianças, dias, entrada/saída → pedido sem preço |
| Motorista Privado | origem, data/hora, duração (preço à hora, sem destino) |

O **escolar** é o único sem preço automático: fica em `pending_quote` e a
proposta é enviada à mão pelo admin, por WhatsApp, como sempre foi.
