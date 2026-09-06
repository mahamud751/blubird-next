import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from '../products/products.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { AppError, NotFoundError } from '../common/errors';
import { OrderItemInDto } from '../orders/dto';
import { ToolCall } from './llm';

export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search the live catalog. Use this for availability, price, and comparisons.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text query, SKU, or product name' },
          category: { type: 'string' },
          in_stock_only: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: 'Fetch one product by id or sku, including live stock and price.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'integer' },
          sku: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_orders',
      description: 'List orders for the identified customer. Requires customer_email on the chat request.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order',
      description: 'Get one order if it belongs to the identified customer.',
      parameters: {
        type: 'object',
        properties: { order_id: { type: 'integer' } },
        required: ['order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quote_order',
      description: 'Price a proposed order from live catalog prices. Does not create an order or change stock.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'integer' },
                sku: { type: 'string' },
                quantity: { type: 'integer', minimum: 1, maximum: 99 },
              },
              required: ['quantity'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_order',
      description:
        'Place an order at live catalog prices. confirm must be true and the customer must have agreed to the quoted total in this chat. Ignored fields: any unit price the model invents.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'integer' },
                sku: { type: 'string' },
                quantity: { type: 'integer', minimum: 1, maximum: 99 },
              },
              required: ['quantity'],
            },
          },
          confirm: {
            type: 'boolean',
            description: 'Must be true to actually place. False or omitted returns a quote only.',
          },
          notes: { type: 'string' },
        },
        required: ['items'],
      },
    },
  },
];

function jsonDump(data: unknown): string {
  return JSON.stringify(data, (_k, v) => (v instanceof Date ? v.toISOString() : v));
}

function productCard(product: {
  id: number;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  category: string;
  description: string;
}) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price_cents: product.priceCents,
    price_usd: (product.priceCents / 100).toFixed(2),
    stock: product.stock,
    category: product.category,
    description: product.description.slice(0, 280),
  };
}

type ToolItem = { product_id?: number; sku?: string; quantity: number };

function parseItems(raw: unknown): OrderItemInDto[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError('ITEMS_REQUIRED', 'items must be a non-empty list');
  }
  return raw.map((row) => {
    if (!row || typeof row !== 'object') throw new AppError('BAD_ARGUMENTS', 'invalid item');
    const rec = row as Record<string, unknown>;
    const quantity = Number(rec.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      const err = new Error('quantity out of range');
      (err as Error & { code?: string }).code = 'BAD_ARGUMENTS';
      throw Object.assign(new AppError('BAD_ARGUMENTS', 'quantity must be between 1 and 99'), {
        validation: true,
      });
    }
    const dto = new OrderItemInDto();
    dto.product_id = rec.product_id == null ? undefined : Number(rec.product_id);
    dto.sku = rec.sku == null ? undefined : String(rec.sku);
    dto.quantity = quantity;
    return dto;
  });
}

@Injectable()
export class ToolDispatcher {
  constructor(
    private readonly products: ProductsService,
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
  ) {}

  private async requireCustomer(email?: string | null) {
    if (!email) {
      return {
        error: 'IDENTIFY',
        message: 'Ask the customer for the email on their store account. Do not guess an email.',
      };
    }
    const customer = await this.customers.getByEmail(email);
    if (!customer) return { error: 'UNKNOWN_CUSTOMER', message: 'No customer exists with that email.' };
    return customer;
  }

  private async quotePayload(items: OrderItemInDto[]) {
    const quoted = await this.orders.quoteItems(items);
    const lines = quoted.map((row) => ({
      sku: row.product.sku,
      name: row.product.name,
      quantity: row.quantity,
      unit_price_cents: row.unit_price_cents,
      line_total_cents: row.line_total_cents,
    }));
    const total = lines.reduce((sum, line) => sum + line.line_total_cents, 0);
    return {
      items: lines,
      total_cents: total,
      total_usd: (total / 100).toFixed(2),
      currency: 'USD',
    };
  }

