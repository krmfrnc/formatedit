import { Injectable } from '@nestjs/common';
import type { NotificationTemplateBody } from './templates/registry';

/**
 * Task 263: Pure `{{var}}` / `{{dot.path}}` substitution engine.
 *
 * Intentionally does NOT pull in Handlebars, Mustache, or similar — project
 * convention is to hand-roll small utilities rather than add dependencies.
 */
@Injectable()
export class NotificationTemplateEngine {
  render(
    template: NotificationTemplateBody,
    variables: Record<string, unknown>,
  ): { subject?: string; body: string } {
    return {
      subject: template.subject ? this.substitute(template.subject, variables) : undefined,
      body: this.substitute(template.body, variables),
    };
  }

  private substitute(input: string, variables: Record<string, unknown>): string {
    return input.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, path: string) => {
      const value = this.resolvePath(variables, path);
      if (value === undefined || value === null) {
        return '';
      }
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch {
          return '';
        }
      }
      return String(value as string | number | boolean);
    });
  }

  private resolvePath(source: Record<string, unknown>, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = source;
    for (const segment of segments) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }
}
