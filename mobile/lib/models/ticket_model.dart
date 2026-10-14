class TicketModel {
  final String id;
  final String companyId;
  final int customerContactId;
  final String? productId;
  final String? moduleId;
  final String? submoduleId;
  final String? branchId;
  final String? departmentId;
  final String problemType;
  final String priority;
  final String category;
  final String description;
  final String status;
  final String assignedLevel;
  final String? assignedEmployeeId;
  final String? assignedEmployeeName;
  final String? companyName;
  final String? contactName;
  final String? contactPhone;
  final String? productName;
  final String? branchName;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? slaDeadline;
  final String slaStatus;
  final int totalResolutionSeconds;
  final bool isTimerRunning;
  final String? closureReason;
  final DateTime? closedAt;
  final Map<String, dynamic>? feedback;
  final List<TicketCommentModel> comments;
  final List<TicketEscalationModel> escalations;

  TicketModel({
    required this.id,
    required this.companyId,
    required this.customerContactId,
    this.productId,
    this.moduleId,
    this.submoduleId,
    this.branchId,
    this.departmentId,
    required this.problemType,
    required this.priority,
    required this.category,
    required this.description,
    required this.status,
    required this.assignedLevel,
    this.assignedEmployeeId,
    this.assignedEmployeeName,
    this.companyName,
    this.contactName,
    this.contactPhone,
    this.productName,
    this.branchName,
    this.createdAt,
    this.updatedAt,
    this.slaDeadline,
    required this.slaStatus,
    required this.totalResolutionSeconds,
    this.isTimerRunning = false,
    this.closureReason,
    this.closedAt,
    this.feedback,
    this.comments = const [],
    this.escalations = const [],
  });

  factory TicketModel.fromJson(Map<String, dynamic> json) {
    // Extract nested or flat relations
    final companyObj =
        json['company'] is Map ? json['company'] as Map<String, dynamic> : null;
    final contactObj = json['customerContact'] is Map
        ? json['customerContact'] as Map<String, dynamic>
        : null;
    final empObj = json['assignedEmployee'] is Map
        ? json['assignedEmployee'] as Map<String, dynamic>
        : null;
    final prodObj =
        json['product'] is Map ? json['product'] as Map<String, dynamic> : null;
    final branchObj =
        json['branch'] is Map ? json['branch'] as Map<String, dynamic> : null;

    final parsedComments = <TicketCommentModel>[];
    if (json['comments'] is List) {
      for (final item in json['comments']) {
        if (item is Map<String, dynamic>) {
          parsedComments.add(TicketCommentModel.fromJson(item));
        }
      }
    }

    final parsedEscalations = <TicketEscalationModel>[];
    if (json['escalations'] is List) {
      for (final item in json['escalations']) {
        if (item is Map<String, dynamic>) {
          parsedEscalations.add(TicketEscalationModel.fromJson(item));
        }
      }
    }

    final isRunning = json['is_timer_running'] == 1 ||
        json['is_timer_running'] == true ||
        json['isTimerRunning'] == true ||
        (json['timer'] is Map && json['timer']['isRunning'] == true);

    return TicketModel(
      id: json['id']?.toString() ?? '',
      companyId:
          json['company_id']?.toString() ?? json['companyId']?.toString() ?? '',
      customerContactId: json['customer_contact_id'] is int
          ? json['customer_contact_id']
          : int.tryParse(
                  '${json['customer_contact_id'] ?? json['customerContactId'] ?? 0}') ??
              0,
      productId:
          json['product_id']?.toString() ?? json['productId']?.toString(),
      moduleId: json['module_id']?.toString() ?? json['moduleId']?.toString(),
      submoduleId:
          json['submodule_id']?.toString() ?? json['submoduleId']?.toString(),
      branchId: json['branch_id']?.toString() ?? json['branchId']?.toString(),
      departmentId:
          json['department_id']?.toString() ?? json['departmentId']?.toString(),
      problemType: json['problem_type']?.toString() ??
          json['problemType']?.toString() ??
          '',
      priority: json['priority']?.toString().toUpperCase() ?? 'MEDIUM',
      category: json['category']?.toString().toUpperCase() ?? 'GENERAL',
      description: json['description']?.toString() ?? '',
      status: json['status']?.toString().toUpperCase() ?? 'OPEN',
      assignedLevel: json['assigned_level']?.toString() ??
          json['assignedLevel']?.toString() ??
          'L1',
      assignedEmployeeId: json['assigned_employee_id']?.toString() ??
          json['assignedEmployeeId']?.toString(),
      assignedEmployeeName: json['assigned_employee_name']?.toString() ??
          empObj?['name']?.toString(),
      companyName: json['company_name']?.toString() ??
          companyObj?['companyName']?.toString() ??
          companyObj?['name']?.toString(),
      contactName:
          json['contact_name']?.toString() ?? contactObj?['name']?.toString(),
      contactPhone:
          json['contact_phone']?.toString() ?? contactObj?['phone']?.toString(),
      productName:
          json['product_name']?.toString() ?? prodObj?['name']?.toString(),
      branchName: json['branch_name']?.toString() ??
          branchObj?['branchName']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : (json['createdAt'] != null
              ? DateTime.tryParse(json['createdAt'].toString())
              : null),
      updatedAt: json['updated_at'] != null
          ? DateTime.tryParse(json['updated_at'].toString())
          : (json['updatedAt'] != null
              ? DateTime.tryParse(json['updatedAt'].toString())
              : null),
      slaDeadline: json['sla_deadline'] != null
          ? DateTime.tryParse(json['sla_deadline'].toString())
          : (json['slaDeadline'] != null
              ? DateTime.tryParse(json['slaDeadline'].toString())
              : null),
      slaStatus: json['sla_status']?.toString().toUpperCase() ??
          json['slaStatus']?.toString().toUpperCase() ??
          'ON_TRACK',
      totalResolutionSeconds: json['total_resolution_seconds'] is int
          ? json['total_resolution_seconds']
          : int.tryParse(
                  '${json['total_resolution_seconds'] ?? json['totalResolutionSeconds'] ?? 0}') ??
              0,
      isTimerRunning: isRunning,
      closureReason: json['closure_reason']?.toString() ??
          json['closureReason']?.toString(),
      closedAt: json['closed_at'] != null
          ? DateTime.tryParse(json['closed_at'].toString())
          : (json['closedAt'] != null
              ? DateTime.tryParse(json['closedAt'].toString())
              : null),
      feedback: json['feedback'] is Map
          ? json['feedback'] as Map<String, dynamic>
          : null,
      comments: parsedComments,
      escalations: parsedEscalations,
    );
  }

  bool get isOpen => status == 'OPEN';
  bool get isInProgress => status == 'IN_PROGRESS';
  bool get isPaused => status == 'PAUSED';
  bool get isReopened => status == 'REOPENED';
  bool get isResolved => status == 'RESOLVED';
  bool get isManagerReview => status == 'MANAGER_REVIEW';
  bool get isCustomerFeedback => status == 'CUSTOMER_FEEDBACK';
  bool get isClosed => status == 'CLOSED';

  bool get isActive => !isResolved && !isClosed;
  bool get canCustomerReopen => isCustomerFeedback || isResolved;
  bool get canCustomerRate =>
      isCustomerFeedback || (isResolved && feedback == null);
}

