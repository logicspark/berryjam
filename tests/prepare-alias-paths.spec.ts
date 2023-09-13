import { getSupportedFiles } from "../src/utils/file.utils";
import { existsSync, readFileSync, mkdirSync } from "fs";
import CompilerSFC from "@vue/compiler-sfc";
import BabelParser from "@babel/parser";
import VueScanner from "../src";
import {
	getCodeConfigCompilerOptionPaths,
	getViteAliasPaths,
} from "../src/utils/module.utils";

let directory: string;
let checkNuxtExistsOutput: boolean;
let dependencies: Record<string, string> = {};
let vueScanner: VueScanner;
let packageJsonPath: string;

beforeEach(() => {
	directory = `${__dirname}/example/example-scan-project`.replace(/\\/g, "/");
	checkNuxtExistsOutput = false;
	vueScanner = new VueScanner(directory, { appDir: directory });
	packageJsonPath = `${directory}/package.json`;
});


/**
 * Prepare Alias Paths
 * To gather all aliases from TS, JS and Vite config files to use for replacement in the 'import' statements.
 */
describe("Get JS and TS alias paths", () => {
	it("should be an object", async () => {
		packageJsonPath = `${directory}/package.json`;
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const received = await vueScanner.prepareAliasPaths(
			packageJsonPath,
			babelParserMod as typeof BabelParser
		);
		expect(dependencies).toBeInstanceOf(Object);
	});
});

/**
 * Collect an alias list such as @, ~ together with its prefix path from JS and TS config files.
 */
describe("Get Vite alias paths", () => {
	it("should be an object", async () => {
		let aliasPaths = await getCodeConfigCompilerOptionPaths(packageJsonPath);
		expect(aliasPaths).toBeInstanceOf(Object);
	});
});

/**
 * Collect an alias list such as @, ~ together with its prefix path from Vite config file (if any).
 */
describe("Get Vite alias paths", () => {
	it("should be a null", async () => {
		const [vueCompilerMod, babelParserMod] =
			await vueScanner.getAnalysisToolModules();
		const vitePath = await getViteAliasPaths(
			packageJsonPath,
			babelParserMod.parse as () => BabelParser.ParseResult<any>
		);
		expect(vitePath).toBe(null);
	});
});
