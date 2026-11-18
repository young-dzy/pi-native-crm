# CRM 本体论改造独立基线核验

固定基线 `1c9f78528571bc28ee1e009378d1bf6361c21a0b`，独立 detached worktree `/Users/helson/code/AiNativeCrm-ontology-baseline`。Node 24.20.0，pnpm 9.15.9，`pnpm install --frozen-lockfile` 退出 0，node_modules 为实际目录。测试进程不继承既有应用环境，未读取/复制生产环境值或操作他人的容器。

本机最初 typecheck 和 lint 均 exit 0，lint 0 errors / 477 warnings；两轮 unit 因严重 I/O 等待先后按授权终止，runner 均 SIGTERM exit 143，无完整 Vitest 统计。`/private/tmp` 后被外部清理，本地原始 install/typecheck/lint/中断 unit 日志不可恢复；以上数字来自清理前实测，不假称仍保有原日志。下述远程原始日志与 artifact 已重新下载并备份至 `/Users/helson/code/crm-ontology-baseline-logs/`，临时副本在 `/private/tmp/crm-ontology-baseline-logs/`。

## 基线结果

- 完整 `pnpm test:unit --maxWorkers=2`（含 co-located tests），[43566308328](https://github.com/helsome/AiNativeCrm/actions/runs/43566308328)，安装 ripgrep 后：exit 1；1351 文件 1347 passed、4 failed；13197 tests 13189 passed、6 failed、1 expected fail、1 skipped。5 个失败为自动 workflow 触发器断言与额度暂停后的基线配置冲突，分别位于 `acolhida-nao-toca-no-fork.test.ts`、`packaging-artefato-do-cliente.test.ts`、`verify-crm-pipeline.test.ts`（3 项）。另一个 `upload-templates-media-security.test.ts` 因 NextRequest 构造 jsdom FormData 时 `_buffer` TypeError，权限断言尚未执行；[单文件重现 43566926056](https://github.com/helsome/AiNativeCrm/actions/runs/43566926056) 同基线 2 passed / 1 failed，不能推断生产接口缺陷。完整输出和 exit 文件在 `artifacts-43566308328/baseline-unit-shell-logs/` 与 `run-43566308328.log`。
- pg15 `pnpm test:db` 与 `pnpm test:db:update` 均成功；275 文件、2318 passed、1 expected fail、1 skipped；pg17 同样结果。原 [CI 43565331082](https://github.com/helsome/AiNativeCrm/actions/runs/43565331082) 实测目标 head 与固定 SHA 相同，日志 `run-43565331082.log`。
- `pnpm test:shell` exit 1，第一处失败为 `tests/shell/instalar-guias.test.sh` README 命令断言（26 项 1 失败），因 `&&` 短路后六文件未执行；[43568837436](https://github.com/helsome/AiNativeCrm/actions/runs/43568837436) 独立补测这六文件均 exit 0。原输出 `artifacts-43566308328/.../shell.log`；补测日志 `run-43568837436.log` 和 `artifacts-43568837436/`。
- 默认堆 `pnpm build` exit 1：编译成功后类型检查阶段 V8 heap OOM，原始日志 `default-build.log`；`NODE_OPTIONS=--max-old-space-size=6144` [重跑 43566634034](https://github.com/helsome/AiNativeCrm/actions/runs/43566634034) 成功，静态页面 62/62，日志 `run-43566634034.log`。默认配置失败依然保留，不能声称默认 build 通过。
- 原 CI 的无 ripgrep runner 也在结构 gate 和分片上出现工具缺失及被暂停触发器导致的失败，完整原始日志为 `run-43565331082.log`；第一分片被 gate 跳过，不作为完整覆盖。旧的无 ripgrep 重复诊断 43566031364 已按授权取消，其已完成 build job 日志已保留。

## 后续诊断和 E2E

临时分支 `chore/ontology-baseline-validation-30`，仅变更该分支 CI workflow。入口 `gh workflow run ci.yml --repo helsome/AiNativeCrm --ref chore/ontology-baseline-validation-30 -f checkout_ref=<完整SHA> -f suite=<分组>`；suite 支持 `all`、`unit`（完整单元和 shell）、`quality`、`db`、`build`、`probe`（以 `test_filter` 指定单文件或目录）、`shell`、`e2e`。quality/build 使用 6144 MiB Node heap；日志及真实退出码上传 artifact，失败由 aggregate 反映。checkout_ref 作为 actions/checkout 的 ref，不注入 shell。E2E job 限定 `tests/e2e/<安全文件名>.spec.ts`，固定 checkout，fresh Supabase、扩展、baseline、0412 ontology role migration、应用连接 rolecheck、Realtime、标准 fixtures、本地 build 和 Chromium；仅对 `agent-workbench-ontology.spec.ts` 注入本地 OpenRouter SSE `127.0.0.1:48934/v1`，统一读取生成的 `.env.e2e` 加密 key。未执行任何部署或 publish-image；fresh onboarding 特殊组的 WAHA/Redis 尚未配置。

现有仓库 `.github/workflows/e2e.yml` 的 workflow_dispatch 无分组或 spec 输入，固定五组，不能直接选择 SHA 与 spec。#33 的 auth smoke [43572037911](https://github.com/helsome/AiNativeCrm/actions/runs/43572037911) 正在验证临时 E2E job，尚未完成；#34 spec 和 E2E 本身尚未验证。

#33 SHA `487b81b7ed114a639f0517159619d867dd7c34cf` 的 6 GiB quality [43567550028](https://github.com/helsome/AiNativeCrm/actions/runs/43567550028) typecheck exit 0，lint exit 0（477 warnings）；日志 `run-43567550028.log`。与基线结论分开。

#34 milestone SHA `59da3bf64c93bd81ebe9437492cd7ead9661bd3e`：quality [43572445030](https://github.com/helsome/AiNativeCrm/actions/runs/43572445030)、pg15 db [43572444995](https://github.com/helsome/AiNativeCrm/actions/runs/43572444995)、MCP 单测 [43572444973](https://github.com/helsome/AiNativeCrm/actions/runs/43572444973)、ontology 单测 [43572445276](https://github.com/helsome/AiNativeCrm/actions/runs/43572445276) 已派发，结果待核。

#34 milestone quality [43572445030](https://github.com/helsome/AiNativeCrm/actions/runs/43572445030) 成功：typecheck exit 0、lint exit 0（0 errors / 477 warnings）；MCP probe [43572444973](https://github.com/helsome/AiNativeCrm/actions/runs/43572444973) 1 文件 3 passed，ontology probe [43572445276](https://github.com/helsome/AiNativeCrm/actions/runs/43572445276) 4 文件 17 passed。pg15 db 仍执行中。

#33 的 fresh Supabase auth smoke [43572037911](https://github.com/helsome/AiNativeCrm/actions/runs/43572037911) 在应用 baseline 和 0412 migration 后执行 ontology-role-check.sql 时失败：`permission denied for schema auth`；浏览器未启动。保留原始 run 日志，未绕过 rolecheck。权限诊断重跑 [43572647535](https://github.com/helsome/AiNativeCrm/actions/runs/43572647535) 执行中。

旧 #33 SHA `487b81b7...` 的 fresh Supabase 只读诊断 [43572900251](https://github.com/helsome/AiNativeCrm/actions/runs/43572900251)：`auth` schema owner `supabase_admin`，postgres ACL 仅 USAGE，无 grant option；`uid` / `jwt` owner `supabase_auth_admin`，PUBLIC EXECUTE。`postgres` 是非 superuser，具有 create role/create DB/inherit/bypass RLS；`ontology_reader` 无 login、superuser、create role、create DB、inherit 或 bypass RLS。baseline 和 migration 的 auth GRANT 输出 no privileges granted，reader schema USAGE 为 false；rolecheck 对 auth 具名函数查找报 42501。空库无 JWT 下 reader 对五张受限表查询均 exit 0 / 0 行，不能证明有数据时正向 RLS。进一步合成数据正向诊断 [43573247817](https://github.com/helsome/AiNativeCrm/actions/runs/43573247817) 执行中；未对 auth schema 增加特权授权。#33 新 rolecheck 修复 `a380dddd` 尚未由此 E2E job 验证。

联合 SHA `fb55610b2edb52768e89c89e544bdccbf070a7cf` 的 quality [43573282439](https://github.com/helsome/AiNativeCrm/actions/runs/43573282439)、pg15 db [43573282341](https://github.com/helsome/AiNativeCrm/actions/runs/43573282341) 执行中；E2E [43573282362](https://github.com/helsome/AiNativeCrm/actions/runs/43573282362) 因 builtin scope 入口仍在修复而按统筹指示取消，不能当作验收。

旧 #33 合成数据正向 RLS 诊断 [43573247817](https://github.com/helsome/AiNativeCrm/actions/runs/43573247817)：事务内创建两组织、manager membership 和一条 lead，设置 JWT 后 `ontology_reader` 读取到所属组织 lead 与该组织，另一个组织不可见，exit 0，事务回滚；随后旧 rolecheck 因 auth schema 名称解析退出 1。该证据证明受测列与这组 RLS 正向/跨组织隔离行为，并非全部模板的完整证明。日志 `run-43573247817.log`。

#34 milestone `59da3bf64c93bd81ebe9437492cd7ead9661bd3e` pg15 [43572444995](https://github.com/helsome/AiNativeCrm/actions/runs/43572444995) 的 `test:db` 和 `test:db:update` 均成功：278 文件、2336 passed、1 expected fail、1 skipped；日志 `run-43572444995.log`。

#34 最新测试 SHA `b92eed5399a6ddcdfe190a56f809fdb6f6c82644`：quality [43573530289](https://github.com/helsome/AiNativeCrm/actions/runs/43573530289)、pg15 [43573530091](https://github.com/helsome/AiNativeCrm/actions/runs/43573530091)、fresh Supabase ontology E2E [43573529985](https://github.com/helsome/AiNativeCrm/actions/runs/43573529985) 已派发，待结果；旧 fb55610b E2E 取消，不能作为 builtin 入口证明。

中间 SHA `b92eed5399a6ddcdfe190a56f809fdb6f6c82644`：quality [43573530289](https://github.com/helsome/AiNativeCrm/actions/runs/43573530289) typecheck/lint 皆成功（477 warnings）；fresh Supabase rolecheck [43573585886](https://github.com/helsome/AiNativeCrm/actions/runs/43573585886) 成功，reader auth schema USAGE 仍为 false，OID rolecheck 成功及合成 manager 正向 RLS 查询 exit 0；此 suite 不执行浏览器。E2E [43573529985](https://github.com/helsome/AiNativeCrm/actions/runs/43573529985) 在范围修复尚未完成时按统筹指示取消，不作为验收。对应日志在持久日志目录。

#34 验收候选 SHA `83c36d90d3a0689af7918f8a84fc844c184a68f2`：quality [43574010004](https://github.com/helsome/AiNativeCrm/actions/runs/43574010004)、pg15 db+update [43574009606](https://github.com/helsome/AiNativeCrm/actions/runs/43574009606)、fresh ontology E2E [43574009785](https://github.com/helsome/AiNativeCrm/actions/runs/43574009785)，以及 ontology [43574016449](https://github.com/helsome/AiNativeCrm/actions/runs/43574016449)、MCP [43574016451](https://github.com/helsome/AiNativeCrm/actions/runs/43574016451)、runtime [43574016428](https://github.com/helsome/AiNativeCrm/actions/runs/43574016428)、agents [43574016415](https://github.com/helsome/AiNativeCrm/actions/runs/43574016415) 单测均已启动，待结果。

验收候选 `83c36d90d3a0689af7918f8a84fc844c184a68f2`：quality [43574010004](https://github.com/helsome/AiNativeCrm/actions/runs/43574010004) 成功，typecheck/lint exit 0，0 errors / 477 warnings；针对性单测 ontology 17/17、MCP 6/6、runtime 1/1、agents 183/183 均成功，原日志 `run-435740*.log`。pg15 db+update run 43574009606 仍执行中。

fresh Supabase ontology E2E [43574009785](https://github.com/helsome/AiNativeCrm/actions/runs/43574009785) exit 1：baseline、role migration/rolecheck、E2E build、种子和浏览器启动均完成；spec 第 213 行在配置副本后等待 `Publicar v1` 启用超时。trace 中按钮的 `aria-describedby` 明确为 `Número WhatsApp não está conectado (status: STARTING).`，spec 把副本 channel_session_id 指向 followup seed fixture。未发布副本，未执行模型调用、ontology 工具与语义证据断言；此结果不证明这些行为。完整日志 `run-43574009785.log`，截图、trace 和 exit 文件 `artifacts-43574009785/`。需要产品/测试所有者决定如何满足发布所需的连接前提后重跑，不可伪绿。

验收候选 `83c36d90...` 的 pg15 [43574009606](https://github.com/helsome/AiNativeCrm/actions/runs/43574009606) 已完成：`pnpm test:db` exit 0，279 文件、2340 passed、1 expected fail、1 skipped；`pnpm test:db:update` exit 0。原日志及独立 exit 文件保存在持久日志目录。浏览器仍失败于发布前置条件，不能作为完整验收。

`095b7a608e0069f7cfb5f64df50ed026480d9b9b` 仅修改 E2E spec 的合成会话状态（与 `83c36d90...` 产品字节相同）。[43574944957](https://github.com/helsome/AiNativeCrm/actions/runs/43574944957) 越过发布门槛并创建 Workbench run，但 UI 保持 `queued`，180 秒等待语义依据失败。API 入队 `workbench_start`，而临时 E2E job 当时未启动 worker；这是明确的环境缺口，不能用于判定 ontology 产品逻辑。原日志、截图、trace 保存在持久证据目录。

经统筹授权，临时 workflow `27431669` 使用仓库 `workers/agent-worker/main.ts` 正常队列入口启动独立 worker，读取同一 `.env.e2e`（含模型 fixture 地址及加密 key）、检查 healthz、记录日志和清理，worker 不连接合成 WAHA；同一 SHA 重新运行 [43576055850](https://github.com/helsome/AiNativeCrm/actions/runs/43576055850)，执行中。需验证实际出队及浏览器证据，不能提前标绿。

同一 `095b7a60...`、真实 worker 重跑 [43576055850](https://github.com/helsome/AiNativeCrm/actions/runs/43576055850) exit 1：worker healthz 成功，日志证明 `workbench_start` 出队并完成、OpenRouter 指向合成模型且调用完成。浏览器首个 `ONTOLOGY_FULL_UNSCOPED` run 状态为 completed，显示合成回答，但等待 `语义依据` 180 秒失败（spec 269 行）。从 Playwright trace 内 run-detail response 只读提取事件：`tool_started` 的 tool 为 `ontology_query`，`tool_completed` 包含 `ontologyObservation: true`、`status: full`；因此后端已返回证据，UI 未展示，具体 reducer/渲染根因尚未确定，后续其余场景未验证。原始日志、worker log、截图、trace、exit 文件在 `crm-ontology-baseline-logs/run-43576055850.log` 和 `artifacts-43576055850/`；fixture 本身没有单独服务日志。临时 workflow 后续诊断 E2E 使用 `--retries=0`（提交 `33b99403`），未据此启动新 run。

进一步只读定位：验收 SHA 的 `AgentCrmWorkbench.tsx` 将 `OntologyEvidence` 渲染在 `panel === details` 的“运行详情”Sheet 中；失败 trace 页面仅显示“运行详情”按钮、抽屉未打开，而 spec 在 `getByLabel('语义依据')` 前没有点击它。后端 detail response 已含 full 语义事件，所以这是高度可疑的测试操作缺口，仍需打开抽屉后的真实重跑确认，不能仅凭源码宣布通过。

## 固定 SHA `72daf4a88c555980959686b356c17d79ea81d9a5` 验收

- quality [43577413025](https://github.com/helsome/AiNativeCrm/actions/runs/43577413025)、pg15 db+update [43577412396](https://github.com/helsome/AiNativeCrm/actions/runs/43577412396)、fresh Supabase + worker 的 ontology E2E [43577412439](https://github.com/helsome/AiNativeCrm/actions/runs/43577412439)、四文件 Mission 单测 [43577412544](https://github.com/helsome/AiNativeCrm/actions/runs/43577412544) 均已完成，结果见下。
- 所有运行均固定 checkout 上述完整 SHA；浏览器 `--retries=0`。临时 workflow 版本 `5f118bbb`，产品仓库无修改。

### `72daf4a8` 最终结果

- quality [43577413025](https://github.com/helsome/AiNativeCrm/actions/runs/43577413025)：typecheck exit 0；lint exit 0，0 errors / 477 warnings。
- Mission 相关四文件 [43577412544](https://github.com/helsome/AiNativeCrm/actions/runs/43577412544)：4 files、11 tests passed，exit 0。
- pg15 [43577412396](https://github.com/helsome/AiNativeCrm/actions/runs/43577412396)：`test:db` exit 0，279 files、2342 passed、1 expected fail、1 skipped；`test:db:update` exit 0，带数据升级通过。
- fresh Supabase + 真实 worker 浏览器 [43577412439](https://github.com/helsome/AiNativeCrm/actions/runs/43577412439)：exit 1。四个原有语义场景（无选 full、有选 full、partial、unanswerable）的 UI、状态与回执断言均在 Mission 开始前完成；新增 Mission 在 spec 第 367 行等待 completed，实际 `partial`，error_code `empty_final_answer`。run `bc328e5d-f228-4025-bdab-805fa0f530b6` 事件有 `ontology_describe_action` supported 和 tool success，未见 `ontology_describe_outcome`、submit 或 proposal（0 个）；`model_decision.resultRecovery=skipped_unknown_cost`、usage `costCents=null`，模型调用 10+10 tokens。其余 Mission 审批/恢复断言未执行，不得计为通过。worker 实际出队，不能归类为先前无 worker 环境故障；为何模型循环未继续须由产品/fixture 所有者排查。

完整日志、各原始 exit 文件、worker 日志、截图及 trace 在 `/Users/helson/code/crm-ontology-baseline-logs/`，包括 `run-43577412439.log`、`artifacts-43577412439/`。同一报告副本写入 `/private/tmp/crm-ontology-baseline-report.md`。本次未修改产品分支。

固定 `85804a9ff94eee70c97d9ad5948c8a68b0dff8a5` 的 E2E 重跑 [43578909992](https://github.com/helsome/AiNativeCrm/actions/runs/43578909992) 已派发，`--retries=0`、fresh Supabase 与真实 worker。相对已通过 quality/db 的 `72daf4a8...` 仅改变 `tests/e2e/agent-workbench-ontology.spec.ts`，产品代码相同；结果待核。

## #36 最终候选 `b63a448f109c19e0ecd635b6a1e0961bdf3ad490`

所有 run checkout 固定完整 SHA；临时 workflow `9489e181`。完整单元（含 co-located）[43579110198](https://github.com/helsome/AiNativeCrm/actions/runs/43579110198)，quality [43579110671](https://github.com/helsome/AiNativeCrm/actions/runs/43579110671)，pg15 db+update [43579110248](https://github.com/helsome/AiNativeCrm/actions/runs/43579110248)，pg17 db+update [43579110372](https://github.com/helsome/AiNativeCrm/actions/runs/43579110372)，6 GiB build [43579110551](https://github.com/helsome/AiNativeCrm/actions/runs/43579110551)，全部 shell 文件独立运行 [43579110344](https://github.com/helsome/AiNativeCrm/actions/runs/43579110344)；结果待完成。

`85804a9f...` E2E [43578909992](https://github.com/helsome/AiNativeCrm/actions/runs/43578909992) 继续执行；与 b63 的差异为独立 `lib/ontology/eval` 评估模块、对应测试、脚本、数据和文档；应用/worker 不导入该评估模块，E2E spec 未变。仅在该 E2E 实际成功后才能考虑复用，仍须记录被测 SHA 和差异。

逐文件 shell 首轮 [43579110344](https://github.com/helsome/AiNativeCrm/actions/runs/43579110344) 虽显示成功，但仅执行了 5 个文件：被测子脚本消耗了循环 stdin，结果无效；保留日志作为 harness 故障证据。临时 workflow `f02052fc` 对子脚本 stdin 使用 `/dev/null` 并核对实际文件数，修正后 [43579249188](https://github.com/helsome/AiNativeCrm/actions/runs/43579249188) 已启动。原 `pnpm test:shell` 也在完整 unit job 中独立运行，结果不被此补测掩盖。

### #36 候选 `b63a448f...` 当前实测

- quality [43579110671](https://github.com/helsome/AiNativeCrm/actions/runs/43579110671)：typecheck/lint exit 0，lint 0 errors / 477 warnings。
- pg15 [43579110248](https://github.com/helsome/AiNativeCrm/actions/runs/43579110248)：`test:db` exit 0，279 files、2342 passed、1 expected fail、1 skipped；`test:db:update` exit 0。
- pg17 [43579110372](https://github.com/helsome/AiNativeCrm/actions/runs/43579110372)：`test:db` exit 1，279 files（278 passed、1 failed），2341 passed、1 failed、1 expected fail、1 skipped；`test:db:update` exit 0。失败 `ontology-non-superuser-migration.test.ts:44`：42501，PG17 中执行者缺少 `ontology_reader` ADMIN option，不能 grant 给 `ontology_schema_user`。单文件独立重现 [43580121408](https://github.com/helsome/AiNativeCrm/actions/runs/43580121408) 同样 1/1 失败、同一 42501；没有超管绕过。原 main 基线 pg17 全量通过，但不包含此新增测试，因此应按候选新增的 pg17 验证失败记录。
- 6 GiB `pnpm build` [43579110551](https://github.com/helsome/AiNativeCrm/actions/runs/43579110551)：exit 0，静态页面 62/62。
- shell 独立完整覆盖 [43579425460](https://github.com/helsome/AiNativeCrm/actions/runs/43579425460)：20/20 文件实际执行，19 exit 0；`tests/shell/instalar-guias.test.sh` exit 1（README 命令断言，与 main 基线重现一致），aggregate exit 1。两轮 harness 故障 [43579110344](https://github.com/helsome/AiNativeCrm/actions/runs/43579110344) 和 [43579249188](https://github.com/helsome/AiNativeCrm/actions/runs/43579249188) 均未完整覆盖，不能作为结果。完整 unit及原 `pnpm test:shell` 尚在运行。

### `85804a9f...` fresh E2E

[43578909992](https://github.com/helsome/AiNativeCrm/actions/runs/43578909992) exit 1。四个语义场景和前两个 Mission run 通过到审批场景；第三 Mission `adf4397b-5645-43e9-b5d9-862784c3effe` 在 spec 第 438 行期望 `awaiting_confirmation`，真实终态 `failed / runtime_failed`，proposal 为 0。run events 记录 action/outcome 描述与 `crm_manage_tags` policy_checked；真实 worker 多次报 `workbench_event_sequence_race`，未完成审批/resume。对应日志及截图/trace/worker log 位于持久证据目录 `run-43578909992.log`、`artifacts-43578909992/`。统筹确认 race 与本地评估失败同根，修复仍在产品分支进行；不能复用该失败 run 作为 E2E 通过。
