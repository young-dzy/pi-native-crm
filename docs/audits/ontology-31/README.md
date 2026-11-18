# Auditoria de semântica CRM v1 — #31

Base examinada: `1c9f78528571bc28ee1e009378d1bf6361c21a0b` (origin/main em 2026-11-14). Isto é um inventário revisável, não o contrato #32 nem certificação de regra comercial. `verified` = fato físico ou comportamento delimitado por evidência; `proposed` = interpretação/regra que ainda requer decisão humana; `unanswerable` = falta definição, dado ou acesso. A existência de coluna não prova completude, qualidade, permissão nem significado de negócio. [Campos físicos](fields-v1.md) lista cada campo e nulidade declarada; migrations/baseline e código abaixo são a autoridade, tipos gerados são fotografia auxiliar.

## Entidades e relações

| Conceito e estado | Origem e relações verificadas | Limites |
|---|---|---|
| Contact — verified | `contacts`, chave `id`, org `organization_id`; dados em `lib/database.types.ts` seção contacts. | Pessoa/cliente é interpretação proposed: contato pode ser prospect; identidade e dados livres são sensíveis. Mesclado `is_merged_into` e `is_anonymized` requerem tratamento explícito. |
| Opportunity/negócio — verified como mapeamento técnico | `crm_leads`; `contact_id` nullable FK para contacts, `pipeline_id` e `stage_id` obrigatórios; `value_cents`, `currency`, `closed_at`, `last_activity_at` nullable. `lib/database.types.ts` crm_leads; `supabase/baseline.sql` `crm_leads_contact_id_fkey` e demais FKs. | Contato 0:N negócios, negócio 0:1 contato. Uma pessoa não identifica um negócio. O sentido comercial de oportunidade é proposed; lead no runtime também pode significar contato (`lib/leads/agent-activity.ts`). |
| Conversation — verified | `conversations.contact_id` NOT NULL FK contacts; org e sessão obrigatórias; `is_group`, `group_chat_id` existem. `supabase/baseline.sql` `conversations_contact_id_fkey`; types conversations. | Contact 1:N conversations, condicionado à unicidade por sessão/tipo em constraints; não implica negócio. Grupo não deve ser tratado como conversa individual. |
| Activity — verified | `crm_lead_activities.lead_id` NOT NULL FK → lead (delete cascade); `contact_id` nullable FK → contact (delete set null), `performed_at`, `type`, `source_module`; types e baseline `crm_lead_activities_lead_id_fkey`. | Lead 1:N activities; contato direto não prova correspondência ao contato atual do lead. `evidence`, `payload`, `reason` podem conter dados sensíveis. |
| Task — verified | `crm_tasks`: `lead_id`, `contact_id`, `assigned_to`, `due_date` nullable; FK lead/contact delete set null. Migration `20260903143000_0210_tarefas_do_crm.sql`; `app/api/v1/tasks/route.ts`. | Tarefa avulsa é válida; prazo ausente não é atraso; não é compromisso de agenda. Tipos gerados não incluem esta tabela. |
| Message — verified | `messages.conversation_id` e `contact_id` NOT NULL; conversation FK cascade; types messages e baseline `messages_conversation_id_fkey`. | Conversation 1:N messages; texto, mídia e metadados são sensíveis. Message→opportunity direto unanswerable: caminho via contato multiplica negócios, não comprova atribuição. |
| Pipeline / Stage — verified | `crm_pipelines` 1:N `crm_stages` por `pipeline_id`; lead aponta a ambos. `is_archived`, `is_won`, `is_lost`, `expected_duration_hours`: types e `lib/leads/stage-operations.ts`. | Arquivamento não equivale a exclusão; conferir estágio pertence ao funil e org, não confiar só no ID. |
| Mission / Task — proposed como associação conceitual | `docs/architecture/mission-state.md`, `crm_tasks` migration 0210. | Mission/Harness não é sinônimo de tarefa de CRM; nenhuma FK entre eles foi aqui estabelecida. |

As FKs individuais do dump não são prova de igualdade de org dos dois extremos. Um adaptador precisa verificar escopo em cada nó e caminho, inclusive ao usar service role; não inferir autorização do mero sucesso de FK. Algumas relações têm validações adicionais em funções/triggers: sua existência e alcance devem ser medidos no banco, não deduzidos de uma FK simples. Um join contact→conversations→messages e contact→leads é N:N em resultado: agregados por negócio podem duplicar e atribuir mensagens indevidamente.

