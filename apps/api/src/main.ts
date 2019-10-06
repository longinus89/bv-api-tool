/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 **/

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import * as cookieParser from 'cookie-parser'
import { defaultPort, globalPrefix } from './app/configs/global.config';

async function bootstrap() {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.port || defaultPort;


  const options = new DocumentBuilder()
    .setTitle('CMDaemon API')
    .setBasePath(globalPrefix)
    .setDescription('CMDaemon API description')
    .setVersion('1.0')
    .addTag('cmdaemon-api')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup(globalPrefix, app, document);

  await app.listen(port, () => {
    console.log('Listening at http://localhost:' + port + '/' + globalPrefix);
  });
}

bootstrap();
