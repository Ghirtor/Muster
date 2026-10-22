//! The packaged app's supervisor: the bundled `server/main.js`, run with the machine's `node`
//! (Node >= 22, as for development), serving the bundled dashboard and the API on one origin.

use std::fs::File;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

const PORT: u16 = 4871;
const READY_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Default)]
pub struct Supervisor(Mutex<Option<Child>>);

impl Supervisor {
  pub fn stop(&self) {
    if let Some(mut child) = self.0.lock().unwrap().take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

fn listening() -> bool {
  let address = SocketAddr::from(([127, 0, 0, 1], PORT));
  TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_ok()
}

/// `path` without Windows' verbatim `\\?\` prefix, which Tauri's resource directory carries and
/// Node cannot resolve a script from.
fn plain(path: &Path) -> PathBuf {
  match path.to_str().and_then(|p| p.strip_prefix(r"\\?\")) {
    Some(rest) if !rest.starts_with(r"UNC\") => PathBuf::from(rest),
    _ => path.to_path_buf(),
  }
}

/// Starts the bundled supervisor unless one already listens on its port, waits for it to accept a
/// connection, and returns the dashboard's URL. Its output goes to `supervisor.log` in the app's
/// log directory.
pub fn start(app: &AppHandle) -> Result<tauri::Url, String> {
  let url: tauri::Url = format!("http://127.0.0.1:{PORT}/").parse().map_err(|e| format!("{e}"))?;
  if listening() {
    log::warn!("a supervisor already listens on :{PORT}, using it");
    return Ok(url);
  }

  let resources = plain(&app.path().resource_dir().map_err(|e| e.to_string())?);
  let script = resources.join("server").join("main.js");
  let web_root = resources.join("web");
  let log_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
  std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
  let log = File::create(log_dir.join("supervisor.log")).map_err(|e| e.to_string())?;
  let log_err = log.try_clone().map_err(|e| e.to_string())?;

  let mut command = Command::new("node");
  command
    .arg(&script)
    .env("FLOTILLA_PORT", PORT.to_string())
    .env("FLOTILLA_WEB_ROOT", &web_root)
    .stdin(Stdio::null())
    .stdout(Stdio::from(log))
    .stderr(Stdio::from(log_err));
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
  }
  let mut child = command
    .spawn()
    .map_err(|e| format!("could not run node ({e}); Flotilla needs Node >= 22 on PATH"))?;

  let started = Instant::now();
  while !listening() {
    if let Ok(Some(status)) = child.try_wait() {
      return Err(format!("node exited with {status}, see supervisor.log"));
    }
    if started.elapsed() > READY_TIMEOUT {
      let _ = child.kill();
      return Err(format!("nothing listened on :{PORT} after {READY_TIMEOUT:?}"));
    }
    std::thread::sleep(Duration::from_millis(100));
  }
  *app.state::<Supervisor>().0.lock().unwrap() = Some(child);
  Ok(url)
}
