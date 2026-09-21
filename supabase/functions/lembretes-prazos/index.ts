// =============================================================================
// Edge Function: lembretes-prazos
//
// Varre as etapas em aberto e enfileira lembretes:
//   - vence em 3 dias  -> prazo_proximo
//   - vence hoje       -> prazo_proximo (dias = 0)
//   - já venceu        -> prazo_vencido
//
// O índice único uq_notificacoes_prazo_dia impede repetir o mesmo aviso
// para a mesma etapa no mesmo dia, então rodar mais de uma vez é inofensivo.
//
// Agende via pg_cron (seção 7 do schema.sql) para 08h de Brasília em dias úteis.
// =============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS } from "../_shared/email.ts";

const AVISAR_COM_ANTECEDENCIA = [3, 0]; // dias antes da entrega

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const hoje = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const maisDias = (n: number) => {
    const d = new Date(hoje);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
  };

  const alvos = AVISAR_COM_ANTECEDENCIA.map(maisDias);

  const { data: etapas, error } = await supabase
    .from("etapas")
    .select("id, numero, descricao, responsavel, responsavel_email, data_entrega, projeto_id, projetos(nome)")
    .eq("concluida", false)
    .not("responsavel_email", "is", null)
    .not("data_entrega", "is", null)
    .lte("data_entrega", alvos[0]);

  if (error) return json({ erro: error.message }, 500);

  const novas: Array<Record<string, unknown>> = [];

  for (const e of etapas ?? []) {
    const entrega = String(e.data_entrega);
    const projeto = (e as { projetos?: { nome?: string } }).projetos?.nome ?? "Projeto";
    const diasRestantes = Math.round(
      (Date.parse(entrega + "T00:00:00Z") - Date.parse(iso(hoje) + "T00:00:00Z")) / 86400000,
    );

    let tipo: string | null = null;
    if (diasRestantes < 0) tipo = "prazo_vencido";
    else if (AVISAR_COM_ANTECEDENCIA.includes(diasRestantes)) tipo = "prazo_proximo";
    if (!tipo) continue;

    novas.push({
      tipo,
      para_email: e.responsavel_email,
      assunto: tipo === "prazo_vencido"
        ? `Etapa ${e.numero} está atrasada — ${projeto}`
        : diasRestantes === 0
          ? `Etapa ${e.numero} vence hoje — ${projeto}`
          : `Etapa ${e.numero} vence em ${diasRestantes} dias — ${projeto}`,
      dados: {
        etapa_id: e.id,
        projeto_id: e.projeto_id,
        projeto,
        numero: e.numero,
        descricao: e.descricao,
        responsavel: e.responsavel,
        data_entrega: entrega,
        dias: Math.max(diasRestantes, 0),
      },
    });
  }

  if (!novas.length) return json({ enfileiradas: 0, mensagem: "Nenhum prazo a avisar hoje." });

  // ignoreDuplicates respeita o índice único de "um aviso por etapa por dia"
  const { error: erroInsert, count } = await supabase
    .from("notificacoes")
    .upsert(novas, { ignoreDuplicates: true, count: "exact" });

  if (erroInsert) return json({ erro: erroInsert.message }, 500);

  // dispara o envio na sequência, sem esperar o próximo ciclo do cron
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enviar-notificacoes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch { /* o cron pega no próximo ciclo */ }

  return json({ enfileiradas: count ?? novas.length });
});

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
