# AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
"""Summarize NASA CFT70 bed rest aerobic capacity for the app (data/bedrest-vo2.json).

Source: NASA Life Sciences Portal, "Aerobic Capacity, Flight Analog" (PI Alan D. Moore Jr.),
doi 10.83263/w056-8t76, CFT70 files MR080G_CFT70_PRE_ALL and MR080G_CFT70_POST1_ALL (70 day head down
bed rest). Input: a table with one row per person (SUBJECT, GROUP, VO2PK_pre, VO2PK_post), made from those
files; three rows in the raw files are shifted one column and were corrected by hand before this step.
Raw files are not re-hosted (redistribution terms not confirmed); only these summaries ship.

Method: each person's peak oxygen uptake (L/min) on the first test after bed rest against their own test
before bed rest, in percent. Per group: people, median, quartiles, and how many lost more than 5%.
Usage: python3 scripts/build_vo2.py table.csv data/bedrest-vo2.json
"""
import csv, json, statistics, sys

def q(v, p):
    v = sorted(v); k = (len(v) - 1) * p; lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)

LABEL = {'CONTROL': 'Bed rest only', 'EXERCISE': 'Exercise', 'FLY': 'Flywheel exercise'}

def main(src, out):
    groups = {}
    with open(src, encoding='utf-8-sig', newline='') as fh:
        for r in csv.DictReader(fh):
            pre, post = float(r['VO2PK_pre']), float(r['VO2PK_post'])
            groups.setdefault(r['GROUP'].strip().upper(), []).append(100 * (post / pre - 1))
    res = {'source': 'NASA Life Sciences Portal, Aerobic Capacity, Flight Analog (PI Alan D. Moore Jr.), doi 10.83263/w056-8t76, CFT70 70 day bed rest',
           'method': "Peak oxygen uptake after bed rest against each person's own test before bed rest.",
           'groups': []}
    for g in ('CONTROL', 'EXERCISE', 'FLY'):
        v = groups.get(g, [])
        if not v:
            continue
        res['groups'].append({'id': g.lower(), 'label': LABEL[g], 'n': len(v), 'median_pct': round(statistics.median(v), 1),
                              'q1_pct': round(q(v, 0.25), 1), 'q3_pct': round(q(v, 0.75), 1), 'lost_over_5pct': sum(x < -5 for x in v)})
    res['people'] = sum(x['n'] for x in res['groups'])
    with open(out, 'w') as fh:
        res['ai_disclosure'] = "Values are from the cited NASA dataset; this summary file was produced by a script written with Claude (Anthropic), an AI tool, under the team's direction. See AI_DISCLOSURE.md."
        json.dump(res, fh, indent=1)
    print(json.dumps(res, indent=1))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
