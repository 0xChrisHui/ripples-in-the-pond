// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {MaterialTestBase, MaterialReceiver, BoundedMaterialHarness} from "./MaterialTestBase.sol";
import {EthereumMaterialNFT} from "../../src/p17/EthereumMaterialNFT.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

contract Material1271 is IERC1271 {
    bytes32 public digest;
    function approve(bytes32 value) external { digest = value; }
    function isValidSignature(bytes32 value, bytes memory) external view returns(bytes4) {
        return value == digest ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}
contract MaterialSecurityTest is MaterialTestBase {
    function testRedeemAndOrderReplay() public {
        EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(1)));
        redeem(a); assertTrue(nft.redeemedOrders(a.orderId)); assertEq(nft.balanceOf(RECIPIENT, 1), 1);
        bytes memory sig = signature(a); vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(a, signer, sig);
    }
    function testEverySignedFieldTamper() public {
        for (uint256 i; i < 6; ++i) {
            EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(i + 1)));
            bytes memory sig = signature(a);
            if (i == 0) a.orderId = bytes32(uint256(80));
            if (i == 1) a.tokenId = 2;
            if (i == 2) a.amount = 2;
            if (i == 3) a.recipient = address(0xBAD);
            if (i == 4) a.tokenURIHash = bytes32(uint256(90));
            if (i == 5) a.deadline += 1;
            vm.expectRevert(); vm.prank(a.recipient); nft.redeem(a, signer, sig);
        }
    }
    function testChainAndContractReplayRejected() public {
        EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(1)));
        bytes memory sig = signature(a);
        vm.chainId(1); vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(a, signer, sig); vm.chainId(31337);
        (uint256[35] memory ids, string[35] memory uris) = metadata();
        BoundedMaterialHarness other = new BoundedMaterialHarness(ids, uris, ADMIN, signer, PAUSER);
        vm.expectRevert(); vm.prank(RECIPIENT); other.redeem(a, signer, sig);
    }
    function testFrontRunExpiredAndInvalidInputs() public {
        EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(1)));
        bytes memory sig = signature(a);
        vm.expectRevert(); vm.prank(address(0xBAD)); nft.redeem(a, signer, sig);
        vm.warp(a.deadline + 1); vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(a, signer, sig);
        for (uint256 i; i < 5; ++i) {
            a = authorization(bytes32(uint256(1)));
            if (i == 0) a.amount = 0;
            if (i == 1) a.amount = type(uint256).max;
            if (i == 2) a.tokenId = 36;
            if (i == 3) a.recipient = address(0);
            if (i == 4) a.orderId = bytes32(0);
            sig = signature(a); vm.expectRevert(); vm.prank(a.recipient); nft.redeem(a, signer, sig);
        }
    }
    function testRoleRevocationAnd1271() public {
        EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(1)));
        bytes memory sig = signature(a);
        bytes32 role = nft.AUTHORIZER_ROLE();
        vm.prank(ADMIN); nft.revokeRole(role, signer);
        vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(a, signer, sig);
        Material1271 contractSigner = new Material1271();
        vm.prank(ADMIN); nft.grantRole(role, address(contractSigner));
        contractSigner.approve(nft.authorizationDigest(a));
        vm.prank(RECIPIENT); nft.redeem(a, address(contractSigner), hex"12");
        assertEq(nft.balanceOf(RECIPIENT, 1), 1);
    }
    function testReceiverRollbackAndReentry() public {
        MaterialReceiver receiver = new MaterialReceiver();
        EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(1)));
        a.recipient = address(receiver); bytes memory sig = signature(a);
        receiver.configure(true, ""); vm.expectRevert(); vm.prank(address(receiver)); nft.redeem(a, signer, sig);
        assertFalse(nft.redeemedOrders(a.orderId)); assertEq(nft.balanceOf(address(receiver), 1), 0);
        receiver.configure(false, abi.encodeCall(nft.redeem, (a, signer, sig)));
        vm.prank(address(receiver)); nft.redeem(a, signer, sig);
        assertFalse(receiver.reentrySucceeded()); assertTrue(nft.redeemedOrders(a.orderId));
    }
    function testPauseKeepsTransfersAndAdminDelay() public {
        redeem(authorization(bytes32(uint256(1))));
        vm.prank(PAUSER); nft.pause();
        EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(2)));
        bytes memory sig = signature(a); vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(a, signer, sig);
        vm.prank(RECIPIENT); nft.safeTransferFrom(RECIPIENT, address(0xBAD), 1, 1, "");
        assertEq(nft.balanceOf(address(0xBAD), 1), 1);
        vm.expectRevert(); vm.prank(PAUSER); nft.unpause();
        vm.prank(ADMIN); nft.unpause(); assertEq(nft.defaultAdminDelay(), 2 days);
        vm.prank(ADMIN); nft.beginDefaultAdminTransfer(address(0xDADA));
        vm.expectRevert(); vm.prank(address(0xDADA)); nft.acceptDefaultAdminTransfer();
        vm.warp(block.timestamp + 2 days + 1); vm.prank(address(0xDADA)); nft.acceptDefaultAdminTransfer();
        assertEq(nft.defaultAdmin(), address(0xDADA));
    }
    function testMetadataAndRoleValidation() public {
        for (uint256 i = 1; i <= 35; ++i) assertEq(nft.uri(i), URI);
        vm.expectRevert(); nft.uri(0);
        (uint256[35] memory ids, string[35] memory uris) = metadata(); ids[34] = 1;
        vm.expectRevert(); new BoundedMaterialHarness(ids, uris, ADMIN, signer, PAUSER);
        (ids, uris) = metadata(); uris[1] = "https://example.com";
        vm.expectRevert(); new BoundedMaterialHarness(ids, uris, ADMIN, signer, PAUSER);
        (ids, uris) = metadata();
        vm.expectRevert(); new BoundedMaterialHarness(ids, uris, ADMIN, ADMIN, PAUSER);
        assertTrue(nft.supportsInterface(0xd9b67a26));
    }
    function testFuzzWrongAmount(uint256 amount) public {
        vm.assume(amount != 1); EthereumMaterialNFT.MaterialMintAuthorization memory a = authorization(bytes32(uint256(1)));
        a.amount = amount; bytes memory sig = signature(a); vm.expectRevert(); vm.prank(RECIPIENT); nft.redeem(a, signer, sig);
    }
}
