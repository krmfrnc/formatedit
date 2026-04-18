import { createLogger, format, transports } from 'winston';
import { getRequestId } from './request-context/request-context';

const appendRequestId = format((info) => {
  const requestId = getRequestId();
  if (requestId) {
    return {
      ...info,
      requestId,
    };
  }

  return info;
});

export const appLogger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'api' },
  format: format.combine(
    appendRequestId(),
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
  ),
  transports: [new transports.Console()],
});
