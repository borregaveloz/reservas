# Fotografias por serviço

Ao escolher um serviço, o **topo da página troca** para a fotografia desse
serviço, em fade.

**Basta largar o ficheiro nesta pasta.** A página tenta carregá-lo ao arrancar e
só usa os que existirem — não é preciso mexer no CSS nem no JavaScript. Um
serviço sem imagem mantém a fotografia base (a estrada de montanha).

O nome é a **chave do serviço** em `service_types`, sempre em `.webp`:

| Ficheiro | Serviço |
|---|---|
| `ocasional.webp` | Transporte Ocasional |
| `regular.webp` | Regular Porta-a-porta |
| `escolar.webp` | Transporte Escolar |
| `privado.webp` | Motorista Privado |
| `partilhado.webp` | Transportes Partilhados |

**Formato:** WebP, ~1100 px de largura, qualidade 72 (`cwebp -q 72 -m 6`). Manda
o original em JPG/PNG que a conversão faz-se aqui — 1100 px chega para ecrãs 3×
e mantém o ficheiro nos ~60 KB, que numa página aberta em dados móveis conta.

**O motivo deve estar na metade superior.** O topo mostra só uma faixa (~42% da
altura, centrada a 55%) e por baixo passa um gradiente escuro para o texto se
ler. Uma fotografia com o assunto em baixo perde-se.

As quatro em uso desde 15-08-2026, recortadas do original em retrato para uma
faixa panorâmica centrada no essencial (o topo mostra a imagem quase toda, em
vez de uma fatia ao calhas). Recortes usados, para se poderem repetir:

| Serviço | Recorte do original |
|---|---|
| ocasional | `1200x850+0+300` |
| regular | `1333x900+0+550` |
| escolar | `1331x950+0+380` (foto nova, 17-08-2026) |
| privado | `842x680+0+90` |

No privado o primeiro recorte não servia: o portátil dominava com o motorista
minúsculo. Vale a pena simular o gradiente antes de publicar.

**O escolar foi trocado a 17-08-2026.** A imagem anterior era um grande plano da
cara de uma menina — ficava fechada de mais, e depois de a faixa passar a mostrar
a fotografia inteira no telemóvel isso notava-se ainda mais. A nova (menino no
banco de trás, com cinto e telemóvel) conta melhor o serviço: vê-se a criança
*dentro do carro*, que é o que se está a contratar.

> **Manter a proporção perto de 1,4:1.** É a das outras três, e é o que faz o
> `contain` do telemóvel encher a faixa sem sobras e o `cover` acima dos 560 px
> cortar pouco. Um recorte mais quadrado mostra mais cena no telemóvel mas corta
> muito mais em ecrã largo — foi testado (1,16:1) e não compensa.

**Como comparar recortes sem publicar:** há `google-chrome-stable` na máquina.
Faz-se um HTML solto que replica as regras do `.hero::after` (gradiente incluído)
com uma faixa de 390x340 e outra de 560x414, aponta-se `--pic` a cada candidato e
tira-se `--headless --screenshot`. É muito mais fiável do que carregar a página
inteira, onde o clique no serviço corre contra o carregamento da imagem.
