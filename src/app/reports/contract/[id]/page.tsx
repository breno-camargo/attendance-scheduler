import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';

import PrintTrigger from '@/components/reports/PrintTrigger';
import ReportContactTables from '@/components/reports/ReportContactTables';
import { professionalScopeWhere, requireAuthWithScope } from '@/lib/api-utils';
import { MAINT_ROLES } from '@/lib/constants';
import { parseSystemTypes } from '@/lib/formatting';
import { getHolidaysForYear } from '@/lib/holidays';
import prisma from '@/lib/prisma';

import './print.css';

// Relatório sempre fresco: evita browser servir versão stale com nome desatualizado.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RowData {
  date: string;
  obs: string;
  isTeste: boolean;
}

interface TableRow {
  item1: RowData;
  item2?: RowData;
}

const VISITS_PER_PAGE = 120;

function renderVisitsTable(tableRows: TableRow[], isSingleColumn: boolean) {
  return (
    <table className="visits-table">
      <thead>
        <tr>
          <th style={{ width: isSingleColumn ? '40%' : '20%' }}>Data</th>
          <th style={{ width: isSingleColumn ? '60%' : '30%' }}>Observação</th>
          {!isSingleColumn && (
            <>
              <th style={{ width: '20%' }}>Data</th>
              <th style={{ width: '30%' }}>Observação</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {tableRows.length === 0 && (
          <tr>
            <td colSpan={2}>Nenhuma visita agendada</td>
          </tr>
        )}
        {tableRows.map((row, idx) => {
          const isT1 = row.item1.isTeste;
          const isT2 = row.item2?.isTeste;

          return (
            <tr key={idx}>
              <td>
                {isT1 ? <span style={{ color: '#ef4444' }}>{row.item1.date}</span> : row.item1.date}
              </td>
              <td>
                {isT1 ? <span style={{ color: '#ef4444' }}>{row.item1.obs}</span> : row.item1.obs}
              </td>
              {!isSingleColumn && (
                <>
                  <td>
                    {isT2 ? (
                      <span style={{ color: '#ef4444' }}>{row.item2?.date || '-'}</span>
                    ) : (
                      row.item2?.date || '-'
                    )}
                  </td>
                  <td>
                    {isT2 ? (
                      <span style={{ color: '#ef4444' }}>{row.item2?.obs || '-'}</span>
                    ) : (
                      row.item2?.obs || '-'
                    )}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function normalizeContactName(name: string) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export default async function ContractReportPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const yearParam = searchParams.year ? parseInt(searchParams.year) : null;

  const result = await requireAuthWithScope();
  if ('error' in result) {
    if (result.error.status === 401) redirect('/login');
    return notFound();
  }
  const { auth } = result;

  const contract = await prisma.contract.findUnique({
    where: {
      id: params.id,
      professional: professionalScopeWhere(auth),
    },
    include: {
      client: true,
      professional: { include: { supervisor: { include: { supervisor: true } } } },
      appointments: { orderBy: { date: 'asc' } },
    },
  });

  if (!contract) return notFound();
  const { professional } = contract;
  const internalStaff = await prisma.internalContact.findMany();

  const technicianName = normalizeContactName(professional?.name ?? '');
  const technicianEmail = professional?.email.trim().toLowerCase();
  const isTechnician = (contact: { name: string; email: string | null }) =>
    (technicianEmail && technicianEmail === contact.email?.trim().toLowerCase()) ||
    (technicianName && technicianName === normalizeContactName(contact.name));

  const directContact = professional?.supervisor;
  // Quando o líder é o técnico fixo, sua equipe fornece o próximo contato.
  const supervisorContact =
    directContact?.supervisor &&
    normalizeContactName(directContact.role ?? '').includes('lider') &&
    isTechnician(directContact)
      ? directContact.supervisor
      : directContact;
  const supervisorRole = normalizeContactName(supervisorContact?.role ?? '');
  const linkedRole = supervisorRole.includes('supervisor')
    ? 'Supervisor'
    : supervisorRole.includes('lider')
      ? 'Técnico de Sistemas (Líder)'
      : null;

  // Match flexível de cargo (ignora plurais, acentos parciais)
  const matchRole = (staffRole: string | null, targetRole: string) => {
    if (!staffRole) return false;
    const a = staffRole.toLowerCase().trim();
    const b = targetRole.toLowerCase().trim();
    return a === b || a.startsWith(b.slice(0, -1)) || b.startsWith(a.slice(0, -1));
  };

  // O vínculo identifica quem acompanha o técnico mesmo quando o cargo é compartilhado.
  const maintenanceContacts = (
    supervisorContact && linkedRole
      ? [{ ...supervisorContact, role: linkedRole }]
      : MAINT_ROLES.flatMap((role) => {
          const matches = internalStaff.filter(
            (member) => member.name.trim() && matchRole(member.role, role),
          );
          if (matches.length > 1) return [];
          const [contact] = matches;
          return contact ? [{ ...contact, role }] : [];
        })
  ).filter((row) => row.name.trim());

  const duplicateContact = maintenanceContacts.find(
    (row) => row.role !== 'Coordenador' && isTechnician(row),
  );
  const technicianRole =
    duplicateContact?.role === 'Supervisor'
      ? 'Técnico de Sistemas e Supervisor'
      : duplicateContact
        ? 'Técnico de Sistemas e Líder de Equipe'
        : undefined;

  const escalationRoles = [
    { contact: 'Setor Comercial', role: 'Comercial Obras/Peças' },
    { contact: 'Setor Comercial', role: 'Comercial Serviços' },
    { contact: 'Manutenção Sistemas', role: 'Gerente' },
    { contact: 'Operação de Segurança', role: 'Diretor' },
  ];
  const escalationContacts = escalationRoles.flatMap((group) =>
    internalStaff
      .filter((member) => member.name.trim() && matchRole(member.role, group.role))
      .map((member) => ({ ...member, ...group })),
  );

  // Determina o ano: usa query param ?year=, senão pega o ano mais recente dos agendamentos.
  const appointmentYears = Array.from(
    new Set(contract.appointments.map((a) => new Date(a.date).getFullYear())),
  );
  const year =
    yearParam && !isNaN(yearParam)
      ? yearParam
      : appointmentYears.length > 0
        ? Math.max(...appointmentYears)
        : new Date().getFullYear();

  // Filtra appointments apenas do ano selecionado
  const filteredAppointments = contract.appointments.filter(
    (a) => new Date(a.date).getFullYear() === year,
  );
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  const getDaysInMonth = (m: number) => new Date(year, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number) => new Date(year, m, 1).getDay();

  const getAppointment = (dateStr: string) =>
    filteredAppointments.find((a) => new Date(a.date).toISOString().split('T')[0] === dateStr);

  // Feriados calculados para o ano
  const holidayKeys = new Set(getHolidaysForYear(year).map((h) => h.date));
  const isFixedHoliday = (dateStr: string) => holidayKeys.has(dateStr);

  const getCellClass = (apt: ReturnType<typeof getAppointment>, dateStr: string) => {
    if (isFixedHoliday(dateStr)) return 'bg-yellow';
    if (!apt) return '';
    if (apt.type === 'TESTE_SDAI') return 'bg-red';
    if (apt.type === 'VISITA_TECNICA') return 'bg-green';
    return 'bg-green'; // Fallback to green for any other planned visit
  };

  const parsedSystems = parseSystemTypes(contract.systemTypes);
  const systems = parsedSystems.length > 0 ? parsedSystems : ['SDAI'];

  const getRowData = (apt: ReturnType<typeof getAppointment>, defaultNum: number): RowData => {
    if (!apt) return { date: '-', obs: '-', isTeste: false };

    const obsValue = (apt.observation || '').trim();
    const isTeste = apt.type === 'TESTE_SDAI';

    let obs = obsValue || `Visita ${String(defaultNum).padStart(2, '0')}`;
    obs = obs
      .replace(/\s*\(Trimestral\)/gi, '')
      .replace(/\s*\(Mensal\)/gi, '')
      .replace(/\s*\(Semestral\)/gi, '')
      .replace(/\s*\(Anual\)/gi, '');

    const dt = new Date(apt.date).toLocaleDateString('pt-BR', {
      timeZone: 'UTC',
    });

    return { date: dt, obs, isTeste };
  };

  const totalVisitPages = Math.max(1, Math.ceil(filteredAppointments.length / VISITS_PER_PAGE));
  const [firstVisitPage, ...continuationPages] = Array.from(
    { length: totalVisitPages },
    (_, pageIndex) => {
      const offset = pageIndex * VISITS_PER_PAGE;
      const appointments = filteredAppointments.slice(offset, offset + VISITS_PER_PAGE);
      const isSingleColumn = appointments.length <= 16;
      const totalRows = isSingleColumn ? appointments.length : Math.ceil(appointments.length / 2);
      const tableRows = Array.from({ length: totalRows }, (_, i) => ({
        item1: getRowData(appointments[i], offset + i + 1),
        item2: isSingleColumn
          ? undefined
          : getRowData(appointments[i + totalRows], offset + i + totalRows + 1),
      }));
      return { offset, isSingleColumn, tableRows };
    },
  );
  const { isSingleColumn, tableRows } = firstVisitPage;

  // Mapeamentos de sistemas
  const badgeMap: Record<string, string> = {
    SDAI: 'badge-sdai',
    CFTV: 'badge-cftv',
    SCA: 'badge-sca',
    SAP: 'badge-sap',
    SAI: 'badge-sai',
    INTERFONIA: 'badge-default',
  };
  const systemNames: Record<string, string> = {
    SDAI: 'Sistema de Detecção\ne Alarme de Incêndio',
    CFTV: 'Circuito Fechado\nde TV',
    SCA: 'Sistema de\nControle de Acesso',
    SAP: 'Sistema de\nAutomação Predial',
    SAI: 'Sistema de\nAlarme de Intrusão',
    INTERFONIA: 'Sistema de\nInterfonia',
  };

  const SystemIcon = ({ skey }: { skey: string }) => {
    const iconMap: Record<string, string> = {
      SDAI: '/icons/sdai.jpg',
      SCA: '/icons/sca.jpg',
      SAP: '/icons/sap.jpg',
      CFTV: '/icons/cftv.jpg',
      SAI: '/icons/sai.jpg',
      INTERFONIA: '/icons/interfonia.png',
    };
    const iconSrc = iconMap[skey];

    if (!iconSrc) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'white',
            color: '#1a1a2e',
            border: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            letterSpacing: '0.5px',
          }}
        >
          {skey.slice(0, 3)}
        </div>
      );
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
          position: 'relative',
        }}
      >
        <Image
          src={iconSrc}
          alt={skey}
          width={48}
          height={48}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transform: skey === 'INTERFONIA' ? 'scale(0.8)' : 'scale(1.25)',
          }}
        />
      </div>
    );
  };

  return (
    <>
      <PrintTrigger />

      <div className="report-container">
        <div className="abstract-shape">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corner-shape.png" alt="" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
          <thead style={{ display: 'table-header-group' }}>
            <tr>
              <td style={{ border: 'none', padding: 0, height: '8mm' }}>
                <div className="abstract-shape thead-shape">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/corner-shape.png" alt="" />
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: 'none', padding: 0 }}>
                {/* CABEÇALHO — só aparece na página 1 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    position: 'relative',
                    zIndex: 10,
                    marginBottom: '4px',
                    paddingTop: '3mm',
                  }}
                >
                  <div style={{ width: '40%' }}></div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="CompaSSS"
                    className="report-logo"
                    style={{ height: '100px', width: 'auto' }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    position: 'relative',
                    zIndex: 10,
                    marginBottom: '4px',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'linear-gradient(to right, #c8e2f5, #d6ebfa)',
                      borderRadius: '30px',
                      padding: '3px 4px 3px 18px',
                      gap: '12px',
                    }}
                  >
                    <span
                      style={{
                        color: '#1a1a1a',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Agenda de Atendimento Técnico {year}
                    </span>
                    <div className="contract-name-badge">{contract.client.name}</div>
                  </div>
                </div>

                <h2
                  className="report-year"
                  style={{
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    margin: '0 0 5px',
                    zIndex: 10,
                    position: 'relative',
                  }}
                >
                  {year}
                </h2>

                {/* CORPO: Calendário + Tabela lateral */}
                <div style={{ display: 'flex', position: 'relative', zIndex: 10 }}>
                  {/* CALENDÁRIO */}
                  <div className="calendar-grid">
                    {months.map((m, i) => {
                      const daysInMonth = getDaysInMonth(i);
                      const firstDay = getFirstDayOfMonth(i);
                      const days = Array.from({ length: 42 }, (_, j) => {
                        const d = j - firstDay + 1;
                        return d > 0 && d <= daysInMonth ? d : null;
                      });
                      return (
                        <div key={m} className="month-card">
                          <div className="month-header">{m}</div>
                          <div className="days-header">
                            {dayNames.map((d) => (
                              <span key={d}>{d}</span>
                            ))}
                          </div>
                          <div className="days-grid">
                            {days.map((d, idx) => {
                              if (d === null)
                                return <div key={idx} className="day-cell empty"></div>;
                              const dateStr = `${year}-${String(i + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              const apt = getAppointment(dateStr);
                              const cls = getCellClass(apt, dateStr);
                              return (
                                <div key={idx} className={`day-cell ${cls}`}>
                                  {d}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* LEGENDA + SISTEMAS abaixo do calendário */}
                    <div
                      style={{
                        gridColumn: 'span 3',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        marginTop: '4px',
                      }}
                    >
                      <div>
                        <div className="legend-item">
                          <div className="legend-color bg-green"></div>VISITA TÉCNICA DE MANUTENÇÃO
                        </div>
                        <div className="legend-item">
                          <div className="legend-color bg-red"></div>TESTE GERAL DO SDAI
                        </div>
                        <div className="legend-item">
                          <div className="legend-color bg-yellow"></div>FERIADO
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div className="report-systems-label">SISTEMAS MANTIDOS</div>
                        <div className="report-systems-grid" data-system-count={systems.length}>
                          {systems.map((s) => {
                            const key = s.trim().toUpperCase();
                            const badge = badgeMap[key] ?? 'badge-default';
                            const label = systemNames[key] ?? s.trim();
                            return (
                              <div key={s} className={`badge-system ${badge}`}>
                                <div className="badge-icon">
                                  <SystemIcon skey={key} />
                                </div>
                                <span
                                  style={{
                                    whiteSpace: 'pre-line',
                                    fontSize: '0.52rem',
                                    fontWeight: 800,
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TABELA DE AGENDAMENTOS (Dinâmica: Coluna simples ou dupla) */}
                  <div
                    style={{
                      width: isSingleColumn ? '38%' : '42%',
                      marginLeft: isSingleColumn ? '8%' : '4%',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {renderVisitsTable(tableRows, isSingleColumn)}
                  </div>
                </div>

                {/* RODAPÉ: Lista de Contatos completa (2 seções) */}
                <ReportContactTables
                  maintenance={maintenanceContacts.filter((row) => row !== duplicateContact)}
                  escalation={escalationContacts}
                  professional={
                    professional && {
                      ...professional,
                      phone: professional.phone || duplicateContact?.phone,
                    }
                  }
                  technicianRole={technicianRole}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {continuationPages.map((page) => (
        <section key={page.offset} className="report-container report-visits-continuation">
          <h2>Continuação das visitas</h2>
          <p>
            {contract.client.name} · {year}
          </p>
          {renderVisitsTable(page.tableRows, page.isSingleColumn)}
        </section>
      ))}
    </>
  );
}
