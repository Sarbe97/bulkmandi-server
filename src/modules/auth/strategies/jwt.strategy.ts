import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'your-secret-key',
      ignoreExpiration: false,
    });
  }


  async validate(payload: any) {
    // console.log('--- JWT Strategy Validate ---');
    // console.log('Payload:', JSON.stringify(payload, null, 2));

    const user = await this.userModel.findById(payload.userId);

    if (!user) {
      console.error('User not found for ID:', payload.userId);
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      console.error('User is inactive:', payload.userId);
      throw new UnauthorizedException('User inactive');
    }

    // console.log('User validated successfully:', user.email);

    // IMPORTANT: Return the complete user object with organizationId
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      isAdmin: payload.isAdmin || false,
      organizationId: payload.organizationId || user.organizationId?.toString(), // Include organizationId
      permissions: payload.permissions || [],
    };
  }

}
