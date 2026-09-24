// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EthereumScoreNFT} from "../../src/EthereumScoreNFT.sol";
import {EthereumScoreTestBase, MockScoreAuthorizer} from "./EthereumScoreTestBase.sol";

contract EthereumScoreNFTTest is EthereumScoreTestBase {
    event ScoreRedeemed(
        bytes32 indexed orderId, address indexed recipient, uint256 indexed tokenId, bytes32 tokenURIHash
    );

    function testConstructorFreezesIdentityUriAndRoles() public view {
        assertEq(nft.name(), "Ripples in the Pond");
        assertEq(nft.symbol(), "RPIP");
        assertEq(nft.contractURI(), COLLECTION_URI);
        assertEq(nft.defaultAdmin(), ADMIN);
        assertEq(nft.defaultAdminDelay(), ADMIN_DELAY);
        assertTrue(nft.hasRole(nft.AUTHORIZER_ROLE(), authorizer));
        assertTrue(nft.hasRole(nft.PAUSER_ROLE(), PAUSER));
        assertFalse(nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), address(this)));
    }

    function testConstructorRejectsInvalidUriAndOverlappingRoles() public {
        vm.expectRevert(EthereumScoreNFT.InvalidPermanentURI.selector);
        new EthereumScoreNFT("https://example.com", ADMIN_DELAY, ADMIN, authorizer, PAUSER);

        vm.expectRevert(EthereumScoreNFT.RolesMustDiffer.selector);
        new EthereumScoreNFT(COLLECTION_URI, ADMIN_DELAY, ADMIN, ADMIN, PAUSER);
    }

    function testRedeemWritesOwnerUriMappingAndEvent() public {
        bytes32 orderId = keccak256("order-1");
        EthereumScoreNFT.MintAuthorization memory authorization = makeAuthorization(orderId, 17, RECIPIENT, TOKEN_URI);
        bytes memory signature = signAuthorization(authorization, AUTHORIZER_KEY);

        vm.expectEmit(true, true, true, true);
        emit ScoreRedeemed(orderId, RECIPIENT, 17, keccak256(bytes(TOKEN_URI)));
        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, authorizer, signature);

        assertEq(nft.ownerOf(17), RECIPIENT);
        assertEq(nft.tokenURI(17), TOKEN_URI);
        assertEq(nft.tokenIdByOrderId(orderId), 17);
    }

    function testReplayAndDuplicateTokenAreRejected() public {
        EthereumScoreNFT.MintAuthorization memory first = makeAuthorization(keccak256("first"), 7, RECIPIENT, TOKEN_URI);
        redeem(first, TOKEN_URI);
        bytes memory firstSignature = signAuthorization(first, AUTHORIZER_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(EthereumScoreNFT.OrderAlreadyRedeemed.selector, first.orderId, first.tokenId)
        );
        vm.prank(RECIPIENT);
        nft.redeem(first, TOKEN_URI, authorizer, firstSignature);

        EthereumScoreNFT.MintAuthorization memory second =
            makeAuthorization(keccak256("second"), 7, RECIPIENT, SECOND_URI);
        bytes memory secondSignature = signAuthorization(second, AUTHORIZER_KEY);
        vm.expectRevert(abi.encodeWithSelector(EthereumScoreNFT.TokenAlreadyMinted.selector, 7));
        vm.prank(RECIPIENT);
        nft.redeem(second, SECOND_URI, authorizer, secondSignature);
    }

    function testSupportsEOAAndERC1271Authorizers() public {
        redeem(makeAuthorization(keccak256("eoa"), 1, RECIPIENT, TOKEN_URI), TOKEN_URI);

        MockScoreAuthorizer smartAuthorizer = new MockScoreAuthorizer();
        bytes32 authorizerRole = nft.AUTHORIZER_ROLE();
        vm.prank(ADMIN);
        nft.grantRole(authorizerRole, address(smartAuthorizer));
        EthereumScoreNFT.MintAuthorization memory authorization =
            makeAuthorization(keccak256("1271"), 2, RECIPIENT, SECOND_URI);
        bytes memory signature = hex"123456";
        smartAuthorizer.approve(nft.authorizationDigest(authorization), signature);

        vm.prank(RECIPIENT);
        nft.redeem(authorization, SECOND_URI, address(smartAuthorizer), signature);
        assertEq(nft.ownerOf(2), RECIPIENT);
    }

    function testAuthorizerCanRotateWithoutChangingAdmin() public {
        uint256 nextKey = 0xB0B;
        address nextAuthorizer = vm.addr(nextKey);
        vm.startPrank(ADMIN);
        nft.grantRole(nft.AUTHORIZER_ROLE(), nextAuthorizer);
        nft.revokeRole(nft.AUTHORIZER_ROLE(), authorizer);
        vm.stopPrank();

        EthereumScoreNFT.MintAuthorization memory authorization =
            makeAuthorization(keccak256("rotate"), 9, RECIPIENT, TOKEN_URI);
        bytes memory oldSignature = signAuthorization(authorization, AUTHORIZER_KEY);
        bytes memory newSignature = signAuthorization(authorization, nextKey);
        vm.expectRevert(abi.encodeWithSelector(EthereumScoreNFT.UnauthorizedAuthorizer.selector, authorizer));
        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, authorizer, oldSignature);

        vm.prank(RECIPIENT);
        nft.redeem(authorization, TOKEN_URI, nextAuthorizer, newSignature);
    }

    function testInterfacesAndOmittedCapabilities() public {
        assertTrue(nft.supportsInterface(0x01ffc9a7));
        assertTrue(nft.supportsInterface(0x80ac58cd));
        assertTrue(nft.supportsInterface(0x5b5e139f));
        assertTrue(nft.supportsInterface(0x7965db0b));
        assertTrue(nft.supportsInterface(0xe8a3d485));
        assertFalse(nft.supportsInterface(0x2a55205a));
        assertFalse(nft.supportsInterface(0x780e9d63));

        redeem(makeAuthorization(keccak256("surface"), 1, RECIPIENT, TOKEN_URI), TOKEN_URI);
        (bool burned,) = address(nft).call(abi.encodeWithSignature("burn(uint256)", 1));
        (bool changed,) = address(nft).call(abi.encodeWithSignature("setTokenURI(uint256,string)", 1, SECOND_URI));
        (bool changedCollection,) = address(nft).call(abi.encodeWithSignature("setContractURI(string)", SECOND_URI));
        (bool upgraded,) = address(nft).call(abi.encodeWithSignature("upgradeTo(address)", address(1)));
        assertFalse(burned);
        assertFalse(changed);
        assertFalse(changedCollection);
        assertFalse(upgraded);
    }

    function testViemAndSolidityDigestFixedVector() public {
        address fixedContract = 0x1111111111111111111111111111111111111111;
        vm.etch(fixedContract, address(nft).code);
        EthereumScoreNFT.MintAuthorization memory authorization = EthereumScoreNFT.MintAuthorization({
            orderId: bytes32(uint256(0x1234)),
            tokenId: 42,
            recipient: 0x2222222222222222222222222222222222222222,
            tokenURIHash: keccak256(bytes(TOKEN_URI)),
            deadline: 2_000_000_000
        });

        assertEq(
            EthereumScoreNFT(fixedContract).authorizationDigest(authorization),
            0x8c42874f07894a0a960ec49fb948d7d68e25c521745df8e8824d64acda364041
        );
    }
}
