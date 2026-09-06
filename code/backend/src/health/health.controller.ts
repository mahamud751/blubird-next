import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AppSettings } from '../config/app.config';
import { AssistantService } from '../assistant/assistant.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettings,
    private readonly assistant: AssistantService,
  ) {}

  @Get()
  async health() {
    const [products, customers, orders] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.customer.count(),
      this.prisma.order.count(),
    ]);
    return {
      status: 'ok',
      app: this.settings.appName,
      products,
      customers,
      orders,
      assistant: Boolean(this.assistant.getLlm()),
      model: this.assistant.getLlm() ? this.settings.llmModel : null,
    };
  }
}
