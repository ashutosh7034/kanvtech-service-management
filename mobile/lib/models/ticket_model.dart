class TicketModel {
  final String id;
  final String companyId;
  final int customerContactId;
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
  final DateTime? createdAt;
  final DateTime? slaDeadline;
  final String slaStatus;
  final int totalResolutionSeconds;
  final bool isTimerRunning;
  final Map<String, dynamic>? feedback;

  TicketModel({
    required this.id,
    required this.companyId,
    required this.customerContactId,
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
    this.createdAt,
    this.slaDeadline,
    required this.slaStatus,
    required this.totalResolutionSeconds,
    this.isTimerRunning = false,
    this.feedback,
  });

  factory TicketModel.fromJson(Map<String, dynamic> json) {
    return TicketModel(
      id: json['id'] ?? '',
      companyId: json['company_id'] ?? json['companyId'] ?? '',
      customerContactId: json['customer_contact_id'] ?? json['customerContactId'] ?? 0,
      problemType: json['problem_type'] ?? json['problemType'] ?? '',
      priority: json['priority'] ?? 'MEDIUM',
      category: json['category'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? 'OPEN',
      assignedLevel: json['assigned_level'] ?? json['assignedLevel'] ?? 'L1',
      assignedEmployeeId: json['assigned_employee_id'] ?? json['assignedEmployeeId'],
      assignedEmployeeName: json['assigned_employee_name'],
      companyName: json['company_name'],
      contactName: json['contact_name'],
      contactPhone: json['contact_phone'],
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at']) : null,
      slaDeadline: json['sla_deadline'] != null ? DateTime.tryParse(json['sla_deadline']) : null,
      slaStatus: json['sla_status'] ?? 'ON_TRACK',
      totalResolutionSeconds: json['total_resolution_seconds'] ?? 0,
      isTimerRunning: json['is_timer_running'] == 1 || (json['timer'] != null && json['timer']['isRunning'] == true),
      feedback: json['feedback'],
    );
  }
}
