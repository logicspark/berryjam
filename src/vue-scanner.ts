import { resolve, join, dirname, extname, basename, parse } from "path";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";

import groupBy from "lodash/groupBy";

import {
	checkFileTypeExists,
	getSupportedFiles,
	transformStringToRegex,
	writeResultToFile,
} from "./utils/file.utils";
import { DEF_IGNORE_FILES, SUPPORT_EXT } from "./utils/constants";
import type {
	VueScannerOption,
	PackageGroup,
	ComponentProfile,
	ImportStatement,
	PackageDependency,
	TraversedTag,
	ChildComponentTag,
	ParsedCodeResult,
	VueProperty,
	VueComponent,
	OutputFormat,
	ImportStatementUsage,
} from "./types";
import { spawnSync } from "node:child_process";
import {
	getCodeConfigCompilerOptionPaths,
	getViteAliasPaths,
	replaceAliasPath,
} from "./utils/module.utils";
import {
	parseVue,
	parseJs,
	parseJsx,
	parseNuxtGlobalTypes,
	parseComponentsDeclaration,
	parseTypescript,
} from "./utils/compiler";
import {
	kebabCaseToPascalCase,
	pascalCaseToKebabCase,
} from "./utils/text.utils";
import { GitService } from "./utils/git.services";
import logger from "./utils/logger";

type CompilerSFC = typeof import("@vue/compiler-sfc");
type BabelParser = typeof import("@babel/parser");

const defaultOutput: OutputFormat = "json";
abstract class Scanner {
	scanPath!: string;
	option!: VueScannerOption;
	abstract scan: () => Promise<ComponentProfile[]>;
}
export class VueScanner implements Scanner {
	scanPath: string;
	option: VueScannerOption;
	packageGroups: PackageGroup[] = [];
	vueComponents: VueComponent[] = [];
	componentProfiles: ComponentProfile[] = [];
	private ignorePathSet: string[];
	private filePaths: string[] = [];
	/**
	 * Create an instance of VueScanner.
	 *
	 * @param path - The path to the directory to scan for Vue.js files.
	 * @param option - Configuration options for the Vue scanner.
	 * @throws Throw an error if the given path does not exist or if there is no root package.json file.
	 */
	constructor(path: string, option: VueScannerOption) {
		this.scanPath = resolve(path);
		this.option = { output: defaultOutput, ...option };
		// Create a set of ignored paths by
		// combining default ignored files with custom ignored files
		// from the options
		this.ignorePathSet = [
			...new Set([...DEF_IGNORE_FILES, ...(option.ignore ?? [])]),
		];
		if (!existsSync(this.scanPath)) {
			throw new Error("The given path does not exist.");
		}
		if (!this.checkRootPackageJsonExists()) {
			throw new Error(
				"The given path does not contain a package.json file in the root directory."
			);
		}

		const { appDir } = this.option;
		// Create the root of the app directory if it does not exist
		if (!existsSync(appDir)) {
			mkdirSync(appDir, { recursive: true });
		}

		logger.setVerboseMode(this.option.verbose ?? false);
	}

	/**
	 * Check if a `package.json` file exists in the root directory of the specified path.
	 *
	 * @returns A boolean value indicates whether the `package.json` file exists or not.
	 */
	private checkRootPackageJsonExists() {
		return existsSync(join(this.scanPath, "package.json"));
	}

	/**
	 * Asynchronously group code configuration files and their associated "package.json" files.
	 * This function scans the specified directory and its subdirectories for supported files
	 * and identifies code configuration files (i.e., tsconfig.json, jsconfig.json).
	 *
	 * @returns A Promise that resolves an array of `PackageGroup` objects, each representing a group
	 *          of code configuration files and their associated "package.json" file.
	 */
	async groupFilesByRelatedPackageJson(): Promise<PackageGroup[]> {
		this.filePaths = await getSupportedFiles(this.scanPath, this.ignorePathSet);
		// including .nuxt folder
		const nuxtPath = `${this.scanPath}/.nuxt`;
		if (this.checkDotNuxtExists(nuxtPath)) {
			this.filePaths.push(
				...(await getSupportedFiles(nuxtPath, this.ignorePathSet))
			);
		}
		const mappedFilesPackage = (await this.traceFilesToPackageJson()) ?? {};
		return this.findCodeConfig(mappedFilesPackage);
	}

