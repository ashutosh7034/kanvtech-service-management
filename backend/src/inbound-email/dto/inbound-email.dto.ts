import { IsString, IsOptional, IsNotEmpty, IsEnum, IsBoolean, IsNumber, IsArray, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketPriority } from '@prisma/client';

export class InboundEmailAttachmentDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsString()
  contentBase64?: string;

  @IsOptional()
  @IsString()
  url?: string;
}

export class InboundEmailPayloadDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  inReplyTo?: string;

  @IsOptional()
  @IsString()
  references?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InboundEmailAttachmentDto)
  attachments?: InboundEmailAttachmentDto[];

  @IsOptional()
  headers?: Record<string, any>;
}

export class UpdateInboundEmailSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  supportAddress?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsString()
  unknownSenderAction?: 'PENDING_REVIEW' | 'CREATE_TRIAGE_TICKET' | 'REJECT';

  @IsOptional()
  @IsString()
  unmatchedProductAction?: 'PENDING_REVIEW' | 'AUTO_ASSIGN_FIRST' | 'CREATE_TRIAGE_TICKET';

  @IsOptional()
  @IsEnum(TicketPriority)
  defaultPriority?: TicketPriority;

  @IsOptional()
  @IsString()
  defaultCategory?: string;

  @IsOptional()
  @IsNumber()
  maxAttachmentSizeMb?: number;

  @IsOptional()
  @IsBoolean()
  sendCustomerAck?: boolean;
}

export class ResolveInboundEmailDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsOptional()
  @IsNumber()
  customerContactId?: number;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  moduleId?: string;

  @IsOptional()
  @IsString()
  submoduleId?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  assignedEmployeeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class InboundEmailFilterDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
