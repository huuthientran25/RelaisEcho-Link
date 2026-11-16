# AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
"""Build data/osd575-cmp.json from the NASA OSDR OSD-575 comprehensive metabolic panel.

Input: LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv from https://osdr.nasa.gov (OSD-575, DOI 10.26030/mc5d-p710).
Usage: python3 scripts/build_osd575.py CMP.csv data/osd575-cmp.json [CARDIOVASCULAR_EvePanel.csv IMMUNE_EvePanel.csv [SERUM_AlamarPanel.csv URINE_AlamarPanel.csv]]
The last two (OSD-575 serum and OSD-656 urine NULISAseq panels) add the 'nulisa' summary.
The two optional files (LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv and
LSDS-8_Multiplex_serum_immune_EvePanel_TRANSFORMED.csv) add inflammation markers. They have no lab
reference range, so only each person's own pre-flight range is shown for them.
Race based eGFR columns are left out on purpose: race based kidney equations are no longer recommended.
"""
import csv, json, re, sys

ANALYTES = [
    # key prefix in the CSV, display name, unit
    ('glucose', 'Glucose', 'mg/dL'),
    ('calcium', 'Calcium', 'mg/dL'),
    ('sodium', 'Sodium', 'mmol/L'),
    ('potassium', 'Potassium', 'mmol/L'),
    ('chloride', 'Chloride', 'mmol/L'),
    ('carbon_dioxide', 'Carbon dioxide (bicarbonate)', 'mmol/L'),
    ('creatinine', 'Creatinine', 'mg/dL'),
    ('urea_nitrogen_bun', 'Urea nitrogen (BUN)', 'mg/dL'),
    ('albumin', 'Albumin', 'g/dL'),
    ('total_protein', 'Total protein', 'g/dL'),
    ('globulin', 'Globulin', 'g/dL'),
    ('alkaline_phosphatase', 'Alkaline phosphatase', 'U/L'),
    ('alt', 'ALT (liver enzyme)', 'U/L'),
    ('ast', 'AST (liver enzyme)', 'U/L'),
    ('total_bilirubin', 'Total bilirubin', 'mg/dL'),
]

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def main(src, dst):
    rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))
    cols = rows[0].keys()
    def col(prefix, kind):
        pats = {'value': [f'{prefix}_value'], 'min': [f'{prefix}_range_min'], 'max': [f'{prefix}_range_max', f'{prefix}_max']}[kind]
        for c in cols:
            if any(c.startswith(p) for p in pats):
                return c
        raise KeyError(f'{prefix} {kind}')
    out = {'source': 'NASA OSDR OSD-575 (SpaceX Inspiration4, LSDS-8), comprehensive metabolic panel, Quest Diagnostics',
           'doi': '10.26030/mc5d-p710', 'publication': 'Overbey et al. 2024, Nature, doi 10.1038/s41586-024-07639-y',
           'timepoints': ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194'],
           'crew': ['C001', 'C002', 'C003', 'C004'], 'analytes': []}
    for key, name, unit in ANALYTES:
        cv, cmin, cmax = col(key, 'value'), col(key, 'min'), col(key, 'max')
        series = {c: [None] * len(out['timepoints']) for c in out['crew']}
        lo = hi = None
        for r in rows:
            m = re.match(r'(C\d{3})_serum_([LR][+-]\d+)', r['Sample Name'])
            if not m:
                continue
            crew, tp = m.groups()
            series[crew][out['timepoints'].index(tp)] = num(r[cv])
            lo = num(r[cmin]) if lo is None else lo
            hi = num(r[cmax]) if hi is None else hi
        out['analytes'].append({'key': key, 'name': name, 'unit': unit, 'rangeMin': lo, 'rangeMax': hi, 'series': series})
    out['ai_disclosure'] = "Values are from the cited NASA dataset; this summary file was produced by a script written with Claude (Anthropic), an AI tool, under the team's direction. See AI_DISCLOSURE.md."
    json.dump(out, open(dst, 'w'), indent=1)
    print(f'wrote {dst}: {len(out["analytes"])} analytes')

