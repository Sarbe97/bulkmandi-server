import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { GstResponseDto } from "./dto/gst-response.dto";
import { IfscResponseDto } from "./dto/ifsc-response.dto";
import { PostOfficeDto } from "./dto/pincode-response.dto";
import { IntegrationsService } from "./integrations.service";

@Controller("utility-apis")
export class IntegrationsController {
  constructor(private readonly utilityApisService: IntegrationsService) { }

  @Get("fleet-types")
  async getFleetTypes() {
    return this.utilityApisService.getFleetTypes();
  }

  @Get("plant-location-suggestions")
  async plantLocationSuggestions(@Query("q") query: string): Promise<PostOfficeDto[]> {
    if (!query) {
      throw new BadRequestException('Query parameter "q" is required');
    }
    return this.utilityApisService.getPlantLocationSuggestions(query);
  }

  @Get("validate-ifsc")
  async validateIfsc(@Query("code") code: string): Promise<IfscResponseDto> {
    if (!code) {
      throw new BadRequestException('Query parameter "code" is required');
    }
    return this.utilityApisService.validateIfscCode(code);
  }

  @Get("verify-gstin")
  async verifyGstin(@Query("gstin") gstin: string, @Query("apikey") apiKey: string): Promise<GstResponseDto> {
    if (!gstin) {
      throw new BadRequestException('Query parameter "gstin" is required');
    }
    if (!apiKey) {
      throw new BadRequestException('Query parameter "apikey" is required');
    }
    return this.utilityApisService.verifyGstin(gstin, apiKey);
  }

  @Post("verify-pennydrop")
  async verifyPennyDrop(@Body("accountNumber") accountNumber: string, @Body("ifscCode") ifscCode: string) {
    if (!accountNumber || !ifscCode) {
      throw new BadRequestException("accountNumber and ifscCode are required");
    }
    return this.utilityApisService.verifyPennyDrop(accountNumber, ifscCode);
  }
}
