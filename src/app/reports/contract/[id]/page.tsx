import Image from 'next/image';
import { notFound } from 'next/navigation';

import PrintTrigger from '@/components/reports/PrintTrigger';
import ReportContactTables from '@/components/reports/ReportContactTables';
import prisma from '@/lib/prisma';

import './print.css';

interface ReportContact {
  action?: string;
  contact?: string;
  role: string;
  name: string;
  phone: string;
  email: string;
}

interface ContactsData {
  maintenance: ReportContact[];
  escalation: ReportContact[];
}

interface RowData {
  date: string;
  obs: string;
  isTeste: boolean;
}

interface TableRow {
  item1: RowData;
  item2?: RowData;
}

export default async function ContractReportPage({ params }: { params: { id: string } }) {
  // Busca o contrato com ORM padrão
  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      professional: true,
      appointments: { orderBy: { date: 'asc' } },
    },
  });

  if (!contract) return notFound();
  const [internalStaff, dbHolidays] = await Promise.all([
    prisma.internalContact.findMany(),
    prisma.holiday.findMany({
      select: { date: true, name: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  const savedJson = contract.contactsJson ?? null;

  // Contatos editáveis salvos (ou valores padrão)
  const defaultContactsData = {
    maintenance: [
      { action: '2° Contato', role: 'Técnico de Sistemas (Líder)', name: '', phone: '', email: '' },
      { action: '3° Contato', role: 'Supervisor', name: '', phone: '', email: '' },
      { action: '4° Contato', role: 'Coordenador', name: '', phone: '', email: '' },
    ],
    escalation: [
      { contact: 'Setor Comercial', role: 'Comercial Obras/Peças', name: '', phone: '', email: '' },
      { contact: '', role: 'Comercial Serviços', name: '', phone: '', email: '' },
      { contact: 'Manutenção Sistemas', role: 'Gerente', name: '', phone: '', email: '' },
      { contact: 'Operação de Segurança', role: 'Diretor', name: '', phone: '', email: '' },
    ],
  };

  // Se JÁ EXISTE dado salvo, usamos ele exatamente como está (respeita exclusões manuais do Breno)
  // Se NÃO EXISTE dado salvo, usamos os padrões com preenchimento automático inicial
  // Se JÁ EXISTE dado salvo, usamos ele EXATAMENTE como está.
  // Se o Breno apagou o Gabriel, o banco tem "" e nós mostramos "-".
  let parsedJson: ContactsData | null = null;
  if (savedJson) {
    try {
      parsedJson = JSON.parse(savedJson);
    } catch {
      /* JSON corrompido, usa padrão */
    }
  }

  const contactsData = parsedJson
    ? {
        maintenance: parsedJson.maintenance || [],
        escalation: parsedJson.escalation || [],
      }
    : {
        // A inteligência de preenchimento automático SÓ acontece se o contrato NUNCA foi salvo.
        maintenance: (defaultContactsData.maintenance || []).map((row: ReportContact) => {
          if (!row.name && row.role) {
            const match = internalStaff.find(
              (s) => s.role?.toLowerCase() === row.role.toLowerCase(),
            );
            if (match) return { ...row, name: match.name, phone: match.phone, email: match.email };
          }
          return row;
        }),
        escalation: (defaultContactsData.escalation || []).map((row: ReportContact) => {
          if (!row.name && row.role) {
            const match = internalStaff.find(
              (s) => s.role?.toLowerCase() === row.role.toLowerCase(),
            );
            if (match) return { ...row, name: match.name, phone: match.phone, email: match.email };
          }
          return row;
        }),
      };

  // Determina o ano pelo ano mais comum nos agendamentos do contrato.
  // Fallback para o ano corrente se não houver agendamentos.
  const appointmentYears = contract.appointments.map((a) => new Date(a.date).getFullYear());
  const yearCounts = appointmentYears.reduce(
    (acc: Record<number, number>, y: number) => {
      acc[y] = (acc[y] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );
  const year = Object.entries(yearCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    ? Number(Object.entries(yearCounts).sort((a, b) => b[1] - a[1])[0][0])
    : new Date().getFullYear();
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
    contract.appointments.find((a) => new Date(a.date).toISOString().split('T')[0] === dateStr);

  // Feriados vêm inteiramente do banco de dados (tabela Holiday).
  const dbHolidayKeys = new Set(
    dbHolidays.map((h) => new Date(h.date).toISOString().split('T')[0]),
  );

  const isFixedHoliday = (dateStr: string) => dbHolidayKeys.has(dateStr);

  const getCellClass = (apt: ReturnType<typeof getAppointment>, dateStr: string) => {
    if (isFixedHoliday(dateStr)) return 'bg-yellow';
    if (!apt) return '';
    if (apt.type === 'TESTE_SDAI') return 'bg-red';
    if (apt.type === 'VISITA_TECNICA') return 'bg-green';
    return 'bg-green'; // Fallback to green for any other planned visit
  };

  const systems = contract.systemTypes ? contract.systemTypes.split(',') : ['SDAI'];

  // Decide entre layout de coluna única ou dupla
  const isSingleColumn = contract.appointments.length <= 16;
  const totalRows = isSingleColumn
    ? Math.max(5, contract.appointments.length)
    : Math.min(54, Math.max(5, Math.ceil(contract.appointments.length / 2)));

  const tableRows: TableRow[] = [];
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

  for (let i = 0; i < totalRows; i++) {
    if (isSingleColumn) {
      tableRows.push({ item1: getRowData(contract.appointments[i], i + 1) });
    } else {
      tableRows.push({
        item1: getRowData(contract.appointments[i], i + 1),
        item2: getRowData(contract.appointments[i + totalRows], i + 1 + totalRows),
      });
    }
  }

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

  // Ícones SVG profissionais — fiéis às imagens de referência do usuário
  const SystemIcon = ({ skey }: { skey: string }) => {
    // Definindo os caminhos das imagens JPEG oficiais
    // Mapeamento definitivo e escala de 1.25 para preenchimento total (cover)
    const iconMap: Record<string, string> = {
      SDAI: '/icons/sdai.jpg',
      SCA: '/icons/sca.jpg',
      SAP: '/icons/sap.jpg',
      CFTV: '/icons/cftv.jpg',
      SAI: '/icons/sai.jpg',
      INTERFONIA: '/icons/interfonia.jpg',
    };

    const iconSrc = iconMap[skey] || '/icons/default.jpg';

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
            transform: 'scale(1.25)',
          }}
        />
      </div>
    );
  };

  return (
    <>
      <PrintTrigger />

      <div className="report-container">
        <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
          <thead style={{ display: 'table-header-group' }}>
            <tr>
              <td
                style={{
                  border: 'none',
                  padding: '10mm 0 0',
                  position: 'relative',
                }}
              >
                <div className="abstract-shape"></div>

                {/* CABEÇALHO */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    position: 'relative',
                    zIndex: 10,
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ width: '40%' }}></div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px',
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: '2rem',
                        fontWeight: 900,
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        letterSpacing: '-1.5px',
                      }}
                    >
                      <span>C</span>
                      <svg width="32" height="32" viewBox="0 0 100 100" style={{ margin: '0 2px' }}>
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="#10b981"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="26"
                          stroke="#10b981"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle cx="50" cy="8" r="4.5" fill="#10b981" />
                        <circle cx="50" cy="92" r="4.5" fill="#10b981" />
                        <circle cx="8" cy="50" r="4.5" fill="#10b981" />
                        <circle cx="92" cy="50" r="4.5" fill="#10b981" />
                        <path
                          d="M50 20 L55 38 L72 35 L60 48 L70 65 L50 55 L30 65 L40 48 L28 35 L45 38 Z"
                          fill="#10b981"
                        />
                      </svg>
                      <span>mpaSSS</span>
                    </h1>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div
                        style={{
                          background: '#bae6fd',
                          color: '#0369a1',
                          padding: '4px 12px',
                          borderRadius: '15px',
                          fontSize: '0.55rem',
                          fontWeight: 800,
                        }}
                      >
                        Agenda de Atendimento Técnico {year}
                      </div>
                      <div
                        style={{
                          background: 'black',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '15px',
                          fontSize: '0.55rem',
                          fontWeight: 800,
                        }}
                      >
                        {contract.client.name}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Espaço a mais para o thead cobrir a altura total da forma verde absoluta */}
                <div style={{ height: '35px' }}></div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: 'none', padding: 0 }}>
                <h2
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
                        <div
                          style={{
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)',
                            background: 'black',
                            color: 'white',
                            fontWeight: 900,
                            fontSize: '0.45rem',
                            padding: '4px',
                            textAlign: 'center',
                            borderRadius: '2px',
                          }}
                        >
                          SISTEMAS MANTIDOS
                        </div>
                        {/* Grade dos badges: 2 colunas */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '4px',
                            flex: 1,
                          }}
                        >
                          {(systems.length > 0 ? systems : ['SDAI']).map((s: string) => {
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
                        {tableRows.map((row, idx) => {
                          const isT1 = row.item1.isTeste;
                          const isT2 = row.item2?.isTeste;

                          return (
                            <tr key={idx}>
                              <td>
                                {isT1 ? (
                                  <span style={{ color: '#ef4444' }}>{row.item1.date}</span>
                                ) : (
                                  row.item1.date
                                )}
                              </td>
                              <td>
                                {isT1 ? (
                                  <span style={{ color: '#ef4444' }}>{row.item1.obs}</span>
                                ) : (
                                  row.item1.obs
                                )}
                              </td>
                              {!isSingleColumn && (
                                <>
                                  <td>
                                    {isT2 ? (
                                      <span style={{ color: '#ef4444' }}>
                                        {row.item2?.date || '-'}
                                      </span>
                                    ) : (
                                      row.item2?.date || '-'
                                    )}
                                  </td>
                                  <td>
                                    {isT2 ? (
                                      <span style={{ color: '#ef4444' }}>
                                        {row.item2?.obs || '-'}
                                      </span>
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
                  </div>
                </div>

                {/* RODAPÉ: Lista de Contatos completa (2 seções) */}
                <ReportContactTables
                  maintenance={contactsData.maintenance}
                  escalation={contactsData.escalation}
                  professional={contract.professional}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
