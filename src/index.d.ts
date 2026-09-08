import type { HardhatPlugin } from "hardhat/types/plugins";

declare const hardhatIgnitionDeployEverything: HardhatPlugin;

export declare function addDeployEverythingModule(hre: any, file: string, external?: boolean): Promise<void>;
export declare function removeDeployEverythingModule(hre: any, file: string, external?: boolean): void;
export declare function isModuleInDeployEverything(hre: any, file: string, external?: boolean): boolean;
export declare function listDeployEverythingModules(hre: any): Promise<Array<{
    filename: string;
    external: boolean;
    moduleResults: string[] | null;
    module: unknown;
}>>;
export declare function runDeployEverythingModules(hre: any, reset: boolean, deploymentArgs: unknown): Promise<void>;

export default hardhatIgnitionDeployEverything;
