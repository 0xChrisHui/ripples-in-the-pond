// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {MaterialTestBase, MaterialReceiver} from "./MaterialTestBase.sol";
import {MaterialNFT} from "../../src/MaterialNFT.sol";
import {OptimismOriginalSBT} from "../../src/p17/OptimismOriginalSBT.sol";

// 新旧合约并存；不可转让不自动等于按钱包终身限领政策。
contract OptimismSBTTest is MaterialTestBase {
    OptimismOriginalSBT internal sbt;
    function setUp() public override {
        super.setUp(); (uint256[35] memory ids, string[35] memory uris) = metadata();
        sbt = new OptimismOriginalSBT(ids, uris, URI, ADMIN, signer, PAUSER);
        vm.prank(signer); sbt.mint(RECIPIENT, 1, 1, "");
    }
    function testSbtCannotTransfer() public {
        vm.expectRevert(); vm.prank(RECIPIENT);
        sbt.safeTransferFrom(RECIPIENT, address(0xBEEF), 1, 1, "");
        assertEq(sbt.balanceOf(RECIPIENT, 1), 1);
    }
    function testSbtCannotBatchTransferOrGrantApproval() public {
        uint256[] memory ids = new uint256[](1); ids[0] = 1;
        uint256[] memory amounts = new uint256[](1); amounts[0] = 1;
        vm.expectRevert(); vm.prank(RECIPIENT);
        sbt.safeBatchTransferFrom(RECIPIENT, address(0xBEEF), ids, amounts, "");
        vm.expectRevert(); vm.prank(RECIPIENT); sbt.setApprovalForAll(address(0xBEEF), true);
    }
    function testOnlyMinterCanMintAndPauseStopsMinting() public {
        vm.expectRevert(); vm.prank(RECIPIENT); sbt.mint(RECIPIENT, 2, 1, "");
        vm.expectRevert(); vm.prank(ADMIN); sbt.mint(RECIPIENT, 2, 1, "");
        vm.prank(PAUSER); sbt.pause();
        vm.expectRevert(); vm.prank(signer); sbt.mint(RECIPIENT, 2, 1, "");
        vm.expectRevert(); vm.prank(PAUSER); sbt.unpause();
        vm.prank(ADMIN); sbt.unpause(); vm.prank(signer); sbt.mint(RECIPIENT, 2, 1, "");
        assertEq(sbt.balanceOf(RECIPIENT, 2), 1);
    }
    function testFixedMetadataAndInvalidAmountIdRecipient() public {
        for (uint256 id = 1; id <= 35; ++id) assertEq(sbt.uri(id), URI);
        assertTrue(sbt.isSoulbound()); assertTrue(sbt.supportsInterface(0xd9b67a26));
        vm.expectRevert(); vm.prank(signer); sbt.mint(RECIPIENT, 36, 1, "");
        vm.expectRevert(); vm.prank(signer); sbt.mint(RECIPIENT, 1, 2, "");
        vm.expectRevert(); vm.prank(signer); sbt.mint(address(0), 1, 1, "");
    }
    function testRejectedReceiverAndReentryRollback() public {
        MaterialReceiver receiver = new MaterialReceiver(); receiver.configure(true, "");
        vm.expectRevert(); vm.prank(signer); sbt.mint(address(receiver), 1, 1, "");
        assertEq(sbt.balanceOf(address(receiver), 1), 0);
        bytes32 role = sbt.MINTER_ROLE(); vm.prank(ADMIN); sbt.grantRole(role, address(receiver));
        receiver.configure(false, abi.encodeCall(sbt.mint, (address(receiver), 2, 1, "")));
        vm.prank(signer); sbt.mint(address(receiver), 1, 1, "");
        assertFalse(receiver.reentrySucceeded()); assertEq(sbt.balanceOf(address(receiver), 2), 0);
    }
    function testLegacyContractStillTransfersAndNoUnapprovedWalletLifetimeCap() public {
        MaterialNFT legacy = new MaterialNFT(URI, signer);
        vm.prank(signer); legacy.mint(RECIPIENT, 1, 1, "");
        vm.prank(RECIPIENT); legacy.safeTransferFrom(RECIPIENT, address(0xBEEF), 1, 1, "");
        assertEq(legacy.balanceOf(address(0xBEEF), 1), 1);
        vm.prank(signer); sbt.mint(RECIPIENT, 1, 1, ""); assertEq(sbt.balanceOf(RECIPIENT, 1), 2);
    }
    function testFuzzNoTransferIncludingSelfAndZeroAmount(address to, uint256 amount) public {
        amount = bound(amount, 0, 1); vm.assume(to != address(0));
        vm.expectRevert(); vm.prank(RECIPIENT); sbt.safeTransferFrom(RECIPIENT, to, 1, amount, "");
        assertEq(sbt.balanceOf(RECIPIENT, 1), 1);
    }
}
