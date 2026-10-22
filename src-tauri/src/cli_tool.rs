//! macOS's "Install Command Line Tool" and "Uninstall Command Line Tool" items in the app menu:
//! they link `/usr/local/bin/flotilla` to the bundled `bin/flotilla` shim, or remove that link,
//! asking for an administrator's password through `osascript`. A `.dmg` has no install step, so the
//! user runs this once instead. It compiles everywhere so other platforms check it too.
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Manager, Runtime};

const LINK: &str = "/usr/local/bin/flotilla";
pub const INSTALL: &str = "install-cli";
pub const UNINSTALL: &str = "uninstall-cli";

/// Tauri's default menu with the two items after "About Flotilla" in the app menu.
pub fn menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  let menu = Menu::default(app)?;
  if let Some(app_menu) = menu.items()?.first().and_then(|item| item.as_submenu().cloned()) {
    let install = MenuItem::with_id(app, INSTALL, "Install Command Line Tool", true, None::<&str>)?;
    let uninstall =
      MenuItem::with_id(app, UNINSTALL, "Uninstall Command Line Tool", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    app_menu.insert_items(&[&separator, &install, &uninstall], 1)?;
  }
  Ok(menu)
}

/// Runs the item with `id`, off the main thread since the password prompt blocks.
pub fn handle<R: Runtime>(app: &AppHandle<R>, id: &str) {
  if id != INSTALL && id != UNINSTALL {
    return;
  }
  let shim = app.path().resource_dir().map(|dir| dir.join("bin").join("flotilla"));
  let id = id.to_owned();
  std::thread::spawn(move || {
    let result = match (id.as_str(), shim) {
      (_, Err(error)) => Err(error.to_string()),
      (INSTALL, Ok(shim)) => install(&shim),
      (_, Ok(shim)) => uninstall(&shim),
    };
    match result {
      Ok(Some(message)) => alert("Flotilla", &message),
      Ok(None) => {}
      Err(message) => alert("The command line tool was not changed", &message),
    }
  });
}

fn install(shim: &Path) -> Result<Option<String>, String> {
  if shim.to_string_lossy().contains("/AppTranslocation/") {
    return Err("Move Flotilla to Applications and open it from there first.".into());
  }
  match linked_to() {
    Some(Some(target)) if target == shim => {
      return Ok(Some(format!("`flotilla` is already installed in {LINK}.")))
    }
    Some(_) => return Err(format!("{LINK} already exists and is not Flotilla's.")),
    None => {}
  }
  let done = as_admin(&format!(
    "mkdir -p /usr/local/bin && ln -s {} {LINK}",
    shell_quote(&shim.to_string_lossy())
  ))?;
  Ok(done.then(|| format!("`flotilla` is installed in {LINK}. Open a new terminal to use it.")))
}

fn uninstall(shim: &Path) -> Result<Option<String>, String> {
  match linked_to() {
    None => Ok(Some(format!("{LINK} is not installed."))),
    Some(Some(target)) if target == shim => {
      let done = as_admin(&format!("rm {LINK}"))?;
      Ok(done.then(|| format!("{LINK} is removed.")))
    }
    Some(_) => Err(format!("{LINK} is not Flotilla's, so it was left alone.")),
  }
}

/// `None` when nothing is at the link's path, `Some(None)` when something other than a link is.
fn linked_to() -> Option<Option<PathBuf>> {
  std::fs::symlink_metadata(LINK).ok()?;
  Some(std::fs::read_link(LINK).ok())
}

/// Runs `script` with `sh` as root after macOS's password prompt. `Ok(false)` when the user
/// cancelled it.
fn as_admin(script: &str) -> Result<bool, String> {
  let output = Command::new("osascript")
    .arg("-e")
    .arg(format!(
      "do shell script \"{}\" with administrator privileges",
      applescript_escape(script)
    ))
    .output()
    .map_err(|e| e.to_string())?;
  if output.status.success() {
    return Ok(true);
  }
  let stderr = String::from_utf8_lossy(&output.stderr);
  // -128 is AppleScript's "User canceled."
  if stderr.contains("(-128)") {
    return Ok(false);
  }
  Err(stderr.trim().to_owned())
}

fn alert(title: &str, message: &str) {
  let script = format!(
    "display alert \"{}\" message \"{}\"",
    applescript_escape(title),
    applescript_escape(message)
  );
  if let Err(error) = Command::new("osascript").arg("-e").arg(script).status() {
    log::error!("could not show an alert: {error}");
  }
}

fn shell_quote(text: &str) -> String {
  format!("'{}'", text.replace('\'', r"'\''"))
}

fn applescript_escape(text: &str) -> String {
  text.replace('\\', r"\\").replace('"', "\\\"")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn quotes_a_path_for_sh_then_applescript() {
    let quoted = shell_quote("/Applications/It's Flotilla.app/bin/flotilla");
    assert_eq!(quoted, r"'/Applications/It'\''s Flotilla.app/bin/flotilla'");
    assert_eq!(applescript_escape(r#"a "b" \c"#), r#"a \"b\" \\c"#);
  }
}
