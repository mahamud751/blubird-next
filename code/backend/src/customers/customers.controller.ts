import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CustomerCreateDto } from './dto';
import { OrdersService } from '../orders/orders.service';

@ApiTags('customers')
@Controller('api/v1/customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  async list() {
    const rows = await this.customers.list();
    return rows.map((row) => this.customers.serialize(row));
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.customers.serialize(await this.customers.getById(id));
  }

  @Post()
  async create(@Body() body: CustomerCreateDto) {
    return this.customers.serialize(await this.customers.create(body));
  }

  @Get(':id/orders')
  async ordersFor(@Param('id', ParseIntPipe) id: number) {
    const rows = await this.orders.listForCustomer(id);
    return rows.map((row) => this.orders.serialize(row));
  }
}
