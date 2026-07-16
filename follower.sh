#!/usr/bin/env bash
#
# Prisma Follower installer.
#   curl -sL https://www.prisma-capital.xyz/follower.sh | sudo bash
#
# Installs Docker and starts trading YOUR IBKR account to match Prisma's daily
# signals. The follower app is delivered as an encrypted archive unlocked by
# your feed key (the same one that unlocks the signals). Nothing about Prisma is
# public, and everything you enter stays on THIS server (root-only).
#
set -euo pipefail

ENC_URL="https://www.prisma-capital.xyz/follower.enc"
INSTALL_DIR="/opt/prisma-follower"
TTY=/dev/tty

say()  { printf "\n\033[1;36m==>\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ok\033[0m %s\n" "$*"; }
ask()  { local p="$1" d="${2:-}" v; if [ -n "$d" ]; then printf "%s [%s]: " "$p" "$d" >"$TTY"; else printf "%s: " "$p" >"$TTY"; fi; read -r v <"$TTY" || true; echo "${v:-$d}"; }
asks() { local p="$1" v; printf "%s: " "$p" >"$TTY"; read -rs v <"$TTY" || true; printf "\n" >"$TTY"; echo "$v"; }

if [ "$(id -u)" -ne 0 ]; then echo "Please run with sudo."; exit 1; fi

say "Prisma Follower installer"
printf "Have ready: your DEDICATED IBKR trading-access username/password + authenticator\n" >"$TTY"
printf "secret (created just for automation), the sub-account number for each strategy,\n" >"$TTY"
printf "your Telegram bot token, and the feed key from your Prisma client page.\n" >"$TTY"

# --- 1. Dependencies -------------------------------------------------------
say "Installing Docker (if needed)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl openssl tar >/dev/null
if ! command -v docker >/dev/null 2>&1; then apt-get install -y -qq docker.io >/dev/null; fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 || apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 || true
fi
systemctl enable --now docker >/dev/null 2>&1 || true
ok "Docker ready"

# --- 2. Feed key + fetch the (encrypted) follower --------------------------
say "Fetching the follower"
FEED_KEY=$(ask "Feed key (from your Prisma client page)")
mkdir -p "$INSTALL_DIR"
if ! curl -fsSL "$ENC_URL" -o /tmp/follower.enc; then
  echo "Could not download the follower. Check your connection and try again."; exit 1
fi
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass pass:"$FEED_KEY" -in /tmp/follower.enc \
     | tar -xzf - -C "$INSTALL_DIR"; then
  echo "Could not unlock the follower. Is your feed key correct?"; rm -f /tmp/follower.enc; exit 1
fi
rm -f /tmp/follower.enc
mkdir -p "$INSTALL_DIR/env" "$INSTALL_DIR/state"
ok "Installed in $INSTALL_DIR"

# --- 3. Questions ----------------------------------------------------------
say "A few questions"
# One or several strategies on this server — one IBKR sub-account each.
STRATS=""
while [ -z "$STRATS" ]; do
  RAW=$(ask "Strategies for this server, comma-separated (alpha / gamma / sigma)" "alpha")
  RAW=$(echo "$RAW" | tr 'A-Z' 'a-z' | tr -d ' ')
  STRATS=""; VALID=1
  IFS=',' read -ra _SARR <<< "$RAW"
  for s in "${_SARR[@]}"; do
    case "$s" in alpha|gamma|sigma) ;; *) printf "  '%s' is not a strategy (alpha/gamma/sigma)\n" "$s" >"$TTY"; VALID=0; break;; esac
    case ",$STRATS," in *",$s,"*) printf "  '%s' listed twice\n" "$s" >"$TTY"; VALID=0; break;; esac
    STRATS="${STRATS:+$STRATS,}$s"
  done
  [ "$VALID" = "1" ] || STRATS=""
done
N_STRATS=$(echo "$STRATS" | awk -F, '{print NF}')
MODE=""
while [ "$MODE" != "paper" ] && [ "$MODE" != "live" ]; do
  MODE=$(ask "Mode (paper / live) - start with paper" "paper"); MODE=$(echo "$MODE" | tr 'A-Z' 'a-z')
done
# Gateway internal API port (localhost inside the gateway, for its healthcheck):
# 4001 live / 4002 paper. Network API port the follower connects to (socat relay):
# 4003 live / 4004 paper.
if [ "$MODE" = "live" ]; then GW_PORT=4001; API_PORT=4003; else GW_PORT=4002; API_PORT=4004; fi

printf "Use the DEDICATED trading-access user you created for automation (its own\n" >"$TTY"
printf "password and authenticator) - never your main login, or the gateway gets\n" >"$TTY"
printf "kicked offline every time you open the IBKR app or website.\n" >"$TTY"
IB_USER=$(ask "IBKR trading-access username")
IB_PASS=$(asks "IBKR trading-access password")
TOTP=$(asks "Authenticator secret (base32, from IBKR 2FA setup)")
if [ "$N_STRATS" -gt 1 ]; then
  printf "One strategy = one IBKR sub-account (never mix two strategies in one\n" >"$TTY"
  printf "account). Your trading-access user needs access rights on each sub-account\n" >"$TTY"
  printf "(IBKR Settings > Users & Access Rights).\n" >"$TTY"
