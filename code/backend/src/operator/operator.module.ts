import { Module } from '@nestjs/common';
import { OperatorController } from './operator.controller';
import { ImporterService } from './importer.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [OperatorController],
  providers: [ImporterService],
  exports: [ImporterService],
})
export class OperatorModule {}
