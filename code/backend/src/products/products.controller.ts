import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductCreateDto, ProductQueryDto, ProductUpdateDto } from './dto';

@ApiTags('products')
@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products (search / category / in-stock)' })
  async list(@Query() query: ProductQueryDto) {
    const result = await this.products.list({
      query: query.q,
      category: query.category,
      inStock: query.in_stock,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
    return {
      items: result.items.map((item) => this.products.serialize(item)),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.products.serialize(await this.products.getById(id));
  }

  @Post()
  async create(@Body() body: ProductCreateDto) {
    return this.products.serialize(await this.products.create(body));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: ProductUpdateDto) {
    return this.products.serialize(await this.products.update(id, body));
  }
}
