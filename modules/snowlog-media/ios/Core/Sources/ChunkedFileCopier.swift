import Foundation

/// Copies a local file into app-owned staging in bounded chunks (#86 §4.3).
///
/// Memory stays at one chunk (1 MiB by default) however large the movie is.
/// Cancellation is checked before every chunk. On cancellation or any I/O failure
/// the writer is closed first and the partial destination is then removed, so a
/// failed copy never leaves a file that looks complete.
public enum ChunkedFileCopier {
    public static let defaultChunkSize = 1 << 20

    public enum CopyError: Error, Equatable {
        case cancelled
        /// The destination already exists. The copier never overwrites.
        case destinationExists
        case sourceUnreadable
        case writeFailed

        public var failureCode: MediaFailureCode {
            switch self {
            case .cancelled:
                return .cancelled
            case .destinationExists, .sourceUnreadable, .writeFailed:
                return .ioError
            }
        }
    }

    /// Returns the number of bytes written.
    @discardableResult
    public static func copy(
        from source: URL,
        to destination: URL,
        chunkSize: Int = defaultChunkSize,
        isCancelled: () -> Bool,
        onProgress: (Int64) -> Void = { _ in }
    ) throws -> Int64 {
        precondition(chunkSize > 0, "chunkSize must be positive")
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: destination.path) {
            throw CopyError.destinationExists
        }
        if isCancelled() {
            throw CopyError.cancelled
        }

        let reader: FileHandle
        do {
            reader = try FileHandle(forReadingFrom: source)
        } catch {
            throw CopyError.sourceUnreadable
        }
        defer { try? reader.close() }

        guard fileManager.createFile(atPath: destination.path, contents: nil) else {
            throw CopyError.writeFailed
        }
        let writer: FileHandle
        do {
            writer = try FileHandle(forWritingTo: destination)
        } catch {
            try? fileManager.removeItem(at: destination)
            throw CopyError.writeFailed
        }

        var written: Int64 = 0
        var failure: CopyError?
        while true {
            if isCancelled() {
                failure = .cancelled
                break
            }
            let chunk: Data?
            do {
                chunk = try reader.read(upToCount: chunkSize)
            } catch {
                failure = .sourceUnreadable
                break
            }
            guard let data = chunk, !data.isEmpty else { break }
            do {
                try writer.write(contentsOf: data)
            } catch {
                failure = .writeFailed
                break
            }
            written += Int64(data.count)
            onProgress(written)
        }

        if failure == nil {
            do {
                try writer.synchronize()
            } catch {
                failure = .writeFailed
            }
        }
        try? writer.close()
        if let failure = failure {
            try? fileManager.removeItem(at: destination)
            throw failure
        }
        return written
    }
}
