import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { UserRole } from 'src/common/enums';
import {
  Organization,
  OrganizationDocument,
} from '../organizations/schemas/organization.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,

    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (user && isPasswordValid) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(loginDto: { email: string; password: string; ip?: string }) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role);

    if (!isAdmin && !user.organizationId) {
      throw new UnauthorizedException('User is not linked to an organization');
    }

    // Update last login
    await this.userModel.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
      lastLoginIp: loginDto.ip,
    });

    // ✅ FETCH ORGANIZATION NAME
    let organizationName = null;
    if (!isAdmin && user.organizationId) {
      const org = await this.organizationModel.findById(user.organizationId);
      organizationName = org?.legalName || null;
    }

    // Build JWT payload
    const payload: any = {
      userId: user._id.toString(), // IMPORTANT: Convert ObjectId to string
      email: user.email,
      role: user.role,
      isAdmin,
    };

    // Add organizationId for non-admin users
    if (!isAdmin && user.organizationId) {
      payload.organizationId = user.organizationId.toString(); // IMPORTANT: Convert to string
    }

    // Add permissions for admin users
    if (isAdmin) {
      payload.permissions = user.permissions || [];
    }

    const response: any = {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };

    if (!isAdmin) {
      response.user.organizationId = user.organizationId?.toString();
      response.user.organizationName = organizationName;
    }

    if (isAdmin) {
      response.user.permissions = user.permissions;
    }

    return response;
  }

  async register(registerDto: {
    email: string;
    password: string;
    mobile: string;
    role: string;
    organizationName: string;
  }) {
    const { email, password, mobile, role, organizationName } = registerDto;

    // Prevent admin registration via public API
    if ([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(role as UserRole)) {
      throw new ConflictException(
        'Admin registration not allowed through this endpoint',
      );
    }

    // Check for duplicate email
    const existingEmail = await this.userModel.findOne({
      email: email.toLowerCase(),
    });
    if (existingEmail) {
      throw new ConflictException(
        'Email already exists. Please use a different email or login.',
      );
    }

    // Check for duplicate mobile
    const existingMobile = await this.userModel.findOne({ mobile });
    if (existingMobile) {
      throw new ConflictException(
        'Mobile number already exists. Please use a different mobile number.',
      );
    }

    // Generate unique orgId
    const orgCount = await this.organizationModel.countDocuments();
    const orgId = `ORG-${String(orgCount + 1).padStart(6, '0')}`;

    // Create organization
    const organization = new this.organizationModel({
      orgId,
      legalName: organizationName,
      role,
      completedSteps: [],
      kycStatus: 'DRAFT',
      status: 'ACTIVE',
      isVerified: false,
    });
    const savedOrg = await organization.save();

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user linked to organization
    const newUser = new this.userModel({
      email: email.toLowerCase(),
      password: hashedPassword,
      mobile,
      role,
      organizationId: savedOrg._id,
    });
    const savedUser = await newUser.save();

    // Generate JWT token
    const payload = {
      userId: savedUser._id,
      email: savedUser.email,
      role: savedUser.role,
      organizationId: savedOrg._id.toString(),
      isAdmin: false,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: savedUser._id.toString(),
        email: savedUser.email,
        role: savedUser.role,
        organizationId: savedOrg._id.toString(),
        orgId: savedOrg.orgId,
      },
    };
  }

  // ADMIN ONLY: Create first admin user
  async seedFirstAdmin() {
    // Check if any admin already exists
    const existingAdmin = await this.userModel.findOne({
      role: { $in: ['ADMIN', 'SUPER_ADMIN'] },
    });

    if (existingAdmin) {
      return {
        message: 'Admin user already exists',
        email: existingAdmin.email,
      };
    }

    // Create first admin with dummy data
    const hashedPassword = await bcrypt.hash('qwerty123', 10);

    const admin = new this.userModel({
      email: 'admin@bulkmandi.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: UserRole.ADMIN,
      permissions: ['*'], // All permissions
      organizationId: null,
      isActive: true,
    });

    await admin.save();

    return {
      message: 'First admin created successfully',
      admin: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      credentials: {
        email: 'admin@bulkmandi.com',
        password: 'Admin@123',
      },
    };
  }
}
