import React, { useEffect, useRef, useState } from "react";
import { Download, Eye, FileImage, FileSpreadsheet, Loader2, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Badge, Button, PageHeader, SelectInput, Surface } from "../../components/ui/Core.jsx";
import { createExportExample, EXPORT_TEMPLATES } from "./export-examples.js";
import "./exports-page.css";

// Share only work in progress (including React's development effect replay).
// Object URLs belong to each mounted card and are released on departure.
const pendingExamples = new Map();
function prepareExample(id) {
  if (!pendingExamples.has(id)) {
    const task = Promise.resolve().then(() => createExportExample(id));
    pendingExamples.set(id, task);
    const release = () => { if (pendingExamples.get(id) === task) pendingExamples.delete(id); };
    task.then(release, release);
  }
  return pendingExamples.get(id);
}

function ExportCard({ template, hidden, onPreview }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    let url;
    setState({ status: "loading" });
    prepareExample(template.id).then(example => {
      if (cancelled) return;
      url = URL.createObjectURL(example.blob);
      setState({ status: "ready", example: { ...example, url } });
    }).catch(() => {
      if (!cancelled) setState({ status: "error" });
    });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [template.id, attempt]);
  const example = state.example;
  const isImage = template.format === "PNG";
  const openPreview = event => onPreview({ template, example, opener: event.currentTarget });
  return <article hidden={hidden} className="export-catalog-item" aria-labelledby={`export-title-${template.id}`}>
    <Surface className="export-catalog-surface">
      <div className="export-card-heading"><div><p className="export-source">{template.source}</p><h3 id={`export-title-${template.id}`}>{template.title}</h3></div><Badge tone={isImage ? "cyan" : "purple"}>{template.format}</Badge></div>
      <p className="export-card-description">{template.description}</p>
      <div className="export-card-preview">
        {state.status === "loading" && <div className="export-preview-state" role="status"><Loader2 size={24} className="export-preview-spinner" aria-hidden="true" /><span>Préparation de l’aperçu…</span></div>}
        {state.status === "error" && <div className="export-preview-state" role="alert"><FileImage size={28} aria-hidden="true" /><p>L’aperçu n’a pas pu être généré.</p><Button type="button" variant="ghost" icon={RefreshCw} onClick={() => setAttempt(value => value + 1)}>Réessayer</Button></div>}
        {example && <button type="button" className="export-preview-button" aria-label={`Agrandir : ${template.title}`} onClick={openPreview}>
          {isImage ? <img src={example.url} width={example.width} height={example.height} alt={`Modèle ${template.title}, généré avec des données fictives`} /> : <div className="export-csv-cover"><FileSpreadsheet size={32} aria-hidden="true" /><strong>Rapport de fréquentation</strong><span>Colonnes et valeurs du fichier CSV</span><pre aria-hidden="true">{example.csvText}</pre></div>}
          <span className="export-preview-hint"><Eye size={16} aria-hidden="true" />Agrandir l’aperçu</span>
        </button>}
      </div>
      <div className="export-card-footer"><span>{example ? isImage ? `${example.width} × ${example.height} px` : "CSV · UTF-8" : template.format}<small>{isImage ? "Une image, tout le contenu" : "Compatible tableur"}</small></span><Button type="button" variant="ghost" icon={Eye} disabled={!example} onClick={openPreview}>Voir le modèle</Button></div>
    </Surface>
  </article>;
}

