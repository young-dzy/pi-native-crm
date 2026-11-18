/**
 * Seed the one OpenCode Zen model verified for real tool calling into the
 * loopback-only E2E catalog. This deliberately makes no capability claim for
 * other models returned by the provider's catalog.
 *
 * Run: npx tsx scripts/seed-e2e-catalogo-opencode.ts
 * Optional: OPENCODE_E2E_MODEL_ID (default space-bunny-free) and
 * OPENCODE_E2E_DISPLAY_NAME. The row is always written with supports_tools.
 */
import { createClient } from "@supabase/supabase-js";

import { guardarCredencial } from "@/lib/ai/credenciais/guardar";
import { definirPadraoDeIaDaOrganizacao } from "@/lib/ai/pontos/padrao-da-organizacao";
import { validateProviderKey } from "@/lib/ai/provider-validators";
import type { createAdminClient } from "@/lib/supabase/admin";

import { anunciarDestino, credenciaisSupabaseDeTeste, destinoEhLocal } from "./lib/env-de-teste";
import { modeloDoCatalogoE2e } from "./lib/modelo-catalogo-e2e";

const credenciais = credenciaisSupabaseDeTeste();
anunciarDestino("seed-e2e-catalogo-opencode", credenciais);
if (!destinoEhLocal(credenciais.url) || !destinoEhLocal(credenciais.dbUrl)) {
  throw new Error("OpenCode E2E catalog seed only permits loopback Supabase and Postgres URLs");
}

const admin = createClient(credenciais.url, credenciais.serviceRole, {
  auth: { persistSession: false },
});

async function main(): Promise<void> {
  const { modelId, displayName } = modeloDoCatalogoE2e();
  const { error } = await admin.from("ai_models").upsert(
    {
      provider: "opencode",
      model_id: modelId,
      display_name: displayName,
      supports_tools: true,
      input_price_per_million_cents: 0,
      output_price_per_million_cents: 0,
      metadata: { source: "sync", seed: "e2e", tool_calling_verified: true },
    },
    { onConflict: "provider,model_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[seed-catalogo-opencode] failed:", error.message);
    process.exit(1);
  }

  const { data: model, error: readError } = await admin
    .from("ai_models")
    .select("supports_tools")
    .eq("provider", "opencode")
    .eq("model_id", modelId)
    .maybeSingle();
  if (readError || !model?.supports_tools) {
    console.error(
      "[seed-catalogo-opencode] catalog entry already exists without verified tool support; refusing to overwrite it",
    );
    process.exit(1);
  }

  console.info(`[seed-catalogo-opencode] opencode/${modelId} is available for local E2E`);

  // The verify-crm drive opens /app/ai/workbench right after login. The app
  // layout then redirects to onboarding, and the drive treats that first URL
  // as the workbench and never walks the wizard. With the key already stored
  // and onboarding marked done, that first page is the workbench.
  const apiKey = (process.env.VERIFY_CRM_MODEL_API_KEY || process.env.OPENCODE_API_KEY || "").trim();
  if (!apiKey) return;

  const { data: membership, error: membershipError } = await admin
    .from("user_organizations")
    .select("organization_id, user_id")
    .eq("role", "admin")
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    console.error("[seed-catalogo-opencode] no admin membership to attach the model key");
    process.exit(1);
  }

  const orgId = membership.organization_id as string;
  const userId = membership.user_id as string;
  const db = admin as unknown as ReturnType<typeof createAdminClient>;

  const saved = await guardarCredencial({
    admin: db,
    orgId,
    userId,
    provider: "opencode",
    label: "Chave do onboarding",
    apiKey,
  });
  if (!saved.ok && saved.motivo !== "label_em_uso") {
    console.error(`[seed-catalogo-opencode] could not store the model key (${saved.motivo})`);
    process.exit(1);
  }

  if (saved.ok) {
    const validation = await validateProviderKey("opencode", apiKey);
    const { error: validationWriteError } = await admin
      .from("ai_provider_credentials")
      .update(
        validation.ok
          ? {
              validated_at: new Date().toISOString(),
              validation_error: null,
              models_available: validation.models,
            }
          : { validated_at: null, validation_error: validation.error, models_available: null },
      )
      .eq("id", saved.id)
      .eq("organization_id", orgId);
    if (validationWriteError || !validation.ok) {
      const detalhe = validation.ok ? validationWriteError.message : validation.error;
      console.error(`[seed-catalogo-opencode] model key was not validated (${detalhe})`);
      process.exit(1);
    }
  }

  const padrao = await definirPadraoDeIaDaOrganizacao({
    admin: db,
    orgId,
    actorUserId: userId,
    provider: "opencode",
  });
  if (!padrao.ok) {
    console.error(`[seed-catalogo-opencode] could not set the organization model (${padrao.motivo})`);
    process.exit(1);
  }

  if (padrao.modelo !== modelId) {
    const { data: orgAtual, error: leituraErr } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle();
    if (leituraErr || !orgAtual) {
      console.error("[seed-catalogo-opencode] could not read organization settings");
      process.exit(1);
    }
    const settingsAtuais = (orgAtual.settings ?? {}) as Record<string, unknown>;
    const llmAtual = (settingsAtuais.llm ?? {}) as Record<string, unknown>;
    const { error: modeloErr } = await admin
      .from("organizations")
      .update({
        settings: { ...settingsAtuais, llm: { ...llmAtual, provider: "opencode", default_model: modelId } },
      })
      .eq("id", orgId);
    if (modeloErr) {
      console.error("[seed-catalogo-opencode] could not pin the seeded model");
      process.exit(1);
    }
  }

  const { error: onboardedErr } = await admin
    .from("organizations")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", orgId)
    .is("onboarded_at", null);
  if (onboardedErr) {
    console.error("[seed-catalogo-opencode] could not mark onboarding complete");
    process.exit(1);
  }

  console.info(`[seed-catalogo-opencode] organization ready for opencode/${modelId}`);
}

void main();
