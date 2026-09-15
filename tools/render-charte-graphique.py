#!/usr/bin/env python3
"""Regenerate docs/charte-graphique.pdf from its authoritative Markdown.
Requires reportlab and pypdf (available in the bundled Codex Python runtime).
"""
from pathlib import Path
from html import escape
import re
import textwrap
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/charte-graphique.md'
TARGET = ROOT / 'docs/charte-graphique.pdf'
PAGE_W, PAGE_H = 595.28, 841.89
BG = colors.HexColor('#020611')
TEXT = colors.HexColor('#F8FAFC')
MUTED = colors.HexColor('#C6D4E5')
CYAN = colors.HexColor('#67E8F9')
BORDER = colors.HexColor('#293D52')
PANEL = colors.HexColor('#0A1427')
FONT_ROOT = Path('/System/Library/Fonts/Supplemental')
# Fall back to a portable font installation when invoked outside macOS.
font_sets = [
    (FONT_ROOT / 'Arial.ttf', FONT_ROOT / 'Arial Bold.ttf', FONT_ROOT / 'Arial Italic.ttf'),
    (Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf')),
]
font_paths = next((row for row in font_sets if all(p.exists() for p in row)), None)
if not font_paths:
    raise SystemExit('Install Arial or DejaVu Sans before generating this PDF.')
for name, filename in zip(['NXT5Doc', 'NXT5DocBold', 'NXT5DocItalic'], font_paths):
    pdfmetrics.registerFont(TTFont(name, str(filename)))
pdfmetrics.registerFontFamily('NXT5Doc', normal='NXT5Doc', bold='NXT5DocBold', italic='NXT5DocItalic', boldItalic='NXT5DocBold')

body = ParagraphStyle('body', fontName='NXT5Doc', fontSize=9.2, leading=13.5, textColor=TEXT, spaceAfter=7, splitLongWords=True)
styles = {
    'body': body,
    'intro': ParagraphStyle('intro', parent=body, fontSize=8.3, leading=12, textColor=MUTED, spaceAfter=15),
    'h2': ParagraphStyle('h2', parent=body, fontName='NXT5DocBold', fontSize=18, leading=23, spaceBefore=8, spaceAfter=14, keepWithNext=True),
    'h3': ParagraphStyle('h3', parent=body, fontName='NXT5DocBold', fontSize=12.4, leading=17, textColor=CYAN, spaceBefore=15, spaceAfter=9, keepWithNext=True),
    'h4': ParagraphStyle('h4', parent=body, fontName='NXT5DocBold', fontSize=10.4, leading=14, textColor=colors.HexColor('#E879F9'), spaceBefore=12, spaceAfter=7, keepWithNext=True),
    'list': ParagraphStyle('list', parent=body, leftIndent=12, firstLineIndent=0, bulletIndent=0, spaceAfter=5),
    'cell': ParagraphStyle('cell', parent=body, fontSize=8.2, leading=11.7, spaceAfter=0),
    'headcell': ParagraphStyle('headcell', parent=body, fontName='NXT5DocBold', fontSize=8.4, leading=12, textColor=CYAN, spaceAfter=0),
    'code': ParagraphStyle('code', parent=body, fontSize=7.5, leading=10.5, textColor=MUTED, leftIndent=9, borderColor=BORDER, borderWidth=0.5, borderPadding=8, spaceBefore=5, spaceAfter=10),
}

def clean(value):
    return value.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-').replace('\u2212', '-')

def inline(value):
    value = escape(clean(value))
    value = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: '<link href="' + m.group(2) + '" color="#67E8F9">' + m.group(1) + '</link>', value)
    value = re.sub(r'`([^`]+)`', r'<font color="#A5F3FC">\1</font>', value)
    value = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', value)
    return value

raw = SOURCE.read_text()
version = re.search(r'^Version ([\d.]+)', raw, re.M).group(1)
metadata = f'NXT5 / Charte graphique {version} / 15 septembre 2026'
logo = ImageReader(str(ROOT / 'public/assets/nxt5-wordmark.png'))
logo_w, logo_h = logo.getSize()

def page_background(c, doc):
    c.saveState()
    c.setFillColor(BG); c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.drawImage(logo, 40, PAGE_H - 50, width=84, height=84 * logo_h/logo_w, mask='auto')
    c.setFillColor(MUTED); c.setFont('NXT5Doc', 7.5)
    c.drawRightString(PAGE_W - 40, PAGE_H - 35, 'CHARTE GRAPHIQUE / SITE WEB')
    c.setStrokeColor(BORDER); c.setLineWidth(0.6); c.line(40, PAGE_H - 62, PAGE_W - 40, PAGE_H - 62)
    c.restoreState()

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages = []
        self.setTitle(f'NXT5 - Charte graphique {version}')
        self.setAuthor('NXT5')
        self.setSubject('Référence complète du site - Discord et exports PNG communs - 15 septembre 2026')
    def showPage(self):
        self.pages.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        total = len(self.pages)
        for state in self.pages:
            self.__dict__.update(state)
            self.setStrokeColor(BORDER); self.setLineWidth(0.6); self.line(40, 38, PAGE_W - 40, 38)
            self.setFillColor(MUTED); self.setFont('NXT5Doc', 7.2)
            self.drawString(40, 24, metadata)
            self.drawRightString(PAGE_W - 40, 24, f'{self._pageNumber:02} / {total:02}')
            super().showPage()
        super().save()

