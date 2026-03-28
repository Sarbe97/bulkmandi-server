import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../../../common/guards/admin.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OrganizationsService } from "../../organizations/organizations.service";
import { RfqService } from "../../rfq/rfq.service";
import { QuotesService } from "../../quotes/quotes.service";
import { PaymentsService } from "../../payments/payments.service";

@ApiTags("Admin Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
    constructor(
        private readonly organizationsService: OrganizationsService,
        private readonly rfqService: RfqService,
        private readonly quotesService: QuotesService,
        private readonly paymentsService: PaymentsService,
    ) { }

    @Get("organizations")
    @ApiOperation({ summary: "Get all organizations (Admin)" })
    @ApiQuery({ name: "role", required: false })
    @ApiQuery({ name: "kycStatus", required: false })
    async getAllOrganizations(
        @Query("role") role?: string,
        @Query("kycStatus") kycStatus?: string,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 20,
    ) {
        const filter: any = {};
        if (role) filter.role = role;
        if (kycStatus) filter.kycStatus = kycStatus;
        
        return this.organizationsService.findAll(filter);
    }

    @Get("rfqs")
    @ApiOperation({ summary: "Get all RFQs (Admin)" })
    async getAllRfqs(
        @Query("status") status?: string,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 20,
    ) {
        const filter: any = {};
        if (status) filter.status = status;
        return this.rfqService.findAll(filter, page, limit);
    }

    @Get("quotes")
    @ApiOperation({ summary: "Get all Quotes (Admin)" })
    async getAllQuotes(
        @Query("status") status?: string,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 20,
    ) {
        const filter: any = {};
        if (status) filter.status = status;
        return this.quotesService.findAll(filter, page, limit);
    }

    @Get("payments")
    @ApiOperation({ summary: "Get all Payments/Escrow (Admin)" })
    async getAllPayments(
        @Query("status") status?: string,
        @Query("escrowHoldStatus") escrowHoldStatus?: string,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 20,
    ) {
        const filter: any = {};
        if (status) filter.status = status;
        if (escrowHoldStatus) filter.escrowHoldStatus = escrowHoldStatus;
        return this.paymentsService.findAll(filter, page, limit);
    }
}
