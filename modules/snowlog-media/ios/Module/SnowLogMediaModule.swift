import ExpoModulesCore
import SnowLogMediaCore

/// Expo module entry point. No JS calls it yet; it is linked so the module and its
/// core pod build as part of the app (#86 Task C).
public class SnowLogMediaModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SnowLogMedia")

    Constant("contractVersion") {
      SnowLogMediaCore.contractVersion
    }
  }
}
