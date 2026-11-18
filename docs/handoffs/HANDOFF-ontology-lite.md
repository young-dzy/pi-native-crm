# CRM Ontology Lite 改造交接

更新于 2026-11-16。面向接手实现、验收和合并的开发者或 Codex 会话。

本次已交付语义层、受限查询、Pi/MCP 集成、Workbench 证据、Mission 语义契约及评估工具。事件序号竞争和 PostgreSQL 17 角色兼容修复已整合并推送。**最终组合版本的完整浏览器审批／恢复链路仍待验收，Epic 尚未完全闭环。**

## 交付位置与版本

| 项目               | 当前记录                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 仓库               | `helsome/AiNativeCrm`                                                                                            |
| PR                 | [#38 — CRM 语义层与 Mission 契约](https://github.com/helsome/AiNativeCrm/pull/38)，2026-11-16 核对为 OPEN、Draft |
| 分支               | `feat/ontology-architecture-30`                                                                                  |
| 工作目录           | `/Users/helson/code/AiNativeCrm-ontology`                                                                        |
| 改造前基线         | `1c9f78528571bc28ee1e009378d1bf6361c21a0b`                                                                       |
| 本交接所述代码快照 | `c9fc17d6f019aa727c878057fdb8daa44548123f`                                                                       |
| 最终产品修复提交   | `30e54a256517d1f408757b971923c351d803b8c8`                                                                       |

本文件以以上代码快照为依据，后续文档提交会使分支 HEAD 前进。交付范围位于 PR 分支，合并和生产部署仍待执行。

## 各 Issue 的交付范围

| Issue                | 已实现                                                         | 交接时的边界                                         |
| -------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| #30 Epic             | 从术语、查询、证据到现有动作提案的主链路                       | 最终组合版本浏览器验收及 Epic 收尾待完成             |
| #31 数据与权限审计   | 实体、关系、来源、角色、业务歧义及代表性问题清单               | 审计中的业务解释需按组织定义确认                     |
| #32 版本化契约       | Zod/TS 契约、不可变快照、摘要、差异与版本解析                  | 商业指标的认证需要真实授权定义及审阅记录             |
| #33 安全查询         | 许可模板、受限数据库角色、可信身份和范围、RLS、取消与限额      | 查询能力限定于当前已实现模板                         |
| #34 Pi/MCP 与证据 UI | 工具注册、内置 Agent 同步、同 Run 事件、SSE 和刷新回放         | 四个语义浏览器场景已验证，最终修复后的组合链路待复验 |
| #35 Mission 契约     | 动作／验收说明、目标检查、转人工归属修复及正负控制             | 最终浏览器提案审批与 Worker 恢复链路待复验           |
| #36 基准与治理       | 44 题冻结集、独立 SQL oracle、运行／评分脚本、负控制、首轮结果 | 首轮含执行故障，修复后的模型质量收益尚未确认         |

## 改造后的运行路径

1. Workbench 或已认证 MCP 请求进入现有 Pi runtime，Model Gateway 负责模型配置、用量、预算和审计。
2. Pi 可调用原 CRM 工具，也可通过 Ontology 工具检索概念、判断可回答性和生成许可查询计划。
3. 语义执行器重新核对当前身份、组织、权限、Agent 版本和读取范围，然后在只读事务中切换到 `ontology_reader` 查询 SQL。
4. 查询返回最小化数据和版本化回执。Workbench 将白名单语义元数据写入同一 Run 的事件，供 SSE 和刷新后回放。
5. 动作描述为计划提供前置条件。实际变更继续交给现有 CRM service、Harness、Mission、人工审批及 Worker 执行路径。

CRM 业务表和已确认客户记忆的事实真源为 SQL。Mem0 承担投影／排序，WeKnora 提供知识来源。客户记忆 L0–L4 的信任边界继续适用。部署依赖保持现有 Pi 与 PostgreSQL 体系，NVIDIA 对照属于可选范围。

### 五个语义工具

| 工具                        | 职责                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `ontology_search_terms`     | 在已发布概念目录中检索候选术语与状态                          |
| `ontology_check_answerable` | 判断问题是否匹配已审阅查询，并列出缺失定义                    |
| `ontology_query`            | 执行许可查询，返回 `full`、`partial` 或 `unanswerable` 及回执 |
| `ontology_describe_action`  | 描述已有能力、作用域、角色、风险、权威服务与前置条件          |
| `ontology_describe_outcome` | 读取当前可信 Run 绑定的 Mission 验收合同并说明证据要求        |

工具输入由 Zod 校验。身份、组织、运行版本和权限范围由服务器提供。动作描述中的 `grantsExecution` 为 `false`。未映射权威服务的能力返回部分信息。

### 查询与范围的实际语义

- 当前自然语言模板支持“开放商机”和“无到期日任务”的完整受审阅问题。额外条件需要匹配实现能力，否则进入澄清流程。
- 显式活动缺口查询接受金额、币种、UTC 起止和许可活动类型，结果始终为 `partial`，保留口径及历史完整性的限制。
- Workbench 未选择漏斗时，读取组织内当前身份可见的记录。选择漏斗时，以已持久化的可信范围进一步限制。
- Workbench 的 `pipeline_ids` 写入配置与实际读取范围分别处理。显式空读取范围不会授予记录访问。
- 联系人、单个商机或会话范围无法由当前聚合模板表达时，工具返回无法回答。其他 runtime 路径遵守既有版本与漏斗范围校验。
- 无联系人商机和独立任务是合法数据。任务关联到其他租户或不可见商机时，查询省略无法证明可见的关联行，并标记部分结果。
- 查询最多返回 100 行，使用只读事务、列级 SELECT、RLS、查询超时及取消处理。数据缺口、截断和实际范围进入回执。

### Workbench 与 Mission 接手要点

内置 Agent 的默认工具随正常同步更新，Workbench 可使用其既有 draft 入口。用户定制通过“复制并定制”建立自己的配置并发布版本。

“语义依据”位于 **运行详情** 抽屉中。首次运行和刷新后的浏览器验收都需要先打开抽屉。语义事件保存版本、摘要、范围、来源、关系、条件和部分结果状态，原始问题及查询行数据不复制到语义事件中。

Mission 规划核对显式目标，覆盖 `lead_id` 和标签工具的 `target_kind`／`target_id`。多商机场景需要明确目标。Mission 转人工在执行时重新检查商机与会话联系人关系。普通联系人转人工在多个开放商机时保留转交，但活动不猜选某个商机。

现有验收合同支持商机状态，以及已核实发送后的客户入站。渠道接受、客户回复、明确确认和业务目标完成各有自己的证据条件。自由文本商业目标仍需核实，普通后续入站无法直接证明客户同意报价。

## 关键文件导航

| 领域             | 入口                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 审计与初始设计   | [#31 审计](../audits/ontology-31/README.md)、[架构模型](../architecture/ontology-lite.architecture.json)                                                                                                                                        |
| 目录与版本       | [contract.ts](../../lib/ontology/contract.ts)、[catalog-v1.ts](../../lib/ontology/catalog-v1.ts)、[versions.ts](../../lib/ontology/versions.ts)、[1.0.0 快照](../audits/ontology-32/snapshot-v1.json)                                           |
| 规划与查询       | [query-plan.ts](../../lib/ontology/query-plan.ts)、[read-plan-internal.ts](../../lib/ontology/read-plan-internal.ts)、`execute-*-read-plan.ts`                                                                                                  |
| MCP 工具         | [ontology.ts](../../lib/mcp/tools/ontology.ts)、[工具目录](../../lib/mcp/tools/catalogo/ontology.ts)                                                                                                                                            |
| Pi 首次／恢复    | [workbench-start-job.ts](../../lib/ai/agents/workbench-start-job.ts)、[run-resumed-workbench-turn.ts](../../lib/ai/agents/run-resumed-workbench-turn.ts)                                                                                        |
| 证据与事件       | [workbench-ontology-observation.ts](../../lib/ai/agents/workbench-ontology-observation.ts)、[workbench-events.ts](../../lib/ai/agents/workbench-events.ts)、[OntologyEvidence.tsx](../../app/app/ai/workbench/_components/OntologyEvidence.tsx) |
| Mission 与转人工 | [mission-semantics.ts](../../lib/ontology/mission-semantics.ts)、[handoff.ts](../../lib/mcp/tools/handoff.ts)、[Mission 架构](../architecture/mission-state.md)                                                                                 |
| 评估和复现       | [#36 协议](../audits/ontology-36/README.md)、[最终验证记录](../audits/ontology-36/verification.md)、[首轮结果](../audits/ontology-36/results-b63/README.md)                                                                                     |

`docs/audits/ontology-33/README.md` 和 `ontology-34/README.md` 保留了阶段性描述。范围、角色引导及验收状态以当前代码和 #36 最终验证记录为准。

## Schema 与安装交接

| 迁移                                               | 作用                                                            |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `20261114100000_0412_ontology_read_role.sql`       | 创建受限 `ontology_reader`，授予必要列与函数读取权限            |
| `20261114120000_0413_workbench_atomic_events.sql`  | 新增 `fn_append_workbench_event`，锁定 Run 行后原子分配事件序号 |
| `20261114130000_0414_ontology_role_set_compat.sql` | 区分 PG15 membership 与 PG16+ SET 能力，处理角色引导和幂等重放  |

迁移已同步到 `supabase/baseline.sql` 和 `supabase/migrations/MANIFEST.md`。新增 RPC 签名已通过 Supabase CLI 生成后纳入 `lib/database.types.ts`。已应用迁移的后续修正继续使用新迁移。

新安装使用仓库现有 baseline 流程。`pnpm db:migrate` 用 `SUPABASE_DB_ADMIN_URL` 执行 schema 操作，该变量缺省时回退到 `SUPABASE_DB_URL`，随后在真实应用连接上检查角色可用性。安装器和更新器也会核对实际应用连接，并在需要时由管理连接授予普通成员资格。相关入口为 [db-migrate.sh](../../scripts/db-migrate.sh)、[安装公共函数](../../hostgator-setup-kit/_common.sh) 和 [角色检查 SQL](../../supabase/ontology-role-check.sql)。

PG17 的 `MEMBER=true` 可能仍为 `SET=false`。已有 SET 能力时跳过冗余 GRANT，否则执行者需要正确的 ADMIN OPTION 或现有管理连接完成授权。新角色创建者的自动 ADMIN 成员关系也要经过实际 SET 检查。

事件 RPC 仅向 `service_role` 开放，核对 Run 与组织，使用与现有取消和审批事务一致的 Run 行锁。它修复并发工具观察争抢事件序号的问题，事件 payload 仍由调用方白名单脱敏。

## 验证证据与剩余缺口

以下为 2026-11-14 已保存的执行证据，2026-11-16 本次交接仅核对版本和文档。

| 范围            | 已有证据                                                         | 解释边界                                                                       |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 候选 `b63a448f` | typecheck、lint、6 GiB 生产 build 通过                           | lint 有 477 条警告，早于最终组合修复                                           |
| 候选 PG15       | 全量 DB 及带数据升级通过                                         | 最终事件／角色修复另有定向证据                                                 |
| PG17 角色修复   | 独立工作树 PG15、PG17 定向验证通过                               | 最终组合 SHA 的整套回归待执行                                                  |
| 事件修复        | 真实 PG15 并发、取消、租户和错误恢复验证通过，3 项 DB 不变量通过 | 覆盖数据库事件路径                                                             |
| 相关 Agent 单测 | 39 个文件、190 项通过                                            | 测试范围见最终验证记录                                                         |
| 安装授权        | 已有 SET 与需要管理授权两条 shell 路径已定向检查                 | 其余 shell 结果分别记录                                                        |
| 浏览器          | 四个语义场景及两个 Mission 场景完成                              | 旧版 `85804a9f` 在后续提案链路发生事件序号竞争，最终修复后审批／恢复链路待复验 |
| 完整 unit       | main 基线 13,189 通过、6 失败，另有预期失败和跳过                | 候选完整 unit 按用户预算决定取消，缺少最终汇总                                 |
| shell           | 20 个文件独立执行，19 通过、1 个 README 基线失败                 | 与最后角色授权定向检查分别记录                                                 |

远程失败 run [43578909992](https://github.com/helsome/AiNativeCrm/actions/runs/43578909992) 保留了真实 Worker 的 `workbench_event_sequence_race`。早期 PG17 run [43579110372](https://github.com/helsome/AiNativeCrm/actions/runs/43579110372) 保留了角色授权失败，后续 0414 已针对该问题修复。

完整记录见 [基线报告](../audits/ontology-36/evidence/baseline-1c9f7852.md) 和 [最终验证记录](../audits/ontology-36/verification.md)。本机原始 CI 日志、trace 和截图保存在 `/Users/helson/code/crm-ontology-baseline-logs/`，其他机器应使用报告中的 Actions 链接获取证据。

## 评估结论与业务定义

首轮实际使用本地 Magpie `http://127.0.0.1:3425/v1` 的 `codex/gpt-6-luna`。44 个题目在两臂形成 88 条观察，其中 70 条模型结果、10 条事件序号竞争导致的 Worker 失败、8 条角色入口 403。四个 agent/viewer 探针在两臂均由 Workbench 的 manager 入口权限拒绝，模型质量指标的分母另行统计。

原始预测、失败事件、70 条独立 Codex 评分及关联 hash 已归档于 [results-b63](../audits/ontology-36/results-b63/README.md)。30 个两臂均有评分的题对中，事实结果为两臂均通过 17、仅 A 通过 1、仅 B 通过 4、两臂均失败 8。首轮受到执行故障及测试目录定价中途更正的影响，修复后的模型质量收益尚未确认。实际费用及内部工具／provider 重试遥测未知。

合成活动缺口验收采用 `minimumValueCents=100000`，即 BRL 1,000，窗口为 `[2026-10-31T00:00:00Z, 2026-11-14T00:00:00Z)`，事件为 `appointment_completed`。这些条件记录为测试假设，生产口径保留配置和澄清流程。

当前已发布快照为 `1.0.0`。`scripts/ontology-propose.ts` 可生成新版本候选、diff 和摘要，模型提案强制保留 `origin=model`、`status=proposed`、`review=null`。业务认证需要授权人员审阅具体定义及依赖，保留身份、证据和版本记录。契约的 review 字符串目前只做结构校验，认证应用端点仍属于后续建设范围。

## 接手后的最小推进顺序

用户已明确要求控制耗时和订阅 token。继续工作时优先沿用已有证据，对具体改动或未解决问题做定向验证。完整模型重评与新增全量评分已停止。

1. 核对 PR HEAD 与本文件快照的差异，确认 schema 0412–0414 已通过正常安装／更新流程应用。
2. 继续验收时，优先运行一次合成 provider 的 Workbench／Mission 浏览器链路，确认正确提案、人工批准、实际 CRM 写入、Worker 续跑和回执。
3. 按实际失败修复并复验相关路径，然后更新 PR 和 Issue 的完成状态。质量收益保留现有结论，扩大评估范围需遵循用户预算。

供需要复验时使用的定向命令如下。这些命令未在本次文档交接中重新执行。

```bash
pnpm test:unit lib/ai/agents/workbench-events-concurrency.test.ts lib/ontology/mission-semantics.test.ts lib/mcp/tools/handoff-mission.test.ts
pnpm test:db tests/invariants/workbench-atomic-events.test.ts tests/invariants/ontology-non-superuser-migration.test.ts
pnpm exec playwright test tests/e2e/agent-workbench-ontology.spec.ts --retries=0
```

浏览器命令依赖 fresh 隔离 Supabase、E2E 凭据及标准 seed、生产构建、Next 应用和真实队列 Worker。应用与 Worker 均须加载同一测试配置，并在启动前把 `OPENROUTER_BASE_URL` 指向本地合成模型 `http://127.0.0.1:48934/v1`，共享测试加密 key。spec 自己启动合成 provider，使用已有定价条目生成模拟成本。Magpie 3425 是真实模型评估路径，按各自脚本配置使用。

仅启动 Next 会使任务停留在 `queued`。Worker 的正常入口为 `workers/agent-worker/main.ts`，验收需确认其就绪并实际出队。页面“语义依据”的检查需打开“运行详情”。

## 环境与协作收尾

- 本次专用评估应用和 Supabase 服务已在 2026-11-14 停止，数据卷保留。恢复工作前检查当前服务和端口。
- 原 `ci.yml` 在收尾时已恢复为 `disabled_manually`。临时诊断分支为 `chore/ontology-baseline-validation-30`，PR 中的 CI 文件保持产品侧既有配置。
- 子对话使用 `gpt-6.1-terra`。真实模型评估使用上述 Magpie 路由。
- 后续并行协作应明确工作树和文件所有权。主工作树保留单一写入者，独立修复完成后整合。
- 本机曾出现 Git 状态显示修改、实际文件字节与 HEAD 相同的现象。本次文档交接中也再次观察到，已逐个核对已跟踪文件，实际字节与 HEAD 一致。后续遇到同样情况时先按字节核对再处理。
- 凭据留在现有受控配置与进程环境中，交接文件仅记录配置名称和位置。
