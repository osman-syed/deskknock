# Installing DeskKnock (Ubuntu, GNOME/Wayland)

## Install

Download the `.deb`, then:

    sudo apt install ./deskknock_0.1.0_amd64.deb

Launch "DeskKnock" from the app menu. It runs in the tray and autostarts on login.

## Firewall

Only if `ufw` is active (`sudo ufw status`):

    sudo ufw allow 47321/tcp

## Peer not showing up (discovery failed)

Discovery uses mDNS, which some office networks block. In the DeskKnock window open Settings and add the teammate under "Manual peers" (one per line, `ip` or `ip:port`; default port 47321). Find their IP with `hostname -I` on their machine.

## Update

Install the newer `.deb` over the old one:

    sudo apt install ./deskknock_<new-version>_amd64.deb

Then quit DeskKnock from the tray menu and start it again.
