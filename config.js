// Configuração pública da página de reservas.
//
// Nada aqui é segredo: a chave Supabase é a "publishable" (anon), que não lê
// nenhuma tabela — todo o acesso passa pelas RPCs, e essas exigem o token que
// o WhatsApp põe no link. A chave Google é de browser e tem de estar restrita
// ao domínio desta página (Application restrictions -> Websites).
window.CFG = {
  SUPABASE_URL: 'https://trtkqjgzmtzgplkaerar.supabase.co',
  SUPABASE_KEY: 'sb_publishable_LBQm2m3BYnAhM19snQUZFQ_Swg4-OMI',
  // POR PREENCHER. A chave que existe hoje aceita pedidos de qualquer domínio
  // (testado: passa até sem cabeçalho Referer), e este repositório é público.
  // Só a meter aqui depois de Application restrictions -> Websites estar mesmo
  // a recusar outras origens.
  GOOGLE_KEY:   '',
  WHATSAPP:     '351961036101',
  LOGO:         'https://borregaveloz.github.io/termos/img/logo_w.jpg',
  TERMOS:       'https://borregaveloz.github.io/termos/'
};
