/**
 * Rodado pelo Playwright (via `globalSetup` no playwright.config.ts) antes
 * de qualquer spec. Popula a fixture determinística prefixada por `E2E -`
 * pra eliminar os `test.skip()` dependentes de estado variável do DB.
 *
 * Não limpa dados que NÃO tenham o prefixo — é aditivo ao banco do dev.
 *
 * Usa o script `seed:e2e` do package.json pra não depender de `npx` baixar
 * `tsx` em runtime — a versão fica fixada em devDependencies.
 */
import { execSync } from 'node:child_process';

export default async function globalSetup() {
  execSync('npm run seed:e2e --silent', { stdio: 'inherit' });
}
