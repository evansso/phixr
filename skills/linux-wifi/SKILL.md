---
name: linux-wifi
description: Load for Linux Wi-Fi problems such as drops, connection failures, no internet, or slow speeds.
---
First separate the symptom: no link, link but no internet, or a link that drops. These point to different causes.

No link or connection failure:
- Check radio blocks with `rfkill list`.
- Check device state with `nmcli device status`.
- For driver or firmware issues, inspect `lspci -k` for the network controller, then check `sudo dmesg` for firmware errors.

Connected but no internet:
- Compare `ping -c 3 1.1.1.1` with `ping -c 3 example.com`. If the IP works and the name fails, investigate DNS. If both fail, investigate the gateway or router.
- Inspect DNS state with `resolvectl status`.

Drops:
- Find the interface using `iw dev`, then check power saving with `iw dev <interface> get power_save`.
- Check NetworkManager logs around the drop with `journalctl -u NetworkManager --since "30 min ago"`.
- Check signal and band with `iw dev <interface> link`; compare 2.4 GHz and 5 GHz behavior.
- Test another device on the same router. If it also drops, suspect the router before the laptop.

Common possible fixes include disabling Wi-Fi power saving, updating firmware, switching router channel or band, and forgetting and rejoining the network. Research version-specific procedures before proposing these changes. Make one change at a time, provide an undo, and verify the original symptom. Interface names vary; discover the name before using it.
