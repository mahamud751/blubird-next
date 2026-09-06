import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength, MinLength } from 'class-validator';

export class CustomerCreateDto {
  @ApiProperty({ example: 'ada@example.com' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @Transform(({ value }) => String(value ?? '').trim())
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
