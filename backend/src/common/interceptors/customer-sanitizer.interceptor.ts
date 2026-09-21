import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class CustomerSanitizerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      map((data) => {
        if (!user || user.role !== 'CUSTOMER') {
          return data;
        }
        return this.sanitize(data);
      }),
    );
  }

  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    const sanitized = { ...obj };

    // 1. Sanitize tickets
    if (sanitized.comments && Array.isArray(sanitized.comments)) {
      sanitized.comments = sanitized.comments.filter(
        (c: any) => c.comment_type === 'CUSTOMER_COMMUNICATION' || c.commentType === 'CUSTOMER_COMMUNICATION'
      );
    }

    // Exclude escalations from customer view
    if ('escalations' in sanitized) {
      delete sanitized.escalations;
    }

    // Exclude technician personal contact info
    if ('assigned_employee_phone' in sanitized) {
      delete sanitized.assigned_employee_phone;
    }
    if ('assigned_employee_email' in sanitized) {
      delete sanitized.assigned_employee_email;
    }
    if (sanitized.assignedEmployee) {
      delete sanitized.assignedEmployee.phone;
      delete sanitized.assignedEmployee.email;
    }

    // Exclude internal timeline events
    if (sanitized.timeline && Array.isArray(sanitized.timeline)) {
      sanitized.timeline = sanitized.timeline.filter(
        (t: any) =>
          !['TIMER_START', 'TIMER_STOP', 'ESCALATED'].includes(t.action_type || t.actionType)
      );
    }

    // Recursively sanitize child properties
    for (const key of Object.keys(sanitized)) {
      if (sanitized[key] && typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }

    return sanitized;
  }
}
