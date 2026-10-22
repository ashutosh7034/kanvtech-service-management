class CompanyModel {
  final String id;
  final String companyName;
  final String? address;
  final String primaryEmail;
  final String contactPerson;
  final String contactPhone;
  final bool isActive;

  CompanyModel({
    required this.id,
    required this.companyName,
    this.address,
    required this.primaryEmail,
    required this.contactPerson,
    required this.contactPhone,
    this.isActive = true,
  });

  factory CompanyModel.fromJson(Map<String, dynamic> json) {
    return CompanyModel(
      id: json['id']?.toString() ?? '',
      companyName: json['companyName']?.toString() ??
          json['company_name']?.toString() ??
          '',
      address: json['address']?.toString(),
      primaryEmail: json['primaryEmail']?.toString() ??
          json['primary_email']?.toString() ??
          '',
      contactPerson: json['contactPerson']?.toString() ??
          json['contact_person']?.toString() ??
          '',
      contactPhone: json['contactPhone']?.toString() ??
          json['contact_phone']?.toString() ??
          '',
      isActive: json['isActive'] == true || json['is_active'] == true,
    );
  }
}

class BranchModel {
  final String id;
  final String companyId;
  final String branchName;
  final String? city;
  final String? state;
  final String? contactPerson;
  final String? contactPhone;

  BranchModel({
    required this.id,
    required this.companyId,
    required this.branchName,
    this.city,
    this.state,
    this.contactPerson,
    this.contactPhone,
  });

  factory BranchModel.fromJson(Map<String, dynamic> json) {
    return BranchModel(
      id: json['id']?.toString() ?? '',
      companyId:
          json['companyId']?.toString() ?? json['company_id']?.toString() ?? '',
      branchName: json['branchName']?.toString() ??
          json['branch_name']?.toString() ??
          '',
      city: json['city']?.toString(),
      state: json['state']?.toString(),
      contactPerson: json['contactPerson']?.toString() ??
          json['contact_person']?.toString(),
      contactPhone:
          json['contactPhone']?.toString() ?? json['contact_phone']?.toString(),
    );
  }
}

class ProductModel {
  final String id;
  final String name;
  final String? description;
  final String? category;
  final bool isActive;

  ProductModel({
    required this.id,
    required this.name,
    this.description,
    this.category,
    this.isActive = true,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? json['productName']?.toString() ?? '',
      description: json['description']?.toString(),
      category: json['category']?.toString(),
      isActive: json['isActive'] != false && json['is_active'] != false,
    );
  }
}

class EmployeeSummaryModel {
  final String id;
  final int userId;
  final String name;
  final String email;
  final String level;
  final String? department;
  final String availability;
  final int openTicketsCount;

  EmployeeSummaryModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    required this.level,
    this.department,
    this.availability = 'AVAILABLE',
    this.openTicketsCount = 0,
  });

  factory EmployeeSummaryModel.fromJson(Map<String, dynamic> json) {
    return EmployeeSummaryModel(
      id: json['id']?.toString() ?? json['employeeId']?.toString() ?? '',
      userId: json['userId'] is int
          ? json['userId']
          : int.tryParse('${json['userId'] ?? json['user_id'] ?? 0}') ?? 0,
      name: json['name']?.toString() ?? json['employeeName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      level: json['level']?.toString() ?? 'L1',
      department: json['department']?.toString(),
      availability: json['availability']?.toString() ?? 'AVAILABLE',
      openTicketsCount: json['openTicketsCount'] is int
          ? json['openTicketsCount']
          : (int.tryParse(
                  '${json['openTicketsCount'] ?? json['open_tickets'] ?? 0}') ??
              0),
    );
  }
}

class EmployeeTaskModel {
  final String id;
  final String title;
  final String? description;
  final String priority;
  final String status;
  final DateTime? dueDate;
  final bool isCompleted;

  EmployeeTaskModel({
    required this.id,
    required this.title,
    this.description,
    required this.priority,
    required this.status,
    this.dueDate,
    this.isCompleted = false,
  });

