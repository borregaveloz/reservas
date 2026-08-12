# Fotografias por serviço

Ao escolher um serviço, o **topo da página troca** para a fotografia desse
serviço, em fade. O nome do ficheiro é a **chave do serviço** em `service_types`:

| Ficheiro | Serviço |
|---|---|
| `ocasional.jpg` | Transporte Ocasional |
| `regular.jpg` | Regular Porta-a-porta |
| `escolar.jpg` | Transporte Escolar |
| `privado.jpg` | Motorista Privado |
| `partilhado.jpg` | Transportes Partilhados |

**Formato:** JPG ou WEBP, **panorâmica** ou retrato — o topo usa `cover`, por
isso qualquer proporção serve. Recomendado ~1600 px no lado maior. O motivo
deve estar na **metade superior**: o topo só mostra uma faixa da imagem, e por
baixo passa um gradiente escuro para o texto se ler.

Pôr o ficheiro aqui **não basta**: é preciso acrescentar duas linhas em
`styles.css`, na secção "fotografia por serviço":

```css
.hero[data-svc="escolar"]{--svc-pic:url(img/servicos/escolar.jpg)}
.hero[data-svc="escolar"]::after{opacity:1}
```

É de propósito. O CSS não sabe se um ficheiro existe, e uma imagem em falta
deixaria o topo em branco a meio da reserva — pior do que manter a foto base.

> `ocasional.jpg` é provisória: é a primeira fotografia que o proprietário
> enviou (mão fora da janela), posta aqui para demonstrar a troca a funcionar.
> Substituir quando houver a definitiva.