story = [Spacer(1, 70)]
cover_title = ParagraphStyle('coverTitle', parent=body, fontName='NXT5DocBold', fontSize=36, leading=43, spaceAfter=22)
cover_intro = ParagraphStyle('coverIntro', parent=body, fontSize=15, leading=22, spaceAfter=18)
story += [Paragraph('Charte graphique', cover_title), Paragraph('Une référence commune pour chaque évolution du site.', cover_intro), Paragraph(f'VERSION {version} / 15 SEPTEMBRE 2026', styles['h3']), Spacer(1, 20)]
story += [Paragraph('Fond bleu nuit, accents cyan, bleu et fuchsia. Des données lisibles et des contrôles cohérents, du site aux publications Discord.', cover_intro), Spacer(1, 22)]
for title, content in [
    ('L’identité reste la même', 'Réutiliser les composants, les logos et les tokens existants. Les boutons gardent leurs angles de 2 px ; les champs et les panneaux restent arrondis.'),
    ('Les games circulent avec leur contexte', 'Réglages par équipe, aperçu avant publication, suivi des envois et lien vers la bonne game. Les données manquantes restent explicitement signalées.'),
    ('Un rendu PNG commun', 'La fiche d’une game partage ses données et ses opérations de dessin entre le navigateur et le serveur. Inter est chargée sous un alias dédié aux exports.'),
]:
    story += [Paragraph(title, styles['h3']), Paragraph(content, body)]
story += [Spacer(1, 20), Paragraph('Référence éditable : docs/charte-graphique.md<br/>Conserver AGENTS.md avec chaque checkout. Les consignes NXT5 ne remplacent pas le système de mise en page propre à Importer.', styles['intro']), PageBreak()]

lines = raw.splitlines()
i = 1
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1; continue
    if line.startswith('```'):
        code = []; i += 1
        while i < len(lines) and not lines[i].startswith('```'):
            code.extend(textwrap.wrap(clean(lines[i]), width=95, replace_whitespace=False, drop_whitespace=False) or [' ']); i += 1
        story.append(KeepTogether([Paragraph('<br/>'.join(escape(v).replace(' ', '&#160;') for v in code), styles['code'])]))
        i += 1; continue
    if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|\-]+\|$', lines[i+1].strip()):
        rows = []; j = i
        while j < len(lines) and lines[j].strip().startswith('|'):
            if j != i + 1:
                cells = [cell.strip() for cell in lines[j].strip().strip('|').split('|')]
                rows.append(cells)
            j += 1
        cols = max(len(row) for row in rows)
        fractions = [0.34, 0.66] if cols == 2 else [0.26, 0.27, 0.47] if cols == 3 else [1/cols]*cols
        values = [[Paragraph(inline(cell), styles['headcell' if n == 0 else 'cell']) for cell in row] for n,row in enumerate(rows)]
        table = Table(values, colWidths=[(PAGE_W-80)*v for v in fractions], repeatRows=1, hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PANEL),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),0.8,BORDER),('LINEBELOW',(0,1),(-1,-1),0.3,BORDER)]))
        story += [table, Spacer(1, 10)]; i = j; continue
    heading = re.match(r'^(#{2,4})\s+(.*)', line)
    if heading:
        level = len(heading.group(1))
        if level == 2 and heading.group(2).startswith(('3.', '4.')):
            story.append(PageBreak())
        story.append(Paragraph(inline(heading.group(2)), styles[f'h{level}'])); i += 1; continue
    if line.startswith('- '):
        value = re.sub(r'^\[ \]\s*', '', line[2:])
        story.append(Paragraph(inline(value), styles['list'], bulletText='•')); i += 1; continue
    paragraph = [line]; i += 1
    while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith(('#', '- ', '|', '```')):
        paragraph.append(lines[i].strip()); i += 1
    text = ' '.join(paragraph)
    story.append(Paragraph(inline(text), styles['intro'] if text.startswith('Version ') else body))

doc = SimpleDocTemplate(str(TARGET), pagesize=(PAGE_W,PAGE_H), leftMargin=40, rightMargin=40, topMargin=78, bottomMargin=54, title=f'NXT5 - Charte graphique {version}', author='NXT5', subject='Référence du site - Discord et exports PNG communs - 15 septembre 2026')
doc.build(story, onFirstPage=page_background, onLaterPages=page_background, canvasmaker=NumberedCanvas)
print(TARGET)
