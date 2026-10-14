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
    return DashboardStatsModel(
      totalTickets: json['totalTickets'] is int
          ? json['totalTickets']
          : int.tryParse('${json['totalTickets'] ?? 0}') ?? 0,
      openTickets: json['openTickets'] is int
          ? json['openTickets']
          : int.tryParse('${json['openTickets'] ?? 0}') ?? 0,
      inProgressTickets: json['inProgressTickets'] is int
          ? json['inProgressTickets']
          : int.tryParse('${json['inProgressTickets'] ?? 0}') ?? 0,
      resolvedTickets: json['resolvedTickets'] is int
          ? json['resolvedTickets']
          : int.tryParse('${json['resolvedTickets'] ?? 0}') ?? 0,
      breachedSlaTickets: json['breachedSlaTickets'] is int
          ? json['breachedSlaTickets']
          : int.tryParse('${json['breachedSlaTickets'] ?? 0}') ?? 0,
      averageResolutionHours:
          (json['avgResolutionHours'] ?? json['averageResolutionHours'] ?? 0.0)
              .toDouble(),
    );
  }
}
