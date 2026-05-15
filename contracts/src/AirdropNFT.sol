// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * AirdropNFT — 空投奖励 NFT（ERC-721）
 *
 * 代码复用 ScoreNFT，独立部署独立 tokenId 空间。
 * 语义区分：ScoreNFT 是"用户创作的乐谱"，AirdropNFT 是"运营发放的奖励"。
 * 避免 /score/[tokenId]、/me、stats 的类型混淆。
 *
 * Phase 7 A2：setTokenURI 仅允许首次写入（与 ScoreNFT v2 对齐）。
 * 防止 MINTER_ROLE 私钥泄露后被改写已铸造 NFT 的元数据（钓鱼 URL 替换）。
 */
contract AirdropNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId;

    // 💭 与 ScoreNFT 一致：独立 flag 比读 ERC721URIStorage._tokenURIs（private）或
    // 判断 super.tokenURI() 长度更显式可靠
    mapping(uint256 => bool) private _uriSet;

    constructor(
        string memory name_,
        string memory symbol_,
        address minter
    ) ERC721(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, minter);
    }

    /// 铸造空投 NFT，返回自增 tokenId
    function mint(address to) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /// 补写 tokenURI（Arweave metadata 上传后调用）
    /// 要求 tokenId 已铸造、且尚未写过 URI（首写一次永久不可改）
    function setTokenURI(
        uint256 tokenId,
        string memory uri
    ) external onlyRole(MINTER_ROLE) {
        _requireMinted(tokenId);
        require(!_uriSet[tokenId], "AirdropNFT: URI already set");
        _uriSet[tokenId] = true;
        _setTokenURI(tokenId, uri);
    }

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
