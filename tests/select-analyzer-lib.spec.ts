import { getSupportedFiles } from "../src/utils/file.utils";
import { existsSync, readFileSync, mkdirSync } from "fs";
import VueScanner from "../src";

let directory: string;
let ignorePatterns: string[];
let getSupportedFilesOutput: string[];
let checkNuxtExistsOutput: boolean;
let dependencies: Record<string, string> = {};
let devDependencies: Record<string, string> = {};
let vueScanner: VueScanner;

beforeEach(() => {
	directory = `${__dirname}/example/example-scan-project`.replace(/\\/g, "/");
	ignorePatterns = [];
	getSupportedFilesOutput = [];
	checkNuxtExistsOutput = false;
	vueScanner = new VueScanner(directory, { appDir: directory });
});

/**
 * To choose the right library that matches the Vue version of your project.
 * To read package.json to check for Vue and Babel versions. If either or both exist, the lib(s) will be installed in your local machine's root directory
 */
describe("Get dependencies", () => {
	// ParsePackageJson
	it("should be an object", () => {
		const expected = Object;
		const packageJsonPath = `${directory}/package.json`;
		const received = vueScanner.parsePackageJson(packageJsonPath);
		dependencies = received.dependencies;
		devDependencies = received.devDependencies;
		expect(dependencies).toBeInstanceOf(expected);
		expect(devDependencies).toBeInstanceOf(expected);
	});

	it("should be an object", async () => {
		const expected = Object;
		const received = await vueScanner.getDependencyByName(
			dependencies,
			devDependencies,
			"vue"
		);
		expect(dependencies).toBeInstanceOf(expected);
	});
});

/**
 * To select libs to use for component analysis with the following criteria.
 * i. If the root directory contains both installed libs, select from these two.
 * ii. If the root directory contains only one of the two, select the available one and select
 * the other lib installed from Berryjam Scan's dependencies.
 * iii. If the root directory does not contain any, select the libs installed from Berryjam's dependencies.
 */
describe("Get the right Vue Complier and Babel", () => {
	it("should be an array", async () => {
		const expected = Array;
		const received = await vueScanner.getAnalysisToolModules();
		expect(received).toBeInstanceOf(Array);
	});

	it("should have 2 modules in the result", async () => {
		const expected = 2;
		const received = await vueScanner.getAnalysisToolModules();
		expect(received).toHaveLength(expected);
	});
});
