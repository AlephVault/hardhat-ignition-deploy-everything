# hardhat-deploy-everything
A hardhat plugin providing the ability to list and manage a bunch of hardhat-ignition deployments to execute at once
(even conditional deployment modules).

# Installation
Run this command to install it from NPM:

```shell
npm install --save-dev hardhat-common-tools@^1.4.0 hardhat-enquirer-plus@^1.4.0 hardhat-ignition-deploy-everything@^1.1.2
```

# Usage
This is a hardhat plugin, so the first thing to do is to install it in your hardhat.config.ts file:

```javascript
require("hardhat-common-tools");
require("hardhat-enquirer-plus");
require("hardhat-ignition-deploy-everything");
```

Once there, you can make use of it (this supports both viem-enabled and ethers-enabled projects):

This package works entirely on top of hardhat-ignition, so you'll also need it (along with the viem/ethers plugin) in
your project.

_There are some arguments not documented here: most of them belongs to the ignition package and some others belong to
this one:_

  - `--force-non-interactive` causes the command to fail if it starts prompting for data to the user.
  - `--external` (in add/remove/check sub-commands) tells that the involved file does not belong to the project but it
    is, instead, a package-path (suitable for a direct `require` call without `./` prefix) file.

## Listing all the registered ignition modules

In order to list which ignition module files are registered in your project, run this command:

```shell
npx hardhat ignition deploy-everything list
```

You will see something like this one (or a message telling that no modules are registered):

```
These modules are added to the full deployment:
- Project file: ignition/modules/Lock.js
  Results: {LockModule#Lock}
- Project file: ignition/modules/MyModule.js
  Results: {MyModule#MyContract}
```

In this example, my deploy-everything settings are set to only two modules: The Lock.js module (which comes by default
in new JavaScript projects; it will be Lock.ts on TypeScript projects) and the MyModule.js file (which stands for an
example module with just one contract).

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

This implies executing all the modules defined there. Since this is already on top of hardhat-ignition, the modules
that were previously run are kept and not re-run again.

The command to execute the full deployment is:

```shell
npx hardhat ignition deploy-everything run
```

If you want to set the parameters, use the `--parameters` argument for that. Actually: also take a look to the help:

```shell
npx hardhat ignition deploy-everything run --help
```

It will list all the hardhat-ignition-related optional arguments (e.g. --reset and --verify). They will work as
expected/detailed in hardhat-ignition's documentation.

## Network-dependent deployments

While hardhat-ignition does not support network-dependent or network-conditional deployments, this is a useful feature
when dealing with multiple chains.

For example, it might happen that you'd like to have a Chainlink's PriceFeed contract in your local network, but they
are only present in external networks (testnets or mainnets, and not all of them). In this case, Chainlink provides a
mock (as of today: something they call Aggregator V3 Mock). Still, you have to be careful when deploying it vs. when
dealing with an external reference (this, in testnets and mainnets) when not having something like network-conditional
deployments.

However, deploy-everything supports network-conditional deployments while executing the `run` task. In order to make
use of this feature for one (or more, perhaps) of your modules, you have to follow these steps:

1. Let's say that you have your `AwesomeInterface` which is implemented in some testnet/mainnet you care about.
2. Let's also say that you have your `AwesomeMock` implementing the `AwesomeInterface`.
   - This is a local contract you want to use in your local network (that you'll somehow mock).
3. You'll create a deployment module for your mock (as a new contract).
   - You'll name it `MyAwesomeModule` and will typically make use of `m.contract` future, using the
     `AwesomeMock` artifact. The extension might be `.ts` or `.js` depending on your needs.
4. You'll create a deployment module for the existing contracts:
   - You'll name it `MyAwesomeModule-XXXX` where XXXX is the intended target chain's id. For example, for Polygon Amoy
     your module file will be named: `MyAwesomeModule-80002.js` (or ending in `.ts` if TypeScript).
   - __However__ the internal module name will still be `MyAwesomeModule` to keep conditional compatibility with the
     ignition deployment process (i.e. `module.exports = buildModule("MyAwesomeModule", ...);`) in each case.
   - The contents, in this case, will involve the `m.contractAt` call instead.
   - You can have conditional modules for _many_ chain ids, not just one. For example: you might have modules for
     networks: Ethereum Mainnet (1), Polygon Mainnet (137), Ethereum Sepolia Testnet (11155111) and Polygon Amoy
     Testnet (80002), for a total of 4 extra conditional modules, while also needing the base, non-conditional, module.
5. You'll add all the modules you want to the deploy-everything settings, _and only the MyAwesomeModule module_ (as if
   you were not doing conditional deployment at all).
6. When you execute the `run` task, you'll specify the `--network` option (and perhaps --deployment-id) as usual with
   ignition deployments. If the chosen network matches the id of a conditional module (in our example: the Amoy / 80002
   chain id) _then the alternate module (in our example: MyAwesomeModule-80002.js) will be executed instead of the main
   one (in our example: MyAwesomeModule.js)_.

## Manually invoking the deploy-everything utilities

While the tasks do the job, you can invoke the utilities to deal with `deploy-everything` in your own code.

This is done in two alternatives:

1. Run them as a hardhat task (scope: `ignition`, task: `deploy-everything`, first positional argument: either `"list"`,
   `"check"`, `"add"`, `"remove"` or `"run"`).
2. Run them through direct/manual `hre.ignition.deployEverything` utilities:

   - `addDeployEverythingModule(file: string, external: boolean)` to add one file (in-project or in-external-package).
   - `removeDeployEverythingModule(file: string, external: boolean)` to remove it.
   - `listDeployEverythingModules()` to list them (it is an asynchronous function).
   - `isModuleInDeployEverything(file: string, external: boolean)` to tell whether it is added (this does not test the
     conditional modules, however).
   - `runDeployEverythingModules(reset, args)` to execute them (it is an asynchronous function).
     - `reset` tells whether the deployment will be reset (for the current --network / --deployment-id).
     - `args` are directly passed to `hre.ignition.deploy` calls, properly including the arguments, if any.
     - Notice how `verify` is not passed here. This is an external ignition task. Invoke it with:

       ```javascript
       await hre.run(
            { scope: "ignition", task: "verify" },
            { deploymentId: someOptionalDeploymentId }
        );
       ```