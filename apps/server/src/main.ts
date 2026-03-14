import 'reflect-metadata';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { RealtimeService } from './common/realtime/realtime.service';
import { registerStaticWeb, resolveStaticWebDistDir } from './bootstrap/static-web';
import { OpenClawTerminalRealtimeService } from './modules/openclaw/openclaw-terminal-realtime.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const httpServer = app.getHttpServer();
  app.setGlobalPrefix('api/v1', { exclude: ['/health', '/ready', '/metrics', '/info'] });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  const webDistDir = resolveStaticWebDistDir({ currentDir: __dirname });
  if (webDistDir) {
    registerStaticWeb(app, webDistDir);
  }
  const realtime = app.get(RealtimeService);
  realtime.attach();
  const terminalRealtime = app.get(OpenClawTerminalRealtimeService);
  terminalRealtime.attach();
  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (realtime.canHandle(request.url)) {
      realtime.handleUpgrade(request, socket, head);
      return;
    }
    if (terminalRealtime.canHandle(request.url)) {
      terminalRealtime.handleUpgrade(request, socket, head);
      return;
    }
    socket.destroy();
  });
  const port = Number(process.env.PORT || 3301);
  await app.listen(port);
}

bootstrap();
