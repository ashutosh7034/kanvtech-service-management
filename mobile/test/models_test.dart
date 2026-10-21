import 'package:flutter_test/flutter_test.dart';
import 'package:kanvtech_mobile/models/user_model.dart';
import 'package:kanvtech_mobile/models/ticket_model.dart';
import 'package:kanvtech_mobile/models/master_models.dart';

void main() {
  group('UserModel Role & Predicate Tests', () {
    test('Customer role parsed correctly', () {
      final user = UserModel.fromJson({
        'id': 101,
        'email': 'customer@acme.com',
        'role': 'CUSTOMER',
        'companyId': 'CMP-0001',
      });
      expect(user.id, 101);
      expect(user.isCustomer, isTrue);
      expect(user.isStaff, isFalse);
      expect(user.isTechnician, isFalse);
      expect(user.isAdmin, isFalse);
      expect(user.isManager, isFalse);
    });

    test('L1 Technician role parsed correctly', () {
      final user = UserModel.fromJson({
        'id': 102,
        'email': 'amit.l1@kanvtech.com',
        'role': 'L1_EMPLOYEE',
        'employeeId': 'EMP-001',
      });
      expect(user.isCustomer, isFalse);
      expect(user.isStaff, isTrue);
      expect(user.isTechnician, isTrue);
      expect(user.isL1, isTrue);
      expect(user.isL2, isFalse);
      expect(user.canAllotTickets, isFalse);
    });

    test('Manager role parsed correctly', () {
      final user = UserModel.fromJson({
        'id': 103,
        'email': 'manager@kanvtech.com',
        'role': 'MANAGER',
        'employeeId': 'EMP-MGR',
      });
      expect(user.isManager, isTrue);
      expect(user.isManagerOrAdmin, isTrue);
      expect(user.canAllotTickets, isTrue);
      expect(user.canApproveResolutions, isTrue);
    });

    test('Admin role parsed correctly', () {
      final user = UserModel.fromJson({
        'id': 1,
        'email': 'admin@kanvtech.com',
        'role': 'ADMIN',
      });
      expect(user.isAdmin, isTrue);
      expect(user.isManagerOrAdmin, isTrue);
      expect(user.canAllotTickets, isTrue);
      expect(user.canApproveResolutions, isTrue);
      expect(user.displayName, 'System Administrator');
    });
  });

  group('TicketModel Deserialization & Workflow Rules', () {
    test('Active ticket limit and reopen predicates', () {
      final activeTicket = TicketModel.fromJson({
        'id': 'KT-2026-000001',
        'company_id': 'CMP-0001',
        'problem_type': 'Database connectivity issue',
        'priority': 'HIGH',
        'status': 'IN_PROGRESS',
        'assigned_level': 'L1',
        'total_resolution_seconds': 1200,
        'is_timer_running': true,
      });

      expect(activeTicket.isActive, isTrue);
      expect(activeTicket.isInProgress, isTrue);
      expect(activeTicket.isTimerRunning, isTrue);
      expect(activeTicket.canCustomerReopen, isFalse);

      final resolvedTicket = TicketModel.fromJson({
        'id': 'KT-2026-000002',
        'company_id': 'CMP-0001',
        'problem_type': 'Login issue',
        'priority': 'MEDIUM',
        'status': 'RESOLVED',
        'assigned_level': 'L2',
        'total_resolution_seconds': 3600,
      });

      expect(resolvedTicket.isActive, isFalse);
      expect(resolvedTicket.canCustomerReopen, isTrue);
      expect(resolvedTicket.canCustomerRate, isTrue);
    });
  });

  group('Master Data Deserialization', () {
    test('Company and Branch models', () {
      final comp = CompanyModel.fromJson({
        'id': 'CMP-0001',
        'company_name': 'Acme Global Corp',
        'primary_email': 'contact@acme.com',
        'contact_person': 'John Doe',
        'contact_phone': '+91 9876543210',
      });
      expect(comp.id, 'CMP-0001');
      expect(comp.companyName, 'Acme Global Corp');

      final branch = BranchModel.fromJson({
        'id': 'BR-0001',
        'company_id': 'CMP-0001',
        'branch_name': 'Mumbai HQ',
        'city': 'Mumbai',
      });
      expect(branch.branchName, 'Mumbai HQ');
    });
  });
}
