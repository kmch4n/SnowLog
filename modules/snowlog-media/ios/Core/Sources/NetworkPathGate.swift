#if canImport(Network)
import Foundation
import Network

/// Observes the default network path with `NWPathMonitor` (#86 §12.2).
///
/// The gate is best-effort scheduling and cancellation, not a transport-level
/// cellular prohibition: PhotoKit's daemon chooses the interface (§12.6). Callers
/// ask `isEligibleWifiNow()` immediately before each network-enabled request and
/// subscribe to changes to cancel an in-flight request when eligibility is lost.
public final class NetworkPathGate {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "jp.kmchan.snowlog.media.network-path")
    private let lock = NSLock()
    private var latest = NetworkPathState.unknown
    private var observers: [UUID: (NetworkPathState) -> Void] = [:]
    private var started = false

    public init() {}

    deinit {
        monitor.cancel()
    }

    /// Starts observing. An `NWPathMonitor` cannot be restarted after `cancel`, so this
    /// is idempotent and there is no `stop`; the gate lives as long as its owner.
    public func start() {
        lock.lock()
        if started {
            lock.unlock()
            return
        }
        started = true
        lock.unlock()

        monitor.pathUpdateHandler = { [weak self] path in
            self?.receive(NetworkPathState(path: path))
        }
        monitor.start(queue: queue)
    }

    public var current: NetworkPathState {
        lock.lock()
        defer { lock.unlock() }
        return latest
    }

    public func isEligibleWifiNow() -> Bool {
        return current.isEligibleWifi
    }

    /// Calls `observer` on the monitor's queue for every later path update.
    /// Returns a key for `removeObserver`.
    @discardableResult
    public func addObserver(_ observer: @escaping (NetworkPathState) -> Void) -> UUID {
        let key = UUID()
        lock.lock()
        observers[key] = observer
        lock.unlock()
        return key
    }

    public func removeObserver(_ key: UUID) {
        lock.lock()
        observers[key] = nil
        lock.unlock()
    }

    private func receive(_ state: NetworkPathState) {
        lock.lock()
        latest = state
        let toNotify = Array(observers.values)
        lock.unlock()
        for observer in toNotify {
            observer(state)
        }
    }
}

extension NetworkPathState {
    /// Maps an observed `NWPath`.
    ///
    /// `hasCellular` uses `usesInterfaceType(.cellular)`, the interface the path
    /// actually uses. It deliberately does not look at `availableInterfaces`, which on
    /// an iPhone with mobile data on can list the cellular interface beside Wi-Fi and
    /// would make every Wi-Fi path ineligible. This reading of §12.2 still needs a
    /// device check (Wi-Fi with mobile data on and off).
    public init(path: NWPath) {
        self.init(
            hasCurrentPath: true,
            isSatisfied: path.status == .satisfied,
            usesWifi: path.usesInterfaceType(.wifi),
            isExpensive: path.isExpensive,
            isConstrained: path.isConstrained,
            hasCellular: path.usesInterfaceType(.cellular)
        )
    }
}
#endif
