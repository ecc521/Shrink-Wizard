import Foundation
import ServiceManagement

let plistName = "com.shrinkwizard.helper.plist"

if #available(macOS 13.0, *) {
    let service = SMAppService.daemon(plistName: plistName)
    
    let args = CommandLine.arguments
    let action = args.count > 1 ? args[1] : "status"
    
    do {
        switch action {
        case "install":
            print("Attempting to register daemon...")
            try service.register()
            print("Successfully registered daemon.")
        case "uninstall":
            print("Attempting to unregister daemon...")
            try service.unregister()
            print("Successfully unregistered daemon.")
        case "status":
            switch service.status {
            case .notRegistered:
                print("Status: Not Registered")
            case .enabled:
                print("Status: Enabled")
            case .requiresApproval:
                print("Status: Requires Approval in System Settings -> Login Items")
            case .notFound:
                print("Status: Not Found (Plist missing)")
            @unknown default:
                print("Status: Unknown")
            }
        default:
            print("Usage: HelperInstaller [install|uninstall|status]")
            exit(1)
        }
    } catch {
        print("Error: \(error.localizedDescription)")
        exit(1)
    }
} else {
    print("Error: SMAppService requires macOS 13.0 or newer.")
    exit(1)
}
