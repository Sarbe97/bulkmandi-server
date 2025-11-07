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

    // ========== Security ==========
    // app.use(compression());

    // ========== CORS ==========
    // cors.options.ts
    const corsOptions = {
      origin: function (origin: string, callback: Function) {
        const whitelist = ["http://localhost:8080", process.env.FRONTEND_URL].filter(Boolean);

        // allow postman / mobile apps / curl (no origin header)
        if (!origin) return callback(null, true);

        if (whitelist.includes(origin)) return callback(null, true);

        return callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"],
      exposedHeaders: ["Content-Disposition"],
      maxAge: 86400,
    };

    app.enableCors(corsOptions);

    // ========== Global Pipes with ClassTransformer ==========
    // ✅ CRITICAL: Remove forbidNonWhitelisted for file uploads
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false, // ✅ CHANGED: Allow unknown properties (like complianceDocs from multipart)
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        skipMissingProperties: false,
        stopAtFirstError: false,
      }),
    );

    // ========== API Prefix ==========
    app.setGlobalPrefix("api/v1");

    // ========== Swagger Documentation ==========
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

    // ========== Start Server ==========
    const port = configService.get("PORT") || 3000;
    await app.listen(port);

    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
    console.log(`🔄 ClassTransformer enabled for @Transform decorators`);
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

bootstrap();
