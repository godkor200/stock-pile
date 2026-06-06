import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { UserEntity } from '@stock-pile/db-schema';

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const u = new UserEntity();
  u.id = 'uuid-existing';
  u.email = 'uuid-existing@local';
  u.passwordHash = 'none';
  u.telegramUserId = null;
  return Object.assign(u, overrides);
}

function buildService(repo: Partial<Repository<UserEntity>>): UsersService {
  return new UsersService(repo as unknown as Repository<UserEntity>);
}

describe('UsersService', () => {
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

  describe('findOrCreate', () => {
    it('기존 유저가 있으면 그대로 반환하고 save를 호출하지 않는다', async () => {
      const existing = makeUser();
      userRepo.findOne.mockResolvedValue(existing);

      const result = await buildService(userRepo).findOrCreate('uuid-existing');

      expect(result).toBe(existing);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('존재하지 않는 userId → 새 유저 생성 후 반환', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const newUser = makeUser({ id: 'new-uuid', email: 'new-uuid@local' });
      userRepo.create.mockReturnValue(newUser);
      userRepo.save.mockResolvedValue(newUser);

      const result = await buildService(userRepo).findOrCreate('new-uuid');

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-uuid',
          email: 'new-uuid@local',
          passwordHash: 'none',
          telegramUserId: null,
        }),
      );
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('new-uuid');
    });

    it('이메일은 <userId>@local 패턴으로 자동 생성된다', async () => {
      const userId = 'abc-123';
      userRepo.findOne.mockResolvedValue(null);
      const created = makeUser({ id: userId, email: `${userId}@local` });
      userRepo.create.mockReturnValue(created);
      userRepo.save.mockResolvedValue(created);

      await buildService(userRepo).findOrCreate(userId);

      const createArg = (userRepo.create as jest.Mock).mock.calls[0][0] as {
        email: string;
      };
      expect(createArg.email).toBe('abc-123@local');
    });

    it('같은 userId로 두 번 호출해도 DB 조회는 두 번 일어난다', async () => {
      const existing = makeUser();
      userRepo.findOne.mockResolvedValue(existing);

      const service = buildService(userRepo);
      await service.findOrCreate('uuid-existing');
      await service.findOrCreate('uuid-existing');

      expect(userRepo.findOne).toHaveBeenCalledTimes(2);
    });
  });
});
