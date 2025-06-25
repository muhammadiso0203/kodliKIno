import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export function readJson<T>(filename: string): T {
  const path = join(process.cwd(), 'data', filename);
  const data = readFileSync(path, 'utf-8');
  return JSON.parse(data);
}

export function writeJson<T>(filename: string, data: T): void {
  const path = join(process.cwd(), 'data', filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}
