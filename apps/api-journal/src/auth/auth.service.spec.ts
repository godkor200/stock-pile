import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UserEntity } from '@stock-pile/db-schema';

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const u = new UserEntity();
  u.id = 'uuid-1';
  u.email = 'test@example.com';
  u.passwordHash = 'none';
  u.telegramUserId = null;
  return Object.assign(u, overrides);
}

function buildService(
  userRepo: Partial<Repository<UserEntity>>,
  jwtSecret = 'test-secret',
): AuthService {
  const config = {
    get: jest.fn((key: string, def: unknown) => (key === 'JWT_SECRET' ? jwtSecret : def)),
  } as unknown as ConfigService;
  return new AuthService(userRepo as unknown as Repository<UserEntity>, config);
}

describe('AuthService', () => {
  let userRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ── signup ────────────────────────────────────────────────────────
  describe('signup', () => {
    it('신규 이메일 → userId와 token 반환', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const saved = makeUser({ id: 'new-uuid' });
      userRepo.create.mockReturnValue(saved);
      userRepo.save.mockResolvedValue(saved);

      const result = await buildService(userRepo).signup('new@example.com', 'password123');

      expect(result.userId).toBe('new-uuid');
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.').length).toBe(2);
    });

    it('이미 존재하는 이메일 → ConflictException', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());

      await expect(
        buildService(userRepo).signup('test@example.com', 'password123'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('저장 전 비밀번호가 해싱된다 (평문 저장 안 됨)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const saved = makeUser();
      userRepo.create.mockReturnValue(saved);
      userRepo.save.mockResolvedValue(saved);

      await buildService(userRepo).signup('a@b.com', 'mypassword');

      const createArg = (userRepo.create as jest.Mock).mock.calls[0][0] as {
        passwordHash: string;
      };
      expect(createArg.passwordHash).not.toBe('mypassword');
      expect(createArg.passwordHash).toContain(':');
    });
  });

  // ── login ─────────────────────────────────────────────────────────
  describe('login', () => {
    it('올바른 이메일+비밀번호 → userId와 token 반환', async () => {
      const service = buildService(userRepo);

      // signup으로 hash 생성 후 재사용
      userRepo.findOne.mockResolvedValue(null);
      const tmpUser = makeUser({ id: 'login-uuid' });
      userRepo.create.mockReturnValue(tmpUser);
      userRepo.save.mockResolvedValue(tmpUser);
      await service.signup('login@example.com', 'secret');

      const createArg = (userRepo.create as jest.Mock).mock.calls[0][0] as {
        passwordHash: string;
      };
      const storedUser = makeUser({ id: 'login-uuid', passwordHash: createArg.passwordHash });
      userRepo.findOne.mockResolvedValue(storedUser);

      const result = await service.login('login@example.com', 'secret');
      expect(result.userId).toBe('login-uuid');
      expect(typeof result.token).toBe('string');
    });

    it('잘못된 비밀번호 → UnauthorizedException', async () => {
      const service = buildService(userRepo);

      userRepo.findOne.mockResolvedValue(null);
      const tmpUser = makeUser();
      userRepo.create.mockReturnValue(tmpUser);
      userRepo.save.mockResolvedValue(tmpUser);
      await service.signup('x@example.com', 'rightpass');

      const createArg = (userRepo.create as jest.Mock).mock.calls[0][0] as {
        passwordHash: string;
      };
      const storedUser = makeUser({ passwordHash: createArg.passwordHash });
      userRepo.findOne.mockResolvedValue(storedUser);

      await expect(service.login('x@example.com', 'wrongpass')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('존재하지 않는 이메일 → UnauthorizedException', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        buildService(userRepo).login('nouser@example.com', 'any'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('passwordHash가 "none"인 유저 → UnauthorizedException', async () => {
      const user = makeUser({ passwordHash: 'none' });
      userRepo.findOne.mockResolvedValue(user);

      await expect(
        buildService(userRepo).login('test@example.com', 'any'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ── token 형식 ────────────────────────────────────────────────────
  describe('token', () => {
    it('발급된 토큰에 userId(sub)가 포함된다', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const saved = makeUser({ id: 'sub-uuid' });
      userRepo.create.mockReturnValue(saved);
      userRepo.save.mockResolvedValue(saved);

      const { token } = await buildService(userRepo).signup('tok@example.com', 'pw');
      const [payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      expect(payload.sub).toBe('sub-uuid');
    });
  });
});
