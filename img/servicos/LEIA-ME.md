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

> `ocasional.webp` é provisória: é a primeira fotografia enviada pelo
> proprietário (mão fora da janela), posta para demonstrar a troca. Substituir.
