# CompaSSS - Sistema de Agendamento Técnico

![Banner](https://img.shields.io/badge/Status-Desenvolvimento-green?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![Prisma](https://img.shields.io/badge/Prisma-ORM-5a67d8?style=for-the-badge&logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-Data-003b57?style=for-the-badge&logo=sqlite)

Uma solução profissional e de alto nível para gestão de agendamentos técnicos especializados (SDAI, CFTV, SCA, SAP). Desenvolvido com foco em estética premium, performance e automação de fluxos de manutenção predial.

---

## ✨ Destaques do Projeto

- 🎨 **Design High-End**: Interface moderna baseada em *Glassmorphism*, com temas Dark e Light totalmente integrados.
- 📅 **Calendário Inteligente**: Distribuição automática de visitas técnicas, com suporte a feriados e janelas de disponibilidade.
- 📄 **Relatórios PDF Profissionais**: Geração automática de cronogramas de manutenção para clientes, com layout adaptável e visual limpo.
- 🛠️ **Gestão de Carteiras**: Organização de portfólios de clientes vinculados a técnicos específicos.
- 🌓 **Tema Dinâmico**: Troca de tema em tempo real com persistência de preferência.

---

## 🚀 Tecnologias Utilizadas

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Banco de Dados**: [SQLite](https://sqlite.org/) (Local e leve)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Estilização**: Pure CSS (Design System customizado)
- **Ícones**: Lucide React & SVGs customizados

---

## 📸 Screenshots

*(Espaço reservado para imagens - Adicione suas capturas de tela aqui)*

| Dashboard / Calendário | Relatório de Contrato (PDF) |
| :---: | :---: |
| ![Preview 1](https://via.placeholder.com/400x250) | ![Preview 2](https://via.placeholder.com/400x250) |

---

## 🛠️ Como Executar o Projeto

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/breno-camargo/attendance-scheduler.git
   cd attendance-scheduler
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure o Banco de Dados**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```
   Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 📁 Estrutura de Pastas

- `src/app`: Rotas e páginas da aplicação (Next.js App Router).
- `src/components`: Componentes de UI reutilizáveis.
- `prisma`: Esquema do banco de dados e migrações.
- `public`: Ativos estáticos e ícones.

---

## 📄 Licença

Este projeto é de uso privado para gestão interna da CompaSSS. 

---

*Desenvolvido com ❤️ por Antigravity (IA) & Breno Camargo.*
