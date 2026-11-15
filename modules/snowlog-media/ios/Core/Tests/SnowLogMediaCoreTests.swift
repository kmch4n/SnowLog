import Foundation
import XCTest
import SnowLogMediaCore

final class ContractTests: XCTestCase {
    func testContractVersionIsLinked() {
        XCTAssertEqual(SnowLogMediaCore.contractVersion, 1)
    }

    func testFailureCodesMatchTheJsStrings() {
        XCTAssertEqual(
            MediaFailureCode.allCases.map { $0.rawValue },
            [
                "needs_network", "not_accessible", "missing", "cancelled", "interrupted",
                "insufficient_space", "unsupported", "source_changed", "timeout", "io_error",
            ]
        )
    }
}

final class NetworkPathStateTests: XCTestCase {
    private let eligible = NetworkPathState(
        hasCurrentPath: true, isSatisfied: true, usesWifi: true,
        isExpensive: false, isConstrained: false, hasCellular: false
    )

    func testPlainWifiIsEligible() {
        XCTAssertTrue(eligible.isEligibleWifi)
    }

    func testUnknownIsIneligible() {
        XCTAssertFalse(NetworkPathState.unknown.isEligibleWifi)
    }

    func testEachDisqualifierAloneMakesThePathIneligible() {
        var noObservation = eligible; noObservation.hasCurrentPath = false
        var unsatisfied = eligible; unsatisfied.isSatisfied = false
        var notWifi = eligible; notWifi.usesWifi = false
        var expensive = eligible; expensive.isExpensive = true
        var constrained = eligible; constrained.isConstrained = true
        var cellular = eligible; cellular.hasCellular = true
        for state in [noObservation, unsatisfied, notWifi, expensive, constrained, cellular] {
            XCTAssertFalse(state.isEligibleWifi, "\(state)")
        }
    }
}

#if canImport(Network)
final class NetworkPathGateTests: XCTestCase {
    func testStartsUnknownAndThenObservesAPath() {
        let gate = NetworkPathGate()
        XCTAssertEqual(gate.current, .unknown)
        XCTAssertFalse(gate.isEligibleWifiNow())

        let observed = expectation(description: "a path update arrives")
        observed.assertForOverFulfill = false
        let key = gate.addObserver { state in
            if state.hasCurrentPath { observed.fulfill() }
        }
        gate.start()
        gate.start() // idempotent
        wait(for: [observed], timeout: 10)
        gate.removeObserver(key)
        XCTAssertTrue(gate.current.hasCurrentPath)
    }
}
#endif

final class MediaRequestTests: XCTestCase {
    private enum Outcome: Equatable { case ready, cancelled, failed }

    func testOutcomeIsDeliveredExactlyOnce() throws {
        let registry = MediaRequestRegistry<Outcome>()
        var delivered: [Outcome] = []
        let token = try registry.begin(requestId: "r1", cancelledOutcome: .cancelled) { delivered.append($0) }
        XCTAssertTrue(token.settle(.ready))
        XCTAssertFalse(token.settle(.failed), "a late callback must not deliver")
        XCTAssertFalse(token.cancel(), "cancelling after settling does nothing")
        XCTAssertEqual(delivered, [.ready])
        XCTAssertTrue(registry.activeRequestIds.isEmpty, "a settled request leaves the registry")
    }

    func testCancellationCannotProduceReady() throws {
        let registry = MediaRequestRegistry<Outcome>()
        var delivered: [Outcome] = []
        var cleanups: [String] = []
        let token = try registry.begin(requestId: "r1", cancelledOutcome: .cancelled) { delivered.append($0) }
        token.onCancel { cleanups.append("cancelImageRequest") }
        token.onCancel { cleanups.append("closeWriter") }

        XCTAssertTrue(registry.cancel(requestId: "r1"))
        XCTAssertTrue(token.isCancelled)
        XCTAssertFalse(token.settle(.ready), "a ready callback after cancel is late")
        XCTAssertEqual(delivered, [.cancelled])
        XCTAssertEqual(cleanups, ["cancelImageRequest", "closeWriter"])
        XCTAssertFalse(registry.cancel(requestId: "r1"), "the ID is no longer active")
    }

