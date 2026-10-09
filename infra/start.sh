#!/usr/bin/env bash
# Starts the hub network on macOS or Linux: DNS answer for the hub name, Caddy over HTTPS, and the app.
# Usage: sudo ./infra/start.sh hub.example.dev 192.168.8.10 [cert-dir]
# Run it with sudo: macOS only lets root bind port 53 on a specific IP. Under sudo the build and the app
# still run as the user who called sudo, so .next/, data/ and tmp/ do not end up owned by root.
# Same inputs as start.ps1. HUB_DOMAIN, HUB_IP, HUB_CERT_DIR and CADDY also work as environment variables.
# Without fullchain.pem and privkey.pem in the cert dir it falls back to Caddy's internal certificate.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: infra/start.sh [--no-app] <hub-domain> <hub-ip> [cert-dir]
  hub-domain  name phones open, for example hub.example.dev
  hub-ip      the hub's fixed IP, for example 192.168.8.10
  cert-dir    folder with fullchain.pem and privkey.pem (default /etc/ulat/certs)
  --no-app    start DNS and Caddy only
EOF
  exit 2
}

fail() {
  echo "start.sh: $1" >&2
  exit 1
}

with_app=1
args=()
for a in "$@"; do
  case "$a" in
    --no-app) with_app=0 ;;
    -h | --help) usage ;;
    -*) echo "start.sh: unknown option $a" >&2; usage ;;
    *) args+=("$a") ;;
  esac
done
[ "${#args[@]}" -le 3 ] || usage

hub_domain="${args[0]:-${HUB_DOMAIN:-}}"
hub_ip="${args[1]:-${HUB_IP:-}}"
cert_dir="${args[2]:-${HUB_CERT_DIR:-/etc/ulat/certs}}"

