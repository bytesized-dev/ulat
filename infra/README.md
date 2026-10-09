# Field network setup

Goal: phones with no mobile data join the hub's Wi-Fi, open `https://hub.[your-domain]`, and get a trusted certificate so the camera, microphone, GPS and offline caching work. Do all of this before the storm, while there is internet.

## Before the storm

1. **Domain.** Use a subdomain of a domain the team owns, for example `hub.<team-domain>`.
2. **Certificate.** Get a Let's Encrypt certificate with a DNS challenge, which never needs the hub to be reachable from the internet:
   `certbot certonly --manual --preferred-challenges dns -d hub.<team-domain>`
   Add the TXT record it asks for at your DNS provider. Copy `fullchain.pem` and `privkey.pem` to `/etc/ulat/certs/`. Note the expiry date in Kit setup. Certificates last 90 days.
3. **Map, model and app.** `ollama pull gemma4:e4b`, install ffmpeg (`brew install ffmpeg`, or `winget install Gyan.FFmpeg` on Windows) so voice notes work, build the app, put the map files in `public/map`.

## In the field

1. Power the router from a power bank. Leave its internet port empty. Name the Wi-Fi `ULAT-HUB`.
2. In the router, reserve a fixed IP for the hub, for example `192.168.8.10`, and set the DHCP DNS server to that same IP.
3. On the hub, run dnsmasq with `infra/dnsmasq.conf`, Caddy with `infra/Caddyfile` and `HUB_DOMAIN=hub.<team-domain>`, and the app with `pnpm start -H 127.0.0.1`. Keep `-H 127.0.0.1`: it makes Caddy the only way in. The sign in limiter trusts the `X-Forwarded-For` header Caddy sets, and a phone that reached port 3000 directly could send its own.
   On Windows, where dnsmasq is not available, run one script instead: `.\infra\start.ps1 -HubDomain hub.<team-domain> -HubIp 192.168.8.10`. It starts a small DNS stub (`infra/dns-stub.mjs`), Caddy and the app (with `-H 127.0.0.1`). It uses `fullchain.pem` and `privkey.pem` from `-CertDir` (default `%ProgramData%\ulat\certs`), and falls back to Caddy's internal certificate when there are none. Press Ctrl+C to stop all three. Windows treats a router with no internet as a Public network, and its firewall prompt only allows Private networks by default, so phones cannot reach ports 53, 443 or 80. Set the Wi-Fi network to Private in Settings, Network and internet, Wi-Fi, or add firewall rules for those ports.
   On a Mac, run one script from the repo root: `sudo ./infra/start.sh hub.<team-domain> 192.168.8.10`. An optional third argument is the certificate folder (default `/etc/ulat/certs`). It starts dnsmasq with `infra/dnsmasq.conf` when dnsmasq is installed, or `infra/dns-stub.mjs` when it is not, then Caddy, then the app (with `-H 127.0.0.1`, building it first if there is no production build). It falls back to Caddy's internal certificate when the folder has no `fullchain.pem` and `privkey.pem`. Press Ctrl+C to stop all three. If it says `caddy not found`, run `brew install caddy`.
   - **Sudo.** Checked on macOS 27.0: a normal user can bind ports 53, 443 and 80 on all addresses, so Caddy alone needs no sudo. DNS binds the hub IP, and macOS refuses that without root (`bind EACCES 127.0.0.1:53`). So the script asks for sudo. It runs the build and the app as the user who called sudo, so `.next/` and `data/` stay yours. Without sudo it stops with that message.
   - **Firewall.** With the macOS firewall on, the first connection to Caddy shows "Do you want the application caddy to accept incoming network connections?". Click Allow, or phones cannot reach the hub. If you clicked Deny, change it in System Settings, Network, Firewall, Options. Do the same for dnsmasq or node if it asks.
   - With the internal certificate, the script keeps Caddy from adding its root to the Mac's keychain (`skip_install_trust` in the generated `tmp/Caddyfile`), because that asks for a password during startup. Browsers on the hub laptop itself will warn until you run `caddy trust`.
4. On a phone: turn off mobile data, join `ULAT-HUB`, open `https://hub.<team-domain>`.

## Phone gotchas

- Android: Private DNS set to automatic or a provider can bypass dnsmasq. Set it to Off for the demo phones.
- Some phones show "no internet" and switch back to mobile data. Keep mobile data off, or tap "stay connected".
- iPhone: Limit IP address tracking and iCloud Private Relay may interfere. Turn them off for the Wi-Fi network if the name does not resolve.

## If it fails

- **Certificate problems:** use `tls internal` in the Caddyfile and install Caddy's root certificate on the demo phones.
- **DNS problems:** stock phones can't edit their hosts file, so open the hub by IP address with the internal certificate.
- **Nothing works:** run plain HTTP on the IP, for example `http://192.168.8.10`. The `:80` site in the Caddyfile serves it, so it still goes through Caddy. Camera and microphone will not work in the browser, so families type or use the help desk, and responders use the photo file picker.
