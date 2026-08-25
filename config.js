// Configuração pública da página de reservas.
//
// Nada aqui é segredo: a chave Supabase é a "publishable" (anon), que não lê
// nenhuma tabela — todo o acesso passa pelas RPCs, e essas exigem o token que
// o WhatsApp põe no link. A chave Google é de browser e tem de estar restrita
// ao domínio desta página (Application restrictions -> Websites).
window.CFG = {
  SUPABASE_URL: 'https://trtkqjgzmtzgplkaerar.supabase.co',
  SUPABASE_KEY: 'sb_publishable_LBQm2m3BYnAhM19snQUZFQ_Swg4-OMI',
  // Restrita a https://borregaveloz.github.io/* (Websites) e à Places API (New).
  // Verificado a 13-08-2026: pedidos de outro domínio, sem Referer, ou a outra
  // API da Google respondem 403. É chave de browser e só serve para esta página
  // — não a reutilizar em chamadas de servidor, que a Google recusa qualquer
  // chave com restrição por referrer (ver README).
  GOOGLE_KEY:   'AIzaSyDw8PDYOYpKVunKhpTctcAFEAOXL0eulPs',
  WHATSAPP:     '351961036101',
  TERMOS:       'https://borregaveloz.github.io/termos/',

  // Rodapé: "Versão 1.2.1 (build a1b2c3d) 18-08-2026".
  //
  // A VERSÃO é para as pessoas e escreve-se à mão — é o que permite dizer "isso
  // foi na 1.2". Subir ao publicar algo que o cliente veja; se ficar esquecida,
  // não se perde nada de essencial, porque o build ao lado não deixa dúvidas.
  VERSION:      '1.2.4',

  // O BUILD é para as máquinas e NÃO SE EDITA — é o publicar.sh que o escreve.
  // Impressão digital do que o cliente recebe (index.html + app.js + styles.css
  // + este ficheiro sem esta linha). Muda quando o conteúdo muda e não muda
  // quando não muda. A data sai do `Last-Modified` do GitHub Pages.
  BUILD:        'f48ffc8'
};
// O logótipo saiu do cabeçalho a 17-08-2026 e com ele a chave LOGO. A saudação
// do WhatsApp continua a mandar a imagem — mas isso é do n8n, não desta página.
