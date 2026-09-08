import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatBlueprints from "hardhat-blueprints";
import hardhatIgnitionDeployEverything from "hardhat-ignition-deploy-everything";

export default defineConfig({
  plugins: [
    hardhatToolboxViem,
    hardhatBlueprints,
    hardhatIgnitionDeployEverything
  ],
  solidity: "0.8.24",
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337,
      accounts: {
        mnemonic: "dentist whale pattern drastic time black cigar bike person destroy punch hungry",
        accountsBalance: "10000000000000000000000",
        count: 100
      }
    },
    testnet: {
      type: "http",
      chainType: "generic",
      chainId: 80002,
      url: "https://rpc-amoy.polygon.technology",
      accounts: {
        mnemonic: "dentist whale pattern drastic time black cigar bike person destroy punch hungry",
        count: 100
      }
    },
    mainnet: {
      type: "http",
      chainType: "generic",
      chainId: 137,
      url: "https://polygon-mainnet.infura.io",
      accounts: {
        mnemonic: "dentist whale pattern drastic time black cigar bike person destroy punch hungry",
        count: 100
      }
    }
  }
});
