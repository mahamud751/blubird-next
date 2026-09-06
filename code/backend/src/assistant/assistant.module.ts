import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ToolDispatcher } from './tools';
import { ProductsModule } from '../products/products.module';
import { CustomersService } from '../customers/customers.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [ProductsModule, OrdersModule],
  controllers: [AssistantController],
  providers: [AssistantService, CustomersService, ToolDispatcher],
  exports: [AssistantService, ToolDispatcher],
})
export class AssistantModule {}
