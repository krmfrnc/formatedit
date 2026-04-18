export const auditableEvents = {
  authRegister: 'auth.registered',
  authLogin: 'auth.logged_in',
  authRefresh: 'auth.refreshed',
  authLogout: 'auth.logged_out',
  twoFactorChallengeSent: 'auth.two_factor.challenge_sent',
  twoFactorVerified: 'auth.two_factor.verified',
  impersonationStarted: 'auth.impersonation.started',
  impersonationStopped: 'auth.impersonation.stopped',
  profileUpdated: 'users.profile.updated',
  notificationPreferencesUpdated: 'users.notification_preferences.updated',
  accountAnonymized: 'users.account.anonymized',
  httpMutation: 'http.mutation',
  retentionPurged: 'audit.retention.purged',
} as const;

export type AuditableEventType = (typeof auditableEvents)[keyof typeof auditableEvents];
