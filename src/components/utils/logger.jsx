const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.isDevelopment = true;
  }

  _formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${level.toUpperCase()}]`;
    
    let formattedData = '';
    if (data && Object.keys(data).length > 0) {
      try {
        formattedData = '\n' + JSON.stringify(data, null, 2);
      } catch (e) {
        formattedData = '\n' + String(data);
      }
    }
    
    return {
      timestamp,
      context: this.context,
      level,
      message,
      data,
      formatted: `${prefix} ${message}${formattedData}`
    };
  }

  _log(level, message, data = {}) {
    const log = this._formatMessage(level, message, data);
    
    // Console avec données séparées pour meilleure lisibilité
    switch (level) {
      case LOG_LEVELS.ERROR:
        if (Object.keys(data).length > 0) {
          console.error(log.formatted);
          console.error('Details:', data);
        } else {
          console.error(log.formatted);
        }
        break;
      case LOG_LEVELS.WARN:
        if (Object.keys(data).length > 0) {
          console.warn(log.formatted);
          console.warn('Details:', data);
        } else {
          console.warn(log.formatted);
        }
        break;
      case LOG_LEVELS.INFO:
        if (Object.keys(data).length > 0) {
          console.log(log.formatted);
          console.log('Details:', data);
        } else {
          console.log(log.formatted);
        }
        break;
      case LOG_LEVELS.DEBUG:
        if (this.isDevelopment) {
          // Utiliser console.log pour compatibilité maximale
          if (Object.keys(data).length > 0) {
            console.log(log.formatted);
            console.log('Details:', data);
          } else {
            console.log(log.formatted);
          }
        }
        break;
    }
    
    // En production, on pourrait envoyer à un service externe
    if (!this.isDevelopment && level === LOG_LEVELS.ERROR) {
      // Exemple: Sentry, LogRocket, etc.
      // sendToMonitoringService(log);
    }
  }

  error(message, data) {
    this._log(LOG_LEVELS.ERROR, message, data);
  }

  warn(message, data) {
    this._log(LOG_LEVELS.WARN, message, data);
  }

  info(message, data) {
    this._log(LOG_LEVELS.INFO, message, data);
  }

  debug(message, data) {
    this._log(LOG_LEVELS.DEBUG, message, data);
  }

  // Helper pour performance
  time(label) {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        this.info(`⏱️ ${label} terminé en ${duration.toFixed(2)}ms`, { duration });
        return duration;
      }
    };
  }
}

export default Logger;

// Exports de convenience
export const createLogger = (context) => new Logger(context);
export const dashboardLogger = new Logger('Dashboard');
export const scanLogger = new Logger('Scan');
export const apiLogger = new Logger('API');