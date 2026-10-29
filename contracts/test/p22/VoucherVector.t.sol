// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PackTestBase} from "./PackTestBase.sol";
import {ScorePackOpener} from "../../src/p22/ScorePackOpener.sol";

/// 凭证编码测试向量：服务端 viem 的 hashTypedData 必须得到同一 digest（见 playbook/phase-22/05-frozen-decisions.md）。
/// 向量固定：chainId=11155111，opener 与 score 地址取 forge 确定性部署结果，所以 digest 随 bytecode 变化；
/// 因此这里只固定 structHash（只依赖字段），domain 由 viem 侧用 opener 的 eip712Domain() 读回对照。
contract VoucherVectorTest is PackTestBase {
    function test_typehashAndStructHashVector() public {
        assertEq(
            opener.PACK_VOUCHER_TYPEHASH(),
            keccak256(
                "PackVoucher(uint256 scoreTokenId,address holder,uint256 trackTokenId,bytes32 soundIdsHash,uint256 deadline)"
            )
        );
        uint256[] memory ids = new uint256[](3);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 33;
        ScorePackOpener.PackVoucher memory v =
            ScorePackOpener.PackVoucher(7, 0x1111111111111111111111111111111111111111, 2, ids, 1_900_000_000);
        // soundIdsHash = keccak256(abi.encodePacked(uint256[]))：每个元素补足 32 字节后直接拼接
        bytes32 idsHash = keccak256(abi.encodePacked(uint256(1), uint256(2), uint256(33)));
        assertEq(idsHash, keccak256(abi.encodePacked(ids)));
        bytes32 expected = keccak256(
            abi.encode(
                opener.PACK_VOUCHER_TYPEHASH(), uint256(7), v.holder, uint256(2), idsHash, uint256(1_900_000_000)
            )
        );
        assertEq(opener.voucherStructHash(v), expected);
        emit log_named_bytes32("TYPEHASH", opener.PACK_VOUCHER_TYPEHASH());
        emit log_named_bytes32("structHash vector", expected);
    }

    function test_eip712DomainFields() public view {
        (, string memory n, string memory ver, uint256 cid, address vc,,) = opener.eip712Domain();
        assertEq(n, "Ripples Pond Score Pack");
        assertEq(ver, "1");
        assertEq(cid, block.chainid);
        assertEq(vc, address(opener));
    }
}
