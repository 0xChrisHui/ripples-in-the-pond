// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MaterialNFT.sol";

/**
 * MaterialNFT 单元测试 — CT-5（对齐 ScoreNFT.t.sol 覆盖度）+ CT-8（freezeURI 封条）
 *
 * 覆盖：构造角色 / mint 权限 / setURI 权限 + 事件 / freezeURI 单向锁 / supportsInterface
 */
contract MaterialNFTTest is Test {
    MaterialNFT nft;

    address admin = address(0xA11CE);
    address minter = address(0xB0B);
    address user = address(0xC0FFEE);
    address outsider = address(0xDEADBEEF);

    string constant INITIAL_URI = "ar://initial-material-uri";

    // ERC165 标准接口 ID
    bytes4 constant IFACE_ERC165 = 0x01ffc9a7;
    bytes4 constant IFACE_ERC1155 = 0xd9b67a26;
    bytes4 constant IFACE_ERC1155_METADATA = 0x0e89341c;
    bytes4 constant IFACE_ACCESS_CONTROL = 0x7965db0b;

    event URIUpdated(string newUri);
    event URIFrozen(string finalUri);

    function setUp() public {
        vm.prank(admin);
        nft = new MaterialNFT(INITIAL_URI, minter);
    }

    // ───────── 构造角色 ─────────

    function testConstructorGrantsRoles() public view {
        assertTrue(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), admin), "admin should have DEFAULT_ADMIN_ROLE");
        assertTrue(nft.hasRole(nft.MINTER_ROLE(), minter), "minter should have MINTER_ROLE");
        assertFalse(nft.hasRole(nft.MINTER_ROLE(), admin), "admin should not auto-hold MINTER_ROLE");
    }

    // ───────── mint ─────────

    function testMintByMinter() public {
        vm.prank(minter);
        nft.mint(user, 1, 5, "");
        assertEq(nft.balanceOf(user, 1), 5);
    }

    function testMintRevertsForNonMinter() public {
        vm.prank(outsider);
        vm.expectRevert();
        nft.mint(user, 1, 5, "");
    }

    function testMintRevertsForAdminWithoutMinterRole() public {
        vm.prank(admin);
        vm.expectRevert();
        nft.mint(user, 1, 5, "");
    }

    // ───────── setURI ─────────

    function testSetURIByAdmin() public {
        vm.expectEmit(false, false, false, true);
        emit URIUpdated("ar://updated");
        vm.prank(admin);
        nft.setURI("ar://updated");
        assertEq(nft.uri(0), "ar://updated");
    }

    function testSetURIRevertsForNonAdmin() public {
        vm.prank(outsider);
        vm.expectRevert();
        nft.setURI("ar://bad");
    }

    // ───────── freezeURI（CT-8）─────────

    function testFreezeURILocksSetURI() public {
        // 先 setURI 到最终值，再 freeze，此后 setURI 永久 revert
        vm.prank(admin);
        nft.setURI("ar://final");

        vm.expectEmit(false, false, false, true);
        emit URIFrozen("ar://final");
        vm.prank(admin);
        nft.freezeURI();

        assertTrue(nft.uriFrozen(), "uriFrozen should be true after freeze");

        vm.prank(admin);
        vm.expectRevert("MaterialNFT: URI frozen");
        nft.setURI("ar://tamper");

        assertEq(nft.uri(0), "ar://final", "URI stays at final value after freeze");
    }

    function testFreezeURIRevertsForNonAdmin() public {
        vm.prank(outsider);
        vm.expectRevert();
        nft.freezeURI();
    }

    function testFreezeURICannotDoubleFreeze() public {
        vm.prank(admin);
        nft.freezeURI();

        vm.prank(admin);
        vm.expectRevert("MaterialNFT: already frozen");
        nft.freezeURI();
    }

    // ───────── supportsInterface ─────────

    function testSupportsInterface() public view {
        assertTrue(nft.supportsInterface(IFACE_ERC165), "ERC165");
        assertTrue(nft.supportsInterface(IFACE_ERC1155), "ERC1155");
        assertTrue(nft.supportsInterface(IFACE_ERC1155_METADATA), "ERC1155MetadataURI");
        assertTrue(nft.supportsInterface(IFACE_ACCESS_CONTROL), "AccessControl");
    }
}
