const {extendEnvironment, scope} = require("hardhat/config");
const {
    runDeployEverythingModules, isModuleInDeployEverything, listDeployEverythingModules,
    removeDeployEverythingModule, addDeployEverythingModule
} = require("./deployments");
const fs = require("fs");
const ignition = scope("ignition");

/**
 * Asks for a module path from the user, interactively.
 * @param hre The hardhat runtime environment.
 * @param module The given module.
 * @param external Tells this is an external module import.
 * @param forceNonInteractive Tells that interactive commands
 * are not allowed by raising an error.
 * @returns {Promise<string>} The chosen action (async function).
 */
async function getModule(hre, module, external, forceNonInteractive) {
    const prompt = external
        ? "Package-relative JavaScript file:"
        : "Project-relative JavaScript file:";
    return await new hre.enquirerPlus.Enquirer.GivenOrValidInput({
        given: module, validate: (v) => {
            v = v.trim();
            return v.endsWith(".js") || v.endsWith(".ts");
        }, onInvalidGiven: (v) => {
            console.log(`Invalid given module file: ${v}`);
        }, makeInvalidInputMessage: (v) => {
            return `Invalid module file: ${v}`
        }, nonInteractive: forceNonInteractive, message: prompt,
        initial: "path/to/file.js"
    }).run();
}

/**
 * Adds a module to the deployment.
 * @param hre The hardhat runtime environment.
 * @param module The path to the module. If not given, this action tries
 * to become interactive and:
 * 1. For external modules: prompt the user to write the module path.
 *    That file is import-tried globally.
 * 2. For files: prompt the user to choose one of the available modules
 *    inside the project's ignition/modules directory. That file is also
 *    import-tried but locally to the project.
 * @param external Whether it is an external path or a project-local one.
 * @param forceNonInteractive If true, raises an error when the command tries
 * to become interactive.
 * @returns {Promise<void>} Nothing (async function).
 */
async function add(hre, module, external, forceNonInteractive) {
    module = await getModule(hre, module, external, forceNonInteractive);
    try {
        addDeployEverythingModule(hre, module, external);
        console.log("The module was successfully added to the full deployment.");
    } catch(e) {
        console.error(e.message || e);
    }
}

/**
 * Removes a module from the deployment.
 * @param module The path to the module. If not given, this action tries
 * to become interactive and list all the added modules (only those that
 * are local or external, depending on whether the external argument is
 * false or true, respectively).
 * @param hre The hardhat runtime environment.
 * @param external Whether it is an external path or a project-local one.
 * @param forceNonInteractive If true, raises an error when the command tries
 * to become interactive.
 * @returns {Promise<void>} Nothing (async function).
 */
async function remove(hre, module, external, forceNonInteractive) {
    module = await getModule(hre, module, external, forceNonInteractive);
    try {
        removeDeployEverythingModule(hre, module, external);
        console.log("The module was successfully removed to the full deployment.");
    } catch(e) {
        console.error(e.message || e);
    }
}

/**
 * Lists all the registered modules in the deployment.
 * @param hre The hardhat runtime environment.
 * @returns {Promise<void>} Nothing (async function).
 */
async function list(hre) {
    const contents = await listDeployEverythingModules({...hre, silent: true});
    if (!contents.length) {
        console.log("There are no modules added to the full deployment.");
    } else {
        console.log("These modules are added to the full deployment:");
    }
    contents.forEach((e) => {
        const prefix = e.external ? "External file" : "Project file";
        console.log(`- ${prefix}: ${e.filename}`);
        if (e.moduleResults) {
            if (e.moduleResults.length) {
                console.log(`  Results: {${e.moduleResults.join(", ")}}`);
            } else {
                console.log("  No results");
            }
        } else {
            console.log("  Error loading the module. Ensure it's a valid file and a valid Hardhat Ignition module.");
        }
    })
}

/**
 * Checks whether a module is added to the full deployment.
 * @param hre The hardhat runtime environment.
 * @param module The path to the module. If not given, this action tries
 * to become interactive and list all the added modules (only those that
 * are local or external, depending on whether the external argument is
 * false or true, respectively).
 * @param external Whether it is external or local to the project.
 * @param forceNonInteractive If true, raises an error when the command tries
 * to become interactive.
 */
async function check(hre, module, external, forceNonInteractive) {
    module = await getModule(hre, module, external, forceNonInteractive);
    if (isModuleInDeployEverything(hre, module, external)) {
        console.log("The module is added to the full deployment.");
    } else {
        console.log("The module is not added to the full deployment.");
    }
}

/**
 * Loads the contents of a parameters file.
 * @param file The file to load from.
 * @returns {*} The parameters.
 */
