import { Injectable, NotFoundException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import type { Response } from 'express';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildWorkspaceArchiveName } from './openclaw-terminal.service';

@Injectable()
export class OpenClawWorkspaceExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
  ) {}

  async downloadWorkspace(currentUser: RequestUserContext, instanceId: string, response: Response) {
    const instance = await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const binding = await this.prisma.runtimeBinding.findUnique({
      where: { instanceId },
      select: { workspacePath: true },
    });
    const workspacePath = binding?.workspacePath?.trim();
    if (!workspacePath) {
      throw new NotFoundException('实例工作区不存在');
    }

    await fs.access(workspacePath).catch(() => {
      throw new NotFoundException('实例工作区不存在');
    });

    const exportedAt = new Date();
    const archiveName = buildWorkspaceArchiveName({
      instanceId,
      instanceName: instance.name,
      exportedAt,
    });
    const tarBin = process.env.TAR_BIN || 'tar';
    const child = spawn(tarBin, ['-czf', '-', '-C', workspacePath, '.'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', async (error) => {
      await this.auditService.record({
        tenantId: currentUser.tenantId,
        actionType: 'instance.workspace.export',
        actionResult: 'failed',
        operatorUserId: currentUser.id,
        targetType: 'instance_workspace',
        targetId: instanceId,
        summary: `Failed to export workspace for ${instance.name}`,
        riskLevel: 'medium',
        metadataJson: { error: error.message },
      });
      if (!response.headersSent) {
        response.status(500).json({ message: error.message });
      }
    });
    child.on('close', async (code) => {
      const success = code === 0;
      await this.auditService.record({
        tenantId: currentUser.tenantId,
        actionType: 'instance.workspace.export',
        actionResult: success ? 'success' : 'failed',
        operatorUserId: currentUser.id,
        targetType: 'instance_workspace',
        targetId: instanceId,
        summary: `${success ? 'Exported' : 'Failed to export'} workspace for ${instance.name}`,
        riskLevel: 'medium',
        afterJson: success ? { archiveName, workspacePath } : undefined,
        metadataJson: success ? { archiveName } : { archiveName, stderr: stderr.trim(), exitCode: code },
      });
      if (!success && !response.destroyed) {
        response.destroy(new Error(stderr.trim() || `workspace export failed with code ${code ?? 1}`));
      }
    });
    response.setHeader('Content-Type', 'application/gzip');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(archiveName)}`);
    response.setHeader('Cache-Control', 'no-store');
    child.stdout.pipe(response);
    response.on('close', () => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    });
  }
}
