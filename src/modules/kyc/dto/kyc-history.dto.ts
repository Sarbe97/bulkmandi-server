
export interface KYCHistoryItem {
  caseId: string;
  submissionNumber: string;
  status: string;
  submissionAttempt: number;
  submittedAt: Date;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
}
