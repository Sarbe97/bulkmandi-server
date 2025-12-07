import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import { Model } from "mongoose";
import { UserRole } from "src/common/enums";
import { IdGeneratorService } from "src/common/services/id-generator.service";
import { Organization, OrganizationDocument } from "../organizations/schemas/organization.schema";
import { User, UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,

    @InjectModel(Organization.name)
    private organizationModel: Model<OrganizationDocument>,
    private jwtService: JwtService,
    private idGenerator: IdGeneratorService,
  ) { }

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
      throw new UnauthorizedException("Invalid email or password");
    }

    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role);

    // ALLOW LOGIN WITHOUT ORG - Frontend will handle redirection
    // if (!isAdmin && !user.organizationId) {
    //   throw new UnauthorizedException("User is not linked to an organization");
    // }

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

    // Generate access token with shorter expiry
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: "15m", // Adjust as needed
    });

    // Generate refresh token with longer expiry
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: "7d", // Adjust as needed
    });

    const response: any = {
      accessToken,
      refreshToken,
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

  async register(registerDto: { email: string; password: string; mobile: string; role: string }) {
    const { email, password, mobile, role } = registerDto;

    // Prevent admin registration via public API
    if ([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(role as UserRole)) {
      throw new ConflictException("Admin registration not allowed through this endpoint");
    }

    // Check for duplicate email
    const existingEmail = await this.userModel.findOne({
      email: email.toLowerCase(),
    });
    if (existingEmail) {
      throw new ConflictException("Email already exists. Please use a different email or login.");
    }

    // Check for duplicate mobile
    const existingMobile = await this.userModel.findOne({ mobile });
    if (existingMobile) {
      throw new ConflictException("Mobile number already exists. Please use a different mobile number.");
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user WITHOUT organization link
    const newUser = new this.userModel({
      email: email.toLowerCase(),
      password: hashedPassword,
      mobile,
      role,
      organizationId: null, // User must select/create organization next
    });
    const savedUser = await newUser.save();

    // Generate JWT token
    const payload = {
      userId: savedUser._id,
      email: savedUser.email,
      role: savedUser.role,
      isAdmin: false,
      needsOrgSelection: true, // Flag indicating user needs to select organization
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: savedUser._id.toString(),
        email: savedUser.email,
        role: savedUser.role,
        needsOrgSelection: true, // Frontend will show organization selection modal
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // Optional: Check if refresh token is revoked or invalidated here

      // Remove fields that should not be re-signed if any
      const { iat, exp, nbf, ...rest } = payload;

      // Generate and return new access token with shorter expiry
      const accessToken = this.jwtService.sign(rest, {
        expiresIn: '15m', // Same expiry as in login
      });

      return { accessToken };
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ADMIN ONLY: Create first admin user
  async seedFirstAdmin() {
    // Check if any admin already exists
    const existingAdmin = await this.userModel.findOne({
      role: { $in: ["ADMIN", "SUPER_ADMIN"] },
    });

    if (existingAdmin) {
      return {
        message: "Admin user already exists",
        email: existingAdmin.email,
      };
    }

    // Create first admin with dummy data
    const hashedPassword = await bcrypt.hash("qwerty123", 10);

    const admin = new this.userModel({
      email: "admin@bulkmandi.com",
      password: hashedPassword,
      name: "Super Admin",
      role: UserRole.ADMIN,
      permissions: ["*"], // All permissions
      organizationId: null,
      isActive: true,
    });

    await admin.save();

    return {
      message: "First admin created successfully",
      admin: {
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      credentials: {
        email: "admin@bulkmandi.com",
        password: "Admin@123",
      },
    };
  }
}
