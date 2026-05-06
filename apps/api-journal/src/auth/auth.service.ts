import * as crypto from 'crypto';
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '@stock-pile/db-schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = config.get('JWT_SECRET', 'fallback-dev-secret');
  }

  /** 이메일 + 비밀번호로 회원가입 */
  async signup(email: string, password: string): Promise<{ userId: string; token: string }> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('이미 사용 중인 이메일입니다.');

    const passwordHash = this.hashPassword(password);
    const user = this.userRepo.create({ email, passwordHash, telegramUserId: null });
    const saved = await this.userRepo.save(user);

    this.logger.log(`회원가입: ${email}`);
    const token = this.createToken(saved.id);
    return { userId: saved.id, token };
  }

  /** 이메일 + 비밀번호로 로그인 */
  async login(email: string, password: string): Promise<{ userId: string; token: string }> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    this.logger.log(`로그인: ${email}`);
    const token = this.createToken(user.id);
    return { userId: user.id, token };
  }

  // ── 내부 유틸 ───────────────────────────────────────────

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    if (storedHash === 'none') return false;
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    try {
      const derived = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }

  /** HMAC-SHA256 기반 간단 토큰 (Node 내장 crypto만 사용) */
  private createToken(userId: string): string {
    const payload = Buffer.from(JSON.stringify({ sub: userId, iat: Date.now() })).toString('base64url');
    const sig = crypto.createHmac('sha256', this.jwtSecret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }
}