function loadParameters(file) {
    try {
        const content = fs.readFileSync(file, {encoding: 'utf8'});
        return JSON.parse(content);
    } catch(e) {
        return {};
    }
}

/**
 * Runs all the registered modules in the deployment.
 * @param parametersFile Optionally loads the parameters (same semantics of ignition's deploy command).
 * @param strategyName The ignition deployment strategy to use (same semantics of ignition's deploy command).
 * @param deploymentId An optional id for the deployment (same semantics of ignition's deploy command).
 * @param defaultSender The default sender (same semantics of ignition's deploy command).
 * @param reset Whether to reset the deployment state (journal) or not (same semantics of ignition's deploy command).
 * @param verify Whether to run a verify action by the end of the deployment.
 * @param hre The hardhat runtime environment.
 * @returns {Promise<void>} Nothing (async function).
 */
async function run(hre, parametersFile, strategyName, deploymentId, defaultSender, reset, verify) {
    const strategyConfig = hre.config.ignition?.strategyConfig?.[strategyName];
    await runDeployEverythingModules(hre, reset, {
        config: {}, strategyConfig, strategy: strategyName, deploymentId, defaultSender,
        parameters: loadParameters(parametersFile)
    });
    if (verify) {
        await hre.run(
            { scope: "ignition", task: "verify" },
            { deploymentId }
        );
    }
}

ignition.task("deploy-everything", "Manages or executes the full deployment in a chain")
    .addOptionalPositionalParam("action", "The action to execute: add, remove, list, check or run")
    .addFlag("forceNonInteractive", "Raise an error if one or more params were not specified and the action would become interactive")
    .addFlag("external", "Tells, for add/remove, that the module comes from an external package")
    .addOptionalParam("module", "Tells the module to add/remove")
    .addOptionalParam("parameters", "For the 'run' action: A relative path to a JSON file to use for the module parameters")
    .addOptionalParam("deploymentId", "For the 'run' action: Set the id of the deployment")
    .addOptionalParam("defaultSender", "For the 'run' action: Set the default sender for the deployment")
    .addOptionalParam("strategy", "For the 'run' action: Set the deployment strategy to use", "basic")
    .addFlag("reset", "For the 'run' action: Wipes the existing deployment state before deploying")
    .addFlag("verify", "Verify the deployment on Etherscan")
    .setAction(async ({
        action, forceNonInteractive, external, module, parameters: parametersFile,
        defaultSender, strategy, deploymentId, reset, verify
    }, hre, runSuper) => {
        await hre.run('compile');
        try {
            parametersFile = (parametersFile || "").trim();
            action = await new hre.enquirerPlus.Enquirer.GivenOrSelect({
                given: action, nonInteractive: forceNonInteractive, message: "Select what to do:",
                choices: [
                    {name: "add", message: "Add a new deployment module (prompted or via --module)"},
                    {name: "remove", message: "Remove a deployment module (prompted or via --module)"},
                    {name: "list", message: "List all the deployment modules (sequentially)"},
                    {name: "run", message: "Execute all the deployment modules ('till the end)"},
                    {name: "check", message: "Check whether a module is added"}
                ]
            }).run();
            switch(action)
            {
                case "add":
                    await add(hre, module, external, forceNonInteractive);
                    break;
                case "remove":
                    await remove(hre, module, external, forceNonInteractive);
                    break;
                case "list":
                    await list(hre);
                    break;
                case "check":
                    await check(hre, module, external, forceNonInteractive);
                    break;
                case "run":
                    await run(hre, parametersFile, strategy, deploymentId, defaultSender, reset, verify);
                    break;
                default:
                    console.error("Invalid action: " + action);
            }
        } catch(e) {
            console.error(e);
        }
    });

extendEnvironment((hre) => {
    if (!hre.ignition) {
        throw new Error(
            "The hardhat-ignition-deploy-everything module requires @nomicfoundation/hardhat-ignition " +
            "to be installed as a plug-in, along with the plug-in " + (
                hre.viem ? "@nomicfoundation/hardhat-ignition/viem" : "@nomicfoundation/hardhat-ignition-ethers"
            )
        );
    }
    hre.ignition.everything = {
        addDeployEverythingModule: (file, external) => addDeployEverythingModule(hre, file, external),
        removeDeployEverythingModule: (file, external) => removeDeployEverythingModule(hre, file, external),
        listDeployEverythingModules: ({ silent = true }) => listDeployEverythingModules({...hre, silent}),
        isModuleInDeployEverything: (file, external) => isModuleInDeployEverything(
            hre, file, external
        ),
        runDeployEverythingModules: (reset, args) => runDeployEverythingModules(
            hre, reset, args
        )
    };
});