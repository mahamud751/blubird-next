import { Injectable } from '@nestjs/common';
import { AppError } from '../common/errors';
import { AppSettings } from '../config/app.config';
import { ProductsService } from '../products/products.service';
import { ProductCreateDto, ProductUpdateDto } from '../products/dto';
import { detectAndParse, normalizeRow } from './parsers';
import { assertUrlAllowed } from './ssrf';

export type FetchTransport = (url: string) => Promise<{
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  url: string;
}>;

@Injectable()
export class ImporterService {
  transport: FetchTransport | null = null;

  constructor(
    private readonly products: ProductsService,
    private readonly settings: AppSettings,
  ) {}

  setTransport(transport: FetchTransport | null) {
    this.transport = transport;
  }

  private async fetchOnce(url: string): Promise<{
    status: number;
    headers: Record<string, string>;
    body: Buffer;
    url: string;
  }> {
    if (this.transport) return this.transport(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.settings.importTimeoutSeconds * 1000);
    try {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'FieldWrenImporter/1.0', Accept: '*/*' },
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const body = Buffer.from(await response.arrayBuffer());
      return { status: response.status, headers, body, url: response.url || url };
    } catch (exc) {
      throw new AppError('FETCH_FAILED', 'could not fetch URL', 400, {
        reason: String(exc).slice(0, 200),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchUrl(url: string): Promise<{ contentType: string; content: Buffer; finalUrl: string }> {
    let current = url;
    for (let hop = 0; hop < 4; hop++) {
      await assertUrlAllowed(current, this.settings.allowedImportHosts);
      let response: Awaited<ReturnType<ImporterService['fetchOnce']>>;
      try {
        response = await this.fetchOnce(current);
      } catch (exc) {
        if (exc instanceof AppError) throw exc;
        throw new AppError('FETCH_FAILED', 'could not fetch URL', 400, {
          reason: String(exc).slice(0, 200),
        });
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.location || response.headers.Location;
        if (!location) throw new AppError('FETCH_FAILED', 'redirect with no Location header');
        current = new URL(location, response.url).toString();
        continue;
      }
      if (response.status >= 400) {
        throw new AppError('FETCH_FAILED', `upstream returned HTTP ${response.status}`, 400, {
          status: response.status,
        });
      }
      if (response.body.length > this.settings.importMaxBytes) {
        throw new AppError(
          'PAYLOAD_TOO_LARGE',
          `response exceeds ${this.settings.importMaxBytes} bytes`,
          413,
        );
      }
      const contentType = response.headers['content-type'] || '';
      return { contentType, content: response.body, finalUrl: response.url };
    }
    throw new AppError('TOO_MANY_REDIRECTS', 'stopped after 3 redirects');
  }

  async importFromUrl(url: string, dryRun = false) {
    const { contentType, content, finalUrl } = await this.fetchUrl(url);
    const [source, rows] = detectAndParse(contentType, content, finalUrl);
    if (rows.length > this.settings.importMaxProducts) {
      throw new AppError(
        'TOO_MANY_PRODUCTS',
        `refusing more than ${this.settings.importMaxProducts} products in one import`,
      );
    }

    const created: string[] = [];
    const updated: string[] = [];
    const skipped: Array<{ row: number; sku?: string; reason: string }> = [];
    const seen = new Set<string>();

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 1;
      let record: Record<string, unknown>;
      try {
        record = normalizeRow(rows[index] as Record<string, unknown>, rowNumber);
      } catch (exc) {
        skipped.push({ row: rowNumber, reason: String((exc as Error).message) });
        continue;
      }
      const sku = String(record.sku);
      if (seen.has(sku)) {
        skipped.push({ row: rowNumber, sku, reason: 'duplicate sku in this file' });
        continue;
      }
      seen.add(sku);
      const existing = await this.products.getBySku(sku);
      if (existing) {
        if (!dryRun) {
          const patch = new ProductUpdateDto();
          patch.name = String(record.name);
          patch.description = String(record.description);
          patch.category = String(record.category);
          patch.price_cents = Number(record.price_cents);
          patch.stock = Number(record.stock);
          await this.products.update(existing.id, patch);
        }
        updated.push(sku);
      } else {
        if (!dryRun) {
          const create = new ProductCreateDto();
          create.sku = sku;
          create.name = String(record.name);
          create.description = String(record.description);
          create.category = String(record.category);
          create.price_cents = Number(record.price_cents);
          create.stock = Number(record.stock);
          create.currency = 'USD';
          create.attributes = {};
          await this.products.create(create);
        }
        created.push(sku);
      }
    }

    return {
      url: finalUrl,
      dry_run: dryRun,
      source,
      created,
      updated,
      skipped,
      counts: {
        created: created.length,
        updated: updated.length,
        skipped: skipped.length,
      },
    };
  }
}
