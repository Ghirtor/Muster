#!/bin/sh
# deb postinst and rpm %post: puts the bundled `muster` CLI on PATH as /usr/bin/muster. The
# app's own binary is `muster-app` on Linux (tauri.linux.conf.json), so the name is free.
chmod 755 /usr/lib/Muster/bin/muster
ln -sf /usr/lib/Muster/bin/muster /usr/bin/muster
