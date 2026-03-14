import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildWorkspaceArchiveName,
  ensureNodePtySpawnHelperExecutable,
  resolveOpenClawTerminalLaunchSpec,
  type TerminalRuntimeBinding,
} from './openclaw-terminal.service';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const current = tempDirs.pop();
    if (current) {
      rmSync(current, { recursive: true, force: true });
    }
  }
});

describe('openclaw terminal service helpers', () => {
  it('resolves a host shell launch spec for process runtimes', () => {
    const binding: TerminalRuntimeBinding = {
      instanceId: 'ins_demo',
      isolationMode: 'process',
      workspacePath: '/opt/lobster/runtimes/ins_demo/workspace',
      processId: '12345',
      startedAt: new Date('2026-03-13T10:00:00.000Z'),
    };

    const spec = resolveOpenClawTerminalLaunchSpec(binding, {
      instanceId: 'ins_demo',
      shellPath: '/bin/sh',
    });

    expect(spec.executionTarget).toBe('host');
    expect(spec.command).toBe('/bin/sh');
    expect(spec.args).toEqual([]);
    expect(spec.cwd).toBe('/opt/lobster/runtimes/ins_demo/workspace');
  });

  it('resolves docker exec launch spec for running container runtimes', () => {
    const binding: TerminalRuntimeBinding = {
      instanceId: 'ins_demo',
      isolationMode: 'container',
      workspacePath: '/opt/lobster/runtimes/ins_demo/workspace',
      processId: 'ctr_abc123',
      startedAt: new Date('2026-03-13T10:00:00.000Z'),
    };

    const spec = resolveOpenClawTerminalLaunchSpec(binding, {
      instanceId: 'ins_demo',
      dockerBin: 'docker',
      shellPath: '/bin/sh',
    });

    expect(spec.executionTarget).toBe('container');
    expect(spec.command).toBe('docker');
    expect(spec.args).toEqual(['exec', '-it', '-w', '/runtime/workspace', 'ctr_abc123', 'sh']);
    expect(spec.cwd).toBe('/runtime/workspace');
  });

  it('rejects terminal launch when a container runtime is stopped', () => {
    const binding: TerminalRuntimeBinding = {
      instanceId: 'ins_demo',
      isolationMode: 'container',
      workspacePath: '/opt/lobster/runtimes/ins_demo/workspace',
      processId: 'ctr_abc123',
      startedAt: null,
    };

    expect(() => resolveOpenClawTerminalLaunchSpec(binding, {
      instanceId: 'ins_demo',
      dockerBin: 'docker',
      shellPath: '/bin/sh',
    })).toThrow('实例未运行');
  });

  it('builds a stable workspace archive name', () => {
    expect(buildWorkspaceArchiveName({
      instanceId: 'ins_demo',
      instanceName: '研发助手 / Demo',
      exportedAt: new Date('2026-03-13T10:11:12.000Z'),
    })).toBe('研发助手-demo-ins_demo-workspace-20260313-101112.tar.gz');
  });

  it('repairs missing execute permission on node-pty spawn helper', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'node-pty-helper-'));
    tempDirs.push(root);
    const helperPath = path.join(root, 'prebuilds', 'darwin-arm64', 'spawn-helper');
    mkdirSync(path.dirname(helperPath), { recursive: true });
    writeFileSync(helperPath, '#!/bin/sh\nexit 0\n', { mode: 0o644 });
    chmodSync(helperPath, 0o644);

    const resolved = ensureNodePtySpawnHelperExecutable({
      platform: 'darwin',
      arch: 'arm64',
      packageRoot: root,
    });

    expect(resolved).toBe(helperPath);
    expect(statSync(helperPath).mode & 0o111).toBe(0o111);
  });
});
