"use client";

export default function Loading() {
  return (
    <div style={{ padding: "4rem 2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            width: "400px",
            height: "40px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "8px",
          }}
        />
        <div
          style={{
            width: "100px",
            height: "45px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "8px",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.5rem",
          opacity: 0.5,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="glass-panel"
            style={{
              height: "300px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "12px",
              animation: "pulse 1.5s infinite ease-in-out",
            }}
          >
            <div
              style={{
                height: "30px",
                background: "rgba(255,255,255,0.05)",
                marginBottom: "1rem",
                borderRadius: "4px",
              }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "6px",
              }}
            >
              {Array.from({ length: 28 }).map((_, j) => (
                <div
                  key={j}
                  style={{
                    height: "40px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "4px",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
