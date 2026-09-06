import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, reset } from './helpers';

describe('health and storefront', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const boot = await bootApp();
    app = boot.app;
    http = boot.http;
  });
  afterAll(async () => app.close());
  beforeEach(async () => reset(app));

  it('health and seeded counts', async () => {
    const health = (await http.get('/health')).body;
    expect(health.status).toBe('ok');
    expect(health.products).toBe(12);
    expect(health.customers).toBe(3);
    expect(health.orders).toBe(2);
  });

  it('storefront serves', async () => {
    const page = await http.get('/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('Field');
    const hero = await http.get('/static/hero.jpg');
    expect(hero.status).toBe(200);
    const photo = await http.get('/static/products/nmb-anc-01.jpg');
    expect(photo.status).toBe(200);
    expect(String(photo.headers['content-type'])).toMatch(/^image\//);
  });
});
