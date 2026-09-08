import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

export {
    addDeployEverythingModule,
    isModuleInDeployEverything,
    listDeployEverythingModules,
    removeDeployEverythingModule,
    runDeployEverythingModules
} from "./deployments.js";

const deployEverythingTask = task(
    ["ignition", "deploy-everything"],
    "Manages or executes the full deployment in a chain"
)
    .addPositionalArgument({
        name: "action",
        description: "The action to execute: add, remove, list, check or run",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined
    })
    .addFlag({
        name: "forceNonInteractive",
        description: "Raise an error if one or more params were not specified and the action would become interactive"
    })
    .addFlag({
        name: "external",
        description: "Tells, for add/remove, that the module comes from an external package"
    })
    .addOption({
        name: "module",
        description: "Tells the module to add/remove",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined
    })
    .addOption({
        name: "parameters",
        description: "For the 'run' action: A relative path to a JSON file to use for the module parameters",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined
    })
    .addOption({
        name: "deploymentId",
        description: "For the 'run' action: Set the id of the deployment",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined
    })
    .addOption({
        name: "defaultSender",
        description: "For the 'run' action: Set the default sender for the deployment",
        type: ArgumentType.STRING_WITHOUT_DEFAULT,
        defaultValue: undefined
    })
    .addOption({
        name: "strategy",
        description: "For the 'run' action: Set the deployment strategy to use",
        type: ArgumentType.STRING,
        defaultValue: "basic"
    })
    .addFlag({
        name: "reset",
        description: "For the 'run' action: Wipes the existing deployment state before deploying"
    })
    .addFlag({
        name: "verify",
        description: "Verify the deployment on Etherscan"
    })
    .setAction(() => import("./tasks/deploy-everything.js"))
    .build();

const hardhatIgnitionDeployEverything = {
    id: "hardhat-ignition-deploy-everything",
    npmPackage: "hardhat-ignition-deploy-everything",
    tasks: [deployEverythingTask]
};

export default hardhatIgnitionDeployEverything;
