import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, reset } from './helpers';

describe('products', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const boot = await bootApp();
    app = boot.app;
    http = boot.http;
  });
  afterAll(async () => app.close());
  beforeEach(async () => reset(app));

  it('list products contains seed catalog', async () => {
    const payload = (await http.get('/api/v1/products')).body;
    expect(payload.total).toBe(12);
    const skus = new Set(payload.items.map((item: { sku: string }) => item.sku));
    expect(skus.has('NMB-ANC-01')).toBe(true);
    const headphones = payload.items.find((item: { sku: string }) => item.sku === 'NMB-ANC-01');
    expect(headphones.price_cents).toBe(18900);
    expect(headphones.stock).toBe(23);
    expect(headphones.image_url).toBe('/static/products/nmb-anc-01.jpg');
  });

  it('filter by category and query', async () => {
    const kitchen = (await http.get('/api/v1/products').query({ category: 'kitchen' })).body;
    expect(kitchen.total).toBe(3);
    const search = (await http.get('/api/v1/products').query({ q: 'noise cancelling' })).body;
    expect(search.total).toBe(1);
    expect(search.items[0].sku).toBe('NMB-ANC-01');
  });

  it('create and get product', async () => {
    const created = await http.post('/api/v1/products').send({
      sku: 'tst-pen-01',
      name: 'Trial Brass Pen',
      description: 'A single test SKU.',
      category: 'stationery',
      price_cents: 2100,
      stock: 8,
    });
    expect(created.status).toBe(201);
    expect(created.body.sku).toBe('TST-PEN-01');
    const fetched = await http.get(`/api/v1/products/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.name).toBe('Trial Brass Pen');
  });

  it('patch stock', async () => {
    const product = (await http.get('/api/v1/products').query({ q: 'Folio' })).body.items[0];
    const updated = await http.patch(`/api/v1/products/${product.id}`).send({ stock: 5 });
    expect(updated.body.stock).toBe(5);
  });
});
