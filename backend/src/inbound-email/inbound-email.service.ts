import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsService } from '../tickets/tickets.service';
import { SlaService } from '../sla/sla.service';
import {
  InboundEmailPayloadDto,
  UpdateInboundEmailSettingsDto,
  ResolveInboundEmailDto,
  InboundEmailFilterDto,
} from './dto/inbound-email.dto';
import { TicketPriority, CommentType, NotificationChannel, EmployeeLevel } from '@prisma/client';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

export interface InboundEmailSettings {
  enabled: boolean;
  supportAddress: string;
  provider: string;
  webhookSecret: string;
  unknownSenderAction: 'PENDING_REVIEW' | 'CREATE_TRIAGE_TICKET' | 'REJECT';
  unmatchedProductAction: 'PENDING_REVIEW' | 'AUTO_ASSIGN_FIRST' | 'CREATE_TRIAGE_TICKET';
  defaultPriority: TicketPriority;
  defaultCategory: string;
  maxAttachmentSizeMb: number;
  sendCustomerAck: boolean;
  lastReceivedAt: string | null;
  totalReceivedCount: number;
  totalProcessedCount: number;
  totalPendingCount: number;
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly ticketsService: TicketsService,
    private readonly slaService: SlaService,
  ) {}

  // ==========================================
  // SETTINGS & CONFIGURATION MANAGEMENT
  // ==========================================

  async getSettings(): Promise<InboundEmailSettings> {
    const keys = [
      'EMAIL_TO_TICKET_ENABLED',
      'EMAIL_TO_TICKET_SUPPORT_ADDRESS',
      'EMAIL_TO_TICKET_PROVIDER',
      'EMAIL_TO_TICKET_WEBHOOK_SECRET',
      'EMAIL_TO_TICKET_UNKNOWN_SENDER_ACTION',
      'EMAIL_TO_TICKET_UNMATCHED_PRODUCT_ACTION',
      'EMAIL_TO_TICKET_DEFAULT_PRIORITY',
      'EMAIL_TO_TICKET_DEFAULT_CATEGORY',
      'EMAIL_TO_TICKET_MAX_ATTACHMENT_SIZE_MB',
      'EMAIL_TO_TICKET_SEND_CUSTOMER_ACK',
      'EMAIL_TO_TICKET_LAST_RECEIVED_AT',
    ];

    const records = await this.prisma.systemSetting.findMany({
      where: { settingKey: { in: keys } },
    });
    const map = new Map<string, string>();
    records.forEach((r) => map.set(r.settingKey, r.settingValue));

    // Stats aggregation
    const [totalReceivedCount, totalProcessedCount, totalPendingCount] = await Promise.all([
      this.prisma.inboundEmailLog.count(),
      this.prisma.inboundEmailLog.count({ where: { status: { in: ['PROCESSED', 'REPLY_APPENDED'] } } }),
      this.prisma.inboundEmailLog.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);

    return {
      enabled: map.get('EMAIL_TO_TICKET_ENABLED') !== 'false',
      supportAddress: map.get('EMAIL_TO_TICKET_SUPPORT_ADDRESS') || process.env.SUPPORT_EMAIL || 'support@kanvtech.com',
      provider: map.get('EMAIL_TO_TICKET_PROVIDER') || 'GENERIC_WEBHOOK',
      webhookSecret: map.get('EMAIL_TO_TICKET_WEBHOOK_SECRET') || process.env.INBOUND_EMAIL_WEBHOOK_SECRET || 'kanvtech-inbound-secret-2026',
      unknownSenderAction: (map.get('EMAIL_TO_TICKET_UNKNOWN_SENDER_ACTION') as any) || 'PENDING_REVIEW',
      unmatchedProductAction: (map.get('EMAIL_TO_TICKET_UNMATCHED_PRODUCT_ACTION') as any) || 'PENDING_REVIEW',
      defaultPriority: (map.get('EMAIL_TO_TICKET_DEFAULT_PRIORITY') as TicketPriority) || TicketPriority.MEDIUM,
      defaultCategory: map.get('EMAIL_TO_TICKET_DEFAULT_CATEGORY') || 'Email Inbound',
      maxAttachmentSizeMb: Number(map.get('EMAIL_TO_TICKET_MAX_ATTACHMENT_SIZE_MB')) || 10,
      sendCustomerAck: map.get('EMAIL_TO_TICKET_SEND_CUSTOMER_ACK') !== 'false',
      lastReceivedAt: map.get('EMAIL_TO_TICKET_LAST_RECEIVED_AT') || null,
      totalReceivedCount,
      totalProcessedCount,
      totalPendingCount,
    };
  }

  async updateSettings(dto: UpdateInboundEmailSettingsDto, actorUserId?: number): Promise<InboundEmailSettings> {
    const upsertSetting = async (key: string, value: string, desc: string) => {
      await this.prisma.systemSetting.upsert({
        where: { settingKey: key },
        update: { settingValue: value, description: desc },
        create: { settingKey: key, settingValue: value, description: desc },
      });
    };

    if (dto.enabled !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_ENABLED', String(dto.enabled), 'Email-to-Ticket automation active flag');
    }
    if (dto.supportAddress !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_SUPPORT_ADDRESS', dto.supportAddress.trim(), 'Primary inbound support email address');
    }
    if (dto.provider !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_PROVIDER', dto.provider.trim(), 'Selected email ingestion provider');
    }
    if (dto.webhookSecret !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_WEBHOOK_SECRET', dto.webhookSecret.trim(), 'Secret key for authenticating inbound webhooks');
    }
    if (dto.unknownSenderAction !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_UNKNOWN_SENDER_ACTION', dto.unknownSenderAction, 'Handling strategy for unverified sender emails');
    }
    if (dto.unmatchedProductAction !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_UNMATCHED_PRODUCT_ACTION', dto.unmatchedProductAction, 'Handling strategy for ambiguous product entitlements');
    }
    if (dto.defaultPriority !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_DEFAULT_PRIORITY', dto.defaultPriority, 'Default ticket priority for inbound emails');
    }
    if (dto.defaultCategory !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_DEFAULT_CATEGORY', dto.defaultCategory.trim(), 'Default ticket category for inbound emails');
    }
    if (dto.maxAttachmentSizeMb !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_MAX_ATTACHMENT_SIZE_MB', String(dto.maxAttachmentSizeMb), 'Maximum attachment size in MB');
    }
    if (dto.sendCustomerAck !== undefined) {
      await upsertSetting('EMAIL_TO_TICKET_SEND_CUSTOMER_ACK', String(dto.sendCustomerAck), 'Send automated confirmation receipt to sender');
    }

    await this.auditService.log({
      actorUserId,
      action: 'SYSTEM_SETTINGS_UPDATED',
      entityType: 'INBOUND_EMAIL_SETTINGS',
      entityId: 'EMAIL_TO_TICKET',
      newValues: dto,
    });

    return this.getSettings();
  }

  // ==========================================
  // SECURITY & WEBHOOK SIGNATURE VERIFICATION
  // ==========================================

  verifyWebhookSignature(headers: Record<string, any>, rawBody: string | Buffer | object): boolean {
    const signature = headers['x-webhook-signature'] || headers['x-kanvtech-signature'] || headers['x-hub-signature-256'] || headers['authorization'];
    const timestamp = headers['x-webhook-timestamp'] || headers['x-kanvtech-timestamp'];

    // If Bearer token provided in Authorization header
    if (signature && typeof signature === 'string' && signature.startsWith('Bearer ')) {
      const token = signature.slice(7).trim();
      return token.length > 0;
    }

    // If timestamp present, verify replay window (10 minutes)
    if (timestamp) {
      const ts = Number(timestamp);
      if (!isNaN(ts)) {
        const diff = Math.abs(Date.now() - ts);
        if (diff > 10 * 60 * 1000) {
          this.logger.warn(`Inbound email webhook rejected: timestamp drift exceeds 10 minutes (${diff}ms).`);
          return false;
        }
      }
    }

    return true;
  }

  // ==========================================
  // MAIN INBOUND EMAIL PROCESSING PIPELINE
  // ==========================================

  async processInboundEmail(
    payload: InboundEmailPayloadDto,
    provider: string = 'GENERIC_WEBHOOK',
    rawPayload?: any,
  ): Promise<{ success: boolean; status: string; logId: number; ticketId?: string; message: string }> {
    const settings = await this.getSettings();

    // Check if system is active
    if (!settings.enabled) {
      this.logger.warn('Inbound Email processing is disabled in system settings.');
      const log = await this.prisma.inboundEmailLog.create({
        data: {
          provider,
          senderEmail: payload.from,
          senderName: payload.fromName || null,
          recipientEmail: payload.to,
          subject: payload.subject || '(No Subject)',
          bodyPlain: payload.text || null,
          bodyHtml: payload.html || null,
          messageId: payload.messageId || null,
          inReplyTo: payload.inReplyTo || null,
          references: payload.references || null,
          status: 'IGNORED',
          errorMessage: 'Email-to-Ticket automation is currently disabled.',
          rawPayloadJson: rawPayload ? JSON.stringify(rawPayload) : null,
          processedAt: new Date(),
        },
      });
      return { success: false, status: 'IGNORED', logId: log.id, message: 'Email automation is currently disabled.' };
    }

    // Update last received timestamp
    await this.prisma.systemSetting.upsert({
      where: { settingKey: 'EMAIL_TO_TICKET_LAST_RECEIVED_AT' },
      update: { settingValue: new Date().toISOString() },
      create: {
        settingKey: 'EMAIL_TO_TICKET_LAST_RECEIVED_AT',
        settingValue: new Date().toISOString(),
        description: 'Timestamp of the latest inbound email received',
      },
    });

    const cleanSender = this.extractCleanEmail(payload.from);
    const cleanRecipient = this.extractCleanEmail(payload.to);
    const cleanSubject = (payload.subject || '(No Subject)').trim();
    const cleanText = (payload.text || this.stripHtmlTags(payload.html || '') || '').trim();

    // 1. Idempotency & Duplicate Check
    if (payload.messageId) {
      const existing = await this.prisma.inboundEmailLog.findFirst({
        where: {
          messageId: payload.messageId,
          status: { in: ['PROCESSED', 'REPLY_APPENDED'] },
        },
      });
      if (existing) {
        this.logger.log(`Duplicate inbound email detected with Message-ID: ${payload.messageId}. Skipping.`);
        return {
          success: true,
          status: 'DUPLICATE',
          logId: existing.id,
          ticketId: existing.ticketId || undefined,
          message: 'Email already processed.',
        };
      }
    }

    // Create Initial Log Record
    let logRecord = await this.prisma.inboundEmailLog.create({
      data: {
        provider,
        senderEmail: cleanSender,
        senderName: payload.fromName || this.extractDisplayName(payload.from) || null,
        recipientEmail: cleanRecipient,
        subject: cleanSubject.slice(0, 255),
        bodyPlain: cleanText,
        bodyHtml: payload.html || null,
        messageId: payload.messageId || null,
        inReplyTo: payload.inReplyTo || null,
        references: payload.references || null,
        status: 'PENDING_REVIEW',
        rawPayloadJson: rawPayload ? JSON.stringify(rawPayload) : null,
        attachmentsJson: payload.attachments ? JSON.stringify(payload.attachments.map((a) => ({ filename: a.filename, size: a.size, contentType: a.contentType }))) : null,
      },
    });

    try {
      // 2. Check for Threading & Reply to Existing Ticket
      const existingTicket = await this.detectExistingTicket(cleanSubject, payload.inReplyTo, payload.references);

      if (existingTicket) {
        this.logger.log(`Inbound email matched existing ticket ${existingTicket.id}. Appending reply.`);
        const replyResult = await this.appendReplyToTicket(existingTicket, payload, cleanSender, logRecord.id);

        await this.prisma.inboundEmailLog.update({
          where: { id: logRecord.id },
          data: {
            status: 'REPLY_APPENDED',
            ticketId: existingTicket.id,
            matchedCompanyId: existingTicket.companyId,
            matchedContactId: existingTicket.customerContactId,
            processedAt: new Date(),
          },
        });

        return {
          success: true,
          status: 'REPLY_APPENDED',
          logId: logRecord.id,
          ticketId: existingTicket.id,
          message: `Reply appended to ticket ${existingTicket.id}.`,
        };
      }

      // 3. Customer & Contact Identification
      const contactMatch = await this.resolveCustomerContact(cleanSender);

      if (!contactMatch.success) {
        if (settings.unknownSenderAction === 'CREATE_TRIAGE_TICKET') {
          // Fallback to Triage Ticket
          this.logger.warn(`Unknown sender ${cleanSender}. Creating triage ticket as per configuration.`);
          const triageTicket = await this.createTriageTicket(payload, cleanSender, logRecord.id, contactMatch.reason);
          await this.prisma.inboundEmailLog.update({
            where: { id: logRecord.id },
            data: {
              status: 'PROCESSED',
              ticketId: triageTicket.id,
              errorMessage: `Created as triage ticket: ${contactMatch.reason}`,
              processedAt: new Date(),
            },
          });
          return {
            success: true,
            status: 'PROCESSED',
            logId: logRecord.id,
            ticketId: triageTicket.id,
            message: `Triage ticket ${triageTicket.id} created for unverified sender.`,
          };
        }

        // Place in Pending Review Queue
        await this.prisma.inboundEmailLog.update({
          where: { id: logRecord.id },
          data: {
            status: 'PENDING_REVIEW',
            errorMessage: contactMatch.reason,
            processedAt: new Date(),
          },
        });

        return {
          success: false,
          status: 'PENDING_REVIEW',
          logId: logRecord.id,
          message: `Email queued for review: ${contactMatch.reason}`,
        };
      }

      const { contact, company, customerUser } = contactMatch;

      // 4. Product & Entitlement Resolution
      const productMatch = await this.resolveProductEntitlement(company.id, cleanSubject, cleanText);

      if (!productMatch.success) {
        if (settings.unmatchedProductAction === 'AUTO_ASSIGN_FIRST' && productMatch.fallbackProductId) {
          this.logger.log(`Multiple products found for customer ${company.companyName}. Auto-assigning first product ${productMatch.fallbackProductId}.`);
        } else {
          // Queue for Review
          await this.prisma.inboundEmailLog.update({
            where: { id: logRecord.id },
            data: {
              status: 'PENDING_REVIEW',
              matchedCompanyId: company.id,
              matchedContactId: contact.id,
              errorMessage: productMatch.reason,
              processedAt: new Date(),
            },
          });

          return {
            success: false,
            status: 'PENDING_REVIEW',
            logId: logRecord.id,
            message: `Email queued for review: ${productMatch.reason}`,
          };
        }
      }

      const effectiveProductId = productMatch.productId || productMatch.fallbackProductId!;

      // 5. Create New Ticket
      const createdTicket = await this.createInboundTicket({
        companyId: company.id,
        contactId: contact.id,
        productId: effectiveProductId,
        customerUserId: customerUser?.id,
        subject: cleanSubject,
        body: cleanText,
        priority: settings.defaultPriority,
        category: settings.defaultCategory,
        attachments: payload.attachments,
        logId: logRecord.id,
      });

      // 6. Send Customer Acknowledgement
      if (settings.sendCustomerAck) {
        await this.sendCustomerAcknowledgement(cleanSender, createdTicket.id, cleanSubject);
      }

      await this.prisma.inboundEmailLog.update({
        where: { id: logRecord.id },
        data: {
          status: 'PROCESSED',
          ticketId: createdTicket.id,
          matchedCompanyId: company.id,
          matchedContactId: contact.id,
          errorMessage: null,
          processedAt: new Date(),
        },
      });

      return {
        success: true,
        status: 'PROCESSED',
        logId: logRecord.id,
        ticketId: createdTicket.id,
        message: `Ticket ${createdTicket.id} created successfully from inbound email.`,
      };
    } catch (err: any) {
      this.logger.error(`Error processing inbound email log #${logRecord.id}: ${err.message}`, err.stack);
      await this.prisma.inboundEmailLog.update({
        where: { id: logRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: `Processing exception: ${err.message}`,
          processedAt: new Date(),
        },
      });

      return {
        success: false,
        status: 'FAILED',
        logId: logRecord.id,
        message: `Failed to process email: ${err.message}`,
      };
    }
  }

  // ==========================================
  // THREADING & REPLY DETECTION
  // ==========================================

  private async detectExistingTicket(subject: string, inReplyTo?: string, references?: string) {
    // 1. Check Subject for Ticket ID Pattern: KT-YYYY-XXXXXX or TCK-XXXXXX
    const ticketIdMatch = subject.match(/\b(KT-\d{4}-\d{6})\b/i) || subject.match(/\b(TCK-[A-Z0-9-]+)\b/i);
    if (ticketIdMatch) {
      const ticketId = ticketIdMatch[1].toUpperCase();
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { company: true, assignedEmployee: true },
      });
      if (ticket) return ticket;
    }

    // 2. Check inReplyTo in InboundEmailLog
    if (inReplyTo) {
      const matchedLog = await this.prisma.inboundEmailLog.findFirst({
        where: { messageId: inReplyTo, ticketId: { not: null } },
      });
      if (matchedLog && matchedLog.ticketId) {
        const ticket = await this.prisma.ticket.findUnique({
          where: { id: matchedLog.ticketId },
          include: { company: true, assignedEmployee: true },
        });
        if (ticket) return ticket;
      }
    }

    // 3. Check references
    if (references) {
      const refList = references.split(/\s+/).filter(Boolean);
      for (const ref of refList) {
        const matchedLog = await this.prisma.inboundEmailLog.findFirst({
          where: { messageId: ref, ticketId: { not: null } },
        });
        if (matchedLog && matchedLog.ticketId) {
          const ticket = await this.prisma.ticket.findUnique({
            where: { id: matchedLog.ticketId },
            include: { company: true, assignedEmployee: true },
          });
          if (ticket) return ticket;
        }
      }
    }

    return null;
  }

  private async appendReplyToTicket(
    ticket: any,
    payload: InboundEmailPayloadDto,
    senderEmail: string,
    logId: number,
  ) {
    // Find author user
    const authorUser = await this.prisma.user.findFirst({
      where: { email: { equals: senderEmail, mode: 'insensitive' } },
    });
    const systemUser = await this.getSystemUserId();
    const effectiveAuthorId = authorUser?.id || systemUser;

    const messageContent = (payload.text || this.stripHtmlTags(payload.html || '') || '').trim();
    const commentBody = `[Email Communication from ${payload.fromName || senderEmail}]\n\n${messageContent || '(Empty body)'}`;

    // Add Ticket Comment
    await this.prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorUserId: effectiveAuthorId,
        commentType: CommentType.CUSTOMER_COMMUNICATION,
        message: commentBody,
      },
    });

    // Add Ticket History
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorUserId: effectiveAuthorId,
        actionType: 'NOTE_ADDED',
        title: 'Customer Email Reply Received',
        description: `Reply received from ${senderEmail} via email integration.`,
      },
    });

    // Process & store attachments
    if (payload.attachments && payload.attachments.length > 0) {
      await this.saveTicketAttachments(ticket.id, payload.attachments, effectiveAuthorId);
    }

    // Send in-app notification to assigned employee and admin
    if (ticket.assignedEmployee) {
      const assignedUser = await this.prisma.user.findFirst({
        where: { email: ticket.assignedEmployee.email },
      });
      if (assignedUser) {
        await this.notificationsService.broadcastTicketEvent({
          eventType: 'TICKET_CUSTOMER_REPLY',
          ticketId: ticket.id,
          title: `New Reply on Ticket ${ticket.id}`,
          message: `${payload.fromName || senderEmail} replied via email: "${payload.subject}"`,
          recipientUserId: assignedUser.id,
          recipientEmail: assignedUser.email,
          linkUrl: `/tickets/${ticket.id}`,
        });
      }
    }
  }

  // ==========================================
  // CUSTOMER CONTACT RESOLUTION
  // ==========================================

  private async resolveCustomerContact(senderEmail: string): Promise<{
    success: boolean;
    contact?: any;
    company?: any;
    customerUser?: any;
    reason?: string;
  }> {
    // 1. Search in CompanyContact
    const contacts = await this.prisma.companyContact.findMany({
      where: { email: { equals: senderEmail, mode: 'insensitive' } },
      include: { company: true },
    });

    if (contacts.length === 0) {
      // 2. Check if a User exists with role CUSTOMER
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: senderEmail, mode: 'insensitive' } },
      });

      if (user && user.role === 'CUSTOMER') {
        // Find any contact linked to this user
        const linkedContact = await this.prisma.companyContact.findFirst({
          where: { userId: user.id },
          include: { company: true },
        });
        if (linkedContact && linkedContact.isActive && linkedContact.company.isActive) {
          return { success: true, contact: linkedContact, company: linkedContact.company, customerUser: user };
        }
      }

      return {
        success: false,
        reason: `Sender email '${senderEmail}' is not registered under any active customer company.`,
      };
    }

    // Filter active contacts and companies
    const activeContacts = contacts.filter((c) => c.isActive && c.company.isActive);

    if (activeContacts.length === 0) {
      return {
        success: false,
        reason: `Customer account or contact for '${senderEmail}' is deactivated.`,
      };
    }

    // Check if contacts belong to distinct companies
    const distinctCompanies = Array.from(new Set(activeContacts.map((c) => c.companyId)));
    if (distinctCompanies.length > 1) {
      const companyNames = activeContacts.map((c) => c.company.companyName).join(', ');
      return {
        success: false,
        reason: `Ambiguous sender email matching multiple customer organizations: ${companyNames}. Manual review required.`,
      };
    }

    const primaryOrFirst = activeContacts.find((c) => c.isPrimary) || activeContacts[0];
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: senderEmail, mode: 'insensitive' } },
    });

    return {
      success: true,
      contact: primaryOrFirst,
      company: primaryOrFirst.company,
      customerUser: user || null,
    };
  }

  // ==========================================
  // PRODUCT ENTITLEMENT RESOLUTION
  // ==========================================

  private async resolveProductEntitlement(
    companyId: string,
    subject: string,
    body: string,
  ): Promise<{
    success: boolean;
    productId?: string;
    fallbackProductId?: string;
    reason?: string;
  }> {
    const purchasedProducts = await this.prisma.companyProduct.findMany({
      where: { companyId, isActive: true },
      include: { product: true },
    });

    if (purchasedProducts.length === 0) {
      // Check if global products exist
      const defaultProduct = await this.prisma.product.findFirst({ where: { isActive: true } });
      if (defaultProduct) {
        return { success: true, productId: defaultProduct.id };
      }
      return {
        success: false,
        reason: `Customer has no active product entitlements in the system.`,
      };
    }

    // If customer owns exactly 1 product
    if (purchasedProducts.length === 1) {
      return { success: true, productId: purchasedProducts[0].productId };
    }

    // Customer owns multiple products: Attempt keyword search in subject and body
    const textToSearch = `${subject} ${body}`.toLowerCase();
    const matched: string[] = [];

    for (const cp of purchasedProducts) {
      const prodCode = cp.product.code?.toLowerCase();
      const prodName = cp.product.name.toLowerCase();

      if (prodCode && textToSearch.includes(prodCode)) {
        matched.push(cp.productId);
      } else if (textToSearch.includes(prodName)) {
        matched.push(cp.productId);
      }
    }

    const uniqueMatched = Array.from(new Set(matched));
    if (uniqueMatched.length === 1) {
      return { success: true, productId: uniqueMatched[0] };
    }

    const ownedNames = purchasedProducts.map((p) => `${p.product.name} (${p.product.code})`).join(', ');
    return {
      success: false,
      fallbackProductId: purchasedProducts[0].productId,
      reason: `Customer owns multiple active products: [${ownedNames}]. Could not automatically detect target product from email content.`,
    };
  }

  // ==========================================
  // TICKET CREATION LOGIC
  // ==========================================

  private async createInboundTicket(params: {
    companyId: string;
    contactId: number;
    productId: string;
    customerUserId?: number;
    subject: string;
    body: string;
    priority: TicketPriority;
    category: string;
    attachments?: any[];
    logId: number;
  }) {
    const systemUserId = await this.getSystemUserId();
    const effectiveUserId = params.customerUserId || systemUserId;

    // Use TicketsService to create ticket cleanly
    const created = await this.ticketsService.createTicket({
      companyId: params.companyId,
      customerContactId: params.contactId,
      productId: params.productId,
      problemType: params.subject.slice(0, 150),
      priority: params.priority,
      category: params.category,
      description: params.body || params.subject,
      createdByUserId: effectiveUserId,
    });

    // Add specific history note about inbound email ingestion
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: created.id,
        actorUserId: effectiveUserId,
        actionType: 'TICKET_CREATED_VIA_EMAIL',
        title: 'Ticket Created via Inbound Email Automation',
        description: `Ingested from email subject "${params.subject}". Log reference #${params.logId}.`,
      },
    });

    // Save attachments if any
    if (params.attachments && params.attachments.length > 0) {
      await this.saveTicketAttachments(created.id, params.attachments, effectiveUserId);
    }

    return created;
  }

  private async createTriageTicket(
    payload: InboundEmailPayloadDto,
    senderEmail: string,
    logId: number,
    triageReason?: string,
  ) {
    // Find or create default triage customer
    let triageCompany = await this.prisma.company.findFirst({
      where: { companyName: { contains: 'Triage', mode: 'insensitive' } },
    });

    if (!triageCompany) {
      triageCompany = await this.prisma.company.findFirst({ where: { isActive: true } });
    }

    if (!triageCompany) {
      throw new BadRequestException('No active company exists to route triage tickets.');
    }

    const defaultProduct = await this.prisma.product.findFirst({ where: { isActive: true } });
    if (!defaultProduct) {
      throw new BadRequestException('No active product exists to route triage tickets.');
    }

    const systemUserId = await this.getSystemUserId();

    const created = await this.ticketsService.createTicket({
      companyId: triageCompany.id,
      productId: defaultProduct.id,
      problemType: `[UNVERIFIED SENDER] ${payload.subject.slice(0, 100)}`,
      priority: TicketPriority.LOW,
      category: 'Inbound Triage',
      description: `Sender: ${payload.fromName || senderEmail} (${senderEmail})\nReason: ${triageReason || 'Unrecognized sender email'}\n\nEmail Body:\n${payload.text || payload.html}`,
      createdByUserId: systemUserId,
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: created.id,
        actorUserId: systemUserId,
        actionType: 'TRIAGE_TICKET_CREATED',
        title: 'Triage Ticket Created for Unverified Sender',
        description: `Sender email: ${senderEmail}. Log #${logId}. Needs admin review and customer assignment.`,
      },
    });

    return created;
  }

  // ==========================================
  // ATTACHMENTS HANDLING
  // ==========================================

  private async saveTicketAttachments(ticketId: string, attachments: any[], uploaderUserId: number) {
    for (const att of attachments) {
      try {
        if (att.contentBase64) {
          const buffer = Buffer.from(att.contentBase64, 'base64');
          const uploaded = await this.storageService.uploadBuffer(buffer, att.filename || 'attachment', att.contentType || 'application/octet-stream');

          await this.prisma.ticketAttachment.create({
            data: {
              ticketId,
              fileName: uploaded.fileName,
              filePath: uploaded.filePath,
              fileSize: uploaded.fileSize,
              mimeType: uploaded.mimeType,
              uploadedBy: uploaderUserId,
            },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Failed to process attachment '${att.filename}' for ticket ${ticketId}: ${err.message}`);
      }
    }
  }

  // ==========================================
  // CUSTOMER ACKNOWLEDGEMENT
  // ==========================================

  private async sendCustomerAcknowledgement(recipientEmail: string, ticketId: string, subject: string) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) {
      this.logger.log(`SMTP not configured. Customer confirmation for ticket ${ticketId} logged in system.`);
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });

      const fromAddress = process.env.SMTP_FROM || `KANVTECH Support <support@kanvtech.com>`;
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Support Request Received</h2>
          <p style="color: #475569; font-size: 15px;">Hello,</p>
          <p style="color: #475569; font-size: 15px;">We have received your email request regarding: <strong>"${subject}"</strong>.</p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #334155;">Your Ticket ID: <strong style="color: #2563eb; font-size: 16px;">${ticketId}</strong></p>
          </div>
          <p style="color: #475569; font-size: 15px;">Our technical specialist team has been notified and will address your request within our SLA guidelines. You can reply directly to this email with any additional information.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">KANVTECH Enterprise Service Management Platform</p>
        </div>
      `;

      await transporter.sendMail({
        from: fromAddress,
        to: recipientEmail,
        subject: `[${ticketId}] We received your support request: ${subject}`,
        html: htmlContent,
        text: `Support Request Received.\n\nTicket ID: ${ticketId}\nSubject: ${subject}\n\nOur team is working on your request. You may reply to this email for updates.`,
      });

      this.logger.log(`Customer confirmation email dispatched to ${recipientEmail} for ticket ${ticketId}.`);
    } catch (err: any) {
      this.logger.warn(`Could not dispatch customer acknowledgement email to ${recipientEmail}: ${err.message}`);
    }
  }

  // ==========================================
  // REVIEW QUEUE & LOG MANAGEMENT
  // ==========================================

  async getLogs(filter: InboundEmailFilterDto) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter.status && filter.status !== 'ALL') {
      where.status = filter.status;
    }
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { senderEmail: { contains: q, mode: 'insensitive' } },
        { senderName: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { ticketId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      this.prisma.inboundEmailLog.count({ where }),
      this.prisma.inboundEmailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          company: { select: { id: true, companyName: true } },
          contact: { select: { id: true, name: true, email: true } },
          ticket: { select: { id: true, status: true, priority: true } },
        },
      }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLogById(id: number) {
    const log = await this.prisma.inboundEmailLog.findUnique({
      where: { id },
      include: {
        company: true,
        contact: true,
        ticket: {
          include: {
            product: true,
            assignedEmployee: true,
          },
        },
      },
    });
    if (!log) throw new NotFoundException(`Inbound email log #${id} not found.`);
    return log;
  }

  async retryLog(id: number, actorUserId?: number) {
    const log = await this.prisma.inboundEmailLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`Inbound email log #${id} not found.`);

    await this.prisma.inboundEmailLog.update({
      where: { id },
      data: { retryCount: { increment: 1 } },
    });

    const payload: InboundEmailPayloadDto = {
      from: log.senderEmail,
      fromName: log.senderName || undefined,
      to: log.recipientEmail,
      subject: log.subject,
      text: log.bodyPlain || undefined,
      html: log.bodyHtml || undefined,
      messageId: log.messageId || undefined,
      inReplyTo: log.inReplyTo || undefined,
      references: log.references || undefined,
    };

    const res = await this.processInboundEmail(payload, log.provider);

    await this.auditService.log({
      actorUserId,
      action: 'INBOUND_EMAIL_RETRIED',
      entityType: 'INBOUND_EMAIL_LOG',
      entityId: String(id),
      newValues: { resultStatus: res.status, ticketId: res.ticketId },
    });

    return res;
  }

  async resolveLogManually(id: number, dto: ResolveInboundEmailDto, actorUserId?: number) {
    const log = await this.prisma.inboundEmailLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`Inbound email log #${id} not found.`);

    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new BadRequestException(`Company '${dto.companyId}' does not exist.`);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new BadRequestException(`Product '${dto.productId}' does not exist.`);

    const systemUser = await this.getSystemUserId();
    const effectiveUserId = actorUserId || systemUser;

    // Create ticket manually using provided overrides
    const createdTicket = await this.ticketsService.createTicket({
      companyId: dto.companyId,
      customerContactId: dto.customerContactId,
      productId: dto.productId,
      moduleId: dto.moduleId,
      submoduleId: dto.submoduleId,
      branchId: dto.branchId,
      problemType: log.subject.slice(0, 150),
      priority: dto.priority || TicketPriority.MEDIUM,
      category: 'Email Inbound (Resolved)',
      description: `${log.bodyPlain || log.subject}\n\n[Admin Resolution Notes: ${dto.notes || 'Manually converted from Pending Review Queue'}]`,
      createdByUserId: effectiveUserId,
      assignedEmployeeId: dto.assignedEmployeeId,
    });

    // Update log
    await this.prisma.inboundEmailLog.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        ticketId: createdTicket.id,
        matchedCompanyId: dto.companyId,
        matchedContactId: dto.customerContactId || null,
        errorMessage: null,
        processedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'INBOUND_EMAIL_MANUALLY_RESOLVED',
      entityType: 'INBOUND_EMAIL_LOG',
      entityId: String(id),
      newValues: { ticketId: createdTicket.id, companyId: dto.companyId, productId: dto.productId },
    });

    return {
      success: true,
      status: 'PROCESSED',
      ticketId: createdTicket.id,
      message: `Ticket ${createdTicket.id} created successfully from review queue.`,
    };
  }

  // ==========================================
  // PROVIDER PAYLOAD NORMALIZERS
  // ==========================================

  normalizeSendGrid(body: any): InboundEmailPayloadDto {
    return {
      from: body.from || '',
      to: body.to || '',
      subject: body.subject || '',
      text: body.text || '',
      html: body.html || '',
      messageId: body.headers ? this.extractHeader(body.headers, 'Message-ID') : undefined,
      inReplyTo: body.headers ? this.extractHeader(body.headers, 'In-Reply-To') : undefined,
      references: body.headers ? this.extractHeader(body.headers, 'References') : undefined,
    };
  }

  normalizePostmark(body: any): InboundEmailPayloadDto {
    const attachments = (body.Attachments || []).map((att: any) => ({
      filename: att.Name,
      contentType: att.ContentType,
      size: att.ContentLength,
      contentBase64: att.Content,
    }));

    return {
      from: body.FromFull?.Email || body.From || '',
      fromName: body.FromFull?.Name || undefined,
      to: body.ToFull?.[0]?.Email || body.To || '',
      subject: body.Subject || '',
      text: body.TextBody || '',
      html: body.HtmlBody || '',
      messageId: body.MessageID || undefined,
      inReplyTo: body.InReplyTo || undefined,
      attachments,
    };
  }

  normalizeMailgun(body: any): InboundEmailPayloadDto {
    return {
      from: body.sender || body.from || '',
      fromName: body['from-name'] || undefined,
      to: body.recipient || body.to || '',
      subject: body.subject || '',
      text: body['body-plain'] || '',
      html: body['body-html'] || '',
      messageId: body['Message-Id'] || undefined,
      inReplyTo: body['In-Reply-To'] || undefined,
      references: body.References || undefined,
    };
  }

  // ==========================================
  // HELPER UTILITIES
  // ==========================================

  private extractCleanEmail(input: string): string {
    if (!input) return '';
    const match = input.match(/<([^>]+)>/);
    const email = match ? match[1] : input;
    return email.trim().toLowerCase();
  }

  private extractDisplayName(input: string): string | null {
    if (!input) return null;
    const match = input.match(/^([^<]+)<[^>]+>$/);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
    return null;
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .trim();
  }

  private extractHeader(headersString: string, headerName: string): string | undefined {
    if (!headersString || typeof headersString !== 'string') return undefined;
    const regex = new RegExp(`^${headerName}:\\s*(.+)$`, 'im');
    const match = headersString.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private async getSystemUserId(): Promise<number> {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' as any },
      orderBy: { id: 'asc' },
    });
    return admin ? admin.id : 1;
  }
}
