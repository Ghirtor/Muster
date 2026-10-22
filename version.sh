#!/bin/sh
# Sets the next release's version on the checked-out branch: ./version.sh <x.y.z> <FEAT-n>.
# Writes it into tauri.conf.json and package.json, commits and pushes the branch;
# scripts/version.mjs does the work.
exec node "$(dirname "$0")/scripts/version.mjs" "$@"
