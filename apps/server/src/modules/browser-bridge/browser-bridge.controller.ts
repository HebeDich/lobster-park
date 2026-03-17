import { existsSync } from 'node:fs';
import path from 'node:path';
import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import AdmZip from 'adm-zip';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { BrowserBridgeService } from './browser-bridge.service';

const EXTENSION_FILES = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

function resolveExtensionDir(): string | null {
  const candidates = [
    // dev 模式: __dirname = apps/server/src/modules/browser-bridge/
    path.resolve(__dirname, '../../../../../packages/browser-bridge-extension'),
    // build 模式: __dirname = dist/apps/server/src/modules/browser-bridge/
    path.resolve(__dirname, '../../../../../../packages/browser-bridge-extension'),
    // cwd = 项目根目录
    path.resolve(process.cwd(), 'packages/browser-bridge-extension'),
    // cwd = apps/server/
    path.resolve(process.cwd(), '../../packages/browser-bridge-extension'),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'manifest.json'))) return dir;
  }
  return null;
}

@Controller()
export class BrowserBridgeController {
  constructor(private readonly bridgeService: BrowserBridgeService) {}

  /**
   * 查询当前用户的浏览器扩展连接状态
   */
  @Get('browser-bridge/status')
  getStatus(@CurrentUser() currentUser: RequestUserContext) {
    return {
      connected: this.bridgeService.isUserConnected(currentUser.id),
      userId: currentUser.id,
    };
  }

  /**
   * 管理员：查询所有已连接的扩展
   */
  @Get('browser-bridge/connections')
  listConnections(@CurrentUser() currentUser: RequestUserContext) {
    if (!currentUser.roles.includes('platform_admin')) {
      return { items: [] };
    }
    return { items: this.bridgeService.getConnectedUsers() };
  }

  /**
   * 下载浏览器桥接扩展 zip 包
   */
  @Get('browser-bridge/download')
  downloadExtension(@Res() res: Response) {
    const extDir = resolveExtensionDir();
    if (!extDir) {
      res.status(404).json({
        message: '扩展文件未找到',
        debug: {
          __dirname,
          cwd: process.cwd(),
          candidates: [
            path.resolve(__dirname, '../../../../../packages/browser-bridge-extension'),
            path.resolve(__dirname, '../../../../../../packages/browser-bridge-extension'),
            path.resolve(process.cwd(), 'packages/browser-bridge-extension'),
            path.resolve(process.cwd(), '../../packages/browser-bridge-extension'),
          ],
        },
      });
      return;
    }
    const zip = new AdmZip();
    for (const file of EXTENSION_FILES) {
      const filePath = path.join(extDir, file);
      if (existsSync(filePath)) {
        const dirInZip = path.dirname(file) === '.' ? '' : path.dirname(file);
        zip.addLocalFile(filePath, dirInZip);
      }
    }
    const buffer = zip.toBuffer();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="lobster-browser-bridge.zip"',
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  /**
   * 向当前用户的浏览器扩展发送指令
   */
  @Post('browser-bridge/execute')
  async execute(
    @CurrentUser() currentUser: RequestUserContext,
    @Body() body: { action: string; params?: Record<string, unknown>; timeout?: number },
  ) {
    if (!body.action) {
      return { success: false, error: '缺少 action 参数' };
    }
    try {
      const result = await this.bridgeService.executeCommand(
        currentUser.id,
        body.action,
        body.params ?? {},
        body.timeout ?? 30_000,
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * 向指定用户的浏览器扩展发送指令（管理员或内部调用）
   */
  @Post('browser-bridge/execute/:userId')
  async executeForUser(
    @CurrentUser() currentUser: RequestUserContext,
    @Param('userId') userId: string,
    @Body() body: { action: string; params?: Record<string, unknown>; timeout?: number },
  ) {
    if (!currentUser.roles.includes('platform_admin') && currentUser.id !== userId) {
      return { success: false, error: '无权操作' };
    }
    if (!body.action) {
      return { success: false, error: '缺少 action 参数' };
    }
    try {
      const result = await this.bridgeService.executeCommand(
        userId,
        body.action,
        body.params ?? {},
        body.timeout ?? 30_000,
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
