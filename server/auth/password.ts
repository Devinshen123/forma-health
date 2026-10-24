import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Account } from '../store';

export const derivePassword = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, result) => error ? reject(error) : resolve(result));
});
export async function checkPassword(password: string, account?: Account) {
  const value = await derivePassword(password, account?.password_salt ?? randomBytes(16).toString('hex'));
  return !!account && /^[a-f0-9]{128}$/.test(account.password_hash) && timingSafeEqual(value, Buffer.from(account.password_hash, 'hex'));
}
export async function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return { salt, hash: (await derivePassword(password, salt)).toString('hex') }; }
