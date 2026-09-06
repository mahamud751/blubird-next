import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { ChatRequestDto } from './dto';

@ApiTags('assistant')
@Controller('api/v1/assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  chat(@Body() body: ChatRequestDto) {
    return this.assistant.chat(body);
  }
}
