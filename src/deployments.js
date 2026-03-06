const fs = require("fs");
const path = require("path");

/**
 * Returns the base directory of the project. It removes any
 * trailing slash.
 * @param hre The hardhat runtime environment.
 * @returns The project path.
 */
function getProjectPrefix(hre) {
    let root = hre.config.paths.root;
    while (root.endsWith('/')) root = root.substring(0, root.length - 1);
    return root;
}

/**
 * Removes the project prefix from the given file.
 * @param hre The hardhat runtime environment.
 * @param file The (absolute) filename.
 * @returns A structure {file, stripped?}. If the file starts
 * with the project prefix then stripped?=true and file= the
 * file without the project prefix. Otherwise, stripped?=false
 * and file=file.
 */
function removeProjectPrefix(hre, file) {
    const prefix = getProjectPrefix(hre) + "/";
    if (file.startsWith(prefix)) {
        return {file: file.substring(prefix.length), stripped: true}
    } else {
        return {file, stripped: false};
    }
}

/**
 * Normalizes a filename with respect to the current project
 * prefix (and returns the normalized filename or the base
 * filename if not belonging to the project).
 * @param file The (relative or absolute) filename.
 * @param hre The hardhat runtime environment.
 * @returns A structure {file, stripped?}. If the file belonged
 * to the project (relatively or absolutely) returns its relative
 * path and stripped?=true. Otherwise, returns its absolute path
 * and stripped?=false.
 */
function normalizeByProjectPrefix(hre, file) {
    return removeProjectPrefix(hre, path.resolve(getProjectPrefix(hre), file));
}

/**
 * Loads the deploy-everything settings from the ignition/deploy-everything.json
 * file (this file must be maintained and committed).
 * @param hre The hardhat runtime environment.
 * @returns {{contents: Array}} The deploy-everything settings.
 */
function loadDeployEverythingSettings(hre) {
    // Determine the path to the deploy-everything file.
    const root = getProjectPrefix(hre) + "/";
    const file = path.resolve(root, "ignition", "deploy-everything.json");

    // Load it.
    try {
        const content = fs.readFileSync(file, {encoding: 'utf8'});
        return JSON.parse(content);
    } catch(e) {
        return {contents: []};
    }
}

/**
 * Saves the deploy-everything settings into the ignition/deploy-everything.json
 * file (this file must be maintained and committed).
 * @param settings The deploy-everything settings.
 * @param hre The hardhat runtime environment.
 */
function saveDeployEverythingSettings(settings, hre) {
    // Determine the path to the deploy-everything file.
    const root = getProjectPrefix(hre);
    const file = path.resolve(root, "ignition", "deploy-everything.json");

    // Save it.
    fs.writeFileSync(file, JSON.stringify(settings), {encoding: 'utf8'});
}

/**
 * Adds a module to the deploy-everything settings (loads it before and saves
 * it after).
 * @param hre The hardhat runtime environment.
 * @param file The module file being added.
 * @param external Whether it is externally imported or not.
 */
function addDeployEverythingModule(hre, file, external) {
    external = !!external;
    let module = "";
    if (external) {
        // External files are taken as-is. They must not start with / and
        // must succeed importing.
        if (file.startsWith("/")) {
            throw new Error(`The module starts with / (this is forbidden): ${file}.`);
        }
        // External files must succeed importing.
        try {
            require(file);
        } catch(e) {
            throw new Error(`Could not require() the external file: ${file}.`)
        }
        // Assign the module directly.
        module = file;
    }
    else
    {
        // Internal files must belong to the project after normalization.
        const normalized = normalizeByProjectPrefix(hre, file);
        if (!normalized.stripped) {
            throw new Error(`The module does not belong to the project: ${file}`);
        }
        // Internal files must succeed importing.
        try {
            require(getProjectPrefix(hre) + "/" + normalized.file);
        } catch(e) {
            throw new Error(`Could not require() the project file: ${file}.`)
        }
        // Assign the module from the normalized path.
        module = normalized.file;
    }

    // Load, check absence, append, and save.
    let settings = loadDeployEverythingSettings(hre);
    settings.contents ||= [];
    if (!!settings.contents.find((e) => {
        return e.filename === module && e.external === external;
    })) throw new Error(`The module is already added to the full deployment: ${file}.`);
    settings.contents = [...settings.contents, {filename: module, external: external}];
    saveDeployEverythingSettings(settings, hre);
}

/**
 * Removes a module to the deploy-everything settings.
 * @param hre The hardhat runtime environment.
 * @param file The module file being removed.
 * @param external Whether the entry to remove is externally imported or not.
 */
