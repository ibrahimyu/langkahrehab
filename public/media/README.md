# Media

Drop files here with these exact names; the app shows a placeholder until a file exists.

| Path | What | Spec |
|---|---|---|
| `patients/{id}.jpg` | Portrait of each made-up patient (`budi`, `sari`, `liem`, `tester`) | Square, 512 × 512, JPEG. Clearly fictional people. |
| `xray/{id}.png` | X-ray-style image with the amputation level marked | 3:4, 600 × 800, PNG. Without it, a drawn diagram is shown. |
| `exercises/{exerciseId}.mp4` | 10-second demonstration of each exercise (`bridging`, `side-lying-abduction`, `prone-hip-extension`, `sit-to-stand`) | 16:9 or 1:1, H.264, under 3 MB, no audio needed; loops. |
| `exercises/{exerciseId}.jpg` | Poster frame for each video | Same aspect as the video. |

Check generated people and videos before adding them: limbs, especially amputations, are often drawn wrong.
