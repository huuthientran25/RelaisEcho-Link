# AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
# Original 30 second background track for the RelaisÉcho Link demo, synthesized from scratch with numpy
# (no samples, no outside audio). D major, 96 bpm, I-vi-IV-V, with an echoing arpeggio.
import numpy as np, wave
SR = 48000; DUR = 30.0; N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
f = lambda m: 440.0 * 2 ** ((m - 69) / 12)
beat = 60 / 96; chord_len = 4 * beat  # 2.5 s
prog = [[50, 54, 57, 62], [47, 50, 54, 59], [43, 47, 50, 55], [45, 49, 52, 57]]
chords = [prog[i % 4] for i in range(11)] + [prog[0]]  # 12 chords, last resolves to D

def env(n, a, r):
    e = np.ones(n); ai = min(n, int(a * SR)); ri = min(n, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai) ** 2
    e[n - ri:] *= np.linspace(1, 0, ri) ** 1.5
    return e

def add(sig, start, gain_l, gain_r):
    i = int(start * SR); j = min(N, i + len(sig))
    L[i:j] += sig[: j - i] * gain_l; R[i:j] += sig[: j - i] * gain_r

# Pad: detuned soft tones, slow swell
for k, ch in enumerate(chords):
    start = k * chord_len; length = chord_len + 0.6 if k < 11 else DUR - start
    n = int(length * SR); tt = np.arange(n) / SR
    s = np.zeros(n)
    for m in ch:
        for det in (-0.0018, 0.0018):
            fr = f(m + 12) * (1 + det)
            s += np.sin(2 * np.pi * fr * tt) + 0.18 * np.sin(2 * np.pi * 2 * fr * tt) + 0.06 * np.sin(2 * np.pi * 3 * fr * tt)
    s *= env(n, 0.9, 0.7) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.2 * tt + k)) / 8
    add(s, start, 0.55, 0.45 if k % 2 else 0.55)

# Bass from 5 s
for k, ch in enumerate(chords):
    start = k * chord_len
    if start < 5: continue
    n = int(min(chord_len, DUR - start) * SR); tt = np.arange(n) / SR
    fr = f(ch[0] - 12)
    s = (np.sin(2 * np.pi * fr * tt) + 0.25 * np.sin(2 * np.pi * 2 * fr * tt)) * env(n, 0.05, 0.3) * 0.32
    add(s, start, 0.5, 0.5)

# Arpeggio from 2.5 s, eighth notes, with ping-pong echo
pattern = [0, 1, 2, 3, 2, 1, 2, 3]
eighth = beat / 2
arp_l = np.zeros(N); arp_r = np.zeros(N)
for k, ch in enumerate(chords):
    for b in range(8):
        start = k * chord_len + b * eighth
        if start < 2.5 or start > 27.4: continue
        m = ch[pattern[b]] + 24
        n = int(0.9 * SR); tt = np.arange(n) / SR
        fr = f(m)
        s = (np.sin(2 * np.pi * fr * tt) + 0.3 * np.sin(2 * np.pi * 2 * fr * tt) * np.exp(-tt / 0.08)) * np.exp(-tt / 0.22)
        s[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
        acc = 0.11 if b in (0, 4) else 0.085
        i = int(start * SR); j = min(N, i + n)
        arp_l[i:j] += s[: j - i] * acc; arp_r[i:j] += s[: j - i] * acc
# echo: 3/8 note delay, alternating sides
d = int(3 * eighth * SR)
el = np.zeros(N); er = np.zeros(N); src = arp_l.copy()
for rep in range(1, 5):
    g = 0.42 ** rep
    sh = np.zeros(N); sh[d * rep:] = src[: N - d * rep] * g
    if rep % 2: er += sh
    else: el += sh
L += arp_l * 0.8 + el; R += arp_r * 0.8 + er

# Soft pulse (kick) on beats 1 and 3 from 10 s to 27.5 s
for k in range(int(DUR / beat)):
    start = k * beat
    if start < 10 or start >= 27.5 or k % 2: continue
    n = int(0.35 * SR); tt = np.arange(n) / SR
    fr = 50 + 70 * np.exp(-tt / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / 0.12) * 0.35
    add(s, start, 0.5, 0.5)

# Simple room: a few short, quiet delays
for dl, g in ((0.031, 0.25), (0.047, 0.2), (0.071, 0.15), (0.113, 0.1)):
    di = int(dl * SR)
    L[di:] += R[:-di] * g; R[di:] += L[:-di] * g * 0.9

# Master: fade in 0.8 s, fade out last 2.2 s, peak normalize to -3 dBFS
fade = np.ones(N)
fi = int(0.8 * SR); fade[:fi] = np.linspace(0, 1, fi)
fo = int(2.2 * SR); fade[N - fo:] = np.linspace(1, 0, fo) ** 1.6
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
g = 10 ** (-3 / 20) / peak
st = np.stack([L * g, R * g], axis=1)
pcm = (np.clip(st, -1, 1) * 32767).astype('<i2')
with wave.open('relaisecho_theme.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', peak)
