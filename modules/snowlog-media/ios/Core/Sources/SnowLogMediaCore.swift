import Foundation

/// Placeholder for the PhotoKit-facing core of #86 Task C.
///
/// It exists so the native test path (instrument I1, #86 §10.1) can be proven before
/// any real logic lands: a local Expo module's test spec is discovered, built, and run
/// on an EAS simulator. Task C replaces this with the request registry, the network
/// gate, and the injected fake PhotoKit adapters.
public enum SnowLogMediaCore {
    /// Bumped when the JS/native contract of the module changes.
    public static let contractVersion = 1
}
