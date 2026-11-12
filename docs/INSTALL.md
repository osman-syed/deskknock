# Installing DeskKnock (Ubuntu, GNOME/Wayland)

## Install

Download the `.deb`, then:

    sudo apt install ./deskknock_0.1.0_amd64.deb

DeskKnock runs in the background and starts automatically at your next login. To start it now without logging out, run once:

    setsid -f deskknock --hidden >/dev/null 2>&1

On first start it picks a random character for you and stays in the tray; no window opens.

## Everyday use

Knock from the tray icon: its menu lists your teammates with their status (Online, Busy until 14:05, ...). Click a name to knock; while the knock is waiting, click it again to cancel. The menu also has `Pause knocks`, `Open DeskKnock` and `Quit`.

The tray icon needs Ubuntu's built-in AppIndicator extension (enabled by default on Ubuntu); on other GNOME setups install the "AppIndicator and KStatusNotifierItem Support" extension.

You only need the window (tray menu → `Open DeskKnock`) to change your character (Settings → Edit my character) or settings.

## Firewall

Only if `ufw` is active (`sudo ufw status`):

    sudo ufw allow 47321/tcp

## Peer not showing up (discovery failed)

Discovery uses mDNS, which some office networks block. In the DeskKnock window open Settings and add the teammate under "Manual peers" (one per line, `ip` or `ip:port`; default port 47321). Find their IP with `hostname -I` on their machine.

## Update

Install the newer `.deb` over the old one:

    sudo apt install ./deskknock_<new-version>_amd64.deb

Then quit DeskKnock from the tray menu and start it again.
