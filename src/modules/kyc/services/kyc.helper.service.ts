import { Injectable } from "@nestjs/common";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";

@Injectable()
export class KycHelperService {
  constructor(private readonly logger: CustomLoggerService) {}

  /**
   * Comprehensive risk assessment
   * Purpose: Evaluate multiple risk factors, not just penny drop
   */
  public assessRisk(org: any): { level: string; score: number; remarks: string } {
    this.logger.log("assessRisk called");

    let riskScore = 100; // Start with perfect score
    const issues: string[] = [];

    // 1. Bank verification (most critical - 40 points)
    const pennyDropStatus = org.primaryBankAccount?.pennyDropStatus;
    const pennyDropScore = org.primaryBankAccount?.pennyDropScore || 0;

    if (pennyDropStatus === "FAILED" || !pennyDropStatus) {
      riskScore -= 40;
      issues.push("Bank verification failed");
    } else if (pennyDropScore < 95) {
      riskScore -= Math.floor((100 - pennyDropScore) / 2.5); // Partial deduction
      issues.push("Bank name mismatch detected");
    }

    // 2. Document completeness (20 points)
    if (!this.checkDocumentsComplete(org)) {
      riskScore -= 20;
      issues.push("Missing required documents");
    }

    // 3. GSTIN validation (15 points)
    if (!this.validateGSTIN(org.orgKyc?.gstin)) {
      riskScore -= 15;
      issues.push("Invalid GSTIN format");
    }

    // 4. PAN validation (15 points)
    if (!this.validatePAN(org.orgKyc?.pan)) {
      riskScore -= 15;
      issues.push("Invalid PAN format");
    }

    // 5. Address verification (10 points)
    if (!org.orgKyc?.registeredAddress || org.orgKyc.registeredAddress.length < 20) {
      riskScore -= 10;
      issues.push("Incomplete address");
    }

    // Calculate final level
    let level: string;
    if (riskScore >= 85) level = "Low";
    else if (riskScore >= 65) level = "Medium";
    else level = "High";

    const remarks = issues.length > 0 ? issues.join("; ") : "All checks passed";

    this.logger.log(`Risk assessment result: level=${level}, score=${riskScore}, remarks=${remarks}`);

    return { level, score: riskScore, remarks };
  }

  /**
   * Calculate age of KYC submission
   * Purpose: Track SLA (Service Level Agreement) - must process within 24h
   */
  public calculateAge(submittedAt?: Date): string {
    if (!submittedAt) return "00:00";
    const now = new Date();
    const diff = now.getTime() - new Date(submittedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const age = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    this.logger.log(`Calculated age: ${age}`);
    return age;
  }

  public validateGSTIN(gstin?: string): boolean {
    if (!gstin) {
      this.logger.log("GSTIN validation failed: empty");
      return false;
    }
    const valid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
    this.logger.log(`GSTIN validation result for ${gstin}: ${valid}`);
    return valid;
  }

  public validatePAN(pan?: string): boolean {
    if (!pan) {
      this.logger.log("PAN validation failed: empty");
      return false;
    }
    const valid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
    this.logger.log(`PAN validation result for ${pan}: ${valid}`);
    return valid;
  }

  public checkDocumentsComplete(org: any): boolean {
    const requiredDocs = ["GST_CERTIFICATE", "PAN_CERTIFICATE"];
    const uploadedTypes = (org.complianceDocuments || []).map((d: any) => d.type);
    const complete = requiredDocs.every((type) => uploadedTypes.includes(type));
    this.logger.log(`Documents completeness check: ${complete}`);
    return complete;
  }
}
