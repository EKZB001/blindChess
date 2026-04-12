import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// Pobierz ścieżkę do katalogu projektu (dla ES Modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '../logs');

// Konfiguracja formatu dla konsoli (czytelny i z kolorami)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `[${timestamp}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
  })
);

// Konfiguracja formatu dla plików (JSON lub czysty tekst z czasem)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: 'info',
  format: fileFormat,
  transports: [
    // 1. Zapisywanie błędów do error.log
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    // 2. Zapisywanie wszystkich logów do combined.log
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log') 
    }),
  ],
});

// 3. Dodanie wypisywania na konsolę w środowisku innym niż produkcyjne
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

export default logger;
