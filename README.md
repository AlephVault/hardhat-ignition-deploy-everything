# hardhat-ignition-deploy-everything

A Hardhat 3 plugin for listing, managing, and executing multiple Hardhat Ignition deployment modules in one run,
including chain-specific module variants.

# Installation

Install the Hardhat 3 package and its peer helper plugins:

```shell
npm install --save-dev hardhat-ignition-deploy-everything@^3.0.0 hardhat-common-tools@^3.0.0 hardhat-enquirer-plus@^3.0.0
```

This package runs on top of Hardhat Ignition. Use it in a project that also registers an ethers or viem Hardhat 3
toolbox, such as `@nomicfoundation/hardhat-toolbox-mocha-ethers` or `@nomicfoundation/hardhat-toolbox-viem`.

# Usage

Hardhat 3 projects are ESM projects. Register the plugin in `hardhat.config.js` or `hardhat.config.ts` with
`defineConfig` and a `plugins` array:

```javascript
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatCommonTools from "hardhat-common-tools";
import hardhatEnquirerPlus from "hardhat-enquirer-plus";
import hardhatIgnitionDeployEverything from "hardhat-ignition-deploy-everything";

export default defineConfig({
  plugins: [
    hardhatToolboxMochaEthers,
    hardhatCommonTools,
    hardhatEnquirerPlus,
    hardhatIgnitionDeployEverything
  ],
  solidity: "0.8.24"
});
```

If another registered plugin already loads `hardhat-common-tools` and `hardhat-enquirer-plus`, do not register them a
second time. Hardhat 3 rejects duplicate plugin ids.

_There are some arguments not documented here: most of them belong to the ignition package and some others belong to
this one:_

  - `--force-non-interactive` causes the command to fail if it starts prompting for data to the user.
  - `--external` (in add/remove/check sub-commands) tells that the involved file does not belong to the project but it
    is, instead, a package-path suitable for an ESM import without `./` prefix.

## Listing all the registered ignition modules

In order to list which ignition module files are registered in your project, run this command:

```shell
npx hardhat ignition deploy-everything list
```

You will see something like this one (or a message telling that no modules are registered):

```text
These modules are added to the full deployment:
- Project file: ignition/modules/Lock.js
  Results: {LockModule#Lock}
- Project file: ignition/modules/MyModule.js
  Results: {MyModule#MyContract}
```

In this example, the deploy-everything settings are set to only two modules: the `Lock.js` module from a JavaScript
project, or `Lock.ts` in a TypeScript project, and the `MyModule.js` file.

## Registering an ignition module into the deploy-everything settings

The following command adds the new module:

```shell
npx hardhat ignition deploy-everything add --module ignition/modules/SomeOtherModule.js
```

You'll then see it when running the `list` command.

The following command removes a previously added module instead:

```shell
npx hardhat ignition deploy-everything remove --module ignition/modules/SomeOtherModule.js
```

## Checking whether a module is added to the deploy-everything settings

The following command will tell whether a file is already added to the deploy-everything settings:

```shell
npx hardhat ignition deploy-everything check --module ignition/modules/SomeOtherModule.js
```

## Executing the whole deploy-everything settings

This implies executing all the modules defined there. Since this is already on top of Hardhat Ignition, the modules
that were previously run are kept and not re-run again.

The command to execute the full deployment is:

```shell
npx hardhat ignition deploy-everything run
```

If you want to set parameters, use the `--parameters` argument. The task help lists the Ignition-related optional
arguments, such as `--reset` and `--verify`:

```shell
npx hardhat ignition deploy-everything --help
```

## Network-dependent deployments

While Hardhat Ignition does not directly model network-conditional deployment modules, deploy-everything supports that
workflow while executing the `run` action.

For example, it might happen that you want a Chainlink Price Feed mock in a local network but an existing external
reference in a testnet or mainnet. To make one module conditional by chain:

1. Create the default module, for example `MyAwesomeModule.js` or `MyAwesomeModule.ts`.
2. Create chain-specific variants named `MyAwesomeModule-XXXX.js`, where `XXXX` is the target chain id. For Polygon
   Amoy, use `MyAwesomeModule-80002.js`.
3. Keep the internal Ignition module name the same across variants, for example:

   ```javascript
   import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

   export default buildModule("MyAwesomeModule", (m) => {
     return {
       contract: m.contractAt("AwesomeInterface", "0x...")
     };
   });
   ```

4. Add only the default module to `ignition/deploy-everything.json`.
5. Run the task with `--network`. If the selected network chain id matches a variant file, that variant is used instead
   of the default module.

## Manually invoking the deploy-everything utilities

Hardhat 3 plugins cannot mutate the Hardhat Runtime Environment with `extendEnvironment`. Import the utilities directly
when you need to call them from your own code:

```javascript
import {
  addDeployEverythingModule,
  isModuleInDeployEverything,
  listDeployEverythingModules,
  removeDeployEverythingModule,
  runDeployEverythingModules
} from "hardhat-ignition-deploy-everything";
```

Available utilities:

  - `addDeployEverythingModule(hre, file, external)` adds one file, either in-project or from an external package.
  - `removeDeployEverythingModule(hre, file, external)` removes one file.
  - `listDeployEverythingModules({ ...hre, silent: true })` lists configured modules and their result ids.
  - `isModuleInDeployEverything(hre, file, external)` checks whether a module is registered.
  - `runDeployEverythingModules(hre, reset, args)` executes the configured modules.

To verify after deployment, invoke Hardhat's Ignition verify task:

```javascript
await hre.tasks.getTask(["ignition", "verify"]).run({ deploymentId });
```
