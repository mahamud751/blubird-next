import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '../common/errors';
import { ProductCreateDto, ProductUpdateDto } from './dto';

export type ProductOut = {
  id: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  currency: string;
  stock: number;
  attributes: Record<string, unknown>;
  image_url: string;
  archived: boolean;
  created_at: Date;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  serialize(product: {
    id: number;
    sku: string;
    name: string;
    description: string;
    category: string;
    priceCents: number;
    currency: string;
    stock: number;
    attributes: Prisma.JsonValue;
    imageUrl: string;
    archived: boolean;
    createdAt: Date;
  }): ProductOut {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category,
      price_cents: product.priceCents,
      currency: product.currency,
      stock: product.stock,
      attributes: (product.attributes as Record<string, unknown>) ?? {},
      image_url: product.imageUrl,
      archived: product.archived,
      created_at: product.createdAt,
    };
  }

  async getById(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('product not found', { product_id: id });
    return product;
  }

  async getBySku(sku: string) {
    return this.prisma.product.findUnique({ where: { sku: sku.toUpperCase() } });
  }

  async list(opts: {
    query?: string;
    category?: string;
    inStock?: boolean;
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const where: Prisma.ProductWhereInput = {};
    if (!opts.includeArchived) where.archived = false;
    if (opts.category) {
      where.category = { equals: opts.category.trim(), mode: 'insensitive' };
    }
    if (opts.inStock === true) where.stock = { gt: 0 };
    if (opts.inStock === false) where.stock = 0;
    if (opts.query) {
      const term = opts.query.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: { id: 'asc' }, take: limit, skip: offset }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, limit, offset };
  }

  async create(payload: ProductCreateDto) {
    const existing = await this.getBySku(payload.sku);
    if (existing) {
      throw new ConflictError('SKU_TAKEN', 'a product with this sku already exists', { sku: payload.sku });
    }
    if (payload.attributes && Object.keys(payload.attributes).length > 30) {
      throw new ConflictError('VALIDATION_ERROR', 'too many attributes');
    }
    const product = await this.prisma.product.create({
      data: {
        sku: payload.sku,
        name: payload.name,
        description: payload.description ?? '',
        category: payload.category ?? 'general',
        priceCents: payload.price_cents,
        currency: payload.currency ?? 'USD',
        stock: payload.stock ?? 0,
        attributes: (payload.attributes ?? {}) as Prisma.InputJsonValue,
        imageUrl: payload.image_url ?? '',
      },
    });
    return product;
  }

  async update(id: number, payload: ProductUpdateDto) {
    const product = await this.getById(id);
    const data: Prisma.ProductUpdateInput = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.description !== undefined) data.description = payload.description;
    if (payload.category !== undefined) data.category = payload.category;
    if (payload.price_cents !== undefined) data.priceCents = payload.price_cents;
    if (payload.stock !== undefined) data.stock = payload.stock;
    if (payload.attributes !== undefined) data.attributes = payload.attributes as Prisma.InputJsonValue;
    if (payload.image_url !== undefined) data.imageUrl = payload.image_url;
    if (payload.archived !== undefined) data.archived = payload.archived;
    return this.prisma.product.update({ where: { id: product.id }, data });
  }
}
