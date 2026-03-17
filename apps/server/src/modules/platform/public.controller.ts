import { Controller, Get } from '@nestjs/common';
import { PlatformService } from './platform.service';

@Controller('public')
export class PublicController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('site-settings')
  getPublicSiteSettings() {
    return this.platformService.getPublicSiteSettings();
  }

  @Get('auth-options')
  getPublicAuthOptions() {
    return this.platformService.getPublicAuthOptions();
  }
}
