export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    return meta ? `${base} ${JSON.stringify(meta)}` : base;
  }

  debug(message: string, meta?: unknown) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: unknown) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: unknown) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (this.shouldLog('error')) {
      const baseMeta = error instanceof Error ? { message: error.message, stack: error.stack } : {};
      const errorMeta = meta ? { ...baseMeta, ...meta } : baseMeta;
      console.error(this.formatMessage('error', message, errorMeta));
    }
  }
}

export const logger = new Logger();