class TicketCommentModel {
  final int id;
  final int authorUserId;
  final String commentType;
  final String message;
  final DateTime? createdAt;
  final String? authorName;

  TicketCommentModel({
    required this.id,
    required this.authorUserId,
    required this.commentType,
    required this.message,
    this.createdAt,
    this.authorName,
  });

  factory TicketCommentModel.fromJson(Map<String, dynamic> json) {
    String? name;
    if (json['author'] is Map) {
      final author = json['author'] as Map;
      if (author['employee'] is Map && author['employee']['name'] != null) {
        name = author['employee']['name'].toString();
      } else if (author['email'] != null) {
        name = author['email'].toString();
      }
    }

    return TicketCommentModel(
      id: json['id'] is int
          ? json['id']
          : int.tryParse('${json['id'] ?? 0}') ?? 0,
      authorUserId: json['authorUserId'] is int
          ? json['authorUserId']
          : int.tryParse(
                  '${json['authorUserId'] ?? json['author_user_id'] ?? 0}') ??
              0,
      commentType: json['commentType']?.toString() ??
          json['comment_type']?.toString() ??
          'INTERNAL_NOTE',
      message: json['message']?.toString() ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : (json['created_at'] != null
              ? DateTime.tryParse(json['created_at'].toString())
              : null),
      authorName: name,
    );
  }

  bool get isInternal => commentType == 'INTERNAL_NOTE';
}

class TicketEscalationModel {
  final int id;
  final String fromLevel;
  final String toLevel;
  final String reason;
  final String? notes;
  final DateTime? createdAt;
  final String? escalatedByName;

  TicketEscalationModel({
    required this.id,
    required this.fromLevel,
    required this.toLevel,
    required this.reason,
    this.notes,
    this.createdAt,
    this.escalatedByName,
  });

  factory TicketEscalationModel.fromJson(Map<String, dynamic> json) {
    String? name;
    if (json['escalatedBy'] is Map && json['escalatedBy']['name'] != null) {
      name = json['escalatedBy']['name'].toString();
    }

    return TicketEscalationModel(
      id: json['id'] is int
          ? json['id']
          : int.tryParse('${json['id'] ?? 0}') ?? 0,
      fromLevel:
          json['fromLevel']?.toString() ?? json['from_level']?.toString() ?? '',
      toLevel:
          json['toLevel']?.toString() ?? json['to_level']?.toString() ?? '',
      reason: json['reason']?.toString() ?? '',
      notes: json['notes']?.toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : (json['created_at'] != null
              ? DateTime.tryParse(json['created_at'].toString())
              : null),
      escalatedByName: name,
    );
  }
}
