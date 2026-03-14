import { Controller, Get } from '@nestjs/common';

@Controller()
export class OpsController {
  @Get('/health')
  getHealth() { return { status: 'ok' }; }

  @Get('/ready')
  getReady() { return { status: 'ready' }; }

  @Get('/metrics')
  getMetrics() { return '# lobster_park_requests_total 0'; }

  @Get('/info')
  getInfo() { return { service: 'lobster-park', version: '0.1.0' }; }
}
