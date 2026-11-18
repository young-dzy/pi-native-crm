# Inventário físico v1 — issue #31

Base: `1c9f78528571bc28ee1e009378d1bf6361c21a0b`. `verified` abaixo significa presença e nulidade declaradas no tipo gerado, não certificação de significado, sensibilidade ou autorização. Confirme no banco instalado antes de implementar #32; tipos podem estar defasados. Campo `Json` não define esquema interno. Cada linha aponta à seção homônima de `lib/database.types.ts` (`Row`); as constraints e relações exigem o baseline/migrations.

## contacts

Fonte: `lib/database.types.ts`, seção `contacts.Row`.

| Campo | Tipo e nulidade declarados | Estado físico |
|---|---|---|
| `ai_authorized_at` | `string | null` | verified |
| `ai_authorized_reason` | `string | null` | verified |
| `anonymized_at` | `string | null` | verified |
| `avatar_storage_path` | `string | null` | verified |
| `avatar_updated_at` | `string | null` | verified |
| `birthdate` | `string | null` | verified |
| `birthday_md` | `number | null` | verified |
| `blocked_at` | `string | null` | verified |
| `blocked_reason` | `string | null` | verified |
| `client_recognized_at` | `string | null` | verified |
| `client_tag_by_system` | `string | null` | verified |
| `consent` | `Json` | verified |
| `cpf_encrypted` | `string | null` | verified |
| `custom_fields` | `Json` | verified |
| `cpf_hash` | `string | null` | verified |
| `created_at` | `string` | verified |
| `created_by_user_id` | `string | null` | verified |
| `display_name` | `string | null` | verified |
| `email` | `string | null` | verified |
| `email_normalized` | `string | null` | verified |
| `force_human` | `boolean` | verified |
| `first_service_at` | `string | null` | verified |
| `id` | `string` | verified |
| `is_anonymized` | `boolean` | verified |
| `is_blocked` | `boolean` | verified |
| `is_merged_into` | `string | null` | verified |
| `last_activity_at` | `string | null` | verified |
| `locale` | `string | null` | verified |
| `merged_at` | `string | null` | verified |
| `name` | `string | null` | verified |
| `organization_id` | `string` | verified |
| `phone_lookup_at` | `string | null` | verified |
| `phone_number` | `string | null` | verified |
| `social_identity` | `string | null` | verified |
| `source` | `string` | verified |
| `source_metadata` | `Json` | verified |
| `tags` | `string[]` | verified |
| `updated_at` | `string` | verified |
| `wa_identity` | `string | null` | verified |
| `wa_lid` | `string | null` | verified |

## crm_leads

Fonte: `lib/database.types.ts`, seção `crm_leads.Row`.

| Campo | Tipo e nulidade declarados | Estado físico |
|---|---|---|
| `assigned_at` | `string | null` | verified |
| `closed_at` | `string | null` | verified |
| `contact_id` | `string | null` | verified |
| `created_at` | `string` | verified |
| `created_by_user_id` | `string | null` | verified |
| `currency` | `string | null` | verified |
| `custom_fields` | `Json` | verified |
| `description` | `string | null` | verified |
| `expected_close_date` | `string | null` | verified |
| `external_id` | `string | null` | verified |
| `id` | `string` | verified |
| `last_activity_at` | `string | null` | verified |
| `lost_reason` | `string | null` | verified |
| `organization_id` | `string` | verified |
| `owner_agent_id` | `string | null` | verified |
| `owner_kind` | `string | null` | verified |
| `owner_user_id` | `string | null` | verified |
| `pipeline_id` | `string` | verified |
| `position_in_stage` | `number` | verified |
| `source` | `string` | verified |
| `source_metadata` | `Json` | verified |
| `stage_changed_at` | `string | null` | verified |
| `stage_id` | `string` | verified |
| `status` | `string` | verified |
| `tags` | `string[]` | verified |
| `title` | `string` | verified |
| `updated_at` | `string` | verified |
| `value_cents` | `number | null` | verified |

## conversations

Fonte: `lib/database.types.ts`, seção `conversations.Row`.

| Campo | Tipo e nulidade declarados | Estado físico |
|---|---|---|
| `reply_context_revision` | `number` | verified |
| `active_agent_set_at` | `string | null` | verified |
| `active_ai_agent_id` | `string | null` | verified |
| `active_intent` | `string | null` | verified |
| `assigned_at` | `string | null` | verified |
| `assigned_to_user_id` | `string | null` | verified |
| `assigned_to_user_name` | `string | null` | verified |
| `assignee_kind` | `string | null` | verified |
| `awaiting_since` | `string | null` | verified |
| `bot_silenced_until` | `string | null` | verified |
| `channel` | `string` | verified |
| `channel_session_id` | `string` | verified |
| `contact_id` | `string` | verified |
| `created_at` | `string` | verified |
| `current_demanda_id` | `string | null` | verified |
| `group_chat_id` | `string | null` | verified |
| `id` | `string` | verified |
| `is_group` | `boolean` | verified |
| `last_handoff_at` | `string | null` | verified |
| `last_handoff_reason` | `string | null` | verified |
| `last_inbound_at` | `string | null` | verified |
| `last_message_at` | `string | null` | verified |
| `last_message_preview` | `string | null` | verified |
| `last_outbound_at` | `string | null` | verified |
| `metadata` | `Json` | verified |
| `organization_id` | `string` | verified |
| `provider_conversation_id` | `string | null` | verified |
| `rag_review_status` | `string | null` | verified |
| `service_closed_at` | `string | null` | verified |
| `service_revision` | `number` | verified |
| `service_started_at` | `string | null` | verified |
| `snooze_until` | `string | null` | verified |
| `snoozed_at` | `string | null` | verified |
| `snoozed_by_user_id` | `string | null` | verified |
| `status` | `string` | verified |
| `status_changed_at` | `string` | verified |
| `tags` | `string[]` | verified |
| `unread_count_for_assignee` | `number` | verified |
| `updated_at` | `string` | verified |
| `usable_for_rag` | `boolean` | verified |
| `usable_for_rag_marked_at` | `string | null` | verified |
| `usable_for_rag_marked_by` | `string | null` | verified |