    func testCleanupRegisteredAfterCancellationRunsImmediately() throws {
        let registry = MediaRequestRegistry<Outcome>()
        let token = try registry.begin(requestId: "r1", cancelledOutcome: .cancelled) { _ in }
        token.cancel()
        var ran = false
        token.onCancel { ran = true }
        XCTAssertTrue(ran)
    }

    func testCleanupIsDroppedWhenTheRequestSettlesNormally() throws {
        let registry = MediaRequestRegistry<Outcome>()
        let token = try registry.begin(requestId: "r1", cancelledOutcome: .cancelled) { _ in }
        var ran = false
        token.onCancel { ran = true }
        token.settle(.ready)
        token.cancel()
        token.onCancel { ran = true }
        XCTAssertFalse(ran)
    }

    func testAnActiveRequestIdCannotBeReusedButASettledOneCan() throws {
        let registry = MediaRequestRegistry<Outcome>()
        let first = try registry.begin(requestId: "r1", cancelledOutcome: .cancelled) { _ in }
        XCTAssertThrowsError(try registry.begin(requestId: "r1", cancelledOutcome: .cancelled) { _ in }) { error in
            XCTAssertEqual(error as? MediaRequestRegistry<Outcome>.BeginError, .duplicateRequestId)
        }
        first.settle(.ready)
        let second = try registry.begin(requestId: "r1", cancelledOutcome: .cancelled) { _ in }
        // The first token settling again (late) must not evict the second.
        first.settle(.failed)
        XCTAssertEqual(registry.activeRequestIds, ["r1"])
        second.settle(.ready)
        XCTAssertTrue(registry.activeRequestIds.isEmpty)
    }

    func testCancelAllCancelsEveryActiveRequest() throws {
        let registry = MediaRequestRegistry<Outcome>()
        var delivered: [String: Outcome] = [:]
        for id in ["a", "b", "c"] {
            _ = try registry.begin(requestId: id, cancelledOutcome: .cancelled) { delivered[id] = $0 }
        }
        registry.cancelAll()
        XCTAssertEqual(delivered, ["a": .cancelled, "b": .cancelled, "c": .cancelled])
        XCTAssertTrue(registry.activeRequestIds.isEmpty)
    }

    func testConcurrentSettleAndCancelDeliverOnce() throws {
        for round in 0..<200 {
            let registry = MediaRequestRegistry<Outcome>()
            let lock = NSLock()
            var count = 0
            let token = try registry.begin(requestId: "r\(round)", cancelledOutcome: .cancelled) { _ in
                lock.lock(); count += 1; lock.unlock()
            }
            DispatchQueue.concurrentPerform(iterations: 8) { i in
                if i % 2 == 0 { token.settle(.ready) } else { token.cancel() }
            }
            XCTAssertEqual(count, 1, "round \(round)")
        }
    }
}

final class NoProgressWatchdogTests: XCTestCase {
    private final class Clock {
        var now: TimeInterval = 1000
    }

    func testTimesOutAfterSixtySecondsWithoutProgress() {
        let clock = Clock()
        let watchdog = NoProgressWatchdog(now: { clock.now })
        clock.now += 59.9
        XCTAssertFalse(watchdog.hasTimedOut)
        clock.now += 0.1
        XCTAssertTrue(watchdog.hasTimedOut)
    }

    func testOnlyAnIncreaseResetsTheTimer() {
        let clock = Clock()
        let watchdog = NoProgressWatchdog(timeout: 60, now: { clock.now })
        clock.now += 30
        watchdog.recordDownloadFraction(0.4)
        clock.now += 50
        watchdog.recordDownloadFraction(0.4) // the same value is not progress
        watchdog.recordDownloadFraction(0.3) // nor is a lower one
        watchdog.recordDownloadFraction(.nan)
        clock.now += 10
        XCTAssertTrue(watchdog.hasTimedOut, "60 s since the last increase")
    }

