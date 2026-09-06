import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, importer, reset, settings } from './helpers';
import { detectAndParse, normalizeRow } from '../code/backend/src/operator/parsers';
import { assertUrlAllowed } from '../code/backend/src/operator/ssrf';
import { AppError } from '../code/backend/src/common/errors';
import { FetchTransport } from '../code/backend/src/operator/importer.service';

const FIXTURES = join(__dirname, '..', 'fixtures');

function jsonTransport(payload: unknown, contentType = 'application/json'): FetchTransport {
  return async (url) => ({
    status: 200,
    headers: { 'content-type': contentType },
    body: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)),
    url,
  });
}

describe('operator import', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const boot = await bootApp();
    app = boot.app;
    http = boot.http;
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await reset(app);
    settings(app).importAllowedHosts = '127.0.0.1,localhost';
    settings(app).importMaxBytes = 2_000_000;
  });

  it('parsers read bundled feeds', () => {
    const [jsonKind, jsonRows] = detectAndParse(
      'application/json',
      readFileSync(join(FIXTURES, 'import_catalog.json')),
      'x.json',
    );
    expect(jsonKind).toBe('json');
    expect(new Set(jsonRows.map((row, i) => normalizeRow(row, i + 1).sku))).toEqual(
      new Set(['NMB-ANC-01', 'RID-BELL-01', 'WTH-SOAP-3']),
    );
    const [csvKind, csvRows] = detectAndParse(
      'text/csv',
      readFileSync(join(FIXTURES, 'import_catalog.csv')),
      'x.csv',
    );
    expect(csvKind).toBe('csv');
    expect(normalizeRow(csvRows[1], 2).sku).toBe('SLP-CUP-08');
    expect(normalizeRow(csvRows[1], 2).price_cents).toBe(1200);
    const [htmlKind, htmlRows] = detectAndParse(
      'text/html',
      readFileSync(join(FIXTURES, 'import_catalog.html')),
      'x.html',
    );
    expect(htmlKind).toBe('html');
    const skus = new Set(
      htmlRows
        .map((row, i) => (row.sku || row.name ? String(normalizeRow(row, i + 1).sku) : ''))
        .filter(Boolean),
    );
    expect(skus.has('PTH-TOWEL-1')).toBe(true);
    expect(skus.has('FLW-HNY-01')).toBe(true);
  });

  it('import json creates and updates', async () => {
    const payload = JSON.parse(readFileSync(join(FIXTURES, 'import_catalog.json'), 'utf8'));
    importer(app).setTransport(jsonTransport(payload));
    const dry = await http.post('/api/v1/operator/imports').send({
      url: 'http://localhost/feed.json',
      dry_run: true,
    });
    expect(dry.status).toBe(200);
    expect(dry.body.counts.created).toBe(2);
    expect(dry.body.counts.updated).toBe(1);
    expect((await http.get('/api/v1/products').query({ q: 'Ridge' })).body.total).toBe(0);

    const real = await http.post('/api/v1/operator/imports').send({
      url: 'http://localhost/feed.json',
      dry_run: false,
    });
    expect(real.status).toBe(200);
    expect(real.body.created).toContain('RID-BELL-01');
    expect(real.body.updated).toContain('NMB-ANC-01');
    const nimbus = (await http.get('/api/v1/products').query({ q: 'Nimbus' })).body.items[0];
    expect(nimbus.stock).toBe(30);
    const bell = (await http.get('/api/v1/products').query({ q: 'Bike Bell' })).body.items[0];
    expect(bell.price_cents).toBe(1600);
  });

  it('import csv and html', async () => {
    const csvBytes = readFileSync(join(FIXTURES, 'import_catalog.csv'));
    const htmlBytes = readFileSync(join(FIXTURES, 'import_catalog.html'));
    importer(app).setTransport(async (url) => {
      if (url.endsWith('.csv')) {
        return { status: 200, headers: { 'content-type': 'text/csv' }, body: csvBytes, url };
      }
      return { status: 200, headers: { 'content-type': 'text/html' }, body: htmlBytes, url };
    });
    const csvReport = (await http.post('/api/v1/operator/imports').send({ url: 'http://localhost/feed.csv' })).body;
    expect(csvReport.source).toBe('csv');
    expect(csvReport.created).toContain('SLP-CUP-08');
    const htmlReport = (await http.post('/api/v1/operator/imports').send({ url: 'http://localhost/feed.html' })).body;
    expect(htmlReport.source).toBe('html');
    expect(htmlReport.created).toContain('FLW-HNY-01');
  });

  it('sample catalogs are served', async () => {
    const page = await http.get('/operator');
    expect(page.status).toBe(200);
    const feed = await http.get('/sample-catalogs/import_catalog.json');
    expect(feed.status).toBe(200);
    expect(feed.text).toContain('RID-BELL-01');
  });

  it('assert url allowed blocks schemes and metadata', async () => {
    const allowed = new Set(['localhost', '127.0.0.1']);
    await expect(assertUrlAllowed('file:///etc/passwd', allowed)).rejects.toMatchObject({
      code: 'URL_FORBIDDEN',
    });
    await expect(assertUrlAllowed('http://169.254.169.254/latest/meta-data', allowed)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(assertUrlAllowed('http://user:pass@example.com/x', allowed)).rejects.toMatchObject({
      code: 'URL_FORBIDDEN',
    });
    await expect(assertUrlAllowed('http://127.0.0.1/sample-catalogs/import_catalog.json', allowed)).resolves.toBe(
      'http://127.0.0.1/sample-catalogs/import_catalog.json',
    );
  });

  it('loopback blocked without allowlist', async () => {
    settings(app).importAllowedHosts = '';
    const response = await http.post('/api/v1/operator/imports').send({ url: 'http://127.0.0.1/secret.json' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('URL_FORBIDDEN');
  });

  it('redirect to metadata is blocked', async () => {
    importer(app).setTransport(async (url) => {
      if (new URL(url).pathname === '/go') {
        return {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest' },
          body: Buffer.from(''),
          url,
        };
      }
      return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('[]'), url };
    });
    const response = await http.post('/api/v1/operator/imports').send({ url: 'http://localhost/go' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('URL_FORBIDDEN');
  });

  it('file url rejected by schema', async () => {
    const response = await http.post('/api/v1/operator/imports').send({ url: 'file:///etc/passwd' });
    expect(response.status).toBe(422);
  });

  it('invalid rows are skipped not fatal', async () => {
    const payload = [
      { sku: 'OK-1', name: 'Good', price: 10, stock: 1 },
      { sku: 'BAD', name: '', price: 10, stock: 1 },
      { sku: 'OK-1', name: 'Duplicate in file', price: 10, stock: 1 },
      { sku: 'NEG-1', name: 'Neg', price: -4, stock: 1 },
    ];
    importer(app).setTransport(jsonTransport(payload));
    const report = (await http.post('/api/v1/operator/imports').send({ url: 'http://localhost/mixed.json' })).body;
    expect(report.created).toEqual(['OK-1']);
    expect(report.counts.skipped).toBe(3);
  });

  it('payload too large', async () => {
    settings(app).importMaxBytes = 64;
    importer(app).setTransport(async (url) => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.alloc(200, 120),
      url,
    }));
    const response = await http.post('/api/v1/operator/imports').send({ url: 'http://localhost/huge.json' });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('html script in name is stored as text', async () => {
    const html = `
    <table>
      <tr><th>sku</th><th>name</th><th>price</th><th>stock</th></tr>
      <tr><td>XSS-IMP</td><td>&lt;script&gt;alert(1)&lt;/script&gt;</td><td>3.00</td><td>1</td></tr>
    </table>
    `;
    importer(app).setTransport(async (url) => ({
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: Buffer.from(html),
      url,
    }));
    const report = (await http.post('/api/v1/operator/imports').send({ url: 'http://localhost/xss.html' })).body;
    expect(report.created).toEqual(['XSS-IMP']);
    const product = (await http.get('/api/v1/products').query({ q: 'XSS-IMP' })).body.items[0];
    expect(product.name).toContain('<script>');
    const page = await http.get('/');
    expect(page.text).not.toContain(product.name);
  });
});
