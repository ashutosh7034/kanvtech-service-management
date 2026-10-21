class UserModel {
  final int id;
  final String email;
  final String role;
  final String? name;
  final String? employeeId;
  final String? companyId;
  final int? contactId;

  UserModel({
    required this.id,
    required this.email,
    required this.role,
    this.name,
    this.employeeId,
    this.companyId,
    this.contactId,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int
          ? json['id']
          : (json['userId'] is int
              ? json['userId']
              : int.tryParse('${json['id'] ?? json['userId'] ?? 0}') ?? 0),
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString().toUpperCase() ?? 'CUSTOMER',
      name: json['name']?.toString(),
      employeeId: json['employeeId']?.toString(),
      companyId: json['companyId']?.toString(),
      contactId: json['contactId'] != null
          ? int.tryParse('${json['contactId']}')
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': id,
        'email': email,
        'role': role,
        'name': name,
        'employeeId': employeeId,
        'companyId': companyId,
        'contactId': contactId,
      };

  bool get isCustomer => role == 'CUSTOMER';
  bool get isTechnician =>
      role == 'L1_EMPLOYEE' || role == 'L2_EMPLOYEE' || role == 'L3_EMPLOYEE';
  bool get isL1 => role == 'L1_EMPLOYEE';
  bool get isL2 => role == 'L2_EMPLOYEE';
  bool get isL3 => role == 'L3_EMPLOYEE';
  bool get isManager => role == 'MANAGER';
  bool get isAdmin => role == 'ADMIN';
  bool get isStaff => !isCustomer;
  bool get isManagerOrAdmin => role == 'MANAGER' || role == 'ADMIN';
  bool get canAllotTickets => role == 'MANAGER' || role == 'ADMIN';
  bool get canApproveResolutions => role == 'MANAGER' || role == 'ADMIN';

  String get displayName {
    if (name != null && name!.trim().isNotEmpty) return name!;
    if (isAdmin) return 'System Administrator';
    if (isManager) return 'Service Manager';
    return email;
  }

  String get formattedRole {
    switch (role) {
      case 'ADMIN':
        return 'System Administrator';
      case 'MANAGER':
        return 'Service Manager';
      case 'L1_EMPLOYEE':
        return 'L1 Support Specialist';
      case 'L2_EMPLOYEE':
        return 'L2 Senior Specialist';
      case 'L3_EMPLOYEE':
        return 'L3 Principal Specialist';
      case 'CUSTOMER':
        return 'Customer Representative';
      default:
        return role.replaceAll('_', ' ');
    }
  }
}
