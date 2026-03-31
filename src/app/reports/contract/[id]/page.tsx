import prisma from "@/lib/prisma";
import PrintTrigger from "./PrintTrigger";
import { notFound } from "next/navigation";
import "./print.css";

export default async function ContractReportPage({
  params,
}: {
  params: { id: string };
}) {
  // Busca o contrato com ORM padrão
  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      professional: true,
      appointments: { orderBy: { date: "asc" } },
    },
  });

  if (!contract) return notFound();
  
  const savedJson = contract.contactsJson ?? null;

  // Contatos editáveis salvos (ou valores padrão)
  const defaultContactsData = {
    maintenance: [
      {
        action: "2° Contato",
        role: "Técnico de Sistemas Líder",
        name: "",
        phone: "",
        email: "",
      },
      { action: "", role: "Supervisor", name: "", phone: "", email: "" },
      {
        action: "3° Contato",
        role: "Coordenador",
        name: "",
        phone: "",
        email: "",
      },
    ],
    escalation: [
      {
        contact: "Setor Comercial",
        role: "Comercial Obras/Peças",
        name: "",
        phone: "",
        email: "",
      },
      {
        contact: "",
        role: "Comercial Serviços",
        name: "",
        phone: "",
        email: "",
      },
      {
        contact: "Manutenção Sistemas",
        role: "Gerente",
        name: "",
        phone: "",
        email: "",
      },
      {
        contact: "Operação de Segurança",
        role: "Diretor",
        name: "",
        phone: "",
        email: "",
      },
      { contact: "", role: "", name: "", phone: "", email: "" },
    ],
  };
  const contactsData = savedJson ? JSON.parse(savedJson) : defaultContactsData;

  const year = 2026;
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  const getDaysInMonth = (m: number) => new Date(year, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number) => new Date(year, m, 1).getDay();

  const getAppointment = (dateStr: string) =>
    contract.appointments.find(
      (a: any) => new Date(a.date).toISOString().split("T")[0] === dateStr,
    );

  const isFixedHoliday = (dateStr: string) =>
    [
      "01-01",
      "02-16",
      "02-17",
      "04-03",
      "04-21",
      "05-01",
      "06-04",
      "09-07",
      "10-12",
      "11-02",
      "11-15",
      "12-25",
    ].includes(dateStr.substring(5));

  const getCellClass = (
    _dateStr: string,
    apt: ReturnType<typeof getAppointment>,
    dateStr: string,
  ) => {
    if (isFixedHoliday(dateStr)) return "bg-yellow";
    if (!apt) return "";
    if (apt.type === "TESTE_SDAI") return "bg-red";
    if (apt.type === "VISITA_TECNICA") return "bg-green";
    return "bg-green"; // Fallback to green for any other planned visit
  };

  const systems = contract.systemTypes
    ? contract.systemTypes.split(",")
    : ["SDAI"];

  // Decide entre layout de coluna única ou dupla
  const isSingleColumn = contract.appointments.length <= 16;
  const totalRows = isSingleColumn
    ? Math.max(5, contract.appointments.length)
    : Math.min(54, Math.max(5, Math.ceil(contract.appointments.length / 2)));

  const tableRows = [];
  const getRowData = (apt: any, defaultNum: number) => {
    if (!apt) return { date: "-", obs: "-", cls: "text-black" };
    const cls = apt.type === "TESTE_SDAI" ? "text-red" : "text-black";
    let obs =
      apt.observation || `Visita ${String(defaultNum).padStart(2, "0")}`;
    obs = obs
      .replace(/\s*\(Trimestral\)/gi, "")
      .replace(/\s*\(Mensal\)/gi, "")
      .replace(/\s*\(Semestral\)/gi, "")
      .replace(/\s*\(Anual\)/gi, "");
    const dt = new Date(apt.date).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
    });
    return { date: dt, obs, cls };
  };

  for (let i = 0; i < totalRows; i++) {
    if (isSingleColumn) {
      tableRows.push({ item1: getRowData(contract.appointments[i], i + 1) });
    } else {
      tableRows.push({
        item1: getRowData(contract.appointments[i], i + 1),
        item2: getRowData(
          contract.appointments[i + totalRows],
          i + 1 + totalRows,
        ),
      });
    }
  }

  // Mapeamentos de sistemas
  const badgeMap: Record<string, string> = {
    SDAI: "badge-sdai",
    CFTV: "badge-cftv",
    SCA: "badge-sca",
    SAP: "badge-sap",
    SAI: "badge-sai",
    INTERFONIA: "badge-default",
  };
  const iconColors: Record<string, string> = {
    SDAI: "#dc2626",
    CFTV: "#10b981",
    SCA: "#9333ea",
    SAP: "#3b82f6",
    SAI: "#d97706",
    INTERFONIA: "#475569",
  };
  const systemNames: Record<string, string> = {
    SDAI: "Sistema de Detecção\ne Alarme de Incêndio",
    CFTV: "Circuito Fechado\nde TV",
    SCA: "Sistema de\nControle de Acesso",
    SAP: "Sistema de\nAutomação Predial",
    SAI: "Sistema de\nAlarme de Intrusão",
    INTERFONIA: "Sistema de\nInterfonia",
  };

  // Ícones SVG profissionais — fiéis às imagens de referência do usuário
  const SystemIcon = ({ skey, color }: { skey: string; color: string }) => {
    // CFTV: câmera de segurança em suporte de parede (câmera trapezoidal apontando para direita, com bracket em L)
    if (skey === "CFTV")
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill={color}>
          <path d="M2 8.5C2 7.67 2.67 7 3.5 7H4V6C4 5.45 4.45 5 5 5s1 .45 1 1v1h7l3 3-3 3H6v1c0 .55-.45 1-1 1s-1-.45-1-1v-1h-.5C2.67 14 2 13.33 2 12.5v-4zm15-.5l3 1.5v2L17 13V8z" />
          <path
            d="M5 16v3H4v-3H3v-1h3v1H5zm1-8v4h5.5l2-2-2-2H6z"
            opacity="0.4"
          />
        </svg>
      );

    // SCA: mão segurando cartão de acesso (estilo outline arrumado)
    if (skey === "SCA")
      return (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Cartão */}
          <rect x="3" y="4" width="14" height="9" rx="1.5" />
          <line x1="3" y1="7.5" x2="17" y2="7.5" />
          <line x1="5" y1="10" x2="8" y2="10" strokeWidth="1.5" />
          {/* Mão */}
          <path
            d="M7 15c0 0-2 .5-2 3l1.5 4h9l1.5-4c0-2.5-2-3-2-3l-2 1.5H9L7 15z"
            fill={color}
            stroke="none"
          />
          <path
            d="M9 15v-2.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V15"
            strokeWidth="1.5"
          />
        </svg>
      );

    // SDAI: chama de fogo sólida e bem-proporcionada
    if (skey === "SDAI")
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill={color}>
          <path d="M12.09 2.91C9 6 9.2 9 10.07 11.1c.43 1.06-.33 2.2-1.51 2.15C7.47 13.2 6.5 12 6.5 12c-.53 5.5 2.5 9 5.5 9 3.31 0 6-2.69 6-6 0-3.5-2.83-7.21-5.91-12.09z" />
          <path
            d="M12 19c-1.66 0-3-1.34-3-3 0-1.71 1.29-2.78 2-4 .71 1.22 2 2.28 2 4 0 1.66-1.34 3-3 3"
            fill="white"
            opacity="0.25"
          />
        </svg>
      );

    // SAP: duas engrenagens interligadas (Material Design style)
    if (skey === "SAP")
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill={color}>
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98 0 .33.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-7.43 2.52c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        </svg>
      );

    // SAI: cerca/grade de segurança com pontas (estilo outline clean)
    if (skey === "SAI")
      return (
        <svg viewBox="0 0 24 24" width="22" height="22">
          {/* Barras verticais com pontas */}
          {[4, 8, 12, 16, 20].map((x, i) => (
            <g key={i}>
              <rect
                x={x - 1}
                y="8"
                width="2"
                height="14"
                rx="0.5"
                fill={color}
              />
              <polygon
                points={`${x},3 ${x - 1.5},7 ${x + 1.5},7`}
                fill={color}
              />
            </g>
          ))}
          {/* Barras horizontais */}
          <rect x="3" y="11" width="18" height="2" rx="0.5" fill={color} />
          <rect x="3" y="17" width="18" height="2" rx="0.5" fill={color} />
        </svg>
      );

    // INTERFONIA: Ícone de telefone/interfone
    if (skey === "INTERFONIA")
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill={color}>
          <path d="M6.62 10.79c1.44 2.82 3.76 5.14 6.58 6.58l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.46.57 3.58.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
      );

    // Default
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill={color}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    );
  };

  return (
    <>
      <PrintTrigger />

      <div className="report-container">
        <table
          style={{ width: "100%", borderCollapse: "collapse", border: "none" }}
        >
          <thead style={{ display: "table-header-group" }}>
            <tr>
              <td
                style={{
                  border: "none",
                  padding: "10mm 0 0",
                  position: "relative",
                }}
              >
                <div className="abstract-shape"></div>

                {/* CABEÇALHO */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    position: "relative",
                    zIndex: 10,
                    marginBottom: "20px",
                  }}
                >
                  <div style={{ width: "40%" }}></div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "8px",
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: "2rem",
                        fontWeight: 900,
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        letterSpacing: "-1.5px",
                      }}
                    >
                      <span>C</span>
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 100 100"
                        style={{ margin: "0 2px" }}
                      >
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
                    <div style={{ display: "flex", gap: "6px" }}>
                      <div
                        style={{
                          background: "#bae6fd",
                          color: "#0369a1",
                          padding: "4px 12px",
                          borderRadius: "15px",
                          fontSize: "0.55rem",
                          fontWeight: 800,
                        }}
                      >
                        Agenda de Atendimento Técnico {year}
                      </div>
                      <div
                        style={{
                          background: "black",
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: "15px",
                          fontSize: "0.55rem",
                          fontWeight: 800,
                        }}
                      >
                        {contract.client.name}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Espaço a mais para o thead cobrir a altura total da forma verde absoluta */}
                <div style={{ height: "35px" }}></div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "none", padding: 0 }}>
                <h2
                  style={{
                    textAlign: "center",
                    fontSize: "1.4rem",
                    margin: "0 0 5px",
                    zIndex: 10,
                    position: "relative",
                  }}
                >
                  {year}
                </h2>

                {/* CORPO: Calendário + Tabela lateral */}
                <div
                  style={{ display: "flex", position: "relative", zIndex: 10 }}
                >
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
                                return (
                                  <div
                                    key={idx}
                                    className="day-cell empty"
                                  ></div>
                                );
                              const dateStr = `${year}-${String(i + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                              const apt = getAppointment(dateStr);
                              const cls = getCellClass("", apt, dateStr);
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
                        gridColumn: "span 3",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginTop: "4px",
                      }}
                    >
                      <div>
                        <div className="legend-item">
                          <div className="legend-color bg-green"></div>VISITA
                          TÉCNICA DE MANUTENÇÃO
                        </div>
                        <div className="legend-item">
                          <div className="legend-color bg-red"></div>TESTE GERAL
                          DO SDAI
                        </div>
                        <div className="legend-item">
                          <div className="legend-color bg-yellow"></div>FERIADO
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <div
                          style={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            background: "black",
                            color: "white",
                            fontWeight: 900,
                            fontSize: "0.45rem",
                            padding: "4px",
                            textAlign: "center",
                            borderRadius: "2px",
                          }}
                        >
                          SISTEMAS MANTIDOS
                        </div>
                        {/* Grade dos badges: 2 colunas */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "4px",
                            flex: 1,
                          }}
                        >
                          {(systems.length > 0 ? systems : ["SDAI"]).map(
                            (s: string) => {
                              const key = s.trim().toUpperCase();
                              const badge = badgeMap[key] ?? "badge-default";
                              const color = iconColors[key] ?? "#6b7280";
                              const label = systemNames[key] ?? s.trim();
                              return (
                                <div
                                  key={s}
                                  className={`badge-system ${badge}`}
                                >
                                  <div className="badge-icon">
                                    <SystemIcon skey={key} color={color} />
                                  </div>
                                  <span
                                    style={{
                                      whiteSpace: "pre-line",
                                      fontSize: "0.52rem",
                                      fontWeight: 800,
                                      lineHeight: 1.25,
                                    }}
                                  >
                                    {label}
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TABELA DE AGENDAMENTOS (Dinâmica: Coluna simples ou dupla) */}
                  <div
                    style={{
                      width: isSingleColumn ? "38%" : "42%",
                      marginLeft: isSingleColumn ? "8%" : "4%",
                      alignSelf: "flex-start",
                    }}
                  >
                    <table className="visits-table">
                      <thead>
                        <tr>
                          <th style={{ width: isSingleColumn ? "40%" : "20%" }}>
                            Data
                          </th>
                          <th style={{ width: isSingleColumn ? "60%" : "30%" }}>
                            Observação
                          </th>
                          {!isSingleColumn && (
                            <>
                              <th style={{ width: "20%" }}>Data</th>
                              <th style={{ width: "30%" }}>Observação</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row: any, idx) => (
                          <tr key={idx}>
                            <td>{row.item1.date}</td>
                            <td className={row.item1.cls}>{row.item1.obs}</td>
                            {!isSingleColumn && (
                              <>
                                <td>{row.item2?.date || "-"}</td>
                                <td className={row.item2?.cls || "text-black"}>
                                  {row.item2?.obs || "-"}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RODAPÉ: Lista de Contatos completa (2 seções) */}
                <div
                  style={{
                    position: "relative",
                    zIndex: 10,
                    pageBreakInside: "avoid",
                    breakInside: "avoid",
                  }}
                >
                  <div style={{ height: "30px" }}></div>

                  {/* Seção 1: Manutenção de Sistemas */}
                  <table
                    className="contact-table"
                    style={{ marginBottom: "4px" }}
                  >
                    <thead>
                      <tr style={{ background: "#14532d", color: "white" }}>
                        <th
                          colSpan={6}
                          style={{ textAlign: "center", letterSpacing: "1px" }}
                        >
                          LISTA DE CONTATOS
                        </th>
                      </tr>
                      <tr
                        style={{
                          background: "#0f172a",
                          color: "white",
                          fontSize: "0.48rem",
                        }}
                      >
                        <th style={{ width: "13%" }}>Ação</th>
                        <th style={{ width: "12%" }}>Empresa</th>
                        <th style={{ width: "22%" }}>Função</th>
                        <th style={{ width: "18%" }}>Nome</th>
                        <th style={{ width: "14%" }}>Telef. 01</th>
                        <th style={{ width: "21%" }}>E-mail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 1° Contato — Técnico do contrato (somente leitura) */}
                      <tr>
                        <td
                          style={{
                            fontWeight: 800,
                            color: "#000",
                            background: "#f0fdf4",
                          }}
                        >
                          1° Contato
                        </td>
                        <td
                          rowSpan={contactsData.maintenance.length + 1}
                          style={{
                            fontWeight: 800,
                            verticalAlign: "middle",
                            background: "white",
                          }}
                        >
                          CompaSSS
                        </td>
                        <td>Técnico de Sistemas (Fixo)</td>
                        <td style={{ fontWeight: 800 }}>
                          {contract.professional?.name || "-"}
                        </td>
                        <td>{contract.professional?.phone || "-"}</td>
                        <td style={{ fontSize: "0.45rem" }}>
                          {contract.professional?.email || "-"}
                        </td>
                      </tr>
                      {/* Demais contatos de manutenção editáveis */}
                      {contactsData.maintenance.map((row: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 800 }}>
                            {idx + 2}° Contato
                          </td>
                          <td>{row.role}</td>
                          <td style={{ fontWeight: 800 }}>{row.name || "-"}</td>
                          <td>{row.phone || "-"}</td>
                          <td style={{ fontSize: "0.45rem" }}>
                            {row.email || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Seção 2: Escalonamento e Contatos-Chave */}
                  <table className="contact-table">
                    <thead>
                      <tr style={{ background: "#064e3b", color: "white" }}>
                        <th
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            letterSpacing: "1px",
                            fontSize: "0.48rem",
                          }}
                        >
                          ESCALONAMENTO DE OCORRÊNCIAS E CONTATOS-CHAVE
                        </th>
                      </tr>
                      <tr
                        style={{
                          background: "#0f172a",
                          color: "white",
                          fontSize: "0.48rem",
                        }}
                      >
                        <th style={{ width: "18%" }}>Contato</th>
                        <th style={{ width: "12%" }}>Empresa</th>
                        <th style={{ width: "18%" }}>Função</th>
                        <th style={{ width: "18%" }}>Nome</th>
                        <th style={{ width: "14%" }}>Telef. 01</th>
                        <th style={{ width: "20%" }}>E-mail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactsData.escalation.map((row: any, idx: number) => {
                        const prevContact =
                          idx > 0
                            ? contactsData.escalation[idx - 1].contact
                            : null;
                        let rSpan = 1;
                        if (row.contact !== prevContact) {
                          for (
                            let i = idx + 1;
                            i < contactsData.escalation.length;
                            i++
                          ) {
                            if (
                              contactsData.escalation[i].contact ===
                                row.contact &&
                              row.contact
                            )
                              rSpan++;
                            else break;
                          }
                        }

                        return (
                          <tr key={idx}>
                            {row.contact !== prevContact && (
                              <td
                                rowSpan={rSpan}
                                style={{
                                  fontWeight: 800,
                                  verticalAlign: "middle",
                                }}
                              >
                                {row.contact}
                              </td>
                            )}
                            {idx === 0 && (
                              <td
                                rowSpan={contactsData.escalation.length}
                                style={{
                                  fontWeight: 800,
                                  verticalAlign: "middle",
                                  background: "white",
                                }}
                              >
                                CompaSSS
                              </td>
                            )}
                            <td>{row.role}</td>
                            <td style={{ fontWeight: 800 }}>
                              {row.name || "-"}
                            </td>
                            <td>{row.phone || "-"}</td>
                            <td style={{ fontSize: "0.45rem" }}>
                              {row.email || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
