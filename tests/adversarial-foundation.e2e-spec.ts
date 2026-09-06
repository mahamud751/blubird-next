import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, reset } from './helpers';

describe('adversarial foundation', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const boot = await bootApp();
    app = boot.app;
    http = boot.http;
  });
  afterAll(async () => app.close());
  beforeEach(async () => reset(app));

  it.each([
    { sku: 'BAD', name: 'x', price_cents: -1, stock: 1 },
    { sku: 'BAD', name: 'x', price_cents: 100, stock: -4 },
    { sku: 'no spaces', name: 'x', price_cents: 100, stock: 1 },
    { sku: 'OK-1', name: ' ', price_cents: 100, stock: 1 },
    { sku: 'OK-1', name: 'x', price_cents: 100, stock: 1, currency: 'US' },
  ])('rejects invalid product %j', async (payload) => {
    const response = await http.post('/api/v1/products').send(payload);
    expect(response.status).toBe(422);
  });

  it('duplicate sku conflict', async () => {
    const response = await http.post('/api/v1/products').send({
      sku: 'NMB-ANC-01',
      name: 'Clone',
      price_cents: 1,
      stock: 1,
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SKU_TAKEN');
  });

  it('duplicate email conflict', async () => {
    const response = await http.post('/api/v1/customers').send({ email: 'ADA@example.com', name: 'Impostor' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('invalid email rejected', async () => {
    const response = await http.post('/api/v1/customers').send({ email: 'not-an-email', name: 'X' });
    expect(response.status).toBe(422);
  });

  it('sql injection in search is literal', async () => {
    const payload = (await http.get('/api/v1/products').query({ q: "'; DROP TABLE products; --" })).body;
    expect(payload.total).toBe(0);
    expect((await http.get('/api/v1/products')).body.total).toBe(12);
  });

  it('cannot oversell', async () => {
    const lamp = (await http.get('/api/v1/products').query({ q: 'Desk Lamp' })).body.items[0];
    const response = await http.post('/api/v1/orders').send({
      customer_email: 'kai@example.com',
      items: [{ sku: lamp.sku, quantity: lamp.stock + 1 }],
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('STOCK_INSUFFICIENT');
    expect((await http.get(`/api/v1/products/${lamp.id}`)).body.stock).toBe(lamp.stock);
  });

  it('empty order rejected', async () => {
    const response = await http.post('/api/v1/orders').send({ customer_email: 'kai@example.com', items: [] });
    expect(response.status).toBe(422);
  });

  it('unknown product and customer', async () => {
    const missingProduct = await http.post('/api/v1/orders').send({
      customer_email: 'kai@example.com',
      items: [{ sku: 'NOPE-NOPE', quantity: 1 }],
    });
    expect(missingProduct.status).toBe(404);
    const missingCustomer = await http.post('/api/v1/orders').send({
      customer_email: 'ghost@example.com',
      items: [{ sku: 'QRY-MUG-ST', quantity: 1 }],
    });
    expect(missingCustomer.status).toBe(404);
  });

  it('cannot cancel unknown or twice', async () => {
    expect((await http.post('/api/v1/orders/9999/cancel')).status).toBe(404);
    const order = (
      await http.post('/api/v1/orders').send({
        customer_email: 'kai@example.com',
        items: [{ sku: 'FLO-NTB-A5', quantity: 1 }],
      })
    ).body;
    const first = await http.post(`/api/v1/orders/${order.id}/cancel`);
    expect(first.status).toBe(200);
    const second = await http.post(`/api/v1/orders/${order.id}/cancel`);
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('ALREADY_CANCELLED');
  });

  it('extremely long name rejected', async () => {
    const response = await http.post('/api/v1/products').send({
      sku: 'LONG-1',
      name: 'n'.repeat(201),
      price_cents: 100,
      stock: 1,
    });
    expect(response.status).toBe(422);
  });

  it('xss payload stored as text', async () => {
    const created = await http.post('/api/v1/products').send({
      sku: 'XSS-1',
      name: '<script>alert(1)</script>',
      description: '<img src=x onerror=alert(1)>',
      price_cents: 100,
      stock: 1,
    });
    expect(created.status).toBe(201);
    expect(created.body.name.startsWith('<script>')).toBe(true);
    const page = await http.get('/');
    expect(page.text).not.toContain('<script>alert(1)</script>');
  });
});
