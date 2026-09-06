import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChatTurnDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsIn(['user', 'assistant'], { message: 'role must be user or assistant' })
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

export class ChatRequestDto {
  @ApiProperty({ example: 'Does the rain shell have insulation?' })
  @Transform(({ value }) => String(value ?? '').trim())
  @MinLength(1, { message: 'message must not be blank' })
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ type: [ChatTurnDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  @ArrayMaxSize(20)
  history?: ChatTurnDto[] = [];

  @ApiPropertyOptional({ example: 'ada@example.com' })
  @IsOptional()
  @Transform(({ value }) => (value ? String(value).trim().toLowerCase() : value))
  @IsEmail()
  customer_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_id?: string;
}
