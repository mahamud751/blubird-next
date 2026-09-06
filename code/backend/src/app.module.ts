import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { AssistantModule } from './assistant/assistant.module';
import { OperatorModule } from './operator/operator.module';
import { HealthController } from './health/health.controller';
import { AppSettings } from './config/app.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    AssistantModule,
    OperatorModule,
  ],
  controllers: [HealthController],
  providers: [AppSettings],
  exports: [AppSettings],
})
export class AppModule {}
