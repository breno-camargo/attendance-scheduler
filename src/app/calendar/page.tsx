"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedApt, setSelectedApt] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [filterContractId, setFilterContractId] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [manualClientId, setManualClientId] = useState("");
  const [manualType, setManualType] = useState("TESTE_SDAI");
  const [clients, setClients] = useState<any[]>([]);
  const year = 2026;

  // Only show clients that appear in the current professional's appointments
  const linkedClients = clients.filter((c) =>
    appointments.some((a) => a.contractId === c.contracts?.[0]?.id),
  );

  const getAptColor = (type: string, contractId?: string) => {
    if (filterContractId && contractId !== filterContractId)
      return "rgba(255,255,255,0.02)";
    if (type === "TESTE_SDAI") return "var(--primary)";
    return "rgba(16, 185, 129, 0.4)";
  };

  // useEffect com Array Vazia []: Dispara APENAS 1 vez, logo que a página Calendário renderiza na tela (Montagem).
  useEffect(() => {
    fetch("/api/professionals")
      .then((r) => r.json())
      .then((data) => {
        const profs = Array.isArray(data) ? data : [];
        setProfessionals(profs);
        // UX Boost: Auto-seleciona o primeiro técnico da lista para não deixar o campo vazio de imediato.
        if (profs.length > 0) setProfessionalId(profs[0].id);
      });
  }, []);

  const fetchAppointments = async () => {
    if (!professionalId) return;
    try {
      const res = await fetch(
        `/api/schedule/generate?professionalId=${professionalId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
        if (data.length > 0) setManualClientId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // useEffect de Reação (React-ividade):
  // O array `[professionalId]` avisa ao React:
  // "Sempre que o usuário escolher um técnico diferente, recarregue as visitas daquele novo técnico".
  useEffect(() => {
    fetchAppointments();
    fetchClients();
  }, [professionalId]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = isManualModalOpen || !!selectedApt;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isManualModalOpen, selectedApt]);

  const generateAppointments = async () => {
    setLoading(true);
    await fetch("/api/schedule/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professionalId, year }),
    });
    await fetchAppointments();
    setLoading(false);
  };

  const handleDeleteApt = async () => {
    if (!selectedApt) return;
    const res = await fetch(`/api/schedule/${selectedApt.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      fetchAppointments();
      setSelectedApt(null);
    }
  };

  const handleToggleType = async () => {
    if (!selectedApt) return;
    const newType =
      selectedApt.type === "VISITA_TECNICA" ? "TESTE_SDAI" : "VISITA_TECNICA";
    const res = await fetch(`/api/schedule/${selectedApt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType }),
    });
    if (res.ok) {
      fetchAppointments();
      setSelectedApt(null);
    }
  };

  const handleUpdateDate = async () => {
    if (!selectedApt || !newDate) return;
    const res = await fetch(`/api/schedule/${selectedApt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate }),
    });
    if (res.ok) {
      fetchAppointments();
      setSelectedApt(null);
      setNewDate("");
    } else {
      alert("Erro ao mudar data. Verifique o formato.");
    }
  };

  const handleDayClick = (dateStr: string) => {
    const apt = getAppointment(dateStr);
    if (apt) {
      setSelectedApt(apt);
      setNewDate(dateStr);
    } else {
      setManualDate(dateStr);
      setIsManualModalOpen(true);
    }
  };

  const handleManualSave = async () => {
    if (!manualClientId || !manualDate) return;

    const client = clients.find((c) => c.id === manualClientId);
    const contractId = client?.contracts?.[0]?.id;

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: manualClientId,
          professionalId,
          contractId,
          date: manualDate,
          type: manualType,
          observation:
            manualType === "TESTE_SDAI"
              ? "Teste Geral SDAI (Manual)"
              : "Visita Extra (Manual)",
        }),
      });
      if (res.ok) {
        setIsManualModalOpen(false);
        fetchAppointments();
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  const getDaysInMonth = (m: number) => new Date(year, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number) => new Date(year, m, 1).getDay();

  /**
   * Array.find(): Bússola do Javascript para Arrays.
   * Percorre todo o array de "appointments" (Agendamentos) e retorna
   * O PRIMEIRO item que bater com a data. Caso não ache, devolve "undefined", deixando o dia livre.
   */
  const getAppointment = (dateStr: string) => {
    return appointments.find((a) => {
      const isDateMatch =
        new Date(a.date).toISOString().split("T")[0] === dateStr;
      if (!isDateMatch) return false;
      // Operador Lógico && (AND): Se tiver filtro ativo, valida também o Cliente.
      if (filterContractId && a.contractId !== filterContractId) return false;
      return true;
    });
  };

  const getColor = (apt: any, dateStr: string) => {
    if (!apt) {
      const fixedHolidays = [
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
      ];
      if (fixedHolidays.includes(dateStr.substring(5))) return "#eab308"; // Amarelo
      return "rgba(255,255,255,0.02)";
    }
    if (apt.type === "TESTE_SDAI") return "#ea580c"; // Vermelho
    if (apt.type === "VISITA_TECNICA") return "#22c55e"; // Verde
    return "";
  };

  return (
    <main
      style={{
        padding: "4rem 2rem",
        maxWidth: "1400px",
        margin: "0 auto",
        display: "flex",
        gap: "2rem",
        flexWrap: "wrap",
        position: "relative",
      }}
    >
      {isManualModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.95)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              className="glass-panel animate-fade-in"
              style={{
                width: "100%",
                maxWidth: "450px",
                padding: "2.5rem",
                border: "1px solid var(--primary)",
              }}
            >
              <h3
                style={{
                  marginBottom: "0.8rem",
                  fontSize: "1.5rem",
                  fontWeight: "800",
                }}
              >
                Novo Agendamento Individual
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  marginBottom: "2rem",
                }}
              >
                Data Alvo:{" "}
                <strong style={{ fontWeight: "700" }}>
                  {manualDate?.split("-").reverse().join("/")}
                </strong>
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Prédio / Cliente
                  </label>
                  <select
                    value={manualClientId}
                    onChange={(e) => setManualClientId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--input-bg)",
                      color: "var(--foreground)",
                      marginTop: "0.5rem",
                      transition: "var(--transition-fast)",
                    }}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Natureza do Serviço
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "0.5rem",
                    }}
                  >
                    <button
                      onClick={() => setManualType("VISITA_TECNICA")}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background:
                          manualType === "VISITA_TECNICA"
                            ? "var(--primary)"
                            : "var(--input-bg)",
                        color:
                          manualType === "VISITA_TECNICA"
                            ? "#000"
                            : "var(--foreground)",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "var(--transition-fast)",
                      }}
                    >
                      Visita Técnica
                    </button>
                    <button
                      onClick={() => setManualType("TESTE_SDAI")}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background:
                          manualType === "TESTE_SDAI"
                            ? "var(--primary)"
                            : "var(--input-bg)",
                        color:
                          manualType === "TESTE_SDAI"
                            ? "#000"
                            : "var(--foreground)",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "var(--transition-fast)",
                      }}
                    >
                      Teste SDAI
                    </button>
                  </div>
                </div>

                <div
                  style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}
                >
                  <button
                    onClick={handleManualSave}
                    className="btn-primary"
                    style={{ flex: 1 }}
                  >
                    Agendar Confirmado
                  </button>
                  <button
                    onClick={() => setIsManualModalOpen(false)}
                    className="btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedApt &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="glass-panel animate-fade-in"
              style={{
                padding: "2.5rem",
                maxWidth: "400px",
                width: "90%",
                border: "1px solid var(--primary)",
              }}
            >
              <h2 style={{ marginBottom: "1rem", fontSize: "1.6rem" }}>
                Gerenciar Visita
              </h2>
              <p
                style={{
                  marginBottom: "2rem",
                  color: "var(--text-muted)",
                  lineHeight: "1.6",
                }}
              >
                <strong style={{ color: "var(--primary)", fontSize: "1.2rem" }}>
                  {selectedApt.client?.name}
                </strong>
                <br />
                <span style={{ fontSize: "0.9rem" }}>
                  📅 Data Alocada:{" "}
                  {new Date(selectedApt.date).toLocaleDateString("pt-BR")}
                </span>
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <button
                  onClick={handleToggleType}
                  className="btn-secondary"
                  style={{
                    background: "var(--input-bg)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                    width: "100%",
                  }}
                >
                  🔄 Mudar para{" "}
                  {selectedApt.type === "VISITA_TECNICA"
                    ? "Teste SDAI"
                    : "Visita Comum"}
                </button>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.8rem",
                    marginTop: "0.5rem",
                    border: "1px solid var(--border)",
                    padding: "1.2rem",
                    borderRadius: "12px",
                    background: "var(--input-bg)",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      fontWeight: "bold",
                    }}
                  >
                    Re-agendar para:
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.8rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--input-bg)",
                      color: "var(--foreground)",
                      transition: "var(--transition-fast)",
                    }}
                  />
                  <button
                    onClick={handleUpdateDate}
                    className="btn-primary"
                    style={{
                      fontSize: "0.85rem",
                      padding: "0.8rem",
                      width: "100%",
                    }}
                    disabled={!newDate}
                  >
                    🚀 Mover Visita
                  </button>
                </div>

                <button
                  onClick={handleDeleteApt}
                  className="btn-secondary"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "#ef4444",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    marginTop: "0.5rem",
                  }}
                >
                  🗑️ Excluir Visita
                </button>
                <button
                  onClick={() => {
                    setSelectedApt(null);
                    setNewDate("");
                  }}
                  className="btn-secondary"
                  style={{ marginTop: "0.5rem", width: "100%" }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div style={{ flex: "1 1 800px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "2rem",
          }}
        >
          <div>
            <h1 className="title" style={{ marginBottom: "0.5rem" }}>
              Calendário Operacional {year}
            </h1>
            <p style={{ color: "var(--text-muted)" }}>
              Visualize e gerencie a carga horária e itinerários técnicos.
            </p>
          </div>
          <Link
            href="/"
            className="btn-secondary"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>&larr;</span> Voltar
          </Link>
        </div>

        <div
          className="glass-panel"
          style={{ marginBottom: "2.5rem", padding: "2rem" }}
        >
          <div
            style={{
              display: "flex",
              gap: "2rem",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                flex: "1",
                minWidth: "250px",
              }}
            >
              <label
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: "bold",
                }}
              >
                Selecione o Técnico Responsável:
              </label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.4)",
                  color: "white",
                  transition: "var(--transition-fast)",
                  fontSize: "1rem",
                  fontWeight: "600",
                }}
              >
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {professionals.length === 0 && (
                  <option value="">Nenhum técnico disponível</option>
                )}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                flex: "1",
                minWidth: "350px",
              }}
            >
              <button
                onClick={generateAppointments}
                className="btn-primary"
                disabled={loading || !professionalId}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.8rem",
                  height: "54px",
                }}
              >
                {loading ? "⌛ Agendando..." : "🔄 Re-gerar Agenda"}
              </button>
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      "Tem certeza que deseja apagar TODA a agenda deste ano para este técnico?",
                    )
                  )
                    return;
                  setLoading(true);
                  await fetch(
                    `/api/schedule/generate?professionalId=${professionalId}&year=${year}`,
                    { method: "DELETE" },
                  );
                  await fetchAppointments();
                  setLoading(false);
                }}
                className="btn-secondary"
                disabled={
                  loading || !professionalId || appointments.length === 0
                }
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  flex: "0.6",
                  height: "54px",
                }}
              >
                🗑️ Limpar
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {months.map((monthStr, m) => {
            const daysInMonth = getDaysInMonth(m);
            const firstDay = getFirstDayOfMonth(m);
            const blanks = Array.from({ length: firstDay });
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            return (
              <div
                key={m}
                className="glass-panel animate-fade-in"
                style={{ padding: "1.2rem", animationDelay: `${m * 0.05}s` }}
              >
                <h3
                  style={{
                    textAlign: "center",
                    marginBottom: "1rem",
                    color: "var(--primary)",
                    fontSize: "1.1rem",
                    fontWeight: "800",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  {monthStr}
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "6px",
                    textAlign: "center",
                    fontSize: "0.7rem",
                    fontWeight: "900",
                    color: "var(--text-muted)",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ color: "#f87171" }}>D</div>
                  <div>S</div>
                  <div>T</div>
                  <div>Q</div>
                  <div>Q</div>
                  <div>S</div>
                  <div style={{ color: "#60a5fa" }}>S</div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "6px",
                  }}
                >
                  {blanks.map((_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {days.map((d) => {
                    const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const apt = getAppointment(dateStr);
                    const color = getColor(apt, dateStr);

                    return (
                      <div
                        key={d}
                        onClick={() => handleDayClick(dateStr)}
                        style={{
                          padding: "8px 0",
                          textAlign: "center",
                          fontSize: "0.85rem",
                          fontWeight: "bold",
                          background: color,
                          color: apt
                            ? apt.type === "TESTE_SDAI"
                              ? "#000"
                              : "white"
                            : "var(--text-muted)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          border: apt
                            ? "none"
                            : "1px solid rgba(255,255,255,0.03)",
                          transition: "var(--transition-fast)",
                          boxShadow:
                            apt && apt.type === "TESTE_SDAI"
                              ? "0 0 15px var(--primary-glow)"
                              : "none",
                          height: "42px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform =
                            "translateY(-4px) scale(1.1)";
                          e.currentTarget.style.zIndex = "10";
                          if (!apt)
                            e.currentTarget.style.borderColor =
                              "var(--primary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform =
                            "translateY(0) scale(1)";
                          e.currentTarget.style.zIndex = "1";
                          if (!apt)
                            e.currentTarget.style.borderColor =
                              "rgba(255,255,255,0.03)";
                        }}
                        title={apt ? `${apt.client.name}: ${apt.type}` : ""}
                      >
                        {d}
                        {apt && (
                          <div
                            style={{
                              width: "4px",
                              height: "4px",
                              borderRadius: "50%",
                              background:
                                apt.type === "TESTE_SDAI" ? "#000" : "white",
                              marginTop: "2px",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section
        className="glass-panel"
        style={{
          flex: "1",
          minWidth: "350px",
          position: "sticky",
          top: "100px",
          height: "calc(100vh - 140px)",
          overflowY: "auto",
          borderLeft: "4px solid var(--primary)",
          padding: "2rem",
        }}
      >
        <h2
          style={{
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            fontSize: "1.4rem",
          }}
        >
          <span style={{ fontSize: "1.8rem" }}>🔧</span> Itinerário Diário
        </h2>

        <div style={{ marginBottom: "2.5rem" }}>
          <label
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              fontWeight: "bold",
              letterSpacing: "1px",
            }}
          >
            Filtro Rápido por Ativo:
          </label>
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginTop: "1rem",
            }}
          >
            <button
              onClick={() => setFilterContractId(null)}
              style={{
                padding: "8px 16px",
                borderRadius: "30px",
                border: "1px solid var(--border)",
                background:
                  filterContractId === null
                    ? "var(--primary)"
                    : "rgba(255,255,255,0.02)",
                color: filterContractId === null ? "#000" : "var(--text-muted)",
                fontSize: "0.8rem",
                fontWeight: "800",
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
            >
              VISÃO GERAL
            </button>
            {linkedClients.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterContractId(c.contracts?.[0]?.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "30px",
                  border: "1px solid var(--border)",
                  background:
                    filterContractId === c.contracts?.[0]?.id
                      ? "var(--primary)"
                      : "rgba(255,255,255,0.02)",
                  color:
                    filterContractId === c.contracts?.[0]?.id
                      ? "#000"
                      : "var(--text-muted)",
                  fontSize: "0.8rem",
                  fontWeight: "800",
                  cursor: "pointer",
                  transition: "var(--transition-fast)",
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {appointments.filter(
          (a) => !filterContractId || a.contractId === filterContractId,
        ).length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 0",
              color: "var(--text-muted)",
            }}
          >
            <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</p>
            <p>
              Nenhum atendimento
              <br />
              programado para este filtro.
            </p>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {appointments
              .filter(
                (a) => !filterContractId || a.contractId === filterContractId,
              )
              .map((a, i) => {
                const accentColor =
                  a.type === "TESTE_SDAI" ? "#ea580c" : "var(--primary)";
                return (
                  <li
                    key={a.id}
                    className="animate-fade-in"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.2rem",
                      padding: "1.2rem",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid transparent",
                      transition: "var(--transition-smooth)",
                      animationDelay: `${i * 0.03}s`,
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      handleDayClick(
                        new Date(a.date).toISOString().split("T")[0],
                      )
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(16, 185, 129, 0.05)";
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.transform = "translateX(8px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)";
                      e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.transform = "translateX(0)";
                    }}
                  >
                    <div
                      style={{
                        textAlign: "center",
                        minWidth: "60px",
                        borderRight: "1px solid var(--border)",
                        paddingRight: "1.2rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          display: "block",
                        }}
                      >
                        {new Date(a.date)
                          .toLocaleDateString("pt-BR", { month: "short" })
                          .replace(".", "")}
                      </span>
                      <span
                        style={{
                          fontSize: "1.4rem",
                          fontWeight: "800",
                          color: accentColor,
                        }}
                      >
                        {new Date(a.date).getDate()}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong
                        style={{
                          fontSize: "1.1rem",
                          display: "block",
                          color: "white",
                        }}
                      >
                        {a.client?.name}
                      </strong>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginTop: "4px",
                        }}
                      >
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: accentColor,
                          }}
                        ></span>
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                          }}
                        >
                          {a.type === "TESTE_SDAI"
                            ? "Teste Geral SDAI"
                            : a.observation}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </main>
  );
}
