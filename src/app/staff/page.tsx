"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const formatPhone = (value: string) => {
  if (!value) return "";
  let v = value.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length <= 2) return v.length > 0 ? `(${v}` : v;
  if (v.length <= 7) return `(${v.substring(0, 2)})${v.substring(2)}`;
  return `(${v.substring(0, 2)})${v.substring(2, 7)}-${v.substring(7)}`;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [phone, setPhone] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const carregarDados = async () => {
    try {
      const res = await fetch("/api/internal-contacts");
      if (res.ok) {
        const data = await res.json();
        setStaff(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Falha ao carregar equipe", error);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const resetForm = () => {
    setName("");
    setRole("");
    setEmailPrefix("");
    setPhone("");
    setEditingId(null);
    setIsModalOpen(false);
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPrefix = emailPrefix.split("@")[0];
    const fullEmail = emailPrefix ? `${cleanPrefix}@compasss.com.br` : "";

    const payload = {
      name,
      role,
      email: fullEmail,
      phone,
    };

    if (editingId) {
      const res = await fetch(`/api/internal-contacts/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        carregarDados();
        resetForm();
      } else {
        const err = await res.json();
        alert(`Erro ao editar equipe: ${err.error || "Falha no servidor"}`);
      }
    } else {
      const res = await fetch("/api/internal-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        carregarDados();
        resetForm();
      } else {
        const err = await res.json();
        alert(
          `Erro ao criar equipe: ${err.details || err.error || "Falha no servidor"}`,
        );
      }
    }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setName(s.name);
    setRole(s.role || "");
    const prefix = s.email?.split("@")[0] || "";
    setEmailPrefix(prefix);
    setPhone(formatPhone(s.phone || ""));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, sName: string) => {
    if (!confirm(`Tem certeza que deseja excluir '${sName}'?`)) return;

    const res = await fetch(`/api/internal-contacts/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      carregarDados();
    } else {
      const err = await res.json();
      alert(`Erro ao excluir: ${err.details || err.error}`);
    }
  };

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
            Gestão de Equipe (Staff)
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>
            Especifique os gerentes, coordenadores e diretores da CompaSSS.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
        >
          <span style={{ fontSize: "1.2rem" }}>+</span> Adicionar Colaborador
        </button>
      </div>

      {isModalOpen &&
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
                maxWidth: "500px",
                maxHeight: "90vh",
                overflowY: "auto",
                border: "1px solid var(--primary)",
                boxShadow: "0 0 40px rgba(16, 185, 129, 0.15)",
                padding: "2rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "2rem",
                }}
              >
                <h2 style={{ margin: 0 }}>
                  {editingId ? "Editar Colaborador" : "Novo Colaborador"}
                </h2>
                <button
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
                  gap: "1.5rem",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do Colaborador"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      padding: "0.8rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                      color: "white",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Cargo A, Cargo B, Cargo C..."
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    style={{
                      padding: "0.8rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                      color: "white",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    E-mail (Opcional)
                  </label>
                  <div
                    style={{ display: "flex", gap: "0", alignItems: "stretch" }}
                  >
                    <input
                      type="text"
                      placeholder="usuário"
                      value={emailPrefix}
                      onChange={(e) =>
                        setEmailPrefix(e.target.value.split("@")[0])
                      }
                      style={{
                        flex: 1,
                        padding: "0.8rem",
                        borderRadius: "8px 0 0 8px",
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                        color: "white",
                        textAlign: "right",
                      }}
                    />
                    <div
                      style={{
                        background: "rgba(16, 185, 129, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid var(--border)",
                        borderLeft: "none",
                        borderRadius: "0 8px 8px 0",
                        color: "var(--primary)",
                        fontSize: "0.85rem",
                        padding: "0 10px",
                        fontWeight: "bold",
                      }}
                    >
                      @compasss.com.br
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <label
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    Telefone (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    maxLength={14}
                    style={{
                      padding: "0.8rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                      color: "white",
                    }}
                  />
                </div>

                <div
                  style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}
                >
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1 }}
                  >
                    {editingId ? "Salvar Alterações" : "Cadastrar"}
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

      <div>
        <h2
          style={{
            marginBottom: "1.5rem",
            fontSize: "1.2rem",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Registros Administrativos
        </h2>
        {staff.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            Nenhuma pessoa cadastrada na equipe.
          </p>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {staff.map((s) => (
              <li
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.5rem",
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.01)",
                  borderRadius: "12px",
                  marginBottom: "16px",
                }}
                className="client-card"
              >
                <div>
                  <strong
                    style={{
                      fontSize: "1.4rem",
                      color: "var(--primary)",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    {s.name}
                  </strong>
                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    {s.role}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      color: "white",
                      opacity: 0.8,
                      fontSize: "0.85rem",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span style={{ color: "var(--primary)" }}>📞</span>{" "}
                      {s.phone || "Nenhum"}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span style={{ color: "var(--primary)" }}>✉️</span>{" "}
                      {s.email || "Nenhum"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.8rem" }}>
                  <button
                    onClick={() => handleEdit(s)}
                    style={{
                      padding: "0.6rem 1.2rem",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      color: "white",
                      fontWeight: "600",
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    style={{
                      padding: "0.6rem 1.2rem",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      color: "#f87171",
                      fontWeight: "600",
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
