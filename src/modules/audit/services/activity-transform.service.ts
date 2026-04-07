import { Injectable } from '@nestjs/common';
import { AuditLog } from '../schemas/audit-log.schema';
import { AuditAction } from 'src/common/constants/app.constants';

export interface ActivityFeedItem {
  id: string;
  type: 'RFQ' | 'QUOTE' | 'ORDER' | 'SHIPMENT' | 'PAYMENT' | 'KYC' | 'SYSTEM';
  title: string;
  description: string;
  timestamp: Date;
  link: string;
  metadata?: any;
}

@Injectable()
export class ActivityTransformService {
  /**
   * Transforms a raw AuditLog into a user-friendly ActivityFeedItem based on who is viewing it.
   */
  transform(log: AuditLog, viewerRole: string): ActivityFeedItem | null {
    const action = log.action as AuditAction;
    const isActor = log.actorId?.toString() === 'viewerId'; // Placeholder logic, will be handled by caller context if needed

    let title = '';
    let description = '';
    let link = '';
    let type: ActivityFeedItem['type'] = 'SYSTEM';

    switch (action) {
      // --- RFQ ---
      case AuditAction.RFQ_CREATED:
        type = 'RFQ';
        title = 'RFQ Created';
        description = `New RFQ #${log.entityIdStr} was created.`;
        link = `/${viewerRole.toLowerCase()}/rfqs/${log.entityIdStr}`;
        break;

      case AuditAction.RFQ_PUBLISHED:
        type = 'RFQ';
        title = 'RFQ Published';
        description = `RFQ #${log.entityIdStr} is now live for bidding.`;
        link = `/${viewerRole.toLowerCase()}/rfqs/${log.entityIdStr}`;
        break;

      // --- QUOTE ---
      case AuditAction.QUOTE_SUBMITTED:
        type = 'QUOTE';
        title = viewerRole === 'BUYER' ? 'New Quote Received' : 'Quote Submitted';
        description = viewerRole === 'BUYER' 
          ? `A new quote was received for RFQ #${log.afterState?.rfqId || 'N/A'}.`
          : `Your quote for RFQ #${log.afterState?.rfqId || 'N/A'} was submitted successfully.`;
        link = `/${viewerRole.toLowerCase()}/quotes/${log.entityIdStr}`;
        break;

      case AuditAction.QUOTE_ACCEPTED:
        type = 'QUOTE';
        title = 'Quote Accepted';
        description = `Quote #${log.entityIdStr} has been accepted.`;
        link = `/${viewerRole.toLowerCase()}/orders/${log.afterState?.orderId || ''}`;
        break;

      // --- ORDER ---
      case AuditAction.ORDER_CREATED:
        type = 'ORDER';
        title = 'New Order Generated';
        description = `Order #${log.entityIdStr} has been created from Quote #${log.afterState?.quoteId}.`;
        link = `/${viewerRole.toLowerCase()}/orders/${log.entityIdStr}`;
        break;

      case AuditAction.ORDER_STATUS_CHANGED:
        type = 'ORDER';
        title = 'Order Status Updated';
        description = `Order #${log.entityIdStr} is now ${log.afterState?.status || 'updated'}.`;
        link = `/${viewerRole.toLowerCase()}/orders/${log.entityIdStr}`;
        break;

      // --- SHIPMENT ---
      case AuditAction.SHIPMENT_DISPATCHED:
        type = 'SHIPMENT';
        title = 'Shipment Dispatched';
        description = `Items for Order #${log.afterState?.orderId || 'N/A'} are on the way.`;
        link = `/${viewerRole.toLowerCase()}/shipments/${log.entityIdStr}`;
        break;

      case AuditAction.SHIPMENT_DELIVERED:
        type = 'SHIPMENT';
        title = 'Shipment Delivered';
        description = `Shipment #${log.entityIdStr} has reached its destination.`;
        link = `/${viewerRole.toLowerCase()}/shipments/${log.entityIdStr}`;
        break;

      // --- PAYMENT ---
      case AuditAction.PAYMENT_ESCROW_INITIATED:
        type = 'PAYMENT';
        title = 'Payment Initiated';
        description = `Escrow payment for Order #${log.afterState?.orderId || 'N/A'} was initiated.`;
        link = `/${viewerRole.toLowerCase()}/payments/${log.entityIdStr}`;
        break;

      // --- KYC ---
      case AuditAction.KYC_APPROVED:
        type = 'KYC';
        title = 'KYC Verified';
        description = 'Your organization KYC has been approved by the admin.';
        link = '/settings/profile';
        break;

      default:
        // Basic fallback for unmapped actions
        title = log.module + ' Activity';
        description = log.description || 'System event occurred';
        link = '#';
    }

    return {
      id: log.logId,
      type,
      title,
      description,
      timestamp: log.timestamp,
      link,
      metadata: {
        entityId: log.entityId,
        entityIdStr: log.entityIdStr,
      }
    };
  }
}
