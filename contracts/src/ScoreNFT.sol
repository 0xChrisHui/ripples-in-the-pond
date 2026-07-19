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
 * - setTokenURI 仅允许首次写入（Phase 6 D-C2 冻结）：
 *   防止 MINTER_ROLE 私钥泄露后被改写已铸造 NFT 的元数据
 */
contract ScoreNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId; // 默认 0，前缀 ++ 后第一次 = 1

    // 💭 为什么不读 ERC721URIStorage._tokenURIs：那是 private，不可访问；
    // 也不依赖 super.tokenURI() 字符串长度（受 _baseURI 实现影响），独立 flag 最显式
    mapping(uint256 => bool) private _uriSet;

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
    /// 要求 tokenId 已铸造、且尚未写过 URI（首写一次永久不可改）
    function setTokenURI(
        uint256 tokenId,
        string memory uri
    ) external onlyRole(MINTER_ROLE) {
        _requireMinted(tokenId);
        require(!_uriSet[tokenId], "ScoreNFT: URI already set");
        // CT-7：空串也是永久首写，会把 tokenURI 焊成空。放在置位前，空串被拒后不消耗唯一写入槽。
        require(bytes(uri).length > 0, "ScoreNFT: empty URI");
        _uriSet[tokenId] = true;
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
