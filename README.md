# Fire Pixel Host-Off fixture

This repository publishes a neutral, non-commercial and tracking-free static fixture used to compare hosting platforms. Every mirror receives the exact contents of `site/`.

The fixture is deliberately `noindex`, collects no personal data, and links to the canonical Fire Pixel website only for attribution.

Two fixtures separate different parts of hosting performance:

- `/` is the small 6 KB control page for connection, response-time and concurrency tests.
- `/full/` is a faithful build of the Fire Pixel homepage with its real responsive image, CSS and fonts. Third-party analytics are removed so the host—not Google Tag Manager, CookiePal or Clarity—is what the test measures. Its manifest records every byte and SHA-256 hash.

## Live mirrors

- [Cloudflare Pages](https://firepixel-hostoff.pages.dev/) — static edge delivery
- [HostXNow](https://benluong.com/hostoff/) — shared LiteSpeed, Ryzen 9 9950X plan
- [MechanicWeb](https://unitcostdominance.com/hostoff/) — shared LiteSpeed, Ryzen 9 7950X
- [GitHub Pages](https://discontinuitythesis.github.io/firepixel-hostoff/) — static edge delivery
- [Hetzner CX43 through Cloudflare Tunnel](https://firepixel.co.uk/hostoff/) — 8 vCPU / 16 GB
- [Hetzner CX43 direct origin](https://hostoff.firepixel.co.uk/) — the same backend over DNS-only HTTPS
- [Hetzner CX23](http://178.105.83.180/hostoff/) — 2 vCPU / 4 GB, direct HTTP test endpoint

Control build `2026-09-01.2` has homepage SHA-256 `02197b5844b06767fdc4d5225e36fe1e0d7dc807336bc095b44caa86104cb748` on every mirror above.

Full visual build `2026-09-01.3` has homepage SHA-256 `35bbe17938a2da4c1fac521cdc0ec0bb19c196924cc8592bd34ec82f96f5f9e8` and manifest SHA-256 `9d7d14d5d3c9c0d533ec4ad3f822298fd077ca78db9c4e79e347c512c223c3ee`.

The visual build is live on every mirror above. Append `/full/` to each mirror URL; for the direct CX43 origin use [hostoff.firepixel.co.uk/full/](https://hostoff.firepixel.co.uk/full/). HostXNow was deployed through a temporary, directory-restricted FTPS account after its account-level SSH access refused connections; the temporary login was removed after the files were verified.

## Rebuild the visual fixture

With the production Fire Pixel build in the sibling `firepixel/dist` directory:

```sh
node scripts/build-full-homepage.mjs
```

The generator fails if the expected analytics or canonical markup changes, rewrites the asset paths for every mirror, and writes `site/full/manifest.json` for deployment verification.

See [the first dated benchmark](RESULTS-2026-09-01.md) for repeated single-request timings, HTTP/2 burst results and full-page Lighthouse evidence. The Dell OptiPlex mirror remains to be added.
