import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { Logger } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('KanvtechBackend');
  const app = await NestFactory.create(AppModule);

  // Production HTTP Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Environment-controlled CORS Hardening
  const configuredCorsOrigin = process.env.CORS_ORIGIN;
  const isDev = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // In development mode, allow localhost and 127.0.0.1
      if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Check configured production origins
      if (configuredCorsOrigin) {
        const allowedOrigins = configuredCorsOrigin.split(',').map((o) => o.trim());
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
      }

      // Deny unauthorized origins
      return callback(new Error(`CORS policy violation: Origin '${origin}' is not authorized`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Static uploads directory (used if STORAGE_DRIVER=local)
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  app.use('/uploads', express.static(uploadDir));

  // Swagger / OpenAPI documentation (strictly gated by SWAGGER_ENABLED=true)
  const isSwaggerEnabled = process.env.SWAGGER_ENABLED === 'true';

  if (isSwaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Kanvtech Service Management Platform API')
      .setDescription(
        'Production REST API with RBAC, Monotonic ID Generation, Continuous Multi-Tier Timer, Dynamic SLA, and Enterprise Audit Trails',
      )
      .setVersion('2.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`OpenAPI / Swagger Documentation available at: /api/docs`);
  } else {
    logger.log(`OpenAPI / Swagger documentation is disabled in production.`);
  }

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');

  logger.log(`=============================================================`);
  logger.log(` Kanvtech NestJS Modular Monolith running on port ${port}`);
  logger.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`=============================================================`);
}

bootstrap();
