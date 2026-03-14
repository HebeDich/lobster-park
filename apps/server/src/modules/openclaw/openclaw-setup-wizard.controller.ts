import { Body, Controller, Post, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { OpenClawSetupWizardService } from './openclaw-setup-wizard.service';
import type { SetupWizardInput } from './openclaw-setup-wizard.service';

@Controller()
export class OpenClawSetupWizardController {
  constructor(
    private readonly authService: AuthService,
    private readonly wizardService: OpenClawSetupWizardService,
  ) {}

  @Post('instances/:instanceId/openclaw/setup-wizard')
  runSetupWizard(
    @CurrentUser() currentUser: RequestUserContext,
    @Param('instanceId') instanceId: string,
    @Body() body: SetupWizardInput,
  ) {
    this.authService.requirePermission(currentUser, 'config.edit');
    return this.wizardService.runSetupWizard(currentUser, instanceId, body);
  }
}
