/* ============================================================
   CONFIGURAÇÃO — edite aqui. Nada mais precisa ser mexido.
   Valores previdenciários de 2026 (Portaria Interministerial
   MPS/MF nº 13/2026 e Decreto nº 12.797/2025). Atualize todo
   mês de janeiro.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CONFIG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    // ---------- Marca ----------
    marca: {
      nome: 'Breno Proenço',
      subtitulo: 'Advocacia Previdenciária',
      instagram: 'brenoproencoadv',
      oab: 'OAB/TO 14.612',
      cidade: 'Palmas · Tocantins · Atendimento online em todo o Brasil',
      cor: '#FF5A1F'
    },

    // ---------- Contato ----------
    // TROQUE pelo seu WhatsApp, só números, com 55 + DDD. Ex.: 5563999999999
    // Endereço do site (ex.: https://www.seudominio.com.br). Preencha para gerar sitemap.xml e links canônicos.
    dominio: '',
    whatsapp: '5563991106266',
    mensagemWhatsapp: 'Olá, Dr. Breno! Fiz um cálculo no seu site e gostaria de uma análise do meu caso.',

    // ---------- Valores do ano ----------
    ano: 2026,
    salarioMinimo: 1621.00,
    teto: 8475.55,
    // BPC: limite = 1/4 do salário mínimo (regra geral) e 1/2 (Lei 14.176/2021)
    // calculados automaticamente a partir do salário mínimo.

    // ---------- Reforma ----------
    dataReforma: '2019-11-13',

    // Duração da pensão por morte do cônjuge (idade na data do óbito).
    // Faixas conforme Lei 8.213/91, art. 77, §2º-B, com idades atualizadas
    // por portaria. CONFIRA se houve nova portaria antes de publicar.
    pensaoFaixas: [
      { ate: 21, anos: 3 },
      { ate: 27, anos: 6 },
      { ate: 30, anos: 10 },
      { ate: 41, anos: 15 },
      { ate: 44, anos: 20 }
    ], // acima disso: vitalícia

    // ---------- Banco de dados (Supabase) ----------
    // URL da função "registrar" (grava visitas, cálculos e leads). Vazio = não grava nada.
    // Ex.: https://SEU-PROJETO.supabase.co/functions/v1/registrar
    registrarUrl: 'https://uoeyjetglhsttflydmop.supabase.co/functions/v1/registrar',
    // Usados só pelo painel de estatísticas (/admin/estatisticas.html).
    // A chave "anon/publishable" é pública por natureza; a proteção vem das regras (RLS) do banco.
    supabaseUrl: 'https://uoeyjetglhsttflydmop.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZXlqZXRnbGhzdHRmbHlkbW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NjM3MTcsImV4cCI6MjEwNzMzOTcxN30.DAh-NFPv_B4hw3xcgja0JD7HrICwJ3oEYRLe6unYUQ0'
  };
});