	/**
	 * Asynchronously find code configuration files associated with "package.json" files.
	 * This function traces files to their nearest "package.json" files and identifies code configuration files
	 * (i.e. tsconfig.json, jsconfig.json).
	 *
	 * @param mappedFilesPackage - An object mapping "package.json" file paths to lists of associated files.
	 * @returns {Promise<PackageGroup[]>} A Promise that resolves an array of `PackageGroup` objects,
	 * each representing a group of code configuration files and their associated "package.json" file.
	 */
	findCodeConfig(
		mappedFilesPackage: Record<string, string[] | null>
	): PackageGroup[] {
		return Object.entries(mappedFilesPackage).map((ele) => {
			const packagePath = ele[0],
				files = ele[1];
			return {
				packageJsonPath: packagePath,
				tsConfigPathList: files?.filter((f) => {
					const extension = extname(f);
					const fileName = basename(f);
					if (
						extension === ".json" &&
						(fileName.startsWith("tsconfig") || fileName.startsWith("jsconfig"))
					) {
						return f;
					}
				}),
				files,
			};
		});
	}

	/**
	 * Search for the nearest "package.json" file by traversing up the directory hierarchy.
	 *
	 * @param directory - The starting directory to begin the search.
	 * @returns The path to the nearest "package.json" file if found, or null if not found.
	 */
	private findNearestPackageJson(directory: string) {
		let currentDirectory = directory;
		// Traverse up the directory hierarchy until the root directory ("/") is reached
		while (currentDirectory !== "/") {
			const packageJsonPath = join(currentDirectory, "package.json");
			if (existsSync(packageJsonPath)) {
				// Return the path to the found "package.json" file
				return packageJsonPath;
			}
			// Move up to the parent directory
			currentDirectory = dirname(currentDirectory);
		}
		return null;
	}

	/**
	 * Trace files to their nearest "package.json" files in the directory hierarchy.
	 * @returns A mapping of "package.json" file paths to arrays of traced file paths,
	 *          or null if no "package.json" files were found in the hierarchy.
	 */
	async traceFilesToPackageJson() {
		const filePackageMap: Record<string, string[] | null> = {};
		// Iterate through each file path in the provided list.
		this.filePaths.forEach((file) => {
			const dir = dirname(file);
			// Find the nearest "package.json" file in the directory hierarchy.
			const nearestPackageJson = this.findNearestPackageJson(dir);
			if (nearestPackageJson) {
				if (!filePackageMap[nearestPackageJson]) {
					filePackageMap[nearestPackageJson] = [];
				}
				filePackageMap[nearestPackageJson]!.push(resolve(file));
			}
		});

		return Object.keys(filePackageMap).length ? filePackageMap : null;
	}

	/**
	 * Parse a "package.json" file to extract its dependencies and devDependencies.
	 *
	 * @param packageJsonPath The path to the "package.json" file to parse.
	 * @returns An object containing the dependencies and devDependencies from the "package.json" file.
	 *          If the parsing fails, it returns empty objects for both dependencies and devDependencies.
	 */
	parsePackageJson(packageJsonPath: string): {
		dependencies: Record<string, string>;
		devDependencies: Record<string, string>;
	} {
		try {
			const packageJsonContent = readFileSync(packageJsonPath, "utf8");
			const packageJson = JSON.parse(packageJsonContent);
			const { dependencies, devDependencies } = packageJson;
			return { dependencies, devDependencies };
		} catch (error) {
			// Handle any errors that occur during parsing by returning empty objects.
			return { dependencies: {}, devDependencies: {} };
		}
	}

	/**
	 * Get specific library version from the package.json dependencies
	 * @param libName The name of the library for which to retrieve the version.
	 * @param packageDependency An object containing dependencies and devDependencies.
	 * @returns The version of the specified library if found, or null if not found.
	 */
	getLibVersionFromDependencies(
		libName: string,
		packageDependency: {
			dependencies: PackageDependency;
			devDependencies: PackageDependency;
		}
	): string | null {
		const { dependencies, devDependencies } = packageDependency;
		return dependencies?.[libName] ?? devDependencies?.[libName] ?? null;
	}

	/**
	 * Check if the ".nuxt" folder exists. The ".nuxt" folder is crucial for locating Vue components in Nuxt projects.
	 *
	 * @param dir - Optional. The directory path to check for the existence of the ".nuxt" folder. If not provided,
	 * it defaults to the value of "scanPath" within the class.
	 * @returns {Boolean} True if the ".nuxt" folder exists; otherwise, false.
	 */
	checkDotNuxtExists(dir?: string) {
		const nuxtPath = `${dir ? dir : this.scanPath}/.nuxt`;
		return existsSync(nuxtPath);
	}

