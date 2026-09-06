import { load } from 'cheerio';
import { parse } from 'csv-parse/sync';
import { AppError } from '../common/errors';
import { SKU_RE } from '../products/dto';

const SKU_KEYS = ['sku', 'SKU', 'handle', 'product_id', 'productId'];
const NAME_KEYS = ['name', 'title', 'product_name', 'productName'];
const DESC_KEYS = ['description', 'body', 'details', 'body_html'];
const CAT_KEYS = ['category', 'product_type', 'type', 'productType'];
const STOCK_KEYS = ['stock', 'inventory', 'quantity', 'qty', 'inventory_quantity'];
const PRICE_CENTS_KEYS = ['price_cents', 'priceCents', 'unit_price_cents'];
const PRICE_KEYS = ['price', 'amount', 'unit_price', 'unitPrice'];

type Row = Record<string, unknown>;

function first(row: Row, keys: string[]): unknown {
  const lowered: Row = {};
  for (const [k, v] of Object.entries(row)) lowered[String(k).toLowerCase()] = v;
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
    if (lowered[key.toLowerCase()] != null && lowered[key.toLowerCase()] !== '') {
      return lowered[key.toLowerCase()];
    }
  }
  return undefined;
}

export function priceToCents(value: unknown, fromCents: boolean): number {
  if (typeof value === 'boolean' || value == null || value === '') {
    throw new Error('price is missing');
  }
  let cents: number;
  if (typeof value === 'number' && Number.isInteger(value)) {
    cents = fromCents ? value : value * 100;
  } else if (typeof value === 'number') {
    cents = fromCents ? Math.round(value) : Math.round(value * 100);
  } else {
    let text = String(value).trim().replace(/,/g, '');
    if (text.startsWith('$')) text = text.slice(1);
    if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error('price is not a number');
    if (text.includes('.') && !fromCents) cents = Math.round(parseFloat(text) * 100);
    else if (fromCents) cents = Math.trunc(parseFloat(text));
    else cents = parseInt(text, 10) * 100;
  }
  if (cents < 0 || cents > 100_000_000) throw new Error('price out of range');
  return cents;
}

function skuFrom(row: Row, index: number): string {
  const raw = first(row, SKU_KEYS);
  if (raw == null) throw new Error('missing sku');
  let sku = String(raw)
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  if (!sku) sku = `IMP-${String(index).padStart(3, '0')}`;
  if (!SKU_RE.test(sku)) {
    sku = sku.replace(/[^A-Z0-9]/g, '').slice(0, 62) || `IMP-${String(index).padStart(3, '0')}`;
    if (sku.length < 2) sku = `IMP-${String(index).padStart(3, '0')}`;
    if (!SKU_RE.test(sku)) throw new Error('sku is not usable');
  }
  return sku.slice(0, 64);
}

export function normalizeRow(row: Row, index: number): Record<string, unknown> {
  const name = String(first(row, NAME_KEYS) ?? '').trim();
  if (!name) throw new Error('missing name');
  const centsValue = first(row, PRICE_CENTS_KEYS);
  const priceCents =
    centsValue != null ? priceToCents(centsValue, true) : priceToCents(first(row, PRICE_KEYS), false);
  const stockRaw = first(row, STOCK_KEYS);
  const stock = stockRaw == null || stockRaw === '' ? 0 : Math.trunc(Number(stockRaw));
  if (Number.isNaN(stock) || stock < 0) throw new Error('stock is negative');
  let description = String(first(row, DESC_KEYS) ?? '');
  description = load(description).root().text().replace(/\s+/g, ' ').trim();
  const category = (String(first(row, CAT_KEYS) ?? 'general').trim() || 'general').slice(0, 80);
  return {
    sku: skuFrom(row, index),
    name: name.slice(0, 200),
    description: description.slice(0, 8000),
    category,
    price_cents: priceCents,
    stock: Math.min(stock, 1_000_000),
    currency: 'USD',
    attributes: {},
  };
}

function extractJsonRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload.filter((row) => row && typeof row === 'object') as Row[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Row;
    for (const key of ['products', 'items', 'data', 'rows']) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter((row) => row && typeof row === 'object') as Row[];
      }
    }
    if ([...NAME_KEYS, ...SKU_KEYS].some((k) => k in obj)) return [obj];
  }
  throw new AppError('PARSE_ERROR', 'JSON did not contain a product list');
}

