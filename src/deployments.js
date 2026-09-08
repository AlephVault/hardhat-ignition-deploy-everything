import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function getProjectPrefix(hre) {
    let root = hre.config.paths.root;
    while (root.endsWith("/")) root = root.substring(0, root.length - 1);
    return root;
}

function removeProjectPrefix(hre, file) {
    const prefix = getProjectPrefix(hre) + "/";
    if (file.startsWith(prefix)) {
        return { file: file.substring(prefix.length), stripped: true };
    } else {
        return { file, stripped: false };
    }
}

function normalizeByProjectPrefix(hre, file) {
    return removeProjectPrefix(hre, path.resolve(getProjectPrefix(hre), file));
}

function loadDeployEverythingSettings(hre) {
    const root = getProjectPrefix(hre) + "/";
    const file = path.resolve(root, "ignition", "deploy-everything.json");

    try {
        const content = fs.readFileSync(file, { encoding: "utf8" });
        return JSON.parse(content);
    } catch {
        return { contents: [] };
    }
}

function saveDeployEverythingSettings(settings, hre) {
    const root = getProjectPrefix(hre);
    const file = path.resolve(root, "ignition", "deploy-everything.json");

    fs.writeFileSync(file, JSON.stringify(settings), { encoding: "utf8" });
}

async function loadModuleFile(file) {
    const imported = await import(file.startsWith("/") ? pathToFileURL(file).href : file);
    return imported.default === undefined ? imported : imported.default;
}

export async function addDeployEverythingModule(hre, file, external) {
    external = !!external;
    let module = "";
    if (external) {
        if (file.startsWith("/")) {
            throw new Error(`The module starts with / (this is forbidden): ${file}.`);
        }
        try {
            await loadModuleFile(file);
        } catch {
            throw new Error(`Could not import the external file: ${file}.`);
        }
        module = file;
    } else {
        const normalized = normalizeByProjectPrefix(hre, file);
        if (!normalized.stripped) {
            throw new Error(`The module does not belong to the project: ${file}`);
        }
        try {
            await loadModuleFile(path.resolve(getProjectPrefix(hre), normalized.file));
        } catch {
            throw new Error(`Could not import the project file: ${file}.`);
        }
        module = normalized.file;
    }

    let settings = loadDeployEverythingSettings(hre);
    settings.contents ||= [];
    if (!!settings.contents.find((e) => {
        return e.filename === module && e.external === external;
    })) throw new Error(`The module is already added to the full deployment: ${file}.`);
    settings.contents = [...settings.contents, { filename: module, external: external }];
    saveDeployEverythingSettings(settings, hre);
}

export function removeDeployEverythingModule(hre, file, external) {
    external = !!external;
    let module = external ? file : normalizeByProjectPrefix(hre, file).file;

    let settings = loadDeployEverythingSettings(hre);
    settings.contents ||= [];
    let element = settings.contents.find((e) => {
        return e.filename === module && e.external === !!external;
    });
    if (!element) throw new Error(`The module is not added to the full deployment: ${file}.`);
    settings.contents = settings.contents.filter((e) => e !== element);
    saveDeployEverythingSettings(settings, hre);
}

export async function listDeployEverythingModules(hre) {
    const chainId = await hre.common.getChainId();
    const settings = loadDeployEverythingSettings(hre).contents || [];
    const modules = [];

    for (const { filename, external } of settings) {
        let moduleResults = null;
        let module = null;
        try {
            module = await importModule(hre, filename, external, chainId);
            moduleResults = Object.values(module.results || {}).map((f) => f.id);
        } catch {}

        modules.push({ filename, external, moduleResults, module });
    }

    return modules;
}

function addChainId(filename, chainId) {
    const parts = filename.split(".");
    const extension = parts.pop();
    return `${parts.join(".")}-${chainId}.${extension}`;
}

async function importModule(hre, filename, external, chainId) {
    if (!hre.silent) console.log(`>>> Importing ${external ? "external" : "internal"} module:`, filename);

    try {
        const path_ = external
            ? addChainId(filename, chainId)
            : addChainId(path.resolve(hre.config.paths.root, filename), chainId);
        if (!hre.silent) console.log(">>> Trying path:", path_);
        return await loadModuleFile(path_);
    } catch {
        if (!hre.silent) console.log(">>> Chain-specific module not found; falling back to the default module.");
    }

    try {
        const path_ = external
            ? filename
            : path.resolve(hre.config.paths.root, filename);
        if (!hre.silent) console.log(">>> Trying path:", path_);
        return await loadModuleFile(path_);
    } catch {
        throw new Error(`Could not import the ${external ? "external" : "in-project"} module: ${filename}.`);
    }
}

export async function runDeployEverythingModules(hre, reset, deploymentArgs) {
    const connection = await hre.network.getOrCreate();
    if (connection.ignition === undefined) {
        throw new Error(
            "The hardhat-ignition-deploy-everything module requires an Ignition binding. " +
            "Register an Ignition toolbox such as @nomicfoundation/hardhat-toolbox-mocha-ethers " +
            "or @nomicfoundation/hardhat-toolbox-viem in your Hardhat config."
        );
    }

    const modules = await listDeployEverythingModules({ ...hre, silent: false });
    const length = modules.length;
    if (!!reset) await connection.ignition.resetDeployment(deploymentArgs.deploymentId);
    for (let idx = 0; idx < length; idx++) {
        const module = modules[idx].module;
        try {
            if (!hre.silent) console.log(`>>> Deploying ${modules[idx].external ? "external" : "internal"} module:`, modules[idx].filename);
            await connection.ignition.deploy(module, deploymentArgs);
        } catch (err) {
            if (!hre.silent) console.log(`error: [${err.name}], [${err.message}]`);
            if (err.name === "HardhatPluginError" &&
                err.message.includes("Invariant violated: neither timeouts or failures")) {
                if (!hre.silent) console.warn(
                    "Hardhat-ignition threw this error due to mishandling idempotency:",
                    err.name, err.message
                );
            } else {
                throw err;
            }
        }
    }
}

export function isModuleInDeployEverything(hre, file, external) {
    external = !!external;
    let module = external ? file : normalizeByProjectPrefix(hre, file).file;
    let settings = loadDeployEverythingSettings(hre);
    return !!(settings.contents || []).find((element) => {
        return !!element.external === external && module === element.filename;
    });
}
