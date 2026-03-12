import { Controller, Post, Headers, Body, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { WebhookService } from './webhook.service.js';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('github')
  @HttpCode(HttpStatus.ACCEPTED)
  async handleGitHub(
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
  ) {
    const payloadString = JSON.stringify(payload);

    if (!this.webhookService.verifySignature(payloadString, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }

    await this.webhookService.handleEvent(event, payload);
    return { status: 'accepted' };
  }
}