fi
IB_ACCTS=""
IFS=',' read -ra _SARR <<< "$STRATS"
for s in "${_SARR[@]}"; do
  while :; do
    A=$(ask "IBKR sub-account for '$s' (Uxxxxxxx)")
    A=$(echo "$A" | tr 'a-z' 'A-Z' | tr -d ' ')
    if [ -z "$A" ]; then printf "  required\n" >"$TTY"; continue; fi
    case ",$IB_ACCTS," in *",$A,"*) printf "  '%s' is already used by another strategy\n" "$A" >"$TTY"; continue;; esac
    break
  done
  IB_ACCTS="${IB_ACCTS:+$IB_ACCTS,}$A"
done
TG_TOKEN=$(ask "Telegram bot token")

# Telegram chat id: auto-detect from the message you sent your bot, else ask.
TG_CHAT=""
if [ -n "$TG_TOKEN" ]; then
  TG_CHAT=$(curl -s "https://api.telegram.org/bot${TG_TOKEN}/getUpdates" \
    | grep -o '"chat":{"id":[0-9-]*' | grep -o '[0-9-]*$' | tail -1 || true)
fi
if [ -n "$TG_CHAT" ]; then ok "Telegram chat detected ($TG_CHAT)"; else
  TG_CHAT=$(ask "Telegram chat id (send your bot a message first, then paste here)")
fi

# --- 4. Write config (root-only) ------------------------------------------
say "Writing configuration"
umask 077
cat > "$INSTALL_DIR/env/gateway.env" <<EOF
TWS_USERID=$IB_USER
TWS_PASSWORD=$IB_PASS
TRADING_MODE=$MODE
TOTP_SECRET=$TOTP
TWS_PORT=$GW_PORT
EOF
cat > "$INSTALL_DIR/env/follower.env" <<EOF
FOLLOWER_STRATEGY=$STRATS
FOLLOWER_MODE=$MODE
FEED_KEY=$FEED_KEY
FEED_BASE_URL=https://www.prisma-capital.xyz/feed
IB_ACCOUNT=$IB_ACCTS
IB_PORT=$API_PORT
TELEGRAM_TOKEN=$TG_TOKEN
TELEGRAM_CHAT_ID=$TG_CHAT
POLL_SECONDS=300
REBALANCE_TOLERANCE=0.02
EOF
echo "TWS_PORT=$GW_PORT" > "$INSTALL_DIR/.env"   # for compose healthcheck interpolation (internal port)
echo "$FEED_KEY" > "$INSTALL_DIR/.feedkey"    # used by the auto-updater to re-fetch
chmod 600 "$INSTALL_DIR"/env/*.env "$INSTALL_DIR/.feedkey"
ok "Config written (readable only by root)"

# --- 5. Start --------------------------------------------------------------
say "Building and starting (first build takes a few minutes)"
docker compose -f "$INSTALL_DIR/docker-compose.yml" --project-directory "$INSTALL_DIR" up -d --build
ok "Containers started"

# --- 6. Auto-update timer (re-fetch encrypted app, rebuild) ---------------
say "Enabling automatic updates"
cat > /usr/local/bin/prisma-follower-update.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail
KEY=\$(cat "$INSTALL_DIR/.feedkey")
curl -fsSL "$ENC_URL" -o /tmp/f.enc || exit 0
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass pass:"\$KEY" -in /tmp/f.enc | tar -xzf - -C "$INSTALL_DIR"
rm -f /tmp/f.enc
docker compose --project-directory "$INSTALL_DIR" up -d --build
EOF
chmod 700 /usr/local/bin/prisma-follower-update.sh
cat > /etc/systemd/system/prisma-follower-update.service <<EOF
[Unit]
Description=Update Prisma follower
[Service]
Type=oneshot
ExecStart=/usr/local/bin/prisma-follower-update.sh
EOF
cat > /etc/systemd/system/prisma-follower-update.timer <<EOF
[Unit]
Description=Update Prisma follower every 6h
[Timer]
OnBootSec=10min
OnUnitActiveSec=6h
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now prisma-follower-update.timer >/dev/null 2>&1 || true
ok "Auto-updates enabled (every 6h)"

say "Done."
printf "Your follower is running in %s mode for: %s.\n" "$MODE" "$STRATS" >"$TTY"
printf "You should get a Telegram welcome message shortly. Send /status to your bot any time.\n" >"$TTY"
printf "Logs:   docker logs -f prisma-follower\n" >"$TTY"
printf "Stop:   docker compose --project-directory %s down\n" "$INSTALL_DIR" >"$TTY"
