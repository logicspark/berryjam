# Introduction

Welcome to Berryjam documentation. Berryjam provides a simple way to identify your component usage and their relationships. You can use the JSON output to create your own dashboard and improve communications across your development team.

In this document, we will go into deeper details of what core functions are in the library and what rules we use to detect components.

# Library Details

Berryjam contains 2 classes:

| Class        | Description                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `VueScanner` | Scan a project for component profiles                                                          |
| `GitService` | Look for git related information such as author and datetime and map to each component profile |

### VueScanner Class

After importing the class, you can instantiate it using the class constructor which requires two parameters: 
- The first parameter is the path of the project to be scanned, and
- The second is an option object that utilizes the `VueScannerOption` interface.

After instantiation, you can use the `scan` method to start scanning your project.

```js
const vueScanner = new VueScanner(path, option);
const scanResult = await vueScanner.scan();
```

The constructor will perform the following:

- Validate if the provided path exists
- Validate if the package.json exists at the root of the provided path
- Create a root directory with options to install Vue Compiler and Babel libraries

For clearer understanding of each available option within the `VueScannerOption` interface, here is the detailed description:

### VueScannerOption Interface

| Property   | Type                     | Description                                                         |
|------------|--------------------------|---------------------------------------------------------------------|
| `appDir`   | `string`                 | The path of the project directory to be scanned.                    |
| `output`   | `OutputFormat` (optional)| The desired output format of the scanned result. (JSON by default)  |
| `ignore`   | `string[]` (optional)    | An array of file names or directory names to exclude from scanning. |
| `verbose`  | `boolean` (optional)     | Enable verbose mode for more detailed scanning information.         |
| `debug`    | `boolean` (optional)     | Operate the scanner in debug mode, providing debugging information. |

### OutputFormat Type

The `OutputFormat` type represents available output formats.

| Type       | Description                                                                                         |
|------------|-----------------------------------------------------------------------------------------------------|
| `"json"`   | Output the scanned result in JSON format and saved as 'component-profiles.json' within the 'appDir'.|
| `"stdout"` | Display the scanned result directly in the console (stdout).                                        |

These options and types offer flexibility and customization when using the `VueScanner` function to analyze Vue.js projects.

There are 5 steps to scan Vue components with `VueScanner`. These steps are as follow:

| Step                               | Description                                                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `Group by Related Package.Json` | Since there are multiple package.json files and supported files (`.vue`, `.js`, `.jsx`, `.ts`, `.tsx` and all files from the `.nuxt` folder (if any)), the system will group and determine the source of origin |
| 2. `Select Analyzer Lib`           | To choose the right library that matches the Vue version of your project                                                                                                                                        |
| 3. `Prepare Alias Paths`           | To gather all aliases from TS, JS and Vite config files to use for replacement in the 'import' statements                                                                                                       |
| 4. `Analyze Component Files`       | For each file extension, the system will gather component info, including props                                                                                                                                 |
| 5. `Optimize Analyzed Results`     | Based on the component info, improvements are made by removing duplicates and formatting the component profile in a more structured way                                                                         |

#### (1) Group by Related Package.Json

This step will call 5 methods to achieve its objective. The output will be a list of package groups together with related files which will be used to map components’ origins.

| Method                   | Description                                                                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `groupFilesByRelatedPackageJson` | Asynchronously group code configuration files and their associated "package.json" files.This function scans the specified directory and its subdirectories for supported files and identifies code configuration files (i.e., tsconfig.json, jsconfig.json). |
| `getSupportedFiles`              | Gather files that will be used for scanning                                                                                                                                                                                                                  |
| `checkDotNuxtExists`             | Check if a .nuxt folder exists. The .nuxt folder is important for finding Vue components in Nuxt projects                                                                                                                                                    |
| `traceFilesToPackageJson`        | To find and group to determine components’ sources origins                                                                                                                                                                                                   |
| `findNearestPackageJson`         | To search for the nearest "package.json" file by traversing up the directory hierarchy.                                                                                                                                                                      |
| `findCodeConfig`                 | To gather all JS and TS config files with respect to each package.json which will be used for mapping later                                                                                                                                                  |

#### (2) Select Analyzer Lib

 7 methods are called to achieve its objective. At the end, we would have prepared two libraries, namely Vue Compiler and Babel.

