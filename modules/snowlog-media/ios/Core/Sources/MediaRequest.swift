import Foundation

/// One native media request: the PhotoKit request, the file writer and the exporter
/// tracked under a single token (#86 §4.3).
///
/// - The outcome is delivered exactly once. A callback that arrives after the request
///   settled or was cancelled is a late callback: `settle` returns false and nothing
///   is delivered, so it cannot report `ready`, rename output or reach the database.
/// - `cancel` runs every registered cleanup once (cancel the PhotoKit request, cancel
///   the exporter, close the writer), then delivers the cancelled outcome.
/// - Cleanup registered after cancellation runs immediately, so a request that is
///   cancelled while still being set up does not leak its writer.
public final class MediaRequestToken<Outcome> {
    public let requestId: String
    private let lock = NSLock()
    private var cancelled = false
    private var settled = false
    private var cancellationHandlers: [() -> Void] = []
    private let cancelledOutcome: Outcome
    private let deliver: (Outcome) -> Void

    init(requestId: String, cancelledOutcome: Outcome, deliver: @escaping (Outcome) -> Void) {
        self.requestId = requestId
        self.cancelledOutcome = cancelledOutcome
        self.deliver = deliver
    }

    public var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return cancelled
    }

    public var isSettled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return settled
    }

    /// Registers cleanup to run if the request is cancelled. Runs it now if the request
    /// was already cancelled. Dropped once the request settles normally.
    public func onCancel(_ handler: @escaping () -> Void) {
        lock.lock()
        if cancelled {
            lock.unlock()
            handler()
            return
        }
        if settled {
            lock.unlock()
            return
        }
        cancellationHandlers.append(handler)
        lock.unlock()
    }

    /// Delivers `outcome` if nothing has been delivered yet. Returns false for a late
    /// callback.
    @discardableResult
    public func settle(_ outcome: Outcome) -> Bool {
        lock.lock()
        if settled {
            lock.unlock()
            return false
        }
        settled = true
        cancellationHandlers.removeAll()
        lock.unlock()
        deliver(outcome)
        return true
    }

    /// Cancels the request: runs cleanup once and delivers the cancelled outcome.
    /// Returns false if the request had already settled or been cancelled.
    @discardableResult
    public func cancel() -> Bool {
        lock.lock()
        if settled {
            lock.unlock()
            return false
        }
        cancelled = true
        settled = true
        let handlers = cancellationHandlers
        cancellationHandlers.removeAll()
        lock.unlock()
        for handler in handlers {
            handler()
        }
        deliver(cancelledOutcome)
        return true
    }
}

/// Active requests by request ID, so `cancelMediaRequest(requestId)` from JS reaches
/// the right token (#86 §4.2). A token leaves the registry when it settles.
public final class MediaRequestRegistry<Outcome> {
    public enum BeginError: Error, Equatable {
        /// A request with this ID is still active. IDs are never reused while active.
        case duplicateRequestId
    }

    private struct Entry {
        let serial: UInt64
        let token: MediaRequestToken<Outcome>
    }

    private let lock = NSLock()
    private var active: [String: Entry] = [:]
    private var nextSerial: UInt64 = 0

    public init() {}

    /// Starts tracking a request. `completion` receives its single outcome.
    public func begin(
        requestId: String,
        cancelledOutcome: Outcome,
        completion: @escaping (Outcome) -> Void
    ) throws -> MediaRequestToken<Outcome> {
        lock.lock()
        defer { lock.unlock() }
        if active[requestId] != nil {
            throw BeginError.duplicateRequestId
        }
        nextSerial += 1
        let serial = nextSerial
        let token = MediaRequestToken<Outcome>(
            requestId: requestId,
            cancelledOutcome: cancelledOutcome
        ) { [weak self] outcome in
            self?.finish(requestId: requestId, serial: serial)
            completion(outcome)
        }
        active[requestId] = Entry(serial: serial, token: token)
        return token
    }

    /// Cancels an active request. Returns false if no request with this ID is active.
    @discardableResult
    public func cancel(requestId: String) -> Bool {
        lock.lock()
        let token = active[requestId]?.token
        lock.unlock()
        return token?.cancel() ?? false
    }

    /// Cancels every active request, e.g. when the app leaves the foreground.
    public func cancelAll() {
        lock.lock()
        let tokens = active.values.map { $0.token }
        lock.unlock()
        for token in tokens {
            token.cancel()
        }
    }

    public var activeRequestIds: Set<String> {
        lock.lock()
        defer { lock.unlock() }
        return Set(active.keys)
    }

    private func finish(requestId: String, serial: UInt64) {
        lock.lock()
        if active[requestId]?.serial == serial {
            active[requestId] = nil
        }
        lock.unlock()
    }
}
