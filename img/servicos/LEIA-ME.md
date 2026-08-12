# Fotografias por serviço

Cada serviço pode ter imagem própria no menu de serviços, em vez do ícone em
traço. O nome do ficheiro é a **chave do serviço** em `service_types`:

| Ficheiro | Serviço |
|---|---|
| `ocasional.jpg` | Transporte Ocasional |
| `regular.jpg` | Regular Porta-a-porta |
| `escolar.jpg` | Transporte Escolar |
| `privado.jpg` | Motorista Privado |
| `partilhado.jpg` | Transportes Partilhados |

**Formato:** JPG ou WEBP, **quadrado**, 300×300 chega (o mosaico tem 48 px e
sobe a 144 px em ecrãs 3×). A imagem é recortada com `cover` e centrada, por
isso o motivo deve estar ao centro — o que ficar nos cantos pode desaparecer.

Pôr o ficheiro aqui **não basta**: é preciso ativar a regra em `styles.css`,
na secção "Fotografia por serviço". São duas linhas por serviço, e sem elas
continua a aparecer o ícone. Isto é de propósito — o CSS não sabe se um
ficheiro existe, e uma imagem em falta deixaria o mosaico vazio.
