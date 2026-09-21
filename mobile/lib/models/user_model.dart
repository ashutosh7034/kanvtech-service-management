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
      id: json['id'] ?? json['userId'] ?? 0,
      email: json['email'] ?? '',
      role: json['role'] ?? 'CUSTOMER',
      name: json['name'],
      employeeId: json['employeeId'],
      companyId: json['companyId'],
      contactId: json['contactId'],
    );
  }

  bool get isCustomer => role == 'CUSTOMER';
  bool get isEmployee => ['L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'].includes(role);
  bool get isManagerOrAdmin => role == 'MANAGER' || role == 'ADMIN';
}

extension ListExtensions on List<String> {
  bool includes(String element) => contains(element);
}
