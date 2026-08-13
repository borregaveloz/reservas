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
  LOGO:         'https://borregaveloz.github.io/termos/img/logo_w.jpg',
  TERMOS:       'https://borregaveloz.github.io/termos/'
};
