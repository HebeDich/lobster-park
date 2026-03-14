import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { WsTicketService } from './ws-ticket.service';

@Global()
@Module({
  providers: [WsTicketService, RealtimeService],
  exports: [WsTicketService, RealtimeService],
})
export class RealtimeModule {}
