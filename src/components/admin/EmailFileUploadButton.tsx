"use client";

// Shared by SuppressEmailsForm and TagEmailsForm — both let an admin
// either paste a list of emails or upload the file it came from, with
// the exact same "just extract anything that looks like an email"
// handling either way (see each form's own EMAIL_PATTERN). Reads the
// file's raw text client-side and hands it to the caller's textarea via
// onText — never uploaded to the server as a file, never parsed as
// structured CSV; this is purely a faster way to fill the paste box than
// open-select-all-copy-paste, which matters most on a phone.
export default function EmailFileUploadButton({ onText }: { onText: (text: string, fileName: string) => void }) {
  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onText(typeof reader.result === "string" ? reader.result : "", file.name);
    reader.readAsText(file);
  }

  return (
    <label
      style={{
        display: "inline-block",
        padding: "8px 16px",
        border: "1px solid #e3e1dc",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        background: "#fff",
      }}
    >
      📎 Subir archivo CSV
      <input
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // allows picking the same file again later
        }}
        style={{ display: "none" }}
      />
    </label>
  );
}