| Method                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parsePackageJson`              | To parse a "package.json" file to extract its dependencies and devDependencies.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `getLibVersionFromDependencies` | Get specific library version from the package.json dependencies                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `getBabelParserVersion`         | Retrieve the version of the Babel parser from either regular dependencies or devDependencies.                                                                                                                                                                                                                                                                                                                                                                                     |
| `installVueParserLib`           | Install a specific version of the '@vue/compiler-sfc' library to the application directory.                                                                                                                                                                                                                                                                                                                                                                                       |
| `installBabelParserLib`         | Install a specific version of the '@babel/parser' library to the application directory.                                                                                                                                                                                                                                                                                                                                                                                           |
| `installLibToAppDir`            | Execute a shell command to install a library in the application directory.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `getAnalysisToolModules`        | <div>Select libs to use for component analysis based on the following criteria: <ol><li>If the root directory contains both installed libs, select from these two</li><li>If the root directory contains only one of the two, select the available one and select the other lib installed from Berryjam's dependencies</li><li>If the root directory does not contain any, select the libs installed from Berryjam's dependencies</li></ol>_Remark: Both libs are required_</div> |

#### (3) Prepare Alias Paths

Step 3 will call on 3 methods. It will gather a list of aliases in the form of objects.

| Method                      | Description                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `prepareAliasPaths`                | To prepare alias paths for module resolution by merging paths from different sources (ts/js.config & vite.config). |
| `getCodeConfigCompilerOptionPaths` | Collect an alias list such as @, ~ together with its prefix path from JS and TS config files                       |
| `getViteAliasPaths`                | Collect an alias list such as @, ~ together with its prefix path from Vite config file (if any)                    |

#### (4) Analyze Component Files

To analyze Vue.js projects of various file extensions, we will need 10 methods to achieve its objective. The function will provide component information such as global variables that contain import statements, Vue components and props.

| Method                               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseCode`                                  | The function is responsible for parsing code which is in various file types (e.g., .vue, .js, .jsx, .ts, .tsx) and returning a ParsedCodeResult.                                                                                                                                                                                                                                                                                                                                                  |
| `parseVue`                                   | If it is a `.vue` file, the system will use vue/compiler-sfc to parse codes into an Abstract Syntax Tree (AST) which will be transformed into component information                                                                                                                                                                                                                                                                                                                               |
| `parseJs`                                    | If it is a `.js` file, the system will use @babel/parser to parse codes into AST format which will be transformed into component information                                                                                                                                                                                                                                                                                                                                                      |
| `parseJsx`                                   | If it is a `.jsx` file, the system will use @babel/parser to parse codes into AST format which will be transformed into component information                                                                                                                                                                                                                                                                                                                                                     |
| `parseNuxtGlobalTypes`                       | If it is either a `.ts` or `.tsx` and contain a prefix `app.config.d.ts` or `components.d.ts`, the system will use Typescript library to parse codes into AST format which will be transformed into component information                                                                                                                                                                                                                                                                         |
| `parseComponentsDeclaration`                 | If it is either a `.ts` or `.tsx` and contain file prefix `.d` but does not contain prefix `app.config.d.ts` or `components.d.ts`, the system will use @babel/parser to parse codes into AST format which will be transforrmed into component information                                                                                                                                                                                                                                         |
| `parseTypescript`                            | If it is either a `.ts` or .`tsx` and the file prefix does not have `.d`, the system will use Typescript library to parse codes into AST format which will be transformed into component information                                                                                                                                                                                                                                                                                              |
| `updateImportStatementsWithTransformedPaths` | Using outputs from both function calls `prepareAliasPath()` and `importStatements()`, the function will replace alias with corresponding prefix path and add new records into a global variable which will be used later                                                                                                                                                                                                                                                                          |
| `collectVueComponents`                       | For each Vue component in the component info, the system will convert component name from `Kebab` case to `Pascal` case. Then, the said component will be checked against the global variable which contains a list of Vue components: <ol><li>If either the tag or source does not match, add a new record to the list</li><li>If both the tag and source are identical, add a new item to the `rows` key of `VueComponent` interface of the corresponding Vue component from the list</li></ol> |
| `nomalizeComponentChildTag`                  | Normalize found components in the current file to be unique.                                                                                                                                                                                                                                                                                                                                                                                                                                      |

#### (5) Optimize Analyzed Results

Finally, 5 methods are called to provide a complete information of each component.

| Method               | Description                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `distinctImportStatements`  | Distinct import statements and categorize whether the statement is from internal or external origin              |
| `mapComponentProfileSource` | Map component profile sources based on import statements, children components, and current package dependencies. |
| `removeDuplicateComponents` | Distinct vue components and recount the total number of components                                               |
| `mapComponentProfileProps`  | Map component profile properties based on the provided mapping of file paths to Vue properties.                  |
| `mapComponentProfileGit`    | Map component profiles with Git-related information. use `GitService` class.                                     |

_Remark: Currently, an `external` tag means it’s a library from your project’s dependencies_

### GitService Class

Below are the methods in the `GitService` class:

| Method       | Description                                                                          |
| ------------ | ----------------------------------------------------------------------------------   |
| `gitScanner` | Initiate git log shell commands to scan which will be used by `gitMapping`.          |
| `gitMapping` | Using the result from `gitScanner` to compare component name and git log filename. If both match, the git information will update into the respective component profile. |

### Dependencies

Third-Party plugins are loaded automatically from Berryjam’s package.json

- Code Parsers
  - [Babel](https://babeljs.io/)
    - @babel/core
    - @babel/generator
    - @babel/parser
    - @babel/preset-typescript
    - @babel/traverse
  - [Vue](https://www.npmjs.com/package/vue?activeTab=dependencies)
    - @vue/compiler-sfc
    - @vue/compiler-dom
    - @vue/babel-plugin-jsx
- Node Modules
  - path
  - fs
- Others
  - [glob](https://www.npmjs.com/package/glob)
  - [lodash](https://www.npmjs.com/package/lodash)
  - [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths)

# Built-In-Rules

Rules serve to identify Vue.js components and their properties. Rules consist of how we handle Vue components for different file extensions (`.vue`, `.js`, `.jsx`, `.ts`, `.tsx`). All these rules provide the basis on how the scanner detects and extracts component information.

For more information on these rules, please check out the [built-in-rules](./built-in-rules) folder.

If there is a rule that is missing, feel free to submit a request [here](../../../issues/new?assignees=&labels=enhancement&projects=&template=feature_request.yml&title=✨+).
