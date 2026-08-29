// Every CRM sub-page had its own <h1>, some styled (fontSize:20) and some
// left at the browser's default h1 size — the section read as visually
// inconsistent page to page. One shared header fixes that everywhere at
// once.
export default function CrmPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ color: "#5b5f6b", margin: "4px 0 0", maxWidth: 720 }}>{subtitle}</p>}
    </div>
  );
}
