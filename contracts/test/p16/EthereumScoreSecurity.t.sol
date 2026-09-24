// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EthereumScoreNFT} from "../../src/EthereumScoreNFT.sol";
import {EthereumScoreTestBase, RejectingScoreReceiver} from "./EthereumScoreTestBase.sol";

contract EthereumScoreSecurityTest is EthereumScoreTestBase {
    function testEverySignedFieldAndDomainAreBound() public {
        EthereumScoreNFT.MintAuthorization memory original =
            makeAuthorization(keccak256("bound"), 11, RECIPIENT, TOKEN_URI);
        bytes memory signature = signAuthorization(original, AUTHORIZER_KEY);

        EthereumScoreNFT.MintAuthorization memory changed =
            makeAuthorization(keccak256("bound"), 11, RECIPIENT, TOKEN_URI);
        changed.orderId = keccak256("changed");
        _expectInvalid(changed, TOKEN_URI, signature);
        changed = makeAuthorization(keccak256("bound"), 11, RECIPIENT, TOKEN_URI);
        changed.tokenId++;
        _expectInvalid(changed, TOKEN_URI, signature);
        changed = makeAuthorization(keccak256("bound"), 11, RECIPIENT, TOKEN_URI);
        changed.recipient = OUTSIDER;
        vm.expectRevert(EthereumScoreNFT.InvalidSignature.selector);
        vm.prank(OUTSIDER);
        nft.redeem(changed, TOKEN_URI, authorizer, signature);
        changed = makeAuthorization(keccak256("bound"), 11, RECIPIENT, TOKEN_URI);
        changed.tokenURIHash = keccak256(bytes(SECOND_URI));
        _expectInvalid(changed, SECOND_URI, signature);
        changed = makeAuthorization(keccak256("bound"), 11, RECIPIENT, TOKEN_URI);
        changed.deadline++;
        _expectInvalid(changed, TOKEN_URI, signature);

        EthereumScoreNFT other = new EthereumScoreNFT(COLLECTION_URI, ADMIN_DELAY, ADMIN, authorizer, PAUSER);
        vm.expectRevert(EthereumScoreNFT.InvalidSignature.selector);
        vm.prank(RECIPIENT);
        other.redeem(original, TOKEN_URI, authorizer, signature);
        vm.chainId(block.chainid + 1);
        _expectInvalid(original, TOKEN_URI, signature);
    }

    function testFrontrunExpiryBadSignerAndMalformedSignatureFail() public {
        EthereumScoreNFT.MintAuthorization memory authorization =
            makeAuthorization(keccak256("guard"), 3, RECIPIENT, TOKEN_URI);
        bytes memory signature = signAuthorization(authorization, AUTHORIZER_KEY);

        vm.expectRevert(abi.encodeWithSelector(EthereumScoreNFT.CallerNotRecipient.selector, OUTSIDER, RECIPIENT));
        vm.prank(OUTSIDER);
        nft.redeem(authorization, TOKEN_URI, authorizer, signature);

        vm.warp(authorization.deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(EthereumScoreNFT.AuthorizationExpired.selector, authorization.deadline));
        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, authorizer, signature);

        authorization.deadline = block.timestamp + 1 hours;
        vm.expectRevert(abi.encodeWithSelector(EthereumScoreNFT.UnauthorizedAuthorizer.selector, OUTSIDER));
        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, OUTSIDER, hex"00");
        vm.expectRevert(EthereumScoreNFT.InvalidSignature.selector);
        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, authorizer, hex"00");
    }

    function testPauseBlocksMintButNeverTransfer() public {
        EthereumScoreNFT.MintAuthorization memory first =
            makeAuthorization(keccak256("before-pause"), 1, RECIPIENT, TOKEN_URI);
        redeem(first, TOKEN_URI);
        vm.prank(PAUSER);
        nft.pause();

        EthereumScoreNFT.MintAuthorization memory second =
            makeAuthorization(keccak256("paused"), 2, RECIPIENT, SECOND_URI);
        bytes memory secondSignature = signAuthorization(second, AUTHORIZER_KEY);
        vm.expectRevert("Pausable: paused");
        vm.prank(RECIPIENT);
        nft.redeem(second, SECOND_URI, authorizer, secondSignature);

        vm.prank(RECIPIENT);
        nft.transferFrom(RECIPIENT, OUTSIDER, 1);
        assertEq(nft.ownerOf(1), OUTSIDER);
        vm.expectRevert();
        vm.prank(PAUSER);
        nft.unpause();
        vm.prank(ADMIN);
        nft.unpause();
    }

    function testReceiverFailureRollsBackOrderAndToken() public {
        RejectingScoreReceiver receiver = new RejectingScoreReceiver();
        EthereumScoreNFT.MintAuthorization memory authorization =
            makeAuthorization(keccak256("reject"), 22, address(receiver), TOKEN_URI);
        bytes memory signature = signAuthorization(authorization, AUTHORIZER_KEY);
        vm.expectRevert("reject mint");
        vm.prank(address(receiver));
        nft.redeem(authorization, TOKEN_URI, authorizer, signature);
        assertEq(nft.tokenIdByOrderId(authorization.orderId), 0);
        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(22);
    }

    function testRejectsInvalidIdsUrisAndUriHash() public {
        EthereumScoreNFT.MintAuthorization memory authorization = makeAuthorization(bytes32(0), 1, RECIPIENT, TOKEN_URI);
        vm.expectRevert(EthereumScoreNFT.EmptyOrderId.selector);
        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, authorizer, hex"");
        authorization = makeAuthorization(keccak256("zero-token"), 0, RECIPIENT, TOKEN_URI);
        vm.expectRevert(EthereumScoreNFT.InvalidTokenId.selector);
        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, authorizer, hex"");

        string[5] memory invalidUris = [
            "",
            "https://example.com",
            "ar://short",
            "ar://TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT/",
            "ar://TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT+"
        ];
        for (uint256 i; i < invalidUris.length; ++i) {
            authorization = makeAuthorization(bytes32(i + 1), i + 1, RECIPIENT, invalidUris[i]);
            vm.expectRevert(EthereumScoreNFT.InvalidPermanentURI.selector);
            vm.prank(RECIPIENT);
            nft.redeem(authorization, invalidUris[i], authorizer, hex"");
        }

        authorization = makeAuthorization(keccak256("hash"), 99, RECIPIENT, TOKEN_URI);
        vm.expectRevert(EthereumScoreNFT.TokenURIHashMismatch.selector);
        vm.prank(RECIPIENT);
        nft.redeem(authorization, SECOND_URI, authorizer, hex"");
    }

    function testFuzzAnyTokenIdChangeInvalidatesSignature(uint256 changedTokenId) public {
        vm.assume(changedTokenId != 0 && changedTokenId != 44);
        EthereumScoreNFT.MintAuthorization memory original =
            makeAuthorization(keccak256("fuzz"), 44, RECIPIENT, TOKEN_URI);
        bytes memory signature = signAuthorization(original, AUTHORIZER_KEY);
        original.tokenId = changedTokenId;
        _expectInvalid(original, TOKEN_URI, signature);
    }

    function _expectInvalid(
        EthereumScoreNFT.MintAuthorization memory authorization,
        string memory uri,
        bytes memory signature
    ) private {
        vm.expectRevert(EthereumScoreNFT.InvalidSignature.selector);
        vm.prank(authorization.recipient);
        nft.redeem(authorization, uri, authorizer, signature);
    }
}
