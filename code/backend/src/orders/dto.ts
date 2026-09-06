import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemInDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  product_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value ? String(value).trim().toUpperCase() : value))
  @IsString()
  sku?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class OrderCreateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customer_id?: number;

  @ApiPropertyOptional({ example: 'ada@example.com' })
  @IsOptional()
  @Transform(({ value }) => (value ? String(value).trim().toLowerCase() : value))
  @IsEmail()
  customer_email?: string;

  @ApiProperty({ type: [OrderItemInDto] })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  items!: OrderItemInDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string = '';
}
