#!/usr/bin/env bash
#
# Prisma Follower installer.
#   curl -sL https://www.prisma-capital.xyz/follower.sh | sudo bash
#
# Installs Docker, fetches the open-source follower, asks you a few questions,
# and starts trading YOUR IBKR account to match Prisma's daily signals.
# Everything you enter stays on THIS server (root-only). Prisma never sees it.
#
set -euo pipefail

REPO_URL="https://github.com/buffalodebile/prisma-follower.git"
INSTALL_DIR="/opt/prisma-follower"
TTY=/dev/tty

say()  { printf "\n\033[1;36m==>\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ok\033[0m %s\n" "$*"; }
ask()  { local p="$1" d="${2:-}" v; if [ -n "$d" ]; then printf "%s [%s]: " "$p" "$d" >"$TTY"; else printf "%s: " "$p" >"$TTY"; fi; read -r v <"$TTY" || true; echo "${v:-$d}"; }
asks() { local p="$1" v; printf "%s: " "$p" >"$TTY"; read -rs v <"$TTY" || true; printf "\n" >"$TTY"; echo "$v"; }

if [ "$(id -u)" -ne 0 ]; then echo "Please run with sudo."; exit 1; fi

say "Prisma Follower installer"
printf "This sets up an automated follower for your own IBKR account.\n" >"$TTY"
printf "Have ready: your IBKR trading-access username/password, the authenticator secret,\n" >"$TTY"
printf "your Telegram bot token, and the feed key from your Prisma client page.\n" >"$TTY"

# --- 1. Dependencies -------------------------------------------------------
say "Installing Docker and git (if needed)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git ca-certificates curl >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y -qq docker.io >/dev/null
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 || apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 || true
fi
systemctl enable --now docker >/dev/null 2>&1 || true
ok "Docker ready"

# --- 2. Fetch the follower -------------------------------------------------
say "Fetching the follower"
if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" pull --ff-only
else
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
mkdir -p "$INSTALL_DIR/env" "$INSTALL_DIR/state"
ok "Installed in $INSTALL_DIR"

# --- 3. Questions ----------------------------------------------------------
say "A few questions"
STRAT=""
while [ "$STRAT" != "alpha" ] && [ "$STRAT" != "gamma" ] && [ "$STRAT" != "sigma" ]; do
  STRAT=$(ask "Strategy for this account (alpha / gamma / sigma)" "alpha"); STRAT=$(echo "$STRAT" | tr 'A-Z' 'a-z')
done
MODE=""
while [ "$MODE" != "paper" ] && [ "$MODE" != "live" ]; do
  MODE=$(ask "Mode (paper / live) - start with paper" "paper"); MODE=$(echo "$MODE" | tr 'A-Z' 'a-z')
done
if [ "$MODE" = "live" ]; then PORT=4001; else PORT=4002; fi

IB_USER=$(ask "IBKR trading-access username")
IB_PASS=$(asks "IBKR trading-access password")
TOTP=$(asks "Authenticator secret (base32, from IBKR 2FA setup)")
IB_ACCT=$(ask "IBKR account number (Uxxxxxxx)")
TG_TOKEN=$(ask "Telegram bot token")
FEED_KEY=$(ask "Feed key (from your Prisma client page)")

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
TWS_PORT=$PORT
EOF
cat > "$INSTALL_DIR/env/follower.env" <<EOF
FOLLOWER_STRATEGY=$STRAT
FOLLOWER_MODE=$MODE
FEED_KEY=$FEED_KEY
FEED_BASE_URL=https://www.prisma-capital.xyz/feed
IB_ACCOUNT=$IB_ACCT
IB_PORT=$PORT
TELEGRAM_TOKEN=$TG_TOKEN
TELEGRAM_CHAT_ID=$TG_CHAT
POLL_SECONDS=300
REBALANCE_TOLERANCE=0.02
EOF
echo "TWS_PORT=$PORT" > "$INSTALL_DIR/.env"   # for compose healthcheck interpolation
chmod 600 "$INSTALL_DIR"/env/*.env
ok "Config written (readable only by root)"

# --- 5. Start --------------------------------------------------------------
say "Building and starting (first build takes a few minutes)"
docker compose -f "$INSTALL_DIR/docker-compose.yml" --project-directory "$INSTALL_DIR" up -d --build
ok "Containers started"

# --- 6. Auto-update timer --------------------------------------------------
say "Enabling automatic updates"
cat > /etc/systemd/system/prisma-follower-update.service <<EOF
[Unit]
Description=Update Prisma follower
[Service]
Type=oneshot
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/git pull --ff-only
ExecStart=/usr/bin/docker compose --project-directory $INSTALL_DIR up -d --build
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
printf "Your follower is running in %s mode for strategy '%s'.\n" "$MODE" "$STRAT" >"$TTY"
printf "You should get a Telegram welcome message shortly. Send /status to your bot any time.\n" >"$TTY"
printf "Logs:   docker logs -f prisma-follower\n" >"$TTY"
printf "Stop:   docker compose --project-directory %s down\n" "$INSTALL_DIR" >"$TTY"
