import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipEnvelope } from './common/response/skip-envelope.decorator';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get('/health')
  @SkipEnvelope()
  getHealth() {
    return { status: 'ok' };
  }

  @Get('/ready')
  @SkipEnvelope()
  getReady() {
    return { status: 'ready' };
  }

  @Get('/metrics')
  @SkipEnvelope()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics() {
    return '# lobster_park_bootstrap_ready 1\n';
  }

  @Get('/info')
  @SkipEnvelope()
  getInfo() {
    return {
      name: '@lobster-park/server',
      version: this.configService.get<string>('app.version', '0.1.0'),
      environment: this.configService.get<string>('app.nodeEnv', 'development')
    };
  }
}

