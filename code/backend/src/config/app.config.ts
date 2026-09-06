import { Injectable } from '@nestjs/common';
import { join } from 'path';

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

@Injectable()
export class AppSettings {
  appName = env('APP_NAME', 'Field & Wren');
  fixturesDir = env('FIXTURES_DIR', join(__dirname, '..', '..', '..', '..', 'fixtures'));
  seedOnStart = env('SEED_ON_START', 'true') !== 'false';
  frontendOrigin = env('FRONTEND_ORIGIN', 'http://127.0.0.1:3000');

  xaiApiKey = env('XAI_API_KEY');
  openaiApiKey = env('OPENAI_API_KEY');
  geminiApiKey = env('GEMINI_API_KEY');
  xaiBaseUrl = env('XAI_BASE_URL', 'https://api.x.ai/v1');
  openaiBaseUrl = env('OPENAI_BASE_URL');
  geminiBaseUrl = env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/');
  xaiModel = env('XAI_MODEL', 'grok-4.6');
  geminiModel = env('GEMINI_MODEL', 'gemini-flash-lite-latest');

  importAllowedHosts = env('IMPORT_ALLOWED_HOSTS', '127.0.0.1,localhost');
  importMaxBytes = Number(env('IMPORT_MAX_BYTES', '2000000'));
  importTimeoutSeconds = Number(env('IMPORT_TIMEOUT_SECONDS', '12'));
  importMaxProducts = Number(env('IMPORT_MAX_PRODUCTS', '500'));

  get llmApiKey(): string {
    return this.geminiApiKey || this.xaiApiKey || this.openaiApiKey;
  }

  get llmBaseUrl(): string {
    if (this.geminiApiKey) return this.geminiBaseUrl;
    return this.openaiBaseUrl || this.xaiBaseUrl;
  }

  get llmModel(): string {
    if (this.geminiApiKey) return this.geminiModel;
    return this.xaiModel;
  }

  get llmProvider(): 'gemini' | 'xai' | 'openai' | null {
    if (this.geminiApiKey) return 'gemini';
    if (this.xaiApiKey) return 'xai';
    if (this.openaiApiKey) return 'openai';
    return null;
  }

  get allowedImportHosts(): Set<string> {
    return new Set(
      this.importAllowedHosts
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    );
  }
}

export const settings = new AppSettings();