    func testBytesAndExportProgressAlsoReset() {
        let clock = Clock()
        let watchdog = NoProgressWatchdog(timeout: 60, now: { clock.now })
        clock.now += 50
        watchdog.recordWrittenBytes(1 << 20)
        clock.now += 50
        XCTAssertFalse(watchdog.hasTimedOut)
        watchdog.recordExportFraction(0.1)
        clock.now += 59
        XCTAssertFalse(watchdog.hasTimedOut)
        watchdog.recordWrittenBytes(1 << 20) // unchanged
        clock.now += 1
        XCTAssertTrue(watchdog.hasTimedOut)
    }
}

final class ChunkedFileCopierTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("snowlog-copier-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeSource(bytes: Int) throws -> URL {
        let url = directory.appendingPathComponent("source.mov")
        let data = Data((0..<bytes).map { UInt8($0 % 251) })
        try data.write(to: url)
        return url
    }

    func testCopiesInBoundedChunksAndReportsProgress() throws {
        let source = try makeSource(bytes: 10_000)
        let destination = directory.appendingPathComponent("out.mov")
        var progress: [Int64] = []
        let written = try ChunkedFileCopier.copy(
            from: source, to: destination, chunkSize: 4096,
            isCancelled: { false }, onProgress: { progress.append($0) }
        )
        XCTAssertEqual(written, 10_000)
        XCTAssertEqual(progress, [4096, 8192, 10_000])
        XCTAssertEqual(try Data(contentsOf: destination), try Data(contentsOf: source))
    }

    func testCancellationRemovesThePartialFile() throws {
        let source = try makeSource(bytes: 10_000)
        let destination = directory.appendingPathComponent("out.mov")
        final class Chunks { var count = 0 }
        let chunks = Chunks()
        XCTAssertThrowsError(
            try ChunkedFileCopier.copy(
                from: source, to: destination, chunkSize: 4096,
                isCancelled: { chunks.count >= 1 }, onProgress: { _ in chunks.count += 1 }
            )
        ) { error in
            XCTAssertEqual(error as? ChunkedFileCopier.CopyError, .cancelled)
            XCTAssertEqual((error as? ChunkedFileCopier.CopyError)?.failureCode, .cancelled)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: destination.path))
    }

    func testNeverOverwritesAnExistingFile() throws {
        let source = try makeSource(bytes: 100)
        let destination = directory.appendingPathComponent("out.mov")
        try Data([1, 2, 3]).write(to: destination)
        XCTAssertThrowsError(
            try ChunkedFileCopier.copy(from: source, to: destination, isCancelled: { false })
        ) { error in
            XCTAssertEqual(error as? ChunkedFileCopier.CopyError, .destinationExists)
        }
        XCTAssertEqual(try Data(contentsOf: destination), Data([1, 2, 3]))
    }

    func testAMissingSourceIsAnIoErrorAndLeavesNothing() throws {
        let destination = directory.appendingPathComponent("out.mov")
        XCTAssertThrowsError(
            try ChunkedFileCopier.copy(
                from: directory.appendingPathComponent("missing.mov"),
                to: destination, isCancelled: { false }
            )
        ) { error in
            XCTAssertEqual((error as? ChunkedFileCopier.CopyError)?.failureCode, .ioError)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: destination.path))
    }
}

final class PreparationRulesTests: XCTestCase {
    private let mib: Int64 = 1024 * 1024

