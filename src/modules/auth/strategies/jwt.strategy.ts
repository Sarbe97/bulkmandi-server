import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    // Payload contains: { userId, email, role, isAdmin, organizationId?, permissions? }
    
    const user = await this.userModel.findById(payload.userId);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

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