	/**
	 * Retrieve the version of the Babel parser from either regular dependencies or devDependencies.
	 *
	 * @param dependencies An object representing regular dependencies.
	 * @param devDependencies An object representing devDependencies.
	 * @returns The version of the Babel parser if found, or null if not found.
	 */
	getBabelParserVersion(
		dependencies: Record<string, string>,
		devDependencies: Record<string, string>
	) {
		// Attempt to retrieve the Babel parser version from dependencies or devDependencies
		return (
			dependencies?.["@babel/parser"] ??
			devDependencies?.["@babel/parser"] ??
			dependencies?.["@babel/core"] ??
			devDependencies?.["@babel/core"] ??
			null
		);
	}

	/**
	 * Install a specific version of the '@vue/compiler-sfc' library to the application directory.
	 *
	 * @param vueVersion - The desired version of Vue.js to install (i.e. '2.6.14').
	 * @throws Throw an error if the installation process encounters any issues.
	 */
	installVueParserLib(vueVersion: string) {
		this.installLibToAppDir(
			`npm install @vue/compiler-sfc@${vueVersion} -s -S`
		);
	}

	/**
	 * Install a specific version of the '@babel/parser' library to the application directory.
	 *
	 * @param babelVersion - The desired version of Babel to install (i.e. '7.15.6').
	 * @throws Throw an error if the installation process encounters any issues.
	 */
	installBabelParserLib(babelVersion: string) {
		this.installLibToAppDir(`npm install @babel/parser@${babelVersion} -s -S`);
	}

	/**
	 * Execute a shell command to install a library in the application directory.
	 * The command is executed synchronously with inherited standard I/O streams.
	 *
	 * @param command - The shell command to run a library installation.
	 */
	private installLibToAppDir(command: string) {
		spawnSync(command, {
			stdio: "inherit",
			shell: true,
			cwd: this.option.appDir, // Set the current working directory to the application directory which user was provided.
		});
	}

	/**
	 * Asynchronously load and import necessary analysis tool modules.
	 *
	 * @returns A Promise that resolves to an array of imported analysis tool modules.
	 */
	getAnalysisToolModules(): Promise<[any, any]> {
		// Initialize an array to store promises for importing analysis tool modules
		let importModules: [any, any] = [
			import(`@vue/compiler-sfc`),
			import(`@babel/parser`),
		];
		// Check if the 'node_modules' directory exists in the specified 'appDir'
		const isNodeModuleExist = existsSync(`${this.option.appDir}/node_modules`);
		if (isNodeModuleExist) {
			const compilerSfc = `${this.option.appDir}/node_modules/@vue/compiler-sfc`;
			const babelParser = `${this.option.appDir}/node_modules/@babel/parser`;
			if (existsSync(compilerSfc)) {
				importModules[0] = import(compilerSfc);
			}
			if (existsSync(babelParser)) {
				importModules[1] = import(babelParser);
			}
		}
		// Return a Promise that resolves an array of imported analysis tool modules
		return Promise.all(importModules);
	}

	/**
	 * Asynchronously prepare alias paths for module resolution by merging paths from different sources (ts/js.config & vite.config).
	 *
	 * @param packageJsonPath - The path to the "package.json" file of the project.
	 * @param babelParser - An instance of BabelParser for parsing configurations.
	 * @returns A Promise that resolves to an object containing merged alias paths.
	 */
	async prepareAliasPaths(packageJsonPath: string, babelParser: BabelParser) {
		let aliasPaths = await getCodeConfigCompilerOptionPaths(packageJsonPath);
		const vitePath = await getViteAliasPaths(
			packageJsonPath,
			babelParser.parse
		);
		if (vitePath) {
			aliasPaths = Object.assign(aliasPaths || {}, vitePath);
		}
		return aliasPaths;
	}

	/**
	 * Get the presence of Nuxt.js in a scan project's dependencies.
	 *
	 * @param packageGroup - An object containing information about the project's package.json file.
	 * @returns The version of Nuxt.js if it is listed as a dependency, or null if not found.
	 */
	getNuxtVersionByPackageGroup(packageGroup: PackageGroup) {
		const { packageJsonPath } = packageGroup;
		const nuxtVersion = this.getLibVersionFromDependencies(
			"nuxt",
			this.parsePackageJson(packageJsonPath)
		);
		return nuxtVersion;
	}

