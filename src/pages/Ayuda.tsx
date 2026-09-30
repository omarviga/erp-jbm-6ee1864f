import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Download, FileText, Search, BookOpen } from "lucide-react";
import guia from "@/content/guia-usuario.json";

type Bloque =
  | { tipo: "p"; texto: string }
  | { tipo: "h2"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "code"; texto: string }
  | { tipo: "img"; src: string; caption?: string }
  | { tipo: "tabla"; headers: string[]; filas: string[][] };

type Seccion = { id: string; titulo: string; contenido: Bloque[] };

const secciones = guia.secciones as Seccion[];

function renderBloque(b: Bloque, i: number) {
  switch (b.tipo) {
    case "p":
      return <p key={i} className="text-sm text-foreground/90 leading-relaxed mb-3">{b.texto}</p>;
    case "h2":
      return <h3 key={i} className="text-base font-bold text-[#1E5128] mt-4 mb-2">{b.texto}</h3>;
    case "lista":
      return (
        <ul key={i} className="list-disc pl-6 mb-3 space-y-1">
          {b.items.map((it, k) => <li key={k} className="text-sm text-foreground/90 leading-relaxed">{it}</li>)}
        </ul>
      );
    case "code":
      return (
        <pre key={i} className="bg-muted text-xs font-mono p-3 rounded-md overflow-x-auto mb-3 whitespace-pre-wrap">
          {b.texto}
        </pre>
      );
    case "tabla":
      return (
        <div key={i} className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse border border-border">
            <thead>
              <tr className="bg-[#1E5128] text-white">
                {b.headers.map((h, k) => <th key={k} className="text-left px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.filas.map((row, r) => (
                <tr key={r} className={r % 2 ? "bg-muted/40" : ""}>
                  {row.map((c, k) => <td key={k} className="px-3 py-2 border-t border-border align-top">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "img":
      return (
        <figure key={i} className="my-4">
          <img src={`/docs/img/${b.src}`} alt={b.caption || ""} className="rounded-lg border border-border w-full max-w-2xl mx-auto" />
          {b.caption && <figcaption className="text-xs text-muted-foreground text-center mt-2 italic">{b.caption}</figcaption>}
        </figure>
      );
  }
}

export default function Ayuda() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return secciones;
    const ql = q.toLowerCase();
    return secciones.filter(s => {
      if (s.titulo.toLowerCase().includes(ql)) return true;
      return s.contenido.some(b =>
        ("texto" in b && b.texto?.toLowerCase().includes(ql)) ||
        ("items" in b && b.items?.some(i => i.toLowerCase().includes(ql))) ||
        ("headers" in b && (b.headers.join(" ") + " " + b.filas.flat().join(" ")).toLowerCase().includes(ql))
      );
    });
  }, [q]);

  return (
    <MainLayout title="Guía de Usuario">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1E5128] flex items-center gap-2">
              <BookOpen className="h-7 w-7" />
              {guia.titulo}
            </h1>
            <p className="text-muted-foreground mt-1">{guia.subtitulo} · {guia.version}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a href="/docs/Guia_Usuario_JBM_ERP.pdf" download>
                <Download className="h-4 w-4 mr-2" /> PDF
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/docs/Guia_Usuario_JBM_ERP.docx" download>
                <FileText className="h-4 w-4 mr-2" /> DOCX
              </a>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en la guía (ej: corte de caja, calibre, productor)..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contenido</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No se encontraron resultados para "{q}".
              </p>
            ) : (
              <Accordion type="multiple" defaultValue={[filtered[0]?.id]} className="w-full">
                {filtered.map((s) => (
                  <AccordionItem key={s.id} value={s.id}>
                    <AccordionTrigger className="text-left text-base font-semibold text-[#1E5128]">
                      {s.titulo}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2">
                        {s.contenido.map((b, i) => renderBloque(b, i))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
