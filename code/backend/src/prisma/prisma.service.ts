import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async resetForTests() {
    await this.$executeRawUnsafe(`
      TRUNCATE TABLE order_items, orders, customers, products RESTART IDENTITY CASCADE;
    `);
  }
}
