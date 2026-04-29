import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '@stock-pile/db-schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * userId(UUID)로 사용자 조회, 없으면 자동 생성
   * 개인용 MVP: 이메일/비밀번호 없이 UUID 기반 식별
   */
  async findOrCreate(userId: string): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { id: userId } });
    if (existing) return existing;

    const user = this.userRepo.create({
      id: userId,
      email: `${userId}@local`,
      passwordHash: 'none',
      telegramUserId: null,
    });
    return this.userRepo.save(user);
  }
}
