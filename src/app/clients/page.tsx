"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [visitsPerMonth, setVisitsPerMonth] = useState("2");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [targetMonths, setTargetMonths] = useState<number[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [defaultSystems] = useState(["SDAI", "CFTV", "SAP", "SCA", "SAI"]);
  const [availableSystems, setAvailableSystems] = useState<string[]>([
    "SDAI",
    "CFTV",
    "SAP",
    "SCA",
    "SAI",
  ]);
  const [selectedSystems, setSelectedSystems] = useState<string[]>([
    "SDAI",
    "CFTV",
  ]);
  const [availableMaintRoles, setAvailableMaintRoles] = useState<string[]>([
    "Técnico de Sistemas (Cobertura)",
    "Supervisor",
    "Coordenador",
  ]);
  const [availableEscRoles, setAvailableEscRoles] = useState<string[]>([
    "Comercial Obras/Peças",
    "Comercial Serviços",
    "Gerente",
    "Diretor",
  ]);
  const [preferredDays, setPreferredDays] = useState<number[]>([]); // 1-5 (Seg-Sex)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [internalStaff, setInternalStaff] = useState<any[]>([]);

  // ── Modal de Contatos ───────────────────────────────────────
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [contactsContractId, setContactsContractId] = useState<string | null>(
    null,
  );
  const [contactsTechName, setContactsTechName] = useState("");
  const [contactsTechPhone, setContactsTechPhone] = useState("");
  const [contactsTechEmail, setContactsTechEmail] = useState("");
  const defaultContacts = () => ({
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
  });
  const [contacts, setContacts] = useState<{
    maintenance: any[];
    escalation: any[];
  }>(defaultContacts());
  const [contactsSaving, setContactsSaving] = useState(false);

  const openContactsModal = async (contractId: string, tech: any) => {
    setContactsContractId(contractId);
    setContactsTechName(tech?.name || "");
    setContactsTechPhone(tech?.phone || "");
    setContactsTechEmail(tech?.email || "");
    const res = await fetch(`/api/contracts/${contractId}/contacts`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data);
    } else {
      setContacts(defaultContacts());
    }
    setContactsModalOpen(true);
  };

  const saveContacts = async () => {
    if (!contactsContractId) return;
    setContactsSaving(true);
    await fetch(`/api/contracts/${contactsContractId}/contacts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contacts),
    });
    setContactsSaving(false);
    setContactsModalOpen(false);
  };

  const getMaintenanceRank = (role: string) => {
    if (role === "Técnico de Sistemas (Cobertura)") return 1;
    if (role === "Supervisor") return 3;
    if (role === "Coordenador") return 4;
    return 2;
  };

  const getEscalationRank = (role: string) => {
    if (role === "Comercial Obras/Peças") return 1;
    if (role === "Comercial Serviços") return 2;
    if (role === "Gerente") return 3;
    if (role === "Diretor") return 4;
    return 5;
  };

  const getEscalationDepartment = (role: string, currentContact: string) => {
    if (role === "Comercial Obras/Peças" || role === "Comercial Serviços")
      return "Setor Comercial";
    if (role === "Gerente") return "Manutenção de Sistemas";
    if (role === "Diretor") return "Operação de Segurança";
    return currentContact;
  };

  const updateMaintenance = (idx: number, field: string, value: string) =>
    setContacts((prev) => {
      const nextMaint = prev.maintenance.map((r, i) =>
        i === idx ? { ...r, [field]: value } : r,
      );
      if (field === "role")
        nextMaint.sort(
          (a, b) => getMaintenanceRank(a.role) - getMaintenanceRank(b.role),
        );
      return { ...prev, maintenance: nextMaint };
    });

  const updateEscalation = (idx: number, field: string, value: string) =>
    setContacts((prev) => {
      const nextEsc = prev.escalation.map((r, i) => {
        if (i !== idx) return r;
        const newRow = { ...r, [field]: value };
        if (field === "role") {
          newRow.contact = getEscalationDepartment(value, newRow.contact);
        }
        return newRow;
      });
      if (field === "role")
        nextEsc.sort(
          (a, b) => getEscalationRank(a.role) - getEscalationRank(b.role),
        );
      return { ...prev, escalation: nextEsc };
    });

  const addMaintenance = () =>
    setContacts((prev) => ({
      ...prev,
      maintenance: [
        ...prev.maintenance,
        { action: "", role: "", name: "", phone: "", email: "" },
      ],
    }));

  const deleteMaintenance = (idx: number) =>
    setContacts((prev) => ({
      ...prev,
      maintenance: prev.maintenance.filter((_, i) => i !== idx),
    }));

  const addEscalation = () =>
    setContacts((prev) => ({
      ...prev,
      escalation: [
        ...prev.escalation,
        { contact: "", role: "", name: "", phone: "", email: "" },
      ],
    }));

  const deleteEscalation = (idx: number) =>
    setContacts((prev) => ({
      ...prev,
      escalation: prev.escalation.filter((_, i) => i !== idx),
    }));

  /**
   * Esta função busca 2 listas na API: Clientes e Técnicos (Professionals).
   * O fetch() faz requisições HTTP (comunicação de rede com o servidor).
   */
  const carregarDados = async () => {
    try {
      // 1ª Chamada: Bate na rota "/api/clients" e recebe a string JSON que será convertida em objeto JavaScript.
      const resC = await fetch("/api/clients");
      if (resC.ok) {
        const dataC = await resC.json();
        setClients(Array.isArray(dataC) ? dataC : []);
      }

      const resP = await fetch("/api/professionals");
      if (resP.ok) {
        const dataP = await resP.json();
        const profs = Array.isArray(dataP) ? dataP : [];
        setProfessionals(profs);
        if (profs.length > 0 && !professionalId) setProfessionalId(profs[0].id);
      }
    } catch (error) {
      console.error("Falha ao carregar dados", error);
    }
  };

  useEffect(() => {
    carregarDados();

    fetch("/api/internal-contacts")
      .then((res) => res.json())
      .then((data) => setInternalStaff(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Falha ao buscar equipe: ", err));

    const savedMaint = localStorage.getItem("compasss_maint_roles");
    if (savedMaint) setAvailableMaintRoles(JSON.parse(savedMaint));
    const savedEsc = localStorage.getItem("compasss_esc_roles");
    if (savedEsc) setAvailableEscRoles(JSON.parse(savedEsc));
  }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = isModalOpen || contactsModalOpen;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen, contactsModalOpen]);

  const resetForm = () => {
    setName("");
    setVisitsPerMonth("2");
    setFrequency("MONTHLY");
    setTargetMonths([]);
    setAvailableSystems([...defaultSystems]);
    setSelectedSystems(["SDAI", "CFTV"]);
    setPreferredDays([]);
    if (professionals.length > 0) setProfessionalId(professionals[0].id);
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleRoleSelect = (
    e: React.ChangeEvent<HTMLSelectElement>,
    idx: number,
    table: "maintenance" | "escalation",
  ) => {
    const val = e.target.value;
    const isMaint = table === "maintenance";
    const currentRoles = isMaint ? availableMaintRoles : availableEscRoles;
    const setRoles = isMaint ? setAvailableMaintRoles : setAvailableEscRoles;
    const storageKey = isMaint ? "compasss_maint_roles" : "compasss_esc_roles";

    if (val === "+++") {
      const nova = window.prompt("Nova função:");
      if (nova && nova.trim()) {
        const newRoles = [...currentRoles, nova.trim()];
        setRoles(newRoles);
        localStorage.setItem(storageKey, JSON.stringify(newRoles));
        if (isMaint) updateMaintenance(idx, "role", nova.trim());
        else updateEscalation(idx, "role", nova.trim());
      }
    } else if (val === "---") {
      const qual = window.prompt(
        "Qual função deseja excluir? Digite o nome exato:\n" +
          currentRoles.join(", "),
      );
      if (qual) {
        const filtered = currentRoles.filter((r) => r !== qual);
        setRoles(filtered);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      }
    } else {
      const matched = internalStaff.find(
        (s) => s.role && s.role.toLowerCase() === val.toLowerCase(),
      );
      if (isMaint) {
        updateMaintenance(idx, "role", val);
        if (matched) {
          updateMaintenance(idx, "name", matched.name || "");
          updateMaintenance(idx, "phone", matched.phone || "");
          updateMaintenance(idx, "email", matched.email || "");
        }
      } else {
        updateEscalation(idx, "role", val);
        if (matched) {
          updateEscalation(idx, "name", matched.name || "");
          updateEscalation(idx, "phone", matched.phone || "");
          updateEscalation(idx, "email", matched.email || "");
        }
      }
    }
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const togglePreferredDay = (day: number) => {
    if (preferredDays.includes(day)) {
      setPreferredDays(preferredDays.filter((d) => d !== day));
    } else {
      setPreferredDays([...preferredDays, day]);
    }
  };

  const toggleTargetMonth = (m: number) => {
    if (targetMonths.includes(m)) {
      setTargetMonths(targetMonths.filter((prev) => prev !== m));
    } else {
      if (frequency === "MONTHLY") {
        setTargetMonths([...targetMonths, m]);
      } else {
        // Lógica Inteligente: Auto-preencher baseado na frequência
        const period =
          frequency === "BIMONTHLY"
            ? 2
            : frequency === "QUARTERLY"
              ? 3
              : frequency === "SEMIANNUAL"
                ? 6
                : frequency === "ANNUAL"
                  ? 12
                  : 1;

        const newMonths = [...targetMonths];
        for (let i = m; i < 12; i += period) {
          if (!newMonths.includes(i)) newMonths.push(i);
        }
        setTargetMonths(newMonths.sort((a, b) => a - b));
      }
    }
  };

  const toggleSystem = (sys: string) => {
    if (selectedSystems.includes(sys)) {
      setSelectedSystems(selectedSystems.filter((s) => s !== sys));
    } else {
      setSelectedSystems([...selectedSystems, sys]);
    }
  };

  const addCustomSystem = () => {
    const name = window.prompt("Nome do novo sistema:");
    if (name && name.trim()) {
      const upperName = name.trim().toUpperCase();
      if (!availableSystems.includes(upperName)) {
        setAvailableSystems([...availableSystems, upperName]);
      }
      if (!selectedSystems.includes(upperName)) {
        setSelectedSystems([...selectedSystems, upperName]);
      }
    }
  };

  const removeSystem = (e: React.MouseEvent, sys: string) => {
    e.stopPropagation(); // Evita que o botão seja selecionado ao clicar no X
    if (defaultSystems.includes(sys)) return; // Não remove os padrões

    setAvailableSystems(availableSystems.filter((s) => s !== sys));
    setSelectedSystems(selectedSystems.filter((s) => s !== sys));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Quando enviamos Arrays (como targetMonths ou sistemas) para o banco de dados via API, às vezes precisamos
    // compactá-las em string. O método nativo do JS ".join(',')" faz isso: pega [1, 2, 3] e transforma em "1,2,3".
    const payload = {
      name,
      visitsPerMonth,
      frequency,
      targetMonths: targetMonths.join(","),
      professionalId,
      systemTypes: selectedSystems.join(","),
      preferredDays: preferredDays.join(","),
    };

    if (editingId) {
      const res = await fetch(`/api/clients/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        carregarDados();
        resetForm();
      } else {
        const err = await res.json();
        alert(
          `Erro ao salvar contrato: ${err.details || err.error || "Falha no servidor"}`,
        );
      }
    } else {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        carregarDados();
        resetForm();
      } else {
        const err = await res.json();
        alert(`Erro ao criar: ${err.error || "Falha no servidor"}`);
      }
    }
  };

  const handleEdit = (client: any) => {
    setEditingId(client.id);
    setName(client.name);

    const contract = client.contracts?.[0];
    if (contract) {
      setVisitsPerMonth(contract.visitsPerMonth?.toString() || "2");
      const savedSystems = contract.systemTypes
        ? contract.systemTypes.split(",")
        : [];
      setSelectedSystems(savedSystems);

      // Quando editamos, a lista de sistemas disponíveis deve ser:
      // PADRÕES + SISTEMAS QUE JÁ ESTAVAM SALVOS NESTE CONTRATO
      const currentAvailable = [...defaultSystems];
      savedSystems.forEach((s: string) => {
        if (!currentAvailable.includes(s)) {
          currentAvailable.push(s);
        }
      });
      setAvailableSystems(currentAvailable);

      setProfessionalId(contract.professionalId || "");

      const pDays = contract.preferredDays
        ? contract.preferredDays.split(",").map(Number)
        : [];
      setPreferredDays(pDays);

      setFrequency(contract.frequency || "MONTHLY");
      const tMonths = contract.targetMonths
        ? contract.targetMonths.split(",").map(Number)
        : [];
      setTargetMonths(tMonths);
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, clientName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente '${clientName}'?`))
      return;

    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      carregarDados();
      if (editingId === id) resetForm();
    }
  };

  const dayNames = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const monthNames = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  return (
    <main
      style={{ padding: "4rem 2rem", maxWidth: "1000px", margin: "0 auto" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "3rem",
        }}
      >
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            Gestão de Contratos
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>
            Administre os ativos e frequências dos clientes CompaSSS.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
        >
          <span style={{ fontSize: "1.2rem" }}>+</span> Novo Contrato
        </button>
      </div>

      {isModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.9)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              backdropFilter: "blur(8px)",
              overflowY: "auto",
            }}
          >
            <section
              className="glass-panel animate-fade-in"
              style={{
                width: "100%",
                maxWidth: "600px",
                padding: "1.5rem",
                border: "1px solid var(--primary)",
                boxShadow: "0 0 40px rgba(16, 185, 129, 0.1)",
                maxHeight: "98vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "1.4rem" }}>
                  {editingId ? "Editar Contrato" : "Novo Contrato"}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    background: "transparent",
                    color: "white",
                    border: "none",
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    padding: "0.5rem",
                  }}
                >
                  &times;
                </button>
              </div>

              <form
                onSubmit={handleSave}
                style={{
                  display: "flex",
                  gap: "0.8rem",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                  }}
                >
                  <label
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    Nome do Cliente (Prédio/Shopping)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      padding: "0.65rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "rgba(0,0,0,0.3)",
                      color: "white",
                      transition: "var(--transition-fast)",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.8rem" }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      Frequência
                    </label>
                    <select
                      value={frequency}
                      onChange={(e) => {
                        setFrequency(e.target.value);
                        setTargetMonths([]);
                      }}
                      required
                      style={{
                        width: "100%",
                        padding: "0.65rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "rgba(0,0,0,0.3)",
                        color: "white",
                        transition: "var(--transition-fast)",
                      }}
                    >
                      <option value="MONTHLY">Mensal</option>
                      <option value="BIMONTHLY">Bimestral</option>
                      <option value="QUARTERLY">Trimestral</option>
                      <option value="SEMIANNUAL">Semestral</option>
                      <option value="ANNUAL">Anual</option>
                    </select>
                  </div>
                  {frequency === "MONTHLY" && (
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.85rem",
                        }}
                      >
                        Visitas/Mês
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={visitsPerMonth}
                        onChange={(e) => setVisitsPerMonth(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "0.65rem",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "rgba(0,0,0,0.3)",
                          color: "white",
                          transition: "var(--transition-fast)",
                        }}
                      />
                    </div>
                  )}
                  <div style={{ flex: 2 }}>
                    <label
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      Técnico Responsável
                    </label>
                    <select
                      value={professionalId}
                      onChange={(e) => setProfessionalId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.65rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "rgba(0,0,0,0.3)",
                        color: "white",
                        transition: "var(--transition-fast)",
                      }}
                    >
                      <option value="">Selecione o Técnico</option>
                      {professionals.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <label
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      Estratégia Mensal (Meses de Visita):
                    </label>
                    {targetMonths.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTargetMonths([])}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#f87171",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          padding: "0 4px",
                          textDecoration: "underline",
                          transition: "var(--transition-fast)",
                        }}
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: "4px",
                    }}
                  >
                    {monthNames.map((m, i) => {
                      const period =
                        frequency === "BIMONTHLY"
                          ? 2
                          : frequency === "QUARTERLY"
                            ? 3
                            : frequency === "SEMIANNUAL"
                              ? 6
                              : frequency === "ANNUAL"
                                ? 12
                                : 1;

                      const firstMonth =
                        targetMonths.length > 0
                          ? Math.min(...targetMonths)
                          : null;
                      const isAllowed =
                        firstMonth === null || (i - firstMonth) % period === 0;
                      const isSelected = targetMonths.includes(i);
                      const isDisabled = !isAllowed && frequency !== "MONTHLY";

                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => toggleTargetMonth(i)}
                          style={{
                            padding: "6px 0",
                            borderRadius: "4px",
                            border: "1px solid var(--border)",
                            background: isSelected
                              ? "#a855f7"
                              : "rgba(255,255,255,0.05)",
                            color: isSelected
                              ? "white"
                              : isDisabled
                                ? "rgba(255,255,255,0.1)"
                                : "white",
                            fontSize: "0.7rem",
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            transition: "var(--transition-fast)",
                            opacity: isDisabled ? 0.3 : 1,
                          }}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                  <small
                    style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}
                  >
                    *{" "}
                    {frequency === "MONTHLY"
                      ? "Se nenhum mês for selecionado, agendará todos os meses."
                      : "Obrigatório selecionar meses para frequências reduzidas."}
                  </small>
                  {frequency !== "MONTHLY" && (
                    <div
                      style={{
                        padding: "8px",
                        borderRadius: "8px",
                        background: "rgba(234, 179, 8, 0.1)",
                        border: "1px solid rgba(234, 179, 8, 0.2)",
                        marginTop: "4px",
                        transition: "var(--transition-smooth)",
                      }}
                    >
                      <p
                        style={{
                          color: "#eab308",
                          fontSize: "0.75rem",
                          margin: 0,
                          fontWeight: "bold",
                        }}
                      >
                        ⚠️ Modo Baixa Frequência Ativado
                      </p>
                      <p
                        style={{
                          color: "#eab308",
                          fontSize: "0.7rem",
                          margin: "4px 0 0 0",
                        }}
                      >
                        Agendamento de Visitas Automático. Testes SDAI deverão
                        ser inseridos MANUALMENTE.
                      </p>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <label
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    Dias de Preferência (Opcional):
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[1, 2, 3, 4, 5].map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => togglePreferredDay(d)}
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          background: preferredDays.includes(d)
                            ? "var(--primary)"
                            : "rgba(255,255,255,0.02)",
                          color: preferredDays.includes(d) ? "#000" : "white",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                          cursor: "pointer",
                          transition: "var(--transition-fast)",
                        }}
                      >
                        {dayNames[i]}
                      </button>
                    ))}
                  </div>
                  <small
                    style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}
                  >
                    *Se nenhum dia for selecionado, o técnico poderá ir em
                    qualquer dia útil.
                  </small>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <label
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    Sistemas Mantidos:
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {availableSystems.map((sys) => (
                      <div key={sys} style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => toggleSystem(sys)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            background: selectedSystems.includes(sys)
                              ? "var(--primary)"
                              : "rgba(255,255,255,0.02)",
                            color: selectedSystems.includes(sys)
                              ? "#000"
                              : "white",
                            fontSize: "0.8rem",
                            fontWeight: "bold",
                            cursor: "pointer",
                            transition: "var(--transition-fast)",
                            minWidth: "70px",
                            paddingRight: !defaultSystems.includes(sys)
                              ? "25px"
                              : "12px",
                          }}
                        >
                          {sys}
                        </button>
                        {!defaultSystems.includes(sys) && (
                          <span
                            onClick={(e) => removeSystem(e, sys)}
                            style={{
                              position: "absolute",
                              right: "4px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "#f87171",
                              fontSize: "0.7rem",
                              cursor: "pointer",
                              fontWeight: "bold",
                              padding: "2px 4px",
                              background: "rgba(0,0,0,0.2)",
                              borderRadius: "4px",
                              transition: "var(--transition-fast)",
                            }}
                          >
                            &times;
                          </span>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCustomSystem}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: "1px dashed var(--primary)",
                        background: "rgba(16, 185, 129, 0.05)",
                        color: "var(--primary)",
                        fontSize: "1rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "var(--transition-fast)",
                      }}
                      title="Adicionar Outro Sistema"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div
                  style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}
                >
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1 }}
                  >
                    {editingId ? "Salvar Alterações" : "Criar Contrato"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )}

      <section
        className="glass-panel animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h2 style={{ margin: 0 }}>Contratos Vigentes</h2>
          <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
            {clients.length} contrato{clients.length !== 1 ? "s" : ""}
          </span>
        </div>

        {clients.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📋</div>
            <p>Nenhum cliente cadastrado ainda.</p>
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {clients.map((c) => {
              const contract = c.contracts?.[0];
              const pDays = contract?.preferredDays
                ? contract.preferredDays
                    .split(",")
                    .map((d: string) => dayNames[parseInt(d) - 1])
                    .join(", ")
                : null;
              const freqLabel =
                contract?.frequency === "MONTHLY"
                  ? `${contract?.visitsPerMonth}x / mês`
                  : contract?.frequency === "BIMONTHLY"
                    ? "Bimestral"
                    : contract?.frequency === "QUARTERLY"
                      ? "Trimestral"
                      : contract?.frequency === "SEMIANNUAL"
                        ? "Semestral"
                        : "Anual";
              const systems = contract?.systemTypes
                ? contract.systemTypes.split(",")
                : [];

              return (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.02)",
                    transition: "all 0.25s",
                  }}
                >
                  {/* Barra lateral colorida */}
                  <div
                    style={{
                      width: "4px",
                      flexShrink: 0,
                      background: "linear-gradient(180deg,#10b981,#065f46)",
                    }}
                  />

                  {/* Conteúdo principal */}
                  <div
                    style={{ flex: 1, padding: "1.2rem 1.4rem", minWidth: 0 }}
                  >
                    <strong
                      style={{
                        fontSize: "1.25rem",
                        color: "var(--primary)",
                        display: "block",
                        marginBottom: "10px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </strong>

                    {/* Badges de info */}
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginBottom: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.68rem",
                          background: "rgba(16,185,129,0.12)",
                          color: "#34d399",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          border: "1px solid rgba(16,185,129,0.25)",
                          fontWeight: 800,
                          letterSpacing: "0.5px",
                        }}
                      >
                        {freqLabel}
                      </span>
                      {systems.slice(0, 6).map((sys: string) => (
                        <span
                          key={sys}
                          style={{
                            fontSize: "0.65rem",
                            background: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.6)",
                            padding: "3px 8px",
                            borderRadius: "20px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            fontWeight: 600,
                          }}
                        >
                          {sys.trim()}
                        </span>
                      ))}
                      {systems.length > 6 && (
                        <span style={{ fontSize: "0.65rem", color: "#64748b" }}>
                          +{systems.length - 6} mais
                        </span>
                      )}
                    </div>

                    {/* Meta inferior */}
                    <div
                      style={{
                        display: "flex",
                        gap: "1.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                        👷 Técnico:{" "}
                        <strong style={{ color: "white" }}>
                          {contract?.professional?.name || "Não vinculado"}
                        </strong>
                      </span>
                      {pDays && (
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          📅 Preferência:{" "}
                          <strong style={{ color: "#fbbf24" }}>{pDays}</strong>
                        </span>
                      )}
                      {contract?.targetMonths && (
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          🗓️ Meses:{" "}
                          <strong style={{ color: "#a5b4fc" }}>
                            {contract.targetMonths
                              .split(",")
                              .map((m: string) => monthNames[parseInt(m)])
                              .join(", ")}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botões de ação — sempre à direita, nunca quebram */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "1rem",
                      borderLeft: "1px solid rgba(255,255,255,0.05)",
                      flexShrink: 0,
                    }}
                  >
                    <Link
                      href={`/reports/contract/${c.contracts[0]?.id}`}
                      target="_blank"
                      onClick={(e) => {
                        if (!c.contracts?.length) {
                          e.preventDefault();
                          alert("Sem contrato para gerar PDF.");
                        }
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "3px",
                        padding: "10px 14px",
                        background: "rgba(16,185,129,0.15)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        borderRadius: "10px",
                        cursor: "pointer",
                        color: "var(--primary)",
                        fontWeight: 800,
                        textDecoration: "none",
                        fontSize: "0.65rem",
                        minWidth: "54px",
                        textAlign: "center",
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>🖨️</span>
                      PDF
                    </Link>
                    <button
                      onClick={() =>
                        openContactsModal(
                          c.contracts[0]?.id,
                          c.contracts[0]?.professional,
                        )
                      }
                      disabled={!c.contracts?.length}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "3px",
                        padding: "10px 14px",
                        background: "rgba(59,130,246,0.15)",
                        border: "1px solid rgba(59,130,246,0.3)",
                        borderRadius: "10px",
                        cursor: "pointer",
                        color: "#60a5fa",
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        minWidth: "54px",
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>📋</span>
                      Contatos
                    </button>
                    <button
                      onClick={() => handleEdit(c)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "3px",
                        padding: "10px 14px",
                        background: "rgba(251,146,60,0.15)",
                        border: "1px solid rgba(251,146,60,0.35)",
                        borderRadius: "10px",
                        cursor: "pointer",
                        color: "#fb923c",
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        minWidth: "54px",
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>✏️</span>
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "3px",
                        padding: "10px 14px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: "10px",
                        cursor: "pointer",
                        color: "#f87171",
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        minWidth: "54px",
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>🗑️</span>
                      Excluir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── MODAL DE LISTA DE CONTATOS ───────────────────────────── */}
      {contactsModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.92)",
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              backdropFilter: "blur(8px)",
            }}
          >
            <section
              className="glass-panel animate-fade-in"
              style={{
                width: "100%",
                maxWidth: "920px",
                maxHeight: "94vh",
                overflowY: "auto",
                padding: "1.8rem",
                border: "1px solid rgba(59,130,246,0.4)",
                boxShadow: "0 0 40px rgba(59,130,246,0.15)",
                borderRadius: "16px",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.3rem" }}>
                    📋 Lista de Contatos
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#94a3b8",
                      fontSize: "0.78rem",
                    }}
                  >
                    Edite, adicione ou remova contatos. O 1° Contato (técnico
                    responsável) é gerado automaticamente.
                  </p>
                </div>
                <button
                  onClick={() => setContactsModalOpen(false)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  &times;
                </button>
              </div>

              {/* SEÇÃO 1: Manutenção de Sistemas */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    background: "linear-gradient(135deg,#14532d,#166534)",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: "8px 8px 0 0",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                    letterSpacing: "1px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>🔧 MANUTENÇÃO DE SISTEMAS</span>
                </div>
                <div
                  style={{
                    border: "1px solid rgba(20,83,45,0.5)",
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                    overflow: "hidden",
                  }}
                >
                  {/* Cabeçalho da tabela */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 70px 1fr 1fr 110px 1fr 32px",
                      background: "#0c1a2e",
                      padding: "7px 10px",
                      fontSize: "0.68rem",
                      color: "#64748b",
                      fontWeight: 700,
                      gap: "6px",
                    }}
                  >
                    <span>Ação</span>
                    <span>Empresa</span>
                    <span>Função</span>
                    <span>Nome</span>
                    <span>Telefone</span>
                    <span>E-mail</span>
                    <span></span>
                  </div>

                  {/* 1° Contato — Técnico vinculado (BLOQUEADO) */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 70px 1fr 1fr 110px 1fr 32px",
                      padding: "9px 10px",
                      fontSize: "0.75rem",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      gap: "6px",
                      alignItems: "center",
                      background: "rgba(16,185,129,0.07)",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        color: "#10b981",
                        fontSize: "0.72rem",
                      }}
                    >
                      1° Contato
                    </span>
                    <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>
                      CompaSSS
                    </span>
                    <span
                      style={{
                        color: "#94a3b8",
                        fontSize: "0.72rem",
                        fontStyle: "italic",
                      }}
                    >
                      Técnico de Sistemas (Fixo)
                    </span>
                    <span style={{ fontWeight: 700, color: "white" }}>
                      {contactsTechName || "—"}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                      {contactsTechPhone || "—"}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "0.66rem" }}>
                      {contactsTechEmail || "—"}
                    </span>
                    <span
                      title="Não pode ser removido"
                      style={{
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.2)",
                        textAlign: "center",
                      }}
                    >
                      🔒
                    </span>
                  </div>

                  {/* Linhas editáveis */}
                  {contacts.maintenance.map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "110px 70px 1fr 1fr 110px 1fr 32px",
                        padding: "6px 10px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        gap: "6px",
                        alignItems: "center",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(0,0,0,0.2)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: "5px",
                          color: "#93c5fd",
                          fontWeight: 800,
                          width: "100%",
                          boxSizing: "border-box",
                          cursor: "not-allowed",
                        }}
                      >
                        {idx + 2}° Contato
                      </div>
                      <span
                        style={{
                          color: "#6b7280",
                          fontSize: "0.7rem",
                          textAlign: "center",
                          fontWeight: 800,
                        }}
                      >
                        CompaSSS
                      </span>
                      <select
                        value={row.role || ""}
                        onChange={(e) =>
                          handleRoleSelect(e, idx, "maintenance")
                        }
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                          cursor: "pointer",
                        }}
                      >
                        <option value="" style={{ color: "black" }}>
                          Selecione...
                        </option>
                        {availableMaintRoles.map((r) => (
                          <option key={r} value={r} style={{ color: "black" }}>
                            {r}
                          </option>
                        ))}
                        {row.role &&
                          !availableMaintRoles.includes(row.role) && (
                            <option value={row.role} style={{ color: "black" }}>
                              {row.role}
                            </option>
                          )}
                        <option disabled>──────────</option>
                        <option
                          value="+++"
                          style={{ color: "green", fontWeight: "bold" }}
                        >
                          ➕ Adicionar Nova...
                        </option>
                        <option
                          value="---"
                          style={{ color: "red", fontWeight: "bold" }}
                        >
                          🗑️ Excluir Uma...
                        </option>
                      </select>
                      <input
                        value={row.name}
                        onChange={(e) =>
                          updateMaintenance(idx, "name", e.target.value)
                        }
                        placeholder="Nome completo"
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        value={row.phone}
                        onChange={(e) =>
                          updateMaintenance(idx, "phone", e.target.value)
                        }
                        placeholder="(11) 99999-9999"
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        value={row.email}
                        onChange={(e) =>
                          updateMaintenance(idx, "email", e.target.value)
                        }
                        placeholder="email@compasss.com.br"
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={() => deleteMaintenance(idx)}
                        title="Remover linha"
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          background: "rgba(239,68,68,0.15)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Botão adicionar linha */}
                  <div style={{ padding: "8px 10px" }}>
                    <button
                      onClick={addMaintenance}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        background: "rgba(16,185,129,0.08)",
                        border: "1px dashed rgba(16,185,129,0.35)",
                        borderRadius: "6px",
                        color: "#10b981",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        width: "100%",
                        justifyContent: "center",
                      }}
                    >
                      + Adicionar Contato
                    </button>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: Escalonamento / Contatos-Chave */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div
                  style={{
                    background: "linear-gradient(135deg,#064e3b,#065f46)",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: "8px 8px 0 0",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                    letterSpacing: "1px",
                  }}
                >
                  🚨 ESCALONAMENTO DE OCORRÊNCIAS E CONTATOS-CHAVE
                </div>
                <div
                  style={{
                    border: "1px solid rgba(6,78,59,0.5)",
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                    overflow: "hidden",
                  }}
                >
                  {/* Cabeçalho */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px 70px 1fr 1fr 110px 1fr 32px",
                      background: "#0c1a2e",
                      padding: "7px 10px",
                      fontSize: "0.68rem",
                      color: "#64748b",
                      fontWeight: 700,
                      gap: "6px",
                    }}
                  >
                    <span>Contato</span>
                    <span>Empresa</span>
                    <span>Função</span>
                    <span>Nome</span>
                    <span>Telefone</span>
                    <span>E-mail</span>
                    <span></span>
                  </div>

                  {contacts.escalation.map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "130px 70px 1fr 1fr 110px 1fr 32px",
                        padding: "6px 10px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        value={row.contact}
                        onChange={(e) =>
                          updateEscalation(idx, "contact", e.target.value)
                        }
                        placeholder="Ex: Setor Comercial"
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "#86efac",
                          fontWeight: 700,
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      <span
                        style={{
                          color: "#6b7280",
                          fontSize: "0.7rem",
                          textAlign: "center",
                        }}
                      >
                        CompaSSS
                      </span>
                      <select
                        value={row.role || ""}
                        onChange={(e) => handleRoleSelect(e, idx, "escalation")}
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                          cursor: "pointer",
                        }}
                      >
                        <option value="" style={{ color: "black" }}>
                          Selecione...
                        </option>
                        {availableEscRoles.map((r) => (
                          <option key={r} value={r} style={{ color: "black" }}>
                            {r}
                          </option>
                        ))}
                        {row.role && !availableEscRoles.includes(row.role) && (
                          <option value={row.role} style={{ color: "black" }}>
                            {row.role}
                          </option>
                        )}
                        <option disabled>──────────</option>
                        <option
                          value="+++"
                          style={{ color: "green", fontWeight: "bold" }}
                        >
                          ➕ Adicionar Nova...
                        </option>
                        <option
                          value="---"
                          style={{ color: "red", fontWeight: "bold" }}
                        >
                          🗑️ Excluir Uma...
                        </option>
                      </select>
                      <input
                        value={row.name}
                        onChange={(e) =>
                          updateEscalation(idx, "name", e.target.value)
                        }
                        placeholder="Nome completo"
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        value={row.phone}
                        onChange={(e) =>
                          updateEscalation(idx, "phone", e.target.value)
                        }
                        placeholder="(11) 99999-9999"
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        value={row.email}
                        onChange={(e) =>
                          updateEscalation(idx, "email", e.target.value)
                        }
                        placeholder="email@compasss.com.br"
                        style={{
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "5px",
                          color: "white",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={() => deleteEscalation(idx)}
                        title="Remover linha"
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          background: "rgba(239,68,68,0.15)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#f87171",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <div style={{ padding: "8px 10px" }}>
                    <button
                      onClick={addEscalation}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        background: "rgba(6,78,59,0.15)",
                        border: "1px dashed rgba(16,185,129,0.3)",
                        borderRadius: "6px",
                        color: "#34d399",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        width: "100%",
                        justifyContent: "center",
                      }}
                    >
                      + Adicionar Contato
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "flex-end",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <button
                  onClick={() => setContactsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveContacts}
                  className="btn-primary"
                  disabled={contactsSaving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: "160px",
                    justifyContent: "center",
                  }}
                >
                  {contactsSaving ? "⏳ Salvando..." : "💾 Salvar Contatos"}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </main>
  );
}
