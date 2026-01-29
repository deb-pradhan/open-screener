// Load environment variables from .env file FIRST before any other imports
import { file } from 'bun';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

try {
  const envFile = file(envPath);
  const envContent = await envFile.text();
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        process.env[key] = value;
      }
    }
  }
  console.log('Loaded environment variables from .env');
  console.log(`MASSIVE_API_KEY length: ${process.env.MASSIVE_API_KEY?.length || 0}`);
} catch (e) {
  console.warn('Could not load .env file:', e);
}

export {};
