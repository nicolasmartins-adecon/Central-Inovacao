/* =============================================================================
   CONFIGURAÇÃO
   -----------------------------------------------------------------------------
   Deixe em branco para rodar em MODO LOCAL (dados de exemplo no navegador).
   Preencha para conectar ao Supabase — ou use o botão "Conexão" dentro do app,
   que grava as chaves neste navegador sem precisar de novo deploy.

   No deploy pelo GitHub Actions este arquivo é reescrito automaticamente com
   os secrets SUPABASE_URL e SUPABASE_ANON_KEY do repositório.
   A chave "anon" é pública por natureza: quem protege os dados é o RLS.
   ========================================================================== */

window.CI_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  /* Base das Edge Functions. Em branco = <SUPABASE_URL>/functions/v1 */
  URL_FUNCOES: "",

  /* Chama a função de envio logo após comentar / atribuir etapa,
     em vez de esperar o cron de 2 minutos. */
  DISPARAR_EMAIL_NA_HORA: true,

  EMPRESA: "Adecon",
  ANO_CICLO: 2027
};
