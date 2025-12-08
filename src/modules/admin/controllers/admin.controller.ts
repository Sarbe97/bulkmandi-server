import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../../../common/guards/admin.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OrganizationsService } from "../../organizations/organizations.service";

@ApiTags("Admin Organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/organizations")
export class AdminController {
    constructor(private readonly organizationsService: OrganizationsService) { }

    @Post(":orgCode/create-invite-code")
    @ApiOperation({ summary: "Create invite code for organization" })
    @ApiParam({ name: "orgCode" })
    async createInviteCode(
        @Param("orgCode") orgCode: string,
        @Body() body: { expiryDays?: number }
    ) {
        return this.organizationsService.createInviteCode(orgCode, body.expiryDays);
    }

    @Post(":orgCode/revoke-invite-code")
    @ApiOperation({ summary: "Revoke invite code" })
    @ApiParam({ name: "orgCode" })
    async revokeInviteCode(@Param("orgCode") orgCode: string) {
        return this.organizationsService.revokeInviteCode(orgCode);
    }
}
