// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {MaterialTestBase, MaterialReceiver} from "./MaterialTestBase.sol";
import {EthereumMaterialNFT} from "../../src/p17/EthereumMaterialNFT.sol";

/// 针对用户批准的真实发行规则，不以当前余额代替历史领取次数。
contract MaterialIssuanceTest is MaterialTestBase {
    function testDifferentOrderCannotClaimSameWalletTokenTwice() public {
        redeem(authorization(bytes32(uint256(1))));
        EthereumMaterialNFT.MaterialMintAuthorization memory again = authorization(bytes32(uint256(2)));
        bytes memory sig = signature(again);
        vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(again, signer, sig);
        assertEq(nft.balanceOf(RECIPIENT, 1), 1);
        assertFalse(nft.redeemedOrders(again.orderId));
    }
    function testTransferDoesNotRestoreClaimAndBatchTransferRemainsAllowed() public {
        redeem(authorization(bytes32(uint256(1))));
        uint256[] memory ids = new uint256[](1); ids[0] = 1;
        uint256[] memory amounts = new uint256[](1); amounts[0] = 1;
        vm.prank(RECIPIENT); nft.safeBatchTransferFrom(RECIPIENT, address(0xBEEF), ids, amounts, "");
        assertEq(nft.balanceOf(RECIPIENT, 1), 0);
        assertEq(nft.balanceOf(address(0xBEEF), 1), 1);
        EthereumMaterialNFT.MaterialMintAuthorization memory again = authorization(bytes32(uint256(2)));
        bytes memory sig = signature(again);
        vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(again, signer, sig);
    }
    function testTransferredHolderCanUseOwnClaim() public {
        redeem(authorization(bytes32(uint256(1))));
        vm.prank(RECIPIENT); nft.safeTransferFrom(RECIPIENT, address(0xBEEF), 1, 1, "");
        EthereumMaterialNFT.MaterialMintAuthorization memory other = authorization(bytes32(uint256(2)));
        other.recipient = address(0xBEEF); redeem(other);
        assertEq(nft.balanceOf(address(0xBEEF), 1), 2);
    }
    function testSameWalletMayClaimEachOfThirtyFiveTokens() public {
        for (uint256 id = 1; id <= 35; ++id) {
            EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(id));
            a.tokenId = id; redeem(a); assertEq(nft.balanceOf(RECIPIENT, id), 1);
        }
    }
    function testDifferentWalletsNotRestrictedByOldFixtureSupplyCap() public {
        for (uint256 index = 1; index <= 10; ++index) {
            EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(index));
            a.recipient = address(uint160(0x1000 + index)); redeem(a);
            assertEq(nft.balanceOf(a.recipient, 1), 1);
        }
    }
    function testRejectedReceiverDoesNotConsumeWalletClaim() public {
        MaterialReceiver receiver = new MaterialReceiver();
        EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(1)));
        a.recipient = address(receiver); bytes memory sig = signature(a);
        receiver.configure(true, ""); vm.expectRevert(); vm.prank(address(receiver)); nft.redeem(a, signer, sig);
        assertFalse(nft.redeemedOrders(a.orderId));
        receiver.configure(false, ""); redeem(a);
        assertEq(nft.balanceOf(address(receiver), 1), 1);
    }
}
