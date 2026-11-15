import Foundation

/// Free space kept back before writing a movie (#86 §6 item 3). Same value as
/// `FREE_SPACE_RESERVE_BYTES` in `src/services/videoTransferRunner.ts`.
public enum FreeSpaceReserve {
    public static let reserveBytes: Int64 = 256 * 1024 * 1024

    /// Known source length needs `length + reserve`; unknown length (an export)
    /// needs the reserve now and must be re-checked while writing. An unknown free
    /// space is not treated as full, matching the JS runner.
    public static func hasRoom(freeBytes: Int64?, sourceBytes: Int64?) -> Bool {
        guard let free = freeBytes else { return true }
        let needed = reserveBytes + max(0, sourceBytes ?? 0)
        return free >= needed
    }
}

/// A Photos resource as far as filename selection needs it.
public struct AssetResourceDescriptor: Equatable {
    public enum Kind: Equatable {
        /// `PHAssetResourceType.fullSizeVideo`: the current (edited) rendition.
        case fullSizeVideo
        /// `PHAssetResourceType.video`: the original.
        case video
        case other
    }

    public var kind: Kind
    public var originalFilename: String

    public init(kind: Kind, originalFilename: String) {
        self.kind = kind
        self.originalFilename = originalFilename
    }
}

public enum VideoFilename {
    /// The user-visible filename (#86 §4.2): the current full-size video resource,
    /// then the video resource, then a stable name derived from the asset ID.
    public static func choose(resources: [AssetResourceDescriptor], assetId: String) -> String {
        for kind in [AssetResourceDescriptor.Kind.fullSizeVideo, .video] {
            if let name = resources.first(where: { $0.kind == kind && !isBlank($0.originalFilename) }) {
                return name.originalFilename
            }
        }
        return fallback(assetId: assetId)
    }

    /// `"<first component of the asset ID>.MOV"`, keeping only letters, digits and
    /// hyphens. A local identifier looks like `"9F98…-A7C1/L0/001"`.
    static func fallback(assetId: String) -> String {
        let head = assetId.split(separator: "/", maxSplits: 1).first.map(String.init) ?? ""
        let allowed = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-")
        let safe = String(head.filter { allowed.contains($0) })
        return (safe.isEmpty ? "video" : safe) + ".MOV"
    }

    private static func isBlank(_ value: String) -> Bool {
        return value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

/// What the adapter measured about a prepared file before reporting `ready` (#86 §4.3).
public struct PreparedFileFacts: Equatable {
    public var byteCount: Int64
    public var durationSeconds: Double
    public var hasReadableVideoTrack: Bool
    public var fileExtension: String
    /// The container's uniform type identifier, if it could be read.
    public var containerType: String?
    /// The asset's modification date when acquisition started and when it finished.
    public var sourceModifiedBefore: Date?
    public var sourceModifiedAfter: Date?

    public init(
        byteCount: Int64,
        durationSeconds: Double,
        hasReadableVideoTrack: Bool,
        fileExtension: String,
        containerType: String?,
        sourceModifiedBefore: Date?,
        sourceModifiedAfter: Date?
    ) {
        self.byteCount = byteCount
        self.durationSeconds = durationSeconds
        self.hasReadableVideoTrack = hasReadableVideoTrack
        self.fileExtension = fileExtension
        self.containerType = containerType
        self.sourceModifiedBefore = sourceModifiedBefore
        self.sourceModifiedAfter = sourceModifiedAfter
    }
}

public enum PreparedFileVerification {
    /// Extension → container UTI. The extensions are `PreparedVideo.extension` in
    /// `src/types/media.ts`.
    public static let containerTypes: [String: String] = [
        "mov": "com.apple.quicktime-movie",
        "mp4": "public.mpeg-4",
        "m4v": "com.apple.m4v-video",
    ]

    /// Returns nil when the file may be reported `ready`. File size alone is never
    /// enough (§4.3).
    ///
    /// A changed source comes first: the content may be a mix of two versions, and the
    /// caller keeps the import metadata for review instead of committing it.
    public static func failure(for facts: PreparedFileFacts) -> MediaFailureCode? {
        if let before = facts.sourceModifiedBefore,
           let after = facts.sourceModifiedAfter,
           before != after {
            return .sourceChanged
        }
        if facts.byteCount <= 0 {
            return .ioError
        }
        let ext = facts.fileExtension.lowercased()
        guard let expectedType = containerTypes[ext] else {
            return .unsupported
        }
        if let actualType = facts.containerType, actualType != expectedType {
            return .unsupported
        }
        if !facts.hasReadableVideoTrack {
            return .unsupported
        }
        if !facts.durationSeconds.isFinite || facts.durationSeconds <= 0 {
            return .unsupported
        }
        return nil
    }
}
