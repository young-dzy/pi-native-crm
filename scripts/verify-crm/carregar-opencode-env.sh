#!/usr/bin/env bash
# Preenche OPENCODE_* vazio a partir de .cursor/skills/verify-crm/opencode.env.
# Valor já presente no ambiente (secret do Actions) ganha.
# No Actions, registra máscaras antes de publicar valores em GITHUB_ENV.
# Com GITHUB_ENV, grava os nomes resolvidos para os passos seguintes do job.
carregar_opencode_env() {
  # O trace do shell não pode registrar a leitura das credenciais.
  set +x
  local aqui arquivo line key val cur masked
  aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  arquivo="${OPENCODE_ENV_FILE:-$aqui/../../.cursor/skills/verify-crm/opencode.env}"
  if [[ -f "$arquivo" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%$'\r'}"
      case "$line" in
        '' | \#*) continue ;;
      esac
      key="${line%%=*}"
      val="${line#*=}"
      case "$key" in
        OPENCODE_API_KEY | OPENCODE_BASE_URL | OPENCODE_MODEL) ;;
        *) continue ;;
      esac
      if [[ "$val" == \"*\" ]]; then
        val="${val#\"}"
        val="${val%\"}"
      fi
      cur="${!key-}"
      cur="${cur#"${cur%%[![:space:]]*}"}"
      cur="${cur%"${cur##*[![:space:]]}"}"
      if [[ -z "$cur" ]]; then
        printf -v "$key" '%s' "$val"
        export "$key"
      fi
    done <"$arquivo"
  fi

  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    for key in OPENCODE_API_KEY VERIFY_CRM_MODEL_API_KEY OPENCODE_BASE_URL OPENCODE_MODEL; do
      val="${!key-}"
      [[ -n "$val" ]] || continue
      masked="${val//%/%25}"
      masked="${masked//$'\r'/%0D}"
      masked="${masked//$'\n'/%0A}"
      printf '::add-mask::%s\n' "$masked"
    done
  fi

  if [[ -n "${GITHUB_ENV:-}" ]]; then
    for key in OPENCODE_API_KEY OPENCODE_BASE_URL OPENCODE_MODEL; do
      val="${!key-}"
      if [[ "$val" == *$'\n__OC_ENV__'* || "$val" == '__OC_ENV__'* ]]; then
        echo "blocked: invalid multiline credential" >&2
        return 1
      fi
    done
    {
      printf 'OPENCODE_API_KEY<<__OC_ENV__\n%s\n__OC_ENV__\n' "${OPENCODE_API_KEY-}"
      printf 'OPENCODE_BASE_URL<<__OC_ENV__\n%s\n__OC_ENV__\n' "${OPENCODE_BASE_URL-}"
      printf 'OPENCODE_MODEL<<__OC_ENV__\n%s\n__OC_ENV__\n' "${OPENCODE_MODEL-}"
      printf 'VERIFY_CRM_MODEL_API_KEY<<__OC_ENV__\n%s\n__OC_ENV__\n' "${OPENCODE_API_KEY-}"
      printf 'OPENCODE_E2E_MODEL_ID<<__OC_ENV__\n%s\n__OC_ENV__\n' "${OPENCODE_MODEL-}"
    } >>"$GITHUB_ENV"
  fi
}

if carregar_opencode_env; then
  unset -f carregar_opencode_env
else
  unset -f carregar_opencode_env
  return 1 2>/dev/null || exit 1
fi