[ -n "$hub_domain" ] && [ -n "$hub_ip" ] || usage
[[ "$hub_domain" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || { echo "start.sh: bad hub domain '$hub_domain'" >&2; usage; }
[[ "$hub_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo "start.sh: bad hub IP '$hub_ip'" >&2; usage; }
for octet in ${hub_ip//./ }; do
  [ "$((10#$octet))" -le 255 ] || { echo "start.sh: bad hub IP '$hub_ip'" >&2; usage; }
done

infra="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$infra")"

caddy="${CADDY:-$(command -v caddy || true)}"
[ -n "$caddy" ] && [ -x "$caddy" ] || fail "caddy not found. Install it with: brew install caddy"
command -v node >/dev/null || fail "node not found."
if [ "$with_app" = 1 ]; then
  command -v pnpm >/dev/null || fail "pnpm not found."
fi

# dnsmasq lives in sbin, which is often not on PATH.
dnsmasq="$(PATH="$PATH:/opt/homebrew/sbin:/usr/local/sbin" command -v dnsmasq || true)"

dns_port="${DNS_PORT:-53}"
as_user=()
if [ "$(id -u)" = 0 ]; then
  [ -z "${SUDO_USER:-}" ] || as_user=(sudo -u "$SUDO_USER" -H env "PATH=$PATH")
elif [ "$dns_port" -lt 1024 ]; then
  fail "DNS needs port $dns_port on $hub_ip, which needs root. Run: sudo $0 $*"
fi

full="$cert_dir/fullchain.pem"
key="$cert_dir/privkey.pem"
skip_trust=0
if [ -f "$full" ] && [ -f "$key" ]; then
  echo "Certificate: $full"
  tls_line="tls \"$full\" \"$key\""
else
  echo "No certificate in $cert_dir, using Caddy's internal certificate. Phones must trust its root."
  tls_line="tls internal"
  skip_trust=1
fi

# Run files go in tmp/, which git ignores. infra/Caddyfile and infra/dnsmasq.conf stay as they are.
tmp="$root/tmp"
mkdir -p "$tmp"
caddyfile="$tmp/Caddyfile"
# With the internal certificate Caddy would also try to add its root to the Mac's keychain through sudo,
# which prompts for a password in the middle of startup. Phones install the root by hand anyway.
TLS_LINE="$tls_line" SKIP_TRUST="$skip_trust" awk '
  /^\{[[:space:]]*$/ && !opened { print; opened = 1; if (ENVIRON["SKIP_TRUST"] == "1") print "\tskip_install_trust"; next }
  /^[[:space:]]*tls \/etc\/ulat\/certs\/fullchain\.pem \/etc\/ulat\/certs\/privkey\.pem[[:space:]]*$/ { print "\t" ENVIRON["TLS_LINE"]; swapped = 1; next }
  { print }
  END { exit swapped ? 0 : 1 }
' "$infra/Caddyfile" >"$caddyfile" || fail "infra/Caddyfile has no tls line to swap. Update the pattern in start.sh."

# Under sudo the files above belong to root. Hand them back so a normal run can overwrite them.
own_tmp() {
  if [ "$(id -u)" = 0 ] && [ -n "${SUDO_USER:-}" ]; then chown -R "$SUDO_USER" "$tmp" 2>/dev/null || true; fi
}

export HUB_DOMAIN="$hub_domain"
export HUB_IP="$hub_ip"

pids=()
names=()
stopping=0

# Kill a process and everything it started. pnpm and next both leave children behind.
descendants() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do
    descendants "$child"
    echo "$child"
  done
}

cleanup() {
  [ "$stopping" = 0 ] || return 0
  stopping=1
  trap '' INT TERM
  local all=() pid p
  for pid in ${pids[@]+"${pids[@]}"}; do
    for p in $(descendants "$pid"); do all+=("$p"); done
    all+=("$pid")
  done
  [ "${#all[@]}" -gt 0 ] || { own_tmp; return 0; }
  kill -TERM "${all[@]}" 2>/dev/null || true
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    local alive=0
    for p in "${all[@]}"; do kill -0 "$p" 2>/dev/null && alive=1; done
    [ "$alive" = 1 ] || break
    sleep 0.5
  done
  kill -KILL "${all[@]}" 2>/dev/null || true
  own_tmp
  echo "Stopped."
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start() {
  local name="$1"
  shift
  "$@" &
  pids+=("$!")
  names+=("$name")
}

"$caddy" validate --config "$caddyfile" --adapter caddyfile >/dev/null 2>&1 \
  || fail "Caddy rejects $caddyfile. Run: $caddy validate --config $caddyfile --adapter caddyfile"

# prerender-manifest.json is written at the end of a build. BUILD_ID also exists after a failed one.
# next build and next start need NODE_ENV=production, and a shell may export development.
if [ "$with_app" = 1 ] && [ ! -f "$root/.next/prerender-manifest.json" ]; then
  echo "No production build found, running pnpm build first."
  (cd "$root" && ${as_user[@]+"${as_user[@]}"} env NODE_ENV=production pnpm build) || fail "pnpm build failed."
fi

if [ -n "$dnsmasq" ]; then
  # dnsmasq.conf has its own domain and IP, so swap in this run's values.
  dnsconf="$tmp/dnsmasq.conf"
  sed -e "s|^listen-address=.*|listen-address=$hub_ip|" \
      -e "s|^address=/.*|address=/$hub_domain/$hub_ip|" \
      "$infra/dnsmasq.conf" >"$dnsconf"
  echo "DNS: dnsmasq ($dnsmasq)"
  start dnsmasq "$dnsmasq" --keep-in-foreground --conf-file="$dnsconf" --pid-file="$tmp/dnsmasq.pid" --port="$dns_port"
else
  echo "DNS: dnsmasq not installed, using infra/dns-stub.mjs"
  start dns-stub node "$infra/dns-stub.mjs"
fi

own_tmp
start caddy "$caddy" run --config "$caddyfile" --adapter caddyfile

if [ "$with_app" = 1 ]; then
  # shellcheck disable=SC2016 # $1 belongs to the inner bash, so it stays in single quotes.
  start app ${as_user[@]+"${as_user[@]}"} bash -c 'cd "$1" && NODE_ENV=production exec pnpm start -H 127.0.0.1' _ "$root"
fi

echo "Hub up: https://$hub_domain (DNS $hub_ip). Press Ctrl+C to stop."

# Stop everything if any one of the three dies, so the hub never runs half up.
# Waiting on a background sleep lets the INT and TERM traps run at once.
while :; do
  for i in "${!pids[@]}"; do
    if ! kill -0 "${pids[$i]}" 2>/dev/null; then
      echo "start.sh: ${names[$i]} stopped. Stopping the rest." >&2
      exit 1
    fi
  done
  sleep 1 &
  wait $! || true
done