	/**
	 * The function is responsible for parsing code which is in various file types (e.g., .vue, .js, .jsx, .ts, .tsx)
	 * and returning a ParsedCodeResult.
	 *
	 * @param filePath - The path to the file that needs to be parsed.
	 * @param `parserModule: { vueModule: CompilerSFC; babelModule: BabelParser }` - An object containing two modules,
	 * vueModule and babelModule, which are used for parsing different file types.
	 * @returns ParsedCodeResult - An object containing parsed information from the code.
	 */
	parseCode(
		filePath: string,
		parserModule: { vueModule: CompilerSFC; babelModule: BabelParser }
	): ParsedCodeResult {
		const extension = extname(filePath);
		let parsedResult: ParsedCodeResult = {
			componentTags: [],
			importStatements: null,
			deepestNested: 0,
			properties: undefined,
		};
		const { vueModule, babelModule } = parserModule;
		switch (extension) {
			case ".vue":
				const result = parseVue(
					filePath,
					vueModule.parse as any,
					babelModule.parse as any
				);
				parsedResult = { ...result };
				break;
			case ".js":
				const parsedJsResult = parseJs(filePath, babelModule.parse as any);
				parsedResult = { ...parsedJsResult };
				break;
			case ".jsx":
				const parsedJsxResult = parseJsx(filePath, babelModule.parse as any);
				parsedResult = { ...parsedJsxResult };
				break;
			case ".ts":
			case ".tsx":
				if (filePath.endsWith(".d.ts")) {
					if (
						filePath.endsWith("app.config.d.ts") ||
						filePath.endsWith(join(".nuxt", "components.d.ts"))
					) {
						parsedResult.importStatements = parseNuxtGlobalTypes(filePath);
					} else {
						parsedResult.importStatements = parseComponentsDeclaration(
							filePath,
							babelModule.parse as any
						);
					}
				} else {
					const parsedTSResult = parseTypescript(
						filePath,
						extension,
						babelModule.parse as any
					);
					parsedResult = { ...parsedTSResult };
				}
				break;
			default:
				break;
		}
		return parsedResult;
	}

	/**
	 * Using outputs from both function prepareAliasPath and importStatements, the function will replace alias with
	 * corresponding prefix path and add new records into a global variable which will be used later.
	 *
	 * @param allImportStatements - A comprehensive list of import statements that was collected from all files.
	 * @param importStatements - A list of import statements at the current file.
	 * @param aliasPath - An object of prepared alias paths taken from different sources (ts/js.config & vite.config).
	 */
	updateImportStatementsWithTransformedPaths(
		allImportStatements: ImportStatement[],
		importStatements: ImportStatement[],
		aliasPath: Record<string, string[]> | null
	) {
		for (const el of importStatements) {
			if (aliasPath) {
				const transformedPath = replaceAliasPath(el.source, aliasPath);
				el.sourcePath = transformedPath;
			} else {
				el.sourcePath = el.source;
			}
			allImportStatements.push(el);
		}
		return allImportStatements;
	}

	/**
	 * Collect information about Vue components based on traversed tags, import statements, and the current file path.
	 *
	 * @param allTraversedTags - An array of all traversed tags in the file.
	 * @param importStatements - Import statements from the file, if available.
	 * @param filePath - The current file path associated with the components.
	 */
	collectVueComponents(
		allTraversedTags: TraversedTag[],
		importStatements: ImportStatement[] | null,
		filePath: string
	) {
		const ignorePatterns = this.ignorePathSet.map(transformStringToRegex);
		allTraversedTags.forEach((ele) => {
			const { tag, row } = ele;
			const transformedTag = kebabCaseToPascalCase(tag).toLowerCase();
			const foundMappedImport =
				importStatements?.find((ele) =>
					ele.importedNames.some((n) => n?.toLowerCase() === transformedTag)
				) ?? null;
			let source = "";
			if (foundMappedImport) {
				const sourceFilePath =
					foundMappedImport?.sourcePath ?? foundMappedImport?.source;
				source = sourceFilePath;
			}
			const foundSourceElem = this.vueComponents.find(
				(ele) => ele.name === tag && ele.destination === filePath
			);
			if (foundSourceElem) {
				foundSourceElem.rows.push(row);
			} else {
				// Check if the file path matchs in the `ignorePatterns` array.
				if (ignorePatterns.some((pattern) => source.match(pattern))) {
					return;
				}
				const vueComponent = {
					name: tag,
					source,
					destination: filePath,
					rows: [row],
					deepestNested: 0,
					fileInfo: {
						path: "",
						property: {
							dataLastModified: "",
							lastModified: "",
							created: "",
							createdBy: "",
							updatedBy: "",
						},
					},
				};
				this.vueComponents.push(vueComponent);
			}
		});
	}

