import { getSupportedFiles } from "../src/utils/file.utils";
import { existsSync, readFileSync, mkdirSync } from "fs";
import VueScanner, { ComponentProfile, ImportStatement } from "../src";
import {
	parseComponentsDeclaration,
	parseJs,
	parseJsx,
	parseNuxtGlobalTypes,
	parseTypescript,
	parseVue,
} from "../src/utils/compiler";
import { resolve, join, dirname, extname, basename } from "path";
import CompilerSFC from "@vue/compiler-sfc";
import BabelParser from "@babel/parser";

let directory: string;
let ignorePatterns: string[];
let getSupportedFilesOutput: string[];
let checkNuxtExistsOutput: boolean;
let vueScanner: VueScanner;
let packageJsonPath: string;
let allImportStatements: ImportStatement[];

type BabelParseFunc = () => BabelParser.ParseResult<any>;

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
 * Analyze Component Files
 * For each file extension, the system will gather component info, including props.
 */

/**
 * If it is a `.vue` file, the system will use vue/compiler-sfc to parse codes into an Abstract Syntax Tree (AST)
 * which will be transformed into component information.
 */
describe("Parse .vue file", () => {
	it("should be an object", async () => {
		const filePath = `${directory}/example-vue/AVueComposition.vue`;
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const received = parseVue(
			filePath,
			vueCompilerMod.parse as unknown as () => CompilerSFC.SFCParseResult,
			babelParserMod.parse as unknown as BabelParseFunc
		);
		expect(received).toBeInstanceOf(Object);
	});
});

/**
 * If it is a `.js` file (both ES Module and CommonJS Module), the system will use @babel/parser to parse codes into AST format
 * which will be transformed into component information.
 */
describe("Parse .js file", () => {
	it("should be an object", async () => {
		const filePath = `${directory}/example-js/AJsOption.js`; //ES Module
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const received = parseJs(filePath, babelParserMod.parse as BabelParseFunc);
		expect(received).toBeInstanceOf(Object);
	});

	it("should be an object", async () => {
		const filePath = `${directory}/example-js/CJsOption.js`; // CommonJS Module
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const received = parseJs(filePath, babelParserMod.parse as BabelParseFunc);
		expect(received).toBeInstanceOf(Object);
	});
});

/**
 * If it is a `.jsx file`, the system will use @babel/parser to parse codes into AST format
 * which will be transformed into component information.
 */
describe("Parse .jsx file", () => {
	it("should be an object", async () => {
		const filePath = `${directory}/example-jsx/AHook.jsx`;
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const received = parseJsx(filePath, babelParserMod.parse as BabelParseFunc);
		expect(received).toBeInstanceOf(Object);
	});
});

/**
 * If it is either a `.ts` or `.tsx` and contain a prefix `app.config.d.ts` or `components.d.ts`,
 * the system will use Typescript library to parse codes into AST format
 * which will be transforrmed into component information.
 */
describe("Parse Nuxt global types", () => {
	it("should be an object", () => {
		const filePath = `${directory}/example-ts/ATsOption.ts`;
		const received = parseNuxtGlobalTypes(filePath);
		expect(received).toBeInstanceOf(Object);
	});
});

/**
 * If it is either a `.ts` or `.tsx` and contain file prefix `.d` but does not contain prefix `app.config.d.ts`
 * or `components.d.ts`, the system will use @babel/parser to parse codes into AST format
 * which will be transforrmed into component information.
 */
describe("Parse component declaration", () => {
	it("should be a null", async () => {
		const filePath = `${directory}/example-scan-project/shims-vue.d.ts`;
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const received = parseComponentsDeclaration(
			filePath,
			babelParserMod.parse as BabelParseFunc
		);
		expect(received).toBe(null);
	});
});

/**
 * If it is either a `.ts` or .`tsx` and the file prefix does not have `.d`, the system will
 * use Typescript library to parse codes into AST format
 * which will be transformed into component information.
 */
describe("Parse TypeScript files", () => {
	it("should be an object", async () => {
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const filePath = `${directory}/example-tsx/AHook.tsx`;
		const received = parseTypescript(filePath, ".tsx", babelParserMod.parse);
		expect(received).toBeInstanceOf(Object);
	});
});

/**
 * Using outputs from both function PrepareAliasPath and importStatements, the function will replace alias
 *  with corresponding prefix path and add new records into a global variable which will be used later.
 */
describe("Update import statements with transformed paths", () => {
	it("should have an more than 1", async () => {
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
		expect(allImportStatements).not.toHaveLength(1);
		expect(importStatements).toBeNull;
	});
});

/**
 * For each Vue component in the component info, the system will convert component name from `Kebab` case to `Pascal` case.
 * Then, the said component will be checked against the global variable which contains a list of Vue components.
 * - If either the tag or source does not match, add a new record to the list.
 * - If both the tag and source are identical, add a new item to the `rows` key of
 * - `VueComponent` interface of the corresponding Vue component from the list
 */
describe("Normalize Vue components", () => {
	it("should be an object", async () => {
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
		const received = vueScanner.nomalizeComponentChildTag(
			filePath,
			componentTags
		);
		expect(received).toBeInstanceOf(Object);
	});
});

/**
 * To gather unique component tags which will be used to map components' children when applicable.
 */
describe("Remove duplicate components", () => {
	it("should have 1 object", () => {
		const componentProfiles: ComponentProfile[] = [];
		// Push 1st object
		componentProfiles.push({
			name: "Button",
			type: "internal",
			total: 0,
			source: {
				path: "C:/projects/berryjam-cli/public/Components/Header.js",
				property: {
					dataLastModified: "Fri Apr 28 2023",
					lastModified: "Fri Apr 28 2023",
					created: "2023-04-17T04:04:04.000Z",
					createdBy: "system",
					updatedBy: "system",
				},
			},
			properties: [],
			usageLocations: [],
			groups: [],
			children: { total: 1, tags: ["Button"], source: "" },
		},
			// Push 2nd object
			{
				name: "Button",
				type: "internal",
				total: 0,
				source: {
					path: "C:/projects/berryjam-cli/public/Components/Header.js",
					property: {
						dataLastModified: "Fri Apr 28 2023",
						lastModified: "Fri Apr 28 2023",
						created: "2023-04-17T04:04:04.000Z",
						createdBy: "system",
						updatedBy: "system",
					},
				},
				properties: [],
				usageLocations: [],
				groups: [],
				children: { total: 1, tags: ["Button"], source: "" },
				deepestNested: 0,
			});

		const received = vueScanner.removeDuplicateComponents(componentProfiles);
		expect(received).toHaveLength(1);
	});
});