function ExportPreviewDialog({ selection, onClose }) {
  const dialog = useRef(null);
  const [actualSize, setActualSize] = useState(false);
  const { template, example } = selection;
  const isImage = template.format === "PNG";
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (selection.opener?.isConnected) selection.opener.focus();
    };
  }, [selection]);
  return <dialog ref={dialog} className="export-dialog" aria-labelledby="export-dialog-title" aria-describedby="export-dialog-description" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="export-dialog-header"><div><p>{template.source}</p><h2 id="export-dialog-title">{template.title}</h2><p id="export-dialog-description">Modèle actuel · données fictives{isImage && ` · ${example.width} × ${example.height} px`}</p></div><Button type="button" variant="ghost" icon={X} aria-label="Fermer l’aperçu" onClick={onClose} autoFocus /></div>
    <div className="export-dialog-toolbar">{isImage && <Button type="button" variant="ghost" icon={actualSize ? ZoomOut : ZoomIn} aria-pressed={actualSize} onClick={() => setActualSize(value => !value)}>{actualSize ? "Adapter à l’écran" : "Taille réelle"}</Button>}<a className="export-download" href={example.url} download={example.filename}><Download size={16} aria-hidden="true" />Télécharger l’exemple {template.format}</a></div>
    <div className="export-dialog-body" tabIndex={0} role="region" aria-label={`Contenu de l’export ${template.title}`}>
      {isImage ? <img className={actualSize ? "export-image-actual" : "export-image-fit"} style={actualSize ? { width: example.width } : undefined} src={example.url} width={example.width} height={example.height} alt={`Export complet ${template.title} avec les données fictives de démonstration`} /> : <pre className="export-csv-full">{example.csvText}</pre>}
    </div>
  </dialog>;
}

export default function ExportsPage() {
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState("all");
  const [selection, setSelection] = useState(null);
  const categoryTemplates = EXPORT_TEMPLATES.filter(template => category === "all" || template.category === category);
  const imageCount = categoryTemplates.filter(template => template.format === "PNG").length;
  const csvCount = categoryTemplates.filter(template => template.format === "CSV").length;
  const isVisible = template => (category === "all" || template.category === category) && (filter === "all" || template.format === filter);
  const visibleCount = EXPORT_TEMPLATES.filter(isVisible).length;
  return <div className="exports-page">
    <PageHeader eyebrow="Configuration · Bibliothèque" title="Exports" subtitle="Retrouve les modèles d’export du site et du bot Discord, ouvre chaque aperçu en grand et télécharge un exemple." />
    <div className="exports-intro"><FileImage size={21} aria-hidden="true" /><p><strong>Les modèles actuels, avec des données fictives.</strong><span>Les aperçus utilisent les rendus des exports du site et des images publiées par le bot Discord.</span></p></div>
    <div className="exports-category"><SelectInput label="Catégorie" aria-label="Catégorie" value={category} onChange={value => { setCategory(value); setFilter("all"); }}>
      <option value="all">Toutes les catégories ({EXPORT_TEMPLATES.length})</option>
      <option value="site">Site ({EXPORT_TEMPLATES.filter(template => template.category === "site").length})</option>
      <option value="bot">Bot Discord ({EXPORT_TEMPLATES.filter(template => template.category === "bot").length})</option>
    </SelectInput></div>
    {category === "bot" && <p className="exports-category-note">Les images jointes aux publications et aux tests de connexion du bot. Les bilans, rappels et reviews sont des messages Discord.</p>}
    <div className="exports-toolbar"><div role="group" aria-label="Formats d’export" className="exports-filters">{[["all", `Tous (${categoryTemplates.length})`], ...(imageCount ? [["PNG", `Images PNG (${imageCount})`]] : []), ...(csvCount ? [["CSV", `Données CSV (${csvCount})`]] : [])].map(([value, label]) => <Button key={value} type="button" variant="ghost" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</Button>)}</div><span className="exports-count" aria-live="polite">{visibleCount} {visibleCount === 1 ? "modèle affiché" : "modèles affichés"}</span></div>
    <section className="exports-catalog" aria-label="Modèles d’export">{EXPORT_TEMPLATES.map(template => <ExportCard key={template.id} template={template} hidden={!isVisible(template)} onPreview={setSelection} />)}</section>
    {selection && <ExportPreviewDialog selection={selection} onClose={() => setSelection(null)} />}
  </div>;
}
