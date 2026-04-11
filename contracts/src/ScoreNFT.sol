// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * ScoreNFT — 乐谱 NFT（ERC-721）
 *
 * 设计要点：
 * - tokenId 从 1 自增（避免 "#0" 的展示尴尬）
 * - mint 与 setTokenURI 两步分离：S5 cron 先 mint 拿 tokenId，
 *   上传 Arweave metadata 后再 setTokenURI 补写
 *   （playbook 冻结决策 D2：metadata 在 cron 侧生成）
 * - MINTER_ROLE 同时负责 mint + setTokenURI
 * - 部署时 minter = deployer (operator)，S3 部署 Orchestrator 后 grantRole
 *   给 Orchestrator；operator 保留作紧急急救
 */
contract ScoreNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId; // 默认 0，前缀 ++ 后第一次 = 1

    constructor(
        string memory name_,
        string memory symbol_,
        address minter
    ) ERC721(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, minter);
    }

    /// 铸造新 ScoreNFT，返回自增 tokenId
    /// tokenURI 暂不写，由后续 setTokenURI 补
    function mint(address to) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /// cron 上传 Arweave metadata 后调用此方法补写 tokenURI
    /// 要求 tokenId 已铸造，避免误写不存在的 tokenId
    function setTokenURI(
        uint256 tokenId,
        string memory uri
    ) external onlyRole(MINTER_ROLE) {
        _requireMinted(tokenId);
        _setTokenURI(tokenId, uri);
    }

    /// ERC721URIStorage 和 AccessControl 各自实现了 supportsInterface，需手动合并
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
