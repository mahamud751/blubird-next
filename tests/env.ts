import 'reflect-metadata';
import { join } from 'path';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://blubird:blubird@127.0.0.1:5433/fieldwren_test?schema=public';
process.env.SEED_ON_START = 'false';
process.env.XAI_API_KEY = '';
process.env.OPENAI_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.FIXTURES_DIR = join(__dirname, '..', 'fixtures');
process.env.IMPORT_ALLOWED_HOSTS = '127.0.0.1,localhost';
