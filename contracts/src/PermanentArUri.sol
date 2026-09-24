// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Ripples 合约共用的永久 Arweave URI 校验器。
library PermanentArUri {
    function isValid(string memory uri) internal pure returns (bool) {
        bytes memory value = bytes(uri);
        if (
            value.length != 48 || value[0] != "a" || value[1] != "r" || value[2] != ":" || value[3] != "/"
                || value[4] != "/"
        ) return false;

        for (uint256 i = 5; i < value.length; ++i) {
            bytes1 char = value[i];
            bool valid = (char >= "A" && char <= "Z") || (char >= "a" && char <= "z") || (char >= "0" && char <= "9")
                || char == "_" || char == "-";
            if (!valid) return false;
        }
        return true;
    }
}
