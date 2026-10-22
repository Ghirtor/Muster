#!/bin/sh
# deb postinst and rpm %post: puts the bundled `flotilla` CLI on PATH as /usr/bin/flotilla. The
# app's own binary is `flotilla-app` on Linux (tauri.linux.conf.json), so the name is free.
chmod 755 /usr/lib/Flotilla/bin/flotilla
ln -sf /usr/lib/Flotilla/bin/flotilla /usr/bin/flotilla
