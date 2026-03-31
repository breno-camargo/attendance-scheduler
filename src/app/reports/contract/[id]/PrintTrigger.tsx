"use client";
import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    // Dá um tempo curto para garantir que fontes e layouts estejam renderizados
    const timer = setTimeout(() => {
      window.print();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
