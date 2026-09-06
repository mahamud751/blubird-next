import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { OrderCreateDto } from './dto';

@ApiTags('orders')
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  async create(@Body() body: OrderCreateDto) {
    return this.orders.serialize(await this.orders.create(body));
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.orders.serialize(await this.orders.getById(id));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id', ParseIntPipe) id: number) {
    return this.orders.serialize(await this.orders.cancel(id));
  }
}
