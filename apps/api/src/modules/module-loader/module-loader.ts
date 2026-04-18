import { DynamicModule, type Type } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { SupportModule } from '../support/support.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { FormattingModule } from '../formatting/formatting.module';
import { DocumentParserModule } from '../document-parser/document-parser.module';
import { CitationModule } from '../citations/citation.module';
import { DocumentsModule } from '../documents/documents.module';
import { GeoModule } from '../geo/geo.module';
import { HealthModule } from '../health/health.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { PaymentsModule } from '../payments/payments.module';
import { StorageModule } from '../storage/storage.module';
import { StudentVerificationModule } from '../student-verification/student-verification.module';
import { TemplatesModule } from '../templates/templates.module';
import { UsersModule } from '../users/users.module';
import { InfrastructureModule } from '../../infrastructure.module';

export interface RegisteredModuleDefinition {
  key: string;
  module: Type<unknown> | DynamicModule;
  category: 'infrastructure' | 'feature';
  description: string;
}

export const registeredModules: RegisteredModuleDefinition[] = [
  {
    key: 'infrastructure',
    module: InfrastructureModule,
    category: 'infrastructure',
    description: 'Common infrastructure services such as Prisma and Redis.',
  },
  {
    key: 'analysis',
    module: AnalysisModule,
    category: 'feature',
    description: 'Admin-managed analysis categories and future ticket operations.',
  },
  {
    key: 'audit',
    module: AuditModule,
    category: 'feature',
    description: 'Audit log capture, filtering, export, and retention operations.',
  },
  {
    key: 'users',
    module: UsersModule,
    category: 'feature',
    description: 'User persistence and profile-oriented service access.',
  },
  {
    key: 'document-parser',
    module: DocumentParserModule,
    category: 'feature',
    description: 'DOCX parsing, heading detection, outline generation, and confidence APIs.',
  },
  {
    key: 'citations',
    module: CitationModule,
    category: 'feature',
    description: 'Bibliography parsing for APA, Vancouver, IEEE, MDPI, Chicago, Harvard, and MLA styles.',
  },
  {
    key: 'documents',
    module: DocumentsModule,
    category: 'feature',
    description: 'Document upload, security validation, storage, and scan orchestration.',
  },
  {
    key: 'formatting',
    module: FormattingModule,
    category: 'feature',
    description: 'Template application, DOCX/PDF output generation, and formatting jobs.',
  },
  {
    key: 'templates',
    module: TemplatesModule,
    category: 'feature',
    description: 'Official and user-owned template management APIs.',
  },
  {
    key: 'auth',
    module: AuthModule,
    category: 'feature',
    description: 'Authentication routes and registration flow.',
  },
  {
    key: 'queue',
    module: QueueModule,
    category: 'feature',
    description: 'BullMQ queue registration and producer access.',
  },
  {
    key: 'payments',
    module: PaymentsModule,
    category: 'feature',
    description: 'Stripe checkout session creation and payment persistence.',
  },
  {
    key: 'student-verification',
    module: StudentVerificationModule,
    category: 'feature',
    description: 'SheerID-backed student verification for academic discount eligibility.',
  },
  {
    key: 'storage',
    module: StorageModule,
    category: 'feature',
    description: 'S3/MinIO storage abstraction layer.',
  },
  {
    key: 'health',
    module: HealthModule,
    category: 'feature',
    description: 'Readiness and configuration snapshot endpoints.',
  },
  {
    key: 'geo',
    module: GeoModule,
    category: 'feature',
    description: 'GeoIP-based currency resolution for multi-currency checkout.',
  },
  {
    key: 'notifications',
    module: NotificationsModule,
    category: 'feature',
    description: 'Event-driven notifications across email, WhatsApp, Telegram, and in-app channels.',
  },
  {
    key: 'admin',
    module: AdminModule,
    category: 'feature',
    description: 'Admin panel services: feature flags, announcements, legal documents, analytics, and Prometheus metrics.',
  },
  {
    key: 'support',
    module: SupportModule,
    category: 'feature',
    description: 'Customer support tickets, WhatsApp/Telegram channel adapters, and after-hours auto-reply.',
  },
  {
    key: 'affiliate',
    module: AffiliateModule,
    category: 'feature',
    description: 'Affiliate program: enrollment, referral tracking, commission rewards, and payout reporting.',
  },
];

export function loadApplicationModules(): Array<Type<unknown> | DynamicModule> {
  return registeredModules.map((entry) => entry.module);
}
