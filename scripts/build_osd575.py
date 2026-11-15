"""Build data/osd575-cmp.json from the NASA OSDR OSD-575 comprehensive metabolic panel.

Input: LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv from https://osdr.nasa.gov (OSD-575, DOI 10.26030/mc5d-p710).
Usage: python3 scripts/build_osd575.py CMP.csv data/osd575-cmp.json [CARDIOVASCULAR_EvePanel.csv IMMUNE_EvePanel.csv]
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

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
    if len(sys.argv) >= 5:
        out = json.load(open(sys.argv[2]))
        for a in out['analytes']:
            a.setdefault('panel', 'Comprehensive metabolic panel (Quest Diagnostics)')
        add_multiplex(out, sys.argv[3:5])
        json.dump(out, open(sys.argv[2], 'w'), indent=1)
        print(f'added multiplex: {len(out["analytes"])} analytes total')
