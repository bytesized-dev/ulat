# Field network setup

Goal: phones with no mobile data join the hub's Wi-Fi, open `https://hub.[your-domain]`, and get a trusted certificate so the camera, microphone, GPS and offline caching work. Do all of this before the storm, while there is internet.

## Before the storm

1. **Domain.** Use a subdomain of a domain the team owns, for example `hub.<team-domain>`.
2. **Certificate.** Get a Let's Encrypt certificate with a DNS challenge, which never needs the hub to be reachable from the internet:
   `certbot certonly --manual --preferred-challenges dns -d hub.<team-domain>`
   Add the TXT record it asks for at your DNS provider. Copy `fullchain.pem` and `privkey.pem` to `/etc/ulat/certs/`. Note the expiry date in Kit setup. Certificates last 90 days.
3. **Map, model and app.** `ollama pull gemma4:e4b`, build the app, put the map files in `public/map`.

## In the field

1. Power the router from a power bank. Leave its internet port empty. Name the Wi-Fi `ULAT-HUB`.
2. In the router, reserve a fixed IP for the hub, for example `192.168.8.10`, and set the DHCP DNS server to that same IP.
3. On the hub, run dnsmasq with `infra/dnsmasq.conf`, Caddy with `infra/Caddyfile` and `HUB_DOMAIN=hub.<team-domain>`, and the app with `pnpm start -H 127.0.0.1`. Keep `-H 127.0.0.1`: it makes Caddy the only way in. The sign in limiter trusts the `X-Forwarded-For` header Caddy sets, and a phone that reached port 3000 directly could send its own.
4. On a phone: turn off mobile data, join `ULAT-HUB`, open `https://hub.<team-domain>`.

## Phone gotchas

- Android: Private DNS set to automatic or a provider can bypass dnsmasq. Set it to Off for the demo phones.
- Some phones show "no internet" and switch back to mobile data. Keep mobile data off, or tap "stay connected".
- iPhone: Limit IP address tracking and iCloud Private Relay may interfere. Turn them off for the Wi-Fi network if the name does not resolve.

## If it fails

- **Certificate problems:** use `tls internal` in the Caddyfile and install Caddy's root certificate on the demo phones.
- **DNS problems:** stock phones can't edit their hosts file, so open the hub by IP address with the internal certificate.
- **Nothing works:** run plain HTTP on the IP, for example `http://192.168.8.10`. The `:80` site in the Caddyfile serves it, so it still goes through Caddy. Camera and microphone will not work in the browser, so families type or use the help desk, and responders use the photo file picker.
