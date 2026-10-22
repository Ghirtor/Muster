#!/bin/sh
# deb prerm and rpm %preun: removes /usr/bin/flotilla on uninstall, keeping it through an upgrade
# (deb passes `remove` or `purge`, rpm `0`, when the package is going away).
case "$1" in
  remove | purge | 0) rm -f /usr/bin/flotilla ;;
esac
