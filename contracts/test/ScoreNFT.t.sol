// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ScoreNFT.sol";

/**
 * ScoreNFT 单元测试 — Phase 3 Step S2
 *
 * 覆盖 playbook 完成标准的三项：mint / setTokenURI / 权限检查
 * 加上 tokenId 自增起点 + supportsInterface 接口注册
 */
contract ScoreNFTTest is Test {
    ScoreNFT nft;

    address admin = address(0xA11CE);
    address minter = address(0xB0B);
    address user = address(0xC0FFEE);
    address outsider = address(0xDEADBEEF);

    // ERC165 标准接口 ID（Solidity 4 字节类型标识）
    bytes4 constant IFACE_ERC165 = 0x01ffc9a7;
    bytes4 constant IFACE_ERC721 = 0x80ac58cd;
    bytes4 constant IFACE_ERC721_METADATA = 0x5b5e139f;
    bytes4 constant IFACE_ACCESS_CONTROL = 0x7965db0b;

    function setUp() public {
        vm.prank(admin);
        nft = new ScoreNFT(
            "Ripples in the Pond Score (Testnet)",
            "RIPS",
            minter
        );
    }

    // ───────── mint ─────────

    function testMintByMinterStartsFromOne() public {
        vm.prank(minter);
        uint256 id1 = nft.mint(user);
        assertEq(id1, 1, "first tokenId should be 1");
        assertEq(nft.ownerOf(1), user);
    }

    function testMintIncrementsTokenId() public {
        vm.startPrank(minter);
        uint256 id1 = nft.mint(user);
        uint256 id2 = nft.mint(user);
        uint256 id3 = nft.mint(outsider);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
        assertEq(nft.balanceOf(user), 2);
        assertEq(nft.balanceOf(outsider), 1);
    }

    function testMintRevertsForNonMinter() public {
        vm.prank(outsider);
        vm.expectRevert();
        nft.mint(user);
    }

    function testMintRevertsForAdminWithoutMinterRole() public {
        // admin 只有 DEFAULT_ADMIN_ROLE，不自动拥有 MINTER_ROLE
        vm.prank(admin);
        vm.expectRevert();
        nft.mint(user);
    }

    // ───────── setTokenURI ─────────

    function testSetTokenURIByMinter() public {
        vm.prank(minter);
        uint256 id = nft.mint(user);

        string memory uri = "ar://K0NAVlE00l6RhefjO7lZKqrG_HTSM9DglDhCC7UnhIo";
        vm.prank(minter);
        nft.setTokenURI(id, uri);

        assertEq(nft.tokenURI(id), uri);
    }

    function testSetTokenURICannotOverwrite() public {
        // Phase 6 D-C2：URI 首写一次永久不可改，防 MINTER_ROLE 私钥泄露后改 metadata
        vm.prank(minter);
        uint256 id = nft.mint(user);

        vm.prank(minter);
        nft.setTokenURI(id, "ar://first");

        vm.prank(minter);
        vm.expectRevert("ScoreNFT: URI already set");
        nft.setTokenURI(id, "ar://second");

        assertEq(nft.tokenURI(id), "ar://first", "first URI must persist");
    }

    function testSetTokenURIRevertsForNonMinter() public {
        vm.prank(minter);
        uint256 id = nft.mint(user);

        vm.prank(outsider);
        vm.expectRevert();
        nft.setTokenURI(id, "ar://bad");
    }

    function testSetTokenURIRevertsForNonexistentToken() public {
        vm.prank(minter);
        vm.expectRevert();
        nft.setTokenURI(999, "ar://notexist");
    }

    function testSetTokenURIRejectsEmpty() public {
        // CT-7：空串会把 tokenURI 永久焊成空；且拒绝后不能消耗唯一写入槽（下方非空仍可写）
        vm.prank(minter);
        uint256 id = nft.mint(user);

        vm.prank(minter);
        vm.expectRevert("ScoreNFT: empty URI");
        nft.setTokenURI(id, "");

        vm.prank(minter);
        nft.setTokenURI(id, "ar://valid");
        assertEq(nft.tokenURI(id), "ar://valid", "slot still writable after empty rejected");
    }

    // ───────── supportsInterface ─────────

    function testSupportsInterface() public view {
        assertTrue(nft.supportsInterface(IFACE_ERC165), "ERC165");
        assertTrue(nft.supportsInterface(IFACE_ERC721), "ERC721");
        assertTrue(nft.supportsInterface(IFACE_ERC721_METADATA), "ERC721Metadata");
        assertTrue(nft.supportsInterface(IFACE_ACCESS_CONTROL), "AccessControl");
    }

    // ───────── name / symbol ─────────

    function testNameAndSymbol() public view {
        assertEq(nft.name(), "Ripples in the Pond Score (Testnet)");
        assertEq(nft.symbol(), "RIPS");
    }
}
