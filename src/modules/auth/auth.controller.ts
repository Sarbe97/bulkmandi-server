import { OrganizationsService } from '@modules/organizations/organizations.service';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly orgService: OrganizationsService,
  ) { }

  @Post('register')
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async register(@Body() registerDto: any) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('logout')
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout() {
    return { success: true, message: 'Logged out successfully' };
  }

  @Post('refresh-token')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Get('admin/create')
  async createAdmin() {
    return this.authService.seedFirstAdmin();
  }

  // ===== NEW: Organization Selection Endpoints =====

  @Get('organizations/search')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Search organizations by name or code' })
  @ApiQuery({ name: 'q', description: 'Search term (minimum 2 characters)' })
  @ApiQuery({ name: 'role', description: 'Organization role (SELLER, BUYER, LOGISTIC)' })
  async searchOrganizations(
    @Query('q') searchTerm: string,
    @Query('role') role: string,
    @CurrentUser() user: any,
  ) {
    // Fallback to user role if not provided (though query param implies it's optional?)
    // Actually the query param description says Role. But the method signature has role.
    // If not provided, maybe default to user.role?
    // Let's use user.role as primary constraint if not specified, 
    // or validate that user.role matches searched role if provided.
    // Simpler: use user.role to ensure they only search relevant orgs.
    return this.orgService.searchOrganizations(searchTerm, user.role);
  }

  @Post('organizations/link')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Link user to an existing organization' })
  async linkToOrganization(
    @CurrentUser() user: any,
    @Body() body: { orgCode: string; requestRevision?: boolean },
  ) {
    return this.orgService.linkUserToOrganization(
      user.userId,
      body.orgCode,
      body.requestRevision || false,
    );
  }

  @Post('organizations/create-and-link')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create new organization and link user' })
  async createAndLinkOrganization(
    @CurrentUser() user: any,
    @Body() body: { legalName: string; role: string },
  ) {
    // Ensure role matches user role
    return this.orgService.createOrganizationAndLinkUser(user.userId, {
      legalName: body.legalName,
      role: user.role, // Enforce user's role
    });
  }

  @Post('organizations/join-with-code')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join organization using invite code' })
  async joinWithCode(
    @CurrentUser() user: any,
    @Body() body: { inviteCode: string },
  ) {
    return this.orgService.joinWithInviteCode(user.userId, body.inviteCode);
  }

  @Get('organizations/check-name')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if organization name is available' })
  @ApiQuery({ name: 'name', description: 'Organization name' })
  async checkOrgName(
    @Query('name') name: string,
    @CurrentUser() user: any,
  ) {
    return this.orgService.checkOrgNameAvailability(name, user.role);
  }
}
