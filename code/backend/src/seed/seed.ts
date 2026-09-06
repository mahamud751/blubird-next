import { Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

function fixturesDir() {
  return process.env.FIXTURES_DIR || join(__dirname, '..', '..', '..', '..', 'fixtures');
}

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir(), name), 'utf8')) as T;
}

type ProductRow = {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  price_cents: number;
  currency?: string;
  stock?: number;
  attributes?: Record<string, unknown>;
  image_url?: string;
};

type CustomerRow = { email: string; name: string };
type OrderRow = {
  customer_email: string;
  status?: string;
  notes?: string;
  items: { sku: string; quantity: number }[];
};

export async function seedIfEmpty(client: PrismaClient): Promise<{
  products: number;
  customers: number;
  orders: number;
  skipped: number;
}> {
  const existing = await client.product.count();
  if (existing > 0) {
    return { products: 0, customers: 0, orders: 0, skipped: 1 };
  }

  const products = loadJson<ProductRow[]>('products.json');
  const customers = loadJson<CustomerRow[]>('customers.json');
  const orders = loadJson<OrderRow[]>('orders.json');

  const skuMap = new Map<string, { id: number; sku: string; name: string; priceCents: number; stock: number }>();
  for (const row of products) {
    const product = await client.product.create({
      data: {
        sku: row.sku.toUpperCase(),
        name: row.name,
        description: row.description ?? '',
        category: row.category ?? 'general',
        priceCents: Number(row.price_cents),
        currency: row.currency ?? 'USD',
        stock: Number(row.stock ?? 0),
        attributes: (row.attributes ?? {}) as Prisma.InputJsonValue,
        imageUrl: row.image_url ?? '',
      },
    });
    skuMap.set(product.sku, product);
  }

  const emailMap = new Map<string, { id: number; email: string }>();
  for (const row of customers) {
    const customer = await client.customer.create({
      data: { email: row.email.trim().toLowerCase(), name: row.name },
    });
    emailMap.set(customer.email, customer);
  }

  for (const row of orders) {
    const customer = emailMap.get(row.customer_email.trim().toLowerCase());
    if (!customer) throw new Error(`unknown customer ${row.customer_email}`);
    const order = await client.order.create({
      data: {
        customerId: customer.id,
        status: row.status ?? 'placed',
        currency: 'USD',
        notes: row.notes ?? '',
        totalCents: 0,
      },
    });
    let total = 0;
    for (const item of row.items) {
      const product = skuMap.get(item.sku.toUpperCase());
      if (!product) throw new Error(`unknown sku ${item.sku}`);
      const quantity = Number(item.quantity);
      if (product.stock < quantity) {
        throw new Error(`fixture order oversells ${product.sku}`);
      }
      product.stock -= quantity;
      await client.product.update({
        where: { id: product.id },
        data: { stock: product.stock },
      });
      const line = quantity * product.priceCents;
      total += line;
      await client.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity,
          unitPriceCents: product.priceCents,
        },
      });
    }
    await client.order.update({ where: { id: order.id }, data: { totalCents: total } });
  }

  return { products: products.length, customers: customers.length, orders: orders.length, skipped: 0 };
}

export async function backfillImages(client: PrismaClient): Promise<number> {
  const products = loadJson<ProductRow[]>('products.json');
  let updated = 0;
  for (const row of products) {
    const sku = row.sku.toUpperCase();
    const imageUrl = row.image_url ?? '';
    if (!imageUrl) continue;
    const product = await client.product.findUnique({ where: { sku } });
    if (product && product.imageUrl !== imageUrl) {
      await client.product.update({ where: { id: product.id }, data: { imageUrl } });
      updated += 1;
    }
  }
  return updated;
}
