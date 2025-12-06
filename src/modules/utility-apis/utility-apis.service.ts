import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GstResponseDto } from './dto/gst-response.dto';
import { IfscResponseDto } from './dto/ifsc-response.dto';
import { PincodeResponseDto, PostOfficeDto } from './dto/pincode-response.dto';
import { FLEET_TYPES_MASTER } from './constants';

@Injectable()
export class UtilityApisService {
  private readonly logger = new Logger(UtilityApisService.name);

  async getFleetTypes() {
    return FLEET_TYPES_MASTER;
  }

  /**
   * Get plant location suggestions by pincode or post office name
   */
  async getPlantLocationSuggestions(query: string): Promise<PostOfficeDto[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const isPincode = /^\d{6}$/.test(trimmed);
    const url = isPincode
      ? `https://api.postalpincode.in/pincode/${encodeURIComponent(trimmed)}`
      : `https://api.postalpincode.in/postoffice/${encodeURIComponent(trimmed)}`;

    try {
      const { data } = await axios.get<PincodeResponseDto[]>(url, { timeout: 10000 });

      const first = Array.isArray(data) ? data[0] : null;
      if (!first || first.Status !== 'Success' || !Array.isArray(first.PostOffice)) {
        return [];
      }

      return first.PostOffice;
    } catch (error) {
      this.logger.error(`Error fetching plant location for query '${query}': ${error.message}`);
      return [];
    }
  }

  /**
   * Validate IFSC code and get bank details
   */
  async validateIfscCode(ifscCode: string): Promise<IfscResponseDto> {
    const trimmed = ifscCode.trim().toUpperCase();

    if (!trimmed || trimmed.length !== 11) {
      throw new BadRequestException('IFSC code must be exactly 11 characters');
    }

    try {
      const { data } = await axios.get<IfscResponseDto>(
        `https://ifsc.razorpay.com/${encodeURIComponent(trimmed)}`,
        { timeout: 10000 }
      );

      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new BadRequestException('Invalid IFSC code');
      }
      this.logger.error(`Error validating IFSC code ${ifscCode}: ${error.message}`);
      throw new BadRequestException('Failed to validate IFSC code');
    }
  }

  /**
   * Verify GST number
   */
  async verifyGstin(gstin: string, apiKey: string): Promise<GstResponseDto> {
    const trimmed = gstin.trim().toUpperCase();

    if (!trimmed || trimmed.length !== 15) {
      throw new BadRequestException('GSTIN must be exactly 15 characters');
    }

    try {
      const url = `https://appyflow.in/api/verifyGST?gstNo=${trimmed}&key_secret=${apiKey}`;
      const { data } = await axios.get<GstResponseDto>(url, { timeout: 10000 });

      return data;
    } catch (error: any) {
      this.logger.error(`Error verifying GSTIN ${gstin}: ${error.message}`);
      throw new BadRequestException('Failed to verify GSTIN');
    }
  }

  async verifyPennyDrop(accountNumber: string, ifscCode: string) {
    if (!accountNumber || !ifscCode) {
      throw new BadRequestException('accountNumber and ifscCode are required');
    }
    const trimmedIfsc = ifscCode.trim().toUpperCase();
    const trimmedAccount = accountNumber.trim();

    try {
      const url = `https://api.razorpay.com/v1/penny-drop/validate`;
      const auth = {
        username: process.env.RAZORPAY_KEY_ID,
        password: process.env.RAZORPAY_KEY_SECRET,
      };

      const payload = {
        ifsc_code: trimmedIfsc,
        account_number: trimmedAccount,
      };

      const response = await axios.post(url, payload, {
        auth,
        timeout: 10000,
      });

      /*
      Response format example (Razorpay docs):
      {
        "status": "success",
        "message": "Account number is valid for the IFSC code provided"
      }
      */

      return response.data;
    } catch (error: any) {
      if (error.response) {
        this.logger.error(`Razorpay Penny Drop API error: ${error.response.data.error.description}`);
        throw new BadRequestException(error.response.data.error.description);
      }
      this.logger.error(`Failed to verify penny drop: ${error.message}`);
      throw new BadRequestException('Failed to verify bank account');
    }
  }
}
