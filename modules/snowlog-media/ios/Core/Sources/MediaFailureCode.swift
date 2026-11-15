/// Why an acquisition did not produce a usable file (#86 §4.2).
///
/// The raw values are the `MediaFailureCode` strings in `src/types/media.ts`.
/// `scripts/tests/snowlogMediaContract.test.cjs` fails when the two lists differ.
public enum MediaFailureCode: String, CaseIterable {
    case needsNetwork = "needs_network"
    case notAccessible = "not_accessible"
    case missing = "missing"
    case cancelled = "cancelled"
    case interrupted = "interrupted"
    case insufficientSpace = "insufficient_space"
    case unsupported = "unsupported"
    case sourceChanged = "source_changed"
    case timeout = "timeout"
    case ioError = "io_error"
}
