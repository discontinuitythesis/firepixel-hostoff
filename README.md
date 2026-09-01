# Fire Pixel Host-Off fixture

This repository publishes a neutral, non-commercial and tracking-free static fixture used to compare hosting platforms. Every mirror receives the exact contents of `site/`.

The fixture is deliberately `noindex`, collects no personal data, and links to the canonical Fire Pixel website only for attribution.

## Live mirrors

- [Cloudflare Pages](https://firepixel-hostoff.pages.dev/) — static edge delivery
- [HostXNow](https://benluong.com/hostoff/) — shared LiteSpeed, Ryzen 9 9950X plan
- [MechanicWeb](https://unitcostdominance.com/hostoff/) — shared LiteSpeed, Ryzen 9 7950X
- [GitHub Pages](https://discontinuitythesis.github.io/firepixel-hostoff/) — static edge delivery
- [Hetzner CX43 through Cloudflare Tunnel](https://firepixel.co.uk/hostoff/) — 8 vCPU / 16 GB
- [Hetzner CX43 direct origin](https://hostoff.firepixel.co.uk/) — the same backend over DNS-only HTTPS
- [Hetzner CX23](http://178.105.83.180/hostoff/) — 2 vCPU / 4 GB, direct HTTP test endpoint

Build `2026-09-01.2` has homepage SHA-256 `02197b5844b06767fdc4d5225e36fe1e0d7dc807336bc095b44caa86104cb748` on every mirror above.

See [the first dated benchmark](RESULTS-2026-09-01.md) for repeated single-request timings, HTTP/2 burst results and full-page Lighthouse evidence. The Dell OptiPlex mirror remains to be added.
