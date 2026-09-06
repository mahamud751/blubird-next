import { Body, Controller, Get, Header, HttpCode, Param, Post, Res } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { extname, join } from 'path';
import { ImporterService } from './importer.service';
import { AppSettings } from '../config/app.config';
import { AppError } from '../common/errors';

class ImportRequestDto {
  @ApiProperty({ example: 'http://127.0.0.1:8000/sample-catalogs/import_catalog.json' })
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dry_run?: boolean = false;
}

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@ApiTags('operator')
@Controller()
export class OperatorController {
  constructor(
    private readonly importer: ImporterService,
    private readonly settings: AppSettings,
  ) {}

  @Post('api/v1/operator/imports')
  @HttpCode(200)
  importCatalog(@Body() body: ImportRequestDto) {
    return this.importer.importFromUrl(body.url, body.dry_run ?? false);
  }

  @Get('sample-catalogs/:name')
  serveSample(@Param('name') name: string, @Res() res: Response) {
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new AppError('NOT_FOUND', 'not found', 404);
    }
    const path = join(this.settings.fixturesDir, name);
    if (!existsSync(path)) throw new AppError('NOT_FOUND', 'not found', 404);
    res.setHeader('Content-Type', MIME[extname(name).toLowerCase()] || 'application/octet-stream');
    createReadStream(path).pipe(res);
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index() {
    return `<!doctype html><html><head><title>Field &amp; Wren API</title></head><body>
      <h1>Field &amp; Wren</h1>
      <p>Storefront lives on the Next.js app. Open <a href="http://127.0.0.1:3000">http://127.0.0.1:3000</a>.</p>
      <p><a href="/docs">OpenAPI</a> · <a href="/operator">Operator</a></p>
    </body></html>`;
  }

  @Get('operator')
  @Header('Content-Type', 'text/html; charset=utf-8')
  operatorPage() {
    return `<!doctype html><html><head><title>Operator · Field &amp; Wren</title></head><body>
      <h1>Operator import</h1>
      <p>Use the Next.js operator UI at <a href="http://127.0.0.1:3000/operator">/operator</a>.</p>
    </body></html>`;
  }
}
