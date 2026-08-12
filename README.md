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
dentro é um token de sessão válido, que dura 3 horas.

## Ficheiros

| | |
|---|---|
| `index.html` | estrutura do formulário |
| `styles.css` | desenho "A · Noite": topo com foto, Poppins, ícones em traço |
| `app.js` | lógica: sessão, moradas, orçamento, submissão |
| `config.js` | URLs e chaves públicas |
| `icons/` | 15 ícones monocromáticos em traço, aplicados por CSS mask |
| `img/hero.jpg` | fotografia do topo |
| `img/servicos/` | imagem opcional por serviço (ver LEIA-ME lá dentro) |

## Moradas

Com `GOOGLE_KEY` preenchida usa a **Places API (New)** da Google. Sem chave cai
automaticamente para o **Photon** (OpenStreetMap), que não precisa de chave mas
tem menos qualidade em Portugal.

> ⚠️ Só pôr a chave Google aqui depois de ela estar restrita por domínio
> (*Application restrictions → Websites* → `https://borregaveloz.github.io/*`).
> Este repositório é público e há bots que o varrem à procura de chaves Google.
> Para confirmar que a restrição está mesmo activa:
>
> ```bash
> curl -s -X POST https://places.googleapis.com/v1/places:autocomplete \
>   -H "Content-Type: application/json" -H "X-Goog-Api-Key: <CHAVE>" \
>   -H "Referer: https://sitio-qualquer.example/" \
>   -d '{"input":"Santarem","includedRegionCodes":["pt"]}'
> ```
>
> Tem de responder `REQUEST_DENIED`. Se devolver sugestões, a chave está aberta.

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
