// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {MaterialTestBase} from "./MaterialTestBase.sol";
import {EthereumMaterialNFT} from "../../src/p17/EthereumMaterialNFT.sol";

contract MaterialVectorTest is MaterialTestBase {
    function testIndependentViemDigestVector() public {
        address vector = address(0x100);
        vm.etch(vector, address(nft).code);
        EthereumMaterialNFT.MaterialMintAuthorization memory a = EthereumMaterialNFT.MaterialMintAuthorization(
            0x1111111111111111111111111111111111111111111111111111111111111111,
            1, 1, RECIPIENT, keccak256(bytes(URI)), 2000000000
        );
        assertEq(EthereumMaterialNFT(vector).authorizationDigest(a),
            0x1a0bb1015acd59e955283044e6b572d972690395e48dca5b3aaa9155876d525d);
    }
}
