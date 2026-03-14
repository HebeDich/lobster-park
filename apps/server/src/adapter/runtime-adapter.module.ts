import { Global, Module } from '@nestjs/common';
import { ContainerAdapter } from './container-adapter';
import { LocalProcessAdapter } from './local-process-adapter';
import { OpenClawPluginRuntimeService } from './openclaw-plugin-runtime.service';
import { RuntimeAdapterService } from './runtime-adapter.service';

@Global()
@Module({
  providers: [LocalProcessAdapter, ContainerAdapter, OpenClawPluginRuntimeService, RuntimeAdapterService],
  exports: [LocalProcessAdapter, ContainerAdapter, OpenClawPluginRuntimeService, RuntimeAdapterService],
})
export class RuntimeAdapterModule {}
