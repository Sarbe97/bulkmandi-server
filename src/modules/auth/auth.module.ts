import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { PassportModule } from "@nestjs/passport";

import { IdGeneratorService } from "src/common/services/id-generator.service";
import { KycCase, KycCaseSchema } from "../kyc/schemas/kyc.schema";
import { Organization, OrganizationSchema } from "../organizations/schemas/organization.schema";
import { OrganizationsModule } from "../organizations/organizations.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthOrganizationService } from "./auth-organization.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          //expiresIn: configService.get<string>("JWT_EXPIRES_IN"),
        },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: KycCase.name, schema: KycCaseSchema },
    ]),
    OrganizationsModule, // ✅ Added OrganizationsModule
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthOrganizationService, JwtStrategy, LocalStrategy, IdGeneratorService],
  exports: [AuthService],
})
export class AuthModule { }
