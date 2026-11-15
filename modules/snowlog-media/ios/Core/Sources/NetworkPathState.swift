/// The network path as the native monitor observed it (#86 §12.2).
///
/// Same fields, and the same eligibility order, as `NetworkPathState` and
/// `isEligibleWifiPath` in `src/utils/mediaPolicy.ts`. Native code re-checks
/// eligibility here immediately before each network-enabled request (§12.3) rather
/// than trusting a JS preflight. `scripts/tests/snowlogMediaContract.test.cjs`
/// fails when the field names drift.
public struct NetworkPathState: Equatable {
    /// Whether a path result has been observed yet. False right after start.
    public var hasCurrentPath: Bool
    public var isSatisfied: Bool
    public var usesWifi: Bool
    public var isExpensive: Bool
    public var isConstrained: Bool
    /// Whether the observed path uses a cellular interface.
    public var hasCellular: Bool

    public init(
        hasCurrentPath: Bool,
        isSatisfied: Bool,
        usesWifi: Bool,
        isExpensive: Bool,
        isConstrained: Bool,
        hasCellular: Bool
    ) {
        self.hasCurrentPath = hasCurrentPath
        self.isSatisfied = isSatisfied
        self.usesWifi = usesWifi
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.hasCellular = hasCellular
    }

    /// Nothing observed yet. Ineligible by construction.
    public static let unknown = NetworkPathState(
        hasCurrentPath: false,
        isSatisfied: false,
        usesWifi: false,
        isExpensive: false,
        isConstrained: false,
        hasCellular: false
    )

    /// Eligible Wi-Fi under `save_data` (#86 §12.2). Unknown is ineligible: treating
    /// "no observation yet" as Wi-Fi would open a window right after launch. A Wi-Fi
    /// path that is expensive or constrained is not eligible either.
    public var isEligibleWifi: Bool {
        if !hasCurrentPath { return false }
        if !isSatisfied { return false }
        if !usesWifi { return false }
        if isExpensive { return false }
        if isConstrained { return false }
        if hasCellular { return false }
        return true
    }
}
