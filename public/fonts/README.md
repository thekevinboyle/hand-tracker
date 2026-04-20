# Fonts

Self-hosted under CSP `font-src 'self'` per DR7 + D31.

- **Source**: https://github.com/JetBrains/JetBrainsMono v2.304
- **License**: SIL OFL-1.1 (see `LICENSE.txt`)
- **Subset ranges**: `U+0020-007E` (Basic Latin) + `U+00A0-00FF` (Latin-1 Supplement) + `U+0100-017F` (Latin Extended-A) + `U+2000-206F` (General Punctuation) + `U+20A0-20CF` (Currency) + `U+2190-2199` (Arrows subset) + `U+25A0-25FF` (Geometric Shapes subset)
- **Weights shipped**: 400 Regular, 500 Medium, 600 SemiBold
- **Ligatures**: stripped via `--layout-features-=liga,dlig,clig,calt`
- **Preloaded**: Medium (500) only — the default UI weight. Regular/SemiBold lazy-load on first use.

Regenerate via `pyftsubset` per the `jetbrains-mono-self-hosting` skill — do not fetch at build time.
