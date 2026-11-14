// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/ScoreNFT.sol";
import "../../src/MintOrchestrator.sol";
import "../../src/p23/AtomicScoreIssuer.sol";

contract ReentrantScoreRecipient is IERC721Receiver {
    AtomicScoreIssuer public issuer;
    bool public blocked;
    bool public sawEmptyURI;
    string constant URI = "ar://H7DBp5S7BeE9mjIxvy_t-82BRH9XwTxK2_JL3HE6lhI";

    constructor(AtomicScoreIssuer issuer_) { issuer = issuer_; }

    function onERC721Received(address, address, uint256 id, bytes calldata) external returns (bytes4) {
        sawEmptyURI = bytes(ScoreNFT(msg.sender).tokenURI(id)).length == 0;
        try issuer.mintScoreWithURI(address(0xCAFE), keccak256("callback"), id + 1, URI) {
            blocked = false;
        } catch Error(string memory reason) {
            blocked = keccak256(bytes(reason)) == keccak256("ReentrancyGuard: reentrant call");
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract AtomicScoreIssuerTest is Test {
    ScoreNFT nft;
    MintOrchestrator orchestrator;
    AtomicScoreIssuer issuer;
    address recipient = address(0xBEEF);
    string constant URI = "ar://H7DBp5S7BeE9mjIxvy_t-82BRH9XwTxK2_JL3HE6lhI";

    function setUp() public {
        nft = new ScoreNFT("Ripples in the Pond", "RIPS", address(this));
        orchestrator = new MintOrchestrator(address(nft));
        nft.grantRole(nft.MINTER_ROLE(), address(orchestrator));
        issuer = new AtomicScoreIssuer(address(orchestrator), address(this), address(this));
        orchestrator.grantRole(orchestrator.MINTER_ROLE(), address(issuer));
        nft.grantRole(nft.MINTER_ROLE(), address(issuer));
    }

    function testAtomicIssueCommitsMetadataAndLegacyOrderTogether() public {
        bytes32 orderId = keccak256("atomic-order");
        (bool ok, bytes memory result) = address(issuer).call(abi.encodeWithSignature(
            "mintScoreWithURI(address,bytes32,uint256,string)", recipient, orderId, 1, URI
        ));
        assertTrue(ok, "atomic issuance must succeed");
        uint256 tokenId = abi.decode(result, (uint256));
        assertEq(tokenId, 1);
        assertEq(nft.ownerOf(tokenId), recipient);
        assertEq(nft.tokenURI(tokenId), URI);
        assertEq(orchestrator.tokenIdByOrderId(orderId), tokenId);
        assertEq(issuer.tokenIdByOrderId(orderId), tokenId);
        assertEq(address(issuer.scoreNft()), address(nft));
    }

    function testDuplicateOrderAcrossNewAndOldPathsCannotMintTwice() public {
        bytes32 orderId = keccak256("same-order");
        issuer.mintScoreWithURI(recipient, orderId, 1, URI);
        vm.expectRevert("orderId used");
        issuer.mintScoreWithURI(recipient, orderId, 2, URI);
        vm.expectRevert("orderId used");
        orchestrator.mintScore(recipient, orderId);
        assertEq(nft.balanceOf(recipient), 1);
        assertEq(nft.tokenURI(1), URI);
    }

    function testOldOrderCannotBeRemintedAndOldURIStaysUnchanged() public {
        bytes32 oldOrder = keccak256("old-order");
        uint256 oldId = orchestrator.mintScore(recipient, oldOrder);
        nft.setTokenURI(oldId, URI);
        vm.expectRevert("orderId used");
        issuer.mintScoreWithURI(recipient, oldOrder, 2, URI);
        assertEq(issuer.tokenIdByOrderId(oldOrder), oldId);
        assertEq(issuer.mintScoreWithURI(recipient, keccak256("next-order"), 2, URI), 2);
        assertEq(nft.tokenURI(oldId), URI);
        assertEq(nft.ownerOf(oldId), recipient);
    }

    function testNumberConflictRollsBackAndSameOrderCanRetry() public {
        bytes32 orderId = keccak256("number-conflict");
        vm.expectRevert(abi.encodeWithSelector(AtomicScoreIssuer.UnexpectedTokenId.selector, 2, 1));
        issuer.mintScoreWithURI(recipient, orderId, 2, URI);
        assertEmpty(orderId);
        assertEq(issuer.mintScoreWithURI(recipient, orderId, 1, URI), 1);
    }

    function testLegacyMintBetweenPreparationAndSubmissionRejectsStaleNumber() public {
        bytes32 orderId = keccak256("prepared-order");
        orchestrator.mintScore(recipient, keccak256("competing-order"));
        vm.expectRevert(abi.encodeWithSelector(AtomicScoreIssuer.UnexpectedTokenId.selector, 1, 2));
        issuer.mintScoreWithURI(recipient, orderId, 1, URI);
        assertEq(orchestrator.tokenIdByOrderId(orderId), 0);
        assertEq(nft.balanceOf(recipient), 1);
        assertEq(orchestrator.mintScore(recipient, keccak256("after-conflict")), 2);
    }

    function testMissingURIWriteRoleRollsBackMintAndOrder() public {
        bytes32 role = nft.MINTER_ROLE();
        bytes32 orderId = keccak256("missing-uri-role");
        nft.revokeRole(role, address(issuer));
        vm.expectRevert();
        issuer.mintScoreWithURI(recipient, orderId, 1, URI);
        assertEmpty(orderId);
        nft.grantRole(role, address(issuer));
        assertEq(issuer.mintScoreWithURI(recipient, orderId, 1, URI), 1);
    }

    function testMissingLegacyMintRoleRejectsWithoutConsumingOrder() public {
        bytes32 role = orchestrator.MINTER_ROLE();
        bytes32 orderId = keccak256("missing-mint-role");
        orchestrator.revokeRole(role, address(issuer));
        vm.expectRevert();
        issuer.mintScoreWithURI(recipient, orderId, 1, URI);
        assertEmpty(orderId);
        orchestrator.grantRole(role, address(issuer));
        assertEq(issuer.mintScoreWithURI(recipient, orderId, 1, URI), 1);
    }

    function testUnauthorizedCallerCannotIssue() public {
        bytes32 orderId = keccak256("unauthorized");
        vm.prank(address(0xBAD));
        vm.expectRevert();
        issuer.mintScoreWithURI(recipient, orderId, 1, URI);
        assertEmpty(orderId);
    }

    function testInvalidArgumentsCannotCreateAnEmptyNFT() public {
        bytes32 orderId = keccak256("invalid");
        vm.expectRevert(AtomicScoreIssuer.InvalidIssue.selector);
        issuer.mintScoreWithURI(address(0), orderId, 1, URI);
        vm.expectRevert(AtomicScoreIssuer.InvalidIssue.selector);
        issuer.mintScoreWithURI(recipient, bytes32(0), 1, URI);
        vm.expectRevert(AtomicScoreIssuer.InvalidIssue.selector);
        issuer.mintScoreWithURI(recipient, orderId, 0, URI);
        vm.expectRevert(AtomicScoreIssuer.InvalidPermanentURI.selector);
        issuer.mintScoreWithURI(recipient, orderId, 1, "");
        vm.expectRevert(AtomicScoreIssuer.InvalidPermanentURI.selector);
        issuer.mintScoreWithURI(recipient, orderId, 1, "https://example.com/metadata.json");
        assertEmpty(orderId);
    }

    function testRecipientRejectionRollsBackAndSameOrderCanRetry() public {
        bytes32 orderId = keccak256("reject-receiver");
        vm.expectRevert("ERC721: transfer to non ERC721Receiver implementer");
        issuer.mintScoreWithURI(address(this), orderId, 1, URI);
        assertEmpty(orderId);
        assertEq(issuer.mintScoreWithURI(recipient, orderId, 1, URI), 1);
    }

    function testAuthorizedRecipientReentryIsBlockedAndFinalURIExists() public {
        ReentrantScoreRecipient receiver = new ReentrantScoreRecipient(issuer);
        issuer.grantRole(issuer.MINTER_ROLE(), address(receiver));
        issuer.mintScoreWithURI(address(receiver), keccak256("outer"), 1, URI);
        assertTrue(receiver.blocked());
        assertTrue(receiver.sawEmptyURI());
        assertEq(nft.tokenURI(1), URI);
        assertEq(nft.ownerOf(1), address(receiver));
        assertEq(issuer.tokenIdByOrderId(keccak256("callback")), 0);
        assertEq(issuer.mintScoreWithURI(recipient, keccak256("after-callback"), 2, URI), 2);
    }

    function testConstructorRejectsInvalidTargetsAndRoles() public {
        vm.expectRevert(AtomicScoreIssuer.InvalidConfiguration.selector);
        new AtomicScoreIssuer(address(0), address(this), address(this));
        vm.expectRevert(AtomicScoreIssuer.InvalidConfiguration.selector);
        new AtomicScoreIssuer(recipient, address(this), address(this));
        vm.expectRevert(AtomicScoreIssuer.InvalidConfiguration.selector);
        new AtomicScoreIssuer(address(orchestrator), address(0), address(this));
        vm.expectRevert(AtomicScoreIssuer.InvalidConfiguration.selector);
        new AtomicScoreIssuer(address(orchestrator), address(this), address(0));
        MintOrchestrator invalid = new MintOrchestrator(recipient);
        vm.expectRevert(AtomicScoreIssuer.InvalidConfiguration.selector);
        new AtomicScoreIssuer(address(invalid), address(this), address(this));
    }

    function testIssuedEventBindsOrderRecipientNumberAndURI() public {
        bytes32 orderId = keccak256("event");
        vm.expectEmit(true, true, true, true, address(issuer));
        emit AtomicScoreIssuer.ScoreIssued(orderId, recipient, 1, keccak256(bytes(URI)));
        issuer.mintScoreWithURI(recipient, orderId, 1, URI);
    }

    function assertEmpty(bytes32 orderId) internal view {
        assertEq(orchestrator.tokenIdByOrderId(orderId), 0);
        assertEq(nft.balanceOf(recipient), 0);
    }
}
