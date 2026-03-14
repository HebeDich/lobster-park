#!/bin/bash
set -euo pipefail

create_backup_snapshot() {
  load_env_file
  ensure_directory "$LP_BACKUP_DIR"
  local snapshot_dir="$LP_BACKUP_DIR/$(date +%Y%m%d%H%M%S)"
  mkdir -p "$snapshot_dir"
  cp "$LP_ENV_FILE" "$snapshot_dir/.env"
  printf '%s\n' "$(resolve_current_target)" > "$snapshot_dir/current-release.txt"

  if docker inspect lobster-park-postgres >/dev/null 2>&1; then
    if docker_compose_infra exec -T postgres pg_dump -U "${LP_POSTGRES_USER:-lobster}" "${LP_POSTGRES_DB:-lobster_park}" > "$snapshot_dir/postgres.sql" 2>/dev/null; then
      log "postgres backup created: $snapshot_dir/postgres.sql"
    else
      warn 'postgres backup failed; continuing without sql dump'
    fi
  fi

  printf '%s\n' "$snapshot_dir"
}
