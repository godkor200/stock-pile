import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ example: '005930' })
  @IsString()
  @IsNotEmpty()
  ticker!: string;
}
