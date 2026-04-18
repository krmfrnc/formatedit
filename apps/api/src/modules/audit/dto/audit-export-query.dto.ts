import { IsIn, IsOptional, IsString } from 'class-validator';
import { AuditLogQueryDto } from './audit-log-query.dto';

export class AuditExportQueryDto extends AuditLogQueryDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsIn(['csv', 'excel'])
  format!: 'csv' | 'excel';
}
