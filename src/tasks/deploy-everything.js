import fs from "node:fs";

import {
    addDeployEverythingModule,
    isModuleInDeployEverything,
    listDeployEverythingModules,
    removeDeployEverythingModule,
    runDeployEverythingModules
} from "../deployments.js";

async function getModule(hre, module, external, forceNonInteractive) {
    const prompt = external
        ? "Package-relative JavaScript or TypeScript file:"
        : "Project-relative JavaScript or TypeScript file:";

    return await new hre.enquirerPlus.Enquirer.GivenOrValidInput({
        given: module,
        validate: (v) => {
            v = v.trim();
            return v.endsWith(".js") || v.endsWith(".ts");
        },
        onInvalidGiven: (v) => {
            console.log(`Invalid given module file: ${v}`);
        },
        makeInvalidInputMessage: (v) => {
            return `Invalid module file: ${v}`;
        },
        nonInteractive: forceNonInteractive,
        message: prompt,
        initial: "ignition/modules/Lock.js"
    }).run();
}

async function add(hre, module, external, forceNonInteractive) {
    module = await getModule(hre, module, external, forceNonInteractive);
    try {
        await addDeployEverythingModule(hre, module, external);
        console.log("The module was successfully added to the full deployment.");
    } catch (e) {
        console.error(e.message || e);
    }
}

async function remove(hre, module, external, forceNonInteractive) {
    module = await getModule(hre, module, external, forceNonInteractive);
    try {
        removeDeployEverythingModule(hre, module, external);
        console.log("The module was successfully removed from the full deployment.");
    } catch (e) {
        console.error(e.message || e);
    }
}

async function list(hre) {
    const contents = await listDeployEverythingModules({ ...hre, silent: true });
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
    });
}

async function check(hre, module, external, forceNonInteractive) {
    module = await getModule(hre, module, external, forceNonInteractive);
    if (isModuleInDeployEverything(hre, module, external)) {
        console.log("The module is added to the full deployment.");
    } else {
        console.log("The module is not added to the full deployment.");
    }
}

function loadParameters(file) {
    if (!file) {
        return {};
    }

    try {
        const content = fs.readFileSync(file, { encoding: "utf8" });
        return JSON.parse(content);
    } catch {
        return {};
    }
}

async function run(hre, parametersFile, strategyName, deploymentId, defaultSender, reset, verify) {
    const strategyConfig = hre.config.ignition?.strategyConfig?.[strategyName];
    await runDeployEverythingModules(hre, reset, {
        config: {},
        strategyConfig,
        strategy: strategyName,
        deploymentId,
        defaultSender,
        parameters: loadParameters(parametersFile)
    });
    if (verify) {
        await hre.tasks.getTask(["ignition", "verify"]).run({ deploymentId });
    }
}

export default async function ({
    action,
    forceNonInteractive,
    external,
    module,
    parameters: parametersFile,
    defaultSender,
    strategy,
    deploymentId,
    reset,
    verify
}, hre) {
    await hre.tasks.getTask("build").run({});
    try {
        parametersFile = (parametersFile || "").trim();
        action ||= await new hre.enquirerPlus.Enquirer.GivenOrSelect({
            given: action,
            nonInteractive: forceNonInteractive,
            message: "Select what to do:",
            choices: [
                { name: "add", message: "Add a new deployment module (prompted or via --module)" },
                { name: "remove", message: "Remove a deployment module (prompted or via --module)" },
                { name: "list", message: "List all the deployment modules (sequentially)" },
                { name: "run", message: "Execute all the deployment modules ('till the end)" },
                { name: "check", message: "Check whether a module is added" }
            ]
        }).run();
        switch (action) {
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
    } catch (e) {
        console.error(e);
    }
}