## crm_lead_activities

Fonte: `lib/database.types.ts`, seção `crm_lead_activities.Row`.

| Campo | Tipo e nulidade declarados | Estado físico |
|---|---|---|
| `actor_agent_id` | `string | null` | verified |
| `actor_kind` | `string | null` | verified |
| `contact_id` | `string | null` | verified |
| `created_at` | `string` | verified |
| `evidence` | `Json | null` | verified |
| `id` | `string` | verified |
| `lead_id` | `string` | verified |
| `metadata` | `Json` | verified |
| `organization_id` | `string` | verified |
| `payload` | `Json` | verified |
| `performed_at` | `string` | verified |
| `performed_by_user_id` | `string | null` | verified |
| `reason` | `string | null` | verified |
| `source_id` | `string | null` | verified |
| `source_module` | `string` | verified |
| `type` | `string` | verified |

## crm_pipelines

Fonte: `lib/database.types.ts`, seção `crm_pipelines.Row`.

| Campo | Tipo e nulidade declarados | Estado físico |
|---|---|---|
| `created_at` | `string` | verified |
| `description` | `string | null` | verified |
| `id` | `string` | verified |
| `is_archived` | `boolean` | verified |
| `is_default` | `boolean` | verified |
| `is_client_pipeline` | `boolean` | verified |
| `name` | `string` | verified |
| `organization_id` | `string` | verified |
| `position` | `number` | verified |
| `settings` | `Json` | verified |
| `slug` | `string` | verified |
| `updated_at` | `string` | verified |
| `vocabulary` | `Json` | verified |

## crm_stages

Fonte: `lib/database.types.ts`, seção `crm_stages.Row`.

| Campo | Tipo e nulidade declarados | Estado físico |
|---|---|---|
| `agent_stage_hint` | `string | null` | verified |
| `color` | `string | null` | verified |
| `created_at` | `string` | verified |
| `description` | `string | null` | verified |
| `expected_duration_hours` | `number | null` | verified |
| `id` | `string` | verified |
| `is_archived` | `boolean` | verified |
| `is_lost` | `boolean` | verified |
| `is_won` | `boolean` | verified |
| `last_change_actor_kind` | `string | null` | verified |
| `last_change_at` | `string | null` | verified |
| `name` | `string` | verified |
| `organization_id` | `string` | verified |
| `pipeline_id` | `string` | verified |
| `position` | `number` | verified |
| `requires_human` | `boolean` | verified |
| `slug` | `string` | verified |
| `updated_at` | `string` | verified |

## messages

Fonte: `lib/database.types.ts`, seção `messages.Row`.

| Campo | Tipo e nulidade declarados | Estado físico |
|---|---|---|
| `ack` | `number | null` | verified |
| `activity_id` | `string | null` | verified |
| `body` | `string | null` | verified |
| `channel_session_id` | `string` | verified |
| `contact_id` | `string` | verified |
| `conversation_id` | `string` | verified |
| `created_at` | `string` | verified |
| `delivered_at` | `string | null` | verified |
| `demanda_id` | `string | null` | verified |
| `demanda_revision` | `number | null` | verified |
| `direction` | `string` | verified |
| `edited_at` | `string | null` | verified |
| `error_code` | `string | null` | verified |
| `error_message` | `string | null` | verified |
| `external_id` | `string | null` | verified |
| `id` | `string` | verified |
| `media_derived_status` | `string | null` | verified |
| `media_derived_text` | `string | null` | verified |
| `media_mime` | `string | null` | verified |
| `media_size_bytes` | `number | null` | verified |
| `media_storage_path` | `string | null` | verified |
| `media_url` | `string | null` | verified |
| `metadata` | `Json` | verified |
| `organization_id` | `string` | verified |
| `read_at` | `string | null` | verified |
| `reply_to_message_id` | `string | null` | verified |
| `revoked_at` | `string | null` | verified |
| `sent_at` | `string` | verified |
| `sent_by_user_id` | `string | null` | verified |
| `sent_via` | `string` | verified |
| `service_revision` | `number | null` | verified |
| `status` | `string` | verified |
| `template_language` | `string | null` | verified |
| `template_name` | `string | null` | verified |
| `type` | `string` | verified |
| `updated_at` | `string` | verified |

## crm_tasks

Fonte: `supabase/migrations/20260903143000_0210_tarefas_do_crm.sql` e `supabase/baseline.sql`, bloco tarefas 0210; ausente de `lib/database.types.ts`.

| Campo | Tipo / nulo | Estado físico |
|---|---|---|
| `id` | `uuid NOT NULL` | verified |
| `organization_id` | `uuid NOT NULL` | verified |
| `title` | `text NOT NULL` | verified |
| `description` | `text NULL` | verified |
| `due_date` | `timestamptz NULL` | verified |
| `priority` | `text NOT NULL` | verified |
| `status` | `text NOT NULL` | verified |
| `lead_id` | `uuid NULL` | verified |
| `contact_id` | `uuid NULL` | verified |
| `assigned_to` | `uuid NULL` | verified |
| `created_by` | `uuid NULL` | verified |
| `created_at` | `timestamptz NOT NULL` | verified |
| `updated_at` | `timestamptz NOT NULL` | verified |