  factory EmployeeTaskModel.fromJson(Map<String, dynamic> json) {
    return EmployeeTaskModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ??
          json['taskName']?.toString() ??
          'Untitled Task',
      description: json['description']?.toString(),
      priority: json['priority']?.toString().toUpperCase() ?? 'MEDIUM',
      status: json['status']?.toString().toUpperCase() ?? 'PENDING',
      dueDate: json['dueDate'] != null
          ? DateTime.tryParse(json['dueDate'].toString())
          : (json['due_date'] != null
              ? DateTime.tryParse(json['due_date'].toString())
              : null),
      isCompleted: json['status'] == 'COMPLETED' || json['isCompleted'] == true,
    );
  }
}

class ChatConversationModel {
  final int id;
  final String? subject;
  final String? lastMessage;
  final DateTime? updatedAt;
  final int unreadCount;
  final List<String> participantNames;

  ChatConversationModel({
    required this.id,
    this.subject,
    this.lastMessage,
    this.updatedAt,
    this.unreadCount = 0,
    this.participantNames = const [],
  });

  factory ChatConversationModel.fromJson(Map<String, dynamic> json) {
    final names = <String>[];
    if (json['participants'] is List) {
      for (final p in json['participants']) {
        if (p is Map && p['user'] is Map) {
          final u = p['user'];
          final name = u['employee']?['name'] ?? u['email'];
          if (name != null) names.add(name.toString());
        }
      }
    }

    return ChatConversationModel(
      id: json['id'] is int
          ? json['id']
          : int.tryParse('${json['id'] ?? 0}') ?? 0,
      subject: json['subject']?.toString(),
      lastMessage:
          json['lastMessage']?.toString() ?? json['last_message']?.toString(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
      unreadCount: json['unreadCount'] is int
          ? json['unreadCount']
          : int.tryParse('${json['unreadCount'] ?? 0}') ?? 0,
      participantNames: names,
    );
  }
}

class ChatMessageModel {
  final int id;
  final int conversationId;
  final int senderUserId;
  final String senderName;
  final String message;
  final DateTime? createdAt;

  ChatMessageModel({
    required this.id,
    required this.conversationId,
    required this.senderUserId,
    required this.senderName,
    required this.message,
    this.createdAt,
  });

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    String sName = 'User';
    if (json['sender'] is Map) {
      final s = json['sender'];
      sName = s['employee']?['name']?.toString() ??
          s['email']?.toString() ??
          'User';
    }

    return ChatMessageModel(
      id: json['id'] is int
          ? json['id']
          : int.tryParse('${json['id'] ?? 0}') ?? 0,
      conversationId: json['conversationId'] is int
          ? json['conversationId']
          : int.tryParse('${json['conversationId'] ?? 0}') ?? 0,
      senderUserId: json['senderUserId'] is int
          ? json['senderUserId']
          : int.tryParse(
                  '${json['senderUserId'] ?? json['sender_user_id'] ?? 0}') ??
              0,
      senderName: sName,
      message: json['message']?.toString() ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
    );
  }
}

class AttendanceRecordModel {
  final int id;
  final String employeeId;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final String status;
  final String? locationAddress;

  AttendanceRecordModel({
    required this.id,
    required this.employeeId,
    required this.checkInTime,
    this.checkOutTime,
    required this.status,
    this.locationAddress,
  });

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    return AttendanceRecordModel(
      id: json['id'] is int
          ? json['id']
          : int.tryParse('${json['id'] ?? 0}') ?? 0,
      employeeId: json['employeeId']?.toString() ??
          json['employee_id']?.toString() ??
          '',
      checkInTime: DateTime.tryParse(json['checkInTime']?.toString() ??
              json['check_in_time']?.toString() ??
              '') ??
          DateTime.now(),
      checkOutTime: json['checkOutTime'] != null
          ? DateTime.tryParse(json['checkOutTime'].toString())
          : (json['check_out_time'] != null
              ? DateTime.tryParse(json['check_out_time'].toString())
              : null),
      status: json['status']?.toString().toUpperCase() ?? 'CHECKED_IN',
      locationAddress: json['locationAddress']?.toString() ??
          json['location_address']?.toString(),
    );
  }
}

class DashboardStatsModel {
  final int totalTickets;
  final int openTickets;
  final int inProgressTickets;
  final int resolvedTickets;
  final int breachedSlaTickets;
  final double averageResolutionHours;

  DashboardStatsModel({
    this.totalTickets = 0,
    this.openTickets = 0,
    this.inProgressTickets = 0,
    this.resolvedTickets = 0,
    this.breachedSlaTickets = 0,
    this.averageResolutionHours = 0.0,
  });

