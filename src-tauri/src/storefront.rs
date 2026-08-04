#[cfg(any(target_os = "macos", target_os = "ios"))]
#[allow(deprecated)]
fn current_country_code() -> Option<String> {
    use objc2_store_kit::SKPaymentQueue;

    // StoreKit returns the storefront associated with the App Store account,
    // which is the distribution region Apple uses for storefront policies.
    unsafe {
        SKPaymentQueue::defaultQueue()
            .storefront()
            .map(|storefront| storefront.countryCode().to_string())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
fn current_country_code() -> Option<String> {
    None
}

#[tauri::command]
pub fn get_app_storefront_country_code() -> Option<String> {
    current_country_code()
}
