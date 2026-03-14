import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { JobService } from './job.service';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Get()
  list(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20', @Query('instanceId') instanceId?: string, @Query('jobType') jobType?: string, @Query('jobStatus') jobStatus?: string) {
    return this.jobService.listJobs(currentUser, { pageNo: Number(pageNo), pageSize: Number(pageSize), instanceId, jobType, jobStatus });
  }

  @Get(':jobId')
  detail(@CurrentUser() currentUser: RequestUserContext, @Param('jobId') jobId: string) {
    return this.jobService.getJob(currentUser, jobId);
  }

  @Post(':jobId/cancel')
  cancel(@CurrentUser() currentUser: RequestUserContext, @Param('jobId') jobId: string) {
    return this.jobService.cancelJob(currentUser, jobId);
  }
}