  factory DashboardStatsModel.fromJson(Map<String, dynamic> json) {
    final Map<dynamic, dynamic> data;
    if (json['metrics'] is Map) {
      data = json['metrics'] as Map;
    } else if (json['data'] is Map) {
      data = json['data'] as Map;
    } else {
      data = json;
    }

    final Map<dynamic, dynamic> volume =
        data['volume'] is Map ? data['volume'] as Map : data;
    final Map<dynamic, dynamic> sla =
        data['sla'] is Map ? data['sla'] as Map : data;

    int parseInt(dynamic val) {
      if (val == null) return 0;
      if (val is int) return val;
      if (val is num) return val.toInt();
      return int.tryParse(val.toString()) ?? 0;
    }

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is double) return val;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString()) ?? 0.0;
    }

    double avgHours = parseDouble(data['avgResolutionHours'] ??
        data['averageResolutionHours'] ??
        json['avgResolutionHours'] ??
        json['averageResolutionHours']);

    if (avgHours == 0.0 && data['avgResolutionSeconds'] != null) {
      final sec = parseDouble(data['avgResolutionSeconds']);
      if (sec > 0) {
        avgHours = double.parse((sec / 3600.0).toStringAsFixed(1));
      }
    }

    return DashboardStatsModel(
      totalTickets: parseInt(
          volume['total'] ?? data['totalTickets'] ?? json['totalTickets']),
      openTickets: parseInt(
          volume['open'] ?? data['openTickets'] ?? json['openTickets']),
      inProgressTickets: parseInt(volume['inProgress'] ??
          data['inProgressTickets'] ??
          json['inProgressTickets']),
      resolvedTickets: parseInt(volume['resolved'] ??
          data['resolvedTickets'] ??
          json['resolvedTickets']),
      breachedSlaTickets: parseInt(sla['breached'] ??
          data['breachedSlaTickets'] ??
          json['breachedSlaTickets']),
      averageResolutionHours: avgHours,
    );
  }
}

class DepartmentModel {
  final String id;
  final String name;
  final String? code;
  final String? description;
  final bool isActive;
  final int employeeCount;
  final String? managerName;
  final List<String> specializations;

  DepartmentModel({
    required this.id,
    required this.name,
    this.code,
    this.description,
    this.isActive = true,
    this.employeeCount = 0,
    this.managerName,
    this.specializations = const [],
  });

  factory DepartmentModel.fromJson(Map<String, dynamic> json) {
    List<String> specs = [];
    if (json['specializations'] is List) {
      specs = (json['specializations'] as List)
          .map((s) => s is Map ? s['name']?.toString() ?? '' : s.toString())
          .where((s) => s.isNotEmpty)
          .toList();
    }

    int count = 0;
    if (json['employees'] is List) {
      count = (json['employees'] as List).length;
    } else if (json['employeeCount'] != null) {
      count = int.tryParse('${json['employeeCount']}') ?? 0;
    }

    return DepartmentModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString(),
      description: json['description']?.toString(),
      isActive: json['isActive'] != false && json['is_active'] != false,
      employeeCount: count,
      managerName: json['manager'] is Map
          ? json['manager']['name']?.toString()
          : json['manager']?.toString(),
      specializations: specs,
    );
  }
}

class EmployeeDetailModel {
  final String id;
  final int userId;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final String level;
  final String? departmentId;
  final String? departmentName;
  final String status;
  final String availability;
  final int assignedTicketsCount;

  EmployeeDetailModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    required this.level,
    this.departmentId,
    this.departmentName,
    this.status = 'ACTIVE',
    this.availability = 'AVAILABLE',
    this.assignedTicketsCount = 0,
  });

  factory EmployeeDetailModel.fromJson(Map<String, dynamic> json) {
    int ticketCount = 0;
    if (json['assignedTickets'] is List) {
      ticketCount = (json['assignedTickets'] as List).length;
    } else if (json['openTicketsCount'] != null ||
        json['assignedTicketsCount'] != null) {
      ticketCount = int.tryParse(
              '${json['openTicketsCount'] ?? json['assignedTicketsCount']}') ??
          0;
    }

    final userMap = json['user'] is Map ? json['user'] as Map : null;
    final deptVal = json['department'];
    final deptName = (deptVal is Map ? deptVal['name']?.toString() : null) ??
        (deptVal is String ? deptVal : null) ??
        json['departmentName']?.toString();

    return EmployeeDetailModel(
      id: json['id']?.toString() ?? '',
      userId: json['userId'] is int
          ? json['userId']
          : int.tryParse('${json['userId'] ?? json['user_id'] ?? 0}') ?? 0,
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString(),
      role: json['role']?.toString() ??
          userMap?['role']?.toString() ??
          'EMPLOYEE',
      level: json['level']?.toString() ?? 'L1',
      departmentId:
          json['departmentId']?.toString() ?? json['department_id']?.toString(),
      departmentName: deptName,
      status: json['status']?.toString() ?? 'ACTIVE',
      availability: json['availability']?.toString() ?? 'AVAILABLE',
      assignedTicketsCount: ticketCount,
    );
  }
}

class ProspectModel {
  final String id;
  final String companyName;
  final String contactPerson;
  final String? email;
  final String phone;
  final String? address;
  final String enquiry;
  final String status;
  final String? source;
  final DateTime createdAt;

  ProspectModel({
    required this.id,
    required this.companyName,
    required this.contactPerson,
    this.email,
    required this.phone,
    this.address,
    required this.enquiry,
    required this.status,
    this.source,
    required this.createdAt,
  });

  factory ProspectModel.fromJson(Map<String, dynamic> json) {
    return ProspectModel(
      id: json['id']?.toString() ?? '',
      companyName: json['companyName']?.toString() ??
          json['company_name']?.toString() ??
          '',
      contactPerson: json['contactPerson']?.toString() ??
          json['contact_person']?.toString() ??
          '',
      email: json['email']?.toString(),
      phone: json['phone']?.toString() ?? '',
      address: json['address']?.toString(),
      enquiry:
          json['enquiry']?.toString() ?? json['description']?.toString() ?? '',
      status: json['status']?.toString() ?? 'NEW',
      source: json['source']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ??
              json['created_at']?.toString() ??
              '') ??
          DateTime.now(),
    );
  }
}

class ImplementationModel {
  final String id;
  final String companyId;
  final String companyName;
  final String productId;
  final String productName;
  final String stage;
  final String status;
  final int progressPercent;
  final DateTime? targetDate;
  final List<ImplementationTaskModel> tasks;

  ImplementationModel({
    required this.id,
    required this.companyId,
    required this.companyName,
    required this.productId,
    required this.productName,
    required this.stage,
    required this.status,
    required this.progressPercent,
    this.targetDate,
    this.tasks = const [],
  });

  factory ImplementationModel.fromJson(Map<String, dynamic> json) {
    final rawTasks = json['tasks'] as List? ?? [];
    return ImplementationModel(
      id: json['id']?.toString() ?? '',
      companyId:
          json['companyId']?.toString() ?? json['company_id']?.toString() ?? '',
      companyName: json['company']?['companyName']?.toString() ??
          json['companyName']?.toString() ??
          'Company',
      productId:
          json['productId']?.toString() ?? json['product_id']?.toString() ?? '',
      productName: json['product']?['name']?.toString() ??
          json['productName']?.toString() ??
          'Product',
      stage: json['stage']?.toString() ?? 'PLANNING',
      status: json['status']?.toString() ?? 'IN_PROGRESS',
      progressPercent: json['progressPercent'] is int
          ? json['progressPercent']
          : int.tryParse(
                  '${json['progressPercent'] ?? json['progress'] ?? 0}') ??
              0,
      targetDate: json['targetDate'] != null
          ? DateTime.tryParse(json['targetDate'].toString())
          : null,
      tasks: rawTasks
          .map((t) =>
              ImplementationTaskModel.fromJson(t as Map<String, dynamic>))
          .toList(),
    );
  }
}

class ImplementationTaskModel {
  final String id;
  final String title;
  final String stage;
  final bool isCompleted;

  ImplementationTaskModel({
    required this.id,
    required this.title,
    required this.stage,
    required this.isCompleted,
  });

  factory ImplementationTaskModel.fromJson(Map<String, dynamic> json) {
    return ImplementationTaskModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Task',
      stage: json['stage']?.toString() ?? 'PLANNING',
      isCompleted: json['isCompleted'] == true || json['is_completed'] == true,
    );
  }
}

