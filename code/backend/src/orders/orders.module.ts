import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CustomersService } from '../customers/customers.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [OrdersController],
  providers: [OrdersService, CustomersService],
  exports: [OrdersService],
})
export class OrdersModule {}