	/**
	 * Normalize component child tags based on the provided `filePath` and `componentTags`.
	 *
	 * @param filePath - The file path associated with the child component.
	 * @param componentTags - An array of component tags to normalize.
	 * @returns The normalized child component object.
	 */
	normalizeComponentChildTag(filePath: string, componentTags?: TraversedTag[]) {
		const child: ChildComponentTag = {
			total: 0,
			tags: [],
			source: filePath,
		};
		if (componentTags?.length) {
			child.tags = componentTags.map((ele) => ele.tag) ?? [];
			child.tags = [...new Set(child.tags)];
			child.total = child.tags.length;
		}
		return child;
	}

	/**
	 * Group and process a list of import statements to return distinct import statements.
	 *
	 * @param importStatements - An array of import statements to process.
	 * @returns An array of distinct import statements with summarized information.
	 */
	distinctImportStatements(importStatements: ImportStatement[]) {
		if (!importStatements.length) return [];

		const importStatementsGroupedBySourcePath = groupBy(
			importStatements,
			"sourcePath"
		);
		this.option.debug &&
			writeFileSync(
				`${this.option.appDir}/importStatementsGroupedBySourcePath.json`,
				JSON.stringify(importStatementsGroupedBySourcePath, null, 2)
			);
		const revisedImportStatement: ImportStatement[] = [];
		Object.entries(importStatementsGroupedBySourcePath).forEach((ele) => {
			const source = ele[0],
				importedList = ele[1];
			if (!importedList.length) return;
			const { source: firstSourcePath, destination } = importedList.at(0)!;
			const foundImportWithUsage = importedList.find((ele) => ele.usage);

			let usage: ImportStatementUsage | undefined = undefined;
			if (foundImportWithUsage) {
				const importedListGroupedByDestination = groupBy(
					importedList,
					"destination"
				);
				const lines = {} as Record<string, number[]>;
				importedList.forEach(({ destination }) => {
					const tmp = importedListGroupedByDestination[destination].reduce(
						(arr, el) => {
							el.usage && arr.push(...el.usage.lines[destination]);
							return arr;
						},
						[] as number[]
					);
					lines[destination] = tmp;
				});
				usage = {
					...foundImportWithUsage.usage!,
					lines,
				};
			}
			const { exists, filePath } = checkFileTypeExists(source, SUPPORT_EXT);
			revisedImportStatement.push({
				importedNames: importedList.reduce((arr, i) => {
					arr.push(...i.importedNames.filter((e) => !arr.includes(e)));
					return arr;
				}, [] as string[]),
				source: firstSourcePath,
				sourcePath: filePath,
				importSourceType: exists ? "internal" : "external",
				destination,
				...(usage && { usage }),
			});
		});
		return revisedImportStatement;
	}

	/**
	 * Retrieve a specific dependency by name from either regular dependencies or devDependencies.
	 *
	 * @param dependencies - An object representing regular dependencies.
	 * @param devDependencies - An object representing devDependencies.
	 * @param packageName - The name of the dependency to retrieve.
	 * @returns An object containing the name and version of the found dependency, or undefined if not found.
	 */
	getDependencyByName(
		dependencies: PackageDependency,
		devDependencies: PackageDependency,
		packageName: string
	) {
		const cb = (packages: PackageDependency) => {
			return Object.entries(packages).find((ele) => {
				const pckName = ele[0];
				return packageName && pckName.startsWith(packageName);
			});
		};
		const foundDependency = cb(dependencies);
		const foundDevDependencies = cb(devDependencies);
		const existsPackage = foundDependency ?? foundDevDependencies;
		if (!existsPackage) {
			return undefined;
		}
		return { name: existsPackage[0], version: existsPackage[1] };
	}

