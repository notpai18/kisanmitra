import { execSync } from 'child_process';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let value = match[2].trim();
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    envVars[key] = value;
  }
});

const varsToSet = [
  'GEMINI_API_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID'
];

for (const key of varsToSet) {
  if (envVars[key]) {
    console.log(`Updating ${key} on Vercel...`);
    try {
      // Remove old env var first to avoid issues
      execSync(`npx vercel env rm ${key} production -y`, { stdio: 'ignore' });
    } catch (e) {}
    try {
      execSync(`npx vercel env rm ${key} preview -y`, { stdio: 'ignore' });
    } catch (e) {}
    try {
      execSync(`npx vercel env rm ${key} development -y`, { stdio: 'ignore' });
    } catch (e) {}

    // Add new env var
    for (const env of ['production', 'development']) {
      console.log(`Setting ${key} for ${env}...`);
      try {
        execSync(`npx vercel env rm ${key} ${env} -y`, { stdio: 'ignore' });
      } catch (e) {}
      try {
        execSync(`echo -n "${envVars[key]}" | npx vercel env add ${key} ${env} --yes`, { stdio: 'inherit' });
      } catch (e) {
        console.error(`Failed to set ${key} for ${env}: ${e.message}`);
      }
    }
  }
}

console.log('Environment variables updated. Triggering redeploy...');
try {
  execSync('npx vercel deploy --prod', { stdio: 'inherit' });
} catch (e) {
  console.error('Redeploy failed, please run manually.');
}
