import { Controller, Get, Param, Put, Query, UseGuards, Request } from "@nestjs/common";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../../../common/guards/admin.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OrganizationsService } from "../../organizations/organizations.service";
import { RfqService } from "../../rfq/rfq.service";
import { QuotesService } from "../../quotes/quotes.service";
import { PaymentsService } from "../../payments/payments.service";
import { RejectPaymentDto } from "../../payments/dto/reject-payment.dto";
import { Body } from "@nestjs/common";

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
        private readonly logger: CustomLoggerService,
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
        this.logger.log(`Admin fetching organizations with filter: role=${role}, kycStatus=${kycStatus}`);
        const filter: any = {};
        if (role) filter.role = role;
        if (kycStatus) filter.kycStatus = kycStatus;
        
        return this.organizationsService.findAll(filter);
    }

    @Get("organizations/:id")
    @ApiOperation({ summary: "Get organization details (Admin)" })
    async getOrganizationDetails(@Param("id") id: string) {
        this.logger.log(`Admin fetching organization details for ID: ${id}`);
        return this.organizationsService.getOrganization(id);
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

    @Put("payments/:id/verify")
    @ApiOperation({ summary: "Verify payment submission (Admin manual gate)" })
    async verifyPayment(
        @Param("id") id: string,
        @Request() req: any,
    ) {
        this.logger.log(`Admin ${req.user.id} verifying payment: ${id}`);
        return this.paymentsService.adminVerifyPayment(id, req.user.id);
    }

    @Put("payments/:id/reject")
    @ApiOperation({ summary: "Reject payment submission (Admin manual gate)" })
    async rejectPayment(
        @Param("id") id: string,
        @Body() dto: RejectPaymentDto,
        @Request() req: any,
    ) {
        return this.paymentsService.adminRejectPayment(id, req.user.id, dto.reason);
    }
}
