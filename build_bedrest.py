# AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
"""Summarize NASA bed rest plasma volume for the app (data/bedrest-pv.json).

Source: NASA Life Sciences Portal, "Bed Rest Standard Measures: Plasma Volume" (PI Steven Platts),
doi 10.83263/4dzb-2267. Download the dataset yourself and pass its folder; raw files are not
re-hosted in this repository (redistribution terms not confirmed), only these summaries.

Method: each person's change from their OWN mean pre bed rest plasma volume, in percent, binned by
bed rest day. For each bin: people, median change, quartiles, and how many sat below their own
lowest pre bed rest value.
Usage: python3 scripts/build_bedrest.py /path/to/unzipped_folder data/bedrest-pv.json
"""
import csv, json, os, statistics, sys

def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None

def rows(folder):
    for root, _, files in os.walk(folder):
        for f in files:
            if f.endswith('.md5sum'):
                continue
            with open(os.path.join(root, f), encoding='utf-8-sig', newline='') as fh:
                for r in csv.DictReader(fh):
                    pv = num(r.get('Pvtot_l') or r.get('PVtot (L)') or r.get('Plasma Vol'))
                    day = num(r.get('BR_Day'))
                    subj = (r.get('Subject') or '').strip()
                    camp = (r.get('Campaign') or '').strip()[:2] or ('CFT70' if 'CFT70' in root else 'C1')
                    phase = (r.get('Test_Phase') or '').strip()
                    if pv and subj and phase in ('PRE_TEST', 'IN_TEST', 'POST_TEST') and day is not None:
                        yield {'campaign': camp, 'subject': f'{camp}:{subj}', 'phase': phase, 'day': day, 'pv': pv}

BINS = [('Days 1 to 7', 1, 7), ('Days 8 to 21', 8, 21), ('Days 22 to 45', 22, 45), ('Days 46 to 90', 46, 90)]

def q(v, p):
    v = sorted(v)
    k = (len(v) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)

def main(folder, out):
    data = list(rows(folder))
    people = {}
    for r in data:
        people.setdefault(r['subject'], []).append(r)
    pre = {s: [r['pv'] for r in rs if r['phase'] == 'PRE_TEST'] for s, rs in people.items()}
    pre = {s: v for s, v in pre.items() if v}
    def summary(label, pick):
        pct, below = [], 0
        for s, rs in people.items():
            if s not in pre:
                continue
            vals = [r['pv'] for r in rs if pick(r)]
            if not vals:
                continue
            v = statistics.median(vals)
            pct.append(100 * (v / statistics.mean(pre[s]) - 1))
            below += v < min(pre[s])
        if not pct:
            return None
        return {'label': label, 'n': len(pct), 'median_pct': round(statistics.median(pct), 1), 'q1_pct': round(q(pct, 0.25), 1),
                'q3_pct': round(q(pct, 0.75), 1), 'below_own_pre_min': below}
    bins = [summary(lbl, lambda r, a=a, b=b: r['phase'] == 'IN_TEST' and a <= r['day'] <= b) for lbl, a, b in BINS]
    post = summary('After bed rest (days 0 to 3)', lambda r: r['phase'] == 'POST_TEST' and r['day'] <= 3)
    res = {
        'source': 'NASA Life Sciences Portal, Bed Rest Standard Measures: Plasma Volume (PI Steven Platts), doi 10.83263/4dzb-2267',
        'method': "Each person's plasma volume against their own mean before bed rest; median of their values in each window.",
        'people': len(pre), 'campaigns': sorted({r['campaign'] for r in data}),
        'bins': [b for b in bins if b] + ([post] if post else []),
    }
    with open(out, 'w') as fh:
        res['ai_disclosure'] = "Values are from the cited NASA dataset; this summary file was produced by a script written with Claude (Anthropic), an AI tool, under the team's direction. See AI_DISCLOSURE.md."
        json.dump(res, fh, indent=1)
    print(json.dumps(res, indent=1))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