### Achado de integridade entre organizações — requisito para o adaptador de tarefa

No baseline pg15 aplicado duas vezes, um `authenticated` agent membro apenas da org A conseguiu inserir uma linha `crm_tasks` na A com `contact_id` existente na org B (1 linha retornada). A policy verifica a org da tarefa e a FK da migration 0210 referencia só `contacts(id)`. O comentário em `app/api/v1/tasks/route.ts` que associa erro 23503 a contato de outra org não foi confirmado nesse caminho de banco. A sonda usa dados sintéticos e não demonstra vazamento pelo REST nem todos os caminhos de escrita. O join sem checagem da org de ambos os lados seria inseguro. O catálogo #32 pode registrar a relação e esta limitação sem declará-la segura. No #33, o adaptador de leitura deve verificar organização e visibilidade em ambos os extremos, recusar vínculos inconsistentes e provar esses casos; correções necessárias no caminho de execução e seus testes podem ser tratadas nessa fase. Detalhes e reprodução em [recibo](verification.md).

## Termos e métricas

| Termo | Estado e evidência | Condição para responder |
|---|---|---|
| Follow-up válido | unanswerable como métrica geral. `lib/leads/activity-vocabulary.ts` e `activity-emitter.ts` registram tipos/evidência; nem toda activity é contato efetivo. | Definir canal, direção, entrega/resposta, ator, cancelamento e janela; não contar todo evento como follow-up. |
| Estagnação | proposed como sinônimo comercial; verified somente para buckets do radar existente. `lib/leads/risk-radar.ts` e `risk-seed.ts`: abertos, relógio `last_activity_at ?? created_at`, janela da etapa positiva ou 24 h, crítico 3×, proteção de agenda/follow-up. | Acordar se radar é a definição pretendida; distinguir silêncio de criação sem atividade, falha de leitura e proteção de agenda. Sem relógio seed omite e conta `semRelogio`, não inventa data. |
| Ganho | verified como estado técnico `status=won` no ciclo de `lib/leads/encerramento.ts` e etapa terminal `is_won`; não equivale automaticamente a receita recebida. | Acordar data e inclusão de reabertos/transferências. `closed_at` nullable; sem ela não atribuir a período. |
| Conversão do funil | unanswerable sem definição de coorte, origem/destino, período, movimentos/reentradas e denominador. | `crm_lead_activities` pode conter mudanças; confirmar completude histórica e como tratar transferências, perda e arquivamento. Não dividir ganhos atuais por todos os leads criados sem definir coorte. |
| Valor do negócio | verified como campo nullable `value_cents` e `currency` (`lib/schemas/leads.ts`, `app/api/v1/leads/_handler.ts`); não é faturamento. | Preservar nulo; agrupar por moeda; sem câmbio, data e fonte autorizados não somar moedas. Default aplicado na criação não prova moeda histórica ausente. |
| Alto valor | unanswerable; não há limiar comercial certificado nesta auditoria. | Solicitar valor/percentil, moeda, âmbito e período; configuração em settings é apenas hipótese a auditar em #32. |

Tempo: usar instantes UTC de origem, intervalo explícito [início, fim) e fuso de negócio explicitado para datas civis (proposed, precisa aceite); `expected_close_date` é data e não instante. `performed_at`, `created_at`, `closed_at` e `stage_changed_at` respondem perguntas diferentes. O sistema tem lógica de fuso em `tests/invariants/janela-no-fuso-da-organizacao.test.ts`; não extrapolar para todas as métricas. Sem timezone ou data requerida, pedir esclarecimento/abster. Reter filtros e versão em recibo. Excluir/contar arquivados, removidos, fundidos e anonimizados apenas conforme pergunta e política aprovada; não reconstituir PII apagada via cópias ou memória.

## Matriz de permissão e adaptações

