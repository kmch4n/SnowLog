import Foundation

/// Pure-Swift core of the SnowLog media adapter (#86 Task C).
///
/// Everything here is free of ExpoModulesCore and React so that the `Tests` spec runs
/// on a simulator without the app host (instrument I1, #86 §10.1). PhotoKit-facing
/// adapters build on these pieces; they are added once they can be checked on a device.
public enum SnowLogMediaCore {
    /// Bumped when the JS/native contract of the module changes.
    public static let contractVersion = 1
}
