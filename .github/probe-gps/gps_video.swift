// Re-export a movie with iPhone-style QuickTime location metadata, or dump the
// metadata AVFoundation reads from movies.
//
//   swift gps_video.swift IN.mov OUT.mov LAT LON ALT [CREATIONDATE]
//   swift gps_video.swift --dump A.mov [B.mov ...]
//
// The export uses AVAssetExportSession with the passthrough preset and a .mov
// container, so samples are copied untouched and AVFoundation writes the
// metadata the way the Camera app's files carry it: moov/meta with an 'mdta'
// handler, keys and ilst (com.apple.quicktime.location.ISO6709 etc.), plus the
// classic udta/(c)xyz string. Set GPS_DEVICE_KEYS=1 to add make/model/software.
// CREATIONDATE is ISO 8601 with offset, e.g. 2026-11-07T10:15:00+0900.

import AVFoundation
import CoreMedia
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

func iso6709(_ lat: Double, _ lon: Double, _ alt: Double) -> String {
    // iPhone form: +DD.DDDD+DDD.DDDD+AAA.AAA/
    return String(format: "%+08.4f%+09.4f%+08.3f/", lat, lon, alt)
}

func utf8Item(_ identifier: AVMetadataIdentifier, _ value: String) -> AVMetadataItem {
    let item = AVMutableMetadataItem()
    item.identifier = identifier
    item.value = value as NSString
    item.dataType = kCMMetadataBaseDataType_UTF8 as String
    return item
}

func quickTimeIdentifier(_ key: String) -> AVMetadataIdentifier {
    guard let id = AVMetadataItem.identifier(forKey: key as NSString, keySpace: .quickTimeMetadata) else {
        fail("cannot build identifier for \(key)")
    }
    return id
}

@available(macOS 13, *)
func dump(_ path: String) async {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    print("== \(path)")
    do {
        let formats = try await asset.load(.availableMetadataFormats)
        print("   formats: \(formats.map { $0.rawValue })")
        for format in formats {
            let items = try await asset.loadMetadata(for: format)
            for item in items {
                let value = (try? await item.load(.stringValue)) ?? "<non-string>"
                print("   [\(format.rawValue)] \(item.identifier?.rawValue ?? "?") = \(value)")
            }
        }
        let common = try await asset.load(.commonMetadata)
        for item in common where item.commonKey == .commonKeyLocation {
            let value = (try? await item.load(.stringValue)) ?? "<non-string>"
            print("   [common] location = \(value)")
        }
    } catch {
        print("   error: \(error)")
    }
}

@available(macOS 15, *)
func run(_ args: [String]) async {
    if args.count >= 3 && args[1] == "--dump" {
        for path in args.dropFirst(2) {
            await dump(path)
        }
        return
    }

    guard args.count >= 6,
          let lat = Double(args[3]), let lon = Double(args[4]), let alt = Double(args[5]) else {
        fail("usage: swift gps_video.swift IN.mov OUT.mov LAT LON ALT [CREATIONDATE] | --dump FILE...")
    }
    let src = URL(fileURLWithPath: args[1])
    let dst = URL(fileURLWithPath: args[2])
    let location = iso6709(lat, lon, alt)

    var items: [AVMetadataItem] = [
        utf8Item(quickTimeIdentifier("com.apple.quicktime.location.accuracy.horizontal"), "5.000000"),
        utf8Item(.quickTimeMetadataLocationISO6709, location),
        utf8Item(.quickTimeUserDataLocationISO6709, location),
    ]
    if args.count >= 7 {
        items.append(utf8Item(.quickTimeMetadataCreationDate, args[6]))
    }
    if ProcessInfo.processInfo.environment["GPS_DEVICE_KEYS"] == "1" {
        items.append(utf8Item(.quickTimeMetadataMake, "Apple"))
        items.append(utf8Item(.quickTimeMetadataModel, "iPhone"))
        items.append(utf8Item(.quickTimeMetadataSoftware, "26.0"))
    }

    let asset = AVURLAsset(url: src)
    guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
        fail("cannot create a passthrough export session for \(src.path)")
    }
    session.metadata = items
    try? FileManager.default.removeItem(at: dst)
    do {
        try await session.export(to: dst, as: .mov)
    } catch {
        fail("export failed: \(error)")
    }
    print("wrote \(dst.path) with \(location)")
    await dump(dst.path)
}

if #available(macOS 15, *) {
    await run(CommandLine.arguments)
} else {
    fail("needs macOS 15 or later")
}