| Superfície | Evidência e comportamento | Limite para planner |
|---|---|---|
| Sessão REST | `lib/auth/require-role.ts`: `getUser`, org ativa validada, role atual em `fn_user_role_in_org`, MFA; rotas podem ter requisitos específicos. | Não tratar role genérico como acesso a todas as linhas; propagação de identidade e RLS obrigatória. |
| Lead / Activity | `tests/invariants/gov-5c-lead-scope.test.ts`, `gov-5e-lead-children-scope.test.ts`: agent restringido por `visibility_mode` e owner; filhos herdam visibilidade do lead; viewer/manager/admin descritos como org-wide nesses testes. | Testar a política real de cada entidade; filtros do planner não ampliam escopo. |
| Conversation / Message | `tests/invariants/gov-5-visibility-scope.test.ts`, `gov-5b-inbox-scope-counts.test.ts`; handlers de conversations/messages. | Verificar acesso da conversa e do histórico no caminho real; não assumir a mesma visibilidade do lead. |
| Task | migration 0210: SELECT por membership ou platform admin; escrita policy agent+; `app/api/v1/tasks/route.ts` GET viewer, POST agent, org explícita. | Visibilidade org-wide da tarefa não autoriza expor lead/conversa oculta através dela; aplicar interseção dos escopos. |
| MCP | `lib/mcp/tools/{leads,contacts,conversations,pipelines}.ts`: leitura agent + `mcp:read`; escrita tem gates próprios. `lib/mcp/tools/messages.ts` envio agent + `mcp:write`. | Cada capability tem role/scope próprios; token não é usuário interativo. `tests/invariants/mcp-nao-alcanca-outro-tenant.test.ts` testa o caminho de leads. |
| Service role / worker | bypass RLS; `lib/leads/agent-activity.ts` filtra explicitamente org e contact; `lib/leads/encerramento.ts` filtra org. | Nunca expor executor SQL arbitrário. Reautorizar identidade e escopo do recurso antes de cada leitura; filtros org e visibilidade no serviço não são intercambiáveis. |
| Privacidade | `app/api/v1/lgpd/anonymize/route.ts`, migration 0210 trigger redige título/descrição das tarefas vinculadas, `lib/lgpd/export-collector.ts`. | Minimização por campo, consentimento e retenção aplicáveis; recusa se não puder provar visibilidade. Não duplicar PII no catálogo ou em evidência desnecessária. |

Serviços existentes: `lib/mcp/tools/leads.ts` chama os mesmos handlers `app/api/v1/leads/_handler.ts`; contacts e conversations seguem padrão semelhante. `lib/mcp/tools/operacao.ts` e `app/api/v1/pipelines/[id]/stages/route.ts` reutilizam `lib/leads/stage-operations.ts`; operações em `lib/operacao/` têm autorização própria. Encerramento usa `lib/leads/encerramento.ts`; atividade de agente usa `lib/leads/agent-activity.ts` e `resolveActiveLeadForContact`. Não há garantia de que todas as rotas REST e MCP já compartilhem todo código: reutilizar a autoridade específica, não duplicar SQL ou sugerir que um catálogo de capabilities autorize execução.

## Perguntas representativas (caminhos previstos, não consultas já implementadas)

Todas exigem org e autorização em cada nó; datas, moeda e definições indicadas são pré-condições, não valores inventados.

| # | Pergunta | Caminho / condição | Estado |
|---|---|---|---|
| 1 | Quais negócios estão abertos? | lead.status=open | verified campo; proposta de consulta |
| 2 | Quais negócios de um contato? | contact.id ← lead.contact_id, retornar todos | verified relação |
| 3 | Quais não têm contato? | lead.contact_id IS NULL | verified |
| 4 | Qual etapa de um negócio? | lead.stage_id → stage.id | verified |
| 5 | Quais etapas de um funil? | pipeline.id ← stage.pipeline_id; definir arquivo | verified |
| 6 | Quem é dono do negócio? | lead.owner_kind / owner_user_id / owner_agent_id | verified campos; identidade/visibilidade específicas |
| 7 | Quais atividades do negócio? | lead.id ← activity.lead_id; visibilidade pai | verified |
| 8 | Quais tarefas deste negócio? | lead.id ← task.lead_id; interseção de permissões | verified relação |
| 9 | Quais tarefas sem prazo? | task.due_date IS NULL | verified |
| 10 | Quais tarefas abertas vencem no intervalo? | task.status pending/in_progress + due_date; fuso e intervalo | verified campos, período proposed |
| 11 | Quais conversas do contato? | contact.id ← conversation.contact_id; distinguir grupo | verified |
| 12 | Qual histórico da conversa? | conversation.id ← messages.conversation_id; scope conversa | verified |
| 13 | Negócios ganhos no período? | lead.status + closed_at; explicitar coorte | proposed |
| 14 | Valores abertos por moeda? | lead.status + value_cents + currency; separar nulos | proposed agregação |
| 15 | Negócios no radar? | serviço de risco existente + etapa, agenda e follow-up | verified regra delimitada; exigir autorização |
| 16 | Quanto tempo na etapa? | lead.stage_changed_at → stage; relógio e data requeridos | proposed |
| 17 | Última atividade do negócio? | lead.id ← activity.lead_id, ordenar performed_at | proposed: nem todo evento é follow-up |
| 18 | Qual próxima ação do contato? | lead_state.contact_id; `lib/leads/next-action.ts` roteia para lead ativo | verified comportamento limitado; não distribuir para todos |
| 19 | Taxa de conversão? | atividades de transição + coorte e regras | unanswerable sem definição/completude |
| 20 | Qual negócio de alto valor parado? | radar + valor/moeda + limiar aprovado | unanswerable sem limiar e critérios |

