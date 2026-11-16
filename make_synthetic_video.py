# AI-assisted (SI-generated) code: written with Claude (Anthropic) under the team's direction; all creative decisions by the team. See AI_DISCLOSURE.md.
# Synthetic test video for the browser pipeline: a skin patch with a 72 bpm colour pulse and torso stripes moving at 15 breaths/min.
# Usage: python3 scripts/make_synthetic_video.py synth.y4m   (needs numpy). Not human data; it checks the code path, not accuracy on people.
import numpy as np, sys
W, H, FPS, SEC = 320, 240, 30, 40
BPM, RPM = 72, 15
rng = np.random.default_rng(1)
yy, xx = np.mgrid[0:H, 0:W]
face = ((xx - 0.5 * W) / (0.12 * W)) ** 2 + ((yy - 0.38 * H) / (0.2 * H)) ** 2 <= 1
out = open(sys.argv[1], 'wb')
out.write(f'YUV4MPEG2 W{W} H{H} F{FPS}:1 Ip A1:1 C420jpeg\n'.encode())
for n in range(FPS * SEC):
    t = n / FPS
    p = np.sin(2 * np.pi * BPM / 60 * t) + 0.3 * np.sin(4 * np.pi * BPM / 60 * t + 0.6)
    img = np.full((H, W, 3), 120.0)
    off = 2.5 * np.sin(2 * np.pi * RPM / 60 * t)
    torso = yy >= 0.62 * H
    stripe = 60 + 50 * (np.sin(2 * np.pi * (yy - off) / 14.0) > 0)
    img[torso] = np.stack([stripe, stripe, stripe + 10], -1)[torso]
    img[face] = [180 + 0.25 * p, 130 + 0.7 * p, 110 + 0.15 * p]
    img += rng.uniform(-1.5, 1.5, img.shape)
    R, G, B = img[..., 0], img[..., 1], img[..., 2]
    Y = 0.299 * R + 0.587 * G + 0.114 * B
    U = -0.168736 * R - 0.331264 * G + 0.5 * B + 128
    V = 0.5 * R - 0.418688 * G - 0.081312 * B + 128
    U = U.reshape(H // 2, 2, W // 2, 2).mean((1, 3)); V = V.reshape(H // 2, 2, W // 2, 2).mean((1, 3))
    out.write(b'FRAME\n')
    for c in (Y, U, V): out.write(np.clip(np.round(c), 0, 255).astype(np.uint8).tobytes())
out.close()
