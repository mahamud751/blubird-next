import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '../common/errors';
import { CustomerCreateDto } from './dto';

export type CustomerOut = {
  id: number;
  email: string;
  name: string;
  created_at: Date;
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  serialize(customer: { id: number; email: string; name: string; createdAt: Date }): CustomerOut {
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      created_at: customer.createdAt,
    };
  }

  async getById(id: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundError('customer not found', { customer_id: id });
    return customer;
  }

  async getByEmail(email: string) {
    return this.prisma.customer.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  async list() {
    return this.prisma.customer.findMany({ orderBy: { id: 'asc' } });
  }

  async create(payload: CustomerCreateDto) {
    const existing = await this.getByEmail(payload.email);
    if (existing) {
      throw new ConflictError('EMAIL_TAKEN', 'a customer with this email already exists', {
        email: payload.email,
      });
    }
    return this.prisma.customer.create({ data: { email: payload.email, name: payload.name } });
  }
}