class SubscriptionModel {
  final String id;
  final String companyId;
  final String companyName;
  final String productId;
  final String productName;
  final String planType;
  final DateTime startDate;
  final DateTime endDate;
  final String status;
  final double? annualValue;

  SubscriptionModel({
    required this.id,
    required this.companyId,
    required this.companyName,
    required this.productId,
    required this.productName,
    required this.planType,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.annualValue,
  });

  factory SubscriptionModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionModel(
      id: json['id']?.toString() ?? '',
      companyId:
          json['companyId']?.toString() ?? json['company_id']?.toString() ?? '',
      companyName: json['company']?['companyName']?.toString() ??
          json['companyName']?.toString() ??
          'Company',
      productId:
          json['productId']?.toString() ?? json['product_id']?.toString() ?? '',
      productName: json['product']?['name']?.toString() ??
          json['productName']?.toString() ??
          'Product',
      planType: json['planType']?.toString() ??
          json['plan_type']?.toString() ??
          'STANDARD',
      startDate: DateTime.tryParse(json['startDate']?.toString() ??
              json['start_date']?.toString() ??
              '') ??
          DateTime.now(),
      endDate: DateTime.tryParse(json['endDate']?.toString() ??
              json['end_date']?.toString() ??
              '') ??
          DateTime.now().add(const Duration(days: 365)),
      status: json['status']?.toString() ?? 'ACTIVE',
      annualValue: json['annualValue'] != null
          ? double.tryParse(json['annualValue'].toString())
          : null,
    );
  }
}

class AuditLogModel {
  final int id;
  final DateTime createdAt;
  final String actorEmail;
  final String actorRole;
  final String action;
  final String entityType;
  final String? entityId;
  final String? ipAddress;

  AuditLogModel({
    required this.id,
    required this.createdAt,
    required this.actorEmail,
    required this.actorRole,
    required this.action,
    required this.entityType,
    this.entityId,
    this.ipAddress,
  });

  factory AuditLogModel.fromJson(Map<String, dynamic> json) {
    return AuditLogModel(
      id: json['id'] is int
          ? json['id']
          : int.tryParse('${json['id'] ?? 0}') ?? 0,
      createdAt: DateTime.tryParse(json['created_at']?.toString() ??
              json['createdAt']?.toString() ??
              '') ??
          DateTime.now(),
      actorEmail: json['actor_email']?.toString() ??
          json['actorEmail']?.toString() ??
          'System',
      actorRole: json['actor_role']?.toString() ??
          json['actorRole']?.toString() ??
          'SYSTEM',
      action: json['action']?.toString() ?? '',
      entityType: json['entity_type']?.toString() ??
          json['entityType']?.toString() ??
          '',
      entityId: json['entity_id']?.toString() ?? json['entityId']?.toString(),
      ipAddress:
          json['ip_address']?.toString() ?? json['ipAddress']?.toString(),
    );
  }
}

class SlaConfigModel {
  final String priority;
  final int responseTimeHours;
  final int resolutionTimeHours;
  final int warningThresholdPercent;

  SlaConfigModel({
    required this.priority,
    required this.responseTimeHours,
    required this.resolutionTimeHours,
    required this.warningThresholdPercent,
  });

  factory SlaConfigModel.fromJson(Map<String, dynamic> json) {
    return SlaConfigModel(
      priority: json['priority']?.toString().toUpperCase() ?? 'MEDIUM',
      responseTimeHours: json['response_time_hours'] is int
          ? json['response_time_hours']
          : int.tryParse(
                  '${json['response_time_hours'] ?? json['responseTimeHours'] ?? 24}') ??
              24,
      resolutionTimeHours: json['resolution_time_hours'] is int
          ? json['resolution_time_hours']
          : int.tryParse(
                  '${json['resolution_time_hours'] ?? json['resolutionTimeHours'] ?? 72}') ??
              72,
      warningThresholdPercent: json['warning_threshold_percent'] is int
          ? json['warning_threshold_percent']
          : int.tryParse(
                  '${json['warning_threshold_percent'] ?? json['warningThresholdPercent'] ?? 75}') ??
              75,
    );
  }
}
