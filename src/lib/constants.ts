export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'compasss.com.br';

/** Cargos que devem ser únicos (1 pessoa por cargo) */
export const UNIQUE_ROLES: string[] = [
  'Técnico de Sistemas (Líder)',
  'Supervisor',
  'Gerente',
  'Coordenador',
];

/** Cargos da seção de Manutenção */
export const MAINT_ROLES: string[] = ['Técnico de Sistemas (Líder)', 'Supervisor', 'Coordenador'];

/** Mapeamento de nomes legados → nome canônico */
const LEGACY_ROLES: Record<string, string> = {
  'Lider de equipe': 'Técnico de Sistemas (Líder)',
  'Técnico de Sistemas Líder': 'Técnico de Sistemas (Líder)',
  'Técnico Líder de Equipe': 'Técnico de Sistemas (Líder)',
  'Tec Líder de Equipe': 'Técnico de Sistemas (Líder)',
};

/** Migra um nome de cargo legado para o nome canônico atual */
export const migrateRole = (role: string): string => LEGACY_ROLES[role] ?? role;
