import Foundation

/// The 60-second no-progress watchdog every media request carries (#86 §4.3).
///
/// Progress means an *increase*: a download fraction, a written byte count or an
/// export fraction that is higher than any seen before. Repeating the same value
/// does not count, so a stalled transfer that keeps reporting 0.4 still times out.
/// The clock is injected so the rule is testable; the adapter polls `hasTimedOut`
/// from a timer and cancels the request through its token.
public final class NoProgressWatchdog {
    public static let defaultTimeout: TimeInterval = 60

    private let timeout: TimeInterval
    private let now: () -> TimeInterval
    private let lock = NSLock()
    private var lastProgressAt: TimeInterval
    private var bestDownloadFraction = -Double.infinity
    private var bestWrittenBytes: Int64 = -1
    private var bestExportFraction = -Double.infinity

    public init(
        timeout: TimeInterval = NoProgressWatchdog.defaultTimeout,
        now: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }
    ) {
        self.timeout = timeout
        self.now = now
        self.lastProgressAt = now()
    }

    public func recordDownloadFraction(_ fraction: Double) {
        guard fraction.isFinite else { return }
        lock.lock()
        defer { lock.unlock() }
        if fraction > bestDownloadFraction {
            bestDownloadFraction = fraction
            lastProgressAt = now()
        }
    }

    public func recordWrittenBytes(_ bytes: Int64) {
        lock.lock()
        defer { lock.unlock() }
        if bytes > bestWrittenBytes {
            bestWrittenBytes = bytes
            lastProgressAt = now()
        }
    }

    public func recordExportFraction(_ fraction: Double) {
        guard fraction.isFinite else { return }
        lock.lock()
        defer { lock.unlock() }
        if fraction > bestExportFraction {
            bestExportFraction = fraction
            lastProgressAt = now()
        }
    }

    public var hasTimedOut: Bool {
        lock.lock()
        defer { lock.unlock() }
        return now() - lastProgressAt >= timeout
    }
}
