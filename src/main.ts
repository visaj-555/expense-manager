import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MulterExceptionFilter } from './common/exceptions/multer.exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new MulterExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ------------------ CORS ------------------
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
      'https://stag.d3eh7bdhx8gko7.amplifyapp.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://stag.d3eh7bdhx8gko7.amplifyapp.com',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://localhost:5173'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Accept-Language',
    ],
    credentials: true,
    maxAge: 3600,
  });

  // ------------------ Global Prefix ------------------
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'api'],
  });

  // ------------------ Swagger Config ------------------
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PROJECT XYZ')
    .setDescription('API documentation for PROJECT XYZ backend')
    .setVersion('1.0')

    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'JWT-auth',
    )

    .addGlobalParameters({
      name: 'Accept-Language',
      in: 'header',
      required: false,
      description: 'Language code (en, hi)',
      schema: {
        type: 'string',
        enum: ['en', 'hi'],
        default: 'en',
      },
    })

    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });


  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Application running at http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger available at http://localhost:${port}/api`);


  app.useGlobalFilters(new MulterExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

}
bootstrap();