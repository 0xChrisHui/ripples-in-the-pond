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
 * - MINTER_ROLE 控制谁能调 mintScore（S5 cron 用 operator 私钥调）
 * - tbaEnabled 默认 false + 空 _maybeCreateTba 钩子
 *   playbook 冻结决策 D1：保留扩展点但不写真实 ERC-6551 代码
 *   Phase 4+ 真要做 TBA 时实现钩子 + 翻开关，无需重部署
 * - 部署后 deployer (operator) 必须用 ScoreNFT.grantRole 把
 *   ScoreNFT 的 MINTER_ROLE 授权给本合约地址，否则 mintScore 会 revert
 */
contract MintOrchestrator is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// 永久绑定的 ScoreNFT 工厂地址，构造时定死避免误改
    IScoreNFT public immutable scoreNft;

    /// TBA 总开关（playbook D1：默认关闭，Phase 3 不实际做 ERC-6551）
    bool public tbaEnabled;

    event TbaEnabledChanged(bool enabled);
    event ScoreMinted(address indexed to, uint256 indexed tokenId);

    constructor(address scoreNftAddress) {
        require(scoreNftAddress != address(0), "scoreNft=0");
        scoreNft = IScoreNFT(scoreNftAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /// 唯一对外受理的"铸造请求"入口
    /// 调用方需要先在 ScoreNFT 上 grantRole(MINTER_ROLE, address(this))
    function mintScore(
        address to
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        tokenId = scoreNft.mint(to);
        _maybeCreateTba(tokenId);
        emit ScoreMinted(to, tokenId);
    }

    /// admin 切换 TBA 总开关。Phase 3 期间始终保持 false
    function setTbaEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tbaEnabled = enabled;
        emit TbaEnabledChanged(enabled);
    }

    /**
     * TBA 钩子 —— 当前是空 stub
     *
     * Phase 4+ 真要启用 TBA 时，在这里实现：
     * 1. require(tbaEnabled, "tba off");
     * 2. ERC-6551 Registry.createAccount(implementation, chainId, scoreNft, tokenId, salt);
     * 不需要重部署本合约，只需升级钩子实现 + admin 翻 setTbaEnabled(true)。
     */
    function _maybeCreateTba(uint256 /* tokenId */) internal view {
        // 故意留空：Phase 3 不做 ERC-6551
        // 用 view 修饰免得编译 warning（未使用状态变量）
        if (tbaEnabled) {
            // 占位：未来 Phase 4+ 在此处接 ERC-6551 Registry
        }
    }
}
