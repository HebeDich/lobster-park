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

    const manifestPath = path.join(extractDir, 'skill.json');
    let manifest: SkillManifest;
    try {
      const raw = await readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(raw) as SkillManifest;
    } catch {
      // 没有 skill.json，尝试从文件内容自动推断 manifest
      manifest = await this.inferManifest(extractDir);
    }

    if (!manifest.name || !manifest.version) {
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

  /** 从解压目录中自动推断 manifest（无 skill.json 时的回退逻辑） */
  private async inferManifest(extractDir: string): Promise<SkillManifest> {
    const files = await readdir(extractDir);
    // 优先查找 skill.md / README.md / 任意 .md 文件作为入口
    const mdFiles = files.filter((f: string) => f.endsWith('.md'));
    const entry = mdFiles.find((f: string) => f === 'skill.md')
      || mdFiles.find((f: string) => f.toLowerCase() === 'readme.md')
      || mdFiles[0];

    if (!entry) {
      return { name: '', version: '' };
    }

    // 用入口文件名（去后缀）作为 skill 名称
    const baseName = path.basename(entry, path.extname(entry));
    const name = baseName === 'skill' || baseName.toLowerCase() === 'readme'
      ? path.basename(extractDir) || 'unnamed-skill'
      : baseName;

    return {
      name,
      version: '1.0.0',
      type: 'prompt',
      entry,
      promptFiles: mdFiles,
    };
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