	/**
	 * Map component profile sources based on import statements, children components, and current package dependencies.
	 *
	 * @param importStatements - The array of import statements in the code.
	 * @param children - The array of child component tags.
	 * @param currentPackage - An object containing dependencies and devDependencies of the current package.
	 */
	mapComponentProfileSource(
		importStatements: ImportStatement[],
		children: ChildComponentTag[],
		currentPackage: {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
		}
	) {
		this.componentProfiles.forEach((ele) => {
			const { name, source: componentSource } = ele;
			const transformedTag = kebabCaseToPascalCase(name);
			// Find imported tags that match the transformed or original component tag name
			const foundImportedTags = importStatements.filter((im) =>
				im.importedNames.some((n) => {
					return (
						n?.toLowerCase() === transformedTag.toLowerCase() ||
						n?.toLowerCase() === name.toLowerCase()
					);
				})
			);
			if (!foundImportedTags?.length) {
				return;
			}

			const foundImportedTagSameSource = foundImportedTags.find((i) =>
				[i.sourcePath, i.source].includes(componentSource.path)
			);
			const foundImportedTag = foundImportedTags.find((i) =>
				i.importedNames.some(
					(e) => e?.toLowerCase() === transformedTag.toLowerCase()
				)
			);
			if (foundImportedTagSameSource || foundImportedTag) {
				const foundMapped = Object.assign(
					{},
					foundImportedTagSameSource ?? foundImportedTag
				);
				const { importSourceType, source, sourcePath, destination } =
					foundMapped;
				const existedSource = sourcePath?.length ? sourcePath : source;
				ele.type = importSourceType;
				ele.source.path = existedSource.replace(/\\/g, "/");
				ele.source.property = {
					dataLastModified: "",
					lastModified: "",
					created: "",
					createdBy: "",
					updatedBy: "",
				};
				ele.children = { total: 0, tags: [], source: "" };
				if (importSourceType === "internal") {
					children.forEach((child) => {
						if ([sourcePath, source].includes(child.source)) {
							ele.children = child;
						}
					});
				} else {
					const packageLib = this.getDependencyByName(
						currentPackage.dependencies,
						currentPackage.devDependencies,
						foundMapped.sourcePath || foundMapped.source
					);
					if (packageLib) {
						ele.type = "external";
						ele.source.package = packageLib;
					}
				}
			}
		});
	}

	/**
	 * Remove duplicate components from the given array of component profiles.
	 *
	 * @param componentProfiles - An array of component profiles to process.
	 * @returns A new array of component profiles without duplicate components.
	 */
	removeDuplicateComponents(componentProfiles: ComponentProfile[]) {
		const deletedIdxList: number[] = [];
		componentProfiles.forEach((ele, idx, arr) => {
			if (deletedIdxList.includes(idx)) {
				return;
			}
			const tagName = ele.name,
				source = ele.source.path,
				mainUsageLocations = ele.usageLocations ?? [];
			const pascalCase = kebabCaseToPascalCase(tagName);
			const kebabCase = pascalCaseToKebabCase(tagName);
			const duplicatedTagWithIndices = arr.reduce(
				(acc, curr, index) => {
					// const isTagExisted = curr.name === tagName;
					const isTagExisted = [pascalCase, kebabCase].includes(curr.name);
					const deleteIdxExisted = deletedIdxList.includes(index);
					const isSourceExisted =
						(!curr.source.path && !curr.source.package) ||
						curr.source.path === source;
					const isDuplicated =
						isTagExisted &&
						!deleteIdxExisted &&
						index !== idx &&
						isSourceExisted;
					if (isDuplicated) {
						acc.values.push(curr);
						acc.indices.push(index);
					}
					return acc;
				},
				{ values: [] as ComponentProfile[], indices: [] as number[] }
			);
			duplicatedTagWithIndices.values.forEach((dup, i) => {
				const { usageLocations, total } = dup;
				const newDetails = usageLocations?.map((e) => {
					e.source = source;
					return e;
				});
				if (newDetails?.length) {
					newDetails.forEach((newDetail) => {
						const mainDetail = mainUsageLocations.find(
							(f) => f.destination === newDetail.destination
						);
						if (!mainDetail) {
							mainUsageLocations.push(newDetail);
						} else {
							const rows = newDetail.rows;
							mainDetail.rows = [...new Set([...mainDetail.rows, ...rows])];
						}
					});
				}
				ele.total += total;
			});
			duplicatedTagWithIndices.indices.forEach((deleteIdx) => {
				deletedIdxList.push(deleteIdx);
			});
		});
		return componentProfiles.filter((_, i) => !deletedIdxList.includes(i));
	}

	/**
	 * Map component profile properties based on the provided mapping of file paths to Vue properties.
	 *
	 * @param filePathToProperties - A mapping of file paths to Vue properties.
	 */
	mapComponentProfileProps(
		filePathToProperties: Record<string, VueProperty[]>
	) {
		this.componentProfiles.forEach((ele) => {
			ele.properties = filePathToProperties[ele.source.path];
		});
	}

	/**
	 * Removes the app directory and its contents, including subdirectories and files.
	 * This operation is performed forcefully and recursively.
	 *
	 * @returns {void} This function does not return a value.
	 * @throws If an error occurs during the directory removal, an error is thrown.
	 */
	removeAppDir() {
		return rmSync(this.option.appDir, { recursive: true, force: true });
	}

	/**
	 * Write an array of component profiles to a JSON file within the specified app directory.
	 * @param componentProfiles An array of component profiles to be written to the file.
	 * @returns The path of the file where the component profiles were written.
	 *
	 */
	async writeComponentProfilesToJson(
		componentProfiles: ComponentProfile[]
	): Promise<string> {
		// Construct the path to the output file
		const outputPath = `${this.option.appDir}/component-profiles.json`;
		// Convert the component profiles to a formatted JSON string and write to the file
		return await writeResultToFile(
			outputPath,
			JSON.stringify(componentProfiles, null, 2)
		);
	}