MULTIPLEX = [
    # file index (0 cardiovascular, 1 immune), column prefix, display name, unit, column unit suffix
    (0, 'crp', 'CRP (C-reactive protein)', 'pg/mL'),
    (0, 'fibrinogen', 'Fibrinogen', 'ng/mL'),
    (0, 'haptoglobin', 'Haptoglobin', 'ng/mL'),
    (0, 'agp', 'Alpha-1 acid glycoprotein', 'ng/mL'),
    (0, 'sap', 'Serum amyloid P', 'pg/mL'),
    (1, 'il_6', 'IL-6', 'pg/mL'),
    (1, 'il_8', 'IL-8', 'pg/mL'),
    (1, 'il_10', 'IL-10', 'pg/mL'),
    (1, 'tnfα', 'TNF-alpha', 'pg/mL'),
    (1, 'ifnγ', 'Interferon gamma', 'pg/mL'),
    (1, 'mcp_1', 'MCP-1', 'pg/mL'),
    (1, 'ip_10', 'IP-10', 'pg/mL'),
]

def add_multiplex(out, paths):
    tables = [list(csv.DictReader(open(p, encoding='utf-8-sig'))) for p in paths]
    for fi, prefix, name, unit in MULTIPLEX:
        rows = tables[fi]
        col = next(c for c in rows[0].keys() if c.startswith(prefix + '_concentration'))
        series = {c: [None] * len(out['timepoints']) for c in out['crew']}
        for r in rows:
            m = re.match(r'(C\d{3})_serum_([LR][+-]\d+)', r.get('Sample Name') or r.get('Sample ID') or '')
            if not m:
                continue
            crew, tp = m.groups()
            if tp in out['timepoints']:
                series[crew][out['timepoints'].index(tp)] = num(r[col])
        panel = 'Inflammation, cardiovascular panel (Eve Technologies)' if fi == 0 else 'Inflammation, immune panel (Eve Technologies)'
        out['analytes'].append({'key': prefix, 'name': name, 'unit': unit, 'rangeMin': None, 'rangeMax': None, 'panel': panel, 'series': series})

# NULISAseq (Alamar) panels: serum OSD-575 and urine OSD-656. NPQ values are log2. Each crew member's
# change is against their own preflight mean; the median change of the whole panel for that person and
# time point is subtracted (panel shift). Same method as the team's CSHRS analysis. Exploratory, n 3 or 4.
NUL_PRE = ['L-92', 'L-44', 'L-3']
NUL_POST = ['R+1', 'R+45', 'R+82', 'R+194']
NUL_TARGETS = {'il6': 'IL-6 (inflammation)', 'cxcl8': 'IL-8 / CXCL8 (neutrophil signal)', 'mpo': 'MPO (neutrophil enzyme)', 'mmp8': 'MMP-8 (neutrophil enzyme)',
               'bdnf': 'BDNF (brain growth factor)', 'gfap': 'GFAP (astrocyte marker)', 'tnf': 'TNF (inflammation)', 'vsnl1': 'VSNL1 (neuron protein)'}


def _median(v):
    v = sorted(v); n = len(v)
    return None if not n else (v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2)


