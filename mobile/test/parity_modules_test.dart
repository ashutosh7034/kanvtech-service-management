import 'package:flutter_test/flutter_test.dart';
import 'package:kanvtech_mobile/models/master_models.dart';
import 'package:kanvtech_mobile/models/ticket_model.dart';

void main() {
  group('Feature Parity Models Verification', () {
    test('DepartmentModel parses correctly', () {
      final dept = DepartmentModel.fromJson({
        'id': 'dept-core-01',
        'name': 'Core Engineering',
        'code': 'CORE',
        'description': 'Backend systems and database engine',
        'employeeCount': 8,
        'manager': {'name': 'Dev Lead'},
        'specializations': ['Database Architecture', 'Security Protocols'],
      });

      expect(dept.id, 'dept-core-01');
      expect(dept.name, 'Core Engineering');
      expect(dept.code, 'CORE');
      expect(dept.employeeCount, 8);
      expect(dept.managerName, 'Dev Lead');
      expect(dept.specializations.length, 2);
    });

    test('EmployeeDetailModel parses specialist level and availability', () {
      final emp = EmployeeDetailModel.fromJson({
        'id': 'EMP-L2-005',
        'userId': 42,
        'name': 'Rajesh Sharma',
        'email': 'rajesh.l2@kanvtech.com',
        'role': 'L2_EMPLOYEE',
        'level': 'L2',
        'departmentName': 'Core Systems',
        'availability': 'AVAILABLE',
        'openTicketsCount': 3,
      });

      expect(emp.id, 'EMP-L2-005');
      expect(emp.userId, 42);
      expect(emp.level, 'L2');
      expect(emp.departmentName, 'Core Systems');
      expect(emp.assignedTicketsCount, 3);
    });

    test('ProspectModel parses inquiries and sales pipeline', () {
      final prospect = ProspectModel.fromJson({
        'id': 'PROSP-001',
        'company_name': 'Horizon Corp',
        'contact_person': 'Anita Roy',
        'phone': '+91 9123456789',
        'email': 'anita@horizon.com',
        'enquiry': 'Request for Enterprise SLA package',
        'status': 'QUALIFIED',
      });

      expect(prospect.id, 'PROSP-001');
      expect(prospect.companyName, 'Horizon Corp');
      expect(prospect.status, 'QUALIFIED');
      expect(prospect.enquiry, 'Request for Enterprise SLA package');
    });

    test('ImplementationModel parses stages and tasks', () {
      final impl = ImplementationModel.fromJson({
        'id': 'IMPL-001',
        'company': {'companyName': 'Apex Financial'},
        'product': {'name': 'Kanvtech Core ERP'},
        'stage': 'DEVELOPMENT',
        'status': 'IN_PROGRESS',
        'progressPercent': 65,
        'tasks': [
          {'id': 'T1', 'title': 'Database Schema Setup', 'stage': 'PLANNING', 'isCompleted': true},
          {'id': 'T2', 'title': 'SSO Integration', 'stage': 'DEVELOPMENT', 'isCompleted': false},
        ],
      });

      expect(impl.id, 'IMPL-001');
      expect(impl.companyName, 'Apex Financial');
      expect(impl.stage, 'DEVELOPMENT');
      expect(impl.progressPercent, 65);
      expect(impl.tasks.length, 2);
      expect(impl.tasks.first.isCompleted, isTrue);
      expect(impl.tasks.last.isCompleted, isFalse);
    });

    test('SubscriptionModel parses AMC validity and days remaining', () {
      final now = DateTime.now();
      final expiry = now.add(const Duration(days: 45));

      final sub = SubscriptionModel.fromJson({
        'id': 'SUB-001',
        'companyName': 'Zenith Logistics',
        'productName': 'Cloud Surveillance Suite',
        'planType': 'ENTERPRISE_AMC',
        'startDate': now.subtract(const Duration(days: 320)).toIso8601String(),
        'endDate': expiry.toIso8601String(),
        'status': 'ACTIVE',
        'annualValue': 150000.0,
      });

      expect(sub.id, 'SUB-001');
      expect(sub.companyName, 'Zenith Logistics');
      expect(sub.planType, 'ENTERPRISE_AMC');
      expect(sub.annualValue, 150000.0);
      expect(sub.endDate.isAfter(DateTime.now()), isTrue);
    });

    test('AuditLogModel parses security events', () {
      final log = AuditLogModel.fromJson({
        'id': 991,
        'created_at': DateTime.now().toIso8601String(),
        'actor_email': 'admin@kanvtech.com',
        'actor_role': 'ADMIN',
        'action': 'USER_ROLE_PROMOTED',
        'entity_type': 'EMPLOYEE',
        'entity_id': 'EMP-L1-002',
        'ip_address': '192.168.1.10',
      });

      expect(log.id, 991);
      expect(log.actorEmail, 'admin@kanvtech.com');
      expect(log.action, 'USER_ROLE_PROMOTED');
      expect(log.entityType, 'EMPLOYEE');
    });

    test('SlaConfigModel parses response and resolution limits', () {
      final sla = SlaConfigModel.fromJson({
        'priority': 'CRITICAL',
        'response_time_hours': 2,
        'resolution_time_hours': 8,
        'warning_threshold_percent': 75,
      });

      expect(sla.priority, 'CRITICAL');
      expect(sla.responseTimeHours, 2);
      expect(sla.resolutionTimeHours, 8);
      expect(sla.warningThresholdPercent, 75);
    });

    test('TicketModel convenience getters match web parity fields', () {
      final ticket = TicketModel.fromJson({
        'id': 'KT-2026-9999',
        'company_id': 'CMP-001',
        'problem_type': 'Core Server Gateway Latency',
        'priority': 'CRITICAL',
        'status': 'IN_PROGRESS',
        'assigned_level': 'L3',
        'sla_status': 'BREACHED',
        'total_resolution_seconds': 5400,
      });

      expect(ticket.ticketNumber, 'KT-2026-9999');
      expect(ticket.level, 'L3');
      expect(ticket.slaBreached, isTrue);
      expect(ticket.isInProgress, isTrue);
    });
  });
}