## Casos de recusa / ambiguidade para #32–#33

1. Contato com dois negócios abertos: listar ambos; ação singular requer objeto explícito ou política de roteamento aplicável. O resolver existente prefere pipeline padrão, depois atividade recente; empate retorna `ambiguous_open_leads`, não escolhe arbitrariamente.
2. Nenhum negócio aberto: `no_open_lead`; `emitAgentActivityForContact` registra `agent.activity_unrouted`. Não criar negócio para fazer join.
3. Negócio sem contato: retornar negócio; caminhos de conversa e follow-up por contato são indisponíveis, não um contato inventado.
4. Candidatos de duas orgs no resolver: lança erro; uma lista de uma única org errada não é detectada por ele. Chamador deve filtrar org confiável.
5. Outro tenant: negar ou ocultar recurso; não distinguir existência em resposta não autorizada.
6. Valor NULL não é zero; recusar classificação de alto valor quando indispensável.
7. Moeda NULL ou mistura de moedas: não somar; agrupar ou pedir taxa e data de conversão verificadas.
8. Falta `closed_at` para pergunta por data de ganho: não atribuir data de criação.
9. `last_activity_at` NULL: distinguir ausência de evento de data de criação; fallback do radar é regra específica, não prova de follow-up.
10. Mensagem associada ao contato com múltiplos negócios: não atribuir a todos; vínculo direto não foi comprovado.
11. Tarefa sem prazo não está atrasada; tarefa sem lead não é tarefa de negócio.
12. Estágio/funil arquivado, contato mesclado ou anonimizado: explicitar política de inclusão e respeitar LGPD, não ressuscitar dados.
13. Acesso ao contato não autoriza revelar conversa/atividade de owner oculto; validar cada entidade.
14. Período sem fuso/limites ou conversão sem coorte: pedir definição, não produzir número definitivo.

## ADR-001 — camada semântica é interpretação, não autoridade

**Decisão proposta para revisão:** catálogo versionado declara conceitos, relações, origem, status e dependências; resolver e planner somente interpretam e planejam leitura em interfaces autorizadas. CRM/Postgres são fonte de fatos; memória confirmada SQL, Mem0 projeção/ranking e WeKnora conhecimento, conforme Epic #30. Pi Agent Core continua runtime; Model Gateway mantém orçamento/auditoria. Ações passam por serviços existentes, Harness/Mission e aprovações, com revalidação no momento da execução. Nenhuma credencial SQL adicional, escrita pelo catálogo, grafo independente ou LLM promovendo definições sem revisão.

Consequências: preservar versão do catálogo e evidências no recibo; `proposed` não vira resposta certificada; mudanças precisam diff/rollback/invalidação de cache. Autorização não é metadado semântico. Respostas parciais devem declarar dados e escopo ausentes. Após a revisão documental pelo coordenador, #32 pode avançar conforme o escopo já autorizado. Essa revisão não certifica automaticamente as definições comerciais ainda propostas ou sem resposta.

Diretórios sugeridos, não criados: `lib/ontology/` para schema/versionamento e catálogo revisado; `lib/ontology/resolver/` e `planner/` para interfaces somente leitura nas fases próprias; fixtures sintéticas e testes correspondentes; `docs/architecture/` para ADR aprovado. Na implementação, conferir baseline instalado, drift de tipos de `crm_tasks`, integridade de tenant dos vínculos e escopo de cada adaptador. Falta decisão de dono de negócio sobre métricas, fuso, valores, histórico e política de arquivo; estes itens continuam proposed/unanswerable.

## Verificação

Ver [recibo](verification.md). Nenhum dado de produção foi consultado. A auditoria não certifica qualidade dos dados de uma instalação nem conclui os gates de E2E, cold start de aplicação ou avaliação do Epic #30.
