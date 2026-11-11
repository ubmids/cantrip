import SwiftUI
import FirebaseCore
import FirebaseAppCheck

@main
struct CantripApp: App {
    init() {
        // App Check is required by Firebase AI Logic. The debug provider is fine for the
        // hackathon build; register its token under App Check > Apps > Manage debug tokens.
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup { LibraryView() }
    }
}
