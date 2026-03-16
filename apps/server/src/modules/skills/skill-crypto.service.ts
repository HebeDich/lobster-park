import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Skill 内容加解密服务
 * 使用 AES-256-GCM 对 Skill 的 contentJson 进行加密存储，
 * 密钥派生自环境变量 SECRET_MASTER_KEY。
 */
@Injectable()
export class SkillCryptoService {
  private readonly key: Buffer;

  constructor() {
    const masterKey = process.env.SECRET_MASTER_KEY || '';
    this.key = createHash('sha256').update(masterKey || 'lobster-park-default-key').digest();
  }

  /** 加密 JSON 对象，返回 base64 编码的密文字符串 */
  encrypt(plainObject: unknown): string {
    const plainText = JSON.stringify(plainObject);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // 格式: iv(12) + tag(16) + ciphertext
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  /** 解密 base64 编码的密文字符串，返回 JSON 对象 */
  decrypt(cipherBase64: string): unknown {
    const buf = Buffer.from(cipherBase64, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  /** 计算内容的 SHA-256 哈希 */
  hash(content: unknown): string {
    return createHash('sha256').update(JSON.stringify(content)).digest('hex');
  }
}
