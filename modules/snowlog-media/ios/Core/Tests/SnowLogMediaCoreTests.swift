import XCTest
import SnowLogMediaCore

final class SnowLogMediaCoreTests: XCTestCase {
    func testContractVersionIsLinked() {
        XCTAssertEqual(SnowLogMediaCore.contractVersion, 1)
    }
}
