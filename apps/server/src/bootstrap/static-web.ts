import { existsSync } from 'node:fs';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import express from 'express';

const RESERVED_PREFIXES = ['/api', '/ws'];
const RESERVED_PATHS = new Set(['/health', '/ready', '/metrics', '/info']);

type ResolveStaticWebOptions = {
  cwd?: string;
  currentDir?: string;
  env?: NodeJS.ProcessEnv;
};

function resolveCandidatePath(candidate: string, cwd: string) {
  return path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate);
}

function hasIndexHtml(candidate: string) {
  return existsSync(path.join(candidate, 'index.html'));
}

export function shouldServeSpaIndex(requestPath: string) {
  if (!requestPath || requestPath === '/') return true;
  if (RESERVED_PATHS.has(requestPath)) return false;
  if (RESERVED_PREFIXES.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`))) return false;
  return !path.extname(requestPath);
}

export function resolveStaticWebDistDir(options: ResolveStaticWebOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const currentDir = options.currentDir ?? __dirname;
  const env = options.env ?? process.env;
  const candidates: string[] = [];

  if (typeof env.WEB_DIST_DIR === 'string' && env.WEB_DIST_DIR.trim()) {
    candidates.push(resolveCandidatePath(env.WEB_DIST_DIR.trim(), cwd));
  }

  candidates.push(
    path.resolve(currentDir, '../../../../../web/dist'),
    path.resolve(cwd, 'apps/web/dist'),
  );

  for (const candidate of candidates) {
    if (hasIndexHtml(candidate)) return candidate;
  }

  return null;
}

export function registerStaticWeb(app: INestApplication, webDistDir: string) {
  const instance = app.getHttpAdapter().getInstance() as express.Express;
  const indexFilePath = path.join(webDistDir, 'index.html');

  instance.use(express.static(webDistDir, { index: false }));
  instance.get('*', (request, response, next) => {
    if (request.method !== 'GET' || !shouldServeSpaIndex(request.path)) {
      next();
      return;
    }
    response.sendFile(indexFilePath);
  });
}
