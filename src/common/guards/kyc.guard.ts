import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '@modules/organizations/schemas/organization.schema';

@Injectable()
export class KycGuard implements CanActivate {
  constructor(
    @InjectModel(Organization.name) private readonly orgModel: Model<OrganizationDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Admins bypass KYC check
    if (user.isAdmin) {
      return true;
    }

    if (!user.organizationId) {
      throw new ForbiddenException('You must be part of an organization to perform this action.');
    }

    const org = await this.orgModel.findById(user.organizationId);
    if (!org) {
      throw new ForbiddenException('Organization not found.');
    }

    if (!org.isVerified || org.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Your Organization KYC is not verified. Please complete onboarding first.');
    }

    return true;
  }
}
