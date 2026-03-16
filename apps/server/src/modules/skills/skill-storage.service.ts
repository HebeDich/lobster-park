import { mkdir, readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { Injectable, BadRequestException } from '@nestjs/common';

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
 * 解压使用 adm-zip 库（纯 Node.js，无需系统 unzip 命令）。
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

    const extractDir = path.join(tempDir, 'content');
    await mkdir(extractDir, { recursive: true });

    try {
      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(extractDir, true);
    } catch (err) {
      await rm(tempDir, { recursive: true, force: true });
      throw new BadRequestException(`ZIP 文件解压失败，请确认文件格式正确: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 查找 manifest：先查找 skill.json（任意层级），再回退到自动推断
    let manifest: SkillManifest | null = null;
    manifest = await this.findAndParseManifest(extractDir);
    if (!manifest) {
      manifest = await this.inferManifestRecursive(extractDir);
    }

    if (!manifest || !manifest.name || !manifest.version) {
      await rm(tempDir, { recursive: true, force: true });
      throw new BadRequestException('无法确定技能名称和版本。请在 ZIP 包中包含 skill.json，或至少包含一个 .md 文件');
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

  /** 递归查找并解析 skill.json（支持嵌套子目录） */
  private async findAndParseManifest(dir: string): Promise<SkillManifest | null> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && entry.name === 'skill.json') {
        try {
          const raw = await readFile(path.join(dir, entry.name), 'utf-8');
          const manifest = JSON.parse(raw) as SkillManifest;
          if (manifest.name && manifest.version) return manifest;
        } catch { /* 忽略解析失败 */ }
      }
    }
    // 递归子目录（最多 2 层）
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
        const found = await this.findAndParseManifest(path.join(dir, entry.name));
        if (found) return found;
      }
    }
    return null;
  }

  /** 递归扫描 .md 文件推断 manifest（无 skill.json 时的回退逻辑） */
  private async inferManifestRecursive(dir: string): Promise<SkillManifest | null> {
    const allMdFiles: string[] = [];
    await this.collectMdFiles(dir, dir, allMdFiles);

    if (allMdFiles.length === 0) return null;

    // 优先匹配特定文件名
    const entry = allMdFiles.find((f: string) => path.basename(f) === 'skill.md')
      || allMdFiles.find((f: string) => path.basename(f).toLowerCase() === 'readme.md')
      || allMdFiles[0];

    const baseName = path.basename(entry, '.md');
    const name = baseName === 'skill' || baseName.toLowerCase() === 'readme'
      ? 'uploaded-skill'
      : baseName;

    return {
      name,
      version: '1.0.0',
      type: 'prompt',
      entry,
      promptFiles: allMdFiles,
    };
  }

  /** 递归收集 .md 文件（相对路径） */
  private async collectMdFiles(baseDir: string, currentDir: string, result: string[]): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
        await this.collectMdFiles(baseDir, fullPath, result);
      } else if (!entry.isDirectory() && entry.name.endsWith('.md')) {
        result.push(path.relative(baseDir, fullPath));
      }
    }
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
