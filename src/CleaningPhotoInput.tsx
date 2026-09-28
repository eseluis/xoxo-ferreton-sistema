import { useState } from "react";

export function CleaningPhotoInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <span className="cleaningPhotoInput">
    <input aria-label="Seleccionar fotografía de aseo" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { setError("Usa una fotografía JPG, PNG o WebP de hasta 10 MB."); return; }
      setBusy(true); setError(""); const url = URL.createObjectURL(file);
      try {
        const picture = new Image(); picture.src = url; await picture.decode();
        const factor = Math.min(1, 800 / Math.max(picture.width, picture.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(picture.width * factor)); canvas.height = Math.max(1, Math.round(picture.height * factor));
        const context = canvas.getContext("2d"); if (!context) throw new Error("No se pudo preparar la foto.");
        context.drawImage(picture, 0, 0, canvas.width, canvas.height); onChange(canvas.toDataURL("image/jpeg", 0.7));
      } catch { setError("No se pudo leer la foto. Intenta con otro archivo."); }
      finally { URL.revokeObjectURL(url); setBusy(false); }
    }} />
    {busy && <small role="status">Preparando fotografía…</small>}
    {error && <small role="alert">{error}</small>}
    {value.startsWith("data:image/") && <img src={value} alt="Evidencia de aseo" />}
    {value && <button type="button" className="ghost compact" onClick={() => onChange("")}>Cambiar fotografía</button>}
  </span>;
}
