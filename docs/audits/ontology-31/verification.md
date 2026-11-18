# Recibo de verificação — #31

Base `1c9f78528571bc28ee1e009378d1bf6361c21a0b`, worktree independente; Node 24.20.0, pnpm 9.15.9. `pnpm install --frozen-lockfile` exit 0. Docker `pgvector/pgvector:pg15`, digest `sha256:e0b617fffc06dd37323ee99873c7a8683f19f1dce34633670262b0113ce32638`. O runner `scripts/test-db.sh` aplica `supabase/baseline.sql` em instalação e reaplicação com `ON_ERROR_STOP=1`, com banco efêmero por arquivo.

| Comando | Resultado observado |
|---|---|
| `pnpm exec vitest run lib/leads/active-lead.test.ts lib/leads/next-action.test.ts` | exit 0; 1 arquivo, 16 testes (não existe arquivo `next-action.test.ts` no baseline; Vitest executou apenas active-lead). Empate, zero abertos, orgs misturadas e fallback de data cobertos pelo arquivo existente. |
| `pnpm test:db tests/invariants/gov-5c-lead-scope.test.ts tests/invariants/gov-5e-lead-children-scope.test.ts tests/invariants/mcp-nao-alcanca-outro-tenant.test.ts tests/invariants/rls-isolation.test.ts` | exit 0; baseline install/update OK; 4 arquivos, 101 testes. Uma mensagem `new row violates row-level security` é esperada por um teste de recusa; resultado final verde. Seed 1794631837494. |
| `pnpm test:db tests/invariants/ontology-audit-31.test.ts` | exit 0; baseline install/update OK; 1 arquivo, 3 testes, seed 1794631930392. Fixture sintética prova 2 negócios de um contato, negócio sem contato/valor/atividade e isolamento de tenant com controle positivo. Não testa planner inexistente. |
| `pnpm typecheck` | exit 0. |
| `pnpm lint` | exit 0; 0 erros, 477 avisos preexistentes na árvore. |
| Sonda temporária de vínculo de tarefa (abaixo) | exit 0; baseline install/update OK; 4/4 testes passaram, incluindo resultado inseguro medido; seed 1794631910926. Não foi mantida como teste que exigiria preservar o defeito. |

Logs brutos locais: `/private/tmp/ontology-31-unit.log`, `/private/tmp/ontology-31-db.log`, `/private/tmp/ontology-31-cases.log`, `/private/tmp/ontology-31-cases-final.log`, `/private/tmp/ontology-31-typecheck.log`, `/private/tmp/ontology-31-lint.log`. Estes caminhos são temporários; este recibo conserva comando, resultado e reprodução sem PII. A CI automática está pausada em `.github/workflows/ci.yml`; push não significa CI verde. Não se verificou branch protection (API retornou 403 ao coordenador).

## Sonda de integridade de tarefa

No harness `tests/invariants/gov-helpers.ts`, `seedGov()` cria org A, usuário `GOV_AGENT_A` com role agent e membership em A. Inseriu-se org B e um contato sintético B como postgres; a sessão abaixo usou `sql()` com `set role authenticated`, sem membership em B:

```sql
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"<GOV_AGENT_A>"}', false);
with t as (
  insert into public.crm_tasks (organization_id, title, contact_id)
  values ('<ORG_A>', 'Sonda sintética', '<CONTACT_B>') returning 1
) select count(*) from t;
-- observado: 1
```

A consulta de controle de RLS de leads em B com agente A retornou 0 e a leitura de um lead A retornou 1 no teste permanente. Estas observações tratam caminhos diferentes: isolamento de linhas não prova integridade de todos os relacionamentos. A sonda de tarefa não chamou o handler HTTP, não provou leitura de PII e não examinou todos os vínculos. Não repetir com dados reais. A recusa exigida pelo futuro planner é requisito proposto, não comportamento já implementado.

Sem mudança de produto, schema, UI, deploy ou dependências versionadas nesta entrega. Não foram executados E2E de navegador, suíte completa de invariantes, build nem o benchmark do Epic; instalação/reaplicação do baseline no harness não prova o fluxo inteiro de self-host. Sem dados de produção, não se pode certificar preenchimento, qualidade histórica ou definição de negócios. Após a revisão documental pelo coordenador, #32 pode prosseguir. No #33, o adaptador deve validar organização e visibilidade dos dois extremos e recusar vínculos inconsistentes; a correção necessária e seu reteste devem acompanhar a exposição desse caminho. As definições comerciais sem evidência continuam `proposed` ou `unanswerable`.