    func testFreeSpaceKeepsTheReserveOnTopOfTheSource() {
        XCTAssertEqual(FreeSpaceReserve.reserveBytes, 256 * mib)
        XCTAssertTrue(FreeSpaceReserve.hasRoom(freeBytes: 356 * mib, sourceBytes: 100 * mib))
        XCTAssertFalse(FreeSpaceReserve.hasRoom(freeBytes: 356 * mib - 1, sourceBytes: 100 * mib))
        XCTAssertTrue(FreeSpaceReserve.hasRoom(freeBytes: 256 * mib, sourceBytes: nil))
        XCTAssertFalse(FreeSpaceReserve.hasRoom(freeBytes: 255 * mib, sourceBytes: nil))
        XCTAssertTrue(FreeSpaceReserve.hasRoom(freeBytes: nil, sourceBytes: 100 * mib))
    }

    func testFilenamePrefersTheCurrentRenditionThenTheOriginal() {
        let full = AssetResourceDescriptor(kind: .fullSizeVideo, originalFilename: "FullSizeRender.mov")
        let original = AssetResourceDescriptor(kind: .video, originalFilename: "IMG_0042.MOV")
        let photo = AssetResourceDescriptor(kind: .other, originalFilename: "IMG_0042.HEIC")
        XCTAssertEqual(VideoFilename.choose(resources: [photo, original, full], assetId: "X"), "FullSizeRender.mov")
        XCTAssertEqual(VideoFilename.choose(resources: [photo, original], assetId: "X"), "IMG_0042.MOV")
        let blank = AssetResourceDescriptor(kind: .fullSizeVideo, originalFilename: "  ")
        XCTAssertEqual(VideoFilename.choose(resources: [blank, original], assetId: "X"), "IMG_0042.MOV")
    }

    func testFilenameFallbackIsStableAndSafe() {
        let id = "9F983DBA-EC35-42B8-8773-B597CF782EDD/L0/001"
        XCTAssertEqual(VideoFilename.choose(resources: [], assetId: id), "9F983DBA-EC35-42B8-8773-B597CF782EDD.MOV")
        XCTAssertEqual(VideoFilename.choose(resources: [], assetId: "../..//x"), "video.MOV")
    }

    private func facts(
        bytes: Int64 = 1000, duration: Double = 12.5, track: Bool = true,
        ext: String = "mov", type: String? = "com.apple.quicktime-movie",
        before: Date? = Date(timeIntervalSince1970: 100), after: Date? = Date(timeIntervalSince1970: 100)
    ) -> PreparedFileFacts {
        PreparedFileFacts(
            byteCount: bytes, durationSeconds: duration, hasReadableVideoTrack: track,
            fileExtension: ext, containerType: type, sourceModifiedBefore: before, sourceModifiedAfter: after
        )
    }

    func testAGoodFileIsReady() {
        XCTAssertNil(PreparedFileVerification.failure(for: facts()))
        XCTAssertNil(PreparedFileVerification.failure(for: facts(ext: "MP4", type: "public.mpeg-4")))
        XCTAssertNil(PreparedFileVerification.failure(for: facts(type: nil, before: nil, after: nil)))
    }

    func testFileSizeAloneIsNotEnough() {
        XCTAssertEqual(PreparedFileVerification.failure(for: facts(bytes: 0)), .ioError)
        XCTAssertEqual(PreparedFileVerification.failure(for: facts(track: false)), .unsupported)
        XCTAssertEqual(PreparedFileVerification.failure(for: facts(duration: 0)), .unsupported)
        XCTAssertEqual(PreparedFileVerification.failure(for: facts(duration: .infinity)), .unsupported)
        XCTAssertEqual(PreparedFileVerification.failure(for: facts(ext: "avi", type: nil)), .unsupported)
        XCTAssertEqual(PreparedFileVerification.failure(for: facts(ext: "mov", type: "public.mpeg-4")), .unsupported)
    }

    func testAChangedSourceWinsOverEverythingElse() {
        let changed = facts(bytes: 0, before: Date(timeIntervalSince1970: 100), after: Date(timeIntervalSince1970: 101))
        XCTAssertEqual(PreparedFileVerification.failure(for: changed), .sourceChanged)
    }
}
