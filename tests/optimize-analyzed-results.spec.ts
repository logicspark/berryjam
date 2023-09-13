import { getSupportedFiles } from "../src/utils/file.utils";
import { existsSync, readFileSync, mkdirSync } from "fs";
import VueScanner, { ChildComponentTag, ImportStatement } from "../src";
import CompilerSFC from "@vue/compiler-sfc";
import BabelParser from "@babel/parser";

let directory: string;
let ignorePatterns: string[];
let getSupportedFilesOutput: string[];
let checkNuxtExistsOutput: boolean;
let vueScanner: VueScanner;
let packageJsonPath: string;
let allImportStatements: ImportStatement[];
let dependencies: Record<string, string> = {};
let devDependencies: Record<string, string> = {};

beforeEach(() => {
	directory = `${__dirname}/example`.replace(/\\/g, "/");
	ignorePatterns = [];
	getSupportedFilesOutput = [];
	allImportStatements = [];
	checkNuxtExistsOutput = false;
	vueScanner = new VueScanner(directory, { appDir: directory });
	packageJsonPath = `${directory}/package.json`;
});

/**
 * Optimize Analyzed Results
 * Based on the component info, improve by removing duplicates and format the component profile in a more structured way.
 */

/**
 * Distinct import statements and categorize whether the statement is from internal or external origins.
 */
describe("Distinct import statements", () => {
	it("should be an array", () => {
		const received = vueScanner.distinctImportStatements(allImportStatements);
		expect(received).toBeInstanceOf(Array);
	});
});

/**
 * Distinct vue components and recount the total number of components.
 */
describe("Revise Vue components", () => {
	/**
	 * function mapImportStatements
	 * Use results from function ReviseImportStatements and update into each Vue component.
	 */
	it("should be an object", async () => {
		packageJsonPath = `${directory}/package.json`;
		const depen = vueScanner.parsePackageJson(packageJsonPath);
		dependencies = depen.dependencies;
		devDependencies = depen.devDependencies;
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const aliasPath = await vueScanner.prepareAliasPaths(
			packageJsonPath,
			babelParserMod as typeof BabelParser
		);
		const filePath = `${directory}/example-tsx/AHook.tsx`;
		const { componentTags, importStatements, properties } =
			vueScanner.parseCode(filePath, {
				vueModule: vueCompilerMod as typeof CompilerSFC,
				babelModule: babelParserMod as typeof BabelParser,
			});
		if (importStatements) {
			const received = vueScanner.updateImportStatementsWithTransformedPaths(
				allImportStatements,
				importStatements,
				aliasPath
			);
		}
		const children: ChildComponentTag[] = [];
		vueScanner.mapComponentProfileSource(allImportStatements, children, {
			dependencies,
			devDependencies,
		});
		console.log("allImportStatements", allImportStatements);
		console.log("dependencies", dependencies);
		console.log("devDependencies", devDependencies);

		expect(dependencies).toBeInstanceOf(Object);
		expect(devDependencies).toBeInstanceOf(Object);
		expect(allImportStatements).toBeInstanceOf(Array);
		expect(allImportStatements).toHaveLength(0);
	});

	/**
	 * function mapProps
	 * Use results from the global variable that contains vue component props and update into each Vue component.
	 */
	it("should be an object", async () => {
		packageJsonPath = `${directory}/package.json`;
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const aliasPath = await vueScanner.prepareAliasPaths(
			packageJsonPath,
			babelParserMod as typeof BabelParser
		);
		const filePath = `${directory}/example-tsx/AHook.tsx`;
		const { componentTags, importStatements, properties } =
			vueScanner.parseCode(filePath, {
				vueModule: vueCompilerMod as typeof CompilerSFC,
				babelModule: babelParserMod as typeof BabelParser,
			});
		const filePathToProperties = {};
		Object.assign(filePathToProperties, { [filePath]: properties });
		const received = filePathToProperties;
		vueScanner.mapComponentProfileProps(filePathToProperties);
		expect(received).toBeInstanceOf(Object);
	});

	/**
	 * function removeDuplicateComponents
	 * After mapping import statements, there may still be Vue components with the same source so we will need to distinct them.
	 */
	it("should be an array", () => {
		const received = vueScanner.removeDuplicateComponents([]);
		expect(received).toBeInstanceOf(Array);
	});
});
