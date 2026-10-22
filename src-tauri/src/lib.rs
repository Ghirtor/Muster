mod cli_tool;
mod supervisor;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default().manage(supervisor::Supervisor::default());
  // Windows' installers and Linux's packages put `flotilla` on PATH; on macOS the app menu does.
  #[cfg(target_os = "macos")]
  let builder = builder
    .menu(cli_tool::menu)
    .on_menu_event(|app, event| cli_tool::handle(app, event.id().as_ref()));
  builder
    .setup(|app| {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;
      if cfg!(debug_assertions) {
        // `tauri dev` runs `npm run start` first, so the supervisor and Vite are already up and
        // the dashboard comes from the dev server, behind its `/api` proxy.
        open_main_window(app.handle(), WebviewUrl::App("index.html".into()))?;
        return Ok(());
      }
      let handle = app.handle().clone();
      std::thread::spawn(move || {
        let url = match supervisor::start(&handle) {
          Ok(url) => WebviewUrl::External(url),
          Err(error) => {
            log::error!("supervisor did not start: {error}");
            WebviewUrl::App("index.html".into())
          }
        };
        if let Err(error) = open_main_window(&handle, url) {
          log::error!("could not open the main window: {error}");
        }
      });
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      if let tauri::RunEvent::Exit = event {
        app.state::<supervisor::Supervisor>().stop();
      }
    });
}

fn open_main_window(app: &tauri::AppHandle, url: WebviewUrl) -> tauri::Result<()> {
  WebviewWindowBuilder::new(app, "main", url)
    .title("Flotilla")
    .inner_size(1440.0, 900.0)
    .min_inner_size(1024.0, 640.0)
    .build()?;
  Ok(())
}
