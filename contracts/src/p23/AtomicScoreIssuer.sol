// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {MintOrchestrator} from "../MintOrchestrator.sol";
import {ScoreNFT} from "../ScoreNFT.sol";
import {PermanentArUri} from "../PermanentArUri.sol";

/// 保留旧 NFT 和订单账本，在一笔交易内完成铸造与首次写入永久资料。
contract AtomicScoreIssuer is AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    MintOrchestrator public immutable orchestrator;
    ScoreNFT public immutable scoreNft;

    error InvalidConfiguration();
    error InvalidIssue();
    error InvalidPermanentURI();
    error UnexpectedTokenId(uint256 expected, uint256 actual);

    event ScoreIssued(
        bytes32 indexed orderId, address indexed recipient, uint256 indexed tokenId, bytes32 tokenURIHash
    );

    constructor(address orchestrator_, address admin_, address minter_) {
        if (orchestrator_.code.length == 0 || admin_ == address(0) || minter_ == address(0)) {
            revert InvalidConfiguration();
        }
        orchestrator = MintOrchestrator(orchestrator_);
        address nft = address(orchestrator.scoreNft());
        if (nft.code.length == 0) revert InvalidConfiguration();
        scoreNft = ScoreNFT(nft);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, minter_);
    }

    /// 只转发旧账本，旧路径与新路径不能为相同订单各铸一枚。
    function tokenIdByOrderId(bytes32 orderId) external view returns (uint256) {
        return orchestrator.tokenIdByOrderId(orderId);
    }

    /// 编号是预上传资料的绑定条件；任何失败均回滚 NFT、编号与旧订单账本。
    function mintScoreWithURI(address recipient, bytes32 orderId, uint256 expectedTokenId, string calldata tokenUri)
        external onlyRole(MINTER_ROLE) nonReentrant returns (uint256 tokenId)
    {
        if (recipient == address(0) || orderId == bytes32(0) || expectedTokenId == 0) revert InvalidIssue();
        if (!PermanentArUri.isValid(tokenUri)) revert InvalidPermanentURI();
        // 为什么调用旧入口：保留既有订单防重复与历史恢复依据，不建第二份映射。
        tokenId = orchestrator.mintScore(recipient, orderId);
        if (tokenId != expectedTokenId) revert UnexpectedTokenId(expectedTokenId, tokenId);
        // 旧 safeMint 接收回调早于本行；保证的是交易提交后资料完整。
        scoreNft.setTokenURI(tokenId, tokenUri);
        emit ScoreIssued(orderId, recipient, tokenId, keccak256(bytes(tokenUri)));
    }
}
