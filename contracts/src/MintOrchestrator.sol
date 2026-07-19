// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * IScoreNFT — 只引一个签名，不依赖 ScoreNFT 完整实现
 * Orchestrator 通过这个接口和工厂合约通话
 */
interface IScoreNFT {
    function mint(address to) external returns (uint256);
}

/**
 * MintOrchestrator — ScoreNFT 的对外受理窗口（"前台 / 门卫亭"）
 *
 * 设计要点：
 * - 自身不存 NFT，只是薄壳：mintScore 转调 ScoreNFT.mint
 * - MINTER_ROLE 控制谁能调 mintScore（cron 用 minter 私钥调）
 * - Phase 6 D-C3：删除 TBA 开关空实现
 *   原本设计为 setTbaEnabled(true) + _maybeCreateTba 钩子作为 ERC-6551 扩展点，
 *   但 Solidity 合约部署后代码不可改 → 翻开关也不会产生新行为 → 误导后继者
 *   未来真要做 ERC-6551，必须新部署本合约或走 proxy 升级，不能在现有合约开关
 * - 部署后 admin 必须用 ScoreNFT.grantRole 把 ScoreNFT.MINTER_ROLE
 *   授权给本合约地址，否则 mintScore 会 revert
 */
contract MintOrchestrator is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// 永久绑定的 ScoreNFT 工厂地址，构造时定死避免误改
    IScoreNFT public immutable scoreNft;

    // CT-4：orderId → tokenId 幂等映射。cron 用稳定 orderId（= 队列 row.id 的 hash）去重，
    // 防后端重试 / lease 竞态导致同一录制双铸。tokenId 从 1 起，值为 0 = 该 orderId 未用过。
    mapping(bytes32 => uint256) public tokenIdByOrderId;

    event ScoreMinted(address indexed to, uint256 indexed tokenId);

    constructor(address scoreNftAddress) {
        require(scoreNftAddress != address(0), "scoreNft=0");
        scoreNft = IScoreNFT(scoreNftAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /// 唯一对外受理的"铸造请求"入口
    /// 调用方需要先在 ScoreNFT 上 grantRole(MINTER_ROLE, address(this))
    /// CT-4：orderId 幂等——同 orderId 二次调用 revert，防后端重试双铸
    function mintScore(
        address to,
        bytes32 orderId
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(tokenIdByOrderId[orderId] == 0, "orderId used");
        tokenId = scoreNft.mint(to);
        tokenIdByOrderId[orderId] = tokenId;
        emit ScoreMinted(to, tokenId);
    }
}