  async searchProducts(args: Record<string, unknown>) {
    const { items, total } = await this.products.list({
      query: args.query ? String(args.query) : undefined,
      category: args.category ? String(args.category) : undefined,
      inStock: args.in_stock_only ? true : undefined,
      limit: 12,
    });
    return { total, items: items.map(productCard) };
  }

  async getProduct(args: Record<string, unknown>) {
    if (args.product_id != null) {
      return productCard(await this.products.getById(Number(args.product_id)));
    }
    if (args.sku) {
      const product = await this.products.getBySku(String(args.sku));
      if (!product) throw new NotFoundError('product not found', { sku: args.sku });
      return productCard(product);
    }
    throw new AppError('PRODUCT_REQUIRED', 'provide product_id or sku');
  }

  async listMyOrders(email?: string | null) {
    const customer = await this.requireCustomer(email);
    if ('error' in customer) return customer;
    const rows = await this.orders.listForCustomer(customer.id);
    return { orders: rows.map((row) => this.orders.serialize(row)) };
  }

  async getOrder(args: Record<string, unknown>, email?: string | null) {
    const customer = await this.requireCustomer(email);
    if ('error' in customer) return customer;
    if (args.order_id == null) throw new AppError('ORDER_REQUIRED', 'order_id is required');
    const order = await this.orders.getById(Number(args.order_id));
    if (order.customerId !== customer.id) {
      return { error: 'NOT_YOURS', message: 'That order is not on this account.' };
    }
    return this.orders.serialize(order);
  }

  async quoteOrder(args: Record<string, unknown>) {
    const items = parseItems(args.items);
    return { quote: await this.quotePayload(items), placed: false };
  }

  async placeOrder(args: Record<string, unknown>, email?: string | null) {
    const customer = await this.requireCustomer(email);
    if ('error' in customer) return customer;
    const items = parseItems(args.items);
    const quote = await this.quotePayload(items);
    if (args.confirm !== true) {
      return {
        placed: false,
        needs_confirmation: true,
        quote,
        message:
          'Read this quote to the customer and call place_order again with confirm=true only after they agree.',
      };
    }
    const created = await this.orders.create({
      customer_id: customer.id,
      items,
      notes: String(args.notes || '').slice(0, 500),
    });
    return { placed: true, order: this.orders.serialize(created) };
  }

  async dispatch(call: ToolCall, customerEmail?: string | null): Promise<string> {
    const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
      search_products: (args) => this.searchProducts(args),
      get_product: (args) => this.getProduct(args),
      list_my_orders: () => this.listMyOrders(customerEmail),
      get_order: (args) => this.getOrder(args, customerEmail),
      quote_order: (args) => this.quoteOrder(args),
      place_order: (args) => this.placeOrder(args, customerEmail),
    };
    if (!handlers[call.name]) {
      return jsonDump({ error: 'UNKNOWN_TOOL', name: call.name });
    }
    let args: Record<string, unknown>;
    try {
      const parsed = JSON.parse(call.arguments || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('arguments must be an object');
      }
      args = parsed as Record<string, unknown>;
    } catch (exc) {
      return jsonDump({ error: 'BAD_ARGUMENTS', message: String(exc) });
    }
    try {
      const result = await handlers[call.name](args);
      return jsonDump(result);
    } catch (exc) {
      if (exc instanceof AppError) {
        if (exc.code === 'BAD_ARGUMENTS' || (exc as { validation?: boolean }).validation) {
          return jsonDump({ error: 'BAD_ARGUMENTS', message: exc.message });
        }
        return jsonDump({ error: exc.code, message: exc.message, details: exc.details });
      }
      if (exc instanceof Prisma.PrismaClientValidationError) {
        return jsonDump({ error: 'BAD_ARGUMENTS', message: exc.message });
      }
      throw exc;
    }
  }
}

export { parseItems };
