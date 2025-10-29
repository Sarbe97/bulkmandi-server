import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from './app.module';

async function generateSwagger() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('Auto-generated API documentation')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Save as JSON
  writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));

  console.log('✅ Swagger JSON spec generated at ./swagger-spec.json');
  await app.close();
}

generateSwagger();