export function parseJson(text: string): [string, Row[]] {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : 'invalid JSON';
    throw new AppError('PARSE_ERROR', `invalid JSON: ${msg}`);
  }
  return ['json', extractJsonRows(payload)];
}

export function parseCsv(text: string): [string, Row[]] {
  const sample = text.replace(/^\uFEFF/, '');
  const records = parse(sample, { columns: true, skip_empty_lines: false, relax_column_count: true }) as Row[];
  if (!records.length && !sample.trim()) throw new AppError('PARSE_ERROR', 'CSV has no header row');
  const firstLine = sample.split(/\r?\n/)[0] ?? '';
  if (!firstLine.trim()) throw new AppError('PARSE_ERROR', 'CSV has no header row');
  return ['csv', records];
}

function tableRows(html: string): Row[] {
  const $ = load(html);
  const rows: Row[] = [];
  $('table').each((_, table) => {
    const heads = $(table)
      .find('th')
      .toArray()
      .map((th) => $(th).text().replace(/\s+/g, ' ').trim());
    if (!heads.length) return;
    $(table)
      .find('tr')
      .each((__, tr) => {
        const cells = $(tr)
          .find('td')
          .toArray()
          .map((td) => $(td).text().replace(/\s+/g, ' ').trim());
        if (!cells.length || cells.length !== heads.length) return;
        const row: Row = {};
        heads.forEach((h, i) => {
          row[h] = cells[i];
        });
        rows.push(row);
      });
  });
  return rows;
}

function cardRows(html: string): Row[] {
  const $ = load(html);
  const rows: Row[] = [];
  $('[data-sku], article.product, .product, [itemtype*="Product"]').each((_, el) => {
    const card = $(el);
    let sku = card.attr('data-sku') || '';
    let name = '';
    const heading = card.find('h1, h2, h3').first();
    if (heading.length) name = heading.text().replace(/\s+/g, ' ').trim();
    const priceEl = card.find('.price, [itemprop=price]').first();
    const stockEl = card.find('.stock').first();
    const descEl = card.find('p, [itemprop=description]').first();
    const cat = card.attr('data-category') || 'general';
    const price = card.attr('data-price') || (priceEl.length ? priceEl.text().replace(/\s+/g, ' ').trim() : undefined);
    const stock = card.attr('data-stock') || (stockEl.length ? stockEl.text().replace(/\s+/g, ' ').trim() : undefined);
    if (!sku && card.attr('itemtype')) {
      const skuEl = card.find('[itemprop=sku]').first();
      sku = skuEl.length ? skuEl.text().replace(/\s+/g, ' ').trim() : '';
    }
    if (name || sku) {
      rows.push({
        sku,
        name,
        price,
        stock,
        description: descEl.length ? descEl.text().replace(/\s+/g, ' ').trim() : '',
        category: cat,
      });
    }
  });
  return rows;
}

export function parseHtml(text: string): [string, Row[]] {
  const rows = [...tableRows(text), ...cardRows(text)];
  if (!rows.length) {
    throw new AppError('PARSE_ERROR', 'HTML did not contain a product table or product cards');
  }
  return ['html', rows];
}

export function detectAndParse(contentType: string, content: Buffer, url: string): [string, Row[]] {
  const text = content.toString('utf8');
  const ctype = (contentType || '').toLowerCase();
  const stripped = text.trimStart();
  if (ctype.includes('json') || stripped.startsWith('{') || stripped.startsWith('[')) return parseJson(text);
  if (ctype.includes('csv') || url.toLowerCase().endsWith('.csv')) return parseCsv(text);
  if (
    ctype.includes('html') ||
    stripped.toLowerCase().startsWith('<!doctype') ||
    stripped.toLowerCase().startsWith('<html')
  ) {
    return parseHtml(text);
  }
  const firstLine = stripped.split(/\r?\n/)[0] || '';
  if (firstLine.includes(',') && firstLine.toLowerCase().includes('sku')) return parseCsv(text);
  try {
    return parseJson(text);
  } catch (exc) {
    if (exc instanceof AppError) return parseHtml(text);
    throw exc;
  }
}