def nulisa_panel(path, fluid):
    rows = list(csv.DictReader(open(path, encoding='utf-8-sig')))
    idc = list(rows[0].keys())[0]
    cols = [c for c in rows[0].keys() if c and c.endswith('_concentration_npq')]
    val = {}  # (crew, tp, target) -> npq
    for r in rows:
        m = re.match(r'(C00\d)_(\w+?)_(.+)$', (r[idc] or '').strip())
        if not m:
            continue
        crew, tp = m.group(1), m.group(3)
        for c in cols:
            x = num(r[c])
            if x is not None:
                val[(crew, tp, c[:-len('_concentration_npq')])] = x
    crews = sorted({k[0] for k in val}); targets = sorted({k[2] for k in val})
    base = {}
    for c in crews:
        for t in targets:
            pre = [val[(c, tp, t)] for tp in NUL_PRE if (c, tp, t) in val]
            if pre:
                base[(c, t)] = sum(pre) / len(pre)
    delta = {k: v - base[(k[0], k[2])] for k, v in val.items() if (k[0], k[2]) in base}
    shift = {}
    for c in crews:
        for tp in NUL_PRE + NUL_POST:
            ds = [d for (cc, tt, _), d in delta.items() if cc == c and tt == tp]
            if ds:
                shift[(c, tp)] = _median(ds)
    adj = {k: d - shift[(k[0], k[1])] for k, d in delta.items()}
    r1 = sorted(((t, _median([adj[(c, 'R+1', t)] for c in crews if (c, 'R+1', t) in adj])) for t in targets
                 if any((c, 'R+1', t) in adj for c in crews)), key=lambda x: -x[1])
    rank = {t: i + 1 for i, (t, _) in enumerate(r1)}
    order = NUL_PRE + NUL_POST
    out = {'fluid': fluid, 'crew': crews, 'samples': {c: sorted({k[1] for k in val if k[0] == c}, key=lambda t: order.index(t) if t in order else 99) for c in crews},
           'targets_on_panel': len(targets), 'markers': []}
    for t, label in NUL_TARGETS.items():
        if t not in targets:
            continue
        vals = [v for k, v in val.items() if k[2] == t]
        m = {'id': t, 'label': label, 'zeros': sum(1 for v in vals if v == 0), 'values': len(vals), 'by_time': []}
        if t in rank:
            m['rank_r1_rise'] = rank[t]
        for tp in NUL_POST:
            xs = [(c, adj[(c, tp, t)]) for c in crews if (c, tp, t) in adj]
            if not xs:
                continue
            m['by_time'].append({'time': tp, 'n': len(xs), 'up': sum(1 for _, a in xs if a > 0), 'down': sum(1 for _, a in xs if a < 0),
                                 'median_fold': round(2 ** _median([a for _, a in xs]), 2), 'fold_by_crew': {c: round(2 ** a, 2) for c, a in xs}})
        out['markers'].append(m)
    return out


def add_nulisa(out, serum_path, urine_path):
    out['nulisa'] = {
        'title': 'Inspiration4 NULISAseq inflammation and brain panels, serum and urine',
        'sources': [{'id': 'OSD-575', 'doi': '10.26030/mc5d-p710', 'file': 'LSDS-8_Multiplex_serum.immune.AlamarPanel_TRANSFORMED.csv', 'fluid': 'serum'},
                    {'id': 'OSD-656', 'doi': '10.26030/7cax-yj10', 'file': 'LSDS-64_Multiplex_urine.immune.AlamarPanel_TRANSFORMED.csv', 'fluid': 'urine'}],
        'method': "NPQ (log2) change against each crew member's own preflight mean (L-92, L-44, L-3), minus the median change of the whole panel for that sample. Fold = 2 to the power of that change. Exploratory, n of 3 or 4, no p values.",
        'panels': [nulisa_panel(serum_path, 'serum'), nulisa_panel(urine_path, 'urine')],
    }


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
    if len(sys.argv) >= 5:
        out = json.load(open(sys.argv[2]))
        for a in out['analytes']:
            a.setdefault('panel', 'Comprehensive metabolic panel (Quest Diagnostics)')
        add_multiplex(out, sys.argv[3:5])
        out['ai_disclosure'] = "Values are from the cited NASA dataset; this summary file was produced by a script written with Claude (Anthropic), an AI tool, under the team's direction. See AI_DISCLOSURE.md."
        if len(sys.argv) >= 7:
            add_nulisa(out, sys.argv[5], sys.argv[6])
            print('added NULISAseq serum and urine summaries')
        json.dump(out, open(sys.argv[2], 'w'), indent=1, ensure_ascii=False)
        print(f'added multiplex: {len(out["analytes"])} analytes total')