function removeDeployEverythingModule(hre, file, external) {
    external = !!external;
    let module = external ? file : normalizeByProjectPrefix(hre, file).file;

    // Load, check presence, remove, and save.
    let settings = loadDeployEverythingSettings(hre);
    settings.contents ||= [];
    let element = settings.contents.find((e) => {
        return e.filename === module && e.external === !!external;
    });
    if (!element) throw new Error(`The module is not added to the full deployment: ${file}.`);
    settings.contents = settings.contents.filter((e) => e !== element);
    saveDeployEverythingSettings(settings, hre);
}

/**
 * Lists all the added modules and their results.
 * @param hre The hardhat runtime environment.
 * @return {Promise<Array>} The added modules into the deployment (including the keys returned in the module) (async function).
 */
async function listDeployEverythingModules(hre) {
    const chainId = await hre.common.getChainId();
    return loadDeployEverythingSettings(hre).contents.map(({filename, external}) => {
        let moduleResults = null;
        let module = null;
        try {
            const module = importModule(hre, filename, external, chainId);
            moduleResults = Object.values(module.results || {}).map((f) => f.id);
        } catch {}

        return {filename, external, moduleResults, module};
    });
}

/**
 * Adds a chainId to the name of a JS or TS file.
 * @param filename The file.
 * @param chainId The chain id.
 * @returns {string} The new file.
 */
function addChainId(filename, chainId) {
    const parts = filename.split('.');
    const extension = parts.pop();
    return `${parts.join('.')}-${chainId}.${extension}`;
}

/**
 * Imports a module (either externally or locally).
 * @param hre The hardhat runtime environment.
 * @param filename The name of the file to load.
 * @param external Whether it is external or not.
 * @param chainId The chain id.
 * @returns {*} The loaded ignition module.
 */
function importModule(hre, filename, external, chainId) {
    if (!hre.silent) console.log(`>>> Importing ${external ? 'external' : 'internal'} module:`, filename);

    try {
        const path_ = external
            ? addChainId(filename, chainId)
            : addChainId(path.resolve(hre.config.paths.root, filename), chainId);
        if (!hre.silent) console.log(">>> Trying path:", path_);
        const required = require(path_);
        return required.default === undefined ? required : required.default;
    } catch {
        if (!hre.silent) console.error(">>> Could not load the module. Ensure it's a valid file and a valid Hardhat Ignition module.");
    }

    try {
        const path_ = external
            ? filename
            : path.resolve(hre.config.paths.root, filename);
        if (!hre.silent) console.log(">>> Trying path:", path_);
        const required = require(path_);
        return required.default === undefined ? required : required.default;
    } catch(e) {
        throw new Error(`Could not import the ${external ? "external" : "in-project"} module: ${filename}.`);
    }
}

/**
 * Runs all the deployments (also considering the current chainId).
 * @param reset Resets the current deployment status (journal) for the current network.
 * @param deploymentArgs The deployment arguments (same semantics of `hre.ignition.deploy` args).
 * @param hre The hardhat runtime environment.
 * @returns {Promise<void>} Nothing (async function).
 */
async function runDeployEverythingModules(hre, reset, deploymentArgs) {
    const modules = await listDeployEverythingModules({...hre, silent: false});
    const length = modules.length;
    if (!!reset) await hre.ignition.resetDeployment(deploymentArgs.deploymentId, hre);
    for(let idx = 0; idx < length; idx++) {
        const module = modules[idx].module;
        try {
            if (!hre.silent) console.log(`>>> Deploying ${module.external ? 'external' : 'internal'} module:`, module.filename);
            await hre.ignition.deploy(module, deploymentArgs);
        } catch(err) {
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

/**
 * Tells whether a file is already added as a module in the deploy-everything
 * (current) settings.
 * @param file The module file being tested.
 * @param external Whether we're talking about an imported file or a local one.
 * @param hre The hardhat runtime environment.
 * @returns {boolean} Whether it is already added or not.
 */
function isModuleInDeployEverything(hre, file, external) {
    external = !!external;
    let module = external ? file : normalizeByProjectPrefix(hre, file).file;
    let settings = loadDeployEverythingSettings(hre);
    return !!(settings.contents || []).find((element) => {
        return !!element.external === external && module === element.filename;
    });
}

module.exports = {
    addDeployEverythingModule, removeDeployEverythingModule, isModuleInDeployEverything,
    listDeployEverythingModules, runDeployEverythingModules
}