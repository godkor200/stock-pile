import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * 최초 방문 시 호출 — UUID로 사용자를 자동 생성하거나 기존 사용자를 반환
   */
  @Post('init')
  @ApiOperation({ summary: '사용자 초기화 (없으면 자동 생성)' })
  async init(@Headers('x-user-id') userId: string) {
    if (!userId) throw new UnauthorizedException();
    const user = await this.users.findOrCreate(userId);
    return { userId: user.id };
  }
}
