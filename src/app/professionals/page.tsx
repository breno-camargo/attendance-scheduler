"use client"; // Esta diretiva informa ao Next.js que este componente deve ser renderizado no navegador (Frontend). Necessário para usar hooks como useState e useEffect.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/**
 * Função utilitária para formatar o número de telefone no formato Brasileiro.
 * Usa Expressão Regular (Regex) para higienizar a entrada.
 */
const formatPhone = (value: string) => {
  if (!value) return "";
  // /\D/g significa: "Encontre tudo que NÃO for um dígito numérico, e substitua por nada (remova)".
  let v = value.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length <= 2) return v.length > 0 ? `(${v}` : v;
  if (v.length <= 7) return `(${v.substring(0, 2)})${v.substring(2)}`;
  return `(${v.substring(0, 2)})${v.substring(2, 7)}-${v.substring(7)}`;
};

export default function ProfessionalsPage() {
  // useState: Cria variáveis dinâmicas no React. Quando o valor muda (via set...), a tela é atualizada automaticamente!
  const [professionals, setProfessionals] = useState<any[]>([]);

  // Estados para controlar individualmente cada input do formulário (Input Controlado Data-Binding)
  const [name, setName] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [phone, setPhone] = useState("");

  // Se "editingId" for "null" sabemos que estamos no fluxo de criação. Se tiver um ID (string), sabemos que é edição.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado que funciona como um "Interruptor" (Toggle) para exibir ou esconder o Modal na tela.
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Função para buscar arquivos no banco de dados.
   * async/await: Diz ao ecossistema JavaScript para "pausar" essa linha e esperar a resposta do banco de dados antes de continuar.
   */
  const carregarDados = async () => {
    try {
      const res = await fetch("/api/professionals"); // Método GET é o padrão no fetch()
      if (res.ok) {
        const data = await res.json();
        setProfessionals(Array.isArray(data) ? data : []); // Alimenta o State principal
      }
    } catch (error) {
      console.error("Falha ao carregar técnicos", error);
    }
  };

  /**
   * useEffect: Executa ações num "efeito colateral".
   * A array vazia `[]` no final avisa ao React: "Execute isso apenas 1 vez, logo que a página carregar".
   */
  useEffect(() => {
    carregarDados();
  }, []);

  const resetForm = () => {
    setName("");
    setEmailPrefix("");
    setPhone("");
    setEditingId(null);
    setIsModalOpen(false);
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  /**
   * Disparado quando o botão "Criar Técnico" ou "Salvar" for pressionado.
   */
  const handleSave = async (e: React.FormEvent) => {
    // e.preventDefault() impede que o formulário recarregue toda a página, comportamento padrão da internet antiga.
    // É o padrão mais usado em SPAs (Single Page Applications) como o React.
    e.preventDefault();

    // Limpa o prefixo caso o usuário tenha colado o e-mail completo por engano
    const cleanPrefix = emailPrefix.split("@")[0];
    const fullEmail = `${cleanPrefix}@compasss.com.br`;

    // Objeto Payload: São os dados compactados que vamos despachar no "Corpo" (Body) da Requisição REST.
    const payload = { name, email: fullEmail, phone };

    if (editingId) {
      // Método PUT: Na arquitetura REST, usamos PUT ou PATCH para mandar alterar um dado existente no servidor.
      const res = await fetch(`/api/professionals/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        carregarDados();
        resetForm();
      } else {
        const err = await res.json();
        alert(`Erro ao editar técnico: ${err.error || "Falha no servidor"}`);
      }
    } else {
      const res = await fetch("/api/professionals", {
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
          `Erro ao criar técnico: ${err.details || err.error || "Falha no servidor"}`,
        );
      }
    }
  };

  const handleEdit = (prof: any) => {
    setEditingId(prof.id);
    setName(prof.name);
    // Tenta separar o prefixo se já tiver o domínio (ou exibe como está)
    const prefix = prof.email?.split("@")[0] || "";
    setEmailPrefix(prefix);
    setPhone(formatPhone(prof.phone || ""));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, profName: string) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o técnico '${profName}'? Ele será removido de todos os contratos.`,
      )
    )
      return;

    const res = await fetch(`/api/professionals/${id}`, { method: "DELETE" });
    if (res.ok) {
      carregarDados();
    } else {
      const err = await res.json();
      alert(
        `Erro ao excluir: ${err.details || err.error || "O técnico pode ter dependências ativas."}`,
      );
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
            Gestão de Técnicos
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>
            Especifique os profissionais capacitados da CompaSSS.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
        >
          <span style={{ fontSize: "1.2rem" }}>+</span> Novo Técnico
        </button>
      </div>

      {/* MODAL POPUP DE EDIÇÃO/CRIAÇÃO DO TÉCNICO */}
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
                  {editingId ? "Editar Técnico" : "Novo Técnico"}
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
                    placeholder="Nome do Técnico"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      padding: "0.8rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                      color: "white",
                      transition: "var(--transition-fast)",
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
                    E-mail Corporativo
                  </label>
                  <div
                    style={{ display: "flex", gap: "0", alignItems: "stretch" }}
                  >
                    {/* Este é um Input Controlado (Controlled Component). 
                      Seu "value" reflete 100% nosso React State. Qualquer tecla disparada no onChange será validada primeiro. */}
                    <input
                      type="text"
                      placeholder="usuário"
                      value={emailPrefix}
                      onChange={(e) => {
                        const val = e.target.value.split("@")[0];
                        setEmailPrefix(val);
                      }}
                      required
                      style={{
                        flex: 1,
                        padding: "0.8rem",
                        borderRadius: "8px 0 0 8px",
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                        color: "white",
                        textAlign: "right",
                        transition: "var(--transition-fast)",
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
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    placeholder="(11)99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    required
                    maxLength={14}
                    style={{
                      padding: "0.8rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                      color: "white",
                      transition: "var(--transition-fast)",
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
                    {editingId ? "Salvar Alterações" : "Criar Técnico"}
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
          Técnicos Cadastrados
        </h2>
        {professionals.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            Nenhum técnico cadastrado ainda.
          </p>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {professionals.map((p) => (
              <li
                key={p.id}
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
                    {p.name}
                  </strong>
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "0.9rem",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    {p.email}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "white",
                      opacity: 0.8,
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ color: "var(--primary)" }}>📞</span>{" "}
                    {p.phone || "Nenhum"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.8rem" }}>
                  <button
                    onClick={() => handleEdit(p)}
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
                    onClick={() => handleDelete(p.id, p.name)}
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
