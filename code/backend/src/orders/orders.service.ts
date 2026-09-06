import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppError, NotFoundError } from '../common/errors';
import { CustomersService } from '../customers/customers.service';
import { ProductsService } from '../products/products.service';
import { OrderCreateDto, OrderItemInDto } from './dto';

const orderInclude = {
  customer: true,
  items: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.OrderInclude;

export type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export type OrderOut = {
  id: number;
  customer_id: number;
  customer_email: string;
  status: string;
  total_cents: number;
  currency: string;
  notes: string;
  created_at: Date;
  items: {
    product_id: number;
    sku: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }[];
};

export type QuotedLine = {
  product: { id: number; sku: string; name: string; priceCents: number; stock: number; archived: boolean };
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly products: ProductsService,
  ) {}

  serialize(order: OrderRecord): OrderOut {
    return {
      id: order.id,
      customer_id: order.customerId,
      customer_email: order.customer.email,
      status: order.status,
      total_cents: order.totalCents,
      currency: order.currency,
      notes: order.notes,
      created_at: order.createdAt,
      items: order.items.map((item) => ({
        product_id: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        line_total_cents: item.quantity * item.unitPriceCents,
      })),
    };
  }

  async getById(id: number): Promise<OrderRecord> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundError('order not found', { order_id: id });
    return order;
  }

  async listForCustomer(customerId: number): Promise<OrderRecord[]> {
    await this.customers.getById(customerId);
    return this.prisma.order.findMany({
      where: { customerId },
      include: orderInclude,
      orderBy: { id: 'desc' },
    });
  }

  private async resolveCustomer(payload: OrderCreateDto) {
    if (payload.customer_id != null) return this.customers.getById(payload.customer_id);
    if (payload.customer_email) {
      const customer = await this.customers.getByEmail(payload.customer_email);
      if (!customer) throw new NotFoundError('customer not found', { email: payload.customer_email });
      return customer;
    }
    throw new AppError('CUSTOMER_REQUIRED', 'provide customer_id or customer_email');
  }

  private async resolveProduct(item: OrderItemInDto) {
    if (item.product_id != null) return this.products.getById(item.product_id);
    if (item.sku) {
      const product = await this.products.getBySku(item.sku);
      if (!product) throw new NotFoundError('product not found', { sku: item.sku });
      return product;
    }
    throw new AppError('PRODUCT_REQUIRED', 'each item needs product_id or sku');
  }

  async quoteItems(items: OrderItemInDto[]): Promise<QuotedLine[]> {
    const merged = new Map<number, QuotedLine>();
    for (const item of items) {
      const product = await this.resolveProduct(item);
      if (product.archived) {
        throw new AppError('PRODUCT_ARCHIVED', 'product is not available', { sku: product.sku });
      }
      const current = merged.get(product.id);
      if (current) {
        current.quantity += item.quantity;
        current.line_total_cents = current.quantity * current.unit_price_cents;
      } else {
        merged.set(product.id, {
          product,
          quantity: item.quantity,
          unit_price_cents: product.priceCents,
          line_total_cents: product.priceCents * item.quantity,
        });
      }
    }
    const result: QuotedLine[] = [];
    for (const row of merged.values()) {
      if (row.quantity > 99) {
        throw new AppError('QUANTITY_LIMIT', 'quantity exceeds per-item limit of 99', { sku: row.product.sku });
      }
      if (row.product.stock < row.quantity) {
        throw new AppError('STOCK_INSUFFICIENT', 'not enough stock', {
          sku: row.product.sku,
          requested: row.quantity,
          available: row.product.stock,
        });
      }
      result.push(row);
    }
    return result;
  }

  async create(payload: OrderCreateDto): Promise<OrderRecord> {
    const customer = await this.resolveCustomer(payload);
    const quoted = await this.quoteItems(payload.items);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          status: 'placed',
          notes: payload.notes ?? '',
          currency: 'USD',
          totalCents: 0,
        },
      });
      let total = 0;
      for (const row of quoted) {
        const decremented = await tx.$executeRaw`
          UPDATE products
          SET stock = stock - ${row.quantity}, updated_at = NOW()
          WHERE id = ${row.product.id}
            AND stock >= ${row.quantity}
            AND archived = false
        `;
        if (decremented !== 1) {
          throw new AppError('STOCK_INSUFFICIENT', 'not enough stock', {
            sku: row.product.sku,
            requested: row.quantity,
          });
        }
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: row.product.id,
            sku: row.product.sku,
            name: row.product.name,
            quantity: row.quantity,
            unitPriceCents: row.product.priceCents,
          },
        });
        total += row.product.priceCents * row.quantity;
      }
      await tx.order.update({ where: { id: order.id }, data: { totalCents: total } });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    });
  }

  async cancel(orderId: number): Promise<OrderRecord> {
    const order = await this.getById(orderId);
    if (order.status === 'cancelled') {
      throw new AppError('ALREADY_CANCELLED', 'order is already cancelled');
    }
    if (order.status === 'shipped') {
      throw new AppError('NOT_CANCELLABLE', 'shipped orders cannot be cancelled');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE products SET stock = stock + ${item.quantity}, updated_at = NOW()
          WHERE id = ${item.productId}
        `;
      }
      await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    });
    return this.getById(orderId);
  }
}
