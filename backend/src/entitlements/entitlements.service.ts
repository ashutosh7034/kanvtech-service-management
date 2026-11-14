import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface UserLicenceInfo {
  purchased: number;
  used: number;
  available: number;
  usagePercentage: number;
}

export interface CompanyLicenceInfo {
  purchased: number;
  used: number;
  available: number;
  usagePercentage: number;
}

export interface EntitlementSummary {
  id: string;
  customerId: string;
  customerName: string;
  tenantId: string;
  userLicences: UserLicenceInfo;
  companyLicences: CompanyLicenceInfo;
  user_licences_purchased?: number;
  active_licensed_users?: number;
  available_user_licences?: number;
  company_licences_purchased?: number;
  registered_companies?: number;
  available_company_licences?: number;
  subscription: {
    startDate: string;
    expiryDate: string;
    status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'PENDING_RENEWAL';
    renewalStatus: string;
    daysRemaining: number;
    isExpired: boolean;
  };
  purchaseReference?: string;
  notes?: string;
  lastModified: string;
  warnings: string[];
}

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get or create commercial entitlement for a customer
   */
  async getCustomerEntitlement(customerId: string, tenantId?: string): Promise<EntitlementSummary> {
    const tId = tenantId || 'KANVTECH';

    // Verify company exists
    const company = await this.prisma.company.findFirst({
      where: { id: customerId, tenantId: tId },
      select: { id: true, companyName: true, tenantId: true, isActive: true },
    });

    if (!company) {
      throw new NotFoundException(`Customer '${customerId}' not found in workspace.`);
    }

    // Query customer_entitlements
    let rows: any[] = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM customer_entitlements WHERE customer_id = $1 AND tenant_id = $2 LIMIT 1',
      customerId,
      tId,
    );

    let ent: any;
    if (rows.length === 0) {
      // Auto-provision default commercial entitlement
      const entId = `ENT-${customerId}`;
      const now = new Date();
      const expiry = new Date();
      expiry.setFullYear(now.getFullYear() + 1);

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO customer_entitlements (
          id, customer_id, tenant_id, user_licences_purchased, company_licences_purchased,
          start_date, expiry_date, status, renewal_status, purchase_reference, notes,
          created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now()
        )`,
        entId,
        customerId,
        tId,
        50,
        150,
        now,
        expiry,
        'ACTIVE',
        'CURRENT',
        `PO-${customerId}`,
        `Default entitlement for ${company.companyName}`,
        'SYSTEM',
      );

      rows = await this.prisma.$queryRawUnsafe(
        'SELECT * FROM customer_entitlements WHERE id = $1 LIMIT 1',
        entId,
      );
    }
    ent = rows[0];

    // Compute actual authoritative usage
    // Active licensed users in tenant (excluding PLATFORM_INCHARGE and EMP-PLT-001)
    const [empCountRow]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int as count FROM employees e
       JOIN users u ON e.user_id = u.id
       WHERE e.tenant_id = $1 AND e.status = 'ACTIVE'
       AND u.role != 'PLATFORM_INCHARGE' AND e.id != 'EMP-PLT-001'`,
      tId,
    );
    const activeEmployees = empCountRow?.count || 0;

    // Registered active companies in tenant
    const [compCountRow]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int as count FROM companies WHERE tenant_id = $1 AND is_active = true`,
      tId,
    );
    const registeredCompanies = compCountRow?.count || 0;

    const userPurchased = Number(ent.user_licences_purchased);
    const userUsed = Number(activeEmployees);
    const userAvailable = Math.max(0, userPurchased - userUsed);
    const userUsagePct = userPurchased > 0 ? Math.round((userUsed / userPurchased) * 100) : 0;

    const compPurchased = Number(ent.company_licences_purchased);
    const compUsed = Number(registeredCompanies);
    const compAvailable = Math.max(0, compPurchased - compUsed);
    const compUsagePct = compPurchased > 0 ? Math.round((compUsed / compPurchased) * 100) : 0;

    const nowTime = Date.now();
    const expiryTime = new Date(ent.expiry_date).getTime();
    const isExpired = nowTime > expiryTime;
    const daysRemaining = Math.ceil((expiryTime - nowTime) / (1000 * 60 * 60 * 24));

    let status = ent.status as any;
    if (isExpired) {
      status = 'EXPIRED';
    } else if (daysRemaining <= 30 && status === 'ACTIVE') {
      status = 'EXPIRING_SOON';
    }

    const warnings: string[] = [];
    if (isExpired) {
      warnings.push(`Subscription expired on ${new Date(ent.expiry_date).toLocaleDateString()}. Normal employee operational access is restricted.`);
    } else if (daysRemaining <= 30) {
      warnings.push(`Subscription expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Renewal required.`);
    }
    if (userAvailable === 0) {
      warnings.push(`User Licence capacity reached (${userUsed}/${userPurchased}). Cannot create additional active employees.`);
    }
    if (compAvailable === 0) {
      warnings.push(`Company Licence capacity reached (${compUsed}/${compPurchased}). Cannot register additional companies.`);
    }

    return {
      id: ent.id,
      customerId: company.id,
      customerName: company.companyName,
      tenantId: tId,
      userLicences: {
        purchased: userPurchased,
        used: userUsed,
        available: userAvailable,
        usagePercentage: userUsagePct,
      },
      companyLicences: {
        purchased: compPurchased,
        used: compUsed,
        available: compAvailable,
        usagePercentage: compUsagePct,
      },
      user_licences_purchased: userPurchased,
      active_licensed_users: userUsed,
      available_user_licences: userAvailable,
      company_licences_purchased: compPurchased,
      registered_companies: compUsed,
      available_company_licences: compAvailable,
      subscription: {
        startDate: ent.start_date.toISOString(),
        expiryDate: ent.expiry_date.toISOString(),
        status,
        renewalStatus: ent.renewal_status || 'CURRENT',
        daysRemaining: Math.max(0, daysRemaining),
        isExpired,
      },
      purchaseReference: ent.purchase_reference || undefined,
      notes: ent.notes || undefined,
      lastModified: ent.updated_at.toISOString(),
      warnings,
    };
  }

  /**
   * Get tenant-wide active commercial entitlement
   */
  async getTenantEntitlement(tenantId?: string): Promise<EntitlementSummary> {
    const tId = tenantId || 'KANVTECH';
    // Find primary or first customer in tenant
    const firstCompany = await this.prisma.company.findFirst({
      where: { tenantId: tId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!firstCompany) {
      throw new NotFoundException(`No registered customer organization found for tenant '${tId}'.`);
    }

    return this.getCustomerEntitlement(firstCompany.id, tId);
  }

  /**
   * Validate that tenant has available User Licence capacity and active subscription
   * Prevents employee creation when capacity is exceeded or subscription expired.
   */
  async validateEmployeeCreationCapacity(tenantId: string): Promise<void> {
    const ent = await this.getTenantEntitlement(tenantId);

    if (ent.subscription.isExpired) {
      throw new ForbiddenException(
        `Subscription for tenant '${tenantId}' has expired on ${new Date(ent.subscription.expiryDate).toLocaleDateString()}. Employee creation is blocked. Please renew subscription.`,
      );
    }

    if (ent.userLicences.available <= 0) {
      throw new BadRequestException(
        `No available User Licence. Your customer subscription includes ${ent.userLicences.purchased} licences, of which ${ent.userLicences.used} are currently in use. Please purchase additional licences or deactivate an existing employee.`,
      );
    }
  }

  /**
   * Validate that tenant has available Company Licence capacity and active subscription
   * Prevents company creation when capacity is exceeded or subscription expired.
   */
  async validateCompanyCreationCapacity(tenantId: string): Promise<void> {
    const ent = await this.getTenantEntitlement(tenantId);

    if (ent.subscription.isExpired) {
      throw new ForbiddenException(
        `Subscription for tenant '${tenantId}' has expired on ${new Date(ent.subscription.expiryDate).toLocaleDateString()}. Company registration is blocked. Please renew subscription.`,
      );
    }

    if (ent.companyLicences.available <= 0) {
      throw new BadRequestException(
        `No available Company Licence. Your subscription includes ${ent.companyLicences.purchased} company licences, of which ${ent.companyLicences.used} are currently registered. Please purchase additional company licences.`,
      );
    }
  }

  /**
   * Increase User Licences before expiry.
   * Business Rule 7: Before expiry, quantity can increase, CANNOT decrease.
   */
  async increaseUserLicences(
    customerId: string,
    newQuantity: number,
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
    reason?: string,
  ): Promise<EntitlementSummary> {
    const tId = tenantId || 'KANVTECH';
    const current = await this.getCustomerEntitlement(customerId, tId);

    if (newQuantity < current.userLicences.purchased) {
      throw new BadRequestException('Licence quantity cannot be reduced before the current entitlement expires.');
    }

    if (newQuantity === current.userLicences.purchased) {
      return current;
    }

    const diff = newQuantity - current.userLicences.purchased;

    await this.prisma.$executeRawUnsafe(
      `UPDATE customer_entitlements
       SET user_licences_purchased = $1, updated_by = $2, updated_at = now()
       WHERE customer_id = $3 AND tenant_id = $4`,
      newQuantity,
      actor.name || 'System Admin',
      customerId,
      tId,
    );

    // Record append-only history
    const histId = `EHIS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO entitlement_history (
        id, tenant_id, customer_id, licence_category, action_type,
        previous_quantity, new_quantity, quantity_difference, effective_date,
        reason, performed_by, performed_by_role, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10, $11, now()
      )`,
      histId,
      tId,
      customerId,
      'USER_LICENCE',
      'ADDITIONAL_PURCHASE',
      current.userLicences.purchased,
      newQuantity,
      diff,
      reason || `User Licence capacity increased from ${current.userLicences.purchased} to ${newQuantity} (+${diff})`,
      actor.name || 'Super Admin',
      actor.role || 'SUPER_ADMIN',
    );

    if (actor.id) {
      await this.auditService.log({
        actorUserId: actor.id,
        action: 'USER_LICENCE_EXPANDED',
        entityType: 'CUSTOMER_ENTITLEMENT',
        entityId: customerId,
        oldValues: { userLicences: current.userLicences.purchased },
        newValues: { userLicences: newQuantity, added: diff },
      });
    }

    return this.getCustomerEntitlement(customerId, tId);
  }

  /**
   * Increase Company Licences before expiry.
   * Business Rule 7: Before expiry, quantity can increase, CANNOT decrease.
   */
  async increaseCompanyLicences(
    customerId: string,
    newQuantity: number,
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
    reason?: string,
  ): Promise<EntitlementSummary> {
    const tId = tenantId || 'KANVTECH';
    const current = await this.getCustomerEntitlement(customerId, tId);

    if (newQuantity < current.companyLicences.purchased) {
      throw new BadRequestException('Licence quantity cannot be reduced before the current entitlement expires.');
    }

    if (newQuantity === current.companyLicences.purchased) {
      return current;
    }

    const diff = newQuantity - current.companyLicences.purchased;

    await this.prisma.$executeRawUnsafe(
      `UPDATE customer_entitlements
       SET company_licences_purchased = $1, updated_by = $2, updated_at = now()
       WHERE customer_id = $3 AND tenant_id = $4`,
      newQuantity,
      actor.name || 'System Admin',
      customerId,
      tId,
    );

    // Record append-only history
    const histId = `EHIS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO entitlement_history (
        id, tenant_id, customer_id, licence_category, action_type,
        previous_quantity, new_quantity, quantity_difference, effective_date,
        reason, performed_by, performed_by_role, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, now(), $9, $10, $11, now()
      )`,
      histId,
      tId,
      customerId,
      'COMPANY_LICENCE',
      'ADDITIONAL_PURCHASE',
      current.companyLicences.purchased,
      newQuantity,
      diff,
      reason || `Company Licence capacity increased from ${current.companyLicences.purchased} to ${newQuantity} (+${diff})`,
      actor.name || 'Super Admin',
      actor.role || 'SUPER_ADMIN',
    );

    if (actor.id) {
      await this.auditService.log({
        actorUserId: actor.id,
        action: 'COMPANY_LICENCE_EXPANDED',
        entityType: 'CUSTOMER_ENTITLEMENT',
        entityId: customerId,
        oldValues: { companyLicences: current.companyLicences.purchased },
        newValues: { companyLicences: newQuantity, added: diff },
      });
    }

    return this.getCustomerEntitlement(customerId, tId);
  }

  /**
   * Log employee deactivation and release User Licence immediately.
   * Business Rule 5: Only Tenant Super Admin can deactivate employees and release their licence.
   */
  async logEmployeeDeactivation(
    employeeId: string,
    employeeName: string,
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
  ): Promise<void> {
    const tId = tenantId || 'KANVTECH';

    // Strictly enforce Tenant Super Admin authorization
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only the Tenant Super Admin can deactivate employees and release their User Licence.');
    }

    const histId = `EHIS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO entitlement_history (
        id, tenant_id, licence_category, action_type,
        quantity_difference, effective_date, reason, performed_by, performed_by_role, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, now(), $6, $7, $8, now()
      )`,
      histId,
      tId,
      'USER_LICENCE',
      'EMPLOYEE_DEACTIVATION',
      -1,
      `Employee ${employeeName} (${employeeId}) deactivated by Tenant Super Admin. One User Licence released for immediate reuse.`,
      actor.name || 'Tenant Super Admin',
      actor.role || 'SUPER_ADMIN',
    );

    this.logger.log(`User licence released for tenant '${tId}' following deactivation of employee ${employeeId}`);
  }

  /**
   * Log employee activation/reactivation
   */
  async logEmployeeActivation(
    employeeId: string,
    employeeName: string,
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
  ): Promise<void> {
    const tId = tenantId || 'KANVTECH';
    const histId = `EHIS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO entitlement_history (
        id, tenant_id, licence_category, action_type,
        quantity_difference, effective_date, reason, performed_by, performed_by_role, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, now(), $6, $7, $8, now()
      )`,
      histId,
      tId,
      'USER_LICENCE',
      'EMPLOYEE_ACTIVATION',
      1,
      `Employee ${employeeName} (${employeeId}) activated. Consuming 1 User Licence.`,
      actor.name || 'Tenant Super Admin',
      actor.role || 'SUPER_ADMIN',
    );
  }

  /**
   * Log company registration
   */
  async logCompanyRegistration(
    companyId: string,
    companyName: string,
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
  ): Promise<void> {
    const tId = tenantId || 'KANVTECH';
    const histId = `EHIS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO entitlement_history (
        id, tenant_id, customer_id, licence_category, action_type,
        quantity_difference, effective_date, reason, performed_by, performed_by_role, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, now(), $6, $7, $8, now()
      )`,
      histId,
      tId,
      companyId,
      'COMPANY_LICENCE',
      'COMPANY_REGISTRATION',
      1,
      `Customer Company ${companyName} (${companyId}) registered. Consuming 1 Company Licence.`,
      actor.name || 'Admin',
      actor.role || 'SUPER_ADMIN',
    );
  }

  /**
   * Initiate a subscription renewal request
   */
  async requestRenewal(
    data: {
      customerId: string;
      userLicences?: number;
      companyLicences?: number;
      renewalMonths?: number;
      pricing?: number;
      notes?: string;
      paymentReference?: string;
      invoiceReference?: string;
    },
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const current = await this.getCustomerEntitlement(data.customerId, tId);

    const renewalUserLicences = data.userLicences ?? current.userLicences.purchased;
    const renewalCompanyLicences = data.companyLicences ?? current.companyLicences.purchased;

    if (renewalUserLicences < current.userLicences.purchased && !current.subscription.isExpired) {
      throw new BadRequestException('Licence quantity cannot be reduced before the current entitlement expires.');
    }
    if (renewalCompanyLicences < current.companyLicences.purchased && !current.subscription.isExpired) {
      throw new BadRequestException('Licence quantity cannot be reduced before the current entitlement expires.');
    }

    const startDate = new Date();
    const expiryDate = new Date();
    const months = data.renewalMonths || 12;
    expiryDate.setMonth(expiryDate.getMonth() + months);

    const reqId = `REN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO renewal_requests (
        id, customer_id, tenant_id, current_user_licences, current_company_licences,
        renewal_user_licences, renewal_company_licences, renewal_start_date, renewal_expiry_date,
        pricing, payment_reference, invoice_reference, status, notes, requested_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', $13, $14, now(), now()
      )`,
      reqId,
      data.customerId,
      tId,
      current.userLicences.purchased,
      current.companyLicences.purchased,
      renewalUserLicences,
      renewalCompanyLicences,
      startDate,
      expiryDate,
      data.pricing || 0,
      data.paymentReference || null,
      data.invoiceReference || null,
      data.notes || 'Subscription renewal request',
      actor.name || 'Tenant Admin',
    );

    return { success: true, renewalRequestId: reqId, message: 'Renewal request created successfully.' };
  }

  /**
   * Approve and execute subscription renewal.
   * Restores employee access, applies new validity dates, and records append-only history.
   */
  async approveAndExecuteRenewal(
    renewalRequestId: string,
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const [req]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM renewal_requests WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      renewalRequestId,
      tId,
    );

    if (!req) {
      throw new NotFoundException(`Renewal request '${renewalRequestId}' not found.`);
    }

    const startDate = new Date(req.renewal_start_date);
    const expiryDate = new Date(req.renewal_expiry_date);

    // Update customer_entitlements
    await this.prisma.$executeRawUnsafe(
      `UPDATE customer_entitlements
       SET user_licences_purchased = $1,
           company_licences_purchased = $2,
           start_date = $3,
           expiry_date = $4,
           status = 'ACTIVE',
           renewal_status = 'RENEWED',
           updated_by = $5,
           updated_at = now()
       WHERE customer_id = $6 AND tenant_id = $7`,
      req.renewal_user_licences,
      req.renewal_company_licences,
      startDate,
      expiryDate,
      actor.name || 'Admin',
      req.customer_id,
      tId,
    );

    // Update renewal request
    await this.prisma.$executeRawUnsafe(
      `UPDATE renewal_requests
       SET status = 'COMPLETED', approved_by = $1, updated_at = now()
       WHERE id = $2`,
      actor.name || 'Admin',
      renewalRequestId,
    );

    // Record append-only history
    const histId = `EHIS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO entitlement_history (
        id, tenant_id, customer_id, licence_category, action_type,
        previous_quantity, new_quantity, quantity_difference,
        effective_date, expiry_date, previous_period, new_period,
        reason, performed_by, performed_by_role, created_at
      ) VALUES (
        $1, $2, $3, 'SUBSCRIPTION', 'SUBSCRIPTION_RENEWAL',
        $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()
      )`,
      histId,
      tId,
      req.customer_id,
      req.current_user_licences,
      req.renewal_user_licences,
      req.renewal_user_licences - req.current_user_licences,
      startDate,
      expiryDate,
      'Previous Period',
      `${startDate.toLocaleDateString()} - ${expiryDate.toLocaleDateString()}`,
      `Subscription renewed successfully until ${expiryDate.toLocaleDateString()}. Normal employee operational access restored.`,
      actor.name || 'Super Admin',
      actor.role || 'SUPER_ADMIN',
    );

    return this.getCustomerEntitlement(req.customer_id, tId);
  }

  /**
   * Direct subscription renewal without request step (for Platform / Tenant Super Admin)
   */
  async directRenewSubscription(
    customerId: string,
    data: {
      renewalMonths?: number;
      userLicences?: number;
      companyLicences?: number;
      paymentReference?: string;
      invoiceReference?: string;
      notes?: string;
    },
    actor: { id?: number; name?: string; role?: string },
    tenantId?: string,
  ): Promise<EntitlementSummary> {
    const tId = tenantId || 'KANVTECH';
    const current = await this.getCustomerEntitlement(customerId, tId);

    const newUserQty = data.userLicences !== undefined ? Number(data.userLicences) : current.userLicences.purchased;
    const newCompQty = data.companyLicences !== undefined ? Number(data.companyLicences) : current.companyLicences.purchased;

    if (newUserQty < current.userLicences.purchased && !current.subscription.isExpired) {
      throw new BadRequestException('Licence quantity cannot be reduced before the current entitlement expires.');
    }
    if (newCompQty < current.companyLicences.purchased && !current.subscription.isExpired) {
      throw new BadRequestException('Licence quantity cannot be reduced before the current entitlement expires.');
    }

    const startDate = new Date();
    const expiryDate = new Date();
    const months = data.renewalMonths || 12;
    expiryDate.setMonth(expiryDate.getMonth() + months);

    await this.prisma.$executeRawUnsafe(
      `UPDATE customer_entitlements
       SET user_licences_purchased = $1,
           company_licences_purchased = $2,
           start_date = $3,
           expiry_date = $4,
           status = 'ACTIVE',
           renewal_status = 'RENEWED',
           purchase_reference = COALESCE($5, purchase_reference),
           notes = COALESCE($6, notes),
           updated_by = $7,
           updated_at = now()
       WHERE customer_id = $8 AND tenant_id = $9`,
      newUserQty,
      newCompQty,
      startDate,
      expiryDate,
      data.paymentReference || null,
      data.notes || null,
      actor.name || 'Admin',
      customerId,
      tId,
    );

    // Record append-only history
    const histId = `EHIS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO entitlement_history (
        id, tenant_id, customer_id, licence_category, action_type,
        previous_quantity, new_quantity, quantity_difference,
        effective_date, expiry_date, previous_period, new_period,
        reason, performed_by, performed_by_role, created_at
      ) VALUES (
        $1, $2, $3, 'SUBSCRIPTION', 'SUBSCRIPTION_RENEWAL',
        $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()
      )`,
      histId,
      tId,
      customerId,
      current.userLicences.purchased,
      newUserQty,
      newUserQty - current.userLicences.purchased,
      startDate,
      expiryDate,
      `${new Date(current.subscription.startDate).toLocaleDateString()} - ${new Date(current.subscription.expiryDate).toLocaleDateString()}`,
      `${startDate.toLocaleDateString()} - ${expiryDate.toLocaleDateString()}`,
      data.notes || `Subscription renewed for ${months} months. Access restored.`,
      actor.name || 'Super Admin',
      actor.role || 'SUPER_ADMIN',
    );

    return this.getCustomerEntitlement(customerId, tId);
  }

  /**
   * Get append-only entitlement history with filters
   */
  async getEntitlementHistory(params: {
    customerId?: string;
    tenantId?: string;
    licenceCategory?: string;
    actionType?: string;
    limit?: number;
    offset?: number;
  }) {
    const tId = params.tenantId || 'KANVTECH';
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tId];
    let idx = 2;

    if (params.customerId) {
      conditions.push(`customer_id = $${idx++}`);
      values.push(params.customerId);
    }
    if (params.licenceCategory) {
      conditions.push(`licence_category = $${idx++}`);
      values.push(params.licenceCategory);
    }
    if (params.actionType) {
      conditions.push(`action_type = $${idx++}`);
      values.push(params.actionType);
    }

    const whereClause = conditions.join(' AND ');
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const offset = Math.max(0, params.offset || 0);

    const [countRow]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int as total FROM entitlement_history WHERE ${whereClause}`,
      ...values,
    );

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM entitlement_history WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      ...values,
      limit,
      offset,
    );

    return {
      total: countRow?.total || 0,
      history: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        customerId: r.customer_id,
        licenceCategory: r.licence_category,
        actionType: r.action_type,
        previousQuantity: r.previous_quantity,
        newQuantity: r.new_quantity,
        quantityDifference: r.quantity_difference,
        effectiveDate: r.effective_date,
        expiryDate: r.expiry_date,
        previousPeriod: r.previous_period,
        newPeriod: r.new_period,
        reason: r.reason,
        purchaseReference: r.purchase_reference,
        performedBy: r.performed_by,
        performedByRole: r.performed_by_role,
        createdAt: r.created_at,
      })),
    };
  }
}
