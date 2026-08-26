use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_store::StoreExt;

pub const AUTOSTART_ARG: &str = "--autostart";

pub fn setup_window_events(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        let window_clone = window.clone();
        let app_handle = app.clone();
        window.on_window_event(move |event| {
            handle_window_event(event, &window_clone, &app_handle);
        });
    }
    Ok(())
}

fn handle_window_event(
    event: &WindowEvent,
    window: &tauri::WebviewWindow,
    app_handle: &AppHandle,
) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };

    match get_close_behavior(app_handle).as_str() {
        "quit" => {
            api.prevent_close();
            app_handle.exit(0);
        }
        "ask" => {
            api.prevent_close();
            let _ = window.emit("close-behavior-requested", ());
        }
        _ => {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

fn get_close_behavior(app_handle: &AppHandle) -> String {
    app_handle
        .store("store.json")
        .ok()
        .and_then(|store| store.get("closeBehavior"))
        .and_then(|value| value.as_str().map(ToOwned::to_owned))
        .unwrap_or_else(|| "minimize".to_string())
}

fn get_autostart_minimized(app_handle: &AppHandle) -> bool {
    app_handle
        .store("store.json")
        .ok()
        .and_then(|store| store.get("autostartMinimized"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
}

fn is_autostart_launch(args: &[String]) -> bool {
    args.iter().any(|arg| arg == AUTOSTART_ARG)
}

pub fn apply_startup_visibility(app_handle: &AppHandle) {
    let args = std::env::args().collect::<Vec<_>>();
    if !is_autostart_launch(&args) || !get_autostart_minimized(app_handle) {
        return;
    }

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn handle_single_instance(app: &AppHandle, argv: Vec<String>, _cwd: String) {
    if is_autostart_launch(&argv) && get_autostart_minimized(app) {
        crate::file_open::handle_single_instance_open_files(app, argv);
        return;
    }

    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_minimized = window.is_minimized().unwrap_or(false);

        if !is_visible {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.set_always_on_top(true);
            let _ = window.set_always_on_top(false);
        } else if is_minimized {
            let _ = window.unminimize();
            std::thread::sleep(std::time::Duration::from_millis(100));
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.set_always_on_top(true);
            let _ = window.set_always_on_top(false);
        } else {
            let _ = window.set_focus();
            let _ = window.set_always_on_top(true);
            let _ = window.set_always_on_top(false);
        }
    }

    crate::file_open::handle_single_instance_open_files(app, argv);
}

#[cfg(target_os = "macos")]
pub fn handle_macos_reopen(app_handle: &AppHandle, has_visible_windows: bool) {
    if !has_visible_windows {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            let _ = app_handle.show();
        }
    }
}
