import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Injectable, BadRequestException } from '@nestjs/common';

const execFileAsync = promisify(execFile);
const DEFAULT_SKILLS_DIR = process.env.SKILL_STORAGE_DIR || '/opt/lobster-park/skills';
const MAX_PACKAGE_SIZE = 50 * 1024 * 1024; // 50MB

export type SkillManifest = {
  name: string;
  version: string;
  description?: string;
  type?: string;
  entry?: string;
  promptFiles?: string[];
  tools?: string[];
};

/**
 * Skill 文件存储服务
 * 负责 ZIP 包上传、解压、校验和文件系统存储。
 * 解压使用系统 unzip 命令（Linux 服务器普遍可用）。
 */
@Injectable()
export class SkillStorageService {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = DEFAULT_SKILLS_DIR;
  }

  /** 获取 Skill 存储的根目录 */
  getBaseDir(): string {
    return this.baseDir;
  }

  /** 获取指定 Skill 版本的存储路径 */
  getSkillDir(skillId: string, version: string): string {
    return path.join(this.baseDir, skillId, version);
  }

  /**
   * 保存上传的 ZIP 包并解压到目标目录
   * @returns 解压后的目录路径和 skill.json 内容
   */
  async saveZipPackage(skillId: string | null, zipBuffer: Buffer): Promise<{ storagePath: string; manifest: SkillManifest; packageSize: number }> {
    if (zipBuffer.length > MAX_PACKAGE_SIZE) {
      throw new BadRequestException(`ZIP 包大小超过限制 (${MAX_PACKAGE_SIZE / 1024 / 1024}MB)`);
    }

    // 先解压到临时目录以读取 manifest
    const tempId = skillId || `_tmp_${Date.now()}`;
    const tempDir = path.join(this.baseDir, tempId, '_upload_tmp');
    await rm(tempDir, { recursive: true, force: true });
    await mkdir(tempDir, { recursive: true });

    const zipPath = path.join(tempDir, '_package.zip');
    await writeFile(zipPath, zipBuffer);

    const extractDir = path.join(tempDir, 'content');
    await mkdir(extractDir, { recursive: true });

    try {
      await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', extractDir]);
    } catch {
      await rm(tempDir, { recursive: true, force: true });
      throw new BadRequestException('ZIP 文件解压失败，请确认文件格式正确且服务器已安装 unzip 命令');
    }

    const manifestPath = path.join(extractDir, 'skill.json');
    let manifest: SkillManifest;
    try {
      const raw = await readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(raw) as SkillManifest;
    } catch {
      await rm(tempDir, { recursive: true, force: true });
      throw new BadRequestException('ZIP 包中缺少 skill.json 或格式不正确');
    }

    if (!manifest.name || !manifest.version) {
      await rm(tempDir, { recursive: true, force: true });
      throw new BadRequestException('skill.json 必须包含 name 和 version 字段');
    }

    // 移动到最终目录 baseDir/{skillId}/{version}/content
    const finalSkillId = skillId || tempId;
    const finalDir = this.getSkillDir(finalSkillId, manifest.version);
    if (finalDir !== tempDir) {
      await rm(finalDir, { recursive: true, force: true });
      await mkdir(path.dirname(finalDir), { recursive: true });
      await rename(tempDir, finalDir);
    }

    const finalExtractDir = path.join(finalDir, 'content');

    return {
      storagePath: finalExtractDir,
      manifest,
      packageSize: zipBuffer.length,
    };
  }

  /** 读取已存储的 Skill 文件内容 */
  async readSkillFile(storagePath: string, relativePath: string): Promise<string> {
    const fullPath = path.resolve(storagePath, relativePath);
    if (!fullPath.startsWith(path.resolve(storagePath))) {
      throw new BadRequestException('非法文件路径');
    }
    return readFile(fullPath, 'utf-8');
  }

  /** 读取 Skill 的 manifest 文件 */
  async readManifest(storagePath: string): Promise<SkillManifest> {
    const raw = await readFile(path.join(storagePath, 'skill.json'), 'utf-8');
    return JSON.parse(raw) as SkillManifest;
  }

  /** 删除 Skill 存储目录 */
  async removeSkillStorage(skillId: string): Promise<void> {
    const skillDir = path.join(this.baseDir, skillId);
    await rm(skillDir, { recursive: true, force: true });
  }

  /** 检查 Skill 存储路径是否存在 */
  async exists(storagePath: string): Promise<boolean> {
    try {
      await stat(storagePath);
      return true;
    } catch {
      return false;
    }
  }
}
