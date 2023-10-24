import { getEndOfLine, getFileInfo } from "../src/utils/file.utils";

let directory: string;

beforeEach(() => {
	directory = `${__dirname}/example`.replace(/\\/g, "/");
});

describe("Parse .jsx file.The output must be the number of lines of the file", () => {
	const endOfLineFileTest = 15;
	it(`should be an number ${endOfLineFileTest}`, async () => {
		const filePath = `${directory}/example-jsx/Example.jsx`;
		const { fileContent } = getFileInfo(filePath);
		const endOfLines = getEndOfLine(fileContent);
		expect(endOfLines).toBe(endOfLineFileTest);
	});
});

describe("Parse .vue file.The output must be the number of lines of the file", () => {
	const endOfLineFileTest = 15;
	it(`should be an number ${endOfLineFileTest}`, async () => {
		const filePath = `${directory}/example-vue/AVueComposition.vue`;
		const { fileContent } = getFileInfo(filePath);
		const endOfLines = getEndOfLine(fileContent);
		expect(endOfLines).toBe(endOfLineFileTest);
	});
});

describe("Parse .ts file.The output must be the number of lines of the file", () => {
	const endOfLineFileTest = 6;
	it(`should be an number ${endOfLineFileTest}`, async () => {
		const filePath = `${directory}/example-ts/ATsOption.ts`;
		const { fileContent } = getFileInfo(filePath);
		const endOfLines = getEndOfLine(fileContent);
		expect(endOfLines).toBe(endOfLineFileTest);
	});
});
