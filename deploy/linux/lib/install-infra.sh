#!/bin/bash
set -euo pipefail

start_infra() {
  load_env_file
  docker_compose_infra up -d postgres redis
  wait_for_container_healthy lobster-park-postgres 30 2 || fail 'postgres did not become healthy in time'
  wait_for_container_healthy lobster-park-redis 30 2 || fail 'redis did not become healthy in time'
}

stop_infra() {
  if [ -f "$LP_CURRENT_LINK/infra/docker-compose.yml" ] && [ -f "$LP_ENV_FILE" ]; then
    docker_compose_infra stop postgres redis >/dev/null 2>&1 || true
  fi
}

destroy_infra() {
  if [ -f "$LP_CURRENT_LINK/infra/docker-compose.yml" ] && [ -f "$LP_ENV_FILE" ]; then
    docker_compose_infra down -v >/dev/null 2>&1 || true
  fi
}
