/* =============================================================================
   TELAS
   Cada função devolve um nó de DOM. O roteador (app.js) troca o conteúdo.
   ========================================================================== */

window.CI = window.CI || {};

CI.views = (function () {
  const U = CI.ui;
  const { h, ic, svgEl, chip, anel, campo, entrada, area, selecao } = U;
  const db = CI.db;

  const TOM_PRIO = { Alta: "var(--crit)", "Média": "var(--warn)", Baixa: "var(--d-agua)" };
  const TOM_STATUS = {
    "Planejado": "var(--muted)", "Em andamento": "var(--accent)",
    "Em risco": "var(--crit)", "Concluído": "var(--ok)", "Pausado": "var(--faint)"
  };
  const TIPOS = ["Projeto Interno", "Iniciativa", "Ponto de Atenção", "Processo", "Ferramenta"];
  const PRIORIDADES = ["Alta", "Média", "Baixa"];
  const STATUS = ["Planejado", "Em andamento", "Em risco", "Concluído", "Pausado"];
  const COLUNAS_QUADRO = ["Iniciativas", "Projetos Internos", "Pontos de Atenção", "Processos", "Ferramentas"];

  /* ---- cálculos compartilhados ------------------------------------------ */

  function estat(projetoId) {
    const etapas = db.etapasDe(projetoId);
    const feitas = etapas.filter(e => e.concluida).length;
    const atrasadas = etapas.filter(e => !e.concluida && e.data_entrega && U.diasAte(e.data_entrega) < 0).length;
    const pendentes = etapas.filter(e => !e.concluida && e.data_entrega);
    pendentes.sort((a, b) => String(a.data_entrega).localeCompare(String(b.data_entrega)));
    return {
      total: etapas.length, feitas, atrasadas,
      pct: etapas.length ? Math.round((feitas / etapas.length) * 100) : 0,
      proxima: pendentes[0] || null
    };
  }

  // A cor guardada é a cor de marca; corVisivel() só ajusta a luminosidade
  // para o tema em uso, de modo que o preto da Presidência não suma no escuro.
  function corBrutaDiretoria(id) {
    return db.diretoria(id)?.cor || "#7B8B9F";
  }

  function corDiretoria(id) {
    return U.corVisivel(corBrutaDiretoria(id));
  }

  function corProjeto(p) {
    return U.corVisivel(p && p.cor ? p.cor : corBrutaDiretoria(p && p.diretoria_id));
  }

  function nomeDiretoria(id) {
    return db.diretoria(id)?.nome || "Sem diretoria";
  }

  function chipPrazo(etapa) {
    if (etapa.concluida) return chip("Concluída", "ok");
    if (!etapa.data_entrega) return chip("Sem data");
    const d = U.diasAte(etapa.data_entrega);
    if (d < 0) return chip(`${Math.abs(d)} d de atraso`, "crit");
    if (d === 0) return chip("Vence hoje", "warn");
    if (d <= 7) return chip(`Em ${d} d`, "warn");
    return chip(U.dataBR(etapa.data_entrega));
  }

  function etapaAtrasada(e) {
    return !e.concluida && e.data_entrega && U.diasAte(e.data_entrega) < 0;
  }

  /* ---- gráfico de barras horizontais ------------------------------------ */

  function barras(dados, opcoes = {}) {
    if (!dados.length) return U.vazio("pulso", "Sem dados ainda", "Cadastre projetos para ver a distribuição.");
    const max = Math.max(1, ...dados.map(d => d.valor));
    return h("div", { estilo: { display: "flex", flexDirection: "column", gap: "10px" } },
      ...dados.map(d => h("div", { estilo: { display: "grid", gridTemplateColumns: "minmax(88px,150px) 1fr auto", gap: "10px", alignItems: "center" } },
        h("span.truncar", { estilo: { fontSize: "12.5px", color: "var(--txt-2)" }, title: d.rotulo }, d.rotulo),
        h("div", { estilo: { height: "8px", borderRadius: "99px", background: "var(--raise-2)", overflow: "hidden" } },
          h("i", {
            estilo: {
              display: "block", height: "100%", borderRadius: "99px",
              background: d.tom || "var(--accent)",
              width: Math.round((d.valor / max) * 100) + "%",
              transition: "width .7s cubic-bezier(.22,1,.36,1)"
            }
          })
        ),
        h("span.dado", { estilo: { fontSize: "12px", color: "var(--txt)", minWidth: "22px", textAlign: "right" } },
          opcoes.sufixo ? d.valor + opcoes.sufixo : d.valor)
      ))
    );
  }

  /* =========================================================================
     PAINEL
     ====================================================================== */

  function vPainel() {
    const projetos = db.dados.projetos;
    const internos = projetos.filter(p => p.tipo === "Projeto Interno");
    const etapas = db.dados.etapas;
    const feitas = etapas.filter(e => e.concluida).length;
    const atrasadas = etapas.filter(etapaAtrasada);
    const impl = db.dados.implementacoes;
    const implementados = impl.filter(i => i.status === "Implementado").length;
    const tip = impl.length ? Math.round((implementados / impl.length) * 100) : 0;
    const concluidos = internos.filter(p => p.status === "Concluído").length;

    const kpis = h("div.grade.g-kpi.surge",
      kpi({
        nome: "Projetos internos", desc: `${concluidos} com objetivo atingido`,
        valor: internos.length, pct: internos.length ? (concluidos / internos.length) * 100 : 0,
        tom: "var(--accent)"
      }),
      kpi({
        nome: "Etapas concluídas", desc: `${feitas} de ${etapas.length} etapas cadastradas`,
        valor: etapas.length ? Math.round((feitas / etapas.length) * 100) : 0, sufixo: "%",
        pct: etapas.length ? (feitas / etapas.length) * 100 : 0, tom: "var(--ok)"
      }),
      kpi({
        nome: "Entregas fora do prazo", desc: atrasadas.length ? "Precisam de repactuação" : "Nenhuma pendência vencida",
        valor: atrasadas.length,
        pct: etapas.length ? (atrasadas.length / etapas.length) * 100 : 0,
        tom: atrasadas.length ? "var(--crit)" : "var(--ok)"
      }),
      kpi({
        nome: "TIP", desc: `${implementados} de ${impl.length} processos e ferramentas`,
        valor: tip, sufixo: "%", pct: tip, tom: "var(--d-agua)"
      })
    );

    /* carteira */
    const ordenados = internos.slice().sort((a, b) => {
      const pa = PRIORIDADES.indexOf(a.prioridade), pb = PRIORIDADES.indexOf(b.prioridade);
      if (pa !== pb) return pa - pb;
      return String(a.inicio || "9").localeCompare(String(b.inicio || "9"));
    });

    const carteira = h("section.painel",
      h("div.painel-hd",
        h("h2", "Carteira de projetos internos"),
        h("div.acoes",
          h("button.btn.btn-p", { type: "button", onclick: () => (location.hash = "#/projetos") }, "Ver todos", ic("setaDir"))
        )
      ),
      h("div.painel-bd",
        ordenados.length
          ? h("div", { estilo: { display: "flex", flexDirection: "column", gap: "3px" } },
              ...ordenados.slice(0, 8).map(p => {
                const s = estat(p.id);
                return h("button", {
                  type: "button",
                  estilo: {
                    display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(46px,110px) 54px", gap: "12px",
                    alignItems: "center", padding: "10px 8px", background: "none", border: 0,
                    borderRadius: "8px", cursor: "pointer", textAlign: "left", width: "100%"
                  },
                  onmouseenter: e => (e.currentTarget.style.background = "var(--panel-2)"),
                  onmouseleave: e => (e.currentTarget.style.background = "none"),
                  onclick: () => (location.hash = "#/projeto/" + p.id)
                },
                  h("div", { estilo: { minWidth: 0 } },
                    h("div", { estilo: { display: "flex", alignItems: "center", gap: "8px" } },
                      h("i", { estilo: { width: "3px", height: "14px", borderRadius: "3px", background: TOM_PRIO[p.prioridade], flex: "none" } }),
                      h("span.truncar", { estilo: { fontSize: "13.5px", fontWeight: 500 } }, p.nome)
                    ),
                    h("div", { estilo: { font: "400 11px/1.4 var(--f-dado)", color: "var(--muted)", marginTop: "3px", paddingLeft: "11px" } },
                      nomeDiretoria(p.diretoria_id) + (s.total ? ` · ${s.feitas}/${s.total} etapas` : " · sem etapas"))
                  ),
                  h("div.progresso", h("i", { estilo: { width: s.pct + "%", "--tom": corDiretoria(p.diretoria_id) } })),
                  h("span.dado", { estilo: { fontSize: "12px", textAlign: "right", color: s.atrasadas ? "var(--crit)" : "var(--txt-2)" } },
                    s.atrasadas ? `${s.atrasadas} atras.` : s.pct + "%")
                );
              })
            )
          : U.vazio("camadas", "Nenhum projeto ainda", "Crie o primeiro projeto interno para começar a acompanhar as etapas.",
              h("button.btn.btn-primario", { type: "button", onclick: () => modalProjeto() }, ic("mais"), "Novo projeto"))
      )
    );

    /* próximas entregas */
    const proximas = db.dados.etapas
      .filter(e => !e.concluida && e.data_entrega)
      .sort((a, b) => String(a.data_entrega).localeCompare(String(b.data_entrega)))
      .slice(0, 7);

    const entregas = h("section.painel",
      h("div.painel-hd", h("h2", "Próximas entregas"),
        h("div.acoes", chip(`${atrasadas.length} fora do prazo`, atrasadas.length ? "crit" : "ok"))),
      h("div.painel-bd.sem-pad",
        proximas.length
          ? h("div", ...proximas.map(e => {
              const p = db.projeto(e.projeto_id);
              return h("button", {
                type: "button",
                estilo: {
                  display: "flex", gap: "10px", alignItems: "center", width: "100%",
                  padding: "11px 16px", background: "none", border: 0,
                  borderBottom: "1px solid var(--line-soft)", cursor: "pointer", textAlign: "left"
                },
                onmouseenter: ev => (ev.currentTarget.style.background = "var(--panel-2)"),
                onmouseleave: ev => (ev.currentTarget.style.background = "none"),
                onclick: () => { location.hash = "#/projeto/" + e.projeto_id; setTimeout(() => gavetaEtapa(e.id), 90); }
              },
                h("div", { estilo: { minWidth: 0, flex: "1 1 auto" } },
                  h("div.truncar", { estilo: { fontSize: "13px" } }, e.descricao || "Etapa sem descrição"),
                  h("div", { estilo: { font: "400 11px/1.4 var(--f-dado)", color: "var(--muted)", marginTop: "2px" } },
                    `${p?.nome || "—"} · etapa ${e.numero}`)
                ),
                chipPrazo(e)
              );
            }))
          : U.vazio("check", "Nada no radar", "Nenhuma etapa em aberto com data definida.")
      )
    );

    /* distribuição por diretoria */
    const porDiretoria = db.dados.diretorias
      .map(d => ({
        rotulo: d.nome,
        valor: projetos.filter(p => p.diretoria_id === d.id).length,
        tom: U.corVisivel(d.cor)
      }))
      .filter(d => d.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    const distribuicao = h("section.painel",
      h("div.painel-hd", h("h2", "Carga por diretoria"),
        h("div.acoes", h("span.rotulo", "ações cadastradas"))),
      h("div.painel-bd", barras(porDiretoria))
    );

    /* movimentação */
    const movimento = db.dados.comentarios.slice()
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
      .slice(0, 5);

    const recente = h("section.painel",
      h("div.painel-hd", h("h2", "Movimentação recente")),
      h("div.painel-bd",
        movimento.length
          ? h("div.conversa", ...movimento.map(c => {
              const e = db.dados.etapas.find(x => x.id === c.etapa_id);
              const p = e ? db.projeto(e.projeto_id) : null;
              return h("div.comentario",
                h("div.avatar", U.iniciais(c.autor_nome)),
                h("div.comentario-corpo",
                  h("div.comentario-cab", h("b", c.autor_nome), h("time", U.relativo(c.criado_em))),
                  h("div", { estilo: { font: "400 11px/1.4 var(--f-dado)", color: "var(--faint)", marginTop: "2px" } },
                    p ? `${p.nome} · etapa ${e.numero}` : ""),
                  h("div.comentario-txt", c.corpo)
                )
              );
            }))
          : U.vazio("balao", "Sem comentários", "As conversas das etapas aparecem aqui.")
      )
    );

    return h("div.view",
      kpis,
      h("div.grade.g-2.surge", { estilo: { marginTop: "14px" } }, carteira, entregas),
      h("div.grade.g-2.surge", { estilo: { marginTop: "14px" } }, distribuicao, recente)
    );
  }

  function kpi({ nome, desc, valor, sufixo, pct, tom }) {
    return h("article.kpi", { estilo: { "--tom": tom } },
      h("div.kpi-txt",
        h("div.kpi-nome", nome),
        h("div.kpi-desc", desc),
        h("div.kpi-valor", String(valor), sufixo ? h("small", sufixo) : null)
      ),
      anel(pct, tom)
    );
  }

  /* =========================================================================
     CRONOGRAMA
     ====================================================================== */

  const SEM_POR_MES = 5;
  const TOTAL_SEM = 12 * SEM_POR_MES;
  let anoCrono = (window.CI_CONFIG && window.CI_CONFIG.ANO_CICLO) || new Date().getFullYear();
  let filtroCronoDir = "";

  function colunaDe(iso, ano) {
    const d = U.paraData(iso);
    if (!d) return null;
    if (d.getFullYear() < ano) return 0;
    if (d.getFullYear() > ano) return TOTAL_SEM - 1;
    const semana = Math.min(Math.ceil(d.getDate() / 7), SEM_POR_MES);
    return d.getMonth() * SEM_POR_MES + (semana - 1);
  }

  function somaDias(iso, dias) {
    const d = U.paraData(iso);
    if (!d) return iso;
    d.setDate(d.getDate() + dias);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  }

  function vCronograma() {
    const anos = new Set([anoCrono, new Date().getFullYear()]);
    db.dados.projetos.forEach(p => {
      [p.inicio, p.termino].forEach(v => { const d = U.paraData(v); if (d) anos.add(d.getFullYear()); });
    });
    const listaAnos = [...anos].sort();

    let projetos = db.dados.projetos.filter(p => p.inicio || p.termino);
    if (filtroCronoDir) projetos = projetos.filter(p => p.diretoria_id === filtroCronoDir);
    projetos.sort((a, b) => {
      const pa = PRIORIDADES.indexOf(a.prioridade), pb = PRIORIDADES.indexOf(b.prioridade);
      if (pa !== pb) return pa - pb;
      return String(a.inicio || "9").localeCompare(String(b.inicio || "9"));
    });

    const semData = db.dados.projetos.filter(p => !p.inicio && !p.termino);

    const grade = h("div.crono", { estilo: { "--semanas": TOTAL_SEM, "--cel": "26px" } });

    /* cabeçalho */
    const cabeca = h("div.crono-cabeca",
      h("div.crono-canto", h("span.rotulo", `Ciclo ${anoCrono}`))
    );
    for (let t = 0; t < 4; t++) {
      cabeca.appendChild(h("div.crono-h.tri", {
        estilo: { gridColumn: `${2 + t * 15} / span 15` }
      }, `${t + 1}º trimestre`));
    }
    for (let m = 0; m < 12; m++) {
      cabeca.appendChild(h("div.crono-h.mes", {
        estilo: { gridColumn: `${2 + m * SEM_POR_MES} / span ${SEM_POR_MES}` }
      }, U.MESES_C[m]));
    }
    for (let s = 0; s < TOTAL_SEM; s++) {
      const fimMes = (s + 1) % SEM_POR_MES === 0;
      const fimTri = (s + 1) % 15 === 0;
      cabeca.appendChild(h("div.crono-h.sem" + (fimTri ? ".fim-tri" : fimMes ? ".fim-mes" : ""), String((s % SEM_POR_MES) + 1)));
    }
    grade.appendChild(cabeca);

    /* linhas */
    projetos.forEach(p => {
      const s = estat(p.id);
      const linha = h("div.crono-linha");

      linha.appendChild(h("div.crono-proj", {
        onclick: () => (location.hash = "#/projeto/" + p.id),
        title: p.nome
      },
        h("i.barra-prio", { estilo: { background: TOM_PRIO[p.prioridade] } }),
        h("div", { estilo: { minWidth: 0 } },
          h("div.nome.truncar", p.nome),
          h("div.sub", `${p.prioridade} · ${s.total ? s.pct + "%" : "sem etapas"}`)
        )
      ));

      const faixa = h("div.crono-faixa");
      const ci = colunaDe(p.inicio || p.termino, anoCrono);
      const cf = colunaDe(p.termino || p.inicio, anoCrono);

      const noAno = (p.inicio && U.paraData(p.inicio)?.getFullYear() <= anoCrono) &&
                    (p.termino ? U.paraData(p.termino)?.getFullYear() >= anoCrono : true);

      if (ci !== null && cf !== null && noAno) {
        const ini = Math.min(ci, cf), fim = Math.max(ci, cf);
        const tomBarra = corProjeto(p);
        const barra = h("div.crono-barra", {
          estilo: {
            "--tom": tomBarra,
            left: `calc(${ini} * var(--cel, 26px) + 2px)`,
            width: `calc(${fim - ini + 1} * var(--cel, 26px) - 4px)`
          },
          title: `${p.nome}\n${U.dataBR(p.inicio)} → ${U.dataBR(p.termino)}\nArraste para deslocar; puxe as bordas para reprogramar.`,
          tabindex: 0
        },
          h("i.preenchido", { estilo: { width: s.pct + "%", background: U.veu(tomBarra) } }),
          h("span.rotulo-barra", { estilo: { color: U.corTexto(tomBarra) } }, p.nome),
          h("i.puxador.esq"), h("i.puxador.dir")
        );
        ligarArrasto(barra, p);
        faixa.appendChild(barra);
      }

      linha.appendChild(faixa);
      grade.appendChild(linha);
    });

    /* linha do hoje */
    const hoje = new Date();
    if (hoje.getFullYear() === anoCrono && projetos.length) {
      const col = hoje.getMonth() * SEM_POR_MES + (Math.min(Math.ceil(hoje.getDate() / 7), SEM_POR_MES) - 1);
      grade.appendChild(h("i.crono-hoje", {
        estilo: { left: `calc(236px + ${col} * var(--cel, 26px) + var(--cel, 26px) / 2)` }
      }));
    }

    const quadro = h("div.crono-quadro",
      h("div.crono-rolagem", grade),
      h("div.crono-legenda",
        h("span", h("i.amostra", { estilo: { background: "var(--crit)" } }), "Prioridade alta"),
        h("span", h("i.amostra", { estilo: { background: "var(--warn)" } }), "Média"),
        h("span", h("i.amostra", { estilo: { background: "var(--d-agua)" } }), "Baixa"),
        h("span", { estilo: { marginLeft: "auto", color: "var(--faint)" } },
          "A parte escura da barra é o percentual de etapas concluídas. Arraste a barra para deslocar o projeto; puxe as bordas para reprogramar.")
      )
    );

    return h("div.view",
      h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "9px", alignItems: "center", marginBottom: "14px" } },
        selecao(listaAnos.map(a => [String(a), "Ciclo " + a]), {
          value: String(anoCrono),
          estilo: { width: "auto", minWidth: "130px" },
          onchange: e => { anoCrono = Number(e.target.value); CI.app.recarregarVista(); }
        }),
        selecao([["", "Todas as diretorias"], ...db.dados.diretorias.map(d => [d.id, d.nome])], {
          value: filtroCronoDir,
          estilo: { width: "auto", minWidth: "180px" },
          onchange: e => { filtroCronoDir = e.target.value; CI.app.recarregarVista(); }
        }),
        h("span.discreto", { estilo: { fontSize: "12.5px", marginLeft: "auto" } },
          `${projetos.length} projeto(s) na linha do tempo`),
        h("button.btn.btn-primario", { type: "button", onclick: () => modalProjeto() }, ic("mais"), "Novo projeto")
      ),
      quadro,
      semData.length
        ? h("section.painel", { estilo: { marginTop: "14px" } },
            h("div.painel-hd", h("h2", "Fora da linha do tempo"),
              h("div.acoes", h("span.rotulo", "sem datas definidas"))),
            h("div.painel-bd",
              h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "8px" } },
                ...semData.map(p => h("button.btn.btn-p", {
                  type: "button", onclick: () => modalProjeto(p)
                }, h("i", { estilo: { width: "6px", height: "6px", borderRadius: "50%", background: corDiretoria(p.diretoria_id) } }), p.nome, ic("lapis")))
              ),
              h("p.discreto", { estilo: { fontSize: "12px", marginTop: "12px" } },
                "Defina início e término para que apareçam no cronograma.")
            )
          )
        : null
    );
  }

  /** Arrastar a barra inteira ou redimensionar pelas bordas. */
  function ligarArrasto(barra, projeto) {
    let modo = null, x0 = 0, cel = 26, deslocado = 0, base = null;

    barra.addEventListener("pointerdown", ev => {
      if (ev.button !== 0) return;
      const alvo = ev.target;
      modo = alvo.classList.contains("puxador")
        ? (alvo.classList.contains("esq") ? "inicio" : "fim")
        : "mover";
      x0 = ev.clientX;
      cel = parseFloat(getComputedStyle(barra.parentElement).getPropertyValue("--cel")) || 26;
      base = { inicio: projeto.inicio, termino: projeto.termino, left: barra.offsetLeft, width: barra.offsetWidth };
      deslocado = 0;
      barra.classList.add("arrastando");
      barra.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      ev.stopPropagation();
    });

    barra.addEventListener("pointermove", ev => {
      if (!modo) return;
      const passos = Math.round((ev.clientX - x0) / cel);
      if (passos === deslocado) return;
      deslocado = passos;
      if (modo === "mover") barra.style.left = (base.left + passos * cel) + "px";
      if (modo === "fim") barra.style.width = Math.max(cel - 4, base.width + passos * cel) + "px";
      if (modo === "inicio") {
        const larg = Math.max(cel - 4, base.width - passos * cel);
        barra.style.left = (base.left + (base.width - larg)) + "px";
        barra.style.width = larg + "px";
      }
    });

    const soltar = async ev => {
      if (!modo) return;
      const m = modo; modo = null;
      barra.classList.remove("arrastando");
      try { barra.releasePointerCapture(ev.pointerId); } catch (_) {}
      if (!deslocado) { CI.app.recarregarVista(); return; }

      const dias = deslocado * 7;
      const mudancas = {};
      if (m === "mover") {
        if (base.inicio) mudancas.inicio = somaDias(base.inicio, dias);
        if (base.termino) mudancas.termino = somaDias(base.termino, dias);
      } else if (m === "inicio") {
        mudancas.inicio = somaDias(base.inicio || base.termino, dias);
        if (base.termino && mudancas.inicio > base.termino) mudancas.inicio = base.termino;
      } else {
        mudancas.termino = somaDias(base.termino || base.inicio, dias);
        if (base.inicio && mudancas.termino < base.inicio) mudancas.termino = base.inicio;
      }

      try {
        await db.atualizar("projetos", projeto.id, mudancas);
        U.aviso(`${projeto.nome}: ${U.dataBR(mudancas.inicio || projeto.inicio)} → ${U.dataBR(mudancas.termino || projeto.termino)}`, "ok");
      } catch (e) {
        U.aviso("Não deu para salvar: " + e.message, "erro");
      }
      CI.app.recarregarVista();
    };

    barra.addEventListener("pointerup", soltar);
    barra.addEventListener("pointercancel", soltar);
    barra.addEventListener("dblclick", ev => { ev.stopPropagation(); modalProjeto(projeto); });
  }

  /* =========================================================================
     PROJETOS
     ====================================================================== */

  const filtros = { diretoria: "", tipo: "", prioridade: "", busca: "" };

  function vProjetos() {
    let lista = db.dados.projetos.slice();
    if (filtros.diretoria) lista = lista.filter(p => p.diretoria_id === filtros.diretoria);
    if (filtros.tipo) lista = lista.filter(p => p.tipo === filtros.tipo);
    if (filtros.prioridade) lista = lista.filter(p => p.prioridade === filtros.prioridade);
    if (filtros.busca) {
      const q = filtros.busca.toLowerCase();
      lista = lista.filter(p =>
        (p.nome || "").toLowerCase().includes(q) ||
        (p.objetivo || "").toLowerCase().includes(q) ||
        nomeDiretoria(p.diretoria_id).toLowerCase().includes(q));
    }
    lista.sort((a, b) => {
      const pa = PRIORIDADES.indexOf(a.prioridade), pb = PRIORIDADES.indexOf(b.prioridade);
      if (pa !== pb) return pa - pb;
      return (a.nome || "").localeCompare(b.nome || "");
    });

    const barraFiltros = h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "9px", alignItems: "center", marginBottom: "14px" } },
      selecao([["", "Todas as diretorias"], ...db.dados.diretorias.map(d => [d.id, d.nome])], {
        value: filtros.diretoria, estilo: { width: "auto", minWidth: "175px" },
        onchange: e => { filtros.diretoria = e.target.value; CI.app.recarregarVista(); }
      }),
      selecao([["", "Todos os tipos"], ...TIPOS], {
        value: filtros.tipo, estilo: { width: "auto", minWidth: "155px" },
        onchange: e => { filtros.tipo = e.target.value; CI.app.recarregarVista(); }
      }),
      selecao([["", "Qualquer prioridade"], ...PRIORIDADES], {
        value: filtros.prioridade, estilo: { width: "auto", minWidth: "160px" },
        onchange: e => { filtros.prioridade = e.target.value; CI.app.recarregarVista(); }
      }),
      (filtros.diretoria || filtros.tipo || filtros.prioridade || filtros.busca)
        ? h("button.btn.btn-fantasma.btn-p", {
            type: "button",
            onclick: () => { filtros.diretoria = filtros.tipo = filtros.prioridade = filtros.busca = ""; CI.app.recarregarVista(); }
          }, ic("x"), "Limpar")
        : null,
      h("span.discreto", { estilo: { fontSize: "12.5px", marginLeft: "auto" } }, `${lista.length} de ${db.dados.projetos.length}`),
      h("button.btn.btn-primario", { type: "button", onclick: () => modalProjeto() }, ic("mais"), "Novo projeto")
    );

    return h("div.view",
      barraFiltros,
      lista.length
        ? h("div.grade.g-3.surge", ...lista.map(cartaoProjeto))
        : U.vazio("caixa", "Nenhum projeto com esses filtros",
            "Ajuste os filtros acima ou crie um projeto novo.",
            h("button.btn.btn-primario", { type: "button", onclick: () => modalProjeto() }, ic("mais"), "Novo projeto"))
    );
  }

  function cartaoProjeto(p) {
    const s = estat(p.id);
    const cor = corProjeto(p);
    return h("button.cartao", { type: "button", onclick: () => (location.hash = "#/projeto/" + p.id) },
      h("div.cartao-topo",
        p.codigo ? h("span.indice", p.codigo) : null,
        h("h3", p.nome),
        h("i", { estilo: { width: "8px", height: "8px", borderRadius: "50%", background: cor, flex: "none", marginTop: "5px" } })
      ),
      p.objetivo ? h("p.objetivo", p.objetivo) : h("p.objetivo.discreto", { estilo: { fontStyle: "italic" } }, "Objetivo ainda não descrito."),
      h("div.cartao-meta",
        chip(p.prioridade, null, TOM_PRIO[p.prioridade]),
        chip(p.status, null, TOM_STATUS[p.status]),
        p.tipo !== "Projeto Interno" ? chip(p.tipo) : null,
        s.atrasadas ? chip(`${s.atrasadas} atrasada(s)`, "crit") : null
      ),
      h("div.progresso", h("i", { estilo: { width: s.pct + "%", "--tom": cor } })),
      h("div.cartao-pe",
        h("span", nomeDiretoria(p.diretoria_id)),
        h("span.direita", s.total ? `${s.feitas}/${s.total} etapas` : "sem etapas")
      )
    );
  }

  /* =========================================================================
     CONSOLE DO PROJETO
     ====================================================================== */

  let mostrarConcluidas = true;

  function vProjeto(id) {
    const p = db.projeto(id);
    if (!p) {
      return h("div.view", U.vazio("alerta", "Projeto não encontrado",
        "Ele pode ter sido removido ou o link está desatualizado.",
        h("button.btn", { type: "button", onclick: () => (location.hash = "#/projetos") }, ic("setaEsq"), "Voltar para projetos")));
    }

    const s = estat(p.id);
    const cor = corProjeto(p);
    let etapas = db.etapasDe(p.id);
    if (!mostrarConcluidas) etapas = etapas.filter(e => !e.concluida);

    const cabecalho = h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-start", marginBottom: "16px" } },
      h("button.btn.btn-fantasma.btn-icone", { type: "button", "aria-label": "Voltar", onclick: () => history.back() }, ic("setaEsq")),
      h("div", { estilo: { minWidth: 0, flex: "1 1 320px" } },
        h("div", { estilo: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" } },
          h("i", { estilo: { width: "9px", height: "9px", borderRadius: "50%", background: cor } }),
          h("span.rotulo", `${p.tipo} · ${nomeDiretoria(p.diretoria_id)}`)
        ),
        h("h1", { estilo: { fontSize: "26px", lineHeight: "1.15" } }, p.nome),
        h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" } },
          chip(p.prioridade, null, TOM_PRIO[p.prioridade]),
          chip(p.status, null, TOM_STATUS[p.status]),
          p.inicio || p.termino ? chip(`${U.dataBR(p.inicio)} → ${U.dataBR(p.termino)}`) : chip("Sem datas", "warn"),
          s.atrasadas ? chip(`${s.atrasadas} fora do prazo`, "crit") : null
        )
      ),
      h("div", { estilo: { display: "flex", gap: "7px", alignItems: "center" } },
        h("button.btn", { type: "button", onclick: () => modalProjeto(p) }, ic("lapis"), "Editar"),
        h("button.btn.btn-primario", { type: "button", onclick: () => modalEtapa(p.id) }, ic("mais"), "Nova etapa")
      )
    );

    const vitais = h("section.painel",
      h("div.painel-hd", h("h2", "Ficha do projeto")),
      h("div.painel-bd",
        h("div", { estilo: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" } },
          anel(s.pct, cor, 68, 7),
          h("div",
            h("div", { estilo: { font: "800 19px/1 var(--f-display)", letterSpacing: "-.02em" } },
              `${s.feitas}/${s.total}`),
            h("div.rotulo", { estilo: { marginTop: "5px" } }, "etapas concluídas"),
            s.proxima
              ? h("div", { estilo: { fontSize: "11.5px", color: "var(--muted)", marginTop: "7px" } },
                  "Próxima: " + U.dataBR(s.proxima.data_entrega))
              : null
          )
        ),
        h("dl.vitais",
          vital("Objetivo", p.objetivo),
          vital("Equipe", p.equipe),
          vital("Responsável", p.responsavel),
          vital("Professor apoiador", p.professor_apoiador),
          vital("Metodologia", p.metodologia),
          vital("Início", p.inicio ? U.dataExtenso(p.inicio) : ""),
          vital("Término", p.termino ? U.dataExtenso(p.termino) : "")
        ),
        h("div", { estilo: { display: "flex", gap: "7px", marginTop: "14px", flexWrap: "wrap" } },
          h("button.btn.btn-p", { type: "button", onclick: () => exportarProjeto(p) }, ic("baixar"), "Exportar CSV"),
          h("button.btn.btn-p.btn-perigo", {
            type: "button",
            onclick: async () => {
              const ok = await U.confirmar("Excluir projeto",
                `“${p.nome}” e suas ${s.total} etapas serão removidos. Não dá para desfazer.`, "Excluir");
              if (!ok) return;
              try { await db.excluir("projetos", p.id); U.aviso("Projeto excluído", "ok"); location.hash = "#/projetos"; }
              catch (e) { U.aviso(e.message, "erro"); }
            }
          }, ic("lixeira"), "Excluir")
        )
      )
    );

    const trilha = h("section.painel",
      h("div.painel-hd",
        h("h2", "Etapas"),
        h("div.acoes",
          h("label", { estilo: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)", cursor: "pointer" } },
            h("input", {
              type: "checkbox", checked: mostrarConcluidas,
              onchange: e => { mostrarConcluidas = e.target.checked; CI.app.recarregarVista(); }
            }), "mostrar concluídas"),
          h("button.btn.btn-p", { type: "button", onclick: () => modalEtapa(p.id) }, ic("mais"), "Etapa")
        )
      ),
      etapas.length > 1
        ? h("p.discreto", {
            estilo: { fontSize: "11.5px", padding: "9px 16px", borderBottom: "1px solid var(--line-soft)" }
          }, "Arraste pela alça à esquerda para reordenar. A numeração se ajusta sozinha.")
        : null,
      h("div.painel-bd.sem-pad",
        etapas.length
          ? trilhaOrdenavel(p, etapas)
          : U.vazio("cronograma", "Nenhuma etapa ainda",
              "Quebre o projeto em entregas com responsável e data. É isso que alimenta o cronograma e os avisos por e-mail.",
              h("button.btn.btn-primario", { type: "button", onclick: () => modalEtapa(p.id) }, ic("mais"), "Criar primeira etapa"))
      )
    );

    return h("div.view", cabecalho, h("div.console", vitais, trilha));
  }

  function vital(rotulo, valor) {
    return h("div.vital",
      h("dt", rotulo),
      h("dd", valor ? String(valor) : h("span.discreto", { estilo: { fontStyle: "italic" } }, "não informado"))
    );
  }

  function linhaEtapa(e, p) {
    const nComentarios = db.comentariosDe(e.id).length;
    const atrasada = etapaAtrasada(e);
    return h("div.etapa" + (e.concluida ? ".feita" : "") + (atrasada ? ".atrasada" : ""), {
      dataset: { id: e.id },
      onclick: ev => {
        if (ev.target.closest(".marcador") || ev.target.closest(".etapa-puxador")) return;
        gavetaEtapa(e.id);
      }
    },
      h("button.etapa-puxador", {
        type: "button",
        "aria-label": `Mover a etapa ${e.numero}. Use as setas para cima e para baixo.`,
        title: "Arraste para reordenar (ou use as setas do teclado)",
        onkeydown: ev => {
          if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
          ev.preventDefault();
          moverEtapaTeclado(e, ev.key === "ArrowUp" ? -1 : 1);
        }
      }, ic("arrastar")),
      h("div.etapa-no",
        h("button.marcador", {
          type: "button",
          "aria-label": e.concluida ? "Reabrir etapa" : "Concluir etapa",
          title: e.concluida ? "Reabrir etapa" : "Marcar como concluída",
          onclick: async ev => {
            ev.stopPropagation();
            await alternarEtapa(e);
          }
        }, e.concluida ? ic("check") : String(e.numero))
      ),
      h("div.etapa-corpo",
        h("div.etapa-desc", e.descricao || "Etapa sem descrição"),
        h("div.etapa-meta",
          e.responsavel ? chip(e.responsavel, null, "var(--d-peri)") : chip("Sem responsável", "warn"),
          chipPrazo(e),
          e.arquivo_url ? chip("Arquivo") : null,
          e.observacao ? chip("Com observação") : null
        )
      ),
      h("div.etapa-lado",
        h("span.sinal-com" + (nComentarios ? ".tem" : ""), ic("balao"), String(nComentarios)),
        ic("setaDir")
      )
    );
  }

  /* ---- reordenação da trilha -------------------------------------------
     Arrastar move o nó de verdade no DOM; ao soltar, a nova sequência é
     gravada. Quando as concluídas estão escondidas, a lista completa é
     remontada mantendo cada etapa oculta ancorada à visível que a precedia.
     ---------------------------------------------------------------------- */

  function trilhaOrdenavel(projeto, etapasVisiveis) {
    const trilha = h("div.trilha", ...etapasVisiveis.map(e => linhaEtapa(e, projeto)));
    ligarReordenacao(trilha, projeto.id);
    return trilha;
  }

  function ordemCompleta(projetoId, idsVisiveis) {
    const todas = db.etapasDe(projetoId).map(e => e.id);
    const visivel = new Set(idsVisiveis);
    const cabeca = [];
    const reboque = new Map();      // id visível -> ocultas que vinham logo depois
    let atual = null;
    todas.forEach(id => {
      if (visivel.has(id)) { atual = id; reboque.set(id, []); }
      else if (atual === null) cabeca.push(id);
      else reboque.get(atual).push(id);
    });
    const saida = [...cabeca];
    idsVisiveis.forEach(id => {
      saida.push(id);
      (reboque.get(id) || []).forEach(o => saida.push(o));
    });
    return saida;
  }

  async function gravarOrdem(projetoId, trilha) {
    const visiveis = [...trilha.querySelectorAll(".etapa")].map(el => el.dataset.id);
    try {
      const n = await db.reordenarEtapas(projetoId, ordemCompleta(projetoId, visiveis));
      if (n) U.aviso("Ordem das etapas atualizada", "ok");
    } catch (err) {
      U.aviso("Não deu para salvar a ordem: " + err.message, "erro");
    }
    CI.app.recarregarVista();
  }

  function ligarReordenacao(trilha, projetoId) {
    let linha = null, rolador = null, autoRolagem = 0;

    trilha.addEventListener("pointerdown", ev => {
      const alca = ev.target.closest(".etapa-puxador");
      if (!alca || ev.button !== 0) return;
      linha = alca.closest(".etapa");
      if (!linha) return;
      rolador = trilha.closest(".conteudo");
      linha.classList.add("movendo");
      trilha.classList.add("reordenando");
      linha.style.pointerEvents = "none";   // libera elementFromPoint
      alca.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    trilha.addEventListener("pointermove", ev => {
      if (!linha) return;
      ev.preventDefault();

      const sob = document.elementFromPoint(ev.clientX, ev.clientY);
      const alvo = sob && sob.closest(".etapa");
      if (alvo && alvo !== linha && alvo.parentElement === trilha) {
        const meio = alvo.getBoundingClientRect().top + alvo.offsetHeight / 2;
        trilha.insertBefore(linha, ev.clientY < meio ? alvo : alvo.nextSibling);
      }

      // rola sozinho perto das bordas
      if (rolador) {
        const r = rolador.getBoundingClientRect();
        if (ev.clientY < r.top + 70) autoRolagem = -14;
        else if (ev.clientY > r.bottom - 70) autoRolagem = 14;
        else autoRolagem = 0;
        if (autoRolagem) rolador.scrollTop += autoRolagem;
      }
    });

    const soltar = () => {
      if (!linha) return;
      linha.style.pointerEvents = "";
      linha.classList.remove("movendo");
      trilha.classList.remove("reordenando");
      linha = null; autoRolagem = 0;
      gravarOrdem(projetoId, trilha);
    };

    trilha.addEventListener("pointerup", soltar);
    trilha.addEventListener("pointercancel", soltar);
  }

  /** Setas do teclado sobre a alça: acessível e bom para ajuste fino. */
  async function moverEtapaTeclado(etapa, passo) {
    const visiveis = db.etapasDe(etapa.projeto_id)
      .filter(e => mostrarConcluidas || !e.concluida)
      .map(e => e.id);
    const i = visiveis.indexOf(etapa.id);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= visiveis.length) return;
    visiveis.splice(j, 0, visiveis.splice(i, 1)[0]);
    try {
      await db.reordenarEtapas(etapa.projeto_id, ordemCompleta(etapa.projeto_id, visiveis));
      CI.app.recarregarVista();
      setTimeout(() => {
        const alvo = document.querySelector(`.etapa[data-id="${etapa.id}"] .etapa-puxador`);
        alvo && alvo.focus();
      }, 70);
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  async function alternarEtapa(e) {
    try {
      const novo = !e.concluida;
      await db.atualizar("etapas", e.id, {
        concluida: novo,
        concluida_em: novo ? new Date().toISOString() : null
      });
      U.aviso(novo ? `Etapa ${e.numero} concluída` : `Etapa ${e.numero} reaberta`, novo ? "ok" : "info");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  /* =========================================================================
     GAVETA DA ETAPA — detalhe, campos e conversa
     ====================================================================== */

  function gavetaEtapa(etapaId) {
    const e = db.dados.etapas.find(x => x.id === etapaId);
    if (!e) return;
    const p = db.projeto(e.projeto_id);

    const salvar = async (campoNome, valor) => {
      if (String(e[campoNome] ?? "") === String(valor ?? "")) return;
      try {
        await db.atualizar("etapas", e.id, { [campoNome]: valor });
        e[campoNome] = valor;
        U.aviso("Salvo", "ok");
        if (campoNome === "responsavel_email" && valor) db.dispararEmails();
      } catch (err) { U.aviso("Não salvou: " + err.message, "erro"); }
    };

    const conversa = h("div.conversa");
    const compositor = h("textarea.entrada", {
      placeholder: "Escreva um comentário… (Ctrl+Enter envia)",
      rows: 3,
      onkeydown: ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") enviar(); }
    });

    function pintarConversa() {
      U.limpar(conversa);
      const lista = db.comentariosDe(e.id);
      if (!lista.length) {
        conversa.appendChild(h("p.discreto", { estilo: { fontSize: "12.5px" } },
          "Ainda não há comentários nesta etapa. Registre decisões, bloqueios e combinados aqui."));
        return;
      }
      lista.forEach(c => {
        conversa.appendChild(h("div.comentario",
          h("div.avatar", U.iniciais(c.autor_nome)),
          h("div.comentario-corpo",
            h("div.comentario-cab", h("b", c.autor_nome), h("time", U.relativo(c.criado_em))),
            h("div.comentario-txt", c.corpo)
          ),
          h("button.btn.btn-fantasma.btn-icone.btn-p.apagar", {
            type: "button", "aria-label": "Apagar comentário",
            onclick: async () => {
              const ok = await U.confirmar("Apagar comentário", "O comentário será removido para todo mundo.", "Apagar");
              if (!ok) return;
              try { await db.excluir("comentarios", c.id); pintarConversa(); U.aviso("Comentário apagado", "ok"); }
              catch (err) { U.aviso(err.message, "erro"); }
            }
          }, ic("lixeira"))
        ));
      });
    }

    async function enviar() {
      const texto = compositor.value.trim();
      if (!texto) { compositor.focus(); return; }
      compositor.disabled = true;
      try {
        await db.criar("comentarios", {
          etapa_id: e.id,
          projeto_id: e.projeto_id,
          autor_nome: db.perfil.nome || "Membro",
          autor_email: db.perfil.email || null,
          autor_id: db.usuario?.id || null,
          corpo: texto
        });
        compositor.value = "";
        pintarConversa();
        U.aviso("Comentário publicado", "ok");
        db.dispararEmails();
      } catch (err) {
        U.aviso("Não enviou: " + err.message, "erro");
      } finally {
        compositor.disabled = false;
        compositor.focus();
      }
    }

    pintarConversa();

    const corpo = [
      h("div.gaveta-secao",
        h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "7px", marginBottom: "14px" } },
          chipPrazo(e),
          chip(p?.nome || "—", null, p ? corProjeto(p) : null),
          h("button.btn.btn-p", {
            type: "button",
            onclick: async () => { await alternarEtapa(e); U.fecharGaveta(); }
          }, ic(e.concluida ? "recarregar" : "check"), e.concluida ? "Reabrir" : "Concluir")
        ),
        h("div.linha-campos",
          campo("Responsável", entrada({
            value: e.responsavel || "", placeholder: "Nome ou cargo",
            onchange: ev => salvar("responsavel", ev.target.value)
          })),
          campo("Data de entrega", entrada({
            type: "date", value: (e.data_entrega || "").slice(0, 10),
            onchange: ev => salvar("data_entrega", ev.target.value || null)
          }))
        ),
        h("div", { estilo: { marginTop: "12px" } },
          campo("E-mail do responsável", entrada({
            type: "email", value: e.responsavel_email || "", placeholder: "nome@adecon.com.br",
            onchange: ev => salvar("responsavel_email", ev.target.value)
          }), "Recebe aviso de atribuição, lembrete de prazo e novos comentários."))
      ),

      h("div.gaveta-secao",
        h("span.rotulo", "Observação da execução"),
        area({
          value: e.observacao || "", rows: 3,
          placeholder: "Como a etapa foi executada, o que travou, o que mudou…",
          onchange: ev => salvar("observacao", ev.target.value)
        })
      ),

      h("div.gaveta-secao",
        h("span.rotulo", "Anotações de reunião"),
        area({
          value: e.anotacoes || "", rows: 3,
          placeholder: "Pauta, encaminhamentos, responsáveis…",
          onchange: ev => salvar("anotacoes", ev.target.value)
        })
      ),

      h("div.gaveta-secao",
        h("span.rotulo", "Arquivo"),
        h("div", { estilo: { display: "flex", gap: "8px" } },
          entrada({
            value: e.arquivo_url || "", placeholder: "Link do Drive, Notion, relatório…",
            onchange: ev => salvar("arquivo_url", ev.target.value)
          }),
          e.arquivo_url
            ? h("a.btn.btn-icone", { href: e.arquivo_url, target: "_blank", rel: "noopener", "aria-label": "Abrir arquivo" }, ic("externo"))
            : null
        )
      ),

      h("div.gaveta-secao",
        h("span.rotulo", `Conversa (${db.comentariosDe(e.id).length})`),
        conversa,
        h("div.compositor",
          compositor,
          h("div.rodape",
            h("span.dica", `Comentando como ${db.perfil.nome || "Membro"}`),
            h("button.btn.btn-primario", { type: "button", onclick: enviar }, ic("balao"), "Comentar")
          )
        )
      )
    ];

    U.abrirGaveta({
      rotulo: `Etapa ${e.numero} · ${p?.nome || ""}`,
      titulo: e.descricao || "Etapa sem descrição",
      acoesCabecalho: [
        h("button.btn.btn-fantasma.btn-icone", {
          type: "button", "aria-label": "Editar etapa",
          onclick: () => { U.fecharGaveta(); modalEtapa(e.projeto_id, e); }
        }, ic("lapis"))
      ],
      corpo
    });
  }

  /* =========================================================================
     MODAIS DE CRIAÇÃO / EDIÇÃO
     ====================================================================== */

  function modalProjeto(projeto) {
    const editando = Boolean(projeto);
    const p = projeto || {
      nome: "", diretoria_id: db.dados.diretorias[0]?.id || null, tipo: "Projeto Interno",
      prioridade: "Média", status: "Planejado", objetivo: "", equipe: "", responsavel: "",
      professor_apoiador: "", metodologia: "", inicio: "", termino: "", codigo: "", cor: ""
    };

    const campos = {};
    const cp = (chave, rotulo, controle, dica) => { campos[chave] = controle; return campo(rotulo, controle, dica); };

    const corpo = [
      cp("nome", "Nome do projeto", entrada({ value: p.nome, placeholder: "HACKADECON", required: true })),
      h("div.linha-campos",
        cp("diretoria_id", "Diretoria", selecao(db.dados.diretorias.map(d => [d.id, d.nome]), { value: p.diretoria_id })),
        cp("tipo", "Classificação", selecao(TIPOS, { value: p.tipo }))
      ),
      h("div.linha-campos",
        cp("prioridade", "Prioridade", selecao(PRIORIDADES, { value: p.prioridade })),
        cp("status", "Status", selecao(STATUS, { value: p.status })),
        cp("codigo", "Código", entrada({ value: p.codigo || "", placeholder: "1.0" }))
      ),
      cp("objetivo", "Objetivo", area({ value: p.objetivo || "", rows: 3, placeholder: "O que este projeto garante para a empresa?" })),
      h("div.linha-campos",
        cp("equipe", "Equipe", entrada({ value: p.equipe || "", placeholder: "Diretores, gerentes e assessores" })),
        cp("responsavel", "Responsável", entrada({ value: p.responsavel || "", placeholder: "Gerente de Inovação" }))
      ),
      h("div.linha-campos",
        cp("professor_apoiador", "Professor apoiador", entrada({ value: p.professor_apoiador || "" })),
        cp("metodologia", "Metodologia", entrada({ value: p.metodologia || "", placeholder: "SCRUM, PDCA…" }))
      ),
      h("div.linha-campos",
        cp("inicio", "Início", entrada({ type: "date", value: (p.inicio || "").slice(0, 10) })),
        cp("termino", "Término", entrada({ type: "date", value: (p.termino || "").slice(0, 10) }))
      )
    ];

    U.abrirModal({
      sub: editando ? "Editar" : "Novo registro",
      titulo: editando ? p.nome : "Novo projeto interno",
      corpo,
      acoes: [
        h("button.btn", { type: "button", onclick: () => U.fecharModal() }, "Cancelar"),
        h("button.btn.btn-primario", {
          type: "button",
          onclick: async () => {
            const dados = {};
            for (const [k, el] of Object.entries(campos)) dados[k] = el.value || (k.match(/inicio|termino/) ? null : "");
            if (!dados.nome.trim()) { U.aviso("Dê um nome ao projeto.", "alerta"); campos.nome.focus(); return; }
            try {
              if (editando) {
                await db.atualizar("projetos", p.id, dados);
                U.aviso("Projeto atualizado", "ok");
              } else {
                const novo = await db.criar("projetos", dados);
                U.aviso("Projeto criado", "ok");
                location.hash = "#/projeto/" + novo.id;
              }
              U.fecharModal();
              CI.app.recarregarVista();
            } catch (err) { U.aviso("Não salvou: " + err.message, "erro"); }
          }
        }, ic("check"), editando ? "Salvar" : "Criar projeto")
      ]
    });
  }

  function modalEtapa(projetoId, etapa) {
    const editando = Boolean(etapa);
    const existentes = db.etapasDe(projetoId);
    const e = etapa || {
      numero: existentes.length + 1, descricao: "", responsavel: "",
      responsavel_email: "", data_entrega: ""
    };

    const fNumero = entrada({ type: "number", step: "0.5", value: e.numero, estilo: { maxWidth: "110px" } });
    const fDesc = area({ value: e.descricao || "", rows: 3, placeholder: "Reunião geral com todos os diretores para falar sobre o projeto" });
    const fResp = entrada({ value: e.responsavel || "", placeholder: "Gerente de Inovação" });
    const fEmail = entrada({ type: "email", value: e.responsavel_email || "", placeholder: "nome@adecon.com.br" });
    const fData = entrada({ type: "date", value: (e.data_entrega || "").slice(0, 10) });

    U.abrirModal({
      sub: editando ? "Editar etapa" : "Nova etapa",
      titulo: db.projeto(projetoId)?.nome || "Projeto",
      largura: 560,
      corpo: [
        h("div.linha-campos",
          campo("Nº", fNumero),
          campo("Data de entrega", fData)
        ),
        campo("Descrição", fDesc),
        h("div.linha-campos",
          campo("Responsável", fResp),
          campo("E-mail do responsável", fEmail, "Recebe o aviso automático.")
        )
      ],
      acoes: [
        editando
          ? h("button.btn.btn-perigo.esquerda", {
              type: "button",
              onclick: async () => {
                const ok = await U.confirmar("Excluir etapa", `A etapa ${e.numero} e seus comentários serão removidos.`, "Excluir");
                if (!ok) return;
                try { await db.excluir("etapas", e.id); U.fecharModal(); CI.app.recarregarVista(); U.aviso("Etapa excluída", "ok"); }
                catch (err) { U.aviso(err.message, "erro"); }
              }
            }, ic("lixeira"), "Excluir")
          : null,
        h("button.btn", { type: "button", onclick: () => U.fecharModal() }, "Cancelar"),
        h("button.btn.btn-primario", {
          type: "button",
          onclick: async () => {
            if (!fDesc.value.trim()) { U.aviso("Descreva a etapa.", "alerta"); fDesc.focus(); return; }
            const dados = {
              projeto_id: projetoId,
              numero: Number(fNumero.value) || existentes.length + 1,
              descricao: fDesc.value.trim(),
              responsavel: fResp.value.trim(),
              responsavel_email: fEmail.value.trim() || null,
              data_entrega: fData.value || null,
              ordem: editando ? (e.ordem ?? 0) : existentes.length
            };
            try {
              if (editando) { await db.atualizar("etapas", e.id, dados); U.aviso("Etapa atualizada", "ok"); }
              else { await db.criar("etapas", Object.assign({ concluida: false }, dados)); U.aviso("Etapa criada", "ok"); }
              if (dados.responsavel_email) db.dispararEmails();
              U.fecharModal();
              CI.app.recarregarVista();
            } catch (err) { U.aviso("Não salvou: " + err.message, "erro"); }
          }
        }, ic("check"), editando ? "Salvar" : "Adicionar etapa")
      ]
    });
  }

  /* =========================================================================
     DIRETORIAS — o quadro de cinco colunas
     ====================================================================== */

  let dirAberta = "";

  function vDiretorias() {
    const lista = dirAberta
      ? db.dados.diretorias.filter(d => d.id === dirAberta)
      : db.dados.diretorias.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    return h("div.view",
      h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "9px", alignItems: "center", marginBottom: "14px" } },
        selecao([["", "Todas as diretorias"], ...db.dados.diretorias.map(d => [d.id, d.nome])], {
          value: dirAberta, estilo: { width: "auto", minWidth: "200px" },
          onchange: e => { dirAberta = e.target.value; CI.app.recarregarVista(); }
        }),
        h("span.discreto", { estilo: { fontSize: "12.5px", marginLeft: "auto" } },
          "Cada coluna reproduz o levantamento feito com a diretoria.")
      ),
      h("div", { estilo: { display: "flex", flexDirection: "column", gap: "14px" } },
        ...lista.map(quadroDiretoria))
    );
  }

  function quadroDiretoria(d) {
    const itens = db.dados.itens_diretoria.filter(i => i.diretoria_id === d.id);
    const colunas = h("div.colunas");

    COLUNAS_QUADRO.forEach(nomeColuna => {
      const desta = itens.filter(i => i.coluna === nomeColuna).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      colunas.appendChild(h("div.coluna",
        h("div.coluna-hd",
          h("span.rotulo", nomeColuna),
          h("span.cont", String(desta.length))
        ),
        ...desta.map(i => h("div.item-quadro", { estilo: { "--tom": U.corVisivel(d.cor) } },
          i.projeto_id
            ? h("a", {
                href: "#/projeto/" + i.projeto_id,
                estilo: { color: "var(--txt)", textDecoration: "none", fontWeight: 500 }
              }, i.titulo)
            : h("span", { estilo: { fontWeight: 500 } }, i.titulo),
          i.descricao ? h("span.discreto", { estilo: { fontSize: "11.5px" } }, i.descricao) : null,
          i.responsavel ? h("span.quem", i.responsavel) : null,
          h("button.remover", {
            type: "button", "aria-label": "Remover item",
            onclick: async () => {
              const ok = await U.confirmar("Remover item", `“${i.titulo}” sai do quadro da ${d.nome}.`, "Remover");
              if (!ok) return;
              try { await db.excluir("itens_diretoria", i.id); U.aviso("Item removido", "ok"); }
              catch (err) { U.aviso(err.message, "erro"); }
            }
          }, ic("x"))
        )),
        h("button.add-item", {
          type: "button",
          onclick: () => modalItemQuadro(d, nomeColuna)
        }, ic("mais"), "Adicionar")
      ));
    });

    return h("section.painel",
      h("div.diretoria-cab",
        h("span.diretoria-sigla", {
          estilo: { background: U.corVisivel(d.cor), color: U.corTexto(d.cor) }
        }, d.sigla || "—"),
        h("div", { estilo: { minWidth: 0, flex: "1 1 auto" } },
          h("h2", { estilo: { fontSize: "16px" } }, d.nome),
          h("div.rotulo", { estilo: { marginTop: "4px" } }, d.composicao || ""),
          d.pergunta_norteadora ? h("p.pergunta", { estilo: { marginTop: "10px" } }, d.pergunta_norteadora) : null
        )
      ),
      colunas
    );
  }

  function modalItemQuadro(d, coluna) {
    const fTitulo = entrada({ placeholder: "Nome da iniciativa, processo ou ferramenta" });
    const fDesc = entrada({ placeholder: "Detalhe em uma linha (opcional)" });
    const fResp = entrada({ placeholder: "Quem toca isso" });
    const fProj = selecao(
      [["", "Não vincular"], ...db.dados.projetos.map(p => [p.id, p.nome])], { value: "" });

    U.abrirModal({
      sub: `${d.nome} · ${coluna}`,
      titulo: "Adicionar ao quadro",
      largura: 520,
      corpo: [
        campo("Título", fTitulo),
        campo("Descrição", fDesc),
        h("div.linha-campos",
          campo("Responsável", fResp),
          campo("Vincular a um projeto", fProj)
        )
      ],
      acoes: [
        h("button.btn", { type: "button", onclick: () => U.fecharModal() }, "Cancelar"),
        h("button.btn.btn-primario", {
          type: "button",
          onclick: async () => {
            if (!fTitulo.value.trim()) { U.aviso("Dê um título ao item.", "alerta"); fTitulo.focus(); return; }
            try {
              await db.criar("itens_diretoria", {
                diretoria_id: d.id, coluna,
                titulo: fTitulo.value.trim(),
                descricao: fDesc.value.trim() || null,
                responsavel: fResp.value.trim() || null,
                projeto_id: fProj.value || null,
                ordem: db.dados.itens_diretoria.filter(i => i.diretoria_id === d.id && i.coluna === coluna).length
              });
              U.fecharModal();
              U.aviso("Item adicionado", "ok");
            } catch (err) { U.aviso("Não salvou: " + err.message, "erro"); }
          }
        }, ic("check"), "Adicionar")
      ]
    });
  }

  /* =========================================================================
     IMPLEMENTAÇÃO
     ====================================================================== */

  const STATUS_IMPL = ["Proposto", "Em teste", "Implementado", "Descartado"];
  const TOM_IMPL = { Proposto: "var(--muted)", "Em teste": "var(--warn)", Implementado: "var(--ok)", Descartado: "var(--faint)" };

  function vImplementacao() {
    const todos = db.dados.implementacoes;
    const feitos = todos.filter(i => i.status === "Implementado").length;
    const tip = todos.length ? Math.round((feitos / todos.length) * 100) : 0;

    const tabela = tipo => {
      const linhas = todos.filter(i => i.tipo === tipo);
      return h("section.painel",
        h("div.painel-hd",
          h("h2", tipo === "Ferramenta" ? "Ferramentas" : "Processos"),
          h("div.acoes",
            chip(`${linhas.filter(i => i.status === "Implementado").length}/${linhas.length} implementados`,
              linhas.length && linhas.every(i => i.status === "Implementado") ? "ok" : null),
            h("button.btn.btn-p", { type: "button", onclick: () => modalImplementacao(tipo) }, ic("mais"), "Adicionar")
          )
        ),
        h("div.painel-bd.sem-pad",
          linhas.length
            ? h("div.tabela-rolagem", h("table.tabela",
                h("thead", h("tr",
                  h("th", tipo), h("th", "Responsável"), h("th", "Diretoria"),
                  h("th", "Status"), h("th", "Relatório"), h("th", "")
                )),
                h("tbody", ...linhas.map(i => h("tr",
                  h("td", h("span", { estilo: { fontWeight: 500 } }, i.nome)),
                  h("td.discreto", i.responsavel || "—"),
                  h("td.discreto", nomeDiretoria(i.diretoria_id)),
                  h("td", selecao(STATUS_IMPL, {
                    value: i.status,
                    estilo: { width: "auto", minWidth: "130px", padding: "5px 26px 5px 9px", fontSize: "12px",
                              backgroundPosition: "calc(100% - 13px) 13px, calc(100% - 8px) 13px" },
                    onchange: async ev => {
                      try {
                        await db.atualizar("implementacoes", i.id, {
                          status: ev.target.value,
                          data_implementacao: ev.target.value === "Implementado" ? U.hojeISO() : null
                        });
                        U.aviso("Status atualizado", "ok");
                      } catch (err) { U.aviso(err.message, "erro"); }
                    }
                  })),
                  h("td", i.relatorio_url
                    ? h("a", { href: i.relatorio_url, target: "_blank", rel: "noopener", estilo: { fontSize: "12px" } }, "abrir")
                    : h("span.discreto", "—")),
                  h("td", { estilo: { textAlign: "right" } },
                    h("button.btn.btn-fantasma.btn-icone.btn-p", {
                      type: "button", "aria-label": "Remover",
                      onclick: async () => {
                        const ok = await U.confirmar("Remover", `“${i.nome}” sai da lista.`, "Remover");
                        if (!ok) return;
                        try { await db.excluir("implementacoes", i.id); U.aviso("Removido", "ok"); }
                        catch (err) { U.aviso(err.message, "erro"); }
                      }
                    }, ic("lixeira")))
                )))
              ))
            : U.vazio("tomada", `Nenhuma ${tipo.toLowerCase()} registrada`,
                "Cada item aqui entra no cálculo do TIP.",
                h("button.btn.btn-primario", { type: "button", onclick: () => modalImplementacao(tipo) }, ic("mais"), "Adicionar"))
        )
      );
    };

    return h("div.view",
      h("div.grade.g-kpi.surge", { estilo: { marginBottom: "14px" } },
        kpi({ nome: "TIP", desc: "Taxa de implementação de processos e ferramentas",
              valor: tip, sufixo: "%", pct: tip, tom: "var(--d-agua)" }),
        kpi({ nome: "Implementados", desc: "Itens já em uso na empresa",
              valor: feitos, pct: todos.length ? (feitos / todos.length) * 100 : 0, tom: "var(--ok)" }),
        kpi({ nome: "Em teste", desc: "Rodando em piloto",
              valor: todos.filter(i => i.status === "Em teste").length,
              pct: todos.length ? (todos.filter(i => i.status === "Em teste").length / todos.length) * 100 : 0,
              tom: "var(--warn)" }),
        kpi({ nome: "Propostos", desc: "Aguardando validação",
              valor: todos.filter(i => i.status === "Proposto").length,
              pct: todos.length ? (todos.filter(i => i.status === "Proposto").length / todos.length) * 100 : 0,
              tom: "var(--muted)" })
      ),
      h("div", { estilo: { display: "flex", flexDirection: "column", gap: "14px" } },
        tabela("Ferramenta"), tabela("Processo"))
    );
  }

  function modalImplementacao(tipo) {
    const fNome = entrada({ placeholder: tipo === "Ferramenta" ? "Notion, CRM, automação…" : "Repasse semanal, onboarding…" });
    const fResp = entrada({ placeholder: "Quem conduz" });
    const fDir = selecao([["", "Sem diretoria"], ...db.dados.diretorias.map(d => [d.id, d.nome])], { value: "" });
    const fStatus = selecao(STATUS_IMPL, { value: "Proposto" });
    const fRel = entrada({ placeholder: "Link do relatório (opcional)" });

    U.abrirModal({
      sub: tipo, titulo: `Nova ${tipo.toLowerCase()}`, largura: 520,
      corpo: [
        campo("Nome", fNome),
        h("div.linha-campos", campo("Responsável", fResp), campo("Diretoria", fDir)),
        h("div.linha-campos", campo("Status", fStatus), campo("Relatório", fRel))
      ],
      acoes: [
        h("button.btn", { type: "button", onclick: () => U.fecharModal() }, "Cancelar"),
        h("button.btn.btn-primario", {
          type: "button",
          onclick: async () => {
            if (!fNome.value.trim()) { U.aviso("Informe o nome.", "alerta"); fNome.focus(); return; }
            try {
              await db.criar("implementacoes", {
                tipo, nome: fNome.value.trim(),
                responsavel: fResp.value.trim() || null,
                diretoria_id: fDir.value || null,
                status: fStatus.value,
                relatorio_url: fRel.value.trim() || null,
                data_implementacao: fStatus.value === "Implementado" ? U.hojeISO() : null
              });
              U.fecharModal(); U.aviso("Registrado", "ok");
            } catch (err) { U.aviso("Não salvou: " + err.message, "erro"); }
          }
        }, ic("check"), "Adicionar")
      ]
    });
  }

  /* =========================================================================
     INDICADORES
     ====================================================================== */

  function vIndicadores() {
    const impl = db.dados.implementacoes;
    const implementados = impl.filter(i => i.status === "Implementado").length;
    const tip = impl.length ? Math.round((implementados / impl.length) * 100) : 0;

    const av = db.dados.avaliacoes;
    const somaNotas = av.reduce((s, a) => s + Number(a.nota || 0), 0);
    const somaMax = av.reduce((s, a) => s + Number(a.nota_maxima || 10), 0);
    const isd = somaMax ? Math.round((somaNotas / somaMax) * 100) : 0;

    const internos = db.dados.projetos.filter(p => p.tipo === "Projeto Interno");
    const atingidos = internos.filter(p => p.status === "Concluído").length;
    const inov = internos.length ? Math.round((atingidos / internos.length) * 100) : 0;

    const cartao = (titulo, formula, valor, detalhe, tom) => h("section.painel",
      h("div.painel-hd", h("h2", titulo)),
      h("div.painel-bd", { estilo: { display: "flex", gap: "16px", alignItems: "center" } },
        anel(valor, tom, 86, 8),
        h("div", { estilo: { minWidth: 0 } },
          h("div", { estilo: { font: "800 34px/1 var(--f-display)", letterSpacing: "-.035em", fontVariantNumeric: "tabular-nums" } },
            valor + "%"),
          h("div.rotulo", { estilo: { marginTop: "7px" } }, formula),
          h("p.discreto", { estilo: { fontSize: "12.5px", marginTop: "7px", lineHeight: 1.5 } }, detalhe)
        )
      )
    );

    /* etapas por diretoria */
    const porDir = db.dados.diretorias.map(d => {
      const ids = db.dados.projetos.filter(p => p.diretoria_id === d.id).map(p => p.id);
      const es = db.dados.etapas.filter(e => ids.includes(e.projeto_id));
      return { rotulo: d.nome, valor: es.filter(e => e.concluida).length, total: es.length, tom: U.corVisivel(d.cor) };
    }).filter(x => x.total > 0);

    const porStatus = STATUS.map(s => ({
      rotulo: s,
      valor: db.dados.projetos.filter(p => p.status === s).length,
      tom: TOM_STATUS[s]
    })).filter(x => x.valor > 0);

    /* lançamento de nota (ISD) */
    const fDir = selecao(db.dados.diretorias.map(d => [d.id, d.nome]), { value: db.dados.diretorias[0]?.id });
    const fNota = entrada({ type: "number", min: "0", max: "10", step: "0.5", value: "8", estilo: { maxWidth: "110px" } });

    return h("div.view",
      h("div.grade.surge", { estilo: { gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))" } },
        cartao("TIP", "implementados ÷ propostos", tip,
          `${implementados} de ${impl.length} processos e ferramentas já em uso.`, "var(--d-agua)"),
        cartao("ISD", "notas recebidas ÷ notas máximas", isd,
          av.length ? `${av.length} avaliação(ões) registradas.` : "Ainda sem avaliações lançadas.", "var(--d-peri)"),
        cartao("Inovação", "objetivos atingidos ÷ projetos definidos", inov,
          `${atingidos} de ${internos.length} projetos internos concluídos.`, "var(--accent)")
      ),
      h("div.grade.g-2.surge", { estilo: { marginTop: "14px" } },
        h("section.painel",
          h("div.painel-hd", h("h2", "Etapas concluídas por diretoria"),
            h("div.acoes", h("span.rotulo", "concluídas / total"))),
          h("div.painel-bd",
            porDir.length
              ? h("div", { estilo: { display: "flex", flexDirection: "column", gap: "11px" } },
                  ...porDir.map(d => h("div",
                    h("div", { estilo: { display: "flex", justifyContent: "space-between", marginBottom: "5px" } },
                      h("span", { estilo: { fontSize: "12.5px", color: "var(--txt-2)" } }, d.rotulo),
                      h("span.dado", { estilo: { fontSize: "11.5px", color: "var(--muted)" } }, `${d.valor}/${d.total}`)
                    ),
                    h("div.progresso", h("i", { estilo: { width: Math.round((d.valor / d.total) * 100) + "%", "--tom": d.tom } }))
                  ))
                )
              : U.vazio("pulso", "Sem etapas cadastradas", "Adicione etapas aos projetos para acompanhar a execução.")
          )
        ),
        h("section.painel",
          h("div.painel-hd", h("h2", "Situação dos projetos")),
          h("div.painel-bd", barras(porStatus))
        )
      ),
      h("section.painel.surge", { estilo: { marginTop: "14px" } },
        h("div.painel-hd", h("h2", "Satisfação das diretorias (ISD)"),
          h("div.acoes", h("span.rotulo", "base do indicador"))),
        h("div.painel-bd",
          h("div", { estilo: { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end", marginBottom: av.length ? "16px" : "0" } },
            campo("Diretoria", fDir),
            campo("Nota (0 a 10)", fNota),
            h("button.btn.btn-primario", {
              type: "button",
              onclick: async () => {
                const nota = Number(fNota.value);
                if (Number.isNaN(nota) || nota < 0 || nota > 10) { U.aviso("Informe uma nota entre 0 e 10.", "alerta"); return; }
                try {
                  await db.criar("avaliacoes", {
                    diretoria_id: fDir.value, nota, nota_maxima: 10,
                    competencia: U.hojeISO().slice(0, 8) + "01"
                  });
                  U.aviso("Nota lançada", "ok");
                  CI.app.recarregarVista();
                } catch (err) { U.aviso(err.message, "erro"); }
              }
            }, ic("mais"), "Lançar nota")
          ),
          av.length
            ? h("div.tabela-rolagem", h("table.tabela", { estilo: { minWidth: "440px" } },
                h("thead", h("tr", h("th", "Diretoria"), h("th", "Nota"), h("th", "Competência"), h("th", ""))),
                h("tbody", ...av.slice().reverse().map(a => h("tr",
                  h("td", nomeDiretoria(a.diretoria_id)),
                  h("td.dado", `${a.nota} / ${a.nota_maxima || 10}`),
                  h("td.discreto", U.dataBR(a.competencia)),
                  h("td", { estilo: { textAlign: "right" } },
                    h("button.btn.btn-fantasma.btn-icone.btn-p", {
                      type: "button", "aria-label": "Remover nota",
                      onclick: async () => {
                        try { await db.excluir("avaliacoes", a.id); CI.app.recarregarVista(); }
                        catch (err) { U.aviso(err.message, "erro"); }
                      }
                    }, ic("lixeira")))
                )))
              ))
            : h("p.discreto", { estilo: { fontSize: "12.5px" } },
                "Lance as notas do formulário de satisfação para o ISD sair do zero.")
        )
      )
    );
  }

  /* =========================================================================
     CONFIGURAÇÃO
     ====================================================================== */

  function vConfig() {
    const con = db.conexao();
    const fUrl = entrada({ value: con.url, placeholder: "https://xxxxxxxx.supabase.co" });
    const fChave = entrada({ value: con.chave, placeholder: "eyJhbGciOi… (chave anon / publishable)" });
    const fNome = entrada({ value: db.perfil.nome || "", placeholder: "Como você assina os comentários" });
    const fEmail = entrada({ type: "email", value: db.perfil.email || "", placeholder: "voce@adecon.com.br" });

    const painelConexao = h("section.painel",
      h("div.painel-hd", h("h2", "Conexão com o Supabase"),
        h("div.acoes", chip(db.mensagemEstado,
          db.estado === "online" ? "ok" : db.estado === "erro" ? "crit" : null))),
      h("div.painel-bd", { estilo: { display: "grid", gap: "13px" } },
        h("p.discreto", { estilo: { fontSize: "12.5px", lineHeight: 1.6 } },
          "Sem estas chaves o painel roda em modo local: tudo fica só neste navegador. ",
          "Com elas, os dados passam a ser do banco e todo mundo vê a mesma coisa em tempo real. ",
          "A chave anon é pública por natureza — quem protege os dados são as políticas de RLS do schema."),
        campo("URL do projeto", fUrl),
        campo("Chave anon", fChave),
        h("div", { estilo: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("button.btn.btn-primario", {
            type: "button",
            onclick: async () => {
              db.salvarConexao(fUrl.value, fChave.value);
              U.aviso("Conexão salva. Recarregando…", "ok");
              setTimeout(() => location.reload(), 700);
            }
          }, ic("plugue"), "Salvar e conectar"),
          con.url ? h("button.btn", {
            type: "button",
            onclick: async () => {
              db.salvarConexao("", "");
              U.aviso("Voltando ao modo local…", "info");
              setTimeout(() => location.reload(), 700);
            }
          }, ic("recarregar"), "Desconectar") : null,
          h("button.btn", {
            type: "button",
            onclick: async () => {
              const r = await db.dispararEmails();
              U.aviso(r?.pulado ? "Disponível apenas com Supabase conectado."
                : r?.erro ? "Falhou: " + r.erro
                : `Fila processada: ${r.enviadas ?? 0} e-mail(s).`,
                r?.erro ? "erro" : "ok");
            }
          }, ic("correio"), "Enviar fila de e-mails agora")
        ),
        db.motor === "supabase" && !db.usuario
          ? h("p", { estilo: { fontSize: "12.5px", color: "var(--warn)" } },
              "Conectado, mas sem sessão. Entre com seu e-mail para ler e gravar no banco.")
          : null
      )
    );

    const painelPerfil = h("section.painel",
      h("div.painel-hd", h("h2", "Seu perfil")),
      h("div.painel-bd", { estilo: { display: "grid", gap: "13px" } },
        h("div.linha-campos", campo("Nome", fNome), campo("E-mail", fEmail)),
        h("div", h("button.btn.btn-primario", {
          type: "button",
          onclick: () => { db.salvarPerfil({ nome: fNome.value.trim(), email: fEmail.value.trim() }); U.aviso("Perfil salvo", "ok"); }
        }, ic("check"), "Salvar perfil")),
        db.usuario
          ? h("div", h("button.btn", { type: "button", onclick: () => db.sair() }, ic("sair"), "Sair da conta"))
          : null
      )
    );

    const painelDados = h("section.painel",
      h("div.painel-hd", h("h2", "Dados")),
      h("div.painel-bd", { estilo: { display: "grid", gap: "13px" } },
        h("p.discreto", { estilo: { fontSize: "12.5px", lineHeight: 1.6 } },
          "O arquivo JSON serve de backup e também para migrar do modo local para o Supabase."),
        h("div", { estilo: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("button.btn", { type: "button", onclick: exportarJSON }, ic("baixar"), "Exportar JSON"),
          h("button.btn", { type: "button", onclick: importarJSON }, ic("arquivo"), "Importar JSON"),
          h("button.btn", { type: "button", onclick: () => exportarCSVGeral() }, ic("baixar"), "Exportar etapas (CSV)"),
          db.motor === "local" ? h("button.btn", {
            type: "button",
            onclick: async () => {
              const ok = await U.confirmar("Restaurar exemplo",
                "Os dados atuais deste navegador serão substituídos pelos dados da planilha.", "Restaurar", false);
              if (ok) { db.restaurarExemplo(); U.aviso("Dados de exemplo restaurados", "ok"); CI.app.recarregarVista(); }
            }
          }, ic("recarregar"), "Restaurar exemplo") : null,
          db.motor === "local" ? h("button.btn.btn-perigo", {
            type: "button",
            onclick: async () => {
              const ok = await U.confirmar("Limpar tudo", "Todos os dados deste navegador serão apagados.", "Limpar");
              if (ok) { db.limparTudo(); U.aviso("Tudo limpo", "ok"); CI.app.recarregarVista(); }
            }
          }, ic("lixeira"), "Limpar tudo") : null
        )
      )
    );

    const painelEmail = h("section.painel",
      h("div.painel-hd", h("h2", "E-mails automáticos")),
      h("div.painel-bd",
        h("p.discreto", { estilo: { fontSize: "12.5px", lineHeight: 1.65, marginBottom: "12px" } },
          "O banco enfileira um e-mail sempre que uma etapa ganha responsável, alguém comenta ou um prazo se aproxima. ",
          "Uma Edge Function esvazia a fila pelo Resend."),
        h("ul", { estilo: { margin: 0, paddingLeft: "18px", color: "var(--txt-2)", fontSize: "12.5px", lineHeight: 1.9 } },
          h("li", "Etapa atribuída — chega para o responsável na hora."),
          h("li", "Novo comentário — chega para o responsável da etapa."),
          h("li", "Prazo em 3 dias e no dia — enviado às 8h em dias úteis."),
          h("li", "Prazo vencido — enviado até a etapa ser concluída ou repactuada.")
        ),
        h("p.discreto", { estilo: { fontSize: "12px", marginTop: "12px" } },
          "Configure RESEND_API_KEY, EMAIL_REMETENTE e URL_APP nos secrets das Edge Functions. O passo a passo está no README do repositório.")
      )
    );

    return h("div.view", h("div.grade.g-2.surge",
      h("div", { estilo: { display: "flex", flexDirection: "column", gap: "14px" } }, painelConexao, painelDados),
      h("div", { estilo: { display: "flex", flexDirection: "column", gap: "14px" } }, painelPerfil, painelEmail)
    ));
  }

  /* =========================================================================
     EXPORTAÇÃO
     ====================================================================== */

  function baixar(nome, conteudo, tipo) {
    try {
      const blob = new Blob([conteudo], { type: tipo });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      U.aviso("Arquivo gerado: " + nome, "ok");
    } catch (_) {
      U.aviso("O navegador bloqueou o download aqui. Tente pelo site publicado.", "alerta");
    }
  }

  function csvLinha(campos) {
    return campos.map(c => {
      const s = String(c ?? "");
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(";");
  }

  function exportarProjeto(p) {
    const linhas = [csvLinha(["Etapa", "Descrição", "Responsável", "E-mail", "Data de entrega", "Dentro do prazo", "Concluída", "Observação", "Anotações", "Arquivo"])];
    db.etapasDe(p.id).forEach(e => {
      const dentro = e.concluida
        ? (!e.data_entrega || !e.concluida_em || e.concluida_em.slice(0, 10) <= e.data_entrega)
        : (!e.data_entrega || U.diasAte(e.data_entrega) >= 0);
      linhas.push(csvLinha([e.numero, e.descricao, e.responsavel, e.responsavel_email,
        e.data_entrega ? U.dataBR(e.data_entrega) : "", dentro ? "SIM" : "NÃO",
        e.concluida ? "SIM" : "NÃO", e.observacao, e.anotacoes, e.arquivo_url]));
    });
    baixar(`${p.nome.replace(/[^\w\-]+/g, "_")}.csv`, "﻿" + linhas.join("\n"), "text/csv;charset=utf-8");
  }

  function exportarCSVGeral() {
    const linhas = [csvLinha(["Projeto", "Diretoria", "Prioridade", "Etapa", "Descrição", "Responsável", "Data de entrega", "Concluída"])];
    db.dados.projetos.forEach(p => db.etapasDe(p.id).forEach(e => {
      linhas.push(csvLinha([p.nome, nomeDiretoria(p.diretoria_id), p.prioridade, e.numero,
        e.descricao, e.responsavel, e.data_entrega ? U.dataBR(e.data_entrega) : "", e.concluida ? "SIM" : "NÃO"]));
    }));
    baixar("central-inovacao-etapas.csv", "﻿" + linhas.join("\n"), "text/csv;charset=utf-8");
  }

  function exportarJSON() {
    baixar("central-inovacao.json", JSON.stringify(db.dados, null, 2), "application/json");
  }

  function importarJSON() {
    const input = h("input", { type: "file", accept: "application/json,.json", estilo: { display: "none" } });
    input.addEventListener("change", async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      try {
        const bruto = JSON.parse(await arquivo.text());
        if (db.motor === "local") {
          db.TABELAS.forEach(t => { if (Array.isArray(bruto[t])) db.dados[t] = bruto[t]; });
          try { localStorage.setItem("ci:dados:v2", JSON.stringify(db.dados)); } catch (_) {}
          db.emitir();
          U.aviso("Dados importados", "ok");
        } else {
          let n = 0;
          for (const tabela of db.TABELAS) {
            for (const linha of (bruto[tabela] || [])) {
              const copia = Object.assign({}, linha); delete copia.id; delete copia.criado_em;
              try { await db.criar(tabela, copia); n++; } catch (_) {}
            }
          }
          U.aviso(`${n} registro(s) enviados ao Supabase`, "ok");
        }
        CI.app.recarregarVista();
      } catch (err) { U.aviso("Arquivo inválido: " + err.message, "erro"); }
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  /* ---- busca global ------------------------------------------------------ */

  function buscaGlobal(termo) {
    const q = termo.trim().toLowerCase();
    if (!q) return [];
    const res = [];
    db.dados.projetos.forEach(p => {
      if ((p.nome || "").toLowerCase().includes(q) || (p.objetivo || "").toLowerCase().includes(q)) {
        res.push({ tipo: "Projeto", titulo: p.nome, sub: nomeDiretoria(p.diretoria_id), ir: () => (location.hash = "#/projeto/" + p.id) });
      }
    });
    db.dados.etapas.forEach(e => {
      if ((e.descricao || "").toLowerCase().includes(q) || (e.responsavel || "").toLowerCase().includes(q)) {
        const p = db.projeto(e.projeto_id);
        res.push({
          tipo: "Etapa", titulo: e.descricao, sub: `${p?.nome || ""} · etapa ${e.numero}`,
          ir: () => { location.hash = "#/projeto/" + e.projeto_id; setTimeout(() => gavetaEtapa(e.id), 90); }
        });
      }
    });
    return res.slice(0, 12);
  }

  /* =========================================================================
     PÁGINA INICIAL — o mascote equilibrista
     Loop de 6 s em canvas, animado por curvas (nada de CSS keyframe solto):
       0.00–0.90  entra correndo e freia derrapando
       1.00–2.15  as cinco caixas caem e se empilham na cabeça
       2.45–3.65  a torre tomba, ele entra em pânico
       3.65–4.18  salvamento elástico
       4.18–5.25  pulo de comemoração e confete
       5.25–6.00  sai correndo de quadro e o laço recomeça
     ====================================================================== */

  const DUR_CICLO = 6000;

  /* --- curvas ------------------------------------------------------------ */
  const sat01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
  const saiCubica  = t => 1 - Math.pow(1 - t, 3);
  const entraCubica = t => t * t * t;
  const entraQuad  = t => t * t;
  const suave      = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const saiCostas  = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const saiElastica = t => (t === 0 || t === 1) ? t
    : Math.pow(2, -9 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1;

  /** Curva por quadros-chave: kf(t, [[ms, valor, easing?], ...]) */
  function kf(t, pontos) {
    if (t <= pontos[0][0]) return pontos[0][1];
    for (let i = 1; i < pontos.length; i++) {
      if (t <= pontos[i][0]) {
        const [a, va] = pontos[i - 1];
        const [b, vb, e] = pontos[i];
        const u = (t - a) / (b - a);
        return va + (vb - va) * (e ? e(u) : u);
      }
    }
    return pontos[pontos.length - 1][1];
  }

  /** Oscilação amortecida — o tremor da torre a cada caixa que encaixa. */
  function tremor(t, impacto, amp, hz = 4.2, queda = 7) {
    const d = (t - impacto) / 1000;
    if (d < 0 || d > 1.2) return 0;
    return amp * Math.exp(-queda * d) * Math.sin(2 * Math.PI * hz * d);
  }

  function escurecer(hex, f) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map(v => Math.round(v * (1 - f)).toString(16).padStart(2, "0"));
    return "#" + c.join("");
  }

  function palcoAnimado() {
    const LW = 560, LH = 262, CHAO = 214;

    const cv = h("canvas", {
      role: "img",
      "aria-label": "Animação: um mascote equilibra uma torre de caixas coloridas na cabeça, " +
                    "quase derruba tudo, salva no último instante e comemora.",
      estilo: { display: "block", width: "100%", height: "auto", aspectRatio: "560 / 262" }
    });
    const ctx = cv.getContext("2d");

    const raiz = getComputedStyle(document.documentElement);
    const tok = (n, alt) => (raiz.getPropertyValue(n).trim() || alt);
    const C = {
      acento: tok("--accent", "#FF5A1F"),
      linha:  tok("--line", "#1E2A38"),
      suave:  tok("--line-soft", "#16202C"),
      fraco:  tok("--faint", "#57677A"),
      txt:    tok("--txt", "#E7EDF4")
    };
    C.sombra = escurecer(C.acento, .38);
    C.pe = escurecer(C.acento, .52);

    /* as caixas são as diretorias (sem laranja: essa cor é do mascote) */
    const CAIXAS = [
      { cor: U.corVisivel("#06B6D4"), larg: 56 },
      { cor: U.corVisivel("#2563EB"), larg: 47 },
      { cor: U.corVisivel("#F2C200"), larg: 53 },
      { cor: U.corVisivel("#0FA34F"), larg: 42 },
      { cor: U.corVisivel("#5B21B6"), larg: 50 }
    ];
    const CX_H = 19, CX_GAP = 3;
    const QUEDA = CAIXAS.map((_, i) => 1000 + i * 205);   // quando cada caixa cai

    /* partículas: poeira da freada, confete e brilho do salvamento */
    const pos = Array.from({ length: 46 }, () => ({ vida: 0 }));
    let soltas = { poeira: -1, confete: -1, brilho: -1 };

    function soltar(tipo, n, gerar) {
      let feitas = 0;
      for (let i = 0; i < pos.length && feitas < n; i++) {
        if (pos[i].vida > 0) continue;
        Object.assign(pos[i], gerar(feitas), { tipo });
        feitas++;
      }
    }

    /* --- desenho ---------------------------------------------------------- */

    function retanguloArredondado(x, y, w, hh, r) {
      const k = Math.min(r, Math.abs(w) / 2, Math.abs(hh) / 2);
      ctx.beginPath();
      ctx.moveTo(x + k, y);
      ctx.arcTo(x + w, y, x + w, y + hh, k);
      ctx.arcTo(x + w, y + hh, x, y + hh, k);
      ctx.arcTo(x, y + hh, x, y, k);
      ctx.arcTo(x, y, x + w, y, k);
      ctx.closePath();
    }

    function desenharCena(t, dt) {
      ctx.clearRect(0, 0, LW, LH);

      /* ---------- parâmetros animados ---------- */
      const x = kf(t, [
        [0, -110], [900, 284, saiCubica], [5250, 284],
        [5450, 248, saiCubica], [6000, 730, entraCubica]      // recua e dispara
      ]);

      const pulo = kf(t, [
        [4340, 0], [4380, -4, saiCubica], [4560, 23, saiCubica],
        [4820, 0, entraQuad], [4900, 0]
      ]);

      // achatamento do corpo: freada, cada caixa que encaixa, agachada e pulo
      let apy = kf(t, [
        [0, 1], [860, 1], [925, .80, saiCubica], [1060, 1.07, saiCubica], [1190, 1, saiCubica],
        [4300, 1], [4380, .76, saiCubica], [4520, 1.15, saiCubica], [4780, 1, saiCubica],
        [4830, .84, saiCubica], [4960, 1.04, saiCubica], [5080, 1, saiCubica]
      ]);
      QUEDA.forEach(q => { apy += tremor(t, q + 240, -.05, 5.5, 9); });
      const apx = 1 + (1 - apy) * .72;

      const inclina = kf(t, [
        [0, .21], [700, .21], [890, -.30, saiCubica], [1080, .06, saiCubica], [1220, 0, saiCubica],
        [2450, 0], [2900, -.10, suave], [3650, -.32, suave],
        [3880, .16, saiCostas], [4200, 0, saiElastica],
        [5250, 0], [5460, .24, saiCubica]
      ]);

      let tomba = kf(t, [
        [2380, 0], [2470, -.045, saiCubica],   // antecipação
        [3350, .26, suave], [3650, .37, suave],
        [3830, -.13, saiCubica], [4200, 0, saiElastica]
      ]);
      QUEDA.forEach(q => { tomba += tremor(t, q + 230, .055); });
      if (t > 5250) tomba += Math.sin((t - 5250) / 48) * .05;      // balança na corrida

      const panico = kf(t, [[2700, 0], [3120, 1, saiCubica], [3660, 1], [3880, 0, saiCubica]]);
      const feliz  = kf(t, [[4160, 0], [4320, 1, saiCubica], [5320, 1], [5440, 0]]);
      const corre  = (t < 820 || t > 5300) ? 1 : 0;
      const passo  = t * 0.035;

      /* ---------- disparos ---------- */
      const volta = Math.floor(t / DUR_CICLO);
      if (t > 860 && t < 1000 && soltas.poeira !== volta) {
        soltas.poeira = volta;
        soltar("poeira", 7, i => ({
          vida: 1, dur: .55, x: x - 14 - i * 5, y: CHAO - 2,
          vx: -40 - Math.random() * 70, vy: -12 - Math.random() * 26, r: 3 + Math.random() * 4
        }));
      }
      if (t > 3860 && t < 3980 && soltas.brilho !== volta) {
        soltas.brilho = volta;
        soltar("brilho", 8, () => ({
          vida: 1, dur: .5, x: x + (Math.random() - .5) * 70, y: 70 + Math.random() * 40,
          vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 40, r: 2 + Math.random() * 2
        }));
      }
      if (t > 4520 && t < 4620 && soltas.confete !== volta) {
        soltas.confete = volta;
        soltar("confete", 18, i => ({
          vida: 1, dur: 1.5, x: x + (Math.random() - .5) * 40, y: CHAO - 170 - Math.random() * 30,
          vx: (Math.random() - .5) * 230, vy: -90 - Math.random() * 130,
          r: 2.4 + Math.random() * 2, giro: Math.random() * 6,
          cor: [C.acento, ...CAIXAS.map(c => c.cor)][i % 6]
        }));
      }

      /* ---------- chão ---------- */
      const g = ctx.createLinearGradient(40, 0, LW - 40, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(.5, C.linha);
      g.addColorStop(1, "transparent");
      ctx.strokeStyle = g; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, CHAO + .5); ctx.lineTo(LW - 40, CHAO + .5); ctx.stroke();

      /* sombra */
      const alturaVoo = pulo / 23;
      ctx.fillStyle = C.suave;
      ctx.globalAlpha = .9 - alturaVoo * .45;
      ctx.beginPath();
      ctx.ellipse(x, CHAO + 3, 35 * apx * (1 - alturaVoo * .3), 6 * (1 - alturaVoo * .3), 0, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;

      /* ---------- traços de velocidade ---------- */
      if (corre) {
        ctx.strokeStyle = C.acento; ctx.lineWidth = 2; ctx.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          const o = 34 + i * 16, dir = t > 5300 ? 1 : 1;
          ctx.globalAlpha = .1 + .12 * ((Math.sin(t / 60 + i) + 1) / 2);
          ctx.beginPath();
          ctx.moveTo(x - o * dir - 26, CHAO - 42 - i * 20);
          ctx.lineTo(x - o * dir, CHAO - 42 - i * 20);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      /* ---------- corpo ---------- */
      const baseY = CHAO - pulo;
      const pernaH = 18, corpoW = 63, corpoH = 53;

      // pernas
      const bal = corre ? Math.sin(passo) * 7 : Math.sin(t / 300) * 1.2;
      const balPanico = panico ? Math.sin(t / 34) * 5 * panico : 0;
      ctx.strokeStyle = C.pe; ctx.lineWidth = 7; ctx.lineCap = "round";
      [-13, 13].forEach((dx, i) => {
        const o = (i ? -1 : 1) * (bal + balPanico);
        ctx.beginPath();
        ctx.moveTo(x + dx, baseY - pernaH - 2);
        ctx.lineTo(x + dx + o, baseY - (pulo > 2 ? 4 : 0));
        ctx.stroke();
      });

      ctx.save();
      ctx.translate(x, baseY - pernaH);
      ctx.rotate(inclina * .35);
      ctx.scale(apx, apy);

      // tronco
      ctx.fillStyle = C.acento;
      retanguloArredondado(-corpoW / 2, -corpoH, corpoW, corpoH, 17);
      ctx.fill();
      // sombreado inferior, dá volume
      ctx.fillStyle = C.sombra; ctx.globalAlpha = .28;
      retanguloArredondado(-corpoW / 2, -corpoH * .38, corpoW, corpoH * .38, 15);
      ctx.fill();
      ctx.globalAlpha = 1;

      // olhos
      const ax = 14, ay = -corpoH + 21;
      const arregala = 1 + panico * .45;
      [-1, 1].forEach(s => {
        if (feliz > .5) {
          ctx.strokeStyle = "#11171E"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(s * ax, ay + 2, 7.4, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.ellipse(s * ax, ay, 8.8 * arregala, 9.5 * arregala, 0, 0, 7);
          ctx.fill();
          const jx = panico * Math.sin(t / 32) * 1.6;
          ctx.fillStyle = "#11171E";
          ctx.beginPath();
          ctx.ellipse(s * ax + jx + (corre ? 1.6 : 0), ay + panico * -1.2,
                      4.2 * (1 - panico * .42), 4.5 * (1 - panico * .42), 0, 0, 7);
          ctx.fill();
        }
      });

      // boca
      ctx.strokeStyle = "#11171E"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
      const by = ay + 17;
      if (panico > .35) {
        ctx.fillStyle = "#11171E";
        ctx.beginPath();
        ctx.ellipse(0, by + 1, 4.2 * panico, 5.6 * panico, 0, 0, 7);
        ctx.fill();
      } else if (feliz > .35) {
        ctx.beginPath();
        ctx.arc(0, by - 4, 8 * feliz, .15 * Math.PI, .85 * Math.PI);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, by - 2, 5.2, .2 * Math.PI, .8 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();

      /* ---------- torre ---------- */
      const topoCabeca = baseY - pernaH - corpoH * apy;
      ctx.save();
      ctx.translate(x, topoCabeca);
      ctx.rotate(tomba);

      // braços segurando a base da torre
      ctx.strokeStyle = C.pe; ctx.lineWidth = 5.5; ctx.lineCap = "round";
      const quantas = QUEDA.filter(q => t >= q + 200).length;
      if (quantas) {
        [-1, 1].forEach(s => {
          ctx.beginPath();
          ctx.moveTo(s * 28, 19);
          ctx.quadraticCurveTo(s * 36, 3, s * 21, -5);
          ctx.stroke();
        });
      }

      let alturaAcum = 0;
      CAIXAS.forEach((cx, i) => {
        const t0 = QUEDA[i], t1 = t0 + 250;
        const p = sat01((t - t0) / (t1 - t0));
        if (p <= 0) { alturaAcum += CX_H + CX_GAP; return; }

        const yFinal = -(i + 1) * (CX_H + CX_GAP);
        const yy = yFinal - (1 - entraQuad(p)) * 200;
        const impacto = tremor(t, t1, .18, 6, 11);
        const sh = 1 + (p >= 1 ? impacto : 0);
        const sw = 1 - (p >= 1 ? impacto * .8 : 0);
        const gi = (i % 2 ? 1 : -1) * Math.sin(t / 420 + i) * 1.2;

        ctx.save();
        ctx.translate(gi, yy + CX_H / 2);
        ctx.scale(sw, sh);
        ctx.fillStyle = cx.cor;
        retanguloArredondado(-cx.larg / 2, -CX_H / 2, cx.larg, CX_H, 4.5);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.22)";
        retanguloArredondado(-cx.larg / 2 + 4, -CX_H / 2 + 3.2, cx.larg - 8, 2.6, 1.3);
        ctx.fill();
        ctx.restore();
        alturaAcum += CX_H + CX_GAP;
      });
      ctx.restore();

      /* gota de suor no auge do pânico */
      if (panico > .5) {
        const gp = sat01((t - 3180) / 620);
        ctx.fillStyle = "#8FD3F4";
        ctx.globalAlpha = (1 - gp) * panico;
        const gx = x + 30 + gp * 26, gy = topoCabeca + 26 - gp * 8 + gp * gp * 46;
        ctx.beginPath();
        ctx.ellipse(gx, gy, 3, 4.2, .5, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* ---------- partículas ---------- */
      pos.forEach(pt => {
        if (pt.vida <= 0) return;
        pt.vida -= dt / pt.dur;
        if (pt.vida <= 0) return;
        pt.vx *= 0.99;
        pt.vy += (pt.tipo === "poeira" ? 40 : pt.tipo === "brilho" ? 0 : 480) * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        ctx.globalAlpha = Math.min(1, pt.vida * 1.3);
        if (pt.tipo === "poeira") {
          ctx.fillStyle = C.fraco;
          ctx.globalAlpha *= .4;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * (2 - pt.vida), 0, 7); ctx.fill();
        } else if (pt.tipo === "brilho") {
          ctx.strokeStyle = C.acento; ctx.lineWidth = 1.6; ctx.lineCap = "round";
          const s = pt.r * 2.2 * pt.vida;
          ctx.beginPath();
          ctx.moveTo(pt.x - s, pt.y); ctx.lineTo(pt.x + s, pt.y);
          ctx.moveTo(pt.x, pt.y - s); ctx.lineTo(pt.x, pt.y + s);
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(pt.giro + (1 - pt.vida) * 9);
          ctx.fillStyle = pt.cor;
          ctx.fillRect(-pt.r, -pt.r * .6, pt.r * 2, pt.r * 1.2);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      });
    }

    /* --- laço -------------------------------------------------------------- */

    function ajustar() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const larguraCss = cv.clientWidth || LW;
      const alvoW = Math.round(larguraCss * dpr);
      const alvoH = Math.round(larguraCss * (LH / LW) * dpr);
      if (cv.width !== alvoW || cv.height !== alvoH) { cv.width = alvoW; cv.height = alvoH; }
      const k = alvoW / LW;
      ctx.setTransform(k, 0, 0, k, 0, 0);
    }

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) {
      requestAnimationFrame(() => { ajustar(); desenharCena(4650, 0); });
      return cv;
    }

    let anterior = performance.now();
    const origem = performance.now() - 300;     // já começa com ele entrando
    function quadro(agora) {
      if (!cv.isConnected) return;              // trocou de tela: encerra
      const dt = Math.min((agora - anterior) / 1000, .05);
      anterior = agora;
      ajustar();
      desenharCena((agora - origem) % DUR_CICLO, dt);
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    return cv;
  }

  function vInicio() {
    const projetos = db.dados.projetos;
    const internos = projetos.filter(p => p.tipo === "Projeto Interno");
    const etapas = db.dados.etapas;
    const feitas = etapas.filter(e => e.concluida).length;

    const numero = (valor, rotulo) => h("div.inicio-num",
      h("b", String(valor)), h("span.rotulo", rotulo));

    return h("div.view",
      h("section.inicio",
        h("span.rotulo", `${(window.CI_CONFIG || {}).EMPRESA || "Adecon"} · ciclo ${(window.CI_CONFIG || {}).ANO_CICLO || new Date().getFullYear()}`),
        h("h1", "Uma empresa que ", h("em", "se planeja em voz alta")),
        h("p.chamada",
          "Os projetos internos das oito diretorias em um lugar só: cronograma por semana, ",
          "etapas com dono e prazo, comentários onde a decisão acontece e os indicadores ",
          "se atualizando conforme a execução anda."),

        h("div.palco",
          palcoAnimado(),
          h("div.palco-rodape",
            h("span.rotulo", "cinco projetos, um gerente de inovação"),
            h("span.rotulo", { estilo: { color: "var(--accent)" } }, "equilíbrio: instável"))
        ),

        h("div.inicio-acoes",
          h("button.btn.btn-primario", {
            type: "button", onclick: () => (location.hash = "#/painel")
          }, ic("painel"), "Abrir o painel"),
          h("button.btn", {
            type: "button", onclick: () => (location.hash = "#/cronograma")
          }, ic("cronograma"), "Ver o cronograma"),
          h("button.btn.btn-fantasma", {
            type: "button", onclick: () => modalProjeto()
          }, ic("mais"), "Criar um projeto")
        ),

        h("div.inicio-nums",
          numero(internos.length, "projetos internos"),
          numero(db.dados.diretorias.length, "diretorias"),
          numero(etapas.length, "etapas mapeadas"),
          numero(etapas.length ? Math.round((feitas / etapas.length) * 100) + "%" : "0%", "já concluído")
        )
      )
    );
  }

  return {
    vInicio, vPainel, vCronograma, vProjetos, vProjeto, vDiretorias, vImplementacao, vIndicadores, vConfig,
    modalProjeto, modalEtapa, gavetaEtapa, buscaGlobal
  };
})();
