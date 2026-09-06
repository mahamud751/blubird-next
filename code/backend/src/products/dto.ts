import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,62}$/;

export class ProductCreateDto {
  @ApiProperty({ example: 'NMB-ANC-01' })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @Matches(SKU_RE, { message: 'sku must be uppercase letters, digits, and hyphens' })
  @MinLength(2)
  @MaxLength(64)
  sku!: string;

  @ApiProperty()
  @Transform(({ value }) => String(value ?? '').trim())
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string = '';

  @ApiPropertyOptional()
  @Transform(({ value }) => {
    const cleaned = String(value ?? 'general').trim();
    return cleaned || 'general';
  })
  @MinLength(1)
  @MaxLength(80)
  category?: string = 'general';

  @ApiProperty({ example: 18900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price_cents!: number;

  @ApiPropertyOptional({ example: 'USD' })
  @Transform(({ value }) => String(value ?? 'USD').trim().toUpperCase())
  @MinLength(3)
  @MaxLength(3)
  currency?: string = 'USD';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number = 0;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown> = {};

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  image_url?: string = '';
}

export class ProductUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @ValidateIf((_, v) => v != null)
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @ValidateIf((_, v) => v != null)
  @MinLength(1)
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price_cents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  image_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  in_stock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
