import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFileSync } from "fs";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Security
    // app.use(compression());

    // CORS
    app.enableCors({
      origin: process.env.FRONTEND_URL || "http://localhost:8080",
      credentials: true,
    });

    // Global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    // API prefix
    app.setGlobalPrefix("api/v1");

    // Swagger documentation
    if (configService.get("NODE_ENV") !== "production") {
      const config = new DocumentBuilder()
        .setTitle("B2B Marketplace API")
        .setDescription("Backend API for B2B Marketplace Platform")
        .setVersion("1.0")
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup("api/docs", app, document);

      writeFileSync("./swagger-spec.json", JSON.stringify(document, null, 2));
      console.log("✅ Swagger spec generated: swagger-spec.json");
    }

    const port = configService.get("PORT") || 3000;
    await app.listen(port);

    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(
      `📚 Swagger docs available at: http://localhost:${port}/api/docs`
    );
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

bootstrap();