	/**
	 * Scan the project directory for Vue components, analyzes their structure, and collects information.
	 *
	 * @returns A promise that resolves an array of component profiles.
	 */
	async scan(): Promise<ComponentProfile[]> {
		// Initialize data structures to store various information
		const filePathToProperties: Record<string, VueProperty[]> = {},
			dependencies: Record<string, string> = {},
			devDependencies: Record<string, string> = {},
			children: ChildComponentTag[] = [];
		let aliasPath: Record<string, string[]> | null = null,
			allImportStatements: ImportStatement[] = [];
		let allTraversedTags: TraversedTag[] = [];

		const componentFiles: { name: string; filePath: string }[] = [];

		/*********
		 * Step 1 *
		 *********/
		this.packageGroups = await this.groupFilesByRelatedPackageJson();
		// Iterate through each package group.
		for (const ele of this.packageGroups) {
			const { files, packageJsonPath } = ele;
			// Skip processing if no files are associated with the package group
			if (!files?.length) {
				continue;
			}
			const { dependencies: d, devDependencies: dd } =
				this.parsePackageJson(packageJsonPath);
			// Collect dependencies and devDependencies
			// These will be used in mapping component profiles source
			Object.assign(dependencies, d);
			Object.assign(devDependencies, dd);

			/*********
			 * Step 2 *
			 *********/
			const vueVersion = this.getLibVersionFromDependencies("vue", {
				dependencies: d,
				devDependencies: dd,
			});
			const nuxtVersion = this.getLibVersionFromDependencies("nuxt", {
				dependencies: d,
				devDependencies: dd,
			});
			if (nuxtVersion) {
				if (!this.checkDotNuxtExists(dirname(packageJsonPath))) {
					console.warn(
						`The .nuxt folder related to ${packageJsonPath} is missing. It's required for scanning Nuxt.js projects.`
					);
				}
			}
			const babelVersion = this.getBabelParserVersion(d, dd);

			if (vueVersion) {
				this.installVueParserLib(vueVersion);
			}
			if (babelVersion) {
				this.installBabelParserLib(babelVersion);
			}
			// Load analysis tool modules for Vue Compiler SFC and Babel Parser
			const [vueCompilerMod, babelParserMod] =
				await this.getAnalysisToolModules();

			/*********
			 * Step 3 *
			 *********/
			// Prepare alias paths for component resolution
			aliasPath = await this.prepareAliasPaths(
				packageJsonPath,
				babelParserMod as BabelParser
			);

			/*********
			 * Step 4 *
			 *********/
			// Iterate through each file in the package group
			for (const path of files) {
				allTraversedTags = [];
				const filePath = path.replace(/\\/g, "/");
				const { componentTags, importStatements, properties, deepestNested } =
					this.parseCode(filePath, {
						vueModule: vueCompilerMod as CompilerSFC,
						babelModule: babelParserMod as BabelParser,
					});
				if ([".vue", ".jsx", ".tsx"].includes(extname(filePath))) {
					// assume it is component, store all file into `componentFiles`
					const name = parse(filePath).name;
					componentFiles.push({ name, filePath });
					const vueComponent: VueComponent = {
						name,
						source: filePath,
						destination: filePath,
						rows: [],
						deepestNested,
						fileInfo: { path: "", property: null },
					};
					this.vueComponents.push(vueComponent);
				}
				// Store all import statements into `allImportStatements`
				if (importStatements?.length) {
					allImportStatements = this.updateImportStatementsWithTransformedPaths(
						allImportStatements,
						importStatements,
						aliasPath
					);
				}
				// Store Vue properties based on file paths
				if (properties?.length) {
					Object.assign(filePathToProperties, { [filePath]: properties });
				}
				// Collect component tags and normalize child components
				if (componentTags?.length) {
					allTraversedTags.push(...componentTags);
					this.collectVueComponents(
						allTraversedTags,
						importStatements,
						filePath
					);
				}
				const child = this.normalizeComponentChildTag(filePath, componentTags);
				children.push(child);
			} // End loop of files within the package group
		} // End loop of package group

		this.option.debug &&
			(await writeFileSync(
				`${this.option.appDir}/componentFiles.json`,
				JSON.stringify(componentFiles, null, 2)
			));

		this.option.debug &&
			(await writeFileSync(
				`${this.option.appDir}/vueComponents.json`,
				JSON.stringify(this.vueComponents, null, 2)
			));

		/*********
		 * Step 5 *
		 *********/
		// Remove duplicate import statements
		allImportStatements = this.distinctImportStatements(allImportStatements);
		this.option.debug &&
			(await writeFileSync(
				`${this.option.appDir}/distinctedAllImportStatements.json`,
				JSON.stringify(allImportStatements, null, 2)
			));
		// Group component sources by name and source path.
		const groupedComponentSources = groupBy(this.vueComponents, (item) => {
			if (!item.source) {
				return item.name;
			}
			return `${item.name}__${item.source}`;
		});

		this.option.debug &&
			(await writeFileSync(
				`${this.option.appDir}/groupedComponentSources.json`,
				JSON.stringify(groupedComponentSources, null, 2)
			));

		// Revises a grouped object of component sources by merging entries with similar keys.
		const revisedGroupedComponentSources = Object.entries(
			groupedComponentSources
		).reduce(
			(acc, [key, value]) => {
				// Split the key into tagName and sourcePath
				const [tagName, sourcePath] = key.split("__");
				// Convert tagName to kebab-case and camelCase
				const kebabCase = pascalCaseToKebabCase(tagName);
				const pascalCase = kebabCaseToPascalCase(tagName);
				// Find an existing key that matches either kebab-case or pascalCase
				const foundKey = Object.keys(acc).find((k) =>
					[
						`${kebabCase}__${sourcePath}`,
						`${pascalCase}__${sourcePath}`,
					].includes(k)
				);
				// If a matching key is found, merge the values; otherwise, create a new entry
				if (foundKey) {
					acc[foundKey] = acc[foundKey].concat(value);
				} else {
					acc[key] = value;
				}
				return acc;
			},
			{} as Record<string, VueComponent[]>
		);
		// Create component profiles from grouped sources.
		this.componentProfiles = Object.entries(revisedGroupedComponentSources).map(
			(ele) => {
				const vueComponents = ele[1];
				const { name, fileInfo, source, deepestNested } = vueComponents.at(0)!;
				fileInfo.path = source;
				const total = vueComponents.reduce((sum, i) => {
					sum += i.rows.length;
					return sum;
				}, 0);
				return {
					name,
					type: existsSync(source) ? "internal" : null,
					total,
					deepestNested,
					source: fileInfo,
				} as ComponentProfile;
			}
		);
		this.option.debug &&
			(await writeFileSync(
				`${this.option.appDir}/revisedGroupedComponentSources.json`,
				JSON.stringify(revisedGroupedComponentSources, null, 2)
			));
		this.componentProfiles.forEach((ele, idx, arr) => {
			const tagName = ele.name,
				source = ele.source.path;
			// Create a unique key for the component based on the tagName and source path
			const key = source ? `${tagName}__${source}` : tagName;
			// Find usage locations for the component based on the key
			const foundUsageLocations = revisedGroupedComponentSources[key];
			// Find the import statement that includes the `usage` key associated with the component
			const foundImportWithUsage = allImportStatements.find(
				({ importedNames, usage, source: src, sourcePath }) =>
					importedNames.includes(tagName) &&
					usage &&
					source &&
					[src, sourcePath].includes(source)
			);
			// Initialize the component's usageLocations property with foundUsageLocations
			arr[idx].usageLocations =
				foundUsageLocations.filter((ele) => ele.rows.length) ?? [];
			// If there's a foundImportWithUsage, add it to the component's usageLocations
			if (foundImportWithUsage) {
				const tmpVueComponent = {
					name: "",
					source:
						foundImportWithUsage.sourcePath ?? foundImportWithUsage.source,
					destination: foundImportWithUsage.destination,
					rows: foundImportWithUsage.usage!.lines[
						foundImportWithUsage.destination
					],
				} as VueComponent;
				arr[idx].usageLocations!.push(tmpVueComponent);
			}
		});

		this.mapComponentProfileSource(allImportStatements, children, {
			dependencies,
			devDependencies,
		});
		this.componentProfiles = this.removeDuplicateComponents(
			this.componentProfiles
		);
		this.mapComponentProfileProps(filePathToProperties);
		if (existsSync(join(this.scanPath, ".git"))) {
			// Use Git Scan
			new GitService(this.option.appDir, this.scanPath).scan();
		}

		if (this.option?.output) {
			switch (this.option.output) {
				case "json":
					await this.writeComponentProfilesToJson(this.componentProfiles);
					break;
				case "stdout":
					console.log(this.componentProfiles);
					break;
				default:
					break;
			}
		}
		return this.componentProfiles;
	}
}