import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // AuthModule, ProxyModule — A-2-1에서 구현
  ],
})
export class AppModule {}
