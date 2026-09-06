import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ada, bootApp, reset } from './helpers';

describe('customers and orders', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const boot = await bootApp();
    app = boot.app;
    http = boot.http;
  });
  afterAll(async () => app.close());
  beforeEach(async () => reset(app));

  it('list seed customers', async () => {
    const rows = (await http.get('/api/v1/customers')).body;
    const emails = new Set(rows.map((row: { email: string }) => row.email));
    expect(emails).toEqual(new Set(['ada@example.com', 'sam@example.com', 'kai@example.com']));
  });

  it('create customer normalizes email', async () => {
    const created = await http.post('/api/v1/customers').send({ email: 'May@Example.COM', name: 'May Chen' });
    expect(created.status).toBe(201);
    expect(created.body.email).toBe('may@example.com');
  });

  it('customer orders', async () => {
    const customer = await ada(http);
    const orders = (await http.get(`/api/v1/customers/${customer.id}/orders`)).body;
    expect(orders).toHaveLength(1);
    expect(orders[0].total_cents).toBe(18900 + 2 * 1400);
    const skus = new Set(orders[0].items.map((item: { sku: string }) => item.sku));
    expect(skus).toEqual(new Set(['NMB-ANC-01', 'FLO-NTB-A5']));
  });

  it('place order decrements stock', async () => {
    const customer = await ada(http);
    const kettle = (await http.get('/api/v1/products').query({ q: 'Kiln' })).body.items[0];
    const before = kettle.stock;
    const order = await http.post('/api/v1/orders').send({
      customer_id: customer.id,
      items: [{ sku: 'KLN-KTL-07', quantity: 2 }],
    });
    expect(order.status).toBe(201);
    expect(order.body.total_cents).toBe(2 * 6400);
    expect(order.body.status).toBe('placed');
    const after = (await http.get(`/api/v1/products/${kettle.id}`)).body;
    expect(after.stock).toBe(before - 2);
  });

  it('place order by email and merge duplicate lines', async () => {
    const order = await http.post('/api/v1/orders').send({
      customer_email: 'kai@example.com',
      items: [
        { sku: 'QRY-MUG-ST', quantity: 1 },
        { sku: 'QRY-MUG-ST', quantity: 2 },
      ],
    });
    expect(order.status).toBe(201);
    expect(order.body.items).toHaveLength(1);
    expect(order.body.items[0].quantity).toBe(3);
  });

  it('cancel restores stock', async () => {
    const socks = (await http.get('/api/v1/products').query({ q: 'Drift' })).body.items[0];
    const order = (
      await http.post('/api/v1/orders').send({
        customer_email: 'kai@example.com',
        items: [{ product_id: socks.id, quantity: 4 }],
      })
    ).body;
    const cancelled = await http.post(`/api/v1/orders/${order.id}/cancel`);
    expect(cancelled.body.status).toBe('cancelled');
    const restored = (await http.get(`/api/v1/products/${socks.id}`)).body;
    expect(restored.stock).toBe(socks.stock);
  });

  it('order snapshots price', async () => {
    const customer = await ada(http);
    const mug = (await http.get('/api/v1/products').query({ q: 'Quarry' })).body.items[0];
    await http.patch(`/api/v1/products/${mug.id}`).send({ price_cents: 9999 });
    const order = (
      await http.post('/api/v1/orders').send({
        customer_id: customer.id,
        items: [{ product_id: mug.id, quantity: 1 }],
      })
    ).body;
    expect(order.items[0].unit_price_cents).toBe(9999);
    await http.patch(`/api/v1/products/${mug.id}`).send({ price_cents: 1800 });
    const fetched = (await http.get(`/api/v1/orders/${order.id}`)).body;
    expect(fetched.items[0].unit_price_cents).toBe(9999);
  });
});
