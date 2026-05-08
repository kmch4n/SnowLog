interface ParsedVersion {
    numbers: number[];
}

function parseVersion(version: string): ParsedVersion | null {
    const match = version.trim().match(/^(\d+(?:\.\d+)*)(?:[-+].*)?$/);
    if (!match) {
        return null;
    }

    return {
        numbers: match[1].split(".").map((part) => Number(part)),
    };
}

/**
 * Compare dotted app versions such as 1.2.0 and 1.10.0.
 * Returns true only when remoteVersion is strictly newer.
 */
export function isRemoteVersionNewer(
    currentVersion: string,
    remoteVersion: string
): boolean {
    const current = parseVersion(currentVersion);
    const remote = parseVersion(remoteVersion);
    if (!current || !remote) {
        return false;
    }

    const length = Math.max(current.numbers.length, remote.numbers.length);
    for (let index = 0; index < length; index += 1) {
        const currentPart = current.numbers[index] ?? 0;
        const remotePart = remote.numbers[index] ?? 0;

        if (remotePart > currentPart) {
            return true;
        }
        if (remotePart < currentPart) {
            return false;
        }
    }

    return false;
}
