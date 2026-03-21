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

}
